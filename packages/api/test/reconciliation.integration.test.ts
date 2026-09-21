/**
 * 照合画面 API の結合テスト (SYS-RECON-P04 で先に書く赤いテスト。実装は SYS-RECON-P05)。
 *
 * 契約として固定するもの:
 * - まとめた判断の成功は 200 と件ごとの結果 (部分成功を許す)。201 件以上は 400
 * - 取り消しは最新の操作だけ。他人の操作 id は 404、取り消し済みは 409、最新でなければ 409
 * - 取り消しは、操作の後に同じ行が書き換わっていれば 409 (action_stale)。形の違う id は 400
 * - 「同じ取引」は照合の規則で組める freee を名指ししたときだけ保存する (no_candidate / freee_not_pairable)
 * - 照合・総収支・ハブ・概況の要確認件数は MF 除外を反映しても一致する
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { splitMigrationStatements } from '../src/migration-test-support.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const request = (path: string, init: RequestInit = {}, withCookie = true) =>
  app.request(
    `/api${path}`,
    { ...init, headers: { ...(withCookie ? { cookie } : {}), ...(init.headers ?? {}) } },
    { ...auth, DB: database },
  );

const postJson = (path: string, body: unknown, withCookie = true) =>
  request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    withCookie,
  );

type Target = { txId?: string; freeeKey?: string };
const OTHER_ACTION_ID = '00000000-0000-4000-8000-000000000001';
const MISSING_ACTION_ID = '00000000-0000-4000-8000-000000000002';
const BROKEN_ACTION_ID = '00000000-0000-4000-8000-000000000003';
const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;
const countRows = async (sql: string) => (await database.prepare(sql).first<{ n: number }>())?.n ?? 0;
const act = (action: string, targets: Target[]) => postJson('/reconciliation/actions', { action, targets });

type Row = {
  txId: string;
  status: string;
  matchedBy?: string | null;
  queues: string[];
  freee: { freeeKey: string; partner?: string; amount?: number } | null;
  candidateKeys: string[];
  excludedBy: string | null;
};
type ReconciliationBody = {
  kpi: {
    actionRequiredCount: number;
    reviewCount: number;
    mfOnlyCount: number;
    resolutionRate: number | null;
    businessExpense: number;
  };
  statusCounts: Record<string, number>;
  rows: Row[];
  unmatchedFreee: Array<{ freeeKey: string; partner: string }>;
  lastAction: { id: string; action: string; targetCount: number; createdAt: string } | null;
};
type ActionBody = {
  action: { id: string; action: string; targetCount: number } | null;
  saved: number;
  results: Array<{ txId: string | null; freeeKey: string | null; ok: boolean; reason?: string }>;
};

const getReconciliation = async () =>
  (await (await request('/reconciliation?from=2026-08&to=2026-08')).json()) as ReconciliationBody;
const rowOf = (body: ReconciliationBody, txId: string) => body.rows.find((row) => row.txId === txId);

/** 照合・総収支・ハブ・概況の 4 つが数える要確認件数 */
async function reviewCounts() {
  const recon = await getReconciliation();
  const cashflow = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as {
    review: unknown[];
  };
  const hub = (await (await request('/analysis/hub?from=2026-08&to=2026-08')).json()) as {
    views: { reconciliation: { count: number } };
  };
  const queue = (await (await request('/review-queue')).json()) as { counts: { reconciliation: number } };
  return {
    reconciliation: recon.kpi.actionRequiredCount,
    totalCashflow: cashflow.review.length,
    hub: hub.views.reconciliation.count,
    overview: queue.counts.reconciliation,
  };
}

