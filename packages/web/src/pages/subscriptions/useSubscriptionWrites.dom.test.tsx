// @vitest-environment jsdom

/**
 * 書き込みの列と自動の送り直し (SM-FE-01 / 05 / 06)。画面を通さずにフックだけを動かし、送った回数・key・base・待ち時間を数える。
 * 待ち時間は差し替えて実時間を使わない (1・2・4 秒を実際に待つと 1 件で 7 秒かかる)。
 *
 * 旧実装 (retry なし・押した時点の base で並行に送る) では、busy と revision の衝突がそのまま
 * 「サーバー側で処理に失敗しました」になり、ここの送った回数と key の検査が落ちる。
 */
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYSIS_DERIVED_QUERY_ROOTS } from '../../analysis-query-invalidation.js';
import { resetRetryProgressForTest } from './operationProgress.js';
import { BUSY_EXHAUSTED, REVISION_EXHAUSTED, SERVER_FAILED } from './operationText.js';
import type { RunOutcome, WriteIntent } from './types.js';
import { OPERATIONS_KEY, WRITE_KEY, useSubscriptionWrites } from './useSubscriptionWrites.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiError = (status: number, code: string) =>
  json({ error: { code, message: `${code} の応答` } }, status);

const busy = () => apiError(409, 'canonical_write_busy');
const overloaded = () => apiError(503, 'd1_overloaded');
const conflict = () => apiError(409, 'subscription_revision_conflict');
const internal = () => apiError(500, 'internal');

interface SentWrite {
  method: string;
  path: string;
  key: string | null;
  body: Record<string, unknown>;
}

type WriteReply = (server: { revision: number }) => Response | Promise<Response>;

const ok =
  (extra: Record<string, unknown> = {}): WriteReply =>
  (server) => {
    server.revision += 1;
    return json({ revision: server.revision, id: 50, ...extra });
  };

interface SetupOptions {
  /** GET /sub-vendors が返す登録 */
  vendors?: Array<Record<string, unknown>>;
  /** GET /sub-vendors の応答を先頭から使う。尽きたら登録の一覧を返す */
  vendorReads?: Array<() => Response>;
  newKey?: () => string;
}

function setup(replies: WriteReply[], options: SetupOptions = {}) {
  const server = { revision: 10 };
  const writes: SentWrite[] = [];
  const reads: string[] = [];
  const waits: number[] = [];
  let keySeq = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path =
      String(input)
        .replace(/^\/api/, '')
        .split('?')[0] ?? '';
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      reads.push(path);
      if (path === '/auth/me') return json({ user: { email: 'owner@example.com' } });
      if (path === '/sub-vendors') {
        const reply = options.vendorReads?.shift();
        if (reply) return reply();
        return json({ vendors: options.vendors ?? [], accountOptions: [], revision: server.revision });
      }
      if (path === '/subscription-operations') return json({ operations: [], revision: server.revision });
      return json({}, 404);
    }
    const headers = new Headers(init?.headers);
    writes.push({
      method,
      path,
      key: headers.get('idempotency-key'),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    const reply = replies.shift();
    if (!reply) throw new Error(`想定外の書き込み ${method} ${path}`);
    return reply(server);
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useSubscriptionWrites({
        wait: async (ms) => {
          waits.push(ms);
        },
        newKey:
          options.newKey ??
          (() => {
            keySeq += 1;
            return `key-${keySeq}`;
          }),
      }),
    { wrapper },
  );
  return { ...hook, server, writes, reads, waits, client };
}

/** 操作の記録 (revision を持つ) を読むまで待つ。読む前に送ると base を省いてしまう */
async function ready(client: QueryClient) {
  await waitFor(() => expect(client.getQueryData(OPERATIONS_KEY)).toBeDefined());
}

const create: WriteIntent = { kind: 'vendor_create', name: 'Aqua Voice' };

