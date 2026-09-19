/**
 * サブスク (整える > サブスク)。毎月の固定費に重複や見直し候補があるかを、一覧 → 詳細 → 判断の順に片付ける。
 * 数値の定義はすべて core の subscriptionsScreen / subscriptionVendorDetail にあり、この画面は並べて操作を送るだけ。
 */
import type { SubscriptionVendorDetail, SubscriptionsScreen } from '@kanjo/core';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button } from '../components/Button.js';
import { KpiCard, PageHeader, PageState, describeError } from '../components/Page.js';
import { REVIEW_QUEUE_KEY } from '../components/ReviewQueue.js';
import { UiIcon } from '../components/UiIcon.js';
import { usePeriod } from '../period.js';
import { AnnualComparison } from './subscriptions/AnnualComparison.js';
import { CategoryTrendChart } from './subscriptions/CategoryTrendChart.js';
import { CoverageCard, RefreshCard } from './subscriptions/CoverageCard.js';
import { DetailPanel } from './subscriptions/DetailPanel.js';
import { SubscriptionKpis } from './subscriptions/Kpis.js';
import { ReasonCard } from './subscriptions/ReasonCard.js';
import { SelectionBar } from './subscriptions/SelectionBar.js';
import { SubscriptionTable } from './subscriptions/SubscriptionTable.js';
import {
  type SubCandidatesResponse,
  type SubVendorsResponse,
  postSubVendor,
  postSubVendorAliases,
} from './subscriptions/api.js';
import { rawNameKey } from './subscriptions/format.js';
import type {
  CreateMergeTarget,
  ExclusionsState,
  LookupStatus,
  MutationImpact,
  RawSelection,
  RunAction,
  VendorOptionsState,
} from './subscriptions/types.js';
import './subscriptions/subscriptions.css';

const QUESTION = '毎月の固定費に、重複や見直し候補はありますか？';
const DESCRIPTION =
  '銀行・カード・電子マネーの取引データから、継続的な支払い（サブスク）を検出しています。不要な支出の見直しで、家計をすっきりさせましょう。';
const NARROW_QUERY = '(max-width: 1023px)';

