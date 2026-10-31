/**
 * 選択バーの統合先と、統合の intent を選択から導く純関数 (FR-003 / AC-008)。
 * 選択は画面 (Subscriptions) が持ち、ここは「何を選べるか」「何を送るか」だけを決める。
 */
import { type SubscriptionRow, defaultMergeTarget } from '@kanjo/core';
import type { SubVendorRow } from '../../api.js';
import type { RawSelection, WriteIntent } from './types.js';

export interface TargetOption {
  /** vendorId の文字列。'' は「まだ選んでいない」 */
  value: string;
  label: string;
}

export const NO_TARGET: TargetOption = { value: '', label: '登録済みのサブスクを選ぶ' };

const isMerged = (vendors: readonly SubVendorRow[], id: number) =>
  vendors.some((vendor) => vendor.id === id && vendor.mergedIntoId !== null);

/**
 * 統合先の選択肢。選択中の登録済みの行を選んだ順に先に並べ、その他の登録を名前順に続ける。
 * 他の登録へ統合済みのものは統合先になれないので除く。
 */
export function mergeTargetOptions(
  selectedRows: readonly SubscriptionRow[],
  vendors: readonly SubVendorRow[],
): TargetOption[] {
  const selected = selectedRows.flatMap((row) =>
    row.vendorId !== null && !isMerged(vendors, row.vendorId)
      ? [{ value: String(row.vendorId), label: row.displayName }]
      : [],
  );
  const taken = new Set(selected.map((option) => option.value));
  const others = vendors
    .filter((vendor) => vendor.mergedIntoId === null && !taken.has(String(vendor.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((vendor) => ({ value: String(vendor.id), label: vendor.name }));
  return [NO_TARGET, ...selected, ...others];
}

/** 実際に使う統合先。選び直した値が選択肢に残っていればそれを、無ければ既定 (推定月額が最大の登録済み) を使う */
export function resolveMergeTarget(
  chosen: string | null,
  options: readonly TargetOption[],
  selectedRows: readonly SubscriptionRow[],
): string {
  if (chosen !== null && options.some((option) => option.value === chosen)) return chosen;
  const key = defaultMergeTarget(selectedRows);
  const vendorId = selectedRows.find((row) => row.vendorKey === key)?.vendorId;
  const value = vendorId === undefined || vendorId === null ? '' : String(vendorId);
  return options.some((option) => option.value === value) ? value : '';
}

/**
 * 統合の intent。統合元は選択中の登録済みの行のうち統合先以外、取引名は選んだ取引名と未登録の行の正規化名。
 * 統合先が空か、統合するものが 1 件も無ければ null (統合のボタンを押せない)。
 */
export function mergeIntentOf({
  target,
  options,
  selectedRows,
  raws,
  listRows,
}: {
  target: string;
  options: readonly TargetOption[];
  selectedRows: readonly SubscriptionRow[];
  raws: readonly RawSelection[];
  /** 一覧のすべての行。統合先の行 (成功後に ?vendor= を付け替える先) を引く */
  listRows: readonly SubscriptionRow[];
}): Extract<WriteIntent, { kind: 'merge' }> | null {
  if (target === '') return null;
  const targetId = Number(target);
  const targetName = options.find((option) => option.value === target)?.label ?? '';
  const sources = selectedRows.filter((row) => row.vendorId !== targetId);
  const sourceVendorIds = sources.flatMap((row) => (row.vendorId === null ? [] : [row.vendorId]));
  const rawNames = [
    ...new Set([
      ...sources.filter((row) => row.vendorId === null).map((row) => row.normalizedName),
      ...raws.map((raw) => raw.name),
    ]),
  ];
  if (sourceVendorIds.length === 0 && rawNames.length === 0) return null;
  const names: Record<string, string> = { [target]: targetName };
  for (const row of sources) if (row.vendorId !== null) names[String(row.vendorId)] = row.displayName;
  return {
    kind: 'merge',
    targetId,
    targetName,
    targetKey: listRows.find((row) => row.vendorId === targetId)?.vendorKey ?? null,
    sourceVendorIds,
    sourceKeys: sources.map((row) => row.vendorKey),
    rawNames,
    names,
  };
}
