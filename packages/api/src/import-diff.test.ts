/**
 * 取込前の差分プレビュー(T09)の回帰テスト。
 *
 * 見張っているのは4つ。
 *   1. 追加・変更・削除・不変の件数が合うこと
 *   2. 双方が動いた明細だけが衝突として出ること(DR-10 / DR-11)
 *   3. 行数が増えてもクエリ数が増えないこと(5,000行で49以内)
 *   4. previewは完全に読み取り専用で、base_*とprovenanceは確定POSTだけが書くこと
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
/** その呼び出しで D1 が実際に受けた prepare の数 */
let preparedCount = 0;

const env = () => ({ ...auth, DB: countingD1(), FILES: files });

/** 発行クエリ数を数えるだけの薄い包み。数を測るのが目的なので挙動は素通しにする。 */
function countingD1(): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'prepare')
        return (sql: string) => {
          preparedCount += 1;
          return (value as D1Database['prepare']).call(target, sql);
        };
      if (prop === 'batch')
        return (statements: D1PreparedStatement[]) => (value as D1Database['batch']).call(target, statements);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
}

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

const MF_HEADER = '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関';
const mfCsv = (rows: string[]) => [MF_HEADER, ...rows].join('\n');

const row = (opts: { day: string; amount: number; big: string; mid: string; desc: string; id: string }) =>
  `1,2026/07/${opts.day},-${opts.amount},${opts.big},${opts.mid},0,${opts.desc},${opts.id},架空口座`;

const BASE_CSV = mfCsv([
  row({ day: '01', amount: 1000, big: '架空費', mid: '架空内訳', desc: '架空の支払いA', id: 'tx-a' }),
  row({ day: '02', amount: 2000, big: '架空費', mid: '架空内訳', desc: '架空の支払いB', id: 'tx-b' }),
  row({ day: '03', amount: 3000, big: '架空費', mid: '架空内訳', desc: '架空の支払いC', id: 'tx-c' }),
]);

async function upload(path: string, body: string, name: string, extra?: Record<string, string>) {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  for (const [key, value] of Object.entries(extra ?? {})) form.append(key, value);
  return app.request(path, { method: 'POST', headers: { cookie }, body: form }, env());
}

const jsonRequest = async (path: string, method = 'GET', body?: unknown): Promise<Response> =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );

/** previewで確定した同じfingerprintを、通常POSTのcommit入力にする。 */
async function confirmImport(body: string, name = 'mf.csv') {
  const previewResponse = await upload('/api/imports/diff', body, name);
  expect(previewResponse.status).toBe(200);
  const preview = (await previewResponse.json()) as DiffBody;
  const response = await upload('/api/imports', body, name, {
    force: '1',
    resolutionPlan: JSON.stringify({ fingerprint: preview.fingerprint, decisions: [] }),
  });
  return { preview, response };
}

interface DiffBody {
  months: string[];
  counts: { added: number; changed: number; deleted: number; unchanged: number };
  conflicts: Array<{
    txId: string;
    attrs: Record<string, { base: string | null; current: string | null; incoming: string | null }>;
  }>;
  backfilled: number;
  fingerprint: string;
  queries: { planned: number; limit: number };
  automation: { autoApplied: number; candidates: number; learned: number };
  candidates: Array<{
    txId: string;
    vendorKey: string;
    vendorLabel: string;
    cls: string | null;
    big: string | null;
    mid: string | null;
    owner: string | null;
    reason: string;
  }>;
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'import-diff-test',
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
  preparedCount = 0;
});

afterAll(async () => {
  await mf?.dispose();
});

