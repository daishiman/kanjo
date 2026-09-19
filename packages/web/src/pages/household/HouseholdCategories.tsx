import type { HouseholdCategoryKey, HouseholdSummary } from '@kanjo/core';
/**
 * 生活費カテゴリ別の内訳と、カテゴリの詳細 (spec §5)。
 *
 * 詳細の主な取引は選択時に取得する (本体レスポンスに入れず初期表示を軽くする)。
 * 取得の失敗はパネル内に閉じ、画面全体を失敗にしない。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type HouseholdCategoryDetail, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { describeError } from '../../components/Page.js';
import { UiIcon, type UiIconName } from '../../components/UiIcon.js';
import { monthLabel, yen } from '../../format.js';
import { usePeriod } from '../../period.js';
import {
  diffWithRate,
  expenseDiffClass,
  percent,
  previousRange,
  rangeText,
  shortDate,
  signedYen,
} from './view-model.js';

export function HouseholdCategories({
  data,
  selected,
  month,
  onSelect,
}: {
  data: HouseholdSummary;
  /** null は詳細を閉じた状態 (`cat=none`) */
  selected: HouseholdCategoryKey | null;
  month: string;
  onSelect: (cat: HouseholdCategoryKey | 'none') => void;
}) {
  const total = data.summary.total.expense;
  const previousTotal = data.summary.previousYear?.expense ?? null;
  const totalDiff = data.summary.change?.expense.diff ?? null;
  return (
    <div className={`household-categories${selected ? '' : ' is-closed'}`}>
      <section className="card" aria-labelledby="household-categories-title">
        <h2 id="household-categories-title">生活費カテゴリ別の内訳</h2>
        <div className="scroll-x">
          <table
            className="data household-table household-category-table"
            data-table-kind="comparison"
            data-sort-reason="6区分の固定順で当期と前年を並べて比べる表"
          >
            <thead>
              <tr>
                <th scope="col">カテゴリ</th>
                <th scope="col" className="num">
                  当期
                  <span className="household-th-sub">({rangeText(data.range)})</span>
                </th>
                <th scope="col" className="num">
                  前年
                  <span className="household-th-sub">({rangeText(previousRange(data.range))})</span>
                </th>
                <th scope="col" className="num">
                  増減額
                </th>
                <th scope="col" className="num">
                  構成比
                </th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((row) => {
                const on = row.key === selected;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは行内の区分名ボタンで選ぶ (Tab / Enter)
                  <tr
                    key={row.key}
                    className={on ? 'selected household-row-on' : undefined}
                    aria-selected={on}
                    onClick={() => onSelect(row.key)}
                  >
                    <td data-label="カテゴリ">
                      <Button
                        variant="text"
                        aria-pressed={on}
                        onClick={(event) => {
                          // 行の onClick へ伝わると選択が 2 回走る (詳細の取得も 2 回になる)
                          event.stopPropagation();
                          onSelect(row.key);
                        }}
                      >
                        <UiIcon name={CATEGORY_ICONS[row.key]} aria-hidden="true" /> {row.label}
                      </Button>
                    </td>
                    <td data-label="当期" className="num">
                      {yen(row.current)}
                    </td>
                    <td data-label="前年" className="num">
                      {yen(row.previous)}
                    </td>
                    <td data-label="増減額" className={`num ${expenseDiffClass(row.diff)}`}>
                      {signedYen(row.diff)}
                    </td>
                    <td data-label="構成比" className="num">
                      {percent(row.share)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="total">
                <td data-label="カテゴリ">合計</td>
                <td data-label="当期" className="num">
                  {yen(total)}
                </td>
                <td data-label="前年" className="num">
                  {yen(previousTotal)}
                </td>
                <td data-label="増減額" className={`num ${expenseDiffClass(totalDiff)}`}>
                  {signedYen(totalDiff)}
                </td>
                <td data-label="構成比" className="num">
                  {total > 0 ? '100.0%' : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      {selected && <CategoryDetail cat={selected} month={month} onClose={() => onSelect('none')} />}
    </div>
  );
}

function CategoryDetail({
  cat,
  month,
  onClose,
}: {
  cat: HouseholdCategoryKey;
  month: string;
  onClose: () => void;
}) {
  const { key, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: ['household', 'category', key, cat, month],
    queryFn: () =>
      api<HouseholdCategoryDetail>(
        withPeriod(`/household/category?key=${encodeURIComponent(cat)}&month=${encodeURIComponent(month)}`),
      ),
  });
  const d = query.data;
  return (
    <section
      className="card household-detail"
      aria-labelledby="household-detail-title"
      aria-busy={query.isFetching}
    >
      <div className="household-card-head">
        <h2 id="household-detail-title">カテゴリの詳細：{d?.label ?? ''}</h2>
        <Button variant="text" size="mini" aria-label="カテゴリの詳細を閉じる" onClick={onClose}>
          <UiIcon name="close" aria-hidden="true" />
        </Button>
      </div>
      {query.isLoading ? (
        <div className="household-skeleton" aria-label="読み込み中">
          <span />
          <span />
          <span />
        </div>
      ) : !d ? (
        <div className="notice danger" role="alert">
          <p>カテゴリの詳細を読み込めませんでした。{describeError(query.error)}</p>
          <Button size="mini" onClick={() => void query.refetch()}>
            再試行
          </Button>
        </div>
      ) : (
        <>
          <div className="household-detail-summary">
            <strong className="household-detail-name">{d.label}</strong>
            <span>
              表示期間の合計（{rangeText(d.range)}）{' '}
              <strong className="household-detail-amount">{yen(d.current)}</strong>
            </span>
            <span className={expenseDiffClass(d.diff)}>前年比 {diffWithRate(d.diff, d.rate)}</span>
          </div>
          {d.breakdown && (
            <p className="household-note">
              内訳: 家計の残り {yen(d.breakdown.household)} / 事業の支出 {yen(d.breakdown.business)}
            </p>
          )}
          <div className="household-card-head">
            <div>
              <h3>主な取引（最大5件） ({monthLabel(d.month)})</h3>
              <p className="household-detail-month-total">
                選択月合計（{monthLabel(d.month)}） <strong>{yen(d.monthTotal)}</strong>
              </p>
            </div>
            <Link to={d.detailHref}>すべて見る →</Link>
          </div>
          {d.transactions.length === 0 ? (
            <p className="household-note">この月の取引はありません。</p>
          ) : (
            <div className="scroll-x">
              <table
                className="data household-table"
                data-table-kind="layout"
                data-sort-reason="選択月の主な取引を日付の昇順で最大5件だけ示す抜粋"
              >
                <thead>
                  <tr>
                    <th scope="col">日付</th>
                    <th scope="col">内容</th>
                    <th scope="col" className="num">
                      金額
                    </th>
                    <th scope="col">取引先</th>
                    <th scope="col">名義</th>
                  </tr>
                </thead>
                <tbody>
                  {d.transactions.map((tx, i) => (
                    <tr key={`${tx.date}-${i}`}>
                      <td data-label="日付">{shortDate(tx.date)}</td>
                      <td data-label="内容">{tx.description}</td>
                      <td data-label="金額" className="num">
                        {yen(tx.amount)}
                      </td>
                      <td data-label="取引先">{tx.payee}</td>
                      <td data-label="名義">{tx.owner.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {d.totalCount > d.transactions.length && (
            <p className="household-note">ほか {d.totalCount - d.transactions.length} 件</p>
          )}
          <aside className="household-rule">
            <h3>このカテゴリの集計について</h3>
            <p>{d.rule.note}</p>
            <Link to="/settings">分類ルールを確認 →</Link>
          </aside>
        </>
      )}
    </section>
  );
}

const CATEGORY_ICONS: Record<HouseholdCategoryKey, UiIconName> = {
  housing: 'house',
  food: 'utensils',
  utilities: 'zap',
  education: 'book-open',
  transport: 'car',
  other: 'ellipsis',
};
