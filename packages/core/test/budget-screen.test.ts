import { describe, expect, it } from 'vitest';
import {
  type BudgetInput,
  type BudgetPlanRow,
  type Dataset,
  applyBudgetInputs,
  applyPeriod,
  budgetOutlook,
  budgetPlansView,
  budgetScreen,
  budgetTable,
  budgetsInEffect,
  defaultBudgetStart,
  defenseLine,
  diagnosisScreen,
  emptyDataset,
  exportJSON,
  importJSON,
  monthlyBudgetsAt,
  splitAnnual,
  suggestAmount,
  thousandRound,
} from '../src/index.js';

/** 予算画面 (spec-budget-screen) の算出規則 BR-01〜BR-25 と AT-13 の等式 */

const monthsFrom = (start: string, n: number): string[] => {
  const [y, m] = start.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const k = y * 12 + (m - 1) + i;
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
  });
};

/** 2024-01 から n か月。売上高 revenue(i)、経費は科目ごとの系列 */
function data(
  n: number,
  revenue: (i: number) => number,
  expense: Record<string, (i: number) => number>,
): Dataset {
  const d = emptyDataset();
  d.months = monthsFrom('2024-01', n);
  d.biz = {
    revenue: d.months.map((_, i) => revenue(i)),
    categories: Object.keys(expense),
    expense: Object.fromEntries(Object.entries(expense).map(([k, f]) => [k, d.months.map((_, i) => f(i))])),
  };
  return d;
}

const plan = (
  start: string,
  account: string,
  annualAmount: number,
  extra: Partial<BudgetPlanRow> = {},
): BudgetPlanRow => ({
  periodStart: start,
  account,
  kind: account === '売上高' || account === 'その他収入' ? 'income' : 'expense',
  annualAmount,
  planAdjustment: 0,
  planReason: null,
  updatedAt: '2026-09-22T00:00:00Z',
  ...extra,
});

const screenOf = (d: Dataset, plans: BudgetPlanRow[] = [], start: string | null = null, range = null) =>
  budgetScreen({ data: range ? applyPeriod(d, range) : d, all: d, range, start, plans });

describe('丸め (BR-05・BR-11)', () => {
  it('千円の四捨五入は 0.5 を絶対値の大きい方へ丸め、符号で結果が変わらない', () => {
    expect(thousandRound(1500)).toBe(2000);
    expect(thousandRound(-1500)).toBe(-2000);
    expect(thousandRound(1499)).toBe(1000);
    expect(thousandRound(-1499)).toBe(-1000);
    expect(Object.is(thousandRound(-400), -0) ? 0 : thousandRound(-400)).toBe(0);
  });

  it('月次予算は 1〜11 か月目が切り捨て、12 か月目に端数を寄せ、年合計が年額に一致する', () => {
    expect(splitAnnual(1_000_000)).toEqual([...Array(11).fill(83_333), 83_337]);
    const neg = splitAnnual(-1_000_001);
    expect(neg.slice(0, 11)).toEqual(Array(11).fill(-83_333));
    expect(neg.reduce((a, b) => a + b, 0)).toBe(-1_000_001);
  });
});

