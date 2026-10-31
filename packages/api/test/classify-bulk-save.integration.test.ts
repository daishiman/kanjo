/**
 * 一括保存 (POST /api/transactions/bulk) の契約 (spec-classify-bulk-save AC-06・AC-07・AC-23〜AC-29・BR-04 /
 * SYS-CLASSIFY-BULK-P04)。
 *
 * 契約の正本は specs/spec-classify-bulk-save.md と docs/classify-screen/bulk-save-decisions.md。
 * ここで固定するのは、要求全体の拒否 (401・403・400・413) で何も書かれないこと、1 件の失敗が他を巻き込まないこと、
 * 書いた明細の履歴が変わった項目ごとに 1 行ずつ残ること、50 件・100 件でも D1 のクエリが 49 本以内に収まること、
 * 同じ要求の 2 回目は何も書かないことの 5 つである。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の一括保存は旧形式 (値の欄を item に直接持つ形) だけを受け、新形式 `{ txId, draft }` を知らない。
 * 本文の上限 (256KB の 413)、クエリ本数の台帳 (BULK_SAVE_QUERY_LEDGER・planBulkSaveQueries)、
 * 予約の値『カテゴリなし』の拒否、確定済みで変わらない明細を書かずに返す no_change、
 * 分割の親と内訳行を split_line_not_supported で断ることも無い。
 * 新しい export は置換前に存在しないので、ファイルごと落ちないようにテストの中で動的に import する。
 *
 * 実データを使わず、専用のインメモリ D1 と架空の明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { splitMigrationStatements } from '../src/migration-test-support.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-32-characters-minimum',
};
/** 予約の値。core の NO_CATEGORY は置換前に無いので字面で書く */
const RESERVED = 'カテゴリなし';
const MONTH = '2026-09';
/** 架空の明細の数。テストごとに範囲を分けて使う (保存済みの明細は次の保存で no_change になるため) */
const BULK_ROWS = 171;
const bulkId = (i: number): string => `tx-bulk-${String(i).padStart(3, '0')}`;
const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, k) => bulkId(from + k));
/** 未整理の明細をそのまま確定させる下書き (取込の値と同じ組・名義は家族) */
const SAVE_DRAFT = { cls: 'per', big: '食費', mid: 'カフェ', owner: 'family' } as const;

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

const env = (db: D1Database = database) => ({ ...auth, DB: db });
const request = (body: unknown, options: { headers?: Record<string, string>; db?: D1Database } = {}) =>
  app.request(
    '/api/transactions/bulk',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.headers ?? { cookie }) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env(options.db),
  );
