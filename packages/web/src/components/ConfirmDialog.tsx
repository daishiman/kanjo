/**
 * 取り返しのつかない操作の確認を、アプリ内の <dialog> で一箇所にまとめる。
 *
 * window.confirm を使わない理由は use-confirm-dialog.ts に書いた通りで、ブラウザの
 * 「このページでこれ以上ダイアログを表示しない」抑止が効くと即座に false が返り、
 * 呼び出し側には抑止を知る手立てが無い。押しても何も起きないボタンになり、原因も画面に出ない。
 *
 * ここを 1 つの部品にしておくのは、確認の作法 (showModal の有無・Esc の塞ぎ方・
 * 初期フォーカス・実行中に閉じさせないこと) が画面ごとにずれると、
 * 「ある画面では Esc で閉じるのに別の画面では閉じない」という読めない差になるため。
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useConfirmDialog } from './use-confirm-dialog.js';

/**
 * 「どれを対象に確認しているか」を持つ確認。
 *
 * 一覧の行ごとに確認を出す画面では、開いているかどうかだけでは足りない。
 * どの行に対する確認かを取り違えると、押した行と消える行がずれる。
 */
export function usePendingConfirm<T>({ busy = false }: { busy?: boolean } = {}) {
  const [target, setTarget] = useState<T | null>(null);
  const dialog = useConfirmDialog({ busy });

  return {
    /** 確認の対象。null の間はダイアログを出さない */
    target,
    dialog,
    ask: (next: T) => {
      setTarget(next);
      dialog.setOpen(true);
    },
    dismiss: () => {
      if (busy) return;
      dialog.close();
      setTarget(null);
    },
  };
}

export function ConfirmDialog({
  dialog,
  title,
  confirmLabel,
  busyLabel,
  onConfirm,
  onDismiss,
  className,
  children,
}: {
  dialog: ReturnType<typeof useConfirmDialog>;
  title: ReactNode;
  /**
   * 確定ボタンの語。押した先で実際に起きることを書く。
   * トリガーと同じ語にすると、確認の前後で同じ語が 2 つ並び、
   * どちらが後戻りできない側なのかが読めない。
   */
  confirmLabel: string;
  /** 実行中の語。既定を置かないのは、待たせている中身が画面ごとに違うため */
  busyLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  className?: string;
  /** 何が起きるかの説明。対象の名前や件数はここに書く */
  children?: ReactNode;
}) {
  return (
    <dialog
      ref={dialog.bind}
      className={`deletion-confirm-dialog${className ? ` ${className}` : ''}`}
      aria-labelledby={dialog.titleId}
      onClose={onDismiss}
      onCancel={(event) => {
        // 既定の閉じ方に任せると busy 中でも閉じてしまう。閉じる経路を close に一本化する
        event.preventDefault();
        onDismiss();
      }}
    >
      <div className="confirm-dialog-body">
        <h3 ref={dialog.titleRef} id={dialog.titleId} tabIndex={-1}>
          {title}
        </h3>
        {children}
        <div className="deletion-run-actions">
          <button type="button" className="primary" disabled={dialog.busy} onClick={onConfirm}>
            {dialog.busy ? busyLabel : confirmLabel}
          </button>
          <button type="button" disabled={dialog.busy} onClick={onDismiss}>
            やめる
          </button>
        </div>
      </div>
    </dialog>
  );
}
