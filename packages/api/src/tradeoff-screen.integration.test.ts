/**
 * トレードオフ画面 (SYS-TRADEOFF) の API/D1 結合テスト。GET・POST・PUT の応答の形、
 * 候補の並びと必要度、サーバでの再計算、上限、利用者の分離を実 D1 で確かめる。
 * 実データは使わず、専用のインメモリ D1 と架空の freee 経費だけで検証する。
 *
 * 経費 (期間 2026-01..2026-06、候補の窓は最後の 3 か月 = 04..06):
 * - 地代家賃 / 架空不動産: 毎月 60,000 (固定費・横ばい → 高)
 * - 外注費 / 架空デザイン: 01..03 は 20,000、04..06 は 30,000 / 25,000 / 20,000 (減少 → 低、月額 25,000)
 * - 通信費 / 架空通信: 毎月 25,000 (固定費・横ばい → 高)。0000 の初期正規化で科目は「サブスク・通信」になる
 * - 広告宣伝費 / 架空広告: 05 に 9,000、06 に 30,000 (スポット・増加 → 低、月額 13,000)
 * - 雑費 / 取引先なし: 毎月 999 (月額 1,000 未満で候補にしない)
 * - other-user の 地代家賃 999,999 (応答に混ざらない)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRADEOFF_AMOUNT_MAX,
  TRADEOFF_CANDIDATE_KEY_MAX,
  TRADEOFF_CANDIDATE_LIMIT,
  TRADEOFF_MEMO_MAX,
  TRADEOFF_TITLE_MAX,
  tradeoffCandidateKey,
} from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';
import { getDb, recomputeFromDeals } from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};
const PERIOD = '?from=2026-01&to=2026-06';
const RENT = tradeoffCandidateKey('地代家賃', '架空不動産');
const OUTSOURCE = tradeoffCandidateKey('外注費', '架空デザイン');
// 候補キーは正規化後の科目 (account_norm) から作るので、通信費ではなく正規化先で指す
const TELECOM = tradeoffCandidateKey('サブスク・通信', '架空通信');
const ADS = tradeoffCandidateKey('広告宣伝費', '架空広告');
const PIPE_IN_ACCOUNT = tradeoffCandidateKey('区切|科目', '取引先');
const PIPE_IN_PARTNER = tradeoffCandidateKey('区切', '科目|取引先');
/** 保存行の selected の期待値。月額は冒頭の経費から手で出した値 (実装の出力を写さない) */
const SAVED: Record<string, { key: string; label: string; value: number }> = {
  [RENT]: { key: RENT, label: '地代家賃 / 架空不動産', value: 60_000 },
  [OUTSOURCE]: { key: OUTSOURCE, label: '外注費 / 架空デザイン', value: 25_000 },
  [TELECOM]: { key: TELECOM, label: 'サブスク・通信 / 架空通信', value: 25_000 },
};

let mf: Miniflare;
let d1: D1Database;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
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

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const deal = (user: string, month: string, account: string, partner: string | null, amount: number) =>
  d1
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount)
       VALUES (?,?,?,'expense',?,?,?,?)`,
    )
    .bind(user, month, `${month}-10`, partner, account, account, amount);

interface Candidate {
  key: string;
  account: string;
  partner: string;
  monthly: number;
  annual: number;
  need: 'low' | 'mid' | 'high';
  needSource: 'auto' | 'manual';
  trend: 'down' | 'flat' | 'up';
  reason: string;
  memo: string | null;
  relatedTo: string | null;
}
interface Plan {
  id: number;
  title: string | null;
  amount: number;
  recurring: boolean;
  startMonth: string | null;
  memo: string | null;
  keys: string[];
  covered: number;
  verdict: 'covered' | 'insufficient';
  createdAt: string;
}
interface Screen {
  candidates: Candidate[];
  defense: { monthlyMargin: number | null; status: string };
  latest: Plan | null;
}

const screen = async (): Promise<Screen> => {
  const res = await request(`/tradeoff${PERIOD}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Screen;
};
const planCount = async (): Promise<number> =>
  (await d1.prepare('SELECT COUNT(*) AS n FROM tradeoff_plans').first<number>('n')) ?? 0;
