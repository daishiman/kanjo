import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_DERIVED_QUERY_ROOTS,
  invalidateAnalysisDerived,
  invalidateAnalysisHub,
} from './analysis-query-invalidation.js';
import { ANALYSIS_HUB_QUERY_ROOT } from './routeMetadata.js';

describe('分析クエリの再集計境界', () => {
  it('分類・分割・予算の保存後はハブを含む全派生分析を無効化する', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    await invalidateAnalysisDerived(client);

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(ANALYSIS_DERIVED_QUERY_ROOTS);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANALYSIS_HUB_QUERY_ROOT });
  });

  it('総収支の重複判断後はハブだけを無効化できる', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();

    await invalidateAnalysisHub(client);

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANALYSIS_HUB_QUERY_ROOT });
  });
});
