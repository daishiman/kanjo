/** 概況のサイドバーに置く、実データ由来の月次クローズ進捗。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type MonthlyCloseStatus, markMonthlyCloseReviewed, unmarkMonthlyCloseReviewed } from '../api.js';
import { Button } from './Button.js';
import { REVIEW_QUEUE_KEY } from './ReviewQueue.js';
import { UiIcon } from './UiIcon.js';

export function MonthlyCloseProgress({ status }: { status: MonthlyCloseStatus | undefined }) {
  const client = useQueryClient();
  const reviewReady =
    status?.steps.filter((step) => step.key !== 'review').every((step) => step.done) ?? false;
  const canToggleReview = status?.reviewedAt != null || reviewReady;
  const reviewActionLabel = status?.reviewedAt ? 'レビュー記録を取り消す' : '月次レビューを記録する';
  const review = useMutation({
    mutationFn: async ({ month, reviewed }: { month: string; reviewed: boolean }) => {
      if (reviewed) await unmarkMonthlyCloseReviewed(month);
      else await markMonthlyCloseReviewed(month);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['overview'] });
      client.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY });
    },
  });

  if (!status) {
    return (
      <section className="monthly-close-card" aria-label="月次クローズの進捗">
        <h2>月次クローズの進捗</h2>
        <output className="monthly-close-loading">
          <UiIcon name="refresh" className="monthly-close-action-icon" />
          <span className="monthly-close-loading-label">確認中…</span>
        </output>
      </section>
    );
  }

  return (
    <section className="monthly-close-card" aria-label="月次クローズの進捗">
      <h2>月次クローズの進捗</h2>
      <strong className="monthly-close-count num">
        {status.doneCount}/{status.total}
      </strong>
      <div
        className="monthly-close-meter"
        role="progressbar"
        aria-label="月次クローズ"
        aria-valuemin={0}
        aria-valuemax={status.total}
        aria-valuenow={status.doneCount}
        tabIndex={0}
      >
        <span style={{ width: `${(status.doneCount / status.total) * 100}%` }} />
      </div>
      <ol>
        {status.steps.map((step) => (
          <li key={step.key} className={step.done ? 'done' : undefined}>
            <UiIcon name={step.done ? 'check' : 'info'} className="status-icon" />
            <span>{step.label}</span>
            {step.count != null && step.count > 0 && <span className="num">{step.count}</span>}
          </li>
        ))}
      </ol>
      {status.month && (
        <Button
          size="mini"
          disabled={review.isPending || !canToggleReview}
          aria-label={reviewActionLabel}
          aria-describedby={!canToggleReview ? 'monthly-close-review-requirement' : undefined}
          onClick={() =>
            review.mutate({ month: status.month as string, reviewed: status.reviewedAt != null })
          }
        >
          <UiIcon name={status.reviewedAt ? 'refresh' : 'check'} className="monthly-close-action-icon" />
          <span className="monthly-close-action-label">{reviewActionLabel}</span>
        </Button>
      )}
      {!canToggleReview && (
        <p id="monthly-close-review-requirement" className="monthly-close-note">
          データ取込・仕分け・照合が完了すると、月次レビューを記録できます。
        </p>
      )}
      {review.isError && <p role="alert">レビューを更新できませんでした。</p>}
    </section>
  );
}
