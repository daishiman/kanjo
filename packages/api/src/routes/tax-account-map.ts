/**
 * 勘定科目の対応表 (spec-classify-bulk-save FR-17・BR-09・AC-16・AC-25)。
 *
 * MF の大項目 → 確定申告の勘定科目の対応を、利用者ごとに 1 行ずつ読み出し・追加・削除する。
 * 事業の明細の提案『MF の分類 (対応表)』が読む (routes/analytics.ts の suggestionContext)。
 * 行の検査は core の taxAccountMapRowIssue が決め、ここは D1 の読み書きと変更履歴だけを担う。
 *
 * - 追加と削除は、対応表の行・設定の変更履歴・JSON snapshot の無効化を 1 回の batch で書く (全件か無し)。
 *   取込や別の更新との直列化は canonicalMutationFence が受け持つ (409 canonical_write_busy もそこが返す)
 * - 変更履歴の changed_at は settingsChangedAt で revision より必ず後にする。設定画面の
 *   revision (baseSavedAt) が進み、対応表を変えた後に古い画面から保存すると 409 で止まる
 * - 他の利用者の行は見つからない扱い (404) で、存在を明かさない
 * - 保存済みの明細の値は変えない (提案は読み出しのたびに対応表から算出する)
 */
import {
  TAX_ACCOUNT_MAP_ROWS_MAX,
  type TaxAccountMapRow,
  compareTaxAccountMapRows,
  settingsActorFromEmail,
  taxAccountMapRowIssue,
} from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { invalidateJsonSnapshotStatement } from '../import-active.js';
import { settingsChangeLogStatements, settingsChangedAt } from '../import-lifecycle.js';
import {
  INVALID_PUBLIC_REQUEST,
  PRIVATE_NO_STORE,
  errorBody,
  publicJsonValidator,
} from '../public-validation.js';
import { settingsBodyLimit } from './settings-screen.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const taxAccountMapRoute = new Hono<Ctx>();

const DUPLICATE = errorBody('duplicate_category', 'この大項目はすでに対応表にあります');
const TOO_MANY = errorBody('too_many_rows', `対応表は ${TAX_ACCOUNT_MAP_ROWS_MAX} 行までです`);
const NOT_FOUND = errorBody('not_found', '対応表の行が見つかりません');

const SELECT_ROWS_SQL =
  'SELECT category_big, tax_account FROM tax_account_map WHERE user_id=? ORDER BY category_big';

interface MapDbRow {
  category_big: string;
  tax_account: string;
}

const rowsOf = (results: readonly unknown[]): TaxAccountMapRow[] =>
  (results as MapDbRow[])
    .map((r) => ({ categoryBig: r.category_big, taxAccount: r.tax_account }))
    .sort(compareTaxAccountMapRows);

/** 変更履歴の before・after。設定 JSON・設定画面の差分と同じ {categoryBig, taxAccount} の形 */
const mapValue = (r: TaxAccountMapRow): string =>
  JSON.stringify({ categoryBig: r.categoryBig, taxAccount: r.taxAccount });

/** 書き込みの前提: 今の行と、設定の revision (変更履歴の最新時刻) を 1 回の batch で読む */
async function loadForWrite(
  database: D1Database,
  userId: string,
): Promise<{ rows: TaxAccountMapRow[]; revision: string | null }> {
  const [rows, revision] = await database.batch<unknown>([
    database.prepare(SELECT_ROWS_SQL).bind(userId),
    database
      .prepare('SELECT MAX(changed_at) AS revision FROM settings_change_log WHERE user_id=?')
      .bind(userId),
  ]);
  return {
    rows: rowsOf(rows.results),
    revision: (revision.results[0] as { revision: string | null } | undefined)?.revision ?? null,
  };
}

const isUniqueViolation = (error: unknown): boolean =>
  /UNIQUE constraint failed|PRIMARY KEY/i.test(error instanceof Error ? error.message : String(error));

/* -------- GET /api/settings/tax-account-map -------- */

taxAccountMapRoute.get('/settings/tax-account-map', async (c) => {
  const result = await c.env.DB.prepare(SELECT_ROWS_SQL).bind(c.get('userId')).all();
  return c.json({ rows: rowsOf(result.results) }, 200, PRIVATE_NO_STORE);
});

/* -------- POST /api/settings/tax-account-map (1 行の追加) -------- */

