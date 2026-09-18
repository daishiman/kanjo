/**
 * サブスク画面 (整える > サブスク) の算出。画面が出す数字はすべてここで1回だけ求め、
 * API は JSON へ写すだけにする (一覧の合計行・KPI・年換算比較・サイドバーのバッジが同じ値になるように)。
 *
 * - 明細は照合後の実質支出 (`buildExpenseProjection(...).effectiveExpenses`)。MF と freee の二重計上を数えない。
 * - 登録済みの照合は `registeredVendorOf` (既存のサブスク集計と同じ規則)。
 * - 直近12か月の支払額・売上比は既存 `subscriptions()` に通して得る (別経路で数えない)。
 *
 * `subs.ts` に置かないのは、`expense-projection.ts` が `subs.ts` を import しており循環になるため。
 */
import { subsReviewStatus, subsSpendAlerts, subscriptions } from './analysis.js';
import { type AccountKind, accountKindOf, isCashTxId } from './cash.js';
import { ensureMonth } from './dataset.js';
import { type ExpenseFact, buildExpenseProjection, registeredVendorOf } from './expense-projection.js';
import { type PeriodRange, applyPeriod } from './period.js';
import { type SubVendor, subsCandidates, vendorKey } from './subs.js';
import type { Dataset, FreeeDeal } from './types.js';

/** 取引名→ベンダー名/別名/除外名の全経路で共有する上限 */
export const SUB_VENDOR_NAME_MAX = 120;

/* ======================== 入出力の型 ======================== */

export interface SubscriptionsScreenVendor {
  id: number;
  name: string;
  aliases: string[];
  accounts: string[];
  /** 利用者のカテゴリ上書き。null は既定辞書に従う */
  category: string | null;
  reviewedAt: string | null;
}

export type SubsReviewDecisionKind = 'confirmed' | 'dismissed';

export interface SubsReviewDecision {
  vendorKey: string;
  decision: SubsReviewDecisionKind;
  ruleFingerprint: string;
}

export interface SubscriptionsScreenInput {
  /** 期間で切る前の Dataset (前期間・年額払いの判定に要る) */
  all: Dataset;
  deals: readonly FreeeDeal[];
  /** null は全期間 */
  range: PeriodRange | null;
  vendors: readonly SubscriptionsScreenVendor[];
  decisions: readonly SubsReviewDecision[];
  /** 「サブスクではない」と記録した取引先 */
  exclusions: readonly string[];
  generatedAt: string;
}

/** 表示順 = この配列の順 */
export const SUBS_REVIEW_RULES = ['dup', 'spike', 'priceUp', 'overlap', 'reviewDue'] as const;
export type SubsReviewRule = (typeof SUBS_REVIEW_RULES)[number];

export interface SubscriptionRowReview {
  state: 'pending' | 'confirmed';
  rules: SubsReviewRule[];
  fingerprint: string;
  reasons: string[];
}

export interface SubscriptionRow {
  vendorKey: string;
  vendorId: number | null;
  status: 'registered' | 'unregistered';
  displayName: string;
  normalizedName: string;
  /** 期間内でこのベンダーに照合した異なる取引名の数 */
  matchedNameCount: number;
  latestAmount: number;
  estimatedMonthly: number;
  annualized: number;
  billing: 'monthly' | 'annual';
  active: boolean;
  category: string;
  categorySource: 'dictionary' | 'override';
  review: SubscriptionRowReview | null;
}

export interface CoverageBucket {
  /** 期間の (口座 × 月) のうち明細がある割合。口座 0 件は null */
  percent: number | null;
  /** 期間の最終月に明細がある口座数 */
  imported: number;
  accounts: number;
}

export interface SubscriptionsScreen {
  period: PeriodRange | null;
  previousPeriod: PeriodRange | null;
  generatedAt: string;
  kpis: {
    monthlyTotal: number;
    monthlyTotalPrev: number | null;
    annualized: number;
    annualizedPrev: number | null;
    last12Total: number;
    revenueShare: number | null;
    reviewCandidates: number;
  };
  coverage: { bank: CoverageBucket; card: CoverageBucket; emoney: CoverageBucket; unclassified: number };
  rows: SubscriptionRow[];
  trend: { months: string[]; series: { category: string; values: number[] }[] };
  comparison: {
    category: string;
    monthly: number;
    annualized: number;
    share: number;
    prevMonthly: number | null;
  }[];
  comparisonTotal: { monthly: number; annualized: number; prevMonthly: number | null };
}

