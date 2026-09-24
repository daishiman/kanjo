// @vitest-environment jsdom

/**
 * 夜間バックアップから設定だけを戻す導線 (spec-settings-screen §7.10) の表示契約。
 *
 * バックアップが取れていても取り出せなければ「戻せる」ことにならない。一覧が出ること、
 * 差分プレビューと確認を挟むこと、復元が設定だけの経路 (POST /api/backups/:date/restore) に流れ、
 * 取引まで入れ替わる初期移行 (POST /api/restore) には合流しないことを固定する。
 */
import type { SettingsDiff } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackupItem } from './api.js';
import { BackupsSection } from './pages/settings/BackupsSection.js';
import { BACKUPS_TEXT, DRAFT_DISCARD_NOTE, RESTORE_NOTE, SAME_CONTENT } from './pages/settings/view-model.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const bucket = (count: number) => ({ count, items: [] });
const diffOf = (rules: number): SettingsDiff => ({
  normRules: { added: bucket(rules), changed: bucket(0), removed: bucket(0), reordered: bucket(0) },
  ownerLabels: { changed: [] },
  statMinMonths: null,
  cashOverrides: { added: bucket(0), changed: bucket(0), removed: bucket(0) },
  total: rules,
});

const backup = (over: Partial<BackupItem> & Pick<BackupItem, 'date'>): BackupItem => ({
  size: 2048,
  uploaded: null,
  status: 'success',
  memo: '',
  summary: null,
  formatVersion: 1,
  latest: false,
  reason: null,
  ...over,
});

function renderWith(
  backups: BackupItem[] | 'error',
  { diff = diffOf(2), hasDraft = false }: { diff?: SettingsDiff; hasDraft?: boolean } = {},
) {
  const calls: { url: string; method: string; body: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
      if (url.endsWith('/api/backups')) return backups === 'error' ? json({}, 500) : json({ backups });
      if (url.endsWith('/compare')) return json({ date: '2026-08-20', diff, revision: 'rev-1' });
      if (url.endsWith('/restore/preview')) return json({ valid: true, diff, revision: 'rev-1' });
      if (url.endsWith('/restore'))
        return json({
          ok: true,
          savedAt: 'rev-2',
          changes: diff.total,
          preRestoreKey: 'k',
          recomputed: true,
        });
      return json({});
    }),
  );
  const onRestored = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <BackupsSection hasDraft={hasDraft} onRestored={onRestored} />
    </QueryClientProvider>,
  );
  return { ...view, calls, onRestored };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('夜間バックアップから設定を戻す', () => {
  it('APIが返した順(新しい日付が先)のまま並び、サイズはKBに切り上げ、状態を見分けられる', async () => {
    // 並べ替えはAPI側の責務。web で二重に並べ替えず、返ってきた順を保つ
    const { container } = renderWith([
      backup({ date: '2026-08-20', size: 4097, latest: true }),
      backup({ date: '2026-08-19' }),
      backup({ date: '2026-08-18', size: null, status: 'failed' }),
    ]);
    await screen.findByText('2026/08/20');
    const dates = [...container.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
    expect(dates).toEqual(['2026/08/20', '2026/08/19', '2026/08/18']);
    expect(screen.getByText('5KB')).toBeTruthy();
    expect(screen.getByText('最新')).toBeTruthy();
    expect(screen.getByText('成功')).toBeTruthy();
    expect(screen.getByText('失敗')).toBeTruthy();
    expect(screen.getByText('バックアップの作成に失敗しました')).toBeTruthy();
  });

  it('失敗した回は中身が無いので、比較も復元も押せない', async () => {
    renderWith([backup({ date: '2026-08-18', size: null, status: 'failed' })]);
    const compare = await screen.findByRole('button', { name: '2026/08/18の比較' });
    const restore = screen.getByRole('button', { name: '2026/08/18の復元' });
    expect((compare as HTMLButtonElement).disabled).toBe(true);
    expect((restore as HTMLButtonElement).disabled).toBe(true);
  });

  it('復元は差分プレビューを先に見せ、キャンセルすると本適用を送らない', async () => {
    const { calls } = renderWith([backup({ date: '2026-08-20' })]);
    // 確認はアプリ内 dialog。window.confirm はブラウザの抑止で無反応になるため通さない
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    fireEvent.click(await screen.findByRole('button', { name: '2026/08/20の復元' }));
    const dialog = await screen.findByRole('dialog');
    expect(confirm).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('heading').textContent).toBe(BACKUPS_TEXT.restoreTitle('2026-08-20'));
    expect(dialog.textContent).toContain('集計ルール（追加 2 件・変更 0 件・削除 0 件）');
    expect(dialog.textContent).toContain(RESTORE_NOTE);
    expect(calls.some((c) => c.url.endsWith('/api/backups/2026-08-20/restore/preview'))).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.url.endsWith('/2026-08-20/restore'))).toBe(false);
  });

  it('確定すると設定だけの経路へ baseSavedAt 付きで送り、取引まで戻す /api/restore には流さない', async () => {
    const { calls, onRestored } = renderWith([backup({ date: '2026-08-20' })]);
    fireEvent.click(await screen.findByRole('button', { name: '2026/08/20の復元' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '復元する' }));

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    const sent = calls.find((c) => c.url.endsWith('/api/backups/2026-08-20/restore'));
    expect(sent?.method).toBe('POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({ baseSavedAt: 'rev-1' });
    expect(calls.some((c) => c.url.endsWith('/api/restore'))).toBe(false);
    expect(await screen.findByText('設定を復元しました。')).toBeTruthy();
  });

  it('現在の設定と同じ内容なら、そう伝えて『復元する』を止める', async () => {
    renderWith([backup({ date: '2026-08-20' })], { diff: diffOf(0) });
    fireEvent.click(await screen.findByRole('button', { name: '2026/08/20の復元' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(SAME_CONTENT);
    expect((within(dialog).getByRole('button', { name: '復元する' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('未保存の変更があれば、破棄されることを確認の中で伝える', async () => {
    renderWith([backup({ date: '2026-08-20' })], { hasDraft: true });
    fireEvent.click(await screen.findByRole('button', { name: '2026/08/20の復元' }));
    expect((await screen.findByRole('dialog')).textContent).toContain(DRAFT_DISCARD_NOTE);
  });

  it('比較は読むだけで、閉じる以外の口を持たない', async () => {
    const { calls } = renderWith([backup({ date: '2026-08-20' })]);
    fireEvent.click(await screen.findByRole('button', { name: '2026/08/20の比較' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('集計ルール（追加 2 件・変更 0 件・削除 0 件）');
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([BACKUPS_TEXT.close]);
    expect(calls.some((c) => c.url.endsWith('/api/backups/2026-08-20/compare'))).toBe(true);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('まだ1件も無いときは、毎日 午前2:00に作られると伝える', async () => {
    renderWith([]);
    expect(await screen.findByText(BACKUPS_TEXT.empty)).toBeTruthy();
  });

  it('一覧を読めないときは、そう伝える', async () => {
    renderWith('error');
    expect(await screen.findByText(BACKUPS_TEXT.loadFailed)).toBeTruthy();
  });
});