async function runWrite(
  result: { current: ReturnType<typeof useSubscriptionWrites> },
  intent: WriteIntent,
): Promise<RunOutcome> {
  let outcome: RunOutcome | undefined;
  await act(async () => {
    outcome = await result.current.run(intent);
  });
  if (!outcome) throw new Error('run が解決しませんでした');
  return outcome;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetRetryProgressForTest();
});

describe('自動の送り直し', () => {
  it('busy 2 回の後に成功: 同じ key・同じ base で 1 秒と 2 秒待って送り直し、失敗を見せない', async () => {
    const { result, client, writes, waits } = setup([() => busy(), () => busy(), ok()]);
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome.ok).toBe(true);
    expect(writes).toHaveLength(3);
    expect(new Set(writes.map((write) => write.key))).toEqual(new Set(['key-1']));
    expect(writes.map((write) => write.body.baseRevision)).toEqual([10, 10, 10]);
    expect(waits).toEqual([1_000, 2_000]);
    await waitFor(() => expect(result.current.liveText).toBe('登録: 完了'));
    expect(result.current.rows.every((row) => row.state !== 'failed')).toBe(true);
  });

  it('revision の衝突 1 回の後に成功: 待たずに登録を取り直し、新しい key と最新の base で送り直す', async () => {
    const { result, client, writes, waits, reads, server } = setup([
      (state) => {
        // 他の利用者の操作が先に反映された
        state.revision = 11;
        return conflict();
      },
      ok(),
    ]);
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome.ok).toBe(true);
    expect(writes.map((write) => [write.key, write.body.baseRevision])).toEqual([
      ['key-1', 10],
      ['key-2', 11],
    ]);
    expect(waits).toEqual([]);
    expect(reads.filter((path) => path === '/sub-vendors')).toHaveLength(1);
    expect(server.revision).toBe(12);
  });

  it('busy 4 回で上限: 1・2・4 秒で 3 回まで送り直して失敗にし、再試行は同じ key と本文で送る', async () => {
    const { result, client, writes, waits } = setup([() => busy(), () => busy(), () => busy(), () => busy()]);
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome).toEqual({ ok: false, code: 'canonical_write_busy' });
    expect(writes).toHaveLength(4);
    expect(waits).toEqual([1_000, 2_000, 4_000]);
    await waitFor(() => expect(result.current.rows[0]?.state).toBe('failed'));
    const failed = result.current.rows[0];
    expect(failed?.detail).toBe(BUSY_EXHAUSTED);
    expect(failed?.detail).not.toBe(SERVER_FAILED);
    expect(failed?.retryOf).not.toBeNull();
    expect(result.current.liveText).toBe(`登録: 失敗。${BUSY_EXHAUSTED}`);
  });

  it('500 は自動で送り直さず、再試行は同じ key と同じ本文で 1 回だけ送る', async () => {
    const replies: WriteReply[] = [() => internal()];
    const { result, client, writes, waits } = setup(replies);
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome).toEqual({ ok: false, code: 'internal' });
    expect(writes).toHaveLength(1);
    expect(waits).toEqual([]);
    await waitFor(() => expect(result.current.rows[0]?.detail).toBe(SERVER_FAILED));
    const retryOf = result.current.rows[0]?.retryOf;
    expect(retryOf).toEqual(expect.any(Number));

    replies.push(ok());
    act(() => result.current.retry(retryOf as number));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    await waitFor(() => expect(result.current.rows.some((row) => row.state === 'failed')).toBe(false));
  });

  it('revision の衝突が 4 回続いたら上限にし、再試行は取り直した上で新しい key で送る', async () => {
    const replies: WriteReply[] = [
      (state) => {
        state.revision += 1;
        return conflict();
      },
    ];
    for (let i = 0; i < 3; i += 1) replies.push(replies[0] as WriteReply);
    const { result, client, writes } = setup(replies);
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome).toEqual({ ok: false, code: 'subscription_revision_conflict' });
    expect(writes.map((write) => write.key)).toEqual(['key-1', 'key-2', 'key-3', 'key-4']);
    await waitFor(() => expect(result.current.rows[0]?.detail).toBe(REVISION_EXHAUSTED));

    replies.push(ok());
    act(() => result.current.retry(result.current.rows[0]?.retryOf as number));
    await waitFor(() => expect(writes).toHaveLength(5));
    expect(writes[4]?.key).toBe('key-5');
  });

  it('revision の衝突後の取り直しが busy なら 1 秒待って読み直し、新しい key で送って失敗を見せない', async () => {
    const { result, client, writes, waits, reads } = setup(
      [
        (state) => {
          state.revision = 11;
          return conflict();
        },
        ok(),
      ],
      { vendorReads: [() => busy()] },
    );
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome.ok).toBe(true);
    expect(writes.map((write) => [write.key, write.body.baseRevision])).toEqual([
      ['key-1', 10],
      ['key-2', 11],
    ]);
    expect(waits).toEqual([1_000]);
    expect(reads.filter((path) => path === '/sub-vendors')).toHaveLength(2);
    await waitFor(() => expect(result.current.liveText).toBe('登録: 完了'));
    expect(result.current.rows.every((row) => row.state !== 'failed')).toBe(true);
  });

  it('取り直しの busy は書き込みの busy と回数を分け合い、上限で BUSY_EXHAUSTED にし、再試行は新しい key で送る', async () => {
    const replies: WriteReply[] = [
      () => busy(),
      (state) => {
        state.revision = 11;
        return conflict();
      },
    ];
    const { result, client, writes, waits } = setup(replies, {
      vendorReads: [() => overloaded(), () => busy(), () => busy()],
    });
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome).toEqual({ ok: false, code: 'canonical_write_busy' });
    expect(writes.map((write) => write.key)).toEqual(['key-1', 'key-1']);
    expect(waits).toEqual([1_000, 2_000, 4_000]);
    await waitFor(() => expect(result.current.rows[0]?.detail).toBe(BUSY_EXHAUSTED));
    expect(result.current.liveText).toBe(`登録: 失敗。${BUSY_EXHAUSTED}`);

    // 衝突した base の要求は送り直しても衝突するので、取り直しの途中で諦めた再試行は本文を作り直す
    replies.push(ok());
    act(() => result.current.retry(result.current.rows[0]?.retryOf as number));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]?.key).toBe('key-2');
  });
});

