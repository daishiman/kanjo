/**
 * 表の並べ替え(純関数)。
 *
 * 表示中のセルの「見えている文字列」だけを材料にする。元データの型を各表から集めて回ると、
 * 表ごとに違う形の値を運ぶ配線が43箇所に増えるので、画面に出ている文字を正とする。
 * そのぶん「¥1,234」「12.3%」「2026-07」「—」といった表記を、比較のときに解釈する必要がある。
 */

export type SortDir = 'asc' | 'desc';

/** 並べ替えの対象外にする行(合計行など)の位置。元の並びのまま、その場に残す */
export type PinnedRow = boolean;

/**
 * 表示文字列を数値として読めるなら数値にする。読めなければ null。
 *
 * 金額は「¥1,234」「-1,234」「△1,234」、割合は「12.3%」、件数は「12」で出ている。
 * 単位や記号は落として符号と数だけを見る(表記が変わっても比較は壊れない)。
 */
export function parseSortNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  // 会計表記の △ / ▲ は負。全角記号もそのまま来る
  const negative = /^[△▲]/.test(t) || /^-/.test(t) || /^−/.test(t);
  const digits = t.replace(/[^\d.]/g, '');
  if (!digits || !/\d/.test(digits)) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * 中身のないセル。昇順・降順のどちらでも末尾へ送る。
 * 未入力の行が並べ替えのたびに先頭へ来ると、読みたい行が毎回下へ押し出される。
 */
export const isBlankSortValue = (text: string): boolean => {
  const t = text.trim();
  return t === '' || t === '—' || t === '-' || t === '−';
};

/**
 * 2つのセルの表示文字列を比べる(昇順の基準)。
 * 空欄は sortedRowOrder が先に除けるので、ここには中身のある文字列だけが来る。
 *
 * 数として読める値どうしは数の大小で、そうでなければ日本語の並び(localeCompare)で比べる。
 * 数と文字が混ざる列(金額のセルに「按分」などの注記が入る表がある)では数を先に置く。
 * 文字を数より先にすると、金額列を押したときに注記の行が上に集まって金額が読めなくなる。
 */
export function compareSortValues(a: string, b: string): number {
  const na = parseSortNumber(a);
  const nb = parseSortNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  // 前後の空白は表示上の都合なので、比較には持ち込まない
  return a.trim().localeCompare(b.trim(), 'ja');
}

/**
 * 指定した列で並べ替えたときの、行の表示順(元の配列に対する添字)。
 *
 * pinned の行は動かさない。合計行がソートで中ほどへ紛れ込むと、表そのものが嘘になる。
 * 同値の行は元の並びを保つ(安定ソート)。同じ列を2回押しても行が入れ替わらないようにするため。
 */
export function sortedRowOrder(
  cells: readonly (readonly string[])[],
  column: number,
  dir: SortDir,
  pinned: readonly PinnedRow[] = [],
): number[] {
  const movable: number[] = [];
  for (let i = 0; i < cells.length; i += 1) if (!pinned[i]) movable.push(i);

  const at = (i: number): string => cells[i][column] ?? '';
  const sign = dir === 'asc' ? 1 : -1;
  const sorted = [...movable].sort((x, y) => {
    // 空欄は向きに関わらず末尾。ここで先に除けるので、比較関数は中身のある値だけを見ればよい
    const bx = isBlankSortValue(at(x));
    const by = isBlankSortValue(at(y));
    if (bx || by) return bx && by ? x - y : bx ? 1 : -1;
    const d = compareSortValues(at(x), at(y));
    return d !== 0 ? d * sign : x - y;
  });

  // 固定行は元の位置へ戻す。動かせる行だけを並べ替えた結果で順に埋める
  const order: number[] = [];
  let k = 0;
  for (let i = 0; i < cells.length; i += 1) order.push(pinned[i] ? i : sorted[k++]);
  return order;
}
