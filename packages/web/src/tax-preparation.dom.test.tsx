// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaxOverviewResponse, TaxReceiptGapsResponse } from './api.js';
import { ReceiptSourceProfilePanel } from './components/ReceiptSourceProfile.js';
import { TaxReceiptsPage } from './pages/TaxReceipts.js';
import { TaxReturnPage } from './pages/TaxReturn.js';
import { TaxYearProvider } from './tax-year.js';

const receiptSummary = {
  requiredCount: 2,
  attachedCount: 0,
  missingCount: 2,
  mustMissingCount: 1,
  missingAmount: 35_000,
  coverage: 0,
  byUrgency: {
    must: { count: 1, amount: 30_000 },
    should: { count: 1, amount: 5_000 },
    optional: { count: 0, amount: 0 },
  },
};

const overview: TaxOverviewResponse = {
  year: '2025',
  period: {
    applied: { from: '2025-01', to: '2025-12' },
    label: '2025年 1月〜12月',
    full: { from: '2025-01', to: '2025-12' },
    years: ['2025'],
    monthCount: 12,
  },
  statement: {
    months: Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, '0')}`),
    revenue: 100_000,
    printedRows: [],
    blankRows: [],
    separateRows: [],
    unassigned: [{ account: '架空クラウド利用料', gross: 10_000 }],
    expenseTotal: 0,
    privateTotal: 0,
    incomeBeforeDeduction: 100_000,
    limits: [],
  },
  checks: [
    {
      id: 'tax-policy',
      title: '申告方針を確認していない科目がある',
      level: 'blocked',
      detail: '1科目',
      action: '確認する',
      href: '/tax',
    },
  ],
  verdict: 'blocked',
  receipts: receiptSummary,
  settings: [
    {
      account: '架空クラウド利用料',
      status: 'unconfirmed',
      taxAccount: '通信費',
      businessPercent: 100,
      basis: null,
    },
  ],
  taxAccountOptions: { printed: ['通信費'], additional: ['支払手数料'], separate: ['専従者給与'] },
  receiptArchive: { fileCount: 0, maxFilesPerPart: 400, parts: 1 },
  externalReceiptSources: [{ source: 'freee', responsibility: 'external-confirmation' }],
};

const receiptGaps: TaxReceiptGapsResponse = {
  year: '2025',
  period: overview.period,
  summary: receiptSummary,
  checks: overview.checks,
  verdict: 'blocked',
  receiptArchive: overview.receiptArchive,
  externalReceiptSources: overview.externalReceiptSources,
  rows: [
    {
      txId: 'mf-must',
      month: '2025-01',
      date: '2025-01-10',
      description: '架空クラウド 要対応',
      amount: 30_000,
      account: '通信費',
      paymentMethod: 'card',
      attachmentCount: 0,
      waived: false,
      urgency: 'must',
      receiptSource: {
        state: 'resolved',
        profile: {
          profileKey: '架空クラウド要対応::請求ポータル',
          merchantKey: '架空クラウド要対応',
          serviceName: '請求ポータル',
          sourceUrl: 'https://billing.example.test/receipts',
          loginAccount: 'account@example.test',
          memo: '利用明細からダウンロード',
        },
        candidates: [],
        inheritedFrom: '架空クラウド要対応',
        overrideState: 'none',
      },
    },
    {
      txId: 'mf-should',
      month: '2025-02',
      date: '2025-02-10',
      description: '架空クラウド 推奨',
      amount: 5_000,
      account: '通信費',
      paymentMethod: 'card',
      attachmentCount: 0,
      waived: false,
      urgency: 'should',
      receiptSource: {
        state: 'unmatched',
        profile: null,
        candidates: [],
        inheritedFrom: null,
        overrideState: 'none',
      },
    },
  ],
};

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = typeof input === 'string' ? input : String(input);
    const body = path.includes('/tax/receipt-gaps') ? receiptGaps : overview;
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(page: ReactNode) {
  localStorage.setItem('kanjo:tax-year', '2025');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaxYearProvider>
        <MemoryRouter>{page}</MemoryRouter>
      </TaxYearProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('確定申告準備のfail-closed UI', () => {
  it('未確認科目は100%を明示表示し、初回確認だけでも保存できる', async () => {
    mockFetch();
    renderPage(<TaxReturnPage />);

    const percent = (await screen.findByRole('spinbutton', {
      name: '架空クラウド利用料 の事業割合',
    })) as HTMLInputElement;
    expect(percent.value).toBe('100');
    expect(screen.getByText('未確認')).toBeTruthy();
    expect((screen.getByRole('button', { name: '設定を保存' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/100%（全額事業）も確認して保存/)).toBeTruthy();
  });

  it('blocked中はCSV/ZIPのactive linkを出さず、成果物の誤用を防ぐ', async () => {
    mockFetch();
    const { container } = renderPage(<TaxReturnPage />);
    await screen.findByText(/要対応を解消するとCSVを書き出せます/);

    expect(container.querySelector('a[href*="/api/export/tax/"]')).toBeNull();
    expect(screen.getByText(/申告書の生成や法令適合を保証するものではありません/)).toBeTruthy();
  });
});

describe('証憑作業キュー', () => {
  it('対象年だけを問い合わせ、初期表示をmustにし、作業中も戻れる', async () => {
    const fetchMock = mockFetch();
    renderPage(<TaxReceiptsPage />);

    expect(await screen.findByText('架空クラウド 要対応')).toBeTruthy();
    expect(screen.queryByText('架空クラウド 推奨')).toBeNull();
    expect(screen.getByRole('button', { name: '要対応(1)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: /2025年の確定申告の準備へ戻る/ })).toBeTruthy();
    expect(screen.getByText(/freeeで記帳した仕訳の証憑はfreee側で確認/)).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/tax/receipt-gaps?year=2025', expect.anything()),
    );
  });

  it('取得先の外部遷移と継承元を示し、同merchantへの継承を既定ONで保存する', async () => {
    const fetchMock = mockFetch();
    renderPage(<TaxReceiptsPage />);

    const external = await screen.findByRole('link', {
      name: /架空クラウド 要対応の取得先を外部サイトで開く/,
    });
    expect(external.getAttribute('href')).toBe('https://billing.example.test/receipts');
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toContain('noreferrer');
    expect(screen.getByText('同じ取引先の設定を継承')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '取得先を編集' }));
    const inherit = screen.getByRole('checkbox', {
      name: /今後の同じ取引先にも使う/,
    }) as HTMLInputElement;
    expect(inherit.checked).toBe(true);
    expect(screen.getByText(/パスワード・認証トークンは保存しません/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '取得先を保存' }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([input]) =>
        String(input).includes('/api/tax/receipt-sources?year=2025'),
      );
      expect(request).toBeTruthy();
      const init = request?.[1] as RequestInit;
      expect(JSON.parse(String(init.body))).toMatchObject({
        mode: 'merchant-profile',
        targetId: 'mf-must',
      });
    });
  });

  it('複数取得先を曖昧なまま自動確定せず、キーボード操作できる候補として示す', async () => {
    const fetchMock = mockFetch();
    renderPage(
      <ReceiptSourceProfilePanel
        targetId="mf-ambiguous"
        merchant="架空モール"
        withTaxYear={(path) => `${path}?year=2025`}
        onSaved={() => {}}
        resolution={{
          state: 'ambiguous',
          profile: null,
          inheritedFrom: '架空モール',
          overrideState: 'none',
          candidates: [
            {
              profileKey: '架空モール::購入履歴',
              merchantKey: '架空モール',
              serviceName: '購入履歴',
              sourceUrl: 'https://shop.example.test/orders',
              loginAccount: '',
              memo: '',
            },
            {
              profileKey: '架空モール::カード明細',
              merchantKey: '架空モール',
              serviceName: 'カード明細',
              sourceUrl: 'https://card.example.test',
              loginAccount: '',
              memo: '',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('取得先の候補を選んでください')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '購入履歴をこの明細に使う' }));
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([input]) => String(input).includes('/tax/receipt-sources'));
      const init = request?.[1] as RequestInit;
      expect(JSON.parse(String(init.body))).toMatchObject({
        mode: 'select-profile',
        targetId: 'mf-ambiguous',
        profileKey: '架空モール::購入履歴',
      });
    });
  });
});
