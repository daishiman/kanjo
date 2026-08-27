/**
 * 図に触れたときの文言が用語解説(glossary.ts)とそろっているかを固定する。
 * 金額はテスト内の架空値で、実データには依存しない。
 */
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../glossary.js';
import {
  chartTooltipValue,
  termInLabel,
  tooltipLine,
  tooltipNote,
  tooltipTitle,
  tooltipValue,
} from './chart-tooltip.js';

describe('ツールチップの期間見出し', () => {
  it('月・四半期を日本語で開く', () => {
    expect(tooltipTitle('2026-01')).toBe('2026年1月');
    expect(tooltipTitle('2026-Q3')).toBe('2026年 第3四半期');
    expect(tooltipTitle('消耗品費')).toBe('消耗品費');
  });
});

describe('ツールチップの数値', () => {
  it('単位ごとに画面と同じ表記にする', () => {
    expect(tooltipValue(123456, 'yen')).toBe('123,456円');
    expect(tooltipValue(0.4567, 'pct')).toBe('45.7%');
    expect(tooltipValue(3, 'count')).toBe('3件');
  });

  it('未記帳の月は 0 円ではなく「まだ入力していない」と伝える', () => {
    expect(tooltipValue(null, 'yen')).toBe('未記帳(まだ入力していない月)');
  });

  it('ウォーターフォールの浮動棒は、座標差でなく元の負寄与を保つ', () => {
    expect(chartTooltipValue([700, 1000], -300)).toBe(-300);
    expect(chartTooltipValue([1000, 1200], 200)).toBe(200);
    // 合計棒には符号付き差分が無いので、従来どおり棒の差を読む
    expect(chartTooltipValue([0, 1200])).toBe(1200);
  });
});

describe('系列名と用語解説の対応', () => {
  it('表記ゆれを含めて用語辞書を引く', () => {
    expect(termInLabel('経費の3点移動平均')).toBe('movingAvg');
    expect(termInLabel('平均+2σ')).toBe('sigmaBand');
    expect(termInLabel('累積構成比')).toBe('pareto');
    expect(termInLabel('売上')).toBeNull();
  });

  it('辞書の用語名を添え、説明は用語ホバーと同じ文を使う', () => {
    expect(tooltipLine('経費の3点移動平均', 100000, 'yen')).toBe(
      `経費の3点移動平均(${GLOSSARY.movingAvg.term}): 100,000円`,
    );
    // 系列名がすでに用語そのものなら重ねて書かない
    expect(tooltipLine('累積構成比', 0.8, 'pct')).toBe('累積構成比: 80%');
    expect(tooltipNote(['売上', '平均+2σ'])).toEqual([GLOSSARY.sigmaBand.short]);
    expect(tooltipNote(['売上', '経費'])).toEqual([]);
  });
});
