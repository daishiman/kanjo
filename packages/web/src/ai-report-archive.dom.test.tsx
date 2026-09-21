// @vitest-environment jsdom

/** 全レポートをアーカイブした空状態から、表示して復元できることのDOM回帰テスト。 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiReportBody, AiReportRow } from './api.js';
import { AiReportLibraryPage, AiReportPage } from './pages/Ai.js';

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

const body: AiReportBody = {
  version: 3,
  generatedBy: 'test',
  model: null,
  title: archivedReport.title,
  analysisDepth: 'standard',
  summary: archivedReport.summary,
  keyFindings: {
    improvements: [],
    wasted: [],
    quickWins: [],
    notes: { improvements: '', wasted: '', quickWins: '' },
  },
  sections: [],
  followUp: null,
  needs: [],
  charts: [],
  dataGaps: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AIレポートの空状態と復元導線', () => {
  it('全件アーカイブ後も件数と切替を残し、表示を切り替えて開くと復元操作が現れる', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/auth/me')) return json({ user: { id: 'u-test' } });
        if (url.includes('/summary')) return json({ overview: { months: [] }, defense: {}, benchmarks: [] });
        if (url.endsWith('/ai/tasks')) return json({ tasks: [] });
        if (url.endsWith('/ai/reports?archived=1'))
          return json({ reports: [archivedReport], archivedCount: 1 });
        if (url.endsWith('/ai/reports')) return json({ reports: [], archivedCount: 1 });
        if (url.endsWith('/ai/reports/rep-archived'))
          return json({
            report: { ...archivedReport, body },
            previous: null,
            versions: [{ ...archivedReport, versionNote: '初回の分析' }],
          });
        throw new Error(`unexpected URL: ${url}`);
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MemoryRouter initialEntries={['/ai/reports']}>
        <QueryClientProvider client={client}>
          <Routes>
            <Route path="/ai/reports" element={<AiReportLibraryPage />} />
            <Route path="/ai/reports/:reportId" element={<AiReportPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('まだレポートはありません')).toBeTruthy();
    expect(screen.getByText('アーカイブ中のレポートが 1件あります。')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'アーカイブを表示' }));
    fireEvent.click(await screen.findByRole('button', { name: /架空のアーカイブ済みレポート/ }));
    expect(await screen.findByRole('button', { name: 'アーカイブから戻す' })).toBeTruthy();
    await waitFor(() => expect(calls.some((url) => url.endsWith('/ai/reports?archived=1'))).toBe(true));
  });
});
