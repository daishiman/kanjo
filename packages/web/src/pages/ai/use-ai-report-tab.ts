/**
 * レポートのタブを URL で持つ (spec-ai-analysis-screen FR-9)。
 *
 * 依頼の詳細とレポート詳細が同じ読み書きを必要とするので 1 か所にする。
 * 既定の「要約」は `?tab=` を付けない (共有した URL を短く保つ)。
 */
import type { AiReportTab } from '@kanjo/core';
import { useSearchParams } from 'react-router-dom';
import { readAiUrl } from './view-model.js';

export function useAiReportTab(): { tab: AiReportTab; setTab: (next: AiReportTab) => void } {
  const [params, setParams] = useSearchParams();
  return {
    tab: readAiUrl(params).tab,
    setTab: (next) => {
      const updated = new URLSearchParams(params);
      if (next === 'summary') updated.delete('tab');
      else updated.set('tab', next);
      setParams(updated, { replace: true });
    },
  };
}
