/**
 * 現金入力画面の view-model。
 *
 * 規則 (合計・絞り込み・ページング・入力経路・交通費合計・入力の上限・URL・下書き) は core の
 * cash-screen に置き、この画面はそれを使って表示の形に並べるだけにする。
 * core を import してよいのはこのファイルだけ (部品は view-model から受け取る)。
 */
import {
  CASH_DRAFT_KEY_PREFIX,
  CASH_IO_LABEL,
  CASH_LIMITS,
  CASH_OWNER_UNSET_LABEL,
  CASH_ROUTE_LABEL,
  type CashDraft,
  type CashDraftStorage,
  type CashFilter,
  type CashNormalDraft,
  type CashTab,
  type CashTransitDraft,
  type CashUrlState,
  EMPTY_CASH_FILTER,
  OWNER_VALUES,
  TRANSIT_CATEGORY,
  TRANSIT_PURPOSES,
  TRANSIT_PURPOSE_OTHER,
  TRANSIT_SAME_ACCOUNT_NOTE,
  type TransitPurpose,
  buildTransitEntry,
  cashBulkIdsError,
  cashCategoryLabel,
  cashCategoryOptions,
  cashDraftTimeLabel,
  cashEntryRoute,
  cashMonthLabel,
  cashMonthNav,
  cashMonthsInPeriod,
  cashPageLabel,
  cashTotals,
  clearCashDraft,
  codePointLength,
  defaultCashMonth,
  filterCashEntries,
  isDefaultCashFilter,
  loadCashDraft,
  paginateCash,
  parseTransitPurpose,
  readCashUrl,
  saveCashDraft,
  transitPurposeLabel,
  transitTotal,
  truncateCodePoints,
  validateCashInput,
  writeCashUrl,
} from '@kanjo/core';
import type { CashEntry, CashEntryBody, Owner } from '../../api.js';

export {
  CASH_DRAFT_KEY_PREFIX,
  CASH_IO_LABEL,
  CASH_LIMITS,
  CASH_OWNER_UNSET_LABEL,
  CASH_ROUTE_LABEL,
  EMPTY_CASH_FILTER,
  OWNER_VALUES,
  TRANSIT_CATEGORY,
  TRANSIT_PURPOSES,
  TRANSIT_PURPOSE_OTHER,
  TRANSIT_SAME_ACCOUNT_NOTE,
  cashBulkIdsError,
  cashCategoryLabel,
  cashCategoryOptions,
  cashDraftTimeLabel,
  cashEntryRoute,
  cashMonthLabel,
  cashMonthNav,
  cashMonthsInPeriod,
  cashPageLabel,
  cashTotals,
  clearCashDraft,
  codePointLength,
  defaultCashMonth,
  filterCashEntries,
  isDefaultCashFilter,
  loadCashDraft,
  paginateCash,
  readCashUrl,
  saveCashDraft,
  transitPurposeLabel,
  transitTotal,
  truncateCodePoints,
  writeCashUrl,
};
export type {
  CashDraft,
  CashDraftStorage,
  CashFilter,
  CashNormalDraft,
  CashTab,
  CashTransitDraft,
  CashUrlState,
  TransitPurpose,
};

/* ======================== 日付・期間 ======================== */

const pad = (n: number): string => String(n).padStart(2, '0');

/** 利用者の時刻での今日 (YYYY-MM-DD) */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 表の日付「YYYY/MM/DD」 */
export const cashDateLabel = (date: string): string => date.replaceAll('-', '/');

/** 対象期間カードの範囲「{開始}年{月}月 - {終了}年{月}月（N年 / Nか月）」 */
export function cashPeriodLabel(range: { from: string; to: string }): string {
  const count = cashMonthsInPeriod(range.from, range.to).length;
  const span = count % 12 === 0 ? `${count / 12}年` : `${count}か月`;
  return `${cashMonthLabel(range.from)} - ${cashMonthLabel(range.to)}（${span}）`;
}

/** 一覧が送れる月。期間が無い (取込が無い) ときは今日の月だけ */
export const cashListMonths = (range: { from: string; to: string } | null, today: string): string[] =>
  range ? cashMonthsInPeriod(range.from, range.to) : [today.slice(0, 7)];

