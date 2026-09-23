/**
 * 現金入力画面 (17-cash) の規則。画面と API が同じ判定を使うよう、ここで1回だけ決める。
 *
 * - 入力経路: 区間 (transitFrom) があれば交通費入力、無ければ通常入力。列は持たず、既存行を書き換えずに全行へ付く。
 * - 合計・絞り込み・ページング: 一覧 API は期間で絞った明細だけを返し、画面がここの純関数で導く。
 * - 入力の上限: API の zod も CASH_LIMITS を参照し、画面と API で上限が食い違わない。
 * - 業務の目的: migration 0052 の transit_purpose 1列に、固定の選択肢は表示語のまま、その他は `その他:` 接頭辞で入れる。
 * - URL と下書き: 不正な値は既定に落とす。下書きは利用者 id を含むキーで、例外は握って画面を止めない。
 *
 * 規則の表は docs/cash-screen/rules.md にあり、core の契約テストの期待値と同じである。
 */
import { CASH_DRAFT_KEY_PREFIX } from './cash-draft-key.js';
import { type CashEntry, type CashIo, type CashSide, buildTransitEntry, transitInputError } from './cash.js';
import { monthIndex, monthKey } from './month.js';
import { OWNER_VALUES, type Owner } from './types.js';

/* ======================== 上限 ======================== */

export const CASH_LIMITS = {
  /** 金額の上限 (円) */
  amountMax: 1_000_000_000,
  descriptionMax: 60,
  memoMax: 200,
  stationMax: 40,
  purposeNoteMax: 40,
  /** 一括削除・一括の元に戻すの件数 */
  bulkMax: 100,
  pageSize: 20,
  /** 論理削除から完全消去までの日数 */
  purgeDays: 30,
  /** 夜間の完全消去 1 晩の行数 */
  purgeBatch: 500,
} as const;

/** 字数はコードポイント数で数える (名義ラベルの上限と同じ数え方) */
export const codePointLength = (s: string): number => [...s].length;

/**
 * HTML の maxLength は UTF-16 code unit 数で数えるため、絵文字で API の上限とずれる。
 * 入力欄・下書き・API のすべてが使う code point 単位の切り詰めをここに集約する。
 */
export const truncateCodePoints = (s: string, max: number): string =>
  codePointLength(s) <= max ? s : [...s].slice(0, max).join('');

/** 'YYYY-MM-DD' で実在する日付か (2月30日などを弾く) */
export function isRealCashDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* ======================== 入力経路 ======================== */

export type CashRoute = 'normal' | 'transit';

export const CASH_ROUTE_VALUES: readonly CashRoute[] = ['normal', 'transit'];

export const CASH_ROUTE_LABEL: Record<CashRoute, string> = {
  normal: '通常入力',
  transit: '交通費入力',
};

export const cashEntryRoute = (e: Pick<CashEntry, 'transitFrom'>): CashRoute =>
  e.transitFrom !== null ? 'transit' : 'normal';

export const CASH_IO_LABEL: Record<CashIo, string> = { income: '収入', expense: '支出' };

/** 名義が NULL の既存行の表示。ownerLabel(null) (名義 unset の表示名) とは別にこの画面だけで使う */
export const CASH_OWNER_UNSET_LABEL = '未設定';

/** 一覧と絞り込みで使うカテゴリの表示文字列 */
export const cashCategoryLabel = (e: Pick<CashEntry, 'categoryMajor' | 'categoryMid'>): string =>
  e.categoryMid ? `${e.categoryMajor} / ${e.categoryMid}` : e.categoryMajor;

/* ======================== 合計 ======================== */

export interface CashTotals {
  income: number;
  expense: number;
  /** 収入 − 支出。負もある */
  net: number;
}

export function cashTotals(entries: readonly Pick<CashEntry, 'io' | 'amount'>[]): CashTotals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.io === 'income') income += e.amount;
    else expense += e.amount;
  }
  return { income, expense, net: income - expense };
}

/* ======================== 絞り込み ======================== */

export type CashOwnerFilter = Owner | 'unset';

export interface CashFilter {
  q: string;
  io: CashIo | null;
  /** cashCategoryLabel の値 */
  category: string | null;
  owner: CashOwnerFilter | null;
  route: CashRoute | null;
  min: number | null;
  max: number | null;
  /** 'YYYY-MM-DD' (両端を含む) */
  from: string | null;
  to: string | null;
}

