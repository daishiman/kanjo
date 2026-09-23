/**
 * 保存バー (spec-settings-screen §7.12)。
 *
 * 画面下端に固定し、未保存の項目数と入力の誤りを role=status で知らせる。
 * 押せる条件は container が決め、ここは表示と受け渡しだけを持つ。
 */
import type { RefObject } from 'react';
import { Button } from '../../components/Button.js';
import { SAVE_TEXT, unsavedLabel } from './view-model.js';

export function SettingsSaveBar({
  count,
  invalid,
  saving,
  canSave,
  resetRef,
  onReset,
  onSave,
}: {
  count: number;
  invalid: boolean;
  saving: boolean;
  canSave: boolean;
  resetRef: RefObject<HTMLButtonElement>;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="settings-save-bar">
      <output className="settings-save-status">
        {count > 0 ? (
          <>
            <span className="settings-unsaved">
              <span aria-hidden="true">⚠</span> {unsavedLabel(count)}
            </span>
            <span>{invalid ? SAVE_TEXT.invalid : SAVE_TEXT.unsavedHint}</span>
          </>
        ) : (
          <span>{SAVE_TEXT.clean}</span>
        )}
      </output>
      <div className="settings-save-actions">
        <Button ref={resetRef} disabled={count === 0 || saving} onClick={onReset}>
          {SAVE_TEXT.reset}
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={onSave}>
          {saving ? SAVE_TEXT.saving : SAVE_TEXT.save}
        </Button>
      </div>
    </div>
  );
}
