/**
 * 選択バーの統合先と統合の intent (FR-003 / AC-008)。
 * 統合済みの登録を統合先に出すと、統合した統合元が一覧に残る不具合 (?vendor=aquavoice) を画面から作れてしまうので、
 * 選択肢から除くことと、統合先そのものを統合元に入れないことを押さえる。
 */
import type { SubscriptionRow } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import type { SubVendorRow } from '../../api.js';
import { NO_TARGET, mergeIntentOf, mergeTargetOptions, resolveMergeTarget } from './selection.js';

const row = (
  vendorKey: string,
  displayName: string,
  vendorId: number | null,
  estimatedMonthly = 1_000,
): SubscriptionRow => ({
  vendorKey,
  vendorId,
  status: vendorId === null ? 'unregistered' : 'registered',
  displayName,
  normalizedName: displayName.toUpperCase(),
  matchedNameCount: 1,
  latestAmount: estimatedMonthly,
  estimatedMonthly,
  annualized: estimatedMonthly * 12,
  billing: 'monthly',
  active: true,
  category: 'その他',
  categorySource: 'dictionary',
  review: null,
});

const vendor = (id: number, name: string, mergedIntoId: number | null = null): SubVendorRow => ({
  id,
  name,
  aliases: [],
  accounts: [],
  mergedIntoId,
});

const aqua = row('aquavoice', 'Aqua Voice', 1, 1_500);
const aquaPro = row('aquavoicepro', 'Aqua Voice Pro', 2, 3_000);
const raw = row('aquavoiceinc', 'aqua voice inc', null, 800);
const vendors = [
  vendor(1, 'Aqua Voice'),
  vendor(2, 'Aqua Voice Pro'),
  vendor(3, 'Zoom'),
  vendor(4, 'Adobe'),
  vendor(5, '旧 Aqua', 1),
];

describe('mergeTargetOptions', () => {
  it('先頭は「まだ選んでいない」、次に選んだ順の登録済み、残りは名前順で、重複させない', () => {
    expect(mergeTargetOptions([aquaPro, raw, aqua], vendors)).toEqual([
      NO_TARGET,
      { value: '2', label: 'Aqua Voice Pro' },
      { value: '1', label: 'Aqua Voice' },
      { value: '4', label: 'Adobe' },
      { value: '3', label: 'Zoom' },
    ]);
  });

  it('他の登録へ統合済みのものは、選択中でも統合先に出さない', () => {
    const merged = row('oldaqua', '旧 Aqua', 5);
    const values = mergeTargetOptions([merged], vendors).map((option) => option.value);
    expect(values).not.toContain('5');
    expect(values[0]).toBe('');
  });
});

describe('resolveMergeTarget', () => {
  const options = mergeTargetOptions([aqua, aquaPro, raw], vendors);

  it('選び直した値が選択肢に残っていればそれを使う', () => {
    expect(resolveMergeTarget('3', options, [aqua, aquaPro, raw])).toBe('3');
  });

  it('選んでいないか、選んだ値が消えていれば、推定月額が最大の登録済みを既定にする', () => {
    expect(resolveMergeTarget(null, options, [aqua, aquaPro, raw])).toBe('2');
    expect(resolveMergeTarget('99', options, [aqua, aquaPro, raw])).toBe('2');
  });

  it('登録済みを選んでいなければ既定は空 (利用者が選ぶまで統合できない)', () => {
    expect(resolveMergeTarget(null, mergeTargetOptions([raw], vendors), [raw])).toBe('');
  });

  it('既定の行が統合済みで選択肢に無ければ空にする', () => {
    const merged = row('oldaqua', '旧 Aqua', 5, 9_000);
    expect(resolveMergeTarget(null, mergeTargetOptions([merged], vendors), [merged])).toBe('');
  });
});

describe('mergeIntentOf', () => {
  const options = mergeTargetOptions([aqua, aquaPro, raw], vendors);
  const listRows = [aqua, aquaPro, raw];

  it('統合先を除いた登録済みを統合元に、未登録の行と選んだ取引名を重複なしの取引名にする', () => {
    const intent = mergeIntentOf({
      target: '1',
      options,
      selectedRows: [aqua, aquaPro, raw],
      raws: [
        { name: 'AQUA VOICE INC', source: 'card' },
        { name: 'AQUA VOICE INC', source: 'bank' },
      ],
      listRows,
    });
    expect(intent).toEqual({
      kind: 'merge',
      targetId: 1,
      targetName: 'Aqua Voice',
      targetKey: 'aquavoice',
      sourceVendorIds: [2],
      sourceKeys: ['aquavoicepro', 'aquavoiceinc'],
      rawNames: ['AQUA VOICE INC'],
      names: { '1': 'Aqua Voice', '2': 'Aqua Voice Pro' },
    });
  });

  it('一覧に無い登録を統合先にしたら、付け替え先の行は null', () => {
    const intent = mergeIntentOf({ target: '3', options, selectedRows: [aqua], raws: [], listRows });
    expect(intent?.targetKey).toBeNull();
    expect(intent?.targetName).toBe('Zoom');
    expect(intent?.sourceVendorIds).toEqual([1]);
  });

  it('統合先が空か、統合先しか選んでいなければ統合できない', () => {
    expect(
      mergeIntentOf({ target: '', options, selectedRows: [aqua, aquaPro], raws: [], listRows }),
    ).toBeNull();
    expect(mergeIntentOf({ target: '1', options, selectedRows: [aqua], raws: [], listRows })).toBeNull();
  });
});
