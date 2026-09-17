import type { AnalysisHubReport } from '@kanjo/core';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ANALYSIS_HUB_ICONS } from '../../analysis-hub-icons.js';
import { Button } from '../../components/Button.js';
import { RouteIcon, type RouteIconName } from '../../components/RouteIcon.js';
import { pct, yen } from '../../format.js';
import { ANALYSIS_TABS, type AnalysisTabId } from '../../routeMetadata.js';

type HubView = AnalysisHubReport['views'][AnalysisTabId];
export type HubDataState = 'loading' | 'error' | 'empty' | 'success';

type StatusTone = 'danger' | 'warning' | 'success' | 'trend' | 'neutral';
type StatusDescriptor = { text: string; tone: StatusTone; icon: RouteIconName };

function viewStatus(view: HubView): StatusDescriptor {
  switch (view.id) {
    case 'reconciliation':
      return view.actionRequiredCount > 0
        ? {
            text: `要確認あり ${view.actionRequiredCount}件`,
            tone: 'danger',
            icon: ANALYSIS_HUB_ICONS.status.error,
          }
        : { text: '要確認なし', tone: 'success', icon: ANALYSIS_HUB_ICONS.status.success };
    case 'total-cashflow':
      return view.reviewCount > 0
        ? { text: `要確認あり ${view.reviewCount}件`, tone: 'danger', icon: ANALYSIS_HUB_ICONS.status.error }
        : { text: '要確認なし', tone: 'success', icon: ANALYSIS_HUB_ICONS.status.success };
    case 'matrix':
      return view.normal
        ? { text: '正常・未記録なし', tone: 'success', icon: ANALYSIS_HUB_ICONS.status.success }
        : {
            text: `未記録 ${view.unrecordedMonths}か月`,
            tone: 'warning',
            icon: ANALYSIS_HUB_ICONS.status.warning,
          };
    case 'trends':
      if (view.expenseChange === null) {
        return { text: '比較データなし', tone: 'neutral', icon: ANALYSIS_HUB_ICONS.status.neutral };
      }
      if (view.expenseChange < 0) {
        return {
          text: `支出 ${pct(view.expenseChange)}`,
          tone: 'trend',
          icon: ANALYSIS_HUB_ICONS.status.trendDown,
        };
      }
      if (view.expenseChange > 0) {
        return {
          text: `支出 ${pct(view.expenseChange)}`,
          tone: 'danger',
          icon: ANALYSIS_HUB_ICONS.status.trendUp,
        };
      }
      return { text: '支出 ±0.0%', tone: 'success', icon: ANALYSIS_HUB_ICONS.status.success };
    case 'diagnosis':
      return view.candidateCount > 0
        ? {
            text: `改善余地 年${yen(view.annualSavings)}`,
            tone: 'warning',
            icon: ANALYSIS_HUB_ICONS.status.warning,
          }
        : { text: '見直し候補なし', tone: 'success', icon: ANALYSIS_HUB_ICONS.status.success };
  }
}

const missingStatus: Record<Exclude<HubDataState, 'success'>, StatusDescriptor> = {
  loading: { text: '集計中', tone: 'neutral', icon: ANALYSIS_HUB_ICONS.status.neutral },
  error: { text: '取得できません', tone: 'danger', icon: ANALYSIS_HUB_ICONS.status.error },
  empty: { text: 'データなし', tone: 'neutral', icon: ANALYSIS_HUB_ICONS.status.neutral },
};

function StatusText({ view, state }: { view: HubView | undefined; state: HubDataState }) {
  const status =
    state === 'success' && view ? viewStatus(view) : missingStatus[state === 'success' ? 'empty' : state];
  return (
    <span className={`analysis-route-status analysis-route-status--${status.tone}`}>
      <RouteIcon name={status.icon} />
      {status.text}
    </span>
  );
}

function Priority({ view }: { view: HubView | undefined }) {
  if (!view) return <span className="analysis-route-priority-empty">—</span>;
  return <span className={`badge ${view.priority === '高' ? 'danger' : 'warn'}`}>{view.priority}</span>;
}

/**
 * 行・カードの余白は選択面として扱う。ただし内側の明示操作と文字選択は横取りしない。
 * 詳細 Link は PUSH、選択 Button/面は ?focus= の REPLACE という責務をここで分ける。
 */
function selectFromSurface(
  event: ReactMouseEvent<HTMLElement>,
  id: AnalysisTabId,
  onSelect: (id: AnalysisTabId) => void,
) {
  const target = event.target;
  if (target instanceof Element && target.closest('a, button')) return;
  if (window.getSelection()?.toString()) return;
  onSelect(id);
}

function selectFromKeyboard(
  event: ReactKeyboardEvent<HTMLElement>,
  id: AnalysisTabId,
  onSelect: (id: AnalysisTabId) => void,
) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  onSelect(id);
}

