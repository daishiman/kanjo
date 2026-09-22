// @vitest-environment jsdom

/**
 * 予算画面の文言・状態・入力・保存・下書き (spec-budget-screen AT-01〜AT-12・AT-14・AT-20・AT-22)。
 *
 * 応答は `test-support/budget-screen-fixture.ts` が core の `applyBudgetInputs` で作る。
 * 期待値も同じ関数から取り、画面が core の数値をそのまま出しているか (数え直していないか) を確かめる。
 * パンくず・期間タブ・期間送りは Layout の持ち物で、各画面共通のテストが見ている (AT-01 のうち画面側だけをここで見る)。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の予算画面 (`pages/Budget.tsx`) は `/api/budget` の月額表と着地見込みを描くだけで、
 * `/api/budget-screen` を読まず、KPI 4 枚・自動提案・科目パネル・過不足カテゴリ・保存バー・下書きを持たない。
 * `./BudgetPage.js` 自体が存在しない。
 */
import { type BudgetInput, applyBudgetInputs } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetScreenResponse } from '../../api.js';
import { PeriodPicker, PeriodProvider } from '../../period.js';
import {
  BUDGET_SAVED_AT,
  BUDGET_START,
  budgetScreenBase,
  budgetScreenResponse,
  emptyBudgetScreenResponse,
} from '../../test-support/budget-screen-fixture.js';
import { BudgetPage } from './BudgetPage.js';
import { budgetDraftKey, clearAllBudgetDrafts } from './draft.js';
import { plainYen, signedYen, yenOf } from './view-model.js';

const USER_ID = 'u-test';
const DRAFT_KEY = budgetDraftKey(USER_ID, BUDGET_START);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Call = { url: URL; init?: RequestInit };
type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

function renderAt(
  path: string,
  opts: { screen?: BudgetScreenResponse; handle?: Handler; periodPicker?: boolean } = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(req), 'http://localhost');
      calls.push({ url, init });
      const custom = await opts.handle?.(url, init);
      if (custom) return custom;
      if (url.pathname.endsWith('/auth/me')) return json({ authenticated: true, user: { id: USER_ID } });
      if (url.pathname.endsWith('/budget-screen')) return json(opts.screen ?? budgetScreenResponse());
      if (url.pathname.endsWith('/budget-plans') && init?.method === 'PUT')
        return json({
          ok: true,
          start: BUDGET_START,
          count: 3,
          savedAt: '2026-09-10T01:18:00.000Z',
          revision: '2026-09-10T01:18:00.000Z',
        });
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = (
    <MemoryRouter initialEntries={[path]}>
      {opts.periodPicker ? <PeriodPicker /> : null}
      <BudgetPage />
      <a href="/overview">概要へ</a>
      <LocationProbe />
    </MemoryRouter>
  );
  const view = render(
    <QueryClientProvider client={client}>
      {opts.periodPicker ? <PeriodProvider>{page}</PeriodProvider> : page}
    </QueryClientProvider>,
  );
  return { calls, view };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const location = () => screen.getByTestId('location').textContent ?? '';
const screenCalls = (calls: Call[]) => calls.filter((c) => c.url.pathname.endsWith('/budget-screen'));
const table = () => screen.getByRole('table', { name: '予算一覧' });
const kpiValue = (label: string) => {
  const card = [...document.querySelectorAll<HTMLElement>('.budget-kpis .kpi')].find((el) =>
    el.querySelector('.label')?.textContent?.includes(label),
  );
  if (!card) throw new Error(`KPI ${label} が無い`);
  return card.querySelector('.value')?.textContent ?? '';
};
const amountInput = (account: string) => screen.getByLabelText<HTMLInputElement>(`${account}の来期予算`);

/** fixture の保存済み入力で出した figures (画面の初期表示と同じ) */
function savedFigures(response = budgetScreenResponse()) {
  return response.figures;
}

beforeEach(() => {
  clearAllBudgetDrafts();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearAllBudgetDrafts();
});

