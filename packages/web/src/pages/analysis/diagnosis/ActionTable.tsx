import { Link } from 'react-router-dom';
import type { DiagnosisImprovement, DiagnosisTotals } from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { DataTable } from '../../../components/DataTable.js';
import { yen } from '../../../format.js';
import {
  EFFORT_LABEL,
  IMPACT_BASIS_LABEL,
  SEVERITY_LABEL,
  SEVERITY_PILL,
  STATUS_PILL,
  type Update,
} from './types.js';

/**
 * 改善アクションの優先順位 (FR-002 / FR-003)。
 *
 * 並びと合計はサーバが決めた値をそのまま使う。画面側で filter/reduce をやり直すと、
 * 畳んだ件数の注記とウォーターフォールの合計が食い違うため (BR-001)。
 * 番号は「年間インパクト降順の順位」であり、配列の添字をそのまま出している。
 */
export function DiagnosisActionTable({
  improvements,
  totals,
  selected,
  showDone,
  update,
}: {
  improvements: readonly DiagnosisImprovement[];
  totals: DiagnosisTotals;
  selected: string | null;
  showDone: boolean;
  update: Update;
}) {
  // 対応済み・見送りは既定で畳む。showDone のときだけ同じ並びのまま混ぜて出す
  const settled = (row: DiagnosisImprovement) => row.status === '対応済み' || row.status === '見送り';
  const candidates = showDone ? improvements : improvements.filter((row) => !settled(row));
  const rows = candidates.slice(0, 6);

  return (
    <section className="card diagnosis-actions" aria-label="改善アクションの優先順位">
      <div className="diagnosis-actions-head">
        <h2>改善アクションの優先順位</h2>
        <span className="sub num">
          未対応 {totals.activeCount} 件 / 年間 {yen(totals.active)}
        </span>
        <Button
          variant="text"
          size="mini"
          aria-pressed={showDone}
          onClick={() => update({ done: showDone ? null : '1' })}
        >
          {showDone ? '対応済み・見送りを畳む' : '対応済み・見送りも表示'}
        </Button>
      </div>
      {totals.collapsedCount > 0 && !showDone && (
        <p className="sub diagnosis-collapsed-note">
          対応済み・見送り {totals.collapsedCount} 件 (年間 {yen(totals.collapsed)}) を畳んでいます。
          合計には含めていません。
        </p>
      )}
      {rows.length === 0 ? (
        // biome-ignore lint/a11y/useSemanticElements: 見出しと次の行動を含む空状態を、更新通知として扱う。
        <div className="diagnosis-actions-empty" role="status">
          <h3>未対応の改善アクションはありません</h3>
          <p>対応済みの項目を確認するか、次回のデータ取込後にもう一度診断してください。</p>
          <Link className="btn" to="/import">
            取込状況を確認する
          </Link>
        </div>
      ) : (
        <div className="scroll-x diagnosis-actions-table-wrap">
          <DataTable
            className="data stack-sm diagnosis-action-table"
            columns={[
              { label: '#', sortable: false },
              '課題',
              '優先度',
              '年間改善インパクト',
              '対応の手間',
              'ステータス',
              { label: '次のアクション', sortable: false },
            ]}
          >
            {rows.map((row) => {
              const rank = improvements.indexOf(row) + 1;
              return (
                <tr
                  key={row.action_key}
                  className={selected === row.action_key ? 'diagnosis-row is-selected' : 'diagnosis-row'}
                  aria-current={selected === row.action_key ? 'true' : undefined}
                >
                  <td className="num" data-label="順位">
                    {rank}
                  </td>
                  <td data-label="課題">
                    <strong>{row.label}</strong>
                    <div className="sub">{row.target}</div>
                  </td>
                  <td data-label="優先度">
                    <span className={SEVERITY_PILL[row.severity]}>{SEVERITY_LABEL[row.severity]}</span>
                  </td>
                  <td className="num" data-label="年間改善インパクト" data-sort={row.annualImpact}>
                    {yen(row.annualImpact)}
                    <div className="sub num">
                      {IMPACT_BASIS_LABEL[row.impactBasis]} {yen(row.monthlyImpact)}
                    </div>
                  </td>
                  <td data-label="対応の手間">{EFFORT_LABEL[row.effort]}</td>
                  <td data-label="ステータス">
                    <span className={STATUS_PILL[row.status] ?? 'pill neutral'}>{row.status}</span>
                  </td>
                  <td data-label="次のアクション">
                    <Button
                      variant="text"
                      size="mini"
                      aria-label={row.label}
                      aria-pressed={selected === row.action_key}
                      onClick={() => update({ action: row.action_key })}
                    >
                      詳細を見る
                    </Button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}
      {candidates.length > rows.length && (
        <p className="sub diagnosis-more-note">
          上位 6 件を表示しています。残り {candidates.length - rows.length} 件。
        </p>
      )}
    </section>
  );
}
