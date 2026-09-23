/**
 * 論理削除した現金明細の夜間の完全消去(job `cash_soft_delete_purge`)。
 *
 * 画面の削除は `deleted_at` を入れるだけで、30日のあいだは同じ id のまま戻せる。
 * 30日を過ぎた行はここで物理的に消す。集計・一覧・バックアップは削除の時点で
 * すでに外しているので、ここで消しても数字は動かない。
 *
 * 1回の実行は D1 batch 1つ(2文)に収める。
 *   1. 消す明細を指す手動編集(tx_edits の `cash:<id>`)を消す
 *   2. 明細そのものを `deleted_at, id` の古い順に最大500行消す
 * 2文は同じ副問い合わせで対象を選ぶ。1文目を先に流すので、2文目で行が消えても
 * 1文目の対象はずれない。残りがあれば翌晩が拾う。
 */
import { CASH_LIMITS } from '@kanjo/core';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CashPurgeResult = {
  /** 完全に消した現金明細の行数 */
  deleted: number;
  /** 一緒に消した手動編集の行数 */
  edits: number;
  /** 1晩の削除上限件数に達した。残件の有無は追加queryを使わないため未確定 */
  limitReached: boolean;
};

/** `deleted_at` がこれより前の行を消す。ちょうど30日前の行は残す */
export const cashPurgeCutoff = (now: string, days: number = CASH_LIMITS.purgeDays): string =>
  new Date(Date.parse(now) - days * DAY_MS).toISOString();

const TARGET_SQL = `SELECT id, user_id FROM cash_entries
  WHERE deleted_at IS NOT NULL AND deleted_at < ?
  ORDER BY deleted_at, id LIMIT ?`;

export async function runCashSoftDeletePurge(
  env: { DB: D1Database },
  now = new Date().toISOString(),
  limit: number = CASH_LIMITS.purgeBatch,
): Promise<CashPurgeResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > CASH_LIMITS.purgeBatch)
    throw new Error('invalid_cash_purge_limit');
  const cutoff = cashPurgeCutoff(now);
  const [edits, rows] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM tx_edits WHERE EXISTS (
         SELECT 1 FROM (${TARGET_SQL}) t
          WHERE t.user_id = tx_edits.user_id AND tx_edits.tx_id = 'cash:' || t.id
       )`,
    ).bind(cutoff, limit),
    env.DB.prepare(`DELETE FROM cash_entries WHERE id IN (SELECT id FROM (${TARGET_SQL}))`).bind(
      cutoff,
      limit,
    ),
  ]);
  const deleted = Number(rows.meta.changes ?? 0);
  return { deleted, edits: Number(edits.meta.changes ?? 0), limitReached: deleted >= limit };
}

/**
 * 夜間ログの1行。利用者 id や明細の内容は載せない。
 * limitReached は「残件あり」ではなく「上限件数を削除した」の意味で、残件なしのちょうど500件でも true。
 * 残件確認の SELECT を足すと scheduled 全体が 50 queries になり安全余白を失うため、warn は可能性を表す。
 */
export const cashPurgeLogLine = (result: CashPurgeResult): Record<string, unknown> =>
  result.limitReached
    ? {
        level: 'warn',
        job: 'cash_soft_delete_purge',
        event: 'cash_soft_delete_purge',
        deleted: result.deleted,
        limitReached: true,
        remainingMayExist: true,
      }
    : {
        level: 'info',
        job: 'cash_soft_delete_purge',
        event: 'cash_soft_delete_purge',
        deleted: result.deleted,
      };
