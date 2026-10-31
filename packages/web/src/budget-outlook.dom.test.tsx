// @vitest-environment jsdom

/**
 * 予算の来期見通しの表示契約 (spec-budget-screen §保守運用・BR-13・BR-14)。
 *
 * 旧画面の「着地見込み (実績累計 + 直近平均 × 残り月数)」は、新しい画面では
 * 「来期見通し (予算対象の実績月は実績、残りの月は自動提案の按分)」に置き換わった。
 * 着地見込みの式そのものは core の `budgetOutlook` の契約テスト
 * (`packages/core/test/budget-outlook-contract.test.ts`) に残し、ここでは画面が
 * 見通しと過不足を同じ規則で出し、入力中の下書きでも保存後と同じ規則で組み替わることを固定する。
 *
 * 期待値は fixture の数値から手で求めた定数で書く (core の関数で数え直さない)。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の画面は `/api/budget` の月額表と着地見込みを出すだけで、`/api/budget-screen` を読まず、
 * 予算一覧の「見通し」列も過不足カテゴリも持たない。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetPage } from './pages/budget/BudgetPage.js';
import { clearAllBudgetDrafts } from './pages/budget/draft.js';
import { budgetScreenBase, budgetScreenResponse } from './test-support/budget-screen-fixture.js';

/**
 * 広告宣伝費だけ、予算対象 12 か月のうち前半 6 か月に実績 30,000 を持たせる。
 * 自動提案 = 千円丸め(360,000 × 1.1 + 0 + 調整 20,000) = 416,000
 * 残り 6 か月 = 四捨五入(416,000 / 12) = 34,667 ずつ
 * 見通し = 30,000 × 6 + 34,667 × 6 = 388,002
 */
function responseWithActuals() {
  const rows = budgetScreenBase().rows.map((row) =>
    row.account === '広告宣伝費'
      ? { ...row, targetActuals: row.targetActuals.map((_, i) => (i < 6 ? 30_000 : null)) }
      : row,
  );
  return budgetScreenResponse({ rows });
}

function renderPage() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL) => {
      const url = String(req);
      const body = url.includes('/auth/me')
        ? { authenticated: true, user: { id: 'u-test' } }
        : responseWithActuals();
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/budget']}>
        <BudgetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const gapCard = () =>
  screen.getByRole('heading', { name: '予算の過不足カテゴリ (来期見通し)' }).closest('section')!;
const gapRow = (account: string) =>
  within(gapCard()).queryByRole('rowheader', { name: account })?.closest('tr');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearAllBudgetDrafts();
});

describe('予算の来期見通し', () => {
  it('見通しは、実績のある月は実績、残りの月は自動提案の按分で積み上げる', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: '予算一覧' });
    const tr = within(table).getByRole('button', { name: '広告宣伝費' }).closest('tr')!;
    expect(tr.textContent).toContain('388,002');
  });

  it('過不足の差額は 見通し − 来期予算 で、見通しが予算を上回れば増加に並ぶ', async () => {
    renderPage();
    await screen.findByRole('table', { name: '予算一覧' });
    // 保存済みの来期予算 300,000 → 388,002 − 300,000 = +88,002
    const row = gapRow('広告宣伝費');
    expect(row?.textContent).toContain('¥388,002');
    expect(row?.textContent).toContain('+¥88,002');
  });

  it('入力中の下書きでも、保存後と同じ規則で過不足が組み替わる', async () => {
    renderPage();
    await screen.findByRole('table', { name: '予算一覧' });
    // 来期予算を 400,000 に上げる → 388,002 − 400,000 = −11,998。増加から外れ、減少に並ぶ
    fireEvent.change(screen.getByLabelText('広告宣伝費の来期予算'), { target: { value: '400000' } });
    expect(gapRow('広告宣伝費')).toBeFalsy();
    fireEvent.click(within(gapCard()).getByRole('tab', { name: /支出の減少が見込まれる/ }));
    expect(gapRow('広告宣伝費')?.textContent).toContain('−¥11,998');
  });
});
