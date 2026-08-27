// @vitest-environment jsdom

/** 全レポートをアーカイブした空状態から、表示して復元できることのDOM回帰テスト。 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiReportRow } from './api.js';
import { AiPage } from './pages/Ai.js';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

const archivedReport: AiReportRow = {
  id: 'rep-archived',
  taskId: 'task-archived',
  period: { from: '2026-01', to: '2026-01' },
  type: 'monthly',
  label: '2026年1月',
  version: 1,
  parentReportId: null,
  generatedBy: 'test',
  title: '架空のアーカイブ済みレポート',
  summary: '架空の総評です。',
  createdAt: '2026-02-01T00:00:00.000Z',
  archivedAt: '2026-02-02T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AIレポートの空状態と復元導線', () => {
  it('全件アーカイブ後もfilterを残し、表示を切り替えると復元操作が現れる', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/summary')) return json({ overview: { months: [] }, defense: {}, benchmarks: [] });
        if (url.endsWith('/ai/tasks')) return json({ tasks: [] });
        if (url.endsWith('/ai/reports?archived=1'))
          return json({ reports: [archivedReport], archivedCount: 1 });
        if (url.endsWith('/ai/reports')) return json({ reports: [], archivedCount: 1 });
        throw new Error(`unexpected URL: ${url}`);
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AiPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/表示中のレポートはありません/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'アーカイブも表示する(1件)' }));
    expect(await screen.findByText('架空のアーカイブ済みレポート')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'アーカイブから戻す' })).toBeTruthy();
    await waitFor(() => expect(calls.some((url) => url.endsWith('/ai/reports?archived=1'))).toBe(true));
  });
});