export const EMPTY_CASH_FILTER: Readonly<CashFilter> = Object.freeze({
  q: '',
  io: null,
  category: null,
  owner: null,
  route: null,
  min: null,
  max: null,
  from: null,
  to: null,
});

/** キーワード比較用。NFKC で全角英数を半角に寄せ、英字の大小を区別しない */
export const normalizeCashKeyword = (s: string): string => s.normalize('NFKC').toLowerCase();

const keywordTargets = (e: CashEntry): string[] =>
  [
    e.description,
    e.memo,
    e.categoryMajor,
    e.categoryMid,
    e.transitFrom,
    e.transitTo,
    e.transitPurpose,
  ].filter((v): v is string => typeof v === 'string' && v !== '');

export function matchesCashFilter(e: CashEntry, f: CashFilter): boolean {
  const q = normalizeCashKeyword(f.q.trim());
  if (q && !keywordTargets(e).some((t) => normalizeCashKeyword(t).includes(q))) return false;
  if (f.io && e.io !== f.io) return false;
  if (f.category !== null && cashCategoryLabel(e) !== f.category) return false;
  if (f.owner !== null && (e.owner ?? 'unset') !== f.owner) return false;
  if (f.route && cashEntryRoute(e) !== f.route) return false;
  if (f.min !== null && e.amount < f.min) return false;
  if (f.max !== null && e.amount > f.max) return false;
  if (f.from !== null && e.date < f.from) return false;
  if (f.to !== null && e.date > f.to) return false;
  return true;
}

/** 全条件の AND。順序は保つ */
export const filterCashEntries = (entries: readonly CashEntry[], f: CashFilter): CashEntry[] =>
  entries.filter((e) => matchesCashFilter(e, f));

/** 絞り込みが既定のままか (空状態と「条件に合う明細がありません」の出し分け) */
export const isDefaultCashFilter = (f: CashFilter): boolean =>
  f.q.trim() === '' &&
  f.io === null &&
  f.category === null &&
  f.owner === null &&
  f.route === null &&
  f.min === null &&
  f.max === null &&
  f.from === null &&
  f.to === null;

/** カテゴリ絞り込みの候補: 選択中の月に現れる表示文字列 (出現順を保って重複を除く) */
export const cashCategoryOptions = (entries: readonly CashEntry[]): string[] => [
  ...new Set(entries.map(cashCategoryLabel)),
];

/* ======================== ページング ======================== */

export interface CashPage<T> {
  rows: T[];
  /** 1 始まり。範囲外は最後のページへ寄せる */
  page: number;
  pageCount: number;
  /** 表示の「{始}-{終}件」。総数 0 なら 0 と 0 */
  start: number;
  end: number;
  total: number;
}

export function paginateCash<T>(
  rows: readonly T[],
  page: number,
  size: number = CASH_LIMITS.pageSize,
): CashPage<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Number.isInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1;
  const offset = (p - 1) * size;
  const slice = rows.slice(offset, offset + size);
  return {
    rows: slice,
    page: p,
    pageCount,
    start: total === 0 ? 0 : offset + 1,
    end: offset + slice.length,
    total,
  };
}

/** ページングの表示 */
export const cashPageLabel = (p: Pick<CashPage<unknown>, 'start' | 'end' | 'total'>): string =>
  p.total === 0 ? '0件' : `${p.start}-${p.end}件 / ${p.total}件`;

/* ======================== 交通費の合計 ======================== */

/** 片道 × (往復なら 2)。既存の buildTransitEntry と transitInputError をそのまま使う */
export function transitTotal(input: { from: string; to: string; oneWayAmount: number; round: boolean }):
  | { amount: number; error: null }
  | { amount: null; error: string } {
  const error = transitInputError(input);
  if (error) return { amount: null, error };
  return { amount: buildTransitEntry(input).amount, error: null };
}

/* ======================== 業務の目的 ======================== */

export const TRANSIT_PURPOSE_FIXED = [
  '客先訪問',
  '打ち合わせ',
  '仕入れ・買い出し',
  '研修・セミナー',
] as const;
export const TRANSIT_PURPOSE_OTHER = 'その他';
export const TRANSIT_PURPOSES = [...TRANSIT_PURPOSE_FIXED, TRANSIT_PURPOSE_OTHER] as const;
export type TransitPurpose = (typeof TRANSIT_PURPOSES)[number];

