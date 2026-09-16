/**
 * 総収支画面の「直前の操作を元に戻す」(BR-008)。
 *
 * 総収支の合計は保存せず、要求のたびに core で導出する (AD-002)。だから取り消すべきものは
 * 合計ではなく、利用者が下した判断の行だけになる。判断が戻れば合計は必ず一致する。
 *
 * 記録するのは操作「後」ではなく操作「前」の値である。後の値から逆算する作りだと、
 * 同じ明細に別の操作が挟まったときに、戻した結果が元の値と違うところへ着地する。
 */
import { type ExclusionReasonCode, STABLE_KEY_VERSION } from '@kanjo/core';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { D1_MAX_BOUND_PARAMS, inClauseChunkSize } from '../d1-limits.js';
import * as s from '../db/schema.js';
import type * as store from '../store.js';

/** drizzle の db handle。store 側の生成関数から型を取り、ここで作り直さない */
type Db = ReturnType<typeof store.getDb>;

/** 記録する操作の種類。'undo' は取消そのもので、取消の対象にはしない */
export type OperationKind = 'verdict' | 'exclude' | 'restore' | 'undo';

/** 判断1件ぶんの操作前の値。null は「その明細にまだ判断が無かった」 */
export interface VerdictBefore {
  verdict: 'same' | 'different';
  freeeKey: string | null;
  stableKey: string | null;
  fingerprintVersion: number | null;
  decidedAt: string | null;
}

export interface VerdictOpItem {
  txId: string;
  before: VerdictBefore | null;
}

/** 除外1件ぶんの操作前の値。null は「その鍵はまだ外されていなかった」 */
export interface ExclusionBefore {
  reason: string;
  reasonCode: ExclusionReasonCode | null;
  memo: string | null;
  createdAt: string | null;
}

export interface ExclusionOpItem {
  freeeKey: string;
  before: ExclusionBefore | null;
}

export type OperationItem = VerdictOpItem | ExclusionOpItem;

/** 画面に返す操作の要約。items_json の中身は画面に渡さない (DR-9: 明細を載せない) */
export interface OperationSummary {
  id: string;
  kind: OperationKind;
  itemCount: number;
  createdAt: string;
}

/** 取消の失敗理由。画面はこの code で「選択を残すか消すか」を決める */
export type UndoFailureCode = 'not_found' | 'already_undone' | 'not_undoable' | 'stale_operation';

export class UndoRejected extends Error {
  constructor(readonly code: UndoFailureCode) {
    super(code);
    this.name = 'UndoRejected';
  }
}

/** 判断行の列数 (user_id / tx_id / verdict / stable_key / fingerprint_version / freee_key / decided_at / updated_at) */
const VERDICT_COLUMNS = 8;
/** 除外行の列数 (user_id / freee_key / reason / reason_code / memo / created_at / updated_at) */
const EXCLUSION_COLUMNS = 7;

const rowsPerStatement = (columns: number): number => Math.floor(D1_MAX_BOUND_PARAMS / columns);

/** 配列を1文に載る大きさへ割る。件数が増えた日にだけ落ちる書き方を避ける */
function chunk<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < rows.length; at += size) out.push(rows.slice(at, at + size));
  return out;
}

/* ============================ 記録 ============================ */

/**
 * 操作を1行として記録し、その id を返す。対象が0件なら記録せず null を返す。
 *
 * 0件の操作を残さないのは、「元に戻す」が何も起きない操作を指してしまうため。
 * 押しても何も変わらないボタンは、壊れていないことを利用者に示せない。
 */
