/**
 * 概況画面の集計・未処理キュー・月次クローズ判定。
 *
 * 契約の正本は `docs/overview-screen/architecture-decision.md` §2..§5。
 * - KPI・推移・年次比較・内訳は同じ `ScopeMonth[]` 1 本から出す (BR-001)。別々に集計すると総額がずれる。
 * - 未処理キューは全期間で作り、期間にも scope にも依存しない (BR-002・BR-003)。
 * - 推奨は乱数・時刻を使わない決定論 (BR-006)。
 * - 保留は明細本文を保存せず、内容指紋 (SHA-256) が一致する間だけ効く (BR-004)。
 */
import { isCashTxId } from './cash.js';
import { classifyStatus, classifySuggestion } from './classify-status.js';
import { resolveTx, ruleMatches } from './classify.js';
import { canonicalEncode } from './fingerprint.js';
import { sha256Hex } from './improvement.js';
import type { PeriodRange } from './period.js';
import type { ReconcileReview, TotalCashflowMonth } from './total-cashflow.js';
import { type Cls, type Dataset, type MfTx, type Rule, isMfBizByMid, isMfCountable } from './types.js';
import { type VendorMemoryRecord, normalizeVendorKey, vendorConfidence } from './vendor-memory.js';

// ---- 入力検証 (BR-007) ----

export const OVERVIEW_SCOPES = ['total', 'business', 'household'] as const;
export type OverviewScope = (typeof OVERVIEW_SCOPES)[number];
export const isOverviewScope = (v: unknown): v is OverviewScope =>
  typeof v === 'string' && (OVERVIEW_SCOPES as readonly string[]).includes(v);

export const REVIEW_ITEM_KINDS = ['reconciliation', 'classification', 'import'] as const;
export type ReviewItemKind = (typeof REVIEW_ITEM_KINDS)[number];
export const isReviewItemKind = (v: unknown): v is ReviewItemKind =>
  typeof v === 'string' && (REVIEW_ITEM_KINDS as readonly string[]).includes(v);

export const REVIEW_ITEM_KEY_MAX = 200;
export const isReviewItemKey = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= REVIEW_ITEM_KEY_MAX;

const CLOSE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isCloseMonth = (v: unknown): v is string => typeof v === 'string' && CLOSE_MONTH_RE.test(v);

// ---- 4 要素の集計 (FR-001) ----

/** scope ごとの 1 か月。categories は支出の科目別金額 (合計が expense) */
export interface ScopeMonth {
  month: string;
  income: number;
  expense: number;
  categories: Record<string, number>;
}

const sumValues = (rec: Record<string, number> | undefined): number =>
  Object.values(rec ?? {}).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

/** scope の出典から月別系列を作る。期間では切らない (前期の比較窓を欠かさないため) */
export function overviewScopeMonths(
  scope: OverviewScope,
  { data, totalMonths }: { data: Dataset; totalMonths: readonly TotalCashflowMonth[] },
): ScopeMonth[] {
  if (scope === 'total') {
    return totalMonths.map((m) => {
      // totalCashflowReport は総支出と同じ選別済み取引集合から科目別内訳も作る。
      // 古い投影には内訳が無いため、その場合だけ従来の事業/家計2分類へ安全に戻す。
      const categories = m.expenseCategories
        ? { ...m.expenseCategories }
        : { 事業費: m.bizExpense, 家計費: m.householdExpense };
      return { month: m.month, income: m.totalIncome, expense: sumValues(categories), categories };
    });
  }
  if (scope === 'business') {
    return data.months.map((month, i) => {
      const categories: Record<string, number> = {};
      for (const [label, series] of Object.entries(data.biz.expense)) categories[label] = series[i] ?? 0;
      return { month, income: data.biz.revenue[i] ?? 0, expense: sumValues(categories), categories };
    });
  }
  return Object.keys(data.personal)
    .sort()
    .map((month) => {
      const p = data.personal[month];
      const categories = { ...(p?.expense ?? {}) };
      return { month, income: sumValues(p?.income), expense: sumValues(categories), categories };
    });
}

