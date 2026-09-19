/**
 * 規則ベースの健全性スコア (ADR-004)。
 *
 * 4 要素をそれぞれ 0-100 の要素スコアへ正規化し、重みを掛けて合成する。学習も推論も使わない。
 * 同じデータからは必ず同じ点が出て、なぜその点なのかを内訳から逆算できることを条件にしている。
 *
 * 算出できない要素 (平均月商 0 など) はその要素を落とし、残った重みで正規化し直す。
 * 0 点として混ぜると「データが無い」と「悪い」が同じ点になり、読み違えるため。
 */
import { balanceMonth, balanceTotals, diagnosis, personalMonths } from './analysis.js';
import { mean, std } from './stats.js';
import type { Dataset } from './types.js';

export type DiagnosisHealthKey = 'fixed_cost_ratio' | 'savings_rate' | 'stability' | 'coverage';

export interface DiagnosisHealthFactor {
  key: DiagnosisHealthKey;
  label: string;
  /** 実測値 (比率)。算出不能なら null */
  actual: number | null;
  /** 0-100。算出不能なら null */
  score: number | null;
  /** 正規化後の重み。算出不能なら 0 */
  weight: number;
  /** score × weight / Σweight */
  contribution: number;
  /** 算出不能の理由。算出できた場合は null */
  unavailableReason: string | null;
}

export interface DiagnosisHealth {
  score: number | null;
  band: '健全' | '注意' | '要改善' | null;
  breakdown: DiagnosisHealthFactor[];
}

/** 要素の重み (合計 100) */
export const DIAGNOSIS_HEALTH_WEIGHTS: Record<DiagnosisHealthKey, number> = {
  fixed_cost_ratio: 30,
  savings_rate: 30,
  stability: 25,
  coverage: 15,
};

/** 区分の下限 */
export const DIAGNOSIS_HEALTH_BAND_GOOD = 75;
export const DIAGNOSIS_HEALTH_BAND_WATCH = 50;

/** 安定性の判定に要る最小の月数。2 点では標準偏差が形を持たない */
const STABILITY_MIN_MONTHS = 3;

const clamp = (x: number): number => Math.min(100, Math.max(0, x));

/** 小さいほど良い指標を 0-100 へ倒す。good で 100、bad で 0 */
const descending = (value: number, good: number, bad: number): number =>
  clamp((100 * (bad - value)) / (bad - good));

/** 素の要素。算出できなければ actual/score を null にし、理由を残す */
interface RawFactor {
  key: DiagnosisHealthKey;
  label: string;
  actual: number | null;
  score: number | null;
  unavailableReason: string | null;
}

function ok(key: DiagnosisHealthKey, label: string, actual: number, score: number): RawFactor {
  return { key, label, actual, score, unavailableReason: null };
}

function unavailable(key: DiagnosisHealthKey, label: string, reason: string): RawFactor {
  return { key, label, actual: null, score: null, unavailableReason: reason };
}

export function diagnosisHealth(data: Dataset): DiagnosisHealth {
  const raw: RawFactor[] = [
    fixedCostRatioFactor(data),
    savingsRateFactor(data),
    stabilityFactor(data),
    coverageFactor(data),
  ];

  const usableWeight = raw
    .filter((f) => f.score != null)
    .reduce((acc, f) => acc + DIAGNOSIS_HEALTH_WEIGHTS[f.key], 0);

  const breakdown: DiagnosisHealthFactor[] = raw.map((f) => {
    if (f.score == null || usableWeight <= 0) {
      return { ...f, weight: 0, contribution: 0 };
    }
    const weight = DIAGNOSIS_HEALTH_WEIGHTS[f.key] / usableWeight;
    return { ...f, weight, contribution: f.score * weight };
  });

  if (usableWeight <= 0) return { score: null, band: null, breakdown };

  const score = Math.round(breakdown.reduce((acc, f) => acc + f.contribution, 0));
  const band =
    score >= DIAGNOSIS_HEALTH_BAND_GOOD ? '健全' : score >= DIAGNOSIS_HEALTH_BAND_WATCH ? '注意' : '要改善';
  return { score, band, breakdown };
}

/** 固定費比率 = 固定費(直近3ヶ月平均) / 平均月商。0.20 以下で 100、0.60 以上で 0 */
function fixedCostRatioFactor(data: Dataset): RawFactor {
  const label = '固定費比率';
  const kpi = diagnosis(data).kpi;
  if (kpi.avgRevenue <= 0) return unavailable('fixed_cost_ratio', label, '平均月商が 0 のため');
  const actual = kpi.fixedCost / kpi.avgRevenue;
  return ok('fixed_cost_ratio', label, actual, descending(actual, 0.2, 0.6));
}

/** 貯蓄率 = (収入 − 支出) / 収入。0.30 以上で 100、0 以下で 0 */
function savingsRateFactor(data: Dataset): RawFactor {
  const label = '貯蓄率';
  const totals = balanceTotals(personalMonths(data).map((m) => balanceMonth(data, m)));
  if (totals.income <= 0) return unavailable('savings_rate', label, '収入が 0 のため');
  const actual = totals.balance / totals.income;
  return ok('savings_rate', label, actual, clamp((100 * actual) / 0.3));
}

/** 収支の安定性 = 月次純収支の CV。0.10 以下で 100、0.50 以上で 0 */
function stabilityFactor(data: Dataset): RawFactor {
  const label = '収支の安定性';
  const balances = personalMonths(data).map((m) => balanceMonth(data, m).balance);
  if (balances.length < STABILITY_MIN_MONTHS)
    return unavailable('stability', label, `対象月が ${STABILITY_MIN_MONTHS} ヶ月に満たないため`);
  const avg = mean(balances);
  if (avg === 0) return unavailable('stability', label, '月次純収支の平均が 0 のため');
  const actual = std(balances) / Math.abs(avg);
  return ok('stability', label, actual, descending(actual, 0.1, 0.5));
}

/** データカバー率 = 記帳済み月数 / 対象期間の月数 */
function coverageFactor(data: Dataset): RawFactor {
  const label = 'データカバー率';
  const months = data.months.length;
  if (months === 0) return unavailable('coverage', label, '対象期間に月が無いため');
  const unrecorded = new Set(data.unrecordedExpMonths);
  const recorded = data.months.filter((m) => !unrecorded.has(m)).length;
  const actual = recorded / months;
  return ok('coverage', label, actual, clamp(100 * actual));
}
