// @vitest-environment jsdom

/**
 * 支出分析ハブ (/analysis) の表示契約 (AC-001 / AC-002 / AC-003 / FR-006)。
 *
 * 実装より先に書く赤いテスト (SYS-ANHUB-P04)。実装は SYS-ANHUB-P05 が
 * `packages/web/src/pages/Analysis.tsx` と `routeMetadata.ts` に置く。
 *
 * 固定するもの:
 *   - /analysis がタブへ転送されず、ハブの構成要素を描くこと
 *   - ?focus= の再現・行選択での置換・不正値の既定化
 *   - URL コピーが期間や金額を載せず、成否を role=status で伝えること
 *   - ハブ表示中は集約 API 1 本だけを呼び、5 タブの API を呼ばないこと
 *   - サイドバー子行の件数バッジが集約応答の要確認件数と一致すること (AC-005)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './components/Layout.js';
import { AnalysisPage } from './pages/Analysis.js';
import { PeriodProvider } from './period.js';
import { ANALYSIS_TABS } from './routeMetadata.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

/** 架空の集約応答。総収支だけ要確認 2 件 */
const HUB = {
  period: {
    applied: { from: '2026-08', to: '2026-08' },
    label: '2026年8月',
    full: { from: '2026-01', to: '2026-08' },
    years: ['2026'],
    monthCount: 1,
  },
  summary: {
    income: 500_000,
    expense: 320_000,
    net: 180_000,
    previous: {
      label: '前1か月',
      range: { from: '2026-07', to: '2026-07' },
      months: 1,
      income: 480_000,
      expense: 300_000,
      net: 180_000,
    },
    change: { income: 0.0417, expense: 0.0667, net: 0 },
  },
  views: {
    reconciliation: {
      id: 'reconciliation',
      priority: '中',
      count: 0,
      actionRequiredCount: 0,
      reviewCount: 0,
    },
    'total-cashflow': { id: 'total-cashflow', priority: '高', count: 2, reviewCount: 2 },
    matrix: { id: 'matrix', priority: '中', count: 0, unrecordedMonths: 0, normal: true },
    trends: { id: 'trends', priority: '中', count: 0, expenseChange: 0.0667 },
    diagnosis: { id: 'diagnosis', priority: '中', count: 1, annualSavings: 36_000, candidateCount: 1 },
  },
};

/** タブ側の画面が空で描き切れる応答 (analysis-tabs.dom.test.tsx と同じ形) */
const EMPTY: Record<string, unknown> = {
  months: [],
  unrecordedExpMonths: [],
  years: [],
  rows: [],
  entries: [],
  recordedMonths: [],
};

