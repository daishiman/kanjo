/**
 * 月文字列 'YYYY-MM' の読み書きの正本。
 *
 * 同じ変換が core に6箇所・web に5箇所で書かれていて、年の切り出しが slice だったり
 * split だったりと少しずつ違っていた。表記が揺れても誰も気づけないので1か所に集める。
 */

/** 'YYYY-MM' の形。年4桁・月2桁のゼロ埋めだけを月として扱う */
export const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * 月を通算番号へ。差を取れば「何か月離れているか」が出る。
 * 例: '2026-01' と '2025-12' の差は 1。
 */
export const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/** 通算番号から月へ戻す。monthIndex の逆。 */
export const monthKey = (index: number): string =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

/** 'YYYY-MM' → 「8月」。年をすでに示している軸や列で使う */
export const monthShort = (m: string): string => `${Number(m.slice(5, 7))}月`;

/**
 * 'YYYY-MM' → 「2026年8月」。
 *
 * 月の形でない文字列は整形せずそのまま返す。四半期ラベル '2026-Q1' のように
 * 月以外の期間表記がそのまま流れてくる場所があり、そこで「NaN年NaN月」を出さないため。
 */
export const monthLabel = (m: string): string => {
  const hit = MONTH_PATTERN.exec(m);
  return hit ? `${hit[1]}年${Number(hit[2])}月` : m;
};
