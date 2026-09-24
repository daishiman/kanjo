import { describe, expect, it } from 'vitest';
import { DEFENSE_LINE_BASIS, DEFENSE_LINE_RECENT_MONTHS } from './analysis.js';
import { CONFIDENCE_TIER_DESCRIPTION } from './classify-status.js';
import {
  GUIDE_FACT_LABELS,
  GUIDE_FAQ,
  GUIDE_PERIOD_TABLE,
  GUIDE_RELATED_PAGES,
  GUIDE_STEPS,
  GUIDE_TERM_CURRENT,
  GUIDE_TOPICS,
  GUIDE_TOPIC_BODY,
  clampGuideQuery,
  guideFlowStages,
  guidePageFacts,
  guideScreen,
  guideTermBench,
  guideTermCurrent,
  resolveGuideTopic,
  searchGuide,
} from './guide-screen.js';
import type { MonthlyCloseStatus } from './overview.js';
import { periodDefinitionText } from './period.js';

const screen = (applied: { from: string; to: string } | null, dataUpdatedAt: string | null = null) =>
  guideScreen({
    period: { applied, full: { from: '2025-01', to: '2026-08' }, label: applied ? 'ラベル' : '全期間' },
    totals: { income: 500, expense: 800 },
    dataUpdatedAt,
    closeStatus: null,
  });

describe('使い方画面の骨格', () => {
  it('目次 7 節を画像の順に並べ、末尾に用語と目安を置く', () => {
    expect(GUIDE_TOPICS.map((t) => [t.id, t.label, t.destination.path])).toEqual([
      ['flow', '月次の流れ', '/analysis/total-cashflow'],
      ['totals', '総収支', '/analysis/total-cashflow'],
      ['reconcile', '照合', '/analysis/reconciliation'],
      ['classify', '仕分け', '/classify'],
      ['budget', '予算', '/budget'],
      ['sources', 'データ出典', '/import'],
      ['terms', '用語と目安', '/analysis'],
    ]);
  });

  it('4 ステップは 取込む→整える→確認→計画 で、それぞれの元画面へ戻る', () => {
    expect(GUIDE_STEPS.map((s) => [s.label, s.sub, s.destination.path])).toEqual([
      ['取込む', 'データを集める', '/import'],
      ['整える', '仕訳・分類で整理', '/classify'],
      ['確認', '状況を見る&診断する', '/analysis/total-cashflow'],
      ['計画', '次の一手を考える', '/budget'],
    ]);
  });

  it('関連ページ 5 件', () => {
    expect(GUIDE_RELATED_PAGES.map((p) => p.label)).toEqual([
      '総収支',
      '明細仕分け',
      '照合',
      '設定',
      '収支分析',
    ]);
  });

  it('URL の topic は既知だけを受け、未知・空は月次の流れに倒す', () => {
    expect(resolveGuideTopic('budget')).toBe('budget');
    expect(resolveGuideTopic('unknown')).toBe('flow');
    expect(resolveGuideTopic('')).toBe('flow');
    expect(resolveGuideTopic(null)).toBe('flow');
  });

  it('ステッパーの完了は月次クローズの実進捗で決まり、読めないときは null', () => {
    const close: MonthlyCloseStatus = {
      month: '2026-08',
      steps: [
        { key: 'import', label: '', done: true, count: null },
        { key: 'classification', label: '', done: true, count: 0 },
        { key: 'reconciliation', label: '', done: false, count: 2 },
        { key: 'review', label: '', done: false, count: null },
      ] as MonthlyCloseStatus['steps'],
      doneCount: 2,
      total: 4,
      reviewedAt: null,
    };
    expect(guideFlowStages(close)).toEqual([
      { label: '取込', done: true },
      { label: '整える', done: true },
      { label: '確認', done: false },
      { label: '月次レビュー', done: false },
    ]);
    expect(guideFlowStages(null).map((s) => s.done)).toEqual([null, null, null, null]);
  });
});