export interface OverviewKpi {
  income: number;
  expense: number;
  balance: number;
  months: number;
}
export interface OverviewTrendPoint {
  month: string;
  income: number;
  expense: number;
  balance: number;
}
export interface OverviewComparisonRow {
  key: 'income' | 'expense' | 'balance';
  label: string;
  current: number;
  previous: number | null;
  delta: number | null;
  deltaRate: number | null;
}
export interface OverviewBreakdownItem {
  label: string;
  amount: number;
  share: number;
}
export interface OverviewAggregate {
  kpi: OverviewKpi;
  trend: OverviewTrendPoint[];
  yearComparison: { rows: OverviewComparisonRow[]; currentLabel: string; previousLabel: string | null };
  breakdown: { items: OverviewBreakdownItem[]; total: number };
}

export const OVERVIEW_WINDOW_MONTHS = 12;
export const OVERVIEW_BREAKDOWN_TOP = 5;
export const OVERVIEW_BREAKDOWN_OTHER = 'その他';

const monthLabel = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;

function breakdownOf(window: readonly ScopeMonth[]): OverviewAggregate['breakdown'] {
  const byLabel = new Map<string, number>();
  for (const m of window) {
    for (const [label, amount] of Object.entries(m.categories))
      byLabel.set(label, (byLabel.get(label) ?? 0) + amount);
  }
  const sorted = [...byLabel.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const top = sorted.slice(0, OVERVIEW_BREAKDOWN_TOP);
  const rest = sorted.slice(OVERVIEW_BREAKDOWN_TOP).reduce((s, [, amount]) => s + amount, 0);
  const rows = top.map(([label, amount]) => ({ label, amount }));
  if (sorted.length > OVERVIEW_BREAKDOWN_TOP) rows.push({ label: OVERVIEW_BREAKDOWN_OTHER, amount: rest });
  // 「その他」も含むため、表示行の合計はKPIの総支出と一致する。
  const total = rows.reduce((s, row) => s + row.amount, 0);
  return { items: rows.map((r) => ({ ...r, share: total === 0 ? 0 : r.amount / total })), total };
}

/** 'YYYY-MM' を通し月番号にする (暦の連続を比べるため) */
const monthOrdinal = (month: string): number =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

/**
 * 表示する期間 (range。null は全期間) の直近 12 か月を集計窓にし、KPI・年次比較の今期・内訳を同じ窓から出す。
 * 前期は窓の直前の暦で連続した同じ月数。系列に揃わなければ (欠けた月を含めて) null (欠けた月を 0 で埋めると前年比が嘘になる)。
 */
export function overviewAggregate(
  series: readonly ScopeMonth[],
  range: PeriodRange | null,
): OverviewAggregate {
  const visible = series.filter((m) => !range || (m.month >= range.from && m.month <= range.to));
  const k = Math.min(OVERVIEW_WINDOW_MONTHS, visible.length);
  const window = visible.slice(visible.length - k);
  const startIndex = window.length > 0 ? series.indexOf(window[0]) : -1;
  const candidate = k > 0 && startIndex >= k ? series.slice(startIndex - k, startIndex) : null;
  // 系列の要素数ではなく暦で揃える。途中に欠けた月があると「前 k か月」が k か月より長い期間を指してしまう
  const previous = candidate?.every((m, i) => monthOrdinal(m.month) === monthOrdinal(window[0].month) - k + i)
    ? candidate
    : null;

  const totals = (months: readonly ScopeMonth[]) => {
    const income = months.reduce((s, m) => s + m.income, 0);
    const expense = months.reduce((s, m) => s + m.expense, 0);
    return { income, expense, balance: income - expense };
  };
  const cur = totals(window);
  const prev = previous ? totals(previous) : null;
  const row = (key: OverviewComparisonRow['key'], label: string): OverviewComparisonRow => {
    const current = cur[key];
    const p = prev ? prev[key] : null;
    const delta = p === null ? null : current - p;
    return {
      key,
      label,
      current,
      previous: p,
      delta,
      deltaRate: p === null || p === 0 ? null : (delta ?? 0) / Math.abs(p),
    };
  };

  return {
    kpi: { ...cur, months: k },
    trend: visible.map((m) => ({
      month: m.month,
      income: m.income,
      expense: m.expense,
      balance: m.income - m.expense,
    })),
    yearComparison: {
      rows: [row('income', '総収入'), row('expense', '総支出'), row('balance', '純収支')],
      currentLabel:
        window.length > 0
          ? `${monthLabel(window[0].month)} - ${monthLabel(window[window.length - 1].month)}`
          : '',
      previousLabel: previous ? `前${k}か月` : null,
    },
    breakdown: breakdownOf(window),
  };
}

// ---- 未処理キュー (FR-002・FR-005) ----

export type RecommendationBasis = 'vendor_memory' | 'rule' | 'mf_mid' | 'none';

export interface Recommendation {
  recommendation: string | null;
  basis: RecommendationBasis;
  basisLabel: string;
  confidence: number | null;
}

export interface ReviewQueueItem extends Recommendation {
  kind: ReviewItemKind;
  itemKey: string;
  /** 符号付き (取込は 0) */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM */
  month: string;
  content: string;
}

export interface FailedImportRun {
  id: string;
  createdAt: string;
  failureReason: string | null;
}

const NO_RECOMMENDATION: Recommendation = {
  recommendation: null,
  basis: 'none',
  basisLabel: '根拠なし',
  confidence: null,
};

const CLS_LABEL: Record<Cls, string> = { biz: '事業', per: '家計' };

const labelOf = (
  cls: Cls | null | undefined,
  big: string | null | undefined,
  mid: string | null | undefined,
) => [cls ? CLS_LABEL[cls] : null, big, mid].filter((x): x is string => !!x).join(' / ');

/**
 * 推奨と根拠。vendor_memory → ルール → MF中項目 → なし の順で最初に当たったものだけを返す (BR-006)。
 *
 * 判定そのものは `classifySuggestion` が唯一の持ち主で、ここはその結果を
 * /review-queue の既存の形 (recommendation / basisLabel) へ写すだけである。
 * 優先順をこちらにも書くと、同じ明細に対して画面ごとに違う推奨が出る。
 */
export function recommendationFor(
  tx: MfTx | null,
  content: string,
  rules: readonly Rule[],
  vendorMemories: readonly VendorMemoryRecord[],
): Recommendation {
  const s = classifySuggestion(tx, content, rules, vendorMemories);
  if (!s.suggestion || s.basis === 'none') return { ...NO_RECOMMENDATION };
  return {
    recommendation: s.label,
    basis: s.basis,
    basisLabel: legacyBasisLabel(s.basis, tx, content, rules, vendorMemories),
    confidence: s.confidence,
  };
}

/** /review-queue が表示している短い根拠文。BR-08 の basisText とは別物なので分けて持つ */
function legacyBasisLabel(
  basis: Exclude<RecommendationBasis, 'none'>,
  tx: MfTx | null,
  content: string,
  rules: readonly Rule[],
  vendorMemories: readonly VendorMemoryRecord[],
): string {
  if (basis === 'vendor_memory') {
    const key = normalizeVendorKey(content);
    const memory = key ? vendorMemories.find((m) => !m.revoked && m.vendorKey === key) : undefined;
    if (memory) return `過去 ${memory.hitCount + memory.disagreeCount} 件中 ${memory.hitCount} 件`;
    return NO_RECOMMENDATION.basisLabel;
  }
  if (basis === 'rule') {
    const rule = tx ? rules.find((r) => ruleMatches(tx, r) && !!labelOf(r.cls, r.big, r.mid)) : undefined;
    return rule ? `ルール「${rule.k}」に一致` : NO_RECOMMENDATION.basisLabel;
  }
  return 'MF の中項目が「事業」';
}

const KIND_ORDER: Record<ReviewItemKind, number> = { reconciliation: 0, classification: 1, import: 2 };

function compareItems(a: ReviewQueueItem, b: ReviewQueueItem): number {
  return (
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    Math.abs(b.amount) - Math.abs(a.amount) ||
    (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
    (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0)
  );
}

/** MF 明細の月 (m) と表示日 (MM/DD) から YYYY-MM-DD を作る */
const mfDate = (t: MfTx): string => {
  const [mm, dd] = (t.d ?? '').split('/');
  const pad = (v: string | undefined, fallback: string) =>
    v && /^\d{1,2}$/.test(v) ? v.padStart(2, '0') : fallback;
  return `${t.m.slice(0, 4)}-${pad(mm, t.m.slice(5, 7))}-${pad(dd, '01')}`;
};

/** 全期間の未処理キュー (保留を除く前)。並びは種別 → 金額の絶対値降順 → 日付の新しい順 → itemKey */
export function buildReviewQueue({
  data,
  review,
  failedImports,
  vendorMemories,
}: {
  data: Dataset;
  review: readonly ReconcileReview[];
  failedImports: readonly FailedImportRun[];
  vendorMemories: readonly VendorMemoryRecord[];
}): ReviewQueueItem[] {
  const txById = new Map(data.mfTx.map((t) => [t.id, t]));
  const reviewIds = new Set(review.map((r) => r.mfTxId));
  const items: ReviewQueueItem[] = [];

  for (const r of review) {
    const amount = r.mf.io === 'expense' ? -Math.abs(r.mf.amount) : Math.abs(r.mf.amount);
    items.push({
      kind: 'reconciliation',
      itemKey: r.mfTxId,
      amount,
      date: r.mf.date,
      month: r.mf.date.slice(0, 7),
      content: r.mf.content,
      ...recommendationFor(txById.get(r.mfTxId) ?? null, r.mf.content, data.rules, vendorMemories),
    });
  }

  // 仕分け画面の「未確認 (clsSrc=既定)」とは母数が違う: 現金の記帳は取込値ではないので直す対象にせず、
  // 分割の射影は親で 1 件、照合待ちに載った明細は照合側で 1 件と数え、同じ明細を二重に数えない
  for (const t of data.mfTx) {
    if (isCashTxId(t.id) || !isMfCountable(t) || t.splitProjection != null || reviewIds.has(t.id)) continue;
    const content = t.c ?? '';
    const resolved = resolveTx(t, data.rules, data.edits, data.institutionOwners);
    const suggestion = classifySuggestion(t, content, data.rules, vendorMemories);
    const edit = data.edits[t.id];
    if (
      classifyStatus({
        clsSrc: resolved.clsSrc,
        origin: edit?.origin,
        matchedProposal: edit?.matchedProposal,
        confidence: suggestion.confidence,
        conflict: suggestion.conflict,
        contradiction: suggestion.contradiction,
      }).status !== 'unsorted'
    )
      continue;
    items.push({
      kind: 'classification',
      itemKey: t.id,
      amount: t.a,
      date: mfDate(t),
      month: t.m,
      content,
      ...recommendationFor(t, content, data.rules, vendorMemories),
    });
  }

  for (const run of failedImports) {
    items.push({
      kind: 'import',
      itemKey: run.id,
      amount: 0,
      date: run.createdAt.slice(0, 10),
      month: run.createdAt.slice(0, 7),
      content: run.failureReason ?? '',
      ...NO_RECOMMENDATION,
    });
  }

  return items.sort(compareItems);
}

// ---- 保留 (FR-003) ----

export interface ReviewSnooze {
  kind: ReviewItemKind;
  itemKey: string;
  fingerprint: string;
}

/** 内容指紋。本文そのものは保存しない (spec セキュリティ確認)。型+長さで符号化するので区切り文字で衝突しない */
export function reviewItemFingerprint(
  item: Pick<ReviewQueueItem, 'amount' | 'date' | 'content'>,
): Promise<string> {
  return sha256Hex(canonicalEncode([item.amount, item.date, item.content]));
}

/** 指紋が今の明細と一致する保留だけを除く。不一致の保留は無視する (削除は GET の副作用にしない) */
export async function applyReviewSnoozes(
  items: readonly ReviewQueueItem[],
  snoozes: readonly ReviewSnooze[],
): Promise<{ items: ReviewQueueItem[]; snoozed: ReviewQueueItem[]; snoozedCount: number }> {
  const byKey = new Map(snoozes.map((s) => [`${s.kind}\0${s.itemKey}`, s.fingerprint]));
  const visible: ReviewQueueItem[] = [];
  // 解除 (FR-003) の対象として画面に並べる。指紋が外れた保留は既に未処理へ戻っているので含めない
  const snoozed: ReviewQueueItem[] = [];
  for (const item of items) {
    const saved = byKey.get(`${item.kind}\0${item.itemKey}`);
    if (saved !== undefined && saved === (await reviewItemFingerprint(item))) {
      snoozed.push(item);
    } else {
      visible.push(item);
    }
  }
  return { items: visible, snoozed, snoozedCount: snoozed.length };
}

export function reviewQueueCounts(items: readonly ReviewQueueItem[]): Record<ReviewItemKind, number> {
  const counts: Record<ReviewItemKind, number> = { reconciliation: 0, classification: 0, import: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

// ---- 月次クローズ (FR-004・BR-005) ----

export type CloseStepKey = 'import' | 'classification' | 'reconciliation' | 'review';

export interface CloseStep {
  key: CloseStepKey;
  label: string;
  done: boolean;
  count: number | null;
}

export interface MonthlyCloseStatus {
  month: string | null;
  steps: CloseStep[];
  doneCount: number;
  total: 4;
  reviewedAt: string | null;
}

/**
 * 対象月はデータの最終月。呼び出し側が指紋の一致する保留を除いた `items` を渡し、
 * ここで対象月だけに絞る。キューとクローズが別々の集合を数えないための単一契約。
 */
export function monthlyCloseStatus({
  data,
  items,
  reviews,
  hasCommittedImport,
}: {
  data: Dataset;
  items: readonly ReviewQueueItem[];
  reviews: readonly { month: string; reviewedAt: string }[];
  /** 対象月を含む committed の取込があるか。手入力の現金だけで月が立っても「取込済み」にしない */
  hasCommittedImport: boolean;
}): MonthlyCloseStatus {
  const month = data.months.length > 0 ? data.months[data.months.length - 1] : null;
  const counts = reviewQueueCounts(month ? items.filter((item) => item.month === month) : []);
  const reviewedAt = month ? (reviews.find((r) => r.month === month)?.reviewedAt ?? null) : null;
  const steps: CloseStep[] = [
    {
      key: 'import',
      label: 'データ取込',
      done:
        month !== null &&
        hasCommittedImport &&
        !data.unrecordedExpMonths.includes(month) &&
        counts.import === 0,
      count: null,
    },
    {
      key: 'classification',
      label: '仕分け',
      done: month !== null && counts.classification === 0,
      count: counts.classification,
    },
    {
      key: 'reconciliation',
      label: '照合',
      done: month !== null && counts.reconciliation === 0,
      count: counts.reconciliation,
    },
    { key: 'review', label: '月次レビュー', done: reviewedAt !== null, count: null },
  ];
  return { month, steps, doneCount: steps.filter((s) => s.done).length, total: 4, reviewedAt };
}
