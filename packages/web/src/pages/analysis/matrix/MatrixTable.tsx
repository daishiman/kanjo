import type { MatrixData } from '../../../api.js';
/**
 * 科目×月の表（仕様 §3.2 / §3.3）。
 *
 * 塗るのは `HeatGrid` ひとつだけで、この画面は分母を持たない。階級の対象から合計・平均を
 * 外すのは `model.ts` の仕事であり、部品はどの行が合計かを知らない（§3.3 `dec-matrix-heat-scale`）。
 */
import { COLORS } from '../../../components/charts.js';
import { chartDecorativeFill } from '../../../components/charts.js';
import { HeatGrid } from '../../../components/heatmap/heat-grid.js';
import { heatBandLowerBounds, heatShade } from '../../../components/heatmap/heat-model.js';
import { man, pct } from '../../../format.js';
import { type MatrixMode, matrixTableModel } from './model.js';

/** 濃淡の凡例（§3.3「色だけに頼らせない」）。判定と同じ下限の配列を見る。 */
function HeatLegend({ scale }: { scale: ReturnType<typeof matrixTableModel>['scale'] }) {
  const bounds = heatBandLowerBounds(scale);
  if (scale.max <= 0) return null;
  return (
    <p className="sub heat-legend">
      <span>少ない</span>
      {bounds.map((lower, band) => (
        <span
          key={lower}
          className="heat-legend-swatch"
          title={`${man(lower)} 以上`}
          style={{
            backgroundColor: chartDecorativeFill(
              COLORS.accent,
              heatShade(bounds.length <= 1 ? 1 : band / (bounds.length - 1)),
            ),
          }}
        />
      ))}
      <span>多い（{man(scale.max)}）</span>
    </p>
  );
}

export interface MatrixTableProps {
  data: MatrixData;
  mode: MatrixMode;
}

export function MatrixTable({ data, mode }: MatrixTableProps) {
  const model = matrixTableModel(data, mode);
  return (
    <>
      {model.shaded ? <HeatLegend scale={model.scale} /> : null}
      <HeatGrid
        className="card scroll-x matrix-table-card"
        columns={model.columns}
        rows={model.rows}
        rowHeader="科目"
        caption="科目別の月次明細"
        color={COLORS.accent}
        formatValue={model.shaded ? man : (v) => pct(v)}
      />
    </>
  );
}
