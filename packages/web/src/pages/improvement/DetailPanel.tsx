/**
 * 「改善リクエストの詳細」(spec FR-12〜FR-17)。
 *
 * 状態の移れる先・概要・画面名・診断の要約・履歴の文言は api が core で導いて返す。
 * ここは並べて、押された操作をページへ伝えるだけにする (API を呼ぶのはページ側)。
 */
import { useEffect, useId, useRef, useState } from 'react';
import { type ImprovementDetailResponse, improvementScreenshotUrl } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DeferredUiIcon as UiIcon } from '../../components/DeferredUiIcon.js';
import { DisclosureLists, StatusBadge } from './ImprovementParts.js';
import {
  COPY_REISSUE_NOTICE,
  COPY_TARGETS,
  COPY_TARGET_LABEL,
  type CopyTarget,
  IMPROVEMENT_STATUS_LABEL,
  type ImprovementStatus,
  TEXT,
  formatDateTime,
} from './view-model.js';

export interface DetailActions {
  onClose: () => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onStatus: (status: ImprovementStatus) => void;
  onReissue: () => void;
  onCopy: (target: CopyTarget) => void;
  onDelete: () => void;
}

export function DetailPanel({
  detail,
  status,
  busy,
  actionError,
  willReissueOnCopy,
  actions,
}: {
  detail: ImprovementDetailResponse | undefined;
  status: 'none' | 'pending' | 'error' | 'success';
  busy: boolean;
  actionError: string | null;
  willReissueOnCopy: boolean;
  actions: DetailActions;
}) {
  if (status === 'none') {
    return (
      <aside className="card improvement-detail is-empty" aria-label="改善リクエストの詳細">
        <p className="sub">{TEXT.unselected}</p>
      </aside>
    );
  }
  if (status === 'error') {
    return (
      <aside className="card improvement-detail" aria-label="改善リクエストの詳細">
        <div className="improvement-state" role="alert">
          <p className="improvement-state-title">詳細の読み込みに失敗しました</p>
          <p className="sub">一時的なエラーです。選択した内容はそのままです。</p>
          <Button onClick={actions.onRetry}>詳細を再読み込みする</Button>
        </div>
      </aside>
    );
  }
  if (status === 'pending' || !detail) {
    return (
      <aside className="card improvement-detail" aria-label="改善リクエストの詳細" aria-busy="true">
        <output className="page-state loading" aria-live="polite">
          <span>詳細を読み込み中…</span>
        </output>
      </aside>
    );
  }
  return (
    <DetailBody
      detail={detail}
      busy={busy}
      actionError={actionError}
      willReissueOnCopy={willReissueOnCopy}
      actions={actions}
    />
  );
}

