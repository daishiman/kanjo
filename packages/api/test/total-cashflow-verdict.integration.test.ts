/**
 * 受入A5「判断が保存され再取込後も同じ明細へ再適用される」の結合テスト。
 *
 * 実装より先に書く赤いテスト (SYS-TCF-P04)。実装は SYS-TCF-P05 以降。
 * 受入とテストの対応表は `packages/core/test/total-cashflow-contract.test.ts` の冒頭にある。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
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

const postVerdict = (txId: string, verdict: 'same' | 'different') =>
  request('/total-cashflow/verdicts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ txId, verdict }),
  });

/** 取込のやり直しを模す。MF 側の行だけを入れ替え、判断テーブルには触れない */
async function reimportMf(rows: Array<{ txId: string; date: string; description: string; amount: number }>) {
  await database.prepare(`DELETE FROM mf_transactions WHERE user_id='default'`).run();
  for (const row of rows) {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default',?1,'2026-08',?2,?3,?4,'事業経費','通信費',1,0,0)`,
      )
      .bind(row.txId, row.date, row.description, row.amount)
      .run();
  }
}

const verdictRowCount = async (): Promise<number> => {
  const row = await database
    .prepare(`SELECT COUNT(*) AS n FROM duplicate_verdicts WHERE user_id='default'`)
    .first<{ n: number }>();
  return row?.n ?? 0;
};

type CashflowBody = {
  months: Array<{ month: string; shiftedCount: number; reviewCount: number; householdExpense: number }>;
  review: Array<{ txId: string; reason: string }>;
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'total-cashflow-verdict',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: database },
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';

  await database
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999)`,
    )
    .run();
  await reimportMf([
    // 発生日をずらし、自動判定では寄らない状態にする。動かせるのは利用者判断だけ
    { txId: '2026-08_1_-3300', date: '2026-08-07', description: '架空クラウド', amount: -3300 },
  ]);
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('受入A5 重複判断の保存と再取込後の再適用', () => {
  it('「同じ」判断が保存され、一覧表の帰属が動く', async () => {
    const before = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(before.months).toHaveLength(1);
    expect(before.months[0]).toMatchObject({ shiftedCount: 0, householdExpense: 3300 });
    expect(before.review).toHaveLength(1);

    expect((await postVerdict('2026-08_1_-3300', 'same')).status).toBe(200);
    expect(await verdictRowCount()).toBe(1);

    const after = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(after.months[0]).toMatchObject({ shiftedCount: 1, householdExpense: 0 });
    expect(after.review).toHaveLength(0);
  });

  it('同じ tx_id で再取込しても行が増えず、判断が再適用される', async () => {
    await reimportMf([
      { txId: '2026-08_1_-3300', date: '2026-08-07', description: '架空クラウド', amount: -3300 },
    ]);
    expect(await verdictRowCount()).toBe(1);

    const body = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(body.months[0]).toMatchObject({ shiftedCount: 1, householdExpense: 0 });
  });

  it('tx_id が振り直されても stable_key が同じなら同じ明細へ再適用される', async () => {
    // idStable=0 の明細は行番号が tx_id に入るため、再取込で識別子が変わりうる。
    // 日付・内容・金額・保有金融機関が同じなら stable_key は変わらない。
    await reimportMf([
      { txId: '2026-08_9_-3300', date: '2026-08-07', description: '架空クラウド', amount: -3300 },
    ]);

    const body = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(body.months[0]).toMatchObject({ shiftedCount: 1, householdExpense: 0 });
    // 新しい tx_id で別行を作らない
    expect(await verdictRowCount()).toBe(1);
  });

  it('別ユーザーの明細と金額が応答へ混ざらない', async () => {
    const response = await request('/total-cashflow?from=2026-08&to=2026-08');
    // 404 の空応答に「混ざっていない」と言わせないため、まず 200 と中身の実在を固定する
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body).months).toHaveLength(1);
    expect(body).toContain('3300');
    expect(body).not.toContain('999999');
    expect(body).not.toContain('別ユーザー');
  });
});

/*
  実データでは要確認が 19 件出た。1 件ずつ送ると、そのたびに期間解決を丸ごとやり直す
  往復が 19 回走る。D1 のクエリ数は invocation 単位で数えられるため、往復の数が
  そのまま保存の成否を左右しかねない。選んだ分を 1 往復で受けられることを固定する。

  旧実装 (単票しか受けない) では `items` が zod で弾かれ 400 になるので、この節は必ず落ちる。
*/
describe('選択した要確認をまとめて判定する', () => {
  const postBulk = (items: Array<{ txId: string; verdict: 'same' | 'different' }>) =>
    request('/total-cashflow/verdicts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });

  const bulkRows = [
    { txId: 'bulk-1', date: '2026-08-11', description: '架空A', amount: -1000 },
    { txId: 'bulk-2', date: '2026-08-12', description: '架空B', amount: -2000 },
    { txId: 'bulk-3', date: '2026-08-13', description: '架空C', amount: -3000 },
  ];

  beforeAll(async () => {
    // 発生日を 2 日ずらし、自動では寄らない要確認 3 件を作る
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
          ('default','2026-08','2026-08-13','expense','架空A','通信費','サブスク・通信',1000),
          ('default','2026-08','2026-08-14','expense','架空B','通信費','サブスク・通信',2000),
          ('default','2026-08','2026-08-15','expense','架空C','通信費','サブスク・通信',3000)`,
      )
      .run();
    await reimportMf(bulkRows);
  });

  it('3 件を 1 回の要求で保存し、一覧表の帰属がまとめて動く', async () => {
    const before = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(before.review.map((r) => r.txId).sort()).toEqual(['bulk-1', 'bulk-2', 'bulk-3']);
    expect(before.months[0]).toMatchObject({ shiftedCount: 0, householdExpense: 6000 });
    const rowsBefore = await verdictRowCount();

    const response = await postBulk(bulkRows.map((row) => ({ txId: row.txId, verdict: 'same' as const })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, saved: 3, rejected: [] });
    expect(await verdictRowCount()).toBe(rowsBefore + 3);

    const after = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(after.months[0]).toMatchObject({ shiftedCount: 3, householdExpense: 0 });
    expect(after.review).toHaveLength(0);
  });

  it('同じ組をもう一度まとめて送っても行は増えず、上書きされる', async () => {
    const rowsBefore = await verdictRowCount();
    expect(
      (await postBulk(bulkRows.map((row) => ({ txId: row.txId, verdict: 'different' as const })))).status,
    ).toBe(200);
    expect(await verdictRowCount()).toBe(rowsBefore);

    const after = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    // 「違う」に倒したので事業費へは寄らず、要確認からも外れる
    expect(after.months[0]).toMatchObject({ shiftedCount: 0, householdExpense: 6000 });
    expect(after.review).toHaveLength(0);
  });

  /*
    まとめて送ると「1 件でも駄目なら全部落とす」に倒れやすい。19 件のうち 1 件が
    保存できないだけで残り 18 件の判断が消えると、利用者は何度も選び直す羽目になる。
  */
  it('保存できない 1 件があっても残りは保存し、落ちた件だけを理由付きで返す', async () => {
    const response = await postBulk([
      { txId: 'bulk-1', verdict: 'same' },
      { txId: '存在しない明細', verdict: 'same' },
    ]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      saved: 1,
      rejected: [{ txId: '存在しない明細', reason: '対象の明細が見つかりません' }],
    });

    const after = (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;
    expect(after.months[0]).toMatchObject({ shiftedCount: 1, householdExpense: 5000 });
  });

  it('単票の要求は従来どおり 404 を返す', async () => {
    // まとめ送りを足したせいで、1 件のときの「その場で言う」応答が失われないこと
    expect((await postVerdict('存在しない明細', 'same')).status).toBe(404);
  });
});

