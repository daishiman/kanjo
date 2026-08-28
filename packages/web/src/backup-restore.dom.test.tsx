// @vitest-environment jsdom

/**
 * 夜間バックアップからの復元導線(FR-05)の表示契約。
 *
 * バックアップが取れていても取り出せなければ「戻せる」ことにならないので、
 * 一覧が出ること・上書きの確認を挟むこと・復元経路が初期移行と同じ
 * POST /api/restore に合流することを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_RESTORE_CONFIRMATION, NightlyBackups } from './pages/Settings.js';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

function renderWith(backups: { date: string; size: number; uploaded: string | null }[]) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/api/backups')) return json({ backups });
      if (url.includes('/api/backups/')) return json({ months: ['2026-01'], biz: {} });
      if (url.endsWith('/api/restore')) return json({ duplicate: false, months: 1 });
      return json({});
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <NightlyBackups />
    </QueryClientProvider>,
  );
  return { ...view, calls };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('夜間バックアップからの復元', () => {
  it('APIが返した順(新しい日付が先)のまま並び、サイズがKBで出る', async () => {
    // 並べ替えはAPI側の責務。web で二重に並べ替えず、返ってきた順を保つ
    const { container } = renderWith([
      { date: '2026-08-20', size: 4096, uploaded: null },
      { date: '2026-08-01', size: 2048, uploaded: null },
    ]);
    await screen.findByText('2026-08-20');
    const dates = [...container.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
    expect(dates).toEqual(['2026-08-20', '2026-08-01']);
    expect(screen.getByText('4 KB')).toBeTruthy();
  });

  it('確認をキャンセルすると何も送らない(上書き操作なので)', async () => {
    const { calls } = renderWith([{ date: '2026-08-20', size: 2048, uploaded: null }]);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    fireEvent.click(await screen.findByRole('button', { name: 'この日に戻す' }));
    expect(confirm).toHaveBeenCalledWith(BACKUP_RESTORE_CONFIRMATION);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('確認したら、その日の中身を取り出して初期移行と同じ /restore へ流す', async () => {
    const { calls } = renderWith([{ date: '2026-08-20', size: 2048, uploaded: null }]);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'この日に戻す' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/restore'))).toBe(true));
    expect(calls.some((c) => c.url.endsWith('/api/backups/2026-08-20'))).toBe(true);
    expect(calls.find((c) => c.url.endsWith('/api/restore'))?.method).toBe('POST');
  });

  it('まだ1件も無いときは、初回の夜間実行待ちだと伝える', async () => {
    renderWith([]);
    expect(await screen.findByText(/初回の夜間実行後に出ます/)).toBeTruthy();
  });
});