/** mutation が実際に変える読取モデル。全操作で同じ query を取り直さない。 */
const AFFECTED_QUERY_ROOTS: Record<MutationImpact, readonly QueryKey[]> = {
  decision: [['subscriptions'], REVIEW_QUEUE_KEY],
  category: [['subscriptions'], REVIEW_QUEUE_KEY, ['sub-vendors']],
  reviewDate: [['subscriptions'], REVIEW_QUEUE_KEY, ['sub-vendors']],
  exclusion: [['subscriptions'], REVIEW_QUEUE_KEY, ['sub-candidates']],
  vendorDefinition: [['subscriptions'], REVIEW_QUEUE_KEY, ['sub-vendors'], ['sub-candidates'], ['summary']],
};

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
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const vendorKey = params.get('vendor');
  const [selection, setSelection] = useState<RawSelection[]>([]);
  const [chosenTarget, setChosenTarget] = useState<number | null>(null);
  const [relatedVisible, setRelatedVisible] = useState(false);
  const [reviewFocusRequest, setReviewFocusRequest] = useState(0);
  const [failure, setFailure] = useState<{ error: unknown; retry: () => void } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const screen = useQuery({
    queryKey: ['subscriptions', key],
    queryFn: () => api<SubscriptionsScreen>(withPeriod('/subscriptions')),
  });
  const rows = screen.data?.rows ?? [];
  const activeRow = vendorKey ? rows.find((row) => row.vendorKey === vendorKey) : undefined;
  const detail = useQuery({
    queryKey: ['subscriptions', key, 'vendor', vendorKey],
    queryFn: () =>
      api<SubscriptionVendorDetail>(
        withPeriod(`/subscriptions/vendors/${encodeURIComponent(vendorKey ?? '')}`),
      ),
    enabled: Boolean(activeRow),
  });
  const vendorsNeeded = Boolean(activeRow && (activeRow.status === 'unregistered' || relatedVisible));
  const vendors = useQuery({
    queryKey: ['sub-vendors'],
    queryFn: () => api<SubVendorsResponse>('/sub-vendors'),
    enabled: vendorsNeeded,
  });
  const exclusionsNeeded = Boolean(activeRow && relatedVisible);
  const candidates = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () => api<SubCandidatesResponse>('/sub-vendors/candidates'),
    enabled: exclusionsNeeded,
  });
  const vendorOptions: VendorOptionsState = {
    status: lookupStatus(vendorsNeeded, vendors.isError, vendors.data !== undefined),
    vendors: vendors.data?.vendors ?? [],
    accountOptions: vendors.data?.accountOptions ?? [],
    retry: () => void vendors.refetch(),
  };
  const exclusions: ExclusionsState = {
    status: lookupStatus(exclusionsNeeded, candidates.isError, candidates.data !== undefined),
    items: candidates.data?.excluded ?? [],
    retry: () => void candidates.refetch(),
  };

  const mutation = useMutation({
    mutationFn: ({ send }: { send: () => Promise<unknown>; impact: MutationImpact }) => send(),
    onMutate: () => setFailure(null),
    onSuccess: (_result, { impact }) =>
      Promise.all(AFFECTED_QUERY_ROOTS[impact].map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
  // 失敗は上部の通知に出し、画面の値は戻さない (楽観更新をしないので戻す値も無い。spec §11)
  const run: RunAction = async (send, impact) => {
    try {
      await mutation.mutateAsync({ send, impact });
      return true;
    } catch (error) {
      setFailure({ error, retry: () => void run(send, impact) });
      return false;
    }
  };

  const setVendor = (next: string | null) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next) copy.set('vendor', next);
        else copy.delete('vendor');
        return copy;
      },
      { replace: true },
    );
    // 生の取引名の選択と統合先は、開いている 1 件のサブスクに属する
    setSelection([]);
    setChosenTarget(null);
    setRelatedVisible(false);
  };

  // URL の vendor が期間内に無い (期間を変えた・解除した) ときは、パネルを閉じて URL からも消す
  const staleVendor = Boolean(screen.data && vendorKey && !activeRow);
  useEffect(() => {
    if (!staleVendor) return;
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.delete('vendor');
        return copy;
      },
      { replace: true },
    );
    setSelection([]);
    setChosenTarget(null);
    setRelatedVisible(false);
  }, [staleVendor, setParams]);

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
  const busy = mutation.isPending;
  const mergeTargetId = activeRow?.status === 'registered' ? (detail.data?.vendorId ?? null) : chosenTarget;
  const toggleRaw = (raw: RawSelection) =>
    setSelection((current) => {
      const id = rawNameKey(raw.name, raw.source);
      return current.some((item) => rawNameKey(item.name, item.source) === id)
        ? current.filter((item) => rawNameKey(item.name, item.source) !== id)
        : [...current, raw];
    });
  const merge = async () => {
    if (mergeTargetId === null || !selection.length) return;
    const names = [...new Set(selection.map((raw) => raw.name))];
    if (await run(() => postSubVendorAliases(mergeTargetId, names), 'vendorDefinition')) {
      setSelection([]);
    }
  };
  const createMergeTarget: CreateMergeTarget = async (name) => {
    const created = await mutation.mutateAsync({
      send: () => postSubVendor(name),
      impact: 'vendorDefinition',
    });
    if (
      typeof created !== 'object' ||
      created === null ||
      !('id' in created) ||
      !Number.isInteger(created.id)
    ) {
      throw new Error('統合先の登録結果を確認できませんでした。');
    }
    return { ok: true, id: created.id as number };
  };

  return (
    <div className="subs">
      <Heading />
      {failure && (
        <div className="subs-message is-error" role="alert">
          <p>{describeError(failure.error)}</p>
          <Button onClick={failure.retry} disabled={busy}>
            <UiIcon name="refresh" aria-hidden="true" />
            再試行する
          </Button>
        </div>
      )}
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
              selection={selection}
              onToggleRaw={toggleRaw}
              mergeTargetId={mergeTargetId}
              onMergeTarget={setChosenTarget}
              onCreateMergeTarget={createMergeTarget}
              run={run}
              busy={busy}
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
        selection={selection}
        busy={busy}
        canMerge={mergeTargetId !== null}
        onRemove={toggleRaw}
        onClear={() => setSelection([])}
        onMerge={() => void merge()}
      />
    </div>
  );
}
