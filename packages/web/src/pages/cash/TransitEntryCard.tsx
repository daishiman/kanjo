/**
 * 交通費の入力 (spec-cash-screen FR-5 / FR-6)。
 *
 * 日付・事業 / 個人・担当者は通常入力と同じ値を使う。
 * 狭幅では通常カードが隠れるため、共通部品をこのカードにも出す。
 * 合計金額は core の transitTotal が片道運賃と往復から出す読み取り専用の値。
 */
import { type FormEvent, useId } from 'react';
import type { Candidates } from '../../api.js';
import { Button } from '../../components/Button.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { Term } from '../../components/Term.js';
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
  type CashTransitDraft,
  type OWNER_VALUES,
  TRANSIT_PURPOSES,
  TRANSIT_PURPOSE_OTHER,
  TRANSIT_SAME_ACCOUNT_NOTE,
  cashAmount,
  codePointLength,
  transitAmount,
  truncateCodePoints,
} from './view-model.js';

export function TransitEntryCard({
  value,
  onChange,
  sharedValue,
  onSharedChange,
  candidates,
  candidatesState,
  ownerLabel,
  active,
  editing,
  busy,
  error,
  blockedReason,
  onSubmit,
  onCancelEdit,
  onSwitchToNormal,
  onActivate,
}: {
  value: CashTransitDraft;
  onChange: (next: CashTransitDraft) => void;
  sharedValue: CashNormalDraft;
  onSharedChange: (next: CashNormalDraft) => void;
  candidates: Candidates;
  candidatesState: CandidatesState;
  ownerLabel: (owner: (typeof OWNER_VALUES)[number]) => string;
  active: boolean;
  editing: boolean;
  busy: boolean;
  error: string | null;
  /** 追加できない理由 (個人でカテゴリ未選択)。ボタンを無効にして文を出す */
  blockedReason: string | null;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onSwitchToNormal: () => void;
  onActivate: () => void;
}) {
  const id = useId();
  const set = (patch: Partial<CashTransitDraft>) => onChange({ ...value, ...patch });
  const total = transitAmount(value);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onActivate();
    onSubmit();
  };

  return (
    <section
      className={`card cash-entry-card${active ? ' is-active' : ''}`}
      aria-labelledby={`${id}-title`}
      data-cash-card="transit"
      onFocusCapture={onActivate}
    >
      <div className="cash-card-head">
        <h2 id={`${id}-title`}>{editing ? '交通費の変更' : '交通費の入力'}</h2>
        <Button variant="text" size="mini" onClick={onSwitchToNormal}>
          通常入力に切り替え
        </Button>
      </div>
      <form className="cash-form" onSubmit={submit} noValidate>
        <p className="sub cash-inline-note cash-transit-shared-note">
          日付・事業 / 個人・担当者は「現金明細の入力」と共通です。
        </p>
        <div className="cash-transit-shared" aria-label="交通費の共通項目">
          <div className="cash-form-row">
            <CashDateField id={`${id}-shared`} value={sharedValue} onChange={onSharedChange} />
            <CashSideField id={`${id}-shared`} value={sharedValue} onChange={onSharedChange} />
            <CashOwnerField
              id={`${id}-shared`}
              value={sharedValue}
              onChange={onSharedChange}
              ownerLabel={ownerLabel}
            />
          </div>
          <div className="cash-form-row">
            <CashCategoryField
              id={`${id}-shared`}
              value={sharedValue}
              onChange={onSharedChange}
              candidates={candidates}
              candidatesState={candidatesState}
              transitMode
            />
          </div>
        </div>
        <div className="cash-form-row cash-route-row">
          <div className="cash-field">
            <label htmlFor={`${id}-from`}>
              出発駅 <span className="cash-req">必須</span>
            </label>
            <input
              id={`${id}-from`}
              type="text"
              value={value.from}
              onChange={(e) => set({ from: truncateCodePoints(e.target.value, CASH_LIMITS.stationMax) })}
            />
          </div>
          <Button
            size="mini"
            className="cash-swap"
            aria-label="出発駅と到着駅を入れ替える"
            onClick={() => set({ from: value.to, to: value.from })}
          >
            ⇅
          </Button>
          <div className="cash-field">
            <label htmlFor={`${id}-to`}>
              到着駅 <span className="cash-req">必須</span>
            </label>
            <input
              id={`${id}-to`}
              type="text"
              value={value.to}
              onChange={(e) => set({ to: truncateCodePoints(e.target.value, CASH_LIMITS.stationMax) })}
            />
          </div>
        </div>
        <div className="cash-form-row">
          <div className="cash-field">
            <label htmlFor={`${id}-oneway`}>
              片道運賃（円） <span className="cash-req">必須</span>
            </label>
            <input
              id={`${id}-oneway`}
              className="num"
              type="text"
              inputMode="numeric"
              value={value.oneWay}
              onChange={(e) => set({ oneWay: e.target.value.replace(/[^\d]/g, '').slice(0, AMOUNT_DIGITS) })}
            />
          </div>
          <SelectionCheckbox
            className="check cash-round"
            label="往復"
            checked={value.round}
            onChange={(e) => set({ round: e.target.checked })}
          />
          <div className="cash-field">
            <label htmlFor={`${id}-total`}>合計金額（円）</label>
            <output id={`${id}-total`} className="cash-total num" aria-live="polite">
              {total === null ? '—' : cashAmount(total)}
            </output>
          </div>
        </div>
        <div className="cash-form-row">
          <div className="cash-field">
            <label htmlFor={`${id}-purpose`}>
              業務の目的 <span className="cash-req">必須</span>
            </label>
            <select
              id={`${id}-purpose`}
              value={value.purpose}
              onChange={(e) => set({ purpose: e.target.value as CashTransitDraft['purpose'] })}
            >
              <option value="">選んでください</option>
              {TRANSIT_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {value.purpose === TRANSIT_PURPOSE_OTHER && (
            <div className="cash-field cash-field-wide">
              <label htmlFor={`${id}-purpose-note`}>
                その他の目的 <span className="cash-req">必須</span>
              </label>
              <input
                id={`${id}-purpose-note`}
                type="text"
                value={value.purposeNote}
                onChange={(e) =>
                  set({ purposeNote: truncateCodePoints(e.target.value, CASH_LIMITS.purposeNoteMax) })
                }
              />
            </div>
          )}
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
        </div>
        <p className="sub cash-inline-note">
          電車代は
          <Term id="voucher" />
          (領収書)が出ないため「証憑不要」で記帳します。{TRANSIT_SAME_ACCOUNT_NOTE}
        </p>
        {blockedReason && <p className="sub cash-inline-note">{blockedReason}</p>}
        {error && error !== blockedReason && (
          <p className="cash-error" role="alert">
            {error}
          </p>
        )}
        <div className="cash-form-actions">
          {editing && <Button onClick={onCancelEdit}>編集をやめる</Button>}
          <Button type="submit" variant="primary" disabled={busy || blockedReason !== null}>
            {busy ? '保存中…' : editing ? '変更を保存' : '交通費として追加 →'}
          </Button>
        </div>
      </form>
    </section>
  );
}