export interface SubscriptionTransaction {
  date: string;
  name: string;
  source: AccountKind;
  amount: number;
}

export interface SubscriptionVendorDetail {
  vendorKey: string;
  vendorId: number | null;
  row: SubscriptionRow;
  rawNames: { name: string; source: AccountKind; count: number }[];
  estimatedMonthly: number;
  annualized: number;
  /** 期間内の全件を新しい順。概要タブは先頭 3 件 */
  recent: SubscriptionTransaction[];
  transactionCount: number;
  bySource: { source: AccountKind; count: number }[];
  related: { aliases: string[]; accounts: string[]; reviewedAt: string | null; reviewDue: boolean } | null;
}

/* ======================== カテゴリ ======================== */

export const SUBS_OTHER_CATEGORY = 'その他';

/**
 * 既定のカテゴリ辞書。正規化名 (`vendorKey`) の部分一致を上から順に引き、先に書いたものを優先する。
 * `exact` のキーは 2 文字などで誤一致しやすいため完全一致だけで当てる。
 */
export const SUBS_CATEGORY_DICTIONARY: readonly {
  keys: readonly string[];
  category: string;
  exact?: boolean;
}[] = [
  { keys: ['primevideo'], category: 'エンタメ' },
  { keys: ['aws', 'amazonwebservices'], category: 'クラウド' },
  {
    keys: [
      'netflix',
      'spotify',
      'youtube',
      'disney',
      'hulu',
      'unext',
      'dazn',
      'abema',
      'applemusic',
      'niconico',
    ],
    category: 'エンタメ',
  },
  { keys: ['amazon'], category: 'ショッピング' },
  { keys: ['googleone', 'icloud', 'dropbox', 'onedrive', 'box'], category: 'クラウド' },
  {
    keys: ['notion', 'slack', 'zoom', 'microsoft365', 'chatgpt', 'openai', 'github', 'chatwork', 'evernote'],
    category: '仕事効率化',
  },
  { keys: ['adobe', 'canva', 'figma'], category: 'クリエイティブ' },
  { keys: ['1password', 'norton', 'mcafee', 'bitwarden', 'nordvpn'], category: 'セキュリティ' },
  { keys: ['newspicks', 'nikkei', '日経'], category: 'ニュース' },
  { keys: ['docomo', 'softbank', 'ahamo', 'povo', '楽天モバイル'], category: '通信' },
  { keys: ['au'], category: '通信', exact: true },
];

/** 選択肢に出すカテゴリ名 (辞書の出現順 + その他) */
export const SUBS_CATEGORIES: readonly string[] = [
  ...new Set([...SUBS_CATEGORY_DICTIONARY.map((entry) => entry.category), SUBS_OTHER_CATEGORY]),
];

/** カテゴリの解決: 利用者の上書き → 既定辞書 → その他 */
export function subsCategoryOf(
  name: string,
  override?: string | null,
): { category: string; source: 'dictionary' | 'override' } {
  const trimmed = override?.trim();
  if (trimmed) return { category: trimmed, source: 'override' };
  const key = vendorKey(name);
  for (const entry of SUBS_CATEGORY_DICTIONARY) {
    const hit = entry.keys.some((k) => {
      const nk = vendorKey(k);
      return entry.exact ? key === nk : key.includes(nk);
    });
    if (hit) return { category: entry.category, source: 'dictionary' };
  }
  return { category: SUBS_OTHER_CATEGORY, source: 'dictionary' };
}

/* ======================== 月の計算 ======================== */

