/**
 * AIレポートの図表カタログ描画(spec §16 v3)。
 * - 数値はすべてアプリ(API側 catalog.ts)が計算した凍結スナップショット。ここでは形に変換して Chart.js に渡すだけ。
 * - kind ごとの描き方を1箇所に固定する(同じ図は毎回同じ形で出る)。
 * - 出せない図も枠を残し、「あと何ヶ月分で出せるか」を示す(無言の空白を作らない)。
 */
import type { ChartOptions, ChartData as CjsData } from 'chart.js';
import type { ReactNode } from 'react';
import { Chart } from 'react-chartjs-2';
import type { AiChartSeries, AiReportChart } from '../api.js';
import { FinancialFigure } from './FinancialFigure.js';
import { tooltipOptions, tooltipTitle, tooltipValue } from './chart-tooltip.js';
import { COLORS, baseChartOptions, vendorPalette, yenTick } from './charts.js';
import { createFinancialFigureModel, financialPeriod } from './figure-view-model.js';

const pctTick = (v: number | string) => `${Math.round(Number(v) * 100)}%`;

function tickFor(unit: AiReportChart['unit']) {
  return unit === 'yen' ? yenTick : unit === 'pct' ? pctTick : undefined;
}

/** 系列を kind に応じて Chart.js のデータセットへ変換する */
function datasets(chart: AiReportChart): { type: 'bar' | 'line'; data: CjsData; options: ChartOptions } {
  const d = chart.data ?? { labels: [], series: [] };
  const tick = tickFor(chart.unit);
  const palette = vendorPalette();
  const base: ChartOptions = {
    ...baseChartOptions(),
    scales: { x: {}, y: { ticks: tick ? { callback: tick } : undefined } },
    plugins: {
      legend: { position: 'bottom', display: d.series.length > 1 },
      // 触れたときの文言は用語辞書とそろえる(chart-tooltip.ts)
      tooltip: tooltipOptions(chart.unit),
    },
  };
  const bar = (sr: AiChartSeries, i: number) => ({
    type: 'bar' as const,
    label: sr.label,
    data: sr.data,
    backgroundColor: `${palette[i % palette.length]}cc`,
    borderWidth: 0,
  });
  const line = (sr: AiChartSeries, i: number, extra: Record<string, unknown> = {}) => ({
    type: 'line' as const,
    label: sr.label,
    data: sr.data,
    borderColor: palette[i % palette.length],
    backgroundColor: `${palette[i % palette.length]}33`,
    borderWidth: 2,
    pointRadius: 2,
    tension: 0.2,
    spanGaps: false,
    ...extra,
  });

  switch (chart.kind) {
    case 'line':
      return {
        type: 'line',
        data: {
          labels: d.labels,
          datasets: d.series.map((sr, i) =>
            line(sr, i, sr.role === 'line' ? { borderDash: [6, 3], pointRadius: 0 } : {}),
          ),
        },
        options: base,
      };
    case 'band': {
      // 経費(実線)・平均(破線)・平均±2σ(塗りつぶしの帯)
      const idxUp = d.series.findIndex((s) => s.label.includes('+2σ'));
      return {
        type: 'line',
        data: {
          labels: d.labels,
          datasets: d.series.map((sr, i) => {
            if (sr.role === 'band')
              return line(sr, 3, {
                borderColor: `${COLORS.good}66`,
                borderWidth: 1,
                pointRadius: 0,
                backgroundColor: `${COLORS.good}22`,
                fill: i === idxUp ? '+1' : false,
              });
            if (sr.role === 'line') return line(sr, 1, { borderDash: [6, 3], pointRadius: 0 });
            return line(sr, 0);
          }),
        },
        options: base,
      };
    }
    case 'waterfall': {
      // 合計(両端)と増減(中間)を浮動棒にする。増加=赤系、減少=緑系、合計=青系
      const total = d.series.find((s) => s.role === 'total')?.data ?? [];
      const delta = d.series.find((s) => s.role !== 'total')?.data ?? [];
      let running = total[0] ?? 0;
      const floats: ([number, number] | null)[] = [];
      const colors: string[] = [];
      d.labels.forEach((_, i) => {
        if (total[i] != null) {
          floats.push([0, total[i] as number]);
          colors.push(`${COLORS.biz}cc`);
          return;
        }
        const v = delta[i] ?? 0;
        floats.push(v >= 0 ? [running, running + v] : [running + v, running]);
        colors.push(v >= 0 ? `${COLORS.danger}cc` : `${COLORS.good}cc`);
        running += v;
      });
      return {
        type: 'bar',
        data: {
          labels: d.labels,
          datasets: [
            { label: '金額', data: floats as unknown as number[], backgroundColor: colors, borderWidth: 0 },
          ],
        },
        options: {
          ...base,
          plugins: {
            legend: { display: false },
            tooltip: tooltipOptions(chart.unit, {
              signedFloatingValues: d.labels.map((_, i) => (total[i] != null ? null : (delta[i] ?? 0))),
              // 表側の series.signed(下の createFinancialFigureModel)と同じ条件
              signed: true,
            }),
          },
        },
      };
    }
    case 'pareto': {
      const amount = d.series.find((s) => s.role !== 'cum');
      const cum = d.series.find((s) => s.role === 'cum');
      return {
        type: 'bar',
        data: {
          labels: d.labels,
          datasets: [
            ...(amount ? [bar(amount, 0)] : []),
            ...(cum ? [line(cum, 2, { yAxisID: 'y1', pointRadius: 2 })] : []),
          ],
        },
        options: {
          ...base,
          // 累積構成比だけは右軸の割合として読ませる
          plugins: {
            ...base.plugins,
            tooltip: tooltipOptions(chart.unit, { pctSeries: cum ? [cum.label] : [] }),
          },
          scales: {
            x: {},
            y: { ticks: tick ? { callback: tick } : undefined },
            y1: {
              position: 'right',
              min: 0,
              max: 1,
              ticks: { callback: pctTick },
              grid: { drawOnChartArea: false },
            },
          },
        },
      };
    }
    case 'stackedBar':
      return {
        type: 'bar',
        data: {
          labels: d.labels,
          datasets: d.series.map((sr, i) =>
            sr.role === 'line'
              ? line(sr, i, sr.label.includes('分岐') ? { borderDash: [6, 3], pointRadius: 0 } : {})
              : { ...bar(sr, i), stack: 'a' },
          ),
        },
        options: {
          ...base,
          scales: {
            x: { stacked: true },
            y: { stacked: true, ticks: tick ? { callback: tick } : undefined },
          },
        },
      };
    default:
      return {
        type: 'bar',
        data: { labels: d.labels, datasets: d.series.map(bar) },
        options: base,
      };
  }
}

