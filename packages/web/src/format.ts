/** 金額・率の表示整形(HTML版の表記を踏襲) */

export const yen = (v: number | null | undefined): string =>
  v == null ? '—' : `¥${Math.round(v).toLocaleString('ja-JP')}`;

export const yenS = (v: number | null | undefined): string =>
  v == null ? '—' : `${v < 0 ? '−' : ''}¥${Math.abs(Math.round(v)).toLocaleString('ja-JP')}`;

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;

/** 増減の色クラス(支出文脈: 増=赤 pos / 減=緑 neg) */
export const deltaCls = (v: number | null | undefined): string =>
  v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg';

export const monthLabel = (m: string): string => {
  const [y, mm] = m.split('-');
  return `${y}年${Number(mm)}月`;
};

export const monthShort = (m: string): string => `${Number(m.split('-')[1])}月`;

/** ISO日時 → 「2026/8/25 14:30」(閲覧者のローカル時刻)。不正・未記録は「—」 */
export const dateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};
