/**
 * 月文字列 'YYYY-MM' の読み書きの正本 (`month.ts`) のテスト。
 *
 * この4つの変換は core に6箇所・web に5箇所へ散っていて、年の切り出しが slice だったり
 * split だったりと少しずつ違っていた。1か所へ集めた結果を固定する。
 *
 * とくに `monthLabel` の「月の形でない文字列はそのまま返す」は、集約前の多数派
 * (無防備に整形して `NaN年NaN月` を出す) と挙動が違う。集約前の実装ならこのテストは落ちる。
 */
import { describe, expect, it } from 'vitest';
import { monthIndex, monthKey, monthLabel, monthShort } from './month.js';

describe('月文字列の変換', () => {
  it('通算番号は隣り合う月の差が 1 になり、年をまたいでも連続する', () => {
    expect(monthIndex('2026-02') - monthIndex('2026-01')).toBe(1);
    expect(monthIndex('2026-01') - monthIndex('2025-12')).toBe(1);
    expect(monthIndex('2026-01') - monthIndex('2025-01')).toBe(12);
  });

  it('通算番号から月へ戻せる (monthIndex の逆)', () => {
    for (const m of ['2025-01', '2025-12', '2026-08']) expect(monthKey(monthIndex(m))).toBe(m);
  });

  it('年月は先頭の 0 を落として日本語にする', () => {
    expect(monthLabel('2026-08')).toBe('2026年8月');
    expect(monthLabel('2026-12')).toBe('2026年12月');
  });

  it('月だけの表記も先頭の 0 を落とす', () => {
    expect(monthShort('2026-08')).toBe('8月');
    expect(monthShort('2026-12')).toBe('12月');
  });

  it('月の形でない文字列は整形せずそのまま返す (四半期ラベルなどが流れてくるため)', () => {
    expect(monthLabel('2026-Q1')).toBe('2026-Q1');
    expect(monthLabel('全期間')).toBe('全期間');
    expect(monthLabel('')).toBe('');
    // 桁が足りない・多いものも月として扱わない
    expect(monthLabel('2026-8')).toBe('2026-8');
    expect(monthLabel('2026-08-02')).toBe('2026-08-02');
  });
});
