import { describe, expect, it } from 'vitest';
import {
  VENDOR_MEMORY_MIN_CONFIDENCE,
  VENDOR_MEMORY_MIN_HITS,
  type VendorMemoryRecord,
  judgeVendorMemory,
  normalizeVendorKey,
  recordVendorOutcome,
  vendorConfidence,
} from '../src/index.js';

const rec = (over: Partial<VendorMemoryRecord> = {}): VendorMemoryRecord => ({
  vendorKey: 'カフェ',
  hitCount: 5,
  disagreeCount: 0,
  big: '会議費',
  ...over,
});

describe('確信度の算出(D01)', () => {
  it('一致率そのものを返す', () => {
    expect(vendorConfidence({ hitCount: 4, disagreeCount: 1 })).toBeCloseTo(0.8);
    expect(vendorConfidence({ hitCount: 5, disagreeCount: 0 })).toBe(1);
  });

  it('母数0を1.0と読ませない', () => {
    expect(vendorConfidence({ hitCount: 0, disagreeCount: 0 })).toBe(0);
  });
});

describe('自動適用の閾値', () => {
  it('件数・一致率とも満たせば自動適用', () => {
    expect(judgeVendorMemory(rec({ hitCount: 3, disagreeCount: 0 })).disposition).toBe('auto-apply');
  });

  it('閾値未満は自動適用されず候補提示に留まる', () => {
    // 一致率は 1.00 だが件数が足りない
    expect(judgeVendorMemory(rec({ hitCount: 2, disagreeCount: 0 })).disposition).toBe('suggest');
    // 件数は足りるが一致率が足りない (3/5 = 0.6)
    expect(judgeVendorMemory(rec({ hitCount: 3, disagreeCount: 2 })).disposition).toBe('suggest');
  });

  it('境界ちょうどは自動適用に含む', () => {
    // 4/5 = 0.80 ちょうど、hit=4 >= 3
    const j = judgeVendorMemory(rec({ hitCount: 4, disagreeCount: 1 }));
    expect(j.confidence).toBeCloseTo(VENDOR_MEMORY_MIN_CONFIDENCE);
    expect(j.disposition).toBe('auto-apply');
    expect(judgeVendorMemory(rec({ hitCount: VENDOR_MEMORY_MIN_HITS, disagreeCount: 0 })).disposition).toBe(
      'auto-apply',
    );
  });

  it('1件中1件を自動適用にしない(分母の小ささを吸収しない)', () => {
    const j = judgeVendorMemory(rec({ hitCount: 1, disagreeCount: 0 }));
    expect(j.confidence).toBe(1);
    expect(j.disposition).toBe('suggest');
  });
});

describe('pinned と取り消し', () => {
  it('pinned は confidence によらず適用される', () => {
    const j = judgeVendorMemory(rec({ hitCount: 1, disagreeCount: 9, pinned: true }));
    expect(j.disposition).toBe('auto-apply');
    expect(j.confidence).toBeLessThan(VENDOR_MEMORY_MIN_CONFIDENCE);
  });

  it('取り消した決め事は pinned でも復活しない', () => {
    expect(judgeVendorMemory(rec({ pinned: true, revoked: true })).disposition).toBe('inactive');
  });

  it('取り消した決め事は候補にも出さない', () => {
    expect(judgeVendorMemory(rec({ revoked: true })).disposition).toBe('inactive');
  });
});

describe('取消が確信度へ反映される', () => {
  it('disagree が増えると confidence が下がる', () => {
    const before = { hitCount: 4, disagreeCount: 0 };
    const after = recordVendorOutcome(before, 'disagree');
    expect(vendorConfidence(after)).toBeLessThan(vendorConfidence(before));
    expect(after).toEqual({ hitCount: 4, disagreeCount: 1 });
  });

  it('取消を重ねると自動適用から候補提示へ落ちる', () => {
    let counts = { hitCount: 4, disagreeCount: 0 };
    expect(judgeVendorMemory(rec(counts)).disposition).toBe('auto-apply');
    counts = recordVendorOutcome(counts, 'disagree');
    counts = recordVendorOutcome(counts, 'disagree');
    expect(judgeVendorMemory(rec(counts)).disposition).toBe('suggest'); // 4/6 = 0.67
  });

  it('一致は hit だけを増やす', () => {
    expect(recordVendorOutcome({ hitCount: 1, disagreeCount: 1 }, 'agree')).toEqual({
      hitCount: 2,
      disagreeCount: 1,
    });
  });
});

describe('画面へ出す説明(qa-014)', () => {
  it('割合ではなく件数の形で示す', () => {
    expect(judgeVendorMemory(rec({ hitCount: 4, disagreeCount: 1 })).reason).toContain('過去 5 件中 4 件');
  });

  it('自動適用されない理由が条件つきで分かる', () => {
    expect(judgeVendorMemory(rec({ hitCount: 2, disagreeCount: 0 })).reason).toContain(
      `${VENDOR_MEMORY_MIN_HITS} 件以上`,
    );
    expect(judgeVendorMemory(rec({ hitCount: 3, disagreeCount: 3 })).reason).toContain('食い違い');
  });
});

describe('取引先名の正規化', () => {
  it('表記ゆれを同じ鍵へ寄せる', () => {
    expect(normalizeVendorKey('ｱﾏｿﾞﾝ ')).toBe(normalizeVendorKey('アマゾン'));
    expect(normalizeVendorKey('cafe　de　x')).toBe(normalizeVendorKey('CAFE DE X'));
  });

  it('末尾の連番を落とす', () => {
    expect(normalizeVendorKey('コンビニ20260701')).toBe(normalizeVendorKey('コンビニ'));
  });

  it('別の取引先を同じ鍵にしない', () => {
    expect(normalizeVendorKey('アマゾン')).not.toBe(normalizeVendorKey('アマゾンウェブ'));
  });
});