/** 中項目を「事業」で始め、相手の無い MF 明細を「MFのみ (事業の支出)」として数えさせる */
async function insertMf(rows: Array<{ txId: string; date: string; description: string; amount: number }>) {
  for (const row of rows) {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,institution,is_target,is_transfer,identity_stable)
         VALUES ('default',?1,'2026-08',?2,?3,?4,'事業経費','事業通信費','架空事業カード',1,0,1)`,
      )
      .bind(row.txId, row.date, row.description, row.amount)
      .run();
  }
}

async function insertFreee(rows: Array<{ month?: string; date: string; partner: string; amount: number }>) {
  for (const row of rows) {
    await database
      .prepare(
        `INSERT INTO freee_deals
          (user_id,month,date,io,partner,account_raw,account_norm,amount)
         VALUES ('default',?1,?2,'expense',?3,'通信費','サブスク・通信',?4)`,
      )
      .bind(row.month ?? '2026-08', row.date, row.partner, row.amount)
      .run();
  }
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'reconciliation',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });

  await database
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300),
        ('default','2026-08','2026-08-10','expense','架空文具店','消耗品費','消耗品費',1200),
        ('default','2026-08','2026-08-20','expense','架空交通','旅費交通費','旅費交通費',5000),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999)`,
    )
    .run();
  await insertMf([
    // 2 日ずれ: 要確認 (日付の近い取引)
    { txId: 'mf-review', date: '2026-08-07', description: '架空クラウド', amount: -3300 },
    // 同日同額: 自動で照合済み
    { txId: 'mf-matched', date: '2026-08-10', description: '架空文具店', amount: -1200 },
    // 相手なし: MFのみ (MF の金額で総収支に計上済み。対応は要らない)
    { txId: 'mf-only', date: '2026-08-25', description: '架空書店', amount: -800 },
  ]);
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('認証', () => {
  it('未ログインは 3 本とも 401', async () => {
    expect((await request('/reconciliation', {}, false)).status).toBe(401);
    expect(
      (await postJson('/reconciliation/actions', { action: 'same', targets: [{ txId: 'x' }] }, false)).status,
    ).toBe(401);
    expect((await postJson('/reconciliation/actions/any/undo', {}, false)).status).toBe(401);
  });
});

describe('GET /reconciliation', () => {
  it('状態・キュー・KPI を返し、直前の操作はまだ無い', async () => {
    const body = await getReconciliation();
    expect(rowOf(body, 'mf-review')).toMatchObject({ status: 'review', queues: ['review', 'nearDate'] });
    expect(rowOf(body, 'mf-matched')).toMatchObject({ status: 'matched' });
    expect(rowOf(body, 'mf-only')).toMatchObject({ status: 'mfOnly', queues: ['mfOnly'], freee: null });
    expect(body.kpi.reviewCount).toBe(1);
    expect(body.kpi.actionRequiredCount).toBe(1);
    expect(body.kpi.mfOnlyCount).toBe(1);
    expect(body.statusCounts).toEqual({ unprocessed: 0, review: 1, matched: 1, mfOnly: 1, excluded: 0 });
    // MFのみは解消率の分母に入れない (照合済み 1 ÷ 照合済み 1 + 要確認 1)
    expect(body.kpi.resolutionRate).toBe(0.5);
    // 要確認の候補になっているだけの freee も、まだどの MF とも組んでいないので下段に並ぶ
    expect(body.unmatchedFreee).toHaveLength(2);
    expect(body.lastAction).toBeNull();
  });

  it('要確認件数は照合・総収支・ハブ・概況で一致する', async () => {
    expect(await reviewCounts()).toEqual({ reconciliation: 1, totalCashflow: 1, hub: 1, overview: 1 });
  });

  it('月末の MF と翌月初 (+3日) の freee を全期間で照合し、GET とハブの件数が一致する', async () => {
    await insertMf([
      { txId: 'mf-boundary-api', date: '2026-08-31', description: '架空月境界保守', amount: -7777 },
    ]);
    await insertFreee([{ month: '2026-09', date: '2026-09-03', partner: '架空月境界保守', amount: 7777 }]);
    try {
      const reconciliation = await getReconciliation();
      const hub = (await (await request('/analysis/hub?from=2026-08&to=2026-08')).json()) as {
        views: { reconciliation: { count: number; actionRequiredCount: number; reviewCount: number } };
      };

      expect(rowOf(reconciliation, 'mf-boundary-api')).toMatchObject({ status: 'review' });
      expect(hub.views.reconciliation).toMatchObject({
        count: reconciliation.kpi.actionRequiredCount,
        actionRequiredCount: reconciliation.kpi.actionRequiredCount,
        reviewCount: reconciliation.kpi.reviewCount,
      });
    } finally {
      await database
        .prepare(`DELETE FROM mf_transactions WHERE user_id='default' AND tx_id='mf-boundary-api'`)
        .run();
      await database
        .prepare(`DELETE FROM freee_deals WHERE user_id='default' AND partner='架空月境界保守'`)
        .run();
    }
  });

  it('月次クローズの照合ステップは要確認+未処理で数え、MFのみは数えず、概況とサイドバーで同じ値になる (BR-006)', async () => {
    type Close = { closeStatus: { steps: Array<{ key: string; done: boolean; count: number | null }> } };
    const queue = (await (await request('/review-queue')).json()) as Close;
    const overview = (await (await request('/overview?scope=total')).json()) as Close;
    const step = (body: Close) => body.closeStatus.steps.find((s) => s.key === 'reconciliation');
    // 要確認 1 (mf-review) だけ。相手の無い mf-only は対応が要らないので、照合ステップを止めない
    expect(step(queue)).toEqual({ key: 'reconciliation', label: '照合', done: false, count: 1 });
    expect(step(overview)).toEqual(step(queue));
  });

  it('未処理だけが残る場合も actionRequiredCount がハブと月次クローズの正本になる', async () => {
    await database
      .prepare(
        `INSERT INTO mf_tx_exclusions
          (user_id,tx_id,stable_key,fingerprint_version,reason,created_at)
         VALUES ('default','mf-review',NULL,NULL,'テスト中だけ既存の要確認を除外','2026-09-16T00:00:00.000Z')`,
      )
      .run();
    await insertFreee([{ date: '2026-08-28', partner: '架空未処理のみ', amount: 4100 }]);
    await insertMf([
      { txId: 'mf-unprocessed-only', date: '2026-08-28', description: '架空未処理のみ', amount: -4900 },
    ]);

    try {
      const reconciliation = await getReconciliation();
      expect(rowOf(reconciliation, 'mf-unprocessed-only')).toMatchObject({ status: 'unprocessed' });
      expect(reconciliation.kpi).toMatchObject({ actionRequiredCount: 1, reviewCount: 0 });

      const hub = (await (await request('/analysis/hub?from=2026-08&to=2026-08')).json()) as {
        views: { reconciliation: { count: number; actionRequiredCount: number; reviewCount: number } };
      };
      expect(hub.views.reconciliation).toMatchObject({ count: 1, actionRequiredCount: 1, reviewCount: 0 });

      type Close = { closeStatus: { steps: Array<{ key: string; done: boolean; count: number | null }> } };
      const queue = (await (await request('/review-queue')).json()) as Close;
      const overview = (await (await request('/overview?scope=total')).json()) as Close;
      const step = (body: Close) => body.closeStatus.steps.find((value) => value.key === 'reconciliation');
      expect(step(queue)).toEqual({ key: 'reconciliation', label: '照合', done: false, count: 1 });
      expect(step(overview)).toEqual(step(queue));
    } finally {
      await database
        .prepare(`DELETE FROM mf_tx_exclusions WHERE user_id='default' AND tx_id='mf-review'`)
        .run();
      await database
        .prepare(`DELETE FROM mf_transactions WHERE user_id='default' AND tx_id='mf-unprocessed-only'`)
        .run();
      await database
        .prepare(`DELETE FROM freee_deals WHERE user_id='default' AND partner='架空未処理のみ'`)
        .run();
    }
  });
});

