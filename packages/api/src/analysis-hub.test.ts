/**
 * GET /api/analysis/hub の契約テスト (AC-003)。
 *
 * 実装より先に書く赤いテスト (SYS-ANHUB-P04)。実装は SYS-ANHUB-P05 が
 * `packages/api/src/routes/analysis-hub.ts` に置き、`src/index.ts` でマウントする。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 * 実装前はルートが無いため、200 を期待するケースが 404 で落ちる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

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

const env = () => ({ ...auth, DB: database });

const request = (path: string, headers: Record<string, string> = { cookie }) =>
  app.request(`/api${path}`, { headers }, env());

type HubBody = {
  period: {
    applied: { from: string; to: string } | null;
    label: string;
    full: { from: string; to: string } | null;
    years: string[];
    monthCount: number;
  };
  summary: {
    income: number;
    expense: number;
    net: number;
    previous: { label: string; months: number; income: number; expense: number; net: number } | null;
    change: { income: number | null; expense: number | null; net: number | null } | null;
  };
  views: Record<string, { id: string; priority: '高' | '中'; count: number; [key: string]: unknown }>;
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'analysis-hub',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  await database
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999)`,
    )
    .run();
  await database
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable) VALUES
        ('default','2026-08_1_-3300','2026-08','2026-08-07','架空クラウド',-3300,'事業経費','通信費',1,0,0),
        ('other-user','2026-08_9_-999999','2026-08','2026-08-05','別ユーザー',-999999,'事業経費','通信費',1,0,0)`,
    )
    .run();
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('GET /api/analysis/hub', () => {
  it('認証済みなら 200 で期間メタ・収支サマリー・5 視点を返す', async () => {
    const response = await request('/analysis/hub?from=2026-08&to=2026-08');
    expect(response.status).toBe(200);
    const body = (await response.json()) as HubBody;

    // 期間メタは既存 PeriodMeta と同じ形 (loadScoped を通していることの確認)
    expect(body.period).toMatchObject({
      applied: { from: '2026-08', to: '2026-08' },
      label: '2026年8月',
      full: { from: '2026-08', to: '2026-08' },
      years: ['2026'],
      monthCount: 1,
    });

    expect(Object.keys(body.views).sort()).toEqual([
      'diagnosis',
      'matrix',
      'reconciliation',
      'total-cashflow',
      'trends',
    ]);
    for (const [id, view] of Object.entries(body.views)) {
      expect(view.id).toBe(id);
      expect(['高', '中']).toContain(view.priority);
    }

    // 同額で日付が 2 日ずれる組は要確認 1 件 (既存 /total-cashflow と同じ判定)
    expect(body.views['total-cashflow']).toMatchObject({ reviewCount: 1, count: 1, priority: '高' });
    // 前期間 (2026-07) はデータに無いので比較データなし
    expect(body.summary.previous).toBeNull();
    expect(body.summary.change).toBeNull();
  });

  it('他の利用者の行を集計に混ぜない', async () => {
    const body = (await (await request('/analysis/hub?from=2026-08&to=2026-08')).json()) as HubBody;
    expect(body.summary.expense).toBeLessThan(999_999);
    expect(body.views['total-cashflow']?.count).toBe(1);
  });

  it('Cookie が無ければ 401', async () => {
    const response = await request('/analysis/hub', {});
    expect(response.status).toBe(401);
  });

  it('一時パスワードの変更前は 403 password_change_required', async () => {
    const pending = await loginForTest(app, env(), {
      id: 'temp-user',
      email: 'temp-user@example.test',
      password: 'Synthetic-Temp-Password-1',
      mustChangePassword: true,
    });
    const response = await request('/analysis/hub', { cookie: pending });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('password_change_required');
  });
});
