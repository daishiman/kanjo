import type { HouseholdSummary } from '@kanjo/core';
/**
 * 月別の家計収支推移 (spec §4)。
 *
 * タブが切り替えるのはグラフの系列だけで、KPI・内訳・表は常に家計全体を示す。
 * 選択中の月は URL の `month` が正本で、月送り・棒のクリック・下部バーが同じ値を読む。
 */
import type { Chart as ChartJS, ChartOptions, Plugin } from 'chart.js';
import { type KeyboardEvent, useRef } from 'react';
import { Chart, getElementAtEvent } from 'react-chartjs-2';
import { Button } from '../../components/Button.js';
import { FinancialFigure } from '../../components/FinancialFigure.js';
import { tooltipOptions } from '../../components/chart-tooltip.js';
import { COLORS, baseChartOptions, chartDecorativeFill } from '../../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from '../../components/figure-view-model.js';
import { monthLabel, yen } from '../../format.js';
import {
  type HouseholdSeg,
  SEGMENTS,
  adjacentMonth,
  axisMonthLabel,
  percent,
  signedYen,
} from './view-model.js';

const selectedMonthBand = (index: number): Plugin<'bar' | 'line'> => ({
  id: 'householdSelectedMonthBand',
  beforeDatasetsDraw(chart) {
    if (index < 0) return;
    const x = chart.scales.x;
    const area = chart.chartArea;
    if (!x || !area) return;
    const count = chart.data.labels?.length ?? 0;
    const center = x.getPixelForValue(index);
    const step = count > 1 ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) : area.right - area.left;
    const halfWidth = Math.max(8, step / 2);
    chart.ctx.save();
    chart.ctx.fillStyle = chartDecorativeFill(COLORS.accent, 0.1);
    chart.ctx.fillRect(center - halfWidth, area.top, halfWidth * 2, area.bottom - area.top);
    chart.ctx.restore();
  },
});

/** 前年棒を点線の輪郭にし、色だけに頼らず当期と区別する。 */
const previousYearOutline: Plugin<'bar' | 'line'> = {
  id: 'householdPreviousYearOutline',
  afterDatasetDraw(chart, args) {
    if (args.index < 3) return;
    const color = args.index === 3 ? COLORS.income : COLORS.expense;
    chart.ctx.save();
    chart.ctx.strokeStyle = color;
    chart.ctx.lineWidth = 1;
    chart.ctx.setLineDash([3, 3]);
    for (const element of chart.getDatasetMeta(args.index).data) {
      const box = element.getProps(['x', 'y', 'base', 'width'], true) as {
        x: number;
        y: number;
        base: number;
        width: number;
      };
      chart.ctx.strokeRect(
        box.x - box.width / 2,
        Math.min(box.y, box.base),
        box.width,
        Math.abs(box.base - box.y),
      );
    }
    chart.ctx.restore();
  },
};

const chartOptions = (selectedIndex: number): ChartOptions<'bar' | 'line'> => ({
  ...baseChartOptions(),
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: (ctx) => ({ weight: ctx.index === selectedIndex ? 'bold' : 'normal' }),
      },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: '(万円)' },
      ticks: { callback: (value) => (Number(value) / 10_000).toLocaleString('ja-JP') },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: tooltipOptions('yen'),
  },
});

const segKey = (seg: HouseholdSeg) => (seg === 'all' ? 'total' : seg);