const put = (path: string, body: unknown) =>
  app.request(
    `/api${path}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    },
    env(),
  );

interface ItemResult {
  txId: string;
  ok: boolean;
  status?: string;
  error?: { code: string; message: string };
}
interface BulkBody {
  results: ItemResult[];
  opId: string;
  saved: number;
  failed: number;
}

const bulkOf = async (response: Response): Promise<BulkBody> => {
  expect(response.status).toBe(200);
  return (await response.json()) as BulkBody;
};
const draftItems = (ids: readonly string[], draft: Record<string, unknown> = SAVE_DRAFT) =>
  ids.map((txId) => ({ txId, draft }));

const countOf = async (sql: string, ...binds: unknown[]): Promise<number> =>
  (
    (await database
      .prepare(sql)
      .bind(...binds)
      .first<{ n: number }>()) as { n: number }
  ).n;
/** 何も書かれていないことを見る 3 つの表の指紋 (default の利用者) */
const fingerprint = async () => ({
  edits: await countOf("SELECT COUNT(*) AS n FROM tx_edits WHERE user_id='default'"),
  history: await countOf("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'"),
  aggregate: (
    await database
      .prepare("SELECT month, scope, amount FROM monthly_agg WHERE user_id='default' ORDER BY month, scope")
      .all()
  ).results,
});
const historyOfOp = async (opId: string) =>
  (
    await database
      .prepare(
        'SELECT tx_id, field, before_value, after_value, source, confidence FROM tx_history WHERE op_id=? ORDER BY tx_id, field',
      )
      .bind(opId)
      .all<{
        tx_id: string;
        field: string;
        before_value: string | null;
        after_value: string | null;
        source: string;
        confidence: number | null;
      }>()
  ).results;
const editRowsOf = async (ids: readonly string[]) =>
  (
    await database
      .prepare(
        `SELECT * FROM tx_edits WHERE user_id='default' AND tx_id IN (${ids.map(() => '?').join(',')}) ORDER BY tx_id`,
      )
      .bind(...ids)
      .all()
  ).results;

/**
 * 1 回の要求で D1 に発行したクエリの数と、batch に載った文の SQL を数える。
 * batch() は中の文の数で数える (Workers Free の数え方と同じ)。
 */
const observedDatabase = (): { database: D1Database; count: () => number; batchSql: () => string[] } => {
  let queryCount = 0;
  const batchSql: string[] = [];
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrapStatement = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrapStatement(
              (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
              sql,
            );
        }
        if (property === 'run' || property === 'all' || property === 'first' || property === 'raw') {
          return (...values: unknown[]) => {
            queryCount++;
            return (Reflect.get(target, property, receiver) as (...args: unknown[]) => unknown).call(
              target,
              ...values,
            );
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, sql);
    return proxy;
  };
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrapStatement(target.prepare(sql), sql);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          queryCount += statements.length;
          batchSql.push(...statements.map((statement) => sqlByStatement.get(statement) ?? ''));
          return target.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database: proxy, count: () => queryCount, batchSql: () => batchSql };
};

/** 集計の置き換えを含む batch の末尾に制約違反を足し、batch 全体を失敗させる (全件か無しの確認) */
const failingAggregateDatabase = (): D1Database => {
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrap((target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values), sql);
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, sql);
    return proxy;
  };
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          const sql = statements.map((statement) => sqlByStatement.get(statement) ?? '');
          const raw = statements.map((statement) => originals.get(statement) ?? statement);
          if (sql.some((text) => /DELETE FROM "monthly_agg"/i.test(text)))
            raw.push(target.prepare("INSERT INTO tx_history (id) VALUES ('forced-aggregate-failure')"));
          return target.batch(raw);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-bulk-save',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  const bulkRows = Array.from({ length: BULK_ROWS }, (_, i) => [
    bulkId(i),
    `${MONTH}-${String((i % 28) + 1).padStart(2, '0')}`,
    `架空店${String(i).padStart(3, '0')}`,
    -(100 + i),
  ]);
  await database.batch([
    database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         SELECT 'default', json_extract(item.value,'$[0]'), ?, json_extract(item.value,'$[1]'),
                json_extract(item.value,'$[2]'), json_extract(item.value,'$[3]'), '食費', 'カフェ', 1, 0, 1
         FROM json_each(?) AS item`,
      )
      .bind(MONTH, JSON.stringify(bulkRows)),
    database.prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES
        ('default','tx-src-pen','${MONTH}','${MONTH}-03','架空文具店',-1200,'日用品','文具',1,0,1),
        ('default','tx-split-src','${MONTH}','${MONTH}-04','架空市場',-1000,'食費','カフェ',1,0,1),
        ('other-user','tx-foreign-2','${MONTH}','${MONTH}-05','別利用者の架空店',-9999,'食費','カフェ',1,0,1)`,
    ),
  ]);
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('要求全体の拒否は何も書かない (AC-23・AC-24)', () => {
  it('Cookie が無ければ 401', async () => {
    const before = await fingerprint();
    const response = await request({ items: draftItems([bulkId(0)]) }, { headers: {} });
    expect(response.status).toBe(401);
    expect(await fingerprint()).toEqual(before);
  });

  it('停止中の利用者は 401', async () => {
    const pending = await loginForTest(app, env(), {
      id: 'bulk-temp-user',
      email: 'bulk-temp-user@example.test',
      password: 'Synthetic-Temp-Password-1',
      status: 'suspended',
    });
    const before = await fingerprint();
    const response = await request({ items: draftItems([bulkId(0)]) }, { headers: { cookie: pending } });
    expect(response.status).toBe(401);
    expect(await fingerprint()).toEqual(before);
  });

  it('101 件・同じ明細の重複・一括指定の『カテゴリなし』は 400 invalid_body', async () => {
    const before = await fingerprint();
    const cases: { body: unknown; message?: string }[] = [
      { body: { items: draftItems(range(0, 100)) }, message: '入力を確認してください' },
      { body: { items: draftItems([bulkId(0), bulkId(0)]) }, message: '同じ明細が複数回含まれています' },
      { body: { bulk: { cls: 'per', big: RESERVED }, items: draftItems([bulkId(0)]) }, message: RESERVED },
      // 前後の空白を除いて一致するものも予約の値 (BR-04)
      {
        body: { bulk: { cls: 'per', big: ` ${RESERVED} ` }, items: draftItems([bulkId(0)]) },
        message: RESERVED,
      },
    ];
    for (const { body, message } of cases) {
      const response = await request(body);
      expect(response.status).toBe(400);
      const json = (await response.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('invalid_body');
      if (message) expect(json.error.message).toContain(message);
    }
    expect(await fingerprint()).toEqual(before);
  });

  it('256KB を超える本文は読む前に 413 payload_too_large', async () => {
    const before = await fingerprint();
    const response = await request({
      items: [{ txId: bulkId(0), draft: { ...SAVE_DRAFT, note: 'x'.repeat(300 * 1024) } }],
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: 'payload_too_large' } });
    expect(await fingerprint()).toEqual(before);
  });

  it('一括 100 件は受け、101 件は 400 (BR-14 の境界)', async () => {
    // 未知の明細だけなら 100 件でも何も書かない。同じ形の 100 件が通ることで、101 件の 400 が件数の上限によると分かる
    const unknownIds = (n: number) => Array.from({ length: n }, (_, i) => `tx-missing-${i}`);
    const before = await fingerprint();
    const hundred = await bulkOf(await request({ items: draftItems(unknownIds(100)) }));
    expect(hundred).toMatchObject({ saved: 0, failed: 100 });
    const over = await request({ items: draftItems(unknownIds(101)) });
    expect(over.status).toBe(400);
    expect(await over.json()).toEqual({ error: { code: 'invalid_body', message: '入力を確認してください' } });
    expect(await fingerprint()).toEqual(before);
  });

  it('本文は 262144 バイト (256KB ちょうど) まで読み、262145 バイトは 413 (AC-24 の境界)', async () => {
    const { BULK_BODY_MAX_BYTES } = await import('../src/routes/classify-bulk.js');
    // 仕様の値で固定する。route の定数で本文を作ると、定数を変えたときにテストも一緒に動き、境界のずれを見逃す
    const SPEC_MAX = 256 * 1024;
    expect(BULK_BODY_MAX_BYTES).toBe(SPEC_MAX);
    const json = JSON.stringify({ items: draftItems(['tx-missing-boundary']) });
    /** JSON の後ろを空白で埋め、UTF-8 でちょうど size バイトの本文にする (JSON として有効なまま) */
    const padTo = (size: number): string => {
      const bytes = new TextEncoder().encode(json).length;
      expect(bytes).toBeLessThanOrEqual(size);
      return json + ' '.repeat(size - bytes);
    };
    const before = await fingerprint();
    // hono の bodyLimit は Content-Length があればその値で、無ければ読んだバイト数で判定する。両方の経路を見る
    for (const withLength of [false, true]) {
      const send = (body: string) =>
        request(body, {
          headers: withLength
            ? { cookie, 'content-length': String(new TextEncoder().encode(body).length) }
            : { cookie },
        });
      // 未知の明細だけの本文なので、上限の内なら 200 の not_found で何も書かない
      const atLimit = await bulkOf(await send(padTo(SPEC_MAX)));
      expect(atLimit.results).toMatchObject([
        { txId: 'tx-missing-boundary', ok: false, error: { code: 'not_found' } },
      ]);
      const over = await send(padTo(SPEC_MAX + 1));
      expect(over.status).toBe(413);
      expect(await over.json()).toEqual({
        error: { code: 'payload_too_large', message: 'リクエストが大きすぎます' },
      });
    }
    expect(await fingerprint()).toEqual(before);
  });
});

describe('50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27)', () => {
  for (const [label, ids] of [
    ['50 件', range(0, 49)],
    ['100 件', range(50, 149)],
  ] as const) {
    it(`${label}: 実測は 49 本以内で、台帳の見積り以下`, async () => {
      const { planBulkSaveQueries } = await import('../src/routes/classify-bulk.js');
      const observed = observedDatabase();
      const body = await bulkOf(await request({ items: draftItems(ids) }, { db: observed.database }));
      expect(body.saved).toBe(ids.length);
      expect(body.failed).toBe(0);
      expect(body.results.every((r) => r.ok)).toBe(true);

      // 見積りは batch に実際に載った文の数から作る。台帳が実装より少なく見積もっていれば実測が上回る
      const sql = observed.batchSql();
      const plan = planBulkSaveQueries({
        deletes: sql.filter((s) => /^\s*DELETE FROM tx_edits\b/i.test(s)).length,
        edits: sql.filter((s) => /^\s*INSERT INTO tx_edits\b/i.test(s)).length,
        history: sql.filter((s) => /^\s*INSERT INTO tx_history\b/i.test(s)).length,
      });
      expect(plan.accepted).toBe(true);
      expect(observed.count()).toBeLessThanOrEqual(plan.total);
      expect(observed.count()).toBeLessThanOrEqual(49);
      // 明細の数に比例する文は無い: 100 件でも削除・書き込み・履歴は 1 文ずつ
      expect(sql.filter((s) => /^\s*INSERT INTO tx_history\b/i.test(s))).toHaveLength(1);
      expect(await countOf('SELECT COUNT(*) AS n FROM tx_history WHERE op_id=?', body.opId)).toBe(
        ids.length * 3,
      );
    }, 60_000);
  }

  it('台帳の read は、一括保存が書く前に読むクエリの実数と一致する', async () => {
    // 合計だけを比べると、lease の最悪値 (普段は使い切らない) の余りに read の見積り不足が隠れる。読む段だけを 1 対 1 で数える
    const { BULK_SAVE_QUERY_LEDGER } = await import('../src/routes/classify-bulk.js');
    const { loadClassifyRowSource } = await import('../src/routes/classify.js');
    const { getDb } = await import('../src/store.js');
    const observed = observedDatabase();
    await loadClassifyRowSource(getDb(observed.database), 'default');
    expect(observed.count()).toBe(BULK_SAVE_QUERY_LEDGER.read);
  });

  it('台帳は 49 本を受け、50 本を拒む (上限そのものは使い切らない)', async () => {
    const { BULK_SAVE_QUERY_LEDGER, planBulkSaveQueries } = await import('../src/routes/classify-bulk.js');
    const fixed = Object.values(BULK_SAVE_QUERY_LEDGER).reduce((a, b) => a + b, 0);
    const room = 49 - fixed;
    expect(room).toBeGreaterThanOrEqual(3);
    expect(planBulkSaveQueries({ deletes: 1, edits: 1, history: room - 2 })).toMatchObject({
      total: 49,
      limit: 50,
      accepted: true,
    });
    expect(planBulkSaveQueries({ deletes: 1, edits: 1, history: room - 1 })).toMatchObject({
      total: 50,
      accepted: false,
    });
    expect(() => planBulkSaveQueries({ deletes: -1, edits: 1, history: 1 })).toThrow();
    expect(() => planBulkSaveQueries({ deletes: 1.5, edits: 1, history: 1 })).toThrow();
  });
});

describe('履歴は変わった項目ごとに 1 行 (AC-26)', () => {
  it('未整理の 2 件は 4 行ずつ、確定済みで変わらない明細は 0 行で ok と今の状態を返す', async () => {
    const settled = bulkId(164);
    expect((await put(`/transactions/${settled}/edit`, SAVE_DRAFT)).status).toBe(200);
    const historyBefore = await countOf('SELECT COUNT(*) AS n FROM tx_history WHERE tx_id=?', settled);

    const note = '架空のメモ';
    const body = await bulkOf(
      await request({
        items: [...draftItems([bulkId(150), bulkId(151)], { ...SAVE_DRAFT, note }), ...draftItems([settled])],
      }),
    );
    expect(body.saved).toBe(3);
    expect(body.results[2]).toEqual({ txId: settled, ok: true, status: expect.any(String) });
    expect(body.results[2]).not.toHaveProperty('error');

    const rows = await historyOfOp(body.opId);
    expect(rows.map((r) => [r.tx_id, r.field])).toEqual([
      [bulkId(150), 'category'],
      [bulkId(150), 'cls'],
      [bulkId(150), 'note'],
      [bulkId(150), 'owner'],
      [bulkId(151), 'category'],
      [bulkId(151), 'cls'],
      [bulkId(151), 'note'],
      [bulkId(151), 'owner'],
    ]);
    // 一括で保存したことが分かるように source は bulk、提案と一致しても信頼度は持たない (BR-13・BR-15)
    expect(rows.every((r) => r.source === 'bulk' && r.confidence === null)).toBe(true);
    // before_value は上書きの層の値。前の上書きが無い明細は取込の値が同じでも NULL
    expect(rows.map((r) => r.before_value)).toEqual(rows.map(() => null));
    expect(rows.find((r) => r.tx_id === bulkId(150) && r.field === 'category')?.after_value).toBe(
      '食費 / カフェ',
    );
    expect(rows.find((r) => r.tx_id === bulkId(150) && r.field === 'note')?.after_value).toBe(note);
    expect(await countOf('SELECT COUNT(*) AS n FROM tx_history WHERE tx_id=?', settled)).toBe(historyBefore);
  });

  it('前の上書きがある明細は、before_value に上書きの表示値を残し、変わらない項目は行を作らない', async () => {
    const overridden = bulkId(170);
    expect(
      (
        await put(`/transactions/${overridden}/edit`, {
          cls: 'per',
          big: '日用品',
          mid: '文具',
          owner: 'spouse',
        })
      ).status,
    ).toBe(200);
    // 前提: 上書きの層に前の値がある (空の層との比較で緑にしない)
    expect(await editRowsOf([overridden])).toEqual([
      expect.objectContaining({
        cls: 'per',
        category_major: '日用品',
        category_mid: '文具',
        owner: 'spouse',
      }),
    ]);

    const body = await bulkOf(await request({ items: draftItems([overridden]) }));
    expect(body.saved).toBe(1);
    const rows = await historyOfOp(body.opId);
    // 種別は家計のまま変わらないので行が無い
    expect(rows.map((r) => [r.field, r.before_value, r.after_value])).toEqual([
      ['category', '日用品 / 文具', '食費 / カフェ'],
      ['owner', '配偶者', '家族'],
    ]);
  });
});

describe('同じ要求の 2 回目は何も書かない (AC-29)', () => {
  it('2 回とも全件 ok で、saved・状態・値・月次集計が同じ。履歴は増えない', async () => {
    const ids = [bulkId(152), bulkId(153)];
    const body = { items: draftItems(ids, { ...SAVE_DRAFT, paymentMethod: 'cash', note: '架空の再送' }) };
    const first = await bulkOf(await request(body));
    expect(first.results.every((r) => r.ok)).toBe(true);
    const editsAfterFirst = await editRowsOf(ids);
    const aggregateAfterFirst = (await fingerprint()).aggregate;
    const historyAfterFirst = await countOf(
      `SELECT COUNT(*) AS n FROM tx_history WHERE tx_id IN (${ids.map(() => '?').join(',')})`,
      ...ids,
    );
    expect(historyAfterFirst).toBe(ids.length * 5);

    const second = await bulkOf(await request(body));
    expect(second.results.every((r) => r.ok)).toBe(true);
    expect(second.saved).toBe(first.saved);
    expect(second.results).toEqual(first.results);
    expect(await editRowsOf(ids)).toEqual(editsAfterFirst);
    expect((await fingerprint()).aggregate).toEqual(aggregateAfterFirst);
    expect(
      await countOf(
        `SELECT COUNT(*) AS n FROM tx_history WHERE tx_id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      ),
    ).toBe(historyAfterFirst);
  });
});

