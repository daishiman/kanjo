/**
 * 規則ベースの健全性スコア (ADR-004) の契約テスト。
 *
 * 期待値の正本は `docs/diagnosis-screen-test-plan.md` §3 と
 * `specs/spec-diagnosis-screen.md` の BR-009..BR-012。
 *
 * | 規則 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | BR-009 | 4 要素 × 重み 30/30/25/15 の加重平均 | `health-full-*` |
 * | BR-010 | 算出できない要素は落とし、残った重みで正規化する | `health-normalize-*` |
 * | BR-011 | 全要素が算出不能なら score/band とも null | `health-none` |
 * | BR-012 | 区分の下限は 75 (健全) と 50 (注意) | `health-band-*` |
 *
 * ## 置換前に落ちる理由
 *
 * `diagnosisHealth` は置換前に存在しない。区分は 75/74/50/49 の 4 点を置いてあるので、
 * 下限を「超」で実装すると 75 と 50 の 2 ケースが落ちる。正規化は重み 0 の要素が
 * `contribution` に混ざらないことを寄与点の実数で見ており、算出不能を 0 点として
 * 合成する実装 (「データが無い」と「悪い」を同じ点にする実装) では総合点が合わない。
 *
 * ## テスト計画からの是正 (1 点)
 *
 * §3 は「全要素 0 点」のケースを求めていたが、この 4 要素では成立しない。固定費比率は
 * 記帳済み月の科目統計から出るため、カバー率を 0 にすると (= 記帳済み月が 1 つも無い)
 * 固定費が 0 になり、固定費比率がむしろ 100 点になる。両立しない 2 要素なので、
 * 「固定費比率・貯蓄率・安定性が 0 点まで落ち、カバー率だけが残る最低点」を対とした。
 */
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSIS_HEALTH_WEIGHTS,
  type Dataset,
  type DiagnosisHealthKey,
  type PersonalMonth,
  diagnosisHealth,
  emptyDataset,
} from '../src/index.js';

const MONTHS: string[] = Array.from({ length: 15 }, (_, i) => {
  const year = 2025 + Math.floor(i / 12);
  return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
});

const flat = (value: number, months = MONTHS): number[] => months.map(() => value);

/** 家計の月。収入と支出だけを置く */
const personalOf = (months: string[], income: number, expense: (m: string, i: number) => number) =>
  Object.fromEntries(
    months.map((m, i): [string, PersonalMonth] => [
      m,
      { income: { 給与: income }, expense: { 生活費: expense(m, i) } },
    ]),
  );

function factorOf(data: Dataset, key: DiagnosisHealthKey) {
  const found = diagnosisHealth(data).breakdown.find((f) => f.key === key);
  if (!found) throw new Error(`要素 ${key} が内訳に無い`);
  return found;
}

