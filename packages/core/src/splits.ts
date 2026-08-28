/**
 * 明細の分割記帳。
 *
 * 銀行から10万円が引き落とされている、という事実だけは明細に載っている。
 * けれど中身が現金払いだと、何にいくら使ったかは明細のどこにも書いていない。
 * そこで「10万円のうち食品に3万、交通費に2万、残りは日用品」と後から割る。
 *
 * ここで一番大事なのは、割った合計が元の金額とぴったり一致すること。
 * ずれた瞬間に、元の明細と内訳のどちらを信じるかが決まらなくなり、
 * 集計が二重計上か計上漏れのどちらかになる。
 * 端数が出ても必ず合わせる(切り捨てて放置しない)のはそのため。
 *
 * このファイルはDBに触れない。保存先の形が決まる前でも、割り方だけは確定できる。
 */
import {
  type Cls,
  type Dataset,
  MAX_SPLIT_LINES,
  MIN_SPLIT_LINES,
  type MfTx,
  SPLIT_MEMO_MAX_LENGTH,
  type SplitLine,
  TX_SPLITS_SNAPSHOT_VERSION,
  type TxSplit,
} from './types.js';

export type { SplitLine, TxSplit } from './types.js';

/** 分割の1行。金額で確定したもの */
/** 割合で入れるときの1行。金額に直してから SplitLine になる */
export interface RatioLine {
  cls: Cls;
  categoryMajor: string;
  categoryMid: string;
  /**
   * 割合。合計が100でなくてもよく、比として扱う。
   * 「6と4」でも「60と40」でも同じ結果になる(入力の手間を減らすため)。
   */
  ratio: number;
  memo?: string;
}

/** 分割が使えない理由。画面ではそのまま出す */
export interface SplitIssue {
  /** 行を特定できるものは行番号。全体の問題は null */
  index: number | null;
  message: string;
}

/**
 * 割合を金額に直す。合計は必ず total と一致する。
 *
 * 比として正規化するので、割合の合計が100でなくても通る。
 * 「60%と30%しか入れていない」を弾くのは validateSplits ではなく画面側の役目
 * (入力の途中で赤くすると、打ち終わる前に手が止まる)。
 */
export function splitByRatio(total: number, lines: RatioLine[]): SplitLine[] {
  const sum = lines.reduce((s, l) => s + l.ratio, 0);
  if (lines.length === 0 || sum <= 0) return [];

  // まず割り切れるところまで配り、端数は後で寄せる
  const raw = lines.map((l) => (total * l.ratio) / sum);
  const floors = raw.map((v) => Math.floor(v));
  const remainder = total - floors.reduce((s, v) => s + v, 0);

  const amounts = distributeRemainder(floors, raw, remainder);

  return lines.map((l, i) => ({
    cls: l.cls,
    categoryMajor: l.categoryMajor,
    categoryMid: l.categoryMid,
    amount: amounts[i],
    ...(l.memo ? { memo: l.memo } : {}),
  }));
}

/**
 * 切り捨てで余った端数(remainder 円)を、各行に1円ずつ足して合計を合わせる。
 *
 * @param floors    切り捨て後の金額。この配列を書き換えず、新しい配列を返す
 * @param raw       切り捨て前の正確な金額(小数)。どこに寄せるかの判断材料
 * @param remainder 配り切れずに余った円。0以上で、行数より小さい
 * @returns 合計が floors の合計 + remainder になる金額の配列
 */
function distributeRemainder(floors: number[], raw: number[], remainder: number): number[] {
  const out = [...floors];
  if (remainder <= 0) return out;

  // 切り捨てで一番損をした行から1円ずつ返す(最大剰余法)。
  // 「一番大きい行に全部寄せる」にしないのは、割合を入れ直したときに
  // 端数の行き先が飛ぶと、金額が動いた理由が読めなくなるため。
  // 小数部が同じときは行番号の小さい順。同じ入力なら必ず同じ結果になる。
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let n = 0; n < remainder; n++) out[order[n].i] += 1;
  return out;
}

/**
 * 分割として成り立っているかを確かめる。
 * 保存の直前に呼ぶ。ここを通ったものだけがDBに入る。
 */