describe('batch の失敗は保存対象だけを write_failed にする (AC-06・AC-07)', () => {
  it('3 件の batch が失敗したら 200 で 3 件とも write_failed、表は 1 行も変わらない', async () => {
    const ids = range(154, 156);
    const before = await fingerprint();
    // 先の保存で集計が入っている。空どうしの比較で緑にしない
    expect(before.aggregate.length).toBeGreaterThan(0);
    const body = await bulkOf(await request({ items: draftItems(ids) }, { db: failingAggregateDatabase() }));
    expect(body.results).toEqual(
      ids.map((txId) => ({
        txId,
        ok: false,
        error: { code: 'write_failed', message: '保存できませんでした' },
      })),
    );
    expect(body).toMatchObject({ saved: 0, failed: 3 });
    expect(await fingerprint()).toEqual(before);
  });

  it('見つからない明細と入力の誤りを混ぜても、write_failed は保存対象にだけ付く', async () => {
    const body = await bulkOf(
      await request(
        {
          items: [
            { txId: bulkId(157), draft: SAVE_DRAFT },
            { txId: 'tx-missing', draft: SAVE_DRAFT },
            { txId: bulkId(158), draft: SAVE_DRAFT },
            { txId: bulkId(166), draft: { ...SAVE_DRAFT, big: '架空の大項目', mid: '' } },
          ],
        },
        { db: failingAggregateDatabase() },
      ),
    );
    expect(body.results.map((r) => [r.txId, r.error?.code])).toEqual([
      [bulkId(157), 'write_failed'],
      ['tx-missing', 'not_found'],
      [bulkId(158), 'write_failed'],
      [bulkId(166), 'invalid_item'],
    ]);
    expect(body).toMatchObject({ saved: 0, failed: 4 });
  });
});

