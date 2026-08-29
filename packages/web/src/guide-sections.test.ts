import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary.js';
import { GUIDE_CURRENT, buildGuideSections } from './guide-sections.js';

describe('指標ガイドの静的行', () => {
  it('APIデータが無くても全用語を一度ずつ表示できる', () => {
    const rows = buildGuideSections().flatMap((section) => section.rows);
    expect(rows.map((row) => row.id).sort()).toEqual(Object.keys(GLOSSARY).sort());
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows.every((row) => row.now.length > 0 && row.bench.length > 0)).toBe(true);
  });

  it('全用語の現在値を明示分類し、該当なしを取得不能と区別する', () => {
    expect(Object.keys(GUIDE_CURRENT).sort()).toEqual(Object.keys(GLOSSARY).sort());
    const rows = buildGuideSections().flatMap((section) => section.rows);
    expect(
      rows.filter((row) => row.currentKind === 'not_applicable').every((row) => row.now === '該当なし'),
    ).toBe(true);
    expect(rows.filter((row) => row.currentKind === 'metric').some((row) => row.now === '—')).toBe(true);
  });
});
