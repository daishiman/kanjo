/**
 * 診断画面の検知器レジストリ (ADR-001)。
 *
 * 「改善の余地」を見つける規則は、ここに登録された検知器だけが持つ。画面と API は
 * 返ってきた配列を並べ替えずに描画・転送するだけで、検知器 id による分岐を持たない。
 * 検知器を足す作業が「配列へ1件足す」で閉じることが、この構造の目的である。
 *
 * 各検知器は Dataset だけを受け取る。diagnosis() を呼ばないのは、diagnosis() が
 * tradeoffCandidates() から呼ばれる位置にあり、そこから検知器を呼ぶと循環するため。
 * 科目の統計は catProfile() を直接使う。
 */
import {
  DIAGNOSIS_FIXED_COST_REVIEW_THRESHOLD,
  budgetTable,
  catProfile,
  catSeries,
  personalExplainability,
  subscriptions,
} from './analysis.js';
import { budgetsInEffect } from './budget-screen.js';
import { sum } from './stats.js';
import { vendorKey } from './subs.js';
import type { Dataset } from './types.js';

/** 改善余地 1 件の根拠。実測値・比較値・期間を必ず持たせ、切り分けの順序を固定する */
export interface DiagnosisEvidence {
  /** 何の数値か (例: 直近3ヶ月平均) */
  label: string;
  /** 実測値 */
  value: number;
  /** 比較対象 (基準・中央値・予算)。持たない場合は null */
  baseline: number | null;
  /** 観測した期間 */
  period: string;
  /** 出典 */
  source: string;
}

/** 利用者の判断。D1 に行が無ければ 未着手 */
export type DiagnosisActionStatus = '未着手' | '対応中' | '対応済み' | '見送り';

export type DiagnosisImpactBasis = 'recurring_monthly' | 'one_off';
export type DiagnosisImprovementScope = 'business' | 'household';
export type DiagnosisImprovementMetric = 'expense' | 'income' | 'net';

export const DIAGNOSIS_ACTION_STATUSES: readonly DiagnosisActionStatus[] = [
  '未着手',
  '対応中',
  '対応済み',
  '見送り',
];

export interface DiagnosisImprovement {
  /** 検知器 id */
  id: string;
  /** 永続化の主キー。`<検知器 id>:<対象キー>` */
  action_key: string;
  /** 対象キー (科目名・取引先名など)。遷移先の絞込に使う */
  target: string;
  label: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  /** 円・整数 */
  annualImpact: number;
  /** recurring_monthly は月額を12倍、one_off は観測額をそのまま年内効果とする */
  impactBasis: DiagnosisImpactBasis;
  monthlyImpact: number;
  /** この候補が改善する範囲。条件帯の scope と一致する候補だけを表示する */
  scope: DiagnosisImprovementScope;
  /** 現在の検知器が根拠を持つ指標。未対応の指標へ候補を流用しない */
  metric: DiagnosisImprovementMetric;
  /** 同じ原資を奪い合う候補の請求単位。1つでも交差すれば同時には数えない */
  claimKeys: string[];
  effort: 'low' | 'medium' | 'high';
  confidence: 'high' | 'medium' | 'low';
  evidence: DiagnosisEvidence[];
  /** 遷移先。画面は Link へ渡すだけ (FR-009) */
  nextAction: { label: string; to: string };
  /** api が D1 から埋める。core は常に 未着手 を置く */
  status: DiagnosisActionStatus;
  /** 判断のメモ。D1 に行が無ければ null */
  note: string | null;
  /** 判断した時刻 (ISO8601)。D1 に行が無ければ null */
  decided_at: string | null;
}

export interface DiagnosisDetector {
  id: string;
  label: string;
  detect(data: Dataset): DiagnosisImprovement[];
}

