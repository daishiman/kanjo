// @vitest-environment jsdom

/**
 * 家計収支画面の URL 状態・選択・詳細パネル・空状態 (SYS-HOUSEHOLD-P04 受入 3・6・7)。
 *
 * 応答は手書きせず core の `householdSummary` / `householdCategoryDetail` で架空明細から作る。
 * サーバと同じ関数の出力を描かせるので、応答の形がずれたらここで落ちる。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の家計画面 (`pages/Household.tsx`) は 旧 household 集計の月別表を描くだけで、
 * `seg` / `month` / `cat` を URL から読まず、カテゴリの詳細・選択中バー・名義ラベルの設定を持たない。
 * `./HouseholdPage.js` 自体が存在しない。
 */
import {
  type Dataset,
  type HouseholdCategoryKey,
  type MfTx,
  emptyDataset,
  householdCategoryDetail,
  householdSummary,
  periodMonths,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HouseholdCategories } from './HouseholdCategories.js';
import { HouseholdPage } from './HouseholdPage.js';

vi.mock('react-chartjs-2', async () => {
  const { createElement, forwardRef } = await import('react');
  const ChartDouble = forwardRef<unknown, Record<string, unknown>>((props, _ref) =>
    createElement('div', { role: 'img', 'aria-label': props['aria-label'] }),
  );
  ChartDouble.displayName = 'ChartDouble';
  return { Chart: ChartDouble, getElementAtEvent: () => [] };
});

const RANGE = { from: '2026-07', to: '2026-08' };
const PREV_MONTHS = ['2025-07', '2025-08'];
const OWN = '本人 普通預金';
const CHILD = '子ども 普通預金';

let seq = 0;
const mf = (month: string, day: number, a: number, big: string, over: Partial<MfTx> = {}): MfTx => {
  seq += 1;
  return {
    id: `mf-${seq}`,
    idStable: true,
    m: month,
    d: `${month.slice(5, 7)}/${String(day).padStart(2, '0')}`,
    c: `${big}の明細`,
    a,
    big,
    mid: '',
    inst: OWN,
    isTarget: true,
    isTransfer: false,
    ...over,
  };
};

/** 前年は食費 30,000 / 当期は食費 50,000 (前年差が最大なので既定の区分は食費)。住居費は毎月 90,000 */
function dataset(opts: { previous: boolean }): Dataset {
  seq = 0;
  const current = periodMonths(RANGE);
  const months = opts.previous ? [...PREV_MONTHS, ...current] : current;
  const txs: MfTx[] = [];
  for (const m of months) {
    const now = current.includes(m);
    txs.push(mf(m, 25, 300_000, '収入'));
    txs.push(mf(m, 27, -90_000, '住宅'));
    txs.push(mf(m, 3, -30_000, '食費'));
    if (now) txs.push(mf(m, 12, -20_000, '食費', { c: 'スーパーでの買い物', inst: CHILD }));
  }
  // 名義間の振替 1 組 (収入にも支出にも入らない)
  txs.push(mf('2026-08', 10, -50_000, '現金・カード', { isTransfer: true, c: '子どもへの仕送り' }));
  txs.push(mf('2026-08', 10, 50_000, '現金・カード', { isTransfer: true, c: '仕送りの入金', inst: CHILD }));
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  data.institutionOwners = { [OWN]: 'business', [CHILD]: 'family' };
  return data;
}

const input = (month: string | null, previous = true) => ({
  all: dataset({ previous }),
  deals: [],
  verdicts: [],
  exclusions: [],
  range: RANGE,
  month,
  labels: null,
});

const PERIOD_META = { applied: RANGE, label: '2026年7月 〜 2026年8月' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: URL, init?: RequestInit) => Response | undefined;

