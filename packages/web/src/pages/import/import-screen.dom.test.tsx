// @vitest-environment jsdom
/**
 * データ取込画面が参照画像 (design/FINAL-UI/images/16-import.png) の構成要素を持つこと。
 *
 * 見出しの段 1〜5、手順 3 段と今いる段、一覧 9 列、要約 6 項目、結果 4 枚、履歴 7 列 (+ 一括削除の選択列)、
 * 選択件数バー、?run からの詳細ペインの復元を、役割と名前で固定する。見た目の細部は固定しない。
 */
import { IMPORT_LIMIT_BOUNDARY_CASES, importLimitReason } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from '../Import.js';
import { chooseImportFiles, createImportServer, csvFile, runDetail, runRow } from './import-test-fakes.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function mount(options: Parameters<typeof createImportServer>[0] = {}, initialEntries = ['/']) {
  const server = createImportServer({ inspect: () => ({ source: 'freee' }), ...options });
  vi.stubGlobal('fetch', server.fetch);
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ImportPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return server;
}

const currentStep = () =>
  within(screen.getByRole('list', { name: '取込の手順' }))
    .getAllByRole('listitem')
    .findIndex((item) => item.getAttribute('aria-current') === 'step') + 1;

const columnNames = (table: HTMLElement) =>
  within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent?.trim() ?? '');

