/**
 * 支出分析ハブの判定規則 (BR-001..BR-005) の境界値テスト。
 *
 * 実装より先に書く赤いテストである (SYS-ANHUB-P04)。実装は SYS-ANHUB-P05 が
 * `packages/core/src/analysis-hub.ts` に置く。
 *
 * 規則の正本は `docs/analysis-hub/requirements-baseline.md` (P01) と
 * `docs/analysis-hub/architecture-decision.md` (P02)。
 *
 * | 規則 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | BR-001 | 照合と総収支は要確認 1 件以上で高、0 件で中。他 3 視点は中 | `BR-001` |
 * | BR-002 | マトリクスは未記録月 0 で正常 | `BR-002` |
 * | BR-003 | 改善余地は月額合計 × 12 | `BR-003` |
 * | BR-004 | 前期間は直前の同じ長さ、1 か月でも欠ければ null | `BR-004` |
 * | BR-005 | 総収支の件数は totalCashflowReport を再利用する | `BR-005` |
 *
 * 実装前は `./analysis-hub.js` が存在しないため、ファイル全体が import で落ちる。
 */
import { describe, expect, it } from 'vitest';
import {
  analysisHub,
  annualSavings,
  hubPriority,
  matrixIsNormal,
  previousPeriod,
  previousPeriodLabel,
} from './analysis-hub.js';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  applyPeriod,
  buildExpenseProjection,
  emptyDataset,
  totalCashflowReport,
  tradeoffCandidates,
} from './index.js';

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-08',
  d: '08/05',
  c: '架空クラウド',
  a: -3_300,
  big: '通信費',
  mid: 'サブスク',
  inst: '三井住友銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-08',
  date: '2026-08-05',
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: 'サブスク・通信',
  amount: 3_300,
  ...over,
});

function dataset(txs: MfTx[], months: string[]): Dataset {
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  return data;
}

/** 家計の食費を月ごとに1件ずつ置く。前期間比の分母と分子を読みやすい額にするため */
const food = (month: string, amount: number): MfTx =>
  mf({
    id: `food-${month}`,
    m: month,
    d: `${month.slice(5)}/10`,
    c: '架空スーパー',
    a: -amount,
    big: '食費',
    mid: '食料品',
  });

describe('BR-001 優先度', () => {
  it('照合と総収支は要確認 0 件で中、1 件で高', () => {
    expect(hubPriority('reconciliation', 0)).toBe('中');
    expect(hubPriority('reconciliation', 1)).toBe('高');
    expect(hubPriority('total-cashflow', 0)).toBe('中');
    expect(hubPriority('total-cashflow', 1)).toBe('高');
  });

  it('マトリクス・推移・診断は件数に関わらず中', () => {
    for (const id of ['matrix', 'trends', 'diagnosis'] as const) {
      expect(hubPriority(id, 0)).toBe('中');
      expect(hubPriority(id, 5)).toBe('中');
    }
  });
});

describe('BR-002 マトリクスの正常判定', () => {
  it('未記録月 0 で正常、1 で正常でない', () => {
    expect(matrixIsNormal(0)).toBe(true);
    expect(matrixIsNormal(1)).toBe(false);
  });

  it('期間内の未記録月だけを数え、期間外の未記録月では正常を崩さない', () => {
    const data = dataset([food('2026-07', 10_000), food('2026-08', 12_000)], ['2026-07', '2026-08']);
    data.unrecordedExpMonths = ['2026-07'];

    const inRange = analysisHub({ all: data, range: { from: '2026-07', to: '2026-08' }, deals: [] });
    expect(inRange.views.matrix).toMatchObject({ unrecordedMonths: 1, normal: false, priority: '中' });

    const outOfRange = analysisHub({ all: data, range: { from: '2026-08', to: '2026-08' }, deals: [] });
    expect(outOfRange.views.matrix).toMatchObject({ unrecordedMonths: 0, normal: true, priority: '中' });
  });
});

describe('BR-003 改善余地', () => {
  it('候補 0 件で 0 円、月額 1,000 円と 500 円で年 18,000 円', () => {
    expect(annualSavings([])).toBe(0);
    expect(annualSavings([{ amount: 1_000 }, { amount: 500 }])).toBe(18_000);
  });

  it('tradeoff 候補が 0 件のデータでは診断の改善余地が 0 円', () => {
    const data = dataset([food('2026-08', 12_000)], ['2026-08']);
    // 前提の確認。候補が出るデータで 0 円を確かめても規則を固定したことにならない
    expect(tradeoffCandidates(data)).toHaveLength(0);

    const hub = analysisHub({ all: data, range: null, deals: [] });
    expect(hub.views.diagnosis).toMatchObject({ annualSavings: 0, candidateCount: 0, priority: '中' });
  });
});

