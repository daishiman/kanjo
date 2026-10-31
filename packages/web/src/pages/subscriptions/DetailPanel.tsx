import { SUBS_CATEGORIES, type SubscriptionVendorDetail } from '@kanjo/core';
import { forwardRef, useEffect, useId, useState } from 'react';
import { AccessibleTabs } from '../../components/AccessibleTabs.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { UiIcon } from '../../components/UiIcon.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { yen } from '../../format.js';
import { CandidateStatusBadges } from './CandidateStatusBadges.js';
import { DetailOverview, TransactionTable } from './DetailOverview.js';
import { SOURCE_LABEL, jpDateTime, slashDate } from './format.js';
import { summarizeObservedHistory } from './history-summary.js';
import type { ExclusionsState, RawSelection, RunWrite, VendorOptionsState } from './types.js';
import { vendorUpdateIntent } from './writeRequests.js';

const TABS = [
  { id: 'overview', label: '概要' },
  { id: 'history', label: '取引履歴' },
  { id: 'related', label: '関連データ' },
] as const;
type TabId = (typeof TABS)[number]['id'];

interface PanelProps {
  status: 'loading' | 'error' | 'ready';
  detail: SubscriptionVendorDetail | undefined;
  onRetry: () => void;
  vendorOptions: VendorOptionsState;
  exclusions: ExclusionsState;
  selection: readonly RawSelection[];
  /** 処理中は取引名の選択と「名称を統合」を止める (AC-011) */
  selectionLocked: boolean;
  onToggleRaw: (raw: RawSelection) => void;
  /** 開いている行を選択に加え、選択バーの統合先へフォーカスを移す */
  onMergeName: () => void;
  /** 書き込みを「操作」に積む。処理中でも押せ、押した順に送る */
  run: RunWrite;
  onRelatedVisibilityChange: (visible: boolean) => void;
  onClose: () => void;
}

/**
 * サブスクの詳細 (spec §6)。作りは照合画面の DetailPanel を踏襲し、
 * 読込中・失敗はパネルの中だけで出す (一覧は触らない。spec §11)。
 */
export const DetailPanel = forwardRef<HTMLElement, PanelProps>(function DetailPanel(props, ref) {
  const { status, detail, onRetry, onClose } = props;
  return (
    <aside ref={ref} className="card subs-detail" aria-labelledby="subs-detail-title" tabIndex={-1}>
      <div className="subs-detail-head">
        <h2 id="subs-detail-title">サブスクの詳細</h2>
        <Button variant="text" aria-label="詳細を閉じる" onClick={onClose}>
          <UiIcon name="close" aria-hidden="true" />
        </Button>
      </div>
      {status === 'loading' && <output className="sub subs-detail-loading">詳細を読み込んでいます…</output>}
      {status === 'error' && (
        <div className="subs-detail-error" role="alert">
          <p>詳細を読み込めませんでした。</p>
          <Button onClick={onRetry}>再試行</Button>
        </div>
      )}
      {status === 'ready' && detail && <DetailBody key={detail.vendorKey} {...props} detail={detail} />}
    </aside>
  );
});

function DetailBody(props: PanelProps & { detail: SubscriptionVendorDetail }) {
  const { detail } = props;
  const [tab, setTab] = useState<TabId>('overview');
  const baseId = useId();
  const row = detail.row;
  const selectTab = (next: TabId) => {
    setTab(next);
    props.onRelatedVisibilityChange(next === 'related');
  };

  // URL の履歴移動を含め、別の詳細へ移る際は前の関連タブが要求した補助 query を止める。
  useEffect(
    () => () => {
      props.onRelatedVisibilityChange(false);
    },
    [props.onRelatedVisibilityChange],
  );

  return (
    <>
      <div className="subs-detail-summary">
        <p className="subs-detail-name">{row.normalizedName}</p>
        <CandidateStatusBadges row={row} />
        <CategoryEditor detail={detail} run={props.run} />
      </div>
      <AccessibleTabs
        ariaLabel="詳細の表示"
        idPrefix={`${baseId}-tab`}
        items={TABS}
        value={tab}
        onChange={selectTab}
        ariaControls={(id) => `${baseId}-panel-${id}`}
        className="subs-tabs"
        tabClassName="subs-tab"
      />
      <div
        className="subs-tabpanel"
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: tabs パターンでは Tab キーでパネル本文へ移れるようにする。
        tabIndex={0}
      >
        {tab === 'overview' && <DetailOverview {...props} onShowHistory={() => selectTab('history')} />}
        {tab === 'history' && <HistoryTab detail={detail} />}
        {tab === 'related' && <RelatedTab {...props} />}
      </div>
    </>
  );
}