/** 5 タブが呼ぶ既存 API。ハブ表示中はどれも呼ばれてはならない */
const TAB_API_PATTERNS = [
  '/expense-projection',
  '/reconciliation',
  '/total-cashflow',
  '/matrix',
  '/trends',
  '/business-spend',
  '/diagnosis',
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function LocationProbe() {
  const location = useLocation();
  // 行選択は履歴を積まない (戻るでハブの外へ出られるように)。PUSH / REPLACE を見える形にする
  const navigationType = useNavigationType();
  // <output> は暗黙に role=status を持ち、URL コピーの結果通知と区別できなくなるので div にする
  return (
    <div data-testid="location" data-navigation-type={navigationType}>
      {`${location.pathname}${location.search}`}
    </div>
  );
}

type HubResponder = (url: string, callIndex: number) => Response | Promise<Response>;

function renderHub(path = '/analysis', responder?: HubResponder) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      calls.push(url);
      if (responder) return responder(url, calls.length);
      const body = url.startsWith('/api/analysis/hub') ? HUB : EMPTY;
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/analysis/:tab" element={<AnalysisPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

const location = () => screen.getByTestId('location').textContent;

describe('支出分析ハブ', () => {
  it('/analysis はタブへ転送せず、ハブの構成要素を描く', async () => {
    renderHub();
    expect(await screen.findByRole('heading', { name: '支出のどこから確認しますか？' })).toBeTruthy();
    expect(location()).toBe('/analysis');

    expect(screen.getByRole('button', { name: 'このページのURLをコピー' })).toBeTruthy();

    const tabs = screen.getByRole('navigation', { name: '支出分析の切り口' });
    expect([...tabs.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(
      ANALYSIS_TABS.map((tab) => tab.path),
    );

    const summary = screen.getByRole('region', { name: '収支サマリー' });
    // 金額はサーバ応答をそのまま表示する (クライアントで数え直さない)
    expect(await within(summary).findByText(/500,000/)).toBeTruthy();
    expect(within(summary).getByText(/320,000/)).toBeTruthy();
    expect(within(summary).getByText('¥180,000', { selector: '.analysis-hub-kpi-value' })).toBeTruthy();
    expect(within(summary).getAllByText(/前1か月/)).toHaveLength(3);

    const routes = screen.getByRole('list', { name: '分析ルート' });
    const rows = within(routes).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    for (const tab of ANALYSIS_TABS) {
      const open = within(routes).getByRole('link', { name: `${tab.label}を開く` });
      expect(open.getAttribute('href')).toBe(tab.path);
    }
    // 優先度は色だけに頼らず文字で出す
    expect(within(rows[1] as HTMLElement).getByText('高')).toBeTruthy();

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['段階', '分析の視点', '目的', '現在の状態', '優先度', '次の操作']);

    const steps = screen.getByRole('list', { name: '読み順' });
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('差異を消す'),
      expect.stringContaining('全体を掴む'),
      expect.stringContaining('偏りを見る'),
      expect.stringContaining('変化を追う'),
      expect.stringContaining('行動を決める'),
    ]);
  });

  it('照合の現在状態は一致候補がなく未処理だけでも actionRequiredCount を表示する', async () => {
    const unprocessedOnly = {
      ...HUB,
      views: {
        ...HUB.views,
        reconciliation: {
          ...HUB.views.reconciliation,
          priority: '高',
          count: 2,
          actionRequiredCount: 2,
          reviewCount: 0,
        },
      },
    };
    renderHub('/analysis', (url) => {
      const body = url.startsWith('/api/analysis/hub') ? unprocessedOnly : EMPTY;
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    });

    expect((await screen.findAllByText('要確認あり 2件')).length).toBeGreaterThan(0);
    const row = within(screen.getByRole('table')).getByRole('row', { name: /照合/ });
    expect(within(row).getByText('要確認あり 2件')).toBeTruthy();
    expect(within(row).queryByText('要確認なし')).toBeNull();
  });

  it('選択中の分析パネルは「わかること・主なデータソース・対象外のデータ」を出す', async () => {
    renderHub();
    const panel = await screen.findByRole('complementary', { name: '選択中の分析' });
    expect(within(panel).getByText('この分析でわかること')).toBeTruthy();
    expect(within(panel).getByText('主なデータソース')).toBeTruthy();
    expect(within(panel).getByText('対象外のデータ')).toBeTruthy();
  });

  it('?focus=total-cashflow で総収支の行・右パネル・下部バーが選択状態になる', async () => {
    renderHub('/analysis?focus=total-cashflow');
    const routes = await screen.findByRole('list', { name: '分析ルート' });
    const selected = within(routes)
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('総収支');

    const panel = screen.getByRole('complementary', { name: '選択中の分析' });
    expect(within(panel).getByRole('heading', { name: '総収支' })).toBeTruthy();
    expect(within(panel).getByText('銀行口座の取引')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: '総収支を開く' }).getAttribute('href')).toBe(
      '/analysis/total-cashflow',
    );

    const tabs = screen.getByRole('navigation', { name: '支出分析の切り口' });
    expect(within(tabs).getByRole('link', { name: '総収支の詳細を開く' }).getAttribute('aria-current')).toBe(
      'step',
    );
    const journey = screen.getByRole('list', { name: '読み順' });
    expect(within(journey).getByText('全体を掴む').closest('li')?.getAttribute('aria-current')).toBe('step');

    const bar = screen.getByRole('region', { name: '選択中の分析の操作' });
    expect(within(bar).getByRole('link', { name: '総収支を開く' }).getAttribute('href')).toBe(
      '/analysis/total-cashflow',
    );
  });

  it('不正な focus は既定 (照合) として扱う', async () => {
    renderHub('/analysis?focus=../../etc');
    const panel = await screen.findByRole('complementary', { name: '選択中の分析' });
    expect(within(panel).getByRole('heading', { name: '照合' })).toBeTruthy();
    // 見出しだけでなく、行の選択状態も既定に揃う (不正値のまま比較すると 1 行も選ばれない)
    const selected = within(screen.getByRole('list', { name: '分析ルート' }))
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'true');
    expect(selected.map((item) => item.textContent)).toEqual([expect.stringContaining('照合')]);
  });

  it('行を選ぶと URL の focus が置き換わる', async () => {
    renderHub('/analysis');
    const routes = await screen.findByRole('list', { name: '分析ルート' });
    const matrix = within(routes)
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('aria-label') === 'マトリックスの説明を選ぶ');
    expect(matrix).toBeTruthy();
    fireEvent.click(matrix as HTMLElement);

    await waitFor(() => expect(location()).toBe('/analysis?focus=matrix'));
    expect(screen.getByTestId('location').dataset.navigationType).toBe('REPLACE');
    const panel = screen.getByRole('complementary', { name: '選択中の分析' });
    expect(within(panel).getByRole('heading', { name: 'マトリックス' })).toBeTruthy();
  });

  it('表の分析視点・目的・状態・優先度セルをクリックすると、その行の分析を選ぶ', async () => {
    renderHub('/analysis');
    const table = await screen.findByRole('table');
    const row = (label: string) => within(table).getByRole('row', { name: new RegExp(label) });

    fireEvent.click(within(row('総収支')).getByRole('rowheader'));
    await waitFor(() => expect(location()).toBe('/analysis?focus=total-cashflow'));

    fireEvent.click(within(row('マトリックス')).getAllByRole('cell')[1] as HTMLElement);
    await waitFor(() => expect(location()).toBe('/analysis?focus=matrix'));
    expect(
      within(screen.getByRole('complementary', { name: '選択中の分析' })).getByRole('heading', {
        name: 'マトリックス',
      }),
    ).toBeTruthy();

    fireEvent.click(within(row('推移')).getAllByRole('cell')[2] as HTMLElement);
    await waitFor(() => expect(location()).toBe('/analysis?focus=trends'));

    fireEvent.click(within(row('診断')).getAllByRole('cell')[3] as HTMLElement);
    await waitFor(() => expect(location()).toBe('/analysis?focus=diagnosis'));
  });

  it('モバイルカードの余白をクリックすると分析を選ぶ', async () => {
    renderHub('/analysis');
    const routes = await screen.findByRole('list', { name: '分析ルート' });
    const matrixCard = within(routes)
      .getAllByRole('listitem')
      .find((item) => within(item).queryByRole('link', { name: 'マトリックスを開く' }));
    expect(matrixCard).toBeTruthy();

    fireEvent.click(matrixCard as HTMLElement);

    await waitFor(() => expect(location()).toBe('/analysis?focus=matrix'));
  });

  it('デスクトップ表の行はキーボードでも選べ、フォーカス対象は行1つにまとまる', async () => {
    renderHub('/analysis');
    const matrixRow = within(await screen.findByRole('table')).getByRole('row', { name: /マトリックス/ });
    expect(matrixRow.tabIndex).toBe(0);
    expect(within(matrixRow).queryByRole('button')).toBeNull();

    matrixRow.focus();
    fireEvent.keyDown(matrixRow, { key: 'Enter' });

    await waitFor(() => expect(location()).toBe('/analysis?focus=matrix'));
  });

  it('行末 CTA は行選択を発火せず、詳細の pathname だけへ遷移する', async () => {
    renderHub('/analysis?focus=reconciliation');
    const table = await screen.findByRole('table');
    const matrixRow = within(table).getByRole('row', { name: /マトリックス/ });

    fireEvent.click(within(matrixRow).getByRole('link', { name: 'マトリックスを開く' }));

    await waitFor(() => expect(location()).toBe('/analysis/matrix'));
    expect(screen.getByTestId('location').dataset.navigationType).toBe('PUSH');
  });

  it('テキストを選択したクリックでは分析を切り替えない', async () => {
    renderHub('/analysis');
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '支出の内訳' } as Selection);
    const matrixRow = within(await screen.findByRole('table')).getByRole('row', { name: /マトリックス/ });

    fireEvent.click(within(matrixRow).getAllByRole('cell')[1] as HTMLElement);

    expect(location()).toBe('/analysis');
  });

  it('主要 CTA は1クリックで選択中の詳細へ遷移する', async () => {
    renderHub('/analysis');
    const action = await screen.findByRole('region', { name: '選択中の分析の操作' });

    fireEvent.click(within(action).getByRole('link', { name: '照合を開く' }));

    await waitFor(() => expect(location()).toBe('/analysis/reconciliation'));
    expect(
      await screen.findByRole('heading', { name: '帳簿と口座の差異を、どこから解消しますか？' }),
    ).toBeTruthy();
  });

  it('API 取得失敗時は集計中を残さず、再読み込み後に復旧する', async () => {
    let hubCalls = 0;
    renderHub('/analysis', (url) => {
      if (!url.startsWith('/api/analysis/hub')) {
        return new Response(JSON.stringify(EMPTY), { headers: { 'Content-Type': 'application/json' } });
      }
      hubCalls += 1;
      if (hubCalls === 1) return new Response('failed', { status: 503 });
      return new Response(JSON.stringify(HUB), { headers: { 'Content-Type': 'application/json' } });
    });

    expect(await screen.findByText(/サーバー側で処理に失敗しました/)).toBeTruthy();
    expect(screen.getAllByText('取得できません')).toHaveLength(10);
    expect(screen.queryByText('集計中')).toBeNull();
    expect(screen.getAllByRole('link', { name: '照合を開く' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }));
    expect(await screen.findByText(/500,000/)).toBeTruthy();
    expect(hubCalls).toBe(2);
  });

  it('空期間は0円と誤表示せず、取込導線と分析リンクを保つ', async () => {
    const emptyHub = {
      ...HUB,
      period: { ...HUB.period, monthCount: 0, label: 'データなし' },
    };
    renderHub('/analysis', (url) => {
      const body = url.startsWith('/api/analysis/hub') ? emptyHub : EMPTY;
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    });

    expect(await screen.findByText('この期間には収支データがありません')).toBeTruthy();
    expect(screen.queryByText('¥0')).toBeNull();
    expect(screen.getByRole('link', { name: 'データを取り込む' }).getAttribute('href')).toBe('/import');
    expect(screen.getAllByText('データなし')).toHaveLength(10);
    expect(screen.getAllByRole('link', { name: '総収支を開く' }).length).toBeGreaterThan(0);
  });

  it('URL コピーは focus だけを載せ、成否を role=status で伝える', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderHub('/analysis?focus=trends');

    fireEvent.click(await screen.findByRole('button', { name: 'このページのURLをコピー' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/analysis?focus=trends`);
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      expect.stringContaining('コピーしました'),
    );
  });

  it('クリップボードへ書けないときは失敗を role=status で伝える', async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderHub('/analysis');

    fireEvent.click(await screen.findByRole('button', { name: 'このページのURLをコピー' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('コピーできませんでした'));
  });

  it('ハブ表示中は集約 API 1 本だけを呼び、5 タブの API を呼ばない', async () => {
    const calls = renderHub('/analysis');
    expect(await screen.findByRole('list', { name: '分析ルート' })).toBeTruthy();
    await waitFor(() => expect(calls.some((url) => url.startsWith('/api/analysis/hub'))).toBe(true));

    const others = calls.filter((url) => !url.startsWith('/api/analysis/hub'));
    expect(others.filter((url) => TAB_API_PATTERNS.some((pattern) => url.includes(pattern)))).toEqual([]);
    expect(calls.filter((url) => url.startsWith('/api/analysis/hub'))).toHaveLength(1);
  });

  it('/analysis/:tab は従来どおりタブを表示し、ハブを描かない', async () => {
    renderHub('/analysis/matrix');
    expect(await screen.findByText('マトリックスのくわしい説明')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '支出のどこから確認しますか？' })).toBeNull();
  });
});

describe('サイドバーの要確認バッジ', () => {
  function renderShell(views: Record<string, unknown>, closeReconciliationCount?: number) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.startsWith('/api/analysis/hub')
          ? { ...HUB, views }
          : url.startsWith('/api/review-queue') && closeReconciliationCount !== undefined
            ? {
                closeStatus: {
                  month: '2026-08',
                  steps: [
                    {
                      key: 'reconciliation',
                      label: '照合',
                      done: closeReconciliationCount === 0,
                      count: closeReconciliationCount,
                    },
                  ],
                  doneCount: closeReconciliationCount === 0 ? 1 : 0,
                  total: 4,
                  reviewedAt: null,
                },
              }
            : { period: HUB.period };
        return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PeriodProvider>
          <MemoryRouter initialEntries={['/analysis']}>
            <Layout>
              <h1>検証本文</h1>
            </Layout>
          </MemoryRouter>
        </PeriodProvider>
      </QueryClientProvider>,
    );
  }

  it('照合は全期間 closeStatus、総収支は期間内 hub の要確認件数を出す', async () => {
    renderShell(
      {
        ...HUB.views,
        reconciliation: { ...HUB.views.reconciliation, count: 3, actionRequiredCount: 3, reviewCount: 0 },
        // 応答に要確認件数らしき値が混ざっても、要確認を持たない視点には出さない
        diagnosis: { ...HUB.views.diagnosis, reviewCount: 4 },
      },
      5,
    );
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    expect(
      (await within(nav).findByTestId('nav-review-badge-reconciliation')).getAttribute('aria-label'),
    ).toBe('要確認5件');
    expect(within(nav).getByTestId('nav-review-badge-total-cashflow').getAttribute('aria-label')).toBe(
      '要確認2件',
    );
    for (const id of ['matrix', 'trends', 'diagnosis']) {
      expect(within(nav).queryByTestId(`nav-review-badge-${id}`)).toBeNull();
    }
    // バッジはリンクの外に置き、リンク名 (タブ名) を変えない
    expect(within(nav).getByRole('link', { name: '照合' })).toBeTruthy();
  });

  it('旧 Worker が closeStatus を返さない間だけ hub の actionRequiredCount へ退避する', async () => {
    renderShell({
      ...HUB.views,
      reconciliation: { ...HUB.views.reconciliation, count: 1, actionRequiredCount: 1, reviewCount: 0 },
      'total-cashflow': { ...HUB.views['total-cashflow'], reviewCount: 0 },
    });
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    // 応答の到着を照合のバッジで待ってから確かめる (到着前の「まだ無い」を 0 件と取り違えない)
    expect(
      (await within(nav).findByTestId('nav-review-badge-reconciliation')).getAttribute('aria-label'),
    ).toBe('要確認1件');
    expect(within(nav).queryByTestId('nav-review-badge-total-cashflow')).toBeNull();
  });
});
