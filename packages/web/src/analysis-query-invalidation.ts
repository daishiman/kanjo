import type { QueryClient } from '@tanstack/react-query';
import { ANALYSIS_HUB_QUERY_ROOT } from './routeMetadata.js';

export const RECONCILIATION_QUERY_ROOT = ['reconciliation'] as const;

/**
 * 分類・分割・予算など、支出分析の入力を変える保存処理から呼ぶ共通境界。
 * 個別画面が query key を列挙するとハブだけ更新し忘れるため、派生分析の母数を1か所に置く。
 */
export const ANALYSIS_DERIVED_QUERY_ROOTS = [
  ANALYSIS_HUB_QUERY_ROOT,
  RECONCILIATION_QUERY_ROOT,
  ['total-cashflow'],
  ['matrix'],
  ['trends'],
  ['diagnosis'],
  ['tradeoff'],
] as const;

export function invalidateAnalysisDerived(client: QueryClient): Promise<unknown[]> {
  return Promise.all(ANALYSIS_DERIVED_QUERY_ROOTS.map((queryKey) => client.invalidateQueries({ queryKey })));
}

/** 総収支の重複判断のように、既存詳細画面は自分で更新済みでハブだけを更新する操作用。 */
export function invalidateAnalysisHub(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: ANALYSIS_HUB_QUERY_ROOT });
}
