// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';

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

function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter>
          <Layout>
            <p>本文</p>
          </Layout>
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

describe('ヘッダーの書き出しメニュー', () => {
  it('概要の読込中もモバイル用の防衛線領域を予約する', () => {
    renderLayout();

    const placeholder = document.querySelector('.header-defense-placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
  });

  it('2つの書き出し導線を示し、Escapeで閉じる', () => {
    renderLayout();
    const trigger = screen.getByRole('button', { name: /書き出し/ });

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '統合データJSON',
      'マトリクスCSV',
    ]);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('メニュー外のmousedownで閉じる', () => {
    renderLayout();
    const trigger = screen.getByRole('button', { name: /書き出し/ });

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('本文'));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