const OTHER_PREFIX = `${TRANSIT_PURPOSE_OTHER}:`;

export const isTransitPurpose = (v: unknown): v is TransitPurpose =>
  typeof v === 'string' && (TRANSIT_PURPOSES as readonly string[]).includes(v);

/** 1列の保存値にまとめる。その他は `その他:記述` */
export const formatTransitPurpose = (purpose: TransitPurpose, note: string | null): string =>
  purpose === TRANSIT_PURPOSE_OTHER ? `${OTHER_PREFIX}${(note ?? '').trim()}` : purpose;

/** 保存値を選択肢と記述に読み分ける。どちらにも当たらない値はその他の記述として扱う */
export function parseTransitPurpose(v: string): { purpose: TransitPurpose; note: string | null } {
  if ((TRANSIT_PURPOSE_FIXED as readonly string[]).includes(v))
    return { purpose: v as TransitPurpose, note: null };
  if (v.startsWith(OTHER_PREFIX))
    return { purpose: TRANSIT_PURPOSE_OTHER, note: v.slice(OTHER_PREFIX.length) };
  return { purpose: TRANSIT_PURPOSE_OTHER, note: v };
}

/** 一覧に出す目的の文。その他は記述を出す */
export function transitPurposeLabel(v: string | null): string | null {
  if (v === null) return null;
  const { purpose, note } = parseTransitPurpose(v);
  return purpose === TRANSIT_PURPOSE_OTHER ? note || TRANSIT_PURPOSE_OTHER : purpose;
}

/**
 * 業務の目的の検証。区間があるときは必須で、その他なら記述 1〜40 字。
 * 区間が無いときは両方 null でなければならない。
 */
export function transitPurposeError(
  hasRoute: boolean,
  purpose: string | null,
  note: string | null,
): string | null {
  if (!hasRoute) {
    return purpose === null && note === null ? null : '業務の目的は交通費のときだけ入力できます';
  }
  if (purpose === null || purpose === '') return '業務の目的を選んでください';
  if (!isTransitPurpose(purpose)) return '業務の目的は候補から選んでください';
  if (purpose === TRANSIT_PURPOSE_OTHER) {
    const n = (note ?? '').trim();
    if (!n) return 'その他の目的を入力してください';
    if (codePointLength(n) > CASH_LIMITS.purposeNoteMax)
      return `その他の目的は${CASH_LIMITS.purposeNoteMax}字以内で入力してください`;
    return null;
  }
  return note === null ? null : '目的の記述はその他のときだけ入力できます';
}

/* ======================== 入力検証 ======================== */

export interface CashInput {
  date: string;
  side: CashSide;
  io: CashIo;
  amount: number;
  description: string;
  categoryMajor: string;
  owner: string | null;
  memo: string | null;
  transitFrom: string | null;
  transitTo: string | null;
  transitRound: boolean;
  transitPurpose: string | null;
  transitPurposeNote: string | null;
}

export interface CashValidateOptions {
  /**
   * 担当者と業務の目的が「無い」ことを許す。API 用。
   * 0052 より前の SPA が送る本文(owner / transitPurpose を持たない)を通すための互換で、
   * 値があるときの検査は画面と同じ。画面は既定の false で両方を必須にする。
   */
  allowUnset?: boolean;
}

/**
 * 画面の入力を API の zod と同じ上限で確かめ、最初の 1 件の文を返す。
 * カテゴリが候補に含まれるかは候補表を持つ API が確かめる。
 */
