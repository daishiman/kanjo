/**
 * 分割明細の編集 (spec-classify-screen 7.9)。
 *
 * 合計の検算は splitSumMessage の 1 か所だけが文言を作る。
 * 「一致しているか」と「いくらずれているか」を画面ごとに書き分けると、
 * 同じ状態に別の言い回しが生まれ、直し方が読めなくなる。
 */
import {
  type Candidates,
  type Cls,
  MAX_SPLIT_LINES,
  type Owner,
  SPLIT_MEMO_MAX_LENGTH,
  type SplitTemplate,
  validateSplits,
} from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { type ClassifyRow, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { CategoryPicker } from '../../components/CategoryPicker.js';
import { OwnerSelect } from '../../components/ClassificationSettings.js';
import { amountText, dateText, splitSumMessage } from './view-model.js';

export interface SplitLineInput {
  lineId: string | null;
  amount: number;
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  memo: string;
}

interface SplitsResponse {
  txId: string;
  total: number;
  description: string;
  date: string;
  state: 'ready' | 'amount_conflict';
  constraints: { minLines: number; maxLines: number; memoMaxLength: number };
  lines: SplitLineInput[];
}

const emptyLine = (row: ClassifyRow): SplitLineInput => ({
  lineId: null,
  amount: 0,
  cls: row.suggestion?.cls ?? row.cls ?? null,
  big: row.suggestion?.big || row.big || null,
  mid: row.suggestion?.mid || row.mid || null,
  owner: row.suggestion?.owner ?? row.owner ?? null,
  memo: '',
});

export function SplitEditorPanel({
  row,
  candidates,
  onClose,
  onSaved,
}: {
  row: ClassifyRow;
  candidates: Candidates;
  onClose: () => void;
  onSaved: (template: SplitTemplate) => void;
}) {
  const total = Math.abs(row.amount);
  const [lines, setLines] = useState<SplitLineInput[]>([emptyLine(row), emptyLine(row)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既存の内訳があれば取りに行く。無い明細は 2 行の空から始める
  const splitQuery = useQuery({
    queryKey: ['splits', row.id],
    queryFn: () => api<SplitsResponse>(`/transactions/${encodeURIComponent(row.id)}/splits`),
  });
  useEffect(() => {
    if (splitQuery.data?.lines.length) setLines(splitQuery.data.lines);
  }, [splitQuery.data]);

  const sum = splitSumMessage(
    lines.map((l) => l.amount),
    total,
  );
  const issues = useMemo(() => {
    const shared = validateSplits(
      total,
      lines.map((line) => ({
        cls: line.cls ?? 'per',
        categoryMajor: line.big ?? '',
        categoryMid: line.mid ?? '',
        amount: line.amount,
        memo: line.memo || undefined,
        owner: line.owner,
      })),
    );
    const missingScope = lines.flatMap((line, index) =>
      line.cls ? [] : [{ index, message: '公私を選んでください。' }],
    );
    return [...missingScope, ...shared];
  }, [lines, total]);

  const update = (i: number, patch: Partial<SplitLineInput>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = () => {
    if (issues.length) return;
    setBusy(true);
    setError(null);
    api(`/transactions/${encodeURIComponent(row.id)}/splits`, {
      method: 'PUT',
      body: JSON.stringify({
        lines: lines.map((l) => ({
          lineId: l.lineId,
          amount: l.amount,
          cls: l.cls,
          big: l.big,
          mid: l.mid,
          owner: l.owner,
          memo: l.memo,
        })),
      }),
    })
      .then(() =>
        onSaved({
          lines: lines.map((line, index) => ({
            kind: index === lines.length - 1 ? 'remainder' : 'fixed',
            ...(index === lines.length - 1 ? {} : { amount: line.amount }),
            cls: line.cls as Cls,
            ...(line.big ? { big: line.big } : {}),
            ...(line.mid ? { mid: line.mid } : {}),
            ...(line.owner ? { owner: line.owner } : {}),
            ...(line.memo ? { memo: line.memo } : {}),
          })),
        }),
      )
      .catch(() => setError('分割を保存できませんでした。'))
      .finally(() => setBusy(false));
  };

  return (
    <section className="classify-split" aria-label="分割明細の編集">
      <div className="classify-edit-head">
        <h2>分割明細の編集</h2>
        <Button variant="text" size="mini" aria-label="分割の編集を閉じる" onClick={onClose}>
          ×
        </Button>
      </div>

      <p className="sub">{`${dateText(row.date)} ${row.payee} ${amountText(row.amount)} を複数の用途に分けます。`}</p>

      {splitQuery.isLoading && <p className="sub">既存の内訳を読み込んでいます…</p>}
      {splitQuery.isError && (
        <p className="sub" role="alert">
          分割の内訳を読み込めませんでした。
        </p>
      )}

      <ul className="classify-split-lines">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 行は並び順そのものが identity で、消すと後ろが繰り上がる
          <li key={i}>
            <span className="classify-split-no">{`${i + 1}行目`}</span>
            <CategoryPicker
              candidates={candidates}
              scope={line.cls}
              big={line.big ?? ''}
              mid={line.mid ?? ''}
              clearLabel="指定しない"
              onChange={(v) => update(i, { big: v.big || null, mid: v.mid || null })}
            />
            <label>
              <span>公私</span>
              <select
                value={line.cls ?? ''}
                onChange={(e) => update(i, { cls: (e.target.value || null) as Cls | null })}
              >
                <option value="">指定しない</option>
                <option value="biz">事業</option>
                <option value="per">個人</option>
              </select>
            </label>
            <label>
              <span>金額</span>
              <input
                type="number"
                value={line.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
              />
            </label>
            <OwnerSelect value={line.owner} onChange={(owner) => update(i, { owner })} />
            <label>
              <span>メモ</span>
              <input
                type="text"
                value={line.memo}
                maxLength={SPLIT_MEMO_MAX_LENGTH}
                onChange={(e) => update(i, { memo: e.target.value })}
              />
            </label>
            <Button
              variant="text"
              size="mini"
              aria-label={`${i + 1}行目を削除`}
              disabled={lines.length <= 2}
              onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        size="mini"
        disabled={lines.length >= MAX_SPLIT_LINES}
        onClick={() => setLines([...lines, emptyLine(row)])}
      >
        ＋ 行を追加
      </Button>

      <output className={sum.ok ? 'classify-split-sum is-ok' : 'classify-split-sum is-ng'}>{sum.text}</output>

      {issues.length > 0 && (
        <p className="sub" role="alert">
          {issues[0].message}
        </p>
      )}

      {error && (
        <p className="sub" role="alert">
          {error}
        </p>
      )}

      <div className="classify-edit-actions">
        <Button variant="primary" disabled={issues.length > 0 || busy} onClick={save}>
          {busy ? '保存しています…' : '分割を保存'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          やめる
        </Button>
      </div>
    </section>
  );
}