const monthNo = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthOfNo = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
const monthsBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let n = monthNo(from); n <= monthNo(to); n++) out.push(monthOfNo(n));
  return out;
};
const inRange = (m: string, range: PeriodRange) => m >= range.from && m <= range.to;
const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');
const jpMonth = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`;
const fixed1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** 直前の同じ長さの期間 */
export function previousSubsPeriod(range: PeriodRange): PeriodRange {
  const len = monthNo(range.to) - monthNo(range.from) + 1;
  return { from: monthOfNo(monthNo(range.from) - len), to: monthOfNo(monthNo(range.to) - len) };
}

/* ======================== 明細の準備 ======================== */

interface Fact extends ExpenseFact {
  kind: AccountKind;
  /** 登録ベンダー名。未登録は null */
  vendor: string | null;
}

interface Context {
  input: SubscriptionsScreenInput;
  defs: SubVendor[];
  facts: Fact[];
  /** 全明細の月 (Dataset の月 ∪ 明細の月) */
  months: string[];
}

function buildContext(input: SubscriptionsScreenInput): Context {
  const defs: SubVendor[] = input.vendors.map((v) => ({
    name: v.name,
    aliases: v.aliases,
    accounts: v.accounts,
  }));
  const instById = new Map(input.all.mfTx.map((tx) => [tx.id, tx.inst ?? '']));
  const accountOf = (fact: ExpenseFact): string => {
    if (fact.source === 'mf') return instById.get(fact.sourceId) ?? '';
    const index = Number(fact.sourceId.slice('freee:'.length));
    return input.deals[index]?.settleAccount ?? '';
  };
  // 照合は1回だけ計算する (全画面の数字が同じ明細から出るように)
  const facts = buildExpenseProjection(input.all, input.deals).effectiveExpenses.map((fact) => ({
    ...fact,
    kind: accountKindOf(accountOf(fact)),
    vendor: registeredVendorOf(fact, defs),
  }));
  const months = [...new Set([...input.all.months, ...facts.map((f) => f.month)])].sort();
  return { input, defs, facts, months };
}

/** 範囲 null (全期間) を実データの端で閉じる */
function effectiveRange(ctx: Context, range: PeriodRange | null): PeriodRange | null {
  if (range) return range;
  if (!ctx.months.length) return null;
  return { from: ctx.months[0]!, to: ctx.months[ctx.months.length - 1]! };
}

/* ======================== 行の基礎値 ======================== */

interface BaseRow {
  row: SubscriptionRow;
  /** 期間内のこの行の明細 */
  periodFacts: Fact[];
  /** 期間の終わりまでの支払月と額 (月の和) */
  payments: { month: string; amount: number }[];
}

function mostFrequentName(facts: readonly Fact[]): string {
  const counts = new Map<string, number>();
  for (const f of facts) counts.set(f.party, (counts.get(f.party) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  // Map は挿入順なので、同数なら先に現れた名前が残る
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function paymentsOf(facts: readonly Fact[]): { month: string; amount: number }[] {
  const byMonth = new Map<string, number>();
  for (const f of facts) byMonth.set(f.month, (byMonth.get(f.month) ?? 0) + f.amount);
  return [...byMonth.keys()].sort().map((month) => ({ month, amount: byMonth.get(month)! }));
}

function billingOf(payments: readonly { month: string }[]): 'monthly' | 'annual' {
  if (payments.length < 2) return 'monthly';
  const gap = monthNo(payments[payments.length - 1]!.month) - monthNo(payments[payments.length - 2]!.month);
  return gap >= 11 && gap <= 13 ? 'annual' : 'monthly';
}

function baseRow(
  key: string,
  history: readonly Fact[],
  range: PeriodRange,
  meta: { vendorId: number | null; normalizedName: string; override: string | null },
): BaseRow {
  const upToEnd = history.filter((f) => f.month <= range.to);
  const periodFacts = upToEnd.filter((f) => f.month >= range.from);
  const payments = paymentsOf(upToEnd);
  const billing = billingOf(payments);
  const latest = payments[payments.length - 1];
  const latestAmount = latest?.amount ?? 0;
  const estimatedMonthly = billing === 'annual' ? Math.round(latestAmount / 12) : latestAmount;
  const since = latest ? monthNo(range.to) - monthNo(latest.month) : Number.POSITIVE_INFINITY;
  const active = billing === 'annual' ? since <= 11 : since <= 1;
  const { category, source } = subsCategoryOf(meta.normalizedName, meta.override);
  return {
    periodFacts,
    payments,
    row: {
      vendorKey: key,
      vendorId: meta.vendorId,
      status: meta.vendorId === null ? 'unregistered' : 'registered',
      displayName: mostFrequentName(periodFacts) || meta.normalizedName,
      normalizedName: meta.normalizedName,
      matchedNameCount: new Set(periodFacts.map((f) => f.party)).size,
      latestAmount,
      estimatedMonthly,
      annualized: estimatedMonthly * 12,
      billing,
      active,
      category,
      categorySource: source,
      review: null,
    },
  };
}

function baseRows(ctx: Context, range: PeriodRange): BaseRow[] {
  const out: BaseRow[] = [];
  for (const vendor of ctx.input.vendors) {
    const history = ctx.facts.filter((f) => f.vendor === vendor.name);
    if (!history.some((f) => inRange(f.month, range))) continue;
    out.push(
      baseRow(vendorKey(vendor.name), history, range, {
        vendorId: vendor.id,
        normalizedName: vendor.name,
        override: vendor.category,
      }),
    );
  }

  // 未登録の候補は既存の候補採点に通す (旧 UI の未登録候補パネルと同じ候補が出る)
  const unregistered = ctx.facts.filter((f) => f.vendor === null);
  const inPeriod = unregistered.filter((f) => inRange(f.month, range));
  const candidates = subsCandidates(
    inPeriod.map((f) => ({
      month: f.month,
      date: f.date,
      io: 'expense' as const,
      partner: f.party,
      accountRaw: f.categoryRaw,
      accountNorm: f.categoryNorm,
      amount: f.amount,
    })),
    ctx.defs,
    20,
    [...ctx.input.exclusions],
  );
  const taken = new Set(out.map((b) => b.row.vendorKey));
  for (const c of candidates) {
    const key = vendorKey(c.partner);
    if (taken.has(key)) continue;
    taken.add(key);
    const history = unregistered.filter((f) => vendorKey(f.party) === key);
    out.push(baseRow(key, history, range, { vendorId: null, normalizedName: c.partner, override: null }));
  }
  return out;
}

/* ======================== 見直し候補の規則 ======================== */

interface RuleHit {
  rule: SubsReviewRule;
  reason: string;
}

function spendHits(base: BaseRow, range: PeriodRange): RuleHit[] {
  const months = monthsBetween(range.from, range.to);
  const byMonth = new Map(base.payments.map((p) => [p.month, p.amount]));
  const series = months.map((m) => byMonth.get(m) ?? 0);
  const alerts = subsSpendAlerts(base.row.normalizedName, months, series);
  const hits: RuleHit[] = [];
  const dup = alerts.filter((a) => a.type === 'dup').at(-1);
  if (dup) {
    hits.push({
      rule: 'dup',
      reason: `${jpMonth(dup.month)}の支払い ¥${yen(dup.value)} が通常 (¥${yen(dup.median)}) の ${fixed1(dup.value / dup.median)} 倍です。二重請求の可能性があります。`,
    });
  }
  const spike = alerts.filter((a) => a.type === 'spike').at(-1);
  if (spike) {
    hits.push({
      rule: 'spike',
      reason: `${jpMonth(spike.month)}の支払い ¥${yen(spike.value)} が通常の ${fixed1(spike.value / spike.median)} 倍に増えています。`,
    });
  }
  return hits;
}

/** 直前の支払額より 5% 以上高い支払いが 2 回続く (最新の該当を採る。値上げ月は期間内) */
function priceUpHit(base: BaseRow, range: PeriodRange): RuleHit | null {
  const p = base.payments;
  const raised = (i: number, prev: number) => p[i] !== undefined && p[i]!.amount * 100 >= prev * 105;
  for (let i = p.length - 2; i >= 1; i--) {
    const prev = p[i - 1]!.amount;
    if (!inRange(p[i]!.month, range) || !raised(i, prev) || !raised(i + 1, prev)) continue;
    let run = 0;
    while (raised(i + run, prev)) run++;
    const now = p[i]!.amount;
    return {
      rule: 'priceUp',
      reason: `${jpMonth(p[i]!.month)}から ¥${yen(prev)} → ¥${yen(now)} (+${fixed1(((now - prev) / prev) * 100)}%) に値上がりし、${run}か月続いています。`,
    };
  }
  return null;
}

function fingerprintOf(rules: readonly SubsReviewRule[], estimatedMonthly: number): string {
  return `${rules.join('+')}:${estimatedMonthly}`;
}

interface ReviewContext {
  vendorByName: Map<string, SubscriptionsScreenVendor>;
  decisionByKey: Map<string, SubsReviewDecision>;
  overlapGroups: Map<string, SubscriptionRow[]>;
}

function reviewContext(ctx: Context, bases: readonly BaseRow[]): ReviewContext {
  const vendorByName = new Map(ctx.input.vendors.map((v) => [v.name, v]));
  const decisionByKey = new Map(ctx.input.decisions.map((d) => [d.vendorKey, d]));
  const overlapGroups = new Map<string, SubscriptionRow[]>();
  for (const { row } of bases) {
    if (row.status !== 'registered' || !row.active || row.category === SUBS_OTHER_CATEGORY) continue;
    overlapGroups.set(row.category, [...(overlapGroups.get(row.category) ?? []), row]);
  }
  return { vendorByName, decisionByKey, overlapGroups };
}

/** 1 行の規則だけを適用する。詳細 API は他の行の判断文まで組み立てない。 */
function applyRule(review: ReviewContext, base: BaseRow, range: PeriodRange): void {
  const { row } = base;
  const hits: RuleHit[] = [...spendHits(base, range)];
  const priceUp = priceUpHit(base, range);
  if (priceUp) hits.push(priceUp);

  if (row.status === 'registered') {
    const group = review.overlapGroups.get(row.category) ?? [];
    if (group.length >= 2 && group.includes(row)) {
      const total = group.reduce((s, r) => s + r.estimatedMonthly, 0);
      hits.push({
        rule: 'overlap',
        reason: `同じカテゴリ「${row.category}」に継続中のサブスクが ${group.length} 件あります (月額合計 ¥${yen(total)})。`,
      });
    }
    const vendor = review.vendorByName.get(row.normalizedName);
    if (vendor && row.active) {
      const [status] = subsReviewStatus(
        [{ id: vendor.id, name: vendor.name, reviewedAt: vendor.reviewedAt }],
        `${range.to}-01`,
      );
      if (status?.due) {
        hits.push({
          rule: 'reviewDue',
          reason:
            status.monthsSince === null
              ? 'まだ一度も見直していません。'
              : `最後の見直しから ${status.monthsSince} か月たっています。`,
        });
      }
    }
  }

  if (!hits.length) return;
  const rules = SUBS_REVIEW_RULES.filter((rule) => hits.some((h) => h.rule === rule));
  const reasons = rules.map((rule) => hits.find((h) => h.rule === rule)!.reason);
  const fingerprint = fingerprintOf(rules, row.estimatedMonthly);
  // 見直しの判断は登録済みベンダーだけに付く。未登録の候補は登録か除外で決める
  const decision = row.status === 'registered' ? review.decisionByKey.get(row.vendorKey) : undefined;
  if (decision?.decision === 'dismissed' && decision.ruleFingerprint === fingerprint) return;
  row.review = {
    state: decision?.decision === 'confirmed' ? 'confirmed' : 'pending',
    rules,
    fingerprint,
    reasons,
  };
}

function applyRules(ctx: Context, bases: BaseRow[], range: PeriodRange): void {
  const review = reviewContext(ctx, bases);
  for (const base of bases) {
    applyRule(review, base, range);
  }
}

const reviewRank = (row: SubscriptionRow) =>
  row.review?.state === 'pending' ? 0 : row.review?.state === 'confirmed' ? 1 : 2;

function sortRows(rows: SubscriptionRow[]): SubscriptionRow[] {
  return rows.sort(
    (a, b) =>
      reviewRank(a) - reviewRank(b) ||
      b.estimatedMonthly - a.estimatedMonthly ||
      (a.normalizedName < b.normalizedName ? -1 : a.normalizedName > b.normalizedName ? 1 : 0),
  );
}

/**
 * 検出理由カードに出す行 (spec §9)。未判断の候補だけを、当たった最初の規則の表示順
 * (二重請求 → 急増 → 値上げ → 重複 → 期限切れ) で並べ、同じ規則の中は推定月額の降順。
 * 一覧の並び (sortRows) とは別の問いに答えるので、別の関数にする。
 */
export function subsReviewCards(rows: readonly SubscriptionRow[]): SubscriptionRow[] {
  const firstRule = (row: SubscriptionRow) => SUBS_REVIEW_RULES.indexOf(row.review?.rules[0] ?? 'reviewDue');
  return rows
    .filter((row) => row.review?.state === 'pending')
    .sort(
      (a, b) =>
        firstRule(a) - firstRule(b) ||
        b.estimatedMonthly - a.estimatedMonthly ||
        (a.normalizedName < b.normalizedName ? -1 : a.normalizedName > b.normalizedName ? 1 : 0),
    );
}

/* ======================== 集計 ======================== */

const countsTowardTotal = (row: SubscriptionRow) => row.status === 'registered' && row.active;

function monthlyTotalOf(rows: readonly SubscriptionRow[]): number {
  return rows.filter(countsTowardTotal).reduce((s, r) => s + r.estimatedMonthly, 0);
}

function monthlyByCategory(rows: readonly SubscriptionRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows.filter(countsTowardTotal)) {
    out.set(row.category, (out.get(row.category) ?? 0) + row.estimatedMonthly);
  }
  return out;
}

/** 既存 `subscriptions()` に照合後の明細で作り直した Dataset を通し、直近12か月と売上比を得る */
function existingNow(ctx: Context, range: PeriodRange | null) {
  const projected = structuredClone(applyPeriod(ctx.input.all, range));
  const names = ctx.input.vendors.map((v) => v.name);
  projected.subs.vendors = names;
  projected.subs.matrix = Object.fromEntries(names.map((name) => [name, projected.months.map(() => 0)]));
  projected.subs.other = projected.months.map(() => 0);
  for (const fact of ctx.facts) {
    if (range && !inRange(fact.month, range)) continue;
    const isSubsAccount = fact.categoryRaw === 'サブスク・通信' || fact.categoryNorm === 'サブスク・通信';
    if (!fact.vendor && !isSubsAccount) continue;
    const index = ensureMonth(projected, fact.month);
    if (fact.vendor) projected.subs.matrix[fact.vendor]![index]! += fact.amount;
    else projected.subs.other[index]! += fact.amount;
  }
  return subscriptions(projected).now;
}

function coverageOf(ctx: Context, range: PeriodRange | null): SubscriptionsScreen['coverage'] {
  const empty = (): CoverageBucket => ({ percent: null, imported: 0, accounts: 0 });
  const eff = effectiveRange(ctx, range);
  if (!eff) return { bank: empty(), card: empty(), emoney: empty(), unclassified: 0 };
  const monthsOfAccount = new Map<string, Set<string>>();
  const touch = (account: string | null | undefined, month: string) => {
    const name = account?.trim();
    if (!name || !inRange(month, eff)) return;
    monthsOfAccount.set(name, (monthsOfAccount.get(name) ?? new Set()).add(month));
  };
  // 入金・振替・計算対象外も「取込まれている」証拠として数える。現金は口座ではない
  for (const tx of ctx.input.all.mfTx) if (!isCashTxId(tx.id)) touch(tx.inst, tx.m);
  for (const deal of ctx.input.deals) touch(deal.settleAccount, deal.month);

  const span = monthNo(eff.to) - monthNo(eff.from) + 1;
  const buckets = { bank: empty(), card: empty(), emoney: empty() };
  const filled = { bank: 0, card: 0, emoney: 0 };
  let unclassified = 0;
  for (const [account, months] of monthsOfAccount) {
    const kind = accountKindOf(account);
    if (kind === 'unclassified') {
      unclassified++;
      continue;
    }
    buckets[kind].accounts++;
    filled[kind] += months.size;
    if (months.has(eff.to)) buckets[kind].imported++;
  }
  for (const kind of ['bank', 'card', 'emoney'] as const) {
    const b = buckets[kind];
    b.percent = b.accounts ? filled[kind] / (b.accounts * span) : null;
  }
  return { ...buckets, unclassified };
}

function trendOf(ctx: Context, range: PeriodRange | null): SubscriptionsScreen['trend'] {
  const eff = effectiveRange(ctx, range);
  if (!eff) return { months: [], series: [] };
  const months = monthsBetween(eff.from, eff.to);
  const index = new Map(months.map((m, i) => [m, i]));
  const vendorCategory = new Map(
    ctx.input.vendors.map((v) => [v.name, subsCategoryOf(v.name, v.category).category]),
  );
  const byCategory = new Map<string, number[]>();
  const add = (category: string, month: string, amount: number) => {
    const i = index.get(month);
    if (i === undefined) return;
    const values = byCategory.get(category) ?? months.map(() => 0);
    values[i]! += amount;
    byCategory.set(category, values);
  };
  const other = months.map(() => 0);
  for (const fact of ctx.facts) {
    if (!index.has(fact.month)) continue;
    if (fact.vendor) add(vendorCategory.get(fact.vendor) ?? SUBS_OTHER_CATEGORY, fact.month, fact.amount);
    else if (fact.categoryRaw === 'サブスク・通信' || fact.categoryNorm === 'サブスク・通信') {
      other[index.get(fact.month)!]! += fact.amount;
    }
  }
  const total = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);
  const ranked = [...byCategory.entries()]
    .filter(([category]) => category !== SUBS_OTHER_CATEGORY)
    .sort((a, b) => total(b[1]) - total(a[1]) || (a[0] < b[0] ? -1 : 1));
  const top = ranked.slice(0, 3);
  const rest = [...ranked.slice(3).map(([, v]) => v), byCategory.get(SUBS_OTHER_CATEGORY) ?? [], other];
  const otherValues = months.map((_, i) => rest.reduce((s, values) => s + (values[i] ?? 0), 0));
  const series = top.map(([category, values]) => ({ category, values }));
  if (total(otherValues) > 0) series.push({ category: SUBS_OTHER_CATEGORY, values: otherValues });
  return { months, series };
}

function hasMonthsIn(ctx: Context, range: PeriodRange): boolean {
  return ctx.months.some((m) => inRange(m, range));
}

/* ======================== 公開関数 ======================== */

function rowsWithContext(ctx: Context, range: PeriodRange): SubscriptionRow[] {
  const bases = baseRows(ctx, range);
  applyRules(ctx, bases, range);
  return sortRows(bases.map((base) => base.row));
}

/**
 * 1 行だけの導出。重複候補の比較に必要な基礎行は共有するが、
 * 他行の理由文、KPI、カバー率、推移、年換算比較は計算しない。
 */
function rowWithContext(ctx: Context, range: PeriodRange, key: string): SubscriptionRow | null {
  const bases = baseRows(ctx, range);
  const target = bases.find((base) => base.row.vendorKey === key);
  if (!target) return null;
  applyRule(reviewContext(ctx, bases), target, range);
  return target.row;
}

function screenWithContext(ctx: Context): SubscriptionsScreen {
  const { input } = ctx;
  const eff = effectiveRange(ctx, input.range);
  const rows = eff ? rowsWithContext(ctx, eff) : [];

  const previousPeriod =
    input.range && hasMonthsIn(ctx, previousSubsPeriod(input.range)) ? previousSubsPeriod(input.range) : null;
  const prevRows = previousPeriod ? baseRows(ctx, previousPeriod).map((b) => b.row) : null;

  const monthlyTotal = monthlyTotalOf(rows);
  const monthlyTotalPrev = prevRows ? monthlyTotalOf(prevRows) : null;
  const now = existingNow(ctx, input.range);

  const current = monthlyByCategory(rows);
  const prev = prevRows ? monthlyByCategory(prevRows) : null;
  const categories = [...new Set([...current.keys(), ...(prev?.keys() ?? [])])];
  const comparison = categories
    .map((category) => {
      const monthly = current.get(category) ?? 0;
      return {
        category,
        monthly,
        annualized: monthly * 12,
        share: monthlyTotal > 0 ? monthly / monthlyTotal : 0,
        prevMonthly: prev ? (prev.get(category) ?? 0) : null,
      };
    })
    .sort(
      (a, b) => b.monthly - a.monthly || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0),
    );

  return {
    period: input.range,
    previousPeriod,
    generatedAt: input.generatedAt,
    kpis: {
      monthlyTotal,
      monthlyTotalPrev,
      annualized: monthlyTotal * 12,
      annualizedPrev: monthlyTotalPrev === null ? null : monthlyTotalPrev * 12,
      last12Total: now.last12Total,
      revenueShare: now.revenueShare,
      reviewCandidates: rows.filter((r) => r.review?.state === 'pending').length,
    },
    coverage: coverageOf(ctx, input.range),
    rows,
    trend: trendOf(ctx, input.range),
    comparison,
    comparisonTotal: { monthly: monthlyTotal, annualized: monthlyTotal * 12, prevMonthly: monthlyTotalPrev },
  };
}

/** サブスク画面の全集計。一覧・KPI・カバー率・推移・比較をこの1回で求める */
export function subscriptionsScreen(input: SubscriptionsScreenInput): SubscriptionsScreen {
  return screenWithContext(buildContext(input));
}

/** 画面全体の派生値を作らず、表示期間の 1 行だけを導出する。 */
export function subscriptionRow(input: SubscriptionsScreenInput, key: string): SubscriptionRow | null {
  const ctx = buildContext(input);
  const eff = effectiveRange(ctx, input.range);
  return eff ? rowWithContext(ctx, eff, key) : null;
}

/** 1 ベンダーの詳細 (行を選んだあとだけ取る)。期間内の一覧に無ければ null */
export function subscriptionVendorDetail(
  input: SubscriptionsScreenInput,
  key: string,
): SubscriptionVendorDetail | null {
  const ctx = buildContext(input);
  const eff = effectiveRange(ctx, input.range);
  if (!eff) return null;
  const row = rowWithContext(ctx, eff, key);
  if (!row) return null;

  const vendor = row.vendorId === null ? null : (input.vendors.find((v) => v.id === row.vendorId) ?? null);
  const facts = ctx.facts.filter(
    (f) =>
      inRange(f.month, eff) &&
      (vendor ? f.vendor === vendor.name : f.vendor === null && vendorKey(f.party) === key),
  );

  const rawNames = new Map<string, { name: string; source: AccountKind; count: number }>();
  for (const f of facts) {
    const id = `${f.party}\u0000${f.kind}`;
    const entry = rawNames.get(id) ?? { name: f.party, source: f.kind, count: 0 };
    entry.count++;
    rawNames.set(id, entry);
  }
  const recent = facts
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.date < b.f.date ? 1 : a.f.date > b.f.date ? -1 : a.i - b.i))
    .map(({ f }) => ({ date: f.date, name: f.party, source: f.kind, amount: f.amount }));
  const order: AccountKind[] = ['card', 'bank', 'emoney', 'unclassified'];
  const bySource = order
    .map((source) => ({ source, count: facts.filter((f) => f.kind === source).length }))
    .filter((s) => s.count > 0);

  let related: SubscriptionVendorDetail['related'] = null;
  if (vendor) {
    const [status] = subsReviewStatus(
      [{ id: vendor.id, name: vendor.name, reviewedAt: vendor.reviewedAt }],
      `${eff.to}-01`,
    );
    related = {
      aliases: [...vendor.aliases],
      accounts: [...vendor.accounts],
      reviewedAt: vendor.reviewedAt,
      reviewDue: status?.due ?? false,
    };
  }

  return {
    vendorKey: key,
    vendorId: row.vendorId,
    row,
    rawNames: [...rawNames.values()].sort((a, b) => b.count - a.count),
    estimatedMonthly: row.estimatedMonthly,
    annualized: row.annualized,
    recent,
    transactionCount: facts.length,
    bySource,
    related,
  };
}
