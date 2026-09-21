/**
 * 明細の変更履歴 (tx_history) の書き手 (spec-classify-screen BR-15)。
 *
 * 履歴は「変わった項目ごとに 1 行」で、同じ要求で書いた行は同じ op_id を持つ。
 * 値が変わらない保存では 1 行も書かない。この『変わったか』の判定をここ 1 か所に置くのは、
 * 編集・一括保存・ルール適用・分割・削除が同じ規則で履歴を残すためである。
 */
import type { Cls, Owner, PaymentMethodOverride, TxEdit } from '@kanjo/core';
import { and, desc, eq } from 'drizzle-orm';
import * as s from './db/schema.js';
import { type Db, type DbBatchQuery, editWriteQueries } from './store.js';

export type HistoryField = (typeof s.txHistory.$inferSelect)['field'];
export type HistorySource = (typeof s.txHistory.$inferSelect)['source'];

export interface HistoryEntry {
  field: HistoryField;
  before: string | null;
  after: string | null;
  confidence?: number | null;
}

/** 由来の表示名。画面が辞書を持たずに済むよう api が付ける */
export const SOURCE_LABEL: Record<HistorySource, string> = {
  auto: '自動提案',
  manual: '手動',
  rule: 'ルール',
  bulk: '一括保存',
  split: '分割',
  delete: '削除',
  undo: '取消',
};

const CLS_LABEL: Record<Cls, string> = { biz: '事業', per: '家計' };
const OWNER_LABEL: Record<Owner, string> = { business: '事業', spouse: '配偶者', family: '家族' };
const METHOD_LABEL: Record<PaymentMethodOverride, string> = {
  cash: '現金',
  card: 'カード',
  account: '口座',
};

const clsText = (v: Cls | null | undefined): string | null => (v ? CLS_LABEL[v] : null);
const ownerText = (v: Owner | null | undefined): string | null => (v ? OWNER_LABEL[v] : null);
const methodText = (v: PaymentMethodOverride | null | undefined): string | null =>
  v ? METHOD_LABEL[v] : null;
/** カテゴリは大項目と中項目をひとつの表示値にまとめる (画面が並べ替えずに読めるように) */
const categoryText = (big: string | null | undefined, mid: string | null | undefined): string | null => {
  const text = [big || null, mid || null].filter((x): x is string => !!x).join(' / ');
  return text || null;
};

/**
 * 保存の前後を比べて、変わった項目だけの履歴を組み立てる。
 * 比較は表示値で行う。空文字と null を別物として扱うと、同じ保存を繰り返すたびに履歴が増える。
 */
export function historyEntries(before: TxEdit | undefined, after: TxEdit): HistoryEntry[] {
  const b = before ?? {};
  const pairs: HistoryEntry[] = [
    { field: 'cls', before: clsText(b.cls), after: clsText(after.cls) },
    {
      field: 'category',
      before: categoryText(b.big, b.mid),
      after: categoryText(after.big, after.mid),
    },
    { field: 'owner', before: ownerText(b.owner), after: ownerText(after.owner) },
    {
      field: 'payment_method',
      before: methodText(b.paymentMethod),
      after: methodText(after.paymentMethod),
    },
    { field: 'note', before: b.note || null, after: after.note || null },
  ];
  return pairs.filter((p) => p.before !== p.after);
}

/** 履歴で見る内訳行の形。行の同一性は lineId ではなく「中身」で判定する */
export interface SplitShape {
  lineId: string;
  seq: number;
  amount: number;
  cls: Cls;
  categoryMajor: string;
  categoryMid: string;
  owner?: Owner | null;
  memo?: string;
}

/** 内訳 1 行の表示値。金額は locale に依らせない (同じ保存が環境で別物に見えないように) */
const splitLineText = (line: SplitShape): string => {
  const head = [clsText(line.cls), categoryText(line.categoryMajor, line.categoryMid)]
    .filter((x): x is string => !!x)
    .join(' / ');
  return [`${head} ${line.amount}`, ownerText(line.owner), line.memo || null]
    .filter((x): x is string => !!x)
    .join(' ');
};

