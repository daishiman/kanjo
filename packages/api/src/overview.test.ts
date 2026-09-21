/**
 * 概況画面 API (GET /api/overview・GET /api/review-queue・保留・月次レビュー) の結合テスト。
 * SYS-OVERVIEW-P04 で実装より先に書いた赤いテスト。実データを使わず、インメモリ D1 と架空明細だけで検証する。
 *
 * | 受入 | 内容 | テスト |
 * |---|---|---|
 * | AC-004 | 保留と月次レビューがバックアップ → 全消去 → 復元で保たれ、4 ステップが判定表どおり | `AC-004` |
 * | BR-007 | kind / itemKey / month / scope の違反は 400 | `入力検証` |
 * | 冪等 | PUT を重ねても 1 行、DELETE は行が無くても 204 | `冪等` |
 * | 認証 | 未ログインは 401 | `認証` |
 *
 * 契約の正本は `docs/overview-screen/architecture-decision.md`。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_ADMIN, loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
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

type Requester = (path: string, method?: string, body?: unknown) => Promise<Response>;

const requesterFor =
  (db: D1Database, sessionCookie: () => string): Requester =>
  async (path, method, body) =>
    app.request(
      `/api${path}`,
      {
        method: method ?? 'GET',
        headers: {
          cookie: sessionCookie(),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { ...auth, DB: db, FILES: files },
    );

const request: Requester = (path, method, body) => requesterFor(d1, () => cookie)(path, method, body);

const tx = (id: string, d: string, c: string, a: number, mid = '雑貨') => ({
  id,
  idStable: true,
  m: '2026-09',
  d,
  c,
  a,
  big: '日用品',
  mid,
  inst: '架空銀行 普通',
  isTarget: true,
  isTransfer: false,
});

/** 仕分け待ち (区分が既定のまま) の明細 3 件を持つ架空の復元データ */
const RESTORE = {
  months: ['2026-08', '2026-09'],
  biz: { revenue: [300_000, 310_000], categories: ['架空通信費'], expense: { 架空通信費: [11_000, 12_000] } },
  subs: { vendors: [], matrix: {}, other: [0, 0] },
  personal: {
    '2026-08': { income: { 給与: 200_000 }, expense: { 日用品: 5_000 } },
    '2026-09': { income: { 給与: 200_000 }, expense: { 日用品: 6_000 } },
  },
  bizPersonal: {},
  mfTx: [
    tx('mf-a', '09/03', '架空商店', -1_000),
    tx('mf-b', '09/04', '架空書店', -9_000),
    tx('mf-c', '09/05', '架空文具', -5_000),
  ],
  rules: [],
  edits: {},
  institutionOwners: {},
  budgets: {},
  cashOverride: {},
  unrecordedExpMonths: [],
};

async function seed(req: Requester = request): Promise<void> {
  const restored = await req('/restore', 'POST', RESTORE);
  expect(restored.status, await restored.clone().text()).toBe(200);
}

async function seedFailedImport(db: D1Database = d1): Promise<void> {
  await db
    .prepare(
      `INSERT INTO import_runs (id,user_id,status,failure_reason,created_at,updated_at)
       VALUES ('run-failed','default','failed','架空の失敗理由','2026-09-11T00:00:00.000Z','2026-09-11T00:00:00.000Z')`,
    )
    .run();
}

interface QueueBody {
  total: number;
  counts: { reconciliation: number; classification: number; import: number };
  snoozedCount: number;
  items: Array<{
    kind: string;
    itemKey: string;
    amount: number;
    date: string;
    month: string;
    content: string;
  }>;
  snoozedItems: Array<{ kind: string; itemKey: string }>;
}