function DetailBody({
  detail,
  busy,
  actionError,
  willReissueOnCopy,
  actions,
}: {
  detail: ImprovementDetailResponse;
  busy: boolean;
  actionError: string | null;
  willReissueOnCopy: boolean;
  actions: DetailActions;
}) {
  const { request } = detail;
  const statusSelectId = useId();
  const statusRef = useRef<HTMLSelectElement | null>(null);
  const [nextStatus, setNextStatus] = useState<ImprovementStatus | ''>('');
  const [zoom, setZoom] = useState(false);
  const zoomCloseRef = useRef<HTMLButtonElement | null>(null);
  const zoomOpenRef = useRef<HTMLButtonElement | null>(null);

  // 依頼を切り替えたら、前の依頼の選びかけは捨てる
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依頼の切り替えで捨てるのが目的
  useEffect(() => {
    setNextStatus('');
    setZoom(false);
  }, [request.id]);

  useEffect(() => {
    if (zoom) zoomCloseRef.current?.focus();
  }, [zoom]);

  const closeZoom = () => {
    setZoom(false);
    zoomOpenRef.current?.focus();
  };

  const screenshotUrl = request.screenshot.available ? improvementScreenshotUrl(request.id) : null;
  const diag = detail.diagnosticsSummary;

  return (
    <aside className="card improvement-detail" aria-labelledby="improvement-detail-title">
      <header className="improvement-detail-head">
        <h2 id="improvement-detail-title">改善リクエストの詳細</h2>
        <Button variant="text" size="mini" aria-label="詳細を閉じる" onClick={actions.onClose}>
          <UiIcon name="close" />
        </Button>
      </header>

      <div className="improvement-detail-id">
        <strong className="improvement-number">{detail.number}</strong>
        {/* バッジから状態の変更欄へ移れる (FR-12) */}
        <Button
          variant="text"
          size="mini"
          className="improvement-status-trigger"
          aria-label={`状態 ${IMPROVEMENT_STATUS_LABEL[request.status]}。状態を変更する`}
          onClick={() => statusRef.current?.focus()}
        >
          <StatusBadge status={request.status} label={IMPROVEMENT_STATUS_LABEL[request.status]} />
        </Button>
      </div>
      <p className="improvement-detail-summary">{detail.summary}</p>
      <dl className="improvement-meta">
        <dt>作成日</dt>
        <dd>{formatDateTime(request.createdAt)}</dd>
        <dt>更新日</dt>
        <dd>{formatDateTime(request.updatedAt)}</dd>
        <dt>関連ページ</dt>
        <dd>{detail.routeLabel}</dd>
      </dl>

      <section className="improvement-detail-section" aria-labelledby="improvement-body-title">
        <h3 id="improvement-body-title">改善の内容</h3>
        <p className="improvement-detail-body">{request.body}</p>
      </section>

      <section className="improvement-detail-section" aria-labelledby="improvement-shot-title">
        <h3 id="improvement-shot-title">添付画像</h3>
        {screenshotUrl ? (
          <>
            <img
              className="improvement-thumb"
              src={screenshotUrl}
              alt={`${detail.number} の添付画像`}
              loading="lazy"
            />
            <Button ref={zoomOpenRef} size="mini" onClick={() => setZoom(true)}>
              画像を拡大して見る
            </Button>
          </>
        ) : (
          <p className="sub">
            {request.purgedAt ? '保持期限を過ぎたため、添付は削除されました' : '添付画像はありません'}
          </p>
        )}
      </section>

      <section className="improvement-detail-section" aria-labelledby="improvement-diag-title">
        <h3 id="improvement-diag-title">診断情報（マスク済み）</h3>
        {diag ? (
          <table
            className="data improvement-diag"
            data-table-kind="layout"
            data-sort-reason="診断の要約を項目名と値の組で縦に並べた定義表で、行の順は意味を持つ"
          >
            <tbody>
              <tr>
                <th scope="row">OS</th>
                <td>{diag.os}</td>
              </tr>
              <tr>
                <th scope="row">ブラウザ</th>
                <td>{diag.browser}</td>
              </tr>
              <tr>
                <th scope="row">画面サイズ</th>
                <td>{diag.viewport}</td>
              </tr>
              <tr>
                <th scope="row">利用環境</th>
                <td>{diag.environment}</td>
              </tr>
              <tr>
                <th scope="row">セッションID</th>
                <td>{diag.sessionIdMasked}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="sub">診断情報はありません</p>
        )}
        <details className="improvement-disclosure">
          <summary>含まれる情報 / 含まれない情報を確認する</summary>
          <DisclosureLists />
        </details>
      </section>

      <section className="improvement-detail-section" aria-labelledby="improvement-activity-title">
        <h3 id="improvement-activity-title">アクティビティ</h3>
        {detail.activities.length === 0 ? (
          <p className="sub">履歴はまだありません</p>
        ) : (
          <ol className="improvement-timeline">
            {detail.activities.map((a) => (
              <li key={a.id}>
                <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                <strong>{a.title}</strong>
                {a.description && <span className="sub">{a.description}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="improvement-detail-section" aria-labelledby="improvement-related-title">
        <h3 id="improvement-related-title">関連する改善リクエスト</h3>
        {detail.related.length === 0 ? (
          <p className="sub">同じページの改善リクエストはありません</p>
        ) : (
          <ul className="improvement-related">
            {detail.related.map((r) => (
              <li key={r.id}>
                <Button variant="text" size="mini" onClick={() => actions.onSelect(r.id)}>
                  {r.number}
                </Button>
                <span>{r.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="improvement-detail-section" aria-labelledby="improvement-ops-title">
        <h3 id="improvement-ops-title">操作</h3>
        <div className="improvement-ops">
          <div className="improvement-status-change">
            <label htmlFor={statusSelectId}>変更先</label>
            <select
              id={statusSelectId}
              ref={statusRef}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ImprovementStatus | '')}
            >
              <option value="">選んでください</option>
              {detail.allowedTransitions.map((s) => (
                <option key={s} value={s}>
                  {IMPROVEMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Button
              disabled={busy || nextStatus === ''}
              onClick={() => {
                if (nextStatus) actions.onStatus(nextStatus);
              }}
            >
              ステータスを変更
            </Button>
          </div>
          <Button disabled={busy} onClick={actions.onReissue}>
            このリクエストを再発行
          </Button>
          {willReissueOnCopy && <p className="sub improvement-copy-notice">{COPY_REISSUE_NOTICE}</p>}
          {COPY_TARGETS.map((t) => (
            <Button key={t} disabled={busy} onClick={() => actions.onCopy(t)}>
              {COPY_TARGET_LABEL[t]}用のプロンプトをコピー
            </Button>
          ))}
          <Button variant="danger" disabled={busy} onClick={actions.onDelete}>
            このリクエストを削除
          </Button>
        </div>
        {actionError && (
          <p className="improvement-reason" role="alert">
            {actionError}
          </p>
        )}
      </section>

      {zoom && screenshotUrl && (
        <div className="improvement-zoom">
          {/* role="dialog" を付けた div ではなく実要素にする (Login のパスワード案内と同じ) */}
          <dialog
            open
            className="improvement-zoom-inner"
            aria-modal="true"
            aria-label={`${detail.number} の添付画像 (拡大)`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeZoom();
            }}
          >
            <Button
              ref={zoomCloseRef}
              variant="text"
              size="mini"
              aria-label="拡大表示を閉じる"
              onClick={closeZoom}
            >
              <UiIcon name="close" />
            </Button>
            <img src={screenshotUrl} alt={`${detail.number} の添付画像`} />
          </dialog>
        </div>
      )}
    </aside>
  );
}
