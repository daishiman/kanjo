/**
 * 総収支の判断が「移行」と「復元」を跨いで保たれることの結合テスト (SYS-TCSCREEN-P08)。
 *
 * | 判定条件 | 内容 | テスト |
 * |---|---|---|
 * | FR-004 | 0042 以前の自由文の理由が、表示文はそのまま・集計語は `other` として読める | `移行` |
 * | FR-006 | 3表を持たない旧バックアップの復元は既存の行に触れず、持つ方はその時点へ戻す | `復元` |
 *
 * 移行は「0041 まで適用した実物の DB に旧形式の行を入れてから 0042 を当てる」形で確かめる。
 * 全部適用した後に列を NULL へ戻す作りだと、移行の UPDATE 自体を一度も通らずに緑になる。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freeeDealKeys } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';
import { getDb, loadBackupPayload } from '../src/store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

const migrationFilenames = readdirSync(migrationsDir)
  .filter((filename) => filename.endsWith('.sql'))
  .sort();

/** 移行番号の境目で区切って当てる。`only` に挙げた分だけを順に実行する */
async function applyMigrationFiles(db: D1Database, only: readonly string[]): Promise<void> {
  for (const filename of only) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
}

/** 0042 が「既存行」と見なすのは、これより前だけを当てた時点で入っていた行 */
const beforeExclusionReasonCode = migrationFilenames.filter((f) => f < '0042');
const fromExclusionReasonCode = migrationFilenames.filter((f) => f >= '0042');

const request = (path: string, init: RequestInit = {}) =>
  app.request(
    `/api${path}`,
    { ...init, headers: { cookie, ...(init.headers ?? {}) } },
    { ...auth, DB: d1, FILES: files },
  );

const postJson = (path: string, body: unknown) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** 画面が読む形。除外は表示文と集計語の両方を見る */
type CashflowBody = {
  freeeOnly: Array<{ freeeKey: string }>;
  excluded: Array<{ freeeKey: string; reason: string; reasonCode: string | null; memo: string | null }>;
};

const screen = async (): Promise<CashflowBody> =>
  (await (await request('/total-cashflow?from=2026-08&to=2026-08')).json()) as CashflowBody;

const countOf = async (
  table: 'duplicate_verdicts' | 'freee_deal_exclusions' | 'total_cashflow_operations',
): Promise<number> => {
  const row = await d1
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id='default'`)
    .first<{ n: number }>();
  return row?.n ?? 0;
};

/** 3表の件数をまとめて見る。1表ずつ書くと、どれかを閉じ忘れても緑になる */
const decisionCounts = async () => ({
  duplicateVerdicts: await countOf('duplicate_verdicts'),
  freeeDealExclusions: await countOf('freee_deal_exclusions'),
  totalCashflowOperations: await countOf('total_cashflow_operations'),
});

/** 3表だけを白紙へ戻す。取込済みの明細には触れない */
async function resetDecisions(): Promise<void> {
  for (const table of ['duplicate_verdicts', 'freee_deal_exclusions', 'total_cashflow_operations']) {
    await d1.prepare(`DELETE FROM ${table} WHERE user_id='default'`).run();
  }
}

/** 0042 より前の書き方で入った除外。理由は自由文だけで、集計語も memo も持たない */
const LEGACY_REASON = '口座間の振替なので数えない';

/**
 * 経費 1 件だけを置く。復元は 1 リクエストの問い合わせ数に上限があり (50 未満)、
 * 行を増やすと判断 3 表ぶんの書き込みが入った時点で 413 になる。
 * ここで見たいのは判断が保たれるかなので、明細は最小で足りる。
 */
const deals = [
  {
    month: '2026-08',
    date: '2026-08-05',
    io: 'expense' as const,
    partner: '架空クラウド',
    accountRaw: '通信費',
    accountNorm: 'サブスク・通信',
    amount: 3300,
  },
];

const legacyExcludedKey = freeeDealKeys(deals)[0] as string;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'total-cashflow-backup',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;

  // ここまでが「移行前の本番」。この時点で入った行が 0042 の対象になる
  await applyMigrationFiles(d1, beforeExclusionReasonCode);
  for (const deal of deals) {
    await d1
      .prepare(
        `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount)
         VALUES ('default',?,?,?,?,?,?,?)`,
      )
      .bind(deal.month, deal.date, deal.io, deal.partner, deal.accountRaw, deal.accountNorm, deal.amount)
      .run();
  }
  await d1
    .prepare(
      `INSERT INTO freee_deal_exclusions (user_id,freee_key,reason,created_at,updated_at)
       VALUES ('default',?,?, '2026-08-20T00:00:00.000Z','2026-08-20T00:00:00.000Z')`,
    )
    .bind(legacyExcludedKey, LEGACY_REASON)
    .run();

  await applyMigrationFiles(d1, fromExclusionReasonCode);
  await recordTestMigrationHead(d1, migrationFilenames);

  await d1
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES ('default','2026-08_1_-3300','2026-08','2026-08-07','架空クラウド',-3300,'事業経費','通信費',1,0,0)`,
    )
    .run();

  cookie = await loginForTest(app, { ...auth, DB: d1, FILES: files });
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('移行 0042 より前に保存された除外 (FR-004)', () => {
  it('自由文の理由はそのまま表示でき、集計語は other として読める', async () => {
    const excluded = (await screen()).excluded;
    // 鍵が食い違うと 0 件成功で緑になる。件数と中身を両方固定する
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({
      freeeKey: legacyExcludedKey,
      reason: LEGACY_REASON,
      reasonCode: 'other',
      memo: null,
    });
  });

  it('理由を推測して振り分けない。移行が付けた集計語は other だけ', async () => {
    const rows = await d1
      .prepare(`SELECT reason_code AS code FROM freee_deal_exclusions WHERE user_id='default'`)
      .all<{ code: string | null }>();
    expect(rows.results.map((row) => row.code)).toEqual(['other']);
  });
});

