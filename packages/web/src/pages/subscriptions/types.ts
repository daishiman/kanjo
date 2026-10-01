import type { AccountKind, SubsReviewDecisionKind } from '@kanjo/core';
import type { SubVendorExclusionRow, SubVendorRow } from '../../api.js';
import type { WriteResponse } from './api.js';

/** 名称統合のために選んだ、ソース付きの生の取引名。 */
export interface RawSelection {
  name: string;
  source: AccountKind;
}

/**
 * 更新が影響する範囲。成功後に取り直す query の根をここから引く (AFFECTED_QUERY_ROOTS)。
 * merge / undo は一覧・登録・候補・合計のすべてを動かす。
 */
export type MutationImpact =
  | 'decision'
  | 'vendorDefinition'
  | 'category'
  | 'reviewDate'
  | 'exclusion'
  | 'merge'
  | 'undo';

/** 操作の行に出す名前 (操作の記録の kind と同じ言い換え) */
export type OperationLabelKind = import('@kanjo/core').SubscriptionOperationKind;

/** 登録内容の変更 1 件。本文は送る直前に、最新の登録へこの変更を当てて作る (SM-FE-04) */
export type VendorChange =
  | { field: 'name'; value: string }
  | { field: 'category'; value: string | null }
  | { field: 'accounts'; op: 'add' | 'remove'; value: string }
  | { field: 'aliases'; op: 'remove'; value: string };

/**
 * 積む操作 1 件。送る本文そのものではなく「何をしたいか」を持ち、
 * 前の操作が反映された後の最新の値から本文を作る。統合元の名前は、前提が崩れたときの文言に使う。
 */
export type WriteIntent =
  | {
      kind: 'merge';
      targetId: number;
      targetName: string;
      /** 統合先の一覧の行。成功後に ?vendor= を付け替える先。一覧に無い統合先は null */
      targetKey: string | null;
      /** 選んだ順。統合先は含めない */
      sourceVendorIds: number[];
      sourceKeys: string[];
      /** 重複なし。未登録の行は正規化名 */
      rawNames: string[];
      /** vendorId → 選んだ時点の名前 */
      names: Record<string, string>;
    }
  | { kind: 'unmerge'; operationId: string; targetName: string | null }
  | { kind: 'vendor_create'; name: string }
  | {
      kind: 'vendor_update';
      vendorId: number;
      vendorName: string;
      change: VendorChange;
      /** 登録の一覧をまだ読んでいないときに使う、詳細の関連データ */
      fallback: { aliases: string[]; accounts: string[] };
    }
  | { kind: 'vendor_aliases_add'; vendorId: number; vendorName: string; aliases: string[] }
  | { kind: 'vendor_delete'; vendorId: number; vendorName: string }
  | { kind: 'review'; vendorId: number; vendorName: string }
  | {
      kind: 'review_decision';
      vendorKey: string;
      /** null は判断の取り消し */
      decision: SubsReviewDecisionKind | null;
      /** 指紋をサーバが表示中と同じ期間で求めるよう、期間付きの path を積む時点で決める */
      path: string;
    }
  | { kind: 'exclusion'; partner: string; exclusionId?: number };

export type IntentKind = WriteIntent['kind'];

export interface RunOptions {
  /** 呼び出し側がその場で見せる失敗のコード (重複など)。操作の行と読み上げには出さない */
  inlineCodes?: readonly string[];
}

export type RunOutcome = { ok: true; data: WriteResponse } | { ok: false; code: string | null };

/** 書き込みを 1 件積む。前の操作が終わるまで待ち、結果で解決する (失敗でも reject しない) */
export type RunWrite = (intent: WriteIntent, options?: RunOptions) => Promise<RunOutcome>;

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
