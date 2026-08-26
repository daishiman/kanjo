/**
 * 現金の記帳(口座・カード明細に出ない現金の受け渡し)。
 * 事業分(biz)は freee 仕訳と同じ形に変換して科目別集計へ合流し、
 * 個人分(per)は口座「現金」の MF 明細として仕分け・家計集計へ合流する。
 * 取込値とは別テーブルで持つため、CSV/Excel の再取込で消えない。
 */
import type { FreeeDeal, MfTx } from './types.js';

export type CashSide = 'biz' | 'per';
export type CashIo = 'income' | 'expense';

export interface CashEntry {
  id: number;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'YYYY-MM'(date から導出) */
  month: string;
  side: CashSide;
  io: CashIo;
  /** 正の整数(円)。向きは io で持つ */
  amount: number;
  /** 内容・支払先(例: 〇〇商工会議所 定例会) */
  description: string;
  /** biz: freee 勘定科目 / per: MF 大項目 */
  categoryMajor: string;
  /** per のみ(biz は空) */
  categoryMid: string;
  memo: string | null;
}

/** 個人分の現金明細を MF 明細として扱うときの ID 接頭辞 */
export const CASH_TX_PREFIX = 'cash:';
/** 個人分の現金明細に付ける口座名 */
export const CASH_INSTITUTION = '現金';

export const cashTxId = (id: number): string => `${CASH_TX_PREFIX}${id}`;
export const isCashTxId = (id: string): boolean => id.startsWith(CASH_TX_PREFIX);
export const monthOf = (date: string): string => date.slice(0, 7);

/** 事業分の現金明細を freee 仕訳1行として扱う(科目の正規化は取込と同じ対応表を使う) */
export function cashToDeal(e: CashEntry, normMap: Record<string, string>): FreeeDeal {
  const accountRaw = e.categoryMajor;
  return {
    month: e.month,
    date: e.date,
    io: e.io,
    partner: e.description,
    accountRaw,
    accountNorm: normMap[accountRaw] ?? accountRaw,
    amount: e.amount,
  };
}

/** 個人分の現金明細を MF 明細1件として扱う(口座は「現金」) */
export function cashToTx(e: CashEntry): MfTx {
  return {
    id: cashTxId(e.id),
    m: e.month,
    d: `${e.date.slice(5, 7)}/${e.date.slice(8, 10)}`,
    c: e.description,
    a: e.io === 'income' ? e.amount : -e.amount,
    big: e.categoryMajor,
    mid: e.categoryMid,
    inst: CASH_INSTITUTION,
  };
}

/** 事業分だけを freee 仕訳の配列にする(対象月を絞れる) */
export function cashBizDeals(
  entries: CashEntry[],
  normMap: Record<string, string>,
  months?: string[],
): FreeeDeal[] {
  const ms = months ? new Set(months) : null;
  return entries
    .filter((e) => e.side === 'biz' && (!ms || ms.has(e.month)))
    .map((e) => cashToDeal(e, normMap));
}
