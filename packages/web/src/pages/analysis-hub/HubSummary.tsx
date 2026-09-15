import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisHubResponse } from '../../api.js';
import { pct, yen } from '../../format.js';

type SummaryKey = 'income' | 'expense' | 'net';

function changeTone(key: SummaryKey, change: number | null): string {
  if (change === null || change === 0) return '';
  const favorable = key === 'expense' ? change < 0 : change > 0;
  return favorable ? 'favorable' : 'adverse';
}

const previousValue = (
  key: SummaryKey,
  previous: NonNullable<AnalysisHubResponse['summary']['previous']>,
): number => previous[key];

export function HubSummary({
  data,
  fallback,
}: {
  data: AnalysisHubResponse | undefined;
  fallback: ReactNode;
}) {
  if (!data) {
    return (
      <section className="analysis-hub-summary card" aria-label="収支サマリー">
        <h2 id="analysis-summary-title">期間の収支サマリー</h2>
        {fallback}
      </section>
    );
  }

  if (data.period.monthCount === 0) {
    return (
      <section className="analysis-hub-summary card" aria-label="収支サマリー">
        <h2 id="analysis-summary-title">期間の収支サマリー</h2>
        <div className="analysis-hub-empty" aria-live="polite">
          <div>
            <strong>この期間には収支データがありません</strong>
            <p>データを取り込むと、収入・支出・純収支をここで比較できます。</p>
          </div>
          <Link className="btn primary" to="/import">
            データを取り込む
          </Link>
        </div>
      </section>
    );
  }

  const { summary } = data;
  const totals = [
    { key: 'income', label: '総収入', value: summary.income, change: summary.change?.income ?? null },
    { key: 'expense', label: '総支出', value: summary.expense, change: summary.change?.expense ?? null },
    { key: 'net', label: '純収支', value: summary.net, change: summary.change?.net ?? null },
  ] as const;

  return (
    <section className="analysis-hub-summary card" aria-label="収支サマリー">
      <div className="analysis-hub-summary-main">
        <div className="analysis-hub-section-heading">
          <h2 id="analysis-summary-title">期間の収支サマリー</h2>
          <span>{data.period.label}</span>
        </div>
        <div className="analysis-hub-kpis">
          {totals.map((item) => (
            <div className="analysis-hub-kpi" data-kind={item.key} key={item.key}>
              <span className="analysis-hub-kpi-label">{item.label}</span>
              <strong
                className={`analysis-hub-kpi-value num${
                  item.key === 'net'
                    ? ` ${item.value < 0 ? 'adverse' : item.value > 0 ? 'favorable' : ''}`
                    : ''
                }`}
              >
                {yen(item.value)}
              </strong>
              {summary.previous ? (
                <span className={`analysis-hub-kpi-change ${changeTone(item.key, item.change)}`}>
                  {item.change === null ? (
                    <span>増減率を算出できません</span>
                  ) : (
                    <strong className="num">
                      <span aria-hidden="true">{item.change > 0 ? '↑' : item.change < 0 ? '↓' : '→'}</span>{' '}
                      {pct(item.change)}
                    </strong>
                  )}
                  <small className="num">
                    （{summary.previous.label} {yen(previousValue(item.key, summary.previous))}）
                  </small>
                </span>
              ) : (
                <span className="analysis-hub-kpi-change analysis-hub-kpi-change--none">
                  前期間の比較データなし
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <aside className="analysis-hub-net-note" aria-label="純収支の説明">
        <strong>純収支とは？</strong>
        <p>
          総収入から総支出を引いた金額です。プラスなら貯蓄に回せるお金、マイナスなら資金繰りの見直しが必要です。
        </p>
      </aside>
    </section>
  );
}
