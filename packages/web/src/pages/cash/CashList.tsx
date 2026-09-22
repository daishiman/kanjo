/**
 * 現金明細の一覧 (spec-cash-screen FR-9〜FR-13)。
 *
 * 絞り込み・合計・ページングの計算は core (view-model 経由) が済ませた値を受け取る。
 * ここは並べることと、操作を親へ返すことだけを受け持つ。
 */
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import type { CashEntry, Owner } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable } from '../../components/DataTable.js';
import { PageState } from '../../components/Page.js';
import {
  CASH_LIMITS,
  CASH_OWNER_UNSET_LABEL,
  CASH_ROUTE_LABEL,
  type CashFilter,
  OWNER_VALUES,
  cashAmount,
  cashMonthLabel,
  cashMonthNav,
  cashPageLabel,
  cashRowView,
  cashSignedAmount,
} from './view-model.js';

export interface CashListProps {
  status: 'loading' | 'error' | 'ready';
  error: unknown;
  onRetry: () => void;
  month: string;
  months: readonly string[];
  onMonth: (month: string) => void;
  filter: CashFilter;
  onFilter: (patch: Partial<CashFilter>) => void;
  onClearFilter: () => void;
  categories: string[];
  ownerLabel: (owner: Owner) => string;
  totals: { income: number; expense: number; net: number };
  /** サンプル表示中は合計が 0 のままであることを添える */
  showingSamples: boolean;
  page: { rows: CashEntry[]; page: number; pageCount: number; start: number; end: number; total: number };
  onPage: (page: number) => void;
  /** 表の上に出す空状態 (月が 0 件で絞り込みが既定)。サンプル表示中は表と並ぶ */
  emptyState: ReactNode | null;
  noMatch: boolean;
  sampleIds: ReadonlySet<number>;
  duplicateIds: ReadonlySet<number>;
  selected: ReadonlySet<number>;
  onToggle: (id: number, checked: boolean) => void;
  onTogglePage: (ids: number[], checked: boolean) => void;
  onBulkDelete: () => void;
  selectedCount: number;
  bulkError: string | null;
  editingId: number | null;
  deleteBusy: boolean;
  onEdit: (e: CashEntry) => void;
  onDelete: (e: CashEntry) => void;
  /** インラインの削除確認とトースト (表の直下に出す) */
  children?: ReactNode;
}

