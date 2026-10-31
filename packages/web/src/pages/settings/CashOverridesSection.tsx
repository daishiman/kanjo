/**
 * 現金上書きの節 (spec-settings-screen §7.8)。
 *
 * 種別 (支払い・受け取り) ごとに全期間の行を 1 行置き、月指定の行を下に足せる。
 * 上書き値は入力欄の文字列のまま持ち、空欄 (上書きしない) と '0' (0 円で上書き) を潰さない。
 */
import { CASH_OVERRIDE_KINDS, type CashOverrideKind } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { type CashOverrideForm, type FormFieldError, newOverrideId, withAllRows } from './draft.js';
import { CASH_KIND_LABEL, CASH_TEXT, fieldErrorText, memoCount } from './view-model.js';

const isBlank = (row: CashOverrideForm): boolean => row.amount.trim() === '' && row.memo.trim() === '';

/** 今月 (JST) の 'YYYY-MM'。月指定を足したときの初期値 */
function currentMonth(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CashOverridesSection({
  rows,
  errors,
  onChange,
}: {
  rows: CashOverrideForm[];
  errors: Record<string, FormFieldError>;
  onChange: (next: CashOverrideForm[]) => void;
}) {
  const commit = (next: CashOverrideForm[]) => onChange(withAllRows(next));
  const setRow = (target: CashOverrideForm, patch: Partial<CashOverrideForm>) =>
    commit(rows.map((r) => (r === target ? { ...r, ...patch } : r)));
  const setScope = (target: CashOverrideForm, scope: CashOverrideForm['scope']) => {
    if (scope === target.scope) return;
    if (scope === 'month') {
      // 未設定の全期間の行は保存済みの id を持たない。月指定の行として新しい id を振る
      const id = target.overrideId.startsWith('blank-') ? newOverrideId() : target.overrideId;
      setRow(target, { scope, month: target.month || currentMonth(), overrideId: id });
      return;
    }
    // 全期間へ戻すときは、同じ種別の未設定の全期間の行を外して 1 行に保つ
    commit(
      rows
        .filter((r) => r === target || !(r.kind === target.kind && r.scope === 'all' && isBlank(r)))
        .map((r) => (r === target ? { ...r, scope, month: '' } : r)),
    );
  };
  const addMonth = (kind: CashOverrideKind) =>
    commit([
      ...rows,
      {
        overrideId: newOverrideId(),
        kind,
        amount: '',
        scope: 'month',
        month: currentMonth(),
        memo: '',
        isNew: true,
      },
    ]);

  return (
    <section className="card settings-section" id="cash-overrides" aria-labelledby="cash-overrides-heading">
      <h2 id="cash-overrides-heading">{CASH_TEXT.heading}</h2>
      <p className="sub">{CASH_TEXT.lead}</p>
      <div className="settings-cash-layout">
        <div className="settings-table-wrap">
          <table
            className="data settings-cash-table"
            data-table-kind="workflow"
            data-sort-reason="支払い→受け取り、全期間→月の固定の並びで読む表のため"
          >
            <caption className="visually-hidden">{CASH_TEXT.heading}</caption>
            <thead>
              <tr>
                <th scope="col">{CASH_TEXT.item}</th>
                <th scope="col">{CASH_TEXT.amount}</th>
                <th scope="col">{CASH_TEXT.scope}</th>
                <th scope="col">{CASH_TEXT.memo}</th>
              </tr>
            </thead>
            {CASH_OVERRIDE_KINDS.map((kind) => (
              <tbody key={kind}>
                {rows.map((row, index) => {
                  if (row.kind !== kind) return null;
                  const at = `cashOverrides.${index}`;
                  const id = `settings-cash-${row.overrideId}`;
                  const amountError = errors[`${at}.amount`];
                  const monthError = errors[`${at}.month`];
                  const memoError = errors[`${at}.memo`];
                  const label = CASH_KIND_LABEL[kind];
                  return (
                    <tr key={row.overrideId}>
                      <th scope="row">
                        {label}
                        {row.scope === 'month' && (
                          <span className="settings-note">{row.month || CASH_TEXT.month}</span>
                        )}
                      </th>
                      <td>
                        <input
                          id={`${id}-amount`}
                          type="text"
                          inputMode="numeric"
                          className="num-input"
                          aria-label={`${label}の${CASH_TEXT.amount}`}
                          aria-invalid={amountError ? true : undefined}
                          aria-describedby={amountError ? `${id}-amount-error` : undefined}
                          value={row.amount}
                          onChange={(e) => setRow(row, { amount: e.target.value })}
                        />
                        {amountError && (
                          <span className="settings-field-error" id={`${id}-amount-error`}>
                            {fieldErrorText(`${at}.amount`, amountError)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="settings-scope">
                          <select
                            aria-label={`${label}の${CASH_TEXT.scope}`}
                            value={row.scope}
                            onChange={(e) => setScope(row, e.target.value as CashOverrideForm['scope'])}
                          >
                            <option value="all">{CASH_TEXT.scopeAll}</option>
                            <option value="month">{CASH_TEXT.scopeMonth}</option>
                          </select>
                          {row.scope === 'month' && (
                            <input
                              type="month"
                              aria-label={`${label}の${CASH_TEXT.month}`}
                              aria-invalid={monthError ? true : undefined}
                              aria-describedby={monthError ? `${id}-month-error` : undefined}
                              value={row.month}
                              onChange={(e) => setRow(row, { month: e.target.value })}
                            />
                          )}
                          {row.scope === 'month' && (
                            <Button
                              size="mini"
                              variant="danger"
                              aria-label={`${label}の${CASH_TEXT.removeMonth}`}
                              onClick={() => commit(rows.filter((r) => r !== row))}
                            >
                              ×
                            </Button>
                          )}
                        </span>
                        {monthError && (
                          <span className="settings-field-error" id={`${id}-month-error`}>
                            {fieldErrorText(`${at}.month`, monthError)}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          aria-label={`${label}の${CASH_TEXT.memo}`}
                          placeholder={CASH_TEXT.memoPlaceholder}
                          aria-invalid={memoError ? true : undefined}
                          aria-describedby={`${id}-memo-count${memoError ? ` ${id}-memo-error` : ''}`}
                          value={row.memo}
                          onChange={(e) => setRow(row, { memo: e.target.value })}
                        />
                        <span className="settings-note settings-count" id={`${id}-memo-count`}>
                          {memoCount(row.memo)}
                        </span>
                        {memoError && (
                          <span className="settings-field-error" id={`${id}-memo-error`}>
                            {fieldErrorText(`${at}.memo`, memoError)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="settings-cash-add">
                  <td colSpan={4}>
                    <Button size="mini" onClick={() => addMonth(kind)}>
                      {`${CASH_KIND_LABEL[kind]}の${CASH_TEXT.addMonth}`}
                    </Button>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
        <ul className="settings-legend">
          {CASH_TEXT.legend.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
