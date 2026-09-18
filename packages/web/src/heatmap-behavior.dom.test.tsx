// @vitest-environment jsdom

/**
 * AIレポートのヒートマップ(図9)の現行の見え方を固定する。
 *
 * このテストは新機能の受入ではなく「移設の基準」である。濃淡の計算は現在
 * `ReportChart.tsx` の中に直書きされており、同じ考え方の実装が画面側にも別にある。
 * これを共通部品へ寄せる作業は、寄せた前後で同じ値が出ることを示せない限り
 * 「見た目が少し変わった」を検出できない。先にここで現行の値を釘付けにしてから動かす。
 *
 * 固定するのは次の5点:
 * - 濃さの分母は行ごとの最大 (行をまたいだ濃さの比較はしない)
 * - 濃度は 13/255 〜 230/255 の範囲へ写す
 * - 値が無いセルと、行の最大が 0 以下の行は塗らない
 * - 数値はセルの中に文字としても出る (色だけに情報を持たせない)
 * - 図そのものが表なので <details> の表を二重に出さない
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiReportChart } from './api.js';
import { ReportChartView } from './components/ReportChart.js';
import { COLORS, chartDecorativeFill } from './components/charts.js';

// ヒートマップは Chart.js を通らないが、同じモジュールが他の kind のために読み込まれる
vi.mock('react-chartjs-2', () => ({
  Chart: () => <div data-chart-placeholder="true" />,
}));

afterEach(cleanup);

/** 現行実装の濃度式 (ReportChart.tsx の shade)。期待値を別の式で書き直さない */
const shade = (ratio: number) => (13 + Math.min(1, Math.max(0, ratio)) * (230 - 13)) / 255;

/**
 * 期待色を実際のセルと同じ表現へ揃える。
 * `chartDecorativeFill` が返すのは 8 桁の 16 進だが、DOM に入ると `rgba(...)` へ正規化される。
 * 文字列の形ではなく色そのものを比べたいので、期待値も一度 DOM に通してから取り出す。
 */
const asRendered = (css: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = css;
  return probe.style.backgroundColor;
};

/** その濃度でセルに現れるはずの背景色 */
const heatColor = (ratio: number) => asRendered(chartDecorativeFill(COLORS.biz, shade(ratio)));

const heatmapChart = (series: AiReportChart['data']): AiReportChart => ({
  id: 'account-month-heatmap',
  figure: 9,
  title: '科目 × 月のヒートマップ',
  kind: 'heatmap',
  unit: 'yen',
  purpose: 'どの科目がどの月に偏っているかを見る',
  readingGuide: '濃い月ほどその科目の中で多く使っている。',
  available: true,
  reason: null,
  monthsNeeded: null,
  granularity: 'month',
  data: series,
  status: 'ok',
  caption: '',
});

const cellsOf = (rowName: string) =>
  within(screen.getByRole('row', { name: new RegExp(`^${rowName}`) })).getAllByRole('cell');

describe('ヒートマップの濃淡 (移設の基準)', () => {
  it('濃さの分母は行ごとの最大で、行をまたぐと同じ値でも濃さが違う', () => {
    render(
      <ReportChartView
        chart={heatmapChart({
          labels: ['2026-01', '2026-02'],
          series: [
            { label: '仕入高', data: [100000, 200000] },
            { label: '通信費', data: [100000, 100000] },
          ],
        })}
      />,
    );

    const [shiire1, shiire2] = cellsOf('仕入高') as HTMLElement[];
    const [tsushin1] = cellsOf('通信費') as HTMLElement[];

    // 仕入高の行の最大は 200000 なので 100000 は半分の位置
    expect(shiire1.style.backgroundColor).toBe(heatColor(0.5));
    expect(shiire2.style.backgroundColor).toBe(heatColor(1));
    // 通信費の行の最大は 100000 なので、同じ 100000 が最も濃くなる
    expect(tsushin1.style.backgroundColor).toBe(heatColor(1));
    // 同じ値なのに濃さが違う = 行ごとの正規化であることの証拠
    expect(shiire1.style.backgroundColor).not.toBe(tsushin1.style.backgroundColor);
  });

  it('値が無いセルと、行の最大が 0 以下の行は塗らない', () => {
    render(
      <ReportChartView
        chart={heatmapChart({
          labels: ['2026-01', '2026-02'],
          series: [
            { label: '欠測あり', data: [null, 50000] },
            { label: '全部ゼロ', data: [0, 0] },
          ],
        })}
      />,
    );

    const [missing, present] = cellsOf('欠測あり');
    expect(missing.getAttribute('style')).toBeNull();
    expect(missing.textContent).toBe('');
    expect(present.getAttribute('style')).not.toBeNull();

    for (const cell of cellsOf('全部ゼロ')) {
      expect(cell.getAttribute('style')).toBeNull();
    }
  });

  it('数値は色だけでなくセルの文字としても出る', () => {
    render(
      <ReportChartView
        chart={heatmapChart({
          labels: ['2026-01'],
          series: [{ label: '仕入高', data: [356000] }],
        })}
      />,
    );

    const [cell] = cellsOf('仕入高');
    expect(cell.textContent).not.toBe('');
    // 触れたときの文言は「行名 月: 値」の順
    expect(cell.getAttribute('title')).toMatch(/^仕入高 .+: .+$/);
  });

  it('図そのものが表なので、同じ数値を <details> の表として二重に出さない', () => {
    const { container } = render(
      <ReportChartView
        chart={heatmapChart({
          labels: ['2026-01'],
          series: [{ label: '仕入高', data: [356000] }],
        })}
      />,
    );

    expect(container.querySelectorAll('table.heatmap').length).toBe(1);
    expect(container.querySelectorAll('details').length).toBe(0);
  });
});
