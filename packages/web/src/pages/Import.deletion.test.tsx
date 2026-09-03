// @vitest-environment jsdom

/**
 * 取込データを消す画面の契約(T12 / T14)。
 *
 * 見張っているのは4つ。
 *   1. 1回のクリックでは何も消えない。必ず確認を挟む。
 *   2. 全件は範囲を自分で書かないと確認へ進めない。
 *   3. 確認画面に巻き添えの件数が出る。
 *   4. 消したあと、その場と履歴の両方から取り消せる(期限つき)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeletionOperation, ImportHistoryRow } from '../api.js';
import { ImportPage } from './Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const historyRow = (over: Partial<ImportHistoryRow> = {}): ImportHistoryRow => ({
  id: 41,
  filename: '架空-2026-07.csv',
  kind: 'mf',
  months: ['2026-06', '2026-07'],
  rows: 12,
  status: 'committed',
  duplicateOf: null,
  failureReason: null,
  generationState: 'active',
  committedAt: '2026-07-31T00:00:00.000Z',
  createdAt: '2026-07-31T00:00:00.000Z',
  originalRecorded: true,
  cancelable: true,
  ...over,
});

const PREFLIGHT = {
  counts: { mfTx: 12, freeeDeals: 0, balanceEntries: 0, months: 1 },
  collateral: { txEdits: 3, txSplits: 1, attachments: 2, cashEntries: 0 },
  months: ['2026-06'],
  fingerprint: 'fp-架空',
  undoable: true,
  undoRetentionDays: 30,
};

const DELETED = {
  operationId: 'op-架空',
  counts: { mfTx: 12, freeeDeals: 0, balanceEntries: 0, months: 1 },
  months: ['2026-06'],
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
};

const operationRow = (over: Partial<DeletionOperation> = {}): DeletionOperation => ({
  id: 'op-架空',
  kind: 'delete',
  granularity: 'period',
  counts: { mfTx: 12 },
  undone: false,
  undoable: true,
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  createdAt: new Date().toISOString(),
  result: 'succeeded',
  ...over,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<ImportPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 取込履歴・削除の各経路を返す fetch。呼ばれた順に記録する */