describe('他画面の派生分析', () => {
  const vendors = [
    { id: 1, name: 'Aqua Voice', aliases: [], accounts: [], mergedIntoId: null },
    { id: 2, name: 'aquavoice', aliases: [], accounts: [], mergedIntoId: null },
  ];
  const fallback = { aliases: [], accounts: [] };

  /** 派生分析の根ごとに読込済みの取得を 1 つ置き、古い印が付いた key を返す関数を渡す */
  function seedAnalysis(client: QueryClient) {
    const keys = ANALYSIS_DERIVED_QUERY_ROOTS.map((root) => [...root, '2026-09']);
    for (const key of keys) client.setQueryData(key, { loaded: true });
    return () => keys.filter((key) => client.getQueryState(key)?.isInvalidated);
  }

  // 分け方の正本は API の withAggregates (routes/subs.ts と subscription-writes.ts の handleMerge・handleUndo)
  it.each<[string, WriteIntent]>([
    [
      '統合',
      {
        kind: 'merge',
        targetId: 1,
        targetName: 'Aqua Voice',
        targetKey: null,
        sourceVendorIds: [2],
        sourceKeys: [],
        rawNames: [],
        names: { '1': 'Aqua Voice', '2': 'aquavoice' },
      },
    ],
    ['統合の取り消し', { kind: 'unmerge', operationId: 'op-1', targetName: 'Aqua Voice' }],
    ['登録', create],
    [
      '名前の変更',
      {
        kind: 'vendor_update',
        vendorId: 1,
        vendorName: 'Aqua Voice',
        change: { field: 'name', value: 'Aqua' },
        fallback,
      },
    ],
    ['別名の追加', { kind: 'vendor_aliases_add', vendorId: 1, vendorName: 'Aqua Voice', aliases: ['aqua'] }],
    ['登録の削除', { kind: 'vendor_delete', vendorId: 1, vendorName: 'Aqua Voice' }],
  ])('%s は subs の集計を置き換えるので、成功後に派生分析のすべてへ古い印を付ける', async (_, intent) => {
    const { result, client } = setup([ok()], { vendors });
    await ready(client);
    const invalidated = seedAnalysis(client);

    const outcome = await runWrite(result, intent);

    expect(outcome.ok).toBe(true);
    expect(invalidated()).toHaveLength(ANALYSIS_DERIVED_QUERY_ROOTS.length);
  });

  it.each<[string, WriteIntent]>([
    ['見直し日の記録', { kind: 'review', vendorId: 1, vendorName: 'Aqua Voice' }],
    [
      '候補の判断',
      {
        kind: 'review_decision',
        vendorKey: 'aqua voice',
        decision: 'confirmed',
        path: '/subscriptions/review-decisions',
      },
    ],
    ['除外', { kind: 'exclusion', partner: 'Aqua Voice' }],
    [
      'カテゴリの変更',
      {
        kind: 'vendor_update',
        vendorId: 1,
        vendorName: 'Aqua Voice',
        change: { field: 'category', value: 'AI' },
        fallback,
      },
    ],
  ])('%s は集計を変えないので、派生分析には古い印を付けない', async (_, intent) => {
    const { result, client } = setup([ok()], { vendors });
    await ready(client);
    const invalidated = seedAnalysis(client);

    const outcome = await runWrite(result, intent);

    expect(outcome.ok).toBe(true);
    expect(invalidated()).toEqual([]);
  });

  it('派生分析の取り直しは待たない: 表示中の分析の取得が終わらなくても、書き込みは完了する', async () => {
    const { result, client } = setup([ok()]);
    await ready(client);
    const observer = new QueryObserver(client, {
      queryKey: [...ANALYSIS_DERIVED_QUERY_ROOTS[0], '2026-09'],
      queryFn: () => new Promise<never>(() => undefined),
    });
    const unsubscribe = observer.subscribe(() => undefined);

    const outcome = await runWrite(result, create);

    expect(outcome.ok).toBe(true);
    unsubscribe();
  });
});

