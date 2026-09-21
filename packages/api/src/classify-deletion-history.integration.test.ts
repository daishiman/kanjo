/**
 * 削除と取消の変更履歴 (spec-classify-screen FR-16・BR-15・AT-15) の API/D1 回帰。
 *
 * 削除は deletion-lifecycle が期間・全件とまとめて扱う汎用の経路で、
 * 明細 1 件ずつの履歴を残す場所を持っていなかった。
 * ここで固定するのは「明細を名指しで消した経路だけが deleted の履歴を 1 件残す」ことと、
 * 「取消が同じ明細へ undo の履歴を返す」ことの 2 つである。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

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

const env = () => ({ ...auth, DB: database });
const post = (path: string, body: unknown) =>
  app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    },
    env(),
  );

interface HistoryRow {
  tx_id: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  source: string;
  op_id: string;
}

const historyOf = async (source: string): Promise<HistoryRow[]> => {
  const rows = await database
    .prepare(
      `SELECT tx_id, field, before_value, after_value, source, op_id
         FROM tx_history WHERE user_id='default' AND source=? ORDER BY tx_id`,
    )
    .bind(source)
    .all<HistoryRow>();
  return rows.results;
};

/** 消す前に必ず preflight を通す。指紋を持たない削除は 400 で弾かれる */
const deleteTransactions = async (txIds: string[]) => {
  const preflight = await post('/data/deletions/preflight', { granularity: 'transaction', txIds });
  expect(preflight.status).toBe(200);
  const { fingerprint } = (await preflight.json()) as { fingerprint: string };
  const response = await post('/data/deletions', { granularity: 'transaction', txIds, fingerprint });
  expect(response.status).toBe(200);
  return (await response.json()) as { operationId: string };
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-deletion-history',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  await database.batch([
    database.prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES
        ('default','tx-del-a','2026-08','2026-08-05','架空クラウド',-3300,'事業経費','通信費',1,0,1),
        ('default','tx-del-b','2026-08','2026-08-06','架空カフェ',-560,'食費','カフェ',1,0,1),
        ('default','tx-period','2026-07','2026-07-06','架空書店',-1800,'教養・教育','書籍',1,0,1)`,
    ),
  ]);
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('削除と取消の履歴 (FR-16・BR-15)', () => {
  it('明細を名指しで消すと deleted の履歴が 1 明細 1 件ずつ残り、取消が同じ明細へ undo を返す', async () => {
    const { operationId } = await deleteTransactions(['tx-del-a', 'tx-del-b']);

    // 消した明細ぶんだけ。多すぎても少なすぎても、あとで「何が消えたか」を辿れない
    const deleted = await historyOf('delete');
    expect(deleted).toHaveLength(2);
    expect(deleted.map((r) => r.tx_id)).toEqual(['tx-del-a', 'tx-del-b']);
    for (const row of deleted) {
      // 項目・由来・操作 id の三点が揃っていて初めて、画面が 1 つの削除としてまとめられる
      expect(row.field).toBe('deleted');
      expect(row.source).toBe('delete');
      expect(row.op_id).toBe(operationId);
      expect(row.before_value).toBe(null);
      expect(row.after_value).toBe('削除');
    }

    const undoResponse = await post(`/data/undo/${operationId}`, {});
    expect(undoResponse.status).toBe(200);
    const undone = (await undoResponse.json()) as { operationId: string };

    const restored = await historyOf('undo');
    expect(restored).toHaveLength(2);
    expect(restored.map((r) => r.tx_id)).toEqual(['tx-del-a', 'tx-del-b']);
    for (const row of restored) {
      expect(row.field).toBe('deleted');
      // 取消は削除を打ち消す。before に「削除」を置いて after を空にする
      expect(row.before_value).toBe('削除');
      expect(row.after_value).toBe(null);
      // 取消は別の操作。削除と同じ op_id にすると 2 つの出来事が 1 つに潰れる
      expect(row.op_id).toBe(undone.operationId);
      expect(row.op_id).not.toBe(operationId);
    }
  });

  it('期間の削除は明細の履歴を増やさない。1 明細の出来事ではないため', async () => {
    const before = (await historyOf('delete')).length;
    const preflight = await post('/data/deletions/preflight', {
      granularity: 'period',
      period: { from: '2026-07', to: '2026-07' },
    });
    expect(preflight.status).toBe(200);
    const { fingerprint } = (await preflight.json()) as { fingerprint: string };
    const response = await post('/data/deletions', {
      granularity: 'period',
      period: { from: '2026-07', to: '2026-07' },
      fingerprint,
    });
    expect(response.status).toBe(200);
    expect((await historyOf('delete')).length).toBe(before);
  });
});