export function CashList(p: CashListProps) {
  const id = useId();
  const [keyword, setKeyword] = useState(p.filter.q);
  const [advanced, setAdvanced] = useState(
    p.filter.min !== null || p.filter.max !== null || p.filter.from !== null || p.filter.to !== null,
  );
  // URL から q が変わったら (戻る・条件をクリア) 入力欄も合わせる
  useEffect(() => setKeyword(p.filter.q), [p.filter.q]);

  const nav = cashMonthNav(p.months, p.month);
  const search = (e: FormEvent) => {
    e.preventDefault();
    p.onFilter({ q: keyword.trim() });
  };
  const numberOrNull = (v: string) => (/^\d{1,10}$/.test(v) ? Number(v) : null);

  const selectable = p.page.rows.filter((e) => !p.sampleIds.has(e.id)).map((e) => e.id);
  const allOnPage = selectable.length > 0 && selectable.every((rid) => p.selected.has(rid));

  return (
    <section className="card cash-list" aria-labelledby={`${id}-title`}>
      <div className="cash-card-head">
        <div>
          <h2 id={`${id}-title`}>現金明細の一覧</h2>
          <p className="sub">登録した現金・交通費の明細を確認・編集・削除できます。</p>
        </div>
        <nav className="cash-month-nav" aria-label="表示する月">
          <Button
            size="mini"
            aria-label="前の月"
            disabled={!nav.prev}
            onClick={() => nav.prev && p.onMonth(nav.prev)}
          >
            &lt;
          </Button>
          <span className="cash-month-label" aria-live="polite">
            {cashMonthLabel(p.month)}
          </span>
          <Button
            size="mini"
            aria-label="次の月"
            disabled={!nav.next}
            onClick={() => nav.next && p.onMonth(nav.next)}
          >
            &gt;
          </Button>
        </nav>
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: React 18 の型は <search> 要素を持たない */}
      <form className="cash-search" onSubmit={search} role="search">
        <input
          type="search"
          aria-label="キーワード"
          placeholder="キーワードで検索（内容・メモ・カテゴリなど）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit">検索</Button>
      </form>

      <div className="cash-filters">
        <select
          aria-label="収支"
          value={p.filter.io ?? ''}
          onChange={(e) => p.onFilter({ io: (e.target.value || null) as CashFilter['io'] })}
        >
          <option value="">すべての収支</option>
          <option value="income">収入</option>
          <option value="expense">支出</option>
        </select>
        <select
          aria-label="カテゴリ"
          value={p.filter.category ?? ''}
          onChange={(e) => p.onFilter({ category: e.target.value || null })}
        >
          <option value="">すべてのカテゴリ</option>
          {p.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="担当者"
          value={p.filter.owner ?? ''}
          onChange={(e) => p.onFilter({ owner: (e.target.value || null) as CashFilter['owner'] })}
        >
          <option value="">すべての担当者</option>
          {OWNER_VALUES.map((o) => (
            <option key={o} value={o}>
              {p.ownerLabel(o)}
            </option>
          ))}
          <option value="unset">{CASH_OWNER_UNSET_LABEL}</option>
        </select>
        <select
          aria-label="取込元"
          value={p.filter.route ?? ''}
          onChange={(e) => p.onFilter({ route: (e.target.value || null) as CashFilter['route'] })}
        >
          <option value="">すべての取込元</option>
          <option value="normal">{CASH_ROUTE_LABEL.normal}</option>
          <option value="transit">{CASH_ROUTE_LABEL.transit}</option>
        </select>
        <Button
          variant="text"
          size="mini"
          aria-expanded={advanced}
          aria-controls={`${id}-advanced`}
          onClick={() => setAdvanced((v) => !v)}
        >
          詳細検索
        </Button>
      </div>
      {advanced && (
        <div className="cash-advanced" id={`${id}-advanced`}>
          <label>
            金額の下限
            <input
              className="num"
              inputMode="numeric"
              value={p.filter.min ?? ''}
              onChange={(e) => p.onFilter({ min: numberOrNull(e.target.value) })}
            />
          </label>
          <label>
            金額の上限
            <input
              className="num"
              inputMode="numeric"
              value={p.filter.max ?? ''}
              onChange={(e) => p.onFilter({ max: numberOrNull(e.target.value) })}
            />
          </label>
          <label>
            日付の開始
            <input
              type="date"
              value={p.filter.from ?? ''}
              onChange={(e) => p.onFilter({ from: e.target.value || null })}
            />
          </label>
          <label>
            日付の終了
            <input
              type="date"
              value={p.filter.to ?? ''}
              onChange={(e) => p.onFilter({ to: e.target.value || null })}
            />
          </label>
        </div>
      )}

      {p.status === 'loading' ? (
        <PageState status="loading" />
      ) : p.status === 'error' ? (
        <PageState
          status="error"
          message="現金明細を読み込めませんでした"
          action={<Button onClick={p.onRetry}>再読込</Button>}
        />
      ) : (
        <>
          <ul className="cash-totals" aria-label="合計">
            <li className="cash-total-card is-income">
              <span className="cash-total-label">↑ 収入合計</span>
              <strong className="num">{cashAmount(p.totals.income)} 円</strong>
            </li>
            <li className="cash-total-card is-expense">
              <span className="cash-total-label">↓ 支出合計</span>
              <strong className="num">{cashAmount(p.totals.expense)} 円</strong>
            </li>
            <li className="cash-total-card is-net">
              <span className="cash-total-label">＝ 収支差額</span>
              <strong className="num">{cashSignedAmount(p.totals.net)} 円</strong>
            </li>
          </ul>
          {p.showingSamples && <p className="sub">サンプルは合計に含まれません</p>}

          {p.emptyState}
          {(p.noMatch || p.page.total > 0) && (
            <>
              {p.selectedCount > 0 && (
                <div className="cash-bulk">
                  <Button
                    variant="danger"
                    size="mini"
                    disabled={p.selectedCount > CASH_LIMITS.bulkMax || p.deleteBusy}
                    onClick={p.onBulkDelete}
                  >
                    選択した {p.selectedCount} 件を削除
                  </Button>
                  {p.bulkError && <span className="cash-error">{p.bulkError}</span>}
                </div>
              )}
              {p.noMatch ? (
                // biome-ignore lint/a11y/useSemanticElements: <output> は文中の要素しか入れられず、文とボタンを包めない
                <div className="page-state" role="status">
                  <p>条件に合う明細がありません</p>
                  <Button onClick={p.onClearFilter}>条件をクリア</Button>
                </div>
              ) : (
                <div className="scroll-x">
                  <DataTable
                    className="data cash-table"
                    columns={[
                      {
                        label: (
                          <input
                            type="checkbox"
                            aria-label="このページをすべて選択"
                            checked={allOnPage}
                            disabled={selectable.length === 0}
                            onChange={(e) => p.onTogglePage(selectable, e.target.checked)}
                          />
                        ),
                        sortable: false,
                      },
                      '日付',
                      '区分',
                      'カテゴリ',
                      '内容・摘要',
                      '担当者',
                      { label: '金額（円）', className: 'num' },
                      '取込元',
                      { label: '操作', sortable: false },
                    ]}
                  >
                    {p.page.rows.map((e) => {
                      const sample = p.sampleIds.has(e.id);
                      const row = cashRowView(e, p.ownerLabel, sample);
                      return (
                        <tr key={e.id} className={p.editingId === e.id ? 'is-editing' : undefined}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${row.date} ${row.description} を選択`}
                              disabled={sample}
                              checked={p.selected.has(e.id)}
                              onChange={(ev) => p.onToggle(e.id, ev.target.checked)}
                            />
                          </td>
                          <td className="num">{row.date}</td>
                          <td>
                            <span
                              className={`pill ${row.io === 'income' ? 'cash-io-income' : 'cash-io-expense'}`}
                            >
                              {row.ioLabel}
                            </span>
                          </td>
                          <td>{row.category}</td>
                          <td>
                            {row.description}
                            {row.purpose && <span className="sub cash-purpose">（{row.purpose}）</span>}
                            {sample && <span className="pill neutral cash-sample">サンプル</span>}
                            {p.duplicateIds.has(e.id) && (
                              <span
                                className="pill warn"
                                title="同じ支払いが freee の仕訳にもある疑いがあります。上の知らせを確認してください"
                              >
                                二重計上の疑い
                              </span>
                            )}
                          </td>
                          <td>{row.ownerLabel}</td>
                          <td className="num">{row.amount}</td>
                          <td>{row.routeLabel}</td>
                          <td className="cash-row-actions">
                            <Button size="mini" disabled={sample} onClick={() => p.onEdit(e)}>
                              編集
                            </Button>
                            <Button
                              variant="danger"
                              size="mini"
                              disabled={sample || p.deleteBusy}
                              onClick={() => p.onDelete(e)}
                            >
                              削除
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </div>
              )}
              {p.page.total > 0 && (
                <nav className="cash-pager" aria-label="ページ">
                  <span className="sub">{cashPageLabel(p.page)}</span>
                  <Button
                    size="mini"
                    aria-label="前のページ"
                    disabled={p.page.page <= 1}
                    onClick={() => p.onPage(p.page.page - 1)}
                  >
                    &lt;
                  </Button>
                  {Array.from({ length: p.page.pageCount }, (_, i) => i + 1).map((n) => (
                    <Button
                      key={n}
                      size="mini"
                      variant={n === p.page.page ? 'primary' : 'secondary'}
                      aria-current={n === p.page.page ? 'page' : undefined}
                      onClick={() => p.onPage(n)}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button
                    size="mini"
                    aria-label="次のページ"
                    disabled={p.page.page >= p.page.pageCount}
                    onClick={() => p.onPage(p.page.page + 1)}
                  >
                    &gt;
                  </Button>
                </nav>
              )}
            </>
          )}
          {p.children}
        </>
      )}
    </section>
  );
}
