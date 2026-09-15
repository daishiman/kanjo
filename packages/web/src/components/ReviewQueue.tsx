/**
 * 未処理キューの共通状態とサイドバー表示。
 *
 * 3 か所は必ず useReviewQueue (queryKey ['review-queue']) の同じ結果を読む。
 * 部品ごとに数え方を持つと、月次クローズで「残っているのに終わった」と誤認するため。
 * キーに期間を含めないのは、件数が全期間の未処理であり、期間の切替で変わってはいけないから。
 */
import { useQuery } from '@tanstack/react-query';
import { type ReviewItemKind, type ReviewQueueResponse, api } from '../api.js';

export const REVIEW_QUEUE_KEY = ['review-queue'] as const;

export const REVIEW_KIND_LABEL: Record<ReviewItemKind, string> = {
  classification: '仕分けの確認',
  reconciliation: '照合の確認',
  import: '取込の確認',
};

/** 右パネルから 1 操作で移る先。種別ごとに直す場所は 1 つに決まる */
export const REVIEW_KIND_PATH: Record<ReviewItemKind, string> = {
  classification: '/classify',
  reconciliation: '/analysis/reconciliation',
  import: '/import',
};

export const REVIEW_KIND_ORDER: readonly ReviewItemKind[] = ['classification', 'reconciliation', 'import'];

export function useReviewQueue({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: REVIEW_QUEUE_KEY,
    queryFn: () => api<ReviewQueueResponse>('/review-queue'),
    enabled,
  });
}

/** 件数の読み上げ文。0 件は「未処理 0 件」より終わったことが伝わる言い方にする */
export const reviewTotalText = (total: number): string => (total === 0 ? '未処理なし' : `未処理 ${total} 件`);

/** サイドバーの件数。読み上げでは「未処理 N 件」と単位まで伝える */
export function ReviewCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="nav-badge">
      <span className="visually-hidden">未処理 </span>
      {count}
      <span className="visually-hidden"> 件</span>
    </span>
  );
}