describe('件数', () => {
  it('追加・変更・削除・不変を数え分ける', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);

    const next = mfCsv([
      // 不変
      row({ day: '01', amount: 1000, big: '架空費', mid: '架空内訳', desc: '架空の支払いA', id: 'tx-a' }),
      // 変更(金額が動いた)
      row({ day: '02', amount: 2500, big: '架空費', mid: '架空内訳', desc: '架空の支払いB', id: 'tx-b' }),
      // 追加。tx-c は原本から消えたので削除
      row({ day: '04', amount: 4000, big: '架空費', mid: '架空内訳', desc: '架空の支払いD', id: 'tx-d' }),
    ]);

    const response = await upload('/api/imports/diff', next, 'mf.csv');
    const body = (await response.json()) as DiffBody;
    expect(response.status).toBe(200);
    expect(body.counts).toEqual({ added: 1, changed: 1, deleted: 1, unchanged: 1 });
    expect(body.months).toEqual(['2026-07']);
  });

  it('同じファイルなら全件が不変', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    const body = (await (await upload('/api/imports/diff', BASE_CSV, 'mf.csv')).json()) as DiffBody;
    expect(body.counts).toEqual({ added: 0, changed: 0, deleted: 0, unchanged: 3 });
  });

  it('対象外の月の明細を「消える」に数えない(DR-1)', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    expect(
      (
        await upload(
          '/api/imports',
          mfCsv(['1,2026/08/01,-900,架空費,架空内訳,0,架空の8月分,tx-aug,架空口座']),
          'mf-aug.csv',
        )
      ).status,
    ).toBe(200);

    // 7月だけのファイル。8月の明細は範囲外なので触らない
    const body = (await (
      await upload(
        '/api/imports/diff',
        mfCsv([
          row({ day: '01', amount: 1000, big: '架空費', mid: '架空内訳', desc: '架空の支払いA', id: 'tx-a' }),
        ]),
        'mf.csv',
      )
    ).json()) as DiffBody;
    expect(body.months).toEqual(['2026-07']);
    expect(body.counts.deleted).toBe(2);
  });

  it('複数のMFファイルは、確定と同じ全unitを1つの差分にまとめる', async () => {
    const form = new FormData();
    form.append('file', new File([BASE_CSV], 'mf-july.csv', { type: 'text/csv' }));
    form.append(
      'file',
      new File([mfCsv(['1,2026/08/01,-900,架空費,架空内訳,0,架空の8月分,tx-aug,架空口座'])], 'mf-aug.csv', {
        type: 'text/csv',
      }),
    );
    const response = await app.request(
      '/api/imports/diff',
      { method: 'POST', headers: { cookie }, body: form },
      env(),
    );
    const body = (await response.json()) as DiffBody;

    expect(response.status).toBe(200);
    expect(body.months).toEqual(['2026-07', '2026-08']);
    expect(body.counts.added).toBe(4);
    expect(body.fingerprint).toMatch(/^v\d+:/);
  });

  it('同月に現金記帳が併存してもMFのbaselineに混ぜずpreview→commitできる', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-15',
      side: 'per',
      io: 'expense',
      amount: 500,
      description: '架空の現金記帳',
      big: '架空費',
      mid: '架空内訳',
      memo: null,
    });
    expect(created.status).toBe(201);

    const { preview, response } = await confirmImport(BASE_CSV);
    expect(preview.counts).toEqual({ added: 0, changed: 0, deleted: 0, unchanged: 3 });
    expect(response.status).toBe(200);
  });
});

