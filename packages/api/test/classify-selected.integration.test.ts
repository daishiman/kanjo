/**
 * 選択の読み出し (GET /api/transactions/selected) と一覧の表示件数 (GET /api/transactions の limit) の契約
 * (spec-classify-bulk-save FR-11・AC-21・AC-25 / SYS-CLASSIFY-BULK-P04)。
 *
 * 契約の正本は specs/spec-classify-bulk-save.md の「API: 選択の読み出し」と一覧の節。
 * ここで固定するのは次の 4 つである。
 * - 一覧の期間・絞り込みの外にある明細も、行の key から一覧と同じ形の行で引き直せる (AC-21)
 * - 他の利用者の key と存在しない key は、区別できない形で missing に入る (AC-25)。
 *   形の違う key と 200 字を超える key も 400 にせず missing に入る
 * - keys の件数 (1〜50 の外) と重複は 400 invalid_query。50 件の key でも 1 文の bound parameter は 100 以内
 * - 一覧は表示件数 25・50・100 を受け (既定 50)、受けた値でページを切る。応答にページを掛けない transactions は無い
 *
 * ## 置換前に落ちる理由
 *
 * 置換前は選択の読み出しの route が無い。一覧は limit=50 だけを受けて 25・100 を 400 にし、
 * 互換のためにページを掛けない全件の transactions を返している。
 * 401・403 の 2 件は route より前の middleware が返すので、置換前でも通る。
 *
 * 実データを使わず、専用のインメモリ D1 と架空の明細だけで検証する。
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
  BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-32-characters-minimum',
};
const MONTH = '2026-09';
const PERIOD = `from=${MONTH}&to=${MONTH}`;
/** 同じ月に入れる架空の明細の数。表示件数 100 でも 2 ページ目ができる数にする */
const FILLER_ROWS = 110;
const fillerId = (i: number): string => `tx-fill-${String(i).padStart(3, '0')}`;
/** 一覧の 2026-09 に出る利用者自身の明細の数 (埋め草 + 架空喫茶) */
const MONTH_TOTAL = FILLER_ROWS + 1;

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
const get = (path: string, options: { headers?: Record<string, string>; db?: D1Database } = {}) =>
  app.request(`/api${path}`, { headers: options.headers ?? { cookie } }, env(options.db));
const send = (path: string, method: 'POST' | 'PUT', body: unknown) =>
  app.request(
    `/api${path}`,
    { method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) },
    env(),
  );
/** key は 1 件ずつ URL エンコードしてカンマで繋ぐ (内訳の lineId は記号を含みうる) */
const selectedPath = (keys: readonly string[]): string =>
  `/transactions/selected?keys=${keys.map(encodeURIComponent).join(',')}`;

interface Row {
  id: string;
  rowKey: string;
  rowKind: string;
  [field: string]: unknown;
}
interface SelectedBody {
  rows: Row[];
  missing: string[];
}
interface ListBody {
  rows: Row[];
  total: number;
  page: number;
  limit: number;
}

const listOf = async (query: string): Promise<ListBody> => {
  const response = await get(`/transactions?${query}`);
  expect(response.status, query).toBe(200);
  return (await response.json()) as ListBody;
};
/** 一覧に出ている行をそのまま取る。選択の読み出しの結果と丸ごと比べる相手 */
const listRow = async (query: string, rowKey: string): Promise<Row> => {
  const row = (await listOf(query)).rows.find((candidate) => candidate.rowKey === rowKey);
  expect(row, `${query} に ${rowKey} がある`).toBeDefined();
  return row as Row;
};
const selectedOf = async (keys: readonly string[], db?: D1Database): Promise<SelectedBody> => {
  const response = await get(selectedPath(keys), { db });
  expect(response.status).toBe(200);
  return (await response.json()) as SelectedBody;
};
/** 並びの細部は実装に委ねられている (仕様の実行セマンティクス)。比べるときは key で並べ直す */
const byRowKey = (rows: readonly Row[]): Row[] => [...rows].sort((a, b) => a.rowKey.localeCompare(b.rowKey));

