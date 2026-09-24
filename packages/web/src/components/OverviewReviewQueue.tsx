/** Overview でだけ使う未処理明細の操作UI。共通シェルの初期JSに含めない。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type ReviewQueueItem, snoozeReviewItem, unsnoozeReviewItem } from '../api.js';
import { yenS } from '../format.js';
import { Button } from './Button.js';
import { REVIEW_KIND_LABEL, REVIEW_KIND_PATH, REVIEW_QUEUE_KEY, reviewTotalText } from './ReviewQueue.js';
import { UiIcon } from './UiIcon.js';
import { REVIEW_KIND_ICON, REVIEW_KIND_STATUS_LABEL, REVIEW_KIND_TONE } from './review-presentation.js';

const REVIEW_REASON: Record<ReviewQueueItem['kind'], string> = {
  reconciliation: '帳簿と実際の明細の照合が、まだ確定していません。',
  classification: '公私区分または科目の仕分けが、まだ確定していません。',
  import: 'データ取込が完了していません。取込履歴で失敗理由を確認してください。',
};

/** 「後で確認」。成功後に invalidate し、3 か所を同じ再取得結果で同時に更新する */
function useSnoozeReviewItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (item: Pick<ReviewQueueItem, 'kind' | 'itemKey'>) =>
      snoozeReviewItem(item.kind, item.itemKey),
    onSuccess: () => client.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY }),
  });
}

/** 「後で確認」の解除 (FR-003)。3 か所を同時に戻す */
function useUnsnoozeReviewItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (item: Pick<ReviewQueueItem, 'kind' | 'itemKey'>) =>
      unsnoozeReviewItem(item.kind, item.itemKey),
    onSuccess: () => client.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY }),
  });
}

