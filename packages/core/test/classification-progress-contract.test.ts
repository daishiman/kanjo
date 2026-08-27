import { describe, expect, it } from 'vitest';
import { type MfTx, type Rule, classificationProgress, resolveTx } from '../src/index.js';

const tx = (over: Partial<MfTx>): MfTx => ({
  id: 'x',
  m: '2026-07',
  d: '2026-07-01',
  c: '架空スーパー',
  a: -1000,
  big: '食費',
  mid: '食料品',
  ...over,
});

describe('仕分けの進み具合', () => {
  const rules: Rule[] = [{ k: '架空クラウド', cls: 'biz', big: null, mid: null, owner: null }];

  it('件数の合計が出どころ別の合計と一致する', () => {
    const resolved = [
      resolveTx(tx({ id: 'a', c: '架空クラウド' }), rules, {}),
      resolveTx(tx({ id: 'b', c: '無関係' }), rules, {}),
      resolveTx(tx({ id: 'c', c: '無関係' }), rules, { c: { cls: 'biz' } }),
    ];
    const p = classificationProgress(resolved);
    expect(p.total).toBe(3);
    expect(p.bySource.ルール + p.bySource.手動 + p.bySource.既定).toBe(p.total);
    expect(p.bizCount + p.personalCount).toBe(p.total);
  });

  it('事業と個人の件数を数える', () => {
    const resolved = [
      resolveTx(tx({ id: 'a', c: '架空クラウド' }), rules, {}),
      resolveTx(tx({ id: 'b', c: '無関係' }), rules, {}),
    ];
    expect(classificationProgress(resolved)).toMatchObject({ bizCount: 1, personalCount: 1 });
  });

  it('残作業は cls ではなく clsSrc の「既定」で数える(既定の cls は per のため)', () => {
    const resolved = [resolveTx(tx({ id: 'b', c: '無関係' }), rules, {})];
    const p = classificationProgress(resolved);
    expect(p.personalCount).toBe(1);
    expect(p.reviewPending).toBe(1);
    expect(p.reviewPending).toBe(p.bySource.既定);
  });

  it('人かルールが触った明細は残作業に数えない', () => {
    const resolved = [
      resolveTx(tx({ id: 'a', c: '架空クラウド' }), rules, {}),
      resolveTx(tx({ id: 'c', c: '無関係' }), rules, { c: { cls: 'per' } }),
    ];
    expect(classificationProgress(resolved).reviewPending).toBe(0);
  });

  it('明細が無ければ全て 0', () => {
    expect(classificationProgress([])).toEqual({
      total: 0,
      bizCount: 0,
      personalCount: 0,
      bySource: { 手動: 0, ルール: 0, 既定: 0 },
      reviewPending: 0,
    });
  });
});
