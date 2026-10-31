/**
 * 保存バー (spec-budget-screen §7.9)。
 *
 * 画面下端に固定し、未保存の項目数・最終保存・下書きの自動保存を role=status で知らせる。
 * 押せる条件は container が決め、ここは表示と受け渡しだけを持つ。
 */
import type { RefObject } from 'react';
import { Button } from '../../components/Button.js';
import { EMPTY_INPUT_NOTE, draftSavedLabel, lastSavedLabel, unsavedLabel } from './view-model.js';

export function BudgetSaveBar({
  unsavedCount,
  savedAt,
  draftSavedAt,
  allEmpty,
  canSave,
  saving,
  resetRef,
  onReset,
  onSave,
}: {
  unsavedCount: number;
  savedAt: string | null;
  draftSavedAt: string | null;
  allEmpty: boolean;
  canSave: boolean;
  saving: boolean;
  resetRef: RefObject<HTMLButtonElement>;
  onReset: () => void;
  onSave: () => void;
}) {
  const draft = draftSavedLabel(draftSavedAt);
  return (
    <div className="budget-save-bar">
      <output className="budget-save-status">
        <span className={unsavedCount > 0 ? 'budget-unsaved-count' : undefined}>
          {unsavedLabel(unsavedCount)}
        </span>
        <span>{lastSavedLabel(savedAt)}</span>
        {draft && <span>{draft}</span>}
        {allEmpty && <span className="budget-save-hint">{EMPTY_INPUT_NOTE}</span>}
      </output>
      <div className="budget-save-actions">
        <Button ref={resetRef} disabled={unsavedCount === 0 || saving} onClick={onReset}>
          リセット
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={onSave}>
          {saving ? '保存中…' : '予算を保存'}
        </Button>
      </div>
    </div>
  );
}