async function queue(req: Requester = request): Promise<QueueBody> {
  const res = await req('/review-queue');
  expect(res.status, await res.clone().text()).toBe(200);
  return (await res.json()) as QueueBody;
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'overview-test',
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
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('認証', () => {
  it.each([
    ['GET', '/overview'],
    ['GET', '/review-queue'],
    ['PUT', '/review-queue/snoozes/classification/mf-a'],
    ['DELETE', '/review-queue/snoozes/classification/mf-a'],
    ['PUT', '/monthly-close/2026-09/review'],
    ['DELETE', '/monthly-close/2026-09/review'],
  ])('%s %s は未ログインで 401', async (method, path) => {
    const res = await app.request(`/api${path}`, { method }, { ...auth, DB: d1, FILES: files });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/overview', () => {
  it('既定は総合で、4 要素・クローズ状況・データ更新時刻・防衛予測・期間を返す', async () => {
    await seed();
    const res = await request('/overview');
    expect(res.status, await res.clone().text()).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & {
      kpi: { income: number; expense: number; balance: number; months: number };
      yearComparison: { rows: Array<{ key: string; current: number }> };
      breakdown: { total: number; items: unknown[] };
      closeStatus: {
        month: string | null;
        steps: Array<{ key: string; done: boolean; count: number | null }>;
        total: number;
      };
      defenseForecast: { level: string };
    };
    expect(body.scope).toBe('total');
    expect(Object.keys(body).sort()).toEqual(
      [
        'breakdown',
        'closeStatus',
        'dataUpdatedAt',
        'defenseForecast',
        'kpi',
        'period',
        'scope',
        'trend',
        'yearComparison',
      ].sort(),
    );
    const expense = body.yearComparison.rows.find((r) => r.key === 'expense');
    expect(expense?.current).toBe(body.kpi.expense);
    expect(body.breakdown.total).toBe(body.kpi.expense);
    expect(body.closeStatus.month).toBe('2026-09');
    expect(body.closeStatus.total).toBe(4);
    expect(body.closeStatus.steps.find((s) => s.key === 'classification')).toMatchObject({
      done: false,
      count: 3,
    });
    expect(['none', 'nodata', 'caution', 'warn']).toContain(body.defenseForecast.level);
  });

  it('scope=business / household を受け付け、未知の scope は 400 invalid_scope', async () => {
    await seed();
    for (const scope of ['business', 'household']) {
      const res = await request(`/overview?scope=${scope}`);
      expect(res.status).toBe(200);
      expect(((await res.json()) as { scope: string }).scope).toBe(scope);
    }
    const bad = await request('/overview?scope=everything');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'invalid_scope' } });
  });

  it('クローズ状況は期間指定に左右されない (BR-002)', async () => {
    await seed();
    const allRes = await request('/overview');
    const narrowedRes = await request('/overview?from=2026-08&to=2026-08');
    expect([allRes.status, narrowedRes.status]).toEqual([200, 200]);
    const all = (await allRes.json()) as { closeStatus: { month: string | null }; kpi: { months: number } };
    const narrowed = (await narrowedRes.json()) as { closeStatus: unknown; kpi: { months: number } };
    expect(all.closeStatus.month).toBe('2026-09');
    expect(narrowed.kpi.months).toBe(1);
    expect(narrowed.closeStatus).toEqual(all.closeStatus);
  });

  it('クローズの取込済みは対象月を含む committed import だけで判定する', async () => {
    await seed();
    await d1
      .prepare("UPDATE imports SET months = '2026-08' WHERE user_id = 'default' AND status = 'committed'")
      .run();

    const outside = (await (await request('/overview')).json()) as {
      closeStatus: { steps: Array<{ key: string; done: boolean }> };
    };
    expect(outside.closeStatus.steps.find((x) => x.key === 'import')?.done).toBe(false);

    await d1
      .prepare(
        "UPDATE imports SET months = '2026-08,2026-09' WHERE user_id = 'default' AND status = 'committed'",
      )
      .run();
    const included = (await (await request('/overview')).json()) as typeof outside;
    expect(included.closeStatus.steps.find((x) => x.key === 'import')?.done).toBe(true);
  });
});

describe('GET /api/review-queue', () => {
  it('仕分け待ちと失敗した取込を全期間で数え、既定の順に並べる', async () => {
    await seed();
    await seedFailedImport();
    const body = await queue();
    expect(body.counts).toEqual({ reconciliation: 0, classification: 3, import: 1 });
    expect(body.total).toBe(4);
    expect(body.snoozedCount).toBe(0);
    expect(body.items.map((x) => `${x.kind}:${x.itemKey}`)).toEqual([
      'classification:mf-b',
      'classification:mf-c',
      'classification:mf-a',
      'import:run-failed',
    ]);
    expect(body.items[0]).toMatchObject({
      amount: -9_000,
      date: '2026-09-04',
      month: '2026-09',
      content: '架空書店',
    });
  });
});

