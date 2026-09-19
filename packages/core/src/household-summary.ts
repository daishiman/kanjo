/**
 * 家計収支画面の集計 (spec-household-cashflow-screen §12)。
 *
 * 入力は総収支と同じ台帳 (`totalCashflowLedger` の `ledger.rows`) に限る。家計画面が独自の
 * 選別 (振替・二重計上・要確認の扱い) を持つと、同じ月の総収入が総収支画面と家計画面で
 * 食い違い、どちらが正しいかを利用者が決められなくなる。
 *
 * 期間の切り方も `totalCashflowScreen` の `reportFor` と同じにする (期間で Dataset を切り、
 * 期間内の月の freee 取引だけを渡す)。前年も同じ関数で作り直す。
 */
import { isCashTxId } from './cash.js';
import { resolveTx } from './classify.js';
import { OWNER_LABEL_KEYS, type OwnerLabels, resolveOwnerLabels } from './owner-labels.js';
import {
  type PeriodRange,
  applyPeriod,
  changeFromPrevious,
  periodMonths,
  previousYearPeriod,
} from './period.js';
import {
  type DuplicateVerdict,
  type FreeeExclusion,
  type SegmentChange,
  type SegmentTotals,
  TREND_PAYEE_UNKNOWN,
  type TrendSourceRow,
  mfMatchDate,
  totalCashflowLedger,
} from './total-cashflow.js';
import type { Dataset, FreeeDeal, MfTx, OwnerKey } from './types.js';

/* ======================== 生活費の 6 区分 (§5.1) ======================== */

export const HOUSEHOLD_CATEGORY_KEYS = [
  'housing',
  'food',
  'utilities',
  'education',
  'transport',
  'other',
] as const;
export type HouseholdCategoryKey = (typeof HOUSEHOLD_CATEGORY_KEYS)[number];

export interface HouseholdCategoryDef {
  key: HouseholdCategoryKey;
  label: string;
  /** 家計側の大項目。`other` は空 (上記以外すべて) */
  majors: readonly string[];
  /** 注記 `「<表示名>」に該当する取引（…等）` の例示 */
  examples: string;
}

/**
 * 区分と大項目の対応表。正本はここ 1 か所 (docs/data-schema.md の表はこの写しで、テストで一致を検査する)。
 *
 * `住宅` と `自動車` は MF の実エクスポートに現れる大項目の別名 (spec の表の `住まい` / `車・バイク` と同じ意味)。
 * 別名を入れないと、実データの住居費・交通費がすべて `その他` へ落ちる。
 */
export const HOUSEHOLD_CATEGORY_MAP: readonly HouseholdCategoryDef[] = [
  {
    key: 'housing',
    label: '住居費',
    majors: ['住まい', '住宅ローン', '住宅購入', '住宅'],
    examples: '家賃・住宅ローン・管理費等',
  },
  { key: 'food', label: '食費', majors: ['食費'], examples: '食料品・外食・飲料等' },
  { key: 'utilities', label: '光熱費', majors: ['水道・光熱費'], examples: '電気・ガス・水道等' },
  { key: 'education', label: '教育費', majors: ['教養・教育', '子育て'], examples: '学費・習い事・書籍等' },
  {
    key: 'transport',
    label: '交通費',
    majors: ['交通費', '車・バイク', '自動車'],
    examples: '電車・バス・ガソリン等',
  },
  { key: 'other', label: 'その他', majors: [], examples: '日用品・通信費・事業の支出等' },
];

const CATEGORY_BY_KEY = new Map(HOUSEHOLD_CATEGORY_MAP.map((c) => [c.key, c]));
const KEY_BY_MAJOR = new Map(HOUSEHOLD_CATEGORY_MAP.flatMap((c) => c.majors.map((m) => [m, c.key] as const)));

export const isHouseholdCategoryKey = (v: unknown): v is HouseholdCategoryKey =>
  typeof v === 'string' && (HOUSEHOLD_CATEGORY_KEYS as readonly string[]).includes(v);

