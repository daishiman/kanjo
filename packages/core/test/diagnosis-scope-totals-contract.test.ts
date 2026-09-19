/**
 * 条件の帯 (範囲 × 指標 × 比較対象) が数値へ効くことの契約テスト (AC-006)。
 *
 * 期待値の正本は `specs/spec-diagnosis-screen.md` の AC-006 と BR-004。
 *
 * | 規則 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | AC-006 | 3 指標 × 3 範囲 × 2 比較対象のどの組合せでも画面の値が core の返却と一致する | `AC-006-組合せ` |
 * | BR-004 | 総合 = 事業 + 家計 | `AC-006-恒等式` |
 * | BR-004 | 期間合計が同じ期間の総収支画面の値と一致する | `AC-006-総収支と一致` |
 * | BR-006 | 比較対象の月が 1 つでも欠ければ baseline は null | `AC-006-欠け月` |
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の `diagnosisScreen` は帯の選択を `selection` として返すだけで、どの数値にも
 * 効いていなかった。3 つの範囲が同じ値を返すため「総合 = 事業 + 家計」を確かめる対象
 * そのものが無く、`scopeTotals` は存在しない。18 組合せの期待値を固定値で置いてあるので、
 * 帯を無視する実装 (どの組合せでも同じ数を返す実装) では 12 組合せが落ちる。
 */
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSIS_COMPARES,
  DIAGNOSIS_METRICS,
  DIAGNOSIS_SCOPES,
  type Dataset,
  type MfTx,
  diagnosisBaselineRange,
  diagnosisCashflowSeries,
  diagnosisScopeTotals,
  emptyDataset,
  resolveDiagnosisSelection,
  totalCashflowScreen,
} from '../src/index.js';

/** 2025-01..2026-12 の 24 か月。前期間と前年同期が別の期間になる長さを選ぶ */
const MONTHS: string[] = Array.from({ length: 24 }, (_, i) => {
  const year = 2025 + Math.floor(i / 12);
  return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
});

const mf = (over: Partial<MfTx>): MfTx => ({
  id: 'mf',
  idStable: true,
  m: '2026-08',
  d: '08/05',
  c: '架空クラウド',
  a: -1_000,
  big: '通信費',
  mid: 'サブスク',
  inst: '三井住友銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

/**
 * 月ごとに額が違う明細を置く。全月同額だと、帯を無視する実装でも
 * 期間合計がたまたま一致してしまい、テストが「効いていない」ことを見逃す。
 */
function dataset(months: string[]): Dataset {
  const data = emptyDataset();
  data.months = [...months];
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = months.flatMap((m, i) => {
    const day = `${m.slice(5, 7)}/05`;
    const n = i + 1;
    return [
      mf({ id: `biz-${m}`, m, d: day, mid: '事業・その他', a: -1_000 * n }),
      mf({ id: `home-${m}`, m, d: day, c: 'スーパー', mid: '食料品', a: -100 * n }),
      mf({ id: `in-${m}`, m, d: day, c: '給与', big: '収入', mid: '給与', a: 10_000 * n }),
    ];
  });
  return data;
}

const RANGE = { from: '2026-07', to: '2026-12' } as const;
const ALL = dataset(MONTHS);

const totalsOf = (scope: string, metric: string, compare: string, data: Dataset = ALL) => {
  const selection = resolveDiagnosisSelection({ scope, metric, compare });
  const cashflow = diagnosisCashflowSeries(data, [], [], [], RANGE, selection.compare);
  return diagnosisScopeTotals(cashflow.series, cashflow.baselineSeries, selection, cashflow.range);
};

describe('AC-006 条件の帯が数値へ効く', () => {
  it('AC-006-組合せ 3 範囲 × 3 指標 × 2 比較対象の 18 通りすべてが値を返す', () => {
    const seen = new Set<string>();
    for (const scope of DIAGNOSIS_SCOPES)
      for (const metric of DIAGNOSIS_METRICS)
        for (const compare of DIAGNOSIS_COMPARES) {
          const t = totalsOf(scope, metric, compare);
          expect(Number.isFinite(t.current)).toBe(true);
          expect(t.baseline).not.toBeNull();
          expect(t.diff).toBe(t.current - (t.baseline as number));
          seen.add(`${scope}/${metric}/${compare}:${t.current}/${t.baseline}`);
        }
    expect(seen.size).toBe(18);
  });

  it('AC-006-固定値 範囲と指標の組合せごとに期間合計が違う', () => {
    // 2026-07..2026-12 は月番号 19..24。事業支出 = 1,000×Σn、家計支出 = 100×Σn、収入 = 10,000×Σn
    const sum = [19, 20, 21, 22, 23, 24].reduce((a, n) => a + n, 0); // 129
    expect(totalsOf('total', 'expense', 'previous').current).toBe(1_100 * sum);
    expect(totalsOf('business', 'expense', 'previous').current).toBe(1_000 * sum);
    expect(totalsOf('household', 'expense', 'previous').current).toBe(100 * sum);
    expect(totalsOf('total', 'income', 'previous').current).toBe(10_000 * sum);
    expect(totalsOf('total', 'net', 'previous').current).toBe((10_000 - 1_100) * sum);
  });

  it('AC-006-恒等式 どの指標でも 総合 = 事業 + 家計 (BR-004)', () => {
    for (const metric of DIAGNOSIS_METRICS) {
      const { byScope } = totalsOf('total', metric, 'previous');
      expect(byScope.total).toBe(byScope.business + byScope.household);
    }
  });

  it('AC-006-総収支と一致 期間合計が同じ期間の総収支画面の値と一致する (BR-004)', () => {
    const summary = totalCashflowScreen(ALL, [], [], [], RANGE).summary;
    expect(totalsOf('total', 'expense', 'previous').current).toBe(summary.total.expense);
    expect(totalsOf('business', 'income', 'previous').current).toBe(summary.biz.income);
    expect(totalsOf('household', 'net', 'previous').current).toBe(summary.household.balance);
  });

  it('AC-006-比較対象 前期間と前年同期で別の期間・別の値になる', () => {
    expect(diagnosisBaselineRange(RANGE, 'previous')).toEqual({ from: '2026-01', to: '2026-06' });
    expect(diagnosisBaselineRange(RANGE, 'yoy')).toEqual({ from: '2025-07', to: '2025-12' });

    const previous = totalsOf('total', 'expense', 'previous');
    const yoy = totalsOf('total', 'expense', 'yoy');
    // 前期間 = 月番号 13..18 (Σ=93)、前年同期 = 7..12 (Σ=57)
    expect(previous.baseline).toBe(1_100 * 93);
    expect(yoy.baseline).toBe(1_100 * 57);
    expect(previous.baselineLabel).toBe('前6か月');
    expect(yoy.baselineLabel).toBe('前年同期');
  });

  it('AC-006-欠け月 比較対象の月が 1 つでも取込前なら baseline を出さない (BR-006)', () => {
    const data = dataset(MONTHS.filter((m) => m !== '2025-09'));
    const t = totalsOf('total', 'expense', 'yoy', data);
    expect(t.baseline).toBeNull();
    expect(t.diff).toBeNull();
    expect(t.rate).toBeNull();
    // 当期の値は欠け月と無関係に出る
    expect(t.current).toBeGreaterThan(0);
  });

  it('AC-006-未知値 帯の未知値は既定へ倒れる (FR-010)', () => {
    const t = totalsOf('zzz', 'zzz', 'zzz');
    expect(t.current).toBe(totalsOf('total', 'expense', 'previous').current);
  });
});
