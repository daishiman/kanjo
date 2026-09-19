/**
 * 診断画面の検知器レジストリ (ADR-001) の契約テスト。
 *
 * 期待値の正本は `docs/diagnosis-screen-test-plan.md` §1/§2 と
 * `specs/spec-diagnosis-screen.md` の BR-001..BR-008。
 *
 * | 規則 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | BR-001 | 固定費 (CV<0.6) かつ直近3ヶ月平均が 30,000 円「超」で 15% を見込む | `fixed_cost_review-*` |
 * | BR-002 | 予算超過 (直近3ヶ月平均 > 予算×1.1) の超過額 / 予算なしは z>=1 の基準超過分 | `spike-budget-*` `spike-range-*` |
 * | BR-003 | サブスク集計の spike アラートは当月と中央値の差 | `spike-vendor-*` |
 * | BR-004 | 同一取引先・同一金額・同一月が 2 件以上なら 2 件目以降が捻出見込み | `duplicate_payment-*` |
 * | BR-005 | サブスクの dup アラートは当月と中央値の差 | `subs_duplicate-*` |
 * | BR-006 | 未分類＋カード引落の 30% を解消見込みとする | `unclassified-*` |
 * | BR-007 | 「サブスク・通信」が全経費の 15.0% 以上なら 20% を見込む | `comms_review-*` |
 * | BR-008 | 検知器の追加は配列へ 1 件足すだけで済む (画面・API に id 分岐が無い) | `registry-*` |
 *
 * ## 置換前に落ちる理由
 *
 * `DIAGNOSIS_DETECTORS` / `detectImprovements` は置換前に存在しない。境界の対 (30,001 と
 * 30,000 など) を 2 件ずつ置いているので、閾値を「以上」「超」のどちらかに読み違えた実装は
 * 必ず片側で落ちる。件数は `toHaveLength` で固定してあり、0 件の主張が「0 件しか調べて
 * いない」に化けないよう、対になるケースが同じ土台から 1 件を出すことを併記している。
 *
 * ## テスト計画からの是正 (2 点)
 *
 * 1. §1 の予算超過は「予算 10,000 / 直近平均 10,001」で 1 円の超過としていたが、判定は
 *    既存の `judgeBudget` (全画面共有) が持ち、`超過` は直近平均 > 予算×1.1 である。
 *    境界は 11,000 と 11,001 が正しい。診断だけ別の閾値を持たせると、予算画面と診断画面で
 *    同じ科目の判定が食い違うため、実装ではなく計画の数値を直した。
 * 2. §1 の `subs_duplicate` の対 (0 件側) は dup から外れると spike 側で拾われる。
 *    「何も出ない」ではなく「dup ではなく spike として 1 件出る」が正しい対である。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSIS_DETECTORS,
  type Dataset,
  type DiagnosisDetector,
  type MfTx,
  detectImprovements,
  diagnosisScreen,
  diagnosisWaterfall,
  emptyDataset,
  tradeoffCandidates,
} from '../src/index.js';

/** 共通の土台。15 ヶ月 (2025-01〜2026-03)・売上は毎月 100 万円 */
const MONTHS: string[] = Array.from({ length: 15 }, (_, i) => {
  const year = 2025 + Math.floor(i / 12);
  const month = (i % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
});

const flat = (value: number): number[] => MONTHS.map(() => value);

/** 末尾 1 ヶ月だけ別の値を置いた系列 */
const lastOnly = (base: number, last: number): number[] =>
  MONTHS.map((_, i) => (i === MONTHS.length - 1 ? last : base));

function baseData(over: Partial<Dataset> = {}): Dataset {
  const data = emptyDataset();
  data.months = [...MONTHS];
  data.biz.revenue = flat(1_000_000);
  data.subs.other = flat(0);
  return { ...data, ...over };
}

/** 経費だけを置いた土台 */
function withExpense(expense: Record<string, number[]>, over: Partial<Dataset> = {}): Dataset {
  return baseData({
    biz: { revenue: flat(1_000_000), categories: Object.keys(expense), expense },
    ...over,
  });
}

/** サブスクだけを置いた土台 */
function withSubs(matrix: Record<string, number[]>): Dataset {
  return baseData({
    subs: { vendors: Object.keys(matrix), aliases: {}, accounts: {}, matrix, other: flat(0) },
  });
}

/** 末尾6ヶ月を「前3ヶ月→直近3ヶ月」の平均比較に使う事業収入 */
function withBusinessIncome(previous: number, recent: number): Dataset {
  const revenue = flat(0);
  revenue.splice(-6, 3, previous, previous, previous);
  revenue.splice(-3, 3, recent, recent, recent);
  return baseData({ biz: { revenue, categories: [], expense: {} } });
}

/** 直近の家計収入・支出を月ごとに置く */
function withHouseholdBalance(income: number[], expense: number[]): Dataset {
  const months = MONTHS.slice(-Math.max(income.length, expense.length));
  return baseData({
    personal: Object.fromEntries(
      months.map((month, index) => [
        month,
        { income: { 給与: income[index] ?? 0 }, expense: { 生活費: expense[index] ?? 0 } },
      ]),
    ),
  });
}

const mf = (over: Partial<MfTx>): MfTx => ({
  id: 'mf-1',
  m: '2026-03',
  d: '03/01',
  c: 'カフェ',
  a: -5_000,
  big: '食費',
  mid: '外食',
  ...over,
});

/** 登録済み検知器を id で引く。画面・API はこの引き方をしない (テスト専用の絞り込み) */
function detector(id: string): DiagnosisDetector {
  const found = DIAGNOSIS_DETECTORS.find((d) => d.id === id);
  if (!found) throw new Error(`検知器 ${id} が登録されていない`);
  return found;
}

describe('§1 検知器の境界値', () => {
  it('fixed_cost_review-hit: 直近3ヶ月平均 30,001 円の固定費は 15% を見込む', () => {
    const rows = detector('fixed_cost_review').detect(withExpense({ 外注費: flat(30_001) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('fixed_cost_review:外注費');
    expect(rows[0].target).toBe('外注費');
    expect(rows[0].monthlyImpact).toBe(4_500);
    expect(rows[0].annualImpact).toBe(54_000);
    expect(rows[0].impactBasis).toBe('recurring_monthly');
    expect(rows[0].scope).toBe('business');
    expect(rows[0].metric).toBe('expense');
    expect(rows[0].claimKeys).toEqual(['business:category:外注費']);
    expect(rows[0].nextAction.to).toBe('/subscriptions?account=%E5%A4%96%E6%B3%A8%E8%B2%BB');
    expect(rows[0].severity).toBe('low');
    expect(rows[0].status).toBe('未着手');
    expect(rows[0].evidence).toEqual([
      {
        label: '直近3ヶ月平均',
        value: 30_001,
        baseline: 30_001,
        period: '2026-01〜2026-03',
        source: 'freee 取引 (科目別集計)',
      },
    ]);
  });

  it('fixed_cost_review-boundary: 30,000 円ちょうどは閾値「超」を満たさず 0 件', () => {
    expect(detector('fixed_cost_review').detect(withExpense({ 外注費: flat(30_000) }))).toHaveLength(0);
  });

  it('spike-budget-hit: 予算 10,000 に対し直近3ヶ月平均 11,001 は 1,001 円の超過', () => {
    const data = withExpense({ 交際費: flat(11_001) }, { budgets: { 交際費: 10_000 } });
    const rows = detector('spike').detect(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('spike:cat:交際費');
    expect(rows[0].monthlyImpact).toBe(1_001);
    expect(rows[0].annualImpact).toBe(12_012);
    expect(rows[0].evidence[0]).toEqual({
      label: '直近3ヶ月平均',
      value: 11_001,
      baseline: 10_000,
      period: '2026-01〜2026-03',
      source: '予算設定',
    });
  });

  it('spike-budget-boundary: 予算×1.1 ちょうど (11,000) は範囲内で 0 件', () => {
    const data = withExpense({ 交際費: flat(11_000) }, { budgets: { 交際費: 10_000 } });
    expect(detector('spike').detect(data)).toHaveLength(0);
  });

  it('spike-range-hit: 予算の無い科目は基準レンジ超え (z>=1) を平均との差で出す', () => {
    const rows = detector('spike').detect(withExpense({ 広告費: lastOnly(10_000, 20_000) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('spike:cat:広告費');
    expect(rows[0].monthlyImpact).toBe(9_333);
    expect(rows[0].annualImpact).toBe(9_333);
    expect(rows[0].impactBasis).toBe('one_off');
    expect(rows[0].severity).toBe('low');
    expect(rows[0].evidence[0]).toEqual({
      label: '直近月の支出',
      value: 20_000,
      baseline: 10_667,
      period: '2026-03',
      source: 'freee 取引 (科目別集計)',
    });
  });

  it('spike-range-boundary: ばらつきの無い系列は z=0 で 0 件', () => {
    expect(detector('spike').detect(withExpense({ 広告費: flat(10_000) }))).toHaveLength(0);
  });

  it('spike-vendor-hit: 中央値 5,000 に対し当月 15,001 は 10,001 円の急増', () => {
    const rows = detector('spike').detect(withSubs({ Zoom: lastOnly(5_000, 15_001) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('spike:vendor:Zoom');
    expect(rows[0].monthlyImpact).toBe(10_001);
    expect(rows[0].annualImpact).toBe(10_001);
    expect(rows[0].impactBasis).toBe('one_off');
    // 遷移先のサブスク画面は vendor を正規化済みキーで引く。表示名のまま渡すと当たらない
    expect(new URL(rows[0].nextAction.to, 'https://example.test').searchParams.get('vendor')).toBe('zoom');
    expect(rows[0].evidence[0]).toEqual({
      label: '当月の支払額',
      value: 15_001,
      baseline: 5_000,
      period: '2026-03',
      source: 'サブスク集計 (取引先別)',
    });
  });

  it('spike-vendor-boundary: 15,000 ちょうどは「15,000 円超」を満たさず 0 件', () => {
    expect(detector('spike').detect(withSubs({ Zoom: lastOnly(5_000, 15_000) }))).toHaveLength(0);
  });

  it('duplicate_payment-hit: 同月・同額・同一取引先が 2 件なら 2 件目が捻出見込み', () => {
    const data = baseData({
      mfTx: [mf({ id: 'mf-1' }), mf({ id: 'mf-2', d: '03/15' })],
    });
    const rows = detector('duplicate_payment').detect(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('duplicate_payment:カフェ:5000:2026-03');
    expect(rows[0].monthlyImpact).toBe(5_000);
    expect(rows[0].annualImpact).toBe(5_000);
    expect(rows[0].impactBasis).toBe('one_off');
    expect(rows[0].scope).toBe('household');
    expect(rows[0].claimKeys).toEqual(['vendor-month:カフェ:2026-03']);
    expect(new URL(rows[0].nextAction.to, 'https://example.test').searchParams.get('payee')).toBe('カフェ');
    expect(rows[0].evidence[0]).toEqual({
      label: '同月・同額の件数',
      value: 2,
      baseline: 1,
      period: '2026-03',
      source: 'MoneyForward 明細',
    });
  });

  it('duplicate_payment-boundary: 1 件だけなら 0 件', () => {
    expect(detector('duplicate_payment').detect(baseData({ mfTx: [mf({ id: 'mf-1' })] }))).toHaveLength(0);
  });

  it('subs_duplicate-hit: 中央値 5,001 に対し当月 20,001 は重複契約疑い', () => {
    const rows = detector('subs_duplicate').detect(withSubs({ Adobe: lastOnly(5_001, 20_001) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('subs_duplicate:Adobe');
    expect(rows[0].monthlyImpact).toBe(15_000);
    expect(rows[0].annualImpact).toBe(180_000);
    expect(rows[0].severity).toBe('medium');
  });

  it('subs_duplicate-boundary: 20,000 ちょうどは dup から外れ、spike として 1 件出る', () => {
    const data = withSubs({ Adobe: lastOnly(5_001, 20_000) });
    expect(detector('subs_duplicate').detect(data)).toHaveLength(0);
    const spikes = detector('spike').detect(data);
    expect(spikes).toHaveLength(1);
    expect(spikes[0].action_key).toBe('spike:vendor:Adobe');
  });

  it('unclassified-hit: 未分類 10 円は 30% の 3 円を解消見込みとする', () => {
    const data = baseData({ personal: { '2026-03': { income: {}, expense: { 未分類: 10 } } } });
    const rows = detector('unclassified').detect(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('unclassified:2026-03');
    expect(rows[0].monthlyImpact).toBe(3);
    expect(rows[0].annualImpact).toBe(3);
    expect(rows[0].impactBasis).toBe('one_off');
    expect(rows[0].nextAction.to).toContain('month=2026-03');
  });

  it('unclassified-boundary: 未分類 1 円は四捨五入で 0 円になり 0 件', () => {
    const data = baseData({ personal: { '2026-03': { income: {}, expense: { 未分類: 1 } } } });
    expect(detector('unclassified').detect(data)).toHaveLength(0);
  });

  it('comms_review-hit: 全経費の 15.0% ちょうどで 20% の圧縮を見込む', () => {
    const data = withExpense({ サブスク・通信: flat(150_000), 外注費: flat(850_000) });
    const rows = detector('comms_review').detect(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_key).toBe('comms_review:comms');
    expect(rows[0].monthlyImpact).toBe(30_000);
    expect(rows[0].annualImpact).toBe(360_000);
    expect(rows[0].severity).toBe('high');
    expect(rows[0].evidence).toHaveLength(2);
    expect(rows[0].evidence[0]).toEqual({
      label: '全経費に占める割合',
      value: 0.15,
      baseline: 0.15,
      period: '2025-01〜2026-03',
      source: 'freee 取引 (科目別集計)',
    });
  });

  it('comms_review-boundary: 14.9% では 0 件', () => {
    const data = withExpense({ サブスク・通信: flat(149_000), 外注費: flat(851_000) });
    expect(detector('comms_review').detect(data)).toHaveLength(0);
  });

  it('income_decline-hit: 直近3ヶ月平均がその前3ヶ月平均より10%超低いと差額を回復余地にする', () => {
    const rows = detector('income_decline').detect(withBusinessIncome(100_000, 89_999));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action_key: 'income_decline:business',
      monthlyImpact: 10_001,
      annualImpact: 120_012,
      impactBasis: 'recurring_monthly',
      scope: 'business',
      metric: 'income',
      confidence: 'medium',
    });
    expect(rows[0].nextAction.to).toBe('/analysis/trends?scope=business&metric=income');
    expect(rows[0].evidence[0]).toEqual({
      label: '直近3ヶ月平均収入',
      value: 89_999,
      baseline: 100_000,
      period: '2026-01〜2026-03',
      source: 'freee 取引 (売上集計)',
    });
  });

  it('income_decline-boundary: 10%減ちょうどと5ヶ月以下では候補を出さない', () => {
    expect(detector('income_decline').detect(withBusinessIncome(100_000, 90_000))).toHaveLength(0);
    const short = withBusinessIncome(100_000, 89_999);
    short.months = short.months.slice(-5);
    short.biz.revenue = short.biz.revenue.slice(-5);
    expect(detector('income_decline').detect(short)).toHaveLength(0);
  });

  it('negative_net-hit: 直近3ヶ月平均の純収支が赤字なら赤字幅を解消余地にする', () => {
    const rows = detector('negative_net').detect(
      withHouseholdBalance([100_000, 100_000, 100_000], [100_001, 100_001, 100_001]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action_key: 'negative_net:household',
      monthlyImpact: 1,
      annualImpact: 12,
      impactBasis: 'recurring_monthly',
      scope: 'household',
      metric: 'net',
      confidence: 'high',
    });
    expect(rows[0].nextAction.to).toBe('/analysis/trends?scope=household&metric=net');
  });

  it('negative_net-boundary: 収支0円ちょうどと2ヶ月以下では候補を出さない', () => {
    expect(
      detector('negative_net').detect(
        withHouseholdBalance([100_000, 100_000, 100_000], [100_000, 100_000, 100_000]),
      ),
    ).toHaveLength(0);
    expect(
      detector('negative_net').detect(withHouseholdBalance([100_000, 100_000], [100_001, 100_001])),
    ).toHaveLength(0);
  });
});

describe('§2 レジストリの拡張性 (ADR-001)', () => {
  it('registry-add: 配列へ 1 件足すだけで新しい行が現れ、降順は保たれる', () => {
    const data = withExpense({ 外注費: flat(30_001) });
    const testOnly: DiagnosisDetector = {
      id: 'test_only',
      label: 'テスト専用',
      detect: () => [
        {
          id: 'test_only',
          action_key: 'test_only:x',
          target: 'x',
          label: 'テスト専用の行',
          detail: '',
          severity: 'high',
          annualImpact: 1_200_000,
          monthlyImpact: 100_000,
          impactBasis: 'recurring_monthly',
          scope: 'business',
          metric: 'expense',
          claimKeys: ['business:test:x'],
          effort: 'low',
          confidence: 'high',
          evidence: [],
          nextAction: { label: '確認する', to: '/' },
          status: '未着手',
          note: null,
          decided_at: null,
        },
      ],
    };

    const before = detectImprovements(data);
    expect(before.map((r) => r.action_key)).toEqual(['fixed_cost_review:外注費']);

    const after = detectImprovements(data, [...DIAGNOSIS_DETECTORS, testOnly]);
    expect(after.map((r) => r.action_key)).toEqual(['test_only:x', 'fixed_cost_review:外注費']);
    expect(after.map((r) => r.annualImpact)).toEqual([1_200_000, 54_000]);
  });

  it('registry-overlap: claim が交差する候補は優先順の先頭だけを残して二重計上しない', () => {
    const candidate = (
      id: string,
      annualImpact: number,
      claimKeys: string[],
    ): ReturnType<DiagnosisDetector['detect']>[number] => ({
      id,
      action_key: `${id}:x`,
      target: 'x',
      label: id,
      detail: '',
      severity: 'high',
      annualImpact,
      monthlyImpact: annualImpact,
      impactBasis: 'one_off',
      scope: 'business',
      metric: 'expense',
      claimKeys,
      effort: 'low',
      confidence: 'high',
      evidence: [],
      nextAction: { label: '確認する', to: '/' },
      status: '未着手',
      note: null,
      decided_at: null,
    });
    const testOnly: DiagnosisDetector = {
      id: 'overlap_test',
      label: '重複テスト',
      detect: () => [
        candidate('large', 100_000, ['fund:a']),
        candidate('small', 60_000, ['fund:a', 'fund:b']),
        candidate('independent', 50_000, ['fund:c']),
      ],
    };

    expect(detectImprovements(baseData(), [testOnly]).map((row) => row.id)).toEqual(['large', 'independent']);
  });

  it('detector-overlap: 同じ通信費を固定費と通信費の両方では数えない', () => {
    const data = withExpense({ サブスク・通信: flat(150_000), 外注費: flat(850_000) });
    const rows = detectImprovements(data);
    expect(rows.filter((row) => row.claimKeys.includes('business:category:サブスク・通信'))).toHaveLength(1);
    expect(rows.find((row) => row.claimKeys.includes('business:category:サブスク・通信'))?.id).toBe(
      'comms_review',
    );
  });

  it('detector-overlap: 総合ではサブスクとMF明細の同一取引先月を1件にし、家計ではMF候補を残す', () => {
    const data = withSubs({ Adobe: lastOnly(5_001, 20_001) });
    data.mfTx = [
      mf({ id: 'mf-1', c: 'Adobe', a: -20_001 }),
      mf({ id: 'mf-2', c: 'Adobe', a: -20_001, d: '03/15' }),
    ];

    const total = detectImprovements(data);
    expect(total.filter((row) => row.claimKeys.includes('vendor-month:adobe:2026-03'))).toHaveLength(1);
    expect(total.find((row) => row.claimKeys.includes('vendor-month:adobe:2026-03'))?.id).toBe(
      'subs_duplicate',
    );
    expect(
      detectImprovements(data, undefined, { scope: 'household', metric: 'expense' }).map((row) => row.id),
    ).toEqual(['duplicate_payment']);
  });

  it('selection: scope と metric は候補を絞り、該当なしでも選んだ指標の現状値を返す', () => {
    const data = baseData({
      mfTx: [mf({ id: 'mf-1' }), mf({ id: 'mf-2', d: '03/15' })],
    });
    const business = diagnosisScreen(data, { scope: 'business', metric: 'expense' });
    const household = diagnosisScreen(data, { scope: 'household', metric: 'expense' });
    const income = diagnosisScreen(data, { scope: 'total', metric: 'income' });
    const net = diagnosisScreen(data, { scope: 'total', metric: 'net' });

    expect(business.improvements).toEqual([]);
    expect(household.improvements.map((row) => row.id)).toEqual(['duplicate_payment']);
    expect(income.improvements).toEqual([]);
    expect(income.totals.active).toBe(0);
    expect(income.waterfall.map((bar) => bar.label)).toEqual(['現状の年間収入', '改善後の年間収入']);
    expect(income.signals).toEqual([]);
    expect(net.improvements).toEqual([]);
    expect(net.waterfall.map((bar) => bar.label)).toEqual(['現状の年間純収支', '改善後の年間純収支']);
  });

  it('waterfall-floor: 改善見込みが現状を超えても改善後は 0 円を下回らない', () => {
    const row = detector('duplicate_payment').detect(
      baseData({ mfTx: [mf({ id: 'mf-1' }), mf({ id: 'mf-2', d: '03/15' })] }),
    )[0];
    const bars = diagnosisWaterfall([row], 1_000);
    expect(bars.every((bar) => bar.from >= 0 && bar.to >= 0)).toBe(true);
    expect(bars.at(-1)).toMatchObject({ kind: 'result', to: 0 });
  });

  it('waterfall-gain: 収入は改善見込みを現状へ加え、純収支は赤字から0円へ戻す', () => {
    const income = detector('income_decline').detect(withBusinessIncome(100_000, 89_999))[0];
    const incomeBars = diagnosisWaterfall([income], 1_079_988, 'income');
    expect(incomeBars.map((bar) => bar.kind)).toEqual(['base', 'gain', 'result']);
    expect(incomeBars[1]).toMatchObject({ from: 1_079_988, to: 1_200_000 });
    expect(incomeBars.at(-1)).toMatchObject({ label: '改善後の年間収入', to: 1_200_000 });

    const net = detector('negative_net').detect(
      withHouseholdBalance([100_000, 100_000, 100_000], [100_001, 100_001, 100_001]),
    )[0];
    const netBars = diagnosisWaterfall([net], -12, 'net');
    expect(netBars[0]).toMatchObject({ label: '現状の年間純収支', from: 0, to: -12 });
    expect(netBars[1]).toMatchObject({ kind: 'gain', from: -12, to: 0 });
    expect(netBars.at(-1)).toMatchObject({ label: '改善後の年間純収支', to: 0 });
  });

  it('registry-no-branch: 画面と API のどのファイルにも検知器 id の分岐が無い', () => {
    const ids = DIAGNOSIS_DETECTORS.map((d) => d.id);
    expect(ids).toEqual([
      'fixed_cost_review',
      'spike',
      'duplicate_payment',
      'subs_duplicate',
      'unclassified',
      'comms_review',
      'income_decline',
      'negative_net',
    ]);

    const hits: string[] = [];
    for (const root of ['../../web/src', '../../api/src']) {
      for (const file of sourceFiles(new URL(`${root}/`, import.meta.url))) {
        const text = readFileSync(file, 'utf8');
        for (const id of ids) {
          if (text.includes(`'${id}'`) || text.includes(`"${id}"`)) hits.push(`${file}: ${id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

/*
 * やりくり試算 (tradeoffCandidates) は検知器レジストリの射影であり、判定規則を自分では
 * 持たない。置換前は analysis.ts に同じ観点の規則がもう一組あったので、その重複が戻って
 * こないことをここで固定する。金額は §1 の境界値テストと同じ土台から出しているため、
 * 射影側だけで金額を作り直すと数値がずれて落ちる。
 */
describe('§3 やりくり試算への射影 (重複実装の除去)', () => {
  it('projection-budget: 予算超過は budget_over として科目 id で出る', () => {
    const data = withExpense({ 交際費: flat(11_001) }, { budgets: { 交際費: 10_000 } });
    expect(tradeoffCandidates(data)).toEqual([
      expect.objectContaining({ id: 'budget:交際費', kind: 'budget_over', amount: 1_001 }),
    ]);
  });

  it('projection-range: 予算の無い科目は above_range として出る', () => {
    const data = withExpense({ 広告費: lastOnly(10_000, 20_000) });
    expect(tradeoffCandidates(data)).toEqual([
      expect.objectContaining({ id: 'range:広告費', kind: 'above_range', amount: 9_333 }),
    ]);
  });

  it('projection-unexplained: 未分類は unexplained として 1 行に畳まれる', () => {
    const data = baseData({ personal: { '2026-03': { income: {}, expense: { 未分類: 10 } } } });
    expect(tradeoffCandidates(data)).toEqual([
      expect.objectContaining({ id: 'unexplained', kind: 'unexplained', amount: 3 }),
    ]);
  });

  it('projection-subs-dup: 重複契約疑いと急増が重なる取引先は dup 側を 1 行だけ残す', () => {
    // 20,001 は dup (中央値との差 15,000) と spike (同じく 15,000) の両方に当たる。
    // 取引先ごとに 1 行なので、打ち手のはっきりしている dup が残る。
    const data = withSubs({ Adobe: lastOnly(5_001, 20_001) });
    expect(tradeoffCandidates(data)).toEqual([
      expect.objectContaining({ id: 'subs:Adobe', kind: 'subs_dup', amount: 15_000 }),
    ]);
  });

  it('projection-subs-spike: dup から外れた取引先は subs_spike として出る', () => {
    const data = withSubs({ Adobe: lastOnly(5_001, 20_000) });
    expect(tradeoffCandidates(data)).toEqual([
      expect.objectContaining({ id: 'subs:Adobe', kind: 'subs_spike', amount: 14_999 }),
    ]);
  });

  it('projection-not-mapped: 試算に対応する kind の無い検知器は射影しない', () => {
    // 固定費の見直しは検知器としては 1 件出るが、試算の 5 kind に対応が無いので 0 件。
    const data = withExpense({ 外注費: flat(30_001) });
    expect(detectImprovements(data).map((r) => r.id)).toEqual(['fixed_cost_review']);
    expect(tradeoffCandidates(data)).toEqual([]);
  });

  it('projection-order: 複数の候補は効果額の降順で並ぶ', () => {
    const data = withExpense(
      { 交際費: flat(11_001), 広告費: lastOnly(10_000, 20_000) },
      { budgets: { 交際費: 10_000 } },
    );
    const rows = tradeoffCandidates(data);
    expect(rows.map((r) => r.id)).toEqual(['range:広告費', 'budget:交際費']);
    expect(rows.map((r) => r.amount)).toEqual([9_333, 1_001]);
  });
});

function sourceFiles(dir: URL): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sourceFiles(new URL(`${entry.name}/`, dir)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(fileURLToPath(new URL(entry.name, dir)));
  }
  return out;
}