/** 補足行のカテゴリと鉛筆 (spec §6.1)。既定辞書の名前か 1〜20 文字の自由入力 */
function CategoryEditor({ detail, run }: { detail: SubscriptionVendorDetail; run: RunWrite }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(detail.row.category);
  const listId = useId();
  const id = detail.vendorId;
  const trimmed = value.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 20;
  useEffect(() => {
    if (!editing) setValue(detail.row.category);
  }, [editing, detail.row.category]);
  if (!editing || id === null) {
    return (
      <p className="subs-detail-category">
        {detail.row.category}
        {id !== null && (
          <Button
            variant="text"
            size="mini"
            aria-label="カテゴリを変更"
            onClick={() => {
              setValue(detail.row.category);
              setEditing(true);
            }}
          >
            ✎
          </Button>
        )}
      </p>
    );
  }
  return (
    <form
      className="subs-inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        const outcome = await run(vendorUpdateIntent(detail, id, { field: 'category', value: trimmed }));
        if (outcome.ok) setEditing(false);
      }}
    >
      <label>
        <span className="visually-hidden">カテゴリ</span>
        <input
          list={listId}
          value={value}
          maxLength={20}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <datalist id={listId}>
        {SUBS_CATEGORIES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Button type="submit" size="mini" variant="primary" disabled={!valid}>
        保存
      </Button>
      <Button size="mini" variant="text" onClick={() => setEditing(false)}>
        やめる
      </Button>
    </form>
  );
}