export function validateCashInput(
  input: CashInput,
  { allowUnset = false }: CashValidateOptions = {},
): string | null {
  if (!isRealCashDate(input.date)) return '日付が正しくありません';
  if (input.side !== 'biz' && input.side !== 'per') return '事業か個人を選んでください';
  if (input.io !== 'income' && input.io !== 'expense') return '収入か支出を選んでください';
  if (!Number.isInteger(input.amount) || input.amount < 1) return '金額は1円以上の整数で入力してください';
  if (input.amount > CASH_LIMITS.amountMax) return '金額が大きすぎます';
  const description = input.description.trim();
  if (!description) return '内容を入力してください';
  if (codePointLength(description) > CASH_LIMITS.descriptionMax)
    return `内容は${CASH_LIMITS.descriptionMax}字以内で入力してください`;
  if (!input.categoryMajor.trim()) return 'カテゴリを選んでください';
  if (
    !(allowUnset && input.owner === null) &&
    !(OWNER_VALUES as readonly (string | null)[]).includes(input.owner)
  )
    return '担当者を選んでください';
  if (input.memo !== null && codePointLength(input.memo) > CASH_LIMITS.memoMax)
    return `メモは${CASH_LIMITS.memoMax}字以内で入力してください`;
  const from = input.transitFrom?.trim() || null;
  const to = input.transitTo?.trim() || null;
  if ((from === null) !== (to === null)) return '出発駅と到着駅の両方を入力してください';
  for (const s of [from, to])
    if (s !== null && codePointLength(s) > CASH_LIMITS.stationMax)
      return `駅名は${CASH_LIMITS.stationMax}字以内で入力してください`;
  const hasRoute = from !== null;
  if (hasRoute && input.io !== 'expense') return '交通費は支出として入力してください';
  if (!hasRoute && input.transitRound) return '往復は区間があるときだけ選べます';
  if (allowUnset && hasRoute && input.transitPurpose === null && input.transitPurposeNote === null)
    return null;
  return transitPurposeError(hasRoute, input.transitPurpose, input.transitPurposeNote);
}

/* ======================== 月 ======================== */

/** 対象期間 (YYYY-MM の両端を含む) の月を古い順に */
export function cashMonthsInPeriod(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i += 1) out.push(monthKey(i));
  return out;
}

/** 今日の月が期間内ならその月、外なら期間の最後の月 */
export function defaultCashMonth(months: readonly string[], today: string): string | null {
  if (months.length === 0) return null;
  const m = today.slice(0, 7);
  return months.includes(m) ? m : months[months.length - 1]!;
}

/** 月送り。期間の端では null (ボタンを無効にする) */
export function cashMonthNav(
  months: readonly string[],
  month: string,
): { prev: string | null; next: string | null } {
  const i = months.indexOf(month);
  if (i < 0) return { prev: null, next: null };
  return { prev: months[i - 1] ?? null, next: months[i + 1] ?? null };
}

/** 「{年}年{月}月」 */
export const cashMonthLabel = (m: string): string => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;

/* ======================== URL ======================== */

export type CashTab = 'normal' | 'transit';

export interface CashUrlState {
  tab: CashTab;
  /** null は既定の月 */
  month: string | null;
  filter: CashFilter;
  page: number;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const nonNegInt = (v: string | null): number | null =>
  v !== null && /^\d{1,10}$/.test(v) ? Number(v) : null;

/** URL の query から状態を読む。形式違い・候補外は既定に落とす */
export function readCashUrl(
  params: { get(key: string): string | null },
  months: readonly string[],
): CashUrlState {
  const tab = params.get('tab') === 'transit' ? 'transit' : 'normal';
  const m = params.get('month');
  const month = m !== null && MONTH_RE.test(m) && months.includes(m) ? m : null;
  const io = params.get('io');
  const owner = params.get('owner');
  const route = params.get('route');
  const from = params.get('from');
  const to = params.get('to');
  const page = nonNegInt(params.get('page'));
  return {
    tab,
    month,
    filter: {
      q: params.get('q') ?? '',
      io: io === 'income' || io === 'expense' ? io : null,
      category: params.get('category') || null,
      owner:
        owner === 'unset' || (OWNER_VALUES as readonly string[]).includes(owner ?? '')
          ? (owner as CashOwnerFilter)
          : null,
      route: route === 'normal' || route === 'transit' ? route : null,
      min: nonNegInt(params.get('min')),
      max: nonNegInt(params.get('max')),
      from: from !== null && isRealCashDate(from) ? from : null,
      to: to !== null && isRealCashDate(to) ? to : null,
    },
    page: page !== null && page >= 1 ? page : 1,
  };
}

/** 状態を URL の query へ。既定値のキーは付けない */
export function writeCashUrl(s: CashUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.tab !== 'normal') p.set('tab', s.tab);
  if (s.month) p.set('month', s.month);
  const f = s.filter;
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.io) p.set('io', f.io);
  if (f.category !== null) p.set('category', f.category);
  if (f.owner) p.set('owner', f.owner);
  if (f.route) p.set('route', f.route);
  if (f.min !== null) p.set('min', String(f.min));
  if (f.max !== null) p.set('max', String(f.max));
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (s.page > 1) p.set('page', String(s.page));
  return p;
}