describe('期間の表・このページの数値', () => {
  it('期間の表は 4 行で、選択中の任意期間を 1年 と誤表示しない', () => {
    expect(GUIDE_PERIOD_TABLE.rows.map((r) => r.label)).toEqual(['1年', '2年', '3年', '任意']);
    expect(GUIDE_PERIOD_TABLE.rows.every((r) => !('note' in r))).toBe(true);
  });

  it('このページの数値は 4 項目で、取込が無ければ最終更新は未取込', () => {
    const facts = guidePageFacts(screen({ from: '2026-01', to: '2026-12' }), () => 'X');
    expect(facts.map((f) => [f.key, f.label])).toEqual([
      ['period', GUIDE_FACT_LABELS.period],
      ['definition', GUIDE_FACT_LABELS.definition],
      ['sources', GUIDE_FACT_LABELS.sources],
      ['updated', GUIDE_FACT_LABELS.updated],
    ]);
    expect(facts[0].value).toBe('ラベル（1年）');
    expect(facts[3].value).toBe('未取込');
    expect(
      guidePageFacts(screen({ from: '2026-06', to: '2026-08' }, '2026-09-01T00:00:00Z'), () => 'FMT')[0]
        .value,
    ).toBe('ラベル（3か月）');
    expect(guidePageFacts(screen(null, '2026-09-01T00:00:00Z'), () => 'FMT')[3].value).toBe('FMT');
  });

  it('期間の定義文は 1 か月・1 年・全期間で開始日と末日を書く', () => {
    expect(periodDefinitionText({ from: '2024-02', to: '2024-02' })).toBe(
      '2024年2月1日 〜 2024年2月29日の取引データを集計しています。',
    );
    expect(periodDefinitionText({ from: '2026-01', to: '2026-12' })).toBe(
      '2026年1月1日 〜 2026年12月31日の取引データを集計しています。',
    );
    expect(periodDefinitionText(null)).toBe('すべての取引データを集計しています。');
  });

  it('guideScreen は純収支を符号つきで返し、防衛ラインを持たない', () => {
    const s = screen(null);
    expect(s.totals).toEqual({ income: 500, expense: 800, net: -300 });
    expect(JSON.stringify(s)).not.toMatch(/defense|防衛ライン/i);
    const empty = guideScreen({
      period: { applied: null, full: null, label: '全期間' },
      totals: null,
      dataUpdatedAt: null,
      closeStatus: null,
    });
    expect(empty.totals).toEqual({ income: 0, expense: 0, net: 0 });
  });
});

describe('よくある疑問', () => {
  it('5 行を画像の順に並べる', () => {
    expect(GUIDE_FAQ.rows.map((r) => [r.id, r.question, r.destination.label])).toEqual([
      ['duplicate', 'なぜ重複候補があるのか？', '照合'],
      ['confidence', '信頼度は何を意味するか？', '明細仕分け'],
      ['scope', '家計・事業の範囲はどう分けている？', '設定'],
      ['defense', '防衛ラインとは何か？', '収支分析'],
      ['fix', '取込・仕分けの誤りを修正するには？', 'データ取込'],
    ]);
  });

  it('信頼度と防衛ラインの条件は算出側の定数から組まれる', () => {
    const row = (id: string) => GUIDE_FAQ.rows.find((r) => r.id === id)!;
    expect(row('confidence').condition).toBe(CONFIDENCE_TIER_DESCRIPTION);
    expect(CONFIDENCE_TIER_DESCRIPTION).toBe('高 (80 以上)・中 (50〜79)・低 (49 以下) の3段階＋%で表示');
    expect(row('defense').condition).toBe(DEFENSE_LINE_BASIS);
    expect(DEFENSE_LINE_BASIS).toContain(`直近${DEFENSE_LINE_RECENT_MONTHS}か月平均`);
  });

  it('重複候補の説明は実際の照合条件と一致し、取引先名の類似を必須としない', () => {
    const duplicate = GUIDE_FAQ.rows.find((row) => row.id === 'duplicate')!;
    expect(duplicate.condition).toContain('±3日以内');
    expect(duplicate.condition).toContain('1件');
    expect(duplicate.condition).not.toContain('類似');
    expect(duplicate.source).toContain('freee');
    expect(GUIDE_TOPIC_BODY.reconcile).toContain(`重複候補は、${duplicate.condition}場合に表示されます。`);
  });
});

