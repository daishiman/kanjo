/**
 * 画面検索(Cmd+K)の絞り込み。
 *
 * 画面が増えたので、サイドバーを目で走査せずに名前で辿り着ける経路を用意する。
 * サイドバーに行を持たない単位(支出分析のタブ)もここからは引ける。
 * ここは「どう当てるか」だけを持ち、表示は CommandPalette.tsx が持つ。
 *
 * 検索対象は routeMetadata.ts の正本をそのまま渡す。追加のデータは持たない
 * (画面が増えたときに更新し忘れる二重管理を作らないため)。
 */

export interface RouteSearchItem {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly task: string;
  readonly taskDetail: string;
  readonly navGroup: string | null;
}

/**
 * query に当てはまる画面を、選ばせたい順に返す。
 *
 * 空文字のときは全画面をサイドバーと同じ業務順序で返す
 * (パレットを開いた直後に一覧として機能させるため)。
 */
export function searchRoutes<T extends RouteSearchItem>(query: string, routes: readonly T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...routes];

  return (
    routes
      .map((route, order) => ({ route, order, rank: rankOf(route, q) }))
      .filter((hit) => hit.rank !== NO_MATCH)
      // 同じ順位なら業務順序を保つ(sort は安定だが、順位を跨ぐ比較で崩れるので order を明示する)
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map((hit) => hit.route)
  );
}

/**
 * 各 route が属する群を補って返す。
 *
 * routeMetadata.ts の navGroup は「サイドバーで見出しを出す位置」を表すので、
 * 群の先頭にしか入っていない(2件目以降は null = 直前の群の続き)。
 * そのまま検索すると「見る」で群の先頭1件しか引けないため、ここで下へ継承する。
 * 正本を書き換えず、検索側の解釈として持つ。
 */
export function withResolvedGroups<T extends RouteSearchItem>(routes: readonly T[]): T[] {
  let group: string | null = null;
  return routes.map((route) => {
    if (route.navGroup) group = route.navGroup;
    return { ...route, navGroup: group };
  });
}

const NO_MATCH = Number.POSITIVE_INFINITY;

/**
 * 当たり方に順位を付ける。小さいほど先に出す。
 *
 * label を最優先にするのは、利用者が思い浮かべているのが画面の名前だから。
 * task/taskDetail まで探すのは「重複契約」のように名前に出ない語で辿り着けるようにするためだが、
 * taskDetail は長文でノイズになりやすいので最下位に置く
 * (「確認」のような語はほぼ全画面に入っており、絞り込みとして機能しない)。
 */
function rankOf(route: RouteSearchItem, q: string): number {
  const label = route.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.includes(q)) return 1;
  if (route.navGroup?.toLowerCase().includes(q)) return 2;
  if (route.task.toLowerCase().includes(q)) return 3;
  if (route.taskDetail.toLowerCase().includes(q)) return 4;
  return NO_MATCH;
}
