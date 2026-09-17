// @vitest-environment jsdom

/**
 * 支出分析(照合・総収支・マトリクス・推移・診断の統合先)の表示契約。
 *
 * 3画面を1画面へ束ねたので、束ねたことで壊れやすいものだけを固定する:
 *   - 切り口がURLに出ること(戻る/進む・リロード・ブックマークが効く)
 *   - 詳細画面では共通サイドバーと同じ切り口ナビを本文に重ねないこと
 *   - 表示していないタブのAPIを呼ばないこと(束ねた瞬間に3倍遅くなるのを防ぐ)
 *   - 各タブの説明文が残っていること(画面を消すと説明ごと消えるのが一番起きやすい退行)
 *   - 旧URLが行き先を失っていないこと
 *   - タブ名の無い /analysis はハブ、綴りの違うタブ名は既定タブへ寄ること
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from './pages/Analysis.js';
import { ANALYSIS_TABS, LEGACY_ROUTE_REDIRECTS } from './routeMetadata.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

const EMPTY: Record<string, unknown> = {
  months: [],
  unrecordedExpMonths: [],
  years: [],
  rows: [],
  entries: [],
  recordedMonths: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 呼ばれたAPIのパスを記録しながら、どのタブでも「空」で描き切れる応答を返す */
function renderAt(path: string) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      calls.push(String(input));
      return new Response(JSON.stringify(EMPTY), { headers: { 'Content-Type': 'application/json' } });
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
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

describe('支出分析のルート', () => {
  it('総収支は問いとデータの見方を本文より前に出し、共通の支出分析説明を重ねない', () => {
    renderAt('/analysis/total-cashflow');

    const heading = screen.getByRole('heading', {
      level: 1,
      name: '家計と事業を合わせた、本当の収支はいくらですか？',
    });
    const lead = screen.getByText(
      '家計と事業の収入・支出を月次で確認し、重複や除外を調整した実質的な収支を把握しましょう。',
    );
    const guide = screen.getByText('データの見方').closest('details');
    const panel = screen.getByRole('region', { name: '総収支' });

    expect(guide).not.toBeNull();
    for (const item of [heading, lead, guide!]) {
      expect(item.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(screen.queryByRole('navigation', { name: '支出分析の切り口' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '支出分析' })).toBeNull();
    expect(screen.queryByText('帳簿と実際の支出を照合し、次に手を打つ場所を決めます。')).toBeNull();
  });

  it('切り口はURLに出し、詳細本文に共通ナビを二重表示しない', async () => {
    renderAt('/analysis/trends');
    expect(await screen.findByText(/集計できる月がありません/)).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: '収支は、いつ・なぜ変わりましたか？' }),
    ).toBeTruthy();
    expect(screen.getByText(/増減のタイミングや要因を把握しましょう/)).toBeTruthy();
    expect(screen.queryByText('推移のくわしい説明')).toBeNull();
    expect(screen.queryByRole('navigation', { name: '支出分析の切り口' })).toBeNull();
    expect(new Set(ANALYSIS_TABS.map((tab) => tab.path)).size).toBe(ANALYSIS_TABS.length);
    expect(ANALYSIS_TABS.find((tab) => tab.id === 'trends')?.path).toBe('/analysis/trends');
  });

  it('表示していないタブのAPIは呼ばない', async () => {
    const calls = renderAt('/analysis/diagnosis');
    expect(await screen.findByText(/診断できるデータが未取込です/)).toBeTruthy();

    expect(calls.some((url) => url.includes('/diagnosis'))).toBe(true);
    expect(calls.some((url) => url.includes('/matrix'))).toBe(false);
    expect(calls.some((url) => url.includes('/trends'))).toBe(false);
    expect(calls.some((url) => url.includes('/business-spend'))).toBe(false);
  });

  it('タブごとの説明文が残っていて、用語ホバーが効く', async () => {
    renderAt('/analysis/matrix');
    expect(await screen.findByText(/比較するデータが未取込です/)).toBeTruthy();

    // 統合前は route の taskDetail として出ていた文。消すと「増=赤」が誰にも伝わらない
    const detail = screen.getByText('マトリクスのくわしい説明').closest('details');
    expect(detail?.textContent).toContain('増=赤');
    expect(detail?.querySelectorAll('.term').length ?? 0).toBeGreaterThan(0);
  });

  it('タブ名の無いURLはハブを出し、綴りの違うURLは既定のタブへ寄せる', async () => {
    // /analysis はどこから見るかを決めるハブ (SYS-ANHUB)。タブへは転送しない
    renderAt('/analysis');
    expect(await screen.findByRole('heading', { name: '支出のどこから確認しますか？' })).toBeTruthy();
    cleanup();

    renderAt('/analysis/nonexistent');
    expect(await screen.findByText(/照合できる取引がまだありません/)).toBeTruthy();
  });

  it('統合前のURLは行き先を失わない', () => {
    expect(LEGACY_ROUTE_REDIRECTS.map((r) => r.from)).toEqual([
      '/reconciliation',
      '/matrix',
      '/trends',
      '/diagnosis',
    ]);
    // 転送先は実在するタブに限る。統合後に増えたタブ(単独URLを持ったことがない画面)は
    // 転送元を持たないので、旧URLとタブの数は一致しない
    const paths = new Set<string>(ANALYSIS_TABS.map((tab) => tab.path));
    expect(LEGACY_ROUTE_REDIRECTS.filter((r) => !paths.has(r.to))).toEqual([]);
  });
});
