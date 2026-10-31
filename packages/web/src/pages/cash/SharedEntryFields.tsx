/**
 * 通常入力と交通費入力が共有する項目。
 *
 * 日付・事業/個人・担当者・カテゴリの入力作法を1箇所に固定し、
 * モバイルで通常入力カードが隠れても交通費を完結できるようにする。
 */
import type { RefObject } from 'react';
import type { Candidates } from '../../api.js';
import { Button } from '../../components/Button.js';
import { CategoryPicker } from '../../components/CategoryPicker.js';
import {
  type CashNormalDraft,
  OWNER_VALUES,
  TRANSIT_CATEGORY,
  TRANSIT_SAME_ACCOUNT_NOTE,
  changeSide,
} from './view-model.js';

export type CandidatesState = 'loading' | 'error' | 'ready';

type CommonProps = {
  id: string;
  value: CashNormalDraft;
  onChange: (next: CashNormalDraft) => void;
};

export function CashDateField({
  id,
  value,
  onChange,
  dateRef,
}: CommonProps & { dateRef?: RefObject<HTMLInputElement> }) {
  return (
    <div className="cash-field">
      <label htmlFor={`${id}-date`}>
        日付 <span className="cash-req">必須</span>
      </label>
      <input
        ref={dateRef}
        id={`${id}-date`}
        type="date"
        value={value.date}
        onChange={(event) => onChange({ ...value, date: event.target.value })}
      />
    </div>
  );
}

export function CashSideField({ id, value, onChange }: CommonProps) {
  return (
    <fieldset className="cash-field cash-choice">
      <legend>
        事業 / 個人 <span className="cash-req">必須</span>
      </legend>
      {(['biz', 'per'] as const).map((side) => (
        <label key={side} className="check">
          <input
            type="radio"
            name={`${id}-side`}
            value={side}
            checked={value.side === side}
            onChange={() => onChange(changeSide(value, side))}
          />
          {side === 'biz' ? '事業' : '個人'}
        </label>
      ))}
    </fieldset>
  );
}

export function CashOwnerField({
  id,
  value,
  onChange,
  ownerLabel,
}: CommonProps & { ownerLabel: (owner: (typeof OWNER_VALUES)[number]) => string }) {
  return (
    <div className="cash-field">
      <label htmlFor={`${id}-owner`}>
        担当者 <span className="cash-req">必須</span>
      </label>
      <select
        id={`${id}-owner`}
        value={value.owner}
        onChange={(event) => onChange({ ...value, owner: event.target.value as CashNormalDraft['owner'] })}
      >
        <option value="">選んでください</option>
        {OWNER_VALUES.map((owner) => (
          <option key={owner} value={owner}>
            {ownerLabel(owner)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CashCategoryField({
  id,
  value,
  onChange,
  candidates,
  candidatesState,
  transitMode = false,
  onSwitchToTransit,
}: CommonProps & {
  candidates: Candidates;
  candidatesState: CandidatesState;
  /** 交通費は事業なら旅費交通費を自動適用し、個人だけ選ぶ */
  transitMode?: boolean;
  onSwitchToTransit?: () => void;
}) {
  const scopeCandidates = value.side === 'biz' ? candidates.biz : candidates.per;
  const noBizCandidates =
    value.side === 'biz' &&
    !candidates.biz.some((candidate) => candidate.source === 'freee' || candidate.source === 'custom');
  const offerTransit = !transitMode && value.side === 'biz' && value.categoryMajor === TRANSIT_CATEGORY;

  return (
    <div className="cash-field cash-field-wide">
      <span className="cash-label" id={`${id}-category`}>
        カテゴリ <span className="cash-req">必須</span>
      </span>
      {transitMode && value.side === 'biz' ? (
        <output className="cash-shared-value" aria-labelledby={`${id}-category`}>
          {TRANSIT_CATEGORY}（自動）
        </output>
      ) : candidatesState === 'loading' ? (
        <select disabled aria-labelledby={`${id}-category`}>
          <option>候補を読み込み中…</option>
        </select>
      ) : candidatesState === 'error' ? (
        <output className="sub cash-inline-note">カテゴリ候補を読み込めません</output>
      ) : scopeCandidates.length === 0 ? (
        <p className="sub cash-inline-note">候補がありません</p>
      ) : (
        <CategoryPicker
          candidates={candidates}
          scope={value.side}
          big={value.categoryMajor}
          mid={value.categoryMid}
          onChange={({ big, mid }) => onChange({ ...value, categoryMajor: big, categoryMid: mid })}
          placeholderBig={value.side === 'biz' ? '勘定科目を選ぶ' : '大項目を選ぶ'}
          placeholderMid="中項目(任意)"
          hintText={value.description}
        />
      )}
      {noBizCandidates && candidatesState === 'ready' && scopeCandidates.length > 0 && (
        <p className="sub cash-inline-note">freee 仕訳が未取込のため、標準科目だけが出ています。</p>
      )}
      {offerTransit && onSwitchToTransit && (
        <p className="sub cash-inline-note">
          {TRANSIT_SAME_ACCOUNT_NOTE} 区間と片道運賃から金額を組み立てるなら、
          <Button variant="text" size="mini" onClick={onSwitchToTransit}>
            交通費の入力に切り替える
          </Button>
        </p>
      )}
    </div>
  );
}
