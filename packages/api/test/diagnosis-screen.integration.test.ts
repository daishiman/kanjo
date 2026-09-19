/**
 * 診断画面 API (GET /api/diagnosis, PATCH /api/diagnosis/actions/:action_key) の結合テスト。
 *
 * 契約の正本は `docs/diagnosis-screen-test-plan.md` §4/§5/§6 と
 * `specs/spec-diagnosis-screen.md` の Contract tests。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の /diagnosis は `diagnosis(data)` の結果 (kpi/entries/autoDiagnosis) だけを返し、
 * selection・improvements・health・waterfall・signals・evidence・totals を持たない。
 * PATCH の経路と `diagnosis_action_states` 表そのものが存在しないため、§5/§6 は全滅する。
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
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;
/** 明細を 1 件も入れていない時点の応答 (§4 Boundary) */
// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
let emptyBody: any;

/** 同月・同額・同一取引先の 2 件から立つ改善余地 */
const DUPLICATE_KEY = 'duplicate_payment:架空カフェ:5000:2026-08';

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const request = (path: string, init: RequestInit = {}) =>
  app.request(
    `/api${path}`,
    { ...init, headers: { cookie, ...(init.headers ?? {}) } },
    { ...auth, DB: database },
  );

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const getJson = async (path: string): Promise<any> => {
  const res = await request(path);
  expect(res.status).toBe(200);
  return res.json();
};

const patch = (actionKey: string, body: unknown) =>
  request(`/diagnosis/actions/${encodeURIComponent(actionKey)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'diagnosis-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });

  // 明細を入れる前の応答を先に控える (何も無い状態でもブロックが欠けないことの証拠)
  emptyBody = await getJson('/diagnosis');

  const rows = [
    ['2026-08_1', '2026-08', '2026-08-03', '架空カフェ', -5_000, '食費', '外食'],
    ['2026-08_2', '2026-08', '2026-08-17', '架空カフェ', -5_000, '食費', '外食'],
    ['2026-08_3', '2026-08', '2026-08-25', '架空給与', 300_000, '収入', '給与'],
    ['2026-07_1', '2026-07', '2026-07-25', '架空給与', 300_000, '収入', '給与'],
    ['2026-07_2', '2026-07', '2026-07-05', '架空スーパー', -40_000, '食費', '食料品'],
    ['2026-06_1', '2026-06', '2026-06-25', '架空給与', 300_000, '収入', '給与'],
    ['2026-06_2', '2026-06', '2026-06-05', '架空スーパー', -60_000, '食費', '食料品'],
    ['2026-06_3', '2026-06', '2026-06-01', '架空家賃', -300_000, '住宅', '家賃'],
    ['2026-07_3', '2026-07', '2026-07-01', '架空家賃', -300_000, '住宅', '家賃'],
    ['2026-08_4', '2026-08', '2026-08-01', '架空家賃', -300_000, '住宅', '家賃'],
    ['2026-05_1', '2026-05', '2026-05-25', '架空給与', 400_000, '収入', '給与'],
    ['2026-04_1', '2026-04', '2026-04-25', '架空給与', 400_000, '収入', '給与'],
    ['2026-03_1', '2026-03', '2026-03-25', '架空給与', 400_000, '収入', '給与'],
  ] as const;
  for (const [txId, month, date, description, amount, major, mid] of rows) {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default',?,?,?,?,?,?,?,1,0,1)`,
      )
      .bind(txId, month, date, description, amount, major, mid)
      .run();
  }
});

afterAll(async () => {
  await miniflare?.dispose();
});

