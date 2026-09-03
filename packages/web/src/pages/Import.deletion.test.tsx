// @vitest-environment jsdom

/**
 * 取込データを消す画面の契約(T12 / T14)。
 *
 * 見張っているのは4つ。
 *   1. 1回のクリックでは何も消えない。必ず確認を挟む。
 *   2. 全件はサーバ導出期間と対象を見せ、明示文言を入力するまで実行できない。
 *   3. 確認画面に巻き添えの件数が出る。
 *   4. 消したあと、その場と履歴の両方から取り消せる(期限つき)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeletionOperation, DeletionPreflight, ImportHistoryRow } from '../api.js';
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
  fullRange: { from: '2026-06', to: '2026-06' },
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
const stubFetch = (
  options: {
    operations?: DeletionOperation[];
    preflight?: DeletionPreflight;
    imports?: ImportHistoryRow[];
    historyError?: boolean;
    deletionResponse?: () => Promise<Response>;
  } = {},
) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${path}`);
      if (path === '/api/data/operations') return json({ operations: options.operations ?? [] });
      if (path.endsWith('/preflight')) return json(options.preflight ?? PREFLIGHT);
      if (path === '/api/data/deletions')
        return options.deletionResponse ? options.deletionResponse() : json(DELETED);
      if (path.startsWith('/api/data/undo/'))
        return json({ operationId: 'op-undo', restored: {}, months: [] });
      if (/^\/api\/imports\/\d+\/undo$/.test(path)) return json(DELETED);
      if (path.startsWith('/api/imports'))
        return options.historyError
          ? json({ error: { code: 'history_unavailable', message: '履歴を読み込めません' } }, 500)
          : json({ imports: options.imports ?? [historyRow()] });
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('データを入れ替える', () => {
  it('下部メンテナンスは期間指定に絞り、全件の二重入口を作らない', async () => {
    stubFetch();
    renderPage();
    await screen.findByRole('button', { name: 'データを入れ替える' });

    const maintenance = openPanel();
    expect(maintenance.queryByRole('radio', { name: /全件/ })).toBeNull();
    expect(maintenance.getByText('指定した期間だけを対象にします')).toBeTruthy();
  });

  it('全件削除を上部の1入口にまとめ、安全条件と対象を確認するまで実行しない', async () => {
    const calls = stubFetch();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'データを入れ替える' }));
    const dialog = await screen.findByRole('dialog', {
      name: '取り込んだデータを入れ替えますか？',
    });
    expect(within(dialog).getByText(/freee・マネーフォワード側の元データ/)).toBeTruthy();
    expect(within(dialog).getByText(/手入力した現金・負債、設定は消えません/)).toBeTruthy();
    expect(within(dialog).getByText(/取込履歴と削除記録/)).toBeTruthy();
    expect(await within(dialog).findByText('公私・科目の手当て 3件')).toBeTruthy();
    expect(within(dialog).getByText('MF明細')).toBeTruthy();
    expect(within(dialog).getByText('freee仕訳')).toBeTruthy();
    expect(within(dialog).getByText('MF資産残高')).toBeTruthy();
    expect(within(dialog).getByText(/削除後30日間は取り消せます/)).toBeTruthy();
    const title = within(dialog).getByRole('heading', {
      name: '取り込んだデータを入れ替えますか？',
    });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(calls).toContain('POST /api/data/deletions/preflight');
    expect(calls).not.toContain('POST /api/data/deletions');

    const execute = within(dialog).getByRole('button', {
      name: '全データを削除して次へ',
    }) as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/入れ替える/), {
      target: { value: '入れ替える' },
    });
    expect(execute.disabled).toBe(false);
  });

  it('履歴が空でも取得失敗でも、サーバpreflightへの入口は常に表示する', async () => {
    stubFetch({ imports: [] });
    const first = renderPage();
    expect(await screen.findByRole('button', { name: 'データを入れ替える' })).toBeTruthy();

    first.unmount();
    cleanup();
    vi.unstubAllGlobals();

    stubFetch({ historyError: true });
    renderPage();
    expect(await screen.findByRole('button', { name: 'データを入れ替える' })).toBeTruthy();
  });

  it('履歴100件ではなくpreflightが返した真の全期間と指紋を使う', async () => {
    const calls = stubFetch({
      preflight: {
        ...PREFLIGHT,
        months: ['2025-01', '2026-06', '2026-07'],
        counts: { ...PREFLIGHT.counts, months: 3 },
        fullRange: { from: '2025-01', to: '2026-07' },
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'データを入れ替える' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/入れ替える/), {
      target: { value: '入れ替える' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '全データを削除して次へ' }));

    await waitFor(() => expect(calls).toContain('POST /api/data/deletions'));
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls.find(([path]) => path === '/api/data/deletions')?.[1]?.body ??
        '{}') as string,
    );
    expect(body).toMatchObject({
      granularity: 'all',
      confirmedPeriod: { from: '2025-01', to: '2026-07' },
      fingerprint: 'fp-架空',
    });
  });

  it('削除後は新規取込とundoを同じ場所に出し、ファイル選択を実際に開ける', async () => {
    stubFetch();
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'データを入れ替える' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/入れ替える/), {
      target: { value: '入れ替える' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '全データを削除して次へ' }));

    expect(await screen.findByText('入れ替えの準備ができました')).toBeTruthy();
    expect(screen.getByText(/取込履歴・削除記録/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'いま取り消す' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '新しいファイルを選ぶ' }));
    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it('preflightの対象月が空なら実行ボタンを出さない', async () => {
    const calls = stubFetch({
      preflight: { ...PREFLIGHT, months: [], counts: { ...PREFLIGHT.counts, months: 0 }, fullRange: null },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'データを入れ替える' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('入れ替えで削除する取込データはありません。')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: '全データを削除して次へ' })).toBeNull();
    expect(calls).not.toContain('POST /api/data/deletions');
  });

  it('削除実行中はEscapeでダイアログを閉じない', async () => {
    let resolveDeletion: ((response: Response) => void) | undefined;
    const pendingDeletion = new Promise<Response>((resolve) => {
      resolveDeletion = resolve;
    });
    stubFetch({ deletionResponse: () => pendingDeletion });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'データを入れ替える' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/入れ替える/), {
      target: { value: '入れ替える' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '全データを削除して次へ' }));
    expect(await within(dialog).findByRole('button', { name: '削除中…' })).toBeTruthy();

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    resolveDeletion?.(json(DELETED));
    expect(await screen.findByText('入れ替えの準備ができました')).toBeTruthy();
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