describe('行の集合と既定の予算対象 (BR-01・BR-02・BR-08)', () => {
  it('収入の 2 行が先頭、支出は前期実績の降順・科目名の昇順', () => {
    const d = data(12, () => 100_000, {
      旅費交通費: () => 1_000,
      広告宣伝費: () => 5_000,
      地代家賃: () => 1_000,
    });
    const s = screenOf(d);
    expect(s.rows.map((r) => r.account)).toEqual([
      '売上高',
      'その他収入',
      '広告宣伝費',
      '地代家賃',
      '旅費交通費',
    ]);
    expect(s.rows.map((r) => r.order)).toEqual([1, 2, 3, 4, 5]);
    expect(s.rows[1].manualOnly).toBe(true);
    expect(s.rows[1].prevActual).toBe(0);
  });

  it('前期実績 = 実績期間の合計 × 12 ÷ 月数 (円未満四捨五入)', () => {
    const d = data(7, () => 0, { 通信費: (i) => (i === 0 ? 1 : 0) });
    // 1 × 12 ÷ 7 = 1.71… → 2
    expect(screenOf(d).rows.find((r) => r.account === '通信費')?.prevActual).toBe(2);
  });

  it('既定の予算対象は実績期間の終了月の翌月から 12 か月', () => {
    expect(defaultBudgetStart({ from: '2024-01', to: '2025-08' })).toBe('2025-09');
    expect(defaultBudgetStart(null)).toBeNull();
    const s = screenOf(data(20, () => 1, {}));
    expect(s.start).toBe('2025-09');
    expect(s.targetMonths[0]).toBe('2025-09');
    expect(s.targetMonths[11]).toBe('2026-08');
    expect(s.actualRange).toEqual({ from: '2024-01', to: '2025-08', months: 20 });
  });

  it('保存行があれば saved、無ければ既存 budgets の月額 × 12 の legacy、どちらも無ければ none', () => {
    const d = data(12, () => 100, { 通信費: () => 10 });
    expect(screenOf(d).source).toBe('none');
    d.budgets = { 通信費: 1_000 };
    const legacy = screenOf(d);
    expect(legacy.source).toBe('legacy');
    expect(legacy.rows.find((r) => r.account === '通信費')?.saved).toEqual({
      annualAmount: 12_000,
      planAdjustment: 0,
      planReason: null,
    });
    const saved = screenOf(d, [
      plan('2025-01', '通信費', 50_000, { planAdjustment: 3_000, planReason: '値上げ' }),
    ]);
    expect(saved.source).toBe('saved');
    expect(saved.savedAt).toBe('2026-09-22T00:00:00Z');
    expect(saved.rows.find((r) => r.account === '通信費')?.saved).toEqual({
      annualAmount: 50_000,
      planAdjustment: 3_000,
      planReason: '値上げ',
    });
  });

  it('一覧に無い科目の保存行は出さない', () => {
    const d = data(12, () => 100, { 通信費: () => 10 });
    const s = screenOf(d, [plan('2025-01', '消えた科目', 1_000)]);
    expect(s.rows.some((r) => r.account === '消えた科目')).toBe(false);
  });

  it('実績 0 か月は empty', () => {
    const s = screenOf(emptyDataset());
    expect(s.empty).toBe(true);
    expect(s.rows).toEqual([]);
  });
});