describe('POST /reconciliation/actions', () => {
  it('201 件は 400、未知の action も 400', async () => {
    const targets = Array.from({ length: 201 }, (_, i) => ({ txId: `mf-${i}` }));
    expect((await act('same', targets)).status).toBe(400);
    expect((await act('merge', [{ txId: 'mf-review' }])).status).toBe(400);
  });

  it('200 件ちょうどは受け付け、存在しない明細は件ごとに失敗として返す', async () => {
    const targets = Array.from({ length: 200 }, (_, i) => ({ txId: `missing-${i}` }));
    const response = await act('different', targets);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ActionBody;
    expect(body.saved).toBe(0);
    expect(body.results).toHaveLength(200);
    expect(body.results.every((result) => !result.ok && result.reason === 'not_found')).toBe(true);
    // 1 件も保存しなかった操作は履歴に残さない (取り消す対象が無い)
    expect((await getReconciliation()).lastAction).toBeNull();
  });

  it('現在の照合対象外の MF へ different / exclude-mf の古い判断を書かない', async () => {
    for (const action of ['different', 'exclude-mf'] as const) {
      const response = await act(action, [{ txId: 'mf-only' }, { txId: 'mf-matched' }]);
      expect(response.status).toBe(200);
      const body = (await response.json()) as ActionBody;
      expect(body).toMatchObject({ saved: 0, action: null });
      expect(body.results.map((result) => result.reason)).toEqual([
        'target_not_actionable',
        'target_not_actionable',
      ]);
    }
    expect(
      await countRows(
        `SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id IN ('mf-only','mf-matched')`,
      ),
    ).toBe(0);
    expect(
      await countRows(
        `SELECT COUNT(*) AS n FROM mf_tx_exclusions WHERE user_id='default' AND tx_id IN ('mf-only','mf-matched')`,
      ),
    ).toBe(0);
  });

  it('部分成功: 実在する明細だけを保存し、MF 除外で要確認が 4 画面そろって減る', async () => {
    const response = await act('exclude-mf', [{ txId: 'mf-review' }, { txId: 'missing' }]);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ActionBody;
    expect(body.saved).toBe(1);
    expect(body.results).toEqual([
      { txId: 'mf-review', freeeKey: null, ok: true },
      { txId: 'missing', freeeKey: null, ok: false, reason: 'not_found' },
    ]);
    expect(body.action).toMatchObject({ action: 'exclude-mf', targetCount: 1 });

    const after = await getReconciliation();
    expect(rowOf(after, 'mf-review')).toMatchObject({ status: 'excluded', excludedBy: 'mf' });
    expect(after.lastAction).toMatchObject({ id: body.action!.id, action: 'exclude-mf' });
    expect(await reviewCounts()).toEqual({ reconciliation: 0, totalCashflow: 0, hub: 0, overview: 0 });
  });

  it('exclude-freee は freeeKey が無ければ件ごとに失敗、あれば freee 側を外す', async () => {
    const before = await getReconciliation();
    // 相手候補になっていない freee (架空交通) を外す
    const freeeKey = before.unmatchedFreee.find((freee) => freee.partner === '架空交通')!.freeeKey;
    const response = await act('exclude-freee', [{ txId: 'mf-only' }, { freeeKey }]);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ActionBody;
    expect(body.results).toEqual([
      { txId: 'mf-only', freeeKey: null, ok: false, reason: 'freee_key_required' },
      { txId: null, freeeKey, ok: true },
    ]);
    expect((await getReconciliation()).unmatchedFreee.map((freee) => freee.freeeKey)).not.toContain(freeeKey);
  });
});

