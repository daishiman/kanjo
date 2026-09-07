import { describe, expect, it } from 'vitest';
import {
  importGenerationState,
  importHistoryCancelable,
  importHistoryDiscardBlock,
} from '../src/deletion.js';

const block = (status: string | null, activeTargetCount = 0, canonicalRowCount = 0, undoSnapshotCount = 0) =>
  importHistoryDiscardBlock({ status, activeTargetCount, canonicalRowCount, undoSnapshotCount });

describe('取込履歴だけを破棄できる状態', () => {
  it.each(['failed', 'duplicate'])('%s は非activeかつ参照行なしなら許可する', (status) => {
    expect(block(status)).toBeNull();
  });

  it('データを消し終えたcommitted履歴は片づけを許可する', () => {
    expect(block('committed', 0, 0, 0)).toBeNull();
  });

  it.each([
    ['processing', 'in_progress'],
    ['applying', 'in_progress'],
    ['ok', 'legacy'],
    [null, 'unsupported_state'],
  ] as const)('%s は履歴だけの破棄を許可しない', (status, reason) => {
    expect(block(status)).toBe(reason);
  });

  it.each([
    [1, 0, 0, 'active'],
    [0, 1, 0, 'has_canonical_data'],
    [0, 0, 1, 'has_undo_snapshot'],
  ] as const)(
    'committed履歴は参照が1つでも残る限り片づけない (active=%i canonical=%i undo=%i)',
    (active, canonical, undo, reason) => {
      expect(block('committed', active, canonical, undo)).toBe(reason);
    },
  );

  it('active pointerが無くてもcanonical行が参照していれば拒否する', () => {
    expect(block('failed', 0, 1)).toBe('has_canonical_data');
  });

  it('30日undoの退避が参照していれば拒否する', () => {
    expect(block('failed', 0, 0, 1)).toBe('has_undo_snapshot');
  });
});

describe('取込履歴の世代表示', () => {
  const state = (
    over: Partial<Parameters<typeof importGenerationState>[0]> & { owned?: readonly string[] } = {},
  ) => {
    const { owned, ...rest } = over;
    return importGenerationState({
      status: 'committed',
      targetKeys: ['2026-01|mf', '2026-02|mf'],
      ownTargetCount: 0,
      ownedTargetKeys: new Set(owned ?? []),
      canonicalRowCount: 0,
      ...rest,
    });
  };

  it('全ての対象を自分で所有していれば現在有効', () => {
    expect(state({ ownTargetCount: 2, owned: ['2026-01|mf', '2026-02|mf'] })).toBe('active');
  });

  it('一部だけ所有していれば一部が有効', () => {
    expect(state({ ownTargetCount: 1, owned: ['2026-01|mf', '2026-02|mf'] })).toBe('partial');
  });

  it('対象を別の取込が引き取っていれば更新済み', () => {
    expect(state({ owned: ['2026-01|mf', '2026-02|mf'] })).toBe('superseded');
  });

  it('対象を一つでも誰かが持っていれば更新済み扱いにする', () => {
    expect(state({ owned: ['2026-02|mf'] })).toBe('superseded');
  });

  it('対象を誰も所有していなければ削除済み', () => {
    expect(state()).toBe('deleted');
  });

  it('所有者不在でも行が残っていれば削除済みと言い切らない', () => {
    expect(state({ canonicalRowCount: 5 })).toBe('superseded');
  });

  it('対象キーが記録されていない古い履歴は削除済みにしない', () => {
    expect(state({ targetKeys: [] })).toBe('superseded');
  });

  it.each([
    ['ok', 'legacy'],
    ['failed', null],
    ['duplicate', null],
    ['processing', null],
  ] as const)('%s は世代表示を持たない (期待値 %s)', (status, expected) => {
    expect(state({ status })).toBe(expected);
  });
});

describe('取込履歴の取消可否', () => {
  it('表示上は更新済みでもcanonical行が残るcommitted履歴は取り消せる', () => {
    expect(importHistoryCancelable({ status: 'committed', activeTargetCount: 0, canonicalRowCount: 1 })).toBe(
      true,
    );
  });

  it('assetsはactive ownershipが残るcommitted履歴だけ取り消せる', () => {
    expect(importHistoryCancelable({ status: 'committed', activeTargetCount: 1, canonicalRowCount: 0 })).toBe(
      true,
    );
    expect(importHistoryCancelable({ status: 'committed', activeTargetCount: 0, canonicalRowCount: 0 })).toBe(
      false,
    );
  });

  it('canonical参照が異常に残っても未完了履歴に取消を出さない', () => {
    expect(importHistoryCancelable({ status: 'failed', activeTargetCount: 0, canonicalRowCount: 1 })).toBe(
      false,
    );
  });
});
