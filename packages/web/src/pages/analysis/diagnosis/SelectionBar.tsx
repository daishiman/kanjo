import { Link } from 'react-router-dom';
import type { DiagnosisImprovement } from '../../../api.js';
import { PageActions } from '../../../components/Page.js';
import { yen } from '../../../format.js';
import { EFFORT_LABEL, SEVERITY_LABEL, SEVERITY_PILL } from './types.js';

/**
 * 選択中の課題の判断を決めるバー。
 *
 * 楽観更新をしない (ADR-006)。保存が通ってから再取得した値で表を描き直す。
 * 判断は合計・棒・シグナルの全部に効くので、失敗した書込みを画面に残すと
 * 「表の合計」と「図の合計」がずれたまま操作が続いてしまう。
 */
export function DiagnosisSelectionBar({
  row,
}: {
  row: DiagnosisImprovement;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: PageActions は共通の固定操作コンテナ。landmark名を付ける。
    <PageActions className="diagnosis-selection" role="region" aria-label="選択中の課題">
      <div className="diagnosis-selection-summary">
        <span>選択中</span>
        <strong>{row.label}</strong>
        <span className={SEVERITY_PILL[row.severity]}>優先度 {SEVERITY_LABEL[row.severity]}</span>
      </div>
      <div className="diagnosis-selection-impact">
        <span>{row.impactBasis === 'one_off' ? '単発の改善見込み' : '年間改善インパクト'}</span>
        <strong className="num">{yen(row.annualImpact)}</strong>
        <span>手間 {EFFORT_LABEL[row.effort]}</span>
      </div>
      <Link className="btn primary" to={row.nextAction.to}>
        {row.nextAction.label}
        <span aria-hidden="true">→</span>
      </Link>
    </PageActions>
  );
}