describe('見出しと予算対象 (AT-01)', () => {
  it('問い・説明 2 行・予算対象の選択と添え書きが出る', async () => {
    renderAt('/budget');
    expect(await screen.findByRole('heading', { level: 1, name: '予算' })).toBeTruthy();
    const lead = document.querySelector('.page-task')?.textContent ?? '';
    expect(lead).toContain('実績に合う予算へ、どこを調整しますか？');
    expect(lead).toContain('過去の実績をもとに、来期の予算を計画しましょう。');
    expect(lead).toContain('自動提案も参考にしながら、事業の優先順位に沿って調整できます。');
    const select = (await screen.findByRole('combobox', { name: '予算対象の開始月' })) as HTMLSelectElement;
    expect(screen.getByText('予算対象')).toBeTruthy();
    expect(select.value).toBe(BUDGET_START);
    expect(within(select).getByRole('option', { name: '2026年9月 - 2027年8月' })).toBeTruthy();
    expect(screen.getByText('来期の12か月の予算を編集できます。')).toBeTruthy();
  });

  it('開始月を変えると URL の start が変わり、その予算対象で取り直す', async () => {
    const { calls } = renderAt('/budget');
    const select = await screen.findByRole('combobox', { name: '予算対象の開始月' });
    fireEvent.change(select, { target: { value: '2025-09' } });
    await waitFor(() => expect(location()).toBe('/budget?start=2025-09'));
    await waitFor(() =>
      expect(screenCalls(calls).some((c) => c.url.searchParams.get('start') === '2025-09')).toBe(true),
    );
  });
});

describe('期間タブ (AT-14)', () => {
  it('期間タブを 2年 にすると、span=2 で取り直す', async () => {
    const { calls } = renderAt('/budget', { periodPicker: true });
    await screen.findByRole('table', { name: '予算一覧' });
    expect(screenCalls(calls).every((c) => c.url.searchParams.get('span') !== '2')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '2年で表示' }));
    await waitFor(() =>
      expect(screenCalls(calls).some((c) => c.url.searchParams.get('span') === '2')).toBe(true),
    );
  });
});

describe('KPI と見通し (AT-02・AT-04)', () => {
  it('KPI 4 枚が core の kpi をそのまま出し、防衛ライン余裕に式を示す', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    const { kpi } = savedFigures();
    expect(kpiValue('年間収入予算')).toBe(yenOf(kpi.incomeBudget));
    expect(kpiValue('年間支出予算')).toBe(yenOf(kpi.expenseBudget));
    expect(kpiValue('予算純収支')).toContain(signedYen(kpi.net));
    expect(kpiValue('防衛ライン余裕')).toContain(signedYen(kpi.defenseMargin));
    // ? (用語) を開くと式が出る
    const term = screen.getByRole('button', { name: /防衛ライン余裕/ });
    fireEvent.focus(term);
    expect(await screen.findByText(/年間収入予算 − 防衛ライン × 12/)).toBeTruthy();
    expect(screen.getByText('防衛ライン 月額 ¥800,000 × 12 と比べた額')).toBeTruthy();
  });

  it('今後の見通しの累計が KPI と一致し、見通しコメントが出る', async () => {
    renderAt('/budget');
    const card = (await screen.findByRole('heading', { name: '今後の見通し（累計・来期）' })).closest(
      'section',
    )!;
    const { kpi, outlook } = savedFigures();
    const value = (label: string) => within(card).getByText(label).nextElementSibling?.textContent;
    expect(value('累計収入')).toBe(plainYen(kpi.incomeBudget));
    expect(value('累計支出')).toBe(plainYen(kpi.expenseBudget));
    expect(outlook.net).toBe(kpi.net);
    expect(within(card).getByText(outlook.comment)).toBeTruthy();
  });
});