describe('ガイド内検索', () => {
  it('例の 4 語はどれも何かに当たる', () => {
    for (const word of ['振替', '重複', '信頼度', '予算']) {
      const result = searchGuide(word);
      expect(result.none, word).toBe(false);
    }
    expect(searchGuide('重複').faq).toContain('duplicate');
    expect(searchGuide('信頼度').topics).toContain('classify');
    expect(searchGuide('予算').topics).toContain('budget');
    expect(searchGuide('振替').topics).toEqual(expect.arrayContaining(['totals', 'reconcile', 'sources']));
  });

  it('空の検索語は全件、当たらなければ none', () => {
    expect(searchGuide('')).toMatchObject({
      empty: true,
      none: false,
      topics: GUIDE_TOPICS.map((t) => t.id),
    });
    expect(searchGuide('   ').empty).toBe(true);
    expect(searchGuide('存在しないキーワードxyz')).toEqual({ empty: false, topics: [], faq: [], none: true });
  });

  it('全角半角と大小を同一視する', () => {
    expect(searchGuide('ＦＲＥＥ').topics).toEqual(searchGuide('freee').topics);
    expect(searchGuide('FREEE').none).toBe(false);
    expect(searchGuide('ＡＩ').topics).toEqual(searchGuide('ai').topics);
  });

  it('用語集など画面側の本文も検索の対象にできる', () => {
    expect(searchGuide('損益計算書').topics).not.toContain('terms');
    expect(searchGuide('損益計算書', { terms: ['PL 損益計算書'] }).topics).toContain('terms');
  });

  it('検索語は 100 字で切る (サロゲートペアを割らない)', () => {
    expect(clampGuideQuery('あ'.repeat(150))).toHaveLength(100);
    expect(Array.from(clampGuideQuery('𠮷'.repeat(120)))).toHaveLength(100);
    expect(clampGuideQuery(null)).toBe('');
  });
});

describe('用語と目安の現在値', () => {
  it('55 語の現在値の種類を持つ', () => {
    expect(Object.keys(GUIDE_TERM_CURRENT)).toHaveLength(55);
  });

  it('データが無ければ metric は値なし、未知の用語は該当なし', () => {
    expect(guideTermCurrent('breakEven', {})).toEqual({ kind: 'metric', value: null });
    expect(guideTermCurrent('nope', {})).toEqual({ kind: 'not_applicable', value: null });
    expect(guideTermCurrent('pl', {})).toEqual({
      kind: 'location',
      value: { type: 'text', value: '決算書ページで表示' },
    });
  });

  it('防衛ラインは nodata のとき値を出さない', () => {
    expect(
      guideTermCurrent('defenseLine', { summary: { defense: { status: 'nodata', line: 0 } } }).value,
    ).toBeNull();
    expect(
      guideTermCurrent('defenseLine', { summary: { defense: { status: 'ok', line: 120_000 } } }).value,
    ).toEqual({
      type: 'yen',
      value: 120_000,
    });
  });

  it('年換算の目安だけ前年実績から組む', () => {
    const context = {
      summary: {
        overview: {
          kpi: { currYearAnnualized: 1, prevYearExpense: 900 },
          top2Share: 0.5,
          unrecordedExpMonths: [],
        },
      },
    };
    expect(guideTermBench('annualized', context)).toEqual({ type: 'yen-prefix', value: 900 });
    expect(guideTermBench('median', context)).toBeNull();
    expect(guideTermCurrent('unrecordedMonth', context).value).toEqual({ type: 'text', value: 'なし' });
  });
});
