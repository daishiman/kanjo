// @vitest-environment jsdom

/**
 * 公私仕分け画面が「中項目」由来の判定根拠を表示し、その明細を確認済みとして数える契約。
 *
 * 実装より先に書く赤いテストである (SYS-MFBIZ-P04)。実装は SYS-MFBIZ-P05 以降。
 * 期待値の正本は `docs/mf-business-classification/requirements-baseline.md` (P01)。
 *
 * ## 置換前の実装では赤になること (受入 8)
 *
 * 置換前の `TxRow.src` は `'手動' | 'ルール' | '既定'`、`progress.bySource` は
 * `{ 手動, ルール, 既定 }` しか持たない。したがって本ファイルの fixture は
 * 型検査 (`tsc`) の時点で落ち、実行時も「確認済み」の内訳に中項目が出ない。
 * 静的・動的の両方で旧実装を弾く。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from '../src/api.js';
import { ClassificationProgressPanel, ClassifyPage } from '../src/pages/Classify.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 判定根拠 (`src`) 以外は既定値でよい。ここで確かめたいのは根拠の素通しだけ */
const tx = (over: Partial<TxRow> & Pick<TxRow, 'id' | 'src' | 'cls'>): TxRow => ({
  rowKey: over.id,
  rowKind: 'mf',
  parentTxId: null,
  lineId: null,
  splitSeq: null,
  splitLineCount: null,
  splitState: null,
  capabilities: { quickClass: true, edit: true, split: true },
  idStable: true,
  date: '2025-10-31',
  description: '架空クラウド',
  amount: -3_300,
  institution: '三井住友銀行 普通',
  instSrc: '取込値',
  csvInstitution: '三井住友銀行 普通',
  paymentMethod: 'bank',
  csvBig: '通信費',
  csvMid: '事業・情報サービス',
  big: '通信費',
  mid: '事業・情報サービス',
  catSrc: '取込値',
  owner: null,
  ownerSrc: '既定',
  edited: false,
  conflict: false,
  origin: null,
  originKey: null,
  scopeMismatch: false,
  edit: null,
  ...over,
});

/** 中項目由来 2 件・手動 1 件・ルール 1 件・既定 1 件。P01 の優先順位表と同じ並び */
const summary = (): TransactionsResponse['summary'] => ({
  month: '2025-10',
  count: 5,
  totalIncome: 150_000,
  bizIncome: 150_000,
  personalIncome: 0,
  totalExpense: 3_300,
  bizExpense: 3_300,
  personalExpense: 0,
  incomeByOwner: { business: 150_000, spouse: 0, family: 0, unset: 0 },
  progress: {
    total: 5,
    bizCount: 3,
    personalCount: 2,
    bySource: { 手動: 1, ルール: 1, 中項目: 2, 既定: 1 },
    reviewPending: 1,
  },
  editedCount: 1,
  conflictCount: 0,
  noInstitutionCount: 0,
  nonCountableCount: 0,
});

const response = (): TransactionsResponse => ({
  months: ['2025-10'],
  month: '2025-10',
  summary: summary(),
  transactions: [
    tx({ id: 'mid-biz', cls: 'biz', src: '中項目', description: '架空クラウド' }),
    tx({
      id: 'default-per',
      cls: 'per',
      src: '既定',
      description: '架空スーパー',
      csvBig: '食費',
      csvMid: '食料品',
      big: '食費',
      mid: '食料品',
    }),
  ],
  candidates: { biz: [], per: [] },
  institutions: ['三井住友銀行 普通'],
});

const stub = () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/transactions')) return json(response());
      return json({});
    }),
  );
};

