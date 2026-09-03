// @vitest-environment jsdom

/**
 * 支出分析(増減マトリクス・支出トレンド・統計診断の統合先)の表示契約。
 *
 * 3画面を1画面へ束ねたので、束ねたことで壊れやすいものだけを固定する:
 *   - 切り口がURLに出ること(戻る/進む・リロード・ブックマークが効く)
 *   - 表示していないタブのAPIを呼ばないこと(束ねた瞬間に3倍遅くなるのを防ぐ)
 *   - 各タブの説明文が残っていること(画面を消すと説明ごと消えるのが一番起きやすい退行)
 *   - 旧URLが行き先を失っていないこと
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from './pages/Analysis.js';
import { ANALYSIS_TABS, LEGACY_ROUTE_REDIRECTS } from './routeMetadata.js';

vi.mock('react-chartjs-2', () => ({ Chart: () => null }));

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

describe('支出分析のタブ', () => {
  it('切り口はURLに出て、現在のタブだけが現在地になる', async () => {
    renderAt('/analysis/trends');
    // パネルは遅延読み込みなので、中身が出るまで待つ
    expect(await screen.findByText(/集計できる月がありません/)).toBeTruthy();

    const tabs = screen.getByRole('navigation', { name: '支出分析の切り口' });
    const links = [...tabs.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(ANALYSIS_TABS.map((tab) => tab.path));
    expect(links.map((a) => a.textContent)).toEqual(ANALYSIS_TABS.map((tab) => tab.label));
    const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('支出トレンド');
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
    const detail = screen.getByText('増減マトリクスのくわしい説明').closest('details');
    expect(detail?.textContent).toContain('増=赤');
    expect(detail?.querySelectorAll('.term').length ?? 0).toBeGreaterThan(0);
  });

  it('タブ名の無いURLと綴りの違うURLは既定のタブへ寄せる', async () => {
    renderAt('/analysis');
    expect(await screen.findByText(/照合できる支出がまだありません/)).toBeTruthy();
    cleanup();

    renderAt('/analysis/nonexistent');
    expect(await screen.findByText(/照合できる支出がまだありません/)).toBeTruthy();
  });

  it('統合前のURLは行き先を失わない', () => {
    expect(LEGACY_ROUTE_REDIRECTS.map((r) => r.from)).toEqual([
      '/reconciliation',
      '/matrix',
      '/trends',
      '/diagnosis',
    ]);
    expect(LEGACY_ROUTE_REDIRECTS.map((r) => r.to)).toEqual(ANALYSIS_TABS.map((tab) => tab.path));
  });
});
