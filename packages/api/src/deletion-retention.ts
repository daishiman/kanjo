/**
 * 保持期間を過ぎた退避行の夜間掃除(T15)。
 *
 * 削除の取り消しは、消す前の行を退避テーブルへ写しておくことで成り立っている(DR-2)。
 * その写しは明細そのものなので、置きっぱなしにすると本体と同じ量まで膨らむ。
 * D1 Free は 1 データベース 500MB が上限で、退避を無期限に持つと本体を圧迫する。
 *
 * そこで D7 のとおり二段構えにする。
 *   ・期限(30日)を過ぎたものを捨てる
 *   ・それでも退避が予算(300MB = 上限の60%)を超えていたら、古い世代から前倒しで捨てる
 * 先に到達した側で掃除が起きる。前倒しで捨てた世代は期限内でも取り消せなくなるので、
 * 画面がその事実を出せるよう、期限内metadataと退避payloadの実在を undo 可否の根拠にしてある。
 *
 * 設計の要点は3つ。
 *   1. 新しい Cron を作らず、既存の夜間 scheduledMaintenance へ相乗りする。
 *      起動経路が増えるほど「どれが動いていないか」が分からなくなる。
 *   2. 1回の実行で扱う操作数を上限で区切る。残りは翌晩へ持ち越す(D1 のクエリ本数上限)。
 *   3. 退避行・target・undo metadataを同じ世代単位で消す。
 *      長期の操作履歴は別層のaudit_logが400日保持する。
 *
 * 掃除済みの操作は退避行を持たないので、次の晩の対象集合から自然に外れる。
 * 掃除済みかどうかの旗を別に持たないのは、旗と実体がずれる余地を作らないため。
 */
import { expiredTombstoneCleanupStatements } from './deletion-lifecycle.js';

/** 1回の夜間実行で退避行を捨てる操作の上限。残りは翌晩が拾う */
export const DELETION_RETENTION_BATCH = 50;

/** 退避行に割り当てる容量の目安(D7: D1 単一データベース上限 500MB の 60%) */
export const DELETION_TOMBSTONE_BUDGET_BYTES = 300 * 1024 * 1024;

export type DeletionRetentionResult = {
  /** 退避物とともに捨てたundo metadataの件数 */
  metadata: number;
  /** 捨てた退避行の件数 */
  rows: number;
  /** 捨てた退避 target の件数 */
  targets: number;
  /** うち、容量のため期限前に捨てた操作の件数 */
  early: number;
  /** 掃除後に残っている退避行の概算バイト数 */
  bytes: number;
};

/** 期限切れのundo metadataを、退避の有無に依存せず有界で拾う。 */
const EXPIRED_UNDO_METADATA = `
  SELECT id FROM import_deletion_operations o
   WHERE o.expires_at <= ?
   ORDER BY o.expires_at
   LIMIT ?`;

/**
 * 期限内で退避行が残っている操作を、古い世代から順に、そのおおよその大きさ付きで拾う。
 * 大きさは payload_json の長さで測る。退避行の中身は数えるだけで読まない(DR-9)。
 */
const LIVING_TOMBSTONES_BY_AGE = `
  SELECT o.id AS id,
         (SELECT coalesce(sum(length(r.payload_json)), 0)
            FROM import_deleted_rows r WHERE r.operation_id = o.id) AS bytes
    FROM import_deletion_operations o
   WHERE o.expires_at > ?
     AND EXISTS (SELECT 1 FROM import_deleted_rows r WHERE r.operation_id = o.id)
   ORDER BY o.expires_at
   LIMIT ?`;

const TOMBSTONE_BYTES = 'SELECT coalesce(sum(length(payload_json)), 0) AS n FROM import_deleted_rows';

/** 指定した操作の退避行を捨て、捨てた件数を返す */
async function sweep(
  db: D1Database,
  ids: string[],
  includeMetadata: boolean,
): Promise<{ rows: number; targets: number }> {
  if (!ids.length) return { rows: 0, targets: 0 };
  // 件数はログに残す。中身は数えるだけで読まない(DR-9: 明細を掃除ジョブへ持ち出さない)
  const holes = ids.map(() => '?').join(',');
  const [rows, targets] = await db.batch<{ n: number }>([
    db.prepare(`SELECT count(*) AS n FROM import_deleted_rows WHERE operation_id IN (${holes})`).bind(...ids),
    db
      .prepare(`SELECT count(*) AS n FROM import_deleted_targets WHERE operation_id IN (${holes})`)
      .bind(...ids),
  ]);
  await db.batch(expiredTombstoneCleanupStatements(db, ids, includeMetadata));
  return { rows: rows.results?.[0]?.n ?? 0, targets: targets.results?.[0]?.n ?? 0 };
}

export async function runDeletionRetention(
  env: { DB: D1Database },
  now = new Date().toISOString(),
  limit = DELETION_RETENTION_BATCH,
  budgetBytes = DELETION_TOMBSTONE_BUDGET_BYTES,
): Promise<DeletionRetentionResult> {
  const db = env.DB;
  const expired = await db.prepare(EXPIRED_UNDO_METADATA).bind(now, limit).all<{ id: string }>();
  const expiredIds = (expired.results ?? []).map((row) => row.id);
  const swept = await sweep(db, expiredIds, true);

  // ここまでで予算に収まれば前倒しはしない。期限の来ていない退避を消すのは最後の手段である
  let bytes = ((await db.prepare(TOMBSTONE_BYTES).first<number>('n')) ?? 0) as number;
  const earlyIds: string[] = [];
  if (bytes > budgetBytes) {
    const living = await db
      .prepare(LIVING_TOMBSTONES_BY_AGE)
      .bind(now, limit)
      .all<{ id: string; bytes: number }>();
    // 予算に収まるところまで、古い世代から順に落とす。1晩で落としきれなければ翌晩が続ける
    for (const row of living.results ?? []) {
      if (bytes <= budgetBytes) break;
      earlyIds.push(row.id);
      bytes -= row.bytes;
    }
  }
  // 容量超過はundo payloadだけを前倒しで落とす。metadataは期限と理由の表示に30日まで使い、期限後に消す。
  const sweptEarly = await sweep(db, earlyIds, false);

  return {
    metadata: expiredIds.length,
    rows: swept.rows + sweptEarly.rows,
    targets: swept.targets + sweptEarly.targets,
    early: earlyIds.length,
    bytes,
  };
}
