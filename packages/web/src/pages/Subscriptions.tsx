/**
 * サブスク (整える > サブスク)。毎月の固定費に重複や見直し候補があるかを、一覧 → 詳細 → 判断の順に片付ける。
 * 数値の定義はすべて core の subscriptionsScreen / subscriptionVendorDetail にあり、この画面は並べて操作を送るだけ。
 */
import type { SubscriptionVendorDetail, SubscriptionsScreen } from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button } from '../components/Button.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { usePeriod } from '../period.js';
import { AnnualComparison } from './subscriptions/AnnualComparison.js';
import { CategoryTrendChart } from './subscriptions/CategoryTrendChart.js';
import { CoverageCard, RefreshCard } from './subscriptions/CoverageCard.js';
import { DetailPanel } from './subscriptions/DetailPanel.js';
import { SubscriptionKpis } from './subscriptions/Kpis.js';
import { OperationList } from './subscriptions/OperationList.js';
import { ReasonCard } from './subscriptions/ReasonCard.js';
import { SelectionBar } from './subscriptions/SelectionBar.js';
import { SubscriptionTable } from './subscriptions/SubscriptionTable.js';
import { type SubCandidatesResponse, getSubVendors } from './subscriptions/api.js';
import { rawNameKey } from './subscriptions/format.js';
import { mergeIntentOf, mergeTargetOptions, resolveMergeTarget } from './subscriptions/selection.js';
import type {
  ExclusionsState,
  LookupStatus,
  RawSelection,
  VendorOptionsState,
  WriteIntent,
} from './subscriptions/types.js';
import { SUB_VENDORS_KEY, useSubscriptionWrites } from './subscriptions/useSubscriptionWrites.js';
import './subscriptions/subscriptions.css';

const QUESTION = '毎月の固定費に、重複や見直し候補はありますか？';
const DESCRIPTION =
  '銀行・カード・電子マネーの取引データから、継続的な支払い（サブスク）を検出しています。不要な支出の見直しで、家計をすっきりさせましょう。';
const NARROW_QUERY = '(max-width: 1023px)';

const lookupStatus = (needed: boolean, isError: boolean, hasData: boolean): LookupStatus =>
  !needed ? 'idle' : isError ? 'error' : hasData ? 'ready' : 'loading';

function Heading() {
  return (
    <>
      <PageHeader route="subscriptions" showTask={false} lead={QUESTION} />
      <p className="subs-description">{DESCRIPTION}</p>
    </>
  );
}

/** 読込中の骨格。カードの枠と見出しは先に出し、画面全体を loading に差し替えない (spec §11) */
function SkeletonCard({ title, className = '' }: { title: string; className?: string }) {
  return (
    <section className={`card subs-skeleton ${className}`} aria-busy="true">
      <h2>{title}</h2>
      <p className="sub">読み込んでいます…</p>
    </section>
  );
}

function LoadingLayout() {
  return (
    <div className="subs" data-loading="true">
      <Heading />
      <section className="kpis subs-kpis" aria-label="サブスクの主要な数字" aria-busy="true">
        {['月額のサブスク合計', '年換算の合計', '直近12か月の支払額', '売上比', '見直し候補'].map((label) => (
          <KpiCard key={label} label={label} value="—" />
        ))}
      </section>
      <div className="subs-context-row">
        <SkeletonCard title="データソースのカバー率" className="subs-coverage" />
        <SkeletonCard title="最終更新" className="subs-refresh" />
      </div>
      <div className="subs-layout is-detail-closed">
        <div className="subs-main">
          <SkeletonCard title="サブスク一覧" className="subs-table-card" />
          <SkeletonCard title="月次のサブスク支出推移" className="subs-trend" />
          <SkeletonCard title="年換算の比較（カテゴリ別）" className="subs-comparison" />
        </div>
        <div className="subs-side">
          <SkeletonCard title="サブスク候補の検出理由" className="subs-reasons" />
        </div>
      </div>
      <output className="visually-hidden">サブスクを読み込んでいます</output>
    </div>
  );
}