describe('月次グラフ (AT-03)', () => {
  it('凡例 5 種が出て、実績の月が無い予算対象では境目の線を引かない', async () => {
    renderAt('/budget');
    const chart = (await screen.findByRole('heading', { name: /月次の実績・予算・見通し/ })).closest(
      'section',
    )!;
    for (const label of ['収入 実績', '収入 予算', '支出 実績', '支出 予算', '見通し (収支)'])
      expect(within(chart).getAllByText(label).length).toBeGreaterThan(0);
    expect(within(chart).getByRole('img', { name: '月次の実績・予算・見通しのグラフ' })).toBeTruthy();
    expect(within(chart).queryByTestId('budget-boundary')).toBeNull();
  });

  it('予算対象に実績の月があると、境目の縦線と『実績(…)』『見通し(…)』の注記が出る', async () => {
    const base = budgetScreenBase();
    const rows = base.rows.map((row) => ({
      ...row,
      targetActuals: row.targetActuals.map((_, i) => (i < 3 ? Math.round(row.prevActual / 12) : null)),
    }));
    renderAt('/budget', { screen: budgetScreenResponse({ rows }) });
    const chart = (await screen.findByRole('heading', { name: /月次の実績・予算・見通し/ })).closest(
      'section',
    )!;
    expect(within(chart).getByTestId('budget-boundary')).toBeTruthy();
    expect(within(chart).getByText(/^実績\(/)).toBeTruthy();
    expect(within(chart).getByText(/^見通し\(/)).toBeTruthy();
  });
});

describe('予算一覧 (AT-05)', () => {
  it('道具・列・並びが仕様どおりで、収入の行が先頭に来る', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    expect(screen.getByPlaceholderText('カテゴリ名で検索 (Ctrl + K)')).toBeTruthy();
    expect(screen.getByRole('button', { name: '実績から提案' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'すべてリセット' })).toBeTruthy();
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((th) => th.textContent ?? '');
    expect(headers[1]).toBe('#');
    expect(headers[2]).toBe('カテゴリ');
    expect(headers[3]).toBe('前期実績 (2025/9-2026/8)');
    expect(headers[4]).toBe('来期予算 (2026/9-2027/8)');
    expect(headers[5]).toContain('自動提案');
    expect(headers[6]).toBe('差額');
    expect(headers[7]).toBe('見通し (2026/9-2027/8)');
    expect(headers[8]).toBe('来期予算 (入力)');
    const selectAll = within(table()).getByRole('checkbox', { name: 'すべて選択' });
    expect(selectAll.closest('label')?.classList.contains('selection-checkbox')).toBe(true);
    expect(
      within(table())
        .getByRole('checkbox', { name: '売上高を選択' })
        .closest('label')
        ?.classList.contains('selection-checkbox'),
    ).toBe(true);
    const accounts = within(table())
      .getAllByRole('rowheader')
      .map((th) => th.querySelector('button')?.textContent);
    expect(accounts).toEqual(['売上高', '外注費', '広告宣伝費', '通信費']);
  });

  it('検索で行を絞り、0 件なら文言を出す。Ctrl+K で検索欄へ移る', async () => {
    renderAt('/budget');
    const search = await screen.findByPlaceholderText('カテゴリ名で検索 (Ctrl + K)');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: '広告' } });
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(1);
    fireEvent.change(search, { target: { value: '家賃' } });
    expect(screen.getByText('「家賃」に合うカテゴリはありません。')).toBeTruthy();
  });

  it('実績から提案で、選んだ行 (無ければ全行) に自動提案を入れる', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    const suggestion = savedFigures().rows.find((r) => r.account === '外注費')!.suggestion;
    fireEvent.click(screen.getByRole('checkbox', { name: '外注費を選択' }));
    fireEvent.click(screen.getByRole('button', { name: '実績から提案' }));
    expect(amountInput('外注費').value).toBe(suggestion.toLocaleString('ja-JP'));
    expect(amountInput('通信費').value).toBe('');
  });
});