const noteCount = async (user = 'default'): Promise<number> =>
  (await d1
    .prepare('SELECT COUNT(*) AS n FROM tradeoff_candidate_notes WHERE user_id = ?')
    .bind(user)
    .first<number>('n')) ?? 0;
const planBody = (over: Record<string, unknown> = {}) => ({
  title: '架空の新しい車',
  amount: 80_000,
  recurring: true,
  startMonth: '2026-07',
  memo: null,
  keys: [RENT, OUTSOURCE],
  ...over,
});
const putNote = (key: string, body: unknown, sessionCookie: string | null = cookie) =>
  request(`/tradeoff/candidates/${encodeURIComponent(key)}${PERIOD}`, 'PUT', body, sessionCookie);

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'tradeoff-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');

  const outsource = [20_000, 20_000, 20_000, 30_000, 25_000, 20_000];
  const ads = [0, 0, 0, 0, 9_000, 30_000];
  await d1.batch(
    MONTHS.flatMap((month, i) => [
      deal('default', month, '地代家賃', '架空不動産', 60_000),
      deal('default', month, '外注費', '架空デザイン', outsource[i]),
      deal('default', month, '通信費', '架空通信', 25_000),
      ...(ads[i] > 0 ? [deal('default', month, '広告宣伝費', '架空広告', ads[i])] : []),
      deal('default', month, '区切|科目', '取引先', 5_000),
      deal('default', month, '区切', '科目|取引先', 4_000),
      deal('default', month, '雑費', null, 999),
      deal('other-user', month, '地代家賃', '別ユーザーの大家', 999_999),
    ]),
  );
  // 本番の取込と同じく、freee 経費から月次集計 (Dataset の事業経費) を作り直す
  await recomputeFromDeals(getDb(d1), 'default');
  await recomputeFromDeals(getDb(d1), 'other-user');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
});

describe('GET /api/tradeoff', () => {
  it('候補を月額の降順で返し、必要度・推移・年額を core の規則どおりに付ける', async () => {
    const body = await screen();
    expect(body.candidates.map((c) => [c.key, c.monthly, c.annual, c.need, c.needSource, c.trend])).toEqual([
      [RENT, 60_000, 720_000, 'high', 'auto', 'flat'],
      // 同額は候補キーのコード単位順 (サ U+30B5 < 外 U+5916)
      [TELECOM, 25_000, 300_000, 'high', 'auto', 'flat'],
      [OUTSOURCE, 25_000, 300_000, 'low', 'auto', 'down'],
      [ADS, 13_000, 156_000, 'low', 'auto', 'up'],
      [PIPE_IN_ACCOUNT, 5_000, 60_000, 'high', 'auto', 'flat'],
      [PIPE_IN_PARTNER, 4_000, 48_000, 'high', 'auto', 'flat'],
    ]);
    const rent = body.candidates[0];
    expect(rent).toMatchObject({ account: '地代家賃', partner: '架空不動産', memo: null });
    expect(rent.reason.startsWith('固定費・直近 3 か月は横ばい')).toBe(true);
    // 固定費見直しの改善案 (月 30,000 円超) から関連ページを引く
    expect(rent.relatedTo).toContain('/subscriptions');
    expect(body.candidates[3].reason.startsWith('スポット・直近 3 か月は増加')).toBe(true);
  });

  it('月額 1,000 円未満と他の利用者の経費を候補にしない', async () => {
    const body = await screen();
    expect(body.candidates.some((c) => c.account === '雑費')).toBe(false);
    expect(JSON.stringify(body)).not.toContain('999999');
    expect(JSON.stringify(body)).not.toContain('別ユーザー');
  });

  it('生活費の実績が無ければ防衛ラインは nodata で余裕は null', async () => {
    const body = await screen();
    expect(body.defense).toEqual({ monthlyMargin: null, status: 'nodata' });
  });

  it('旧応答の budgets・plans・review を返さない', async () => {
    const body = (await screen()) as unknown as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['candidates', 'defense', 'latest']);
  });

  it('未ログインは 401', async () => {
    const res = await request(`/tradeoff${PERIOD}`, 'GET', undefined, null);
    expect(res.status).toBe(401);
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
    const res = await request(`/tradeoff${PERIOD}`, 'GET', undefined, pending);
    expect(res.status).toBe(403);
  });
});

