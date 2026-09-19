import { type AccountKind, SUB_VENDOR_NAME_MAX, type SubscriptionVendorDetail } from '@kanjo/core';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api.js';
import { Button } from '../../components/Button.js';
import { UiIcon } from '../../components/UiIcon.js';
import { yen } from '../../format.js';
import { ReviewDecisionActions } from './ReviewDecisionActions.js';
import { putSubVendor } from './api.js';
import { SOURCE_LABEL, rawNameKey, slashDate } from './format.js';
import type { CreateMergeTarget, RawSelection, RunAction, VendorOptionsState } from './types.js';

const SOURCE_ICON: Record<AccountKind, 'lock' | 'wallet' | 'cloud' | 'info'> = {
  bank: 'lock',
  card: 'wallet',
  emoney: 'cloud',
  unclassified: 'info',
};

function NameEditor({
  detail,
  run,
  busy,
}: { detail: SubscriptionVendorDetail; run: RunAction; busy: boolean }) {
  const [value, setValue] = useState(detail.row.normalizedName);
  const [duplicate, setDuplicate] = useState(false);
  const inputId = useId();
  const id = detail.vendorId;
  const trimmed = value.trim();
  const changed = trimmed !== detail.row.normalizedName;
  return (
    <form
      className="subs-name-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (id === null || !trimmed || !changed) return;
        setDuplicate(false);
        await run(async () => {
          try {
            return await putSubVendor(id, { name: trimmed });
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              setDuplicate(true);
              return null;
            }
            throw error;
          }
        }, 'vendorDefinition');
      }}
    >
      <label htmlFor={inputId}>正規化された名称</label>
      <div className="subs-inline-form">
        <input
          id={inputId}
          value={value}
          disabled={id === null}
          aria-invalid={duplicate || undefined}
          aria-describedby={duplicate ? `${inputId}-error` : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {id !== null && (
          <Button type="submit" size="mini" disabled={busy || !trimmed || !changed}>
            保存
          </Button>
        )}
      </div>
      {duplicate && (
        <p id={`${inputId}-error`} className="subs-field-error">
          同じ名前のサブスクがすでにあります
        </p>
      )}
    </form>
  );
}

