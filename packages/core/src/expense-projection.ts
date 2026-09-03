/**
 * freeeとMoney Forwardを一つの支出実態へ投影する読み取りモデル。
 *
 * canonicalを書き換えず、取込・取消・undo後の現在値から毎回導出する。
 * 税務の正本はfreeeのまま。MFにしかない事業支出は「未記帳」であり、
 * freeeの帳簿確定額とは呼ばない。
 */
import { type SubscriptionsData, subscriptions } from './analysis.js';
import { isCashTxId } from './cash.js';
import { resolveTx } from './classify.js';
import { ensureMonth, subVendorDefs } from './dataset.js';
import { normalizeMfDisplayDate } from './persisted-projection.js';
import { matchSubVendor } from './subs.js';
import type { Dataset, FreeeDeal, MfTx } from './types.js';
import { isMfCountable } from './types.js';

export type ExpenseSource = 'freee' | 'mf';
export type ExpensePurpose = 'business' | 'personal';

export interface ExpenseFact {
  source: ExpenseSource;
  /** 画面から元明細へ戻るための識別子。freeeの値は導出内でだけ安定する。 */
  sourceId: string;
  sourceStable: boolean;
  month: string;
  date: string;
  amount: number;
  purpose: ExpensePurpose;
  party: string;
  categoryRaw: string;
  categoryNorm: string;
  split: boolean;
}

export interface ExpenseReview {
  mf: ExpenseFact;
  freee: ExpenseFact | null;
  candidateCount: number;
  reason:
    | '一致候補が複数あります'
    | '支払先が一致しません'
    | '日付が一致しません'
    | '事業・個人の区分が一致しません'
    | 'MF明細の識別子が安定していません'
    | '分割明細のため自動照合できません';
}

export interface ExpenseProjection {
  summary: {
    /** freeeへ記帳済みの事業経費 */
    booked: number;
    /** MFで事業と判定され、freeeと照合されていない支出 */
    unbooked: number;
    /** booked + unbooked。自動照合済みMFは加えない */
    effective: number;
    matchedCount: number;
    reviewCount: number;
  };
  months: Array<{ month: string; booked: number; unbooked: number; effective: number }>;
  matched: Array<{ freee: ExpenseFact; mf: ExpenseFact }>;
  review: ExpenseReview[];
  unbooked: ExpenseFact[];
  /** 入力元を問わず、照合済みの二重分を除いた支出。サブスク射影の入力にも使う。 */
  effectiveExpenses: ExpenseFact[];
}

/**
 * 自動照合では、NFKC・大小文字・空白の差だけを吸収する。
 * 法人格や記号を落とすvendorKeyはサブスク登録には便利だが、
 * 別取引を除外する根拠としては強すぎるため使わない。
 */
export function strictExpensePartyKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[\s　]/g, '');
}

function mfDate(tx: MfTx): string {
  return `${tx.m}-${normalizeMfDisplayDate(tx.d, tx.m).slice(-2)}`;
}

function factsFromFreee(deals: readonly FreeeDeal[]): ExpenseFact[] {
  return deals.flatMap((deal, index) => {
    if (deal.io !== 'expense' || deal.amount <= 0) return [];
    const personal = deal.accountRaw === '事業主貸' || deal.accountNorm === '事業主貸';
    return [
      {
        source: 'freee' as const,
        sourceId: `freee:${index}`,
        sourceStable: false,
        month: deal.month,
        date: deal.date,
        amount: deal.amount,
        purpose: personal ? ('personal' as const) : ('business' as const),
        party: deal.partner,
        categoryRaw: deal.accountRaw,
        categoryNorm: deal.accountNorm,
        split: false,
      },
    ];
  });
}

