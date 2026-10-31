/** 使い方・決算書で共通の対象期間の前後移動。 */
import { type PeriodNavigation, shiftedPeriod } from '@kanjo/core';
import { usePeriod } from '../period.js';
import { Button } from './Button.js';
import './PeriodRange.css';

export function PeriodRange({
  navigation,
  label,
  loading = false,
}: {
  navigation: PeriodNavigation | null | undefined;
  label: string | undefined;
  loading?: boolean;
}) {
  const { setSelection } = usePeriod();
  const previous = loading ? null : shiftedPeriod(navigation, -1);
  const next = loading ? null : shiftedPeriod(navigation, 1);
  return (
    <div className="period-range" aria-label="対象期間" aria-busy={loading}>
      <Button
        size="mini"
        aria-label="前の期間へ"
        disabled={!previous}
        onClick={() => previous && setSelection(previous)}
      >
        ‹
      </Button>
      <span className="period-range-label">{loading ? '読み込み中' : (label ?? '全期間')}</span>
      <Button size="mini" aria-label="次の期間へ" disabled={!next} onClick={() => next && setSelection(next)}>
        ›
      </Button>
    </div>
  );
}
