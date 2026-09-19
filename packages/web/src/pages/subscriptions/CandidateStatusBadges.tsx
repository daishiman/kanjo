import type { SubscriptionRow } from '@kanjo/core';

/** 一覧・詳細・検出理由で共有する候補状態。文字で状態を伝え、色だけに依存しない。 */
export function CandidateStatusBadges({
  row,
  compact = false,
}: {
  row: SubscriptionRow;
  compact?: boolean;
}) {
  const review = row.review?.state;
  if (compact) {
    if (review === 'pending') return <span className="subs-badge is-pending">候補</span>;
    if (review === 'confirmed') return <span className="subs-badge is-confirmed">確認済み</span>;
    if (row.status === 'unregistered') return <span className="subs-badge is-unregistered">未登録</span>;
    return <span className="subs-badge is-none">-</span>;
  }

  return (
    <>
      {review === 'pending' && <span className="subs-badge is-pending">見直し候補</span>}
      {review === 'confirmed' && <span className="subs-badge is-confirmed">確認済み</span>}
      {row.status === 'unregistered' && <span className="subs-badge is-unregistered">未登録</span>}
    </>
  );
}