function factsFromMf(data: Dataset): ExpenseFact[] {
  return data.mfTx.flatMap((tx) => {
    // data.mfTxには個人の手入力現金(cash:*)も投影される。この照合は取込元
    // freee/MFだけが対象なので、現金をMF未記帳と呼ばず既存の現金台帳へ任せる。
    if (isCashTxId(tx.id) || !isMfCountable(tx) || tx.a >= 0) return [];
    const resolved = resolveTx(tx, data.rules, data.edits, data.institutionOwners);
    return [
      {
        source: 'mf' as const,
        sourceId: tx.id,
        sourceStable: tx.idStable === true,
        month: tx.m,
        date: mfDate(tx),
        amount: Math.abs(tx.a),
        purpose: resolved.cls === 'biz' ? ('business' as const) : ('personal' as const),
        party: tx.c,
        categoryRaw: resolved.big,
        categoryNorm: resolved.mid || resolved.big,
        split: tx.splitProjection != null,
      },
    ];
  });
}

const exactKey = (fact: ExpenseFact): string =>
  `${fact.date}\u0000${fact.amount}\u0000${fact.purpose}\u0000${strictExpensePartyKey(fact.party)}`;

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

function reviewCandidates(mf: ExpenseFact, freee: readonly ExpenseFact[]): ExpenseFact[] {
  const party = strictExpensePartyKey(mf.party);
  return freee.filter((row) => {
    if (row.amount !== mf.amount) return false;
    const sameDate = row.date === mf.date;
    const sameParty = party !== '' && party === strictExpensePartyKey(row.party);
    const nearDate = Math.abs(dayNumber(row.date) - dayNumber(mf.date)) <= 3;
    return sameDate || (sameParty && nearDate);
  });
}

function reviewReason(mf: ExpenseFact, candidates: readonly ExpenseFact[]): ExpenseReview['reason'] {
  if (mf.split) return '分割明細のため自動照合できません';
  if (!mf.sourceStable) return 'MF明細の識別子が安定していません';
  if (candidates.length !== 1) return '一致候補が複数あります';
  const candidate = candidates[0]!;
  if (candidate.purpose !== mf.purpose) return '事業・個人の区分が一致しません';
  if (candidate.date !== mf.date) return '日付が一致しません';
  return '支払先が一致しません';
}

export function buildExpenseProjection(data: Dataset, deals: readonly FreeeDeal[]): ExpenseProjection {
  const freee = factsFromFreee(deals);
  const mf = factsFromMf(data);
  const freeeByKey = new Map<string, ExpenseFact[]>();
  const mfByKey = new Map<string, ExpenseFact[]>();
  for (const fact of freee) {
    if (!strictExpensePartyKey(fact.party)) continue;
    const key = exactKey(fact);
    freeeByKey.set(key, [...(freeeByKey.get(key) ?? []), fact]);
  }
  for (const fact of mf) {
    if (fact.source !== 'mf' || !fact.sourceStable || fact.split || !strictExpensePartyKey(fact.party))
      continue;
    const key = exactKey(fact);
    mfByKey.set(key, [...(mfByKey.get(key) ?? []), fact]);
  }

  const matched: ExpenseProjection['matched'] = [];
  const matchedMfIds = new Set<string>();
  for (const [key, mfRows] of mfByKey) {
    const freeeRows = freeeByKey.get(key) ?? [];
    if (mfRows.length !== 1 || freeeRows.length !== 1) continue;
    matched.push({ freee: freeeRows[0]!, mf: mfRows[0]! });
    matchedMfIds.add(mfRows[0]!.sourceId);
  }

  const unmatchedMf = mf.filter((fact) => !matchedMfIds.has(fact.sourceId));
  const review: ExpenseReview[] = [];
  for (const fact of unmatchedMf) {
    if (fact.source !== 'mf') continue;
    const candidates = reviewCandidates(fact, freee);
    if (candidates.length === 0) continue;
    const exactMfCount = mfByKey.get(exactKey(fact))?.length ?? 0;
    const exactFreeeCount = freeeByKey.get(exactKey(fact))?.length ?? 0;
    const duplicatedExactKey = exactMfCount > 1 || exactFreeeCount > 1;
    review.push({
      mf: fact,
      freee: candidates.length === 1 ? candidates[0]! : null,
      candidateCount: candidates.length,
      reason: duplicatedExactKey ? '一致候補が複数あります' : reviewReason(fact, candidates),
    });
  }

  const booked = freee.filter((fact) => fact.purpose === 'business');
  const unbooked = unmatchedMf.filter((fact) => fact.purpose === 'business');
  const effectiveExpenses = [...freee, ...unmatchedMf];
  const monthNames = [...new Set([...data.months, ...effectiveExpenses.map((fact) => fact.month)])].sort();
  const months = monthNames.map((month) => {
    const bookedAmount = booked
      .filter((fact) => fact.month === month)
      .reduce((sum, fact) => sum + fact.amount, 0);
    const unbookedAmount = unbooked
      .filter((fact) => fact.month === month)
      .reduce((sum, fact) => sum + fact.amount, 0);
    return {
      month,
      booked: bookedAmount,
      unbooked: unbookedAmount,
      effective: bookedAmount + unbookedAmount,
    };
  });
  const bookedTotal = booked.reduce((sum, fact) => sum + fact.amount, 0);
  const unbookedTotal = unbooked.reduce((sum, fact) => sum + fact.amount, 0);
  const matchedBusinessCount = matched.filter((pair) => pair.freee.purpose === 'business').length;

  return {
    summary: {
      booked: bookedTotal,
      unbooked: unbookedTotal,
      effective: bookedTotal + unbookedTotal,
      matchedCount: matchedBusinessCount,
      reviewCount: review.length,
    },
    months,
    matched,
    review,
    unbooked,
    effectiveExpenses,
  };
}

