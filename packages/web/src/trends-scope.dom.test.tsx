// @vitest-environment jsdom

/**
 * 支出トレンド画面の表示契約。
 *
 * この画面は「見て終わり」にしないことが目的なので、
 * 事業と家計が同じ土俵で並ぶこと・並び順が金額ではなく管理優先度であること・
 * スコープの切り替えがサーバへ届くことの3点を固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrendRow, TrendsResponse } from './api.js';
import { TrendsPage } from './pages/analysis/Trends.js';

// jsdom には canvas が無く、再描画のたびに Chart.js が実サイズを測ろうとして落ちる。
// この画面で検証したいのは表と操作なので、グラフは差し替える
vi.mock('react-chartjs-2', () => ({ Chart: () => null }));

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const row = (over: Partial<TrendRow> & Pick<TrendRow, 'account' | 'side'>): TrendRow => ({
  key: `${over.side}:${over.account}`,
  total: 600000,
  share: 0.4,
  monthlyAvg: 100000,
  cv: 0.2,
  type: '固定費',
  slopePerMonth: 5000,
  slopeRatio: 0.05,
  annualImpact: 60000,
  mk: { s: 15, tau: 1, z: 2.6, p: 0.009, n: 6 },
  direction: '増加',
  recentAvg: 120000,
  priorAvg: 80000,
  presenceRate: 1,
  gapMonths: [],
  series: [80000, 90000, 100000, 110000, 115000, 120000],
  action: '削減を検討',
  score: 1000,
  reason: '毎月じわじわ増えている',
  ...over,
});

const payload = (over: Partial<TrendsResponse> = {}): TrendsResponse => ({
  months,
  recordedMonths: months,
  unrecordedExpMonths: [],
  expenseTotal: 1500000,
  monthlyAvg: 250000,
  rows: [
    row({ account: '外注費', side: 'biz' }),
    row({
      account: '食費',
      side: 'personal',
      total: 300000,
      share: 0.2,
      monthlyAvg: 50000,
      direction: '横ばい',
      action: '継続監視',
      annualImpact: 0,
      reason: '横ばいだが規模が大きい',
    }),
  ],
  pareto: [
    { account: '外注費', side: 'biz', key: 'biz:外注費', total: 600000, share: 0.4, cumShare: 0.4 },
    { account: '食費', side: 'personal', key: 'personal:食費', total: 300000, share: 0.2, cumShare: 0.6 },
  ],
  coreCount: 3,
  breakdown: {
    beforeMonths: months.slice(0, 3),
    afterMonths: months.slice(3),
    beforeTotal: 700000,
    afterTotal: 800000,
    diff: 100000,
    rows: [
      {
        account: '外注費',
        side: 'biz',
        key: 'biz:外注費',
        before: 80000,
        after: 120000,
        diff: 40000,
        contribution: 0.4,
      },
    ],
  },
  counts: { 削減を検討: 1, 継続監視: 1, 記録を整える: 0, 対応不要: 0 },
  scope: 'all',
  scopeLabel: '事業+家計',
  sides: [
    {
      side: 'biz',
      label: '事業',
      total: 1200000,
      monthlyAvg: 200000,
      share: 0.8,
      accountCount: 4,
      topAccount: { account: '外注費', total: 600000 },
    },
    {
      side: 'personal',
      label: '家計',
      total: 300000,
      monthlyAvg: 50000,
      share: 0.2,
      accountCount: 2,
      topAccount: { account: '食費', total: 300000 },
    },
  ],
  monthlySides: months.map((month) => ({ month, biz: 200000, personal: 50000, total: 250000 })),
  period: {
    applied: null,
    label: '全期間',
    full: { from: months[0], to: months[5] },
    years: ['2026'],
    monthCount: 6,
  },
  ...over,
});

/** 呼ばれたURLを記録する。スコープの切り替えがサーバへ届くかを見るため */
function renderWith(over: Partial<TrendsResponse> = {}) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify(payload(over)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TrendsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return urls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('支出トレンドの表示', () => {
  it('事業と家計が同じ表に並び、規模を比べられる', async () => {
    renderWith();
    const head = await screen.findByText('事業と家計の内訳');
    const table = head.parentElement?.querySelector('table') as HTMLElement;
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('事業');
    expect(rows[0].textContent).toContain('¥1,200,000');
    expect(rows[0].textContent).toContain('80.0%');
    expect(rows[1].textContent).toContain('家計');
    expect(rows[1].textContent).toContain('食費');
  });

  it('科目には事業か家計かが必ず付く', async () => {
    // 事業と家計に同名の科目(通信費など)があるため、区分が無いと行が読めない
    renderWith();
    const cell = (await screen.findByRole('button', { name: '食費' })).closest('td') as HTMLElement;
    expect(cell.textContent).toContain('家計');
  });

  it('次の行動と、1年続いた場合の差が同じ行に出る', async () => {
    renderWith();
    const cell = (await screen.findByRole('button', { name: '外注費' })).closest('td') as HTMLElement;
    const tr = cell.closest('tr') as HTMLElement;
    expect(tr.textContent).toContain('削減を検討');
    expect(tr.textContent).toContain('増加');
    expect(tr.textContent).toContain('¥60,000');
  });

  it('科目を開くと判定の根拠が出る', async () => {
    // 「増加」とだけ言われても納得できない。p値と傾きを出して判断を委ねる
    renderWith();
    fireEvent.click(await screen.findByRole('button', { name: '外注費' }));
    const detail = (await screen.findByText(/毎月じわじわ増えている/)).closest('tr');
    // 「有意確率p」は用語ホバーの button なので p と =0.009 が別ノードになる。行全体の文字列で見る
    expect(detail?.textContent).toContain('有意確率p=0.009');
  });

  it('対応不要の科目は「手を打つ順番」に出さない', async () => {
    renderWith({
      rows: [row({ account: '消耗品費', side: 'biz', action: '対応不要', direction: '横ばい' })],
      counts: { 削減を検討: 0, 継続監視: 0, 記録を整える: 0, 対応不要: 1 },
    });
    expect(await screen.findByText(/いま対応が要る科目はありません/)).toBeTruthy();
  });

  it('スコープの切り替えがサーバへ届く', async () => {
    const urls = renderWith();
    await screen.findByText('事業と家計の内訳');
    fireEvent.click(screen.getByRole('tab', { name: '家計' }));
    await waitFor(() => expect(urls.some((u) => u.includes('scope=personal'))).toBe(true));
  });

  it('集計できる月が無ければ取込へ誘導する', async () => {
    renderWith({ recordedMonths: [] });
    expect(await screen.findByRole('link', { name: 'データ取込へ' })).toBeTruthy();
  });
});
