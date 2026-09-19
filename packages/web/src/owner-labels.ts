import {
  type OwnerKey,
  type OwnerLabels,
  ownerLabel as coreOwnerLabel,
  resolveOwnerLabels,
} from '@kanjo/core';
/**
 * 名義の表示名 (spec §6.3・§6.4)。
 *
 * 家計・設定・明細の各画面はこのフックから名義を表示する。画面ごとに写し表を持つと、
 * 保存した表示名が一部の画面にしか反映されない。
 *
 * 取得に失敗しても既定の表示名で描画を続ける。表示名は補助の設定であり、
 * それが読めないことで明細の一覧まで失敗にすると被害が大きい。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invalidateAnalysisDerived } from './analysis-query-invalidation.js';
import { api } from './api.js';

export const OWNER_LABELS_QUERY_KEY = ['owner-labels'] as const;

/** 応答が壊れていても既定へ倒す (テストの fetch モックが未対応の経路を返す場合を含む) */
function labelsOf(body: unknown): OwnerLabels {
  const labels = (body as { labels?: unknown } | null | undefined)?.labels;
  if (!labels || typeof labels !== 'object') return resolveOwnerLabels();
  return resolveOwnerLabels(labels as Partial<Record<OwnerKey, string>>);
}

export function useOwnerLabels() {
  const query = useQuery({
    queryKey: OWNER_LABELS_QUERY_KEY,
    queryFn: async () => labelsOf(await api<unknown>('/settings/owner-labels')),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const labels = query.data ?? resolveOwnerLabels();
  const ownerLabel = useCallback(
    (owner: OwnerKey | null | undefined) => coreOwnerLabel(owner, labels),
    [labels],
  );
  return { labels, ownerLabel, isLoading: query.isLoading };
}

/** 保存が成功したら、名義を表示している問い合わせをすべて作り直す */
export function useSaveOwnerLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (labels: OwnerLabels) =>
      labelsOf(
        await api<unknown>('/settings/owner-labels', {
          method: 'PUT',
          body: JSON.stringify({ labels }),
        }),
      ),
    onSuccess: (saved) => {
      qc.setQueryData(OWNER_LABELS_QUERY_KEY, saved);
      void qc.invalidateQueries({ queryKey: OWNER_LABELS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['household'] });
      void qc.invalidateQueries({ queryKey: ['classification'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void invalidateAnalysisDerived(qc);
    },
  });
}
