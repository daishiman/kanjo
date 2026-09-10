// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes('/imports')
        ? { imports: [{ id: 1, filename: 'sample.csv', createdAt: '2026-09-10T02:30:00.000Z' }] }
        : {
            overview: { months: ['2026-08'], unrecordedExpMonths: ['2026-08'] },
            defense: { status: 'ok', line: 100000, incomeEstimate: 200000 },
            period: {
              applied: null,
              label: '全期間',
              full: { from: '2025-09', to: '2026-08' },
              years: ['2026', '2025'],
              monthCount: 12,
            },
          };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderLayout(path = '/analysis/total-cashflow', locked = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]}>
          <Layout locked={locked}>
            <h1>検証本文</h1>
          </Layout>
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

describe('全画面共通シェル', () => {
  it('月次業務の順序と現在地を同時に示す', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const groups = [...nav.querySelectorAll('.nav-group')].map((node) => node.textContent);
    expect(groups).toEqual(['取込', '整える', '確認', '計画', '管理']);
    const current = screen.getByRole('navigation', { name: '現在地' });
    expect([...current.querySelectorAll('span')].map((node) => node.textContent)).toEqual([
      '確認',
      '支出分析',
      'トータル収支',
    ]);
  });

  it('期間・状態・検索・出力・ヘルプ・利用者を共通ヘッダーに集約する', async () => {
    renderLayout('/');
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('group', { name: '全体期間' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: '画面を検索' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: /書き出し/ })).toBeTruthy();
    expect(within(header).getByRole('link', { name: '使い方' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: '利用者メニュー' })).toBeTruthy();
    expect(await within(header).findByText(/最終更新/)).toBeTruthy();
  });

  it('信頼の前提と確認先を全画面のフッターに残す', () => {
    renderLayout('/');
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('外部送信しません');
    expect(footer.textContent).toContain('税務上の正本はfreee');
    expect(footer.textContent).toContain('毎晩バックアップ');
    expect(within(footer).getByRole('link', { name: 'データ出典' })).toBeTruthy();
    expect(within(footer).getByRole('link', { name: '復元設定' })).toBeTruthy();
  });

  it('未認証時は同じ骨格を表示し、業務操作をロックする', () => {
    renderLayout('/', true);
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    expect(nav.querySelectorAll('[aria-disabled="true"]').length).toBeGreaterThan(10);
    expect(screen.getByRole('group', { name: '全体期間' }).classList.contains('is-locked')).toBe(true);
    expect((screen.getByRole('button', { name: '画面を検索' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'ヘルプ' }).getAttribute('href')).toBe('#privacy-help');
  });
});