/**
 * 分割全体の表示値。行が無い状態は null にする。
 * null は「分割していない」であって「0 行に分割した」ではない。
 */
const splitText = (lines: readonly SplitShape[]): string | null => {
  if (lines.length === 0) return null;
  const body = [...lines]
    .sort((x, y) => x.seq - y.seq)
    .map(splitLineText)
    .join('、');
  return `${lines.length}行に分割 (${body})`;
};

/**
 * 分割の保存前後を比べて履歴を組み立てる (BR-15・spec-classify-screen §7.3)。
 *
 * 分割は「1 明細が何行になったか」が読み手の関心事なので、内訳 1 行ごとではなく
 * 親明細に対して 1 行だけ残す。ここも historyEntries と同じく、変わらなければ空を返す。
 */
export function splitHistoryEntries(
  before: readonly SplitShape[],
  after: readonly SplitShape[],
): HistoryEntry[] {
  const b = splitText(before);
  const a = splitText(after);
  // 表示値が同じなら中身も同じ。件数だけを見ると、金額の付け替えが履歴に残らない
  return b === a ? [] : [{ field: 'split', before: b, after: a }];
}

/** 履歴の行を書く文。entries が空なら 1 文も返さない (値が変わらない保存では書かない) */
export function historyWriteQueries(
  db: Db,
  userId: string,
  txId: string,
  entries: readonly HistoryEntry[],
  meta: { source: HistorySource; opId: string; changedAt: string; confidence?: number | null },
): DbBatchQuery[] {
  if (entries.length === 0) return [];
  return entries.map((entry, i) =>
    db.insert(s.txHistory).values({
      id: `${meta.opId}:${txId}:${entry.field}:${i}`,
      userId,
      txId,
      changedAt: meta.changedAt,
      field: entry.field,
      beforeValue: entry.before,
      afterValue: entry.after,
      source: meta.source,
      // 信頼度は自動提案の履歴にだけ意味がある (BR-15)
      confidence: meta.source === 'auto' ? (entry.confidence ?? meta.confidence ?? null) : null,
      opId: meta.opId,
    }),
  ) as unknown as DbBatchQuery[];
}

/** 表示用に整えた履歴。新しい順、同じ時刻は id の降順 */
export async function loadHistory(db: Db, userId: string, txId: string, limit: number) {
  const rows = await db
    .select()
    .from(s.txHistory)
    .where(and(eq(s.txHistory.userId, userId), eq(s.txHistory.txId, txId)))
    .orderBy(desc(s.txHistory.changedAt), desc(s.txHistory.id))
    .limit(limit);
  return rows.map((r) => ({
    changedAt: r.changedAt,
    field: r.field,
    before: r.beforeValue,
    after: r.afterValue,
    source: r.source,
    sourceLabel: SOURCE_LABEL[r.source],
    confidence: r.confidence,
    opId: r.opId,
  }));
}

/**
 * 1 明細ぶんの「編集の保存 + 履歴」の文の並び。
 * tx_edits と tx_history を同じ batch に載せられる形で返すことで、
 * 「保存はされたが履歴が残らない」中間状態を作らない (全部成功か、全部失敗か)。
 */
export function saveEditQueries(
  db: Db,
  userId: string,
  txId: string,
  params: {
    before: TxEdit | undefined;
    next: TxEdit;
    now: string;
    opId: string;
    source: HistorySource;
    confidence?: number | null;
    disagreeOriginKey?: string | null;
  },
): { queries: DbBatchQuery[]; entries: HistoryEntry[] } {
  const entries = historyEntries(params.before, params.next);
  return {
    queries: [
      ...editWriteQueries(db, userId, txId, params.next, {
        disagreeOriginKey: params.disagreeOriginKey ?? null,
        now: params.now,
      }),
      ...historyWriteQueries(db, userId, txId, entries, {
        source: params.source,
        opId: params.opId,
        changedAt: params.now,
        confidence: params.confidence ?? null,
      }),
    ],
    entries,
  };
}