describe('復元 バックアップと総収支の判断 (FR-006)', () => {
  /**
   * 3表すべてに 1 行ずつ作る。判断を先に置いてから除外する順序は変えられない。
   * 先に除外すると、その明細は候補から外れて判断を保存できない。
   */
  async function decide(): Promise<void> {
    const saved = await postJson('/total-cashflow/verdicts', {
      txId: '2026-08_1_-3300',
      verdict: 'same',
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    // 除外は直接入れる。API を通すと履歴がもう 1 行増え、問い合わせ数の上限に当たる
    await d1
      .prepare(
        `INSERT INTO freee_deal_exclusions (user_id,freee_key,reason,reason_code,memo,created_at,updated_at)
         VALUES ('default',?,?, 'other', NULL, '2026-08-20T00:00:00.000Z','2026-08-20T00:00:00.000Z')`,
      )
      .bind(legacyExcludedKey, LEGACY_REASON)
      .run();
  }

  // 移行の describe が使う「0042 以前の行」もここで消える。宣言順に実行されるため、
  // 移行の確認が先に済んでいる
  beforeEach(resetDecisions);

  it('3表の key を持たない旧バックアップの復元は、既存の判断に触れない', async () => {
    await decide();
    const before = await decisionCounts();
    expect(before).toEqual({
      duplicateVerdicts: 1,
      freeeDealExclusions: 1,
      totalCashflowOperations: 1,
    });

    const payload = await loadBackupPayload(getDb(d1), 'default');
    // 差は 3 key の有無だけにする。別物を渡すと、消えなかった理由が key なのか中身なのか分からない
    // key ごと落とす。undefined を代入する書き方だと key は残り、
    // 「3 key を持たない旧バックアップ」という前提そのものが崩れる
    const {
      duplicateVerdicts: _dv,
      freeeDealExclusions: _fe,
      totalCashflowOperations: _op,
      ...legacyBackup
    } = payload;

    const restored = await postJson('/restore', legacyBackup);
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await decisionCounts()).toEqual(before);
  });

  it('3表を持つバックアップの復元は、判断をその時点へ戻す', async () => {
    await decide();
    const payload = await loadBackupPayload(getDb(d1), 'default');
    const snapshot = await decisionCounts();

    await resetDecisions();
    expect(await decisionCounts()).toEqual({
      duplicateVerdicts: 0,
      freeeDealExclusions: 0,
      totalCashflowOperations: 0,
    });

    const restored = await postJson('/restore', payload);
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await decisionCounts()).toEqual(snapshot);
    // 件数だけでは、別の理由で 1 行入っても気付けない。除外の中身まで戻ることを見る
    expect((await screen()).excluded[0]).toMatchObject({
      freeeKey: legacyExcludedKey,
      reason: LEGACY_REASON,
      reasonCode: 'other',
    });
  });
});
