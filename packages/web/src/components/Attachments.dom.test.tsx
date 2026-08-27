// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentArchiveRecovery,
  AttachmentDisclosureCell,
  AttachmentPanel,
  OrphanedAttachmentRecovery,
  useAttachmentDisclosure,
} from './Attachments.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const usage = { usedBytes: 1_024, limitBytes: 10_240, remainingBytes: 9_216 };

function withQueryClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const image = (name: string) => new File(['jpeg'], name, { type: 'image/jpeg' });

function emptyList() {
  return { attachments: [], limit: 10, usage };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json(emptyList())),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AttachmentPanel DOM contract', () => {
  it('通常file pickerとcamera inputのchangeからtarget/file入りFormDataを実POSTする', async () => {
    const uploads: Array<{ target: string; filename: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const form = init.body as FormData;
          uploads.push({
            target: String(form.get('target')),
            filename: (form.get('file') as File).name,
          });
          return json({ attachment: { id: uploads.length } }, 201);
        }
        return json(emptyList());
      }),
    );
    withQueryClient(<AttachmentPanel targetId="cash:1" />);

    const camera = screen.getByLabelText('カメラで証憑を撮影する');
    const picker = screen.getByLabelText('証憑ファイルを選ぶ');

    expect(camera.getAttribute('type')).toBe('file');
    expect(camera.getAttribute('accept')).toBe('image/*');
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(picker.hasAttribute('multiple')).toBe(true);
    expect(await screen.findByText('利用量 1 KB / 10 KB')).toBeTruthy();

    fireEvent.change(picker, { target: { files: [image('picker.jpg')] } });
    await waitFor(() => expect(uploads).toEqual([{ target: 'cash:1', filename: 'picker.jpg' }]));
    fireEvent.change(camera, { target: { files: [image('camera.jpg')] } });
    await waitFor(() =>
      expect(uploads).toEqual([
        { target: 'cash:1', filename: 'picker.jpg' },
        { target: 'cash:1', filename: 'camera.jpg' },
      ]),
    );
  });

  it('accepts a drop, keeps partial successes, and invalidates both panel and parent queries', async () => {
    const onChanged = vi.fn();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const file = (init.body as FormData).get('file') as File;
          calls.push(file.name);
          if (file.name === 'bad.jpg')
            return json({ error: { code: 'duplicate', message: '同じ証憑があります' } }, 409);
          return json({ attachment: { id: calls.length } }, 201);
        }
        return json(emptyList());
      }),
    );

    withQueryClient(<AttachmentPanel targetId="cash:2" onChanged={onChanged} />);
    const region = await screen.findByRole('region', { name: '証憑の添付' });
    fireEvent.drop(region, {
      dataTransfer: { files: [image('first.jpg'), image('bad.jpg'), image('last.jpg')] },
    });

    expect(await screen.findByText('2件を添付し、1件は添付できませんでした。')).toBeTruthy();
    expect(screen.getByText('bad.jpg: 同じ証憑があります')).toBeTruthy();
    expect(calls).toEqual(['first.jpg', 'bad.jpg', 'last.jpg']);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([, init]) => !init?.method).length,
    ).toBeGreaterThan(1);
  });

  it('commit済みPOSTのHEAD障害は再送失敗にせず成功件数と状態確認警告を同時表示する', async () => {
    let postRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          postRequests += 1;
          return json(
            {
              error: {
                code: 'attachment_availability_unavailable',
                message: '添付は保存済みです。状態を確認できないため、同じファイルを再送しないでください',
                committed: true,
                retryable: false,
              },
            },
            503,
          );
        }
        return json(emptyList());
      }),
    );

    withQueryClient(<AttachmentPanel targetId="cash:committed" />);
    const picker = screen.getByLabelText('証憑ファイルを選ぶ');
    fireEvent.change(picker, { target: { files: [image('committed.jpg')] } });

    expect(await screen.findByText('1件を添付しました。')).toBeTruthy();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '添付は保存済みです。状態を確認できないため、同じファイルを再送しないでください',
    );
    expect(postRequests).toBe(1);
  });

  it('routes a page paste only to the currently open target', async () => {
    const uploadedTargets: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          uploadedTargets.push(String((init.body as FormData).get('target')));
          return json({ attachment: { id: 1 } }, 201);
        }
        return json(emptyList());
      }),
    );

    function Harness() {
      const disclosure = useAttachmentDisclosure();
      return (
        <>
          <button type="button" onClick={() => disclosure.toggle('mf-1')}>
            1件目を開く
          </button>
          <button type="button" onClick={() => disclosure.toggle('mf-2')}>
            2件目を開く
          </button>
          {disclosure.isOpen('mf-1') && (
            <AttachmentPanel targetId="mf-1" registerPasteReceiver={disclosure.registerPasteReceiver} />
          )}
          {disclosure.isOpen('mf-2') && (
            <AttachmentPanel targetId="mf-2" registerPasteReceiver={disclosure.registerPasteReceiver} />
          )}
        </>
      );
    }

    withQueryClient(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '1件目を開く' }));
    await screen.findByRole('region', { name: '証憑の添付' });
    fireEvent.click(screen.getByRole('button', { name: '2件目を開く' }));

    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { files: [image('paste.jpg')] } });
    window.dispatchEvent(event);

    await waitFor(() => expect(uploadedTargets).toEqual(['mf-2']));
    expect(event.defaultPrevented).toBe(true);
  });

  it('derives open links, copy, and actions from original availability and cleanup stage', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          attachments: [
            {
              id: 1,
              filename: 'ready.pdf',
              size: 1_024,
              state: 'ready',
              retryable: true,
              originalAvailable: true,
              cleanupStage: 'none',
            },
            {
              id: 2,
              filename: 'object-pending.pdf',
              size: 2_048,
              state: 'delete_pending',
              retryable: true,
              originalAvailable: true,
              cleanupStage: 'object_delete_pending',
            },
            {
              id: 3,
              filename: 'object-failed.pdf',
              size: 3_072,
              state: 'delete_failed',
              retryable: true,
              originalAvailable: true,
              cleanupStage: 'object_delete_failed',
            },
            {
              id: 4,
              filename: 'metadata-pending.pdf',
              size: 4_096,
              state: 'delete_failed',
              retryable: true,
              originalAvailable: false,
              cleanupStage: 'metadata_delete_pending',
            },
            {
              id: 5,
              filename: 'dead-letter.pdf',
              size: 5_120,
              state: 'delete_failed',
              retryable: true,
              originalAvailable: false,
              cleanupStage: 'dead_letter',
            },
          ],
          limit: 10,
          usage,
        }),
      ),
    );

    withQueryClient(<AttachmentPanel targetId="mf-1" />);
    const items = await screen.findAllByRole('listitem');

    expect(within(items[0]).getByRole('link', { name: 'ready.pdf' })).toBeTruthy();
    expect(within(items[0]).getByRole('button', { name: '削除する' })).toBeTruthy();
    expect(within(items[1]).getByRole('link', { name: 'object-pending.pdf' })).toBeTruthy();
    fireEvent.click(within(items[1]).getByRole('button', { name: 'object-pending.pdfのリンクをコピー' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/api\/attachments\/2\/content$/)),
    );
    expect(await within(items[1]).findByRole('status')).toHaveProperty(
      'textContent',
      'リンクをコピーしました',
    );
    expect(within(items[1]).getByText('原本を削除中・再開可')).toBeTruthy();
    expect(within(items[2]).getByRole('link', { name: 'object-failed.pdf' })).toBeTruthy();
    expect(within(items[2]).getByText('原本の削除に失敗')).toBeTruthy();
    expect(within(items[2]).getByRole('button', { name: '原本削除を再開する' })).toBeTruthy();
    expect(within(items[3]).queryByRole('link')).toBeNull();
    expect(within(items[3]).queryByRole('button', { name: /リンクをコピー/ })).toBeNull();
    expect(within(items[3]).getByText('原本削除済み・記録を整理中')).toBeTruthy();
    expect(within(items[3]).getByRole('button', { name: '記録整理を再開する' })).toBeTruthy();
    expect(within(items[4]).queryByRole('link')).toBeNull();
    expect(within(items[4]).queryByRole('button', { name: /リンクをコピー/ })).toBeNull();
    expect(within(items[4]).getByText('自動整理を停止・手動確認が必要')).toBeTruthy();
    const manualRetry = within(items[4]).getByRole('button', { name: '手動で再試行する' });
    expect((manualRetry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(manualRetry);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/attachments/5', expect.objectContaining({ method: 'DELETE' })),
    );
  });

  it('originalAvailable wire欠落はready stateでもfail closedしてopen/copyを出さない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          attachments: [
            {
              id: 6,
              filename: 'legacy-ready.pdf',
              size: 1_024,
              state: 'ready',
              retryable: false,
              cleanupStage: 'none',
            },
          ],
          limit: 10,
          usage,
        }),
      ),
    );

    withQueryClient(<AttachmentPanel targetId="mf-wire-missing" />);
    const item = (await screen.findAllByRole('listitem'))[0];
    expect(within(item).getByText('legacy-ready.pdf')).toBeTruthy();
    expect(within(item).queryByRole('link')).toBeNull();
    expect(within(item).queryByRole('button', { name: /リンクをコピー/ })).toBeNull();
  });

  it('ready行の通常deleteはconfirm後にDELETEし、一覧と親badgeをinvalidateして空一覧を再取得する', async () => {
    const onChanged = vi.fn();
    let listRequests = 0;
    const requests: Array<{ path: string; method: string }> = [];
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const method = init?.method ?? 'GET';
        requests.push({ path, method });
        if (method === 'DELETE') return json({ ok: true });
        listRequests += 1;
        return json(
          listRequests === 1
            ? {
                attachments: [
                  {
                    id: 7,
                    filename: 'delete-ready.pdf',
                    size: 1_024,
                    state: 'ready',
                    retryable: false,
                    originalAvailable: true,
                    cleanupStage: 'none',
                  },
                ],
                limit: 10,
                usage,
              }
            : emptyList(),
        );
      }),
    );

    withQueryClient(<AttachmentPanel targetId="cash:7" onChanged={onChanged} />);
    expect(await screen.findByRole('link', { name: 'delete-ready.pdf' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));

    expect(confirm).toHaveBeenCalledWith('「delete-ready.pdf」を削除しますか?');
    await waitFor(() => expect(requests).toContainEqual({ path: '/api/attachments/7', method: 'DELETE' }));
    expect(await screen.findByText('まだ証憑は添付されていません。')).toBeTruthy();
    expect(listRequests).toBeGreaterThanOrEqual(2);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('out-of-band missingではlink/open/copyを隠し、R2原本が再出現すると自然に再表示する', async () => {
    let listRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        listRequests += 1;
        const available = listRequests > 1;
        return json({
          attachments: [
            {
              id: 31,
              filename: 'out-of-band.pdf',
              size: 2_048,
              state: 'ready',
              retryable: false,
              originalAvailable: available,
              cleanupStage: available ? 'none' : 'original_missing',
            },
          ],
          limit: 10,
          usage,
        });
      }),
    );

    const { client } = withQueryClient(<AttachmentPanel targetId="mf-out-of-band" />);
    const missingItem = (await screen.findAllByRole('listitem'))[0];
    expect(within(missingItem).queryByRole('link')).toBeNull();
    expect(within(missingItem).queryByRole('button', { name: /リンクをコピー/ })).toBeNull();
    expect(within(missingItem).getByText('原本が保管先に見つかりません')).toBeTruthy();
    expect(within(missingItem).getByRole('button', { name: '管理情報を削除する' })).toBeTruthy();

    await act(() => client.invalidateQueries({ queryKey: ['attachments', 'mf-out-of-band'] }));

    expect(await screen.findByRole('link', { name: 'out-of-band.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'out-of-band.pdfのリンクをコピー' })).toBeTruthy();
    expect(screen.queryByText('原本が保管先に見つかりません')).toBeNull();
  });

  it('shows quota exhaustion and prevents new file selection without hiding existing evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          attachments: [],
          limit: 10,
          usage: { usedBytes: 10_240, limitBytes: 10_240, remainingBytes: 0 },
        }),
      ),
    );

    withQueryClient(<AttachmentPanel targetId="cash:9" />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      '保存容量の上限に達しました。不要な証憑を削除してから追加してください。',
    );
    expect((screen.getByRole('button', { name: '撮影する' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'ファイルを選ぶ' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('attachment summary and orphan recovery DOM contract', () => {
  it('badgeは0/1/2件を未添付・添付あり 1・添付あり 2としてexact表示する', () => {
    const disclosure = {
      openTargetId: null,
      isOpen: () => false,
      toggle: vi.fn(),
      registerPasteReceiver: vi.fn(),
    };
    const { rerender } = render(
      <AttachmentDisclosureCell targetId="cash:1" status="missing" count={0} disclosure={disclosure} />,
    );
    expect(screen.getByText('未添付')).toBeTruthy();
    expect(screen.getByRole('button', { name: '証憑を追加' })).toBeTruthy();

    rerender(
      <AttachmentDisclosureCell targetId="cash:1" status="attached" count={1} disclosure={disclosure} />,
    );
    expect(screen.getByText('添付あり 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: '証憑を管理' })).toBeTruthy();

    rerender(
      <AttachmentDisclosureCell targetId="cash:1" status="attached" count={2} disclosure={disclosure} />,
    );
    expect(screen.getByText('添付あり 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: '証憑を管理' })).toBeTruthy();
  });

  it('keeps MF orphan evidence visible and only links originals that still exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          attachments: [
            {
              id: 21,
              filename: 'orphan-original.pdf',
              size: 2_048,
              state: 'ready',
              originalAvailable: true,
              cleanupStage: 'none',
              orphaned: true,
              retryable: true,
            },
            {
              id: 22,
              filename: 'orphan-cleanup.pdf',
              size: 1_024,
              state: 'delete_failed',
              originalAvailable: false,
              cleanupStage: 'metadata_delete_pending',
              orphaned: true,
              retryable: true,
            },
          ],
          usage,
        }),
      ),
    );

    withQueryClient(<OrphanedAttachmentRecovery />);
    const region = await screen.findByRole('region', { name: '親明細が見つからない証憑' });
    expect(within(region).getByText('親明細が見つからない証憑が2件あります。')).toBeTruthy();
    expect(within(region).getByRole('link', { name: 'orphan-original.pdf' })).toBeTruthy();
    expect(within(region).queryByRole('link', { name: 'orphan-cleanup.pdf' })).toBeNull();
    expect(within(region).getByText('原本削除済み・記録を整理中')).toBeTruthy();
  });
});

describe('attachment archive recovery DOM contract', () => {
  const archiveRecord = (index: number) => ({
    r2Key: `attachments/user/month/${index}.pdf`,
    target: { kind: 'mf', key: `mf-${index}` },
    filename: `receipt-${index}.pdf`,
    contentType: 'application/pdf',
    size: 100 + index,
    contentHash: `hash-${index}`,
    createdAt: '2026-08-27T00:00:00.000Z',
  });

  it('chunks 11 records into serial groups of 10 and only recovers metadata after truthful confirmation', async () => {
    const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push({ path, body });
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        const recordCount = (body.attachmentArchive as { records: Array<Record<string, unknown>> }).records
          .length;
        if (recordCount > 10)
          return json({ error: { code: 'invalid_attachment_archive', message: '最大10件です' } }, 400);
        if (path.endsWith('/archive/reconcile')) {
          return json({
            ok: true,
            report: {
              matched: 0,
              metadataMissing: recordCount,
              targetMissing: 0,
              missing: 0,
              mismatch: 0,
              skipped: 0,
              records: [],
            },
          });
        }
        return json({
          ok: true,
          recovered: recordCount,
          alreadyPresent: 0,
          skipped: 0,
          report: {
            matched: 0,
            metadataMissing: recordCount,
            targetMissing: 0,
            missing: 0,
            mismatch: 0,
            skipped: 0,
            records: [],
          },
        });
      }),
    );
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    withQueryClient(<AttachmentArchiveRecovery />);
    const inventory = {
      version: 1,
      basis: 'inventory-only',
      restoreCapable: false,
      metadataRecoveryCapable: true,
      recoveryEndpoint: '/api/attachments/archive/recover',
      records: Array.from({ length: 11 }, (_, index) => archiveRecord(index + 1)),
    };
    const file = new File([JSON.stringify({ attachmentArchive: inventory })], 'archive.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('証憑アーカイブJSONを選ぶ'), { target: { files: [file] } });

    expect(
      await screen.findByText('一致 0件 / 管理情報の欠損 11件 / 原本の欠損 0件 / 不一致 0件 / 対象外 0件'),
    ).toBeTruthy();
    expect(requests).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '証憑の管理情報を復旧する' }));

    await waitFor(() => expect(requests).toHaveLength(4));
    expect(confirm).toHaveBeenCalledWith(
      '同じ保管場所に原本が残っている証憑の管理情報だけを復元します。原本ファイルの復元ではありません。続けますか?',
    );
    expect(
      requests.map(
        ({ body }) => (body.attachmentArchive as { records: Array<Record<string, unknown>> }).records.length,
      ),
    ).toEqual([10, 1, 10, 1]);
    expect(requests.slice(2).every(({ body }) => body.confirm === true)).toBe(true);
    expect(maxInFlight).toBe(1);
    expect(
      await screen.findByText(
        '管理情報を11件復旧しました。取り込み済み 0件 / 原本の欠損 0件 / 内容の不一致 0件 / 対象外 0件。問題のある記録は成功件数に含めていません。原本ファイルを復元した操作ではありません。',
      ),
    ).toBeTruthy();
  });

  it('partially recovers only valid metadata and reports missing, mismatch, and skipped as unsuccessful', async () => {
    let requestCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        requestCount += 1;
        if (requestCount === 1)
          return json({
            ok: true,
            report: {
              matched: 0,
              metadataMissing: 1,
              targetMissing: 0,
              missing: 1,
              mismatch: 1,
              skipped: 1,
              records: [],
            },
          });
        return json(
          {
            ok: false,
            recovered: 1,
            alreadyPresent: 0,
            skipped: 1,
            report: {
              matched: 0,
              metadataMissing: 1,
              targetMissing: 0,
              missing: 1,
              mismatch: 1,
              skipped: 1,
              records: [],
            },
          },
          409,
        );
      }),
    );
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    withQueryClient(<AttachmentArchiveRecovery />);
    const file = new File(
      [
        JSON.stringify({
          attachmentArchive: {
            version: 1,
            basis: 'inventory-only',
            restoreCapable: false,
            metadataRecoveryCapable: true,
            recoveryEndpoint: '/api/attachments/archive/recover',
            records: [archiveRecord(1)],
          },
        }),
      ],
      'archive.json',
      { type: 'application/json' },
    );
    fireEvent.change(screen.getByLabelText('証憑アーカイブJSONを選ぶ'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('原本の欠損・不一致・対象外は復旧せず、成功件数に含めません。'),
    );
    fireEvent.click(screen.getByRole('button', { name: '証憑の管理情報を復旧する' }));

    expect(
      await screen.findByText(
        '管理情報を1件復旧しましたが、復旧できなかった記録があります。取り込み済み 0件 / 原本の欠損 1件 / 内容の不一致 1件 / 対象外 1件。問題のある記録は成功件数に含めていません。原本ファイルを復元した操作ではありません。',
      ),
    ).toBeTruthy();
  });
});