describe('科目パネル (AT-06)', () => {
  it('人件費があるときは、一覧を絞り込まずに根拠パネルを初期表示する', async () => {
    const base = budgetScreenBase();
    renderAt('/budget', {
      screen: budgetScreenResponse({
        rows: base.rows.map((row) => (row.account === '外注費' ? { ...row, account: '人件費' } : row)),
      }),
    });
    expect(await screen.findByRole('complementary', { name: '人件費' })).toBeTruthy();
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(4);
    expect(screen.queryByRole('status', { name: '診断からの絞り込み' })).toBeNull();
  });

  it('行を押すと科目パネルが開き、自動提案の根拠と計算の詳細が出る', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    expect(screen.getByText('一覧の行を選ぶと、自動提案の根拠を確かめられます。')).toBeTruthy();
    fireEvent.click(within(table()).getByRole('button', { name: '広告宣伝費' }));
    await waitFor(() =>
      expect(location()).toBe('/budget?account=%E5%BA%83%E5%91%8A%E5%AE%A3%E4%BC%9D%E8%B2%BB'),
    );
    const panel = screen.getByRole('complementary', { name: '広告宣伝費' });
    const figure = savedFigures().rows.find((r) => r.account === '広告宣伝費')!;
    expect(
      within(panel)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['提案の根拠', '関連データ']);
    expect(
      within(panel).getByText(
        `自動提案 ${yenOf(figure.suggestion)}（前期差 ${signedYen(figure.suggestion - 360_000)}）`,
      ),
    ).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'この値を適用' })).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: '推奨の根拠' })).toBeTruthy();
    expect(within(panel).getByText(figure.basisText)).toBeTruthy();
    const calc = panel.querySelector('.budget-calc')!;
    expect([...calc.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      '前期実績',
      '増減率 (過去12か月)',
      '計画による調整',
      '季節性補正',
      '推奨値',
    ]);
    // BR-05: 千円丸め(前期実績 × (1 + g) + S + 調整)
    const b = figure.suggestionBasis;
    expect(
      Math.round((b.prevActual * (1 + b.growthRate) + b.seasonal + b.planAdjustment) / 1000) * 1000,
    ).toBe(figure.suggestion);
    expect(within(panel).getByLabelText<HTMLInputElement>('広告宣伝費の計画による調整額').value).toBe(
      '20,000',
    );
    expect(within(panel).getByLabelText<HTMLInputElement>('広告宣伝費の調整の理由').value).toBe(
      '展示会の出展',
    );
    expect(within(panel).getByText('残り 94 字')).toBeTruthy();
    expect(within(panel).getByRole('img', { name: '月別の実績推移' })).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: '主な根拠データ' })).toBeTruthy();
    expect(within(panel).getByText('適用前の値 ¥300,000')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'この行を元に戻す' })).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: '科目パネルを閉じる' }));
    await waitFor(() => expect(location()).toBe('/budget'));
    expect(screen.queryByRole('complementary', { name: '広告宣伝費' })).toBeNull();
  });

  it('この値を適用で来期予算に自動提案が入り、調整額を変えると自動提案が組み直る', async () => {
    const { calls } = renderAt('/budget?account=外注費');
    const panel = await screen.findByRole('complementary', { name: '外注費' });
    const before = savedFigures().rows.find((r) => r.account === '外注費')!.suggestion;
    fireEvent.click(within(panel).getByRole('button', { name: 'この値を適用' }));
    expect(amountInput('外注費').value).toBe(before.toLocaleString('ja-JP'));
    const count = screenCalls(calls).length;
    fireEvent.change(within(panel).getByLabelText('外注費の計画による調整額'), {
      target: { value: '100000' },
    });
    await waitFor(() =>
      expect(panel.querySelector('.budget-suggestion-value')?.textContent).toContain(yenOf(before + 100_000)),
    );
    expect(screenCalls(calls)).toHaveLength(count);
  });
});

