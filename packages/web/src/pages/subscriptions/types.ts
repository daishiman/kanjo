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
