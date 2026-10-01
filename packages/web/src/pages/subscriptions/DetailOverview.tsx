import { type AccountKind, SUB_VENDOR_NAME_MAX, type SubscriptionVendorDetail } from '@kanjo/core';
import { useEffect, useId, useState } from 'react';
import { Button } from '../../components/Button.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { UiIcon } from '../../components/UiIcon.js';
import { yen } from '../../format.js';
import { ReviewDecisionActions } from './ReviewDecisionActions.js';
import { SOURCE_LABEL, rawNameKey, slashDate } from './format.js';
import type { RawSelection, RunWrite } from './types.js';
import { vendorUpdateIntent } from './writeRequests.js';

const SOURCE_ICON: Record<AccountKind, 'lock' | 'wallet' | 'cloud' | 'info'> = {
  bank: 'lock',
  card: 'wallet',
  emoney: 'cloud',
  unclassified: 'info',
};

function NameEditor({ detail, run }: { detail: SubscriptionVendorDetail; run: RunWrite }) {
  const [value, setValue] = useState(detail.row.normalizedName);
  const [baseline, setBaseline] = useState(detail.row.normalizedName);
  const [duplicate, setDuplicate] = useState(false);
  const inputId = useId();
  const id = detail.vendorId;
  const trimmed = value.trim();
  const changed = trimmed !== detail.row.normalizedName;
  useEffect(() => {
    const next = detail.row.normalizedName;
    if (next === baseline) return;
    setValue((current) => (current === baseline ? next : current));
    setBaseline(next);
  }, [detail.row.normalizedName, baseline]);
  return (
    <form
      className="subs-name-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (id === null || !trimmed || !changed) return;
        setDuplicate(false);
        const outcome = await run(vendorUpdateIntent(detail, id, { field: 'name', value: trimmed }), {
          inlineCodes: ['duplicate'],
        });
        // 重複だけは入力のそばで知らせる。他の失敗は「操作」の行に出る
        if (!outcome.ok && outcome.code === 'duplicate') setDuplicate(true);
      }}
    >
      <label htmlFor={inputId}>正規化された名称</label>
      <div className="subs-inline-form">
        <input
          id={inputId}
          value={value}
          maxLength={SUB_VENDOR_NAME_MAX}
          disabled={id === null}
          aria-invalid={duplicate || undefined}
          aria-describedby={duplicate ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (duplicate) setDuplicate(false);
          }}
        />
        {id !== null && (
          <Button type="submit" size="mini" disabled={!trimmed || !changed}>
            保存
          </Button>
        )}
      </div>
      {duplicate && (
        <p id={`${inputId}-error`} className="subs-field-error" role="alert">
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
  selection,
  selectionLocked,
  onToggleRaw,
  onMergeName,
  run,
  onShowHistory,
}: {
  detail: SubscriptionVendorDetail;
  selection: readonly RawSelection[];
  /** 処理中は選択を動かさない (統合の対象が送る前に変わらないように。AC-011) */
  selectionLocked: boolean;
  onToggleRaw: (raw: RawSelection) => void;
  /** 開いている行を選択に加え、選択バーの統合先へフォーカスを移す (FR-004) */
  onMergeName: () => void;
  run: RunWrite;
  onShowHistory: () => void;
}) {
  const row = detail.row;
  const checked = new Set(selection.map((raw) => rawNameKey(raw.name, raw.source)));
  return (
    <>
      <NameEditor detail={detail} run={run} />

      <fieldset className="subs-raw-names">
        <legend>マッチした生の取引名（{detail.rawNames.length}件）</legend>
        <p className="subs-raw-head" aria-hidden="true">
          <span>取引名</span>
          <span>ソース</span>
        </p>
        <ul>
          {detail.rawNames.map((raw) => (
            <li key={rawNameKey(raw.name, raw.source)}>
              <SelectionCheckbox
                label={raw.name}
                checked={checked.has(rawNameKey(raw.name, raw.source))}
                disabled={selectionLocked}
                onChange={() => onToggleRaw({ name: raw.name, source: raw.source })}
              />
              <span className="subs-raw-source">{SOURCE_LABEL[raw.source]}</span>
            </li>
          ))}
        </ul>
        <Button className="subs-merge-name" disabled={selectionLocked} onClick={onMergeName}>
          名称を統合
        </Button>
      </fieldset>

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

      <ReviewDecisionActions row={row} run={run} />
    </>
  );
}
