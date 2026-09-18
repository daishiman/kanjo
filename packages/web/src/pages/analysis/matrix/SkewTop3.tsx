/**
 * 偏りが大きい 3 点（仕様 §5.1）。
 *
 * 順位の規則は core の `matrixSkewTop`（= `zScores`）が持つ。ここで再計算しない。
 * 画面ごとに違う定義で「大きく動いた科目」を出していたのが β の実体なので、
 * この部品が自前の閾値や式を持った時点で問題が戻る。
 */
import { type MatrixSkewRow, matrixSkewTop } from '@kanjo/core';
import type { MatrixData } from '../../../api.js';
import { DataTable } from '../../../components/DataTable.js';
import { deltaCls, man, monthLabel, pct } from '../../../format.js';

export interface SkewTop3Props {
  data: MatrixData;
  limit?: number;
}

export function SkewTop3({ data, limit = 3 }: SkewTop3Props) {
  const rows: MatrixSkewRow[] = data.rows
    .filter((r) => !r.isTotal)
    .map((r) => ({ key: r.label, label: r.label, series: r.series }));
  const points = matrixSkewTop(
    { months: data.months, unrecordedMonths: data.unrecordedExpMonths, rows },
    limit,
  );

  if (points.length === 0) return <p className="sub">偏りを判定できる記帳済みの月がまだありません。</p>;

  return (
    <DataTable
      className="data"
      caption={<caption className="visually-hidden">偏りが大きい{points.length}点</caption>}
      columns={['順位', '科目', '月', '金額', '前月比', '前年同月比']}
    >
      {points.map((p) => (
        <tr key={`${p.rowKey}-${p.month}`}>
          <th scope="row">{p.rank}</th>
          <td>{p.rowLabel}</td>
          <td>{monthLabel(p.month)}</td>
          <td className="num">{man(p.amount)}</td>
          <td className={`num ${deltaCls(p.momRate)}`}>{pct(p.momRate)}</td>
          <td className={`num ${deltaCls(p.yoyRate)}`}>{pct(p.yoyRate)}</td>
        </tr>
      ))}
    </DataTable>
  );
}
