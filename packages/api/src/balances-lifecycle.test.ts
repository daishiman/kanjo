/**
 * 残高(BS)の API/D1 ライフサイクル回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空の残高だけで検証する。
 *
 * 見張っているのは2つ。
 *   1. 資産推移CSVを入れ直しても資産が増えないこと(月ごと1点のはずが行が積み上がる事故)
 *   2. CSVの取込が、手入力した負債を消さないこと
 *      (資産だけ残って負債が消えると、純資産が実態より良く見える)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

const env = () => ({ ...auth, DB: d1, FILES: files });

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

async function jsonRequest(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );
}

/**
 * MFの資産推移CSVを、本番と同じmultipart取込経路に通す。
 * 直近だけ日次・それ以前は月末という、実ファイルと同じ形を作る。
 */
const ASSET_CSV = [
  '日付,合計（円）,預金・現金（円）,投資信託（円）',
  '2026/08/28,300,100,200',
  '2026/08/27,280,80,200',
  '2026/07/31,240,40,200',
].join('\n');

async function importAssets(body = ASSET_CSV, name = '資産推移月次.csv'): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  return app.request('/api/imports', { method: 'POST', headers: { cookie }, body: form }, env());
}

const balanceRows = async () =>
  (
    await d1
      .prepare(
        'SELECT month, date, side, category, amount, source FROM balance_entries WHERE user_id = ? ORDER BY month, side, category',
      )
      .bind('default')
      .all<{
        month: string;
        date: string;
        side: string;
        category: string;
        amount: number;
        source: string;
      }>()
  ).results;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'balances-lifecycle-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
}, 30_000);

beforeEach(async () => {
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name)))
    await d1.prepare(`DELETE FROM "${name}"`).run();
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    env(),
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await mf?.dispose();
});

describe('資産推移CSVの取込', () => {
  it('日次と月次が混ざったCSVを、月ごとに1点だけ保存する', async () => {
    const response = await importAssets();
    expect(response.status).toBe(200);
    const rows = await balanceRows();
    // 8月は3行あるが残るのは08/28の1点。7月は月末の1点
    expect(rows).toEqual([
      {
        month: '2026-07',
        date: '2026-07-31',
        side: 'asset',
        category: '投資信託',
        amount: 200,
        source: 'mf',
      },
      {
        month: '2026-07',
        date: '2026-07-31',
        side: 'asset',
        category: '預金・現金',
        amount: 40,
        source: 'mf',
      },
      {
        month: '2026-08',
        date: '2026-08-28',
        side: 'asset',
        category: '投資信託',
        amount: 200,
        source: 'mf',
      },
      {
        month: '2026-08',
        date: '2026-08-28',
        side: 'asset',
        category: '預金・現金',
        amount: 100,
        source: 'mf',
      },
    ]);
  });

  it('同じCSVを入れ直しても残高が積み上がらない', async () => {
    expect((await importAssets()).status).toBe(200);
    // 「同じ内容でも取り込み直す」を指定しない限り重複としてスキップされる
    expect((await importAssets(ASSET_CSV, '資産推移月次(2).csv')).status).toBe(200);
    expect(await balanceRows()).toHaveLength(4);
  });

  it('残高が変わったCSVは、同じ月の行を置き換える(足さない)', async () => {
    expect((await importAssets()).status).toBe(200);
    const updated = ['日付,合計（円）,預金・現金（円）,投資信託（円）', '2026/08/31,500,300,200'].join('\n');
    expect((await importAssets(updated, '資産推移月次-更新.csv')).status).toBe(200);
    const august = (await balanceRows()).filter((r) => r.month === '2026-08');
    expect(august.map((r) => [r.category, r.amount, r.date])).toEqual([
      ['投資信託', 200, '2026-08-31'],
      ['預金・現金', 300, '2026-08-31'],
    ]);
    // 7月は今回のCSVに無いので触らない
    expect((await balanceRows()).filter((r) => r.month === '2026-07')).toHaveLength(2);
  });

  it('収支の集計には1円も入らない', async () => {
    expect((await importAssets()).status).toBe(200);
    const agg = await d1
      .prepare('SELECT COUNT(*) AS n FROM monthly_agg WHERE user_id = ?')
      .bind('default')
      .first<{ n: number }>();
    expect(agg?.n).toBe(0);
  });
});

describe('負債の手入力', () => {
  it('月ごとに種類別の残高を保存する', async () => {
    const response = await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [
        { category: 'クレジットカード未払金', amount: 50 },
        { category: '借入金', amount: 0 },
      ],
    });
    expect(response.status).toBe(200);
    const rows = await balanceRows();
    expect(rows.map((r) => [r.category, r.amount, r.source])).toEqual([
      ['クレジットカード未払金', 50, 'manual'],
      ['借入金', 0, 'manual'],
    ]);
  });

  it('入れ直すと、その月の手入力だけを置き換える', async () => {
    await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [{ category: 'クレジットカード未払金', amount: 50 }],
    });
    await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [{ category: '借入金', amount: 70 }],
    });
    expect((await balanceRows()).map((r) => [r.category, r.amount])).toEqual([['借入金', 70]]);
  });

  it('一覧に無い種類は受けない', async () => {
    // 自由入力にすると月ごとに名前が揺れて、前月と比べられなくなる
    const response = await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [{ category: '架空の負債', amount: 1 }],
    });
    expect(response.status).toBe(400);
  });

  it('資産推移CSVの取込で消えない', async () => {
    await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [{ category: 'クレジットカード未払金', amount: 50 }],
    });
    expect((await importAssets()).status).toBe(200);
    const manual = (await balanceRows()).filter((r) => r.source === 'manual');
    // 消えると、資産だけが残って純資産が実態より良く見える
    expect(manual.map((r) => [r.month, r.category, r.amount])).toEqual([
      ['2026-08', 'クレジットカード未払金', 50],
    ]);
  });
});

describe('決算書の貸借対照表', () => {
  it('負債を入れていない月の純資産を出さない', async () => {
    expect((await importAssets()).status).toBe(200);
    const response = await jsonRequest('/statements');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      bs: {
        months: Array<{ month: string; assetTotal: number; netAssets: number | null; partial: boolean }>;
        monthsWithoutLiabilities: string[];
      };
    };
    expect(body.bs.months.map((m) => [m.month, m.assetTotal, m.netAssets])).toEqual([
      ['2026-07', 240, null],
      ['2026-08', 300, null],
    ]);
    expect(body.bs.monthsWithoutLiabilities).toEqual(['2026-07', '2026-08']);
  });

  it('負債を入れた月だけ純資産を出す', async () => {
    expect((await importAssets()).status).toBe(200);
    await jsonRequest('/balances/liabilities', 'PUT', {
      month: '2026-08',
      lines: [{ category: 'クレジットカード未払金', amount: 120 }],
    });
    const body = (await (await jsonRequest('/statements')).json()) as {
      bs: { months: Array<{ month: string; netAssets: number | null; partial: boolean; asOf: string }> };
    };
    expect(body.bs.months.map((m) => [m.month, m.netAssets])).toEqual([
      ['2026-07', null],
      ['2026-08', 180],
    ]);
    // 8月は28日時点。31日の残高ではないと画面で断れるようにする
    expect(body.bs.months[1].partial).toBe(true);
    expect(body.bs.months[1].asOf).toBe('2026-08-28');
  });
});