/**
 * 追加した明細が選択中の月に出ないときの知らせ。一覧は移らず、その月へ移るリンクを添える。
 * 期間の外なら移る先が無いので文だけ。
 */
export function addedElsewhereNotice(
  date: string,
  month: string,
  months: readonly string[],
): { text: string; month: string | null } | null {
  const added = date.slice(0, 7);
  if (added === month) return null;
  if (!months.includes(added)) return { text: '選択中の期間の外に追加しました', month: null };
  return { text: `${cashMonthLabel(added)}に追加しました`, month: added };
}

/* ======================== 金額 ======================== */

/** 3 桁区切り (円は列見出しか呼び出し側で付ける) */
/** 金額欄に打てる桁数。上限 (CASH_LIMITS.amountMax) の桁数から導き、上限を変えたら欄も追従させる */
export const AMOUNT_DIGITS = String(CASH_LIMITS.amountMax).length;

export const cashAmount = (n: number): string => n.toLocaleString('ja-JP');

/** 収支差額。正負を色だけでなく符号でも示す */
export const cashSignedAmount = (n: number): string =>
  n > 0 ? `+${cashAmount(n)}` : n < 0 ? `-${cashAmount(-n)}` : '0';

/* ======================== 入力欄 ======================== */

/** 担当者の既定: 事業なら business、個人なら未選択 */
export const defaultOwnerFor = (side: CashNormalDraft['side']): Owner | '' =>
  side === 'biz' ? 'business' : '';

export const emptyNormalDraft = (today: string): CashNormalDraft => ({
  date: today,
  side: 'biz',
  io: 'expense',
  amount: '',
  description: '',
  categoryMajor: '',
  categoryMid: '',
  owner: defaultOwnerFor('biz'),
  memo: '',
});

/** 往復の既定は現行 (交通費へ切り替えたとき往復) に合わせる */
export const emptyTransitDraft = (): CashTransitDraft => ({
  from: '',
  to: '',
  oneWay: '',
  round: true,
  purpose: '',
  purposeNote: '',
  memo: '',
});

/**
 * 事業 / 個人の切り替え。カテゴリの候補表が変わるのでカテゴリは空に戻す。
 * 担当者は、前の区分の既定のまま触っていなければ新しい区分の既定へ寄せ、選び直した値は残す。
 */
export function changeSide(n: CashNormalDraft, side: CashNormalDraft['side']): CashNormalDraft {
  if (n.side === side) return n;
  const owner = n.owner === defaultOwnerFor(n.side) ? defaultOwnerFor(side) : n.owner;
  return { ...n, side, categoryMajor: '', categoryMid: '', owner };
}

/** 追加に成功した後: 日付・事業 / 個人・担当者は残し、それ以外を空に戻す */
export function resetFormsAfterCreate(n: CashNormalDraft): {
  normal: CashNormalDraft;
  transit: CashTransitDraft;
} {
  return {
    normal: { ...emptyNormalDraft(n.date), side: n.side, owner: n.owner },
    transit: emptyTransitDraft(),
  };
}

/** 入力途中の金額文字列。整数でなければ NaN (検証で「1円以上の整数」を出す) */
const parseAmount = (s: string): number => (/^\d{1,10}$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);

const nullIfBlank = (s: string): string | null => (s.trim() === '' ? null : s);

/** 通常入力の送信 body。区間と証憑不要は持ち越さない */
export function normalBody(n: CashNormalDraft): CashEntryBody {
  return {
    date: n.date,
    side: n.side,
    io: n.io,
    amount: parseAmount(n.amount),
    description: n.description.trim(),
    big: n.categoryMajor,
    mid: n.side === 'biz' ? '' : n.categoryMid,
    memo: nullIfBlank(n.memo),
    transitFrom: null,
    transitTo: null,
    transitRound: false,
    receiptWaived: false,
    owner: n.owner as Owner,
    transitPurpose: null,
    transitPurposeNote: null,
  };
}

const transitInputOf = (t: CashTransitDraft) => ({
  from: t.from.trim(),
  to: t.to.trim(),
  oneWayAmount: parseAmount(t.oneWay),
  round: t.round,
});

/** 交通費の合計金額 (読み取り専用の欄)。入力が揃わない間は null */
export function transitAmount(t: CashTransitDraft): number | null {
  const input = transitInputOf(t);
  if (!input.from || !input.to || !Number.isFinite(input.oneWayAmount)) return null;
  return transitTotal(input).amount;
}