/** severity の境界 (年額)。24万円以上=high、6万円以上=medium */
export const DIAGNOSIS_SEVERITY_HIGH = 240_000;
export const DIAGNOSIS_SEVERITY_MEDIUM = 60_000;
/** 固定費の見直しで圧縮できる想定 (可逆な運用仮説) */
export const DIAGNOSIS_FIXED_COST_CUT_RATIO = 0.15;
/** 未分類明細の精査で解消できる想定。tradeoffCandidates の従来値と同じ */
export const DIAGNOSIS_UNCLASSIFIED_CUT_RATIO = 0.3;
/** 通信費の見直しで圧縮できる想定 */
export const DIAGNOSIS_COMMS_CUT_RATIO = 0.2;
/** 「サブスク・通信」を見直し対象とみなす、全経費に占める割合 */
export const DIAGNOSIS_COMMS_SHARE_THRESHOLD = 0.15;
/** 直近3ヶ月平均がその前3ヶ月平均よりこの割合を超えて低いと収入減として扱う */
export const DIAGNOSIS_INCOME_DROP_RATIO = 0.1;
/** action_key の長さ上限 (BR-006) */
export const DIAGNOSIS_ACTION_KEY_MAX = 200;
/** メモの長さ上限 (BR-007) */
export const DIAGNOSIS_NOTE_MAX = 500;

const COMMS_CATEGORY = 'サブスク・通信';

export const claimPart = (value: string): string => value.trim().normalize('NFKC').toLocaleLowerCase('ja');

const withQuery = (path: string, params: Record<string, string | number>): string => {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
};

function severityOf(annualImpact: number): DiagnosisImprovement['severity'] {
  if (annualImpact >= DIAGNOSIS_SEVERITY_HIGH) return 'high';
  if (annualImpact >= DIAGNOSIS_SEVERITY_MEDIUM) return 'medium';
  return 'low';
}

const yen = (n: number): string => `¥${Math.round(n).toLocaleString()}`;

/** 対象期間の表示。記帳月が無ければ「期間不明」 */
function periodLabelOf(data: Dataset): string {
  const m = data.months;
  return m.length ? `${m[0]}〜${m[m.length - 1]}` : '期間不明';
}

/** 直近3ヶ月の表示 */
function recentLabelOf(data: Dataset): string {
  const m = data.months.slice(-3);
  return m.length ? `${m[0]}〜${m[m.length - 1]}` : '期間不明';
}

interface MonthlyFlow {
  month: string;
  income: number;
  expense: number;
}