function renderAt(path: string, opts: { previous?: boolean; handle?: Handler } = {}) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(req), 'http://localhost');
      calls.push({ url, init });
      const custom = opts.handle?.(url, init);
      if (custom) return custom;
      const month = url.searchParams.get('month');
      if (url.pathname.endsWith('/household/category')) {
        const key = url.searchParams.get('key') as HouseholdCategoryKey;
        return json(householdCategoryDetail({ ...input(month, opts.previous ?? true), key }));
      }
      if (url.pathname.endsWith('/household')) {
        return json({
          empty: false,
          ...householdSummary(input(month, opts.previous ?? true)),
          period: PERIOD_META,
          updatedAt: null,
        });
      }
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <HouseholdPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const selectionBar = () => screen.getByRole('region', { name: '選択中の月' });
const detail = () => document.querySelector<HTMLElement>('.household-detail');
const categoryCalls = (calls: { url: URL }[]) =>
  calls
    .filter((c) => c.url.pathname.endsWith('/household/category'))
    .map((c) => `${c.url.searchParams.get('key')}@${c.url.searchParams.get('month')}`);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('既定の表示 (受入 3)', () => {
  it('URL が空なら期間の最終月を選び、前年差が最大の区分 (食費) の詳細を開く', async () => {
    const calls = renderAt('/household');
    await screen.findByRole('heading', { name: '生活費カテゴリ別の内訳' });
    expect(within(selectionBar()).getByText('2026年8月')).toBeTruthy();
    await waitFor(() => expect(detail()?.textContent).toContain('スーパーでの買い物'));
    expect(categoryCalls(calls)).toContain('food@2026-08');
    // 名義は応答の表示名をそのまま出す
    expect(within(detail()!).getByText('子ども')).toBeTruthy();
    // 既定値は URL に書かない
    expect(search().get('seg')).toBeNull();
    expect(search().get('cat')).toBeNull();
  });

  it('区分を選ぶと URL の cat が変わり、その区分の詳細を取りに行く', async () => {
    const calls = renderAt('/household');
    const row = await screen.findByRole('button', { name: '住居費' });
    fireEvent.click(row);
    await waitFor(() => expect(search().get('cat')).toBe('housing'));
    expect(row.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(categoryCalls(calls)).toContain('housing@2026-08'));
  });

  it('カテゴリ詳細は期間合計と選択月合計を、最大5件の抜粋と区別して示す', async () => {
    renderAt('/household');
    const panel = await waitFor(() => {
      const found = detail();
      expect(found?.textContent).toContain('スーパーでの買い物');
      return found!;
    });
    expect(within(panel).getByText(/表示期間の合計/).textContent).toContain('¥100,000');
    expect(within(panel).getByText(/選択月合計/).textContent).toContain('¥50,000');
    expect(within(panel).getByRole('heading', { name: /主な取引（最大5件）/ })).toBeTruthy();
  });

  it('詳細を閉じると cat=none になり、パネルが消える', async () => {
    renderAt('/household');
    fireEvent.click(await screen.findByRole('button', { name: 'カテゴリの詳細を閉じる' }));
    await waitFor(() => expect(search().get('cat')).toBe('none'));
    expect(detail()).toBeNull();
  });
});

describe('区分の選択は 1 回だけ伝える', () => {
  it.each([
    ['housing', '住居費', 0],
    ['food', '食費', 1],
    ['other', 'その他', 5],
  ] as const)(
    '選択行が先頭・中間・末尾のどこでも、5列全体を1つの選択単位として伝える (%s)',
    (key, label, index) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <HouseholdCategories
              data={householdSummary(input('2026-08'))}
              selected={key}
              month="2026-08"
              onSelect={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const rows = screen
        .getAllByRole('button', { name: /^(?:住居費|食費|光熱費|教育費|交通費|その他)$/ })
        .map((button) => button.closest('tr'));
      expect(rows).toHaveLength(6);
      expect(rows[index]?.getAttribute('aria-selected')).toBe('true');
      expect(rows[index]?.querySelectorAll(':scope > td')).toHaveLength(5);
      expect(within(rows[index]!).getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(rows.filter((row) => row?.getAttribute('aria-selected') === 'true')).toHaveLength(1);
      expect(
        rows.every((row, rowIndex) => row?.getAttribute('aria-selected') === String(rowIndex === index)),
      ).toBe(true);
    },
  );

  it('区分名のボタンを押しても、行のクリックと重ねて onSelect を 2 回呼ばない', () => {
    const onSelect = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HouseholdCategories
            data={householdSummary(input('2026-08'))}
            selected={null}
            month="2026-08"
            onSelect={onSelect}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '住居費' }));
    expect(onSelect.mock.calls).toEqual([['housing']]);
    // 行 (ボタン以外のセル) を押したときも 1 回
    fireEvent.click(screen.getByRole('button', { name: '食費' }).closest('tr')!.querySelector('td.num')!);
    expect(onSelect.mock.calls).toEqual([['housing'], ['food']]);
  });
});

