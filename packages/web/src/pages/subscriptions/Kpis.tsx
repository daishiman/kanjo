import type { SubscriptionsScreen } from '@kanjo/core';
import { KpiCard } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { UiIcon, type UiIconName } from '../../components/UiIcon.js';
import { ratio, yen } from '../../format.js';
import { periodDelta } from './format.js';

const icon = (name: UiIconName) => <UiIcon name={name} aria-hidden="true" />;

/** 前期間比の補足行。矢印と「増加/減少」の文字で、色だけに頼らない (spec §3) */
export function DeltaNote({ current, previous }: { current: number; previous: number | null }) {
  const delta = periodDelta(current, previous);
  if (!delta) return <>前期間のデータがありません</>;
  return (
    <span className={`subs-delta is-${delta.tone}`}>
      前期間比 {delta.text}
      {delta.arrow && <span aria-hidden="true"> {delta.arrow}</span>}
      <span className="visually-hidden">（{delta.spoken}）</span>
    </span>
  );
}

export function SubscriptionKpis({ kpis }: { kpis: SubscriptionsScreen['kpis'] }) {
  return (
    <section className="kpis subs-kpis" aria-label="サブスクの主要な数字">
      <KpiCard
        label="月額のサブスク合計"
        value={yen(kpis.monthlyTotal)}
        note={<DeltaNote current={kpis.monthlyTotal} previous={kpis.monthlyTotalPrev} />}
        icon={icon('wallet')}
      />
      <KpiCard
        label="年換算の合計"
        value={yen(kpis.annualized)}
        note={<DeltaNote current={kpis.annualized} previous={kpis.annualizedPrev} />}
        icon={icon('rotate-ccw')}
      />
      <KpiCard
        label="直近12か月の支払額"
        value={yen(kpis.last12Total)}
        note="対象期間の実績合計"
        icon={icon('clock')}
      />
      <KpiCard
        label={<Term id="revenueShare">売上比</Term>}
        value={kpis.revenueShare === null ? '—' : ratio(kpis.revenueShare, 1)}
        note="売上に占める割合"
        icon={icon('brand-bars')}
      />
      <KpiCard
        label="見直し候補"
        value={`${kpis.reviewCandidates}件`}
        note="重複・不要の可能性"
        icon={icon('alert')}
      />
    </section>
  );
}
