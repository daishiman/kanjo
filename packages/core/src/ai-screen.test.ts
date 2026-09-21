/**
 * AI分析画面の判定規則 (`ai-screen.ts`) のうち、表示の土台になる日時整形を固定する。
 *
 * 日時は「UTC で持ち、JST で見せる」。境界 (UTC の深夜) で日付が1日ずれると
 * 版の並び順も T-番号の見え方も狂うので、ずれる側の値をそのまま書いて固定する。
 */
import { describe, expect, it } from 'vitest';
import { aiClockLabel, aiDateLabel, aiDateTimeLabel } from './ai-screen.js';

describe('日時の表示は Asia/Tokyo', () => {
  it('UTC 深夜は JST の翌日になる', () => {
    expect(aiDateLabel('2026-09-10T15:00:00.000Z')).toBe('2026/09/11');
    expect(aiDateTimeLabel('2026-09-10T15:00:00.000Z')).toBe('2026/09/11 00:00');
    expect(aiClockLabel('2026-09-10T15:00:00.000Z')).toBe('00:00');
  });

  it('月末・年末をまたぐ', () => {
    expect(aiDateLabel('2026-12-31T15:00:00.000Z')).toBe('2027/01/01');
    expect(aiDateLabel('2024-02-28T15:00:00.000Z')).toBe('2024/02/29');
  });

  it('JST の日中はその日のまま', () => {
    expect(aiDateTimeLabel('2026-09-10T01:18:00.000Z')).toBe('2026/09/10 10:18');
    expect(aiClockLabel('2026-09-10T01:22:30.000Z')).toBe('10:22');
  });

  it('壊れた値は落とさず、そのまま返す', () => {
    expect(aiDateLabel('いつか')).toBe('いつか');
    expect(aiDateTimeLabel('')).toBe('');
    expect(aiClockLabel('いつか')).toBe('');
  });
});
