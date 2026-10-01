import {
  type QueryKey,
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
/**
 * サブスク画面の書き込みを 1 本の列に並べるフック (SM-FE-01)。
 *
 * 統合・取り消し・登録・判断・除外はどれも同じ revision を進めるので、同時に送ると後の要求が必ず古い base で
 * 409 になる。そこで全書き込みを scope `subscriptions-write` の mutation にし、前の操作の取り直し
 * (onSuccess の invalidate) が終わってから次を送る。本文は送る直前に最新の値から作り (SM-FE-04)、
 * busy は同じ key で 1・2・4 秒待って、revision の衝突は取り直してから新しい key で送り直す (SM-FE-05/06)。
 * 取り直しの GET が busy を返したときも、同じ待ちと回数で読み直す。
 *
 * mutation の options は積んだ時点で固定されるので、後から変わる値 (成功時の処理・その場で扱う失敗のコード) は
 * ref と variables で渡す。
 */
import { invalidateAnalysisDerived } from '../../analysis-query-invalidation.js';
import type { AuthState } from '../../api.js';
import { ApiError, api } from '../../api.js';
import { REVIEW_QUEUE_KEY } from '../../components/ReviewQueue.js';
import {
  type OperationsResponse,
  type SubVendorsResponse,
  type WriteResponse,
  getOperations,
  getSubVendors,
  sendWrite,
} from './api.js';
import { clearProgress, setProgress, useRetryProgress } from './operationProgress.js';
import { type MutationEntry, type OperationRow, operationRows } from './operationRows.js';
import {
  AUTO_RETRY_LIMIT,
  type PinnedRequest,
  WriteFailure,
  buildLocally,
  classifyWriteError,
  errorCodeOf,
  retryKindOf,
} from './operationText.js';
import type { MutationImpact, RunWrite, WriteIntent } from './types.js';
import { buildRequest, checkPrecondition, impactOf, labelOf, needsVendorList } from './writeRequests.js';

export const WRITE_KEY = ['subscriptions-write'] as const;
export const SUB_VENDORS_KEY = ['sub-vendors'] as const;
export const OPERATIONS_KEY = ['subscription-operations'] as const;

/** busy の自動再試行の待ち時間。Retry-After (120 秒) には従わない (SM-FE-06) */
const BUSY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

/** 成功後に取り直す読取モデル。操作の記録はどの書き込みでも増えるので全部に足す */
const DEFINITION_QUERY_ROOTS: readonly QueryKey[] = [
  ['subscriptions'],
  REVIEW_QUEUE_KEY,
  SUB_VENDORS_KEY,
  ['sub-candidates'],
  ['summary'],
  OPERATIONS_KEY,
];
const VENDOR_METADATA_QUERY_ROOTS: readonly QueryKey[] = [
  ['subscriptions'],
  REVIEW_QUEUE_KEY,
  SUB_VENDORS_KEY,
  OPERATIONS_KEY,
];
const AFFECTED_QUERY_ROOTS: Record<MutationImpact, readonly QueryKey[]> = {
  decision: [['subscriptions'], REVIEW_QUEUE_KEY, OPERATIONS_KEY],
  category: VENDOR_METADATA_QUERY_ROOTS,
  reviewDate: VENDOR_METADATA_QUERY_ROOTS,
  exclusion: [['subscriptions'], REVIEW_QUEUE_KEY, ['sub-candidates'], OPERATIONS_KEY],
  vendorDefinition: DEFINITION_QUERY_ROOTS,
  merge: DEFINITION_QUERY_ROOTS,
  undo: DEFINITION_QUERY_ROOTS,
};
/**
 * subs の集計 (monthly_agg の subs:* と subs_other) を置き換える影響。API の withAggregates と同じ分け方で、
 * 他画面の派生分析にも同じ名寄せを示させる。カテゴリ・見直し日・判断・除外は集計の入力を変えない
 */
const AFFECTS_TOTALS: Record<MutationImpact, boolean> = {
  decision: false,
  category: false,
  reviewDate: false,
  exclusion: false,
  vendorDefinition: true,
  merge: true,
  undo: true,
};

/** mutation に載せる値。「再試行」は同じ clientOpId で別の mutation を積み、操作の行では 1 行にまとめる */
export interface WriteVariables {
  clientOpId: number;
  intent: WriteIntent;
  inlineCodes: readonly string[];
  /** 5xx・通信の失敗・busy の上限からの「再試行」は、最後に送った key と本文をそのまま使う */
  pinned?: PinnedRequest;
  submittedAt: number;
}

/** 画面の操作の通し番号。画面をまたいで残る mutation と重ならないよう、モジュールで 1 本にする */
let nextClientOpId = 1;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const defaultNewKey = () => crypto.randomUUID();

const revisionOf = (data: unknown): number | undefined => {
  const revision = (data as { revision?: unknown } | undefined)?.revision;
  return typeof revision === 'number' ? revision : undefined;
};

export interface UseSubscriptionWritesOptions {
  /** 統合と取り消しは取り直しの前に、その他は取り直しの後に呼ぶ (?vendor= の付け替えを先に済ませる) */
  onWriteSuccess?: (intent: WriteIntent, data: WriteResponse) => void;
  /** テストで待ち時間を差し替える */
  wait?: (ms: number) => Promise<void>;
  newKey?: () => string;
}

export interface SubscriptionWrites {
  run: RunWrite;
  retry: (clientOpId: number) => void;
  undo: (operationId: string, targetName: string | null) => void;
  /** 書き込みを待機中か処理中 */
  busy: boolean;
  rows: OperationRow[];
  /** 「操作」の読み上げ。完了と失敗だけを入れる */
  liveText: string;
  historyFailed: boolean;
  historyFetching: boolean;
  retryHistory: () => void;
}

export function useSubscriptionWrites(options: UseSubscriptionWritesOptions = {}): SubscriptionWrites {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  /** 書き込みの応答で受け取った最新の revision。取り直しの前に次の操作を送るときの base に使う */
  const lastRevision = useRef<number | null>(null);
  const [liveText, setLiveText] = useState('');

  const operations = useQuery({ queryKey: OPERATIONS_KEY, queryFn: getOperations });
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });

  /** 画面が知っている最新の revision。どの読取モデルも同じ revision を返すので最大を取る */
  const currentBase = useCallback((): number | null => {
    const revisions = [
      ...queryClient.getQueriesData({ queryKey: ['subscriptions'] }).map(([, data]) => revisionOf(data)),
      revisionOf(queryClient.getQueryData(SUB_VENDORS_KEY)),
      revisionOf(queryClient.getQueryData(OPERATIONS_KEY)),
      lastRevision.current ?? undefined,
    ].filter((revision): revision is number => revision !== undefined);
    return revisions.length === 0 ? null : Math.max(...revisions);
  }, [queryClient]);

  /** 前提を検査し、最新の値から本文を作る。検査に落ちたものは送らない */
  const prepare = useCallback(
    async (intent: WriteIntent): Promise<PinnedRequest> => {
      const vendors = needsVendorList(intent)
        ? (await queryClient.ensureQueryData({ queryKey: SUB_VENDORS_KEY, queryFn: getSubVendors })).vendors
        : queryClient.getQueryData<SubVendorsResponse>(SUB_VENDORS_KEY)?.vendors;
      const records = queryClient.getQueryData<OperationsResponse>(OPERATIONS_KEY)?.operations;
      return buildLocally(() => {
        const precondition = checkPrecondition(intent, vendors, records);
        if (!precondition.ok) {
          if ('stale' in precondition) throw new WriteFailure('stale', null, precondition.stale);
          const reason = precondition.blocked;
          throw new WriteFailure(
            'request',
            new ApiError(reason === 'undo_expired' ? 410 : 409, reason, reason),
          );
        }
        const newKey = optionsRef.current.newKey ?? defaultNewKey;
        return { key: newKey(), base: currentBase(), request: buildRequest(intent, vendors) };
      });
    },
    [queryClient, currentBase],
  );

  /** revision の衝突の後、一覧と登録を取り直す。取り消しは記録も取り直して前提を検査し直す */
  const refreshAfterConflict = useCallback(
    async (intent: WriteIntent) => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['subscriptions'], type: 'active' }, { throwOnError: true }),
        queryClient.fetchQuery({ queryKey: SUB_VENDORS_KEY, queryFn: getSubVendors, staleTime: 0 }),
        intent.kind === 'unmerge'
          ? queryClient.fetchQuery({ queryKey: OPERATIONS_KEY, queryFn: getOperations, staleTime: 0 })
          : null,
      ]);
    },
    [queryClient],
  );

  const execute = useCallback(
    async ({ clientOpId, intent, pinned }: WriteVariables): Promise<WriteResponse> => {
      let current: PinnedRequest | null = pinned ?? null;
      /** revision の衝突の後、一覧の取り直しがまだ済んでいない */
      let refreshPending = false;
      let busyCount = 0;
      let revisionCount = 0;
      /** busy は 1・2・4 秒待つ。上限に達したら、「再試行」で送る要求 (読み直しの途中なら無し) を付けて諦める */
      const waitForBusy = async (error: unknown, retryWith?: PinnedRequest) => {
        if (busyCount >= AUTO_RETRY_LIMIT) throw new WriteFailure('busy', error, [], retryWith);
        busyCount += 1;
        setProgress(clientOpId, { kind: 'busy', attempt: busyCount });
        const wait = optionsRef.current.wait ?? defaultWait;
        await wait(BUSY_DELAYS_MS[busyCount - 1] ?? BUSY_DELAYS_MS[BUSY_DELAYS_MS.length - 1]);
      };
      try {
        for (;;) {
          if (current === null) {
            // 取り直しの GET も書き込みと同じ lease を見るので、busy は書き込みと同じ待ちと回数で読み直す
            try {
              if (refreshPending) await refreshAfterConflict(intent);
              refreshPending = false;
              current = await prepare(intent);
            } catch (error) {
              if (retryKindOf(error) !== 'busy') throw error;
              await waitForBusy(error);
              continue;
            }
          }
          try {
            const data = await sendWrite(current.request, current.key, current.base);
            const revision = revisionOf(data);
            if (revision !== undefined) lastRevision.current = Math.max(lastRevision.current ?? 0, revision);
            return data;
          } catch (error) {
            const kind = retryKindOf(error);
            if (kind === 'busy') {
              await waitForBusy(error, current);
              continue;
            }
            if (kind === 'revision') {
              if (revisionCount >= AUTO_RETRY_LIMIT) throw new WriteFailure('revision', error);
              revisionCount += 1;
              setProgress(clientOpId, { kind: 'revision', attempt: revisionCount });
              refreshPending = true;
              current = null;
              continue;
            }
            throw new WriteFailure('request', error, [], current);
          }
        }
      } finally {
        clearProgress(clientOpId);
      }
    },
    [prepare, refreshAfterConflict],
  );

  const mutation = useMutation<WriteResponse, unknown, WriteVariables>({
    mutationKey: WRITE_KEY,
    scope: { id: 'subscriptions-write' },
    networkMode: 'always',
    retry: 0,
    gcTime: Number.POSITIVE_INFINITY,
    mutationFn: execute,
    onSuccess: async (data, { intent }) => {
      const routeFirst = intent.kind === 'merge' || intent.kind === 'unmerge';
      if (routeFirst) optionsRef.current.onWriteSuccess?.(intent, data);
      const impact = impactOf(intent);
      // 他画面の派生分析は古い印を付けるだけで待たない (この画面に無い取得を待つと、列の次の操作が遅れる)
      if (AFFECTS_TOTALS[impact]) void invalidateAnalysisDerived(queryClient);
      // 取り直しが終わるまで次の操作を始めない (onSuccess の間、この mutation は pending のまま)
      await Promise.all(
        AFFECTED_QUERY_ROOTS[impact].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      if (!routeFirst) optionsRef.current.onWriteSuccess?.(intent, data);
      setLiveText(`${labelOf(intent)}: 完了`);
    },
    onError: (error, { intent, inlineCodes }) => {
      const code = errorCodeOf(error);
      if (code !== null && inlineCodes.includes(code)) return;
      setLiveText(`${labelOf(intent)}: 失敗。${classifyWriteError(error, intent.kind).message}`);
    },
  });
  const { mutateAsync } = mutation;

  const run = useCallback<RunWrite>(
    async (intent, runOptions) => {
      const clientOpId = nextClientOpId;
      nextClientOpId += 1;
      try {
        const data = await mutateAsync({
          clientOpId,
          intent,
          inlineCodes: runOptions?.inlineCodes ?? [],
          submittedAt: Date.now(),
        });
        return { ok: true, data };
      } catch (error) {
        return { ok: false, code: errorCodeOf(error) };
      }
    },
    [mutateAsync],
  );

  const retry = useCallback(
    (clientOpId: number) => {
      const latest = queryClient
        .getMutationCache()
        .findAll({ mutationKey: WRITE_KEY })
        .filter((item) => (item.state.variables as WriteVariables | undefined)?.clientOpId === clientOpId)
        .sort((a, b) => b.mutationId - a.mutationId)[0];
      const variables = latest?.state.variables as WriteVariables | undefined;
      if (!latest || !variables) return;
      const error = latest.state.error;
      const pinned =
        error instanceof WriteFailure && (error.reason === 'busy' || error.reason === 'request')
          ? error.pinned
          : undefined;
      mutateAsync({ ...variables, pinned, submittedAt: Date.now() }).catch(() => {
        // 失敗は操作の行と読み上げに出す
      });
    },
    [queryClient, mutateAsync],
  );

  const undo = useCallback(
    (operationId: string, targetName: string | null) => {
      void run({ kind: 'unmerge', operationId, targetName });
    },
    [run],
  );

  const busy = useIsMutating({ mutationKey: WRITE_KEY }) > 0;
  const entries = useMutationState({
    filters: { mutationKey: WRITE_KEY },
    select: (item): MutationEntry | null => {
      const variables = item.state.variables as WriteVariables | undefined;
      if (!variables || item.state.status === 'idle') return null;
      return {
        clientOpId: variables.clientOpId,
        intent: variables.intent,
        inlineCodes: variables.inlineCodes,
        status: item.state.status,
        isPaused: item.state.isPaused,
        submittedAt: variables.submittedAt,
        data: item.state.data as WriteResponse | undefined,
        error: item.state.error,
      };
    },
  });
  // サーバー履歴で同じ id を確認できた成功だけを片付ける。
  // 再試行前の失敗を残す場合、最新の成功を消すと失敗行が復活するので、その組は保持する。
  useEffect(() => {
    if (!operations.data) return;
    const recordIds = new Set(operations.data.operations.map((record) => record.id));
    const cache = queryClient.getMutationCache();
    const mutations = cache.findAll({ mutationKey: WRITE_KEY });
    const unsettled = new Set(
      entries.flatMap((entry) => (entry && entry.status !== 'success' ? [entry.clientOpId] : [])),
    );
    for (const item of mutations) {
      const variables = item.state.variables as WriteVariables | undefined;
      const data = item.state.data as WriteResponse | undefined;
      if (
        item.state.status === 'success' &&
        variables &&
        !unsettled.has(variables.clientOpId) &&
        data?.operation &&
        recordIds.has(data.operation.id)
      )
        cache.remove(item);
    }
  }, [entries, operations.data, queryClient]);

  const progress = useRetryProgress();
  const currentEmail = auth.data?.user?.email ?? null;

  const rows = useMemo(() => {
    const mutations = entries.filter((entry): entry is MutationEntry => entry !== null);
    const pendingUndoIds = new Set(
      mutations.flatMap((entry) =>
        entry.status === 'pending' && entry.intent.kind === 'unmerge' ? [entry.intent.operationId] : [],
      ),
    );
    return operationRows({
      mutations,
      operations: operations.data?.operations ?? [],
      operationsLoaded: operations.data !== undefined,
      progress,
      currentEmail,
      pendingUndoIds,
    });
  }, [entries, operations.data, progress, currentEmail]);

  return {
    run,
    retry,
    undo,
    busy,
    rows,
    liveText,
    historyFailed: operations.isError,
    historyFetching: operations.isFetching,
    retryHistory: () => void operations.refetch(),
  };
}
