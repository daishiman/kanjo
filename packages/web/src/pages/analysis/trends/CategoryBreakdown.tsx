import { Fragment, type ReactNode, useMemo, useState } from 'react';
import type { TrendCategoryRow, TrendsScreen } from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { SortableTableHeader } from '../../../components/SortableTableHeader.js';
import { UiIcon } from '../../../components/UiIcon.js';
import { pct, ratio, yen } from '../../../format.js';
import { type TableSort, sortedRowsBy } from '../../../table-sort.js';
import { Spark } from './Spark.js';
import { changeClass, sideLabel, signedYen } from './format.js';
import type { TrendSide } from './types.js';

interface CategoryLineProps {
  row: TrendCategoryRow | TrendCategoryRow['payees'][number];
  label: ReactNode;
  hasCompare: boolean;
  betterWhen: 'higher' | 'lower' | undefined;
  selected: boolean;
  className?: string;
}

const CATEGORY_METRIC_COLUMNS = ['current', 'compare', 'change', 'rate', 'share', 'contribution'] as const;
type CategorySortColumn = 'category' | 'spark' | (typeof CATEGORY_METRIC_COLUMNS)[number];

const CATEGORY_SORT_OPTIONS: readonly { id: CategorySortColumn; label: string }[] = [
  { id: 'category', label: 'カテゴリ' },
  { id: 'spark', label: '12か月の変化量' },
  { id: 'current', label: '今回合計' },
  { id: 'compare', label: '比較期間' },
  { id: 'change', label: '増減額' },
  { id: 'rate', label: '増減率' },
  { id: 'share', label: '構成比' },
  { id: 'contribution', label: '寄与度' },
];

const sparkChange = (series: readonly (number | null)[]): number | null => {
  const values = series.filter((value): value is number => value !== null);
  return values.length >= 2 ? values[values.length - 1]! - values[0]! : null;
};

const categorySortValue = (row: TrendCategoryRow, column: CategorySortColumn): string | number | null => {
  switch (column) {
    case 'category':
      return `${row.name}\u0000${row.side}`;
    case 'spark':
      return sparkChange(row.spark);
    case 'current':
      return row.current;
    case 'compare':
      return row.compare;
    case 'change':
      return row.change;
    case 'rate':
      return row.changeRate;
    case 'share':
      return row.share;
    case 'contribution':
      return row.contribution;
  }
};

function CategoryLine({ row, label, hasCompare, betterWhen, selected, className }: CategoryLineProps) {
  return (
    <tr className={[className, selected ? 'is-selected' : ''].filter(Boolean).join(' ') || undefined}>
      <th scope="row" data-label="カテゴリ">
        {label}
      </th>
      <td data-label="直近12か月">
        <Spark series={row.spark} />
      </td>
      <td data-label="今回合計" className="num">
        {yen(row.current)}
      </td>
      <td data-label="比較期間" className="num">
        {hasCompare ? yen(row.compare) : '—'}
      </td>
      <td data-label="増減額" className={`num ${changeClass(row.change, betterWhen)}`}>
        {hasCompare ? signedYen(row.change) : '—'}
      </td>
      <td data-label="増減率" className="num">
        {hasCompare ? pct(row.changeRate) : '—'}
      </td>
      <td data-label="構成比" className="num">
        {ratio(row.share)}
      </td>
      <td data-label="寄与度" className="num">
        {hasCompare ? pct(row.contribution) : '—'}
      </td>
    </tr>
  );
}

