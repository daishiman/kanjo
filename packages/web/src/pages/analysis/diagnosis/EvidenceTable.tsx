import { Link } from 'react-router-dom';
import type { DiagnosisEvidenceRow } from '../../../api.js';
import { DataTable } from '../../../components/DataTable.js';
import { ratio } from '../../../format.js';

/**
 * 診断根拠 (FR-007)。数字が合わないときに、どのデータをどこまで見たのかを
 * 最初に確かめる場所。カバー率が測れない行は「—」を出し、0% と区別する。
 */
export function DiagnosisEvidenceTable({ evidence }: { evidence: readonly DiagnosisEvidenceRow[] }) {
  return (
    <section className="card scroll-x diagnosis-evidence" aria-label="診断の根拠">
      <h2>診断の根拠</h2>
      <DataTable
        columns={['データソース', '対象期間', 'カバー率', '主な内容', { label: '確認', sortable: false }]}
      >
        {evidence.map((row) => (
          <tr key={row.source}>
            <td>{row.source}</td>
            <td>{row.period}</td>
            <td className="num" data-sort={row.coverage ?? -1}>
              {row.coverage === null ? '—' : ratio(row.coverage, 0)}
            </td>
            <td>{row.summary}</td>
            <td>
              <Link to={row.to}>確認する</Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
