/**
 * ReceiptSourceProfile の認証・D1・年境界統合。すべて架空データだけを使う。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
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
let cookie = '';

async function applyMigrations(database: D1Database): Promise<void> {
  const names = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of names) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await database.prepare(statement).run();
  }
  await recordTestMigrationHead(database, names);
}

const env = () => ({ ...auth, DB: d1, FILES: files });

async function request(path: string, method = 'GET', body?: unknown): Promise<Response> {
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

async function seedCash(date: string, description = '架空クラウド株式会社'): Promise<string> {
  const response = await request('/cash-entries', 'POST', {
    date,
    side: 'biz',
    io: 'expense',
    amount: 12_000,
    description,
    big: '通信費',
    mid: '',
    memo: null,
  });
  expect(response.status).toBe(201);
  const { entry } = (await response.json()) as { entry: { id: number } };
  return `cash:${entry.id}`;
}

async function uploadReceipt(targetId: string, sequence: number): Promise<void> {
  const form = new FormData();
  form.append('target', targetId);
  form.append(
    'file',
    new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, sequence])],
      `receipt-${sequence}.png`,
      { type: 'image/png' },
    ),
  );
  const response = await app.request(
    '/api/attachments',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(response.status).toBe(201);
}

const fields = (
  over: Partial<Record<'serviceName' | 'sourceUrl' | 'loginAccount' | 'memo', string>> = {},
) => ({
  serviceName: '架空請求ポータル',
  sourceUrl: 'https://billing.example.test/receipts',
  loginAccount: 'account@example.test',
  memo: '利用明細から取得',
  ...over,
});

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'tax-receipt-source-test',
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
  const objects = await files.list({ prefix: 'attachments/' });
  for (const object of objects.objects) await files.delete(object.key);
  // profileへの複合FKがあるため、疎な明細overrideを先に空にする。
  await d1.prepare('DELETE FROM receipt_source_overrides').run();
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
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
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}, 30_000);

afterAll(async () => mf?.dispose(), 30_000);

describe('対象年の申告準備export', () => {
  it('12ヶ月・年別100%設定・R2原本が揃った同一集合だけをCSV/ZIPへ出す', async () => {
    for (let month = 1; month <= 12; month++) {
      const target = await seedCash(`2025-${String(month).padStart(2, '0')}-10`, `架空支払先${month}`);
      await uploadReceipt(target, month);
    }
    const saved = await request('/tax/accounts?year=2025', 'PUT', {
      settings: [{ account: '通信費', taxAccount: '通信費', businessPercent: 100, basis: null }],
    });
    expect(saved.status).toBe(200);

    const overview = await request('/tax/overview?year=2025');
    expect(overview.status).toBe(200);
    expect(overview.headers.get('cache-control')).toBe('private, no-store');
    const readiness = (await overview.json()) as {
      verdict: string;
      statement: { months: string[] };
      receipts: { requiredCount: number; missingCount: number };
      settings: { account: string; status: string; businessPercent: number }[];
    };
    expect(readiness).toMatchObject({
      verdict: 'ok',
      receipts: { requiredCount: 12, missingCount: 0 },
      settings: [{ account: '通信費', status: 'confirmed', businessPercent: 100 }],
    });
    expect(readiness.statement.months).toHaveLength(12);

    const csv = await request('/export/tax/statement.csv?year=2025');
    expect(csv.status).toBe(200);
    expect(csv.headers.get('cache-control')).toBe('private, no-store');
    expect(await csv.text()).toContain('2025年 確定申告の準備・決算書転記シート');

    const zipResponse = await request('/export/tax/receipts.zip?year=2025&part=1');
    expect(zipResponse.status).toBe(200);
    expect(zipResponse.headers.get('cache-control')).toBe('private, no-store');
    const archive = unzipSync(new Uint8Array(await zipResponse.arrayBuffer()));
    const paths = Object.keys(archive);
    const receiptPaths = paths.filter((path) => path.endsWith('.png'));
    expect(receiptPaths).toHaveLength(12);
    expect(paths).toContain('索引.csv');
    expect(paths).toContain('README.md');
    const index = new TextDecoder().decode(archive['索引.csv']);
    for (const path of receiptPaths) expect(index).toContain(path);
    expect(new Set(paths).size).toBe(paths.length);

    // HEAD後に原本が消えたraceは索引だけ残して成功にせず、stream全体を失敗させる。
    const getMissing = new Proxy(files, {
      get(bucket, property, receiver) {
        if (property === 'get') return async () => null;
        const value = Reflect.get(bucket, property, receiver);
        return typeof value === 'function' ? value.bind(bucket) : value;
      },
    });
    const raced = await app.request(
      '/api/export/tax/receipts.zip?year=2025&part=1',
      { headers: { cookie } },
      { ...auth, DB: d1, FILES: getMissing },
    );
    expect(raced.status).toBe(200);
    await expect(raced.arrayBuffer()).rejects.toThrow();
  }, 60_000);

  it('年指定なし・未確認・R2原本不足をサーバー側で止める', async () => {
    await seedCash('2025-01-10');
    expect((await request('/tax/overview')).status).toBe(400);
    expect((await request('/tax/overview?year=2025&span=1')).status).toBe(400);
    const csv = await request('/export/tax/statement.csv?year=2025');
    expect(csv.status).toBe(409);
    expect(((await csv.json()) as { error: { code: string } }).error.code).toBe('tax_export_blocked');
    const zip = await request('/export/tax/receipts.zip?year=2025&part=1');
    expect(zip.status).toBe(409);
  });
});

describe('証憑取得先profile', () => {
  it('同merchantの翌月へ継承し、明細overrideはその1件だけを上書きする', async () => {
    const january = await seedCash('2025-01-10');
    const february = await seedCash('2025-02-10', '架空クラウド（株）');
    const saved = await request('/tax/receipt-sources?year=2025', 'PUT', {
      mode: 'merchant-profile',
      targetId: january,
      fields: fields(),
    });
    expect(saved.status).toBe(200);

    const inherited = await request('/tax/receipt-gaps?year=2025');
    expect(inherited.status).toBe(200);
    const inheritedRows = (await inherited.json()) as {
      rows: {
        txId: string;
        receiptSource: { state: string; inheritedFrom: string | null; profile: { serviceName: string } };
      }[];
    };
    expect(inheritedRows.rows.find((row) => row.txId === february)?.receiptSource).toMatchObject({
      state: 'resolved',
      inheritedFrom: '架空クラウド',
      profile: { serviceName: '架空請求ポータル' },
    });

    const overridden = await request('/tax/receipt-sources?year=2025', 'PUT', {
      mode: 'transaction-override',
      targetId: february,
      fields: fields({
        serviceName: 'カード明細サイト',
        sourceUrl: 'https://card.example.test/statements',
        loginAccount: 'card-user',
      }),
    });
    expect(overridden.status).toBe(200);
    const after = (await (await request('/tax/receipt-gaps?year=2025')).json()) as {
      rows: { txId: string; receiptSource: { overrideState: string; profile: { serviceName: string } } }[];
    };
    expect(after.rows.find((row) => row.txId === january)?.receiptSource.profile.serviceName).toBe(
      '架空請求ポータル',
    );
    expect(after.rows.find((row) => row.txId === february)?.receiptSource).toMatchObject({
      overrideState: 'applied',
      profile: { serviceName: 'カード明細サイト' },
    });
  });

  it('複数sourceは次の明細で自動確定せず候補にし、他userのprofileを選べない', async () => {
    const first = await seedCash('2025-01-10');
    expect(
      (
        await request('/tax/receipt-sources?year=2025', 'PUT', {
          mode: 'merchant-profile',
          targetId: first,
          fields: fields(),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/tax/receipt-sources?year=2025', 'PUT', {
          mode: 'merchant-profile',
          targetId: first,
          fields: fields({
            serviceName: '法人カード明細',
            sourceUrl: 'https://card.example.test/statements',
          }),
        })
      ).status,
    ).toBe(200);
    const nextMonth = await seedCash('2025-03-10', '架空クラウド');
    await d1
      .prepare(
        `INSERT INTO receipt_source_profiles
          (user_id,profile_key,merchant_key,service_name,source_url,updated_at)
         VALUES ('other','other::secret','other','他利用者の取得先','https://other.example.test','2025-01-01')`,
      )
      .run();

    const gaps = (await (await request('/tax/receipt-gaps?year=2025')).json()) as {
      rows: { txId: string; receiptSource: { state: string; candidates: { profileKey: string }[] } }[];
    };
    const resolution = gaps.rows.find((row) => row.txId === nextMonth)?.receiptSource;
    expect(resolution?.state).toBe('ambiguous');
    expect(resolution?.candidates).toHaveLength(2);
    expect(resolution?.candidates.map((candidate) => candidate.profileKey)).not.toContain('other::secret');

    const crossUser = await request('/tax/receipt-sources?year=2025', 'PUT', {
      mode: 'select-profile',
      targetId: nextMonth,
      profileKey: 'other::secret',
    });
    expect(crossUser.status).toBe(404);
  });

  it('http/https以外・URL埋込認証・秘密field・対象年外をfail-closedにする', async () => {
    const target = await seedCash('2025-04-10');
    for (const sourceUrl of [
      'javascript:alert(1)',
      'file:///tmp/receipt',
      'https://user:secret@example.test',
    ]) {
      const rejected = await request('/tax/receipt-sources?year=2025', 'PUT', {
        mode: 'merchant-profile',
        targetId: target,
        fields: fields({ sourceUrl }),
      });
      expect(rejected.status, sourceUrl).toBe(400);
    }
    expect(
      (
        await request('/tax/receipt-sources?year=2025', 'PUT', {
          mode: 'merchant-profile',
          targetId: target,
          fields: { ...fields(), password: 'do-not-store' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('/tax/receipt-sources?year=2024', 'PUT', {
          mode: 'merchant-profile',
          targetId: target,
          fields: fields(),
        })
      ).status,
    ).toBe(404);
    const count = await d1
      .prepare('SELECT COUNT(*) AS n FROM receipt_source_profiles')
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