/** 連番の月を作る (区分の境界を割り切れる月数にするため) */
const monthsOf = (count: number): string[] =>
  Array.from(
    { length: count },
    (_, i) => `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
  );

/** カバー率だけが効く土台。売上 0 で固定費比率を、家計なしで貯蓄率と安定性を落とす */
function coverageOnly(total: number, unrecorded: number): Dataset {
  const months = monthsOf(total);
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = flat(0, months);
  data.subs.other = flat(0, months);
  data.unrecordedExpMonths = months.slice(0, unrecorded);
  return data;
}

describe('§3 健全性スコア', () => {
  it('health-full-best: 4 要素すべてが 100 点なら総合 100 点・健全', () => {
    const data = emptyDataset();
    data.months = [...MONTHS];
    data.biz.revenue = flat(1_000_000);
    data.subs.other = flat(0);
    data.personal = personalOf(MONTHS, 100_000, () => 0);

    const health = diagnosisHealth(data);
    expect(health.score).toBe(100);
    expect(health.band).toBe('健全');
    expect(health.breakdown.map((f) => f.score)).toEqual([100, 100, 100, 100]);
    expect(health.breakdown.map((f) => f.weight)).toEqual([0.3, 0.3, 0.25, 0.15]);
    expect(health.breakdown.map((f) => f.unavailableReason)).toEqual([null, null, null, null]);
  });

  it('health-full-worst: 3 要素が 0 点まで落ちるとカバー率の寄与だけが残る', () => {
    const months = [...MONTHS];
    const data = emptyDataset();
    data.months = months;
    data.biz.revenue = flat(1_000_000);
    data.subs.other = flat(0);
    data.biz.categories = ['外注費'];
    data.biz.expense = { 外注費: flat(700_000) };
    // 記帳済みは先頭 1 ヶ月だけ (カバー率 1/15)
    data.unrecordedExpMonths = months.slice(1);
    // 純収支を大きくばらつかせて安定性を 0 点まで落とす
    data.personal = personalOf(months, 100_000, (_m, i) => (i < 8 ? 150_000 : 400_000));

    const health = diagnosisHealth(data);
    expect(factorOf(data, 'fixed_cost_ratio').actual).toBeCloseTo(0.7, 10);
    expect(health.breakdown.map((f) => f.score?.toFixed(2))).toEqual(['0.00', '0.00', '0.00', '6.67']);
    expect(health.score).toBe(1);
    expect(health.band).toBe('要改善');
  });

  it('health-normalize-single: 算出できる要素が 1 つなら、その重みが 15/15 に正規化される', () => {
    const data = coverageOnly(1, 0);

    const health = diagnosisHealth(data);
    const coverage = factorOf(data, 'coverage');
    expect(coverage.weight).toBe(1);
    expect(coverage.contribution).toBe(100);
    expect(health.score).toBe(100);
    expect(health.band).toBe('健全');

    const dropped = health.breakdown.filter((f) => f.score === null);
    expect(dropped.map((f) => f.key)).toEqual(['fixed_cost_ratio', 'savings_rate', 'stability']);
    expect(dropped.map((f) => f.weight)).toEqual([0, 0, 0]);
    expect(dropped.map((f) => f.contribution)).toEqual([0, 0, 0]);
    expect(dropped.map((f) => f.unavailableReason)).toEqual([
      '平均月商が 0 のため',
      '収入が 0 のため',
      '対象月が 3 ヶ月に満たないため',
    ]);
  });

  it('health-none: 全要素が算出不能なら score も band も null', () => {
    const health = diagnosisHealth(emptyDataset());
    expect(health.score).toBeNull();
    expect(health.band).toBeNull();
    expect(health.breakdown).toHaveLength(4);
    expect(health.breakdown.every((f) => f.score === null && f.weight === 0)).toBe(true);
    expect(factorOf(emptyDataset(), 'coverage').unavailableReason).toBe('対象期間に月が無いため');
  });

  it('health-band-75: 75 点ちょうどは健全 (下限は「以上」)', () => {
    const health = diagnosisHealth(coverageOnly(4, 1));
    expect(health.score).toBe(75);
    expect(health.band).toBe('健全');
  });

  it('health-band-74: 74 点は注意', () => {
    const health = diagnosisHealth(coverageOnly(50, 13));
    expect(health.score).toBe(74);
    expect(health.band).toBe('注意');
  });

  it('health-band-50: 50 点ちょうどは注意 (下限は「以上」)', () => {
    const health = diagnosisHealth(coverageOnly(2, 1));
    expect(health.score).toBe(50);
    expect(health.band).toBe('注意');
  });

  it('health-band-49: 49 点は要改善', () => {
    const health = diagnosisHealth(coverageOnly(100, 51));
    expect(health.score).toBe(49);
    expect(health.band).toBe('要改善');
  });

  it('health-weights: 重みの合計は 100 で、内訳の並びは重みの定義順と同じ', () => {
    expect(Object.values(DIAGNOSIS_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(diagnosisHealth(emptyDataset()).breakdown.map((f) => f.key)).toEqual(
      Object.keys(DIAGNOSIS_HEALTH_WEIGHTS),
    );
  });
});