/**
 * 交通費の送信 body。日付・事業 / 個人・担当者は通常入力カードから取り、
 * カテゴリは事業なら旅費交通費、個人なら通常入力カードのカテゴリを使う。
 * 金額と内容は既存の buildTransitEntry が区間と片道運賃から組み立てる。
 */
export function transitBody(n: CashNormalDraft, t: CashTransitDraft): CashEntryBody {
  const input = transitInputOf(t);
  const built = Number.isFinite(input.oneWayAmount)
    ? buildTransitEntry(input)
    : { amount: Number.NaN, description: '' };
  const other = t.purpose === TRANSIT_PURPOSE_OTHER;
  return {
    date: n.date,
    side: n.side,
    io: 'expense',
    amount: built.amount,
    description: built.description,
    big: n.side === 'biz' ? TRANSIT_CATEGORY : n.categoryMajor,
    mid: n.side === 'biz' ? '' : n.categoryMid,
    memo: nullIfBlank(t.memo),
    transitFrom: input.from,
    transitTo: input.to,
    transitRound: t.round,
    receiptWaived: true,
    owner: n.owner as Owner,
    transitPurpose: t.purpose || null,
    transitPurposeNote: other ? t.purposeNote : null,
  };
}

const inputOf = (b: CashEntryBody) => ({
  date: b.date,
  side: b.side,
  io: b.io,
  amount: b.amount,
  description: b.description,
  categoryMajor: b.big,
  owner: b.owner === ('' as Owner) ? null : b.owner,
  memo: b.memo,
  transitFrom: b.transitFrom,
  transitTo: b.transitTo,
  transitRound: b.transitRound,
  transitPurpose: b.transitPurpose,
  transitPurposeNote: b.transitPurposeNote,
});

/** 通常入力の検証 (API の zod と同じ上限)。null なら送れる */
export const normalError = (n: CashNormalDraft): string | null => validateCashInput(inputOf(normalBody(n)));

/** 交通費入力の検証。区間と運賃の誤りを先に、共有する欄 (日付・担当者など) を後に出す */
export function transitError(n: CashNormalDraft, t: CashTransitDraft): string | null {
  if (n.side === 'per' && !n.categoryMajor.trim()) return '個人の交通費はカテゴリを選んでください';
  const total = transitTotal(transitInputOf(t));
  if (total.error) return total.error;
  return validateCashInput(inputOf(transitBody(n, t)));
}

/**
 * 編集: 行の値を入力欄の形へ戻す。交通費の行は交通費カードへ、片道運賃は往復なら半分に戻す。
 * 名義が未設定 (0051 より前の行) は未選択にして、保存の前に選ばせる。
 */
export function entryToForms(
  e: CashEntry,
  current: CashNormalDraft,
): { tab: CashTab; normal: CashNormalDraft; transit: CashTransitDraft } {
  const route = cashEntryRoute(e);
  const shared: CashNormalDraft = {
    ...current,
    date: e.date,
    side: e.side,
    owner: e.owner ?? '',
    categoryMajor: e.side === 'biz' && route === 'transit' ? '' : e.categoryMajor,
    categoryMid: e.side === 'biz' ? '' : e.categoryMid,
  };
  if (route === 'normal') {
    return {
      tab: 'normal',
      normal: {
        ...shared,
        io: e.io,
        amount: String(e.amount),
        description: e.description,
        memo: e.memo ?? '',
      },
      transit: emptyTransitDraft(),
    };
  }
  const purpose = e.transitPurpose === null ? null : parseTransitPurpose(e.transitPurpose);
  return {
    tab: 'transit',
    normal: shared,
    transit: {
      from: e.transitFrom ?? '',
      to: e.transitTo ?? '',
      oneWay: String(e.transitRound ? e.amount / 2 : e.amount),
      round: e.transitRound,
      purpose: purpose?.purpose ?? '',
      purposeNote: purpose?.note ?? '',
      memo: e.memo ?? '',
    },
  };
}

/* ======================== 一覧 ======================== */

