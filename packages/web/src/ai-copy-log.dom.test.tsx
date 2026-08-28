// @vitest-environment jsdom

/**
 * AI指示文のコピー記録の表示契約。
 *
 * 「作っただけで貼り付け忘れた依頼」と「渡したのに結果が返っていない依頼」は
 * 状態だけでは同じ waiting に見える。いつ・どちらへ渡したかを一覧に出して切り分ける。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiTaskView } from './api.js';
import { RunCard } from './pages/Ai.js';

const task = (over: Partial<AiTaskView> = {}): AiTaskView => ({
  id: 't1',
  period: { from: '2026-01', to: '2026-01' },
  type: 'monthly',
  label: '2026年1月',
  supplement: null,
  copiedAt: null,
  copiedTarget: null,
  parentReportId: null,
  expiresAt: '2026-02-01T00:00:00.000Z',
  createdAt: '2026-01-31T00:00:00.000Z',
  reportId: null,
  status: 'waiting',
  ...over,
});

function mount(tasks: AiTaskView[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RunCard tasks={tasks} onChanged={vi.fn()} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('AI指示文のコピー記録', () => {
  it('一度もコピーしていない依頼は「未コピー」と出る', () => {
    mount([task()]);
    expect(screen.getByText('未コピー')).toBeTruthy();
  });

  it('コピー済みなら貼り付け先が分かる', () => {
    const { container } = mount([task({ copiedAt: '2026-01-31T09:00:00.000Z', copiedTarget: 'codex' })]);
    // 見出しの説明文にも 'Codex' が出るので、依頼一覧の行だけを見る
    const cell = container.querySelector('table.ai-table tbody tr td:nth-child(4)');
    expect(cell?.textContent).toContain('Codex');
    expect(cell?.textContent).toContain('2026');
  });
});