export function CategoryBreakdown({
  screen,
  onSelect,
}: {
  screen: TrendsScreen;
  onSelect: (category: string, side: TrendSide, payee: string | null) => void;
}) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sort, setSort] = useState<TableSort<CategorySortColumn>>(null);
  const metric = screen.metrics.find((item) => item.id === screen.selection.metric);
  const hasCompare = screen.comparePeriod !== null;
  const compareLabel = screen.comparePeriod?.label ?? '比較';
  const selectedSide = screen.selection.side ?? null;
  const categories = useMemo(
    () => sortedRowsBy(screen.categories, sort, categorySortValue),
    [screen.categories, sort],
  );
  const sortHeader = (
    column: CategorySortColumn,
    label: string,
    options?: { className?: string; title?: string },
  ) => (
    <SortableTableHeader
      column={column}
      sort={sort}
      onSort={setSort}
      className={options?.className}
      title={options?.title}
    >
      {label}
    </SortableTableHeader>
  );
  return (
    <section className="card" aria-labelledby="trends-categories-title">
      <h3 id="trends-categories-title">カテゴリ別の推移と増減</h3>
      {screen.categories.length === 0 ? (
        <p className="sub">この条件で集計できるカテゴリはありません。</p>
      ) : (
        <div className="scroll-x trends-category-table-wrap">
          <div className="trends-category-sort-mobile">
            <label>
              並べ替え
              <select
                aria-label="カテゴリ表の並べ替え列"
                value={sort?.column ?? ''}
                onChange={(event) =>
                  setSort(
                    event.target.value
                      ? { column: event.target.value as CategorySortColumn, dir: 'asc' }
                      : null,
                  )
                }
              >
                <option value="">元の順序</option>
                {CATEGORY_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {sort && (
              <Button
                size="mini"
                aria-label={`並び順を${sort.dir === 'asc' ? '降順' : '昇順'}にする`}
                onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
              >
                {sort.dir === 'asc' ? '昇順' : '降順'}
              </Button>
            )}
          </div>
          <table className="data stack-sm trends-table trends-category-table" data-table-kind="sortable">
            <colgroup>
              <col className="trends-category-col--category" />
              <col className="trends-category-col--spark" />
              {CATEGORY_METRIC_COLUMNS.map((column) => (
                <col key={column} className={`trends-category-col--${column}`} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {sortHeader('category', 'カテゴリ')}
                {sortHeader('spark', '12か月の推移', {
                  title: '最初と最後の記録値の差で並べ替えます',
                })}
                {sortHeader('current', '今回合計', { className: 'num' })}
                {sortHeader('compare', '比較期間', {
                  className: 'num',
                  title: hasCompare ? compareLabel : '比較できないため値なし',
                })}
                {sortHeader('change', '増減額', { className: 'num' })}
                {sortHeader('rate', '増減率', { className: 'num' })}
                {sortHeader('share', '構成比', { className: 'num' })}
                {sortHeader('contribution', '寄与度', { className: 'num' })}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const rowKey = `${category.side}-${category.name}`;
                const open = openRow === rowKey;
                const selected =
                  screen.selection.category === category.name &&
                  selectedSide === category.side &&
                  !screen.selection.payee;
                return (
                  <Fragment key={rowKey}>
                    <CategoryLine
                      row={category}
                      label={
                        <Button
                          variant="text"
                          className="trends-category-button"
                          aria-expanded={open}
                          aria-label={`${category.name}(${sideLabel(category.side)})の取引先を${open ? '閉じる' : '表示'}`}
                          aria-pressed={selected}
                          onClick={() => {
                            setOpenRow(open ? null : rowKey);
                            onSelect(category.name, category.side, null);
                          }}
                        >
                          <UiIcon
                            name={open ? 'down' : 'chevron-right'}
                            className="trends-category-chevron"
                          />
                          <span className="trends-category-name" title={category.name}>
                            {category.name}
                          </span>
                          <span className={`pill ${category.side === 'business' ? 'biz' : 'per'}`}>
                            {sideLabel(category.side)}
                          </span>
                        </Button>
                      }
                      hasCompare={hasCompare}
                      betterWhen={metric?.betterWhen}
                      selected={selected}
                    />
                    {open && (
                      <tr className="trends-payee-heading">
                        <td colSpan={8}>取引先の内訳</td>
                      </tr>
                    )}
                    {open &&
                      category.payees.map((payee) => {
                        const payeeSelected =
                          screen.selection.category === category.name &&
                          selectedSide === category.side &&
                          screen.selection.payee === payee.payee;
                        return (
                          <CategoryLine
                            key={`${rowKey}-${payee.origin}-${payee.payee}`}
                            row={payee}
                            className="trends-payee"
                            label={
                              <Button
                                variant="text"
                                className="trends-payee-button"
                                aria-pressed={payeeSelected}
                                onClick={() => onSelect(category.name, category.side, payee.payee)}
                              >
                                <span className="trends-category-name" title={payee.payee}>
                                  {payee.payee}
                                </span>
                                <span className="pill neutral">
                                  {payee.origin === 'freee' ? 'freee' : 'MF'}
                                </span>
                              </Button>
                            }
                            hasCompare={hasCompare}
                            betterWhen={metric?.betterWhen}
                            selected={payeeSelected}
                          />
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