/** 表の 1 行の表示。区分・取込元は色でなく文字で出す */
export interface CashRowView {
  id: number;
  date: string;
  ioLabel: string;
  io: CashEntry['io'];
  category: string;
  description: string;
  purpose: string | null;
  ownerLabel: string;
  amount: string;
  routeLabel: string;
  sample: boolean;
}

export function cashRowView(e: CashEntry, ownerLabel: (owner: Owner) => string, sample = false): CashRowView {
  return {
    id: e.id,
    date: cashDateLabel(e.date),
    ioLabel: CASH_IO_LABEL[e.io],
    io: e.io,
    category: cashCategoryLabel(e),
    description: e.description,
    purpose: transitPurposeLabel(e.transitPurpose),
    ownerLabel: e.owner === null ? CASH_OWNER_UNSET_LABEL : ownerLabel(e.owner),
    amount: cashAmount(e.amount),
    routeLabel: CASH_ROUTE_LABEL[cashEntryRoute(e)],
    sample,
  };
}

/**
 * 画面内だけのサンプル 5 行。保存も集計もしない (id は負にして実在の行と混ざらないようにする)。
 * 日付は選択中の月の中に置く。
 */
export function sampleCashEntries(month: string): CashEntry[] {
  const row = (
    id: number,
    day: string,
    patch: Partial<CashEntry> & Pick<CashEntry, 'io' | 'amount' | 'description' | 'categoryMajor'>,
  ): CashEntry => ({
    id,
    date: `${month}-${day}`,
    month,
    side: 'biz',
    categoryMid: '',
    memo: null,
    transitFrom: null,
    transitTo: null,
    transitRound: false,
    receiptWaived: false,
    owner: 'business',
    transitPurpose: null,
    ...patch,
  });
  const transit = buildTransitEntry({ from: '東京', to: '新宿', oneWayAmount: 220, round: true });
  return [
    row(-1, '20', { io: 'income', amount: 50000, description: '売上金(現金受取)', categoryMajor: '売上高' }),
    row(-2, '15', { io: 'expense', amount: 12000, description: '事務用品の購入', categoryMajor: '消耗品費' }),
    row(-3, '12', {
      io: 'expense',
      amount: transit.amount,
      description: transit.description,
      categoryMajor: TRANSIT_CATEGORY,
      transitFrom: '東京',
      transitTo: '新宿',
      transitRound: true,
      receiptWaived: true,
      transitPurpose: '打ち合わせ',
    }),
    row(-4, '08', {
      io: 'expense',
      amount: 8500,
      description: '打ち合わせの飲食代',
      categoryMajor: '会議費',
    }),
    row(-5, '03', { io: 'expense', amount: 680, description: '切手の購入', categoryMajor: '通信費' }),
  ];
}

/** 選択中の月の行 (API は期間で絞った全件を返すので、月はここで切る) */
export const entriesInMonth = (entries: readonly CashEntry[], month: string): CashEntry[] =>
  entries.filter((e) => e.month === month);

/** 一覧の状態をまとめて導く。ページは範囲外なら最後のページへ寄せる (core の paginateCash) */
export function cashListView(entries: readonly CashEntry[], month: string, url: CashUrlState) {
  const monthRows = entriesInMonth(entries, month);
  const filtered = filterCashEntries(monthRows, url.filter);
  return {
    monthRows,
    filtered,
    totals: cashTotals(filtered),
    page: paginateCash(filtered, url.page),
    categories: cashCategoryOptions(monthRows),
    /** 月に行が無く、絞り込みも既定 → 空状態 */
    empty: monthRows.length === 0 && isDefaultCashFilter(url.filter),
    /** 絞り込みの結果だけが 0 件 → 「条件に合う明細がありません」 */
    noMatch: filtered.length === 0 && !(monthRows.length === 0 && isDefaultCashFilter(url.filter)),
  };
}

/** 選んだ行のうち、今の絞り込みに残っている id だけ (見えない行を消さない) */
export const visibleSelection = (selected: ReadonlySet<number>, rows: readonly CashEntry[]): number[] =>
  rows.filter((e) => selected.has(e.id)).map((e) => e.id);

/* ======================== 下書き ======================== */

/** localStorage を例外なしで取る (プライベートモードなどで投げる環境がある) */
export function browserDraftStorage(): CashDraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const DRAFT_SAVE_DELAY_MS = 500;
