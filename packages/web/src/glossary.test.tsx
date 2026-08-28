import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Term, linkTerms } from './components/Term.js';
import { ABBREVIATIONS, GLOSSARY, GUIDE_ORDER, TERM_ALIASES } from './glossary.js';

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

describe('略語の読み方', () => {
  it('略語には元の英語と日本語の呼び方が両方ある', () => {
    // 英語だけ・日本語だけだと、片方しか知らない相手との会話で結び付かない
    expect(ABBREVIATIONS.length).toBeGreaterThan(0);
    for (const a of ABBREVIATIONS) {
      expect(a.abbr.abbr.trim(), a.id).not.toBe('');
      expect(a.abbr.full.trim(), a.id).not.toBe('');
      expect(a.abbr.ja.trim(), a.id).not.toBe('');
      expect(a.meaning.trim(), a.id).not.toBe('');
    }
  });

  it('経営で最初に見る略語(PL・BS)が載っている', () => {
    const ids = ABBREVIATIONS.map((a) => a.id);
    expect(ids).toContain('pl');
    expect(ids).toContain('bs');
    expect(ids).toContain('cv');
  });

  it('同じ略語表記を2つの用語が使っていない', () => {
    const seen = ABBREVIATIONS.map((a) => a.abbr.abbr);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('並びは指標ガイドと同じ順(行き来しても順番が変わらない)', () => {
    const order = ABBREVIATIONS.map((a) => GUIDE_ORDER.indexOf(a.id));
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
});

describe('表記ゆれの別名', () => {
  /** 自由文を linkTerms にかけ、ホバー化された表記とその用語IDの組を取り出す */
  const hovered = (text: string): { id: string; text: string }[] =>
    linkTerms(text).flatMap((node) =>
      typeof node === 'string' || !node || typeof node !== 'object' || !('props' in node)
        ? []
        : [{ id: String(node.props.id), text: String(node.props.children) }],
    );

  it.each([
    ['損益分岐', 'breakEven'],
    ['BEP', 'breakEven'],
    ['損益分岐点売上高', 'breakEven'],
    ['安全余裕度', 'safetyMargin'],
    ['年率換算', 'annualized'],
    ['Zスコア', 'zScore'],
    ['経費比率', 'expenseRatio'],
    ['二重契約', 'subsDup'],
    ['メジアン', 'median'],
    ['前年同期比', 'yoy'],
    ['増減寄与', 'contribution'],
    ['2シグマ', 'sigmaBand'],
    ['3か月移動平均', 'movingAvg'],
    ['公私区分', 'publicPrivate'],
    ['立替経費', 'bizAdvance'],
  ])('別名「%s」でも %s の説明を引ける', (alias, id) => {
    expect(hovered(`今月は${alias}を確認した。`)).toEqual([{ id, text: alias }]);
  });

  it('同じ表記を2つの用語が取り合わない', () => {
    const owner = new Map<string, string>();
    for (const { id, text } of TERM_ALIASES) {
      expect(text.trim()).not.toBe('');
      expect(owner.get(text) ?? id).toBe(id);
      owner.set(text, id);
    }
  });

  it('別名が別の用語の別名を丸ごと含まない(どちらが出るかが表記次第にならない)', () => {
    const conflicts = TERM_ALIASES.flatMap((a) =>
      TERM_ALIASES.filter((b) => a.id !== b.id && a.text !== b.text && a.text.includes(b.text)).map(
        (b) => `${a.text}(${a.id}) ⊃ ${b.text}(${b.id})`,
      ),
    );
    expect(conflicts).toEqual([]);
  });

  it('長い別名は短い別名より先に当たる(「損益分岐点」が「損益分岐」に食われない)', () => {
    expect(hovered('損益分岐点を下回った。')).toEqual([{ id: 'breakEven', text: '損益分岐点' }]);
  });

  it('「版」単体は拾わず、「HTML版」を誤ってホバー化しない', () => {
    expect(hovered('HTML版から書き出したファイルを取り込む。')).toEqual([]);
    expect(hovered('レポートの版を確認する。')).toEqual([{ id: 'reportVersion', text: 'レポートの版' }]);
  });
});