export function SubscriptionsPage() {
  const { key, withPeriod } = usePeriod();
  const [params, setParams] = useSearchParams();
  const urlVendor = params.get('vendor');
  /**
   * React Router は URL の付け替えを遷移 (startTransition) として後から反映する。その間に一覧の取り直しが
   * 先に届くと、古い URL の統合元を「期間外」と見て消してしまう。付け替えた先をここに持ち、URL が追いつくまで使う。
   */
  const [pendingVendor, setPendingVendor] = useState<{ from: string | null; to: string | null } | null>(null);
  const vendorKey = pendingVendor && pendingVendor.from === urlVendor ? pendingVendor.to : urlVendor;
  /** 一覧で選んだ行 (選んだ順)。別の行を開いても保つ */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  /** 詳細で選んだ生の取引名。開いている 1 件のサブスクに属する */
  const [raws, setRaws] = useState<RawSelection[]>([]);
  /** 選択バーで選び直した統合先。null は既定 (推定月額が最大の登録済み) */
  const [chosenTarget, setChosenTarget] = useState<string | null>(null);
  /** 選択バーで登録した直後の統合先。登録の結果を 1 度だけ見るために持ち、見たら null に戻す */
  const [createdTarget, setCreatedTarget] = useState<string | null>(null);
  const [relatedVisible, setRelatedVisible] = useState(false);
  const [reviewFocusRequest, setReviewFocusRequest] = useState(0);
  const [targetFocusRequest, setTargetFocusRequest] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const targetRef = useRef<HTMLSelectElement>(null);
  const operationsRef = useRef<HTMLHeadingElement>(null);

  const screen = useQuery({
    queryKey: ['subscriptions', key],
    queryFn: () => api<SubscriptionsScreen>(withPeriod('/subscriptions')),
  });
  const rows = screen.data?.rows ?? [];
  const activeRow = vendorKey ? rows.find((row) => row.vendorKey === vendorKey) : undefined;
  const selectedRows = selectedKeys.flatMap((selected) => rows.filter((row) => row.vendorKey === selected));
  const detail = useQuery({
    queryKey: ['subscriptions', key, 'vendor', vendorKey],
    queryFn: () =>
      api<SubscriptionVendorDetail>(
        withPeriod(`/subscriptions/vendors/${encodeURIComponent(vendorKey ?? '')}`),
      ),
    enabled: Boolean(activeRow),
  });
  // 登録の一覧は関連データ (対象科目) と選択バー (統合先) の両方が使う
  const relatedNeeded = Boolean(activeRow && relatedVisible);
  const vendorsNeeded = relatedNeeded || selectedRows.length > 0 || raws.length > 0;
  const vendors = useQuery({ queryKey: SUB_VENDORS_KEY, queryFn: getSubVendors, enabled: vendorsNeeded });
  const candidates = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () => api<SubCandidatesResponse>('/sub-vendors/candidates'),
    enabled: relatedNeeded,
  });
  const vendorOptions: VendorOptionsState = {
    status: lookupStatus(relatedNeeded, vendors.isError, vendors.data !== undefined),
    vendors: vendors.data?.vendors ?? [],
    accountOptions: vendors.data?.accountOptions ?? [],
    retry: () => void vendors.refetch(),
  };
  const exclusions: ExclusionsState = {
    status: lookupStatus(relatedNeeded, candidates.isError, candidates.data !== undefined),
    items: candidates.data?.excluded ?? [],
    retry: () => void candidates.refetch(),
  };

  /** 開く詳細を付け替える (null は閉じる)。行を開く・閉じる・統合先へ移る・期間外で閉じる、のすべてがここを通る */
  const setVendor = useCallback(
    (next: string | null) => {
      setPendingVendor(next === urlVendor ? null : { from: urlVendor, to: next });
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          if (next) copy.set('vendor', next);
          else copy.delete('vendor');
          return copy;
        },
        { replace: true },
      );
      // 生の取引名の選択は開いている 1 件のサブスクに属するので外す。行の選択と統合先は保つ
      setRaws([]);
      setRelatedVisible(false);
    },
    [urlVendor, setParams],
  );

  /**
   * 行・取引名・統合先の選択を空にする。rescueFocus のときは、選択バーの中にあったフォーカスを
   * バーと一緒に消えないよう「操作」の見出しへ移す (AC-016)。
   */
  const releaseSelection = useCallback(({ rescueFocus }: { rescueFocus: boolean }) => {
    const focusInBar = rescueFocus && document.activeElement?.closest('.subs-selection') != null;
    setSelectedKeys([]);
    setRaws([]);
    setChosenTarget(null);
    if (focusInBar) operationsRef.current?.focus();
  }, []);

  /** 統合の成功後 (取り直しの前): 開いていた統合元の詳細は統合先へ付け替え、選択を空にする */
  const afterMerge = (intent: Extract<WriteIntent, { kind: 'merge' }>) => {
    if (vendorKey && intent.sourceKeys.includes(vendorKey)) {
      setVendor(rows.find((row) => row.vendorId === intent.targetId)?.vendorKey ?? intent.targetKey);
    }
    releaseSelection({ rescueFocus: true });
  };
  const writes = useSubscriptionWrites({
    onWriteSuccess: (intent) => {
      if (intent.kind === 'merge') afterMerge(intent);
    },
  });

  // URL が付け替え先に追いついたら、持っておいた付け替え先は要らない
  useEffect(() => {
    if (pendingVendor && pendingVendor.from !== urlVendor) setPendingVendor(null);
  }, [pendingVendor, urlVendor]);

  // URL の vendor が期間内に無い (期間を変えた・解除した) ときは、パネルを閉じて URL からも消す
  const staleVendor = Boolean(screen.data && vendorKey && !activeRow);
  useEffect(() => {
    if (staleVendor) setVendor(null);
  }, [staleVendor, setVendor]);

  // 一覧から消えた行 (統合された・期間外になった) は選択からも外す。元に戻して行が戻っても選び直させる
  const listRows = screen.data?.rows;
  useEffect(() => {
    if (!listRows) return;
    const present = new Set(listRows.map((row) => row.vendorKey));
    setSelectedKeys((current) =>
      current.every((selected) => present.has(selected))
        ? current
        : current.filter((selected) => present.has(selected)),
    );
  }, [listRows]);

  /**
   * 登録は名前の完全一致で未登録の行を吸収する。選択がすべて登録した統合先にまとまると統合するものが残らず、
   * 統合のボタンを押せないバーだけが残る。統合の完了と同じく選択を消し、結果は「操作」の行と読み上げに任せる。
   * 登録の応答は一覧の取り直しを待ってから返るので、登録した直後の描画で判定できる。
   */
  const absorbedByCreated =
    createdTarget !== null &&
    raws.length === 0 &&
    selectedRows.length > 0 &&
    selectedRows.every((row) => String(row.vendorId) === createdTarget);
  useEffect(() => {
    if (createdTarget === null) return;
    setCreatedTarget(null);
    if (absorbedByCreated) releaseSelection({ rescueFocus: true });
  }, [createdTarget, absorbedByCreated, releaseSelection]);

  // 「名称を統合」は選択バーが出てから統合先へフォーカスを移す
  useEffect(() => {
    if (targetFocusRequest > 0) targetRef.current?.focus();
  }, [targetFocusRequest]);

  // 狭い幅では詳細パネルが一覧の下に出るので、開いたらそこまで送る
  useEffect(() => {
    if (!vendorKey || !panelRef.current || typeof panelRef.current.scrollIntoView !== 'function') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches) {
      panelRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [vendorKey]);

  if (screen.isLoading) return <LoadingLayout />;
  if (screen.isError || !screen.data) {
    return (
      <div className="subs">
        <Heading />
        <PageState
          status="error"
          error={screen.error}
          action={
            <Button variant="primary" onClick={() => void screen.refetch()}>
              再試行
            </Button>
          }
        />
      </div>
    );
  }

  const data = screen.data;
  // 処理中は統合の対象を動かさない。統合のボタン・統合先・その他の操作は止めず、押した順に積む (AC-011)
  const selectionLocked = writes.busy;
  const options = mergeTargetOptions(selectedRows, vendors.data?.vendors ?? []);
  const target = resolveMergeTarget(chosenTarget, options, selectedRows);
  const mergeIntent = mergeIntentOf({ target, options, selectedRows, raws, listRows: data.rows });
  const selectionCount = selectedRows.length + raws.length;

  // 行・全選択・取引名・「名称を統合」は、処理中は disabled に加えてここでも受け付けない。
  // 選択バーのチップを外す・選択を解除するは止めないので、ロックを見ない別の関数にする
  const removeRow = (removed: string) =>
    setSelectedKeys((current) => current.filter((selected) => selected !== removed));
  const removeRaw = (raw: RawSelection) => {
    const id = rawNameKey(raw.name, raw.source);
    setRaws((current) => current.filter((item) => rawNameKey(item.name, item.source) !== id));
  };
  const toggleRow = (next: string) => {
    if (selectionLocked) return;
    setSelectedKeys((current) =>
      current.includes(next) ? current.filter((selected) => selected !== next) : [...current, next],
    );
  };
  const selectVisible = (keys: string[], selected: boolean) => {
    if (selectionLocked) return;
    setSelectedKeys((current) =>
      selected
        ? [...current, ...keys.filter((candidate) => !current.includes(candidate))]
        : current.filter((candidate) => !keys.includes(candidate)),
    );
  };
  const toggleRaw = (raw: RawSelection) => {
    if (selectionLocked) return;
    const id = rawNameKey(raw.name, raw.source);
    setRaws((current) =>
      current.some((item) => rawNameKey(item.name, item.source) === id)
        ? current.filter((item) => rawNameKey(item.name, item.source) !== id)
        : [...current, raw],
    );
  };
  const mergeName = () => {
    if (selectionLocked || !activeRow) return;
    const opened = activeRow.vendorKey;
    setSelectedKeys((current) => (current.includes(opened) ? current : [...current, opened]));
    setTargetFocusRequest((current) => current + 1);
  };

  return (
    <div className={`subs${selectionCount > 0 ? ' has-selection' : ''}`}>
      <Heading />
      <SubscriptionKpis kpis={data.kpis} />

      <div className="subs-context-row">
        <CoverageCard coverage={data.coverage} />
        <RefreshCard
          generatedAt={data.generatedAt}
          fetching={screen.isFetching}
          onRefetch={() => void screen.refetch()}
        />
      </div>

      <div className={`subs-layout${activeRow ? '' : ' is-detail-closed'}`}>
        <div className="subs-main">
          {data.rows.length ? (
            <SubscriptionTable
              rows={data.rows}
              kpis={data.kpis}
              activeKey={activeRow?.vendorKey ?? null}
              reviewFocusRequest={reviewFocusRequest}
              onOpen={(next) => setVendor(next === vendorKey ? null : next)}
              selectedKeys={selectedKeys}
              selectionLocked={selectionLocked}
              onToggleRow={toggleRow}
              onSelectVisible={selectVisible}
            />
          ) : (
            <section className="card subs-table-card" aria-labelledby="subs-list-title">
              <h2 id="subs-list-title">サブスク一覧</h2>
              <PageState
                status="empty"
                message="この期間にサブスクの支払いはありません"
                action={
                  <Link className="btn primary" to="/import">
                    データ取込へ
                  </Link>
                }
              />
            </section>
          )}
          <OperationList
            ref={operationsRef}
            rows={writes.rows}
            liveText={writes.liveText}
            historyFailed={writes.historyFailed}
            historyFetching={writes.historyFetching}
            onRetryHistory={writes.retryHistory}
            onRetry={writes.retry}
            onUndo={writes.undo}
          />
          <CategoryTrendChart trend={data.trend} />
          <AnnualComparison comparison={data.comparison} total={data.comparisonTotal} />
        </div>
        <div className="subs-side">
          {activeRow && (
            <DetailPanel
              ref={panelRef}
              status={detail.isError ? 'error' : detail.data ? 'ready' : 'loading'}
              detail={detail.data}
              onRetry={() => void detail.refetch()}
              vendorOptions={vendorOptions}
              exclusions={exclusions}
              selection={raws}
              selectionLocked={selectionLocked}
              onToggleRaw={toggleRaw}
              onMergeName={mergeName}
              run={writes.run}
              onRelatedVisibilityChange={setRelatedVisible}
              onClose={() => setVendor(null)}
            />
          )}
          <ReasonCard
            rows={data.rows}
            activeKey={activeRow?.vendorKey ?? null}
            onOpen={setVendor}
            onShowAll={() => setReviewFocusRequest((current) => current + 1)}
          />
        </div>
      </div>

      <SelectionBar
        rows={selectedRows}
        raws={raws}
        options={options}
        target={target}
        mergeDisabled={mergeIntent === null}
        vendorsFailed={vendorsNeeded && vendors.isError}
        targetRef={targetRef}
        onTarget={(value) => setChosenTarget(value)}
        onRetryVendors={() => void vendors.refetch()}
        onRemoveRow={removeRow}
        onRemoveRaw={removeRaw}
        onClear={() => releaseSelection({ rescueFocus: false })}
        onMerge={() => {
          if (mergeIntent) void writes.run(mergeIntent);
        }}
        onCreated={(value) => {
          setChosenTarget(value);
          setCreatedTarget(value);
        }}
        run={writes.run}
      />
    </div>
  );
}