/**
 * 支出行の区分。事業側の行は大項目が `食費` でも `other` に入れる。
 * 家計の生活費の区分に事業の支出を混ぜると、6 区分の和が総支出と一致しても「食費」の意味が変わる。
 */
export function householdCategoryOf(row: Pick<TrendSourceRow, 'side' | 'category'>): HouseholdCategoryKey {
  if (row.side === 'business') return 'other';
  return KEY_BY_MAJOR.get(row.category) ?? 'other';
}

export const householdCategoryNote = (key: HouseholdCategoryKey): string => {
  const def = CATEGORY_BY_KEY.get(key)!;
  return `「${def.label}」に該当する取引（${def.examples}）を自動で分類して集計しています。`;
};

/* ======================== 振替の対推定 (§6.2) ======================== */

/** 振替の組にする日付差の上限 (日) */
export const TRANSFER_PAIR_MAX_DAYS = 3;

export interface TransferParty {
  /** null = 相手不明 */
  owner: OwnerKey | null;
  label: string;
}

export interface TransferRow {
  date: string;
  month: string;
  description: string;
  amount: number;
  from: TransferParty;
  to: TransferParty;
  paired: boolean;
}

export const TRANSFER_UNKNOWN_LABEL = '相手不明';

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/**
 * 振替明細を出金と入金の組にする。純関数・決定論。
 *
 * 候補は「金額の絶対値が等しく、符号が逆で、日付差が 3 日以内」の組。日付差の小さい順 →
 * 出金側の日付 → 出金側の id → 入金側の id の昇順で貪欲に確定し、1 明細は 1 組にしか入らない。
 * 組にならない明細は 1 明細 1 行で、相手を `相手不明` にする。
 */