describe('他の利用者の明細は見つからない扱い (AC-25)', () => {
  it('他の利用者の明細と未知の id は同じ not_found で、存在を明かさない', async () => {
    const body = await bulkOf(
      await request({ items: draftItems(['tx-foreign-2', 'tx-unknown-2', bulkId(167)]) }),
    );
    const [foreign, unknown, own] = body.results;
    expect(foreign?.error).toEqual({ code: 'not_found', message: '明細が見つかりません' });
    expect(foreign?.error).toEqual(unknown?.error);
    expect(own?.ok).toBe(true);
    expect(await countOf("SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id='tx-foreign-2'")).toBe(0);
    expect(await countOf("SELECT COUNT(*) AS n FROM tx_history WHERE tx_id='tx-foreign-2'")).toBe(0);
  });
});

describe('『カテゴリなし』は予約の値 (BR-04)', () => {
  it('下書きの『カテゴリなし』はその明細だけ invalid_item で、他の明細は保存される', async () => {
    const body = await bulkOf(
      await request({
        items: [
          { txId: bulkId(160), draft: { ...SAVE_DRAFT, big: RESERVED, mid: '' } },
          { txId: bulkId(161), draft: SAVE_DRAFT },
        ],
      }),
    );
    expect(body.results[0]).toMatchObject({ txId: bulkId(160), ok: false, error: { code: 'invalid_item' } });
    expect(body.results[0]?.error?.message).toContain(RESERVED);
    expect(body.results[1]).toMatchObject({ txId: bulkId(161), ok: true });
    expect(await countOf('SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id=?', bulkId(160))).toBe(0);
  });

  it('個別の編集でも『カテゴリなし』は 400 reserved_category', async () => {
    const response = await put(`/transactions/${bulkId(160)}/edit`, { cls: 'per', big: RESERVED, mid: null });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'reserved_category' } });
  });

  it('今の値が『カテゴリなし』の明細は、その値を送り返してメモだけを直せる', async () => {
    // 編集パネルは全欄を送る。新しく選んだ値ではない送り返しまで 400 にすると、カテゴリを選び直さない限り他の欄を直せない
    const id = bulkId(169);
    const toBiz = await bulkOf(await request({ bulk: { cls: 'biz' }, items: [{ txId: id, draft: {} }] }));
    expect(toBiz.results[0]).toMatchObject({ txId: id, ok: true });
    const response = await put(`/transactions/${id}/edit`, {
      cls: 'biz',
      big: RESERVED,
      mid: null,
      owner: 'family',
      paymentMethod: null,
      note: '架空のメモ',
    });
    expect(response.status).toBe(200);
    expect(
      await database.prepare('SELECT cls, category_major, note FROM tx_edits WHERE tx_id=?').bind(id).first(),
    ).toMatchObject({ cls: 'biz', category_major: RESERVED, note: '架空のメモ' });
  });

  // 画面は今の値を取込値まで含めて送り返す。送り返しの判定が上書きの層だけを見ると、
  // 上書きの無い明細はカテゴリを選び直さない限りメモも直せない。月は他のテストと重ねない
  const insertImportReserved = (txId: string, day: string) =>
    database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default',?,'2026-05',?,'架空の取込名の店',-600,?,'',1,0,1)`,
      )
      .bind(txId, `2026-05-${day}`, RESERVED)
      .run();

  it('取込値が『カテゴリなし』の明細も、個別の編集でその値を送り返して他の欄を直せる', async () => {
    await insertImportReserved('tx-import-reserved-1', '11');
    const response = await put('/transactions/tx-import-reserved-1/edit', {
      cls: 'per',
      big: RESERVED,
      mid: null,
      owner: 'family',
      paymentMethod: null,
      note: '架空のメモ',
    });
    expect(response.status).toBe(200);
    expect(
      await database
        .prepare('SELECT category_major, note FROM tx_edits WHERE tx_id=?')
        .bind('tx-import-reserved-1')
        .first(),
    ).toMatchObject({ category_major: RESERVED, note: '架空のメモ' });
  });

  it('取込値が『カテゴリなし』の明細も、一括保存の下書きでその値を送り返して他の欄を直せる', async () => {
    await insertImportReserved('tx-import-reserved-2', '12');
    const body = await bulkOf(
      await request({
        items: [
          { txId: 'tx-import-reserved-2', draft: { cls: 'per', big: RESERVED, mid: '', note: '確認済み' } },
        ],
      }),
    );
    expect(body.results[0]).toMatchObject({ txId: 'tx-import-reserved-2', ok: true });
    expect(
      await database
        .prepare('SELECT category_major, note FROM tx_edits WHERE tx_id=?')
        .bind('tx-import-reserved-2')
        .first(),
    ).toMatchObject({ category_major: RESERVED, note: '確認済み' });
  });

  it('『カテゴリなし』と空の大項目は、診断の「未分類明細」から開く一覧 (category=未分類) に出る', async () => {
    // 集計は『カテゴリなし』と空の大項目を未分類に数える。一覧の絞り込みも同じ鍵で見ないと、
    // 金額だけ見えて明細に辿り着けない
    const idsOf = async (query: string) => {
      const response = await app.request(
        `/api/transactions?${query}&limit=100`,
        { headers: { cookie } },
        env(),
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { rows: { id: string }[] }).rows.map((row) => row.id);
    };
    const uncategorized = encodeURIComponent('未分類');
    const id = bulkId(168);

    // 取込の値は個人の食費。事業だけを指定すると、事業の組が下書きにも土台にも無いので『カテゴリなし』で保存する
    const toBiz = await bulkOf(await request({ bulk: { cls: 'biz' }, items: [{ txId: id, draft: {} }] }));
    expect(toBiz.results[0]).toMatchObject({ txId: id, ok: true });
    expect(await idsOf(`month=${MONTH}&category=${uncategorized}`)).toContain(id);
    // 予約の値そのものを指定したときの完全一致も残す
    expect(await idsOf(`month=${MONTH}&category=${encodeURIComponent(RESERVED)}`)).toContain(id);
    expect(await idsOf(`month=${MONTH}&category=${encodeURIComponent('食費')}`)).not.toContain(id);

    // 個人へ付け替えても、個人の組は今の値に無いので『カテゴリなし』のまま。診断の入口の URL そのもので開ける
    const toPer = await bulkOf(await request({ bulk: { cls: 'per' }, items: [{ txId: id, draft: {} }] }));
    expect(toPer.results[0]).toMatchObject({ txId: id, ok: true });
    expect(
      await database.prepare('SELECT cls, category_major FROM tx_edits WHERE tx_id=?').bind(id).first(),
    ).toMatchObject({ cls: 'per', category_major: RESERVED });
    expect(await idsOf(`month=${MONTH}&cls=per&category=${uncategorized}`)).toContain(id);

    // 大項目が空の明細も未分類に数える (別の月に置き、他のテストの明細の数を変えない)
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','tx-empty-big','2026-08','2026-08-12','架空の雑貨店',-700,'','',1,0,1)`,
      )
      .run();
    expect(await idsOf(`month=2026-08&cls=per&category=${uncategorized}`)).toContain('tx-empty-big');
  });
});