describe('POST /reconciliation/actions/:id/undo', () => {
  it('最新でない操作は 409、最新は 200 で書き戻し、再取消は 409', async () => {
    await insertFreee([
      { date: '2026-08-29', partner: '架空Undo A', amount: 1000 },
      { date: '2026-08-29', partner: '架空Undo B', amount: 2000 },
    ]);
    await insertMf([
      { txId: 'mf-undo-a', date: '2026-08-31', description: '架空Undo A', amount: -1000 },
      { txId: 'mf-undo-b', date: '2026-08-31', description: '架空Undo B', amount: -2000 },
    ]);
    const first = (await (await act('exclude-mf', [{ txId: 'mf-undo-a' }])).json()) as ActionBody;
    const second = (await (await act('different', [{ txId: 'mf-undo-b' }])).json()) as ActionBody;

    const stale = await postJson(`/reconciliation/actions/${first.action!.id}/undo`, {});
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { error: { code: string } }).error.code).toBe('action_not_latest');

    const undo = await postJson(`/reconciliation/actions/${second.action!.id}/undo`, {});
    expect(undo.status).toBe(200);
    expect(await undo.json()).toMatchObject({ ok: true, action: { id: second.action!.id } });
    const verdict = await database
      .prepare(`SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id='mf-undo-b'`)
      .first<{ n: number }>();
    expect(verdict?.n).toBe(0);
    expect(rowOf(await getReconciliation(), 'mf-undo-b')).toMatchObject({ status: 'review' });

    const again = await postJson(`/reconciliation/actions/${second.action!.id}/undo`, {});
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe('action_already_undone');
  });

  it('MF 除外の取り消しで要確認が戻り、4 画面の件数も戻る', async () => {
    await insertFreee([{ date: '2026-08-26', partner: '架空Undo復元', amount: 3100 }]);
    await insertMf([
      { txId: 'mf-undo-restore', date: '2026-08-28', description: '架空Undo復元', amount: -3100 },
    ]);
    const before = await reviewCounts();
    const excluded = (await (await act('exclude-mf', [{ txId: 'mf-undo-restore' }])).json()) as ActionBody;
    expect(rowOf(await getReconciliation(), 'mf-undo-restore')).toMatchObject({ status: 'excluded' });
    expect(await reviewCounts()).toEqual(
      Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value - 1])),
    );

    expect((await postJson(`/reconciliation/actions/${excluded.action!.id}/undo`, {})).status).toBe(200);
    expect(rowOf(await getReconciliation(), 'mf-undo-restore')).toMatchObject({ status: 'review' });
    expect(await reviewCounts()).toEqual(before);
  });

  it('MF 除外中の有効な候補は判断し直せ、取り消すと除外へ戻る', async () => {
    const decided = (await (await act('different', [{ txId: 'mf-review' }])).json()) as ActionBody;
    expect(decided.saved).toBe(1);
    expect(rowOf(await getReconciliation(), 'mf-review')).toMatchObject({
      status: 'matched',
      matchedBy: 'different',
    });

    expect((await postJson(`/reconciliation/actions/${decided.action!.id}/undo`, {})).status).toBe(200);
    expect(rowOf(await getReconciliation(), 'mf-review')).toMatchObject({
      status: 'excluded',
      excludedBy: 'mf',
    });
  });

  it('他人の操作 id と存在しない id は 404、形の違う id は照会せずに 400', async () => {
    await database
      .prepare(
        `INSERT INTO reconciliation_actions (id,user_id,action,target_count,before_json,after_json,created_at)
         VALUES ('${OTHER_ACTION_ID}','other-user','same',1,'{}','{}','2999-01-01T00:00:00.000Z')`,
      )
      .run();
    const other = await postJson(`/reconciliation/actions/${OTHER_ACTION_ID}/undo`, {});
    expect(other.status).toBe(404);
    expect(((await other.json()) as { error: { code: string } }).error.code).toBe('action_not_found');
    expect((await postJson(`/reconciliation/actions/${MISSING_ACTION_ID}/undo`, {})).status).toBe(404);
    const malformed = await postJson('/reconciliation/actions/nope/undo', {});
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { error: { code: string } }).error.code).toBe('invalid_action_id');
  });
});

