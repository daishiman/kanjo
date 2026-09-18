/**
 * `MatrixData`（§9.1）を表の見た目へ写す（仕様 §3.2 / §3.3）。
 *
 * ここには**計算を書かない**。合計・平均・濃淡の分母・偏りの順位はすべて core が持っており
 * （`matrix-derived.ts` / `heat-scale.ts`）、このファイルは「どの行を本体として渡すか」
 * という表側の知識だけを担う。§3.3 が言うとおり、合計を分母から外すのは階級を計算する側の
 * 責務であり、描画部品ではない。
 */
import {
  type HeatScale,
  heatScaleOf,
  matrixBodyValues,
  matrixColumnSummary,
  matrixRowSummary,
  recordedIndexes,
} from '@kanjo/core';
import type { MatrixData } from '../../../api.js';
import { type HeatCell, type HeatRow, heatIntensities } from '../../../components/heatmap/heat-model.js';
import { deltaCls } from '../../../format.js';

/** 現行の切替群。§2.2 の `all|share|yoy` への移行は P07/P08 の task に残る。 */
export type MatrixMode = 'val' | 'mom' | 'yoy';

export const SUMMARY_COLUMNS = ['合計', '平均'] as const;

export interface MatrixTableModel {
  /** 月見出し 13 列 + `合計` + `平均`。 */
  columns: string[];
  /** 本体行（濃淡あり）に続けて `合計` 行・`平均` 行（濃淡なし）。 */
  rows: HeatRow[];
  /** 凡例が使う分母。本体セルだけから取る。 */
  scale: HeatScale;
  /** 濃淡を塗っているか。率モードでは分母が §3.3 に定義されていないので塗らない。 */
  shaded: boolean;
}

/** 月見出し `YYYY/MM`（§3.2）。 */
export function monthColumn(month: string): string {
  return month.replace('-', '/');
}

/** 前年同月の `YYYY-MM`。 */
function prevYearMonth(month: string): string {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
}

/** 濃淡を持たないセル（合計列・平均列・率モードのセル）。 */
const plain = (value: number | null): HeatCell => ({ value, intensity: null });

/**
 * 率モードのセル。前月／前年同月が未記帳・0 のときは比較の相手がいないので `null`。
 * 濃淡は付けない: §3.3 が分母を定めているのは金額であり、率に同じ分母は使えない。
 */
function rateCell(
  series: readonly number[],
  i: number,
  baseIndex: number | undefined,
  unrecordedBase: boolean,
): HeatCell {
  if (baseIndex === undefined || unrecordedBase) return plain(null);
  const base = series[baseIndex] ?? 0;
  if (base <= 0) return plain(null);
  const rate = (series[i] ?? 0) / base - 1;
  return { value: rate, intensity: null, className: deltaCls(rate) };
}

export function matrixTableModel(data: MatrixData, mode: MatrixMode): MatrixTableModel {
  const { months } = data;
  const unrecorded = new Set(data.unrecordedExpMonths);
  const recorded = recordedIndexes(months, data.unrecordedExpMonths);
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  // §3.2 の表は経費のマトリックスなので、core が付ける集計行（経費計・売上）は本体に入れない。
  // 合計行・平均行はここで本体行から作る。こうすると「合計行と合計列の交点が総計」が構造上保証される。
  const body = data.rows.filter((r) => !r.isTotal);

  const columns = [...months.map(monthColumn), ...SUMMARY_COLUMNS];
  const scale = heatScaleOf(matrixBodyValues(body, recorded));
  const shaded = mode === 'val';

  const bodyRows: HeatRow[] = body.map((row) => {
    const summary = matrixRowSummary(row.series, recorded);
    const monthCells: HeatCell[] = months.map((month, i) => {
      if (unrecorded.has(month)) return { value: null, intensity: null, absence: 'unrecorded' };
      if (mode === 'val') return { value: row.series[i] ?? null, intensity: null };
      if (mode === 'mom')
        return rateCell(row.series, i, i > 0 ? i - 1 : undefined, unrecorded.has(months[i - 1] ?? ''));
      const prev = prevYearMonth(month);
      return rateCell(row.series, i, monthIndex.get(prev), unrecorded.has(prev));
    });

    if (shaded) {
      // 分母は本体セル全体（`scale`）。行ごとに取り直さないので月をまたいで濃さを比べられる
      const { intensities } = heatIntensities(
        monthCells.map((c) => c.value),
        'table',
        { scale },
      );
      for (const [i, cell] of monthCells.entries()) cell.intensity = intensities[i] ?? null;
    }

    return {
      key: row.label,
      label: row.label,
      cells: [...monthCells, plain(shaded ? summary.total : null), plain(shaded ? summary.average : null)],
    };
  });

  if (!shaded) return { columns, rows: bodyRows, scale, shaded };

  const columnTotals = months.map((month, i) =>
    unrecorded.has(month) ? null : matrixColumnSummary(body, i),
  );
  // 総計は合計列の和として出す。行合計の和から別に出すと、二つの経路が食い違う余地が残る
  const grand = columnTotals.reduce((s, c) => s + (c?.total ?? 0), 0);

  const totalRow: HeatRow = {
    key: '合計',
    label: '合計',
    cells: [
      ...months.map((month, i) =>
        unrecorded.has(month)
          ? ({ value: null, intensity: null, absence: 'unrecorded' } as HeatCell)
          : plain(columnTotals[i]?.total ?? null),
      ),
      plain(grand),
      plain(recorded.length > 0 ? grand / recorded.length : null),
    ],
  };

  // §3.2: 平均行の `合計`/`平均` 列は `-`（平均の合計にも平均にも意味が無い）
  const averageRow: HeatRow = {
    key: '平均',
    label: '平均',
    cells: [
      ...months.map((month, i) =>
        unrecorded.has(month)
          ? ({ value: null, intensity: null, absence: 'unrecorded' } as HeatCell)
          : plain(columnTotals[i]?.average ?? null),
      ),
      plain(null),
      plain(null),
    ],
  };

  return { columns, rows: [...bodyRows, totalRow, averageRow], scale, shaded };
}