// POST は行を増やすので、latest の確認はこの describe の中で順に行う。
describe('POST /api/tradeoff と latest', () => {
  it('記録が無ければ latest は null', async () => {
    expect((await screen()).latest).toBeNull();
  });

  it('O2 の 3 例をサーバの月額で再計算し、covered は選んだ候補の月額合計で保存する', async () => {
    const cases = [
      { body: planBody(), covered: 85_000, verdict: 'covered' },
      {
        body: planBody({ amount: 300_000, recurring: false, keys: [OUTSOURCE, TELECOM] }),
        covered: 50_000,
        verdict: 'covered',
      },
      {
        body: planBody({ amount: 100_000, recurring: true, keys: [OUTSOURCE, TELECOM] }),
        covered: 50_000,
        verdict: 'insufficient',
      },
    ];
    for (const c of cases) {
      const res = await request(`/tradeoff${PERIOD}`, 'POST', c.body);
      expect(res.status).toBe(201);
      const out = (await res.json()) as { ok: boolean; id: number; plan: Plan };
      expect(out.ok).toBe(true);
      expect(out.plan).toMatchObject({
        id: out.id,
        amount: c.body.amount,
        recurring: c.body.recurring,
        startMonth: '2026-07',
        keys: c.body.keys,
        covered: c.covered,
        verdict: c.verdict,
      });
      const row = await d1
        .prepare('SELECT user_id, covered, verdict, selected FROM tradeoff_plans WHERE id = ?')
        .bind(out.id)
        .first<{ user_id: string; covered: number; verdict: string; selected: string }>();
      expect(row).toMatchObject({ user_id: 'default', covered: c.covered, verdict: c.verdict });
      // selected は [{ key, label, value }] で、value はクライアントの値ではなくサーバの月額
      expect(JSON.parse(row?.selected ?? '[]')).toEqual(c.body.keys.map((k) => SAVED[k]));
    }
  });

  it('latest は自分の記録のうち id 最大の 1 件', async () => {
    // 他の利用者の記録は id が最大でも latest に出ない
    await d1
      .prepare(
        `INSERT INTO tradeoff_plans (id,user_id,title,amount,recurring,selected,covered,verdict)
         VALUES (9000000,'other-user','別ユーザーの記録',1,1,'[]',0,'covered')`,
      )
      .run();
    const max = await d1
      .prepare("SELECT MAX(id) AS id FROM tradeoff_plans WHERE user_id = 'default'")
      .first<number>('id');
    const latest = (await screen()).latest;
    expect(latest?.id).toBe(max);
    expect(latest?.title).not.toBe('別ユーザーの記録');
    expect(latest?.verdict).toBe('insufficient');
  });

  it('本文の covered・verdict を信用しない', async () => {
    const res = await request(`/tradeoff${PERIOD}`, 'POST', {
      ...planBody(),
      covered: 999_999_999,
      verdict: 'insufficient',
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    const row = await d1
      .prepare('SELECT covered, verdict FROM tradeoff_plans WHERE id = ?')
      .bind(id)
      .first<{ covered: number; verdict: string }>();
    expect(row).toEqual({ covered: 85_000, verdict: 'covered' });
  });

  it('現在の候補に無いキーは 422 で 1 行も増やさない', async () => {
    const before = await planCount();
    for (const keys of [[RENT, '存在しない科目|架空'], ['地代家賃|別ユーザーの大家'], ['雑費|']]) {
      const res = await request(`/tradeoff${PERIOD}`, 'POST', planBody({ keys }));
      expect(res.status).toBe(422);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unknown_candidate');
    }
    expect(await planCount()).toBe(before);
  });

  it('上限を 1 つ超えた各欄は 400 で 1 行も増やさない', async () => {
    const before = await planCount();
    const bad = [
      { title: 'あ'.repeat(TRADEOFF_TITLE_MAX + 1) },
      { memo: 'あ'.repeat(TRADEOFF_MEMO_MAX + 1) },
      { amount: 0 },
      { amount: TRADEOFF_AMOUNT_MAX + 1 },
      { amount: 1.5 },
      { keys: [] },
      { keys: Array.from({ length: TRADEOFF_CANDIDATE_LIMIT + 1 }, (_, i) => `v1:["${i}",""]`) },
      { keys: ['x'.repeat(TRADEOFF_CANDIDATE_KEY_MAX + 1)] },
      { startMonth: '2026-13' },
      { recurring: 'yes' },
    ];
    for (const over of bad) {
      const res = await request(`/tradeoff${PERIOD}`, 'POST', planBody(over));
      expect(res.status, JSON.stringify(over).slice(0, 40)).toBe(400);
    }
    expect(await planCount()).toBe(before);
  });

  it('64 KiB を超える本文は検証・保存前に 413 で止める', async () => {
    const before = await planCount();
    const res = await request(`/tradeoff${PERIOD}`, 'POST', {
      ...planBody(),
      memo: 'x'.repeat(64 * 1024),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('payload_too_large');
    expect(await planCount()).toBe(before);
  });

  it('境界ちょうどは受け付ける', async () => {
    const res = await request(
      `/tradeoff${PERIOD}`,
      'POST',
      planBody({
        title: 'あ'.repeat(TRADEOFF_TITLE_MAX),
        memo: 'あ'.repeat(TRADEOFF_MEMO_MAX),
        amount: TRADEOFF_AMOUNT_MAX,
        startMonth: null,
      }),
    );
    expect(res.status).toBe(201);
  });

  it('同じ候補キーを 2 回含む keys は 400 で 1 行も増やさない', async () => {
    const before = await planCount();
    const res = await request(`/tradeoff${PERIOD}`, 'POST', planBody({ keys: [RENT, RENT] }));
    expect(res.status).toBe(400);
    expect(await planCount()).toBe(before);
  });

  it('同じ本文を 2 回送ると 2 行増える', async () => {
    const before = await planCount();
    expect((await request(`/tradeoff${PERIOD}`, 'POST', planBody())).status).toBe(201);
    expect((await request(`/tradeoff${PERIOD}`, 'POST', planBody())).status).toBe(201);
    expect(await planCount()).toBe(before + 2);
  });

  it('未ログインは 401', async () => {
    const res = await request(`/tradeoff${PERIOD}`, 'POST', planBody(), null);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/tradeoff/candidates/:key', () => {
  it('必要度とメモを保存し、GET で manual とメモが返る', async () => {
    const res = await putNote(OUTSOURCE, { need: 'high', memo: '契約が年末まで' });
    expect(res.status).toBe(200);
    const out = (await res.json()) as { ok: boolean; candidate: Candidate };
    expect(out.ok).toBe(true);
    expect(out.candidate).toMatchObject({
      key: OUTSOURCE,
      need: 'high',
      needSource: 'manual',
      memo: '契約が年末まで',
      reason: '契約が年末まで',
    });
    const got = (await screen()).candidates.find((c) => c.key === OUTSOURCE);
    expect(got).toMatchObject({ need: 'high', needSource: 'manual', memo: '契約が年末まで' });
  });

  it('同じ本文の繰り返しは行を増やさない', async () => {
    expect((await putNote(OUTSOURCE, { need: 'high', memo: '契約が年末まで' })).status).toBe(200);
    expect(await noteCount()).toBe(1);
  });

  it('メモだけの上書きは必要度を自動のまま残す', async () => {
    const res = await putNote(TELECOM, { need: null, memo: '回線は2本' });
    expect(res.status).toBe(200);
    const { candidate } = (await res.json()) as { candidate: Candidate };
    expect(candidate).toMatchObject({ need: 'high', needSource: 'auto', memo: '回線は2本' });
  });

  it('メモの空文字は null として扱う', async () => {
    const res = await putNote(TELECOM, { need: 'mid', memo: '' });
    expect(res.status).toBe(200);
    const { candidate } = (await res.json()) as { candidate: Candidate };
    expect(candidate).toMatchObject({ need: 'mid', needSource: 'manual', memo: null });
  });

  it('両方 null で自分の行だけを消し、自動へ戻す', async () => {
    await d1
      .prepare(
        `INSERT INTO tradeoff_candidate_notes (user_id,candidate_key,need,memo,updated_at)
         VALUES ('other-user',?,'mid','別ユーザーの外注メモ','2026-06-30T00:00:00Z')`,
      )
      .bind(OUTSOURCE)
      .run();
    const res = await putNote(OUTSOURCE, { need: null, memo: null });
    expect(res.status).toBe(200);
    const { candidate } = (await res.json()) as { candidate: Candidate };
    expect(candidate).toMatchObject({ need: 'low', needSource: 'auto', memo: null });
    const row = await d1
      .prepare(
        "SELECT COUNT(*) AS n FROM tradeoff_candidate_notes WHERE user_id = 'default' AND candidate_key = ?",
      )
      .bind(OUTSOURCE)
      .first<number>('n');
    expect(row).toBe(0);
    // 他の利用者の同じキーの上書きは消えない
    const others = await d1
      .prepare("SELECT memo FROM tradeoff_candidate_notes WHERE user_id = 'other-user' AND candidate_key = ?")
      .bind(OUTSOURCE)
      .all<{ memo: string }>();
    expect(others.results).toEqual([{ memo: '別ユーザーの外注メモ' }]);
  });

  it('他の利用者の上書きは GET に出ない', async () => {
    await d1
      .prepare(
        `INSERT INTO tradeoff_candidate_notes (user_id,candidate_key,need,memo,updated_at)
         VALUES ('other-user',?,'low','別ユーザーのメモ','2026-06-30T00:00:00Z')`,
      )
      .bind(RENT)
      .run();
    const rent = (await screen()).candidates.find((c) => c.key === RENT);
    expect(rent).toMatchObject({ need: 'high', needSource: 'auto', memo: null });
    expect(JSON.stringify(await screen())).not.toContain('別ユーザーのメモ');
  });

  it('旧は衝突した | を含む 2 候補の上書きを別々に保存する', async () => {
    expect(PIPE_IN_ACCOUNT).not.toBe(PIPE_IN_PARTNER);
    expect((await putNote(PIPE_IN_ACCOUNT, { need: 'low', memo: '科目側' })).status).toBe(200);
    expect((await putNote(PIPE_IN_PARTNER, { need: 'mid', memo: '取引先側' })).status).toBe(200);
    const candidates = (await screen()).candidates;
    expect(candidates.find((candidate) => candidate.key === PIPE_IN_ACCOUNT)).toMatchObject({
      need: 'low',
      memo: '科目側',
    });
    expect(candidates.find((candidate) => candidate.key === PIPE_IN_PARTNER)).toMatchObject({
      need: 'mid',
      memo: '取引先側',
    });
  });

  it('現在の候補に無いキーは 422 で行を作らない', async () => {
    const before = await noteCount();
    for (const key of ['存在しない科目|架空', '地代家賃|別ユーザーの大家', '雑費|']) {
      const res = await putNote(key, { need: 'low', memo: null });
      expect(res.status).toBe(422);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unknown_candidate');
    }
    expect(await noteCount()).toBe(before);
  });

  it('501 字のメモ・値域外の必要度・300 字を超えるキーは 400', async () => {
    const before = await noteCount();
    expect((await putNote(RENT, { need: 'low', memo: 'あ'.repeat(TRADEOFF_MEMO_MAX + 1) })).status).toBe(400);
    expect((await putNote(RENT, { need: 'urgent', memo: null })).status).toBe(400);
    expect((await putNote(RENT, { memo: null })).status).toBe(400);
    expect(
      (await putNote('x'.repeat(TRADEOFF_CANDIDATE_KEY_MAX + 1), { need: 'low', memo: null })).status,
    ).toBe(400);
    expect(await noteCount()).toBe(before);
    expect((await putNote(RENT, { need: 'low', memo: 'あ'.repeat(TRADEOFF_MEMO_MAX) })).status).toBe(200);
  });

  it('64 KiB を超える本文は検証・保存前に 413 で止める', async () => {
    const before = await noteCount();
    const res = await putNote(RENT, { need: 'low', memo: 'x'.repeat(64 * 1024) });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('payload_too_large');
    expect(await noteCount()).toBe(before);
  });

  it('未ログインは 401', async () => {
    const res = await putNote(RENT, { need: 'low', memo: null }, null);
    expect(res.status).toBe(401);
  });
});
