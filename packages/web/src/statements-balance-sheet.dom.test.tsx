// @vitest-environment jsdom

/**
 * 決算書画面の貸借対照表(BS)の表示契約。
 *
 * BSは資産だけ自動で入り、負債は手入力という非対称な作りになっている。
 * だから固定したいのは「入っていないものが、入っているように見えないこと」。
 *   - 負債を入れていない月の純資産は数字を出さない(資産だけで純資産を名乗らない)
 *   - どの月が未入力かを名指しする(全体を見て探させない)
 *   - 空欄のまま保存しても、その種類を0円として送らない
 * 残高がまだ1件も無いときは、代わりに「何を取り込めば作れるか」を出す。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BalanceSheet, StatementsResponse } from './api.js';
import { StatementsPage } from './pages/Statements.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).AccessibleChart,
}));

const LIABILITY_OPTIONS = ['クレジットカード未払金', '借入金', '未払金・買掛金', 'その他の負債'];

const emptyBs: BalanceSheet = {
  months: [],
  assetCategories: [],
  liabilityCategories: [],
  monthsWithoutLiabilities: [],
  limits: [],
};

/** 7月は負債入力済み、8月は未入力かつ月末前 */
const bs: BalanceSheet = {
  months: [
    {
      month: '2026-07',
      asOf: '2026-07-31',
      partial: false,
      assets: [{ category: '預金・現金', amount: 400000 }],
      assetTotal: 400000,
      liabilities: [{ category: 'クレジットカード未払金', amount: 150000 }],
      liabilityTotal: 150000,
      netAssets: 250000,
    },
    {
      month: '2026-08',
      asOf: '2026-08-28',
      partial: true,
      assets: [{ category: '預金・現金', amount: 500000 }],
      assetTotal: 500000,
      liabilities: [],
      liabilityTotal: 0,
      netAssets: null,
    },
  ],
  assetCategories: ['預金・現金'],
  liabilityCategories: ['クレジットカード未払金'],
  monthsWithoutLiabilities: ['2026-08'],
  limits: ['資産はマネーフォワードに連携した口座の分だけです'],
};

/**
 * PLは空にする。資産推移CSVだけを入れた直後の状態で、
 * 「仕訳がまだ無いからBSも見せない」にならないことを一緒に確かめる。
 */
const payload = (over: Partial<StatementsResponse> = {}): StatementsResponse =>
  ({
    pl: { months: [] },
    cf: { months: [] },
    bs,
    liabilityCategoryOptions: LIABILITY_OPTIONS,
    balanceSheetSources: [
      {
        step: 1,
        name: '資産推移(全口座の残高)',
        service: 'MF',
        where: '資産 → 資産推移 → CSVダウンロード',
        url: 'https://moneyforward.com/bs/history',
        columns: ['日付', '合計（円）'],
        use: 'BSの資産の部が埋まります。',
      },
    ],
    period: { applied: null, label: '全期間', full: null, years: [], monthCount: 0 },
    ...over,
  }) as unknown as StatementsResponse;

/** PUTの本文を記録する。空欄を0円として送っていないかを見るため */
function renderWith(over: Partial<StatementsResponse> = {}) {
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(payload(over)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StatementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return puts;
}

/** 行見出しから、その行の各月のセルを取り出す */
const rowCells = (label: string) => {
  const table = screen.getByRole('table', { name: '貸借対照表の月別明細' });
  const head = within(table).getByRole('rowheader', { name: label });
  return [...(head.closest('tr')?.querySelectorAll('td') ?? [])].map((td) => td.textContent);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('決算書のBS', () => {
  it('負債を入れた月だけ純資産を出し、入れていない月は数字を出さない', async () => {
    renderWith();
    await screen.findByText('資産合計');
    expect(rowCells('資産合計')).toEqual(['¥400,000', '¥500,000']);
    // 8月は資産だけ入っている。ここに 500,000 と出ると、借金の無い人の数字に見える
    expect(rowCells('純資産')).toEqual(['¥250,000', '—']);
    expect(screen.getByRole('img', { name: /資産.*負債.*純資産/ })).toBeTruthy();
  });

  it('未入力の月を名指しする', async () => {
    renderWith();
    await screen.findByText(/未入力/);
    expect(screen.getByText(/未入力/).textContent).toContain('8月');
  });

  it('月末前の月には、何日時点かを添える', async () => {
    renderWith();
    const august = await screen.findByRole('columnheader', { name: /8月/ });
    expect(august.textContent).toContain('2026-08-28時点');
    // 月末に達している7月には要らない
    expect(screen.getByRole('columnheader', { name: /7月/ }).textContent).not.toContain('時点');
  });

  it('空欄の種類は送らない(0円として保存しない)', async () => {
    const puts = renderWith();
    await screen.findByText('負債を入れる');
    fireEvent.change(screen.getByLabelText('借入金'), { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: 'この月の負債を保存' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ month: '2026-08', lines: [{ category: '借入金', amount: 30000 }] });
  });

  it('数字でない金額のままでは保存させない', async () => {
    renderWith();
    await screen.findByText('負債を入れる');
    fireEvent.change(screen.getByLabelText('借入金'), { target: { value: '3万' } });
    expect((screen.getByRole('button', { name: 'この月の負債を保存' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/0以上の整数/)).toBeTruthy();
  });

  it('残高が1件も無いときは、表の代わりに取込元を出す', async () => {
    renderWith({ bs: emptyBs });
    await screen.findByText(/はまだ作れません/);
    expect(screen.queryByText('負債を入れる')).toBeNull();
    // 書き出す場所は、探させずにそのまま開けるようにする
    const link = screen.getByRole('link', { name: 'https://moneyforward.com/bs/history' });
    expect(link.getAttribute('href')).toBe('https://moneyforward.com/bs/history');
  });
});
