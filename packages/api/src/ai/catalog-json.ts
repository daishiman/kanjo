/**
 * 図表カタログと本文規則を Skill 側(validate-report.py)へ渡す JSON の中身。
 * 書き出しは scripts/export-chart-catalog.mts、同期の確認は catalog.test.ts。
 */
import { CHART_CATALOG, MAX_SERIES, MONTHLY_LIMIT } from './catalog.js';
import { FINDING_KEYS, SECTION_IDS, SECTION_MIN_ITEMS, TEXT_LIMITS } from './contract.js';

export const CATALOG_JSON_RELATIVE = 'skills/run-kanjo-accounting-report/references/chart-catalog.json';

export function catalogJson(): string {
  return `${JSON.stringify(
    {
      $comment:
        'pnpm catalog:export が packages/api/src/ai/catalog.ts と contract.ts から生成。手で編集しない(テストで同期を確認)',
      monthlyLimit: MONTHLY_LIMIT,
      maxSeries: MAX_SERIES,
      textLimits: TEXT_LIMITS,
      sectionIds: SECTION_IDS,
      sectionMinItems: SECTION_MIN_ITEMS,
      findingKeys: FINDING_KEYS,
      charts: CHART_CATALOG,
    },
    null,
    2,
  )}\n`;
}
