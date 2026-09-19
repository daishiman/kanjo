import type { SubscriptionRow, SubscriptionsScreen } from '@kanjo/core';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button.js';
import { DataTable, termColumn } from '../../components/DataTable.js';
import { yen } from '../../format.js';
import { CandidateStatusBadges } from './CandidateStatusBadges.js';
import { STATUS_FILTER_LABEL, type StatusFilter, matchesRow, plain } from './format.js';

const STATUS_FILTERS = Object.keys(STATUS_FILTER_LABEL) as StatusFilter[];

/**
 * サブスク一覧 (spec §5)。並びは core が決めた順のまま出し、ここでは絞るだけにする。
 * 行の選択は詳細を開くためだけに使い、用途のないチェック状態は持たない。
 */
export function SubscriptionTable({
  rows,
  kpis,
  activeKey,
  reviewFocusRequest,
  onOpen,
}: {
  rows: SubscriptionRow[];
  kpis: SubscriptionsScreen['kpis'];
  activeKey: string | null;
  /** 理由カードの「候補一覧」から、既存の絞り込みへ移る要求を数値で受け取る。 */
  reviewFocusRequest: number;
  onOpen: (vendorKey: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const cardRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const visible = useMemo(() => rows.filter((row) => matchesRow(row, query, status)), [rows, query, status]);
  const filtering = visible.length !== rows.length;
  useEffect(() => {
    if (reviewFocusRequest < 1) return;
    setQuery('');
    setStatus('review');
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      statusRef.current?.focus();
    });
  }, [reviewFocusRequest]);
  // 行のどこを押しても開く。名前のボタンはキーボード用に同じ操作を持つ。
  const openFromRow = (event: MouseEvent<HTMLTableRowElement>, key: string) => {
    if ((event.target as HTMLElement).closest('button')) return;
    onOpen(key);
  };

  return (
    <section ref={cardRef} className="card subs-table-card" aria-labelledby="subs-table-title">
      <div className="subs-table-head">
        <h2 id="subs-table-title">サブスク一覧</h2>
        <div className="subs-table-tools">
          <label className="subs-search">
            <span className="visually-hidden">ベンダー名・カテゴリで検索</span>
            <input
              type="search"
              placeholder="ベンダー名・カテゴリで検索..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="subs-status-filter">
            <span className="visually-hidden">ステータスで絞り込む</span>
            <select
              ref={statusRef}
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              {STATUS_FILTERS.map((key) => (
                <option key={key} value={key}>
                  {STATUS_FILTER_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <section
        className="scroll-x subs-table-scroll"
        aria-label="サブスク一覧の横スクロール領域"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: overflow表をキーボードで横スクロールできるようにする。
        tabIndex={0}
      >
        <DataTable
          className="data subs-table"
          caption={<caption className="visually-hidden">サブスク一覧</caption>}
          columns={[
            termColumn('vendor', { label: 'ベンダー名', sortable: false }),
            { label: '正規化名', sortable: false },
            { label: '取引名数', sortable: false, className: 'num' },
            { label: '最新の金額', sortable: false, className: 'num' },
            { label: '月額の推定', sortable: false, className: 'num' },
            { label: '年換算', sortable: false, className: 'num' },
            { label: 'カテゴリ', sortable: false },
            { label: '候補', sortable: false, className: 'subs-badge-column' },
          ]}
          foot={
            <tr className="total">
              <td colSpan={4}>{filtering ? '合計（全体の合計）' : '合計'}</td>
              <td className="num">{yen(kpis.monthlyTotal)}</td>
              <td className="num">{yen(kpis.annualized)}</td>
              <td />
              <td />
            </tr>
          }
        >
          {visible.map((row) => {
            const active = row.vendorKey === activeKey;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは名前のボタンで同じ操作ができる。行の click は指での操作面を広げるだけ。
              <tr
                key={row.vendorKey}
                className={active ? 'is-active' : undefined}
                data-vendor-key={row.vendorKey}
                onClick={(event) => openFromRow(event, row.vendorKey)}
              >
                <td>
                  <Button
                    variant="text"
                    className="subs-row-open"
                    aria-label={`${row.displayName}の詳細を表示`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onOpen(row.vendorKey)}
                  >
                    {row.displayName}
                  </Button>
                </td>
                <td>{row.normalizedName}</td>
                <td className="num">{row.matchedNameCount}</td>
                <td className="num">{plain(row.latestAmount)}</td>
                <td className="num">{plain(row.estimatedMonthly)}</td>
                <td className="num">{plain(row.annualized)}</td>
                <td>{row.category}</td>
                <td className="subs-badge-column">
                  <CandidateStatusBadges row={row} compact />
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>
      {!visible.length && <p className="sub subs-no-hit">条件に合うサブスクはありません。</p>}
    </section>
  );
}