function HistoryTab({ detail }: { detail: SubscriptionVendorDetail }) {
  const dialog = useConfirmDialog();
  const titleId = `${dialog.titleId}-history`;
  const usageTitleId = `${titleId}-usage`;
  const usage = summarizeObservedHistory(detail.recent);
  return (
    <>
      <p className="sub">期間内の取引 {detail.transactionCount}件（新しい順）</p>
      {detail.recent.length ? (
        <>
          <ul className="subs-history-summary" aria-label="直近の取引履歴">
            {detail.recent.slice(0, 3).map((tx, index) => (
              <li key={`${tx.date}-${tx.name}-${tx.amount}-${index}`}>
                <time dateTime={tx.date}>{slashDate(tx.date)}</time>
                <strong>{tx.name}</strong>
                <span>{SOURCE_LABEL[tx.source]}</span>
                <span className="num">{yen(tx.amount)}</span>
              </li>
            ))}
          </ul>
          <Button ref={dialog.triggerRef} onClick={() => dialog.setOpen(true)}>
            取引履歴を大きく表示（{detail.transactionCount}件）
          </Button>
        </>
      ) : (
        <p className="sub">期間内の取引はありません。</p>
      )}
      {dialog.open && (
        <dialog
          ref={dialog.bind}
          className="deletion-confirm-dialog subs-history-dialog"
          aria-labelledby={titleId}
          onClose={dialog.close}
          onCancel={(event) => {
            event.preventDefault();
            dialog.close();
          }}
        >
          <div className="subs-history-dialog-body">
            <div className="subs-history-dialog-head">
              <div>
                <h3 ref={dialog.titleRef} id={titleId} tabIndex={-1}>
                  {detail.row.normalizedName}の取引履歴
                </h3>
                <p className="sub">新しい順</p>
              </div>
              <Button aria-label="取引履歴を閉じる" onClick={dialog.close}>
                <UiIcon name="close" aria-hidden="true" />
                閉じる
              </Button>
            </div>
            {usage && (
              <section className="subs-history-usage" aria-labelledby={usageTitleId}>
                <div className="subs-history-usage-head">
                  <h4 id={usageTitleId}>履歴からわかる利用状況</h4>
                  <p>対象期間内の履歴から算出</p>
                </div>
                <dl>
                  <div className="subs-history-usage-period">
                    <dt>確認できる利用期間</dt>
                    <dd className="num">
                      <time dateTime={usage.firstDate}>{slashDate(usage.firstDate)}</time>
                      {usage.firstDate === usage.lastDate ? (
                        <span>（1日の記録）</span>
                      ) : (
                        <>
                          <span>〜</span>
                          <time dateTime={usage.lastDate}>{slashDate(usage.lastDate)}</time>
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="subs-history-usage-payments">
                    <dt>支払い実績</dt>
                    <dd>
                      <span className="num">{usage.paymentMonthCount}か月</span>
                      <span>・</span>
                      <span className="num">{usage.transactionCount}件</span>
                    </dd>
                  </div>
                  <div>
                    <dt>合計支払額</dt>
                    <dd className="num">{yen(usage.totalAmount)}</dd>
                  </div>
                  <div>
                    <dt>支払い月あたり平均</dt>
                    <dd className="num">{yen(usage.monthlyAverage)}</dd>
                  </div>
                </dl>
              </section>
            )}
            <div className="subs-history-table-scroll">
              <TransactionTable
                rows={detail.recent}
                caption={`${detail.row.normalizedName}の取引履歴`}
                withSource
                expanded
              />
            </div>
            <ul
              className="subs-history-mobile"
              aria-label={`${detail.row.normalizedName}の取引履歴（モバイル表示）`}
            >
              {detail.recent.map((tx, index) => (
                <li key={`${tx.date}-${tx.name}-${tx.amount}-${index}`}>
                  <div>
                    <time dateTime={tx.date}>{slashDate(tx.date)}</time>
                    <strong className="num">{yen(tx.amount)}</strong>
                  </div>
                  <p>{tx.name}</p>
                  <span>{SOURCE_LABEL[tx.source]}</span>
                </li>
              ))}
            </ul>
          </div>
        </dialog>
      )}
    </>
  );
}

function RelatedTab({
  detail,
  vendorOptions,
  exclusions,
  run,
}: PanelProps & { detail: SubscriptionVendorDetail }) {
  const row = detail.row;
  if (row.status === 'unregistered' || detail.vendorId === null || !detail.related) {
    return (
      <>
        <p className="sub">
          まだ登録していない候補です。候補の判断は「概要」で行うと、別名・対象科目・見直し日を管理できます。
        </p>
        <ExcludedList state={exclusions} run={run} />
      </>
    );
  }
  return (
    <RegisteredRelated
      detail={detail}
      id={detail.vendorId}
      related={detail.related}
      name={row.normalizedName}
      vendorOptions={vendorOptions}
      exclusions={exclusions}
      run={run}
    />
  );
}

function RegisteredRelated({
  detail,
  id,
  related,
  name,
  vendorOptions,
  exclusions,
  run,
}: {
  detail: SubscriptionVendorDetail;
  id: number;
  related: NonNullable<SubscriptionVendorDetail['related']>;
  name: string;
  vendorOptions: VendorOptionsState;
  exclusions: ExclusionsState;
  run: RunWrite;
}) {
  const [alias, setAlias] = useState('');
  const [removing, setRemoving] = useState(false);
  // 処理中の「足す・外す」。送り終わるまで見込みの状態を出し、続けて押せるようにする (AC-011)
  const [pendingAccounts, setPendingAccounts] = useState<ReadonlyMap<string, boolean>>(new Map());
  const removeDialog = useConfirmDialog({ busy: removing });
  const aliasId = useId();
  const trimmed = alias.trim();
  // 保存済みの科目が選択肢から消えていても外さずに見せる (黙って対象を変えない)
  const accounts = [
    ...new Set([
      ...(vendorOptions.status === 'ready' ? vendorOptions.accountOptions : []),
      ...related.accounts,
    ]),
  ];
  const isChecked = (account: string) => pendingAccounts.get(account) ?? related.accounts.includes(account);
  const setAccount = async (account: string, on: boolean) => {
    setPendingAccounts((current) => new Map(current).set(account, on));
    await run(
      vendorUpdateIntent(detail, id, { field: 'accounts', op: on ? 'add' : 'remove', value: account }),
    );
    // 後から同じ科目を押し直していれば、その操作の見込みを残す
    setPendingAccounts((current) => {
      if (current.get(account) !== on) return current;
      const next = new Map(current);
      next.delete(account);
      return next;
    });
  };

  return (
    <>
      <section aria-labelledby={`${aliasId}-title`}>
        <h3 id={`${aliasId}-title`}>別名</h3>
        {related.aliases.length ? (
          <ul className="subs-alias-list">
            {related.aliases.map((item) => (
              <li key={item}>
                {item}
                <Button
                  variant="text"
                  size="mini"
                  aria-label={`別名「${item}」を削除`}
                  onClick={() =>
                    run(vendorUpdateIntent(detail, id, { field: 'aliases', op: 'remove', value: item }))
                  }
                >
                  <UiIcon name="close" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub">別名はありません。</p>
        )}
        <form
          className="subs-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!trimmed) return;
            const outcome = await run({
              kind: 'vendor_aliases_add',
              vendorId: id,
              vendorName: name,
              aliases: [trimmed],
            });
            if (outcome.ok) setAlias('');
          }}
        >
          <label htmlFor={aliasId} className="visually-hidden">
            追加する別名
          </label>
          <input
            id={aliasId}
            value={alias}
            maxLength={100}
            placeholder="別名を追加"
            onChange={(event) => setAlias(event.target.value)}
          />
          <Button type="submit" size="mini" disabled={!trimmed}>
            追加
          </Button>
        </form>
      </section>

      <fieldset className="subs-accounts">
        <legend>対象科目</legend>
        <p className="sub">選ぶと、その科目の明細だけをこのサブスクに数えます。未選択なら全科目。</p>
        {(vendorOptions.status === 'idle' || vendorOptions.status === 'loading') && (
          <output className="sub">対象科目の候補を読み込んでいます…</output>
        )}
        {vendorOptions.status === 'error' && (
          <div className="subs-inline-error" role="alert">
            <p>対象科目の候補を読み込めませんでした。</p>
            <Button size="mini" onClick={vendorOptions.retry}>
              再試行
            </Button>
          </div>
        )}
        {accounts.length ? (
          accounts.map((account) => (
            <SelectionCheckbox
              key={account}
              label={account}
              checked={isChecked(account)}
              onChange={() => setAccount(account, !isChecked(account))}
            />
          ))
        ) : (
          <p className="sub">選べる科目がありません。</p>
        )}
      </fieldset>

      <section className="subs-review-date" aria-label="四半期の見直し">
        <p>
          最後に見直した日: {related.reviewedAt ? jpDateTime(related.reviewedAt) : 'まだ見直していません'}
          {related.reviewDue && <span className="subs-badge is-pending">見直し時期</span>}
        </p>
        <Button onClick={() => run({ kind: 'review', vendorId: id, vendorName: name })}>見直した</Button>
      </section>

      <div className="subs-detail-actions">
        <Button ref={removeDialog.triggerRef} variant="danger" onClick={() => removeDialog.setOpen(true)}>
          登録の解除
        </Button>
      </div>
      {removeDialog.open && (
        <ConfirmDialog
          dialog={removeDialog}
          title={`「${name}」の登録を解除しますか？`}
          confirmLabel="登録を解除する"
          busyLabel="解除しています…"
          onConfirm={async () => {
            setRemoving(true);
            const outcome = await run({ kind: 'vendor_delete', vendorId: id, vendorName: name });
            setRemoving(false);
            // 失敗は「操作」の行に出し、ダイアログは開いたままにして押し直せるようにする
            if (outcome.ok) removeDialog.close();
          }}
          onDismiss={removeDialog.close}
        >
          <p>別名・対象科目・カテゴリ・見直し日も消えます。明細は消えません。</p>
        </ConfirmDialog>
      )}
      <ExcludedList state={exclusions} run={run} />
    </>
  );
}

/** 除外した支払先と取消 (旧 UI の候補パネルから移した操作。dec-subs-legacy-ui) */
function ExcludedList({ state, run }: { state: ExclusionsState; run: RunWrite }) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <output className="sub">除外した支払先を読み込んでいます…</output>;
  }
  if (state.status === 'error') {
    return (
      <div className="subs-inline-error" role="alert">
        <p>除外した支払先を読み込めませんでした。</p>
        <Button size="mini" onClick={state.retry}>
          再試行
        </Button>
      </div>
    );
  }
  if (!state.items.length) return null;
  return (
    <details className="subs-excluded">
      <summary>除外した支払先（{state.items.length}件）</summary>
      <ul>
        {state.items.map((item) => (
          <li key={item.id}>
            {item.partner}
            <Button
              variant="text"
              size="mini"
              aria-label={`${item.partner}の除外を取り消す`}
              onClick={() => run({ kind: 'exclusion', partner: item.partner, exclusionId: item.id })}
            >
              除外を取り消す
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
