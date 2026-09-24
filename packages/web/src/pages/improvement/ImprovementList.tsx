/**
 * 「改善リクエスト一覧」(spec FR-8〜FR-11、FR-21、FR-22)。
 *
 * 検索・件数・ページングの計算は api が core で済ませて返す。ここは返った 1 ページを並べるだけ。
 * 並べ替えは作成日の新しい順に固定で、ページをまたぐので画面内の並べ替え (DataTable) は使わない。
 */
import type { ReactNode } from 'react';
import type { ImprovementListResponse } from '../../api.js';
import { AccessibleTabs } from '../../components/AccessibleTabs.js';
import { Button } from '../../components/Button.js';
import { StatusBadge } from './ImprovementParts.js';
import {
  IMPROVEMENT_TABS,
  IMPROVEMENT_TAB_LABEL,
  type ImprovementListItem,
  type ImprovementTab,
  SEARCH_PLACEHOLDER,
  TEXT,
  formatDate,
  improvementPageRangeText,
} from './view-model.js';

export const LIST_PANEL_ID = 'improvement-list-panel';

export function ImprovementList({
  q,
  tab,
  data,
  status,
  selectedId,
  onQuery,
  onTab,
  onPage,
  onSelect,
  onRetry,
  onStartCreate,
}: {
  q: string;
  tab: ImprovementTab;
  data: ImprovementListResponse | undefined;
  status: 'pending' | 'error' | 'success';
  selectedId: string | null;
  onQuery: (q: string) => void;
  onTab: (tab: ImprovementTab) => void;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onStartCreate: () => void;
}) {
  let body: ReactNode;
  if (status === 'error') {
    body = (
      <div className="improvement-state" role="alert">
        <p className="improvement-state-title">{TEXT.errorTitle}</p>
        <p className="sub">{TEXT.errorBody}</p>
        <Button onClick={onRetry}>再読み込みする</Button>
      </div>
    );
  } else if (status === 'pending' || !data) {
    body = (
      <output className="page-state loading" aria-busy="true" aria-live="polite">
        <span className="skeleton-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>データを読み込み中…</span>
      </output>
    );
  } else if (data.counts.all === 0 && q === '') {
    // 条件を付けずに 0 件 = まだ 1 件も無い。条件で 0 件のときとは文も導線も違う
    body = (
      <div
        className="improvement-state"
        // biome-ignore lint/a11y/useSemanticElements: <output> は段落とボタンを子に持てない。見出し・本文・導線をひとまとまりで知らせる
        role="status"
      >
        <p className="improvement-state-title">{TEXT.emptyTitle}</p>
        <p className="sub">{TEXT.emptyBody}</p>
        <Button variant="primary" onClick={onStartCreate}>
          最初の改善リクエストを作成
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <AccessibleTabs
          ariaLabel="状態で絞り込む"
          idPrefix="improvement-tab"
          items={IMPROVEMENT_TABS.map((t) => ({
            id: t,
            label: `${IMPROVEMENT_TAB_LABEL[t]} ${data.counts[t]}`,
          }))}
          value={tab}
          onChange={onTab}
          ariaControls={() => LIST_PANEL_ID}
        />
        <div id={LIST_PANEL_ID} role="tabpanel" className="improvement-table-wrap" tabIndex={-1}>
          {data.items.length === 0 ? (
            <output className="improvement-no-match">{TEXT.noMatch}</output>
          ) : (
            <ListTable items={data.items} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
        <Pager data={data} onPage={onPage} />
      </>
    );
  }

  return (
    <section className="card improvement-list" aria-labelledby="improvement-list-title">
      <h2 id="improvement-list-title">改善リクエスト一覧</h2>
      <label className="improvement-search">
        <span className="visually-hidden">改善リクエストを検索</span>
        <input
          type="search"
          value={q}
          placeholder={SEARCH_PLACEHOLDER}
          maxLength={100}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      {body}
    </section>
  );
}

function ListTable({
  items,
  selectedId,
  onSelect,
}: {
  items: ImprovementListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <table
      className="data improvement-table"
      data-table-kind="workflow"
      data-sort-reason="サーバが作成日の新しい順に 10 件ずつ区切るため、ページ内だけの並べ替えはページをまたぐ順と食い違う (FR-10)"
    >
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col" className="left">
            関連ページ
          </th>
          <th scope="col" className="left">
            改善の概要
          </th>
          <th scope="col" className="left">
            ステータス
          </th>
          <th scope="col" className="left" aria-sort="descending">
            作成日<span aria-hidden="true"> ↓</span>
          </th>
          <th scope="col" className="left">
            更新日
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <tr key={item.id} className={selected ? 'is-selected' : undefined} aria-selected={selected}>
              <td>
                {/* 行全体を押せる形にすると表の読み上げが崩れるので、番号をボタンにする */}
                <Button
                  variant="text"
                  size="mini"
                  className="improvement-row-select"
                  aria-pressed={selected}
                  aria-label={`${item.number} ${item.summary} を選ぶ`}
                  onClick={() => onSelect(item.id)}
                >
                  {item.number}
                </Button>
              </td>
              <td className="left">{item.routeLabel}</td>
              <td className="left improvement-summary-cell">{item.summary}</td>
              <td className="left">
                <StatusBadge status={item.status} label={item.statusLabel} />
              </td>
              <td className="left">{formatDate(item.createdAt)}</td>
              <td className="left">{formatDate(item.updatedAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Pager({ data, onPage }: { data: ImprovementListResponse; onPage: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pages = Array.from({ length: last }, (_, i) => i + 1);
  return (
    <nav className="improvement-pager" aria-label="ページ">
      <div className="improvement-pager-buttons">
        <Button
          size="mini"
          aria-label="前のページ"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          ‹
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            size="mini"
            variant={p === data.page ? 'primary' : 'secondary'}
            aria-current={p === data.page ? 'page' : undefined}
            aria-label={`${p} ページ目`}
            onClick={() => onPage(p)}
          >
            {p}
          </Button>
        ))}
        <Button
          size="mini"
          aria-label="次のページ"
          disabled={data.page >= last}
          onClick={() => onPage(data.page + 1)}
        >
          ›
        </Button>
      </div>
      <span className="sub">{improvementPageRangeText(data)}</span>
    </nav>
  );
}
