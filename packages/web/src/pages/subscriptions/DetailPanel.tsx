import { SUBS_CATEGORIES, type SubscriptionVendorDetail } from '@kanjo/core';
import { type KeyboardEvent, forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/Button.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { UiIcon } from '../../components/UiIcon.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { yen } from '../../format.js';
import { CandidateStatusBadges } from './CandidateStatusBadges.js';
import { DetailOverview, TransactionTable } from './DetailOverview.js';
import {
  deleteExclusion,
  deleteSubVendor,
  postSubVendorAliases,
  postVendorReview,
  putSubVendor,
} from './api.js';
import { SOURCE_LABEL, jpDateTime, slashDate } from './format.js';
import { summarizeObservedHistory } from './history-summary.js';
import type {
  CreateMergeTarget,
  ExclusionsState,
  RawSelection,
  RunAction,
  VendorOptionsState,
} from './types.js';

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
  onToggleRaw: (raw: RawSelection) => void;
  /** 統合先。登録済みの行は自分自身、未登録の行は利用者が選んだ登録済みサブスク (未選択は null) */
  mergeTargetId: number | null;
  /** 未登録の行で統合先を選ぶ。下部の選択中バーと同じ値を共有するため画面側が持つ */
  onMergeTarget: (id: number | null) => void;
  /** 統合先の選択肢が無い場合に、同じ sub-vendor 作成経路でその場登録する */
  onCreateMergeTarget: CreateMergeTarget;
  run: RunAction;
  busy: boolean;
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  // WAI-ARIA tabs: 左右キーで隣のタブへ (端で折り返す)、Home / End で両端へ移り、そのまま選ぶ (自動選択)
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index + TABS.length - 1) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    selectTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="subs-detail-summary">
        <p className="subs-detail-name">{row.normalizedName}</p>
        <CandidateStatusBadges row={row} />
        <CategoryEditor detail={detail} run={props.run} busy={props.busy} />
      </div>
      <div className="subs-tabs" role="tablist" aria-label="詳細の表示" onKeyDown={onTabKey}>
        {TABS.map((item, index) => (
          <button
            data-native-control="tab"
            key={item.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'subs-tab on' : 'subs-tab'}
            onClick={() => selectTab(item.id)}
            // ref は最後に置く (UI 契約の走査は開始タグを最初の `>` までと読むため、矢印関数より前に ARIA 属性を並べる)
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
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
function CategoryEditor({
  detail,
  run,
  busy,
}: { detail: SubscriptionVendorDetail; run: RunAction; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(detail.row.category);
  const listId = useId();
  const id = detail.vendorId;
  const trimmed = value.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 20;
  if (!editing || id === null) {
    return (
      <p className="subs-detail-category">
        {detail.row.category}
        {id !== null && (
          <Button variant="text" size="mini" aria-label="カテゴリを変更" onClick={() => setEditing(true)}>
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
        if (await run(() => putSubVendor(id, { category: trimmed }), 'category')) setEditing(false);
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
      <Button type="submit" size="mini" variant="primary" disabled={busy || !valid}>
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
  busy,
}: PanelProps & { detail: SubscriptionVendorDetail }) {
  const row = detail.row;
  if (row.status === 'unregistered' || detail.vendorId === null || !detail.related) {
    return (
      <>
        <p className="sub">
          まだ登録していない候補です。候補の判断は「概要」で行うと、別名・対象科目・見直し日を管理できます。
        </p>
        <ExcludedList state={exclusions} run={run} busy={busy} />
      </>
    );
  }
  return (
    <RegisteredRelated
      id={detail.vendorId}
      related={detail.related}
      name={row.normalizedName}
      vendorOptions={vendorOptions}
      exclusions={exclusions}
      run={run}
      busy={busy}
    />
  );
}

function RegisteredRelated({
  id,
  related,
  name,
  vendorOptions,
  exclusions,
  run,
  busy,
}: {
  id: number;
  related: NonNullable<SubscriptionVendorDetail['related']>;
  name: string;
  vendorOptions: VendorOptionsState;
  exclusions: ExclusionsState;
  run: RunAction;
  busy: boolean;
}) {
  const [alias, setAlias] = useState('');
  const removeDialog = useConfirmDialog({ busy });
  const aliasId = useId();
  const trimmed = alias.trim();
  // 保存済みの科目が選択肢から消えていても外さずに見せる (黙って対象を変えない)
  const accounts = [
    ...new Set([
      ...(vendorOptions.status === 'ready' ? vendorOptions.accountOptions : []),
      ...related.accounts,
    ]),
  ];
  const setAccount = (account: string, on: boolean) =>
    run(
      () =>
        putSubVendor(id, {
          accounts: on ? [...related.accounts, account] : related.accounts.filter((item) => item !== account),
        }),
      'vendorDefinition',
    );

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
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => putSubVendor(id, { aliases: related.aliases.filter((a) => a !== item) }),
                      'vendorDefinition',
                    )
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
            if (await run(() => postSubVendorAliases(id, [trimmed]), 'vendorDefinition')) setAlias('');
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
          <Button type="submit" size="mini" disabled={busy || !trimmed}>
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
              checked={related.accounts.includes(account)}
              disabled={busy}
              onChange={(event) => setAccount(account, event.target.checked)}
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
        <Button disabled={busy} onClick={() => run(() => postVendorReview(id), 'reviewDate')}>
          見直した
        </Button>
      </section>

      <div className="subs-detail-actions">
        <Button
          ref={removeDialog.triggerRef}
          variant="danger"
          disabled={busy}
          onClick={() => removeDialog.setOpen(true)}
        >
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
            if (await run(() => deleteSubVendor(id), 'vendorDefinition')) removeDialog.close();
          }}
          onDismiss={removeDialog.close}
        >
          <p>別名・対象科目・カテゴリ・見直し日も消えます。明細は消えません。</p>
        </ConfirmDialog>
      )}
      <ExcludedList state={exclusions} run={run} busy={busy} />
    </>
  );
}

/** 除外した支払先と取消 (旧 UI の候補パネルから移した操作。dec-subs-legacy-ui) */
function ExcludedList({ state, run, busy }: { state: ExclusionsState; run: RunAction; busy: boolean }) {
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
              disabled={busy}
              onClick={() => run(() => deleteExclusion(item.id), 'exclusion')}
            >
              除外を取り消す
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