describe('新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04)', () => {
  // 予約の値を通すのは、今の値を送り返す保存 (一括保存の下書き・個別の編集) だけ。
  // ルール・分割・取引先の記憶・現金は新しい値を作る窓口なので、候補に無い値として 400 にする
  const send = (method: string, path: string, body: unknown) =>
    app.request(
      `/api${path}`,
      { method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) },
      env(),
    );
  const expectInvalidCategory = async (response: Response) => {
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_category' } });
  };

  it('ルール', async () => {
    const before = await countOf("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'");
    await expectInvalidCategory(
      await send('POST', '/rules', { keyword: '架空予約キーワード', cls: 'per', big: RESERVED }),
    );
    expect(await countOf("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'")).toBe(before);
  });

  it('分割の内訳', async () => {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','tx-split-reserved','2026-07','2026-07-08','架空の分割店',-1000,'食費','カフェ',1,0,1)`,
      )
      .run();
    await expectInvalidCategory(
      await put('/transactions/tx-split-reserved/splits', {
        lines: [
          { cls: 'per', big: '食費', mid: 'カフェ', amount: 600 },
          { cls: 'per', big: RESERVED, mid: '', amount: 400 },
        ],
      }),
    );
    expect(await countOf("SELECT COUNT(*) AS n FROM tx_splits WHERE tx_id='tx-split-reserved'")).toBe(0);
  });

  it('取引先の記憶', async () => {
    const before = await countOf("SELECT COUNT(*) AS n FROM vendor_memory WHERE user_id='default'");
    await expectInvalidCategory(
      await send('PATCH', `/vendor-memory/${encodeURIComponent('架空予約店')}`, {
        cls: 'per',
        big: RESERVED,
      }),
    );
    expect(await countOf("SELECT COUNT(*) AS n FROM vendor_memory WHERE user_id='default'")).toBe(before);
  });

  it('現金の記録', async () => {
    const before = await countOf("SELECT COUNT(*) AS n FROM cash_entries WHERE user_id='default'");
    await expectInvalidCategory(
      await send('POST', '/cash-entries', {
        date: '2026-07-10',
        side: 'per',
        io: 'expense',
        amount: 500,
        description: '架空の現金',
        big: RESERVED,
        mid: '',
        memo: null,
        owner: 'family',
      }),
    );
    expect(await countOf("SELECT COUNT(*) AS n FROM cash_entries WHERE user_id='default'")).toBe(before);
  });

  it('取込値に同じ名前の大項目があっても受けない (候補に入れない)', async () => {
    // 候補は取込値からも作るので、取込値の名前が予約の値と同じでも候補にしないことを配線ごと確かめる
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','tx-reserved-import','2026-07','2026-07-09','架空の予約名の店',-700,?,'',1,0,1)`,
      )
      .bind(RESERVED)
      .run();
    try {
      const before = await countOf("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'");
      await expectInvalidCategory(
        await send('POST', '/rules', { keyword: '架空予約取込キーワード', cls: 'per', big: RESERVED }),
      );
      expect(await countOf("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'")).toBe(before);
    } finally {
      // 同じファイルの後ろのテストは明細の件数を数えるので、足した明細を残さない
      await database.prepare("DELETE FROM mf_transactions WHERE tx_id='tx-reserved-import'").run();
    }
  });
});

