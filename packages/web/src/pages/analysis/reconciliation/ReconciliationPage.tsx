/**
 * 照合の作業面。一覧が master、右の取引詳細が detailで、判断待ちの差異を一件ずつ片付ける。
 * 検索語と絞り込みは取引内容を含むため URL へは渡さない。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RECONCILIATION_QUERY_ROOT,
  invalidateAnalysisDerived,
} from '../../../analysis-query-invalidation.js';
import { ApiError, api } from '../../../api.js';
import { PageState, describeError } from '../../../components/Page.js';
import { REVIEW_QUEUE_KEY } from '../../../components/ReviewQueue.js';
import { usePeriod } from '../../../period.js';
import '../reconciliation.css';
import { DetailPanel } from './DetailPanel.js';
import { FailureNotice, OperationResult } from './Feedback.js';
import { ReconciliationKpis } from './Kpis.js';
import { SelectionActions } from './SelectionActions.js';
import { ReconciliationSummaries } from './Summaries.js';
import { ReconciliationWorkspace } from './Workspace.js';
import {
  type ReconciliationActionKind,
  type ReconciliationActionResponse,
  type ReconciliationResponse,
  postReconciliationAction,
  undoReconciliationAction,
} from './api.js';
import {
  INITIAL_FILTERS,
  NARROW_QUERY,
  type OperationRequest,
  type PageSize,
  type ReconciliationFilters,
  type ReconciliationRow,
  filterRows,
  isPending,
  targetOf,
} from './model.js';

const ERROR_MESSAGES: Record<string, { message: string; retryable: boolean }> = {
  canonical_write_busy: {
    message: '取込中のため保存できませんでした。取込が終わってから、もう一度お試しください。',
    retryable: true,
  },
  action_not_latest: {
    message: 'この後に別の操作をしているため、元に戻せません。新しい操作から順に取り消してください。',
    retryable: false,
  },
  action_already_undone: { message: 'この操作はすでに元に戻しています。', retryable: false },
  action_not_found: {
    message: '取り消す操作が見つかりません。画面を再読み込みしてください。',
    retryable: false,
  },
  action_stale: {
    message: 'この操作の後に同じ明細の判断が変わったため、元に戻せません。明細ごとに判断し直してください。',
    retryable: false,
  },
  action_snapshot_invalid: {
    message: '操作の記録を読み取れないため、元に戻せません。明細ごとに判断し直してください。',
    retryable: false,
  },
  invalid_action_id: { message: '取り消す操作の指定が正しくありません。', retryable: false },
};

const describeFailure = (error: unknown) => {
  const known = error instanceof ApiError ? ERROR_MESSAGES[error.code] : undefined;
  return known ?? { message: describeError(error), retryable: true };
};

export function ReconciliationPage() {
  const { key, withPeriod } = usePeriod();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...RECONCILIATION_QUERY_ROOT, key],
    queryFn: () => api<ReconciliationResponse>(withPeriod('/reconciliation')),
  });
  const [filters, setFilters] = useState<ReconciliationFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<{
    response: ReconciliationActionResponse;
    request: OperationRequest;
  } | null>(null);
  const [failure, setFailure] = useState<{ error: unknown; retry: () => void } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const [filtersOpen] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia(NARROW_QUERY).matches,
  );

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: RECONCILIATION_QUERY_ROOT }),
      invalidateAnalysisDerived(client),
      client.invalidateQueries({ queryKey: ['summary'] }),
      client.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY }),
      client.invalidateQueries({ queryKey: ['overview'] }),
    ]);

  const operate = useMutation({
    mutationFn: (request: OperationRequest) => postReconciliationAction(request.action, request.targets),
    onMutate: () => {
      setFailure(null);
      setResult(null);
    },
    onSuccess: async (response, request) => {
      setResult({ response, request });
      if (request.targets.length > 1) setSelected(new Set());
      await refresh();
    },
    onError: (error, request) => setFailure({ error, retry: () => operate.mutate(request) }),
  });

  const undo = useMutation({
    mutationFn: (id: string) => undoReconciliationAction(id),
    onMutate: () => {
      setFailure(null);
      setResult(null);
    },
    onSuccess: () => refresh(),
    onError: (error, id) => setFailure({ error, retry: () => undo.mutate(id) }),
  });

  const data = query.data;
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const months = useMemo(() => [...new Set(rows.map((row) => row.month))].sort().reverse(), [rows]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleById = useMemo(() => new Map(visible.map((row) => [row.txId, row])), [visible]);
  const allById = useMemo(() => new Map(rows.map((row) => [row.txId, row])), [rows]);
  const fallbackActive = visible.find(isPending) ?? visible[0] ?? null;
  const active =
    activeId === null
      ? null
      : activeId === undefined
        ? fallbackActive
        : (visibleById.get(activeId) ?? fallbackActive);
  const selectedRows = [...selected]
    .map((id) => allById.get(id))
    .filter((row): row is ReconciliationRow => row !== undefined);

  useEffect(() => {
    const selectableIds = new Set(filtered.filter(isPending).map((row) => row.txId));
    setSelected((current) => {
      if ([...current].every((id) => selectableIds.has(id))) return current;
      return new Set([...current].filter((id) => selectableIds.has(id)));
    });
  }, [filtered]);

  useEffect(() => {
    if (activeId && panelRef.current && typeof panelRef.current.scrollIntoView === 'function') {
      const narrow = typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;
      if (narrow) panelRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [activeId]);

  if (query.isLoading) return <PageState status="loading" />;
  if (query.isError || !data) return <PageState status="error" error={query.error} />;
  if (!rows.length) {
    return (
      <PageState
        status="empty"
        message="照合できる取引がまだありません。"
        action={
          <Link className="btn primary" to="/import">
            freee・MFを取り込む
          </Link>
        }
      />
    );
  }

  const updateFilters = (patch: Partial<ReconciliationFilters>) => {
    const next = { ...filters, ...patch };
    const nextIds = new Set(filterRows(rows, next).map((row) => row.txId));
    setSelected((current) => new Set([...current].filter((id) => nextIds.has(id))));
    setFilters(next);
    setPage(1);
    setActiveId(undefined);
  };
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleVisible = () => {
    const visibleIds = visible.filter(isPending).map((row) => row.txId);
    const remove = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of visibleIds) remove ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const run = (action: ReconciliationActionKind, targetRows: readonly ReconciliationRow[]) =>
    operate.mutate({ action, targets: targetRows.map((row) => targetOf(row, action)) });
  const showSummary = (patch: Partial<ReconciliationFilters>) => {
    updateFilters(patch);
    listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const busy = operate.isPending || undo.isPending;
  const failureView = failure ? describeFailure(failure.error) : null;
  const actionRequiredCount = data.kpi.actionRequiredCount;
  const reviewRows = rows.filter((row) => row.status === 'review');

  return (
    <div className="recon">
      <ReconciliationKpis kpi={data.kpi} />
      {failure && failureView && (
        <FailureNotice
          message={failureView.message}
          retryable={failureView.retryable}
          busy={busy}
          onRetry={failure.retry}
        />
      )}
      {result && <OperationResult response={result.response} action={result.request.action} />}

      <div className={`recon-workspace${active ? '' : ' is-detail-closed'}`}>
        <ReconciliationWorkspace
          ref={listRef}
          data={data}
          filters={filters}
          filtersOpen={filtersOpen}
          months={months}
          filtered={filtered}
          visible={visible}
          active={active}
          selected={selected}
          actionRequiredCount={actionRequiredCount}
          currentPage={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          onFilters={updateFilters}
          onPage={(nextPage) => {
            setPage(nextPage);
            setActiveId(filtered[(nextPage - 1) * pageSize]?.txId);
          }}
          onPageSize={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
            setActiveId(filtered[0]?.txId);
          }}
          onToggleSelected={toggleSelected}
          onToggleVisible={toggleVisible}
          onOpen={setActiveId}
        />
        {active && (
          <DetailPanel
            ref={panelRef}
            row={active}
            lastAction={data.lastAction}
            busy={busy}
            onClose={() => setActiveId(null)}
            onAction={(action) => run(action, [active])}
            onUndo={(id) => undo.mutate(id)}
          />
        )}
      </div>

      <ReconciliationSummaries
        mfOnlyRows={data.mfOnly}
        reviewRows={reviewRows}
        onShowMfOnly={() => showSummary({ candidate: 'withoutCandidate', status: 'mfOnly', queue: null })}
        onShowReview={() => showSummary({ candidate: 'withCandidate', status: 'review', queue: null })}
      />

      <SelectionActions
        selectedRows={selectedRows}
        busy={busy}
        onClear={() => setSelected(new Set())}
        onRun={run}
      />
    </div>
  );
}
