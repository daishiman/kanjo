import { forwardRef } from 'react';
import { Button } from '../../../components/Button.js';
import { DataTable } from '../../../components/DataTable.js';
import { UiIcon } from '../../../components/UiIcon.js';
import { monthLabel, yen } from '../../../format.js';
import type { ReconciliationResponse } from './api.js';
import {
  ACTION_QUEUES,
  INFO_QUEUES,
  INITIAL_FILTERS,
  PAGE_SIZES,
  type PageSize,
  type QueueItem,
  type ReconciliationFilters,
  type ReconciliationQueue,
  type ReconciliationRow,
  STATUS_LABELS,
  STATUS_ORDER,
  isPending,
  pagerItems,
  signedYen,
  slashDate,
} from './model.js';

export const ReconciliationWorkspace = forwardRef<
  HTMLElement,
  {
    data: ReconciliationResponse;
    filters: ReconciliationFilters;
    filtersOpen: boolean;
    months: readonly string[];
    filtered: readonly ReconciliationRow[];
    visible: readonly ReconciliationRow[];
    active: ReconciliationRow | null;
    selected: ReadonlySet<string>;
    actionRequiredCount: number;
    currentPage: number;
    pageCount: number;
    pageSize: PageSize;
    onFilters: (patch: Partial<ReconciliationFilters>) => void;
    onPage: (page: number) => void;
    onPageSize: (size: PageSize) => void;
    onToggleSelected: (id: string) => void;
    onToggleVisible: () => void;
    onOpen: (id: string) => void;
  }
