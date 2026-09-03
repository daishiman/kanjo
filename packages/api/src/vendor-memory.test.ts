/**
 * 取引先ごとの決め事(vendor_memory)の API 回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空の取引先だけで検証する。
 *
 * 見張っているのは4つ。
 *   1. 他の利用者の決め事を見ることも触ることもできないこと
 *   2. 取り消した決め事が以後は当たらないこと
 *   3. 当て直しが、過去に自動で当てた手当てだけを外すこと(人の手当ては残す・DR-6)
 *   4. 応答に明細の内容・金額が出ないこと(DR-9)
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

const MF_HEADER = '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関';

/** 同じ取引先が3件、別の取引先が1件。すべて架空。 */
const SEED_CSV = [
  MF_HEADER,
  '1,2026/06/10,-1000,架空費,架空内訳,0,架空商店,tx-a,架空口座',
  '1,2026/06/11,-1100,架空費,架空内訳,0,架空商店,tx-b,架空口座',
  '1,2026/06/12,-1200,架空費,架空内訳,0,架空商店,tx-c,架空口座',
  '1,2026/06/13,-9900,架空費,架空内訳,0,別の架空商店,tx-z,架空口座',
].join('\n');

async function importSeed(): Promise<void> {
  const form = new FormData();
  form.append('file', new File([SEED_CSV], 'mf-seed.csv', { type: 'text/csv' }));
  const response = await app.request(
    '/api/imports',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(response.status).toBe(200);
}

interface SeedMemory {
  userId?: string;
  vendorKey?: string;
  label?: string;
  cls?: string | null;
  big?: string | null;
  mid?: string | null;
  owner?: string | null;
  hitCount?: number;
  disagreeCount?: number;
  pinned?: boolean;
  revoked?: boolean;
}

/** 決め事を直接1件仕込む。取込が決め事を育てる経路とは切り離して、操作だけを見る。 */
async function seedMemory(memory: SeedMemory = {}): Promise<void> {
  const now = new Date().toISOString();
  await d1
    .prepare(
      `INSERT INTO vendor_memory
         (user_id, vendor_key, vendor_label, cls, category_major, category_mid, owner,
          hit_count, disagree_count, pinned, revoked, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      memory.userId ?? 'default',
      memory.vendorKey ?? '架空商店',
      memory.label ?? '架空商店',
      memory.cls ?? null,
      memory.big ?? null,
      memory.mid ?? null,
      memory.owner ?? null,
      memory.hitCount ?? 0,
      memory.disagreeCount ?? 0,
      memory.pinned ? 1 : 0,
      memory.revoked ? 1 : 0,
      now,
      now,
    )
    .run();
}

/** 手当てを直接1件仕込む。「人が付けた手当て」と「自動で当てた手当て」を作り分ける。 */
async function seedEdit(txId: string, edit: { cls?: string; owner?: string }): Promise<void> {
  await d1
    .prepare('INSERT INTO tx_edits (user_id, tx_id, cls, owner, updated_at) VALUES (?,?,?,?,?)')
    .bind('default', txId, edit.cls ?? null, edit.owner ?? null, new Date().toISOString())
    .run();
}

const editedTxIds = async (): Promise<string[]> =>
  (
    await d1
      .prepare('SELECT tx_id FROM tx_edits WHERE user_id=? ORDER BY tx_id')
      .bind('default')
      .all<{ tx_id: string }>()
  ).results.map((row) => row.tx_id);

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'vendor-memory-test',
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

type MemoryBody = {
  vendorKey: string;
  vendorLabel: string;
  cls: string | null;
  owner: string | null;
  hitCount: number;
  pinned: boolean;
  revoked: boolean;
  disposition: string;
  confidence: number;
  reason: string;
};

const listMemories = async (): Promise<MemoryBody[]> => {
  const response = await jsonRequest('/vendor-memory');
  expect(response.status).toBe(200);
  return ((await response.json()) as { memories: MemoryBody[] }).memories;
};

describe('決め事の一覧', () => {
  it('よく使う決め事から並べ、いま自動で当たるかどうかを添える', async () => {
    await seedMemory({ vendorKey: '架空商店', cls: 'biz', hitCount: 5 });
    await seedMemory({ vendorKey: '別の架空商店', cls: 'per', hitCount: 1 });

    const memories = await listMemories();
    expect(memories.map((m) => m.vendorKey)).toEqual(['架空商店', '別の架空商店']);
    expect(memories[0].disposition).toBe('auto-apply');
    // 1件しかない決め事は候補どまり。ここが auto-apply になると2件目から外し続ける(D01)
    expect(memories[1].disposition).toBe('suggest');
    expect(memories[1].reason).toContain('3 件以上');
  });

  it('食い違いが多ければ、件数が足りていても候補どまりにする', async () => {
    await seedMemory({ hitCount: 3, disagreeCount: 3 });
    const [memory] = await listMemories();
    expect(memory.confidence).toBe(0.5);
    expect(memory.disposition).toBe('suggest');
  });

  it('他の利用者の決め事は出てこない', async () => {
    await seedMemory({ userId: 'someone-else', vendorKey: '他人の架空商店', hitCount: 9 });
    expect(await listMemories()).toEqual([]);
  });
});

describe('決め事の変更', () => {
  it('留めると、件数が足りなくても自動で当たるようになる', async () => {
    await seedMemory({ cls: 'biz', hitCount: 1 });

    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', { pinned: true });
    expect(response.status).toBe(200);
    const body = (await response.json()) as MemoryBody;
    expect(body.pinned).toBe(true);
    expect(body.disposition).toBe('auto-apply');
  });

  it('取り消すと、留めていても当たらなくなる', async () => {
    await seedMemory({ cls: 'biz', hitCount: 10, pinned: true });

    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', { revoked: true });
    expect(response.status).toBe(200);
    expect(((await response.json()) as MemoryBody).disposition).toBe('inactive');
    // 一覧からも自動適用として見えない
    expect((await listMemories())[0].disposition).toBe('inactive');
  });

  it('表記ゆれのキーでも同じ決め事に届く', async () => {
    await seedMemory({ cls: 'biz', hitCount: 3 });
    const response = await jsonRequest('/vendor-memory/架空 商店', 'PATCH', { owner: 'business' });
    expect(response.status).toBe(200);
    expect(((await response.json()) as MemoryBody).owner).toBe('business');
  });

  it('まだ無い取引先は、その場で決め事として作れる', async () => {
    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', {
      cls: 'biz',
      label: '架空商店',
      pinned: true,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as MemoryBody;
    expect(body.hitCount).toBe(0);
    // 実績0件でも、留めたなら当たる。留めなければ候補どまりのまま(D01)
    expect(body.disposition).toBe('auto-apply');
  });

  it('作ったばかりの決め事は、留めない限り自動では当たらない', async () => {
    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', { cls: 'biz' });
    expect(((await response.json()) as MemoryBody).disposition).toBe('suggest');
  });

  it('同じ名前でも、他の利用者の決め事には触れない', async () => {
    await seedMemory({ userId: 'someone-else', vendorKey: '架空商店', cls: 'biz', hitCount: 5 });

    expect((await jsonRequest('/vendor-memory/架空商店', 'PATCH', { revoked: true })).status).toBe(200);
    // 他人の行は1文字も動いていない
    const row = await d1
      .prepare('SELECT revoked, hit_count FROM vendor_memory WHERE user_id=?')
      .bind('someone-else')
      .first<{ revoked: number; hit_count: number }>();
    expect(row).toEqual({ revoked: 0, hit_count: 5 });
    // 自分側には別の行ができている
    const mine = await listMemories();
    expect(mine).toHaveLength(1);
    expect(mine[0].revoked).toBe(true);
  });

  it('候補にない科目は受け付けない', async () => {
    await importSeed();
    await seedMemory({ cls: 'per', hitCount: 3 });

    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', { big: '存在しない架空の科目' });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('invalid_category');
  });

  it('公私を決めずに科目だけを指定させない', async () => {
    await seedMemory({ hitCount: 3 });
    const response = await jsonRequest('/vendor-memory/架空商店', 'PATCH', { big: '架空費' });
    expect(response.status).toBe(400);
  });
});

describe('決め事の当て直し', () => {
  it('自動で当たる決め事を、手当ての無い明細だけに当てる', async () => {
    await importSeed();
    await seedMemory({ cls: 'biz', owner: 'business', hitCount: 5 });
    // tx-a は人が「個人」と決めている。決め事より人が強い(DR-6)
    await seedEdit('tx-a', { cls: 'per' });

    const response = await jsonRequest('/vendor-memory/架空商店/reapply', 'POST');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { matched: number; applied: number; withdrawn: number };
    expect(body.matched).toBe(3);
    expect(body.applied).toBe(2);
    expect(body.withdrawn).toBe(0);

    expect(await editedTxIds()).toEqual(['tx-a', 'tx-b', 'tx-c']);
    // 別の取引先(tx-z)は巻き込まれない
    const applied = await d1
      .prepare('SELECT cls, owner FROM tx_edits WHERE user_id=? AND tx_id=?')
      .bind('default', 'tx-b')
      .first<{ cls: string; owner: string }>();
    expect(applied).toEqual({ cls: 'biz', owner: 'business' });
    const kept = await d1
      .prepare('SELECT cls FROM tx_edits WHERE user_id=? AND tx_id=?')
      .bind('default', 'tx-a')
      .first<{ cls: string }>();
    expect(kept?.cls).toBe('per');
  });

  it('候補どまりの決め事は1件も当てない', async () => {
    await importSeed();
    await seedMemory({ cls: 'biz', owner: 'business', hitCount: 1 });

    const response = await jsonRequest('/vendor-memory/架空商店/reapply', 'POST');
    const body = (await response.json()) as { disposition: string; applied: number };
    expect(body.disposition).toBe('suggest');
    expect(body.applied).toBe(0);
    expect(await editedTxIds()).toEqual([]);
  });

  it('取り消したあとの当て直しは、過去に当てた手当てを外す', async () => {
    await importSeed();
    await seedMemory({ cls: 'biz', owner: 'business', hitCount: 5 });
    expect((await jsonRequest('/vendor-memory/架空商店/reapply', 'POST')).status).toBe(200);
    expect(await editedTxIds()).toEqual(['tx-a', 'tx-b', 'tx-c']);
    expect(
      await d1.prepare("SELECT DISTINCT origin,origin_key FROM tx_edits WHERE user_id='default'").first(),
    ).toEqual({ origin: 'vendor_memory', origin_key: '架空商店' });

    expect((await jsonRequest('/vendor-memory/架空商店', 'PATCH', { revoked: true })).status).toBe(200);
    const response = await jsonRequest('/vendor-memory/架空商店/reapply', 'POST');
    const body = (await response.json()) as { withdrawn: number; applied: number };
    expect(body.withdrawn).toBe(3);
    expect(body.applied).toBe(0);
    expect(await editedTxIds()).toEqual([]);
  });

  it('決め事と同じ値でも、手動の手当ては取り消さない(DR-6)', async () => {
    await importSeed();
    await seedMemory({ cls: 'biz', owner: 'business', hitCount: 5, revoked: true });
    await seedEdit('tx-a', { cls: 'biz', owner: 'business' }); // 同値でも由来は手動
    await seedEdit('tx-b', { cls: 'per' }); // 人が選んだ別の値

    const response = await jsonRequest('/vendor-memory/架空商店/reapply', 'POST');
    expect(((await response.json()) as { withdrawn: number }).withdrawn).toBe(0);
    expect(await editedTxIds()).toEqual(['tx-a', 'tx-b']);
  });

  it('他の利用者の決め事は当て直せない', async () => {
    await importSeed();
    await seedMemory({ userId: 'someone-else', vendorKey: '架空商店', cls: 'biz', hitCount: 9 });

    const response = await jsonRequest('/vendor-memory/架空商店/reapply', 'POST');
    expect(response.status).toBe(404);
    expect(await editedTxIds()).toEqual([]);
  });

  it('応答に明細の内容も金額も出さない(DR-9)', async () => {
    await importSeed();
    await seedMemory({ cls: 'biz', owner: 'business', hitCount: 5 });

    const text = await (await jsonRequest('/vendor-memory/架空商店/reapply', 'POST')).text();
    expect(text).not.toContain('tx-a');
    expect(text).not.toContain('1000');
    expect(text).not.toContain('架空口座');
    // 出るのは件数と扱いだけ
    expect(JSON.parse(text)).toMatchObject({ matched: 3, applied: 3, withdrawn: 0 });
  });
});
