import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DIAGNOSIS_ACTION_STATUSES,
  type DiagnosisActionStatus,
  type DiagnosisImprovement,
} from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { dateTime, yen } from '../../../format.js';
import {
  CONFIDENCE_LABEL,
  EFFORT_LABEL,
  IMPACT_BASIS_LABEL,
  SEVERITY_LABEL,
  SEVERITY_PILL,
  STATUS_PILL,
} from './types.js';

type Tab = 'summary' | 'data' | 'samples';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'summary', label: '概要' },
  { id: 'data', label: '関連データ' },
  { id: 'samples', label: '明細サンプル' },
];

/**
 * 選択した課題の詳細パネル。
 *
 * 明細サンプルのタブは、API が明細そのものを返さないので「どの出典の・どの期間を見たか」と
 * その確認先への導線を出す。ここで明細を取りに行くと、診断の 1 応答で画面が閉じなくなる。
 */
const NOTE_MAX = 500;

export function DiagnosisDetailPanel({
  row,
  onSave,
  saving,
  error,
}: {
  row: DiagnosisImprovement;
  onSave: (input: { status: DiagnosisActionStatus; note: string | null }) => void;
  saving: boolean;
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>('summary');
  const baseId = useId().replaceAll(':', '');
  const noteId = `${baseId}-note`;
  const [note, setNote] = useState(row.note ?? '');
  const sources = [...new Set(row.evidence.map((item) => item.source))];

  return (
    <section className="card diagnosis-detail" aria-label="課題の詳細">
      <div className="diagnosis-detail-heading">
        <span className={SEVERITY_PILL[row.severity]}>優先度 {SEVERITY_LABEL[row.severity]}</span>
        <h2>{row.label}</h2>
        <span className={STATUS_PILL[row.status] ?? 'pill neutral'}>{row.status}</span>
      </div>
      <div className="segment" role="tablist" aria-label="詳細の表示内容">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-native-control="tab"
            role="tab"
            id={`${baseId}-${item.id}-tab`}
            aria-selected={tab === item.id}
            aria-controls={`${baseId}-${item.id}`}
            className={tab === item.id ? 'on' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id={`${baseId}-summary`}
        role="tabpanel"
        aria-labelledby={`${baseId}-summary-tab`}
        hidden={tab !== 'summary'}
      >
        <p className="diagnosis-detail-lead">{row.detail}</p>
        <h3>なぜ優先度が高いのか</h3>
        <ul className="diagnosis-reason-list">
          <li>
            {row.impactBasis === 'one_off' ? '単発' : '年間'}{' '}
            <span className="num">{yen(row.annualImpact)}</span> の改善余地がある
          </li>
          <li>見積りの確からしさは「{CONFIDENCE_LABEL[row.confidence]}」</li>
          <li>{row.evidence.length} 件の数値根拠から判定している</li>
        </ul>
        <h3>関連する数値</h3>
        <dl className="diagnosis-detail-facts">
          <div>
            <dt>{row.impactBasis === 'one_off' ? '単発の改善見込み' : '年間改善インパクト'}</dt>
            <dd className="num">{yen(row.annualImpact)}</dd>
          </div>
          <div>
            <dt>見込みの時間軸</dt>
            <dd>
              {IMPACT_BASIS_LABEL[row.impactBasis]} <span className="num">{yen(row.monthlyImpact)}</span>
            </dd>
          </div>
          <div>
            <dt>対応の手間</dt>
            <dd>{EFFORT_LABEL[row.effort]}</dd>
          </div>
          <div>
            <dt>見積りの確からしさ</dt>
            <dd>{CONFIDENCE_LABEL[row.confidence]}</dd>
          </div>
        </dl>
        <h3>主な内訳</h3>
        <dl className="diagnosis-detail-breakdown">
          {row.evidence.map((item) => (
            <div key={`${item.label}-${item.period}`}>
              <dt>{item.label}</dt>
              <dd className="num">{yen(item.value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        id={`${baseId}-data`}
        role="tabpanel"
        aria-labelledby={`${baseId}-data-tab`}
        hidden={tab !== 'data'}
        className="scroll-x"
      >
        <table
          className="data"
          data-table-kind="comparison"
          data-sort-reason="実測値と比較対象を1行で左右に並べる根拠表。検知器が並べた切り分けの順序が根拠そのもので、並べ替えると何と何を比べたかが読めなくなる"
        >
          <thead>
            <tr>
              <th>指標</th>
              <th>実測値</th>
              <th>比較対象</th>
              <th>期間</th>
            </tr>
          </thead>
          <tbody>
            {row.evidence.map((item) => (
              <tr key={`${item.label}-${item.period}`}>
                <td>{item.label}</td>
                <td className="num">{yen(item.value)}</td>
                <td className="num">{item.baseline === null ? '—' : yen(item.baseline)}</td>
                <td>{item.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        id={`${baseId}-samples`}
        role="tabpanel"
        aria-labelledby={`${baseId}-samples-tab`}
        hidden={tab !== 'samples'}
      >
        <div className="diagnosis-sample-empty">
          <h3>明細は実行先で確認できます</h3>
          <p>{`この診断応答には取引明細を含めていません。${sources.join(' / ')} の「${row.target}」へ絞り込んで確認します。`}</p>
          <Link to={row.nextAction.to}>{row.nextAction.label}で明細を確認する</Link>
        </div>
      </div>

      <details className="diagnosis-action-state">
        <summary>対応状況とメモ</summary>
        {row.decided_at && <p className="sub">最終更新 {dateTime(row.decided_at)}</p>}
        <div className="diagnosis-selection-status">
          <span className="diagnosis-condition-label">対応状況</span>
          {/* biome-ignore lint/a11y/useSemanticElements: 共通 segment と既存 toggle 契約を保つ。 */}
          <span className="segment" role="group" aria-label="対応状況">
            {DIAGNOSIS_ACTION_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                data-native-control="toggle"
                disabled={saving}
                aria-pressed={row.status === status}
                className={row.status === status ? 'on' : ''}
                onClick={() => onSave({ status, note: note.trim() ? note : null })}
              >
                {status}
              </button>
            ))}
          </span>
        </div>
        <div className="diagnosis-selection-note">
          <label htmlFor={noteId}>判断メモ ({NOTE_MAX} 文字以内)</label>
          <textarea
            id={noteId}
            value={note}
            maxLength={NOTE_MAX}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            disabled={saving}
            onClick={() => onSave({ status: row.status, note: note.trim() ? note : null })}
          >
            {saving ? '保存中…' : 'メモを保存する'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="diagnosis-selection-error">
            {error}。入力内容は残っています。通信状態を確認して、もう一度保存してください。
          </p>
        )}
      </details>
    </section>
  );
}