export async function recordOperation(
  db: Db,
  userId: string,
  kind: OperationKind,
  items: readonly OperationItem[],
  undoesId: string | null = null,
): Promise<string | null> {
  if (items.length === 0) return null;
  const id = crypto.randomUUID();
  await db.insert(s.totalCashflowOperations).values({
    id,
    userId,
    kind,
    itemsJson: JSON.stringify(items),
    itemCount: items.length,
    undoesId,
    undoneAt: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/**
 * いま取り消せる操作。未取消で、かつ取消そのものではない最新の1件。
 *
 * 取消行を対象から外すのは redo を持たないため (AD-004)。取消を取り消せると、
 * 画面のボタン1つが「戻す」と「やり直す」を状況で切り替えることになり、
 * 押す前に何が起きるかが読めなくなる。
 */
export async function latestUndoable(db: Db, userId: string): Promise<OperationSummary | null> {
  const rows = await db
    .select()
    .from(s.totalCashflowOperations)
    .where(
      and(
        eq(s.totalCashflowOperations.userId, userId),
        isNull(s.totalCashflowOperations.undoneAt),
        ne(s.totalCashflowOperations.kind, 'undo'),
      ),
    )
    // 同じミリ秒に 2 行入ったときも順序を一意にする。id を第二鍵に置かないと、
    // どちらが「直前」かが実行ごとに変わり、取消の対象が揺れる
    .orderBy(desc(s.totalCashflowOperations.createdAt), desc(s.totalCashflowOperations.id))
    .limit(1);
  const row = rows[0];
  return row ? { id: row.id, kind: row.kind, itemCount: row.itemCount, createdAt: row.createdAt } : null;
}

/* ============================ 取消 ============================ */

/**
 * 操作を1つ元に戻す。
 *
 * 判定の順序を「存在 → 取消済み → 取消行 → 最新か」の4段に分けてあるのは、
 * 画面に出す言葉が段ごとに違うからである。とくに「最新でない」は利用者の操作が
 * 別の更新と競合した合図で、再読込を促す必要がある。ひとまとめに 409 を返すと、
 * 何を直せば通るのかを画面が説明できない。
 */
export async function undoOperation(db: Db, userId: string, operationId: string): Promise<OperationSummary> {
  const rows = await db
    .select()
    .from(s.totalCashflowOperations)
    .where(and(eq(s.totalCashflowOperations.id, operationId), eq(s.totalCashflowOperations.userId, userId)));
  const op = rows[0];
  if (!op) throw new UndoRejected('not_found');
  if (op.undoneAt) throw new UndoRejected('already_undone');
  if (op.kind === 'undo') throw new UndoRejected('not_undoable');

  const latest = await latestUndoable(db, userId);
  if (!latest || latest.id !== op.id) throw new UndoRejected('stale_operation');

  const items = JSON.parse(op.itemsJson) as OperationItem[];
  if (op.kind === 'verdict') await restoreVerdicts(db, userId, items as VerdictOpItem[]);
  else await restoreExclusions(db, userId, items as ExclusionOpItem[]);

  const now = new Date().toISOString();
  await db
    .update(s.totalCashflowOperations)
    .set({ undoneAt: now })
    .where(and(eq(s.totalCashflowOperations.id, op.id), eq(s.totalCashflowOperations.userId, userId)));

  // 取消も1行として残す。履歴から消す作りだと「なぜ値が戻ったか」が後から読めない
  const undoId = await recordOperation(db, userId, 'undo', items, op.id);
  return {
    id: undoId ?? op.id,
    kind: 'undo',
    itemCount: items.length,
    createdAt: now,
  };
}

/** 操作前に判断が無かった行は消し、あった行はその値へ戻す */
async function restoreVerdicts(db: Db, userId: string, items: readonly VerdictOpItem[]): Promise<void> {
  const remove = items.filter((i) => i.before === null).map((i) => i.txId);
  const now = new Date().toISOString();
  const revert = items
    .filter((i): i is VerdictOpItem & { before: VerdictBefore } => i.before !== null)
    .map((i) => ({
      userId,
      txId: i.txId,
      verdict: i.before.verdict,
      stableKey: i.before.stableKey,
      fingerprintVersion: i.before.fingerprintVersion ?? STABLE_KEY_VERSION,
      freeeKey: i.before.freeeKey,
      decidedAt: i.before.decidedAt,
      updatedAt: now,
    }));

  for (const part of chunk(remove, inClauseChunkSize(1))) {
    await db
      .delete(s.duplicateVerdicts)
      .where(and(eq(s.duplicateVerdicts.userId, userId), inArray(s.duplicateVerdicts.txId, part)));
  }
  for (const part of chunk(revert, rowsPerStatement(VERDICT_COLUMNS))) {
    await db
      .insert(s.duplicateVerdicts)
      .values(part)
      .onConflictDoUpdate({
        target: [s.duplicateVerdicts.userId, s.duplicateVerdicts.txId],
        set: {
          verdict: sql`excluded.verdict`,
          stableKey: sql`excluded.stable_key`,
          fingerprintVersion: sql`excluded.fingerprint_version`,
          freeeKey: sql`excluded.freee_key`,
          decidedAt: sql`excluded.decided_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

/** 操作前に外されていなかった鍵は戻し、外されていた鍵はその理由へ戻す */
async function restoreExclusions(db: Db, userId: string, items: readonly ExclusionOpItem[]): Promise<void> {
  const remove = items.filter((i) => i.before === null).map((i) => i.freeeKey);
  const now = new Date().toISOString();
  const revert = items
    .filter((i): i is ExclusionOpItem & { before: ExclusionBefore } => i.before !== null)
    .map((i) => ({
      userId,
      freeeKey: i.freeeKey,
      reason: i.before.reason,
      reasonCode: i.before.reasonCode,
      memo: i.before.memo,
      createdAt: i.before.createdAt ?? now,
      updatedAt: now,
    }));

  for (const part of chunk(remove, inClauseChunkSize(1))) {
    await db
      .delete(s.freeeDealExclusions)
      .where(and(eq(s.freeeDealExclusions.userId, userId), inArray(s.freeeDealExclusions.freeeKey, part)));
  }
  for (const part of chunk(revert, rowsPerStatement(EXCLUSION_COLUMNS))) {
    await db
      .insert(s.freeeDealExclusions)
      .values(part)
      .onConflictDoUpdate({
        target: [s.freeeDealExclusions.userId, s.freeeDealExclusions.freeeKey],
        set: {
          reason: sql`excluded.reason`,
          reasonCode: sql`excluded.reason_code`,
          memo: sql`excluded.memo`,
          // createdAt は操作前の値へ戻す。「いつ外したか」は取消で変わらない
          createdAt: sql`excluded.created_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}
