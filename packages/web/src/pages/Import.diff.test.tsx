// @vitest-environment jsdom

/**
 * 取込前の差分プレビューの契約(T13)。
 *
 * 見張っているのは3つ。
 *   1. 何もしないまま取り込んでも、手当てを消す書き込みが1本も出ない(DR-11)。
 *   2. 出るのは件数の要約と、選ぶ必要のある取引先だけ。全件を目で追わせない。
 *   3. 同じ取引先はまとめて1回で選べ、その場で決め事にもできる。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from './Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 同じ取引先(架空商店)が2件、別の取引先(架空カフェ)が1件ぶつかっている */
const DIFF = {
  fingerprint: 'v1:test-preview',
  months: ['2026-06'],
  counts: { added: 40, changed: 3, deleted: 0, unchanged: 120 },
  conflicts: [
    {
      txId: 'tx-a',
      attrs: {
        cls: { base: 'per', current: 'biz', incoming: 'per' },
        big: { base: '食費', current: '会議費', incoming: '食費' },
      },
    },
    {
      txId: 'tx-b',
      attrs: { cls: { base: 'per', current: 'biz', incoming: 'per' } },
    },
    {
      txId: 'tx-c',
      attrs: { owner: { base: null, current: 'me', incoming: null } },
    },
  ],
  backfilled: 0,
  automation: { autoApplied: 0, candidates: 1, learned: 0 },
  candidates: [
    {
      txId: 'tx-preview-candidate',
      vendorKey: '架空スタンド',
      vendorLabel: '架空スタンド',
      cls: 'biz',
      big: '旅費交通費',
      mid: '',
      owner: null,
      reason: '2件。自動で当てるには 3 件以上が要る',
    },
  ],
  queries: { planned: 6, limit: 50 },
};

const TX = (id: string, description: string) => ({
  id,
  rowKey: id,
  rowKind: 'mf',
  parentTxId: null,
  lineId: null,
  splitSeq: null,
  splitLineCount: null,
  splitState: null,
  capabilities: { quickClass: true, edit: true, split: true, attach: true },
  attachmentTargetId: null,
  idStable: true,
  date: '2026-06-10',
  description,
  amount: -1200,
  institution: null,
  paymentMethod: 'card',
  csvBig: '食費',
  csvMid: '',
  big: '会議費',
  mid: '',
  catSrc: '手動',
  cls: 'biz',
  src: '手動',
  owner: null,
  ownerSrc: '既定',
  edited: true,
  conflict: true,
  scopeMismatch: false,
  attachmentCount: 0,
  edit: null,
});

/** 実際に飛んだ書き込みだけを取り出せるよう、method 付きで記録する */
const stubFetch = () => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push(`${init?.method ?? 'GET'} ${decodeURIComponent(path)}`);
      if (path === '/api/imports/diff') return json(DIFF);
      if (path.startsWith('/api/transactions?month='))
        return json({
          transactions: [
            TX('tx-a', '架空商店 渋谷店'),
            TX('tx-b', '架空商店　渋谷店'),
            TX('tx-c', '架空カフェ'),
          ],
        });
      if (path.startsWith('/api/transactions/')) return json({ ok: true });
      if (path === '/api/vendor-memory') throw new Error('previewは全memory一覧を読まない');
      if (path.startsWith('/api/vendor-memory/')) return json({ ok: true });
      if (path === '/api/imports' && init?.method === 'POST') {
        const rawPlan = init.body instanceof FormData ? init.body.get('resolutionPlan') : null;
        if (typeof rawPlan === 'string') calls.push(`RESOLUTION ${rawPlan}`);
        const plan =
          typeof rawPlan === 'string'
            ? (JSON.parse(rawPlan) as {
                decisions: Array<{ txIds: string[]; choice: string; remember: boolean }>;
              })
            : { decisions: [] };
        return json({
          results: [
            { filename: 'f.csv', kind: 'mf', months: ['2026-06'], status: 'committed', rows: 3, skipped: 0 },
          ],
          resolution: {
            reset: plan.decisions
              .filter((decision) => decision.choice === 'incoming')
              .reduce((sum, decision) => sum + decision.txIds.length, 0),
            remembered: plan.decisions.filter((decision) => decision.remember).length,
          },
        });
      }
      if (path.startsWith('/api/imports')) return json({ imports: [] });
      if (path === '/api/data/operations') return json({ operations: [] });
      if (path === '/api/sub-vendors/candidates') return json({ candidates: [] });
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

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