describe('過不足とインパクト (AT-07・AT-08)', () => {
  it('過不足カテゴリに 2 タブと件数・表があり、差額 = 見通し − 来期予算', async () => {
    renderAt('/budget');
    const card = (await screen.findByRole('heading', { name: '予算の過不足カテゴリ (来期見通し)' })).closest(
      'section',
    )!;
    const { gaps, rows } = savedFigures();
    const tabs = within(card).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      `支出の増加が見込まれる (${gaps.increase.count})`,
      `支出の減少が見込まれる (${gaps.decrease.count})`,
    ]);
    const heads = within(card)
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(heads).toEqual(['#', 'カテゴリ', '見通し', '差額', '要因']);
    for (const gap of gaps.increase.rows) {
      const budget = rows.find((r) => r.account === gap.account)!.budget ?? 0;
      expect(gap.gap).toBe(gap.forecast - budget);
      const tr = within(card).getByRole('rowheader', { name: gap.account }).closest('tr')!;
      expect(tr.textContent).toContain(signedYen(gap.gap));
    }
  });

  it('過不足の科目から根拠パネルを開ける', async () => {
    renderAt('/budget');
    const card = (await screen.findByRole('heading', { name: '予算の過不足カテゴリ (来期見通し)' })).closest(
      'section',
    )!;
    fireEvent.click(within(card).getByRole('button', { name: '広告宣伝費' }));
    expect(await screen.findByRole('complementary', { name: '広告宣伝費' })).toBeTruthy();
    expect(location()).toContain('account=%E5%BA%83%E5%91%8A%E5%AE%A3%E4%BC%9D%E8%B2%BB');
  });

  it('来期予算を自動提案より下げると『抑制』が出て、予算純収支がその場で変わる (問い合わせない)', async () => {
    const { calls } = renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    const netBefore = kpiValue('予算純収支');
    const count = screenCalls(calls).length;
    // 未入力の行は 0 として数えないので、自動提案より低い正の額を入れる
    fireEvent.change(amountInput('外注費'), { target: { value: '500000' } });
    const impact = screen.getByRole('heading', { name: '調整によるインパクト' }).closest('section')!;
    expect(impact.textContent).toContain('抑制');
    expect(impact.textContent).toContain(
      '実績に合わせて無理のない予算を設定することで、安定したキャッシュフローを維持できます。',
    );
    expect(kpiValue('予算純収支')).not.toBe(netBefore);
    // 期待値も core の同じ関数から出す
    const base = budgetScreenBase();
    const inputs: Record<string, BudgetInput> = {};
    for (const row of base.rows) if (row.saved) inputs[row.account] = row.saved;
    inputs.外注費 = { annualAmount: 500_000, planAdjustment: 0, planReason: null };
    expect(kpiValue('予算純収支')).toContain(signedYen(applyBudgetInputs(base, inputs).kpi.net));
    expect(screenCalls(calls)).toHaveLength(count);
  });
});

