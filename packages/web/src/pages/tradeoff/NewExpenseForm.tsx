import { useId } from 'react';
import { StepHeading } from './StepHeading.js';
import {
  type ExpenseDraft,
  TRADEOFF_AMOUNT_MAX,
  TRADEOFF_MEMO_MAX,
  TRADEOFF_TITLE_MAX,
  parseAmount,
} from './view-model.js';

/**
 * 1.新しい支出を設定 (FR-2 / FR-3)。5 入力を持つだけで、年額への換算はしない。
 * 開始月は記録と表示のための値で、試算には渡らない。
 */
export function NewExpenseForm({
  draft,
  onChange,
}: {
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
}) {
  const id = useId();
  const amountError = draft.amount.trim().length > 0 && parseAmount(draft.amount) === null;
  return (
    <section className="card tradeoff-step" aria-labelledby={`${id}-h`}>
      <StepHeading
        id={`${id}-h`}
        number={1}
        title="新しい支出を設定"
        qualifier="（試算条件）"
        description="増やしたい支出の条件を入力します。入力中の内容は、記録するまで保存されません。"
      />
      <div className="tradeoff-form">
        <label className="tradeoff-field tradeoff-field--wide">
          <span>支出名</span>
          <input
            type="text"
            maxLength={TRADEOFF_TITLE_MAX}
            placeholder="例: 新しい業務ツール"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <div className="tradeoff-field tradeoff-field--amount">
          <label htmlFor={`${id}-amount`}>金額</label>
          <input
            id={`${id}-amount`}
            className="num-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={TRADEOFF_AMOUNT_MAX}
            step={1}
            placeholder="円"
            value={draft.amount}
            aria-invalid={amountError || undefined}
            aria-describedby={amountError ? `${id}-amount-error` : undefined}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
          {amountError && (
            <span id={`${id}-amount-error`} className="tradeoff-field-error" role="alert">
              金額は 1 円〜1 億円の整数で入力してください
            </span>
          )}
        </div>
        <div className="tradeoff-field tradeoff-field--frequency">
          <span id={`${id}-freq`}>支払いの頻度</span>
          {/* biome-ignore lint/a11y/useSemanticElements: 2 つのトグルボタンの束で、fieldset の枠と既定余白を持ち込まない */}
          <div className="segment" role="group" aria-labelledby={`${id}-freq`}>
            <button
              data-native-control="toggle"
              type="button"
              className={draft.recurring ? '' : 'on'}
              aria-pressed={!draft.recurring}
              onClick={() => onChange({ recurring: false })}
            >
              単発
            </button>
            <button
              data-native-control="toggle"
              type="button"
              className={draft.recurring ? 'on' : ''}
              aria-pressed={draft.recurring}
              onClick={() => onChange({ recurring: true })}
            >
              毎月
            </button>
          </div>
        </div>
        <label className="tradeoff-field tradeoff-field--start">
          <span>開始月</span>
          <input
            type="month"
            value={draft.startMonth}
            onChange={(e) => onChange({ startMonth: e.target.value })}
          />
        </label>
        <label className="tradeoff-field tradeoff-field--memo">
          <span>メモ</span>
          <textarea
            rows={2}
            maxLength={TRADEOFF_MEMO_MAX}
            value={draft.memo}
            onChange={(e) => onChange({ memo: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
