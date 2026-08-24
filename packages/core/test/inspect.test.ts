/**
 * 統計プリミティブのユニットテスト（HTML版と同一定義: 不偏標準偏差 n-1）。
 */
import { describe, expect, it } from 'vitest';
import { mean, median, movingAvg, std, sum, yearOf } from '../src/index.js';

describe('stats', () => {
  it('mean / sum / 空配列は0', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
    expect(sum([10, -4])).toBe(6);
  });
  it('std は不偏標準偏差（n-1）', () => {
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(std([5])).toBe(0);
  });
  it('median は偶数個で中央2値の平均', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('movingAvg は窓未満を null 埋め', () => {
    expect(movingAvg([3, 6, 9, 12], 3)).toEqual([null, null, 6, 9]);
  });
  it('yearOf', () => {
    expect(yearOf('2026-07')).toBe('2026');
  });
});