describe('確定単位の解決プラン', () => {
  it('取込値へ戻す選択をMF洗い替えと同じbatchで確定する', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_edits
           (user_id,tx_id,cls,category_major,base_major,base_known,updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目','架空費',2,'2026-07-01T00:00:00.000Z')`,
      )
      .run();
    const changed = mfCsv([
      row({
        day: '01',
        amount: 1000,
        big: '架空の取込側大項目',
        mid: '架空内訳',
        desc: '架空の支払いA',
        id: 'tx-a',
      }),
    ]);
    const preview = (await (await upload('/api/imports/diff', changed, 'mf.csv')).json()) as DiffBody;
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM audit_log').first<number>('n')).resolves.toBe(0);

    const response = await upload('/api/imports', changed, 'mf.csv', {
      force: '1',
      resolutionPlan: JSON.stringify({
        fingerprint: preview.fingerprint,
        decisions: [{ txIds: ['tx-a'], choice: 'incoming', remember: false }],
      }),
    });

    expect(response.status).toBe(200);
    expect(
      await d1.prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'").first(),
    ).toEqual({ n: 0 });
    await expect(
      d1.prepare("SELECT action,result,scope FROM audit_log WHERE action='import_resolution'").first(),
    ).resolves.toMatchObject({ action: 'import_resolution', result: 'succeeded' });
    await expect(
      d1
        .prepare(
          `SELECT attribute,before_value,after_value,reason_code,source_type,tx_key,source_key
             FROM audit_log_detail`,
        )
        .first(),
    ).resolves.toMatchObject({
      attribute: 'category_major',
      before_value: '架空の手当て大項目',
      after_value: '架空の取込側大項目',
      reason_code: 'three_way_incoming',
      source_type: 'user_resolution',
      tx_key: expect.stringMatching(/^v1:[0-9a-f]{64}$/),
      source_key: expect.stringMatching(/^user_resolution:v1:[0-9a-f]{64}$/),
    });
  });

  it('stable-keyで一意に引ける旧IDの手当てを新IDへrekeyする', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    // 確定POSTが今の正本stable-keyを埋める。previewは決して書かない。
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id,tx_id,cls,updated_at)
         VALUES ('default','tx-a','biz','2026-07-01T00:00:00.000Z')`,
      )
      .run();
    expect((await confirmImport(BASE_CSV)).response.status).toBe(200);
    const keyed = await d1
      .prepare("SELECT stable_key FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'")
      .first<string>('stable_key');
    expect(keyed).toMatch(/^v1:mf:/);

    const rekeyed = BASE_CSV.replace('tx-a', 'tx-a-new');
    const preview = (await (await upload('/api/imports/diff', rekeyed, 'mf.csv')).json()) as DiffBody;
    expect(
      (
        await upload('/api/imports', rekeyed, 'mf.csv', {
          force: '1',
          resolutionPlan: JSON.stringify({ fingerprint: preview.fingerprint, decisions: [] }),
        })
      ).status,
    ).toBe(200);

    await expect(
      d1
        .prepare(
          "SELECT tx_id,stable_key,fingerprint_version FROM tx_edits WHERE user_id='default' AND cls='biz'",
        )
        .first(),
    ).resolves.toMatchObject({ tx_id: 'tx-a-new', stable_key: keyed, fingerprint_version: 1 });
  });
});

describe('衝突(3点比較)', () => {
  /**
   * 手当てに使う科目は「取込に出てきた科目」でなければ受け付けられない
   * (classify の categoryAllowed)。そこで手当て先の科目を含む種を使う。
   */
  const SEED_CSV = mfCsv([
    row({ day: '01', amount: 1000, big: '架空費', mid: '架空内訳', desc: '架空の支払いA', id: 'tx-a' }),
    row({
      day: '09',
      amount: 900,
      big: '架空の手当て大項目',
      mid: '架空の手当て中項目',
      desc: '架空の手当て先',
      id: 'tx-seed',
    }),
  ]);

  /** 手当てを付け、基準値を「その時点の取込値」として記録させる */
  const editCategory = async (txId: string, big: string, mid: string) =>
    jsonRequest(`/transactions/${txId}/edit`, 'PUT', { big, mid });

  it('取込元だけが動いた明細は衝突にしない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    const changed = mfCsv([
      row({
        day: '01',
        amount: 1000,
        big: '架空の別大項目',
        mid: '架空内訳',
        desc: '架空の支払いA',
        id: 'tx-a',
      }),
    ]);
    const body = (await (await upload('/api/imports/diff', changed, 'mf.csv')).json()) as DiffBody;
    // 手当てが無いので、機械が取り込んで構わない
    expect(body.conflicts).toEqual([]);
  });

  it('双方が動いた明細だけを衝突として、3つの値を並べる', async () => {
    expect((await upload('/api/imports', SEED_CSV, 'mf.csv')).status).toBe(200);
    // 利用者が大項目を直す。base には取込値「架空費」が控えられる
    expect((await editCategory('tx-a', '架空の手当て大項目', '架空の手当て中項目')).status).toBe(200);

    // 取込元も大項目を動かす
    const changed = mfCsv([
      row({
        day: '01',
        amount: 1000,
        big: '架空の取込側大項目',
        mid: '架空内訳',
        desc: '架空の支払いA',
        id: 'tx-a',
      }),
    ]);
    const body = (await (await upload('/api/imports/diff', changed, 'mf.csv')).json()) as DiffBody;

    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].txId).toBe('tx-a');
    expect(body.conflicts[0].attrs.big).toEqual({
      base: '架空費',
      current: '架空の手当て大項目',
      incoming: '架空の取込側大項目',
    });
    // 中項目は取込元が動いていないので衝突しない
    expect(body.conflicts[0].attrs.mid).toBeUndefined();

    expect(
      (
        await upload('/api/imports', changed, 'mf.csv', {
          force: '1',
          resolutionPlan: JSON.stringify({
            fingerprint: body.fingerprint,
            decisions: [{ txIds: ['tx-a'], choice: 'keep', remember: false }],
          }),
        })
      ).status,
    ).toBe(200);
    await expect(
      d1
        .prepare(
          "SELECT reason_code,before_value,after_value FROM audit_log_detail WHERE reason_code='three_way_keep'",
        )
        .first(),
    ).resolves.toEqual({
      reason_code: 'three_way_keep',
      before_value: '架空の手当て大項目',
      after_value: '架空の手当て大項目',
    });
  });

  it('取込原本が運ばない属性(種別・名義)をいつわりの衝突にしない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    expect((await jsonRequest('/transactions/tx-a/edit', 'PUT', { cls: 'biz' })).status).toBe(200);
    const body = (await (await upload('/api/imports/diff', BASE_CSV, 'mf.csv')).json()) as DiffBody;
    expect(body.conflicts).toEqual([]);
  });

  it('衝突行に明細の内容・金額を載せない(DR-9)', async () => {
    expect((await upload('/api/imports', SEED_CSV, 'mf.csv')).status).toBe(200);
    expect((await editCategory('tx-a', '架空の手当て大項目', '架空の手当て中項目')).status).toBe(200);
    const changed = mfCsv([
      row({
        day: '01',
        amount: 1000,
        big: '架空の取込側大項目',
        mid: '架空内訳',
        desc: '架空の支払いA',
        id: 'tx-a',
      }),
    ]);
    const text = await (await upload('/api/imports/diff', changed, 'mf.csv')).text();
    expect(text).not.toContain('架空の支払いA');
    expect(text).not.toContain('1000');
    // stable_key は内容と金額をそのまま並べた鍵。返した時点で明細本体を出したことになる
    expect(text).not.toContain('stableKey');
    expect(text).not.toContain('v1:mf:');
  });
});

describe('基準値の書戻し', () => {
  it('既定では1文も書かない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    // 0030 より前に付いた手当てを模す。base_* を空にする
    await d1.prepare("UPDATE tx_edits SET base_major=NULL, base_mid=NULL WHERE tx_id='tx-a'").run();
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, cls, category_major, category_mid, updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目',NULL,'2026-07-01T00:00:00.000Z')
         ON CONFLICT(user_id,tx_id) DO UPDATE SET category_major=excluded.category_major`,
      )
      .run();

    const claimsBefore = await d1
      .prepare('SELECT user_id,run_id,claimed_at,expires_at FROM import_writer_claims ORDER BY user_id')
      .all();
    const body = (await (await upload('/api/imports/diff', BASE_CSV, 'mf.csv')).json()) as DiffBody;
    expect(body.backfilled).toBe(0);
    const after = await d1
      .prepare("SELECT base_major FROM tx_edits WHERE tx_id='tx-a'")
      .first<string>('base_major');
    expect(after).toBeNull();
    const claimsAfter = await d1
      .prepare('SELECT user_id,run_id,claimed_at,expires_at FROM import_writer_claims ORDER BY user_id')
      .all();
    expect(claimsAfter.results).toEqual(claimsBefore.results);
  });

  it('互換入力apply=1も拒否し、previewで書かない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, cls, category_major, category_mid, updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目',NULL,'2026-07-01T00:00:00.000Z')`,
      )
      .run();

    const response = await upload('/api/imports/diff', BASE_CSV, 'mf.csv', { apply: '1' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'diff_read_only' } });

    const after = await d1
      .prepare("SELECT base_major, stable_key, fingerprint_version FROM tx_edits WHERE tx_id='tx-a'")
      .first<{ base_major: string | null; stable_key: string | null; fingerprint_version: number | null }>();
    expect(after).toEqual({ base_major: null, stable_key: null, fingerprint_version: null });
  });

  it('空欄の基準値とstable-keyは確定POSTだけが埋める', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, cls, category_major, category_mid, updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目',NULL,'2026-07-01T00:00:00.000Z')`,
      )
      .run();

    const { response } = await confirmImport(BASE_CSV);
    expect(response.status).toBe(200);
    const after = await d1
      .prepare("SELECT base_major, stable_key, fingerprint_version FROM tx_edits WHERE tx_id='tx-a'")
      .first<{ base_major: string; stable_key: string; fingerprint_version: number }>();
    expect(after?.base_major).toBe('架空費');
    expect(after?.stable_key).toMatch(/^v1:mf:/);
    expect(after?.fingerprint_version).toBe(1);
  });

  it('既に入っている基準値を新しい取込値で上書きしない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, cls, category_major, base_major, base_known, updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目','架空の古い基準',2,'2026-07-01T00:00:00.000Z')`,
      )
      .run();

    expect((await confirmImport(BASE_CSV)).response.status).toBe(200);
    const after = await d1
      .prepare("SELECT base_major FROM tx_edits WHERE tx_id='tx-a'")
      .first<string>('base_major');
    // 上書きすると base == incoming になり、双方が動いた衝突を永久に見逃す
    expect(after).toBe('架空の古い基準');
  });

  it('手当ての中身(種別・科目)は書き換えない', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, cls, category_major, updated_at)
         VALUES ('default','tx-a','biz','架空の手当て大項目','2026-07-01T00:00:00.000Z')`,
      )
      .run();
    expect((await confirmImport(BASE_CSV)).response.status).toBe(200);
    const after = await d1
      .prepare("SELECT cls, category_major FROM tx_edits WHERE tx_id='tx-a'")
      .first<{ cls: string; category_major: string }>();
    expect(after).toEqual({ cls: 'biz', category_major: '架空の手当て大項目' });
  });
});

