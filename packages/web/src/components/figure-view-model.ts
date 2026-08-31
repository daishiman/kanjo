/**
 * 図(FinancialFigure)の表示アダプタ。
 *
 * 会計の計算はしない。API/analysis が出した数値を、図と表が「同じ値・同じ表記」で
 * 出せる形に1度だけ変換する。
 *
 * なぜ7要素(見出し→結論→期間と単位→凡例→図→次の行動→正確な値の表)なのか:
 * - 数字を読み慣れていない利用者は、図を見ても「で、どうすればいいのか」に辿り着けない。
 *   先に結論(summary)を1文で言い、図はその裏づけとして見せる。図が主役だと結論が読み手任せになる。
 * - 期間と単位を図の外に出すのは、狭い画面で軸ラベルが省略されても意味が落ちないようにするため。
 * - 図の後に「次の行動」を置くのは、結論→根拠→次の一手 の順で読み終われるようにするため。
 * - 最後の <details> 表は検算用。canvas は読み上げも拡大もコピーもできないので、
 *   同じ数値を必ずテキストでも持たせる。ここを別計算にすると図と表がずれるため、
 *   表は必ずこのモデルの rows から作る(呼び出し側で再集計しない)。
 *
 * 命名: データ抽出は financial-chart-model.ts、表示への変換はこのファイル。
 */

export type FinancialFigureUnit = 'yen' | 'pct' | 'count';

export interface FinancialFigureSeries {
  key: string;
  label: string;
  values: readonly (number | null | undefined)[];
  unit?: FinancialFigureUnit;
  /** 増減や収支のように、正値にも符号を表示する。 */
  signed?: boolean;
  /** 図でこの系列に使う色。凡例チップがこれを見る(未指定なら色を出さない)。 */
  color?: string;
}

export interface FinancialFigureCell {
  raw: number | null;
  text: string;
}

export interface FinancialFigureRow {
  key: string;
  label: string;
  cells: readonly FinancialFigureCell[];
}

export interface FinancialFigureSummarySeries {
  key: string;
  label: string;
  color?: string;
}

export interface FinancialFigureModel {
  id: string;
  title: string;
  summary: string;
  period: string;
  unitLabel: string;
  rowHeader: string;
  /** 図と同じ主要系列。非canvasの凡例もこれを読む。 */
  summarySeries: readonly FinancialFigureSummarySeries[];
  /** 正確な表に残す全系列。 */
  series: readonly FinancialFigureSeries[];
  rows: readonly FinancialFigureRow[];
  /**
   * この図を見たあとの次の一手。
   * 「表で確認し、」のような前置きは書かない。直下の <details> の見出しが
   * 「正確な値を表で確認」であり、逐語で重複するため。1画面に図が4〜5個並ぶので、
   * 全図が同じ書き出しになると、どれも次の行動として読まれなくなる。
   * 図ごとに違う行き先・違う判断だけを書く。
   */
  action: string;
  tableLabel: string;
}

interface FinancialFigureInput
  extends Omit<
    FinancialFigureModel,
    'rows' | 'summarySeries' | 'series' | 'tableLabel' | 'rowHeader' | 'unitLabel'
  > {
  labels: readonly string[];
  /** 表の1列目の見出し。多くの図は月別なので既定は「月」。 */
  rowHeader?: string;
  /** 単位の表示。多くの図は円なので既定は「円」。 */
  unitLabel?: string;
  summarySeries?: readonly FinancialFigureSummarySeries[];
  series: readonly FinancialFigureSeries[];
  tableLabel?: string;
}

/** 凡例に並べる系列の上限。これを超えた分は1行に畳む(色を追えない凡例にしない)。 */
const LEGEND_SERIES_LIMIT = 6;

export function financialPeriod(labels: readonly string[]): string {
  if (!labels.length) return '対象期間なし';
  if (labels.length === 1) return labels[0] ?? '対象期間なし';
  return `${labels[0]}〜${labels[labels.length - 1]}`;
}

export interface FormatFinancialValueOptions {
  /** 正値にも符号を付ける(増減・収支)。 */
  signed?: boolean;
  /** 値が無いときの文言。表は「—」、図のツールチップは理由まで書く。 */
  nullText?: string;
}

/**
 * 図と表で共通の数値表記。
 * 表記が2実装あると、同じ raw が図では「1,234円」表では「¥1,234」になり、
 * 利用者に別の数字だと思わせる。単位付きの文字はすべてここを通す。
 */
export function formatFinancialValue(
  value: number | null | undefined,
  unit: FinancialFigureUnit,
  options: FormatFinancialValueOptions = {},
): string {
  const { signed = false, nullText = '—' } = options;
  if (value == null || !Number.isFinite(value)) return nullText;

  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  if (unit === 'pct') return `${sign}${(Math.abs(value) * 100).toFixed(1)}%`;
  if (unit === 'count') return `${sign}${Math.abs(value).toLocaleString('ja-JP')}件`;
  const rounded = Math.round(value);
  const yenSign = rounded < 0 ? '-' : signed && rounded > 0 ? '+' : '';
  return `${yenSign}¥${Math.abs(rounded).toLocaleString('ja-JP')}`;
}

/**
 * Chart と正確な値の表に同じ labels/series を渡すための pure adapter。
 * 長さが足りない series は「データなし」として null で補い、表で別の
 * 会計計算をしない。
 */
export function createFinancialFigureModel(input: FinancialFigureInput): FinancialFigureModel {
  const series = input.series.map((item) => ({ ...item, values: [...item.values] }));
  const summarySeries = input.summarySeries?.map((item) => ({ ...item })) ?? [
    ...series.slice(0, LEGEND_SERIES_LIMIT).map(({ key, label, color }) => ({ key, label, color })),
    ...(series.length > LEGEND_SERIES_LIMIT
      ? [
          {
            key: `${input.id}-remaining-series`,
            label: `他${series.length - LEGEND_SERIES_LIMIT}系列（正確な表に表示）`,
          },
        ]
      : []),
  ];
  const rows = input.labels.map((label, index) => ({
    key: `${index}-${label}`,
    label,
    cells: series.map((item) => {
      const value = item.values[index];
      const raw = value == null || !Number.isFinite(value) ? null : value;
      return {
        raw,
        text: formatFinancialValue(raw, item.unit ?? 'yen', { signed: item.signed }),
      };
    }),
  }));

  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    period: input.period,
    unitLabel: input.unitLabel ?? '円',
    rowHeader: input.rowHeader ?? '月',
    summarySeries,
    series,
    rows,
    action: input.action,
    tableLabel: input.tableLabel ?? `${input.title}の正確な値`,
  };
}

/**
 * 図の横軸ラベル。
 * 呼び出し側が model.rows の内部構造を知らずに Chart.js へ渡せるようにする。
 */
export function figureLabels(model: FinancialFigureModel): string[] {
  return model.rows.map((row) => row.label);
}

/**
 * index 番目の系列の生値。
 * `rows.map((row) => row.cells[N]?.raw)` を各画面に書くと view-model の内部構造が
 * 呼び出し側に漏れ、rows/cells の形を変えられなくなる。
 */
export function seriesData(model: FinancialFigureModel, index: number): (number | null)[] {
  return model.rows.map((row) => row.cells[index]?.raw ?? null);
}