describe('増減率・季節性・自動提案 (BR-03〜BR-05・BR-07)', () => {
  it('24 か月未満は増減率も季節性も 0', () => {
    const s = screenOf(data(23, () => 0, { 通信費: (i) => 1_000 + i * 100 }));
    const r = s.rows.find((x) => x.account === '通信費');
    expect(s.seasonalEnabled).toBe(false);
    expect(r?.growthRate).toBe(0);
    expect(r?.seasonal).toBe(0);
    expect(r?.monthDeviation).toEqual(Array(12).fill(0));
  });

  it('増減率 = 直近 12 ÷ 前 12 − 1 を ±30% に収める', () => {
    const up = screenOf(data(24, () => 0, { 通信費: (i) => (i < 12 ? 1_000 : 2_000) }));
    expect(up.rows.find((x) => x.account === '通信費')?.growthRate).toBe(0.3);
    const small = screenOf(data(24, () => 0, { 通信費: (i) => (i < 12 ? 1_000 : 1_100) }));
    expect(small.rows.find((x) => x.account === '通信費')?.growthRate).toBeCloseTo(0.1, 10);
    const zero = screenOf(data(24, () => 0, { 通信費: (i) => (i < 12 ? 0 : 1_000) }));
    expect(zero.rows.find((x) => x.account === '通信費')?.growthRate).toBe(0);
  });

  it('増減率は全実績から取る (実績期間が 1 年でも前の 12 か月を見る)', () => {
    const d = data(24, () => 0, { 通信費: (i) => (i < 12 ? 1_000 : 1_100) });
    const s = screenOf(d, [], null, { from: '2025-01', to: '2025-12' } as never);
    const r = s.rows.find((x) => x.account === '通信費');
    expect(r?.prevActual).toBe(13_200);
    expect(r?.growthRate).toBeCloseTo(0.1, 10);
  });

  it('12 か月の倍数の実績期間では季節性補正 S = 0、見通しの月割には偏りを足す', () => {
    // 1 月だけ 13,000、他は 1,000 → 平均 2,000、1 月の偏り +11,000
    const d = data(24, () => 0, { 通信費: (i) => (i % 12 === 0 ? 13_000 : 1_000) });
    const s = screenOf(d);
    const r = s.rows.find((x) => x.account === '通信費');
    expect(s.seasonalEnabled).toBe(true);
    expect(r?.seasonal).toBe(0);
    expect(r?.monthDeviation[0]).toBe(11_000);
    expect(r?.monthDeviation[1]).toBe(-1_000);
    const f = applyBudgetInputs(s, {}).rows.find((x) => x.account === '通信費');
    // 提案 = 24,000 × 1 + 0 = 24,000。1 月の見通し = 2,000 + 11,000
    expect(f?.suggestion).toBe(24_000);
    expect(f?.forecastMonthly[0]).toEqual({ month: '2026-01', amount: 13_000, actual: false });
    expect(f?.forecastMonthly[1].amount).toBe(1_000);
    expect(f?.forecastAnnual).toBe(24_000);
  });

  it('予算対象と前期実績の月の偏りの差が季節性補正になる', () => {
    // 30 か月。実績期間を 2026-01〜2026-06 (1 月を含む 6 か月) に絞ると、前期実績は 1 月の山を 2 倍に数える
    const d = data(30, () => 0, { 通信費: (i) => (i % 12 === 0 ? 13_000 : 1_000) });
    const range = { from: '2026-01', to: '2026-06' };
    const s = budgetScreen({ data: applyPeriod(d, range), all: d, range, start: null, plans: [] });
    const r = s.rows.find((x) => x.account === '通信費');
    // 直近 24 か月 (2024-07〜2026-06) の d(1) = 11,000、他 = −1,000
    // S = Σ予算対象 (2026-07〜2027-06) の d = 0 − (12 ÷ 6) × (11,000 − 5,000) = −12,000
    expect(r?.seasonal).toBe(-12_000);
    expect(r?.prevActual).toBe(36_000);
    expect(suggestAmount(r as never, 0).value).toBe(24_000);
  });

  it('自動提案は 前期実績 × (1 + g) + S + 調整 の千円丸めで、調整は提案だけを動かす', () => {
    const s = screenOf(data(12, () => 0, { 通信費: () => 10_000 }));
    const r = s.rows.find((x) => x.account === '通信費');
    if (!r) throw new Error('row');
    expect(suggestAmount(r, 0)).toEqual({ value: 120_000, unrounded: 120_000 });
    expect(suggestAmount(r, 1_500)).toEqual({ value: 122_000, unrounded: 121_500 });
    const f = applyBudgetInputs(s, {
      通信費: { annualAmount: 100_000, planAdjustment: 1_500, planReason: null },
    });
    const row = f.rows.find((x) => x.account === '通信費');
    expect(row?.suggestion).toBe(122_000);
    expect(row?.budget).toBe(100_000);
    expect(row?.suggestionBasis).toEqual({
      prevActual: 120_000,
      growthRate: 0,
      seasonal: 0,
      planAdjustment: 1_500,
      unrounded: 121_500,
    });
  });

  it('予算対象の月に実績があれば見通しはその実績', () => {
    const d = data(24, () => 0, { 通信費: () => 10_000 });
    const s = screenOf(d, [], '2025-07');
    const f = applyBudgetInputs(s, {}).rows.find((x) => x.account === '通信費');
    expect(f?.forecastMonthly.slice(0, 6).every((m) => m.actual)).toBe(true);
    expect(f?.forecastMonthly[6].actual).toBe(false);
    expect(s.targetMonths[0]).toBe('2025-07');
  });
});

