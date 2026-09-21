/** 金額・率の表示整形(HTML版の表記を踏襲) */

// 月の表記は core が正本 (core/month.ts)。web 側からはここ経由で引く
export { monthLabel, monthShort } from '@kanjo/core';

export const yen = (v: number | null | undefined): string =>
  v == null ? '—' : `¥${Math.round(v).toLocaleString('ja-JP')}`;

export const yenS = (v: number | null | undefined): string =>
  v == null ? '—' : `${v < 0 ? '−' : ''}¥${Math.abs(Math.round(v)).toLocaleString('ja-JP')}`;

/**
 * 万円 1 桁丸め（仕様 §3.2）。表は俯瞰なので万円、セル詳細だけが `yen` で円の実額を出す。
 * 桁区切りを付けるので総計（`1,139.4万`）も読める。
 */
export const man = (v: number | null | undefined): string =>
  v == null
    ? '—'
    : `${(v / 10_000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万`;

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;

/** 符号なしの割合(構成比・貯蓄率・対売上比など「増減」でない率) */
export const ratio = (v: number | null | undefined, digits = 1): string =>
  v == null ? '—' : `${(v * 100).toFixed(digits)}%`;

/** 収支の色クラス(黒字=緑 / 赤字=赤)。deltaCls と逆向き */
export const gainCls = (v: number | null | undefined): string =>
  v == null || v === 0 ? '' : v > 0 ? 'neg' : 'pos';

/** 増減の色クラス(支出文脈: 増=赤 pos / 減=緑 neg) */
export const deltaCls = (v: number | null | undefined): string =>
  v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg';

/** ISO日時 → 「2026/8/25 14:30」(閲覧者のローカル時刻)。不正・未記録は「—」 */
export const dateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};