describe('区分だけの提案 (まだ自動で当てない取引先の記憶) の明細は『カテゴリなし』で保存する (用語集『カテゴリなし』・BR-02)', () => {
  // 未整理の明細に大の無い提案が付くのは、まだ自動で当てない取引先の記憶が区分・名義・中項目だけを持つときだけ
  // (classify-status の candidatesFor)。MF の中項目や区分付きのルールに当たった明細は確定済みで提案を見ない。
  // 提案を組の出どころにすると、空の大項目 (= 取込値へ戻す指定) を保存し、事業の明細に家計の取込値の科目が残る
  const VENDOR = '架空区分記憶店';
  const send = (method: string, path: string, body: unknown) =>
    app.request(
      `/api${path}`,
      { method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) },
      env(),
    );
  const insertVendorTx = (txId: string, day: string) =>
    database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default',?,'2026-06',?,?,-800,'食費','外食',1,0,1)`,
      )
      .bind(txId, `2026-06-${day}`, VENDOR)
      .run();
  interface ListRow {
    id: string;
    status: string;
    scopeMismatch: boolean;
    suggestion: { cls: string | null; big: string | null; mid: string | null } | null;
  }
  const listRow = async (txId: string) => {
    const response = await app.request(
      '/api/transactions?month=2026-06&limit=100',
      { headers: { cookie } },
      env(),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { rows: ListRow[] }).rows.find((row) => row.id === txId);
  };
  // 前提を保存の前に確かめる。確定済みの明細では解決関数が提案を見ないので、未整理でなければ何も確かめていない
  const expectClsOnlySuggestion = async (txId: string) =>
    expect(await listRow(txId)).toMatchObject({
      status: 'unsorted',
      suggestion: { cls: 'biz', big: null, mid: null },
    });

  beforeAll(async () => {
    // 新しい記憶は当たった回数が 0 で、明細へは当てずに提案だけを出す
    const response = await send('PATCH', `/vendor-memory/${encodeURIComponent(VENDOR)}`, { cls: 'biz' });
    expect(response.status).toBe(200);
  });

  it('指定なしで保存すると事業の『カテゴリなし』になり、一覧で区分に合わない科目として出ない', async () => {
    await insertVendorTx('tx-cls-memory-1', '11');
    await expectClsOnlySuggestion('tx-cls-memory-1');
    const body = await bulkOf(await request({ items: [{ txId: 'tx-cls-memory-1', draft: {} }] }));
    expect(body.results[0]).toMatchObject({ txId: 'tx-cls-memory-1', ok: true });
    expect(
      await database
        .prepare('SELECT cls, category_major FROM tx_edits WHERE tx_id=?')
        .bind('tx-cls-memory-1')
        .first(),
    ).toMatchObject({ cls: 'biz', category_major: RESERVED });
    expect(await listRow('tx-cls-memory-1')).toMatchObject({ scopeMismatch: false });
  });

  it('区分だけの一括指定でも同じ', async () => {
    await insertVendorTx('tx-cls-memory-2', '12');
    await expectClsOnlySuggestion('tx-cls-memory-2');
    const body = await bulkOf(
      await request({ bulk: { cls: 'biz' }, items: [{ txId: 'tx-cls-memory-2', draft: {} }] }),
    );
    expect(body.results[0]).toMatchObject({ txId: 'tx-cls-memory-2', ok: true });
    expect(
      await database
        .prepare('SELECT cls, category_major FROM tx_edits WHERE tx_id=?')
        .bind('tx-cls-memory-2')
        .first(),
    ).toMatchObject({ cls: 'biz', category_major: RESERVED });
  });

  it('『カテゴリなし』の明細は、一括保存の下書きで今の値を送り返してメモだけを直せる', async () => {
    // 下書きは今の組 (『カテゴリなし』) を持ったまま届く。送り返しは新しい値ではないので通す (BR-04)
    const id = 'tx-cls-memory-1';
    const body = await bulkOf(
      await request({
        items: [{ txId: id, draft: { cls: 'biz', big: RESERVED, mid: '', note: '確認済み' } }],
      }),
    );
    expect(body.results[0]).toMatchObject({ txId: id, ok: true });
    expect(
      await database.prepare('SELECT cls, category_major, note FROM tx_edits WHERE tx_id=?').bind(id).first(),
    ).toMatchObject({ cls: 'biz', category_major: RESERVED, note: '確認済み' });
    expect((await historyOfOp(body.opId)).map((r) => r.field)).toEqual(['note']);
  });
});