describe('操作の記録の保持', () => {
  it('90 日より古い記録は次の操作で消え、90 日以内は残る', async () => {
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 89 * 86_400_000).toISOString();
    await database
      .prepare(
        `INSERT INTO reconciliation_actions (id,user_id,action,target_count,before_json,after_json,created_at) VALUES
          ('old-action','default','same',1,'{}','{}',?1),
          ('recent-action','default','same',1,'{}','{}',?2)`,
      )
      .bind(old, recent)
      .run();
    const cleanup = (await (await act('exclude-mf', [{ txId: 'mf-undo-b' }])).json()) as ActionBody;
    expect(cleanup.saved).toBe(1);
    const ids = await database
      .prepare(
        `SELECT id FROM reconciliation_actions WHERE user_id='default' AND id IN ('old-action','recent-action')`,
      )
      .all<{ id: string }>();
    expect(ids.results.map((row) => row.id)).toEqual(['recent-action']);
    expect((await postJson(`/reconciliation/actions/${cleanup.action!.id}/undo`, {})).status).toBe(200);
  });
});

describe('月次レビュー API (既存 0040 を再利用)', () => {
  it('PUT は 200 と reviewedAt、DELETE は 204', async () => {
    const put = await request('/monthly-close/2026-08/review', { method: 'PUT' });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ month: '2026-08' });
    expect((await request('/monthly-close/2026-08/review', { method: 'DELETE' })).status).toBe(204);
  });
});

