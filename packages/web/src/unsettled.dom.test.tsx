// @vitest-environment jsdom

/**
 * 未決済一覧の見え方。
 * 対象が無いときは何も出さないこと(決済列の無い取込を「0件」と言い切らない)を固定する。架空データのみ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnsettledResponse } from './api.js';
import { UNSETTLED_ROW_LIMIT, UnsettledPanel } from './components/Unsettled.js';

const row = (over: Partial<UnsettledResponse['rows'][number]> = {}): UnsettledResponse['rows'][number] => ({
  deal: { date: '2026-08-01', io: 'expense', partner: '架空印刷', accountNorm: '外注費', amount: 30_000 },
  remaining: 30_000,
  dueDate: '2026-08-31',
  daysOverdue: 0,
  status: 'scheduled',
  ...over,
});

function mount(data: UnsettledResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UnsettledPanel />
    </QueryClientProvider>,
  );
}

const response = (rows: UnsettledResponse['rows']): UnsettledResponse => ({
  today: '2026-08-27',
  rows,
  summary: {
    payable: { count: rows.length, amount: rows.reduce((a, r) => a + r.remaining, 0) },
    receivable: { count: 0, amount: 0 },
    overdue: { count: rows.filter((r) => r.status === 'overdue').length, amount: 0 },
  },
  schedule: [],
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('未決済の一覧', () => {
  it('対象が無ければ何も出さない', async () => {
    const { container } = mount(response([]));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('件数・取引先・残額・期日を出す', async () => {
    mount(response([row()]));
    expect(await screen.findByText('未決済(未払・未入金) 1件')).toBeTruthy();
    expect(screen.getByText('架空印刷')).toBeTruthy();
    // 同じ額が KPI にも出るため、表の残額セルに絞って確かめる
    expect(screen.getAllByText('¥30,000').some((el) => el.tagName === 'TD')).toBe(true);
    expect(screen.getByText('2026-08-31')).toBeTruthy();
  });

  it('期日超過は超過日数を添える', async () => {
    mount(response([row({ status: 'overdue', daysOverdue: 7, dueDate: '2026-08-20' })]));
    expect(await screen.findByText('期日超過')).toBeTruthy();
    expect(screen.getByText('7日')).toBeTruthy();
  });

  it('未払と未入金を区別して出す', async () => {
    mount(
      response([
        row(),
        row({
          deal: { date: '2026-08-02', io: 'income', partner: '架空顧客', accountNorm: '売上高', amount: 1 },
          remaining: 1,
        }),
      ]),
    );
    expect(await screen.findByText('未払')).toBeTruthy();
    expect(screen.getByText('未入金')).toBeTruthy();
  });

  it('判定の基準日を明示する', async () => {
    mount(response([row()]));
    expect(await screen.findByText(/基準日 2026-08-27/)).toBeTruthy();
  });

  it('上限を超えたら残り件数を伝える(黙って切らない)', async () => {
    mount(response(Array.from({ length: UNSETTLED_ROW_LIMIT + 3 }, () => row())));
    expect(await screen.findByText(/残り3件/)).toBeTruthy();
    expect(screen.getAllByText('架空印刷')).toHaveLength(UNSETTLED_ROW_LIMIT);
  });
});

describe('これから現金がいつ動くか', () => {
  const withSchedule = (schedule: UnsettledResponse['schedule']): UnsettledResponse => ({
    ...response([row()]),
    schedule,
  });

  it('月ごとの差引を累計し、手元残高を含まない予定純増減として示す', async () => {
    mount(
      withSchedule([
        { month: '2026-09', receipt: 0, payment: 30_000, net: -30_000, overdue: 0, count: 1 },
        { month: '2026-10', receipt: 50_000, payment: 0, net: 50_000, overdue: 0, count: 1 },
      ]),
    );
    const rows = await screen.findAllByRole('row');
    const nine = rows.find((r) => r.textContent?.startsWith('2026-09'));
    const ten = rows.find((r) => r.textContent?.startsWith('2026-10'));
    // 9月に3万沈み(累計 −¥30,000)、10月の入金で累計 ¥20,000 まで戻る
    expect(nine?.textContent).toContain('−¥30,000');
    expect(ten?.textContent?.endsWith('¥20,000')).toBe(true);
    expect(screen.getByText(/それだけで資金不足とは判定しません/)).toBeTruthy();
  });

  it('旧Workerがscheduleを返さなくても未決済一覧を表示する', async () => {
    const legacy = response([row()]);
    legacy.schedule = undefined;
    mount(legacy);
    expect(await screen.findByText('架空印刷')).toBeTruthy();
    expect(screen.queryByText('これから現金がいつ動くか')).toBeNull();
  });

  it('期日の無い分は表に混ぜず、件数と額を別に伝える', async () => {
    mount(
      withSchedule([
        { month: '2026-09', receipt: 0, payment: 30_000, net: -30_000, overdue: 0, count: 1 },
        { month: null, receipt: 10_000, payment: 0, net: 10_000, overdue: 0, count: 2 },
      ]),
    );
    expect(await screen.findByText(/期日の入っていない2件/)).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('予定が無ければ表そのものを出さない', async () => {
    mount(withSchedule([]));
    await screen.findByText('架空印刷');
    expect(screen.queryByText('これから現金がいつ動くか')).toBeNull();
  });
});
