/**
 * ヘッダー文の「情報量」を機械検証する回帰テスト。
 *
 * 背景: task 文を一律1文へ短縮したとき、冗長な言い換えと一緒に
 * 「増=赤・減=緑」「予算±10%」「適法性の保証はしない」といった
 * 誤読を防ぐ情報まで消え、用語ホバー(linkTerms)が 20件→4件 に落ちた。
 * 表示有無だけを見るテストでは検知できなかったので、ここでは
 * 「用語リンクが何件あるか」「どの route が何を説明しているか」を数える。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './components/Page.js';
import { linkTerms } from './components/Term.js';
import { ANALYSIS_TABS, APP_ROUTES } from './routeMetadata.js';

/**
 * 説明文を持つ単位は「画面」と「支出分析のタブ」の2種類ある。
 * タブは元は独立した画面で、統合後もその説明文を表示しているので、
 * 情報量の下限はこの2つを合わせて数える(画面を減らして説明ごと消す退行を検知する)。
 */
const DESCRIBED = [...APP_ROUTES, ...ANALYSIS_TABS];

/** 1つの文に含まれる glossary 用語リンクの数 */
const termCount = (text: string): number => linkTerms(text).filter((node) => typeof node !== 'string').length;

const headerTermCount = (route: (typeof DESCRIBED)[number]): number =>
  termCount(route.task) + termCount(route.taskDetail);

describe('ページヘッダーの情報量', () => {
  it('全15ルートと支出分析の3タブが task と taskDetail を持ち、taskDetail は task より詳しい', () => {
    for (const route of DESCRIBED) {
      expect(route.taskDetail, route.id).toBeTruthy();
      expect(route.taskDetail.length, route.id).toBeGreaterThan(route.task.length);
      expect(route.taskDetail, route.id).not.toBe(route.task);
    }
  });

  it('ヘッダー全体で用語ホバーが十分に張られている(短縮による用語消失の検知)', () => {
    const total = DESCRIBED.reduce((sum, route) => sum + headerTermCount(route), 0);
    // 実測: 短縮前20件 → 一律1文へ短縮して4件 → taskDetail 復元後51件。
    // 下限を割ったら、また説明文から用語が削られている。
    expect(total).toBeGreaterThanOrEqual(45);
  });

  it('用語リンクがゼロのルートは会計用語を持たない画面だけに限る', () => {
    const zero = DESCRIBED.filter((route) => headerTermCount(route) === 0).map((route) => route.id);
    expect(zero).toEqual([]);
  });

  it('誤読を防ぐ情報(色凡例・判定基準・免責・永続保証)がヘッダーに残っている', () => {
    const detail = (id: (typeof DESCRIBED)[number]['id']) =>
      DESCRIBED.find((route) => route.id === id)?.taskDetail ?? '';
    // 色の意味は画面ごとに変わる。Matrix には可視の凡例があるが、
    // 凡例は表を開いて初めて見えるので、ヘッダーの文言でも先に示しておく
    expect(detail('matrix')).toContain('増=赤');
    expect(detail('matrix')).toContain('減=緑');
    expect(detail('budget')).toContain('±10%');
    // 責任範囲の記述(BR-002 税務警告を隠さない)
    expect(detail('tax')).toContain('適法性の保証はしない');
    expect(detail('tax')).toMatch(/e-Tax/);
    // 編集を信頼してよい根拠
    expect(detail('classify')).toContain('残る');
    expect(detail('cash')).toContain('消えない');
    // 決算書の会計用語
    for (const word of ['損益計算書', '貸借対照表', 'キャッシュフロー', '発生主義'])
      expect(detail('statements')).toContain(word);
  });

  it('taskDetail は折りたたみで表示され、用語ホバーが効く', () => {
    for (const route of APP_ROUTES) {
      const html = renderToStaticMarkup(<PageHeader route={route.id} />);
      expect(html, route.id).toContain('class="page-task-detail"');
      expect(html, route.id).toContain('<summary>');
      expect(html.replace(/<[^>]+>/g, ''), route.id).toContain(route.taskDetail);
    }
    // linkTerms が taskDetail にも適用されている(term ボタンが出る)ことを1件で確認
    const statements = renderToStaticMarkup(<PageHeader route="statements" />);
    expect(statements.match(/class="term"/g)?.length ?? 0).toBeGreaterThan(1);
  });
});