/*
  「取り込んだ内容に抜け漏れはないでしょうか」への答えは、freee 全件が必ず
  一致 / MF に相手なし / 除外 のどれか 1 つに入る分割で示す。旧実装は months と review しか
  返しておらず、freee 側の行き先は画面から一切見えなかったので、この節は必ず落ちる。
*/
describe('freee 全件の行き先と二重登録の除外', () => {
  type Split = {
    matched: Array<{ freeeKey: string; by: string; mf: { content: string }; freee: { partner: string } }>;
    freeeOnly: Array<{ freeeKey: string; partner: string; amount: number }>;
    excluded: Array<{ freeeKey: string; partner: string; reason: string }>;
    coverage: { freeeTotal: number; matched: number; freeeOnly: number; excluded: number; mfReview: number };
    months: Array<{ bizExpense: number }>;
  };

  const load = async (): Promise<Split> =>
    (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as Split;

  const exclude = (freeeKey: string, reason: string) =>
    request('/total-cashflow/freee-exclusions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ freeeKey, reason }),
    });

  const restore = (freeeKey: string) =>
    request('/total-cashflow/freee-exclusions', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ freeeKey }),
    });

  it('3 つの内訳を足すと freee の総数になる', async () => {
    const body = await load();
    expect(body.coverage.freeeTotal).toBeGreaterThan(0);
    expect(body.coverage.matched + body.coverage.freeeOnly + body.coverage.excluded).toBe(
      body.coverage.freeeTotal,
    );
    // 件数と実際の配列の長さが食い違わないこと (件数だけを別に数えていないか)
    expect(body.matched).toHaveLength(body.coverage.matched);
    expect(body.freeeOnly).toHaveLength(body.coverage.freeeOnly);
    expect(body.excluded).toHaveLength(body.coverage.excluded);
  });

  it('一致した組は MF と freee の中身を持って返る', async () => {
    // bulk-1 は直前の節で「同じ」に倒してある。名前と中身の両方が届くこと
    const body = await load();
    const hit = body.matched.find((m) => m.mf.content === '架空A');
    expect(hit).toMatchObject({ by: 'user', freee: { partner: '架空A' } });
    expect(hit?.freeeKey).toMatch(/^v1:freee:/);
  });

  it('二重登録として外すと事業費から落ち、外した一覧に理由つきで残る', async () => {
    const before = await load();
    const target = before.freeeOnly[0];
    expect(target).toBeTruthy();
    const bizBefore = before.months[0]!.bizExpense;

    expect((await exclude(target!.freeeKey, '同じ支払を 2 回登録していた')).status).toBe(200);

    const after = await load();
    expect(after.months[0]!.bizExpense).toBe(bizBefore - target!.amount);
    expect(after.excluded).toEqual([
      expect.objectContaining({ freeeKey: target!.freeeKey, reason: '同じ支払を 2 回登録していた' }),
    ]);
    // 外した取引は「相手なし」からも消える。両方に出ると分割の和が壊れる
    expect(after.freeeOnly.map((d) => d.freeeKey)).not.toContain(target!.freeeKey);
    expect(after.coverage.matched + after.coverage.freeeOnly + after.coverage.excluded).toBe(
      after.coverage.freeeTotal,
    );

    expect((await restore(target!.freeeKey)).status).toBe(200);
    const restored = await load();
    expect(restored.excluded).toHaveLength(0);
    expect(restored.months[0]!.bizExpense).toBe(bizBefore);
  });

  /*
    一致した組は 1 か月で十数件ある。1 件ずつ外させると同じ理由を何度も打つことになり、
    そのたびに往復する。旧実装は freeeKey 単数しか受けないので、この検査は 400 で落ちる。
  */
  it('選んだぶんを 1 往復でまとめて外し、同じ鍵が重なっても落ちない', async () => {
    const before = await load();
    const targets = [...before.freeeOnly, ...before.matched].map((d) => d.freeeKey).slice(0, 2);
    expect(targets).toHaveLength(2);

    const response = await request('/total-cashflow/freee-exclusions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // 同じ鍵を混ぜる。1 文の中で同じ行を二度更新しようとすると SQLite が拒むので、
      // 受け取った側で畳めていなければここで 500 になる
      body: JSON.stringify({ freeeKeys: [...targets, targets[0]], reason: '日付と金額が一致' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, saved: 2 });

    const after = await load();
    expect(after.excluded.map((d) => d.freeeKey).sort()).toEqual([...targets].sort());
    // 理由は選んだ全件に同じものが付く。1 件だけ空になると、後から戻す判断ができない
    expect(after.excluded.every((d) => d.reason === '日付と金額が一致')).toBe(true);
    expect(after.coverage.matched + after.coverage.freeeOnly + after.coverage.excluded).toBe(
      after.coverage.freeeTotal,
    );

    for (const key of targets) expect((await restore(key)).status).toBe(200);
    expect((await load()).excluded).toHaveLength(0);
  });

  it('理由の無い除外は受け付けない', async () => {
    const response = await request('/total-cashflow/freee-exclusions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ freeeKey: 'v1:freee:whatever', reason: '   ' }),
    });
    expect(response.status).toBe(400);
  });
});