describe('BR-004 前期間比', () => {
  it('前期間は月数を保ったまま直前へずらし、年をまたぐ', () => {
    expect(previousPeriod({ from: '2026-01', to: '2026-12' })).toEqual({ from: '2025-01', to: '2025-12' });
    expect(previousPeriod({ from: '2026-01', to: '2026-03' })).toEqual({ from: '2025-10', to: '2025-12' });
    expect(previousPeriod({ from: '2026-08', to: '2026-08' })).toEqual({ from: '2026-07', to: '2026-07' });
  });

  it('ラベルは「前Nか月」', () => {
    expect(previousPeriodLabel({ from: '2025-09', to: '2026-08' })).toBe('前12か月');
    expect(previousPeriodLabel({ from: '2026-08', to: '2026-08' })).toBe('前1か月');
  });

  it('前期間の欠けが 0 か月なら比較し、増減は比率で返す', () => {
    const all = dataset(
      [food('2026-05', 10_000), food('2026-06', 10_000), food('2026-07', 12_000), food('2026-08', 12_000)],
      ['2026-05', '2026-06', '2026-07', '2026-08'],
    );
    const hub = analysisHub({ all, range: { from: '2026-07', to: '2026-08' }, deals: [] });

    expect(hub.summary.expense).toBe(24_000);
    expect(hub.summary.previous).toMatchObject({
      label: '前2か月',
      range: { from: '2026-05', to: '2026-06' },
      months: 2,
      expense: 20_000,
    });
    expect(hub.summary.change?.expense).toBeCloseTo(0.2);
    expect(hub.views.trends.expenseChange).toBeCloseTo(0.2);
  });

  it('前期間の月が 1 か月でも欠ければ比較データなし (null)', () => {
    const all = dataset(
      [food('2026-06', 10_000), food('2026-07', 12_000), food('2026-08', 12_000)],
      ['2026-06', '2026-07', '2026-08'],
    );
    const hub = analysisHub({ all, range: { from: '2026-07', to: '2026-08' }, deals: [] });

    expect(hub.summary.expense).toBe(24_000);
    expect(hub.summary.previous).toBeNull();
    expect(hub.summary.change).toBeNull();
    expect(hub.views.trends.expenseChange).toBeNull();
  });

  it('期間未指定 (全期間) では前期間が必ず欠けて null', () => {
    const all = dataset([food('2026-07', 12_000), food('2026-08', 12_000)], ['2026-07', '2026-08']);
    const hub = analysisHub({ all, range: null, deals: [] });

    expect(hub.summary.expense).toBe(24_000);
    expect(hub.summary.previous).toBeNull();
  });

  it('前期間の値が 0 の項目は増減を null にし、0 除算の Infinity を返さない', () => {
    const all = dataset([food('2026-07', 10_000), food('2026-08', 12_000)], ['2026-07', '2026-08']);
    const hub = analysisHub({ all, range: { from: '2026-08', to: '2026-08' }, deals: [] });

    expect(hub.summary.previous).toMatchObject({ income: 0, expense: 10_000 });
    expect(hub.summary.change?.income).toBeNull();
    expect(hub.summary.change?.expense).toBeCloseTo(0.2);
  });
});

describe('BR-005 総収支の値と件数を再利用する', () => {
  const all = dataset(
    [
      food('2026-08', 12_000),
      // freee の取引と金額が同じで日付が 2 日ずれる。自動では寄らず要確認に残る
      mf({ id: 'review-1', m: '2026-08', d: '08/07', big: '事業経費', mid: '通信費' }),
    ],
    ['2026-08'],
  );
  const deals = [deal()];
  const range = { from: '2026-08', to: '2026-08' };

  it('要確認が 1 件以上なら総収支は高で、件数は totalCashflowReport の review と一致する', () => {
    const report = totalCashflowReport(applyPeriod(all, range), deals);
    // 前提の確認。0 件のデータでは「件数の一致」も「高」も恒真に近くなる
    expect(report.review.length).toBeGreaterThanOrEqual(1);

    const hub = analysisHub({ all, range, deals });
    expect(hub.views['total-cashflow']).toMatchObject({
      id: 'total-cashflow',
      reviewCount: report.review.length,
      count: report.review.length,
      priority: '高',
    });
  });

  it('収支サマリーは totalCashflowReport の months の合計で、要確認の明細を支出に入れない', () => {
    const report = totalCashflowReport(applyPeriod(all, range), deals);
    const sum = (key: 'totalIncome' | 'totalExpense' | 'totalBalance') =>
      report.months.reduce((acc, row) => acc + row[key], 0);

    const hub = analysisHub({ all, range, deals });
    expect(hub.summary).toMatchObject({
      income: sum('totalIncome'),
      expense: sum('totalExpense'),
      net: sum('totalBalance'),
    });
  });

  it('照合の件数は buildExpenseProjection の reviewCount と一致する', () => {
    const expected = buildExpenseProjection(applyPeriod(all, range), deals).summary.reviewCount;
    const hub = analysisHub({ all, range, deals });
    expect(hub.views.reconciliation).toMatchObject({
      id: 'reconciliation',
      reviewCount: expected,
      count: expected,
      priority: hubPriority('reconciliation', expected),
    });
  });

  it('期間外の freee 取引は当期の件数に入らない', () => {
    const hub = analysisHub({
      all,
      range,
      deals: [...deals, deal({ month: '2026-01', date: '2026-01-05', amount: 99_999 })],
    });
    expect(hub.summary.expense).toBe(
      totalCashflowReport(applyPeriod(all, range), deals).months[0]?.totalExpense,
    );
  });

  it('要確認 0 件のデータでは照合と総収支がともに中', () => {
    const quiet = dataset([food('2026-08', 12_000)], ['2026-08']);
    const hub = analysisHub({ all: quiet, range, deals: [] });
    expect(hub.views.reconciliation.priority).toBe('中');
    expect(hub.views['total-cashflow'].priority).toBe('中');
    expect(Object.keys(hub.views).sort()).toEqual([
      'diagnosis',
      'matrix',
      'reconciliation',
      'total-cashflow',
      'trends',
    ]);
  });
});
