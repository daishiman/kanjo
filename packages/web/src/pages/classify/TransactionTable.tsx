/**
 * 中央の取引一覧 (spec-classify-screen 7.5)。
 *
 * 行を押すと編集パネルが開く。チェックは一括選択にだけ使う。
 * 行全体を押せるのは速さのためだが、それだけだとキーボードから開けないので、
 * 内容の欄に同じ働きのボタンを置いて経路を 2 つにしてある。
 */
import type { ClassifyRow } from '../../api.js';
import { Button } from '../../components/Button.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { SortableTableHeader } from '../../components/SortableTableHeader.js';
import type { TableSort } from '../../table-sort.js';
import {
  type ClassifyFilters,
  amountText,
  confidenceText,
  countText,
  dateText,
  descriptionText,
  suggestionText,
} from './view-model.js';

/** 選択できる上限 (7.4・7.8)。超える選択は URL にも一括保存にも載せない */
export const MAX_SELECTION = 50;

export function TransactionTable({
  rows,
  total,
  page,
  sort,
  selected,
  openTxKey,
  onSort,
  onSelect,
  onOpen,
  onPage,
}: {
  rows: ClassifyRow[];
  total: number;
  page: number;
  sort: ClassifyFilters['sort'];
  selected: string[];
  openTxKey: string | null;
  onSort: (next: ClassifyFilters['sort']) => void;
  onSelect: (next: string[]) => void;
  onOpen: (row: ClassifyRow) => void;
  onPage: (next: number) => void;
}) {
  const pageKeys = rows.map((r) => r.rowKey);
  const allChecked = pageKeys.length > 0 && pageKeys.every((k) => selected.includes(k));
  const lastPage = Math.max(1, Math.ceil(total / 50));

  const tableSort: TableSort<'date'> = { column: 'date', dir: sort === 'date_asc' ? 'asc' : 'desc' };

  const toggleRow = (key: string) => {
    if (selected.includes(key)) {
      onSelect(selected.filter((k) => k !== key));
      return;
    }
    onSelect([...selected, key].slice(0, MAX_SELECTION));
  };

  return (
    <section className="classify-table" aria-label="取引一覧">
      <div className="classify-table-head">
        <h2>取引一覧（{total.toLocaleString('ja-JP')}件）</h2>
        <span className="sub">表示件数 50件</span>
      </div>

      <div className="classify-table-scroll">
        <table className="classify-transactions stack-sm" data-table-kind="sortable">
          <thead>
            <tr>
              <th scope="col" className="selection-cell">
                <SelectionCheckbox
                  className="classify-check"
                  labelHidden
                  label="表示中の明細をすべて選択"
                  checked={allChecked}
                  onChange={() =>
                    onSelect(
                      allChecked
                        ? selected.filter((k) => !pageKeys.includes(k))
                        : [...new Set([...selected, ...pageKeys])].slice(0, MAX_SELECTION),
                    )
                  }
                />
              </th>
              <SortableTableHeader
                column="date"
                sort={tableSort}
                onSort={(next) => onSort(next?.dir === 'asc' ? 'date_asc' : 'date_desc')}
              >
                日付
              </SortableTableHeader>
              <th scope="col">取引先</th>
              <th scope="col">内容</th>
              <th scope="col" className="num">
                金額
              </th>
              <th scope="col">提案カテゴリ</th>
              <th scope="col" className="num">
                信頼度
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: 同じ操作を内容欄のボタンで持たせてある
              <tr
                key={row.rowKey}
                className={`${row.rowKey === openTxKey ? 'is-open' : ''}${row.needsReview ? ' is-review' : ''}`}
                onClick={() => onOpen(row)}
              >
                <td data-label="選択" className="selection-cell">
                  <SelectionCheckbox
                    className="classify-check"
                    labelHidden
                    label={`${dateText(row.date)} ${row.payee} を選択`}
                    checked={selected.includes(row.rowKey)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleRow(row.rowKey)}
                  />
                </td>
                <td data-label="日付">{dateText(row.date)}</td>
                <td data-label="取引先">{row.payee}</td>
                <td data-label="内容">
                  <Button
                    variant="text"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(row);
                    }}
                  >
                    {descriptionText(row)}
                  </Button>
                </td>
                <td data-label="金額" className="num">
                  {amountText(row.amount)}
                </td>
                <td data-label="提案カテゴリ">{suggestionText(row)}</td>
                <td data-label="信頼度" className="num">
                  <span className={row.needsReview ? 'classify-confidence is-review' : 'classify-confidence'}>
                    {confidenceText(row.confidence)}
                  </span>
                  {row.needsReview && <span className="classify-review-flag">要確認</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="classify-pager">
        <span>{`全${countText(total)}`}</span>
        <Button variant="text" aria-label="前のページ" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹
        </Button>
        <span>{page}</span>
        <Button
          variant="text"
          aria-label="次のページ"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
        >
          ›
        </Button>
      </div>
    </section>
  );
}