export function validateSplits(total: number, lines: SplitLine[]): SplitIssue[] {
  const issues: SplitIssue[] = [];
  if (lines.length === 0) return [{ index: null, message: '分割の行がありません。' }];
  if (lines.length < MIN_SPLIT_LINES)
    issues.push({ index: null, message: `内訳は${MIN_SPLIT_LINES}行以上に分けてください。` });
  if (lines.length > MAX_SPLIT_LINES)
    issues.push({ index: null, message: `内訳は${MAX_SPLIT_LINES}行までです。` });

  lines.forEach((l, i) => {
    if (!Number.isInteger(l.amount) || l.amount <= 0)
      issues.push({ index: i, message: '金額は1円以上の整数で入れてください。' });
    if (!l.categoryMajor)
      issues.push({ index: i, message: '分類を選んでください(未選択のままでは集計に入りません)。' });
    if ((l.memo?.length ?? 0) > SPLIT_MEMO_MAX_LENGTH)
      issues.push({ index: i, message: `メモは${SPLIT_MEMO_MAX_LENGTH}文字までです。` });
  });

  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== total) {
    const diff = total - sum;
    issues.push({
      index: null,
      message:
        diff > 0
          ? `${diff.toLocaleString()}円が振り分けられていません。`
          : `${(-diff).toLocaleString()}円はみ出しています。`,
    });
  }
  return issues;
}

/* ------------------------- 集計への反映 ------------------------- */

/** Web Crypto randomUUID と同じcanonical spellingだけを受理する。 */
export const isSplitLineId = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** JSON snapshotのcanonical envelope。表示用Datasetとは別に子行を保持する。 */
export const txSplitsSnapshot = (rows: readonly TxSplit[]) => ({
  version: TX_SPLITS_SNAPSHOT_VERSION,
  rows: [...rows]
    .map((row) => ({ ...row }))
    .sort((a, b) => a.txId.localeCompare(b.txId) || a.seq - b.seq || a.lineId.localeCompare(b.lineId)),
});

export class TxSplitsSnapshotError extends Error {
  constructor() {
    super('invalid_tx_splits_snapshot');
    this.name = 'TxSplitsSnapshotError';
  }
}

/** 旧snapshotは空のcanonical集合として扱い、復元先の現在値を残さない。 */
export function txSplitsFromSnapshot(value: unknown): TxSplit[] {
  if (value === undefined) return [];
  if (!value || typeof value !== 'object') throw new TxSplitsSnapshotError();
  const envelope = value as { version?: unknown; rows?: unknown };
  if (envelope.version !== TX_SPLITS_SNAPSHOT_VERSION || !Array.isArray(envelope.rows)) {
    throw new TxSplitsSnapshotError();
  }
  const rows: TxSplit[] = [];
  const lineIds = new Set<string>();
  const positions = new Set<string>();
  for (const candidate of envelope.rows) {
    if (!candidate || typeof candidate !== 'object') throw new TxSplitsSnapshotError();
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.txId !== 'string' ||
      typeof row.lineId !== 'string' ||
      !isSplitLineId(row.lineId) ||
      !Number.isInteger(row.seq) ||
      Number(row.seq) <= 0 ||
      !Number.isInteger(row.parentAmount) ||
      Number(row.parentAmount) <= 0 ||
      !Number.isInteger(row.amount) ||
      Number(row.amount) <= 0 ||
      (row.cls !== 'biz' && row.cls !== 'per') ||
      typeof row.categoryMajor !== 'string' ||
      row.categoryMajor.length === 0 ||
      typeof row.categoryMid !== 'string' ||
      (row.memo !== undefined && typeof row.memo !== 'string') ||
      (typeof row.memo === 'string' && row.memo.length > SPLIT_MEMO_MAX_LENGTH)
    ) {
      throw new TxSplitsSnapshotError();
    }
    const position = `${row.txId}\u0000${row.seq}`;
    if (lineIds.has(row.lineId) || positions.has(position)) throw new TxSplitsSnapshotError();
    lineIds.add(row.lineId);
    positions.add(position);
    rows.push({
      txId: row.txId,
      lineId: row.lineId,
      seq: Number(row.seq),
      parentAmount: Number(row.parentAmount),
      amount: Number(row.amount),
      cls: row.cls,
      categoryMajor: row.categoryMajor,
      categoryMid: row.categoryMid,
      ...(row.memo ? { memo: row.memo } : {}),
      ...(typeof row.createdAt === 'string' ? { createdAt: row.createdAt } : {}),
      ...(typeof row.updatedAt === 'string' ? { updatedAt: row.updatedAt } : {}),
    });
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.txId, (counts.get(row.txId) ?? 0) + 1);
  if ([...counts.values()].some((count) => count > MAX_SPLIT_LINES)) throw new TxSplitsSnapshotError();
  return rows.sort((a, b) => a.txId.localeCompare(b.txId) || a.seq - b.seq);
}

/** 親が消えた分割を、同じMF洗替えcandidateから取り除く。 */
export function reconcileTxSplits(data: Dataset): void {
  const parents = new Set(data.mfTx.filter((tx) => tx.idStable === true).map((tx) => tx.id));
  data.txSplits = data.txSplits.filter((split) => parents.has(split.txId));
}