describe('§4 GET /api/diagnosis', () => {
  it('positive: 改善余地・健全性・棒・シグナル・根拠・合計が 1 応答で揃う', async () => {
    const body = await getJson('/diagnosis');

    expect(body.selection).toEqual({ scope: 'total', metric: 'expense', compare: 'previous' });

    const duplicate = body.improvements.find(
      (row: { action_key: string }) => row.action_key === DUPLICATE_KEY,
    );
    expect(duplicate).toBeDefined();
    expect(duplicate.id).toBe('duplicate_payment');
    expect(duplicate.monthlyImpact).toBe(5_000);
    expect(duplicate.annualImpact).toBe(5_000);
    expect(duplicate.impactBasis).toBe('one_off');
    expect(duplicate.scope).toBe('household');
    expect(duplicate.metric).toBe('expense');
    expect(duplicate.claimKeys).toEqual(['vendor-month:架空カフェ:2026-08']);
    expect(new URL(duplicate.nextAction.to, 'https://example.test').searchParams.get('payee')).toBe(
      '架空カフェ',
    );
    expect(duplicate.status).toBe('未着手');
    expect(duplicate.note).toBeNull();
    expect(duplicate.decided_at).toBeNull();

    // 年間インパクトの降順
    const annual = body.improvements.map((row: { annualImpact: number }) => row.annualImpact);
    expect(annual).toEqual([...annual].sort((a: number, b: number) => b - a));

    expect(body.health.breakdown.map((f: { key: string }) => f.key)).toEqual([
      'fixed_cost_ratio',
      'savings_rate',
      'stability',
      'coverage',
    ]);
    expect(body.waterfall[0].kind).toBe('base');
    expect(body.waterfall[body.waterfall.length - 1].kind).toBe('result');
    expect(body.waterfall.every((bar: { from: number; to: number }) => bar.from >= 0 && bar.to >= 0)).toBe(
      true,
    );
    expect(body.waterfall.filter((bar: { kind: string }) => bar.kind === 'cut')).toHaveLength(
      body.totals.activeCount,
    );
    expect(
      body.waterfall
        .filter((bar: { kind: string }) => bar.kind === 'cut')
        .map((bar: { key: string }) => bar.key),
    ).toEqual(
      body.improvements
        .filter((row: { status: string }) => !['対応済み', '見送り'].includes(row.status))
        .map((row: { action_key: string }) => row.action_key),
    );
    expect(body.waterfall.at(-1).to).toBe(Math.max(0, body.waterfall[0].to - body.totals.active));
    expect(body.signals.length).toBeLessThanOrEqual(3);
    expect(body.signals.map((signal: { label: string }) => signal.label)).toEqual(
      body.improvements
        .filter((row: { status: string }) => !['対応済み', '見送り'].includes(row.status))
        .slice(0, 3)
        .map((row: { label: string }) => row.label),
    );
    const claims = body.improvements.flatMap((row: { claimKeys: string[] }) => row.claimKeys);
    expect(new Set(claims).size).toBe(claims.length);
    expect(body.evidence).toHaveLength(4);
    expect(body.totals.active).toBe(
      body.improvements
        .filter((row: { status: string }) => !['対応済み', '見送り'].includes(row.status))
        .reduce((acc: number, row: { annualImpact: number }) => acc + row.annualImpact, 0),
    );
  });

  it('boundary: 明細が 1 件も無くても 200 で、全ブロックが空のまま揃う', () => {
    expect(emptyBody.improvements).toEqual([]);
    expect(emptyBody.totals).toEqual({ active: 0, activeCount: 0, collapsed: 0, collapsedCount: 0 });
    expect(emptyBody.waterfall.map((bar: { kind: string }) => bar.kind)).toEqual(['base', 'result']);
    expect(emptyBody.health.score).toBeNull();
    expect(emptyBody.health.band).toBeNull();
    expect(emptyBody.evidence).toHaveLength(4);
    expect(emptyBody.selection).toEqual({ scope: 'total', metric: 'expense', compare: 'previous' });
  });

  it('negative: 未登録の scope/metric/compare は 400 にせず既定へ倒す', async () => {
    const body = await getJson('/diagnosis?scope=zzz&metric=zzz&compare=zzz');
    expect(body.selection).toEqual({ scope: 'total', metric: 'expense', compare: 'previous' });
  });

  it('scope/metric: 家計の支出・収入・純収支をそれぞれの検知規則で返す', async () => {
    const household = await getJson('/diagnosis?scope=household&metric=expense');
    expect(household.improvements.map((row: { scope: string }) => row.scope)).toEqual(['household']);

    for (const [metric, id] of [
      ['income', 'income_decline'],
      ['net', 'negative_net'],
    ] as const) {
      const body = await getJson(`/diagnosis?scope=household&metric=${metric}`);
      expect(body.improvements).toHaveLength(1);
      expect(body.improvements[0]).toMatchObject({ id, scope: 'household', metric });
      expect(body.totals.active).toBe(body.improvements[0].annualImpact);
      expect(body.waterfall.map((bar: { kind: string }) => bar.kind)).toEqual(['base', 'gain', 'result']);
      expect(body.waterfall.at(-1).to).toBe(body.waterfall[0].to + body.totals.active);
      const target = new URL(body.improvements[0].nextAction.to, 'https://example.test');
      expect(target.pathname).toBe('/analysis/trends');
      expect(target.searchParams.get('scope')).toBe('household');
      expect(target.searchParams.get('metric')).toBe(metric);
    }
  });

  it('negative: 未認証は 401', async () => {
    const res = await app.request('/api/diagnosis', {}, { ...auth, DB: database });
    expect(res.status).toBe(401);
  });
});