/** ファイルを選んだ状態にする。ドロップゾーンの隠し input に流し込む */
function chooseFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['計算対象,日付\n'], '架空-2026-06.csv', { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

/** 差分を出したうえで、取込を確定する(確認ダイアログは常に OK) */
async function previewAndCommit() {
  fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
  await screen.findByText('取り込むとこうなります');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '取込を実行' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('差分の見せ方', () => {
  it('件数を先に出す。自動で決まる分は数だけで、行にしない', async () => {
    stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));

    const summary = (await screen.findByText('増える明細')).closest('dl') as HTMLElement;
    const counts = within(summary);
    expect(counts.getByText('40件')).toBeTruthy();
    expect(counts.getByText('変わる明細')).toBeTruthy();
    expect(counts.getByText('3件')).toBeTruthy();
    expect(counts.getByText('そのままの明細')).toBeTruthy();
    expect(counts.getByText('120件')).toBeTruthy();
    // 120件の「そのまま」も40件の「増える」も、行としては出さない
    expect(screen.queryByText('架空サーバ')).toBeNull();
  });

  it('行にするのは、ぶつかった取引先だけ。同じ取引先は1つにまとまる', async () => {
    stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));

    // 3件の衝突が、2つの取引先にまとまる
    expect(await screen.findByText('選ぶ必要があるのは 2件の取引先だけです。')).toBeTruthy();
    expect(screen.getByText('架空商店 渋谷店')).toBeTruthy();
    expect(screen.getByText('2件(まとめて選べます)')).toBeTruthy();
    expect(screen.getByText('架空カフェ')).toBeTruthy();
  });

  it('衝突は前回の取込値・今の手当て・今回の取込値を並べて出す', async () => {
    stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
    await screen.findByText('架空商店 渋谷店');

    const card = screen.getByText('架空商店 渋谷店').closest('.notice') as HTMLElement;
    const scope = within(card);
    expect(scope.getByText('前回の取込値')).toBeTruthy();
    expect(scope.getByText('今の手当て')).toBeTruthy();
    expect(scope.getByText('今回の取込値')).toBeTruthy();
    // 公私は「事業/家計」の語で出す。biz/per の生の値は出さない
    expect(scope.getByText('事業')).toBeTruthy();
    expect(card.textContent).not.toContain('biz');
  });

  it('閾値に届いていない取引先を、決め事にする導線つきで出す', async () => {
    const calls = stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
    await screen.findByText('まだ自動で当てていない取引先 1件');
    // すでに自動で当たっているものは、選ばせる対象に出さない
    expect(screen.queryByText(/架空サーバ/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'これで自動にする' }));
    await waitFor(() => expect(calls).toContain('PATCH /api/vendor-memory/架空スタンド'));
  });
});

describe('無操作で確定したとき', () => {
  it('手当てを消す書き込みが1本も出ない(DR-11)', async () => {
    const calls = stubFetch();
    renderPage();
    chooseFile();

    await previewAndCommit();

    await waitFor(() => expect(calls).toContain('POST /api/imports'));
    expect(calls.filter((call) => call.startsWith('PUT /api/transactions/'))).toEqual([]);
    expect(calls.filter((call) => call.startsWith('PATCH /api/vendor-memory/'))).toEqual([]);
  });

  it('差分を見ること自体では、何も書き換えない', async () => {
    const calls = stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
    await screen.findByText('取り込むとこうなります');

    expect(calls).toContain('POST /api/imports/diff');
    expect(calls.filter((call) => call.startsWith('PUT '))).toEqual([]);
    // apply=1 を付けていない = 基準値の埋め戻しも起こさない
    expect(calls).not.toContain('POST /api/imports');
  });
});

describe('取り込んだ内容に合わせるとき', () => {
  it('選んだ取引先の全件を取込と同じPOSTで確定する', async () => {
    const calls = stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
    await screen.findByText('架空商店 渋谷店');

    const card = screen.getByText('架空商店 渋谷店').closest('.notice') as HTMLElement;
    fireEvent.click(within(card).getByLabelText('取り込んだ内容に合わせる'));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '取込を実行' }));

    await waitFor(() => expect(calls).toContain('POST /api/imports'));
    const plan = JSON.parse(calls.find((call) => call.startsWith('RESOLUTION '))?.slice(11) ?? '{}');
    expect(plan).toMatchObject({
      fingerprint: DIFF.fingerprint,
      decisions: [{ txIds: ['tx-a', 'tx-b'], choice: 'incoming' }],
    });
    expect(calls.filter((call) => call.startsWith('PUT /api/transactions/'))).toEqual([]);
    expect(JSON.stringify(plan)).not.toContain('tx-c');
  });

  it('同じ場で決め事にもできる', async () => {
    const calls = stubFetch();
    renderPage();
    chooseFile();

    fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));
    await screen.findByText('架空商店 渋谷店');

    const card = screen.getByText('架空商店 渋谷店').closest('.notice') as HTMLElement;
    fireEvent.click(within(card).getByLabelText(/次からもこの取引先はこの内容にする/));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '取込を実行' }));

    await waitFor(() => expect(calls).toContain('POST /api/imports'));
    const plan = JSON.parse(calls.find((call) => call.startsWith('RESOLUTION '))?.slice(11) ?? '{}');
    expect(plan.decisions[0]).toMatchObject({ remember: true, vendorKey: '架空商店渋谷店' });
    expect(calls.filter((call) => call.startsWith('PATCH /api/vendor-memory/'))).toEqual([]);
    // 覚えるだけで、手当ては動かさない(選んだのは keep のまま)
    expect(calls.filter((call) => call.startsWith('PUT /api/transactions/'))).toEqual([]);
    await screen.findByText(/覚えた取引先 1件/);
  });
});
