import { describe, expect, it } from 'vitest';
import { REPORT_CSS, buildReportHtml, emptyDataset, escapeHtml } from '../src/index.js';
import type { Dataset } from '../src/index.js';

/**
 * 会計レポートHTMLの契約。
 *
 * デザインシステム(skills/report-design-system)の絶対原則のうち、
 * 「単一ファイル・外部参照ゼロ」「色は意味だけ・accentは1〜2箇所」
 * 「分析にはmethodを添える」「出所をfooterに書く」は
 * 見た目の好みではなく配布可能性と説明責任の要件なので、テストで固定する。
 */

const ds = (over: Partial<Dataset> = {}): Dataset => ({
  ...emptyDataset(),
  months: ['2026-06', '2026-07', '2026-08'],
  biz: {
    revenue: [1000000, 1200000, 900000],
    categories: ['地代家賃', '通信費'],
    expense: { 地代家賃: [200000, 200000, 200000], 通信費: [30000, 32000, 41000] },
  },
  ...over,
});

const html = (over: Partial<Dataset> = {}): string => buildReportHtml(ds(over), '2026-08-28');

describe('会計レポートHTML', () => {
  it('外部参照がひとつも無い(保存すればオフラインで開ける)', () => {
    const h = html();
    expect(h).not.toMatch(/src="http|href="http|@import/);
  });

  it('CSSは正本を全文埋め込む(記憶で似せない)', () => {
    expect(html()).toContain(REPORT_CSS);
  });

  it('結論のキー数字(accent)は1〜2箇所まで', () => {
    const count = (html().match(/class="v num acc"/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
  });

  it('分析セクションには method(仮説/手法/結果/前提と限界)が付く', () => {
    const h = html();
    expect((h.match(/class="method"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    for (const k of ['仮説', '手法', '結果', '前提と限界']) expect(h).toContain(`<b>${k}</b>`);
  });

  it('footer にデータの出所と手法が入る', () => {
    const h = html();
    expect(h).toMatch(/<footer>[\s\S]*出所[\s\S]*手法[\s\S]*実データからの計算結果/);
  });

  it('禁じられた図(円グラフ・外部チャートライブラリ)を使わない', () => {
    const h = html();
    expect(h).not.toContain('<pie');
    expect(h).not.toMatch(/chart\.js|d3\.|plotly/i);
  });

  it('チャートの棒には data-tip が付く(マウスで月と金額が読める)', () => {
    expect(html()).toMatch(/<rect[^>]*data-tip="2026-0\d 経費/);
  });

  it('未記帳の月は棒を描かず、その旨を本文に明示する', () => {
    const h = html({ unrecordedExpMonths: ['2026-08'] });
    expect(h).toContain('集計から外した月');
    expect(h).toContain('2026-08');
    expect(h).not.toMatch(/data-tip="2026-08 経費/);
  });

  it('データが空でも壊れたHTMLを吐かない', () => {
    const h = buildReportHtml(emptyDataset(), '2026-08-28');
    expect(h).toContain('対象期間なし');
    expect(h).toContain('<footer>');
  });
});

describe('HTMLの逃がし', () => {
  it('タグにも属性にもなり得る文字をすべて落とす', () => {
    expect(escapeHtml(`<a href="x" data='y'>&`)).toBe('&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;');
  });

  it('科目名にタグが混ざってもレポートに素通ししない', () => {
    const h = buildReportHtml(
      ds({
        biz: {
          revenue: [1000000, 1200000, 900000],
          categories: ['<script>x</script>'],
          expense: { '<script>x</script>': [1, 2, 3] },
        },
      }),
      '2026-08-28',
    );
    expect(h).not.toContain('<script>x</script>');
    expect(h).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});
