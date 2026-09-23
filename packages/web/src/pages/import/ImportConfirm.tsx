/**
 * 取り返しのつかない操作 (取込・置換・取り消し・履歴の削除) の確認。
 * window.confirm はブラウザの抑止で即 false を返すことがあるので、アプリ内の <dialog> で行う。
 * 実行中は Esc も「やめる」も塞ぎ (busy)、閉じる経路を 1 つに保つ。
 */
import type { ReactNode } from 'react';
import { Button } from '../../components/Button.js';
import type { useConfirmDialog } from '../../components/use-confirm-dialog.js';

export function ImportConfirm({
  dialog,
  title,
  children,
  confirmLabel,
  busyLabel,
  danger = false,
  onConfirm,
}: {
  dialog: ReturnType<typeof useConfirmDialog>;
  title: ReactNode;
  children?: ReactNode;
  /** 押した先で実際に起きることを語にする (トリガーと同じ語にしない) */
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  if (!dialog.open) return null;
  return (
    <dialog
      ref={dialog.bind}
      className="deletion-confirm-dialog import-confirm-dialog"
      aria-labelledby={dialog.titleId}
      onClose={dialog.close}
      onCancel={(event) => {
        event.preventDefault();
        dialog.close();
      }}
    >
      <div className="import-discard-confirmation">
        <h3 ref={dialog.titleRef} id={dialog.titleId} tabIndex={-1}>
          {title}
        </h3>
        {children}
        <div className="deletion-run-actions">
          <Button variant={danger ? 'danger' : 'primary'} disabled={dialog.busy} onClick={onConfirm}>
            {dialog.busy ? busyLabel : confirmLabel}
          </Button>
          <Button disabled={dialog.busy} onClick={dialog.close}>
            やめる
          </Button>
        </div>
      </div>
    </dialog>
  );
}