describe('§5 PATCH /api/diagnosis/actions/:action_key', () => {
  it('positive: 4 語のいずれもそのまま保存され、再送は冪等', async () => {
    for (const status of ['未着手', '対応中', '対応済み', '見送り']) {
      const res = await patch(DUPLICATE_KEY, { status });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ action_key: DUPLICATE_KEY, status, note: null });
      expect(typeof body.decided_at).toBe('string');
    }
    const again = await patch(DUPLICATE_KEY, { status: '見送り' });
    expect(again.status).toBe(200);
    const { results } = await database
      .prepare('SELECT COUNT(*) AS n FROM diagnosis_action_states WHERE action_key = ?')
      .bind(DUPLICATE_KEY)
      .all();
    expect((results[0] as { n: number }).n).toBe(1);
  });

  it('boundary: note は 500 文字まで受け付け、501 文字は 400', async () => {
    const ok = await patch(DUPLICATE_KEY, { status: '対応中', note: 'あ'.repeat(500) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).note).toHaveLength(500);

    const ng = await patch(DUPLICATE_KEY, { status: '対応中', note: 'あ'.repeat(501) });
    expect(ng.status).toBe(400);
  });

  it('boundary: action_key は 200 文字まで受け付け、201 文字は 400', async () => {
    const head = 'duplicate_payment:';
    const ok = await patch(head + 'あ'.repeat(200 - head.length), { status: '対応中' });
    expect(ok.status).toBe(200);
    const ng = await patch(head + 'あ'.repeat(201 - head.length), { status: '対応中' });
    expect(ng.status).toBe(400);
  });

  it('negative: 未登録の検知器 id は 400 で、行を作らない', async () => {
    const res = await patch('zzz:あ', { status: '対応中' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
    const { results } = await database
      .prepare("SELECT COUNT(*) AS n FROM diagnosis_action_states WHERE action_key LIKE 'zzz:%'")
      .all();
    expect((results[0] as { n: number }).n).toBe(0);
  });

  it('negative: 4 語以外の status は 400', async () => {
    const res = await patch(DUPLICATE_KEY, { status: '完了' });
    expect(res.status).toBe(400);
  });

  it('negative: 未認証は 401', async () => {
    const res = await app.request(
      `/api/diagnosis/actions/${encodeURIComponent(DUPLICATE_KEY)}`,
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{"status":"対応中"}' },
      { ...auth, DB: database },
    );
    expect(res.status).toBe(401);
  });

  it('negative: エラー本文に SQL 断片やスタックを含めない', async () => {
    const res = await patch("duplicate_payment:'); DROP TABLE diagnosis_action_states; --", {
      status: '対応中',
    });
    const text = JSON.stringify(await res.json());
    for (const fragment of ['SQLITE', 'sqlite', 'INSERT', 'SELECT', 'D1_', '.ts:', 'at async']) {
      expect(text).not.toContain(fragment);
    }
    // 表は落ちていない
    const { results } = await database.prepare('SELECT COUNT(*) AS n FROM diagnosis_action_states').all();
    expect((results[0] as { n: number }).n).toBeGreaterThan(0);
  });
});

