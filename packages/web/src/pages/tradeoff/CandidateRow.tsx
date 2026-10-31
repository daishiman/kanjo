import type { TradeoffScreenCandidate } from '@kanjo/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { yen } from '../../format.js';
import {
  NEED_LABEL,
  type NeedChoice,
  TRADEOFF_MEMO_MAX,
  TREND_LABEL,
  candidateName,
  partnerLabel,
  relatedLabel,
} from './view-model.js';

const NEED_CHOICES: { value: NeedChoice; label: string }[] = [
  { value: 'low', label: '低にする' },
  { value: 'mid', label: '中にする' },
  { value: 'high', label: '高にする' },
  { value: 'auto', label: '自動に戻す' },
];

/** 候補 1 行とメモ編集。保存失敗時は編集値を残し、成功時だけ閉じる。 */
export function CandidateRow({
  candidate,
  index,
  selected,
  pending,
  failed,
  onToggle,
  onNeed,
  onMemo,
}: {
  candidate: TradeoffScreenCandidate;
  index: number;
  selected: boolean;
  pending: boolean;
  failed: boolean;
  onToggle: () => void;
  onNeed: (choice: NeedChoice) => void;
  onMemo: (memo: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [savingMemo, setSavingMemo] = useState(false);
  const name = candidateName(candidate);
  const busy = pending || savingMemo;

  const saveMemo = async () => {
    if (editing === null) return;
    setSavingMemo(true);
    const saved = await onMemo(editing);
    setSavingMemo(false);
    if (saved) setEditing(null);
  };

  return (
    <tr className={selected ? 'is-selected' : undefined}>
      <td>
        <SelectionCheckbox label={`${name}を選ぶ`} labelHidden checked={selected} onChange={onToggle} />
      </td>
      <td className="num">{index + 1}</td>
      <td className="left">
        <strong>{candidate.account}</strong>
        <span className="sub">{partnerLabel(candidate.partner)}</span>
      </td>
      <td className="num">{yen(candidate.monthly)}</td>
      <td className="num">{yen(candidate.annual)}</td>
      <td>
        <span className="tradeoff-need-cell">
          <span className={`tradeoff-need tradeoff-need--${candidate.need}`}>
            {NEED_LABEL[candidate.need]}
          </span>
          {candidate.needSource === 'manual' && <span className="pill neutral">手動</span>}
          <select
            className="tradeoff-need-menu"
            aria-label={`${name}の必要度`}
            value=""
            disabled={busy}
            onChange={(event) => onNeed(event.target.value as NeedChoice)}
          >
            <option value="" disabled>
              変更
            </option>
            {NEED_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </span>
      </td>
      <td className={`tradeoff-trend tradeoff-trend--${candidate.trend}`}>{TREND_LABEL[candidate.trend]}</td>
      <td className="left tradeoff-memo-cell">
        {editing !== null ? (
          <span className="tradeoff-memo-edit">
            <textarea
              aria-label={`${name}のメモ`}
              rows={2}
              maxLength={TRADEOFF_MEMO_MAX}
              value={editing}
              disabled={savingMemo}
              onChange={(event) => setEditing(event.target.value)}
            />
            <span className="tradeoff-memo-actions">
              <Button size="mini" variant="primary" disabled={busy} onClick={() => void saveMemo()}>
                {savingMemo ? '保存中…' : 'メモを保存'}
              </Button>
              <Button size="mini" disabled={busy} onClick={() => setEditing(null)}>
                やめる
              </Button>
            </span>
          </span>
        ) : (
          <>
            <span>{candidate.memo ?? candidate.reason}</span>
            {candidate.relatedTo && (
              <Link className="tradeoff-related" to={candidate.relatedTo}>
                {relatedLabel(candidate.relatedTo)}へ
              </Link>
            )}
            <Button
              variant="text"
              size="mini"
              aria-label={`${name}のメモを編集`}
              disabled={busy}
              onClick={() => setEditing(candidate.memo ?? '')}
            >
              メモ
            </Button>
          </>
        )}
        {failed && (
          <p className="tradeoff-row-error" role="alert">
            {editing !== null
              ? 'メモを保存できませんでした。入力内容は残っています'
              : '必要度を保存できませんでした。もう一度お試しください'}
          </p>
        )}
      </td>
    </tr>
  );
}