// 本文は小さい 1 行だけ。大きな本文は読む前に 413 で止める
taxAccountMapRoute.use(
  '/settings/tax-account-map',
  settingsBodyLimit(16 * 1024, '保存する内容が大きすぎます。'),
);

const addSchema = z.object({ categoryBig: z.unknown(), taxAccount: z.unknown() }).strict();

taxAccountMapRoute.post('/settings/tax-account-map', publicJsonValidator(addSchema), async (c) => {
  const body = c.req.valid('json');
  // z.unknown() の欄は省略可能と推論される。欠けた欄は undefined のまま検査へ渡し invalid_type にする
  const issue = taxAccountMapRowIssue({ categoryBig: body.categoryBig, taxAccount: body.taxAccount });
  if (issue)
    return c.json(
      errorBody(INVALID_PUBLIC_REQUEST.error.code, INVALID_PUBLIC_REQUEST.error.message, { fields: issue }),
      400,
      PRIVATE_NO_STORE,
    );
  const row: TaxAccountMapRow = {
    categoryBig: (body.categoryBig as string).trim(),
    taxAccount: body.taxAccount as string,
  };

  const database = c.env.DB;
  const userId = c.get('userId');
  const current = await loadForWrite(database, userId);
  if (current.rows.some((r) => r.categoryBig === row.categoryBig))
    return c.json(DUPLICATE, 400, PRIVATE_NO_STORE);
  // 上限は decisions §4。設定 JSON の復元 (validateSettingsInput の too_many) と同じ数で止める
  if (current.rows.length >= TAX_ACCOUNT_MAP_ROWS_MAX) return c.json(TOO_MANY, 400, PRIVATE_NO_STORE);

  const changedAt = settingsChangedAt(new Date().toISOString(), current.revision);
  let results: D1Result<unknown>[];
  try {
    results = await database.batch<unknown>([
      database
        .prepare(
          `INSERT INTO tax_account_map (user_id, category_big, tax_account, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(userId, row.categoryBig, row.taxAccount, changedAt, changedAt),
      ...settingsChangeLogStatements(
        database,
        userId,
        [['tax_account_map', row.categoryBig, null, mapValue(row)]],
        { changedAt, changedBy: settingsActorFromEmail(c.get('actor').email), origin: 'screen' },
      ),
      invalidateJsonSnapshotStatement(database, userId, 'tax_account_map'),
      database.prepare(SELECT_ROWS_SQL).bind(userId),
    ]);
  } catch (error) {
    // 事前の検査とフェンスで普段は来ない。主キーが最後の砦として二重の行を拒んだ場合も同じ 400 にする
    if (isUniqueViolation(error)) return c.json(DUPLICATE, 400, PRIVATE_NO_STORE);
    throw error;
  }
  return c.json({ rows: rowsOf(results.at(-1)?.results ?? []) }, 200, PRIVATE_NO_STORE);
});

/* -------- DELETE /api/settings/tax-account-map/:categoryBig (1 行の削除) -------- */

taxAccountMapRoute.delete('/settings/tax-account-map/:categoryBig', async (c) => {
  // 行の識別子は大項目そのもの (URL エンコード)。Hono が param を decodeURIComponent して渡す
  const categoryBig = c.req.param('categoryBig');
  const database = c.env.DB;
  const userId = c.get('userId');
  const current = await loadForWrite(database, userId);
  const target = current.rows.find((r) => r.categoryBig === categoryBig);
  // 他の利用者の行は user_id で引けないので、無い行と同じ 404 になる (AC-25)
  if (!target) return c.json(NOT_FOUND, 404, PRIVATE_NO_STORE);

  const changedAt = settingsChangedAt(new Date().toISOString(), current.revision);
  const results = await database.batch<unknown>([
    database
      .prepare('DELETE FROM tax_account_map WHERE user_id=? AND category_big=?')
      .bind(userId, target.categoryBig),
    ...settingsChangeLogStatements(
      database,
      userId,
      [['tax_account_map', target.categoryBig, mapValue(target), null]],
      { changedAt, changedBy: settingsActorFromEmail(c.get('actor').email), origin: 'screen' },
    ),
    invalidateJsonSnapshotStatement(database, userId, 'tax_account_map'),
    database.prepare(SELECT_ROWS_SQL).bind(userId),
  ]);
  return c.json({ rows: rowsOf(results.at(-1)?.results ?? []) }, 200, PRIVATE_NO_STORE);
});
