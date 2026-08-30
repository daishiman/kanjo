// @vitest-environment jsdom

/**
 * iconが「別のキー」ではなく「別の絵」であることを、実際に描いた図形で確かめる。
 *
 * 元の検査は routeMetadata の icon 文字列が重複していないことしか見ていなかった。
 * これはキーを増やせば必ず通るので、守っているつもりの契約(利用者が見分けられること)は
 * どこにも存在していなかった。ここでは登録されている全iconを描画し、
 * svg の中身の図形(tag + 全属性)を並べた署名で比べる。
 *
 * 「似ている」までは自動では言えない(似ているかどうかは人の目でしか決まらない)ので、
 * この検査が言えるのは「同じ絵に別の名前が付いていない」まで。
 * 実際に見分けにくかった layout-dashboard(概況) と grid-2x2(増減マトリクス) の組は、
 * 概況を gauge に替えて解消してある(RouteIcon.tsx のコメント参照)。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ROUTE_ICON_NAMES, RouteIcon } from './components/RouteIcon.js';
import { ANALYSIS_TABS, APP_ROUTES } from './routeMetadata.js';

afterEach(cleanup);

/** 図形1つを「tag名 + 属性名=値 を名前順に並べたもの」で表す。属性の書き順の違いで別物にしない */
function shapeSignature(element: Element): string {
  const attributes = [...element.attributes]
    .map((attribute) => `${attribute.name}=${attribute.value}`)
    .sort()
    .join(' ');
  return `${element.tagName.toLowerCase()}[${attributes}]`;
}

function iconShapes(name: (typeof ROUTE_ICON_NAMES)[number]): string[] {
  const { container } = render(<RouteIcon name={name} />);
  const svg = container.querySelector('svg.route-icon');
  if (!svg) throw new Error(`${name} が svg.route-icon を描いていない`);
  return [...svg.children].map(shapeSignature);
}

describe('iconの図形', () => {
  it('全iconが1つ以上の図形を描く(空のiconは「一意」を自明に満たしてしまう)', () => {
    for (const name of ROUTE_ICON_NAMES) {
      expect(iconShapes(name).length, `${name} に図形がない`).toBeGreaterThan(0);
    }
  });

  it('2つのiconが同一の図形集合になっていない', () => {
    const byGeometry = new Map<string, string[]>();
    for (const name of ROUTE_ICON_NAMES) {
      // 図形の並び順は絵に影響しないので、順序を揃えてから比べる
      const key = [...iconShapes(name)].sort().join('|');
      byGeometry.set(key, [...(byGeometry.get(key) ?? []), name]);
    }
    const duplicated = [...byGeometry.values()].filter((names) => names.length > 1);
    expect(duplicated, `同じ絵に別のキーが付いている: ${JSON.stringify(duplicated)}`).toEqual([]);
    expect(byGeometry.size).toBe(ROUTE_ICON_NAMES.length);
  });

  it('片方のiconがもう片方の図形をすべて含んでいない', () => {
    // 完全一致だけを見ると「A に線を1本足しただけの B」を通してしまう。
    // 20px では足した1本が消えて同じ絵に見えるので、包含も落とす。
    const shapes = new Map(ROUTE_ICON_NAMES.map((name) => [name, new Set(iconShapes(name))]));
    const contained: string[] = [];
    for (const [a, shapesOfA] of shapes) {
      for (const [b, shapesOfB] of shapes) {
        if (a === b) continue;
        if ([...shapesOfA].every((shape) => shapesOfB.has(shape))) contained.push(`${a} ⊂ ${b}`);
      }
    }
    expect(contained).toEqual([]);
  });

  it('ナビとタブが使うicon名はすべて登録済みで、重複しない', () => {
    // 支出分析のタブも Cmd+K の候補とタブ見出しに icon を出すので、同じ一意性の対象
    const used = [...APP_ROUTES, ...ANALYSIS_TABS].map((route) => route.icon);
    for (const name of used) expect(ROUTE_ICON_NAMES).toContain(name);
    expect(new Set(used).size).toBe(used.length);
  });

  it('登録されているiconに使われていないものがない', () => {
    // 使われないiconが残ると、上の一意性検査が実画面と関係のない図形まで守り始める
    const used = new Set<string>([...APP_ROUTES, ...ANALYSIS_TABS].map((route) => route.icon));
    expect(ROUTE_ICON_NAMES.filter((name) => !used.has(name))).toEqual([]);
  });
});
