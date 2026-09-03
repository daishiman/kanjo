import { describe, expect, it } from 'vitest';
import { importHistoryCancelable, importHistoryDiscardBlock } from '../src/deletion.js';

const block = (status: string | null, activeTargetCount = 0, canonicalRowCount = 0, undoSnapshotCount = 0) =>
  importHistoryDiscardBlock({ status, activeTargetCount, canonicalRowCount, undoSnapshotCount });

describe('取込履歴だけを破棄できる状態', () => {
  it.each(['failed', 'duplicate'])('%s は非activeかつ参照行なしなら許可する', (status) => {
    expect(block(status)).toBeNull();
  });

  it.each([
    ['processing', 'in_progress'],
    ['applying', 'in_progress'],
    ['ok', 'legacy'],
    ['committed', 'unsupported_state'],
    [null, 'unsupported_state'],
  ] as const)('%s は履歴だけの破棄を許可しない', (status, reason) => {
    expect(block(status)).toBe(reason);
  });

  it('状態表示が更新済みでもactive pointerが残れば拒否する', () => {
    expect(block('committed', 1)).toBe('active');
  });

  it('active pointerが無くてもcanonical行が参照していれば拒否する', () => {
    expect(block('failed', 0, 1)).toBe('has_canonical_data');
  });

  it('30日undoの退避が参照していれば拒否する', () => {
    expect(block('failed', 0, 0, 1)).toBe('has_undo_snapshot');
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
