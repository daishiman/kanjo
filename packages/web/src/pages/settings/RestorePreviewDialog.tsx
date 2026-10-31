/**
 * 設定の復元の確認 (spec-settings-screen §7.9・§7.10)。
 *
 * 設定ファイルとバックアップの 2 経路で同じ形を使う。差分の件数を節ごとに 1 行で出し、
 * 差分が 0 件なら『復元する』を止める。失敗は閉じずにダイアログの中へ出す (何も変わっていないため)。
 */
import type { SettingsDiff } from '@kanjo/core';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import type { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { DATA_TEXT, DRAFT_DISCARD_NOTE, RESTORE_NOTE, SAME_CONTENT, diffLines } from './view-model.js';

export function RestorePreviewDialog({
  dialog,
  title,
  diff,
  hasDraft,
  error,
  onConfirm,
  onDismiss,
}: {
  dialog: ReturnType<typeof useConfirmDialog>;
  title: string;
  diff: SettingsDiff;
  hasDraft: boolean;
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const same = diff.total === 0;
  return (
    <ConfirmDialog
      dialog={dialog}
      title={title}
      confirmLabel={DATA_TEXT.restoreConfirm}
      busyLabel={DATA_TEXT.restoreBusy}
      dismissLabel={DATA_TEXT.cancel}
      confirmDisabled={same}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    >
      {same ? (
        <p>{SAME_CONTENT}</p>
      ) : (
        <ul className="settings-diff">
          {diffLines(diff).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="sub">{RESTORE_NOTE}</p>
      {hasDraft && <p className="sub">{DRAFT_DISCARD_NOTE}</p>}
      {error && (
        <p className="settings-field-error" role="alert">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
