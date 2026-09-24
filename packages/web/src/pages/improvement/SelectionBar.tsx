/**
 * 下部固定の選択中バー (spec FR-20)。
 *
 * 一覧を下へ読み進めても、選んだ依頼の番号とコピーの入口が手元に残るようにする。
 * コピー先はバーの中で切り替える。既定は Codex (画像の『Codex用をコピー』)。
 */
import { useState } from 'react';
import { Button } from '../../components/Button.js';
import { DeferredUiIcon as UiIcon } from '../../components/DeferredUiIcon.js';
import { StatusBadge } from './ImprovementParts.js';
import {
  COPY_REISSUE_NOTICE,
  COPY_TARGETS,
  COPY_TARGET_LABEL,
  type CopyTarget,
  IMPROVEMENT_STATUS_LABEL,
  type ImprovementStatus,
} from './view-model.js';

export function SelectionBar({
  number,
  summary,
  status,
  busy,
  willReissueOnCopy,
  onCopy,
  onClose,
}: {
  number: string;
  summary: string;
  status: ImprovementStatus;
  busy: boolean;
  willReissueOnCopy: boolean;
  onCopy: (target: CopyTarget) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<CopyTarget>('codex');
  return (
    <section className="improvement-selection-bar" aria-label="選択中の改善リクエスト">
      <span className="improvement-selection-label">選択中</span>
      <strong className="improvement-number">{number}</strong>
      <span className="improvement-selection-summary">{summary}</span>
      <StatusBadge status={status} label={IMPROVEMENT_STATUS_LABEL[status]} />
      {willReissueOnCopy && <p className="sub improvement-copy-notice">{COPY_REISSUE_NOTICE}</p>}
      <div className="improvement-selection-actions">
        <Button variant="primary" size="mini" disabled={busy} onClick={() => onCopy(target)}>
          {COPY_TARGET_LABEL[target]}用をコピー
        </Button>
        <label className="improvement-copy-target">
          <span className="visually-hidden">コピー先</span>
          <select value={target} onChange={(e) => setTarget(e.target.value as CopyTarget)}>
            {COPY_TARGETS.map((t) => (
              <option key={t} value={t}>
                {COPY_TARGET_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="text" size="mini" aria-label="選択を外す" onClick={onClose}>
          <UiIcon name="close" />
        </Button>
      </div>
    </section>
  );
}