describe('書く前に予算の超過が分かる要求は 413 (AC-28)', () => {
  it('too_many_classify_changes で results を持たず、何も書かない。同じ要求は本物の上限なら通る', async () => {
    const { planBulkSaveQueries } = await import('../src/routes/classify-bulk.js');
    // 1 件の未整理の保存は削除・書き込み・履歴が 1 文ずつ。その見積りちょうどを上限にすると「49 本以内」を超える
    const limit = planBulkSaveQueries({ deletes: 1, edits: 1, history: 1 }).total;
    const body = { items: draftItems([bulkId(159)]) };
    const before = await fingerprint();

    // scheduled-maintenance-budget はモジュールの評価時に上限で計画を検査する。import の間は本物の上限を見せ、
    // 下げるのは要求の間だけにする (getter なので、関数の中で上限を読む台帳には下げた値が届く)
    let lowered = false;
    vi.resetModules();
    vi.doMock('../src/d1-limits.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/d1-limits.js')>();
      return {
        ...actual,
        get D1_INVOCATION_QUERY_LIMIT() {
          return lowered ? limit : actual.D1_INVOCATION_QUERY_LIMIT;
        },
      };
    });
    try {
      const { app: limited } = await import('../src/index.js');
      lowered = true;
      const response = await limited.request(
        '/api/transactions/bulk',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(body),
        },
        env(),
      );
      lowered = false;
      expect(response.status).toBe(413);
      const json = (await response.json()) as Record<string, unknown>;
      expect(json).toMatchObject({ error: { code: 'too_many_classify_changes' } });
      expect(json).not.toHaveProperty('results');
    } finally {
      lowered = false;
      vi.doUnmock('../src/d1-limits.js');
      vi.resetModules();
    }
    expect(await fingerprint()).toEqual(before);

    const accepted = await bulkOf(await request(body));
    expect(accepted.results).toEqual([{ txId: bulkId(159), ok: true, status: expect.any(String) }]);
  }, 60_000);
});

