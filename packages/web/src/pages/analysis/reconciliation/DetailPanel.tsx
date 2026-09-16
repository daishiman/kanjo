import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button.js';
import { UiIcon } from '../../../components/UiIcon.js';
import { yen } from '../../../format.js';
import type { ReconciliationActionKind, ReconciliationLastAction } from './api.js';
import { ACTION_LABELS, type ReconciliationRow, isPending, slashDate } from './model.js';

const dateTime = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const DetailPanel = forwardRef<
  HTMLElement,
  {
    row: ReconciliationRow;
    lastAction: ReconciliationLastAction | null;
    busy: boolean;
    onClose: () => void;
    onAction: (action: ReconciliationActionKind) => void;
    onUndo: (id: string) => void;
  }
>(function DetailPanel({ row, lastAction, busy, onClose, onAction, onUndo }, ref) {
  const canMatch = Boolean(row.freee?.freeeKey ?? row.candidateKeys[0]);
  const mfOnly = row.status === 'mfOnly';
  return (
    <aside ref={ref} className="card recon-detail" aria-label="取引の詳細">
      <div className="recon-detail-head">
        <h2>取引の詳細</h2>
        <Button variant="text" aria-label="詳細を閉じる" onClick={onClose}>
          <UiIcon name="close" />
        </Button>
      </div>

      <section className="recon-detail-block" aria-label="MoneyForwardの取引">
        <h3>MoneyForwardの取引</h3>
        <dl>
          <dt>日付</dt>
          <dd>{slashDate(row.mf.date)}</dd>
          <dt>内容</dt>
          <dd>{row.mf.content || '—'}</dd>
          <dt>金額</dt>
          <dd className="num">{yen(row.mf.amount)}</dd>
          <dt>利用先</dt>
          <dd>{[row.mf.major, row.mf.middle].filter(Boolean).join(' / ') || '—'}</dd>
          <dt>口座・カード</dt>
          <dd>{row.mf.institution || '—'}</dd>
          <dt>メモ</dt>
          <dd>{row.mf.memo || '—'}</dd>
        </dl>
      </section>

      <section className="recon-detail-block" aria-label="freeeの候補">
        <h3>freeeの候補</h3>
        {row.freee ? (
          <dl>
            <dt>日付</dt>
            <dd>{slashDate(row.freee.date)}</dd>
            <dt>内容</dt>
            <dd>{row.freee.partner || '—'}</dd>
            <dt>金額</dt>
            <dd className="num">{yen(row.freee.amount)}</dd>
            <dt>勘定科目</dt>
            <dd>{row.freee.account || '—'}</dd>
            <dt>補助科目</dt>
            <dd>{row.freee.settleAccount || '—'}</dd>
            <dt>メモ</dt>
            <dd>—</dd>
          </dl>
        ) : (
          <p className="sub">freeeに候補となる取引がありません。</p>
        )}
      </section>

      {mfOnly && (
        <p className="recon-detail-note" role="note">
          <UiIcon name="info" />
          <span>
            freeeに相手の無い支出です。総収支にはMFの金額で計上済みのため、照合の対応は要りません。事業・家計の区分が違うときだけ、仕分けで直してください。
          </span>
        </p>
      )}

      {row.reasons.length > 0 && (
        <div className="recon-detail-block">
          <h3>一致の理由</h3>
          <ul className="recon-reasons" aria-label="一致の理由">
            {row.reasons.map((reason) => (
              <li key={reason.kind} className={reason.ok ? 'is-ok' : 'is-ng'}>
                <UiIcon name={reason.ok ? 'check' : 'circle-x'} />
                {reason.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.score !== null && (
        <div className="recon-score">
          <span>一致度</span>
          <strong>{row.score}%</strong>
          <div
            className="recon-score-bar"
            role="meter"
            aria-label="一致度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={row.score}
          >
            <span style={{ inlineSize: `${row.score}%` }} />
          </div>
        </div>
      )}

      <div className="recon-detail-actions">
        {isPending(row) && (
          <>
            {!canMatch && (
              <p id="recon-candidate-action-note" className="recon-detail-note" role="note">
                <UiIcon name="info" />
                <span>freee候補がないため、照合と「別の取引」は実行できません。</span>
              </p>
            )}
            <Button
              variant="primary"
              disabled={busy || !canMatch}
              aria-describedby={canMatch ? undefined : 'recon-candidate-action-note'}
              onClick={() => onAction('same')}
            >
              同じ取引として照合
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !canMatch}
              aria-describedby={canMatch ? undefined : 'recon-candidate-action-note'}
              onClick={() => onAction('different')}
            >
              別の取引として処理
            </Button>
            <Button variant="text" disabled={busy} onClick={() => onAction('exclude-mf')}>
              照合から除外する
            </Button>
          </>
        )}
        <Link className="btn recon-open-classify" to={`/classify?month=${encodeURIComponent(row.month)}`}>
          仕分けを開く
          <UiIcon name="external-link" />
        </Link>
      </div>

      {lastAction && (
        <section className="recon-last-action" aria-label="直前の操作">
          <h3>直前の操作</h3>
          <p>
            <time dateTime={lastAction.createdAt}>{dateTime.format(new Date(lastAction.createdAt))}</time>{' '}
            {lastAction.targetCount}件を{ACTION_LABELS[lastAction.action]}
          </p>
          <Button variant="text" disabled={busy} onClick={() => onUndo(lastAction.id)}>
            <UiIcon name="rotate-ccw" />
            元に戻す
          </Button>
        </section>
      )}
    </aside>
  );
});
