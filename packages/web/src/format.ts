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
