import { readFileSync } from 'node:fs';
/**
 * 図・表の見方の契約。
 *
 * 守りたいのは「説明のほうが図より読むのに時間がかかる」状態にしないこと。
 * 長さと3行の役割を固定して、どのカードでも同じ速さで読めるようにする。
 */
import { describe, expect, it } from 'vitest';
import { FIGURE_GUIDES, type FigureGuide } from './figure-guides.js';

const entries = Object.entries(FIGURE_GUIDES) as [string, FigureGuide][];
const matrixSource = readFileSync(new URL('./pages/analysis/Matrix.tsx', import.meta.url), 'utf8');

describe('図・表の見方', () => {
  it('1行は40〜50字程度に収める', () => {
    for (const [id, g] of entries) {
      for (const [field, text] of Object.entries(g)) {
        expect(text.length, `${id}.${field}`).toBeGreaterThan(0);
        // 50字を超えたら文を削るか、図を2つに分ける合図
        expect(text.length, `${id}.${field}: ${text}`).toBeLessThanOrEqual(50);
      }
    }
  });

  it('3行はすべて埋まっている', () => {
    // 「どこを見る」だけあって「次の一手」が無いと、読んで終わりの図になる
    for (const [id, g] of entries) {
      expect(Object.keys(g).sort(), id).toEqual(['act', 'read', 'shows']);
    }
  });

  it('1行に1文だけ置く(句点で切って改行する)', () => {
    // 1行に2文入ると、折り返しで意味の切れ目が見えなくなる
    for (const [id, g] of entries) {
      for (const [field, text] of Object.entries(g)) {
        expect(text.split('。').filter(Boolean).length, `${id}.${field}`).toBe(1);
        expect(text.endsWith('。'), `${id}.${field}`).toBe(true);
      }
    }
  });

  it('図のidが重複しない', () => {
    expect(new Set(entries.map(([id]) => id)).size).toBe(entries.length);
  });

  it('Matrixでも説明を図より先に置く', () => {
    expect(matrixSource.indexOf('<HowTo id="matrixMovers" />')).toBeLessThan(
      matrixSource.indexOf('<MatrixMoversChart data={m} />'),
    );
  });
});