const wrap = (node: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('判定根拠の表示 (受入 6)', () => {
  it('中項目由来の明細は判定根拠として「中項目」を表示する', async () => {
    stub();
    render(wrap(<ClassifyPage />));

    const cell = await screen.findByText('架空クラウド');
    const row = cell.closest('tr');
    expect(row).not.toBeNull();
    // 判定は事業、根拠は中項目。どちらも API 応答の値をそのまま出す。
    // 行内には簡易操作の「事業」ボタンもあるので、判定の pill だけを見る
    expect(within(row as HTMLElement).getByText('事業', { selector: '.pill.biz' })).toBeTruthy();
    expect(within(row as HTMLElement).getByText('中項目')).toBeTruthy();
  });

  it('既定のままの明細は根拠が「既定」で、中項目とは区別される', async () => {
    stub();
    render(wrap(<ClassifyPage />));

    const cell = await screen.findByText('架空スーパー');
    const row = cell.closest('tr') as HTMLElement;
    expect(within(row).getByText('既定')).toBeTruthy();
    expect(within(row).queryByText('中項目')).toBeNull();
  });

  it('決め事のmaterialize後は解決層と自動適用由来を両方表示する', async () => {
    const vendorApplied = response();
    vendorApplied.transactions[0] = tx({
      id: 'vendor-applied',
      cls: 'biz',
      src: '手動',
      description: '架空の定期支払い',
      edited: true,
      origin: 'vendor_memory',
      originKey: '架空の定期支払い',
      edit: {
        cls: 'biz',
        big: null,
        mid: null,
        owner: null,
        inst: null,
        updatedAt: null,
        origin: 'vendor_memory',
        originKey: '架空の定期支払い',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(vendorApplied)),
    );
    render(wrap(<ClassifyPage />));

    const row = await screen.findByText('架空の定期支払い').then((cell) => cell.closest('tr') as HTMLElement);
    expect(within(row).getByText('手動')).toBeTruthy();
    expect(within(row).getByRole('link', { name: '決め事' })).toBeTruthy();
  });

  it('手動判定の解除中は cls/src の片方だけを推測せず、再取得後に組で置き換える', async () => {
    const initial = response();
    initial.transactions[0] = tx({
      id: 'mid-biz',
      cls: 'per',
      src: '手動',
      description: '架空クラウド',
      edited: true,
      edit: {
        cls: 'per',
        big: null,
        mid: null,
        owner: null,
        inst: null,
        updatedAt: null,
        origin: 'manual',
        originKey: null,
      },
    });
    const resolved = response();
    let current = initial;
    let releasePut: (() => void) | undefined;
    const putGate = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        await putGate;
        current = resolved;
        return json({ ok: true });
      }
      return json(current);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(wrap(<ClassifyPage />));

    const rowOf = () => screen.getByText('架空クラウド').closest('tr') as HTMLElement;
    const row = await screen.findByText('架空クラウド').then((cell) => cell.closest('tr') as HTMLElement);
    fireEvent.click(within(row).getByRole('button', { name: '自動に戻す' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));

    // サーバの優先順位を解けない間は、直前の整合した組を保つ。
    expect(within(rowOf()).getByText('個人', { selector: '.pill.per' })).toBeTruthy();
    expect(within(rowOf()).getByText('手動')).toBeTruthy();
    expect(within(rowOf()).queryByText('中項目')).toBeNull();

    releasePut?.();
    await waitFor(() => {
      expect(within(rowOf()).getByText('事業', { selector: '.pill.biz' })).toBeTruthy();
      expect(within(rowOf()).getByText('中項目')).toBeTruthy();
    });
  });
});

describe('仕分けの進み具合の表示 (O5)', () => {
  it('中項目由来を確認済みの内訳に出し、未確認には数えない', async () => {
    render(wrap(<ClassificationProgressPanel summary={summary()} month="2025-10" />));

    // 確認済み = total 5 - reviewPending 1 = 4 件
    const done = await screen.findByText('4件');
    const doneCard = done.closest('.kpi') ?? (done.parentElement as HTMLElement);
    expect(doneCard.textContent).toContain('中項目 2件');

    // 未確認は「人もルールも中項目も触っていない」1 件だけ
    expect(screen.getByText('1件')).toBeTruthy();
  });

  it('中項目の自動判定条件と手動で直す方法を同じ説明枠で示す', () => {
    render(wrap(<ClassificationProgressPanel summary={summary()} month="2025-10" />));
    expect(screen.getByText(/中項目が「事業」で始まる/)).toBeTruthy();
    expect(screen.getByText(/「個人」または「事業」で上書き/)).toBeTruthy();
    expect(screen.getByText(/「手動」の件数には、取引先の決め事/)).toBeTruthy();
    expect(screen.getByText(/行の「決め事」表示で/)).toBeTruthy();
  });
});