export interface TxSplitDatasetIssue {
  txId: string;
  reason: 'parent_missing' | 'identity_unstable' | 'parent_amount_changed' | 'invalid_lines';
}

/** canonical parentとの参照整合性を、restore commit前に一括検査する。 */
export function validateTxSplitsForDataset(data: Dataset): TxSplitDatasetIssue[] {
  const parents = new Map(data.mfTx.map((tx) => [tx.id, tx]));
  const groups = new Map<string, TxSplit[]>();
  for (const split of data.txSplits) groups.set(split.txId, [...(groups.get(split.txId) ?? []), split]);
  const issues: TxSplitDatasetIssue[] = [];
  for (const [txId, lines] of groups) {
    const parent = parents.get(txId);
    if (!parent) issues.push({ txId, reason: 'parent_missing' });
    else if (parent.idStable !== true) issues.push({ txId, reason: 'identity_unstable' });
    else if (lines.some((line) => line.parentAmount !== Math.abs(parent.a))) {
      issues.push({ txId, reason: 'parent_amount_changed' });
    } else if (
      new Set(lines.map((line) => line.lineId)).size !== lines.length ||
      new Set(lines.map((line) => line.seq)).size !== lines.length ||
      lines.some((line) => !isSplitLineId(line.lineId)) ||
      validateSplits(Math.abs(parent.a), lines).length > 0
    ) {
      issues.push({ txId, reason: 'invalid_lines' });
    }
  }
  return issues.sort((a, b) => a.txId.localeCompare(b.txId));
}

/**
 * 分割を明細に反映する。元の1行を内訳N行に差し替える(data を直接書き換える)。
 *
 * 元の行を残したまま内訳を足すと、同じ支出を2回数えることになる。
 * 逆に元の行だけ消して内訳を入れ損ねると、支出が丸ごと消える。
 * どちらも静かに起きるので、差し替えは1箇所(ここ)だけで行う。
 *
 * 合計が元の金額と合わない分割は「無かったこと」にして元の行を残す。
 * 元の明細は銀行の記録そのもので、必ず正しい。
 * 内訳は人が入れたもので、間違っていることがある。
 * 迷ったら、確かなほうを残す。
 */
export function applySplits(data: Dataset, splits: TxSplit[]): void {
  if (splits.length === 0) return;

  const byTx = new Map<string, TxSplit[]>();
  for (const sp of splits) {
    const list = byTx.get(sp.txId);
    if (list) list.push(sp);
    else byTx.set(sp.txId, [sp]);
  }

  const out: MfTx[] = [];
  for (const tx of data.mfTx) {
    const lines = byTx.get(tx.id);
    if (!lines) {
      out.push(tx);
      continue;
    }
    const total = Math.abs(tx.a);
    const identityStable = tx.idStable === true;
    const parentAmountMatches = lines.every((line) => line.parentAmount === total);
    const identitiesValid =
      new Set(lines.map((line) => line.lineId)).size === lines.length &&
      lines.every((line) => isSplitLineId(line.lineId));
    // 不正な分割は元明細へfail-closedする。ただし状態を構造化して画面へ返し、黙って隠さない。
    if (
      !identityStable ||
      !parentAmountMatches ||
      !identitiesValid ||
      validateSplits(total, lines).length > 0
    ) {
      out.push({
        ...tx,
        splitProjection: {
          kind: 'split-parent',
          parentTxId: tx.id,
          state: identityStable ? 'amount_conflict' : 'identity_unstable',
        },
      });
      continue;
    }

    // 収入か支出かは元の明細の符号で決まる。内訳は絶対値で持つ
    const sign = tx.a < 0 ? -1 : 1;
    const ordered = [...lines].sort((a, b) => a.seq - b.seq);
    const parentEdit = data.edits[tx.id] ?? {};
    for (const l of ordered) {
      out.push({
        ...tx,
        id: l.lineId,
        a: sign * l.amount,
        c: l.memo ? `${tx.c} / ${l.memo}` : tx.c,
        big: l.categoryMajor,
        mid: l.categoryMid,
        splitProjection: {
          kind: 'split',
          parentTxId: tx.id,
          lineId: l.lineId,
          seq: l.seq,
          lineCount: ordered.length,
          parentAmount: total,
        },
        projectedEdit: {
          ...parentEdit,
          cls: l.cls,
          big: l.categoryMajor,
          mid: l.categoryMid,
          baseBig: l.categoryMajor,
          baseMid: l.categoryMid,
        },
      });
    }
  }
  data.mfTx = out;
}
