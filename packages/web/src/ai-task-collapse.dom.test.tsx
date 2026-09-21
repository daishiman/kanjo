// @vitest-environment jsdom

/**
 * AI分析「2. 実行中」の依頼一覧の操作 (spec-ai-analysis-screen「段階ごとの操作と遷移」)。
 * - 結果待ち (待機中・実行中) にはキャンセルだけ。キャンセルは履歴が残るので確認を挟まない
 * - 完了には詳細だけ、失敗・キャンセルには再実行と削除
 * - 削除は戻せないので、アプリ内の確認ダイアログを通してからでないと送らない
 * 架空の依頼だけを使い、実データには触れない。
 */
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiTaskView } from './api.js';
import { AiRunTable } from './pages/ai/AiRunTable.js';

type Stage = AiTaskView['stage'];
const PROGRESS: Record<Stage, number | null> = {
  waiting: 0,
  running: 50,
  done: 100,
  failed: null,
  canceled: null,
};

const task = (id: string, stage: Stage, seq: number): AiTaskView => ({
  id,
  period: { from: '2025-09', to: '2026-08' },
  type: 'annual',
  label: '2025年9月〜2026年8月',
  supplement: stage === 'running' ? '費用の削減余地を分析\n2行目' : null,
  copiedAt: null,
  copiedTarget: null,
  parentReportId: null,
  expiresAt: '2026-09-11T00:00:00.000Z',
  createdAt: `2026-09-10T0${seq}:00:00.000Z`,
  reportId: stage === 'done' ? `rep-${id}` : null,
  status: stage === 'done' ? 'done' : stage === 'waiting' || stage === 'running' ? 'waiting' : 'expired',
  seq,
  displayId: `T-000${seq}`,
  stage,
  progress: PROGRESS[stage],
  dataFetchedAt: stage === 'running' ? '2026-09-10T01:00:00.000Z' : null,
  rejectedAt: null,
  rejectCount: 0,
  canceledAt: stage === 'canceled' ? '2026-09-10T02:00:00.000Z' : null,
});

const queryOf = (tasks: AiTaskView[]) =>
  ({
    data: { tasks },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }) as unknown as UseQueryResult<{ tasks: AiTaskView[] }>;

function mount(tasks: AiTaskView[]) {
  const onChanged = vi.fn();
  const onSelect = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AiRunTable
        query={queryOf(tasks)}
        onSelect={onSelect}
        onOpenReport={vi.fn()}
        onChanged={onChanged}
        onRetried={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { ...view, onChanged, onSelect };
}

const row = (id: string) => document.getElementById(`ai-task-${id}`) as HTMLElement;
const buttonsOf = (id: string) =>
  within(row(id))
    .getAllByRole('button')
    .map((b) => b.textContent)
    .slice(1); // 先頭は ID のボタン

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('段階ごとの操作', () => {
  it('表の 7 列と、段階ごとの操作ボタンが表どおりに出る', () => {
    const { container } = mount([
      task('w', 'waiting', 1),
      task('r', 'running', 2),
      task('d', 'done', 3),
      task('f', 'failed', 4),
      task('c', 'canceled', 5),
    ]);
    const heads = [...container.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(heads).toEqual(['ID', 'ステータス', '依頼期間', '作成日時', '進捗', '依頼内容', '操作']);
    expect(buttonsOf('w')).toEqual(['キャンセル']);
    expect(buttonsOf('r')).toEqual(['キャンセル']);
    expect(buttonsOf('d')).toEqual(['詳細']);
    expect(buttonsOf('f')).toEqual(['再実行', '削除']);
    expect(buttonsOf('c')).toEqual(['再実行', '削除']);
  });

  it('段階は文字、進捗は % の数値で出し、失敗・キャンセルは「-」にする', () => {
    mount([task('r', 'running', 2), task('c', 'canceled', 5)]);
    expect(row('r').textContent).toContain('実行中');
    expect(row('r').textContent).toContain('50%');
    expect(row('r').textContent).toContain('費用の削減余地を分析');
    expect(row('r').textContent).not.toContain('2行目');
    expect(row('c').textContent).toContain('キャンセル');
    expect(row('c').textContent).toContain('-');
  });

  it('依頼が無ければ空の文を出して表を出さない', () => {
    const { container } = mount([]);
    expect(screen.getByText('まだ依頼はありません')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });
});

describe('キャンセルと削除', () => {
  it('キャンセルは確認なしで POST /cancel を送り、一覧の読み直しを促す', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = mount([task('w', 'waiting', 1)]);
    fireEvent.click(within(row('w')).getByRole('button', { name: 'キャンセル' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/ai/tasks/w/cancel');
    expect(init.method).toBe('POST');
  });

  it('409 already_done は文を出して一覧を取り直す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'already_done', message: 'done' } }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const { onChanged } = mount([task('w', 'waiting', 1)]);
    fireEvent.click(within(row('w')).getByRole('button', { name: 'キャンセル' }));
    expect(await screen.findByText('この依頼は結果を受信済みです。一覧を更新しました。')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  /**
   * 確認はアプリ内の <dialog> で出す。window.confirm はブラウザの「このページでこれ以上
   * ダイアログを表示しない」が効くと即 false を返し、押しても無反応なボタンになったまま
   * 理由も画面に出ない。呼ばれていないことまで固定して、戻した実装をここで落とす。
   */
  it('削除でやめるを押したら何も送らず、window.confirm も通さない', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount([task('f', 'failed', 4)]);
    fireEvent.click(within(row('f')).getByRole('button', { name: '削除' }));

    expect(confirm).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('元に戻せません');
    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('依頼の記録を消すを押すと DELETE を送り、確認を閉じる', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = mount([task('c', 'canceled', 5)]);
    fireEvent.click(within(row('c')).getByRole('button', { name: '削除' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '依頼の記録を消す' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/ai/tasks/c');
    expect(init.method).toBe('DELETE');
    // 送り終えたら確認は閉じる。開いたままだと二重に送れてしまう
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