describe('月の選択と URL の復元 (受入 6)', () => {
  it('‹ で前の月へ移ると URL・下部バー・詳細の月がそろって変わる', async () => {
    const calls = renderAt('/household');
    fireEvent.click(await screen.findByRole('button', { name: '前の月' }));
    await waitFor(() => expect(search().get('month')).toBe('2026-07'));
    await waitFor(() => expect(within(selectionBar()).getByText('2026年7月')).toBeTruthy());
    await waitFor(() => expect(categoryCalls(calls)).toContain('food@2026-07'));
    expect(screen.getByRole('button', { name: '前の月' }).hasAttribute('disabled')).toBe(true);
    expect(
      within(selectionBar())
        .getByRole('link', { name: /内訳の明細を確認/ })
        .getAttribute('href'),
    ).toBe('/classify?month=2026-07');
  });

  it('グラフ領域の左右矢印でも月を選べる', async () => {
    renderAt('/household');
    const graph = await screen.findByRole('group', { name: /グラフの月を選ぶ/ });
    fireEvent.keyDown(graph, { key: 'ArrowLeft' });
    await waitFor(() => expect(search().get('month')).toBe('2026-07'));
    fireEvent.keyDown(graph, { key: 'End' });
    await waitFor(() => expect(search().get('month')).toBe('2026-08'));
  });

  it('URL の seg・month・cat から状態を復元する', async () => {
    const calls = renderAt('/household?seg=biz&month=2026-07&cat=housing');
    const tab = await screen.findByRole('tab', { name: '事業' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(within(selectionBar()).getByText('2026年7月')).toBeTruthy();
    await waitFor(() => expect(categoryCalls(calls)).toEqual(['housing@2026-07']));
    expect(
      calls.some(
        (c) => c.url.pathname.endsWith('/household') && c.url.searchParams.get('month') === '2026-07',
      ),
    ).toBe(true);
  });

  it('タブを家計全体へ戻すと seg を URL から消す', async () => {
    renderAt('/household?seg=personal');
    fireEvent.click(await screen.findByRole('tab', { name: '家計全体' }));
    await waitFor(() => expect(search().has('seg')).toBe(false));
  });

  it('タブは矢印キーと Home / End で移り、選択中のタブだけが Tab の順に入る', async () => {
    renderAt('/household');
    const all = await screen.findByRole('tab', { name: '家計全体' });
    expect(all.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: '事業' }).tabIndex).toBe(-1);
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    await waitFor(() => expect(search().get('seg')).toBe('biz'));
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '事業' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    await waitFor(() => expect(search().get('seg')).toBe('personal'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    await waitFor(() => expect(search().has('seg')).toBe(false));
  });

  it('壊れた値は既定へ倒し、画面を失敗にしない', async () => {
    const calls = renderAt('/household?seg=x&month=2026-13&cat=constructor');
    await screen.findByRole('heading', { name: '生活費カテゴリ別の内訳' });
    expect(screen.getByRole('tab', { name: '家計全体' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(categoryCalls(calls)).toContain('food@2026-08'));
  });

  it('期間外の月 (invalid_month) は month を URL から外して最終月で出し直す', async () => {
    renderAt('/household?month=2025-01', {
      handle: (url) =>
        url.pathname.endsWith('/household') && url.searchParams.get('month') === '2025-01'
          ? json({ error: { code: 'invalid_month', message: '期間外' } }, 400)
          : undefined,
    });
    await waitFor(() => expect(search().has('month')).toBe(false));
    await waitFor(() => expect(within(selectionBar()).getByText('2026年8月')).toBeTruthy());
  });
});

describe('空状態と前年の欠損 (受入 7)', () => {
  it('取込前は空状態と取込への導線だけを出す', async () => {
    renderAt('/household', {
      handle: (url) =>
        url.pathname.endsWith('/household')
          ? json({
              empty: true,
              labels: { business: '本人', spouse: 'パートナー', family: '子ども', unset: 'その他' },
              period: { applied: null, label: '全期間' },
              updatedAt: null,
            })
          : undefined,
    });
    expect(await screen.findByRole('heading', { name: '表示するデータがありません' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'データ取込へ' }).getAttribute('href')).toBe('/import');
    expect(screen.queryByRole('heading', { name: '生活費カテゴリ別の内訳' })).toBeNull();
  });

  it('前年が無いと前年の欄は 0 ではなく — を出す', async () => {
    renderAt('/household', { previous: false });
    const compare = await screen.findByRole('region', { name: '前年との比較（同じ期間・月次）' });
    for (const dd of compare.querySelectorAll('dd')) expect(dd.textContent).toBe('—');
    const foodRow = screen.getByRole('button', { name: '食費' }).closest('tr')!;
    expect(within(foodRow).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('名義ラベルの設定', () => {
  it('21 文字は送信せずフィールドにエラーを出す', async () => {
    const calls = renderAt('/household');
    fireEvent.click(await screen.findByRole('button', { name: /名義ラベルを編集/ }));
    const field = await screen.findByLabelText(/事業の名義/);
    fireEvent.change(field, { target: { value: 'あ'.repeat(21) } });
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByText('20文字以内で入力してください。')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
  });
});

describe('振替の導線', () => {
  it('選択月の振替をこの画面で全件示し、存在しない一覧への循環リンクを出さない', async () => {
    renderAt('/household');
    const heading = await screen.findByRole('heading', { name: /除外した振替/ });
    const card = heading.closest('section')!;
    expect(within(card).getAllByRole('row')).toHaveLength(2);
    expect(within(card).queryByRole('link', { name: /すべて見る/ })).toBeNull();
  });
});
