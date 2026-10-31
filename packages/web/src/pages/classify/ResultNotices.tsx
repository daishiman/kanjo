/**
 * 一括保存と削除の通知 (spec-classify-screen 7.7・spec-classify-bulk-save FR-07・FR-16)。
 *
 * 文言は view-model の純関数だけが作る。通知はここ 1 か所に集め、
 * 操作した場所ごとに別の言い回しが生まれないようにする。
 */
import type { BulkSaveBody } from '../../api.js';
import { Button } from '../../components/Button.js';
import { bulkResultMessage, dateText, deleteMessage, undoMessage } from './view-model.js';

export interface BulkFailure {
  txId: string;
  date: string;
  payee: string;
  message: string;
}

export type ClassifyNotice =
  | {
      kind: 'bulk';
      /** 送った件数・保存できた件数・保存できなかった件数 */
      n: number;
      m: number;
      k: number;
      failures: BulkFailure[];
      /** 書き込みに失敗した明細だけの本文。一括指定は送ったときのまま (AC-07) */
      retryBody: BulkSaveBody | null;
    }
  | {
      /** 要求全体の失敗。retryBody は直前に送った本文そのもの (FR-16) */
      kind: 'request';
      message: string;
      retryBody: BulkSaveBody | null;
    }
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
  onRetry: (body: BulkSaveBody) => void;
  onUndo: (operationId: string) => void;
}) {
  if (!notice) return null;

  const dismiss = (
    <Button variant="text" size="mini" aria-label="通知を閉じる" onClick={onDismiss}>
      ×
    </Button>
  );

  if (notice.kind === 'undo') {
    return (
      <output className="classify-notice is-ok">
        <span>{undoMessage()}</span>
        {dismiss}
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
        {dismiss}
      </output>
    );
  }

  if (notice.kind === 'request') {
    const { retryBody } = notice;
    // 何も保存されなかった (かもしれない) ので、結果の通知 (status) ではなくエラー (alert) で伝える
    return (
      <div role="alert" className="classify-notice is-ng">
        <span>{notice.message}</span>
        {retryBody && (
          <Button variant="text" size="mini" disabled={busy} onClick={() => onRetry(retryBody)}>
            同じ内容で再試行
          </Button>
        )}
        {dismiss}
      </div>
    );
  }

  const { tone, text } = bulkResultMessage(notice.n, notice.m, notice.k);
  const { retryBody } = notice;
  return (
    <output className={`classify-notice ${tone === 'ok' ? 'is-ok' : 'is-ng'}`}>
      <span>{text}</span>
      {retryBody && (
        <Button variant="text" size="mini" disabled={busy} onClick={() => onRetry(retryBody)}>
          {`失敗した${retryBody.items.length}件のみ再試行`}
        </Button>
      )}
      {notice.k > 0 && (
        <details className="classify-notice-detail">
          <summary>失敗の内訳</summary>
          <ul>
            {notice.failures.map((f) => (
              <li key={f.txId}>
                {f.date ? `${dateText(f.date)} ` : ''}
                {f.payee}: {f.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {dismiss}
    </output>
  );
}
