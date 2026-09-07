// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';
import { ANALYSIS_TABS, APP_ROUTES, MOBILE_ROUTES, type SearchRoute } from './routeMetadata.js';

/**
 * サイドバーに出る順。支出分析の直後に、その 5 つのタブが子として続く。
 * 「サイドバーからトータル収支へ行けない」への答えなので、順序ごと固定する。
 */
const SIDEBAR_LINKS: readonly SearchRoute[] = APP_ROUTES.flatMap((route): SearchRoute[] =>
  route.id === 'analysis' ? [route, ...ANALYSIS_TABS] : [route],
);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderLayout(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]}>
          <Layout>
            <h1>匿名の検証画面</h1>
          </Layout>
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

describe('現在地の一意性', () => {
  it.each(APP_ROUTES.map((route) => [route.path, route.label] as const))(
    '%sでは現在ページだけがcurrentになる',
    (path, label) => {
      renderLayout(path);
      const sidebar = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      const current = sidebar.querySelectorAll('[aria-current="page"]');

      expect(current).toHaveLength(1);
      expect(current[0]?.textContent).toContain(label);
    },
  );

  /*
    「トータル収支を確認する画面へは、どう行けばいいですか。サイドバーから行けないのですが」
    への答え。タブの名前がサイドバーのどこにも無いと、支出分析へ降りてタブを押し直す道しか
    残らず、その道は画面に着くまで見えない。
  */
  it('支出分析のタブがサイドバーから直接押せる', () => {
    renderLayout('/');
    const sidebar = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    for (const tab of ANALYSIS_TABS) {
      expect(within(sidebar).getByRole('link', { name: tab.label }).getAttribute('href')).toBe(tab.path);
    }
  });

  it('タブを開いているときは、その子だけが現在地になる', () => {
    // 親子で aria-current="page" が 2 つ立つと「いま開いている頁」が 2 つあることになる
    renderLayout('/analysis/total-cashflow');
    const sidebar = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const current = sidebar.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('トータル収支');
  });

  it('現在地の表現はaria-currentだけで、既定の.activeを重ねない', () => {
    // NavLink は className を文字列で渡すと .active も足す。下部タブでは .active が
    // 「ドロワーが開いている」の表現でもあるため、同じclassが2つの意味を持ってしまう
    renderLayout('/classify');
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(2); // サイドバーと下部タブに1つずつ
    for (const link of current) expect(link.classList.contains('active')).toBe(false);
    expect(document.querySelectorAll('.active')).toHaveLength(0);
  });

  it('ドロワーを開いたときだけ.activeが付き、それはメニューボタンだけ', () => {
    renderLayout('/classify');
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    const active = document.querySelectorAll('.active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe('メニュー');
  });
});

// icon の一意性は route-icon-distinct.test.tsx へ移した。ここにあった検査は
// 「icon キーの文字列が重複しない」だけで、キーさえ違えば同じ絵でも通っていた。
// 守っているつもりの契約(利用者が見分けられること)は実在していなかったので、
// 実際に描いた図形どうしを比べる検査に置き換えている。
describe('routeのiconとlabel', () => {
  it('desktop navはiconを装飾として隠し、可視labelをリンク名にする', () => {
    renderLayout('/');
    const navigation = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const routeLinks = within(navigation).getAllByRole('link');

    // 業務ルート(支出分析の子タブを含む)が先頭に並び、その後ろに「その他」として改善要望が1件だけ続く
    expect(routeLinks).toHaveLength(SIDEBAR_LINKS.length + 1);
    for (const [index, link] of routeLinks.slice(0, SIDEBAR_LINKS.length).entries()) {
      expect(link.textContent).toContain(SIDEBAR_LINKS[index]?.label);
      const icon = link.querySelector('svg.route-icon');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(icon?.getAttribute('focusable')).toBe('false');
    }
    const extra = routeLinks[SIDEBAR_LINKS.length];
    expect(extra.textContent).toContain('改善要望');
    expect(extra.querySelector('svg.route-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('bottom tabは同じrouteのsidebarと同一のiconを描き、labelはmobileLabelになる', () => {
    // 「同じicon」は NavItem の抽出で構造上そうなったが、利用者に見えている契約は
    // 「同じ画面はどちらのナビでも同じ絵」なので、実DOMの一致として残す
    renderLayout('/');
    const sidebar = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const tabbar = screen.getByRole('navigation', { name: 'モバイルナビゲーション' });
    const routeTabs = within(tabbar).getAllByRole('link');

    expect(routeTabs).toHaveLength(MOBILE_ROUTES.length);
    for (const [index, tab] of routeTabs.entries()) {
      const route = MOBILE_ROUTES[index];
      expect(tab.textContent).toBe(route?.mobileLabel);
      const tabIcon = tab.querySelector('svg.route-icon');
      const sidebarIcon = within(sidebar)
        .getByRole('link', { name: route?.label })
        .querySelector('svg.route-icon');
      expect(tabIcon?.getAttribute('aria-hidden')).toBe('true');
      expect(tabIcon?.innerHTML).toBe(sidebarIcon?.innerHTML);
    }
  });

  it('drawerはEscapeで閉じられる', () => {
    renderLayout('/');
    const trigger = screen.getByRole('button', { name: 'メニュー' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

// ナビの視覚契約(44pxの行、iconとlabelの間隔、tab iconの寸法、色以外の現在地手掛かり、
// reduced-motion)は scripts/check-mobile-layout.mjs の実描画へ移した。
// styles.css を正規表現で見る検査は「宣言があること」しか言えず、カスケードで上書きされて
// 実際には効いていない場合を通してしまう(thead-render.test.ts と同じ失敗の型)。
// このファイルは jsdom で見える構造契約だけを持つ。
