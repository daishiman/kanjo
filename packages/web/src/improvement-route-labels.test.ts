/**
 * 改善リクエストの「関連ページ」の画面名は core の IMPROVEMENT_ROUTE_LABELS が決める。
 * core は web を参照できないので写しを持つ (docs/improvement-screen/design-decisions.md の OI-05)。
 * 写しが routeMetadata.ts の label とずれたら、ここで落とす。
 */
import { IMPROVEMENT_ROUTE_LABELS, improvementRouteLabel } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { ANALYSIS_TABS, APP_ROUTES } from './routeMetadata.js';

const routed = [...APP_ROUTES, ...ANALYSIS_TABS].map((r) => [r.path, r.label] as const);

describe('改善リクエストの画面名の表 (core) と routeMetadata の一致', () => {
  it('routeMetadata の全経路が core の表と同じ画面名になる', () => {
    expect(routed.map(([path]) => [path, improvementRouteLabel(path)])).toEqual(routed);
  });

  it('core の表にだけある経路は、共通ナビに出ない /improvement だけである', () => {
    const paths = new Set<string>(routed.map(([path]) => path));
    expect(Object.keys(IMPROVEMENT_ROUTE_LABELS).filter((p) => !paths.has(p))).toEqual(['/improvement']);
  });
});
