import type { AccountKind } from '@kanjo/core';
import type { SubVendorExclusionRow, SubVendorRow } from '../../api.js';

/** 名称統合のために選んだ、ソース付きの生の取引名。 */
export interface RawSelection {
  name: string;
  source: AccountKind;
}

export type MutationImpact = 'decision' | 'vendorDefinition' | 'category' | 'reviewDate' | 'exclusion';

/** 更新系の実行境界。通知と影響範囲別の query invalidation は画面側が担う。 */
export type RunAction = (send: () => Promise<unknown>, impact: MutationImpact) => Promise<boolean>;

/** 未登録候補の詳細から統合先マスタを1件作る。登録後の選択にIDが必要なため作成応答を返す。 */
export type CreateMergeTarget = (name: string) => Promise<{ ok: true; id: number }>;

export type LookupStatus = 'idle' | 'loading' | 'error' | 'ready';

export interface VendorOptionsState {
  status: LookupStatus;
  vendors: SubVendorRow[];
  accountOptions: string[];
  retry: () => void;
}

export interface ExclusionsState {
  status: LookupStatus;
  items: SubVendorExclusionRow[];
  retry: () => void;
}