describe('手動編集の4属性base', () => {
  it('quick classとfull editが同じ有効値resolverから最初のbaseを保存する', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO rules
           (user_id,keyword,cls,category_major,category_mid,owner,sort_order,created_at)
         VALUES
           ('default','架空の支払いA','biz',NULL,NULL,'family',1,'2026-07-01T00:00:00.000Z'),
           ('default','架空の支払いB','biz',NULL,NULL,'spouse',2,'2026-07-01T00:00:00.000Z')`,
      )
      .run();

    expect((await jsonRequest('/transactions/tx-a/class', 'PUT', { cls: 'per' })).status).toBe(200);
    await expect(
      d1
        .prepare("SELECT cls,base_cls,base_known FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'")
        .first(),
    ).resolves.toEqual({ cls: 'per', base_cls: 'biz', base_known: 1 });

    expect(
      (
        await jsonRequest('/transactions/tx-b/edit', 'PUT', {
          cls: 'per',
          big: '架空費',
          mid: '架空内訳',
          owner: 'business',
        })
      ).status,
    ).toBe(200);
    await expect(
      d1
        .prepare(
          `SELECT cls,category_major,category_mid,owner,
                  base_cls,base_major,base_mid,base_owner,base_known,origin,origin_key
             FROM tx_edits WHERE user_id='default' AND tx_id='tx-b'`,
        )
        .first(),
    ).resolves.toEqual({
      cls: 'per',
      category_major: '架空費',
      category_mid: '架空内訳',
      owner: 'business',
      base_cls: 'biz',
      base_major: '架空費',
      base_mid: '架空内訳',
      base_owner: 'spouse',
      base_known: 15,
      origin: 'manual',
      origin_key: null,
    });
  });

  it('owner=nullとmid=空文字を未記録ではなく既知baseとして往復保存する', async () => {
    const emptyBaseCsv = mfCsv([
      row({ day: '01', amount: 1000, big: '架空費', mid: '', desc: '架空の空基準', id: 'tx-empty' }),
    ]);
    expect((await upload('/api/imports', emptyBaseCsv, 'mf.csv')).status).toBe(200);
    expect(
      (
        await jsonRequest('/transactions/tx-empty/edit', 'PUT', {
          big: '架空費',
          mid: '',
          owner: 'business',
        })
      ).status,
    ).toBe(200);

    await expect(
      d1
        .prepare(
          "SELECT base_mid,base_owner,base_known FROM tx_edits WHERE user_id='default' AND tx_id='tx-empty'",
        )
        .first(),
    ).resolves.toEqual({ base_mid: '', base_owner: null, base_known: 14 });

    expect((await jsonRequest('/transactions/tx-empty/edit', 'PUT', { owner: 'family' })).status).toBe(200);
    await expect(
      d1
        .prepare(
          "SELECT base_mid,base_owner,base_known FROM tx_edits WHERE user_id='default' AND tx_id='tx-empty'",
        )
        .first(),
    ).resolves.toEqual({ base_mid: '', base_owner: null, base_known: 14 });
  });
});

describe('取引先の決め事の通常取込', () => {
  const seedMemory = async (
    args: {
      vendorKey?: string;
      cls?: 'biz' | 'per' | null;
      owner?: 'business' | 'spouse' | 'family' | null;
      hits?: number;
    } = {},
  ) => {
    const vendorKey = args.vendorKey ?? '架空の支払いA';
    await d1
      .prepare(
        `INSERT INTO vendor_memory
           (user_id,vendor_key,vendor_label,cls,category_major,category_mid,owner,
            hit_count,disagree_count,pinned,revoked,created_at,updated_at)
         VALUES ('default',?,?,?,NULL,NULL,?,?,0,0,0,?,?)`,
      )
      .bind(
        vendorKey,
        vendorKey,
        args.cls ?? 'biz',
        args.owner ?? null,
        args.hits ?? 3,
        '2026-07-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z',
      )
      .run();
  };

  it('seed→自動適用→provenance表示→個別取消は高信頼でも再適用しない', async () => {
    await seedMemory({ hits: 5 });

    const imported = await upload('/api/imports', BASE_CSV, 'mf.csv');
    expect(imported.status).toBe(200);
    expect(await imported.json()).toMatchObject({
      resolution: { autoApplied: 1, candidates: 0, learned: 0 },
    });
    await expect(
      d1
        .prepare("SELECT cls,origin,origin_key FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'")
        .first(),
    ).resolves.toEqual({ cls: 'biz', origin: 'vendor_memory', origin_key: '架空の支払いA' });
    const audit = await d1
      .prepare(
        `SELECT d.tx_key,d.attribute,d.reason_code,d.source_type,d.source_key
           FROM audit_log_detail d JOIN audit_log a ON a.id=d.audit_id
          WHERE a.action='import_resolution'`,
      )
      .all<{
        tx_key: string;
        attribute: string;
        reason_code: string;
        source_type: string;
        source_key: string;
      }>();
    expect(audit.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attribute: 'cls',
          reason_code: 'vendor_memory_auto_apply',
          source_type: 'vendor_memory',
          tx_key: expect.stringMatching(/^v1:[0-9a-f]{64}$/),
          source_key: expect.stringMatching(/^vendor_memory:v1:[0-9a-f]{64}$/),
        }),
      ]),
    );
    expect(JSON.stringify(audit.results)).not.toContain('架空の支払いA');
    expect(JSON.stringify(audit.results)).not.toContain('tx-a');

    const listed = (await (await jsonRequest('/transactions?month=2026-07')).json()) as {
      transactions: Array<{ id: string; cls: string; origin: string | null; originKey: string | null }>;
    };
    expect(listed.transactions.find((tx) => tx.id === 'tx-a')).toMatchObject({
      cls: 'biz',
      origin: 'vendor_memory',
      originKey: '架空の支払いA',
    });

    expect((await jsonRequest('/transactions/tx-a/class', 'PUT', { cls: null })).status).toBe(200);
    await expect(
      d1
        .prepare(
          "SELECT cls,origin,origin_key,base_known FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'",
        )
        .first(),
    ).resolves.toEqual({ cls: 'per', origin: 'manual', origin_key: null, base_known: 15 });
    await expect(
      d1
        .prepare(
          "SELECT hit_count,disagree_count FROM vendor_memory WHERE user_id='default' AND vendor_key='架空の支払いA'",
        )
        .first(),
    ).resolves.toEqual({ hit_count: 5, disagree_count: 1 });

    const next = await upload('/api/imports', BASE_CSV, 'mf.csv', { force: '1' });
    expect(next.status).toBe(200);
    expect(await next.json()).toMatchObject({
      resolution: { autoApplied: 0, candidates: 0, learned: 0 },
    });
    await expect(
      d1.prepare("SELECT cls,origin FROM tx_edits WHERE user_id='default' AND tx_id='tx-a'").first(),
    ).resolves.toEqual({ cls: 'per', origin: 'manual' });
    await expect(
      d1
        .prepare(
          "SELECT disagree_count FROM vendor_memory WHERE user_id='default' AND vendor_key='架空の支払いA'",
        )
        .first(),
    ).resolves.toEqual({ disagree_count: 1 });
  });

  it('監査detailの確定に失敗したら、明細・手当て・active pointer・ヘッダを全てrollbackする', async () => {
    await seedMemory({ hits: 5 });
    await d1
      .prepare(
        `CREATE TRIGGER synthetic_audit_detail_failure
           BEFORE INSERT ON audit_log_detail
           BEGIN SELECT RAISE(ABORT, 'synthetic audit detail failure'); END`,
      )
      .run();
    try {
      const response = await upload('/api/imports', BASE_CSV, 'mf.csv');
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ results: [{ status: 'failed' }] });
      await expect(d1.prepare('SELECT COUNT(*) AS n FROM mf_transactions').first<number>('n')).resolves.toBe(
        0,
      );
      await expect(d1.prepare('SELECT COUNT(*) AS n FROM tx_edits').first<number>('n')).resolves.toBe(0);
      await expect(
        d1.prepare('SELECT COUNT(*) AS n FROM import_active_targets').first<number>('n'),
      ).resolves.toBe(0);
      await expect(d1.prepare('SELECT COUNT(*) AS n FROM audit_log').first<number>('n')).resolves.toBe(0);
      await expect(d1.prepare('SELECT COUNT(*) AS n FROM audit_log_detail').first<number>('n')).resolves.toBe(
        0,
      );
    } finally {
      await d1.prepare('DROP TRIGGER IF EXISTS synthetic_audit_detail_failure').run();
    }
  });

  it('runtimeで tx_edits > rules > vendor_memory > import/default の順に解く', async () => {
    await seedMemory({ owner: 'spouse' });
    await d1
      .prepare(
        `INSERT INTO rules
           (user_id,keyword,cls,category_major,category_mid,owner,sort_order,created_at)
         VALUES ('default','架空の支払いA','per',NULL,NULL,NULL,1,'2026-07-01T00:00:00.000Z')`,
      )
      .run();

    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    const sources = await d1
      .prepare(
        `SELECT d.attribute,d.source_type,d.source_key
           FROM audit_log_detail d JOIN audit_log a ON a.id=d.audit_id
          WHERE a.action='import_resolution' ORDER BY d.attribute`,
      )
      .all<{ attribute: string; source_type: string; source_key: string }>();
    expect(sources.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attribute: 'cls',
          source_type: 'rule',
          source_key: expect.stringMatching(/^rule:v1:[0-9a-f]{64}$/),
        }),
        expect.objectContaining({
          attribute: 'owner',
          source_type: 'vendor_memory',
          source_key: expect.stringMatching(/^vendor_memory:v1:[0-9a-f]{64}$/),
        }),
      ]),
    );
    let listed = (await (await jsonRequest('/transactions?month=2026-07')).json()) as {
      transactions: Array<{
        id: string;
        cls: string;
        owner: string | null;
        origin: string | null;
        originKey: string | null;
      }>;
    };
    expect(listed.transactions.find((tx) => tx.id === 'tx-a')).toMatchObject({
      cls: 'per',
      owner: 'spouse',
      origin: 'vendor_memory',
      originKey: '架空の支払いA',
    });

    expect((await jsonRequest('/transactions/tx-a/class', 'PUT', { cls: 'biz' })).status).toBe(200);
    listed = (await (await jsonRequest('/transactions?month=2026-07')).json()) as typeof listed;
    expect(listed.transactions.find((tx) => tx.id === 'tx-a')).toMatchObject({
      cls: 'biz',
      owner: null,
      origin: 'manual',
      originKey: null,
    });
  });

  it('低確信候補は今回previewの明細ID・値・根拠だけを返す', async () => {
    await seedMemory({ hits: 1, owner: 'spouse' });
    const response = await upload('/api/imports/diff', BASE_CSV, 'mf.csv');
    const body = (await response.json()) as DiffBody;
    expect(response.status).toBe(200);
    expect(body.automation.candidates).toBe(1);
    expect(body.candidates).toEqual([
      expect.objectContaining({
        txId: 'tx-a',
        vendorKey: '架空の支払いA',
        vendorLabel: '架空の支払いA',
        cls: 'biz',
        owner: 'spouse',
        reason: expect.stringContaining('3 件以上'),
      }),
    ]);
  });

  it('materialize済みvendor editより後から追加したruleが強く、一覧とmonthly_aggが同じ値を見る', async () => {
    await seedMemory({ hits: 5 });
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    expect(
      (
        await jsonRequest('/rules', 'POST', {
          keyword: '架空の支払いA',
          cls: 'per',
          top: true,
        })
      ).status,
    ).toBe(201);

    const listed = (await (await jsonRequest('/transactions?month=2026-07')).json()) as {
      transactions: Array<{ id: string; cls: string; origin: string | null; originKey: string | null }>;
    };
    expect(listed.transactions.find((tx) => tx.id === 'tx-a')).toMatchObject({
      cls: 'per',
      origin: null,
      originKey: null,
    });
    await expect(
      d1
        .prepare(
          "SELECT amount FROM monthly_agg WHERE user_id='default' AND month='2026-07' AND scope='per_exp:架空費'",
        )
        .first<number>('amount'),
    ).resolves.toBe(6000);
  });
});

describe('クエリ数', () => {
  /** 通常幅の取込。5,000行でもクエリ数が増えないことを見る */
  const wideCsv = (count: number) =>
    mfCsv(
      Array.from({ length: count }, (_, index) =>
        row({
          day: String((index % 28) + 1).padStart(2, '0'),
          amount: 100 + index,
          big: '架空費',
          mid: '架空内訳',
          desc: `架空の支払い${index}`,
          id: `tx-${index}`,
        }),
      ),
    );

  it('5,000行の差分でも 49 クエリ以内', async () => {
    expect((await upload('/api/imports', wideCsv(5000), 'mf.csv')).status).toBe(200);
    preparedCount = 0;
    const response = await upload('/api/imports/diff', wideCsv(5000), 'mf.csv');
    expect(response.status).toBe(200);
    expect(preparedCount).toBeLessThan(50);
  }, 120_000);

  it('行数を10倍にしてもクエリ数が変わらない', async () => {
    expect((await upload('/api/imports', wideCsv(500), 'mf.csv')).status).toBe(200);
    preparedCount = 0;
    await upload('/api/imports/diff', wideCsv(50), 'mf.csv');
    const few = preparedCount;
    preparedCount = 0;
    await upload('/api/imports/diff', wideCsv(500), 'mf.csv');
    expect(preparedCount).toBe(few);
  }, 60_000);

  it('見積りを応答で示し、上限より小さいことを約束する', async () => {
    expect((await upload('/api/imports', BASE_CSV, 'mf.csv')).status).toBe(200);
    const body = (await (await upload('/api/imports/diff', BASE_CSV, 'mf.csv')).json()) as DiffBody;
    expect(body.queries.limit).toBe(50);
    expect(body.queries.planned).toBeLessThan(50);
  });
});

describe('対応していない入力', () => {
  it('資産推移CSVはエラーにせず、差分対象外と案内する', async () => {
    const assets = ['日付,合計（円）,預金・現金（円）', '2026/07/31,100,100'].join('\n');
    const response = await upload('/api/imports/diff', assets, '資産推移.csv');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      supported: false,
      message: expect.stringContaining('このまま取込を実行できます'),
    });
  });

  it('freeeの取引は400にせず、通常取込へ進めると案内する', async () => {
    const freee = ['収支区分,発生日,勘定科目,金額,取引先', '支出,2026/07/31,通信費,100,架空先'].join('\n');
    const response = await upload('/api/imports/diff', freee, 'deals.csv');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      supported: false,
      message: 'freeeの取引は明細ごとの差分確認の対象外です。このまま取込を実行できます。',
    });
  });

  it('判定できないファイルはdiff_unsupportedで拒否する', async () => {
    const response = await upload('/api/imports/diff', '未知の列\n架空値', 'unknown.csv');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'diff_unsupported' } });
  });

  it('ファイルが無ければ400', async () => {
    const response = await app.request(
      '/api/imports/diff',
      { method: 'POST', headers: { cookie }, body: new FormData() },
      env(),
    );
    expect(response.status).toBe(400);
  });
});
