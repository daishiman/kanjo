// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReconciliationPage } from './pages/analysis/Reconciliation.js';
import type { ReconciliationResponse } from './pages/analysis/reconciliation/api.js';

type Row = ReconciliationResponse['rows'][number];

const mf = (content: string, amount: number, date: string): Row['mf'] => ({
  date,
  displayDate: date.slice(5).replace('-', '/'),
  content,
  amount,
  io: 'expense',
  institution: '架空カード',
  major: '通信費',
  middle: '',
  memo: '架空メモ',
  cls: 'biz',
  clsSrc: 'ルール',
});

const freee = (partner: string, amount: number, date: string, key: string): NonNullable<Row['freee']> => ({
  freeeIndex: 0,
  freeeKey: key,
  month: date.slice(0, 7),
  date,
  partner,
  amount,
  io: 'expense',
  account: '通信費',
  settleAccount: '普通預金',
});

function row(partial: Partial<Row> & Pick<Row, 'txId' | 'status'>): Row {
  return {
    date: '2026-08-10',
    month: '2026-08',
    mf: mf(`架空取引${partial.txId}`, 1_000, '2026-08-10'),
    freee: null,
    difference: null,
    score: null,
    similarity: null,
    reasons: [],
    queues: [],
    verdict: null,
    matchedBy: null,
    excludedBy: null,
    excludedReason: null,
    reviewReason: null,
    candidateKeys: [],
    ...partial,
  };
}

const reviewRow = row({
  txId: 'mf-review',
  status: 'review',
  mf: mf('架空クラウド', 3_300, '2026-08-05'),
  freee: freee('架空クラウド株式会社', 3_300, '2026-08-06', 'fk-review'),
  difference: 0,
  score: 88,
  similarity: 0.6,
  reasons: [
    { kind: 'amount', ok: true, label: '金額が一致' },
    { kind: 'date', ok: false, label: '日付が1日ずれ' },
    { kind: 'content', ok: true, label: '内容が類似' },
  ],
  queues: ['review', 'nearDate'],
  reviewReason: '発生日が一致しません',
  candidateKeys: ['fk-review'],
});

/** freee に相手の無い事業支出。総収支に計上済みで、照合の問いは無い */
const mfOnlyRow = row({
  txId: 'mf-only',
  status: 'mfOnly',
  mf: mf('架空文具店', 4_400, '2026-08-03'),
  queues: ['mfOnly'],
});

const matchedRows = Array.from({ length: 10 }, (_, index) =>
  row({
    txId: `mf-matched-${index}`,
    status: 'matched',
    date: `2026-07-${String(index + 10).padStart(2, '0')}`,
    month: '2026-07',
    mf: mf(`架空照合済み${index}`, 500, `2026-07-${String(index + 10).padStart(2, '0')}`),
    freee: freee(
      `架空照合済み${index}`,
      500,
      `2026-07-${String(index + 10).padStart(2, '0')}`,
      `fk-${index}`,
    ),
    difference: 0,
    score: 100,
    similarity: 1,
    matchedBy: 'auto',
  }),
);

const response: ReconciliationResponse = {
  kpi: {
    businessExpense: 612_400,
    mfOnlyCount: 1,
    mfOnlyAmount: 4_400,
    actionRequiredCount: 1,
    reviewCount: 1,
    resolvedCount: 10,
    // MFのみは解消率の分母に入れない (照合済み 10 + 要確認 1)
    resolvableCount: 11,
    resolutionRate: 10 / 11,
  },
  statusCounts: { unprocessed: 0, review: 1, matched: 10, mfOnly: 1, excluded: 0 },
  sourceCounts: { moneyforward: 12, freee: 11 },
  queues: { review: 1, mfOnly: 1, amountMismatch: 0, nearDate: 1 },
  rows: [reviewRow, mfOnlyRow, ...matchedRows],
  mfOnly: [mfOnlyRow],
  unmatchedFreee: [],
  lastAction: null,
  period: {
    applied: null,
    label: '全期間',
    full: { from: '2026-07', to: '2026-08' },
    years: ['2026'],
    monthCount: 2,
  },
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function renderPage(handler: Handler = () => json(response)) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReconciliationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { fetchMock, invalidate };
}

