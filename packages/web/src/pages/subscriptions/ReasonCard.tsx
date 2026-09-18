import { type SubscriptionRow, subsReviewCards } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { CandidateStatusBadges } from './CandidateStatusBadges.js';

/**
 * サブスク候補の検出理由 (spec §9)。選択中、または最優先の未判断候補を代表表示する。
 * 残りは一覧の既存ステータス絞り込みへ渡して失わず、判断操作は詳細内の ReviewDecisionActions を正本とする。
 */
export function ReasonCard({
  rows,
  activeKey,
  onOpen,
  onShowAll,
}: {
  rows: readonly SubscriptionRow[];
  activeKey: string | null;
  onOpen: (vendorKey: string) => void;
  onShowAll: () => void;
}) {
  const cards = subsReviewCards(rows);
  const representative = cards.find((row) => row.vendorKey === activeKey) ?? cards[0];
  const remaining = representative ? cards.length - 1 : 0;

  return (
    <section className="card subs-reasons" aria-labelledby="subs-reasons-title">
      <h2 id="subs-reasons-title">サブスク候補の検出理由</h2>
      {representative ? (
        <ul className="subs-reason-list">
          <li className="subs-reason" data-vendor-key={representative.vendorKey}>
            <p className="subs-reason-name">
              <strong>{representative.normalizedName}</strong>
              <CandidateStatusBadges row={representative} />
            </p>
            {representative.review?.reasons.map((reason) => (
              <p key={reason} className="subs-reason-text">
                {reason}
              </p>
            ))}
            {representative.vendorKey !== activeKey && (
              <Button variant="text" onClick={() => onOpen(representative.vendorKey)}>
                この候補を詳しく見る →
              </Button>
            )}
          </li>
        </ul>
      ) : (
        <p className="sub">見直し候補はありません</p>
      )}
      {remaining > 0 && (
        <Button className="subs-reasons-all" variant="text" onClick={onShowAll}>
          他{remaining}件を候補一覧で見る →
        </Button>
      )}
    </section>
  );
}
