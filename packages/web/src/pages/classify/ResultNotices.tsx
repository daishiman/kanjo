import type { BulkItemBody } from '../../api.js';
/**
 * 一括保存と削除の通知 (spec-classify-screen 7.7)。
 *
 * 文言は view-model の純関数だけが作る。通知はここ 1 か所に集め、
 * 操作した場所ごとに別の言い回しが生まれないようにする。
 */
import { Button } from '../../components/Button.js';
import { bulkResultMessage, dateText, deleteMessage, undoMessage } from './view-model.js';

export interface BulkFailure {
  txId: string;
  rowKey: string;
  date: string;
  payee: string;
  message: string;
  /** 再試行は現在ページから再構築せず、失敗したペイロードそのものを送る。 */
  item: BulkItemBody | null;
}

export type ClassifyNotice =
  | { kind: 'bulk'; n: number; m: number; k: number; failures: BulkFailure[] }
  | { kind: 'delete'; n: number; operationId: string }
  | { kind: 'undo' };

export function ResultNotices({
  notice,
  busy,
  onDismiss,
  onRetry,
  onUndo,
}: {
  notice: ClassifyNotice | null;
  busy: boolean;
  onDismiss: () => void;
  onRetry: (failures: BulkFailure[]) => void;
  onUndo: (operationId: string) => void;
}) {
  if (!notice) return null;

  if (notice.kind === 'undo') {
    return (
      <output className="classify-notice is-ok">
        <span>{undoMessage()}</span>
        <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
          ×
        </Button>
      </output>
    );
  }

  if (notice.kind === 'delete') {
    return (
      <output className="classify-notice is-ng">
        <span>{deleteMessage(notice.n)}</span>
        <Button variant="text" size="mini" disabled={busy} onClick={() => onUndo(notice.operationId)}>
          元に戻す
        </Button>
        <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
          ×
        </Button>
      </output>
    );
  }

  const { tone, text } = bulkResultMessage(notice.n, notice.m, notice.k);
  return (
    <output className={`classify-notice ${tone === 'ok' ? 'is-ok' : 'is-ng'}`}>
      <span>{text}</span>
      {notice.k > 0 && (
        <>
          <Button variant="text" size="mini" disabled={busy} onClick={() => onRetry(notice.failures)}>
            {`失敗した${notice.k}件のみ再試行`}
          </Button>
          <details className="classify-notice-detail">
            <summary>失敗の内訳</summary>
            <ul>
              {notice.failures.map((f) => (
                <li key={f.txId}>
                  {dateText(f.date)} {f.payee}: {f.message}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
        ×
      </Button>
    </output>
  );
}
