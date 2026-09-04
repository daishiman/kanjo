/**
 * 明細の分割記帳の API/D1 ライフサイクル回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空明細だけで検証する。
 *
 * 見張っているのは「保存できてしまう内訳の範囲」。
 * 合計の合わない内訳が1度でも入ると、以後の集計は元の明細と内訳の
 * どちらを数えるか決められず、二重計上か計上漏れになる。
 * だから合計検査はサーバ側にも置き、画面を通さない経路でも通さない。
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
let cookie: string;

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
    { ...auth, DB: d1 },
  );
}

/** 架空の引き落とし1件。分割の対象になる「中身の分からない10万円」 */
async function seedTx(txId = 'T1', amount = -100000): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO mf_transactions
         (user_id, tx_id, month, date, description, amount, category_major, category_mid, institution, identity_stable)
       VALUES ('default', ?, '2026-07', '07/01', '架空銀行 引き落とし', ?, '未分類', '', '架空銀行', 1)`,
    )
    .bind(txId, amount)
    .run();
}

/** 候補に無い科目は弾かれるので、テストで使う科目は先に候補へ入れておく */
async function addOption(scope: 'biz' | 'per', major: string, mid = ''): Promise<void> {
  const response = await jsonRequest('/category-options', 'POST', { scope, major, mid });
  expect(response.status).toBe(201);
}

const line = (amount: number, big: string, extra: Record<string, unknown> = {}) => ({
  amount,
  cls: 'per' as const,
  big,
  mid: '',
  ...extra,
});

const splitRows = async () =>
  (
    await d1
      .prepare('SELECT seq, amount, category_major FROM tx_splits WHERE user_id = ? ORDER BY seq')
      .bind('default')
      .all<{ seq: number; amount: number; category_major: string }>()
  ).results;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'split-lifecycle-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
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
    { ...auth, DB: d1 },
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);
  await seedTx();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('明細の分割記帳', () => {
  it('元の明細の金額を、内訳を入れる前の姿で返す', async () => {
    const response = await jsonRequest('/transactions/T1/splits');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number; lines: unknown[] };
    // 符号は落として絶対値。内訳は常に正の数で持つ
    expect(body.total).toBe(100000);
    expect(body.lines).toEqual([]);
  });

  it('合計が元の金額と合わない内訳は保存しない', async () => {
    await addOption('per', '食費');
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(30000, '食費'), line(20000, '食費')],
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('invalid_split');
    expect(await splitRows()).toEqual([]);
  });

  it('合計が合っていれば、並び番号を1から振って保存する', async () => {
    await addOption('per', '食費');
    await addOption('per', '日用品');
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(70000, '食費'), line(30000, '日用品')],
    });
    expect(response.status).toBe(200);
    expect(await splitRows()).toEqual([
      { seq: 1, amount: 70000, category_major: '食費' },
      { seq: 2, amount: 30000, category_major: '日用品' },
    ]);
  });

  it('保存し直すと、前の内訳は残らずまるごと入れ替わる', async () => {
    await addOption('per', '食費');
    await addOption('per', '日用品');
    await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(70000, '食費'), line(30000, '日用品')],
    });
    const saved = (await (await jsonRequest('/transactions/T1/splits')).json()) as {
      lines: Array<{ lineId: string }>;
    };
    await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [
        line(50000, '食費', { lineId: saved.lines[0].lineId }),
        line(50000, '食費', { lineId: saved.lines[1].lineId }),
      ],
    });
    // 以前の3万円行などが残る、という中途半端な状態を作らず親単位で置換する
    expect(await splitRows()).toEqual([
      { seq: 1, amount: 50000, category_major: '食費' },
      { seq: 2, amount: 50000, category_major: '食費' },
    ]);
  });

  it('空の内訳を送ると分割をやめ、元の1行に戻る', async () => {
    await addOption('per', '食費');
    await jsonRequest('/transactions/T1/splits', 'PUT', { lines: [line(100000, '食費')] });
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', { lines: [] });
    expect(response.status).toBe(200);
    expect(await splitRows()).toEqual([]);
  });

  it('候補に無い科目の内訳は保存しない', async () => {
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(100000, '架空の科目')],
    });
    expect(response.status).toBe(400);
    expect(await splitRows()).toEqual([]);
  });

  it('存在しない明細には内訳を付けられない', async () => {
    expect((await jsonRequest('/transactions/NOPE/splits')).status).toBe(404);
    expect((await jsonRequest('/transactions/NOPE/splits', 'PUT', { lines: [] })).status).toBe(404);
  });

  it('保存した内訳が、仕分けの明細一覧では元の1行に代わって並ぶ', async () => {
    await addOption('per', '食費');
    await addOption('per', '日用品');
    await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(70000, '食費', { memo: '米と野菜' }), line(30000, '日用品')],
    });
    const response = await jsonRequest('/transactions?month=2026-07');
    const body = (await response.json()) as {
      transactions: Array<{
        id: string;
        amount: number;
        big: string;
        rowKind: string;
        parentTxId: string | null;
        attachmentTargetId: string | null;
        capabilities: { quickClass: boolean; edit: boolean; split: boolean; attach: boolean };
      }>;
    };
    // 元の1行は消え、外部IDのsuffix解析ではなく構造化metadataを持つ内訳だけが並ぶ
    expect(body.transactions.map((t) => t.id)).toHaveLength(2);
    expect(body.transactions.map((t) => t.rowKind)).toEqual(['split', 'split']);
    expect(body.transactions.map((t) => t.parentTxId)).toEqual(['T1', 'T1']);
    expect(body.transactions.map((t) => t.attachmentTargetId)).toEqual(['T1', 'T1']);
    expect(body.transactions.every((t) => !t.capabilities.quickClass && !t.capabilities.edit)).toBe(true);
    // 支出の符号は元の明細から引き継ぐ。内訳側は正の数しか持っていない
    expect(body.transactions.map((t) => t.amount)).toEqual([-70000, -30000]);
    expect(body.transactions.map((t) => t.big)).toEqual(['食費', '日用品']);
  });

  it('安定IDの無い親は分割せず、再取込を案内する', async () => {
    await d1
      .prepare("UPDATE mf_transactions SET identity_stable=0 WHERE user_id='default' AND tx_id='T1'")
      .run();
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', { lines: [] });
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('unstable_identity');
  });

  it('派生した内訳行のquick/edit操作を拒否し、分割editorへ責務を集約する', async () => {
    await addOption('per', '食費');
    const saved = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(50000, '食費'), line(50000, '食費')],
    });
    const body = (await saved.json()) as { lines: Array<{ lineId: string }> };
    const derivedId = body.lines[0].lineId;
    expect((await jsonRequest(`/transactions/${derivedId}/class`, 'PUT', { cls: 'biz' })).status).toBe(409);
    expect((await jsonRequest(`/transactions/${derivedId}/edit`, 'PUT', { owner: 'spouse' })).status).toBe(
      409,
    );
    expect(await d1.prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE user_id='default'").first()).toEqual({
      n: 0,
    });
  });

  it('50行は1つのatomic batchで保存でき、51行は上限として拒否する', async () => {
    await addOption('per', '食費');
    const fifty = Array.from({ length: 50 }, () => line(2000, '食費'));
    expect((await jsonRequest('/transactions/T1/splits', 'PUT', { lines: fifty })).status).toBe(200);
    expect(await splitRows()).toHaveLength(50);
    expect(
      (await jsonRequest('/transactions/T1/splits', 'PUT', { lines: [...fifty, line(1, '食費')] })).status,
    ).toBe(400);
    expect(await splitRows()).toHaveLength(50);
  });
});

/**
 * 内訳1行ごとの名義。
 *
 * 妻と家族で分け合う引き落としは、これが無いと「分割して、さらに名義のために
 * もう一度別の手当てをする」という二重運用になり、片方だけ直した状態が普通に残る。
 * 未指定を「名義なし」に潰さないことが要。潰すと、親に付けた名義が内訳へ降りない。
 */
describe('内訳1行ごとの名義', () => {
  const ownerRows = async () =>
    (
      await d1
        .prepare('SELECT seq, owner FROM tx_splits WHERE user_id = ? ORDER BY seq')
        .bind('default')
        .all<{ seq: number; owner: string | null }>()
    ).results;

  const listOwners = async () => {
    const body = (await (await jsonRequest('/transactions?month=2026-07')).json()) as {
      transactions: { owner: string | null; ownerSrc: string }[];
    };
    return body.transactions.map((t) => t.owner);
  };

  it('行ごとに違う名義を保存し、読み出しでも返す', async () => {
    await addOption('per', '食費');
    await addOption('per', '日用品');
    const saved = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(60000, '食費', { owner: 'spouse' }), line(40000, '日用品', { owner: 'family' })],
    });
    expect(saved.status).toBe(200);
    expect(await ownerRows()).toEqual([
      { seq: 1, owner: 'spouse' },
      { seq: 2, owner: 'family' },
    ]);

    const body = (await (await jsonRequest('/transactions/T1/splits')).json()) as {
      lines: { owner: string | null }[];
    };
    expect(body.lines.map((l) => l.owner)).toEqual(['spouse', 'family']);
    expect(await listOwners()).toEqual(['spouse', 'family']);
  });

  it('名義を指定しない行は元の明細の名義に従う', async () => {
    await addOption('per', '食費');
    await addOption('per', '日用品');
    // 元の明細に手で名義を付けてから分割する
    expect((await jsonRequest('/transactions/T1/edit', 'PUT', { owner: 'business' })).status).toBe(200);
    expect(
      (
        await jsonRequest('/transactions/T1/splits', 'PUT', {
          lines: [line(60000, '食費'), line(40000, '日用品', { owner: 'family' })],
        })
      ).status,
    ).toBe(200);

    // 未指定は NULL で保存する。'unset' に潰すと、親の名義が降りてこない
    expect(await ownerRows()).toEqual([
      { seq: 1, owner: null },
      { seq: 2, owner: 'family' },
    ]);
    expect(await listOwners()).toEqual(['business', 'family']);
  });

  it('名義を外して保存し直すと、また元の明細の名義に戻る', async () => {
    await addOption('per', '食費');
    await jsonRequest('/transactions/T1/edit', 'PUT', { owner: 'business' });
    await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(60000, '食費', { owner: 'spouse' }), line(40000, '食費', { owner: 'spouse' })],
    });
    expect(await listOwners()).toEqual(['spouse', 'spouse']);

    await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(60000, '食費'), line(40000, '食費')],
    });
    expect(await ownerRows()).toEqual([
      { seq: 1, owner: null },
      { seq: 2, owner: null },
    ]);
    expect(await listOwners()).toEqual(['business', 'business']);
  });

  it('名義に無い値は保存しない', async () => {
    await addOption('per', '食費');
    const response = await jsonRequest('/transactions/T1/splits', 'PUT', {
      lines: [line(60000, '食費', { owner: '祖父' }), line(40000, '食費')],
    });
    expect(response.status).toBe(400);
    expect(await ownerRows()).toEqual([]);
  });
});