beforeAll(() => {
  // jsdom は <dialog> の showModal を持たない
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole('table', { name: '照合候補一覧' });
const bodyRows = () => within(table()).getAllByRole('row').slice(1);
const reconciliationCss = readFileSync(
  resolve(process.cwd(), 'src/pages/analysis/reconciliation.css'),
  'utf8',
);

describe('照合画面の構成', () => {
  it('KPI 4 枚を画像の順で出し、解消済みは割合と件数を示す', async () => {
    renderPage();
    const kpis = await screen.findByRole('region', { name: '照合の概況' });
    const cards = within(kpis).getAllByRole('group');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      '事業支出',
      'MFのみの支出（対応不要）',
      '対応が必要',
      '解消済み',
    ]);
    expect(cards[0]!.textContent).toContain('¥612,400');
    expect(cards[1]!.textContent).toContain('1件');
    expect(cards[1]!.textContent).toContain('¥4,400');
    expect(cards[2]!.textContent).toContain('1件');
    expect(cards[1]!.textContent).toContain('対応不要');
    // MFのみは注意の色で煽らない (対応の要らない件数)
    expect(cards[1]!.className).not.toContain('is-warn');
    expect(cards[3]!.textContent).toContain('91%');
    expect(cards[3]!.textContent).toContain('(10 / 11件)');
    // KPI の飾りアイコンは読み上げない
    for (const card of cards.slice(0, 3)) {
      const svg = card.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('解消率の分母が 0 のときは「対象なし」と出す', async () => {
    renderPage(() =>
      json({
        ...response,
        kpi: { ...response.kpi, resolvedCount: 0, resolvableCount: 0, resolutionRate: null },
        rows: [row({ txId: 'mf-excluded', status: 'excluded', excludedBy: 'mf' })],
        statusCounts: { unprocessed: 0, review: 0, matched: 0, mfOnly: 0, excluded: 1 },
        mfOnly: [],
      }),
    );
    const kpis = await screen.findByRole('region', { name: '照合の概況' });
    expect(within(kpis).getByRole('group', { name: '解消済み' }).textContent).toContain('対象なし');
  });

  it('対応件数はreview内訳ではなく actionRequiredCount を正本にする', async () => {
    const unprocessed = row({ txId: 'mf-unprocessed-count', status: 'unprocessed' });
    renderPage(() =>
      json({
        ...response,
        kpi: { ...response.kpi, actionRequiredCount: 2, reviewCount: 1 },
        rows: [reviewRow, unprocessed, mfOnlyRow, ...matchedRows],
        statusCounts: { unprocessed: 1, review: 1, matched: 10, mfOnly: 1, excluded: 0 },
        sourceCounts: { moneyforward: 13, freee: 11 },
      }),
    );

    const kpis = await screen.findByRole('region', { name: '照合の概況' });
    expect(within(kpis).getByRole('group', { name: '対応が必要' }).textContent).toContain('2件');
    expect(screen.getByRole('region', { name: /対応キュー 2件/ })).toBeTruthy();
  });

  it('絞り込みはfreee候補の有無を業務語で示し、対応キューは 3 行と確認のみ 1 行', async () => {
    renderPage();
    const filters = await screen.findByRole('region', { name: '絞り込み' });
    expect(within(filters).getByText('freee候補')).toBeTruthy();
    expect(within(filters).getByRole('radio', { name: '候補なし' })).toBeTruthy();
    expect(within(filters).getByRole('radio', { name: '候補あり' })).toBeTruthy();
    expect(within(filters).queryByText('MoneyForwardのみ')).toBeNull();
    for (const label of ['未処理 0', '要確認 1', '照合済み 10', 'MFのみ 1', '除外 0']) {
      expect(within(filters).getByRole('radio', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(within(filters).getByRole('combobox', { name: '対象年月' })).toBeTruthy();

    const queue = screen.getByRole('region', { name: /対応キュー/ });
    // 見出しの件数は判断を待つ行 (要確認 + 未処理) だけ。MFのみを足すと、何もしなくてよい件数が「対応」に見える
    expect(within(queue).getByRole('heading', { level: 2 }).textContent).toContain('1件');
    const items = within(queue).getAllByRole('button');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      '要確認の候補 1件',
      '金額の差異 0件',
      '日付の近い取引 1件',
      'MFのみの支出 1件',
    ]);
    expect(within(queue).getByRole('heading', { level: 3, name: '確認のみ' })).toBeTruthy();
    for (const item of items) expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('候補一覧は 8 列で、ステータスは文字のバッジで示す', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      '選択',
      'ステータス',
      '日付',
      'MoneyForwardの取引内容',
      '金額',
      'freeeの候補',
      '差額',
      '一致度',
    ]);
    expect(bodyRows()).toHaveLength(10);
    expect(within(bodyRows()[0]!).getByText('要確認').className).toContain('recon-badge');
    expect(screen.getByRole('heading', { name: /照合候補一覧 12件/ })).toBeTruthy();

    const selectHeader = within(table()).getAllByRole('columnheader')[0]!;
    const selectableCell = within(bodyRows()[0]!).getAllByRole('cell')[0]!;
    const unavailableCell = within(bodyRows()[1]!).getAllByRole('cell')[0]!;
    for (const cell of [selectHeader, selectableCell, unavailableCell]) {
      expect(cell.className).toContain('recon-select-column');
      expect(cell.querySelector('.recon-selection-hit')).not.toBeNull();
    }
    expect(within(selectableCell).getByRole('checkbox').className).toContain('recon-control-native');
    expect(selectableCell.querySelector('.recon-control-indicator')).not.toBeNull();
    expect(unavailableCell.querySelector('.recon-selection-placeholder')).not.toBeNull();
  });

  it('選択コントロールは44pxの操作面と18pxの視覚部品を分ける', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });

    const firstRow = bodyRows()[0]!;
    expect(within(firstRow).getByRole('checkbox').className).toContain('recon-control-native');
    expect(screen.getAllByRole('radio', { name: 'すべて' })[0]!.className).toContain('recon-control-native');
    expect(reconciliationCss).toMatch(
      /\.recon-selection-hit\s*\{[^}]*min-inline-size:\s*var\(--tap-target-min\);[^}]*min-block-size:\s*var\(--tap-target-min\);/s,
    );
    expect(reconciliationCss).toMatch(
      /\.recon-control-indicator\s*\{[^}]*inline-size:\s*18px;[^}]*block-size:\s*18px;/s,
    );
    expect(reconciliationCss).toMatch(
      /\.recon-control-native\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*opacity:\s*0;/s,
    );
  });

  it('全選択は行と同じ操作領域を使い、一部選択から全選択・全解除できる', async () => {
    const second = row({
      ...reviewRow,
      txId: 'mf-review-second',
      mf: mf('架空クラウド2', 5_500, '2026-08-07'),
      freee: freee('架空クラウド2', 5_500, '2026-08-07', 'fk-review-second'),
      candidateKeys: ['fk-review-second'],
    });
    renderPage(() =>
      json({
        ...response,
        rows: [reviewRow, second],
        statusCounts: { unprocessed: 0, review: 2, matched: 0, mfOnly: 0, excluded: 0 },
        sourceCounts: { moneyforward: 2, freee: 2 },
        queues: { review: 2, mfOnly: 0, amountMismatch: 0, nearDate: 1 },
        mfOnly: [],
      }),
    );
    await screen.findByRole('table', { name: '照合候補一覧' });

    const selectAll = screen.getByRole('checkbox', {
      name: '表示中の対応対象2件をすべて選択',
    }) as HTMLInputElement;
    const rowChecks = bodyRows().map((current) => within(current).getByRole('checkbox') as HTMLInputElement);
    expect(selectAll.closest('.recon-selection-hit')).not.toBeNull();

    fireEvent.click(rowChecks[0]!);
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);

    fireEvent.click(selectAll);
    expect(rowChecks.every((checkbox) => checkbox.checked)).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
    expect(selectAll.checked).toBe(true);

    fireEvent.click(selectAll);
    expect(rowChecks.every((checkbox) => !checkbox.checked)).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it('ページ送りと表示件数の切り替えで、再取得せずに一覧を切り替える', async () => {
    const { fetchMock } = renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    const calls = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '2ページ目' }));
    expect(bodyRows()).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: '表示件数' }), { target: { value: '20' } });
    expect(bodyRows()).toHaveLength(12);
    expect(screen.queryByRole('button', { name: '2ページ目' })).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('検索・ステータス・キューで絞り込み、リセットで戻す。検索語は通信に載せない', async () => {
    const { fetchMock } = renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.change(screen.getByRole('searchbox', { name: '照合候補を検索' }), {
      target: { value: '文具' },
    });
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]!.textContent).toContain('架空文具店');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('文具'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));
    expect(bodyRows()).toHaveLength(10);

    fireEvent.click(screen.getByRole('radio', { name: /要確認 1/ }));
    expect(bodyRows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'リセット' }));

    fireEvent.click(screen.getByRole('button', { name: 'MFのみの支出 1件' }));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]!.textContent).toContain('架空文具店');
  });

  it('freee候補の有無は「すべて」と同義にならず、重複なく切り替える', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });

    fireEvent.click(screen.getByRole('radio', { name: '候補なし' }));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]!.textContent).toContain('架空文具店');

    fireEvent.click(screen.getByRole('radio', { name: '候補あり' }));
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByRole('heading', { name: /照合候補一覧 11件/ })).toBeTruthy();
  });

  it('候補一覧は内部スクロール領域をキーボードで操作でき、内容ボタンの目的が分かる', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });

    const scroller = screen.getByRole('region', { name: '照合候補一覧の横スクロール領域' });
    expect(scroller.getAttribute('tabindex')).toBe('0');
    const detailButton = within(bodyRows()[1]!).getByRole('button', {
      name: '架空文具店の詳細を表示',
    });
    fireEvent.click(detailButton);
    expect(screen.getByRole('complementary', { name: '取引の詳細' }).textContent).toContain('架空文具店');
  });

  it('未解消が0件でも表示中の先頭行を選び、一覧と詳細の作業面を初期表示する', async () => {
    const settled = matchedRows.slice(0, 2);
    renderPage(() =>
      json({
        ...response,
        rows: settled,
        statusCounts: { unprocessed: 0, review: 0, matched: 2, mfOnly: 0, excluded: 0 },
        sourceCounts: { moneyforward: 2, freee: 2 },
        queues: { review: 0, mfOnly: 0, amountMismatch: 0, nearDate: 0 },
        mfOnly: [],
      }),
    );

    const panel = await screen.findByRole('complementary', { name: '取引の詳細' });
    expect(panel.textContent).toContain('架空照合済み0');
    expect(
      within(bodyRows()[0]!)
        .getByRole('button', { name: /架空照合済み0/ })
        .getAttribute('aria-current'),
    ).toBe('true');
  });

  it('行を選ぶと取引の詳細パネルに MF・freee・一致の理由・一致度を出す', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空クラウド/ }));
    const panel = screen.getByRole('complementary', { name: '取引の詳細' });
    const mfSection = within(panel).getByRole('region', { name: 'MoneyForwardの取引' });
    for (const term of ['日付', '内容', '金額', '利用先', '口座・カード', 'メモ']) {
      expect(within(mfSection).getByText(term)).toBeTruthy();
    }
    const freeeSection = within(panel).getByRole('region', { name: 'freeeの候補' });
    for (const term of ['日付', '内容', '金額', '勘定科目', '補助科目', 'メモ']) {
      expect(within(freeeSection).getByText(term)).toBeTruthy();
    }
    const reasons = within(panel).getByRole('list', { name: '一致の理由' });
    const items = within(reasons).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['金額が一致', '日付が1日ずれ', '内容が類似']);
    for (const item of items) expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(panel).getByRole('meter', { name: '一致度' }).getAttribute('aria-valuenow')).toBe('88');
    expect(
      within(panel)
        .getByRole('link', { name: /仕分けを開く/ })
        .getAttribute('href'),
    ).toContain('/classify');

    fireEvent.click(within(panel).getByRole('button', { name: '詳細を閉じる' }));
    expect(screen.queryByRole('complementary', { name: '取引の詳細' })).toBeNull();
  });

  it('下段に MFにありfreeeにない支出 と 自動一致できなかった候補 を導線付きで出す', async () => {
    renderPage();
    const mfOnly = await screen.findByRole('region', { name: /MFにありfreeeにない支出/ });
    expect(within(mfOnly).getByRole('table').textContent).toContain('架空文具店');
    expect(within(mfOnly).getByText(/照合の対応は要りません/)).toBeTruthy();
    expect(within(mfOnly).getByRole('link', { name: /明細仕分けで区分を確かめる/ })).toBeTruthy();
    const review = screen.getByRole('region', { name: /自動一致できなかった候補/ });
    expect(within(review).getByRole('table').textContent).toContain('発生日が一致しません');
    expect(within(review).getByRole('link', { name: /データ取込を確認する/ })).toBeTruthy();
  });

  it('MFのみが120件あっても下段は3件だけをプレビューし、残りを主一覧で確認できる', async () => {
    const mfOnlyRows = Array.from({ length: 120 }, (_, index) =>
      row({
        txId: `mf-only-${index}`,
        status: 'mfOnly',
        date: `2026-${String(1 + Math.floor(index / 28)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
        mf: mf(`架空未照合${index}`, 1_000 + index, '2026-08-03'),
        queues: ['mfOnly'],
      }),
    );
    renderPage(() =>
      json({
        ...response,
        rows: mfOnlyRows,
        mfOnly: mfOnlyRows,
        statusCounts: { unprocessed: 0, review: 0, matched: 0, mfOnly: 120, excluded: 0 },
        sourceCounts: { moneyforward: 120, freee: 0 },
        queues: { review: 0, mfOnly: 120, amountMismatch: 0, nearDate: 0 },
      }),
    );

    const summary = await screen.findByRole('region', { name: /MFにありfreeeにない支出/ });
    expect(within(summary).getAllByRole('row')).toHaveLength(4);
    expect(within(summary).getByRole('button', { name: '残り117件を一覧で見る' })).toBeTruthy();

    const filters = screen.getByRole('region', { name: '絞り込み' });
    const mfOnlyFilter = within(filters).getByRole('radio', { name: 'MFのみ 120' });
    expect(mfOnlyFilter.className).toContain('recon-control-native');
    const filterRow = mfOnlyFilter.closest('label')!;
    expect(filterRow.className).toContain('recon-radio');
    expect(filterRow.querySelector('.recon-control-indicator')).not.toBeNull();
    expect(filterRow.querySelector('.recon-radio-label')?.textContent).toBe('MFのみ');
    expect(filterRow.querySelector('.recon-radio-count')?.textContent).toBe('120');
  });

  it('絞り込みで見えなくなった選択を外し、詳細を絞り込み後の先頭行へ同期する', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    expect(within(bodyRows()[1]!).queryByRole('checkbox')).toBeNull();
    expect(within(bodyRows()[1]!).getByText('一括操作の対象外')).toBeTruthy();
    expect(screen.getByRole('region', { name: '選択中の取引' }).textContent).toContain('1件選択中');

    fireEvent.click(screen.getByRole('radio', { name: /照合済み 10/ }));
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
    expect(screen.getByRole('complementary', { name: '取引の詳細' }).textContent).toContain('架空照合済み0');
  });

  it('表示中の行を一度に選択でき、多数ページでもページ番号を必要な範囲だけ出す', async () => {
    const rows = Array.from({ length: 120 }, (_, index) =>
      row({
        txId: `mf-page-${index}`,
        status: 'review',
        date: '2026-08-03',
        mf: mf(`架空ページ${index}`, 1_000 + index, '2026-08-03'),
        freee: freee(`架空ページ${index}`, 1_000 + index, '2026-08-03', `fk-page-${index}`),
        difference: 0,
        score: 100,
        similarity: 1,
        queues: ['review'],
        reviewReason: '発生日が一致しません',
        candidateKeys: [`fk-page-${index}`],
      }),
    );
    renderPage(() =>
      json({
        ...response,
        rows,
        kpi: { ...response.kpi, actionRequiredCount: 120, reviewCount: 120 },
        statusCounts: { unprocessed: 0, review: 120, matched: 0, mfOnly: 0, excluded: 0 },
        sourceCounts: { moneyforward: 120, freee: 120 },
        queues: { review: 0, mfOnly: 0, amountMismatch: 0, nearDate: 0 },
        mfOnly: [],
      }),
    );
    await screen.findByRole('table', { name: '照合候補一覧' });

    fireEvent.click(screen.getByRole('checkbox', { name: '表示中の対応対象10件をすべて選択' }));
    expect(screen.getByRole('region', { name: '選択中の取引' }).textContent).toContain('10件選択中');
    expect(screen.getByRole('button', { name: '12ページ目' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '7ページ目' })).toBeNull();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('MFのみの行は確認のみとし、保存操作は出さない', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[1]!).getByRole('button', { name: /架空文具店/ }));
    const panel = screen.getByRole('complementary', { name: '取引の詳細' });
    expect(within(panel).getByRole('note').textContent).toContain('照合の対応は要りません');
    for (const name of ['同じ取引として照合', '別の取引として処理', '照合から除外する']) {
      expect(within(panel).queryByRole('button', { name })).toBeNull();
    }
    expect(within(panel).getByRole('link', { name: /仕分けを開く/ })).toBeTruthy();
  });
});

describe('照合画面の操作', () => {
  it('freee候補がない要確認は詳細で照合と「別の取引」を押せず、除外は維持する', async () => {
    const noCandidateReview = row({
      txId: 'mf-review-no-candidate',
      status: 'review',
      reviewReason: '対応する freee 取引が他の明細へ寄せられています',
      queues: ['review'],
    });
    const { fetchMock } = renderPage(() =>
      json({
        ...response,
        rows: [noCandidateReview],
        kpi: { ...response.kpi, actionRequiredCount: 1, reviewCount: 1 },
        statusCounts: { unprocessed: 0, review: 1, matched: 0, mfOnly: 0, excluded: 0 },
        sourceCounts: { moneyforward: 1, freee: 0 },
        queues: { review: 1, mfOnly: 0, amountMismatch: 0, nearDate: 0 },
        mfOnly: [],
      }),
    );
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空取引mf-review-no-candidate/ }));

    const panel = screen.getByRole('complementary', { name: '取引の詳細' });
    expect(
      (within(panel).getByRole('button', { name: '同じ取引として照合' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const different = within(panel).getByRole('button', { name: '別の取引として処理' }) as HTMLButtonElement;
    expect(different.disabled).toBe(true);
    expect(within(panel).getByRole('note').textContent).toContain('freee候補がないため');
    expect(
      (within(panel).getByRole('button', { name: '照合から除外する' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(different);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('同じ取引として照合を保存し、分析と月次クローズの問い合わせを更新する', async () => {
    let posted: unknown = null;
    const { invalidate } = renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json({
          results: [{ txId: 'mf-review', freeeKey: 'fk-review', ok: true }],
          saved: 1,
          action: { id: 'act-1', action: 'same', targetCount: 1, createdAt: '2026-09-10T01:12:00.000Z' },
        });
      }
      return json(response);
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空クラウド/ }));
    fireEvent.click(screen.getByRole('button', { name: '同じ取引として照合' }));
    await waitFor(() =>
      expect(posted).toEqual({ action: 'same', targets: [{ txId: 'mf-review', freeeKey: 'fk-review' }] }),
    );
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      for (const key of ['["reconciliation"]', '["total-cashflow"]', '["summary"]', '["review-queue"]']) {
        expect(keys).toContain(key);
      }
    });
    expect(await screen.findByRole('status', { name: '操作の結果' })).toBeTruthy();
  });

  it('一括照合は候補のある未解消行だけを件数の確認後に送り、部分成功の内訳を出す', async () => {
    let posted: { action: string; targets: unknown[] } | null = null;
    renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json({
          results: [
            { txId: 'mf-review', freeeKey: 'fk-review', ok: true },
            { txId: 'mf-review', freeeKey: 'fk-review', ok: false, reason: 'freee_not_pairable' },
          ],
          saved: 1,
          action: { id: 'act-2', action: 'same', targetCount: 1, createdAt: '2026-09-10T01:12:00.000Z' },
        });
      }
      return json(response);
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    // 対応対象の要確認行を選ぶ。確認のみ・照合済みは選択できない。
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    expect(within(bodyRows()[1]!).queryByRole('checkbox')).toBeNull();
    expect(within(bodyRows()[1]!).getByText('一括操作の対象外')).toBeTruthy();
    expect(within(bodyRows()[2]!).queryByRole('checkbox')).toBeNull();
    expect(within(bodyRows()[2]!).getByText('一括操作の対象外')).toBeTruthy();
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(bar.textContent).toContain('1件選択中');

    fireEvent.click(within(bar).getByRole('button', { name: '選択した取引を照合' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.textContent).toContain('選択した1件のうち');
    expect(posted).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '1件を照合する', hidden: true }));
    await waitFor(() => expect(posted?.targets).toEqual([{ txId: 'mf-review', freeeKey: 'fk-review' }]));
    const result = await screen.findByRole('status', { name: '操作の結果' });
    expect(result.textContent).toContain('1件を保存しました');
    expect(result.textContent).toContain('1件は保存できませんでした');
    expect(result.textContent).toContain('向き・日付が合わず同じ取引として照合できません');
  });

  it('freee候補がある行が選択に無いときは、一括照合と「別の取引」を押せない', async () => {
    const noCandidate = row({ txId: 'mf-unprocessed', status: 'unprocessed' });
    const { fetchMock } = renderPage(() =>
      json({
        ...response,
        kpi: { ...response.kpi, actionRequiredCount: 1, reviewCount: 0 },
        rows: [noCandidate],
        statusCounts: { unprocessed: 1, review: 0, matched: 0, mfOnly: 0, excluded: 0 },
        sourceCounts: { moneyforward: 1, freee: 0 },
        queues: { review: 0, mfOnly: 0, amountMismatch: 0, nearDate: 0 },
        mfOnly: [],
      }),
    );
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(bar.textContent).toContain('照合できるのは0件');
    const trigger = within(bar).getByRole('button', { name: '選択した取引を照合' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    const differentTrigger = within(bar).getByRole('button', {
      name: '選択した取引を別の取引として処理',
    }) as HTMLButtonElement;
    expect(differentTrigger.disabled).toBe(true);
    fireEvent.click(differentTrigger);
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('一括の「照合から除外」は対応待ちの行だけを送る', async () => {
    let posted: { action: string; targets: unknown[] } | null = null;
    renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json({
          results: (posted?.targets ?? []).map((target) => ({ ...(target as object), ok: true })),
          saved: 1,
          action: {
            id: 'act-5',
            action: 'exclude-mf',
            targetCount: 1,
            createdAt: '2026-09-10T01:12:00.000Z',
          },
        });
      }
      return json(response);
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    fireEvent.click(within(bar).getByRole('button', { name: '選択した取引を照合から除外' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.textContent).toContain('総収支の金額は変わりません');
    fireEvent.click(within(dialog).getByRole('button', { name: '1件を除外する', hidden: true }));
    await waitFor(() =>
      expect(posted).toEqual({
        action: 'exclude-mf',
        targets: [{ txId: 'mf-review' }],
      }),
    );
  });

  it('一括の「別の取引として処理」はfreee候補がある未解消行だけを送る', async () => {
    let posted: { action: string; targets: unknown[] } | null = null;
    const noCandidate = row({ txId: 'mf-no-candidate-different', status: 'unprocessed' });
    renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json({
          results: [{ txId: 'mf-review', freeeKey: null, ok: true }],
          saved: 1,
          action: { id: 'act-3', action: 'different', targetCount: 1, createdAt: '2026-09-10T01:12:00.000Z' },
        });
      }
      return json({ ...response, rows: [reviewRow, noCandidate, ...response.rows.slice(1)] });
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    fireEvent.click(within(bodyRows()[1]!).getByRole('checkbox'));
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(bar.textContent).toContain('2件選択中');
    fireEvent.click(within(bar).getByRole('button', { name: '選択した取引を別の取引として処理' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.textContent).toContain('未解消でfreeeの候補がある1件');
    expect(dialog.textContent).toContain('freeeの候補が無い');
    expect(posted).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '1件を別の取引にする', hidden: true }));
    await waitFor(() => expect(posted).toEqual({ action: 'different', targets: [{ txId: 'mf-review' }] }));
    expect((await screen.findByRole('status', { name: '操作の結果' })).textContent).toContain(
      '1件を保存しました（『別の取引』として処理）',
    );
  });

  it('一括照合は同じ freee の候補を指す 2 件目を送らない (freee 1 件に組める明細は 1 件)', async () => {
    let posted: { action: string; targets: unknown[] } | null = null;
    const twin = row({
      ...reviewRow,
      txId: 'mf-review-twin',
      mf: mf('架空クラウド 追加', 3_300, '2026-08-07'),
    });
    renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json({
          results: [{ txId: 'mf-review', freeeKey: 'fk-review', ok: true }],
          saved: 1,
          action: { id: 'act-4', action: 'same', targetCount: 1, createdAt: '2026-09-10T01:12:00.000Z' },
        });
      }
      return json({ ...response, rows: [reviewRow, twin, ...response.rows.slice(1)] });
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    fireEvent.click(within(bodyRows()[1]!).getByRole('checkbox'));
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(bar.textContent).toContain('照合できるのは1件');
    fireEvent.click(within(bar).getByRole('button', { name: '選択した取引を照合' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: '1件を照合する', hidden: true }));
    await waitFor(() => expect(posted?.targets).toEqual([{ txId: 'mf-review', freeeKey: 'fk-review' }]));
  });

  it('選択をクリアで選択中バーを閉じる', async () => {
    renderPage();
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '選択をクリア' }));
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
  });

  it('取込と重なった 409 は保存できなかったと出し、再試行できる', async () => {
    let attempts = 0;
    renderPage((url, init) => {
      if (url.endsWith('/reconciliation/actions') && init?.method === 'POST') {
        attempts += 1;
        return json(
          { error: { code: 'canonical_write_busy', message: '別の取込みまたは更新が進行中です' } },
          409,
        );
      }
      return json(response);
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空クラウド/ }));
    fireEvent.click(screen.getByRole('button', { name: '別の取引として処理' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('取込中のため保存できませんでした');
    fireEvent.click(within(alert).getByRole('button', { name: '再試行する' }));
    await waitFor(() => expect(attempts).toBe(2));
  });

  it.each([
    ['action_stale', 'この操作の後に同じ明細の判断が変わったため、元に戻せません'],
    ['action_not_latest', 'この後に別の操作をしているため、元に戻せません'],
    ['action_already_undone', 'この操作はすでに元に戻しています'],
    ['action_snapshot_invalid', '操作の記録を読み取れないため、元に戻せません'],
  ])('取り消しの 409 (%s) は取込中と言わず、再試行も出さない', async (code, message) => {
    renderPage((url, init) => {
      if (url.includes('/undo') && init?.method === 'POST') {
        return json({ error: { code, message: 'server message' } }, 409);
      }
      return json({
        ...response,
        lastAction: {
          id: 'act-9',
          action: 'different',
          targetCount: 1,
          createdAt: '2026-09-10T01:12:00.000Z',
        },
      });
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空クラウド/ }));
    fireEvent.click(
      within(screen.getByRole('region', { name: '直前の操作' })).getByRole('button', { name: /元に戻す/ }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).not.toContain('取込中');
    expect(within(alert).queryByRole('button', { name: '再試行する' })).toBeNull();
  });

  it('直前の操作を出し、元に戻すで取り消しを送る', async () => {
    let undone = '';
    renderPage((url, init) => {
      if (url.includes('/undo') && init?.method === 'POST') {
        undone = url;
        return json({
          ok: true,
          action: { id: 'act-9', action: 'different', targetCount: 1, undoneAt: '2026-09-10T01:13:00.000Z' },
        });
      }
      return json({
        ...response,
        lastAction: {
          id: 'act-9',
          action: 'different',
          targetCount: 1,
          createdAt: '2026-09-10T01:12:00.000Z',
        },
      });
    });
    await screen.findByRole('table', { name: '照合候補一覧' });
    fireEvent.click(within(bodyRows()[0]!).getByRole('button', { name: /架空クラウド/ }));
    const last = screen.getByRole('region', { name: '直前の操作' });
    expect(last.textContent).toContain('別の取引');
    fireEvent.click(within(last).getByRole('button', { name: /元に戻す/ }));
    await waitFor(() => expect(undone).toContain('/reconciliation/actions/act-9/undo'));
  });
});

describe('照合画面の状態', () => {
  it('読込中は読込表示を出す', () => {
    renderPage(() => new Promise<Response>(() => {}));
    expect(screen.getByText('データを読み込み中…')).toBeTruthy();
  });

  it('候補が 0 件なら取込への導線を出す', async () => {
    renderPage(() =>
      json({
        ...response,
        rows: [],
        mfOnly: [],
        statusCounts: { unprocessed: 0, review: 0, matched: 0, mfOnly: 0, excluded: 0 },
      }),
    );
    expect(await screen.findByText('照合できる取引がまだありません。')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'freee・MFを取り込む' })).toBeTruthy();
  });

  it('取得に失敗したら理由と再読み込みを出す', async () => {
    renderPage(() => json({ error: { code: 'internal', message: 'boom' } }, 500));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('サーバー側で処理に失敗しました');
  });
});
