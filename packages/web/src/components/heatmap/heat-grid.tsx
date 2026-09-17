/**
 * 濃淡を塗る唯一の表部品（仕様 §3.3 の制約 1〜5）。
 *
 * この部品は分母を受け取らない。塗る値は `heat-model.ts` が作った `cells[].intensity` からしか
 * 来ないので、描画側が分母を再計算する余地が型で消えている。色も props で受け取る
 * （マトリックス画面は `COLOR.accent`、AI レポートの図 9 は `COLORS.biz`）。
 */
import { chartDecorativeFill } from '../charts.js';
import { type HeatRow, heatShade } from './heat-model.js';

export interface HeatGridProps {
  /** 列見出し（表示用の文字列そのもの）。 */
  columns: readonly string[];
  rows: readonly HeatRow[];
  /** 行見出し列の見出し。 */
  rowHeader: string;
  /**
   * 表の名前。読み上げで表を名指しできるよう、見えない caption として出す。
   * 画面に複数の表が並ぶので、名前が無いと「どの表か」を伝えられない。
   */
  caption?: string;
  /** 塗る色（`#rrggbb`）。部品内に固定しない。 */
  color: string;
  formatValue: (value: number) => string;
  cellTitle?: (row: HeatRow, columnIndex: number) => string;
  selected?: { rowKey: string; column: string } | null;
  onSelect?: (rowKey: string, column: string) => void;
  /** 外側レイアウト（高さ・余白・横スクロール）は親が与える。 */
  className?: string;
}

export function HeatGrid({
  columns,
  rows,
  rowHeader,
  caption,
  color,
  formatValue,
  cellTitle,
  selected,
  onSelect,
  className,
}: HeatGridProps) {
  return (
    <div className={className}>
      <table className="data heatmap">
        {caption ? <caption className="visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, i) => {
                const column = columns[i] ?? String(i);
                const isSelected = selected?.rowKey === row.key && selected?.column === column;
                // 未記帳は「値が無い」ではなく「まだ記録していない」なので、空欄と区別して名乗らせる（§3.3）
                const text =
                  cell.value == null ? (
                    cell.absence === 'unrecorded' ? (
                      <span className="pill neutral">未記帳</span>
                    ) : (
                      ''
                    )
                  ) : (
                    formatValue(cell.value)
                  );
                return (
                  <td
                    // 列は固定長で列見出しと 1 対 1 に並ぶので、行キー + 列見出しで一意になる
                    key={`${row.key}-${column}`}
                    className={`num heat${cell.className ? ` ${cell.className}` : ''}`}
                    style={
                      cell.intensity == null
                        ? undefined
                        : { backgroundColor: chartDecorativeFill(color, heatShade(cell.intensity)) }
                    }
                    title={cellTitle?.(row, i)}
                  >
                    {/* セルを選べる表では、押せるものを button にする。
                        td 自身に onClick を付けるとマウスでしか選べない */}
                    {onSelect ? (
                      <button
                        // 押された状態を持つセル。共通 Button ではなく native button の
                        // `toggle` 例外に入る（`NATIVE_BUTTON_EXCEPTION_MARKERS`）
                        data-native-control="toggle"
                        type="button"
                        className="heat-cell"
                        aria-pressed={isSelected}
                        onClick={() => onSelect(row.key, column)}
                      >
                        {text}
                      </button>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
