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
import { tooltipOptions, tooltipTitle, tooltipValue } from './chart-tooltip.js';
import { COLORS, VENDOR_PALETTE, yenTick } from './charts.js';

const PALETTE = [COLORS.biz, COLORS.per, COLORS.warn, COLORS.good, ...VENDOR_PALETTE.slice(4)];
const pctTick = (v: number | string) => `${Math.round(Number(v) * 100)}%`;

function tickFor(unit: AiReportChart['unit']) {
  return unit === 'yen' ? yenTick : unit === 'pct' ? pctTick : undefined;
}

/** 系列を kind に応じて Chart.js のデータセットへ変換する */
function datasets(chart: AiReportChart): { type: 'bar' | 'line'; data: CjsData; options: ChartOptions } {
  const d = chart.data ?? { labels: [], series: [] };
  const tick = tickFor(chart.unit);
  const base: ChartOptions = {
    responsive: true,
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
    backgroundColor: `${PALETTE[i % PALETTE.length]}cc`,
    borderWidth: 0,
  });
  const line = (sr: AiChartSeries, i: number, extra: Record<string, unknown> = {}) => ({
    type: 'line' as const,
    label: sr.label,
    data: sr.data,
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: `${PALETTE[i % PALETTE.length]}33`,
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
            tooltip: tooltipOptions(
              chart.unit,
              [],
              d.labels.map((_, i) => (total[i] != null ? null : (delta[i] ?? 0))),
            ),
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
            tooltip: tooltipOptions(chart.unit, cum ? [cum.label] : []),
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
  return (
    <div className="report-chart" id={`fig-${chart.figure}`}>
      <h4>
        <span className="figure-no">{figure}</span> {chart.title}
        {chart.granularity === 'quarter' && <span className="sub">(四半期ごと)</span>}
      </h4>
      {chart.kind === 'heatmap' ? (
        <HeatmapTable chart={chart} />
      ) : (
        <Chart type={type} height={120} data={data} options={options} />
      )}
      <p className="chart-guide">
        <span className="sub">読み方: </span>
        {chart.readingGuide}
      </p>
      {caption && (
        <p className="chart-caption">
          <span className="sub">AIの読み解き: </span>
          {caption}
        </p>
      )}
    </div>
  );
}
