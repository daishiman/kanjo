import { describe, expect, it } from 'vitest';
import { shiftedPeriod } from './period.js';

const full = { from: '2024-01', to: '2026-12' };

describe('shiftedPeriod (期間の前後移動)', () => {
  it('同じ長さだけ前後へずらした任意期間を返す', () => {
    expect(shiftedPeriod({ applied: { from: '2025-01', to: '2025-12' }, full }, -1)).toEqual({
      mode: 'custom',
      from: '2024-01',
      to: '2024-12',
    });
    expect(shiftedPeriod({ applied: { from: '2025-11', to: '2026-01' }, full }, 1)).toEqual({
      mode: 'custom',
      from: '2026-02',
      to: '2026-04',
    });
  });

  it('全期間 (applied が null) やデータが無いときは null', () => {
    expect(shiftedPeriod({ applied: null, full }, -1)).toBeNull();
    expect(shiftedPeriod({ applied: { from: '2025-01', to: '2025-01' }, full: null }, 1)).toBeNull();
    expect(shiftedPeriod(null, 1)).toBeNull();
  });

  it('範囲の端では null', () => {
    expect(shiftedPeriod({ applied: { from: '2024-01', to: '2024-06' }, full }, -1)).toBeNull();
    expect(shiftedPeriod({ applied: { from: '2026-07', to: '2026-12' }, full }, 1)).toBeNull();
  });

  it('移動後の一部だけが全期間からはみ出す場合も null', () => {
    expect(shiftedPeriod({ applied: { from: '2024-06', to: '2024-12' }, full }, -1)).toBeNull();
    expect(shiftedPeriod({ applied: { from: '2026-01', to: '2026-08' }, full }, 1)).toBeNull();
  });
});