describe('画面の数値が 1 か所から出る (AT-13・BR-09〜BR-14)', () => {
  const d = data(24, (i) => 500_000 + i * 1_000, {
    広告宣伝費: (i) => 50_000 + (i % 3) * 1_000,
    地代家賃: () => 100_000,
    通信費: (i) => 10_000 + i * 200,
  });
  d.personal = {};
  const s = screenOf(d);
  const inputs: Record<string, BudgetInput> = {
    売上高: { annualAmount: 7_000_000, planAdjustment: 0, planReason: null },
    その他収入: { annualAmount: 100_001, planAdjustment: 0, planReason: null },
    広告宣伝費: { annualAmount: 500_000, planAdjustment: 0, planReason: null },
    地代家賃: { annualAmount: 1_300_000, planAdjustment: 20_000, planReason: '更新料' },
    通信費: { annualAmount: null, planAdjustment: 0, planReason: null },
  };
  const f = applyBudgetInputs(s, inputs);

  it('KPI・一覧の和・グラフの年合計・見通しの累計が一致する', () => {
    expect(f.kpi.incomeBudget).toBe(7_100_001);
    expect(f.kpi.expenseBudget).toBe(1_800_000);
    expect(f.kpi.net).toBe(f.kpi.incomeBudget - f.kpi.expenseBudget);
    const listSum = f.rows.reduce((a, r) => a + (r.budget ?? 0), 0);
    expect(listSum).toBe(f.kpi.incomeBudget + f.kpi.expenseBudget);
    expect(f.monthly.reduce((a, m) => a + m.incomeBudget, 0)).toBe(f.kpi.incomeBudget);
    expect(f.monthly.reduce((a, m) => a + m.expenseBudget, 0)).toBe(f.kpi.expenseBudget);
    expect(f.outlook).toMatchObject({
      income: f.kpi.incomeBudget,
      expense: f.kpi.expenseBudget,
      net: f.kpi.net,
    });
  });

  it('防衛ライン余裕 = 年間収入予算 − 円未満四捨五入(defenseLine().line × 12)', () => {
    const line = defenseLine(d).line;
    expect(s.defenseLine.monthly).toBe(line);
    expect(f.kpi.defenseMargin).toBe(f.kpi.incomeBudget - Math.round(line * 12));
  });

  it('差額 = 来期予算 − 前期実績、過不足 = 見通し − 来期予算 (支出の設定済みの行だけ)', () => {
    for (const r of f.rows) {
      const base = s.rows.find((x) => x.account === r.account);
      expect(r.diff).toBe(r.budget == null ? null : r.budget - (base?.prevActual ?? 0));
      if (base?.kind === 'income' || r.budget == null) expect(r.gap).toBeNull();
      else expect(r.gap).toBe(r.forecastAnnual - r.budget);
    }
  });

  it('インパクトの支出差 = Σ(来期予算 − 自動提案) (支出の設定済みの行)', () => {
    const expected = f.rows
      .filter((r) => r.account !== '売上高' && r.account !== 'その他収入' && r.budget != null)
      .reduce((a, r) => a + ((r.budget as number) - r.suggestion), 0);
    expect(f.impact.expenseDiff).toBe(expected);
    expect(f.impact.net).toBe(f.kpi.net);
  });

  it('見通し (収支) は収入の見通し − 支出の見通し', () => {
    const i = 3;
    const inc = f.rows.filter((r) => r.account === '売上高' || r.account === 'その他収入');
    const exp = f.rows.filter((r) => r.account !== '売上高' && r.account !== 'その他収入');
    const net =
      inc.reduce((a, r) => a + r.forecastMonthly[i].amount, 0) -
      exp.reduce((a, r) => a + r.forecastMonthly[i].amount, 0);
    expect(f.monthly[i].forecastNet).toBe(net);
  });

  it('同じ入力なら同じ結果 (現在時刻・乱数を読まない)', () => {
    expect(applyBudgetInputs(s, inputs)).toEqual(f);
    expect(screenOf(d)).toEqual(s);
  });
});