describe('保存バーと保存 (AT-09)', () => {
  it('保存で基準revisionと未保存の行だけを PUT する', async () => {
    const { calls } = renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    const bar = document.querySelector<HTMLElement>('.budget-save-bar')!;
    expect(within(bar).getByText('すべて保存済みです')).toBeTruthy();
    expect(within(bar).getByText(/^最終保存：2026年8月20日 \d{2}:00$/)).toBeTruthy();
    expect((within(bar).getByRole('button', { name: '予算を保存' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(amountInput('外注費'), { target: { value: '1,000,000' } });
    expect(within(bar).getByText('未保存 1項目')).toBeTruthy();
    expect(within(table()).getByText('未保存')).toBeTruthy();
    await waitFor(() => expect(within(bar).getByText(/^下書きを自動保存 \d{2}:\d{2}$/)).toBeTruthy(), {
      timeout: 2000,
    });

    fireEvent.click(within(bar).getByRole('button', { name: '予算を保存' }));
    await screen.findByText('予算を保存しました。');
    const puts = calls.filter((c) => c.init?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.url.pathname).toBe('/api/budget-plans');
    const body = JSON.parse(String(puts[0]!.init?.body)) as {
      start: string;
      baseSavedAt: string | null;
      rows: { account: string }[];
    };
    expect(body.start).toBe(BUDGET_START);
    expect(body.baseSavedAt).toBe(BUDGET_SAVED_AT);
    expect(body.rows.map((r) => r.account)).toEqual(['外注費']);
    expect(body.rows.find((r) => r.account === '外注費')).toMatchObject({
      kind: 'expense',
      annualAmount: 1_000_000,
      planAdjustment: 0,
      planReason: null,
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('競合時は再取得が終わるまで保存を止め、未編集行だけ最新値へ追随する', async () => {
    const initial = budgetScreenResponse();
    const newerSavedAt = '2026-09-11T02:00:00.000Z';
    const newer = budgetScreenResponse({
      savedAt: newerSavedAt,
      rows: budgetScreenBase().rows.map((row) =>
        row.account === '広告宣伝費'
          ? { ...row, saved: { annualAmount: 330_000, planAdjustment: 20_000, planReason: '外部更新' } }
          : row,
      ),
    });
    let gets = 0;
    let finishRefresh: (response: Response) => void = () => {
      throw new Error('再取得が開始されていません');
    };
    const { calls } = renderAt('/budget', {
      handle: (url, init) => {
        if (url.pathname.endsWith('/budget-screen')) {
          gets += 1;
          if (gets === 1) return json(initial);
          return new Promise<Response>((resolve) => {
            finishRefresh = resolve;
          });
        }
        if (url.pathname.endsWith('/budget-plans') && init?.method === 'PUT')
          return json({ error: { code: 'budget_conflict', message: '最新の予算を取得し直します。' } }, 409);
        return undefined;
      },
    });
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('外注費'), { target: { value: '1,000,000' } });
    fireEvent.click(screen.getByRole('button', { name: '予算を保存' }));
    expect(await screen.findByText('この予算はほかの画面で更新されています。')).toBeTruthy();
    await waitFor(() => expect(gets).toBe(2));
    expect((screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement).disabled).toBe(true);

    finishRefresh(json(newer));
    await waitFor(() => expect(amountInput('広告宣伝費').value).toBe('330,000'));
    expect(amountInput('外注費').value).toBe('1,000,000');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: '予算を保存' }) as HTMLButtonElement).disabled).toBe(false);
    const put = calls.find((call) => call.init?.method === 'PUT');
    expect(JSON.parse(String(put?.init?.body))).toMatchObject({ baseSavedAt: BUDGET_SAVED_AT });
  });

  it('保存に失敗すると理由と再試行を出し、入力は残る', async () => {
    renderAt('/budget', {
      handle: (url, init) =>
        url.pathname.endsWith('/budget-plans') && init?.method === 'PUT'
          ? json({ error: { code: 'internal', message: 'boom' } }, 500)
          : undefined,
    });
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('通信費'), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: '予算を保存' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('予算を保存できませんでした。時間をおいてもう一度お試しください。');
    expect(within(alert).getByRole('button', { name: '再試行' })).toBeTruthy();
    expect(amountInput('通信費').value).toBe('60000');
  });

  it('整数でない入力は保存できず、理由を出す', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('通信費'), { target: { value: '12.5' } });
    expect(screen.getByText('整数で入力してください（±100億円以内）')).toBeTruthy();
    expect(amountInput('通信費').getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('button', { name: '予算を保存' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('下書き・リセット・離脱確認 (AT-10)', () => {
  it('入力から 800ms 後に下書きを書き、開き直すと復元して未保存を数える', async () => {
    const first = renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('外注費'), { target: { value: '900,000' } });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), { timeout: 2000 });
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY)!) as { rows: Record<string, unknown> };
    expect(Object.keys(stored.rows)).toEqual(['外注費']);
    first.view.unmount();
    vi.unstubAllGlobals();

    renderAt('/budget');
    await waitFor(() => expect(amountInput('外注費').value).toBe('900,000'));
    expect(screen.getByText('未保存 1項目')).toBeTruthy();
  });

  it('800ms 未満で画面を閉じても、dirty 行を同期的に下書きへ残す', async () => {
    const page = renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('通信費'), { target: { value: '72,000' } });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    page.view.unmount();
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as {
      rows?: Record<string, { annualAmount: string }>;
    };
    expect(stored.rows?.['通信費']?.annualAmount).toBe('72,000');
  });

  it('ログアウト時の一括消去で下書きが消える', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, savedAt: new Date().toISOString(), rows: {} }));
    localStorage.setItem('kanjo:other', 'keep');
    clearAllBudgetDrafts();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem('kanjo:other')).toBe('keep');
    localStorage.removeItem('kanjo:other');
  });

  it('リセットは確認を出し、戻すと保存済みの値に戻って下書きも消える', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('売上高'), { target: { value: '1' } });
    const bar = document.querySelector<HTMLElement>('.budget-save-bar')!;
    fireEvent.click(within(bar).getByRole('button', { name: 'リセット' }));
    const dialog = await screen.findByRole('dialog', { name: '入力を保存済みの値に戻しますか？' });
    expect(within(dialog).getByText('未保存の 1 項目の入力と下書きが消えます。')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '戻す' }));
    expect(amountInput('売上高').value).toBe('12,600,000');
    expect(within(bar).getByText('すべて保存済みです')).toBeTruthy();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('未保存のまま画面内のリンクを押すと確認を出し、とどまれば移動しない', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    fireEvent.change(amountInput('通信費'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('link', { name: '概要へ' }));
    const dialog = await screen.findByRole('dialog', {
      name: '保存していない変更があります。このまま移動しますか？',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'とどまる' }));
    expect(location()).toBe('/budget');
    fireEvent.click(screen.getByRole('link', { name: '概要へ' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '移動する' }));
    await waitFor(() => expect(location()).toBe('/overview'));
  });
});