/**
 * ヒートマップ(図9)。Chart.js に行列を描く仕組みが無いので、色を塗った表として出す。
 * 濃さは「行(科目)の中での大小」。行ごとに最大月を最も濃くするので、行をまたいだ濃さの比較はしない。
 */
function HeatmapTable({ chart }: { chart: AiReportChart }) {
  const d = chart.data ?? { labels: [], series: [] };
  return (
    // FinancialFigure の <details> 表を出さない図なので、この表が正確な値の正本。
    // 読み上げから隠すと、ヒートマップの数値に辿り着く手段が無くなる
    <div className="heatmap-scroll">
      <table className="data heatmap">
        <thead>
          <tr>
            <th scope="col">科目</th>
            {d.labels.map((l) => (
              <th key={l} scope="col" className="num">
                {tooltipTitle(l)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.series.map((sr) => {
            const max = sr.data.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);
            return (
              <tr key={sr.label}>
                <th scope="row">{sr.label}</th>
                {sr.data.map((v, i) => (
                  <td
                    // 月ラベルと1対1で並ぶ固定長の列なので、行名+月ラベルで一意になる
                    key={`${sr.label}-${d.labels[i] ?? i}`}
                    className="num heat"
                    style={
                      v == null || max <= 0
                        ? undefined
                        : { backgroundColor: `${COLORS.biz}${shade(v / max)}` }
                    }
                    title={`${sr.label} ${tooltipTitle(d.labels[i] ?? '')}: ${tooltipValue(v, chart.unit)}`}
                  >
                    {v == null ? '' : yenTick(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 0〜1 の割合を16進の不透明度(薄い 0x0d 〜 濃い 0xe6)にする */
function shade(ratio: number): string {
  const a = Math.round(13 + Math.min(1, Math.max(0, ratio)) * (230 - 13));
  return a.toString(16).padStart(2, '0');
}

const STATUS_TEXT: Record<AiReportChart['status'], string> = {
  ok: '',
  source_missing: '元データが足りません',
  app_missing: 'アプリ側の計算で出せませんでした(不具合の可能性があります)',
};

export function ReportChartView({ chart, caption }: { chart: AiReportChart; caption?: ReactNode }) {
  const figure = `図${chart.figure}`;
  if (!chart.available || !chart.data) {
    return (
      <div className="report-chart unavailable" id={`fig-${chart.figure}`}>
        <h4>
          <span className="figure-no">{figure}</span> {chart.title}
        </h4>
        <div className="chart-placeholder">
          <p>
            {chart.monthsNeeded != null && chart.monthsNeeded > 0
              ? `この図はあと${chart.monthsNeeded}ヶ月分のデータで表示できます。`
              : STATUS_TEXT[chart.status] || 'この図は今のデータでは表示できません。'}
          </p>
          {chart.reason && <p className="sub">{chart.reason}</p>}
        </div>
        <p className="sub">目的: {chart.purpose}</p>
      </div>
    );
  }
  const { type, data, options } = datasets(chart);
  const labels = chart.data.labels.map(tooltipTitle);
  // 凡例チップの色は、図のデータセットを決めたのと同じ場所から取る(別に色を選ぶと図と食い違う)。
  // kind ごとに色の付け方が違うので、系列名で引き当てる。引けない系列は色なし。
  const seriesColors = new Map<string, string | undefined>(
    data.datasets.map((ds) => [
      String(ds.label ?? ''),
      typeof (ds as { borderColor?: unknown }).borderColor === 'string'
        ? (ds as { borderColor: string }).borderColor
        : typeof ds.backgroundColor === 'string'
          ? ds.backgroundColor
          : undefined,
    ]),
  );
  const model = createFinancialFigureModel({
    id: `report-chart-${chart.figure}`,
    title: `${figure} ${chart.title}${chart.granularity === 'quarter' ? '（四半期ごと）' : ''}`,
    summary: chart.readingGuide,
    period: financialPeriod(labels),
    unitLabel: chart.unit === 'yen' ? '円' : chart.unit === 'pct' ? '%' : '件数',
    rowHeader: chart.granularity === 'quarter' ? '四半期' : '期間',
    labels,
    series: chart.data.series.map((series, index) => ({
      key: `${index}-${series.label}`,
      label: series.label,
      values: series.data,
      unit: series.role === 'cum' ? 'pct' : chart.unit,
      signed: chart.kind === 'waterfall',
      color: seriesColors.get(series.label),
    })),
    action: chart.purpose,
  });
  const isHeatmap = chart.kind === 'heatmap';
  return (
    <FinancialFigure
      model={model}
      className="report-chart"
      anchorId={`fig-${chart.figure}`}
      headingLevel={4}
      // ヒートマップは図そのものが表。<details> の表を出すと、同じ数字が行と列を入れ替えて2度並ぶ
      hideDetails={isHeatmap}
      afterChart={
        // 読み方は model.summary が正本。ここに同じ文をもう一度置かない
        caption ? (
          <p className="chart-caption">
            <span className="sub">AIの読み解き: </span>
            {caption}
          </p>
        ) : null
      }
    >
      {isHeatmap ? (
        <HeatmapTable chart={chart} />
      ) : (
        <Chart
          type={type}
          role="img"
          aria-label={`${chart.title}の関係を示す図`}
          fallbackContent={`${chart.title}の関係を示す図`}
          data={data}
          options={options}
        />
      )}
    </FinancialFigure>
  );
}