describe('文と過不足カテゴリ (BR-15・BR-16・BR-18・BR-19)', () => {
  const d = data(24, () => 0, {
    A: () => 10_000,
    B: () => 20_000,
    C: () => 30_000,
    D: () => 40_000,
    E: () => 50_000,
    F: () => 60_000,
    G: () => 1_000,
  });
  const s = screenOf(d);
  const low = (account: string, amount: number): [string, BudgetInput] => [
    account,
    { annualAmount: amount, planAdjustment: 0, planReason: null },
  ];

  it('増加は |過不足| の降順で上位 5 件、件数は全件', () => {
    const f = applyBudgetInputs(s, Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((k) => low(k, 0))));
    expect(f.gaps.increase.count).toBe(6);
    expect(f.gaps.increase.rows.map((r) => r.account)).toEqual(['F', 'E', 'D', 'C', 'B']);
    expect(f.gaps.decrease.count).toBe(0);
    expect(f.outlook.comment).toContain('一部の費用で増加傾向があるため');
    expect(f.impact.drivers).toEqual(['F', 'E']);
    expect(f.impact.text).toMatch(/支出抑制となり/);
    expect(f.impact.text).toMatch(/特に F と E が増加要因です。$/);
  });

  it('同額の過不足は科目名の昇順、減少はもう一方のタブ', () => {
    const f = applyBudgetInputs(s, Object.fromEntries([low('G', 112_000), low('A', 0)]));
    expect(f.gaps.decrease.rows.map((r) => r.account)).toEqual(['G']);
    expect(f.gaps.decrease.rows[0].gap).toBe(-100_000);
    expect(f.gaps.increase.rows.map((r) => r.account)).toEqual(['A']);
  });

  it('増加 0 件の見通しコメントと、支出差 0 のインパクトの文', () => {
    const f = applyBudgetInputs(s, { G: { annualAmount: 12_000, planAdjustment: 0, planReason: null } });
    expect(f.outlook.comment).toBe(
      '現状の予算で推移した場合、来期の純収支は −12,000円 の見込みです。見通しが予算を上回る費用はありません。',
    );
    expect(f.impact.text).toBe(
      '現在の入力内容は、支出の合計が自動提案と同じで、予算純収支は −¥12,000 を見込んでいます。',
    );
  });

  it('推奨の根拠・主な根拠データ・要因の文', () => {
    const f = applyBudgetInputs(s, {
      A: { annualAmount: 0, planAdjustment: 500_000, planReason: '広告を拡大' },
    });
    const a = f.rows.find((r) => r.account === 'A');
    expect(a?.basisText).toBe(
      '前期実績と過去12か月の増減率（±0.0%）をもとに、来期は+416.7%の増加を見込みました。計画による調整 +¥500,000 を反映しています（理由: 広告を拡大）。',
    );
    expect(a?.evidence).toEqual([
      '過去12か月の月次実績の推移',
      '前期実績（2024年1月 - 2025年12月の24か月）',
      '直近24か月の月別の偏り（季節性）',
      '計画による調整: 広告を拡大',
    ]);
    expect(a?.factor).toBe('広告を拡大');
    const b = f.rows.find((r) => r.account === 'B');
    expect(b?.factor).toBe('来期予算が自動提案と異なる');
  });

  it('24 か月未満の根拠文と、前期実績 0 の根拠文', () => {
    const short = screenOf(data(6, () => 0, { A: () => 1_000 }));
    const f = applyBudgetInputs(short, {});
    expect(f.rows.find((r) => r.account === 'A')?.basisText).toContain(
      '実績が24か月に満たないため、増減率と季節性補正は0として計算しました。',
    );
    expect(f.rows.find((r) => r.account === 'その他収入')?.basisText).toMatch(/^前期実績が無いため/);
  });
});

