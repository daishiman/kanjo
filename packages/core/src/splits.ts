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
import type { Cls } from './types.js';

/** 分割の1行。金額で確定したもの */
export interface SplitLine {
  cls: Cls;
  categoryMajor: string;
  categoryMid: string;
  /** 正の整数(円)。0円の行は作らない */
  amount: number;
  memo?: string;
}

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

  lines.forEach((l, i) => {
    if (!Number.isInteger(l.amount) || l.amount <= 0)
      issues.push({ index: i, message: '金額は1円以上の整数で入れてください。' });
    if (!l.categoryMajor)
      issues.push({ index: i, message: '分類を選んでください(未選択のままでは集計に入りません)。' });
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
