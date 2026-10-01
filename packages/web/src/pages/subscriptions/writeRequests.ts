/**
 * 積んだ操作 (intent) と最新の値から、送る要求と前提の検査を作る純関数。
 * 押した時点の本文を積むと、前の操作の反映を知らない古い本文で上書きしてしまう (対象科目の連続の足し外しなど)。
 * そこで本文は mutationFn が送る直前に、取り直した登録の一覧へ intent を当てて作る (SM-FE-04)。
 *
 * 前提の検査は「送っても失敗が分かっている要求」を省くためのもので、最終の判断は API が行う。
 */
import type { SubscriptionVendorDetail } from '@kanjo/core';
import type { SubVendorRow } from '../../api.js';
import type { OperationRecord, WriteRequest } from './api.js';
import { operationLabel } from './operationText.js';
import type { MutationImpact, OperationLabelKind, VendorChange, WriteIntent } from './types.js';

/** 登録内容の変更 1 件の intent。登録の一覧をまだ読んでいなければ、詳細の関連データから本文を作る */
export function vendorUpdateIntent(
  detail: Pick<SubscriptionVendorDetail, 'row' | 'related'>,
  vendorId: number,
  change: VendorChange,
): Extract<WriteIntent, { kind: 'vendor_update' }> {
  return {
    kind: 'vendor_update',
    vendorId,
    vendorName: detail.row.normalizedName,
    change,
    fallback: { aliases: detail.related?.aliases ?? [], accounts: detail.related?.accounts ?? [] },
  };
}

/** 操作の行と操作の記録で使う種類。別名の追加は「登録内容の変更」として出す */
export const labelKindOf = (intent: WriteIntent): OperationLabelKind =>
  intent.kind === 'vendor_aliases_add' ? 'vendor_update' : intent.kind;

export const labelOf = (intent: WriteIntent): string =>
  operationLabel(
    labelKindOf(intent),
    intent.kind === 'merge' || intent.kind === 'unmerge' ? intent.targetName : null,
  );

/** 成功後に取り直す範囲。カテゴリだけの変更は候補を、見直し日の記録は一覧の候補を動かさない */
export function impactOf(intent: WriteIntent): MutationImpact {
  switch (intent.kind) {
    case 'merge':
      return 'merge';
    case 'unmerge':
      return 'undo';
    case 'vendor_update':
      return intent.change.field === 'category' ? 'category' : 'vendorDefinition';
    case 'review':
      return 'reviewDate';
    case 'review_decision':
      return 'decision';
    case 'exclusion':
      return 'exclusion';
    default:
      return 'vendorDefinition';
  }
}

/** 足し外しは最新の配列に当てる。同じ値を二度足さず、無い値の除去はそのまま */
function applyListChange(current: readonly string[], op: 'add' | 'remove', value: string): string[] {
  if (op === 'add') return current.includes(value) ? [...current] : [...current, value];
  return current.filter((item) => item !== value);
}

function vendorPatch(change: VendorChange, vendor: { aliases: string[]; accounts: string[] }) {
  switch (change.field) {
    case 'name':
      return { name: change.value };
    case 'category':
      return { category: change.value };
    case 'accounts':
      return { accounts: applyListChange(vendor.accounts, change.op, change.value) };
    case 'aliases':
      return { aliases: applyListChange(vendor.aliases, change.op, change.value) };
  }
}

const findVendor = (vendors: readonly SubVendorRow[] | undefined, id: number) =>
  vendors?.find((vendor) => vendor.id === id);

/** intent を、送る直前の登録の一覧に当てて要求にする。一覧が無ければ詳細の関連データを使う */
export function buildRequest(
  intent: WriteIntent,
  vendors: readonly SubVendorRow[] | undefined,
): WriteRequest {
  switch (intent.kind) {
    case 'merge':
      return {
        path: '/sub-vendors/merge',
        method: 'POST',
        body: {
          targetId: intent.targetId,
          sourceVendorIds: intent.sourceVendorIds,
          rawNames: intent.rawNames,
        },
      };
    case 'unmerge':
      return {
        path: `/subscription-operations/${encodeURIComponent(intent.operationId)}/undo`,
        method: 'POST',
        body: {},
      };
    case 'vendor_create':
      return { path: '/sub-vendors', method: 'POST', body: { name: intent.name, aliases: [], accounts: [] } };
    case 'vendor_update': {
      const latest = findVendor(vendors, intent.vendorId);
      const base = latest ? { aliases: latest.aliases, accounts: latest.accounts ?? [] } : intent.fallback;
      return {
        path: `/sub-vendors/${intent.vendorId}`,
        method: 'PUT',
        body: vendorPatch(intent.change, base),
      };
    }
    case 'vendor_aliases_add':
      return {
        path: `/sub-vendors/${intent.vendorId}/aliases`,
        method: 'POST',
        body: { aliases: intent.aliases },
      };
    case 'vendor_delete':
      return { path: `/sub-vendors/${intent.vendorId}`, method: 'DELETE', body: {} };
    case 'review':
      return { path: `/sub-vendors/${intent.vendorId}/review`, method: 'POST', body: {} };
    case 'review_decision':
      return intent.decision === null
        ? { path: intent.path, method: 'DELETE', body: { vendorKey: intent.vendorKey } }
        : {
            path: intent.path,
            method: 'POST',
            body: { vendorKey: intent.vendorKey, decision: intent.decision },
          };
    case 'exclusion':
      return intent.exclusionId === undefined
        ? { path: '/sub-vendors/exclusions', method: 'POST', body: { partner: intent.partner } }
        : { path: `/sub-vendors/exclusions/${intent.exclusionId}`, method: 'DELETE', body: {} };
  }
}

/** 統合先・統合元の検査に、登録の一覧を必ず要る種類 (無ければ取りに行く) */
export const needsVendorList = (intent: WriteIntent) => intent.kind === 'merge';

/**
 * 前提の検査の結果。
 * - stale: 対象が他の操作で消えたか統合された。names を文言に入れ、送らずに失敗にする
 * - blocked: 取り消せない統合。API と同じコードで失敗にし、理由の文言を出す
 */
export type Precondition = { ok: true } | { ok: false; stale: string[] } | { ok: false; blocked: string };

const isLive = (vendors: readonly SubVendorRow[], id: number) => {
  const vendor = findVendor(vendors, id);
  return vendor !== undefined && vendor.mergedIntoId === null;
};

export function checkPrecondition(
  intent: WriteIntent,
  vendors: readonly SubVendorRow[] | undefined,
  operations: readonly OperationRecord[] | undefined,
): Precondition {
  switch (intent.kind) {
    case 'merge': {
      if (!vendors) return { ok: true };
      const broken = [intent.targetId, ...intent.sourceVendorIds]
        .filter((id) => !isLive(vendors, id))
        .map((id) => intent.names[String(id)] ?? (id === intent.targetId ? intent.targetName : String(id)));
      return broken.length === 0 ? { ok: true } : { ok: false, stale: broken };
    }
    case 'unmerge': {
      const record = operations?.find((operation) => operation.id === intent.operationId);
      if (!record || record.undoable || record.undoBlockedReason === null) return { ok: true };
      return { ok: false, blocked: record.undoBlockedReason };
    }
    case 'vendor_update':
    case 'vendor_aliases_add':
    case 'vendor_delete':
    case 'review':
      // 登録の一覧を読んでいない画面では検査しない (検査のためだけに取りに行かず、API の 404 と 409 に任せる)
      if (!vendors || isLive(vendors, intent.vendorId)) return { ok: true };
      return { ok: false, stale: [intent.vendorName] };
    default:
      return { ok: true };
  }
}
