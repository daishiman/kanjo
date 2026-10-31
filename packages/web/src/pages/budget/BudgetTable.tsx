/**
 * 予算一覧 (spec-budget-screen §7.6)。
 *
 * 行の順・前期実績・自動提案・差額・見通しは core が出した値をそのまま並べる。
 * ここで持つのは検索語の絞り込みと、チェック・入力欄・行の選択の受け渡しだけ。
 */
import type { BudgetBaseRow, BudgetFigureRow } from '@kanjo/core';
import type { RefObject } from 'react';
import { Button } from '../../components/Button.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { Term } from '../../components/Term.js';
import type { BudgetFormRow } from './draft.js';
import { AMOUNT_ERROR, diffClass, noMatchLabel, plainYen, signedPlain } from './view-model.js';

export interface BudgetTableProps {
  rows: BudgetBaseRow[];
  figures: ReadonlyMap<string, BudgetFigureRow>;
  form: Record<string, BudgetFormRow>;
  unsaved: ReadonlySet<string>;
  invalid: ReadonlySet<string>;
  checked: ReadonlySet<string>;
  selected: string | null;
  query: string;
  noMatch: boolean;
  prevLabel: string;
  targetLabel: string;
  searchRef: RefObject<HTMLInputElement>;
  resetRef: RefObject<HTMLButtonElement>;
  onQuery: (value: string) => void;
  onCheck: (account: string, on: boolean) => void;
  onCheckAll: (on: boolean) => void;
  onAmount: (account: string, value: string) => void;
  onAmountBlur: (account: string) => void;
  onOpen: (account: string) => void;
  onSuggest: () => void;
  onResetAll: () => void;
}

export function BudgetTable(props: BudgetTableProps) {
  const { rows, figures, form, unsaved, invalid, checked, selected, query } = props;
  const allChecked = rows.length > 0 && rows.every((row) => checked.has(row.account));
  const targetLabel = checked.size > 0 ? `選択中 ${checked.size}件` : '全件';
  const resetLabel = checked.size > 0 ? '選択分をリセット' : 'すべてリセット';
  return (
    <section className="card budget-table-card" aria-labelledby="budget-table-title">
      <div className="budget-table-head">
        <h2 id="budget-table-title">予算一覧</h2>
        <div className="budget-table-tools">
          <input
            ref={props.searchRef}
            type="search"
            className="budget-search"
            placeholder="カテゴリ名で検索 (Ctrl + K)"
            aria-label="カテゴリ名で検索"
            value={query}
            onChange={(event) => props.onQuery(event.target.value)}
          />
          <Button
            aria-label="実績から提案"
            aria-describedby="budget-suggest-target"
            onClick={props.onSuggest}
          >
            実績から提案
            <span id="budget-suggest-target" className="budget-button-target">
              （{targetLabel}）
            </span>
          </Button>
          <Button
            ref={props.resetRef}
            aria-label={checked.size > 0 ? `選択した${checked.size}件をリセット` : 'すべてリセット'}
            onClick={props.onResetAll}
          >
            {resetLabel}
            <span className="budget-button-target">（{targetLabel}）</span>
          </Button>
        </div>
      </div>
      <div className="budget-table-scroll">
        <table
          className="budget-table"
          aria-label="予算一覧"
          data-table-kind="workflow"
          data-sort-reason="収入から支出の順を core が決め、入力中に並びが変わって入力位置を見失わないよう固定する"
        >
          <thead>
            <tr>
              <th scope="col" className="budget-col-check">
                <SelectionCheckbox
                  label="すべて選択"
                  labelHidden
                  checked={allChecked}
                  onChange={(event) => props.onCheckAll(event.target.checked)}
                />
              </th>
              <th scope="col">#</th>
              <th scope="col">カテゴリ</th>
              <th scope="col" className="num">
                前期実績 ({props.prevLabel})
              </th>
              <th scope="col" className="num">
                来期予算 ({props.targetLabel})
              </th>
              <th scope="col" className="num">
                <Term id="budgetSuggestion">自動提案 ⓘ</Term>
              </th>
              <th scope="col" className="num">
                差額
              </th>
              <th scope="col" className="num">
                見通し ({props.targetLabel})
              </th>
              <th scope="col" className="num">
                来期予算 (入力)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const figure = figures.get(row.account);
              const isSelected = selected === row.account;
              const isInvalid = invalid.has(row.account);
              const errorId = `budget-amount-error-${index}`;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは行内の科目名ボタンで選ぶ (Tab / Enter)
                <tr
                  key={row.account}
                  className={isSelected ? 'budget-row selected' : 'budget-row'}
                  aria-selected={isSelected}
                  onClick={(event) => {
                    // チェック欄と入力欄を押したときはパネルを開かない (§7.6)
                    if ((event.target as HTMLElement).closest('input, button, label')) return;
                    props.onOpen(row.account);
                  }}
                >
                  <td className="budget-col-check">
                    <SelectionCheckbox
                      label={`${row.account}を選択`}
                      labelHidden
                      checked={checked.has(row.account)}
                      onChange={(event) => props.onCheck(row.account, event.target.checked)}
                    />
                  </td>
                  <td>{row.order}</td>
                  <th scope="row" className="budget-account">
                    <Button
                      variant="text"
                      aria-pressed={isSelected}
                      onClick={() => props.onOpen(row.account)}
                    >
                      {row.account}
                    </Button>
                    {row.manualOnly && <span className="budget-manual-note">実績なし・手入力</span>}
                  </th>
                  <td className="num">{plainYen(row.prevActual)}</td>
                  <td className="num">{plainYen(row.saved?.annualAmount ?? null)}</td>
                  <td className="num">{plainYen(figure?.suggestion ?? null)}</td>
                  <td className={`num ${diffClass(figure?.diff)}`}>{signedPlain(figure?.diff ?? null)}</td>
                  <td className="num">{plainYen(figure?.forecastAnnual ?? null)}</td>
                  <td className="budget-col-input">
                    <div className="budget-input-wrap">
                      {unsaved.has(row.account) && (
                        <span className="budget-unsaved-mark">
                          <span aria-hidden="true">●</span>
                          <span className="visually-hidden">未保存</span>
                        </span>
                      )}
                      <input
                        type="text"
                        inputMode="numeric"
                        className="budget-amount"
                        aria-label={`${row.account}の来期予算`}
                        aria-invalid={isInvalid || undefined}
                        aria-describedby={isInvalid ? errorId : undefined}
                        value={form[row.account]?.annualAmount ?? ''}
                        onChange={(event) => props.onAmount(row.account, event.target.value)}
                        onBlur={() => props.onAmountBlur(row.account)}
                      />
                    </div>
                    {isInvalid && (
                      <p id={errorId} className="budget-field-error">
                        {AMOUNT_ERROR}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {props.noMatch && <p className="budget-empty-note">{noMatchLabel(query)}</p>}
      </div>
    </section>
  );
}
