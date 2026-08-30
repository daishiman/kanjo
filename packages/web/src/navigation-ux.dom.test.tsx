// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';
import { APP_ROUTES, MOBILE_ROUTES } from './routeMetadata.js';

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

    expect(routeLinks).toHaveLength(APP_ROUTES.length);
    for (const [index, link] of routeLinks.entries()) {
      expect(link.textContent).toContain(APP_ROUTES[index]?.label);
      const icon = link.querySelector('svg.route-icon');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(icon?.getAttribute('focusable')).toBe('false');
    }
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