/** 後で確認にした明細と解除ボタン。件数から外した明細を取り戻す入口。 */
export function SnoozedReviewList({ items }: { items: readonly ReviewQueueItem[] }) {
  const unsnooze = useUnsnoozeReviewItem();
  if (!items.length) return null;
  return (
    <div className="review-snoozed">
      <h3>後で確認にした明細 ({items.length} 件)</h3>
      {unsnooze.isError && (
        <p className="notice danger" role="alert">
          解除できませんでした。もう一度お試しください。
        </p>
      )}
      <ul>
        {items.map((item) => (
          <li key={`${item.kind}/${item.itemKey}`}>
            <span>
              {item.content} <span className="sub">({REVIEW_KIND_LABEL[item.kind]})</span>
            </span>
            <Button
              size="mini"
              onClick={() => unsnooze.mutate(item)}
              disabled={unsnooze.isPending}
              aria-label={`${item.content} の後で確認を解除`}
            >
              解除
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 1280px 以上は右パネルを常設、未満はドロワー。matchMedia の無い環境は広幅扱い。 */
const WIDE_QUERY = '(min-width: 1280px)';

const wideMedia = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(WIDE_QUERY)
    : null;

/** 一覧と詳細を並べられる幅か。初期選択と詳細表示で同じ判定を使う。 */
export function useWideReviewLayout(): boolean {
  const [wide, setWide] = useState(() => wideMedia()?.matches ?? true);
  useEffect(() => {
    const m = wideMedia();
    if (!m) return;
    const onChange = () => setWide(m.matches);
    onChange();
    m.addEventListener?.('change', onChange);
    return () => m.removeEventListener?.('change', onChange);
  }, []);
  return wide;
}

function ReviewDetailBody({
  item,
  onSnooze,
  snoozing,
  snoozeError,
}: {
  item: ReviewQueueItem;
  onSnooze: () => void;
  snoozing: boolean;
  snoozeError: boolean;
}) {
  return (
    <>
      <div className={`review-detail-lead ${REVIEW_KIND_TONE[item.kind]}`}>
        <span className="review-detail-title">
          <span className={`review-row-status ${REVIEW_KIND_TONE[item.kind]}`}>
            <UiIcon name={REVIEW_KIND_ICON[item.kind]} className="review-detail-icon" />
            <span>{REVIEW_KIND_STATUS_LABEL[item.kind]}</span>
          </span>
          <strong data-capture-mask="">{item.content || REVIEW_KIND_LABEL[item.kind]}</strong>
        </span>
        <strong
          className={`review-detail-amount num ${item.amount < 0 ? 'pos' : item.amount > 0 ? 'neg' : ''}`}
          data-capture-mask=""
        >
          {yenS(item.amount)}
        </strong>
        <span className="review-detail-date">{item.date}</span>
      </div>
      <section className="review-detail-reason" aria-label="この明細が未処理の理由">
        <h3>この明細が未処理の理由</h3>
        <p>{REVIEW_REASON[item.kind]}</p>
      </section>
      <dl className="review-detail">
        <div>
          <dt>推奨</dt>
          <dd>
            {item.recommendation ? (
              <span className="review-recommendation">{item.recommendation}</span>
            ) : (
              '推奨なし'
            )}
          </dd>
        </div>
        <div>
          <dt>根拠</dt>
          <dd>{item.basisLabel}</dd>
        </div>
        <div>
          <dt>信頼度</dt>
          <dd className="review-confidence-detail">
            {item.confidence == null ? (
              <span>数値化できる根拠がありません</span>
            ) : (
              <>
                <span className="num">{item.confidence}%</span>
                <span
                  className="confidence-meter"
                  role="progressbar"
                  aria-label="推奨の信頼度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.confidence}
                  tabIndex={0}
                >
                  <span style={{ width: `${item.confidence}%` }} />
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
      {snoozeError && (
        <p className="notice danger" role="alert">
          後で確認にできませんでした。もう一度お試しください。
        </p>
      )}
      <div className="review-detail-actions">
        <Link className="btn primary" to={REVIEW_KIND_PATH[item.kind]}>
          {REVIEW_KIND_LABEL[item.kind]}へ進む
        </Link>
        <Button onClick={onSnooze} disabled={snoozing}>
          後で確認
        </Button>
      </div>
    </>
  );
}

/** 広幅は aside、狭幅はフォーカス復帰付きモーダルダイアログ。 */
export function ReviewDetailPanel({
  item,
  wide,
  onClose,
  focusAfterSnooze,
}: {
  item: ReviewQueueItem | null;
  wide: boolean;
  onClose: () => void;
  focusAfterSnooze?: () => void;
}) {
  const snooze = useSnoozeReviewItem();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const itemId = item ? `${item.kind}/${item.itemKey}` : null;
  const resetSnooze = snooze.reset;

  useEffect(() => {
    if (itemId !== null) resetSnooze();
  }, [itemId, resetSnooze]);

  useEffect(() => {
    if (wide || !item) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [wide, item]);

  const closeDialog = (restoreFocus: () => void = () => returnFocus.current?.focus()) => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    onClose();
    restoreFocus();
  };

  const onSnooze = () => {
    if (!item) return;
    snooze.mutate(item, {
      onSuccess: () => closeDialog(focusAfterSnooze ?? (() => returnFocus.current?.focus())),
    });
  };

  const body = item ? (
    <ReviewDetailBody
      item={item}
      onSnooze={onSnooze}
      snoozing={snooze.isPending}
      snoozeError={snooze.isError}
    />
  ) : null;

  if (wide) {
    return (
      <aside className="review-aside" aria-label="選択中の明細">
        <div className="review-aside-heading">
          <h2>選択中の明細</h2>
          {item && (
            <Button variant="text" className="review-aside-close" onClick={onClose} aria-label="選択を閉じる">
              <UiIcon name="close" />
            </Button>
          )}
        </div>
        {body ?? <p className="sub">優先して確認する明細を選ぶと、推奨と根拠をここに表示します。</p>}
      </aside>
    );
  }
  if (!item) return null;
  return (
    <dialog
      ref={dialogRef}
      className="review-drawer"
      aria-label="選択中の明細"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
    >
      <h2>選択中の明細</h2>
      {body}
      <Button variant="text" onClick={() => closeDialog()}>
        閉じる
      </Button>
    </dialog>
  );
}

/** 画面下端に固定する件数と次の一手。件数の変化は output で伝える。 */
export function ReviewActionBar({ total, next }: { total: number | null; next?: ReactNode }) {
  return (
    <section className="review-action-bar" aria-label="未処理の確認">
      <output aria-live="polite">{total == null ? '未処理 件数を確認中' : reviewTotalText(total)}</output>
      {next}
    </section>
  );
}
