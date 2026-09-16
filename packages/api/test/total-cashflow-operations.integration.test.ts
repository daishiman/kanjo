/**
 * 受入AC-004「直前の操作を元に戻すと、総額と判定件数が操作前と一致する」の結合テスト (BR-008)。
 *
 * 取消は「合計を戻す」のではなく「判断の行を戻す」実装なので、行が戻ったことだけを見ても
 * 受入は満たせない。合計は要求のたびに core が導出する (AD-002) ため、
 * 操作前・操作後・取消後の 3 点で画面に出る数字そのものを突き合わせる。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
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

const postJson = (path: string, body: unknown) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const undo = (operationId: string) => postJson(`/total-cashflow/operations/${operationId}/undo`, {});

/** 画面が読む値だけを取り出す。内部表の行数ではなく、この形で前後を比べる */
type CashflowBody = {
  months: Array<{
    month: string;
    shiftedCount: number;
    reviewCount: number;
    reviewAmount: number;
    totalExpense: number;
    householdExpense: number;
  }>;
  review: Array<{ txId: string }>;
  freeeOnly: Array<{ freeeKey: string }>;
  excluded: Array<{ freeeKey: string; reason: string }>;
  lastOperation: { id: string; kind: string; itemCount: number } | null;
};

const screen = async (): Promise<CashflowBody> =>
  (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;

const countOf = async (table: 'duplicate_verdicts' | 'freee_deal_exclusions'): Promise<number> => {
  const row = await database
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id='default'`)
    .first<{ n: number }>();
  return row?.n ?? 0;
};

/** 判断・除外・操作履歴だけを白紙へ戻す。取込済みの明細には触れない */
async function resetDecisions(): Promise<void> {
  for (const table of ['duplicate_verdicts', 'freee_deal_exclusions', 'total_cashflow_operations']) {
    await database.prepare(`DELETE FROM ${table} WHERE user_id='default'`).run();
  }
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'total-cashflow-operations',
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
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300)`,
    )
    .run();
  // 発生日をずらし、自動では寄らない状態にする。動かせるのは利用者の判断だけ
  await database
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES ('default','2026-08_1_-3300','2026-08','2026-08-07','架空クラウド',-3300,'事業経費','通信費',1,0,0)`,
    )
    .run();
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

beforeEach(async () => {
  await resetDecisions();
});

describe('受入AC-004 直前の操作を元に戻す (BR-008)', () => {
  it('判断の取消で、画面の数字と判定件数が操作前と一致する', async () => {
    const before = await screen();
    expect(before.months[0]).toMatchObject({ shiftedCount: 0, reviewCount: 1 });
    expect(before.lastOperation).toBeNull();

    const saved = (await (
      await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'same' })
    ).json()) as { operationId: string };
    expect(saved.operationId).toEqual(expect.any(String));

    const after = await screen();
    expect(after.months[0]).toMatchObject({ shiftedCount: 1, reviewCount: 0 });
    expect(await countOf('duplicate_verdicts')).toBe(1);

    expect((await undo(saved.operationId)).status).toBe(200);

    const restored = await screen();
    // 行が消えたことだけでなく、画面に出る数字そのものが元へ戻ることを見る。
    // 合計は保存せず毎回導出するので、ここが一致して初めて取消が成立している
    expect(restored.months[0]).toEqual(before.months[0]);
    expect(restored.review.map((r) => r.txId)).toEqual(before.review.map((r) => r.txId));
    expect(await countOf('duplicate_verdicts')).toBe(0);
  });

  it('同じ操作 id を二度送っても、戻るのは一回ぶんだけ', async () => {
    const saved = (await (
      await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'same' })
    ).json()) as { operationId: string };

    expect((await undo(saved.operationId)).status).toBe(200);

    const second = await undo(saved.operationId);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: { code: 'already_undone', message: 'この操作はすでに元に戻されています' },
    });
    expect(await countOf('duplicate_verdicts')).toBe(0);
  });

  it('除外の取消で、外した取引が理由ごと戻る', async () => {
    // 鍵は core が組み立てる内部形式なので、テストで literal を書き写さない。
    // 書き写すと、鍵の作り方が変わった日にこのテストだけが古い形で緑になる
    const freeeKey = (await screen()).freeeOnly[0]?.freeeKey;
    expect(freeeKey).toEqual(expect.any(String));
    const listed = (await (
      await postJson('/total-cashflow/freee-exclusions', {
        freeeKey,
        reason: '二重登録のため',
        reasonCode: 'duplicate',
      })
    ).json()) as { operationId: string | null; saved?: number };

    // 鍵の形が実装と食い違うと 0 件成功で緑になる。件数で先に固定する
    expect(await countOf('freee_deal_exclusions')).toBe(1);
    expect(listed.operationId).toEqual(expect.any(String));

    expect((await undo(listed.operationId as string)).status).toBe(200);
    expect(await countOf('freee_deal_exclusions')).toBe(0);
    expect((await screen()).excluded).toHaveLength(0);
  });

  it('取消そのものは取り消せない', async () => {
    const saved = (await (
      await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'same' })
    ).json()) as { operationId: string };
    const undone = (await (await undo(saved.operationId)).json()) as { operation: { id: string } };

    const again = await undo(undone.operation.id);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({
      error: { code: 'not_undoable', message: '取り消しそのものは元に戻せません' },
    });
  });

  it('後から別の操作が入った古い操作は、取り消さずに再読込を促す', async () => {
    const first = (await (
      await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'same' })
    ).json()) as { operationId: string };
    await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'different' });

    const stale = await undo(first.operationId);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({
      error: { code: 'stale_operation', message: '別の更新と重なりました。もう一度お試しください' },
    });
    // 拒否した以上、判断は後から入れた側のまま動かない
    expect(await countOf('duplicate_verdicts')).toBe(1);
  });

  it('知らない操作 id は 404 で、どの判断も動かさない', async () => {
    await postJson('/total-cashflow/verdicts', { txId: '2026-08_1_-3300', verdict: 'same' });

    const missing = await undo('00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: 'not_found', message: 'この操作は見つかりませんでした' },
    });
    expect(await countOf('duplicate_verdicts')).toBe(1);
  });
});