export function TransactionTable({
  rows,
  caption,
  withSource = false,
  expanded = false,
}: {
  rows: SubscriptionVendorDetail['recent'];
  caption: string;
  withSource?: boolean;
  expanded?: boolean;
}) {
  if (!rows.length) return <p className="sub">期間内の取引はありません。</p>;
  return (
    <table
      className={`data subs-tx-table${expanded ? ' is-expanded' : ''}`}
      data-table-kind="layout"
      data-sort-reason="詳細パネル内の直近取引を新しい日付順に固定した短い履歴"
    >
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">日付</th>
          <th scope="col">取引名</th>
          {withSource && <th scope="col">ソース</th>}
          <th scope="col" className="num">
            金額
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((tx, index) => (
          <tr key={`${tx.date}-${tx.name}-${tx.amount}-${index}`}>
            <td className="nowrap">{slashDate(tx.date)}</td>
            <td>{tx.name}</td>
            {withSource && <td>{SOURCE_LABEL[tx.source]}</td>}
            <td className="num">{yen(tx.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DetailOverview({
  detail,
  vendorOptions,
  selection,
  onToggleRaw,
  mergeTargetId,
  onMergeTarget,
  onCreateMergeTarget,
  run,
  busy,
  onShowHistory,
}: {
  detail: SubscriptionVendorDetail;
  vendorOptions: VendorOptionsState;
  selection: readonly RawSelection[];
  onToggleRaw: (raw: RawSelection) => void;
  mergeTargetId: number | null;
  onMergeTarget: (id: number | null) => void;
  onCreateMergeTarget: CreateMergeTarget;
  run: RunAction;
  busy: boolean;
  onShowHistory: () => void;
}) {
  const row = detail.row;
  const checked = new Set(selection.map((raw) => rawNameKey(raw.name, raw.source)));
  return (
    <>
      <NameEditor detail={detail} run={run} busy={busy} />

      <fieldset className="subs-raw-names">
        <legend>マッチした生の取引名（{detail.rawNames.length}件）</legend>
        <p className="subs-raw-head" aria-hidden="true">
          <span>取引名</span>
          <span>ソース</span>
        </p>
        <ul>
          {detail.rawNames.map((raw) => (
            <li key={rawNameKey(raw.name, raw.source)}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.has(rawNameKey(raw.name, raw.source))}
                  onChange={() => onToggleRaw({ name: raw.name, source: raw.source })}
                />
                <span>{raw.name}</span>
              </label>
              <span className="subs-raw-source">{SOURCE_LABEL[raw.source]}</span>
            </li>
          ))}
        </ul>
      </fieldset>

      {row.status === 'unregistered' && (
        <div className="subs-merge-target">
          <span>統合先</span>
          {(vendorOptions.status === 'idle' || vendorOptions.status === 'loading') && (
            <output className="sub">統合先を読み込んでいます…</output>
          )}
          {vendorOptions.status === 'error' && (
            <span className="subs-inline-error" role="alert">
              統合先を読み込めませんでした。
              <Button size="mini" onClick={vendorOptions.retry}>
                再試行
              </Button>
            </span>
          )}
          {vendorOptions.status === 'ready' && (
            <>
              <select
                aria-label="統合先"
                value={mergeTargetId ?? ''}
                disabled={!vendorOptions.vendors.length}
                onChange={(event) =>
                  onMergeTarget(event.target.value === '' ? null : Number(event.target.value))
                }
              >
                <option value="">
                  {vendorOptions.vendors.length ? '登録済みのサブスクを選ぶ' : '統合先がありません'}
                </option>
                {vendorOptions.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <MergeTargetCreator busy={busy} onCreate={onCreateMergeTarget} onCreated={onMergeTarget} />
            </>
          )}
        </div>
      )}

      <dl className="subs-estimate">
        <div>
          <dt>月額の推定額</dt>
          <dd className="num">{yen(detail.estimatedMonthly)}</dd>
        </div>
        <div>
          <dt>年換算</dt>
          <dd className="num">{yen(detail.annualized)}</dd>
        </div>
      </dl>

      <section className="subs-recent" aria-labelledby="subs-recent-title">
        <h3 id="subs-recent-title">直近の取引</h3>
        <TransactionTable rows={detail.recent.slice(0, 3)} caption="直近の取引" />
        <Button variant="text" onClick={onShowHistory}>
          すべて見る ({detail.transactionCount}件) →
        </Button>
      </section>

      <section className="subs-by-source" aria-labelledby="subs-by-source-title">
        <h3 id="subs-by-source-title">データソース</h3>
        <ul>
          {detail.bySource.map((item) => (
            <li key={item.source}>
              <UiIcon name={SOURCE_ICON[item.source]} aria-hidden="true" />
              {SOURCE_LABEL[item.source]} <span className="num">{item.count}件</span>
            </li>
          ))}
        </ul>
      </section>

      <ReviewDecisionActions row={row} run={run} busy={busy} />
    </>
  );
}

function MergeTargetCreator({
  busy,
  onCreate,
  onCreated,
}: {
  busy: boolean;
  onCreate: CreateMergeTarget;
  onCreated: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const id = useId();
  const trimmed = value.trim();

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <div className="subs-merge-create-entry">
        <Button
          ref={triggerRef}
          variant="text"
          onClick={() => {
            setOpen(true);
            setError(null);
            setNotice(null);
          }}
        >
          新しい統合先を登録
        </Button>
        {notice && <output>{notice}</output>}
      </div>
    );
  }

  return (
    <form
      className="subs-merge-create"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        if (!trimmed) {
          setError('統合先の名前を入力してください。');
          return;
        }
        try {
          const created = await onCreate(trimmed);
          onCreated(created.id);
          setValue('');
          setOpen(false);
          setNotice(`「${trimmed}」を登録し、統合先に選びました。`);
        } catch (caught) {
          setError(
            caught instanceof ApiError && caught.status === 409
              ? '同じ名前の統合先がすでにあります。上の一覧から選んでください。'
              : '統合先を登録できませんでした。入力内容を確認してもう一度お試しください。',
          );
        }
      }}
    >
      <label htmlFor={id}>新しい統合先の名前</label>
      <input
        ref={inputRef}
        id={id}
        value={value}
        required
        maxLength={SUB_VENDOR_NAME_MAX}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(null);
        }}
      />
      {error && (
        <p id={`${id}-error`} className="subs-field-error" role="alert">
          {error}
        </p>
      )}
      <div className="subs-merge-create-actions">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '登録中…' : '登録して統合先に選ぶ'}
        </Button>
        <Button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
        >
          やめる
        </Button>
      </div>
    </form>
  );
}
