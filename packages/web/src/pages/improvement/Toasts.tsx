/**
 * 操作の直後に右下へ出す知らせ (spec FR-18、FR-19)。
 *
 * 時間で消さない (読み終える前に消えると『元に戻す』を押せない)。× で閉じる。
 * 削除の知らせが出たら『元に戻す』へフォーカスを移す (押した削除ボタンは詳細ごと消えるため)。
 */
import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button.js';
import { TEXT } from './view-model.js';

export type ImprovementNotice =
  | { kind: 'copied'; text: string }
  | { kind: 'deleted'; id: string }
  | { kind: 'info'; text: string }
  | { kind: 'error'; text: string };

export function Toasts({
  notice,
  busy,
  onUndo,
  onDismiss,
}: {
  notice: ImprovementNotice | null;
  busy: boolean;
  onUndo: (id: string) => void;
  onDismiss: () => void;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const deletedId = notice?.kind === 'deleted' ? notice.id : null;
  useEffect(() => {
    if (deletedId) undoRef.current?.focus();
  }, [deletedId]);
  if (!notice) return null;
  const tone = notice.kind === 'error' ? 'is-ng' : 'is-ok';
  return (
    <output className={`improvement-toast ${tone}`} aria-live="polite">
      {notice.kind === 'deleted' ? (
        <>
          <span>{TEXT.deleted}</span>
          <Button ref={undoRef} variant="text" size="mini" disabled={busy} onClick={() => onUndo(notice.id)}>
            元に戻す
          </Button>
        </>
      ) : (
        <span>{notice.text}</span>
      )}
      <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
        ×
      </Button>
    </output>
  );
}