describe('レビュー是正: 金額違いの照合・候補の検証・重複指定・取り消しの安全', () => {
  it('freee候補の無い要確認は「別の取引」にせず、除外とUndoはできる', async () => {
    await insertMf([
      {
        txId: 'mf-review-without-candidate',
        date: '2026-09-01',
        description: '架空表示月不一致',
        amount: -6600,
      },
    ]);
    let unexpectedActionId: string | null = null;
    try {
      const before = await getReconciliation();
      expect(rowOf(before, 'mf-review-without-candidate')).toMatchObject({
        status: 'review',
        freee: null,
        candidateKeys: [],
        reviewReason: '取込月と表示日の月が一致しません',
      });

      const different = (await (
        await act('different', [{ txId: 'mf-review-without-candidate' }])
      ).json()) as ActionBody;
      unexpectedActionId = different.action?.id ?? null;
      expect(different).toMatchObject({ saved: 0, action: null });
      expect(different.results[0]).toMatchObject({ ok: false, reason: 'no_candidate' });

      const excluded = (await (
        await act('exclude-mf', [{ txId: 'mf-review-without-candidate' }])
      ).json()) as ActionBody;
      expect(excluded.saved).toBe(1);
      expect(rowOf(await getReconciliation(), 'mf-review-without-candidate')).toMatchObject({
        status: 'excluded',
        excludedBy: 'mf',
      });
      expect((await postJson(`/reconciliation/actions/${excluded.action!.id}/undo`, {})).status).toBe(200);
      expect(rowOf(await getReconciliation(), 'mf-review-without-candidate')).toMatchObject({
        status: 'review',
        freee: null,
      });
    } finally {
      if (unexpectedActionId) {
        await postJson(`/reconciliation/actions/${unexpectedActionId}/undo`, {});
      }
      await database
        .prepare(
          `DELETE FROM duplicate_verdicts WHERE user_id='default' AND tx_id='mf-review-without-candidate'`,
        )
        .run();
      await database
        .prepare(
          `DELETE FROM mf_tx_exclusions WHERE user_id='default' AND tx_id='mf-review-without-candidate'`,
        )
        .run();
      await database
        .prepare(
          `DELETE FROM mf_transactions WHERE user_id='default' AND tx_id='mf-review-without-candidate'`,
        )
        .run();
    }
  });

  it('金額の差異の行で相手を名指しした「同じ取引」は照合済みになり、他人の freee は混ざらない', async () => {
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
          ('default','2026-08','2026-08-15','expense','架空ホスティング','通信費','サブスク・通信',2000)`,
      )
      .run();
    await insertMf([{ txId: 'mf-diff', date: '2026-08-16', description: '架空ホスティング', amount: -2300 }]);

    const before = await getReconciliation();
    const row = rowOf(before, 'mf-diff')!;
    expect(row).toMatchObject({
      status: 'unprocessed',
      freee: { partner: '架空ホスティング', amount: 2000 },
    });
    expect(row.queues).toContain('amountMismatch');
    // 他人の freee 取引 (999,999 円) は相手にも下段にも事業支出にも出ない
    const partners = [
      ...before.rows.map((r) => r.freee?.partner),
      ...before.unmatchedFreee.map((freee) => freee.partner),
    ];
    expect(partners).not.toContain('別ユーザー');
    expect(before.kpi.businessExpense).toBeLessThan(999_999);

    const response = await act('same', [{ txId: 'mf-diff', freeeKey: row.freee!.freeeKey }]);
    const body = (await response.json()) as ActionBody;
    expect(body.results).toEqual([{ txId: 'mf-diff', freeeKey: row.freee!.freeeKey, ok: true }]);
    const after = await getReconciliation();
    expect(rowOf(after, 'mf-diff')).toMatchObject({ status: 'matched', matchedBy: 'user' });
    expect(after.unmatchedFreee.map((freee) => freee.partner)).not.toContain('架空ホスティング');
  });

  it('候補の無い「同じ」は no_candidate、組めない相手・他人の鍵は保存しない', async () => {
    await insertFreee([{ date: '2026-08-11', partner: '架空検証対象', amount: 6100 }]);
    await insertMf([
      { txId: 'mf-action-validation', date: '2026-08-08', description: '架空検証対象', amount: -6100 },
    ]);
    const hosting = rowOf(await getReconciliation(), 'mf-diff')!.freee!.freeeKey;
    const response = await act('same', [
      { txId: 'mf-action-validation' },
      // 08-08 の明細に 08-15 の freee (7 日ずれ) を名指し
      { txId: 'mf-action-validation', freeeKey: hosting },
      { txId: 'mf-action-validation', freeeKey: 'other-user-freee-key' },
    ]);
    const body = (await response.json()) as ActionBody;
    expect(body.saved).toBe(0);
    expect(body.results.map((result) => result.reason)).toEqual([
      'no_candidate',
      'freee_not_pairable',
      'freee_not_found',
    ]);
    expect(
      await countRows(
        `SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id='mf-action-validation'`,
      ),
    ).toBe(0);
  });

  it('1 回に同じ明細を二度送ると、後の件は duplicate_target で失敗として返す', async () => {
    await insertFreee([{ date: '2026-08-21', partner: '架空重複対象', amount: 6200 }]);
    await insertMf([
      { txId: 'mf-duplicate-target', date: '2026-08-23', description: '架空重複対象', amount: -6200 },
    ]);
    const response = await act('different', [
      { txId: 'mf-duplicate-target' },
      { txId: 'mf-duplicate-target' },
    ]);
    const body = (await response.json()) as ActionBody;
    expect(body.saved).toBe(1);
    expect(body.results.map((result) => [result.ok, result.reason])).toEqual([
      [true, undefined],
      [false, 'duplicate_target'],
    ]);
    expect((await postJson(`/reconciliation/actions/${body.action!.id}/undo`, {})).status).toBe(200);
  });

  it('判定器で組めない「同じ」は保存せず理由を返す (除外済み・取られ済み・同じ回の取り合い)', async () => {
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
          ('default','2026-08','2026-08-02','expense','架空ドメイン','通信費','サブスク・通信',1500),
          ('default','2026-08','2026-08-02','expense','架空メール','通信費','サブスク・通信',900),
          ('default','2026-08','2026-08-03','expense','架空サーバ','通信費','サブスク・通信',4000)`,
      )
      .run();
    await insertMf([
      // 同日同額で自動照合される
      { txId: 'mf-dom-auto', date: '2026-08-02', description: '架空ドメイン', amount: -1500 },
      { txId: 'mf-dom-late', date: '2026-08-03', description: '架空ドメイン管理', amount: -1600 },
      { txId: 'mf-mail', date: '2026-08-02', description: '架空メール', amount: -950 },
      { txId: 'mf-srv-a', date: '2026-08-03', description: '架空サーバ東京', amount: -4100 },
      { txId: 'mf-srv-b', date: '2026-08-02', description: '架空サーバ大阪', amount: -4200 },
    ]);
    const before = await getReconciliation();
    const domainKey = rowOf(before, 'mf-dom-auto')!.freee!.freeeKey;
    const freeeKeyOf = (partner: string) =>
      before.unmatchedFreee.find((freee) => freee.partner === partner)!.freeeKey;
    const mailKey = freeeKeyOf('架空メール');
    const serverKey = freeeKeyOf('架空サーバ');
    expect((await (await act('exclude-freee', [{ freeeKey: mailKey }])).json()) as ActionBody).toMatchObject({
      saved: 1,
    });

    const body = (await (
      await act('same', [
        { txId: 'mf-dom-late', freeeKey: domainKey },
        { txId: 'mf-mail', freeeKey: mailKey },
        { txId: 'mf-srv-a', freeeKey: serverKey },
        { txId: 'mf-srv-b', freeeKey: serverKey },
      ])
    ).json()) as ActionBody;
    // 既に自動照合済み、または除外済みの相手しか持たない MF は、現在の照合対象外として先に拒否する。
    // 架空サーバは 1 件だけが未処理なので保存できる。
    expect(body.saved).toBe(1);
    expect(body.results.slice(0, 2).map((result) => result.reason)).toEqual([
      'target_not_actionable',
      'target_not_actionable',
    ]);
    const server = body.results.slice(2);
    expect(server.filter((result) => result.ok)).toHaveLength(1);
    expect(server.find((result) => !result.ok)?.reason).toBe('target_not_actionable');
    // 保存したと返した件は必ず照合済みになり、失敗と返した件は判断が残らない
    const after = await getReconciliation();
    const winner = server.find((result) => result.ok)!.txId!;
    const loser = server.find((result) => !result.ok)!.txId!;
    expect(rowOf(after, winner)).toMatchObject({ status: 'matched', matchedBy: 'user' });
    expect(rowOf(after, loser)?.status).toBe('mfOnly');
    expect(rowOf(after, 'mf-dom-late')?.status).toBe('mfOnly');
    expect(
      await countRows(
        `SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id IN ('mf-dom-late','mf-mail','${loser}')`,
      ),
    ).toBe(0);
  });

  it('新しく外した freee 取引の取り消しは、除外の行を消して下段へ戻す', async () => {
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
          ('default','2026-08','2026-08-27','expense','架空新規商店','消耗品費','消耗品費',700)`,
      )
      .run();
    const freeeKey = (await getReconciliation()).unmatchedFreee.find(
      (freee) => freee.partner === '架空新規商店',
    )!.freeeKey;
    const excluded = (await (await act('exclude-freee', [{ freeeKey }])).json()) as ActionBody;
    const excludedCount = `SELECT COUNT(*) AS n FROM freee_deal_exclusions WHERE user_id='default' AND freee_key='${freeeKey.replaceAll("'", "''")}'`;
    expect(await countRows(excludedCount)).toBe(1);

    expect((await postJson(`/reconciliation/actions/${excluded.action!.id}/undo`, {})).status).toBe(200);
    expect(await countRows(excludedCount)).toBe(0);
    expect((await getReconciliation()).unmatchedFreee.map((freee) => freee.partner)).toContain(
      '架空新規商店',
    );
  });

  it('25 件の実書き込みは文を分けて全件保存し、一括で取り消せる', async () => {
    const txIds = Array.from({ length: 25 }, (_, i) => `mf-bulk-${String(i).padStart(2, '0')}`);
    await insertMf(
      txIds.map((txId, i) => ({ txId, date: '2026-08-28', description: `架空一括${i}`, amount: -(100 + i) })),
    );
    await insertFreee(
      txIds.map((_, i) => ({ date: '2026-08-27', partner: `架空一括${i}`, amount: 1000 + i })),
    );
    const inList = txIds.map((txId) => `'${txId}'`).join(',');

    const beforeSame = await getReconciliation();
    const sameTargets = txIds.map((txId) => {
      const row = rowOf(beforeSame, txId)!;
      expect(row).toMatchObject({ status: 'unprocessed' });
      return { txId, freeeKey: row.freee!.freeeKey };
    });
    const same = (await (await act('same', sameTargets)).json()) as ActionBody;
    expect(same.saved).toBe(25);
    expect(same.results.every((result) => result.ok)).toBe(true);
    expect(
      txIds.every((txId) => {
        const row = rowOf(beforeSame, txId);
        return row?.freee?.freeeKey !== undefined;
      }),
    ).toBe(true);
    const afterSame = await getReconciliation();
    expect(
      txIds.every((txId) => {
        const row = rowOf(afterSame, txId);
        return row?.status === 'matched' && row.matchedBy === 'user';
      }),
    ).toBe(true);
    const verdictCount = `SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id IN (${inList})`;
    expect(await countRows(verdictCount)).toBe(25);
    expect((await postJson(`/reconciliation/actions/${same.action!.id}/undo`, {})).status).toBe(200);
    expect(await countRows(verdictCount)).toBe(0);
    const afterSameUndo = await getReconciliation();
    expect(txIds.every((txId) => rowOf(afterSameUndo, txId)?.status === 'unprocessed')).toBe(true);

    // 判断は 1 文 12 行、MF 除外は 1 文 16 行で分かれる。どちらも 25 件を超えて書けること
    for (const [action, table] of [
      ['different', 'duplicate_verdicts'],
      ['exclude-mf', 'mf_tx_exclusions'],
    ] as const) {
      const body = (await (
        await act(
          action,
          txIds.map((txId) => ({ txId })),
        )
      ).json()) as ActionBody;
      expect(body.saved).toBe(25);
      expect(body.results.every((result) => result.ok)).toBe(true);
      const count = `SELECT COUNT(*) AS n FROM ${table} WHERE user_id='default' AND tx_id IN (${inList})`;
      expect(await countRows(count)).toBe(25);
      expect((await postJson(`/reconciliation/actions/${body.action!.id}/undo`, {})).status).toBe(200);
      expect(await countRows(count)).toBe(0);
    }
  });

  it('操作の後に同じ行が書き換わっていれば、取り消しは 409 (action_stale) で後の変更を消さない', async () => {
    const body = (await (await act('different', [{ txId: 'mf-bulk-00' }])).json()) as ActionBody;
    // 総収支の画面で「同じ」に変えた、または復元で行が差し替わった状態を再現する
    await database
      .prepare(`UPDATE duplicate_verdicts SET verdict='same' WHERE user_id='default' AND tx_id='mf-bulk-00'`)
      .run();
    const stale = await postJson(`/reconciliation/actions/${body.action!.id}/undo`, {});
    expect(stale.status).toBe(409);
    expect(await errorCode(stale)).toBe('action_stale');
    expect(
      await countRows(
        `SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default' AND tx_id='mf-bulk-00' AND verdict='same'`,
      ),
    ).toBe(1);
    await database
      .prepare(`DELETE FROM duplicate_verdicts WHERE user_id='default' AND tx_id='mf-bulk-00'`)
      .run();
  });

  it('壊れた操作の記録は 500 にせず 409 (action_snapshot_invalid)', async () => {
    await database
      .prepare(
        `INSERT INTO reconciliation_actions (id,user_id,action,target_count,before_json,after_json,created_at)
         VALUES ('${BROKEN_ACTION_ID}','default','same',1,'not json','{}','2999-01-01T00:00:00.000Z')`,
      )
      .run();
    const broken = await postJson(`/reconciliation/actions/${BROKEN_ACTION_ID}/undo`, {});
    expect(broken.status).toBe(409);
    expect(await errorCode(broken)).toBe('action_snapshot_invalid');
    await database.prepare(`DELETE FROM reconciliation_actions WHERE id='${BROKEN_ACTION_ID}'`).run();
  });
});
