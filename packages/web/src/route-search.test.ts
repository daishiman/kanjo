/**
 * 画面検索(Cmd+K)の絞り込み規則を固定する。
 *
 * 「当たる」だけでなく「当たりすぎない」ことも検査する。候補は20件に満たないので、
 * 全件が並ぶ結果は絞り込みとして機能していないのと同じ。
 */
import { describe, expect, it } from 'vitest';
import { searchRoutes, withResolvedGroups } from './route-search.js';
import { SEARCH_ROUTES } from './routeMetadata.js';

// サイドバーに行が無い「支出分析」のタブも検索では引ける。引けないと統合が
// 「増減マトリクスが消えた」に見えるので、検索対象は SEARCH_ROUTES が正本
const ROUTES = withResolvedGroups(SEARCH_ROUTES);
const idsOf = (query: string) => searchRoutes(query, ROUTES).map((route) => route.id);

describe('画面検索の絞り込み', () => {
  it('空文字ではサイドバーと同じ業務順序で全画面を返す', () => {
    expect(idsOf('')).toEqual(SEARCH_ROUTES.map((route) => route.id));
    expect(idsOf('   ')).toEqual(SEARCH_ROUTES.map((route) => route.id));
  });

  it('画面名の一部で辿り着ける', () => {
    expect(idsOf('マトリクス')).toContain('matrix');
    expect(idsOf('サブスク')).toContain('subscriptions');
  });

  it('名前に出ない語でも、画面の説明から辿り着ける', () => {
    // 「重複契約」は subscriptions の taskDetail にしかない
    const hits = idsOf('重複契約');
    expect(hits).toContain('subscriptions');
    expect(hits.length).toBeLessThan(SEARCH_ROUTES.length);
  });

  it('画面名に当たったものを、説明に当たったものより先に出す', () => {
    const hits = idsOf('仕分け');
    expect(hits[0]).toBe('classify');
  });

  it('ナビのグループ名で、その群の画面をまとめて引ける', () => {
    // navGroup は群の先頭にしか入っていないので、継承しないと1件しか引けない
    const group = SEARCH_ROUTES.filter((route) => ROUTES.find((r) => r.id === route.id)?.navGroup === '見る');
    expect(group.length).toBeGreaterThan(1);
    for (const route of group) expect(idsOf('見る')).toContain(route.id);
  });

  it('当てはまらない語では空を返す', () => {
    expect(idsOf('該当しない語句zzz')).toEqual([]);
  });

  it('全画面の説明に入っている語では絞り込めないので、そういう語を検索対象の主軸にしない', () => {
    // 「確認」は多くの task に入る。絞り込みが効かないことを既知として固定しておく
    // (将来ここが全件になったら、検索対象の見直しが必要という合図)
    expect(idsOf('確認').length).toBeLessThan(SEARCH_ROUTES.length);
  });

  it('同じ順位のときは業務順序を保つ', () => {
    // 群名での一致は全件が同じ順位になるので、並びはサイドバーの順序そのものになる
    const hits = idsOf('見る');
    const order = (id: string) => SEARCH_ROUTES.findIndex((route) => route.id === id);
    const inGroup = hits.filter((id) => ROUTES.find((route) => route.id === id)?.navGroup === '見る');
    expect(inGroup.map(order)).toEqual([...inGroup.map(order)].sort((a, b) => a - b));
  });
});