describe('§6 判断の保存と合計への反映', () => {
  it('未着手 → 対応中 (メモ付き) → 期間を変えても保持される', async () => {
    const res = await patch(DUPLICATE_KEY, { status: '対応中', note: '契約先に確認中' });
    expect(res.status).toBe(200);

    const body = await getJson('/diagnosis');
    const row = body.improvements.find((r: { action_key: string }) => r.action_key === DUPLICATE_KEY);
    expect(row.status).toBe('対応中');
    expect(row.note).toBe('契約先に確認中');
    expect(typeof row.decided_at).toBe('string');

    // 期間を変えても判断は同じ鍵で残る
    const scoped = await getJson('/diagnosis?from=2026-06&to=2026-08');
    const scopedRow = scoped.improvements.find((r: { action_key: string }) => r.action_key === DUPLICATE_KEY);
    expect(scopedRow.status).toBe('対応中');
    expect(scopedRow.note).toBe('契約先に確認中');
  });

  it('対応済みにすると未対応の合計から外れ、畳んだ件数へ移る', async () => {
    const before = await getJson('/diagnosis');
    const target = before.improvements.find((r: { action_key: string }) => r.action_key === DUPLICATE_KEY);

    await patch(DUPLICATE_KEY, { status: '対応済み' });
    const after = await getJson('/diagnosis');

    expect(after.totals.activeCount).toBe(before.totals.activeCount - 1);
    expect(after.totals.active).toBe(before.totals.active - target.annualImpact);
    expect(after.totals.collapsedCount).toBe(before.totals.collapsedCount + 1);
    expect(after.totals.collapsed).toBe(before.totals.collapsed + target.annualImpact);
    // 対応済みは棒から消える (合計と図が食い違わない)
    expect(after.waterfall.map((bar: { key: string }) => bar.key)).not.toContain(DUPLICATE_KEY);
    // 行そのものは残る
    expect(
      after.improvements.find((r: { action_key: string }) => r.action_key === DUPLICATE_KEY).status,
    ).toBe('対応済み');
  });

  it('検知されなくなった鍵は行が残るだけで応答に出ず、再び検知されると判断が戻る', async () => {
    const orphan = 'duplicate_payment:架空カフェ:5000:1999-01';
    await patch(orphan, { status: '見送り', note: '対象外' });

    const body = await getJson('/diagnosis');
    expect(body.improvements.map((r: { action_key: string }) => r.action_key)).not.toContain(orphan);

    const { results } = await database
      .prepare('SELECT status, note FROM diagnosis_action_states WHERE action_key = ?')
      .bind(orphan)
      .all();
    expect(results[0]).toMatchObject({ status: '見送り', note: '対象外' });

    // 同じ鍵が再び検知される状態にすると、保存済みの判断がそのまま載る
    for (const txId of ['1999-01_1', '1999-01_2']) {
      await database
        .prepare(
          `INSERT INTO mf_transactions
            (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
           VALUES ('default',?,'1999-01','1999-01-10','架空カフェ',-5000,'食費','外食',1,0,1)`,
        )
        .bind(txId)
        .run();
    }
    const revived = await getJson('/diagnosis');
    const row = revived.improvements.find((r: { action_key: string }) => r.action_key === orphan);
    expect(row).toBeDefined();
    expect(row.status).toBe('見送り');
    expect(row.note).toBe('対象外');
  });
});

/**
 * AC-006: 条件の帯が選んだ範囲×指標の期間合計が、同じ期間の総収支画面と一致すること。
 * 2 つの画面で別々に足すと、同じ条件なのに合計が食い違い、どちらが正しいか判定できなくなる。
 */
describe('AC-006 条件の帯の期間合計', () => {
  const PERIOD = 'from=2026-06&to=2026-08';

  it('同じ期間の /total-cashflow と合計が一致し、総合 = 事業 + 家計 が成り立つ', async () => {
    const cashflow = await getJson(`/total-cashflow?${PERIOD}`);
    const expense = await getJson(`/diagnosis?${PERIOD}&scope=total&metric=expense`);
    expect(expense.scopeTotals.current).toBe(cashflow.summary.total.expense);
    expect(expense.scopeTotals.byScope.total).toBe(
      expense.scopeTotals.byScope.business + expense.scopeTotals.byScope.household,
    );

    const income = await getJson(`/diagnosis?${PERIOD}&scope=business&metric=income`);
    expect(income.scopeTotals.current).toBe(cashflow.summary.biz.income);

    const net = await getJson(`/diagnosis?${PERIOD}&scope=household&metric=net`);
    expect(net.scopeTotals.current).toBe(cashflow.summary.household.balance);
  });

  it('比較対象の月が取込前なら baseline を出さない (BR-006)', async () => {
    const body = await getJson(`/diagnosis?${PERIOD}&compare=yoy`);
    expect(body.scopeTotals.baselineRange).toEqual({ from: '2025-06', to: '2025-08' });
    expect(body.scopeTotals.baseline).toBeNull();
    expect(body.scopeTotals.diff).toBeNull();
  });
});
