/**
 * サブスク画面 (SYS-SUBS) の API/D1 結合テスト。GET 2 経路・更新 4 経路の 200/400/401/404、
 * 所有者の絞り込み、サイドバーのバッジと KPI 5 枚目の一致、判断の指紋を実 D1 で確かめる。
 * 実データは使わず、専用のインメモリ D1 と架空の MF 明細だけで検証する。
 *
 * 明細 (直近 1 年 = 2025-09..2026-08):
 * - Adobe Creative Cloud: 2,480 円、2026-07 から 2,728 円 (値上がり)
 * - Spotify 980 円と Netflix 1,490 円: どちらも既定辞書で「エンタメ」(カテゴリ重複)
 * - 架空ジム: 未登録の月額 (未登録の候補)
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

let mf: Miniflare;
let d1: D1Database;
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

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  sessionCookie: string | null = cookie,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.cookie = sessionCookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return app.request(
    `/api${path}`,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    { ...auth, DB: d1 },
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const n = 2025 * 12 + 8 + i;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
});

let seq = 0;
const mfPay = (user: string, month: string, name: string, amount: number) => {
  seq++;
  return d1
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,institution,is_target,is_transfer,identity_stable)
       VALUES (?,?,?,?,?,?,'通信費','情報サービス','架空カード',1,0,1)`,
    )
    .bind(user, `mf-subs-${seq}`, month, `${month}-01`, name, -amount);
};

interface Row {
  vendorKey: string;
  vendorId: number | null;
  status: 'registered' | 'unregistered';
  category: string;
  categorySource: 'dictionary' | 'override';
  review: { state: 'pending' | 'confirmed'; rules: string[]; fingerprint: string } | null;
}
interface Screen {
  period: { from: string; to: string } | null;
  previousPeriod: { from: string; to: string } | null;
  kpis: { monthlyTotal: number; reviewCandidates: number };
  rows: Row[];
}

const screen = async (query = '?span=1'): Promise<Screen> => {
  const res = await request(`/subscriptions${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Screen;
};
const badge = async (): Promise<number> => {
  const res = await request('/review-queue');
  expect(res.status).toBe(200);
  return ((await res.json()) as { subscriptionCandidates: number }).subscriptionCandidates;
};
const vendorIdOf = async (name: string): Promise<number> => {
  const row = await d1
    .prepare("SELECT id FROM sub_vendors WHERE user_id = 'default' AND name = ?")
    .bind(name)
    .first<{ id: number }>();
  if (!row) throw new Error(`vendor ${name} missing`);
  return row.id;
};

let otherVendorId = 0;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'subs-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');

  const pays = MONTHS.flatMap((month) => [
    mfPay('default', month, 'Adobe Creative Cloud', month >= '2026-07' ? 2_728 : 2_480),
    mfPay('default', month, 'Spotify', 980),
    mfPay('default', month, 'Netflix', 1_490),
    mfPay('default', month, '架空ジム', 7_700),
    mfPay('other-user', month, '別ユーザーの動画', 999_999),
  ]);
  await d1.batch([
    ...pays,
    d1.prepare(
      `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order) VALUES
        ('default','Adobe Creative Cloud','[]','[]',100),
        ('default','Spotify','[]','[]',200),
        ('default','Netflix','[]','[]',300),
        ('other-user','別ユーザーの動画','[]','[]',100)`,
    ),
  ]);
  const other = await d1
    .prepare("SELECT id FROM sub_vendors WHERE user_id = 'other-user'")
    .first<{ id: number }>();
  otherVendorId = other?.id ?? 0;
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
});

describe('GET /api/subscriptions', () => {
  it('期間の集計を返し、他人の明細を含めない', async () => {
    const body = await screen();
    expect(body.period).toEqual({ from: '2025-09', to: '2026-08' });
    expect(body.rows.map((r) => r.vendorKey)).toEqual(
      expect.arrayContaining(['adobecreativecloud', 'spotify', 'netflix']),
    );
    expect(body.rows.find((r) => r.status === 'unregistered')).toBeTruthy();
    // 登録済みで継続中の推定月額の和 (2,728 + 980 + 1,490)
    expect(body.kpis.monthlyTotal).toBe(5_198);
    expect(JSON.stringify(body)).not.toContain('999999');
    expect(JSON.stringify(body)).not.toContain('別ユーザー');
  });

  it('期間の指定が無ければ全期間で、前期間を作らない', async () => {
    const body = await screen('');
    expect(body.period).toBeNull();
    expect(body.previousPeriod).toBeNull();
  });

  it('未ログインは 401', async () => {
    const res = await request('/subscriptions', 'GET', undefined, null);
    expect(res.status).toBe(401);
  });

  it('集計と詳細の応答は保存させない (Cache-Control: no-store)', async () => {
    for (const path of ['/subscriptions?from=2025-09&to=2026-08', '/subscriptions/vendors/spotify']) {
      const res = await request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it('パスワード変更前は fence で止まる', async () => {
    const pending = await loginForTest(
      app,
      { ...auth, DB: d1 },
      {
        id: 'temp-user',
        email: 'temp-user@example.test',
        password: 'Synthetic-Temp-Password-1',
        mustChangePassword: true,
      },
    );
    const res = await request('/subscriptions', 'GET', undefined, pending);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/subscriptions/vendors/:key', () => {
  it('1 ベンダーぶんの取引と関連データを返す', async () => {
    const res = await request('/subscriptions/vendors/spotify?span=1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      vendorKey: string;
      transactionCount: number;
      related: { aliases: string[] } | null;
    };
    expect(body.vendorKey).toBe('spotify');
    expect(body.transactionCount).toBe(12);
    expect(body.related?.aliases).toEqual([]);
  });

  it('無いキーと他人のベンダーは 404', async () => {
    expect((await request('/subscriptions/vendors/no-such-vendor?span=1')).status).toBe(404);
    expect((await request(`/subscriptions/vendors/${encodeURIComponent('別ユーザーの動画')}`)).status).toBe(
      404,
    );
  });
});

describe('見直し候補への判断', () => {
  it('確認するとサイドバーのバッジと KPI が 1 減り、取消で戻る', async () => {
    const before = await screen();
    // バッジは既定の期間 (直近 1 年) の KPI 5 枚目と同じ数
    expect(await badge()).toBe(before.kpis.reviewCandidates);
    const spotify = before.rows.find((r) => r.vendorKey === 'spotify');
    expect(spotify?.review?.state).toBe('pending');

    const saved = await request('/subscriptions/review-decisions?span=1', 'POST', {
      vendorKey: 'spotify',
      decision: 'confirmed',
    });
    expect(saved.status).toBe(200);
    const after = await screen();
    expect(after.kpis.reviewCandidates).toBe(before.kpis.reviewCandidates - 1);
    expect(after.rows.find((r) => r.vendorKey === 'spotify')?.review?.state).toBe('confirmed');
    expect(await badge()).toBe(before.kpis.reviewCandidates - 1);

    const undone = await request('/subscriptions/review-decisions', 'DELETE', { vendorKey: 'spotify' });
    expect(undone.status).toBe(200);
    expect((await screen()).kpis.reviewCandidates).toBe(before.kpis.reviewCandidates);
    expect(await badge()).toBe(before.kpis.reviewCandidates);
  });

  it('除外は指紋つきで保存され、指紋が変わると候補が再び出る', async () => {
    const before = await screen();
    const netflix = before.rows.find((r) => r.vendorKey === 'netflix');
    expect(netflix?.review).not.toBeNull();

    const res = await request('/subscriptions/review-decisions?span=1', 'POST', {
      vendorKey: 'netflix',
      // クライアントが指紋を送っても使わない
      ruleFingerprint: 'forged',
      decision: 'dismissed',
    });
    expect(res.status).toBe(200);
    const stored = await d1
      .prepare(
        "SELECT decision, rule_fingerprint FROM sub_vendor_review_decisions WHERE user_id = 'default' AND vendor_key = 'netflix'",
      )
      .first<{ decision: string; rule_fingerprint: string }>();
    expect(stored).toEqual({ decision: 'dismissed', rule_fingerprint: netflix?.review?.fingerprint });
    const hidden = await screen();
    expect(hidden.rows.find((r) => r.vendorKey === 'netflix')?.review).toBeNull();
    expect(hidden.kpis.reviewCandidates).toBe(before.kpis.reviewCandidates - 1);

    // 最新月の額が変わると値上がりの規則が加わり、指紋が変わる
    await d1
      .prepare(
        "UPDATE mf_transactions SET amount = -1990 WHERE user_id = 'default' AND description = 'Netflix' AND month = '2026-08'",
      )
      .run();
    const back = (await screen()).rows.find((r) => r.vendorKey === 'netflix');
    expect(back?.review?.state).toBe('pending');
    expect(back?.review?.fingerprint).not.toBe(netflix?.review?.fingerprint);
  });

  it('除外済みの候補も確認済みへ切り替えられる (既存の判断を外して指紋を求める)', async () => {
    const dismissed = await request('/subscriptions/review-decisions?span=1', 'POST', {
      vendorKey: 'spotify',
      decision: 'dismissed',
    });
    expect(dismissed.status).toBe(200);
    // 指紋が一致しているので候補から消えている
    expect((await screen()).rows.find((r) => r.vendorKey === 'spotify')?.review).toBeNull();

    const res = await request('/subscriptions/review-decisions?span=1', 'POST', {
      vendorKey: 'spotify',
      decision: 'confirmed',
    });
    expect(res.status).toBe(200);
    expect((await screen()).rows.find((r) => r.vendorKey === 'spotify')?.review?.state).toBe('confirmed');
    expect(
      (await request('/subscriptions/review-decisions', 'DELETE', { vendorKey: 'spotify' })).status,
    ).toBe(200);
  });

  it('未登録・他人のベンダーは 404、候補でなければ 409、不正な本文は 400', async () => {
    const unregistered = (await screen()).rows.find((r) => r.status === 'unregistered');
    expect(
      (
        await request('/subscriptions/review-decisions?span=1', 'POST', {
          vendorKey: unregistered?.vendorKey,
          decision: 'confirmed',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request('/subscriptions/review-decisions?span=1', 'POST', {
          vendorKey: '別ユーザーの動画',
          decision: 'confirmed',
        })
      ).status,
    ).toBe(404);
    expect(
      (await request('/subscriptions/review-decisions', 'POST', { vendorKey: 'spotify', decision: 'maybe' }))
        .status,
    ).toBe(400);
    expect(
      (await request('/subscriptions/review-decisions', 'POST', { vendorKey: '', decision: 'confirmed' }))
        .status,
    ).toBe(400);
    expect(
      (
        await request('/subscriptions/review-decisions', 'POST', {
          vendorKey: 'x'.repeat(121),
          decision: 'confirmed',
        })
      ).status,
    ).toBe(400);
    expect(
      (await request('/subscriptions/review-decisions', 'DELETE', { vendorKey: 'spotify' })).status,
    ).toBe(404);
    // 全期間では継続中でなくなる行は無いが、見直し済みで規則に当たらない登録は候補ではない
    const id = await vendorIdOf('Adobe Creative Cloud');
    await request(`/sub-vendors/${id}/review`, 'POST');
    const quiet = await request('/subscriptions/review-decisions?from=2025-09&to=2026-05', 'POST', {
      vendorKey: 'adobecreativecloud',
      decision: 'confirmed',
    });
    expect(quiet.status).toBe(409);
  });

  it('未ログインは 401', async () => {
    const res = await request(
      '/subscriptions/review-decisions',
      'POST',
      { vendorKey: 'spotify', decision: 'confirmed' },
      null,
    );
    expect(res.status).toBe(401);
  });

  it('見直し日と判断の保存はJSON snapshotを無効化する', async () => {
    const activateSnapshot = () =>
      d1
        .prepare(
          `INSERT OR REPLACE INTO import_active_targets
             (user_id,target_key,content_hash,import_id,updated_at)
           VALUES ('default','json:global','synthetic',1,'2026-08-01T00:00:00.000Z')`,
        )
        .run();
    const activeCount = () =>
      d1
        .prepare("SELECT COUNT(*) AS n FROM import_active_targets WHERE user_id='default'")
        .first<{ n: number }>();

    await activateSnapshot();
    expect(
      (
        await request('/subscriptions/review-decisions?span=1', 'POST', {
          vendorKey: 'spotify',
          decision: 'confirmed',
        })
      ).status,
    ).toBe(200);
    expect(await activeCount()).toEqual({ n: 0 });
    await request('/subscriptions/review-decisions', 'DELETE', { vendorKey: 'spotify' });

    await activateSnapshot();
    expect(
      (await request(`/sub-vendors/${await vendorIdOf('Adobe Creative Cloud')}/review`, 'POST')).status,
    ).toBe(200);
    expect(await activeCount()).toEqual({ n: 0 });
  });
});

describe('未ログインの拒否', () => {
  // 画面が使う 6 経路のうち、上の describe で見ていない 4 経路。認証は router 前段なので本文の正否より先に 401
  it.each([
    ['GET', '/subscriptions/vendors/spotify', undefined],
    ['DELETE', '/subscriptions/review-decisions', { vendorKey: 'spotify' }],
    ['POST', '/sub-vendors/1/aliases', { aliases: ['Spotify AB'] }],
    ['PUT', '/sub-vendors/1', { category: '音楽' }],
  ] as const)('%s %s は 401', async (method, path, body) => {
    const res = await request(path, method, body, null);
    expect(res.status).toBe(401);
  });
});

describe('名称の統合と部分更新', () => {
  it('統合は既存の別名とまとめ、同じ別名は冪等に無視する', async () => {
    const id = await vendorIdOf('Spotify');
    const first = await request(`/sub-vendors/${id}/aliases`, 'POST', { aliases: ['SPOTIFY.COM'] });
    expect(first.status).toBe(200);
    const again = await request(`/sub-vendors/${id}/aliases`, 'POST', {
      aliases: ['spotify.com', 'Spotify'],
    });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { aliases: string[] }).aliases).toEqual(['SPOTIFY.COM']);
  });

  it('統合後に 50 件を超えるなら 400、他人と無い id は 404、不正な id は 400', async () => {
    const id = await vendorIdOf('Spotify');
    const many = Array.from({ length: 50 }, (_, i) => `架空別名${i}`);
    expect((await request(`/sub-vendors/${id}/aliases`, 'POST', { aliases: many })).status).toBe(400);
    expect((await request(`/sub-vendors/${id}/aliases`, 'POST', { aliases: [] })).status).toBe(400);
    expect((await request(`/sub-vendors/${id}/aliases`, 'POST', { aliases: ['x'.repeat(121)] })).status).toBe(
      400,
    );
    expect((await request(`/sub-vendors/${otherVendorId}/aliases`, 'POST', { aliases: ['a'] })).status).toBe(
      404,
    );
    expect((await request('/sub-vendors/abc/aliases', 'POST', { aliases: ['a'] })).status).toBe(400);
  });

  it('整数でない :id は変更・解除・除外の取消でも 400 にそろえる (以前は PUT / DELETE だけ 404)', async () => {
    expect((await request('/sub-vendors/abc', 'PUT', { category: '音楽' })).status).toBe(400);
    expect((await request('/sub-vendors/1.5', 'DELETE')).status).toBe(400);
    expect((await request('/sub-vendors/exclusions/abc', 'DELETE')).status).toBe(400);
    expect((await request('/sub-vendors/abc/review', 'POST')).status).toBe(400);
  });

  it('カテゴリだけを上書きし、null で辞書に戻す。他の項目は保つ', async () => {
    const id = await vendorIdOf('Spotify');
    const set = await request(`/sub-vendors/${id}`, 'PUT', { category: '音楽' });
    expect(set.status).toBe(200);
    const row = (await screen()).rows.find((r) => r.vendorKey === 'spotify');
    expect(row).toMatchObject({ category: '音楽', categorySource: 'override' });
    const vendor = await d1
      .prepare('SELECT name, aliases, category FROM sub_vendors WHERE id = ?')
      .bind(id)
      .first<{ name: string; aliases: string; category: string | null }>();
    expect(vendor).toEqual({ name: 'Spotify', aliases: '["SPOTIFY.COM"]', category: '音楽' });

    expect((await request(`/sub-vendors/${id}`, 'PUT', { category: null })).status).toBe(200);
    expect((await screen()).rows.find((r) => r.vendorKey === 'spotify')?.categorySource).toBe('dictionary');
  });

  it('別名は 50 件 × 120 文字まで受け付け、カテゴリは 20 文字まで', async () => {
    const id = await vendorIdOf('Netflix');
    const fifty = Array.from({ length: 50 }, (_, i) => `${'架'.repeat(90)}${i}`);
    expect((await request(`/sub-vendors/${id}`, 'PUT', { aliases: fifty })).status).toBe(200);
    expect((await request(`/sub-vendors/${id}`, 'PUT', { aliases: [...fifty, '51件目'] })).status).toBe(400);
    expect((await request(`/sub-vendors/${id}`, 'PUT', { category: 'あ'.repeat(21) })).status).toBe(400);
    expect((await request(`/sub-vendors/${id}`, 'PUT', { aliases: [] })).status).toBe(200);
  });

  it('明細由来のベンダー名は全経路で120文字まで、121文字は400', async () => {
    const max = `V${'x'.repeat(119)}`;
    const tooLong = `V${'x'.repeat(120)}`;
    const created = await request('/sub-vendors', 'POST', { name: max });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { ok: true; id: number };
    expect(createdBody.ok).toBe(true);
    expect(createdBody.id).toBe(await vendorIdOf(max));
    expect((await request('/sub-vendors', 'POST', { name: tooLong })).status).toBe(400);
    const id = createdBody.id;
    expect((await request(`/sub-vendors/${id}`, 'DELETE')).status).toBe(200);

    expect((await request('/sub-vendors/exclusions', 'POST', { partner: max })).status).toBe(200);
    expect((await request('/sub-vendors/exclusions', 'POST', { partner: tooLong })).status).toBe(400);
    const exclusion = await d1
      .prepare("SELECT id FROM sub_vendor_exclusions WHERE user_id='default' AND partner=?")
      .bind(max)
      .first<{ id: number }>();
    expect(exclusion).not.toBeNull();
    expect((await request(`/sub-vendors/exclusions/${exclusion!.id}`, 'DELETE')).status).toBe(200);
  });

  it('他人のベンダーの変更は 404', async () => {
    expect((await request(`/sub-vendors/${otherVendorId}`, 'PUT', { category: '音楽' })).status).toBe(404);
  });
});

describe('名前の変更・登録解除と見直しの判断', () => {
  const decisionKeys = async (): Promise<string[]> => {
    const { results } = await d1
      .prepare(
        "SELECT vendor_key FROM sub_vendor_review_decisions WHERE user_id = 'default' ORDER BY vendor_key",
      )
      .all<{ vendor_key: string }>();
    return results.map((r) => r.vendor_key);
  };

  it('名前を変えても判断は新しい名前へ付いてくる (候補に戻らず、バッジも増えない)', async () => {
    expect(
      (
        await request('/subscriptions/review-decisions?span=1', 'POST', {
          vendorKey: 'spotify',
          decision: 'confirmed',
        })
      ).status,
    ).toBe(200);
    const before = await badge();
    const id = await vendorIdOf('Spotify');
    expect(
      (await request(`/sub-vendors/${id}`, 'PUT', { name: 'Spotify Premium', aliases: ['Spotify'] })).status,
    ).toBe(200);
    const row = (await screen()).rows.find((r) => r.vendorKey === 'spotifypremium');
    expect(row?.review?.state).toBe('confirmed');
    expect(await decisionKeys()).toContain('spotifypremium');
    expect(await decisionKeys()).not.toContain('spotify');
    expect(await badge()).toBe(before);
  });

  it('登録を解除すると判断も消え、同じ名前で登録し直しても古い判断は生き返らない', async () => {
    // 前のテストに頼らず、この中で判断を保存してから解除する
    await request('/subscriptions/review-decisions', 'DELETE', { vendorKey: 'spotifypremium' });
    expect(
      (
        await request('/subscriptions/review-decisions?span=1', 'POST', {
          vendorKey: 'spotifypremium',
          decision: 'dismissed',
        })
      ).status,
    ).toBe(200);
    expect(await decisionKeys()).toContain('spotifypremium');
    const id = await vendorIdOf('Spotify Premium');
    expect((await request(`/sub-vendors/${id}`, 'DELETE')).status).toBe(200);
    expect(await decisionKeys()).not.toContain('spotifypremium');

    expect(
      (await request('/sub-vendors', 'POST', { name: 'Spotify Premium', aliases: ['Spotify'], accounts: [] }))
        .status,
    ).toBe(200);
    const row = (await screen()).rows.find((r) => r.vendorKey === 'spotifypremium');
    expect(row?.review?.state).toBe('pending');
  });
});
