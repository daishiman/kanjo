import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Term, linkTerms } from './components/Term.js';
import { GLOSSARY, GUIDE_ORDER, TERM_ALIASES } from './glossary.js';

describe('用語辞書', () => {
  it('指標ガイドの並び順は辞書の全項目を1回ずつ含む', () => {
    const ids = Object.keys(GLOSSARY).sort();
    expect([...GUIDE_ORDER].sort()).toEqual(ids);
  });

  it('自由文の表記は長いものから照合される(部分一致で短い語が先に当たらない)', () => {
    for (let i = 1; i < TERM_ALIASES.length; i++) {
      expect(TERM_ALIASES[i - 1].text.length).toBeGreaterThanOrEqual(TERM_ALIASES[i].text.length);
    }
  });

  it('Term は辞書の用語を点線つきのボタンとして描く', () => {
    const html = renderToStaticMarkup(<Term id="cv" />);
    expect(html).toContain('class="term"');
    expect(html).toContain('>CV<');
    expect(renderToStaticMarkup(<Term id="cv">変動係数</Term>)).toContain('>変動係数<');
  });

  it('linkTerms は段落内の最初の1回だけをホバー化し、本文を欠かさない', () => {
    const text = '損益分岐点を下回る月が2回。損益分岐点は固定費の合計で、CVが0.6未満の科目を固定費とみなす。';
    const html = renderToStaticMarkup(<p>{linkTerms(text)}</p>);
    expect(html.match(/class="term"/g)?.length).toBe(3); // 損益分岐点・固定費・CV
    expect(html.replace(/<[^>]+>/g, '')).toBe(text);
  });

  it('辞書の語が無い文はそのまま返す', () => {
    expect(linkTerms('今月は特に問題ありません。')).toEqual(['今月は特に問題ありません。']);
  });
});
