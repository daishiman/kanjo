// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';

/** サイドバーの件数バッジと月次クローズは、どの画面でも /review-queue の同じ応答から描く */
const REVIEW_QUEUE = {
  total: 5,
  counts: { import: 1, classification: 4 },
  snoozedCount: 0,
  items: [],
  subscriptionCandidates: 2,
  closeStatus: {
    month: '2026-08',
    doneCount: 3,
    total: 4,
    reviewedAt: null,
    steps: [
      { key: 'import', label: 'データ取込', done: true, count: 0 },
      { key: 'classify', label: '仕分け', done: true, count: 0 },
      { key: 'reconcile', label: '照合', done: true, count: 0 },
      { key: 'review', label: '月次レビュー', done: false, count: null },
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes('/imports')
        ? { imports: [{ id: 1, filename: 'sample.csv', createdAt: '2026-09-10T02:30:00.000Z' }] }
        : path.includes('/review-queue')
          ? REVIEW_QUEUE
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
    renderLayout('/analysis/reconciliation');
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const groups = [...nav.querySelectorAll('.nav-group')].map((node) => node.textContent);
    expect(groups).toEqual(['取込', '整える', '確認', '計画', '管理']);
    const current = screen.getByRole('navigation', { name: '現在地' });
    expect([...current.querySelectorAll('span')].map((node) => node.textContent)).toEqual([
      '確認',
      '支出分析',
      '照合',
    ]);
  });

  it('サイドバーの文言を業務の呼び名に揃え、支出分析と決算書に子へ進む印を付ける', () => {
    renderLayout('/analysis/reconciliation');
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const labels = [...nav.querySelectorAll(':scope > div > a .nav-label')].map((node) => node.textContent);
    expect(labels).toEqual([
      '概要',
      'データ取込',
      '現金入力',
      '明細仕分け',
      'サブスク',
      '累計収支',
      '支出分析',
      '決算書',
      'AI分析',
      '予算',
      'トレードオフ',
      '設定',
      '使い方',
      '改善リクエスト',
    ]);
    for (const name of ['支出分析', '決算書']) {
      const chevron = within(nav).getByRole('link', { name }).querySelector('.nav-chevron');
      expect(chevron?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(within(nav).getByRole('link', { name: '概要' }).querySelector('.nav-chevron')).toBeNull();
  });

  it('データ取込・明細仕分け・サブスクの件数バッジを /review-queue の同じ応答から出す', async () => {
    renderLayout('/analysis/reconciliation');
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const badge = (name: string) =>
      within(nav)
        .getByRole('link', { name: new RegExp(`^${name}`) })
        .querySelector('.nav-badge')?.textContent;
    await waitFor(() => expect(badge('データ取込')).toBe('未処理 1 件'));
    expect(badge('明細仕分け')).toBe('未処理 4 件');
    expect(badge('サブスク')).toBe('未処理 2 件');
  });

  it('月次クローズの進捗 3/4 を概要以外の画面のサイドバーにも出し、汎用の進捗は重ねない', async () => {
    for (const path of ['/analysis/reconciliation', '/settings']) {
      const view = renderLayout(path);
      const sidebar = screen.getByRole('complementary');
      const card = await within(sidebar).findByRole('region', { name: '月次クローズの進捗' });
      expect(await within(card).findByText('3/4')).toBeTruthy();
      expect(
        within(card).getByRole('progressbar', { name: '月次クローズ' }).getAttribute('aria-valuenow'),
      ).toBe('3');
      expect(screen.queryByRole('region', { name: '月次進捗' })).toBeNull();
      view.unmount();
    }
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
    // 用語ホバーで文字が要素に分かれるので、ヘッダー全体の文字列で確かめる
    await waitFor(() => expect(header.textContent).toContain('防衛ライン：正常'));
    expect(header.textContent).toContain('未記録 1か月');
    // 検索・使い方・アバターはアイコンボタン。名前は読み上げ用にだけ残す
    for (const action of [
      within(header).getByRole('button', { name: '画面を検索' }),
      within(header).getByRole('link', { name: '使い方' }),
      within(header).getByRole('button', { name: '利用者メニュー' }),
    ]) {
      expect(action.querySelector('.action-icon')).toBeTruthy();
      expect(action.querySelector('.header-action-label')).toBeNull();
    }
  });

  it('ブランド・状態・共通操作・信頼情報を装飾文字ではなく一貫した図記号で示す', async () => {
    renderLayout('/');
    const sidebar = screen.getByRole('complementary');
    const header = screen.getByRole('banner');
    const footer = screen.getByRole('contentinfo');

    expect(sidebar.querySelector('.brand-mark')).toBeTruthy();
    await waitFor(() => expect(header.querySelector('.header-defense .status-icon')).toBeTruthy());
    expect(header.querySelectorAll('.action-icon').length).toBeGreaterThanOrEqual(4);
    expect(footer.querySelectorAll('.trust-icon')).toHaveLength(3);
  });

  it('信頼の前提と確認先を全画面のフッターに残す', () => {
    renderLayout('/');
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('外部送信しません');
    expect(footer.textContent).toContain('税務上の正本はfreee');
    expect(footer.textContent).toContain('毎晩バックアップ');
    expect(within(footer).getByRole('link', { name: 'データ出典' })).toBeTruthy();
    const links = screen.getByRole('navigation', { name: '信頼とデータの確認先' });
    expect(
      [...links.children].map((node) => node.querySelector('summary')?.textContent ?? node.textContent),
    ).toEqual(['利用規約', 'プライバシー', 'データ出典', 'v1.0']);
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
