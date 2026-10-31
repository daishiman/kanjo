/**
 * 操作の結果の知らせ (spec-cash-screen FR-16)。
 *
 * 時間で消さない (読み終える前に消えると『元に戻す』を押せない)。× で閉じる。
 * 削除の知らせが出たら『元に戻す』へフォーカスを移す (押した確認欄は消えて、フォーカスの行き場が無くなるため)。
 */
import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button.js';

export type CashNotice =
  | { kind: 'deleted'; ids: number[]; error?: string }
  | { kind: 'restored' }
  | { kind: 'restore-gone' }
  | { kind: 'added'; text: string; month: string | null }
  | { kind: 'saved' };

export function ResultNotices({
  notice,
  busy,
  onUndo,
  onShowMonth,
  onDismiss,
}: {
  notice: CashNotice | null;
  busy: boolean;
  onUndo: (ids: number[]) => void;
  onShowMonth: (month: string) => void;
  onDismiss: () => void;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const deletedKey = notice?.kind === 'deleted' ? notice.ids.join(',') : null;
  useEffect(() => {
    if (deletedKey) undoRef.current?.focus();
  }, [deletedKey]);
  if (!notice) return null;
  const close = (
    <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
      ×
    </Button>
  );
  if (notice.kind === 'deleted') {
    return (
      <output className="cash-notice is-ok">
        <span>
          {notice.ids.length === 1 ? '明細を削除しました。' : `${notice.ids.length} 件の明細を削除しました。`}
        </span>
        <Button ref={undoRef} variant="text" size="mini" disabled={busy} onClick={() => onUndo(notice.ids)}>
          元に戻す
        </Button>
        {notice.error && <span className="cash-error">{notice.error}</span>}
        {close}
      </output>
    );
  }
  if (notice.kind === 'restore-gone') {
    return (
      <output className="cash-notice is-ng">
        <span>この明細はもう戻せません</span>
        {close}
      </output>
    );
  }
  if (notice.kind === 'added') {
    const month = notice.month;
    return (
      <output className="cash-notice is-ok">
        <span>{notice.text}</span>
        {month && (
          <Button variant="text" size="mini" onClick={() => onShowMonth(month)}>
            その月を表示
          </Button>
        )}
        {close}
      </output>
    );
  }
  return (
    <output className="cash-notice is-ok">
      <span>{notice.kind === 'restored' ? '明細を元に戻しました。' : '変更を保存しました。'}</span>
      {close}
    </output>
  );
}
