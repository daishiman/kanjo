import type { CoverageBucket, SubscriptionsScreen } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { UiIcon, type UiIconName } from '../../components/UiIcon.js';
import { jpDateTime } from './format.js';

/** 3 区分の並びとアイコン。銀行・カードの専用アイコンは無いので、既存のセットから意味の近いものを選ぶ */
const BUCKETS: { key: 'bank' | 'card' | 'emoney'; label: string; icon: UiIconName }[] = [
  { key: 'bank', label: '銀行口座', icon: 'lock' },
  { key: 'card', label: 'クレジットカード', icon: 'wallet' },
  { key: 'emoney', label: '電子マネー', icon: 'cloud' },
];

/** core は割合 (0〜1) で返す。表示は整数の % (spec §4.1: 97% (3/3)) */
const percentText = (bucket: CoverageBucket) =>
  bucket.percent === null ? '—' : `${Math.round(bucket.percent * 100)}%`;

/**
 * データソースのカバー率 (spec §4.1)。
 * % は (口座 × 月) の埋まり具合、(分子/分母) は最新月まで取込済みの口座数で、別の問いに答える数。
 */
export function CoverageCard({ coverage }: { coverage: SubscriptionsScreen['coverage'] }) {
  return (
    <section className="card subs-coverage" aria-labelledby="subs-coverage-title">
      <div className="subs-coverage-heading">
        <h2 id="subs-coverage-title">データソースのカバー率</h2>
        {coverage.unclassified > 0 && (
          <p className="sub subs-coverage-unclassified">分類できない口座 {coverage.unclassified} 件</p>
        )}
      </div>
      <ul className="subs-coverage-list">
        {BUCKETS.map(({ key, label, icon }) => {
          const bucket = coverage[key];
          return (
            <li key={key} data-coverage={key}>
              <UiIcon name={icon} aria-hidden="true" />
              <span className="subs-coverage-label">{label}</span>
              <span className="subs-coverage-value num">
                {percentText(bucket)}{' '}
                <span className="subs-coverage-count">
                  ({bucket.imported}/{bucket.accounts})
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 最終更新と再取得 (spec §4.2)。再取得は本画面の応答を取り直すだけで、外部への再取込はしない */
export function RefreshCard({
  generatedAt,
  fetching,
  onRefetch,
}: {
  generatedAt: string | null;
  fetching: boolean;
  onRefetch: () => void;
}) {
  return (
    <section className="card subs-refresh" aria-label="最終更新">
      <p>
        <UiIcon name="clock" aria-hidden="true" />
        <span className="subs-refresh-copy">
          <span>最終更新</span>
          <time dateTime={generatedAt ?? undefined}>{jpDateTime(generatedAt)}</time>
        </span>
      </p>
      <Button onClick={onRefetch} disabled={fetching}>
        <UiIcon name="refresh" aria-hidden="true" />
        {fetching ? '再取得中…' : '再取得'}
      </Button>
    </section>
  );
}
