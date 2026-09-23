/**
 * 現金明細の入力 (spec-cash-screen FR-3 / FR-4 / FR-7)。
 *
 * 値は親 (CashPage) が持ち、この部品は欄を並べて変更を返すだけ。
 * 日付・事業 / 個人・担当者・(個人の) カテゴリは交通費カードも使うので、ここが唯一の入力欄になる。
 */
import { type FormEvent, type RefObject, useId } from 'react';
import type { Candidates } from '../../api.js';
import { Button } from '../../components/Button.js';
import {
  type CandidatesState,
  CashCategoryField,
  CashDateField,
  CashOwnerField,
  CashSideField,
} from './SharedEntryFields.js';
import {
  AMOUNT_DIGITS,
  CASH_LIMITS,
  type CashNormalDraft,
  type OWNER_VALUES,
  codePointLength,
  truncateCodePoints,
} from './view-model.js';

export function NormalEntryCard({
  value,
  onChange,
  candidates,
  candidatesState,
  ownerLabel,
  active,
  editing,
  busy,
  error,
  draftSavedLabel,
  dateRef,
  onSubmit,
  onClear,
  onCancelEdit,
  onSwitchToTransit,
  onActivate,
}: {
  value: CashNormalDraft;
  onChange: (next: CashNormalDraft) => void;
  candidates: Candidates;
  candidatesState: CandidatesState;
  ownerLabel: (owner: (typeof OWNER_VALUES)[number]) => string;
  /** タブで選ばれている (強調し、下部固定バーの追加先になる) */
  active: boolean;
  editing: boolean;
  busy: boolean;
  /** 検証または API の 400 の文。主ボタンの上に出す */
  error: string | null;
  draftSavedLabel: string | null;
  dateRef: RefObject<HTMLInputElement>;
  onSubmit: () => void;
  onClear: () => void;
  onCancelEdit: () => void;
  onSwitchToTransit: () => void;
  onActivate: () => void;
}) {
  const id = useId();
  const set = (patch: Partial<CashNormalDraft>) => onChange({ ...value, ...patch });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onActivate();
    onSubmit();
  };

  return (
    <section
      className={`card cash-entry-card${active ? ' is-active' : ''}`}
      aria-labelledby={`${id}-title`}
      data-cash-card="normal"
      onFocusCapture={onActivate}
    >
      <div className="cash-card-head">
        <h2 id={`${id}-title`}>{editing ? '現金明細の変更' : '現金明細の入力'}</h2>
        {draftSavedLabel && (
          <span className="sub cash-draft-time">下書きを自動保存しました {draftSavedLabel}</span>
        )}
      </div>
      <form className="cash-form" onSubmit={submit} noValidate>
        <div className="cash-form-row">
          <CashDateField id={id} value={value} onChange={onChange} dateRef={dateRef} />
          <CashSideField id={id} value={value} onChange={onChange} />
          <fieldset className="cash-field cash-choice">
            <legend>
              収支 <span className="cash-req">必須</span>
            </legend>
            {(['income', 'expense'] as const).map((io) => (
              <label key={io} className="check">
                <input
                  type="radio"
                  name={`${id}-io`}
                  value={io}
                  checked={value.io === io}
                  onChange={() => set({ io })}
                />
                {io === 'income' ? '収入' : '支出'}
              </label>
            ))}
          </fieldset>
          <div className="cash-field">
            <label htmlFor={`${id}-amount`}>
              金額（円） <span className="cash-req">必須</span>
            </label>
            <input
              id={`${id}-amount`}
              className="num"
              type="text"
              inputMode="numeric"
              value={value.amount}
              onChange={(e) => set({ amount: e.target.value.replace(/[^\d]/g, '').slice(0, AMOUNT_DIGITS) })}
            />
          </div>
        </div>
        <div className="cash-form-row">
          <div className="cash-field cash-field-wide">
            <label htmlFor={`${id}-description`}>
              内容・摘要 <span className="cash-req">必須</span>
            </label>
            <input
              id={`${id}-description`}
              type="text"
              placeholder="例：会議費、備品購入、売上金 など"
              value={value.description}
              onChange={(e) =>
                set({ description: truncateCodePoints(e.target.value, CASH_LIMITS.descriptionMax) })
              }
            />
          </div>
          <CashCategoryField
            id={id}
            value={value}
            onChange={onChange}
            candidates={candidates}
            candidatesState={candidatesState}
            onSwitchToTransit={onSwitchToTransit}
          />
          <CashOwnerField id={id} value={value} onChange={onChange} ownerLabel={ownerLabel} />
        </div>
        <div className="cash-form-row">
          <div className="cash-field cash-field-wide">
            <label htmlFor={`${id}-memo`}>メモ</label>
            <textarea
              id={`${id}-memo`}
              rows={2}
              value={value.memo}
              onChange={(e) => set({ memo: truncateCodePoints(e.target.value, CASH_LIMITS.memoMax) })}
            />
            <span className="sub cash-count" aria-live="polite">
              {codePointLength(value.memo)}/{CASH_LIMITS.memoMax}
            </span>
          </div>
          <p className="sub cash-receipt-note">領収書は freee に保管してください</p>
        </div>
        {error && (
          <p className="cash-error" role="alert">
            {error}
          </p>
        )}
        <div className="cash-form-actions">
          {editing ? (
            <Button onClick={onCancelEdit}>編集をやめる</Button>
          ) : (
            <Button onClick={onClear}>両方の入力をクリア</Button>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '保存中…' : editing ? '変更を保存' : '現金明細を追加 →'}
          </Button>
        </div>
      </form>
    </section>
  );
}