describe('データ取込画面の構成', () => {
  it('問い・期間カード・段 1〜5 の見出し・手順 3 段を持ち、選ぶ前は 1 段目にいる', async () => {
    mount();
    expect(
      screen.getByRole('heading', { name: '複数の明細ファイルを、安全に取り込みますか？' }),
    ).toBeTruthy();
    expect(screen.getByRole('complementary', { name: '対象期間（グローバル）' })).toBeTruthy();
    for (const name of [
      '1. ファイルを選択',
      '2. 取込ファイル一覧',
      '3. 取込内容の確認',
      '4. 取込結果',
      '5. 取込履歴',
    ])
      expect(screen.getByRole('heading', { name: new RegExp(`^${name.replace('.', '\\.')}`) })).toBeTruthy();

    const steps = within(screen.getByRole('list', { name: '取込の手順' })).getAllByRole('listitem');
    expect(steps.map((step) => step.querySelector('strong')?.textContent)).toEqual([
      'ファイル選択',
      '内容確認',
      '取込結果',
    ]);
    expect(currentStep()).toBe(1);
    expect(screen.queryByRole('region', { name: '選択中のファイル' })).toBeNull();
    expect(screen.getByText('まだ取り込んでいません')).toBeTruthy();
    expect(await screen.findByText('まだ取込履歴はありません')).toBeTruthy();
  });

  it('一覧は 9 列、要約は 6 項目、履歴は 7 列と一括削除の選択列を持つ', async () => {
    const row = runRow({ id: 'run-1' });
    mount({ runs: [row], details: { 'run-1': runDetail(row) } });
    chooseImportFiles([csvFile('a-2026-08.csv')]);

    const files = columnNames(await screen.findByRole('table', { name: '取込ファイル一覧' }));
    expect(files).toHaveLength(9);
    expect(files.slice(1)).toEqual([
      'ファイル名',
      '取込元',
      '対象期間',
      'ファイルサイズ',
      '重複チェック',
      'バリデーション',
      'ステータス',
      '操作',
    ]);

    const summary = screen.getByRole('region', { name: /取込内容の確認/ });
    await waitFor(() => expect(within(summary).getByText('1件')).toBeTruthy());
    expect(Array.from(summary.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      '対象ファイル',
      '取り込み予定の明細',
      '対象期間',
      '影響する取込元',
      '重複の可能性',
      'サブスク候補',
    ]);

    const history = columnNames(await screen.findByRole('table', { name: '取込履歴' }));
    expect(history).toHaveLength(8);
    expect(history.slice(1)).toEqual([
      '取込日時',
      '取込元',
      'ファイル数',
      '取込明細数',
      '結果',
      '詳細',
      '操作',
    ]);
  });

  it('選ぶと 2 段目と選択件数バー、確定すると 3 段目と結果 4 枚が出る', async () => {
    mount();
    chooseImportFiles([csvFile('a-2026-08.csv'), csvFile('b-2026-08.csv', '計算対象,日付\n2,2026/08/11\n')]);

    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    expect(within(bar).getByText('2 件のファイルを選択中')).toBeTruthy();
    const commit = await within(bar).findByRole('button', { name: '✓ 2ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
    expect(currentStep()).toBe(2);

    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );
    await screen.findByText('2 件のファイルを正常に取り込みました');
    expect(currentStep()).toBe(3);

    const cards = within(screen.getByRole('region', { name: /取込結果/ }))
      .getAllByRole('listitem')
      .filter((item) => item.classList.contains('import-result-card'));
    expect(cards.map((card) => card.querySelector('span')?.textContent?.replace(/^[✓✕!↻]\s*/, ''))).toEqual([
      '取込成功',
      '取込失敗',
      '重複の可能性',
      'サブスク候補',
    ]);
    expect(screen.queryByRole('region', { name: '選択中のファイル' })).toBeNull();
  });

  it('?run=<id> で開くと詳細ペインを復元し、閉じると ?run を外す', async () => {
    const row = runRow({ id: 'run-1' });
    mount({ runs: [row], details: { 'run-1': runDetail(row) } }, ['/?run=run-1']);

    const pane = await screen.findByRole('complementary', { name: '履歴の詳細' });
    expect(await within(pane).findByRole('listitem', { name: '架空-2026-06.csvの取込履歴' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('?run=run-1');

    fireEvent.click(within(pane).getByRole('button', { name: '履歴の詳細を閉じる' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: '履歴の詳細' })).toBeNull());
    expect(screen.getByTestId('location').textContent).toBe('');
  });
});

describe('送信前の上限判定は core の共通境界表どおり', () => {
  /** 中身は小さく、大きさだけ境界の値にする (jsdom で数十 MB を確保しない) */
  const sizedFile = ({ name, size }: { name: string; size: number }) => {
    const file = new File(['{}'], name, { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  it.each(IMPORT_LIMIT_BOUNDARY_CASES)('$name', async (entry) => {
    const server = mount();
    const uploads = () =>
      server.calls.filter((call) => call.startsWith('POST /api/imports/inspections')).length;

    if (entry.before.length) {
      chooseImportFiles(entry.before.map(sizedFile));
      await waitFor(() => expect(uploads()).toBe(1));
    }
    chooseImportFiles(entry.files.map(sizedFile));

    const acceptedInNextBatch = entry.files.length - (entry.expected ? 1 : 0);
    const sent = (entry.before.length ? 1 : 0) + (acceptedInNextBatch ? 1 : 0);
    await waitFor(() => expect(uploads()).toBe(sent));
    const last = entry.files.at(-1)?.name ?? '';
    const row = await waitFor(() => {
      const found = screen.getAllByRole('row').find((candidate) => candidate.textContent?.includes(last));
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });
    if (entry.expected) {
      expect(row.getAttribute('data-state')).toBe('blocked');
      expect(row.textContent).toContain(importLimitReason(entry.expected));
    } else {
      await waitFor(() => expect(row.getAttribute('data-state')).toBe('ready'));
    }
    expect(uploads()).toBe(sent);
  });
});

describe('状態・安全・既定値', () => {
  it('MF を確定しても検査済み ID だけを送り、ファイルを再送しない', async () => {
    const server = mount({ inspect: () => ({ source: 'mf' }) });
    chooseImportFiles([csvFile('mf-2026-08.csv')]);

    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    const commit = await within(bar).findByRole('button', { name: '✓ 1ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );
    await screen.findByText('1 件のファイルを正常に取り込みました');

    expect(server.calls.filter((call) => call.includes('/api/imports/diff'))).toEqual([]);
    expect(server.calls.filter((call) => call === 'POST /api/imports')).toEqual([]);
    expect(server.calls.filter((call) => call === 'POST /api/imports/runs')).toHaveLength(1);
    expect(server.calls.filter((call) => call.includes('/api/imports/inspections'))).toHaveLength(1);
  });

  it('履歴は読込中を示し、失敗すると理由と再読込を出し、再読込で空の状態に戻る', async () => {
    let fail = true;
    let release: (() => void) | null = null;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    mount({
      route: async (method, path) => {
        if (method !== 'GET' || path !== '/api/imports/runs') return undefined;
        await pending;
        return fail
          ? new Response(JSON.stringify({ error: { code: 'internal', message: '一時的な障害' } }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          : undefined;
      },
    });
    const history = screen.getByRole('region', { name: /取込履歴/ });
    expect(within(history).getByText('データを読み込み中…')).toBeTruthy();

    (release as unknown as () => void)();
    const alert = await within(history).findByRole('alert');
    expect(alert.textContent).toContain('取込履歴を読み込めませんでした。');

    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: '再読込' }));
    expect(await within(history).findByText('まだ取込履歴はありません')).toBeTruthy();
  });

  it('ファイル名の HTML は要素にならず、文字のまま出る', async () => {
    const name = '<img src=x onerror="alert(1)">.csv';
    mount();
    chooseImportFiles([csvFile(name)]);
    const table = await screen.findByRole('table', { name: '取込ファイル一覧' });
    expect(await within(table).findByText(name)).toBeTruthy();
    expect(table.querySelector('img')).toBeNull();
  });

  it('送信が通信で落ちた行は、理由つきの失敗になり、再試行で取込準備完了に戻る', async () => {
    let failOnce = true;
    mount({
      uploadFails: () => {
        const fail = failOnce;
        failOnce = false;
        return fail;
      },
    });
    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const table = await screen.findByRole('table', { name: '取込ファイル一覧' });
    const row = () =>
      within(table)
        .getAllByRole('row')
        .find((candidate) => candidate.textContent?.includes('a-2026-08.csv')) as HTMLElement;
    await waitFor(() => expect(row().getAttribute('data-state')).toBe('failed'));
    expect(row().textContent).toContain('通信できませんでした');

    fireEvent.click(within(row()).getByRole('button', { name: /再試行/ }));
    await waitFor(() => expect(row().getAttribute('data-state')).toBe('ready'));
  });

  it('取り込めるファイルが 0 件なら、主ボタンは押せない', async () => {
    mount({ inspect: () => ({ source: 'freee', state: 'blocked', reason: '対応していない形式です' }) });
    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    await waitFor(() => expect(within(bar).getByText(/取込可能：0件/)).toBeTruthy());
    const commit = within(bar).getByRole('button', { name: '✓ 0ファイルを取り込む' }) as HTMLButtonElement;
    expect(commit.disabled).toBe(true);
  });

  it('選択中のエラー行は自動除外し、取込結果の失敗と再試行対象にする', async () => {
    mount({
      inspect: (file) =>
        file.name.startsWith('bad')
          ? {
              source: 'freee',
              state: 'blocked',
              validation: { kind: 'error', count: 1 },
              reason: '日付が不正です',
            }
          : { source: 'freee' },
    });
    chooseImportFiles([csvFile('ok-2026-08.csv'), csvFile('bad-2026-08.csv')]);
    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    await waitFor(() => expect(within(bar).getByText('取込可能：1件（エラー：1件）')).toBeTruthy());
    const commit = within(bar).getByRole('button', { name: '✓ 1ファイルを取り込む' });

    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );
    await screen.findByText('エラーのあった 1 件のファイルは取り込みませんでした。');
    expect(screen.getByRole('button', { name: 'エラーのファイルのみ再試行' })).toBeTruthy();
    const failed = screen
      .getAllByRole('row')
      .find((candidate) => candidate.textContent?.includes('bad-2026-08.csv')) as HTMLElement;
    expect(failed.getAttribute('data-state')).toBe('failed');
    expect(failed.textContent).toContain('日付が不正です');
  });

  it('選択をキャンセルすると、選択件数バーが閉じる', async () => {
    mount();
    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    await waitFor(() =>
      expect(
        (within(bar).getByRole('button', { name: '✓ 1ファイルを取り込む' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );

    fireEvent.click(within(bar).getByRole('button', { name: '選択をキャンセル' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '選択中のファイル' })).toBeNull());
  });

  it('確定後も、判断に使った取込内容の要約を残す', async () => {
    mount();
    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const summary = screen.getByRole('region', { name: /3\. 取込内容の確認/ });
    await waitFor(() => expect(within(summary).getByText('1件')).toBeTruthy());

    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    const commit = within(bar).getByRole('button', { name: '✓ 1ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );
    await screen.findByText('1 件のファイルを正常に取り込みました');

    expect(within(summary).getByText('1件')).toBeTruthy();
    expect(within(summary).queryByText('-')).toBeNull();
  });

  it('確認文は、追加と月次置換の違いをそのまま説明する', async () => {
    mount();
    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    const commit = await within(bar).findByRole('button', { name: '✓ 1ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(commit);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        '同一期間の既存明細を残し、まだない明細だけ追加します。既にある明細はスキップします。',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }));

    fireEvent.click(screen.getByRole('checkbox', { name: /前回データを残す/ }));
    fireEvent.click(commit);
    expect(
      within(await screen.findByRole('dialog')).getByText(
        '同じ月の明細を今回のファイル内容に置き換えます。既存明細が消える場合があります。',
      ),
    ).toBeTruthy();
  });

  it('サマリーは全幅、結果と履歴は左、履歴詳細は右の読み順にする', async () => {
    const row = runRow({ id: 'run-1' });
    mount({ runs: [row], details: { 'run-1': runDetail(row) } }, ['/?run=run-1']);
    const summary = screen.getByRole('region', { name: /3\. 取込内容の確認/ });
    const lower = await waitFor(() => {
      const found = document.querySelector('[data-layout-region="result-history-detail"]');
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });

    expect(summary.compareDocumentPosition(lower) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lower.children[0]).toBe(screen.getByRole('region', { name: /4\. 取込結果/ }));
    expect(lower.children[1]).toBe(screen.getByRole('region', { name: /5\. 取込履歴/ }));
    expect(lower.children[2]).toBe(screen.getByRole('complementary', { name: '履歴の詳細' }));
  });

  it('「前回データを残す」は既定でオンで、確定の要求に keepPrevious: true が載る', async () => {
    const server = mount();
    const keep = screen.getByRole('checkbox', { name: /前回データを残す/ }) as HTMLInputElement;
    expect(keep.checked).toBe(true);

    chooseImportFiles([csvFile('a-2026-08.csv')]);
    const bar = await screen.findByRole('region', { name: '選択中のファイル' });
    const commit = await within(bar).findByRole('button', { name: '✓ 1ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );
    await waitFor(() =>
      expect(server.bodies.find((entry) => entry.path === '/api/imports/runs')?.body).toMatchObject({
        keepPrevious: true,
      }),
    );
  });
});