describe('送る前の画面の不具合', () => {
  it('本文を作る段で投げた例外は送らずに読み込み直しを促し、「サーバー側で処理に失敗しました」を出さない', async () => {
    const { result, client, writes } = setup([], {
      // 安全でない接続では crypto.randomUUID が無く、fetch の失敗と同じ TypeError になる
      newKey: () => {
        throw new TypeError('crypto.randomUUID is not a function');
      },
    });
    await ready(client);

    const outcome = await runWrite(result, create);

    expect(outcome).toEqual({ ok: false, code: null });
    expect(writes).toHaveLength(0);
    await waitFor(() => expect(result.current.rows[0]?.state).toBe('failed'));
    expect(result.current.rows[0]?.detail).toContain('画面を読み込み直して');
    expect(result.current.rows[0]?.retryOf).toBeNull();
    expect(result.current.liveText).not.toContain(SERVER_FAILED);
  });
});

describe('書き込みの列', () => {
  it('続けて積んだ操作は前の操作の応答と取り直しを待ってから、その revision を base にして送る', async () => {
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const { result, client, writes } = setup([
      async (state) => {
        await gate;
        return ok()(state);
      },
      ok(),
    ]);
    await ready(client);

    let first: Promise<RunOutcome> = Promise.resolve({ ok: false, code: null });
    let second: Promise<RunOutcome> = first;
    act(() => {
      first = result.current.run(create);
      second = result.current.run({ kind: 'vendor_create', name: 'Notion' });
    });

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.rows.map((row) => row.state).sort()).toEqual(['running', 'waiting']),
    );
    expect(result.current.busy).toBe(true);
    // 1 件目の応答が来るまで 2 件目は送らない
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(writes).toHaveLength(1);

    await act(async () => {
      releaseFirst();
      await Promise.all([first, second]);
    });

    expect(writes.map((write) => [write.body.name, write.body.baseRevision])).toEqual([
      ['Aqua Voice', 10],
      ['Notion', 11],
    ]);
    expect(writes[0]?.key).not.toBe(writes[1]?.key);
    await waitFor(() => expect(result.current.busy).toBe(false));
  });
});

