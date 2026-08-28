// @vitest-environment jsdom

/**
 * 予算の年間・着地見込み(FR-04)の表示契約。
 *
 * 月次の「範囲内」が12回続いても年間で収まるとは限らない。
 * 年間予算と着地見込みを並べ、入力中の下書きでも保存後と同じ判定規則で
 * 見えることを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetPage } from './pages/Budget.js';

const payload = {
  budgets: { 広告宣伝費: 10000 },
  table: [
    {
      account: '広告宣伝費',
      type: '変動費',
      recentAvg: 30000,
      budget: 10000,
      diff: 20000,
      judge: '超過',
    },
  ],
  outlook: {
    year: '2026',
    recordedMonths: 6,
    remainingMonths: 6,
    rows: [
      {
        account: '広告宣伝費',
        budget: 10000,
        annualBudget: 120000,
        ytd: 90000,
        recentAvg: 30000,
        landing: 270000,
        diff: 150000,
        judge: '超過',
      },
    ],
    totals: { annualBudget: 120000, ytd: 90000, landing: 270000, diff: 150000 },
  },
};

function renderPage() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BudgetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('予算の年間・着地見込み', () => {
  it('残り月数と着地見込みが、根拠になる実績累計・直近平均と並んで出る', async () => {
    const { container } = renderPage();
    await screen.findByText(/2026年の着地見込み/);
    const heading = container.querySelector('h2:last-of-type')?.textContent ?? '';
    expect(heading).toContain('記帳済み 6ヶ月');
    expect(heading).toContain('残り 6ヶ月');

    const row = container.querySelectorAll('table.stack-sm tbody tr')[0];
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent);
    // 実績累計 / 直近3ヶ月平均 / 着地見込み / 年間予算 / 差異
    expect(cells).toEqual(['広告宣伝費', '¥90,000', '¥30,000', '¥270,000', '¥120,000', '¥150,000', '超過']);
  });

  it('スマホでカード化するため、全セルに見出しラベルが付く', async () => {
    const { container } = renderPage();
    await screen.findByText(/2026年の着地見込み/);
    const tds = [...container.querySelectorAll('table.stack-sm tbody td')];
    expect(tds.length).toBeGreaterThan(0);
    for (const td of tds) expect(td.getAttribute('data-label')).toBeTruthy();
  });

  it('入力中の下書きでも、保存後と同じ判定規則で着地が組み替わる', async () => {
    const { container } = renderPage();
    await screen.findByText(/2026年の着地見込み/);
    // 月次予算を 30,000 に上げる → 年間 360,000。着地 270,000 は 25% 下なので「余裕」へ
    const input = container.querySelector('input.num-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30000' } });

    const row = container.querySelectorAll('table.stack-sm tbody tr')[0];
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells[4]).toBe('¥360,000');
    expect(cells[5]).toBe('−¥90,000');
    expect(cells[6]).toBe('余裕');
  });
});
