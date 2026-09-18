import type { SubscriptionRow } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { usePeriod } from '../../period.js';
import { deleteReviewDecision, postExclusion, postReviewDecision, postSubVendor } from './api.js';
import type { RunAction } from './types.js';

/**
 * 見直し候補の判断操作の唯一の配置先。
 * ReasonCard は理由の説明に専念し、判断は対象の詳細を確かめた後にここで行う。
 */
export function ReviewDecisionActions({
  row,
  run,
  busy,
}: {
  row: SubscriptionRow;
  run: RunAction;
  busy: boolean;
}) {
  const { withPeriod } = usePeriod();
  if (!row.review) return null;

  if (row.status === 'unregistered') {
    return (
      <section className="subs-review-decisions" aria-label="候補の判断">
        <Button
          variant="primary"
          disabled={busy}
          aria-label={`${row.normalizedName}を候補として採用`}
          onClick={() => run(() => postSubVendor(row.normalizedName), 'vendorDefinition')}
        >
          候補として採用
        </Button>
        <Button
          disabled={busy}
          aria-label={`${row.normalizedName}を候補から除外`}
          onClick={() => run(() => postExclusion(row.normalizedName), 'exclusion')}
        >
          候補から除外
        </Button>
      </section>
    );
  }

  if (row.review.state === 'confirmed') {
    return (
      <section className="subs-review-decisions" aria-label="候補の判断">
        <Button disabled={busy} onClick={() => run(() => deleteReviewDecision(row.vendorKey), 'decision')}>
          確認を取り消す
        </Button>
      </section>
    );
  }

  return (
    <section className="subs-review-decisions" aria-label="候補の判断">
      <Button
        variant="primary"
        disabled={busy}
        onClick={() => run(() => postReviewDecision(row.vendorKey, 'confirmed', withPeriod), 'decision')}
      >
        候補として確認
      </Button>
      <Button
        disabled={busy}
        onClick={() => run(() => postReviewDecision(row.vendorKey, 'dismissed', withPeriod), 'decision')}
      >
        候補から除外
      </Button>
    </section>
  );
}