const average = (values: readonly number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

/** 指標別の候補も、診断APIへ渡された期間で切られた Dataset だけを見る */
function monthlyFlow(data: Dataset, scope: DiagnosisImprovementScope): MonthlyFlow[] {
  if (scope === 'business') {
    return data.months.map((month, index) => ({
      month,
      income: data.biz.revenue[index] ?? 0,
      expense: sum(data.biz.categories.map((account) => data.biz.expense[account]?.[index] ?? 0)),
    }));
  }
  return Object.keys(data.personal)
    .sort()
    .map((month) => ({
      month,
      income: sum(Object.values(data.personal[month]?.income ?? {})),
      expense: sum(Object.values(data.personal[month]?.expense ?? {})),
    }));
}

const flowPeriod = (rows: readonly MonthlyFlow[]): string =>
  rows.length ? `${rows[0].month}〜${rows[rows.length - 1].month}` : '期間不明';

/**
 * 1 件を組み立てる。monthlyImpact が 0 以下なら null を返す。
 *
 * 金額が 0 の候補を返さないのは、押しても何も変わらない行を優先順位の表に並べないため。
 */
function improvement(
  detectorId: string,
  target: string,
  fields: Omit<
    DiagnosisImprovement,
    'id' | 'action_key' | 'target' | 'severity' | 'annualImpact' | 'status' | 'note' | 'decided_at'
  > & { monthlyImpact: number },
): DiagnosisImprovement | null {
  const monthlyImpact = Math.round(fields.monthlyImpact);
  if (monthlyImpact <= 0) return null;
  const annualImpact = fields.impactBasis === 'recurring_monthly' ? monthlyImpact * 12 : monthlyImpact;
  return {
    ...fields,
    id: detectorId,
    action_key: `${detectorId}:${target}`,
    target,
    monthlyImpact,
    annualImpact,
    severity: severityOf(annualImpact),
    status: '未着手',
    note: null,
    decided_at: null,
  };
}

/** 記帳のある科目だけ (系列の合計が 0 の科目は統計が立たない) */
function activeCategories(data: Dataset): string[] {
  return data.biz.categories.filter((c) => sum(catSeries(data, c)) > 0);
}

/* ============================ 1. 固定費の見直し ============================ */

const fixedCostReview: DiagnosisDetector = {
  id: 'fixed_cost_review',
  label: '固定費の見直し',
  detect(data) {
    const out: DiagnosisImprovement[] = [];
    for (const account of activeCategories(data)) {
      const p = catProfile(data, account);
      if (p.type !== '固定費' || p.rAvg <= DIAGNOSIS_FIXED_COST_REVIEW_THRESHOLD) continue;
      const row = improvement('fixed_cost_review', account, {
        label: `${account} の固定費を見直す`,
        detail: `直近3ヶ月平均 ${yen(p.rAvg)} の固定費。契約の棚卸しで ${Math.round(DIAGNOSIS_FIXED_COST_CUT_RATIO * 100)}% の圧縮を見込む。`,
        monthlyImpact: p.rAvg * DIAGNOSIS_FIXED_COST_CUT_RATIO,
        impactBasis: 'recurring_monthly',
        scope: 'business',
        metric: 'expense',
        claimKeys: [`business:category:${claimPart(account)}`],
        effort: 'medium',
        confidence: 'medium',
        evidence: [
          {
            label: '直近3ヶ月平均',
            value: Math.round(p.rAvg),
            baseline: Math.round(p.mean),
            period: recentLabelOf(data),
            source: 'freee 取引 (科目別集計)',
          },
        ],
        nextAction: { label: '契約を棚卸しする', to: withQuery('/subscriptions', { account }) },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/* ============================ 2. 急増した費目 ============================ */

/**
 * (a) 予算のある科目の超過 / (b) 予算の無い科目の基準レンジ超え / (c) サブスクの急増。
 *
 * (a) と (b) は排他である。予算の有無で分けるため、同じ科目が両方から出ることはない。
 */
const spike: DiagnosisDetector = {
  id: 'spike',
  label: '急増した費目',
  detect(data) {
    const out: DiagnosisImprovement[] = [];
    const budgets = budgetsInEffect(data);
    // (a) 予算あり
    for (const r of budgetTable(data)) {
      if (r.judge !== '超過' || r.diff == null) continue;
      const row = improvement('spike', `cat:${r.account}`, {
        label: `${r.account} を予算内に戻す`,
        detail: `直近3ヶ月平均 ${yen(r.recentAvg)} が予算 ${yen(r.budget ?? 0)} を超過している。`,
        monthlyImpact: r.diff,
        impactBasis: 'recurring_monthly',
        scope: 'business',
        metric: 'expense',
        claimKeys: [`business:category:${claimPart(r.account)}`],
        effort: 'low',
        confidence: 'high',
        evidence: [
          {
            label: '直近3ヶ月平均',
            value: Math.round(r.recentAvg),
            baseline: Math.round(r.budget ?? 0),
            period: recentLabelOf(data),
            source: '予算設定',
          },
        ],
        nextAction: { label: '予算を確認する', to: withQuery('/budget', { account: r.account }) },
      });
      if (row) out.push(row);
    }
    // (b) 予算なし
    for (const account of activeCategories(data)) {
      if (budgets[account] != null) continue;
      const p = catProfile(data, account);
      const judge = p.z >= 2 ? '要確認' : p.z >= 1 ? 'やや高い' : null;
      if (!judge) continue;
      const row = improvement('spike', `cat:${account}`, {
        label: `${account} を基準レンジへ戻す`,
        detail: `直近 ${yen(p.lastVal)} が基準レンジ上限 ${yen(p.mean + p.sd)} を超えている (${judge})。`,
        monthlyImpact: p.lastVal - p.mean,
        impactBasis: 'one_off',
        scope: 'business',
        metric: 'expense',
        claimKeys: [`business:category:${claimPart(account)}`],
        effort: 'low',
        confidence: 'high',
        evidence: [
          {
            label: '直近月の支出',
            value: Math.round(p.lastVal),
            baseline: Math.round(p.mean),
            period: data.months.length ? data.months[data.months.length - 1] : '期間不明',
            source: 'freee 取引 (科目別集計)',
          },
        ],
        nextAction: { label: '予算を設定する', to: withQuery('/budget', { account }) },
      });
      if (row) out.push(row);
    }
    // (c) サブスクの急増。取引先ごとに最新の1件だけを見る
    for (const a of latestAlertByVendor(data, 'spike')) {
      const row = improvement('spike', `vendor:${a.vendor}`, {
        label: `${a.vendor} の急増を解消する`,
        detail: `${a.month} に ${yen(a.value)} (通常月の中央値 ${yen(a.median)})。`,
        monthlyImpact: a.value - a.median,
        impactBasis: 'one_off',
        scope: 'business',
        metric: 'expense',
        claimKeys: [`business:subscription:${claimPart(a.vendor)}`],
        effort: 'low',
        confidence: 'high',
        evidence: [
          {
            label: '当月の支払額',
            value: Math.round(a.value),
            baseline: Math.round(a.median),
            period: a.month,
            source: 'サブスク集計 (取引先別)',
          },
        ],
        nextAction: {
          label: '契約を確認する',
          // サブスク画面は URL の vendor を正規化済みキーで引く。表示名のまま渡すと当たらない
          to: withQuery('/subscriptions', { vendor: vendorKey(a.vendor), month: a.month }),
        },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/** 取引先ごとに、指定種別の最新アラートを1件だけ取る */
function latestAlertByVendor(data: Dataset, type: 'dup' | 'spike') {
  const latest = new Map<string, { month: string; vendor: string; value: number; median: number }>();
  for (const a of subscriptions(data).alerts) {
    if (a.type !== type) continue;
    const prev = latest.get(a.vendor);
    if (!prev || a.month > prev.month) latest.set(a.vendor, a);
  }
  return [...latest.values()];
}

/* ============================ 3. 重複支払いの候補 ============================ */

/**
 * 同一取引先・同一金額が同一月に2回以上ある明細。2回目以降の合計を捻出見込みとする。
 *
 * 他の検知器と同じ原資を指す場合は claimKeys が共通になる。どちらを残すかは
 * レジストリ共通の重複排除へ委ね、個々の検知器へ例外分岐を置かない。
 */
const duplicatePayment: DiagnosisDetector = {
  id: 'duplicate_payment',
  label: '重複支払いの候補',
  detect(data) {
    const groups = new Map<string, { payee: string; amount: number; month: string; count: number }>();
    for (const t of data.mfTx) {
      if (t.a >= 0) continue; // 支出だけ
      const payee = t.c.trim();
      if (!payee) continue;
      const amount = Math.abs(t.a);
      const key = `${payee}\u0000${amount}\u0000${t.m}`;
      const cur = groups.get(key);
      if (cur) cur.count += 1;
      else groups.set(key, { payee, amount, month: t.m, count: 1 });
    }
    const out: DiagnosisImprovement[] = [];
    for (const g of groups.values()) {
      if (g.count < 2) continue;
      const row = improvement('duplicate_payment', `${g.payee}:${g.amount}:${g.month}`, {
        label: `${g.payee} の重複支払いを確認する`,
        detail: `${g.month} に ${yen(g.amount)} の支払いが ${g.count} 件ある。`,
        monthlyImpact: g.amount * (g.count - 1),
        impactBasis: 'one_off',
        scope: 'household',
        metric: 'expense',
        claimKeys: [`vendor-month:${claimPart(g.payee)}:${g.month}`],
        effort: 'low',
        confidence: 'medium',
        evidence: [
          {
            label: '同月・同額の件数',
            value: g.count,
            baseline: 1,
            period: g.month,
            source: 'MoneyForward 明細',
          },
        ],
        nextAction: {
          label: '照合画面で確認する',
          to: withQuery('/analysis/reconciliation', {
            payee: g.payee,
            month: g.month,
            amount: g.amount,
          }),
        },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/* ============================ 4. サブスクの重複候補 ============================ */

const subsDuplicate: DiagnosisDetector = {
  id: 'subs_duplicate',
  label: 'サブスクの重複候補',
  detect(data) {
    const out: DiagnosisImprovement[] = [];
    for (const a of latestAlertByVendor(data, 'dup')) {
      const row = improvement('subs_duplicate', a.vendor, {
        label: `${a.vendor} の重複契約疑いを解消する`,
        detail: `${a.month} に ${yen(a.value)} (通常月の中央値 ${yen(a.median)})。`,
        monthlyImpact: a.value - a.median,
        impactBasis: 'recurring_monthly',
        scope: 'business',
        metric: 'expense',
        claimKeys: [
          `business:subscription:${claimPart(a.vendor)}`,
          `vendor-month:${claimPart(a.vendor)}:${a.month}`,
        ],
        effort: 'medium',
        confidence: 'medium',
        evidence: [
          {
            label: '当月の支払額',
            value: Math.round(a.value),
            baseline: Math.round(a.median),
            period: a.month,
            source: 'サブスク集計 (取引先別)',
          },
        ],
        nextAction: {
          label: '契約を確認する',
          // サブスク画面は URL の vendor を正規化済みキーで引く。表示名のまま渡すと当たらない
          to: withQuery('/subscriptions', { vendor: vendorKey(a.vendor), month: a.month }),
        },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/* ============================ 5. 未分類明細 ============================ */

const unclassified: DiagnosisDetector = {
  id: 'unclassified',
  label: '未分類明細',
  detect(data) {
    const ex = personalExplainability(data);
    if (!ex || ex.unexplained <= 0) return [];
    const row = improvement('unclassified', ex.month, {
      label: '未分類・明細不明の支出を精査する',
      detail: `${ex.month} の未分類＋カード引落 ${yen(ex.unexplained)} (精査で ${Math.round(DIAGNOSIS_UNCLASSIFIED_CUT_RATIO * 100)}% 解消する想定)。`,
      monthlyImpact: ex.unexplained * DIAGNOSIS_UNCLASSIFIED_CUT_RATIO,
      impactBasis: 'one_off',
      scope: 'household',
      metric: 'expense',
      claimKeys: [`household:unclassified:${ex.month}`],
      effort: 'high',
      confidence: 'low',
      evidence: [
        {
          label: '未分類＋カード引落',
          value: Math.round(ex.unexplained),
          baseline: Math.round(ex.total),
          period: ex.month,
          source: 'MoneyForward 明細 (個人)',
        },
      ],
      nextAction: {
        label: '仕分け画面で分類する',
        to: withQuery('/classify', { month: ex.month, cls: 'per', category: '未分類' }),
      },
    });
    return row ? [row] : [];
  },
};

/* ============================ 6. 通信費の見直し ============================ */

const commsReview: DiagnosisDetector = {
  id: 'comms_review',
  label: '通信費の見直し',
  detect(data) {
    if (!data.biz.categories.includes(COMMS_CATEGORY)) return [];
    const total = sum(data.biz.categories.map((c) => sum(catSeries(data, c))));
    if (total <= 0) return [];
    const own = sum(catSeries(data, COMMS_CATEGORY));
    const share = own / total;
    if (share < DIAGNOSIS_COMMS_SHARE_THRESHOLD) return [];
    const p = catProfile(data, COMMS_CATEGORY);
    const row = improvement('comms_review', 'comms', {
      label: `${COMMS_CATEGORY} を見直す`,
      detail: `全経費の ${(share * 100).toFixed(1)}% を占める。使用頻度の棚卸し → 重複解約 → 年払い化の順で ${Math.round(DIAGNOSIS_COMMS_CUT_RATIO * 100)}% の圧縮を見込む。`,
      monthlyImpact: p.rAvg * DIAGNOSIS_COMMS_CUT_RATIO,
      impactBasis: 'recurring_monthly',
      scope: 'business',
      metric: 'expense',
      claimKeys: [`business:category:${claimPart(COMMS_CATEGORY)}`],
      effort: 'medium',
      confidence: 'medium',
      evidence: [
        {
          label: '全経費に占める割合',
          value: Number(share.toFixed(4)),
          baseline: DIAGNOSIS_COMMS_SHARE_THRESHOLD,
          period: periodLabelOf(data),
          source: 'freee 取引 (科目別集計)',
        },
        {
          label: '直近3ヶ月平均',
          value: Math.round(p.rAvg),
          baseline: Math.round(p.mean),
          period: recentLabelOf(data),
          source: 'freee 取引 (科目別集計)',
        },
      ],
      nextAction: {
        label: '契約を棚卸しする',
        to: withQuery('/subscriptions', { account: COMMS_CATEGORY }),
      },
    });
    return row ? [row] : [];
  },
};

/* ============================ 7. 収入の落ち込み ============================ */

/**
 * 直近3ヶ月平均と、その直前3ヶ月平均を比較する。
 * 季節性を推測で補正せず、10%減ちょうどまでは通常変動として候補を出さない。
 */
const incomeDecline: DiagnosisDetector = {
  id: 'income_decline',
  label: '収入の落ち込み',
  detect(data) {
    const out: DiagnosisImprovement[] = [];
    for (const scope of ['business', 'household'] as const) {
      const rows = monthlyFlow(data, scope);
      if (rows.length < 6) continue;
      const previous = rows.slice(-6, -3);
      const recent = rows.slice(-3);
      const previousAverage = average(previous.map((row) => row.income));
      const recentAverage = average(recent.map((row) => row.income));
      if (previousAverage <= 0 || recentAverage >= previousAverage * (1 - DIAGNOSIS_INCOME_DROP_RATIO)) {
        continue;
      }
      const label = scope === 'business' ? '事業収入の落ち込みを立て直す' : '家計収入の落ち込みを確認する';
      const source = scope === 'business' ? 'freee 取引 (売上集計)' : 'MoneyForward 明細 (個人収入)';
      const declineRate = (previousAverage - recentAverage) / previousAverage;
      const row = improvement('income_decline', scope, {
        label,
        detail: `直近3ヶ月平均 ${yen(recentAverage)} が、その前3ヶ月平均 ${yen(previousAverage)} より ${(declineRate * 100).toFixed(1)}% 減少している。`,
        monthlyImpact: previousAverage - recentAverage,
        impactBasis: 'recurring_monthly',
        scope,
        metric: 'income',
        claimKeys: [`${scope}:income:recent3`],
        effort: 'high',
        confidence: 'medium',
        evidence: [
          {
            label: '直近3ヶ月平均収入',
            value: Math.round(recentAverage),
            baseline: Math.round(previousAverage),
            period: flowPeriod(recent),
            source,
          },
        ],
        nextAction: {
          label: '減少要因を確認する',
          to: withQuery('/analysis/trends', { scope, metric: 'income' }),
        },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/* ============================ 8. 継続する赤字 ============================ */

/** 直近3ヶ月平均が赤字なら、0円へ戻すまでの差を継続的な改善余地として示す。 */
const negativeNet: DiagnosisDetector = {
  id: 'negative_net',
  label: '継続する赤字',
  detect(data) {
    const out: DiagnosisImprovement[] = [];
    for (const scope of ['business', 'household'] as const) {
      let rows = monthlyFlow(data, scope);
      if (scope === 'business') {
        const unrecorded = new Set(data.unrecordedExpMonths);
        rows = rows.filter((row) => !unrecorded.has(row.month));
      }
      const recent = rows.slice(-3);
      if (recent.length < 3) continue;
      const averageNet = average(recent.map((row) => row.income - row.expense));
      if (averageNet >= 0) continue;
      const label = scope === 'business' ? '事業の赤字を解消する' : '家計の赤字を解消する';
      const source = scope === 'business' ? 'freee 取引 (売上・経費集計)' : 'MoneyForward 明細 (個人収支)';
      const row = improvement('negative_net', scope, {
        label,
        detail: `直近3ヶ月の平均純収支が ${yen(averageNet)}。まず月次収支を 0 円へ戻す差額を改善余地とする。`,
        monthlyImpact: Math.abs(averageNet),
        impactBasis: 'recurring_monthly',
        scope,
        metric: 'net',
        claimKeys: [`${scope}:net:recent3`],
        effort: 'high',
        confidence: 'high',
        evidence: [
          {
            label: '直近3ヶ月平均純収支',
            value: Math.round(averageNet),
            baseline: 0,
            period: flowPeriod(recent),
            source,
          },
        ],
        nextAction: {
          label: '赤字の要因を確認する',
          to: withQuery('/analysis/trends', { scope, metric: 'net' }),
        },
      });
      if (row) out.push(row);
    }
    return out;
  },
};

/* ============================ レジストリ ============================ */

/** 登録済みの検知器。足すときはここへ1件加える (docs/diagnosis-screen.md 2.4) */
export const DIAGNOSIS_DETECTORS: readonly DiagnosisDetector[] = [
  fixedCostReview,
  spike,
  duplicatePayment,
  subsDuplicate,
  unclassified,
  commsReview,
  incomeDecline,
  negativeNet,
];

/**
 * 候補を効果額順に並べ、同じ claim を先に確保した候補だけを残す。
 * 検知器 id による分岐を持たない (ADR-001 / fitness test)。
 */
export function dedupeDiagnosisImprovements(
  improvements: readonly DiagnosisImprovement[],
): DiagnosisImprovement[] {
  const confidence = { high: 3, medium: 2, low: 1 } as const;
  const sorted = [...improvements].sort(
    (a, b) =>
      b.annualImpact - a.annualImpact ||
      b.claimKeys.length - a.claimKeys.length ||
      confidence[b.confidence] - confidence[a.confidence] ||
      a.action_key.localeCompare(b.action_key, 'ja'),
  );
  const claimed = new Set<string>();
  const kept: DiagnosisImprovement[] = [];
  for (const row of sorted) {
    if (row.claimKeys.some((key) => claimed.has(key))) continue;
    kept.push(row);
    for (const key of row.claimKeys) claimed.add(key);
  }
  return kept;
}

export function detectImprovements(
  data: Dataset,
  detectors: readonly DiagnosisDetector[] = DIAGNOSIS_DETECTORS,
  selection: {
    scope?: 'total' | DiagnosisImprovementScope;
    metric?: 'expense' | 'income' | 'net';
  } = {},
): DiagnosisImprovement[] {
  const out: DiagnosisImprovement[] = [];
  for (const d of detectors) out.push(...d.detect(data));
  const scope = selection.scope ?? 'total';
  const metric = selection.metric ?? 'expense';
  const eligible = out.filter((row) => row.metric === metric && (scope === 'total' || row.scope === scope));
  return dedupeDiagnosisImprovements(eligible);
}

/* ==================== FR-09 やりくり試算への射影 ==================== */

export interface TradeoffCandidate {
  id: string;
  kind: 'subs_dup' | 'subs_spike' | 'budget_over' | 'above_range' | 'unexplained';
  label: string;
  detail: string;
  /** 月あたりの捻出期待額 */
  amount: number;
}

/**
 * 1 件を試算の形へ写す。対応する kind が無ければ null。
 *
 * 予算超過と基準レンジ超えはどちらも検知器 `spike` が出すが、試算では kind が分かれる。
 * 検知器側が予算の有無で排他に判定しているので、ここも同じ条件で振り分ける。
 */
function tradeoffOf(row: DiagnosisImprovement, data: Dataset): TradeoffCandidate | null {
  const base = { label: row.label, detail: row.detail, amount: row.monthlyImpact };
  if (row.id === 'subs_duplicate') return { ...base, id: `subs:${row.target}`, kind: 'subs_dup' };
  if (row.id === 'unclassified') return { ...base, id: 'unexplained', kind: 'unexplained' };
  if (row.id !== 'spike') return null;
  if (row.target.startsWith('vendor:'))
    return { ...base, id: `subs:${row.target.slice('vendor:'.length)}`, kind: 'subs_spike' };
  const account = row.target.slice('cat:'.length);
  return budgetsInEffect(data)[account] != null
    ? { ...base, id: `budget:${account}`, kind: 'budget_over' }
    : { ...base, id: `range:${account}`, kind: 'above_range' };
}

/**
 * 削減余地リスト (効果額降順)。検知器レジストリの出力を試算の形へ射影する。
 *
 * 判定規則を持たないのは、同じ観点の実装を core の 1 箇所に保つため。試算に対応する
 * kind を持たない検知器 (固定費の見直し・通信費の見直し・重複支払い) はここへ出さない。
 */
export function tradeoffCandidates(data: Dataset): TradeoffCandidate[] {
  const out: TradeoffCandidate[] = [];
  for (const row of detectImprovements(data)) {
    const candidate = tradeoffOf(row, data);
    if (!candidate || candidate.amount <= 0) continue;
    out.push(candidate);
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/* ============================ action_key の検証 ============================ */

/** 制御文字を含まないこと。科目名・取引先名が入るため全角は許す */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * 受け取った action_key が登録済み検知器のものかを判定する (BR-006)。
 *
 * 許可リスト方式にするのは、レジストリに無い id の行が D1 に増えないようにするため。
 * 増えると「もう検知されないが消せもしない行」を抱えることになる。
 */
export function isValidDiagnosisActionKey(
  key: string,
  detectors: readonly DiagnosisDetector[] = DIAGNOSIS_DETECTORS,
): boolean {
  if (!key || key.length > DIAGNOSIS_ACTION_KEY_MAX) return false;
  if (hasControlChar(key)) return false;
  const at = key.indexOf(':');
  if (at <= 0 || at === key.length - 1) return false;
  const id = key.slice(0, at);
  return detectors.some((d) => d.id === id);
}

/** status が 4 語のいずれかか */
export function isDiagnosisActionStatus(value: unknown): value is DiagnosisActionStatus {
  return typeof value === 'string' && DIAGNOSIS_ACTION_STATUSES.includes(value as DiagnosisActionStatus);
}