function AnalysisViewLabel({
  label,
  step,
  selected,
}: {
  label: string;
  step: string;
  selected: boolean;
}) {
  return (
    <span className="analysis-route-select">
      <RouteIcon name={ANALYSIS_TABS.find((tab) => tab.label === label)?.icon ?? 'chart-pie'} />
      <span>
        <strong>{label}</strong>
        <small>{step}</small>
      </span>
      <span className="analysis-route-select-hint">{selected ? '選択中' : '説明を選ぶ'}</span>
    </span>
  );
}

export function AnalysisRouteTable({
  views,
  state,
  focus,
  onSelect,
}: {
  views: AnalysisHubReport['views'] | undefined;
  state: HubDataState;
  focus: AnalysisTabId;
  onSelect: (id: AnalysisTabId) => void;
}) {
  return (
    <section className="analysis-route-list card" aria-labelledby="analysis-route-title">
      <div className="analysis-hub-section-heading">
        <div>
          <h2 id="analysis-route-title">分析ルート一覧</h2>
          <p>5つの視点を業務の順に確認し、必要な分析を開きます。</p>
        </div>
      </div>

      <div className="analysis-route-table-wrap">
        <table
          className="analysis-route-table"
          data-table-kind="workflow"
          data-sort-reason="業務の確認手順を段階1から5へ固定したナビゲーション"
        >
          <colgroup>
            <col className="analysis-route-col analysis-route-col--step" />
            <col className="analysis-route-col analysis-route-col--view" />
            <col className="analysis-route-col analysis-route-col--purpose" />
            <col className="analysis-route-col analysis-route-col--status" />
            <col className="analysis-route-col analysis-route-col--priority" />
            <col className="analysis-route-col analysis-route-col--action" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">段階</th>
              <th scope="col">分析の視点</th>
              <th scope="col">目的</th>
              <th scope="col">現在の状態</th>
              <th scope="col">優先度</th>
              <th scope="col">次の操作</th>
            </tr>
          </thead>
          <tbody>
            {ANALYSIS_TABS.map((tab, index) => {
              const view = views?.[tab.id];
              const selected = tab.id === focus;
              return (
                <tr
                  key={tab.id}
                  className="analysis-route-record"
                  data-route-id={tab.id}
                  data-selected={selected || undefined}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={selected ? `${tab.label}を選択中` : `${tab.label}の説明を選ぶ`}
                  tabIndex={0}
                  onClick={(event) => selectFromSurface(event, tab.id, onSelect)}
                  onKeyDown={(event) => selectFromKeyboard(event, tab.id, onSelect)}
                >
                  <td>
                    <span className="analysis-route-step num">{index + 1}</span>
                  </td>
                  <th scope="row">
                    <AnalysisViewLabel label={tab.label} step={tab.step} selected={selected} />
                  </th>
                  <td>{tab.purpose}</td>
                  <td>
                    <StatusText view={view} state={state} />
                  </td>
                  <td>
                    <Priority view={view} />
                  </td>
                  <td>
                    <Link className={`btn analysis-route-open${selected ? ' primary' : ''}`} to={tab.path}>
                      {tab.label}を開く
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="analysis-route-cards" aria-label="分析ルート">
        {ANALYSIS_TABS.map((tab, index) => {
          const view = views?.[tab.id];
          const selected = tab.id === focus;
          return (
            <li
              key={tab.id}
              className="analysis-route-record"
              data-route-id={tab.id}
              data-selected={selected || undefined}
              aria-current={selected ? 'true' : undefined}
              aria-label={selected ? `${tab.label}を選択中` : `${tab.label}の説明を選ぶ`}
              onClick={(event) => selectFromSurface(event, tab.id, onSelect)}
              onKeyDown={(event) => selectFromKeyboard(event, tab.id, onSelect)}
            >
              <div className="analysis-route-card-head">
                <span className="analysis-route-step num">{index + 1}</span>
                <div>
                  <strong>{tab.label}</strong>
                  <span>{tab.step}</span>
                </div>
                <Priority view={view} />
              </div>
              <p>{tab.purpose}</p>
              <StatusText view={view} state={state} />
              <div className="analysis-route-card-actions">
                <Button
                  variant="text"
                  aria-pressed={selected}
                  aria-label={selected ? `${tab.label}を選択中` : `${tab.label}の説明を選ぶ`}
                  onClick={() => onSelect(tab.id)}
                >
                  <span className="visually-hidden">{tab.label}</span>
                  {selected ? '選択中' : '説明を選ぶ'}
                </Button>
                <Link className={`btn analysis-route-open${selected ? ' primary' : ''}`} to={tab.path}>
                  {tab.label}を開く
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
