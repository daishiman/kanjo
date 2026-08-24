/**
 * freee 取引エクスポートの行→仕訳変換。HTML版 importFreee の判定・集計を忠実に移植。
 * ヘッダー判定: 「収支区分」列を含む。
 */
import { normDate, normMonth, normalizeAccount, parseAmount } from '../normalize.js';
import type { FreeeDeal } from '../types.js';

export interface FreeeParseResult {
  deals: FreeeDeal[];
  /** ファイルに含まれる対象月（洗い替え対象）。明細行の日付から導出 */
  months: string[];
  rows: number;
  skipped: number;
}

export function isFreeeHeader(header: string[]): boolean {
  return header.join(',').includes('収支区分');
}

/**
 * rows[0]=ヘッダー。発生日が読めない行（複数明細の継続行など）はHTML版同様スキップする。
 */
export function parseFreeeRows(rows: string[][], normMap: Record<string, string>): FreeeParseResult {
  const H = rows[0] ?? [];
  const col = (n: string) => H.indexOf(n);
  const ci = {
    kb: col('収支区分'),
    dt: col('発生日'),
    acct: col('勘定科目'),
    amt: col('金額'),
    vendor: col('取引先'),
  };
  const deals: FreeeDeal[] = [];
  const months = new Set<string>();
  let skipped = 0;
  rows.slice(1).forEach((r) => {
    const m = normMonth(r[ci.dt] ?? '');
    if (!m) {
      skipped++;
      return;
    }
    months.add(m);
    const amt = parseAmount(r[ci.amt]);
    const acctRaw = r[ci.acct] ?? '';
    deals.push({
      month: m,
      date: normDate(r[ci.dt] ?? '') ?? `${m}-01`,
      io: r[ci.kb] === '収入' ? 'income' : 'expense',
      partner: ci.vendor >= 0 ? (r[ci.vendor] ?? '') : '',
      accountRaw: acctRaw,
      accountNorm: normalizeAccount(acctRaw, normMap),
      amount: amt,
    });
  });
  return { deals, months: [...months].sort(), rows: deals.length, skipped };
}
