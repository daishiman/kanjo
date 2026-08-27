// @vitest-environment jsdom

/**
 * AI分析「2. 実行する」の依頼一覧の見え方。
 * - 受信済みの依頼は畳み、結果待ちだけを最初から見せる(検証で依頼を何度も作っても一覧が伸びない)
 * - 取り消しは元に戻せないので、確認を挟んでからでないと送らない
 * 架空の依頼だけを使い、実データには触れない。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiTaskView } from './api.js';
import { RunCard } from './pages/Ai.js';

const task = (id: string, status: AiTaskView['status'], createdAt: string): AiTaskView => ({
  id,
  period: { from: '2026-01', to: '2026-01' },
  type: 'monthly',
  label: '2026年1月',
  supplement: null,
  parentReportId: null,
  expiresAt: '2026-02-02T00:00:00.000Z',
  createdAt,
  reportId: status === 'done' ? `rep-${id}` : null,
  status,
});

function mount(tasks: AiTaskView[]) {
  const onChanged = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RunCard tasks={tasks} onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return { ...view, onChanged };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('依頼一覧の畳み方', () => {
  it('受信済みは畳んで件数だけ出し、結果待ちはそのまま出す', () => {
    const { container } = mount([
      task('t1', 'done', '2026-02-01T00:00:00.000Z'),
      task('t2', 'done', '2026-02-01T01:00:00.000Z'),
      task('t3', 'waiting', '2026-02-01T02:00:00.000Z'),
    ]);
    const details = container.querySelector('details.task-done');
    expect(details).toBeTruthy();
    // 既定では閉じている(open 属性が付かない)
    expect((details as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByText('受信済みの依頼 2件')).toBeTruthy();
    // 結果待ちの行は畳まれた中ではなく表に直接出る
    const openRows = container.querySelectorAll('table.ai-table');
    expect(openRows.length).toBe(2); // 結果待ちの表 + 畳んだ中の表
    expect(details?.contains(openRows[0] as Node)).toBe(false);
  });

  it('結果待ちが無いときは、そう書いて空表を出さない', () => {
    mount([task('t1', 'done', '2026-02-01T00:00:00.000Z')]);
    expect(screen.getByText(/結果待ちの依頼はありません/)).toBeTruthy();
    expect(screen.getByText('受信済みの依頼 1件')).toBeTruthy();
  });

  it('受信済みが無ければ畳む見出し自体を出さない', () => {
    const { container } = mount([task('t3', 'waiting', '2026-02-01T02:00:00.000Z')]);
    expect(container.querySelector('details.task-done')).toBeNull();
  });
});

describe('結果待ちの取り消し', () => {
  it('確認でキャンセルしたら何も送らない', () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount([task('t3', 'waiting', '2026-02-01T02:00:00.000Z')]);
    fireEvent.click(screen.getByText('取り消す'));
    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('確認でOKなら DELETE を送り、一覧の読み直しを促す', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = mount([task('t3', 'waiting', '2026-02-01T02:00:00.000Z')]);
    fireEvent.click(screen.getByText('取り消す'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/ai/tasks/t3');
    expect(init.method).toBe('DELETE');
  });
});