describe('状態 (AT-11)', () => {
  it('読込中はスケルトンを出す', async () => {
    renderAt('/budget', {
      handle: (url) =>
        url.pathname.endsWith('/budget-screen') ? new Promise<Response>(() => {}) : undefined,
    });
    expect(await screen.findByText('データを読み込み中…')).toBeTruthy();
  });

  it('実績が無ければ空の文言と取込への導線を出す', async () => {
    renderAt('/budget', { screen: emptyBudgetScreenResponse() });
    expect(await screen.findByText('予算の計算に使える実績がありません。')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'データ取込' }).getAttribute('href')).toBe('/import');
  });

  it('取得に失敗すると失敗の文言を出す', async () => {
    renderAt('/budget', {
      handle: (url) =>
        url.pathname.endsWith('/budget-screen')
          ? json({ error: { code: 'internal', message: 'boom' } }, 500)
          : undefined,
    });
    expect((await screen.findByRole('alert')).textContent).toContain('予算を読み込めませんでした。');
  });
});

describe('語と色 (AT-12)', () => {
  it('『AI』の文字列が無く『自動提案』があり、符号と文言で区別する', async () => {
    renderAt('/budget');
    await screen.findByRole('table', { name: '予算一覧' });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/AI/);
    expect(text).toContain('自動提案');
    // 差額は色に加えて符号の文字を持つ
    const diffCells = [...table().querySelectorAll<HTMLElement>('td.budget-up, td.budget-down')];
    expect(diffCells.length).toBeGreaterThan(0);
    for (const cell of diffCells) expect(cell.textContent).toMatch(/^[+−]/);
    // 余裕が負になれば『不足』を併記する
    fireEvent.change(amountInput('売上高'), { target: { value: '0' } });
    expect(kpiValue('防衛ライン余裕')).toContain('不足');
    expect(kpiValue('予算純収支')).toContain('不足');
  });
});

describe('診断からの受け口 (AT-20)', () => {
  it('?account= の科目に絞り、絞り込みの表示と科目パネルを出す。すべて表示で戻る', async () => {
    renderAt('/budget?account=広告宣伝費');
    const status = await screen.findByRole('status', { name: '診断からの絞り込み' });
    expect(status.textContent).toContain('広告宣伝費');
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(1);
    expect(screen.getByRole('complementary', { name: '広告宣伝費' })).toBeTruthy();
    fireEvent.click(within(status).getByRole('link', { name: 'すべて表示' }));
    await waitFor(() => expect(within(table()).getAllByRole('rowheader')).toHaveLength(4));
  });

  it('一覧に無い科目は URL から外し、全行を出す', async () => {
    renderAt('/budget?account=存在しない科目');
    await waitFor(() => expect(location()).toBe('/budget'));
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(4);
    expect(screen.queryByRole('status', { name: '診断からの絞り込み' })).toBeNull();
  });
});

describe('外部送信 (AT-22)', () => {
  it('fetch の宛先は同じオリジンの /api だけ', async () => {
    const { calls } = renderAt('/budget?account=広告宣伝費');
    await screen.findByRole('complementary', { name: '広告宣伝費' });
    fireEvent.change(amountInput('広告宣伝費'), { target: { value: '310000' } });
    fireEvent.click(screen.getByRole('button', { name: '予算を保存' }));
    await screen.findByText('予算を保存しました。');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.url.origin).toBe('http://localhost');
      expect(call.url.pathname.startsWith('/api/')).toBe(true);
    }
  });
});