const stubFetch = (options: { operations?: DeletionOperation[] } = {}) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${path}`);
      if (path === '/api/data/operations') return json({ operations: options.operations ?? [] });
      if (path.endsWith('/preflight')) return json(PREFLIGHT);
      if (path === '/api/data/deletions') return json(DELETED);
      if (path.startsWith('/api/data/undo/'))
        return json({ operationId: 'op-undo', restored: {}, months: [] });
      if (/^\/api\/imports\/\d+\/undo$/.test(path)) return json(DELETED);
      if (path.startsWith('/api/imports')) return json({ imports: [historyRow()] });
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const panel = () =>
  screen.getByRole('heading', { name: '取り込んだデータを消す' }).closest('.card') as HTMLElement;

const openPanel = () => {
  const root = panel() as HTMLDetailsElement;
  if (!root.open) fireEvent.click(root.querySelector('summary') as HTMLElement);
  return within(root);
};

describe('期間で消す', () => {
  it('「消える内容を確認」だけでは1件も消さない', async () => {
    const calls = stubFetch();
    renderPage();

    const scope = openPanel();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));

    await screen.findByText('消える内容');
    // 実行の POST は1本も出ていない
    expect(calls).not.toContain('POST /api/data/deletions');
  });

  it('確認画面に、一緒に外れる手当ての件数が出る', async () => {
    stubFetch();
    renderPage();

    const scope = openPanel();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));

    expect(await screen.findByText('公私・科目の手当て 3件')).toBeTruthy();
    expect(screen.getByText('明細の分割 1件')).toBeTruthy();
    expect(screen.getByText('添付した書類 2件')).toBeTruthy();
    // 現金が巻き添えにならないことを、0件として見せる(DR-6)
    expect(screen.getByText('手で記帳した現金 0件(取込の削除では消えません)')).toBeTruthy();
    expect(screen.getByText(/削除後30日間は取り消せます/)).toBeTruthy();
  });

  it('確認してから押したときだけ消し、確認した指紋を添えて送る', async () => {
    const calls = stubFetch();
    renderPage();

    const scope = openPanel();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この内容で消す' }));

    await waitFor(() => expect(calls).toContain('POST /api/data/deletions'));
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls.find(([path]) => path === '/api/data/deletions')?.[1]?.body ??
        '{}') as string,
    );
    expect(body.fingerprint).toBe('fp-架空');
    expect(body.granularity).toBe('period');
  });

  it('期間を書かないうちは確認へ進めない', () => {
    stubFetch();
    renderPage();
    const button = openPanel().getByRole('button', { name: '消える内容を確認' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('事前確認後に期間や種別を変えたら確認を破棄し、再確認を必須にする', async () => {
    const calls = stubFetch();
    renderPage();

    const scope = openPanel();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));
    expect(await screen.findByRole('heading', { name: '消える内容' })).toBeTruthy();

    fireEvent.click(scope.getByLabelText('MF明細'));
    expect(screen.queryByRole('button', { name: 'この内容で消す' })).toBeNull();

    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));
    expect(await screen.findByRole('heading', { name: '消える内容' })).toBeTruthy();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-05' } });
    expect(screen.queryByRole('button', { name: 'この内容で消す' })).toBeNull();
    expect(calls).not.toContain('POST /api/data/deletions');
  });
});

describe('全件を消す', () => {
  it('全件を選ぶだけでは進めない。取り込んである範囲を自分で書かせる', async () => {
    stubFetch();
    renderPage();
    // 取込履歴が読めるまで待つ(全期間はそこから決まる)
    await screen.findByText('架空-2026-07.csv');

    const scope = openPanel();
    fireEvent.click(scope.getByRole('radio', { name: /全件を消す/ }));
    const button = scope.getByRole('button', { name: '消える内容を確認' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // 範囲の一部だけでは足りない
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    expect(button.disabled).toBe(true);

    // 全期間を書いて初めて進める
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-07' } });
    expect(button.disabled).toBe(false);
  });

  it('自分で書いた全期間を実行時の確認fieldとしてサーバへ渡す', async () => {
    const calls = stubFetch();
    renderPage();
    await screen.findByText('架空-2026-07.csv');

    const scope = openPanel();
    fireEvent.click(scope.getByRole('radio', { name: /全件を消す/ }));
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-07' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この内容で消す' }));

    await waitFor(() => expect(calls).toContain('POST /api/data/deletions'));
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls.find(([path]) => path === '/api/data/deletions')?.[1]?.body ??
        '{}') as string,
    );
    expect(body.confirmedPeriod).toEqual({ from: '2026-06', to: '2026-07' });
  });
});

describe('取込ごとの取り消し', () => {
  it('履歴の行から、その取込だけを確認つきで消せる', async () => {
    const calls = stubFetch();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込を取り消す' }));
    await screen.findByText('消える内容');
    const cancel = screen.getByRole('button', { name: 'やめる' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(calls).toContain('POST /api/imports/41/undo/preflight');
    expect(calls).not.toContain('POST /api/imports/41/undo');

    fireEvent.click(screen.getByRole('button', { name: 'この内容で消す' }));
    await waitFor(() => expect(calls).toContain('POST /api/imports/41/undo'));
  });

  it('やめると確認が閉じ、何も送らない', async () => {
    const calls = stubFetch();
    renderPage();

    const trigger = await screen.findByRole('button', { name: 'この取込を取り消す' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'やめる' }));

    await waitFor(() => expect(screen.queryByText('消える内容')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(calls).not.toContain('POST /api/imports/41/undo');
  });
});

describe('消したあとの取り消し', () => {
  it('その場で取り消せる。期限が日数で出る', async () => {
    const calls = stubFetch();
    renderPage();

    const scope = openPanel();
    fireEvent.change(scope.getByLabelText('はじめの月'), { target: { value: '2026-06' } });
    fireEvent.change(scope.getByLabelText('おわりの月'), { target: { value: '2026-06' } });
    fireEvent.click(scope.getByRole('button', { name: '消える内容を確認' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この内容で消す' }));

    const undo = await screen.findByRole('button', { name: 'いま取り消す' });
    expect(screen.getByText(/あと30日/)).toBeTruthy();
    fireEvent.click(undo);
    await waitFor(() => expect(calls).toContain('POST /api/data/undo/op-架空'));
  });

  it('履歴からも取り消せる。期限が切れたものはボタンを出さない', async () => {
    const calls = stubFetch({
      operations: [
        operationRow({ id: 'op-まだ戻せる' }),
        operationRow({
          id: 'op-期限切れ',
          expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
        operationRow({ id: 'op-戻し済み', undone: true }),
      ],
    });
    renderPage();
    openPanel();

    const undo = await screen.findByRole('button', { name: '取り消す(あと30日)' });
    expect(screen.getByText('取り消し済み')).toBeTruthy();
    expect(screen.getByText(/期限切れ/)).toBeTruthy();

    fireEvent.click(undo);
    await waitFor(() => expect(calls).toContain('POST /api/data/undo/op-まだ戻せる'));
  });

  it('保管量の上限で先に捨てられたものは、期限内でも戻せないと出す(D7)', async () => {
    stubFetch({
      operations: [
        // 期限はまだ先。それでも退避の置き場が足りず、古い順に捨てられている
        operationRow({ id: 'op-前倒し', undoable: false }),
      ],
    });
    renderPage();
    openPanel();

    expect(await screen.findByText('戻せません(保管量の上限)')).toBeTruthy();
    // 期限切れと同じ顔で出さない。期限の約束は守られている
    expect(screen.queryByText(/期限切れ/)).toBeNull();
    expect(screen.queryByRole('button', { name: /取り消す\(あと/ })).toBeNull();
  });

  it('消した記録に、明細の中身は出ない(DR-9)', async () => {
    stubFetch({ operations: [operationRow()] });
    renderPage();
    openPanel();

    // 記録が1行読み込まれるまで待つ
    await screen.findByRole('button', { name: /取り消す\(あと/ });
    const history = screen.getByRole('region', { name: '消した記録' });
    // 出るのは件数・範囲・日時だけ。指紋も範囲の生の指定も出さない
    expect(history.textContent).not.toContain('fp-');
    expect(history.textContent).toContain('12');
    expect(history.textContent).toContain('期間で');
  });
});