describe('item の形と分割の扱い', () => {
  it('新形式は strict: draft の知らない key と、値の欄と draft の同居は invalid_item', async () => {
    const body = await bulkOf(
      await request({
        items: [
          { txId: bulkId(162), draft: { ...SAVE_DRAFT, bogus: 1 } },
          { txId: bulkId(165), cls: 'per', draft: SAVE_DRAFT },
        ],
      }),
    );
    expect(body.results.map((r) => [r.txId, r.error?.code])).toEqual([
      [bulkId(162), 'invalid_item'],
      [bulkId(165), 'invalid_item'],
    ]);
    expect(
      await countOf('SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id IN (?,?)', bulkId(162), bulkId(165)),
    ).toBe(0);
  });

  it('旧形式でメモだけを送っても、確定済みの科目は取込の値へ巻き戻らない', async () => {
    const id = bulkId(163);
    expect(
      (await put(`/transactions/${id}/edit`, { cls: 'per', big: '日用品', mid: '文具', owner: 'family' }))
        .status,
    ).toBe(200);
    const body = await bulkOf(await request({ items: [{ txId: id, note: '架空のメモだけ' }] }));
    expect(body.results[0]?.ok).toBe(true);
    const [row] = await editRowsOf([id]);
    expect(row).toMatchObject({ category_major: '日用品', category_mid: '文具', note: '架空のメモだけ' });
    expect((await historyOfOp(body.opId)).map((r) => r.field)).toEqual(['note']);
  });

  it('分割した親と内訳行は split_line_not_supported で、内訳からの編集へ案内する', async () => {
    expect(
      (
        await put('/transactions/tx-split-src/splits', {
          lines: [
            { cls: 'per', big: '食費', mid: 'カフェ', amount: 600 },
            { cls: 'per', big: '日用品', mid: '文具', amount: 400 },
          ],
        })
      ).status,
    ).toBe(200);
    const lineIds = (
      await database
        .prepare(
          "SELECT line_id FROM tx_splits WHERE user_id='default' AND tx_id='tx-split-src' ORDER BY seq",
        )
        .all<{ line_id: string }>()
    ).results.map((r) => r.line_id);
    expect(lineIds).toHaveLength(2);
    const historyBefore = await countOf("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'");

    const body = await bulkOf(await request({ items: draftItems(['tx-split-src', ...lineIds]) }));
    for (const result of body.results)
      expect(result.error).toEqual({
        code: 'split_line_not_supported',
        message: '分割済みの明細は内訳から編集してください',
      });
    expect(body).toMatchObject({ saved: 0, failed: 3 });
    expect(await countOf("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'")).toBe(historyBefore);
  });
});

describe('tx_edits の書き込みの列', () => {
  it('一括保存が書く列は tx_edits の全列 (user_id を除く) と一致する', async () => {
    const { TX_EDIT_WRITE_COLUMNS } = await import('../src/tx-edit-codec.js');
    const columns = (await database.prepare('PRAGMA table_info(tx_edits)').all<{ name: string }>()).results
      .map((c) => c.name)
      .filter((name) => name !== 'user_id');
    expect([...TX_EDIT_WRITE_COLUMNS].sort()).toEqual(columns.sort());
  });
});