/*
  同日同額の freee が 2 件あるとき、「同じ」だけでは機械はどちらとも読める。
  利用者が名指しした相手が保存され、次に開いたときも同じ組に寄ることを固定する。
*/
describe('どの freee 取引と組むかの名指し', () => {
  type Body = {
    review: Array<{ txId: string; candidates: Array<{ freeeKey: string; partner: string }> }>;
    matched: Array<{ mfTxId: string; freeeKey: string; freee: { partner: string } }>;
  };
  const load = async (): Promise<Body> =>
    (await (await request('/total-cashflow?from=2026-09&to=2026-09')).json()) as Body;

  beforeAll(async () => {
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
          ('default','2026-09','2026-09-03','expense','架空アプリ A','通信費','サブスク・通信',2900),
          ('default','2026-09','2026-09-03','expense','架空アプリ B','通信費','サブスク・通信',2900)`,
      )
      .run();
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','pick-1','2026-09','2026-09-05','架空アプリ',-2900,'事業経費','通信費',1,0,1)`,
      )
      .run();
  });

  it('名指しした候補へ寄り、名指ししなかった方は相手なしとして残る', async () => {
    const before = await load();
    const target = before.review.find((r) => r.txId === 'pick-1');
    expect(target?.candidates).toHaveLength(2);
    const bKey = target!.candidates.find((c) => c.partner === '架空アプリ B')!.freeeKey;

    const response = await request('/total-cashflow/verdicts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ txId: 'pick-1', verdict: 'same', freeeKey: bKey }),
    });
    expect(response.status).toBe(200);

    const after = await load();
    expect(after.matched.find((m) => m.mfTxId === 'pick-1')).toMatchObject({
      freeeKey: bKey,
      freee: { partner: '架空アプリ B' },
    });
  });

  it('名指しは保存され、要求をやり直しても同じ相手へ寄る', async () => {
    const again = await load();
    expect(again.matched.find((m) => m.mfTxId === 'pick-1')?.freee.partner).toBe('架空アプリ B');
    const saved = await database
      .prepare(`SELECT freee_key FROM duplicate_verdicts WHERE user_id='default' AND tx_id='pick-1'`)
      .first<{ freee_key: string | null }>();
    expect(saved?.freee_key).toMatch(/^v1:freee:/);
  });
});