describe('保留 (PUT/DELETE /api/review-queue/snoozes/:kind/:itemKey)', () => {
  it('冪等: PUT を重ねても 1 行、件数は 1 減り、DELETE で戻る。DELETE は行が無くても 204', async () => {
    await seed();
    const before = await queue();

    const first = await request('/review-queue/snoozes/classification/mf-a', 'PUT');
    expect(first.status, await first.clone().text()).toBe(200);
    expect(await first.json()).toMatchObject({ kind: 'classification', itemKey: 'mf-a' });
    const second = await request('/review-queue/snoozes/classification/mf-a', 'PUT');
    expect(second.status).toBe(200);

    const rows = await d1
      .prepare('SELECT item_kind, item_key, fingerprint FROM review_snoozes WHERE user_id = ?')
      .bind('default')
      .all<{ item_kind: string; item_key: string; fingerprint: string }>();
    expect(rows.results).toHaveLength(1);
    // 明細本文の写しを持たない
    expect(rows.results[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const after = await queue();
    expect(after.total).toBe(before.total - 1);
    expect(after.snoozedCount).toBe(1);
    expect(after.items.map((x) => x.itemKey)).not.toContain('mf-a');
    // 解除の対象として、保留中の明細を返す (FR-003)
    expect(before.snoozedItems).toEqual([]);
    expect(after.snoozedItems).toEqual([
      expect.objectContaining({ kind: 'classification', itemKey: 'mf-a' }),
    ]);

    expect((await request('/review-queue/snoozes/classification/mf-a', 'DELETE')).status).toBe(204);
    expect((await request('/review-queue/snoozes/classification/mf-a', 'DELETE')).status).toBe(204);
    const restored = await queue();
    expect(restored.total).toBe(before.total);
    expect(restored.snoozedItems).toEqual([]);
  });

  it('保存した指紋と明細が食い違えば保留は効かない (FR-003)', async () => {
    await seed();
    expect((await request('/review-queue/snoozes/classification/mf-a', 'PUT')).status).toBe(200);
    await d1
      .prepare("UPDATE review_snoozes SET fingerprint = ? WHERE item_key = 'mf-a'")
      .bind('0'.repeat(64))
      .run();
    const body = await queue();
    expect(body.snoozedCount).toBe(0);
    expect(body.items.map((x) => x.itemKey)).toContain('mf-a');
  });

  it('有効な保留後のキューと月次クローズの仕分け件数が一致し、stale 指紋は両方で復帰する', async () => {
    await seed();
    expect((await request('/review-queue/snoozes/classification/mf-a', 'PUT')).status).toBe(200);

    const effectiveQueue = await queue();
    const effectiveOverview = (await (await request('/overview')).json()) as {
      closeStatus: { steps: Array<{ key: string; count: number | null }> };
    };
    expect(effectiveOverview.closeStatus.steps.find((x) => x.key === 'classification')?.count).toBe(
      effectiveQueue.counts.classification,
    );

    await d1
      .prepare("UPDATE review_snoozes SET fingerprint = ? WHERE item_key = 'mf-a'")
      .bind('0'.repeat(64))
      .run();
    const staleQueue = await queue();
    const staleOverview = (await (await request('/overview')).json()) as typeof effectiveOverview;
    expect(staleQueue.items.map((x) => x.itemKey)).toContain('mf-a');
    expect(staleOverview.closeStatus.steps.find((x) => x.key === 'classification')?.count).toBe(
      staleQueue.counts.classification,
    );
  });

  it('キューに無い明細は 404 review_item_not_found', async () => {
    await seed();
    const res = await request('/review-queue/snoozes/classification/mf-unknown', 'PUT');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'review_item_not_found' } });
  });
});

describe('月次レビュー (PUT/DELETE /api/monthly-close/:month/review)', () => {
  it('冪等: 2 回目の PUT も初回の reviewedAt を返し、行は 1 行。DELETE は 204', async () => {
    await seed();
    const first = await request('/monthly-close/2026-09/review', 'PUT');
    expect(first.status, await first.clone().text()).toBe(200);
    const a = (await first.json()) as { month: string; reviewedAt: string };
    expect(a.month).toBe('2026-09');
    const second = (await (await request('/monthly-close/2026-09/review', 'PUT')).json()) as {
      reviewedAt: string;
    };
    expect(second.reviewedAt).toBe(a.reviewedAt);
    const count = await d1.prepare('SELECT COUNT(*) AS n FROM monthly_close_reviews').first<number>('n');
    expect(count).toBe(1);
    const reviewer = await d1
      .prepare('SELECT reviewed_by_user_id AS id FROM monthly_close_reviews')
      .first<string>('id');
    expect(reviewer).toBe(TEST_ADMIN.id);

    const overview = (await (await request('/overview')).json()) as {
      closeStatus: { steps: Array<{ key: string; done: boolean }>; reviewedAt: string | null };
    };
    expect(overview.closeStatus.steps.find((s) => s.key === 'review')?.done).toBe(true);
    expect(overview.closeStatus.reviewedAt).toBe(a.reviewedAt);

    expect((await request('/monthly-close/2026-09/review', 'DELETE')).status).toBe(204);
    expect((await request('/monthly-close/2026-09/review', 'DELETE')).status).toBe(204);
  });
});