>(function ReconciliationWorkspace(
  {
    data,
    filters,
    filtersOpen,
    months,
    filtered,
    visible,
    active,
    selected,
    actionRequiredCount,
    currentPage,
    pageCount,
    pageSize,
    onFilters,
    onPage,
    onPageSize,
    onToggleSelected,
    onToggleVisible,
    onOpen,
  },
  ref,
) {
  const selectableVisible = visible.filter(isPending);
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((row) => selected.has(row.txId));
  const someVisibleSelected = selectableVisible.some((row) => selected.has(row.txId));

  return (
    <>
      <div className="recon-side">
        <section className="card recon-filters" aria-label="絞り込み">
          <details open={filtersOpen}>
            <summary>
              <UiIcon name="sliders-horizontal" />
              <span>絞り込み</span>
            </summary>
            <div className="recon-filters-head">
              <Button variant="text" onClick={() => onFilters(INITIAL_FILTERS)}>
                リセット
              </Button>
            </div>
            <fieldset>
              <legend>freee候補</legend>
              <RadioOption
                name="recon-candidate"
                checked={filters.candidate === 'all'}
                onChange={() => onFilters({ candidate: 'all' })}
                label="すべて"
              />
              <RadioOption
                name="recon-candidate"
                checked={filters.candidate === 'withoutCandidate'}
                onChange={() => onFilters({ candidate: 'withoutCandidate' })}
                label="候補なし"
              />
              <RadioOption
                name="recon-candidate"
                checked={filters.candidate === 'withCandidate'}
                onChange={() => onFilters({ candidate: 'withCandidate' })}
                label="候補あり"
              />
            </fieldset>
            <fieldset>
              <legend>ステータス</legend>
              <RadioOption
                name="recon-status"
                checked={filters.status === 'all'}
                onChange={() => onFilters({ status: 'all' })}
                label="すべて"
              />
              {STATUS_ORDER.map((status) => (
                <RadioOption
                  key={status}
                  name="recon-status"
                  checked={filters.status === status}
                  onChange={() => onFilters({ status })}
                  label={STATUS_LABELS[status]}
                  count={data.statusCounts[status]}
                />
              ))}
            </fieldset>
            <label className="recon-month">
              <span>対象年月</span>
              <select value={filters.month} onChange={(event) => onFilters({ month: event.target.value })}>
                <option value="all">すべて</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          </details>
        </section>

        <section className="card recon-queue" aria-labelledby="recon-queue-title">
          <h2 id="recon-queue-title">
            対応キュー <span className="recon-count">{actionRequiredCount}件</span>
          </h2>
          <QueueList
            queues={ACTION_QUEUES}
            counts={data.queues}
            current={filters.queue}
            onSelect={(queue) => onFilters({ queue })}
          />
          <h3 className="recon-queue-subhead">確認のみ</h3>
          <QueueList
            queues={INFO_QUEUES}
            counts={data.queues}
            current={filters.queue}
            onSelect={(queue) => onFilters({ queue })}
          />
        </section>
      </div>

      <section ref={ref} className="card recon-list" aria-labelledby="recon-list-title">
        <div className="recon-list-head">
          <h2 id="recon-list-title">
            照合候補一覧 <span className="recon-count">{filtered.length}件</span>
          </h2>
          <label className="recon-search">
            <UiIcon name="search" />
            <input
              type="search"
              aria-label="照合候補を検索"
              placeholder="取引内容・金額・メモで検索..."
              value={filters.search}
              onChange={(event) => onFilters({ search: event.target.value })}
            />
          </label>
        </div>
        <section
          className="scroll-x recon-table-scroll"
          aria-label="照合候補一覧の横スクロール領域"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: overflow表をキーボードで横スクロールできるようにする。
          tabIndex={0}
        >
          <DataTable
            className="data recon-table"
            caption={<caption className="visually-hidden">照合候補一覧</caption>}
            columns={[
              {
                className: 'recon-select-column',
                label: (
                  <>
                    <span className="visually-hidden">選択</span>
                    {selectableVisible.length ? (
                      <SelectionCheckbox
                        label={`表示中の対応対象${selectableVisible.length}件をすべて選択`}
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected && !allVisibleSelected}
                        onChange={onToggleVisible}
                      />
                    ) : (
                      <UnavailableSelection label="表示中に一括操作の対象はありません" />
                    )}
                  </>
                ),
                sortable: false,
              },
              { label: 'ステータス', sortable: false },
              { label: '日付', sortable: false },
              { label: 'MoneyForwardの取引内容', sortable: false },
              { label: '金額', sortable: false, className: 'num' },
              { label: 'freeeの候補', sortable: false },
              { label: '差額', sortable: false, className: 'num' },
              { label: '一致度', sortable: false, className: 'num' },
            ]}
          >
            {visible.map((row) => (
              <tr key={row.txId} className={active?.txId === row.txId ? 'is-active' : undefined}>
                <td className="recon-select-column">
                  {isPending(row) ? (
                    <SelectionCheckbox
                      label={`${row.mf.content}を選択`}
                      checked={selected.has(row.txId)}
                      onChange={() => onToggleSelected(row.txId)}
                    />
                  ) : (
                    <UnavailableSelection label="一括操作の対象外" />
                  )}
                </td>
                <td>
                  <span className={`recon-badge recon-badge--${row.status}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className="nowrap">{slashDate(row.date)}</td>
                <td>
                  <Button
                    variant="text"
                    className="recon-row-open"
                    aria-label={`${row.mf.content || '内容未設定'}の詳細を表示`}
                    aria-current={active?.txId === row.txId ? 'true' : undefined}
                    onClick={() => onOpen(row.txId)}
                  >
                    {row.mf.content || '内容未設定'}
                  </Button>
                </td>
                <td className="num">{yen(row.mf.amount)}</td>
                <td>{row.freee ? row.freee.partner || '取引先未設定' : '—'}</td>
                <td className="num">{signedYen(row.difference)}</td>
                <td className="num">{row.score === null ? '—' : `${row.score}%`}</td>
              </tr>
            ))}
          </DataTable>
        </section>
        {!visible.length && <p className="sub recon-no-hit">条件に合う候補はありません。</p>}
        <nav className="recon-pager" aria-label="照合候補のページ">
          <Button
            variant="text"
            aria-label="前のページ"
            disabled={currentPage <= 1}
            onClick={() => onPage(currentPage - 1)}
          >
            <UiIcon name="chevron-left" />
          </Button>
          {pageCount > 1 &&
            pagerItems(currentPage, pageCount).map((item) =>
              typeof item !== 'number' ? (
                <span className="recon-pager-gap" key={`ellipsis-after-${item.gapAfter}`}>
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === currentPage ? 'primary' : 'text'}
                  aria-label={`${item}ページ目`}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => onPage(item)}
                >
                  {item}
                </Button>
              ),
            )}
          <Button
            variant="text"
            aria-label="次のページ"
            disabled={currentPage >= pageCount}
            onClick={() => onPage(currentPage + 1)}
          >
            <UiIcon name="chevron-right" />
          </Button>
          <select
            aria-label="表示件数"
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}件 / ページ
              </option>
            ))}
          </select>
        </nav>
      </section>
    </>
  );
});

function QueueList({
  queues,
  counts,
  current,
  onSelect,
}: {
  queues: readonly QueueItem[];
  counts: ReconciliationResponse['queues'];
  current: ReconciliationQueue | null;
  onSelect: (queue: ReconciliationQueue | null) => void;
}) {
  return (
    <ul>
      {queues.map((queue) => (
        <li key={queue.id}>
          <Button
            variant="text"
            className={`recon-queue-item${current === queue.id ? ' is-active' : ''}`}
            aria-pressed={current === queue.id}
            aria-label={`${queue.label} ${counts[queue.id]}件`}
            onClick={() => onSelect(current === queue.id ? null : queue.id)}
          >
            <UiIcon name={queue.icon} className={`ui-icon recon-queue-icon is-${queue.id}`} />
            <span className="recon-queue-text">
              <strong>{queue.label}</strong>
              <span>{queue.note}</span>
            </span>
            <span className="recon-queue-count">{counts[queue.id]}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SelectionCheckbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <label className="recon-selection-hit">
      <input
        type="checkbox"
        className="recon-control-native"
        aria-label={label}
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate;
        }}
        onChange={onChange}
      />
      <span className="recon-control-indicator" aria-hidden="true" />
    </label>
  );
}

function UnavailableSelection({ label }: { label: string }) {
  return (
    <span className="recon-selection-hit recon-selection-hit--unavailable">
      <span className="recon-selection-placeholder" aria-hidden="true">
        —
      </span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

function RadioOption({
  name,
  checked,
  onChange,
  label,
  count,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="recon-radio">
      <input
        type="radio"
        className="recon-control-native"
        name={name}
        checked={checked}
        aria-label={count === undefined ? label : `${label} ${count}`}
        onChange={onChange}
      />
      <span className="recon-control-indicator" aria-hidden="true" />
      <span className="recon-radio-label">{label}</span>
      {count !== undefined && (
        <span className="recon-radio-count" aria-hidden="true">
          {count}
        </span>
      )}
    </label>
  );
}