describe('確認済みの成功mutationの保持', () => {
  it('履歴でidを確認できた成功だけ除去し、未確認の成功と失敗を保持する', async () => {
    const operation = (id: string) => ({
      id,
      kind: 'merge',
      targetVendorId: 1,
      createdAt: '2026-10-01T00:00:00Z',
    });
    const { result, client } = setup([
      ok({ operation: operation('confirmed') }),
      ok({ operation: operation('unconfirmed') }),
      () => internal(),
    ]);
    await ready(client);
    await runWrite(result, create);
    await runWrite(result, create);
    await runWrite(result, create);
    expect(client.getMutationCache().findAll({ mutationKey: WRITE_KEY })).toHaveLength(3);
    act(() =>
      client.setQueryData(OPERATIONS_KEY, {
        revision: 12,
        operations: [
          {
            id: 'confirmed',
            kind: 'merge',
            targetVendorName: 'Aqua Voice',
            createdAt: '2026-10-01T00:00:00Z',
            actorEmail: 'owner@example.com',
            undoneAt: null,
            undoneByEmail: null,
            undoable: true,
            undoBlockedReason: null,
          },
        ],
      }),
    );
    await waitFor(() =>
      expect(client.getMutationCache().findAll({ mutationKey: WRITE_KEY })).toHaveLength(2),
    );
    expect(
      client
        .getMutationCache()
        .findAll({ mutationKey: WRITE_KEY })
        .map((item) => item.state.status),
    ).toEqual(['success', 'error']);
    expect(result.current.rows.filter((row) => row.operationId === 'confirmed')).toHaveLength(1);
    expect(result.current.rows.some((row) => row.state === 'failed')).toBe(true);
  });
  it('再試行成功を履歴で確認しても前の失敗行を復活させない', async () => {
    const replies: WriteReply[] = [() => internal()];
    const { result, client } = setup(replies);
    await ready(client);
    await runWrite(result, create);
    const retryOf = result.current.rows[0]?.retryOf;
    expect(retryOf).toEqual(expect.any(Number));
    replies.push(
      ok({
        operation: { id: 'retried', kind: 'merge', targetVendorId: 1, createdAt: '2026-10-01T00:00:00Z' },
      }),
    );
    act(() => result.current.retry(retryOf as number));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() =>
      client.setQueryData(OPERATIONS_KEY, {
        revision: 11,
        operations: [
          {
            id: 'retried',
            kind: 'merge',
            targetVendorName: 'Aqua Voice',
            createdAt: '2026-10-01T00:00:00Z',
            actorEmail: 'owner@example.com',
            undoneAt: null,
            undoneByEmail: null,
            undoable: true,
            undoBlockedReason: null,
          },
        ],
      }),
    );
    await waitFor(() => expect(result.current.rows.some((row) => row.operationId === 'retried')).toBe(true));
    expect(result.current.rows.some((row) => row.state === 'failed')).toBe(false);
    expect(
      client
        .getMutationCache()
        .findAll({ mutationKey: WRITE_KEY })
        .map((item) => item.state.status),
    ).toEqual(['error', 'success']);
  });
});
