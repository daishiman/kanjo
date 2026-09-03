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
 * rows[0]=ヘッダー。freeeの複数行取引は、継続明細の発生日と収支区分が空欄になる。
 * 直前の正常な取引から日付と収支を継承するが、不正行を跨いで古い取引へ戻らない。
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
    // 決済列。エクスポートの設定によっては存在しないため、列ごとに有無を見る
    due: col('支払期日'),
    settledAt: col('支払日'),
    settleAcct: col('支払口座'),
    settledAmt: col('支払金額'),
  };
  /** 列が無ければ undefined、列はあるが空欄なら null を返す(未決済判定でこの2つを区別する) */
  const optDate = (r: string[], i: number): string | null | undefined =>
    i < 0 ? undefined : (normDate(r[i] ?? '') ?? null);
  const optText = (r: string[], i: number): string | null | undefined =>
    i < 0 ? undefined : (r[i] ?? '').trim() || null;
  const optAmount = (r: string[], i: number): number | null | undefined => {
    if (i < 0) return undefined;
    return (r[i] ?? '').trim() ? parseAmount(r[i]) : null;
  };
  const deals: FreeeDeal[] = [];
  const months = new Set<string>();
  let skipped = 0;
  type Parent = Pick<
    FreeeDeal,
    'month' | 'date' | 'io' | 'partner' | 'dueDate' | 'settledDate' | 'settleAccount'
  >;
  const continuationIoMatches = (candidate: Parent | null, raw: string): boolean =>
    raw === '' || (candidate !== null && raw === (candidate.io === 'income' ? '収入' : '支出'));
  let parent: Parent | null = null;
  for (const r of rows.slice(1)) {
    const rawDate = (r[ci.dt] ?? '').trim();
    const rawIo = (r[ci.kb] ?? '').trim();
    const accountRaw = r[ci.acct] ?? '';
    const rawAmount = (r[ci.amt] ?? '').trim();
    const explicitDate = normDate(rawDate);
    const explicitMonth = normMonth(rawDate);
    const explicitIo = rawIo === '収入' ? 'income' : rawIo === '支出' ? 'expense' : null;
    const isContinuation = rawDate === '';

    let month: string;
    let date: string;
    let io: FreeeDeal['io'];
    if (isContinuation) {
      const sameIo = continuationIoMatches(parent, rawIo);
      // 継続行は「今の行の明細」が完成し、直前取引との接続も一意なときだけ受理する。
      if (!parent || !sameIo || !accountRaw.trim() || !rawAmount || parseAmount(rawAmount) === 0) {
        skipped++;
        parent = null;
        continue;
      }
      ({ month, date, io } = parent);
    } else {
      // 「値はあるが日付ではない」行で文脈を切る。その次の空欄行を古い取引へ繋げない。
      if (!explicitDate || !explicitMonth) {
        skipped++;
        parent = null;
        continue;
      }
      month = explicitMonth;
      date = explicitDate;
      io = explicitIo ?? 'expense';
    }

    const currentPartner = ci.vendor >= 0 ? (r[ci.vendor] ?? '') : '';
    const dueDate = optDate(r, ci.due);
    const settledDate = optDate(r, ci.settledAt);
    const settleAccount = optText(r, ci.settleAcct);
    const deal: FreeeDeal = {
      month,
      date,
      io,
      partner: isContinuation && !currentPartner.trim() ? (parent?.partner ?? '') : currentPartner,
      accountRaw,
      accountNorm: normalizeAccount(accountRaw, normMap),
      amount: parseAmount(rawAmount),
      dueDate: isContinuation && dueDate === null ? parent?.dueDate : dueDate,
      settledDate: isContinuation && settledDate === null ? parent?.settledDate : settledDate,
      settleAccount: isContinuation && settleAccount === null ? parent?.settleAccount : settleAccount,
      // 親の総決済額を各明細へ複製すると二重計上になる。この行に明記された値だけを持つ。
      settledAmount: optAmount(r, ci.settledAmt),
    };
    deals.push(deal);
    months.add(month);

    // 日付ありで収支区分も正常な行だけが、新しい継承元になる。
    if (!isContinuation) {
      parent = explicitIo
        ? {
            month,
            date,
            io,
            partner: currentPartner,
            dueDate,
            settledDate,
            settleAccount,
          }
        : null;
    }
  }
  return { deals, months: [...months].sort(), rows: deals.length, skipped };
}
