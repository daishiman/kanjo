/** 一覧・詳細・作成フォームで共有する表示部品。ページ間の依存を作らない。 */
import { IMPROVEMENT_DIAGNOSTICS_DISCLOSURE, type ImprovementStatus, STATUS_TONE } from './view-model.js';

export function StatusBadge({ status, label }: { status: ImprovementStatus; label: string }) {
  // 色だけに頼らず、状態を文字でも示す
  return <span className={`improvement-status is-${STATUS_TONE[status]}`}>{label}</span>;
}

export function DisclosureLists() {
  return (
    <div className="improvement-disclosure-body">
      <h4>含まれる情報</h4>
      <ul>
        {IMPROVEMENT_DIAGNOSTICS_DISCLOSURE.included.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      <h4>含まれない情報</h4>
      <ul>
        {IMPROVEMENT_DIAGNOSTICS_DISCLOSURE.excluded.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