export function HouseholdSeries({
  data,
  seg,
  month,
  onSeg,
  onMonth,
}: {
  data: HouseholdSummary;
  seg: HouseholdSeg;
  month: string;
  onSeg: (seg: HouseholdSeg) => void;
  onMonth: (month: string) => void;
}) {
  const chartRef = useRef<ChartJS<'bar' | 'line'>>(null);
  const key = segKey(seg);
  const months = data.series.map((row) => row.month);
  const selectedIndex = months.indexOf(month);
  const labels = months.map(axisMonthLabel);
  const flatLabels = labels.map((label) => (Array.isArray(label) ? label.join(' ') : label));
  const segLabel = SEGMENTS.find((item) => item.id === seg)?.label ?? '家計全体';
  const selectedRow = data.series[selectedIndex];
  const model = createFinancialFigureModel({
    id: 'household-series',
    title: '月別の家計収支推移',
    summary: selectedRow
      ? `${monthLabel(month)}の${segLabel}の純収支は ${signedYen(selectedRow[key].balance)} です。`
      : 'この期間に表示できる月がありません。',
    period: financialPeriod(flatLabels),
    labels: flatLabels,
    series: [
      {
        key: 'income',
        label: '収入（当期）',
        values: data.series.map((row) => row[key].income),
        unit: 'yen',
        signed: false,
        color: COLORS.income,
      },
      {
        key: 'expense',
        label: '支出（当期）',
        values: data.series.map((row) => row[key].expense),
        unit: 'yen',
        signed: false,
        color: COLORS.expense,
      },
      {
        key: 'balance',
        label: '純収支（当期）',
        values: data.series.map((row) => row[key].balance),
        unit: 'yen',
        signed: true,
        color: COLORS.net,
      },
      {
        // 前年同月の実データが無い月は null (0 として描かない。spec §4.4)
        key: 'previous-income',
        label: '収入（前年）',
        values: data.series.map((row) => row.previous?.[key].income ?? null),
        unit: 'yen',
        signed: false,
        color: COLORS.income,
      },
      {
        key: 'previous-expense',
        label: '支出（前年）',
        values: data.series.map((row) => row.previous?.[key].expense ?? null),
        unit: 'yen',
        signed: false,
        color: COLORS.expense,
      },
    ],
    action: '棒をクリックするか、グラフ上の左右矢印または ‹ › で月を選ぶと、下の詳細も切り替わります。',
  });
  const prev = adjacentMonth(months, month, -1);
  const next = adjacentMonth(months, month, 1);
  const { biz, personal } = data.segments;
  const total = data.summary.total;

  const onTabKey = (event: KeyboardEvent<HTMLElement>) => {
    const at = SEGMENTS.findIndex((item) => item.id === seg);
    const last = SEGMENTS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (at + 1) % SEGMENTS.length
        : event.key === 'ArrowLeft'
          ? (at + last) % SEGMENTS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onSeg(SEGMENTS[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  const onChartKey = (event: KeyboardEvent<HTMLElement>) => {
    const picked =
      event.key === 'ArrowLeft'
        ? prev
        : event.key === 'ArrowRight'
          ? next
          : event.key === 'Home'
            ? months[0]
            : event.key === 'End'
              ? months.at(-1)
              : null;
    if (!picked) return;
    event.preventDefault();
    onMonth(picked);
  };

  return (
    <section className="card household-series" aria-label="月別の家計収支推移">
      <FinancialFigure
        model={model}
        headingLevel={2}
        className="household-financial-figure"
        beforeChart={
          <div className="household-series-controls">
            <span className="segment" role="tablist" aria-label="グラフの対象" onKeyDown={onTabKey}>
              {SEGMENTS.map((item) => (
                <button
                  key={item.id}
                  data-native-control="tab"
                  type="button"
                  role="tab"
                  aria-selected={seg === item.id}
                  // 選択中のタブだけを Tab の順に入れ、残りは矢印キーで移る (WAI-ARIA の tabs)
                  tabIndex={seg === item.id ? 0 : -1}
                  className={seg === item.id ? 'on' : ''}
                  onClick={() => onSeg(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </span>
            <div className="household-month-nav">
              <Button
                variant="text"
                size="mini"
                aria-label="前の月"
                disabled={!prev}
                onClick={() => prev && onMonth(prev)}
              >
                ‹
              </Button>
              <span className="household-month-current" aria-live="polite">
                {monthLabel(month)}
              </span>
              <Button
                variant="text"
                size="mini"
                aria-label="次の月"
                disabled={!next}
                onClick={() => next && onMonth(next)}
              >
                ›
              </Button>
            </div>
          </div>
        }
      >
        <div
          className="household-chart-keyboard"
          // biome-ignore lint/a11y/useSemanticElements: canvas と凡例を1つの名前付きキーボード操作領域として扱う。
          role="group"
          aria-label="グラフの月を選ぶ。左右矢印、Home、Endキーを使用できます"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: canvas の月選択をキーボードだけでも操作可能にする。
          tabIndex={0}
          onKeyDown={onChartKey}
        >
          <Chart
            type="bar"
            role="img"
            aria-label={`${segLabel}の月別の収入・支出・純収支と前年同月を比べる図`}
            fallbackContent={`${segLabel}の月別の収入・支出・純収支と前年同月を比べる図`}
            data={{
              labels,
              datasets: [
                {
                  type: 'bar' as const,
                  label: model.series[0]?.label,
                  data: seriesData(model, 0),
                  backgroundColor: COLORS.income,
                  borderColor: COLORS.income,
                  order: 2,
                },
                {
                  type: 'bar' as const,
                  label: model.series[1]?.label,
                  data: seriesData(model, 1),
                  backgroundColor: COLORS.expense,
                  borderColor: COLORS.expense,
                  order: 2,
                },
                {
                  type: 'line' as const,
                  label: model.series[2]?.label,
                  data: seriesData(model, 2),
                  borderColor: COLORS.net,
                  backgroundColor: COLORS.net,
                  pointRadius: 3,
                  order: 1,
                },
                {
                  // 前年は同じ色の枠だけを濃く、塗りを淡くして当期と見分ける
                  type: 'bar' as const,
                  label: model.series[3]?.label,
                  data: seriesData(model, 3),
                  backgroundColor: chartDecorativeFill(COLORS.income, 0.18),
                  borderColor: COLORS.income,
                  borderWidth: 0,
                  order: 3,
                },
                {
                  type: 'bar' as const,
                  label: model.series[4]?.label,
                  data: seriesData(model, 4),
                  backgroundColor: chartDecorativeFill(COLORS.expense, 0.18),
                  borderColor: COLORS.expense,
                  borderWidth: 0,
                  order: 3,
                },
              ],
            }}
            options={chartOptions(selectedIndex)}
            plugins={[selectedMonthBand(selectedIndex), previousYearOutline]}
            ref={chartRef}
            onClick={(event) => {
              if (!chartRef.current) return;
              const picked = months[getElementAtEvent(chartRef.current, event)[0]?.index ?? -1];
              if (picked) onMonth(picked);
            }}
          />
        </div>
      </FinancialFigure>

      <div className="household-segments">
        <h3>
          事業と個人の内訳<span className="household-note">（家計全体の内訳・重複なし）</span>
        </h3>
        <div className="household-segments-grid">
          <p>
            <span>事業の純収支</span>
            <strong>{signedYen(biz.balance)}</strong>
            <span className="household-note">（総収入の{percent(biz.incomeShare)}）</span>
          </p>
          <p>
            <span>個人の純収支</span>
            <strong>{signedYen(personal.balance)}</strong>
            <span className="household-note">（総収入の{percent(personal.incomeShare)}）</span>
          </p>
          <p className="household-equation">
            家計全体の純収支 {yenSigned(total.balance)} = 事業 {yenSigned(biz.balance)} + 個人{' '}
            {yenSigned(personal.balance)}
          </p>
        </div>
        <p className="household-note">※ 事業と個人は別会計として集計しており、金額の重複はありません。</p>
      </div>
    </section>
  );
}

/** 等式の中では正の値に `+` を付けない (`¥756,000 = 事業 ¥420,000 + …`) */
const yenSigned = (v: number) => (v < 0 ? `−${yen(-v)}` : yen(v));