describe('入力検証 (BR-007)', () => {
  it.each([
    ['PUT', '/review-queue/snoozes/other/mf-a', 'invalid_kind'],
    ['DELETE', '/review-queue/snoozes/other/mf-a', 'invalid_kind'],
    ['PUT', `/review-queue/snoozes/classification/${'a'.repeat(201)}`, 'invalid_item_key'],
    ['PUT', '/monthly-close/2026-13/review', 'invalid_month'],
    ['DELETE', '/monthly-close/2026-9/review', 'invalid_month'],
    ['PUT', '/monthly-close/latest/review', 'invalid_month'],
  ])('%s %s は 400 %s', async (method, path, code) => {
    await seed();
    const res = await request(path, method);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code } });
  });
});

describe('AC-004 バックアップ → 全消去 → 復元', () => {
  it('保留と月次レビューがバックアップに載り、空の DB へ復元しても件数とクローズ状況が保たれる', async () => {
    await seed();
    expect((await request('/review-queue/snoozes/classification/mf-b', 'PUT')).status).toBe(200);
    expect((await request('/monthly-close/2026-09/review', 'PUT')).status).toBe(200);
    const beforeQueue = await queue();
    const beforeClose = ((await (await request('/overview')).json()) as { closeStatus: unknown }).closeStatus;

    const exportedRes = await request('/export/json');
    expect(exportedRes.status).toBe(200);
    const exported = (await exportedRes.json()) as Record<string, unknown> & {
      reviewSnoozes: Array<{ kind: string; itemKey: string; fingerprint: string }>;
      monthlyCloseReviews: Array<{ month: string; reviewedByUserId: string }>;
    };
    expect(exported.reviewSnoozes).toEqual([
      expect.objectContaining({
        kind: 'classification',
        itemKey: 'mf-b',
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ]);
    // レビュー者はテナント鍵 ('default') ではなく、ログインした利用者の id
    expect(exported.monthlyCloseReviews).toEqual([
      expect.objectContaining({ month: '2026-09', reviewedByUserId: TEST_ADMIN.id }),
    ]);

    // 全消去: 別のインメモリ D1 を新しく作る
    const freshMf = new Miniflare(
      convertV4MiniflareOptions({
        name: 'overview-restore-fresh',
        modules: true,
        script: 'export default { fetch() { return new Response("test") } }',
        d1Databases: ['DB'],
        r2Buckets: ['FILES'],
      }),
    );
    try {
      const freshDb = (await freshMf.getD1Database('DB')) as D1Database;
      await applyMigrations(freshDb);
      const freshCookie = await loginForTest(app, { ...auth, DB: freshDb });
      const fresh = requesterFor(freshDb, () => freshCookie);
      expect((await queue(fresh)).total).toBe(0);

      const restored = await fresh('/restore', 'POST', exported);
      expect(restored.status, await restored.clone().text()).toBe(200);

      const afterQueue = await queue(fresh);
      expect(afterQueue.total).toBe(beforeQueue.total);
      expect(afterQueue.snoozedCount).toBe(1);
      expect(afterQueue.items.map((x) => x.itemKey)).not.toContain('mf-b');
      const afterClose = ((await (await fresh('/overview')).json()) as { closeStatus: unknown }).closeStatus;
      expect(afterClose).toEqual(beforeClose);
    } finally {
      await freshMf.dispose();
    }
  });

  it('保留・月次レビューの key を持たない旧バックアップの復元は、既存の行に触れない', async () => {
    await seed();
    expect((await request('/review-queue/snoozes/classification/mf-b', 'PUT')).status).toBe(200);
    expect((await request('/monthly-close/2026-09/review', 'PUT')).status).toBe(200);
    const restored = await request('/restore', 'POST', {
      ...RESTORE,
      mfTx: [...RESTORE.mfTx, tx('mf-d', '09/06', '架空花屋', -700)],
    });
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM review_snoozes').first<number>('n')).toBe(1);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM monthly_close_reviews').first<number>('n')).toBe(1);
  });

  it('レビュー者の無い月次レビュー行はテナント鍵で埋めず、復元を拒む', async () => {
    await seed();
    const restored = await request('/restore', 'POST', {
      ...RESTORE,
      monthlyCloseReviews: [{ month: '2026-09', reviewedAt: '2026-09-30T00:00:00.000Z' }],
    });
    expect(restored.status).toBe(400);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM monthly_close_reviews').first<number>('n')).toBe(0);
  });

  it('保留だけが違うバックアップも重複扱いでスキップせず、バックアップ側の集合で置き換える', async () => {
    await seed();
    const exported = (await (await request('/export/json')).json()) as Record<string, unknown>;
    expect(exported.reviewSnoozes).toEqual([]);
    expect((await request('/review-queue/snoozes/classification/mf-b', 'PUT')).status).toBe(200);
    const restored = await request('/restore', 'POST', exported);
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM review_snoozes').first<number>('n')).toBe(0);
  });
});
