/**
 * 月導出・金額パース・科目正規化。HTML版から移植。
 */

/** 'YYYY/M/D' や 'YYYY-MM-DD' → 'YYYY-MM'。判別不能は null */
export function normMonth(s: string): string | null {
  const m = String(s ?? '').match(/(\d{4})[/-](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}` : null;
}

/** 'YYYY/M/D' → 'YYYY-MM-DD'。判別不能は null */
export function normDate(s: string): string | null {
  const m = String(s ?? '').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : null;
}

/** カンマ・円記号を除去して整数化（HTML版と同一: 失敗は 0） */
export function parseAmount(v: unknown): number {
  return Number.parseInt(String(v).replace(/[,¥]/g, ''), 10) || 0;
}

/** 科目正規化マップの適用 */
export function normalizeAccount(raw: string, map: Record<string, string>): string {
  return map[raw] ?? raw;
}