/** 1 回の要求で D1 に渡った文ごとの bound parameter の数を記録する */
const bindingObserver = (): { database: D1Database; bindings: () => number[] } => {
  const counts: number[] = [];
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) => {
            counts.push(values.length);
            return (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrapStatement(target.prepare(sql));
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database: proxy, bindings: () => counts };
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-selected',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  const fillerRows = Array.from({ length: FILLER_ROWS }, (_, i) => [
    fillerId(i),
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
      .bind(MONTH, JSON.stringify(fillerRows)),
    database.prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES
        ('default','tx-sel-sep','${MONTH}','${MONTH}-29','架空喫茶',-480,'食費','カフェ',1,0,1),
        ('default','tx-sel-may','2026-05','2026-05-12','架空書店',-1500,'食費','カフェ',1,0,1),
        ('default','tx-sel-split','2026-07','2026-07-03','架空市場',-1000,'食費','カフェ',1,0,1),
        ('other-user','tx-foreign-sel','${MONTH}','${MONTH}-10','別利用者の架空店',-9999,'食費','カフェ',1,0,1)`,
    ),
  ]);
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('選択の読み出しの要求全体の拒否', () => {
  it('Cookie が無ければ 401', async () => {
    const response = await get(selectedPath(['mf:tx-sel-sep']), { headers: {} });
    expect(response.status).toBe(401);
  });

  it('停止中の利用者は 401', async () => {
    const pending = await loginForTest(app, env(), {
      id: 'selected-temp-user',
      email: 'selected-temp-user@example.test',
      password: 'Synthetic-Temp-Password-1',
      status: 'suspended',
    });
    const response = await get(selectedPath(['mf:tx-sel-sep']), { headers: { cookie: pending } });
    expect(response.status).toBe(401);
  });

  it('51 件・重複・空の keys・keys 無しは 400 invalid_query', async () => {
    const cases: [string, string][] = [
      ['51 件', selectedPath(Array.from({ length: 51 }, (_, i) => `mf:${fillerId(i)}`))],
      ['重複', selectedPath(['mf:tx-sel-sep', 'mf:tx-sel-sep'])],
      ['空の keys', '/transactions/selected?keys='],
      ['keys 無し', '/transactions/selected'],
    ];
    for (const [label, path] of cases) {
      const response = await get(path);
      expect(response.status, label).toBe(400);
      expect(await response.json(), label).toMatchObject({ error: { code: 'invalid_query' } });
    }
  });
});

describe('表示外の明細も key で引き直せる (AC-21)', () => {
  it('一覧の期間と絞り込みの外にある明細も、一覧と同じ形の行で返る', async () => {
    // 前提: 事業だけの絞り込みに未整理の明細は出ず、2026-09 の一覧に 2026-05 の明細は出ない
    const filtered = await listOf(`${PERIOD}&cls=biz&q=${encodeURIComponent('架空喫茶')}`);
    expect(filtered.total).toBe(0);
    const september = await listOf(`${PERIOD}&q=${encodeURIComponent('架空書店')}`);
    expect(september.total).toBe(0);

    const body = await selectedOf(['mf:tx-sel-sep', 'mf:tx-sel-may']);
    expect(body.missing).toEqual([]);
    // 提案・信頼度・根拠文・並べ替え用の値の落とし方まで、一覧の行と同じであることを丸ごと比べる
    expect(byRowKey(body.rows)).toEqual(
      byRowKey([
        await listRow(`${PERIOD}&q=${encodeURIComponent('架空喫茶')}`, 'mf:tx-sel-sep'),
        await listRow('from=2026-05&to=2026-05', 'mf:tx-sel-may'),
      ]),
    );
  });

  it('現金の明細と分割の内訳も、一覧の行の key のまま引ける。分割した親の key は見つからない', async () => {
    const created = await send('/cash-entries', 'POST', {
      date: '2026-08-10',
      side: 'per',
      owner: 'family',
      io: 'expense',
      amount: 650,
      description: '架空売店',
      big: '食費',
      mid: 'カフェ',
      memo: null,
    });
    expect(created.status).toBe(201);
    const { entry } = (await created.json()) as { entry: { id: number } };
    // 現金の取引 id は cash:<番号> なので、行の key は接頭辞が 2 つ重なる
    const cashKey = `cash:cash:${entry.id}`;
    const cashRow = await listRow('from=2026-08&to=2026-08', cashKey);
    expect(cashRow.rowKind).toBe('cash');

    const split = await send('/transactions/tx-sel-split/splits', 'PUT', {
      lines: [
        { amount: 600, cls: 'per', big: '食費', mid: 'カフェ' },
        { amount: 400, cls: 'per', big: '食費', mid: 'カフェ' },
      ],
    });
    expect(split.status).toBe(200);
    const splitRows = (await listOf('from=2026-07&to=2026-07')).rows.filter((row) => row.rowKind === 'split');
    expect(splitRows).toHaveLength(2);

    const body = await selectedOf([cashKey, ...splitRows.map((row) => row.rowKey), 'mf:tx-sel-split']);
    expect(byRowKey(body.rows)).toEqual(byRowKey([cashRow, ...splitRows]));
    // 正常に分割した親は一覧の行に無い。一覧の行の key として引けないので見つからない扱いにする
    expect(body.missing).toEqual(['mf:tx-sel-split']);
  });
});

describe('見つからない key は 400 にせず missing に入れる (AC-25)', () => {
  it('他の利用者の key と存在しない key は、同じ形で missing に入る', async () => {
    const foreign = await selectedOf(['mf:tx-foreign-sel']);
    const absent = await selectedOf(['mf:tx-sel-none']);
    expect(foreign).toEqual({ rows: [], missing: ['mf:tx-foreign-sel'] });
    expect(absent).toEqual({ rows: [], missing: ['mf:tx-sel-none'] });

    const mixed = await selectedOf(['mf:tx-sel-sep', 'mf:tx-foreign-sel']);
    expect(mixed.rows.map((row) => row.rowKey)).toEqual(['mf:tx-sel-sep']);
    expect(mixed.missing).toEqual(['mf:tx-foreign-sel']);
    // 他の利用者の明細の項目を応答に含めない
    expect(JSON.stringify(mixed)).not.toContain('別利用者の架空店');
  });

  it('形の違う key・種類の違う key・201 字の key は missing に入り、他の key は引ける', async () => {
    const odd = [
      'bogus',
      'xx:tx-sel-sep',
      'mf:',
      `mf:${'x'.repeat(198)}`,
      // MF の明細を現金・内訳の key で引いても当たらない (種類も key の一部)
      'cash:tx-sel-may',
      'split:tx-sel-may',
    ];
    expect(odd[3]).toHaveLength(201);
    const body = await selectedOf(['mf:tx-sel-sep', ...odd]);
    expect(body.rows.map((row) => row.rowKey)).toEqual(['mf:tx-sel-sep']);
    expect([...body.missing].sort()).toEqual([...odd].sort());
  });
});

describe('読み出しは bound parameter の上限の内に収まる', () => {
  it('50 件の key でも、1 文の bound parameter は 100 以内', async () => {
    const keys = Array.from({ length: 50 }, (_, i) => `mf:${fillerId(i)}`);
    const observed = bindingObserver();
    const body = await selectedOf(keys, observed.database);
    expect(body.rows).toHaveLength(50);
    expect(body.missing).toEqual([]);
    // 0 件しか観測していないのに「違反 0 件」と読まないよう、観測した文があることも見る
    expect(observed.bindings().length).toBeGreaterThan(0);
    expect(Math.max(...observed.bindings())).toBeLessThanOrEqual(100);
  });
});

describe('一覧の表示件数 (FR-11)', () => {
  it('表示件数は 25・50・100 を受け、受けた値でページを切る (既定 50)', async () => {
    const byDefault = await listOf(PERIOD);
    expect(byDefault).toMatchObject({ limit: 50, page: 1, total: MONTH_TOTAL });
    expect(byDefault.rows).toHaveLength(50);

    const quarter = await listOf(`${PERIOD}&limit=25`);
    expect(quarter).toMatchObject({ limit: 25, total: MONTH_TOTAL });
    expect(quarter.rows).toHaveLength(25);

    const hundred = await listOf(`${PERIOD}&limit=100`);
    expect(hundred).toMatchObject({ limit: 100, total: MONTH_TOTAL });
    expect(hundred.rows).toHaveLength(100);

    // ページの切れ目は受けた表示件数で決まる (25 件の 2 ページ目 = 100 件の 26〜50 件目)
    const quarterPage2 = await listOf(`${PERIOD}&limit=25&page=2`);
    expect(quarterPage2.rows.map((row) => row.id)).toEqual(hundred.rows.slice(25, 50).map((row) => row.id));
    const hundredPage2 = await listOf(`${PERIOD}&limit=100&page=2`);
    expect(hundredPage2.rows).toHaveLength(MONTH_TOTAL - 100);
  });

  it('応答にページを掛けない全件の transactions は無い', async () => {
    for (const query of [PERIOD, `${PERIOD}&limit=100`]) {
      const body = (await listOf(query)) as unknown as Record<string, unknown>;
      expect(Object.keys(body), query).not.toContain('transactions');
    }
  });
});