describe('既存の読み手の予算 (BR-22〜BR-25)', () => {
  const base = () => {
    const d = data(12, () => 0, { 通信費: () => 10_000, 地代家賃: () => 50_000 });
    d.budgets = { 通信費: 9_000 };
    return d;
  };

  it('該当期間が無ければ既存 budgets をそのまま返す', () => {
    const d = base();
    expect(monthlyBudgetsAt(d, '2025-01')).toEqual({ 通信費: 9_000 });
    expect(budgetsInEffect(d)).toEqual({ 通信費: 9_000 });
  });

  it('月を含む期間のうち開始月が最も新しい期間の 年額 ÷ 12 (円未満四捨五入) を返す', () => {
    const d = base();
    d.budgetPlans = [
      plan('2024-06', '通信費', 120_000),
      plan('2025-01', '通信費', 240_006),
      plan('2025-01', '地代家賃', 600_000),
      plan('2026-01', '通信費', 1),
    ];
    expect(monthlyBudgetsAt(d, '2025-03')).toEqual({ 通信費: 20_001, 地代家賃: 50_000 });
    expect(monthlyBudgetsAt(d, '2024-12')).toEqual({ 通信費: 10_000 });
    expect(monthlyBudgetsAt(d, '2027-01')).toEqual({ 通信費: 9_000 });
  });

  it('基準月は budgetAsOf、無ければ最終実績月の翌月。予算表・着地見込み・診断が同じ値を読む', () => {
    const d = base();
    d.budgetPlans = [plan('2025-01', '通信費', 240_000)];
    expect(budgetsInEffect(d)).toEqual({ 通信費: 20_000 });
    expect(budgetTable(d).find((r) => r.account === '通信費')?.budget).toBe(20_000);
    expect(budgetTable(d).find((r) => r.account === '地代家賃')?.budget).toBeNull();
    expect(budgetOutlook(d).rows.find((r) => r.account === '通信費')?.budget).toBe(20_000);
    d.budgetAsOf = '2027-06';
    expect(budgetTable(d).find((r) => r.account === '通信費')?.budget).toBe(9_000);
  });

  it('診断の予算を設定した科目数も同じ読み出しを通る', () => {
    const d = base();
    d.budgetPlans = [plan('2025-01', '通信費', 240_000), plan('2025-01', '地代家賃', 600_000)];
    const s = diagnosisScreen(d);
    expect(JSON.stringify(s)).toContain('予算を設定した科目 2 件。');
  });

  it('期間の切り出しは budgetPlans と budgetAsOf を落とさない', () => {
    const d = base();
    d.budgetPlans = [plan('2025-01', '通信費', 240_000)];
    d.budgetAsOf = '2025-02';
    const sliced = applyPeriod(d, { from: '2024-06', to: '2024-08' });
    expect(sliced.budgetPlans).toEqual(d.budgetPlans);
    expect(sliced.budgetAsOf).toBe('2025-02');
  });

  it('JSON の書き出しに budgetPlans が入り、復元で戻る', () => {
    const d = base();
    d.budgetPlans = [plan('2025-01', '通信費', 240_000, { planReason: '値上げ' })];
    const json = exportJSON(d);
    expect(json.budgetPlans).toEqual(d.budgetPlans);
    const restored = emptyDataset();
    importJSON(restored, JSON.parse(JSON.stringify(json)));
    expect(restored.budgetPlans).toEqual(d.budgetPlans);
  });
});

describe('GET /api/budget-plans の本文 (budgetPlansView)', () => {
  it('保存行があれば科目名の昇順で返し、無ければ既存 budgets × 12 の初期値', () => {
    const saved = budgetPlansView({}, '2025-01', [
      plan('2025-01', '通信費', 2),
      plan('2025-01', '地代家賃', 1),
    ]);
    expect(saved.source).toBe('saved');
    expect(saved.rows.map((r) => r.account)).toEqual(['地代家賃', '通信費']);
    const legacy = budgetPlansView({ 通信費: 1_000, 地代家賃: 2_000 }, '2025-01', []);
    expect(legacy).toEqual({
      start: '2025-01',
      source: 'legacy',
      savedAt: null,
      rows: [
        {
          account: '地代家賃',
          kind: 'expense',
          annualAmount: 24_000,
          planAdjustment: 0,
          planReason: null,
          updatedAt: null,
        },
        {
          account: '通信費',
          kind: 'expense',
          annualAmount: 12_000,
          planAdjustment: 0,
          planReason: null,
          updatedAt: null,
        },
      ],
    });
    expect(budgetPlansView({}, '2025-01', []).source).toBe('none');
  });
});
