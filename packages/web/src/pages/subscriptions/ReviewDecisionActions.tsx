import type { SubscriptionRow } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { usePeriod } from '../../period.js';
import type { RunWrite } from './types.js';

const DECISIONS_PATH = '/subscriptions/review-decisions';

/**
 * 見直し候補の判断操作の唯一の配置先。
 * ReasonCard は理由の説明に専念し、判断は対象の詳細を確かめた後にここで行う。
 * 処理中でも押せ、押した順に「操作」へ積む (AC-011)。
 */
export function ReviewDecisionActions({ row, run }: { row: SubscriptionRow; run: RunWrite }) {
  const { withPeriod } = usePeriod();
  if (!row.review) return null;

  if (row.status === 'unregistered') {
    return (
      <section className="subs-review-decisions" aria-label="候補の判断">
        <Button
          variant="primary"
          aria-label={`${row.normalizedName}を候補として採用`}
          onClick={() => run({ kind: 'vendor_create', name: row.normalizedName })}
        >
          候補として採用
        </Button>
        <Button
          aria-label={`${row.normalizedName}を候補から除外`}
          onClick={() => run({ kind: 'exclusion', partner: row.normalizedName })}
        >
          候補から除外
        </Button>
      </section>
    );
  }

  if (row.review.state === 'confirmed') {
    return (
      <section className="subs-review-decisions" aria-label="候補の判断">
        <Button
          onClick={() =>
            run({ kind: 'review_decision', vendorKey: row.vendorKey, decision: null, path: DECISIONS_PATH })
          }
        >
          確認を取り消す
        </Button>
      </section>
    );
  }

  const decide = (decision: 'confirmed' | 'dismissed') =>
    run({ kind: 'review_decision', vendorKey: row.vendorKey, decision, path: withPeriod(DECISIONS_PATH) });
  return (
    <section className="subs-review-decisions" aria-label="候補の判断">
      <Button variant="primary" onClick={() => decide('confirmed')}>
        候補として確認
      </Button>
      <Button onClick={() => decide('dismissed')}>候補から除外</Button>
    </section>
  );
}