export function pairTransfers(
  txs: readonly MfTx[],
  ownerOf: (tx: MfTx) => OwnerKey,
  labels: OwnerLabels = resolveOwnerLabels(),
): TransferRow[] {
  const outs = txs.filter((tx) => tx.a < 0);
  const ins = txs.filter((tx) => tx.a > 0);
  const candidates: { out: MfTx; inn: MfTx; gap: number; outDate: string }[] = [];
  for (const out of outs) {
    const outDate = mfMatchDate(out);
    for (const inn of ins) {
      if (Math.abs(out.a) !== inn.a) continue;
      const gap = Math.abs(dayNumber(mfMatchDate(inn)) - dayNumber(outDate));
      if (gap <= TRANSFER_PAIR_MAX_DAYS) candidates.push({ out, inn, gap, outDate });
    }
  }
  candidates.sort(
    (a, b) =>
      a.gap - b.gap ||
      a.outDate.localeCompare(b.outDate) ||
      a.out.id.localeCompare(b.out.id) ||
      a.inn.id.localeCompare(b.inn.id),
  );

  const used = new Set<string>();
  const party = (tx: MfTx): TransferParty => {
    const owner = ownerOf(tx);
    return { owner, label: labels[owner] };
  };
  const unknown: TransferParty = { owner: null, label: TRANSFER_UNKNOWN_LABEL };
  const rows: (TransferRow & { id: string })[] = [];
  for (const { out, inn, outDate } of candidates) {
    if (used.has(out.id) || used.has(inn.id)) continue;
    used.add(out.id);
    used.add(inn.id);
    rows.push({
      id: out.id,
      date: outDate,
      month: out.m,
      description: out.c,
      amount: Math.abs(out.a),
      from: party(out),
      to: party(inn),
      paired: true,
    });
  }
  for (const tx of txs) {
    if (used.has(tx.id) || tx.a === 0) continue;
    const self = party(tx);
    rows.push({
      id: tx.id,
      date: mfMatchDate(tx),
      month: tx.m,
      description: tx.c,
      amount: Math.abs(tx.a),
      from: tx.a < 0 ? self : unknown,
      to: tx.a < 0 ? unknown : self,
      paired: false,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return rows.map(({ id: _id, ...row }) => row);
}

/* ======================== 画面の集計 ======================== */

export interface HouseholdInput {
  all: Dataset;
  deals: readonly FreeeDeal[];
  verdicts: readonly DuplicateVerdict[];
  exclusions: readonly FreeeExclusion[];
  mfExcludedTxIds?: readonly string[];
  range: PeriodRange;
  /** 選択中の月。期間外・未指定は期間の最終月 */
  month?: string | null;
  /** 保存済みの表示名 (部分でもよい) */
  labels?: Partial<Record<OwnerKey, string>> | null;
}

export interface HouseholdSegmentTotals extends SegmentTotals {
  /** その区分の収入 ÷ 家計全体の総収入。総収入 0 なら null */
  incomeShare: number | null;
}

export interface HouseholdSeriesRow {
  month: string;
  total: SegmentTotals;
  biz: SegmentTotals;
  personal: SegmentTotals;
  /** 前年同月の実データ。前年同月が未記帳なら null */
  previous: { total: SegmentTotals; biz: SegmentTotals; personal: SegmentTotals } | null;
}

export interface HouseholdCategoryRow {
  key: HouseholdCategoryKey;
  label: string;
  current: number;
  previous: number | null;
  diff: number | null;
  rate: number | null;
  /** 当期合計に占める比 (丸めない)。総支出 0 なら null */
  share: number | null;
}

export interface HouseholdOwnerRow {
  owner: OwnerKey;
  label: string;
  current: number;
  previous: number | null;
  diff: number | null;
}

export interface HouseholdSummary {
  range: PeriodRange;
  months: string[];
  selectedMonth: string;
  summary: {
    total: SegmentTotals;
    monthlyAverage: SegmentTotals;
    annualized: SegmentTotals;
    recordedMonths: number;
    /** 期間内で実際に集計した台帳行。空状態の正本。 */
    ledgerRowCount: number;
    previousYear: SegmentTotals | null;
    change: { income: SegmentChange; expense: SegmentChange; balance: SegmentChange } | null;
  };
  segments: { biz: HouseholdSegmentTotals; personal: HouseholdSegmentTotals };
  series: HouseholdSeriesRow[];
  categories: HouseholdCategoryRow[];
  /** URL に `cat` が無いときに選ぶ区分 (前年差が最大。前年が比較不能なら住居費) */
  defaultCategory: HouseholdCategoryKey;
  owners: HouseholdOwnerRow[];
  transfers: { month: string; rows: TransferRow[]; totalCount: number };
  /** 件数の最も多い取込元と、それ以外の取込元の数。取込元が無ければ null */
  sources: { primary: string; otherCount: number } | null;
  /** 表示名 (4 名義ぶん)。画面はこれを使い、内部値を写し直さない */
  labels: OwnerLabels;
}

const shiftYear = (month: string, years: number): string =>
  `${String(Number(month.slice(0, 4)) + years).padStart(4, '0')}${month.slice(4)}`;

const zero = (): SegmentTotals => ({ income: 0, expense: 0, balance: 0 });

const add = (acc: SegmentTotals, row: Pick<TrendSourceRow, 'io' | 'amount'>): void => {
  if (row.io === 'income') acc.income += row.amount;
  else acc.expense += row.amount;
  acc.balance = acc.income - acc.expense;
};

/** 期間で切った Dataset と、同じ判定を通った台帳行 (総収支画面の reportFor と同じ切り方) */
function ledgerFor(input: HouseholdInput, range: PeriodRange): { sliced: Dataset; rows: TrendSourceRow[] } {
  const sliced = applyPeriod(input.all, range);
  const months = new Set(sliced.months);
  const { ledger } = totalCashflowLedger(
    sliced,
    input.deals.filter((d) => months.has(d.month)),
    input.verdicts,
    input.exclusions,
    input.mfExcludedTxIds ?? [],
  );
  return { sliced, rows: ledger.rows };
}

interface Tally {
  total: SegmentTotals;
  biz: SegmentTotals;
  personal: SegmentTotals;
  byMonth: Map<string, { total: SegmentTotals; biz: SegmentTotals; personal: SegmentTotals }>;
  categories: Map<HouseholdCategoryKey, number>;
  owners: Map<OwnerKey, number>;
}

function tally(rows: readonly TrendSourceRow[]): Tally {
  const t: Tally = {
    total: zero(),
    biz: zero(),
    personal: zero(),
    byMonth: new Map(),
    categories: new Map(HOUSEHOLD_CATEGORY_KEYS.map((k) => [k, 0])),
    owners: new Map(OWNER_LABEL_KEYS.map((k) => [k, 0])),
  };
  for (const row of rows) {
    let month = t.byMonth.get(row.month);
    if (!month) {
      month = { total: zero(), biz: zero(), personal: zero() };
      t.byMonth.set(row.month, month);
    }
    const seg = row.side === 'business' ? 'biz' : 'personal';
    add(t.total, row);
    add(t[seg], row);
    add(month.total, row);
    add(month[seg], row);
    if (row.io === 'expense') {
      const key = householdCategoryOf(row);
      t.categories.set(key, (t.categories.get(key) ?? 0) + row.amount);
    } else {
      t.owners.set(row.owner, (t.owners.get(row.owner) ?? 0) + row.amount);
    }
  }
  return t;
}

/** 期間内の振替明細 (現金明細・分割の派生行を除く) */
const transferTxs = (data: Dataset): MfTx[] =>
  data.mfTx.filter((tx) => tx.isTransfer === true && !isCashTxId(tx.id) && tx.splitProjection == null);

function sourcesOf(rows: readonly TrendSourceRow[]): HouseholdSummary['sources'] {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.account) counts.set(row.account, (counts.get(row.account) ?? 0) + 1);
  if (counts.size === 0) return null;
  // 同数は名前の昇順で先。並びが取込順で揺れないようにする
  const [primary] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { primary, otherCount: counts.size - 1 };
}

/** 選択中の月。期間外・未指定・壊れた値は期間の最終月 */
function selectedMonthOf(range: PeriodRange, month: string | null | undefined): string {
  return month && month >= range.from && month <= range.to && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? month
    : range.to;
}

/**
 * 家計収支画面の値を 1 回の呼び出しでまとめて作る。
 *
 * 不変条件 (テストで固定):
 * 1. `summary.total` = `totalCashflowScreen(...)` の `summary.total` (収入・支出・純収支)
 * 2. 全月と期間合計で `biz + personal = total`
 * 3. `categories[].current` の和 = 総支出
 * 4. `owners[].current` の和 = 総収入
 * 5. 振替明細は台帳行に現れない (台帳が `isMfCountable` で除く)
 */
export function householdSummary(input: HouseholdInput): HouseholdSummary {
  return householdSummaryFromLedger(input, ledgerFor(input, input.range));
}

/** 詳細と概要が同じ期間台帳を共有し、重い消し込みを二重実行しないための内部投影。 */
function householdSummaryFromLedger(
  input: HouseholdInput,
  current: ReturnType<typeof ledgerFor>,
): HouseholdSummary {
  const { range } = input;
  const labels = resolveOwnerLabels(input.labels);
  const months = periodMonths(range);
  const known = new Set(input.all.months);
  const selectedMonth = selectedMonthOf(range, input.month);

  const now = tally(current.rows);

  // 前年同期は全月が揃っているときだけ比較する (BR-006)。欠けた月を 0 と数えると増減が実態と逆に出る
  const prevRange = previousYearPeriod(range);
  const prevMonths = periodMonths(prevRange);
  const prevComplete = prevMonths.every((m) => known.has(m));
  // 月ごとの前年系列は、期間全体が揃っていなくても前年同月の実データがあれば描く (§4.4)
  const prevAny = prevMonths.some((m) => known.has(m));
  const before = prevAny ? tally(ledgerFor(input, prevRange).rows) : null;
  const prevTotals = prevComplete && before ? before : null;

  const recordedMonths = months.filter((m) => known.has(m)).length;
  const avg = (v: number): number => (recordedMonths === 0 ? 0 : Math.round(v / recordedMonths));
  const monthlyAverage = {
    income: avg(now.total.income),
    expense: avg(now.total.expense),
    balance: avg(now.total.balance),
  };

  const share = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

  const categories: HouseholdCategoryRow[] = HOUSEHOLD_CATEGORY_MAP.map((def) => {
    const cur = now.categories.get(def.key) ?? 0;
    const prev = prevTotals ? (prevTotals.categories.get(def.key) ?? 0) : null;
    const change = prev == null ? null : changeFromPrevious(cur, prev);
    return {
      key: def.key,
      label: def.label,
      current: cur,
      previous: prev,
      diff: change?.diff ?? null,
      rate: change?.rate ?? null,
      share: share(cur, now.total.expense),
    };
  });

  // 前年差が最大の区分 (同額なら固定順で先)。比較不能なら住居費
  let defaultCategory: HouseholdCategoryKey = 'housing';
  if (prevTotals) {
    let best = Number.NEGATIVE_INFINITY;
    for (const row of categories) {
      if (row.diff != null && row.diff > best) {
        best = row.diff;
        defaultCategory = row.key;
      }
    }
  }

  const owners: HouseholdOwnerRow[] = OWNER_LABEL_KEYS.map((owner) => {
    const cur = now.owners.get(owner) ?? 0;
    const prev = prevTotals ? (prevTotals.owners.get(owner) ?? 0) : null;
    return {
      owner,
      label: labels[owner],
      current: cur,
      previous: prev,
      diff: prev == null ? null : cur - prev,
    };
  });

  const series: HouseholdSeriesRow[] = months.map((month) => {
    const row = now.byMonth.get(month) ?? { total: zero(), biz: zero(), personal: zero() };
    const prevMonth = shiftYear(month, -1);
    const prev =
      before && known.has(prevMonth)
        ? (before.byMonth.get(prevMonth) ?? { total: zero(), biz: zero(), personal: zero() })
        : null;
    return { month, ...row, previous: prev };
  });

  const resolveOwner = (tx: MfTx): OwnerKey =>
    resolveTx(tx, input.all.rules, input.all.edits, input.all.institutionOwners).owner ?? 'unset';
  const transferRows = pairTransfers(transferTxs(current.sliced), resolveOwner, labels).filter(
    (row) => row.month === selectedMonth,
  );

  return {
    range,
    months,
    selectedMonth,
    summary: {
      total: now.total,
      monthlyAverage,
      annualized: {
        income: monthlyAverage.income * 12,
        expense: monthlyAverage.expense * 12,
        balance: monthlyAverage.balance * 12,
      },
      recordedMonths,
      ledgerRowCount: current.rows.length,
      previousYear: prevTotals ? prevTotals.total : null,
      change: prevTotals
        ? {
            income: changeFromPrevious(now.total.income, prevTotals.total.income),
            expense: changeFromPrevious(now.total.expense, prevTotals.total.expense),
            balance: changeFromPrevious(now.total.balance, prevTotals.total.balance),
          }
        : null,
    },
    segments: {
      biz: { ...now.biz, incomeShare: share(now.biz.income, now.total.income) },
      personal: { ...now.personal, incomeShare: share(now.personal.income, now.total.income) },
    },
    series,
    categories,
    defaultCategory,
    owners,
    transfers: { month: selectedMonth, rows: transferRows, totalCount: transferRows.length },
    sources: sourcesOf(current.rows),
    labels,
  };
}

/* ======================== カテゴリの詳細 (§5.3) ======================== */

export const HOUSEHOLD_DETAIL_LIMIT = 5;

export interface HouseholdTransaction {
  date: string;
  description: string;
  amount: number;
  payee: string;
  owner: { owner: OwnerKey; label: string };
}

export interface HouseholdCategoryDetail {
  key: HouseholdCategoryKey;
  label: string;
  range: PeriodRange;
  current: number;
  previous: number | null;
  diff: number | null;
  rate: number | null;
  month: string;
  /** 選択月の区分合計。`totalCount` 件すべての金額の和 (5 件は表示の打ち切り) */
  monthTotal: number;
  transactions: HouseholdTransaction[];
  totalCount: number;
  rule: { majors: string[]; note: string };
  detailHref: string;
  /** `other` だけ。家計の残りと事業の支出 */
  breakdown?: { household: number; business: number };
}

/**
 * 明細画面への絞り込みリンク。大項目が複数なら `big` を並べる。
 * `その他` は対応する大項目を持たない (「どれにも当たらない」は列挙できない) ので `hcat=other` で渡す。
 * 大項目名は URL の区切り文字だけを符号化する (spec の逐語 `big=食費` を保つ)。
 */
export function householdDetailHref(key: HouseholdCategoryKey, month: string): string {
  const majors = CATEGORY_BY_KEY.get(key)!.majors;
  if (majors.length === 0) return `/classify?month=${month}&hcat=${key}`;
  const safe = (m: string) => m.replace(/[&#%+=?]/g, (ch) => encodeURIComponent(ch));
  return `/classify?month=${month}${majors.map((m) => `&big=${safe(m)}`).join('')}`;
}

/** 明細画面の 1 行が家計のどの区分に入るか。家計画面の集計と同じ判定 (事業側は `その他`) */
export const householdCategoryOfTx = (tx: { cls: 'biz' | 'per'; big: string | null }): HouseholdCategoryKey =>
  householdCategoryOf({ side: tx.cls === 'biz' ? 'business' : 'household', category: tx.big ?? '' });

export function householdCategoryDetail(
  input: HouseholdInput & { key: HouseholdCategoryKey },
): HouseholdCategoryDetail {
  const def = CATEGORY_BY_KEY.get(input.key)!;
  const current = ledgerFor(input, input.range);
  const summary = householdSummaryFromLedger(input, current);
  const row = summary.categories.find((c) => c.key === input.key)!;
  const month = summary.selectedMonth;
  const { sliced, rows } = current;
  const txById = new Map(sliced.mfTx.map((tx) => [tx.id, tx]));

  const inMonth = rows
    .filter((r) => r.month === month && r.io === 'expense' && householdCategoryOf(r) === input.key)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.txId ?? '').localeCompare(b.txId ?? ''));

  // MF の明細は「内容」を内容に、メモを取引先に出す (MF に取引先の列が無いため)。
  // freee は勘定科目を内容に、取引先を取引先に出す
  const toView = (r: TrendSourceRow): HouseholdTransaction => {
    const tx = r.txId ? txById.get(r.txId) : undefined;
    return {
      date: r.date,
      description: r.origin === 'mf' ? r.payee : r.category,
      amount: r.amount,
      payee: r.origin === 'mf' ? tx?.memo?.trim() || TREND_PAYEE_UNKNOWN : r.payee,
      owner: { owner: r.owner, label: summary.labels[r.owner] },
    };
  };

  const detail: HouseholdCategoryDetail = {
    key: def.key,
    label: def.label,
    range: input.range,
    current: row.current,
    previous: row.previous,
    diff: row.diff,
    rate: row.rate,
    month,
    monthTotal: inMonth.reduce((sum, r) => sum + r.amount, 0),
    transactions: inMonth.slice(0, HOUSEHOLD_DETAIL_LIMIT).map(toView),
    totalCount: inMonth.length,
    rule: { majors: [...def.majors], note: householdCategoryNote(def.key) },
    detailHref: householdDetailHref(def.key, month),
  };
  if (def.key === 'other') {
    let household = 0;
    let business = 0;
    for (const r of rows) {
      if (r.io !== 'expense' || householdCategoryOf(r) !== 'other') continue;
      if (r.side === 'business') business += r.amount;
      else household += r.amount;
    }
    detail.breakdown = { household, business };
  }
  return detail;
}
