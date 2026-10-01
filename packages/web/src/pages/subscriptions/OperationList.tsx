/**
 * 「操作」のカード。待機中・処理中・完了・失敗を 1 行ずつ並べ、失敗は「再試行」、統合は「元に戻す」を持つ。
 * 失敗はここで行として見せ、画面上部の赤い帯や role=alert は使わない (SM-UX-04)。
 * 読み上げは完了と失敗だけを 1 つの aria-live に入れ、行の差し替えごとには読ませない。
 */
import { type Ref, forwardRef } from 'react';
import { Button } from '../../components/Button.js';
import { shortDateTime } from './format.js';
import { type OperationRow, STATE_TEXT } from './operationRows.js';

interface Props {
  rows: readonly OperationRow[];
  liveText: string;
  historyFailed?: boolean;
  historyFetching?: boolean;
  onRetryHistory?: () => void;
  onRetry: (clientOpId: number) => void;
  onUndo: (operationId: string, targetName: string | null) => void;
}

function OperationListInner(
  { rows, liveText, onRetry, onUndo, historyFailed, historyFetching, onRetryHistory }: Props,
  headingRef: Ref<HTMLHeadingElement>,
) {
  if (rows.length === 0 && !historyFailed) return null;
  return (
    <section className="card subs-operations" aria-labelledby="subs-operations-title">
      <h2 id="subs-operations-title" ref={headingRef} tabIndex={-1}>
        操作
      </h2>
      <p className="visually-hidden" aria-live="polite">
        {liveText}
      </p>
      {historyFailed && (
        <div className="subs-inline-error" role="alert">
          <p>操作履歴を読み込めませんでした。</p>
          <Button size="mini" disabled={historyFetching} onClick={onRetryHistory}>
            {historyFetching ? '履歴を読み直しています…' : '履歴を読み直す'}
          </Button>
        </div>
      )}
      <ul className="subs-operation-list">
        {rows.map((row) => (
          <li
            key={row.key}
            className={`subs-operation is-${row.state}`}
            data-operation-id={row.operationId ?? undefined}
          >
            <span className="subs-operation-state">{STATE_TEXT[row.state]}</span>
            <span className="subs-operation-text">
              <span className="subs-operation-label">{row.label}</span>
              {row.detail ? <span className="subs-operation-detail">{row.detail}</span> : null}
            </span>
            <span className="subs-operation-actor">{row.actor}</span>
            <time className="subs-operation-time" dateTime={row.at}>
              {shortDateTime(row.at)}
            </time>
            {row.retryOf !== null ? (
              <Button variant="secondary" size="mini" onClick={() => onRetry(row.retryOf as number)}>
                再試行
              </Button>
            ) : null}
            {row.undo ? (
              <Button
                variant="secondary"
                size="mini"
                disabled={row.undo.pending}
                onClick={() => {
                  if (row.undo) onUndo(row.undo.operationId, row.undo.targetName);
                }}
              >
                元に戻す
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export const OperationList = forwardRef(OperationListInner);