/* ======================== 一括 ======================== */

/** 一括削除・一括の元に戻すの id 配列の検証。API の zod と同じ規則 */
export function cashBulkIdsError(ids: readonly unknown[]): string | null {
  if (ids.length === 0) return '明細を選んでください';
  if (ids.length > CASH_LIMITS.bulkMax) return `一度に削除できるのは${CASH_LIMITS.bulkMax}件までです`;
  if (!ids.every((v) => typeof v === 'number' && Number.isInteger(v) && v > 0))
    return '明細の指定が正しくありません';
  if (new Set(ids).size !== ids.length) return '同じ明細が重複しています';
  return null;
}

/* ======================== 下書き ======================== */

export const cashDraftKey = (userId: string): string => `${CASH_DRAFT_KEY_PREFIX}${userId}`;

export interface CashNormalDraft {
  date: string;
  side: CashSide;
  io: CashIo;
  /** 入力途中の文字列のまま */
  amount: string;
  description: string;
  categoryMajor: string;
  categoryMid: string;
  owner: Owner | '';
  memo: string;
}

export interface CashTransitDraft {
  from: string;
  to: string;
  oneWay: string;
  round: boolean;
  purpose: TransitPurpose | '';
  purposeNote: string;
  memo: string;
}

export interface CashDraft {
  normal: CashNormalDraft;
  transit: CashTransitDraft;
  savedAt: string;
}

/** localStorage と同じ形。テストでは Map で代用する */
export interface CashDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? truncateCodePoints(v, max) : '');

/** 保存の形へ寄せる。上限を超える値は上限で切り、候補外は空に戻す */
function sanitizeDraft(v: Partial<CashDraft>): Omit<CashDraft, 'savedAt'> {
  const n = (v.normal ?? {}) as Partial<CashNormalDraft>;
  const t = (v.transit ?? {}) as Partial<CashTransitDraft>;
  return {
    normal: {
      date: str(n.date, 10),
      side: n.side === 'per' ? 'per' : 'biz',
      io: n.io === 'income' ? 'income' : 'expense',
      amount: str(n.amount, 10),
      description: str(n.description, CASH_LIMITS.descriptionMax),
      categoryMajor: str(n.categoryMajor, 100),
      categoryMid: str(n.categoryMid, 100),
      owner: (OWNER_VALUES as readonly unknown[]).includes(n.owner) ? (n.owner as Owner) : '',
      memo: str(n.memo, CASH_LIMITS.memoMax),
    },
    transit: {
      from: str(t.from, CASH_LIMITS.stationMax),
      to: str(t.to, CASH_LIMITS.stationMax),
      oneWay: str(t.oneWay, 10),
      round: t.round !== false,
      purpose: isTransitPurpose(t.purpose) ? t.purpose : '',
      purposeNote: str(t.purposeNote, CASH_LIMITS.purposeNoteMax),
      memo: str(t.memo, CASH_LIMITS.memoMax),
    },
  };
}

/** 保存できたら保存した下書きを返す。例外は握って null (画面は止めない) */
export function saveCashDraft(
  storage: CashDraftStorage | null,
  userId: string,
  draft: Omit<CashDraft, 'savedAt'>,
  now: string,
): CashDraft | null {
  if (!storage) return null;
  try {
    const saved: CashDraft = { ...sanitizeDraft(draft), savedAt: now };
    storage.setItem(cashDraftKey(userId), JSON.stringify(saved));
    return saved;
  } catch {
    return null;
  }
}

/** 読めない・壊れた値は null (空の入力から始め、保存時刻を出さない) */
export function loadCashDraft(storage: CashDraftStorage | null, userId: string): CashDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(cashDraftKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CashDraft> | null;
    if (!v || typeof v !== 'object' || typeof v.savedAt !== 'string') return null;
    return { ...sanitizeDraft(v), savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function clearCashDraft(storage: CashDraftStorage | null, userId: string): void {
  try {
    storage?.removeItem(cashDraftKey(userId));
  } catch {
    /* 消せなくても次の保存で上書きされる */
  }
}

/** 「YYYY/MM/DD HH:MM」(利用者の時刻で表示する) */
export function cashDraftTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