export interface SourceNeutralSubscriptionsData extends SubscriptionsData {
  /** 有効額へ寄与した明細数。照合済みMFはfreee側だけを数える。 */
  sourceCoverage: { freee: number; moneyForward: number; matched: number; review: number };
}

function registeredVendorFor(fact: ExpenseFact, data: Dataset): string | null {
  const defs = subVendorDefs(data);
  const matched = matchSubVendor(fact.party, defs);
  if (!matched) return null;
  const definition = defs.find((vendor) => vendor.name === matched);
  if (!definition?.accounts?.length) return matched;
  const refs = new Set([fact.categoryRaw, fact.categoryNorm, `${fact.categoryRaw}/${fact.categoryNorm}`]);
  return definition.accounts.some((account) => refs.has(account)) ? matched : null;
}

/** 登録支払先のサブスク集計も、freee固定ではなく照合後の実質支出から導出する。 */
export function sourceNeutralSubscriptions(
  data: Dataset,
  deals: readonly FreeeDeal[],
): SourceNeutralSubscriptionsData {
  const projection = buildExpenseProjection(data, deals);
  const projected = structuredClone(data);
  projected.subs.matrix = Object.fromEntries(
    projected.subs.vendors.map((vendor) => [vendor, projected.months.map(() => 0)]),
  );
  projected.subs.other = projected.months.map(() => 0);

  for (const fact of projection.effectiveExpenses) {
    const index = ensureMonth(projected, fact.month);
    const vendor = registeredVendorFor(fact, projected);
    if (vendor) projected.subs.matrix[vendor][index] += fact.amount;
    else if (fact.categoryRaw === 'サブスク・通信' || fact.categoryNorm === 'サブスク・通信') {
      projected.subs.other[index] += fact.amount;
    }
  }

  return {
    ...subscriptions(projected),
    sourceCoverage: {
      freee: projection.effectiveExpenses.filter((fact) => fact.source === 'freee').length,
      moneyForward: projection.effectiveExpenses.filter((fact) => fact.source === 'mf').length,
      matched: projection.matched.length,
      review: projection.review.length,
    },
  };
}

/** 既存のサブスク候補採点へ渡す、照合後のソース中立明細。 */
export function sourceNeutralSubscriptionDeals(data: Dataset, deals: readonly FreeeDeal[]): FreeeDeal[] {
  return buildExpenseProjection(data, deals).effectiveExpenses.map((fact) => ({
    month: fact.month,
    date: fact.date,
    io: 'expense',
    partner: fact.party,
    accountRaw: fact.categoryRaw,
    accountNorm: fact.categoryNorm,
    amount: fact.amount,
  }));
}
