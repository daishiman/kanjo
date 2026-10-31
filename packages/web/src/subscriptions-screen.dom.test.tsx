// @vitest-environment jsdom

/**
 * サブスク画面 (整える > サブスク) の表示契約。画像 design/FINAL-UI/images/09-subscriptions.png が
 * 構成の正本で、数値は core の検算済み fixture (spec §13.3) を写したもの。画像の数値は期待値にしない。
 *
 * 旧画面 (支払先別の積み上げ図 + 支払先の表) では、見出しの問い・KPI 5 枚・カバー率・8 列の一覧・
 * 詳細パネル・検出理由カードのどれも無いので、この describe の大半が落ちる。
 *
 * 統合と操作の契約 (spec-subscriptions-merge): 行チェックと全選択・下部の選択バー・統合先の既定・
 * 処理中の無効化・?vendor= の付け替え・「操作」の状態と文言・再試行を、revision と Idempotency-Key を
 * 持つ偽のサーバで検査する。旧実装 (取引名だけを別名に足す統合・操作の一覧なし) ではこの部分が落ちる。
 */
import {
  SUB_VENDOR_NAME_MAX,
  type SubscriptionRow,
  type SubscriptionVendorDetail,
  type SubscriptionsScreen,
  vendorKey,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SubscriptionsPage } from './pages/Subscriptions.js';
import { PeriodProvider } from './period.js';

vi.mock('react-chartjs-2', () => ({
  Chart: ({
    'aria-label': ariaLabel,
    data,
    options,
  }: {
    'aria-label'?: string;
    data?: { labels?: unknown[]; datasets?: { label?: string; data?: number[] }[] };
    options?: { plugins?: { legend?: { display?: boolean } } };
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-chart-labels={data?.labels?.length ?? 0}
      data-chart-legend={String(options?.plugins?.legend?.display)}
      data-dataset-labels={data?.datasets?.map((dataset) => dataset.label).join('|')}
      data-dataset-sum={data?.datasets
        ?.flatMap((dataset) => dataset.data ?? [])
        .reduce((sum, value) => sum + value, 0)}
    />
  ),
}));

/* ---------------- core の検算済み fixture (subs-screen-fixture.ts) の出力を写したもの ---------------- */

function subRow(partial: Partial<SubscriptionRow> & Pick<SubscriptionRow, 'vendorKey' | 'normalizedName'>) {
  const monthly = partial.estimatedMonthly ?? 0;
  return {
    vendorId: null,
    status: 'registered',
    displayName: partial.normalizedName,
    matchedNameCount: 1,
    latestAmount: monthly,
    estimatedMonthly: monthly,
    annualized: monthly * 12,
    billing: 'monthly',
    active: true,
    category: 'その他',
    categorySource: 'dictionary',
    review: null,
    ...partial,
  } satisfies SubscriptionRow;
}

const adobe = subRow({
  vendorKey: 'adobecreativecloud',
  vendorId: 6,
  normalizedName: 'Adobe Creative Cloud',
  estimatedMonthly: 2_728,
  category: 'クリエイティブ',
  review: {
    state: 'pending',
    rules: ['priceUp'],
    fingerprint: 'priceUp:2728',
    reasons: ['2026年7月から ¥2,480 → ¥2,728 (+10.0%) に値上がりし、2か月続いています。'],
  },
});
const spotify = subRow({
  vendorKey: 'spotify',
  vendorId: 3,
  normalizedName: 'Spotify',
  matchedNameCount: 2,
  estimatedMonthly: 980,
  category: 'エンタメ',
  review: {
    state: 'pending',
    rules: ['overlap'],
    fingerprint: 'overlap:980',
    reasons: ['同じカテゴリ「エンタメ」に継続中のサブスクが 2 件あります (月額合計 ¥2,470)。'],
  },
});

const fixtureRows: SubscriptionRow[] = [
  adobe,
  spotify,
  subRow({
    vendorKey: 'notion',
    vendorId: 5,
    normalizedName: 'Notion',
    estimatedMonthly: 1_650,
    category: '仕事効率化',
  }),
  subRow({
    vendorKey: 'newspicks',
    vendorId: 8,
    normalizedName: 'NewsPicks',
    estimatedMonthly: 1_500,
    category: 'ニュース',
  }),
  subRow({
    vendorKey: 'netflix',
    vendorId: 1,
    normalizedName: 'Netflix',
    matchedNameCount: 2,
    estimatedMonthly: 1_490,
    category: 'エンタメ',
  }),
  subRow({
    vendorKey: 'amazonプライム',
    vendorId: 2,
    normalizedName: 'Amazonプライム',
    matchedNameCount: 2,
    estimatedMonthly: 600,
    category: 'ショッピング',
  }),
  subRow({
    vendorKey: '1password',
    vendorId: 7,
    normalizedName: '1Password',
    estimatedMonthly: 580,
    category: 'セキュリティ',
  }),
  subRow({
    vendorKey: 'googleone',
    vendorId: 4,
    normalizedName: 'Google One',
    estimatedMonthly: 250,
    category: 'クラウド',
  }),
];

const months = [
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
];
const flat = (value: number) => months.map(() => value);

const fixtureScreen: SubscriptionsScreen = {
  period: { from: '2025-09', to: '2026-08' },
  previousPeriod: { from: '2024-09', to: '2025-08' },
  generatedAt: '2026-09-10T10:24:00+09:00',
  kpis: {
    monthlyTotal: 9_778,
    monthlyTotalPrev: 9_530,
    annualized: 117_336,
    annualizedPrev: 114_360,
    last12Total: 114_856,
    revenueShare: 0.05386296296296297,
    reviewCandidates: 2,
  },
  coverage: {
    bank: { percent: 0.9722222222222222, imported: 3, accounts: 3 },
    card: { percent: 1, imported: 2, accounts: 2 },
    emoney: { percent: 0.9166666666666666, imported: 1, accounts: 2 },
    unclassified: 0,
  },
  rows: fixtureRows,
  trend: {
    months,
    series: [
      { category: 'クリエイティブ', values: [...flat(2_480).slice(0, 10), 2_728, 2_728] },
      { category: 'エンタメ', values: flat(2_470) },
      { category: '仕事効率化', values: flat(1_650) },
      { category: 'その他', values: flat(2_930) },
    ],
  },
  comparison: [
    {
      category: 'クリエイティブ',
      monthly: 2_728,
      annualized: 32_736,
      share: 0.2789936592350174,
      prevMonthly: 2_480,
    },
    {
      category: 'エンタメ',
      monthly: 2_470,
      annualized: 29_640,
      share: 0.2526078952751074,
      prevMonthly: 2_470,
    },
    {
      category: '仕事効率化',
      monthly: 1_650,
      annualized: 19_800,
      share: 0.16874616485988955,
      prevMonthly: 1_650,
    },
    {
      category: 'ニュース',
      monthly: 1_500,
      annualized: 18_000,
      share: 0.1534056044180814,
      prevMonthly: 1_500,
    },
    {
      category: 'ショッピング',
      monthly: 600,
      annualized: 7_200,
      share: 0.06136224176723256,
      prevMonthly: 600,
    },
    {
      category: 'セキュリティ',
      monthly: 580,
      annualized: 6_960,
      share: 0.05931683370832481,
      prevMonthly: 580,
    },
    { category: 'クラウド', monthly: 250, annualized: 3_000, share: 0.0255676007363469, prevMonthly: 250 },
  ],
  comparisonTotal: { monthly: 9_778, annualized: 117_336, prevMonthly: 9_530 },
};

const spotifyRecent = months
  .map((month, index) => ({
    date: `${month}-01`,
    name: index % 2 === 0 ? 'Spotify' : 'SPOTIFY.COM',
    source: index % 2 === 0 ? ('card' as const) : ('bank' as const),
    amount: 980,
  }))
  .reverse();

const spotifyDetail: SubscriptionVendorDetail = {
  vendorKey: 'spotify',
  vendorId: 3,
  row: spotify,
  rawNames: [
    { name: 'Spotify', source: 'card', count: 6 },
    { name: 'SPOTIFY.COM', source: 'bank', count: 6 },
  ],
  estimatedMonthly: 980,
  annualized: 11_760,
  recent: spotifyRecent,
  transactionCount: 12,
  bySource: [
    { source: 'card', count: 6 },
    { source: 'bank', count: 6 },
  ],
  related: { aliases: ['SPOTIFY.COM'], accounts: ['通信費'], reviewedAt: '2026-08-01', reviewDue: false },
};

/** 未登録の候補 (まだ sub_vendors に無い取引先)。採用・除外の送り先を確かめる */
const unregistered = subRow({
  vendorKey: '架空動画',
  normalizedName: '架空動画',
  status: 'unregistered',
  estimatedMonthly: 1_200,
  category: 'その他',
  review: {
    state: 'pending',
    rules: ['dup'],
    fingerprint: 'dup:1200',
    reasons: ['2026年8月に同じ金額 ¥1,200 の請求が 2 回あります。'],
  },
});

const unregisteredDetail: SubscriptionVendorDetail = {
  vendorKey: unregistered.vendorKey,
  vendorId: null,
  row: unregistered,
  rawNames: [{ name: unregistered.normalizedName, source: 'card', count: 2 }],
  estimatedMonthly: unregistered.estimatedMonthly,
  annualized: unregistered.annualized,
  recent: [],
  transactionCount: 0,
  bySource: [{ source: 'card', count: 2 }],
  related: null,
};

const candidatesResponse = { candidates: [], excluded: [], dealRows: 0 };

/* ---------------- 偽のサーバ (revision・Idempotency-Key・操作の記録を持つ) ---------------- */

const ADMIN_EMAIL = 'admin@example.test';
const SERVER_FAILED = 'サーバー側で処理に失敗しました。同じ操作を再試行しても二重には反映されません';

const authState = {
  authenticated: true,
  user: {
    id: 'usr_test_admin',
    email: ADMIN_EMAIL,
    role: 'admin',
    status: 'active',
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: null,
  },
};

type Body = Record<string, unknown>;

type VendorRecord = {
  id: number;
  name: string;
  aliases: string[];
  accounts: string[];
  mergedIntoId: number | null;
};

type OperationRecord = {
  id: string;
  kind:
    | 'merge'
    | 'unmerge'
    | 'vendor_create'
    | 'vendor_update'
    | 'vendor_delete'
    | 'review'
    | 'review_decision'
    | 'exclusion';
  targetVendorName: string | null;
  createdAt: string;
  actorEmail: string | null;
  undoneAt: string | null;
  undoneByEmail: string | null;
  undoable: boolean;
  undoBlockedReason:
    | 'already_undone'
    | 'undo_expired'
    | 'undo_blocked_by_later_operation'
    | 'not_merge'
    | null;
};

type Server = {
  revision: number;
  rows: SubscriptionRow[];
  vendors: VendorRecord[];
  operations: OperationRecord[];
  seq: number;
  nextVendorId: number;
  snapshots: Map<string, { vendors: VendorRecord[]; rows: SubscriptionRow[] }>;
  keys: Map<string, Body>;
  inflight: number;
  maxInflight: number;
};

type SentRequest = {
  method: string;
  url: string;
  body: Body | undefined;
  key: string | null;
  headers: Record<string, string>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const bodyOf = (init?: RequestInit): Body | undefined =>
  init?.body ? (JSON.parse(String(init.body)) as Body) : undefined;

/** 登録済みの行から sub_vendors を作る。Spotify だけが別名と対象科目を持つ */
function makeVendors(overrides: Record<number, Partial<VendorRecord>> = {}): VendorRecord[] {
  return fixtureRows
    .filter((row) => row.vendorId !== null)
    .map((row) => {
      const id = row.vendorId as number;
      const own =
        id === spotify.vendorId
          ? { aliases: ['SPOTIFY.COM'], accounts: ['通信費'] }
          : { aliases: [], accounts: [] };
      return { id, name: row.normalizedName, ...own, mergedIntoId: null, ...overrides[id] };
    });
}

function makeDetail(row: SubscriptionRow, vendor?: VendorRecord): SubscriptionVendorDetail {
  return {
    vendorKey: row.vendorKey,
    vendorId: row.vendorId,
    row,
    rawNames: [{ name: row.normalizedName, source: 'card', count: 1 }],
    estimatedMonthly: row.estimatedMonthly,
    annualized: row.annualized,
    recent: [],
    transactionCount: 0,
    bySource: [{ source: 'card', count: 1 }],
    related: vendor
      ? { aliases: vendor.aliases, accounts: vendor.accounts, reviewedAt: null, reviewDue: false }
      : null,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const apiError = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const conflict = () => apiError(409, 'subscription_revision_conflict', '他の操作が先に反映されました');
/** Retry-After は 120 秒。画面はこれに従わず 1・2・4 秒で自動再試行する */
const busy = () =>
  apiError(409, 'canonical_write_busy', '別の書き込みを処理中です', { 'Retry-After': '120' });

function record(
  server: Server,
  kind: OperationRecord['kind'],
  targetVendorName: string | null,
  key: string | null,
  respond: (op: OperationRecord) => Body = () => ({ ok: true }),
) {
  server.revision += 1;
  server.seq += 1;
  const op: OperationRecord = {
    id: `op-${server.seq}`,
    kind,
    targetVendorName,
    createdAt: `2026-09-30T10:${String(server.seq).padStart(2, '0')}:00.000Z`,
    actorEmail: ADMIN_EMAIL,
    undoneAt: null,
    undoneByEmail: null,
    undoable: kind === 'merge',
    undoBlockedReason: kind === 'merge' ? null : 'not_merge',
  };
  server.operations.unshift(op);
  const body = { ...respond(op), revision: server.revision };
  if (key) server.keys.set(key, body);
  return json(body);
}

function read(server: Server, url: string, data: SubscriptionsScreen, detail: SubscriptionVendorDetail) {
  const path = url.split('?')[0]!;
  if (path === '/api/auth/me') return json(authState);
  if (path === '/api/review-queue') return json({});
  if (path === '/api/subscription-operations') {
    return json({ operations: server.operations.slice(0, 20), revision: server.revision });
  }
  if (path.startsWith('/api/subscriptions/vendors/')) {
    const vendorKey = decodeURIComponent(path.slice('/api/subscriptions/vendors/'.length));
    const row = server.rows.find((item) => item.vendorKey === vendorKey);
    if (vendorKey === detail.vendorKey) {
      const vendor = server.vendors.find((item) => item.id === detail.vendorId);
      const related =
        detail.related && vendor
          ? { ...detail.related, aliases: vendor.aliases, accounts: vendor.accounts }
          : detail.related;
      return json({ ...detail, row: row ?? detail.row, related });
    }
    if (!row) return apiError(404, 'not_found', 'サブスクが見つかりません');
    return json(
      makeDetail(
        row,
        server.vendors.find((item) => item.id === row.vendorId),
      ),
    );
  }
  if (path === '/api/subscriptions') return json({ ...data, rows: server.rows, revision: server.revision });
  if (path === '/api/sub-vendors/candidates') return json(candidatesResponse);
  if (path === '/api/sub-vendors') {
    return json({
      vendors: server.vendors,
      accountOptions: ['通信費', '支払手数料'],
      review: [],
      revision: server.revision,
    });
  }
  return json({});
}

function write(server: Server, method: string, url: string, body: Body | undefined, key: string | null) {
  // 同じ key の再送は、base の照合より先に保存済みの応答を返す (二重に反映しない)
  if (key) {
    const saved = server.keys.get(key);
    if (saved) return json({ ...saved, replayed: true });
  }
  if (body?.baseRevision !== undefined && body.baseRevision !== server.revision) return conflict();
  const path = url.split('?')[0]!;
  const live = (id: unknown) =>
    server.vendors.find((vendor) => vendor.id === id && vendor.mergedIntoId === null);
  const nameTaken = (name: unknown, except?: number) =>
    server.vendors.some(
      (vendor) => vendor.id !== except && vendor.mergedIntoId === null && vendor.name === name,
    );
  const duplicate = () => apiError(409, 'duplicate', '同じ名前のベンダーが既に登録されています');

  if (method === 'POST' && path === '/api/sub-vendors/merge') {
    const targetId = body?.targetId as number;
    const sourceIds = (body?.sourceVendorIds ?? []) as number[];
    const rawNames = (body?.rawNames ?? []) as string[];
    if (!sourceIds.length && !rawNames.length) return apiError(400, 'empty_merge', '統合元がありません');
    if (sourceIds.includes(targetId)) return apiError(422, 'merge_cycle', '統合先が統合元に含まれています');
    const target = live(targetId);
    if (!target || sourceIds.some((id) => !live(id))) {
      return apiError(404, 'not_found', '統合先か統合元が見つかりません');
    }
    const snapshot = clone({ vendors: server.vendors, rows: server.rows });
    for (const id of sourceIds) live(id)!.mergedIntoId = targetId;
    target.aliases = [...new Set([...target.aliases, ...rawNames])];
    server.rows = server.rows.filter((row) =>
      row.vendorId === null ? !rawNames.includes(row.normalizedName) : !sourceIds.includes(row.vendorId),
    );
    return record(server, 'merge', target.name, key, (op) => {
      server.snapshots.set(op.id, snapshot);
      return {
        operation: { id: op.id, kind: 'merge', targetVendorId: targetId, createdAt: op.createdAt },
        replayed: false,
      };
    });
  }

  const undo = /^\/api\/subscription-operations\/([^/]+)\/undo$/.exec(path);
  if (method === 'POST' && undo) {
    const merged = server.operations.find((op) => op.id === undo[1]);
    if (!merged || merged.kind !== 'merge') return apiError(404, 'not_found', '操作が見つかりません');
    if (merged.undoneAt) return apiError(409, 'already_undone', 'すでに元に戻されています');
    const snapshot = clone(server.snapshots.get(merged.id)!);
    server.vendors = snapshot.vendors;
    server.rows = snapshot.rows;
    return record(server, 'unmerge', merged.targetVendorName, key, (op) => {
      Object.assign(merged, {
        undoneAt: op.createdAt,
        undoneByEmail: ADMIN_EMAIL,
        undoable: false,
        undoBlockedReason: 'already_undone',
      });
      return {
        operation: { id: op.id, kind: 'unmerge', undoesId: merged.id, createdAt: op.createdAt },
        replayed: false,
      };
    });
  }

  if (method === 'POST' && path === '/api/sub-vendors/exclusions') {
    return record(server, 'exclusion', null, key, () => ({ ok: true, id: 50 }));
  }
  if (method === 'DELETE' && /^\/api\/sub-vendors\/exclusions\/\d+$/.test(path)) {
    return record(server, 'exclusion', null, key);
  }

  const nested = /^\/api\/sub-vendors\/(\d+)\/(aliases|review)$/.exec(path);
  if (method === 'POST' && nested) {
    const vendor = live(Number(nested[1]));
    if (!vendor) return conflict();
    if (nested[2] === 'review') {
      return record(server, 'review', vendor.name, key, () => ({ ok: true, reviewedAt: '2026-09-30' }));
    }
    vendor.aliases = [...new Set([...vendor.aliases, ...((body?.aliases ?? []) as string[])])];
    return record(server, 'vendor_update', vendor.name, key, () => ({ ok: true, aliases: vendor.aliases }));
  }

  const single = /^\/api\/sub-vendors\/(\d+)$/.exec(path);
  if (single && (method === 'PUT' || method === 'DELETE')) {
    const vendor = live(Number(single[1]));
    if (!vendor) return conflict();
    if (method === 'DELETE') {
      server.vendors = server.vendors.filter((item) => item !== vendor);
      server.rows = server.rows.filter((row) => row.vendorId !== vendor.id);
      return record(server, 'vendor_delete', vendor.name, key);
    }
    if (typeof body?.name === 'string') {
      if (nameTaken(body.name, vendor.id)) return duplicate();
      vendor.name = body.name;
    }
    if (Array.isArray(body?.aliases)) vendor.aliases = body.aliases as string[];
    if (Array.isArray(body?.accounts)) vendor.accounts = body.accounts as string[];
    server.rows = server.rows.map((row) =>
      row.vendorId === vendor.id ? { ...row, normalizedName: vendor.name, displayName: vendor.name } : row,
    );
    return record(server, 'vendor_update', vendor.name, key);
  }

  if (method === 'POST' && path === '/api/sub-vendors') {
    if (nameTaken(body?.name)) return duplicate();
    const vendor: VendorRecord = {
      id: server.nextVendorId,
      name: String(body?.name),
      aliases: [],
      accounts: [],
      mergedIntoId: null,
    };
    server.nextVendorId += 1;
    server.vendors.push(vendor);
    // 本番の照合 (matchSubVendor) と同じく、正規化した名前が一致する未登録の行は新しい登録へまとまる
    server.rows = server.rows.map((row) =>
      row.vendorId === null && vendorKey(row.normalizedName) === vendorKey(vendor.name)
        ? { ...row, status: 'registered' as const, vendorId: vendor.id, displayName: vendor.name }
        : row,
    );
    return record(server, 'vendor_create', vendor.name, key, () => ({ ok: true, id: vendor.id }));
  }

  if (path.startsWith('/api/subscriptions/review-decisions'))
    return record(server, 'review_decision', null, key);
  return apiError(404, 'not_found', '見つかりません');
}

/* ---------------- 描画の道具 ---------------- */

type Handler = (
  url: string,
  init: RequestInit | undefined,
  server: Server,
) => Response | undefined | Promise<Response | undefined>;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage({
  data = fixtureScreen,
  detail = spotifyDetail,
  handler,
  path = '/subscriptions',
  vendors = makeVendors(),
  operations = [],
}: {
  data?: SubscriptionsScreen;
  detail?: SubscriptionVendorDetail;
  handler?: Handler;
  path?: string;
  vendors?: VendorRecord[];
  operations?: OperationRecord[];
} = {}) {
  const server: Server = {
    revision: 7,
    rows: clone(data.rows),
    vendors: clone(vendors),
    operations: clone(operations),
    seq: 0,
    nextVendorId: 99,
    snapshots: new Map(),
    keys: new Map(),
    inflight: 0,
    maxInflight: 0,
  };
  const calls: { method: string; url: string; body: unknown }[] = [];
  const requests: SentRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = bodyOf(init);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({ method, url, body });
    requests.push({ method, url, body, key: headers['idempotency-key'] ?? null, headers });
    if (method === 'GET') return (await handler?.(url, init, server)) ?? read(server, url, data, detail);
    server.inflight += 1;
    server.maxInflight = Math.max(server.maxInflight, server.inflight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return (
        (await handler?.(url, init, server)) ??
        write(server, method, url, body, headers['idempotency-key'] ?? null)
      );
    } finally {
      server.inflight -= 1;
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth'], authState);
  const view = render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]}>
          <SubscriptionsPage />
          <LocationProbe />
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
  return { ...view, calls, requests, server, fetchMock, client };
}

const getCount = (calls: readonly { method: string; url: string }[], path: string) =>
  calls.filter((call) => call.method === 'GET' && call.url.split('?')[0] === path).length;
const sent = (requests: readonly SentRequest[], method: string, path: string) =>
  requests.filter((request) => request.method === method && request.url.split('?')[0] === path);

const location = () => screen.getByTestId('location').textContent ?? '';
/** 読込中の骨格にも同じ KPI 領域があるので、読込後にだけ出る「最終更新」で待つ */
const kpiRegion = async () => {
  await screen.findByRole('region', { name: '最終更新' });
  return screen.getByRole('region', { name: 'サブスクの主要な数字' });
};
const table = () => screen.getByRole('table', { name: 'サブスク一覧' });
const bodyRows = () => within(table()).getAllByRole('row').slice(1, -1);
const detailPanel = () => screen.findByRole('complementary', { name: 'サブスクの詳細' });

const selectionBar = () => screen.getByRole('region', { name: '選択中の取引' });
const rowCheckbox = (name: string) =>
  screen.getByRole('checkbox', { name: `${name} を選択` }) as HTMLInputElement;
const selectAll = () => screen.getByRole('checkbox', { name: '表示中の行をすべて選択' }) as HTMLInputElement;
const targetSelect = () =>
  within(selectionBar()).getByRole('combobox', { name: '統合先' }) as HTMLSelectElement;
const chips = () => within(selectionBar()).getAllByRole('button', { name: /の選択を外す$/ });
const mergeButton = (count: number) =>
  within(selectionBar()).getByRole('button', { name: `選択した${count}件を統合` }) as HTMLButtonElement;

const operationsRegion = () => screen.getByRole('region', { name: '操作' });
const operationItems = () => within(operationsRegion()).getAllByRole('listitem');
const liveText = () => operationsRegion().querySelector('[aria-live="polite"]')?.textContent ?? '';
/** 操作の一覧から、すべての文言を含む行を待って返す */
const operationItem = (texts: readonly (string | RegExp)[], timeout = 1_000) =>
  waitFor(
    () => {
      const item = operationItems().find((li) =>
        texts.every((text) =>
          typeof text === 'string' ? (li.textContent ?? '').includes(text) : text.test(li.textContent ?? ''),
        ),
      );
      expect(item, texts.join(' / ')).toBeTruthy();
      return item!;
    },
    { timeout },
  );

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Netflix と Notion の行を選び、統合先の既定 (月額の大きい Notion) が入るまで待つ */
async function selectNetflixAndNotion() {
  await kpiRegion();
  fireEvent.click(rowCheckbox('Netflix'));
  fireEvent.click(rowCheckbox('Notion'));
  await waitFor(() => expect(targetSelect().value).toBe('5'));
}

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ---------------- 構成 ---------------- */

describe('サブスク画面の構成', () => {
  it('見出し・問い・説明文が出る', async () => {
    renderPage();
    await kpiRegion();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('サブスク');
    expect(screen.getByText('毎月の固定費に、重複や見直し候補はありますか？')).toBeTruthy();
    expect(screen.getByText(/見直しで、家計をすっきりさせましょう/)).toBeTruthy();
  });

  it('KPI 5 枚と前期間比', async () => {
    const { container } = renderPage();
    await kpiRegion();
    const cards = [...container.querySelectorAll<HTMLElement>('.subs-kpis .kpi')];
    expect(cards.map((card) => card.querySelector('.label')?.textContent)).toEqual([
      '月額のサブスク合計',
      '年換算の合計',
      '直近12か月の支払額',
      '売上比',
      '見直し候補',
    ]);
    expect(cards.map((card) => card.querySelector('.value')?.textContent)).toEqual([
      '¥9,778',
      '¥117,336',
      '¥114,856',
      '5.4%',
      '2件',
    ]);
    expect(cards.every((card) => card.querySelector('.kpi-icon .ui-icon'))).toBe(true);
    // 1・2 枚目だけが前期間比を持つ。差額・率・矢印 (増加は ↑)
    expect(cards[0]!.querySelector('.note')?.textContent).toContain('+¥248 (+2.6%)');
    expect(cards[0]!.querySelector('.note')?.textContent).toContain('↑');
    expect(cards[1]!.querySelector('.note')?.textContent).toContain('+¥2,976 (+2.6%)');
    expect(cards[2]!.querySelector('.note')?.textContent).not.toContain('前期間比');
    expect(cards[3]!.querySelector('.note')?.textContent).toBe('売上に占める割合');
  });

  it('前期間比の表記', async () => {
    const { container } = renderPage({
      data: {
        ...fixtureScreen,
        kpis: { ...fixtureScreen.kpis, monthlyTotal: 9_530, annualized: 100_000, annualizedPrev: 114_360 },
      },
    });
    await kpiRegion();
    const notes = [...container.querySelectorAll<HTMLElement>('.subs-kpis .kpi .note')];
    // 差 0 は矢印なし・「変化なし」と文字でも言う (色だけで区別しない)
    expect(notes[0]!.textContent).toContain('±¥0 (±0.0%)');
    expect(notes[0]!.textContent).not.toMatch(/[↑↓]/);
    expect(notes[0]!.textContent).toContain('変化なし');
    expect(notes[1]!.textContent).toContain('-¥14,360 (-12.6%)');
    expect(notes[1]!.textContent).toContain('↓');
    expect(notes[1]!.textContent).toContain('減少');
  });

  it('カバー率と再取得', async () => {
    const { calls } = renderPage();
    const coverage = await screen.findByRole('region', { name: 'データソースのカバー率' });
    const items = within(coverage).getAllByRole('listitem');
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ''))).toEqual([
      '銀行口座97%(3/3)',
      'クレジットカード100%(2/2)',
      '電子マネー92%(1/2)',
    ]);
    const refresh = screen.getByRole('region', { name: '最終更新' });
    expect(refresh.textContent).toContain('最終更新');
    const before = calls.filter((call) => call.url.includes('/api/subscriptions')).length;
    fireEvent.click(within(refresh).getByRole('button', { name: /再取得/ }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url.includes('/api/subscriptions')).length).toBeGreaterThan(before),
    );
  });

  it('9 列 (先頭は全選択)・合計行・検索・絞込', async () => {
    renderPage();
    await kpiRegion();
    const headers = within(table()).getAllByRole('columnheader');
    // 先頭列は見出しの全選択 (ラベルは視覚的に隠す)。ベンダー名の末尾の「?」は用語ヘルプ (glossary の vendor)
    expect(headers.map((th) => th.textContent?.trim())).toEqual([
      '表示中の行をすべて選択',
      'ベンダー名?',
      '正規化名',
      '取引名数',
      '最新の金額',
      '月額の推定',
      '年換算',
      'カテゴリ',
      '候補',
    ]);
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual(
      fixtureRows.map((row) => row.vendorKey),
    );
    // 未判断の 2 件だけ「候補」バッジ
    expect(within(bodyRows()[0]!).getByText('候補')).toBeTruthy();
    expect(within(bodyRows()[2]!).queryByText('候補')).toBeNull();
    const total = within(table()).getAllByRole('row').at(-1)!;
    expect(total.textContent).toContain('¥9,778');
    expect(total.textContent).toContain('¥117,336');

    fireEvent.change(screen.getByRole('searchbox', { name: 'ベンダー名・カテゴリで検索' }), {
      target: { value: 'エンタメ' },
    });
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual(['spotify', 'netflix']);
    // 絞込中も合計は全体の値のまま (見出しで分かるようにする)
    expect(within(table()).getAllByRole('row').at(-1)!.textContent).toContain('全体の合計');

    fireEvent.change(screen.getByRole('searchbox', { name: 'ベンダー名・カテゴリで検索' }), {
      target: { value: '' },
    });
    const filter = screen.getByRole('combobox', { name: 'ステータスで絞り込む' });
    expect(
      within(filter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['すべてのステータス', '見直し候補', '登録済み', '未登録の候補']);
    fireEvent.change(filter, { target: { value: 'review' } });
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual([
      'adobecreativecloud',
      'spotify',
    ]);
  });

  it('ロゴ画像要素が 0 件', async () => {
    const { container } = renderPage({ path: '/subscriptions?vendor=spotify' });
    await detailPanel();
    await screen.findByText('マッチした生の取引名（2件）');
    expect(container.querySelectorAll('img')).toHaveLength(0);
    for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.style.backgroundImage, element.outerHTML).toBe('');
    }
    // 頭文字の丸 (アバター) も置かない
    expect(container.querySelectorAll('[class*="avatar"], [class*="logo"], [class*="initial"]')).toHaveLength(
      0,
    );
  });

  it('推移の棒と凡例', async () => {
    renderPage();
    const chart = await screen.findByRole('img', {
      name: '月別のサブスク支払いをカテゴリ別の積み上げで示す図',
    });
    expect(chart.getAttribute('data-chart-labels')).toBe('12');
    expect(chart.getAttribute('data-dataset-labels')).toBe('クリエイティブ|エンタメ|仕事効率化|その他');
    expect(chart.getAttribute('data-chart-legend')).toBe('false');
    // 棒の和 = 直近12か月の支払額
    expect(chart.getAttribute('data-dataset-sum')).toBe('114856');
    const card = screen.getByRole('region', { name: '月次のサブスク支出推移' });
    expect(within(card).getAllByRole('heading', { name: '月次のサブスク支出推移' })).toHaveLength(1);
    expect(within(card).getAllByText('円')).toHaveLength(1);
    expect(within(card).getAllByRole('list', { name: '図の系列' })).toHaveLength(1);
  });

  it('年換算の比較は月額の降順で、合計は一覧の合計と同じ', async () => {
    renderPage();
    const card = await screen.findByRole('region', { name: '年換算の比較（カテゴリ別）' });
    const rows = within(card).getAllByRole('row');
    expect(rows.slice(1, -1).map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      fixtureScreen.comparison.map((row) => row.category),
    );
    expect(rows.at(-1)!.textContent).toContain('¥9,778');
    expect(rows.at(-1)!.textContent).toContain('¥117,336');
    expect(rows.at(-1)!.textContent).toContain('100.0%');
  });
});

/* ---------------- 詳細パネル ---------------- */

describe('サブスクの詳細', () => {
  it('初期表示と登録済みの概要では補助データを取得しない', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(getCount(calls, '/api/sub-vendors')).toBe(0);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(0);
  });

  it('関連データを開いた時だけ登録情報と除外情報を各1回取得する', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1));
    expect(getCount(calls, '/api/sub-vendors')).toBe(1);
  });

  it('未登録の概要は統合先の選択を持たず、補助データも取得しない (統合先は選択バーで選ぶ)', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    const path = `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`;
    const { calls } = renderPage({ data, detail: unregisteredDetail, path });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（1件）');
    expect(within(panel).getByRole('button', { name: '名称を統合' })).toBeTruthy();
    expect(within(panel).queryByRole('combobox', { name: '統合先' })).toBeNull();
    expect(getCount(calls, '/api/sub-vendors')).toBe(0);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(0);
  });

  it('行を選ぶと URL に vendor が付き詳細が開く', async () => {
    renderPage();
    await kpiRegion();
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    expect(location()).toBe('/subscriptions?vendor=spotify');
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(
      within(panel)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['概要', '取引履歴', '関連データ']);
    expect(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }).getAttribute('aria-current')).toBe(
      'true',
    );

    fireEvent.click(within(panel).getByRole('button', { name: '詳細を閉じる' }));
    expect(location()).toBe('/subscriptions');
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
  });

  it('タブは矢印キーで折り返して移り、Home / End で両端へ飛び、選択と tabIndex と tabpanel が付いてくる', async () => {
    renderPage();
    await kpiRegion();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(within(panel).getByRole('tablist', { name: '詳細の表示' })).toBeTruthy();
    const selected = () => {
      const tabs = within(panel).getAllByRole('tab');
      const on = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(on).toHaveLength(1);
      // roving tabindex: 選ばれたタブだけが Tab キーの到達点で、フォーカスもそこにある (初期表示は除く)
      expect(tabs.map((tab) => tab.tabIndex)).toEqual(tabs.map((tab) => (tab === on[0] ? 0 : -1)));
      const tabpanel = within(panel).getByRole('tabpanel');
      expect(on[0].getAttribute('aria-controls')).toBe(tabpanel.id);
      expect(tabpanel.getAttribute('aria-labelledby')).toBe(on[0].id);
      return on[0];
    };
    expect(selected().textContent).toBe('概要');

    const press = (key: string) => {
      fireEvent.keyDown(selected(), { key });
      const tab = selected();
      expect(document.activeElement).toBe(tab);
      return tab.textContent;
    };
    expect(press('ArrowRight')).toBe('取引履歴');
    expect(press('ArrowRight')).toBe('関連データ');
    expect(press('ArrowRight')).toBe('概要');
    expect(press('ArrowLeft')).toBe('関連データ');
    expect(press('Home')).toBe('概要');
    expect(press('End')).toBe('関連データ');
    // 関係ないキーでは動かない
    expect(press('ArrowDown')).toBe('関連データ');
  });

  it('再読込しても URL の vendor から詳細を復元し、期間外の vendor は URL から消す', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    cleanup();
    vi.unstubAllGlobals();

    renderPage({ path: '/subscriptions?vendor=nosuch' });
    await kpiRegion();
    await waitFor(() => expect(location()).toBe('/subscriptions'));
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
  });

  it('詳細パネルの概要タブ', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(within(panel).getByText('見直し候補')).toBeTruthy();
    expect(within(panel).getByText('エンタメ')).toBeTruthy();
    const raw = within(panel).getByRole('group', { name: 'マッチした生の取引名（2件）' });
    expect(within(raw).getAllByRole('checkbox')).toHaveLength(2);
    expect(raw.textContent).toContain('クレジットカード');
    expect(raw.textContent).toContain('銀行口座');
    expect(panel.textContent).toContain('¥980');
    expect(panel.textContent).toContain('¥11,760');
    // 直近の取引は先頭 3 件だけ。残りは「すべて見る」で取引履歴タブへ
    const recent = within(panel).getByRole('table', { name: '直近の取引' });
    expect(within(recent).getAllByRole('row')).toHaveLength(4);
    fireEvent.click(within(panel).getByRole('button', { name: 'すべて見る (12件) →' }));
    expect(within(panel).getByRole('tab', { name: '取引履歴' }).getAttribute('aria-selected')).toBe('true');
    expect(
      within(within(panel).getByRole('list', { name: '直近の取引履歴' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(within(panel).getByRole('button', { name: '取引履歴を大きく表示（12件）' })).toBeTruthy();
  });

  it('狭い詳細は直近3件に要約し、全履歴は広いdialogで省略せず読める', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));

    const summary = within(panel).getByRole('list', { name: '直近の取引履歴' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(3);
    const trigger = within(panel).getByRole('button', { name: '取引履歴を大きく表示（12件）' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Spotifyの取引履歴' });
    const usageSummary = within(dialog).getByRole('region', { name: '履歴からわかる利用状況' });
    expect(usageSummary.textContent).toContain('対象期間内の履歴から算出');
    expect(usageSummary.textContent).toContain('確認できる利用期間');
    expect(usageSummary.textContent).toContain('2025/09/01〜2026/08/01');
    expect(usageSummary.textContent).toContain('支払い実績');
    expect(usageSummary.textContent).toContain('12か月・12件');
    expect(usageSummary.textContent).toContain('合計支払額');
    expect(usageSummary.textContent).toContain('¥11,760');
    expect(usageSummary.textContent).toContain('支払い月あたり平均');
    expect(usageSummary.textContent).toContain('¥980');
    const history = within(dialog).getByRole('table', { name: 'Spotifyの取引履歴' });
    expect(history.classList.contains('is-expanded')).toBe(true);
    expect(within(history).getAllByRole('row')).toHaveLength(13);
    expect(history.textContent).toContain('SPOTIFY.COM');
    expect(history.textContent).toContain('クレジットカード');
    expect(history.textContent).toContain('銀行口座');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spotifyの取引履歴' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('1件の履歴は1日の記録として要約し、長い名称もdialogでは省略しない', async () => {
    const longVendorName = 'とても長い名称のテスト用クラウドストレージ年間利用サービス';
    const longTransactionName = 'とても長い名称のテスト用クラウドストレージ年間利用サービス決済明細';
    const row = { ...spotify, displayName: longVendorName, normalizedName: longVendorName };
    const detail: SubscriptionVendorDetail = {
      ...spotifyDetail,
      row,
      recent: [{ date: '2026-08-13', name: longTransactionName, source: 'card', amount: 8_454 }],
      transactionCount: 1,
      bySource: [{ source: 'card', count: 1 }],
    };
    renderPage({
      data: {
        ...fixtureScreen,
        rows: fixtureScreen.rows.map((item) => (item.vendorKey === row.vendorKey ? row : item)),
      },
      detail,
      path: '/subscriptions?vendor=spotify',
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));
    fireEvent.click(within(panel).getByRole('button', { name: '取引履歴を大きく表示（1件）' }));

    const dialog = await screen.findByRole('dialog', { name: `${longVendorName}の取引履歴` });
    const usageSummary = within(dialog).getByRole('region', { name: '履歴からわかる利用状況' });
    expect(usageSummary.textContent).toContain('2026/08/13（1日の記録）');
    expect(usageSummary.textContent).toContain('1か月・1件');
    expect(usageSummary.textContent).toContain('合計支払額¥8,454');
    expect(usageSummary.textContent).toContain('支払い月あたり平均¥8,454');
    expect(within(dialog).getByRole('table').textContent).toContain(longTransactionName);
  });

  it('履歴が0件なら利用要約と全件dialogの入口を出さず、理由を表示する', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    renderPage({
      data,
      detail: unregisteredDetail,
      path: `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`,
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));

    expect(within(panel).getByText('期間内の取引はありません。')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: /取引履歴を大きく表示/ })).toBeNull();
    expect(screen.queryByRole('region', { name: '履歴からわかる利用状況' })).toBeNull();
  });

  it('候補として確認すると判断 API に confirmed と base を送る', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/subscriptions/review-decisions?span=1',
        body: { vendorKey: 'spotify', decision: 'confirmed', baseRevision: 7 },
      }),
    );
  });

  it('判断後は画面と詳細だけを再取得し、開いた補助データを取り直さず状態を更新する', async () => {
    const { calls } = renderPage({
      path: '/subscriptions?vendor=spotify',
      handler: (url, init, server) => {
        if (url.startsWith('/api/subscriptions/review-decisions') && init?.method === 'POST') {
          const confirmedRow = { ...spotify, review: { ...spotify.review!, state: 'confirmed' as const } };
          server.rows = server.rows.map((row) => (row.vendorKey === 'spotify' ? confirmedRow : row));
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1));
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    fireEvent.click(within(panel).getByRole('tab', { name: '概要' }));
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    await within(panel).findByRole('button', { name: '確認を取り消す' });
    expect(getCount(calls, '/api/sub-vendors')).toBe(vendorGets);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(candidateGets);
  });

  it('判断は表示中の期間を付けて送る (指紋はサーバがその期間で求める)', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'span', span: 3 }));
    try {
      const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
      const panel = await detailPanel();
      fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
      await waitFor(() =>
        expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toContain(
          '/api/subscriptions/review-decisions?span=3',
        ),
      );
    } finally {
      localStorage.removeItem('kanjo:period');
    }
  });

  it('取引名 2 件は統合先を選ぶまで統合できず、選ぶと統合 API に取引名だけを送る', async () => {
    const { requests } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
    for (const box of within(raw).getAllByRole('checkbox')) fireEvent.click(box);

    expect(selectionBar().textContent).toContain('2件の取引を選択中');
    // 統合先の候補 (登録の一覧) は選んでから読む。揃っても登録済みの行を選んでいないので空のまま
    await waitFor(() => expect(within(targetSelect()).getAllByRole('option').length).toBeGreaterThan(1));
    expect(targetSelect().value).toBe('');
    expect(mergeButton(2).disabled).toBe(true);
    fireEvent.change(targetSelect(), { target: { value: '3' } });
    expect(mergeButton(2).disabled).toBe(false);
    fireEvent.click(mergeButton(2));
    await waitFor(() =>
      expect(sent(requests, 'POST', '/api/sub-vendors/merge').map((request) => request.body)).toEqual([
        { targetId: 3, sourceVendorIds: [], rawNames: ['Spotify', 'SPOTIFY.COM'], baseRevision: 7 },
      ]),
    );
    // 統合が通って取り直しが終わったら選択は空になり、バーは消える
    await waitFor(() => expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull());
    expect(within(panel).getByRole('button', { name: '名称を統合' })).toBeTruthy();
  });

  it('選択を解除すると下部バーが消え、チェックも外れる', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    fireEvent.click(within(raw).getAllByRole('checkbox')[0]!);
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(within(bar).getAllByRole('button', { name: '選択を解除' })).toHaveLength(1);
    fireEvent.click(within(bar).getByRole('button', { name: '選択を解除' }));
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
    expect(
      within(raw)
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('関連データタブ', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    expect(within(panel).getByRole('heading', { name: '別名' })).toBeTruthy();
    expect(within(panel).getByText('SPOTIFY.COM')).toBeTruthy();
    expect(within(panel).getByRole('group', { name: '対象科目' })).toBeTruthy();
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    fireEvent.click(within(review).getAllByRole('button')[0]!);
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'POST' && call.url === '/api/sub-vendors/3/review')).toBe(
        true,
      ),
    );
  });
});

/* ---------------- 一覧の選択と統合 (AC-007 / AC-008 / AC-016) ---------------- */

describe('一覧の選択と統合', () => {
  it('行チェックと全選択: 一部選択は mixed、全選択は表示中の行だけ、合計行にチェックは無い (AC-007)', async () => {
    renderPage();
    await kpiRegion();
    fireEvent.click(rowCheckbox('Netflix'));
    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll().checked).toBe(false);
    // mixed は native の indeterminate だけで表し、ARIA 属性を重ねない
    expect(selectAll().getAttribute('aria-checked')).toBeNull();

    fireEvent.click(selectAll());
    expect(selectionBar().textContent).toContain('8件の取引を選択中');
    expect(selectAll().checked).toBe(true);
    fireEvent.click(selectAll());
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'ベンダー名・カテゴリで検索' }), {
      target: { value: 'エンタメ' },
    });
    fireEvent.click(selectAll());
    expect(selectionBar().textContent).toContain('2件の取引を選択中');
    const total = within(table()).getAllByRole('row').at(-1)!;
    expect(within(total).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('選択バーは件数・チップ・統合先・統合・解除を持ち、統合は Idempotency-Key を付けて送る (AC-008)', async () => {
    const { requests } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    fireEvent.click(rowCheckbox('Netflix'));
    fireEvent.click(rowCheckbox('Notion'));
    fireEvent.click(within(raw).getByRole('checkbox', { name: 'SPOTIFY.COM' }));

    // 件数は行と取引名の合計で、統合先の行も数える
    expect(selectionBar().textContent).toContain('3件の取引を選択中');
    expect(chips()).toHaveLength(3);
    // 既定の統合先は月額の推定が最大の登録済みの行 (Notion ¥1,650 > Netflix ¥1,490)
    await waitFor(() => expect(targetSelect().value).toBe('5'));
    expect(within(selectionBar()).queryByRole('button', { name: '新しい統合先を登録' })).toBeNull();
    expect(within(selectionBar()).getByRole('button', { name: '選択を解除' })).toBeTruthy();
    expect(within(selectionBar()).getByRole('button', { name: '選択を解除して閉じる' })).toBeTruthy();

    fireEvent.click(mergeButton(3));
    await waitFor(() => expect(sent(requests, 'POST', '/api/sub-vendors/merge')).toHaveLength(1));
    const [merge] = sent(requests, 'POST', '/api/sub-vendors/merge');
    expect(merge!.body).toEqual({
      targetId: 5,
      sourceVendorIds: [1],
      rawNames: ['SPOTIFY.COM'],
      baseRevision: 7,
    });
    expect(merge!.key).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('統合先の選択肢は選択中の登録済みを先に、他を名前順に並べ、統合済みを除き、選び直した値を保つ', async () => {
    renderPage({ vendors: makeVendors({ 4: { mergedIntoId: 5 } }) });
    await kpiRegion();
    fireEvent.click(rowCheckbox('Netflix'));
    await waitFor(() => expect(targetSelect().value).toBe('1'));
    // 選択中の登録済みは読み込みを待たずに出し、その他の登録は読み込み後に名前順で続ける
    await waitFor(() =>
      expect(
        within(targetSelect())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        '登録済みのサブスクを選ぶ',
        'Netflix',
        '1Password',
        'Adobe Creative Cloud',
        'Amazonプライム',
        'NewsPicks',
        'Notion',
        'Spotify',
      ]),
    );
    fireEvent.change(targetSelect(), { target: { value: '6' } });
    fireEvent.click(rowCheckbox('1Password'));
    expect(targetSelect().value).toBe('6');
  });

  it('行の選択は別の行を開いても保ち、取引名の選択は別の行を開くと外す', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    fireEvent.click(rowCheckbox('Netflix'));
    fireEvent.click(within(raw).getByRole('checkbox', { name: 'Spotify' }));
    expect(selectionBar().textContent).toContain('2件の取引を選択中');

    fireEvent.click(screen.getByRole('button', { name: 'Notionの詳細を表示' }));
    await waitFor(() => expect(selectionBar().textContent).toContain('1件の取引を選択中'));
    expect(chips().map((chip) => chip.getAttribute('aria-label') ?? chip.textContent)).toEqual([
      'Netflixの選択を外す',
    ]);
  });

  it('詳細の「名称を統合」から統合先を選んで統合すると、URL を統合先へ付け替え、フォーカスを「操作」へ移す (AC-016)', async () => {
    const { requests } = renderPage({ path: '/subscriptions?vendor=netflix' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('button', { name: '名称を統合' }));
    expect(selectionBar().textContent).toContain('1件の取引を選択中');
    await waitFor(() => expect(document.activeElement).toBe(targetSelect()));
    await waitFor(() => expect(targetSelect().value).toBe('1'));
    // 統合先が自分自身だけなら統合元が 0 件なので押せない
    expect(mergeButton(1).disabled).toBe(true);

    fireEvent.change(targetSelect(), { target: { value: '5' } });
    const button = mergeButton(1);
    expect(button.disabled).toBe(false);
    button.focus();
    fireEvent.click(button);
    await waitFor(() =>
      expect(sent(requests, 'POST', '/api/sub-vendors/merge').map((request) => request.body)).toEqual([
        { targetId: 5, sourceVendorIds: [1], rawNames: [], baseRevision: 7 },
      ]),
    );
    await waitFor(() => expect(location()).toBe('/subscriptions?vendor=notion'));
    await waitFor(() => expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull());
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).not.toContain('netflix');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: '操作' })),
    );
    expect(liveText()).toBe('Notion へ統合: 完了');
  });
});

/* ---------------- 同時処理と操作の一覧 (AC-009〜011 / AC-015 / AC-021 / AC-022 / FR-018 / UC-4) ---------------- */

describe('同時処理と操作の一覧', () => {
  it('処理中に積んだ統合は待機中として並び、先の失敗は再試行つきで残り、後の統合は完了する (AC-009)', async () => {
    const gate = deferred();
    renderPage({
      handler: async (url, init) => {
        if (url === '/api/sub-vendors/merge' && bodyOf(init)?.targetId === 5) {
          await gate.promise;
          return json({ error: 'internal' }, 500);
        }
        return undefined;
      },
    });
    await selectNetflixAndNotion();
    fireEvent.click(mergeButton(2));
    await operationItem(['処理中', 'Notion へ統合']);

    fireEvent.change(targetSelect(), { target: { value: '6' } });
    fireEvent.click(mergeButton(2));
    await waitFor(() => {
      const items = operationItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.textContent).toContain('待機中');
      expect(items[0]!.textContent).toContain('Adobe Creative Cloud へ統合');
      expect(items[0]!.textContent).toContain(ADMIN_EMAIL);
      expect(items[1]!.textContent).toContain('処理中');
      expect(items[1]!.textContent).toContain('Notion へ統合');
      expect(items[1]!.textContent).toContain(ADMIN_EMAIL);
    });

    gate.resolve();
    const failed = await operationItem(['失敗', 'Notion へ統合', SERVER_FAILED], 3_000);
    expect(within(failed).getByRole('button', { name: /再試行/ })).toBeTruthy();
    const done = await operationItem(['完了', 'Adobe Creative Cloud へ統合'], 3_000);
    expect(within(done).getByRole('button', { name: /元に戻す/ })).toBeTruthy();
    expect(liveText()).toBe('Adobe Creative Cloud へ統合: 完了');
    // 失敗は操作の行に出し、上部の通知 (読み込みの失敗専用) は使わない
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('統合を元に戻すと取り消しの記録が付き、統合元の行が戻る (AC-010)', async () => {
    const { requests } = renderPage();
    await selectNetflixAndNotion();
    fireEvent.click(mergeButton(2));
    const merged = await operationItem(['完了', 'Notion へ統合'], 3_000);
    await waitFor(() =>
      expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).not.toContain('netflix'),
    );

    fireEvent.click(within(merged).getByRole('button', { name: /元に戻す/ }));
    await waitFor(() =>
      expect(sent(requests, 'POST', '/api/subscription-operations/op-1/undo')).toHaveLength(1),
    );
    const [undo] = sent(requests, 'POST', '/api/subscription-operations/op-1/undo');
    expect(undo!.body).toEqual({ baseRevision: 8 });
    expect(undo!.key).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    await operationItem([`${ADMIN_EMAIL} が元に戻しました`], 3_000);
    await operationItem(['統合の取り消し']);
    await waitFor(() =>
      expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toContain('netflix'),
    );
  });

  it('処理中は行チェック・全選択・取引名・「名称を統合」だけを止める (AC-011)', async () => {
    const gate = deferred();
    renderPage({
      path: '/subscriptions?vendor=spotify',
      handler: async (url) => {
        if (url === '/api/sub-vendors/merge') await gate.promise;
        return undefined;
      },
    });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    for (const box of within(raw).getAllByRole('checkbox')) fireEvent.click(box);
    await waitFor(() => expect(within(targetSelect()).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(targetSelect(), { target: { value: '3' } });
    fireEvent.click(mergeButton(2));
    await operationItem(['処理中', 'Spotify へ統合']);

    expect(rowCheckbox('Netflix').disabled).toBe(true);
    expect(selectAll().disabled).toBe(true);
    for (const box of within(raw).getAllByRole('checkbox'))
      expect((box as HTMLInputElement).disabled).toBe(true);
    expect((within(panel).getByRole('button', { name: '名称を統合' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    // 統合のボタンと統合先は止めない (押すたびに 1 件積む)
    expect(mergeButton(2).disabled).toBe(false);
    expect(targetSelect().disabled).toBe(false);
    fireEvent.click(rowCheckbox('Netflix'));
    fireEvent.click(selectAll());
    expect(selectionBar().textContent).toContain('2件の取引を選択中');

    gate.resolve();
    await operationItem(['完了', 'Spotify へ統合'], 3_000);
  });

  it('busy は 1・2 秒待って同じ key で自動再試行し、利用者には失敗を見せない (AC-015)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    try {
      let busyLeft = 2;
      const { requests } = renderPage({
        handler: (url) => {
          if (url === '/api/sub-vendors/merge' && busyLeft > 0) {
            busyLeft -= 1;
            return busy();
          }
          return undefined;
        },
      });
      await selectNetflixAndNotion();
      fireEvent.click(mergeButton(2));
      await operationItem(['処理中', '別の操作を処理中です。自動で再試行します (1/3)']);
      await vi.advanceTimersByTimeAsync(1_000);
      await operationItem(['別の操作を処理中です。自動で再試行します (2/3)']);
      await vi.advanceTimersByTimeAsync(2_000);
      await operationItem(['完了', 'Notion へ統合'], 3_000);

      const merges = sent(requests, 'POST', '/api/sub-vendors/merge');
      expect(merges).toHaveLength(3);
      expect(new Set(merges.map((request) => request.key)).size).toBe(1);
      expect(document.body.textContent).not.toContain(SERVER_FAILED);
    } finally {
      vi.useRealTimers();
    }
  });

  it('revision の衝突は取り直してから新しい key と最新の base で送り直す (AC-021 A)', async () => {
    let conflicted = false;
    const vendorsGate = deferred();
    const { requests } = renderPage({
      handler: async (url, init, server) => {
        const method = init?.method ?? 'GET';
        if (url === '/api/sub-vendors/merge' && !conflicted) {
          // 他の利用者の書き込みが先に入った状態を作る。このあと write が 409 を返す
          conflicted = true;
          server.revision = 8;
          return undefined;
        }
        if (method === 'GET' && url.split('?')[0] === '/api/sub-vendors' && conflicted) {
          await vendorsGate.promise;
        }
        return undefined;
      },
    });
    await selectNetflixAndNotion();
    fireEvent.click(mergeButton(2));
    await operationItem(['他の利用者の操作が先に反映されました。最新の状態で送り直しています (1/3)']);
    expect(sent(requests, 'POST', '/api/sub-vendors/merge')).toHaveLength(1);

    vendorsGate.resolve();
    await operationItem(['完了', 'Notion へ統合'], 3_000);
    const merges = sent(requests, 'POST', '/api/sub-vendors/merge');
    expect(merges.map((request) => request.body?.baseRevision)).toEqual([7, 8]);
    expect(merges[0]!.key).not.toBe(merges[1]!.key);
  });

  it('送り直す前に統合元が他の操作で変わっていたら送らず、崩れた名前を出す (AC-021 B)', async () => {
    let changed = false;
    const { requests } = renderPage({
      handler: (url, _init, server) => {
        if (url === '/api/sub-vendors/merge' && !changed) {
          changed = true;
          server.vendors = server.vendors.map((vendor) =>
            vendor.id === 1 ? { ...vendor, mergedIntoId: 6 } : vendor,
          );
          server.rows = server.rows.filter((row) => row.vendorKey !== 'netflix');
          server.revision = 8;
        }
        return undefined;
      },
    });
    await selectNetflixAndNotion();
    fireEvent.click(mergeButton(2));
    const failed = await operationItem(
      ['Netflix は他の操作で変更されたため、統合しませんでした。一覧を確認してもう一度選んでください'],
      3_000,
    );
    expect(sent(requests, 'POST', '/api/sub-vendors/merge')).toHaveLength(1);
    expect(within(failed).queryByRole('button', { name: /再試行/ })).toBeNull();
    // 一覧から消えた Netflix は選択からも外れる
    await waitFor(() => expect(selectionBar().textContent).toContain('1件の取引を選択中'));
  });

  it('記録は操作者と取り消した人を出し、削除された利用者は名前で言い換え、操作 id は属性にだけ持つ (AC-022)', async () => {
    const op9: OperationRecord = {
      id: 'op-9',
      kind: 'merge',
      targetVendorName: 'Notion',
      createdAt: '2026-09-29T09:00:00.000Z',
      actorEmail: null,
      undoneAt: '2026-09-29T10:00:00.000Z',
      undoneByEmail: null,
      undoable: false,
      undoBlockedReason: 'already_undone',
    };
    const op8: OperationRecord = {
      id: 'op-8',
      kind: 'vendor_update',
      targetVendorName: 'Spotify',
      createdAt: '2026-09-29T08:00:00.000Z',
      actorEmail: 'suspended@example.test',
      undoneAt: null,
      undoneByEmail: null,
      undoable: false,
      undoBlockedReason: 'not_merge',
    };
    const { container } = renderPage({ operations: [op9, op8] });
    await kpiRegion();
    const merged = await operationItem(['Notion へ統合']);
    expect(merged.textContent).toContain('削除された利用者');
    expect(merged.textContent).toContain('削除された利用者が元に戻しました');
    expect(within(merged).queryByRole('button', { name: /元に戻す/ })).toBeNull();
    const updated = await operationItem(['登録内容の変更']);
    expect(updated.textContent).toContain('suspended@example.test');
    expect(container.querySelector('[data-operation-id="op-9"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('op-9');
  });

  it('操作の時刻は最終更新と同じく閲覧者のローカル時刻で「月/日 時:分」に出し、dateTime は記録の時刻のまま', async () => {
    // 東京では日付をまたぐ時刻。固定のタイムゾーンで書くと、東京以外の閲覧者 (と UTC の CI) で日付と時刻がずれる
    const createdAt = '2026-09-29T15:30:00.000Z';
    renderPage({
      operations: [
        {
          id: 'op-7',
          kind: 'vendor_update',
          targetVendorName: 'Spotify',
          createdAt,
          actorEmail: ADMIN_EMAIL,
          undoneAt: null,
          undoneByEmail: null,
          undoable: false,
          undoBlockedReason: 'not_merge',
        },
      ],
    });
    await kpiRegion();
    const item = await operationItem(['登録内容の変更']);
    const local = new Date(createdAt);
    const hh = String(local.getHours()).padStart(2, '0');
    const mm = String(local.getMinutes()).padStart(2, '0');
    const time = item.querySelector('time');
    expect(time?.textContent).toBe(`${local.getMonth() + 1}/${local.getDate()} ${hh}:${mm}`);
    expect(time?.getAttribute('datetime')).toBe(createdAt);
  });

  it('記録も待機中の操作も無ければ「操作」を出さない (FR-018)', async () => {
    const { calls } = renderPage();
    await kpiRegion();
    await waitFor(() => expect(getCount(calls, '/api/subscription-operations')).toBe(1));
    expect(screen.queryByRole('region', { name: '操作' })).toBeNull();
  });

  it('続けて 5 回押した統合は 1 件ずつ順に送り、base を進め、key を分け、利用者の識別子を本文に入れない (UC-4)', async () => {
    const { requests, server } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    for (const box of within(raw).getAllByRole('checkbox')) fireEvent.click(box);
    await waitFor(() => expect(within(targetSelect()).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(targetSelect(), { target: { value: '3' } });
    const button = mergeButton(2);
    for (let count = 0; count < 5; count += 1) fireEvent.click(button);

    await waitFor(
      () =>
        expect(operationItems().filter((item) => (item.textContent ?? '').includes('完了'))).toHaveLength(5),
      { timeout: 5_000 },
    );
    const merges = sent(requests, 'POST', '/api/sub-vendors/merge');
    expect(merges).toHaveLength(5);
    expect(server.maxInflight).toBe(1);
    expect(merges.map((request) => request.body?.baseRevision)).toEqual([7, 8, 9, 10, 11]);
    expect(new Set(merges.map((request) => request.key)).size).toBe(5);
    const payload = JSON.stringify(
      requests.filter((request) => request.method !== 'GET').map((request) => request.body),
    );
    expect(payload).not.toContain('tenant');
    expect(payload).not.toContain('usr_test_admin');
    expect(payload).not.toContain(ADMIN_EMAIL);
  });
});

/* ---------------- 検出理由 ---------------- */

describe('サブスク候補の検出理由', () => {
  it('最優先の1件を代表表示し、残りは既存の候補絞り込みへ渡す', async () => {
    renderPage();
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute('data-vendor-key')).toBe('adobecreativecloud');
    expect(items[0]!.textContent).toContain('¥2,480 → ¥2,728 (+10.0%)');

    fireEvent.click(within(card).getByRole('button', { name: '他1件を候補一覧で見る →' }));
    const filter = screen.getByRole('combobox', { name: 'ステータスで絞り込む' });
    await waitFor(() => expect((filter as HTMLSelectElement).value).toBe('review'));
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual([
      'adobecreativecloud',
      'spotify',
    ]);
  });

  it('理由カードは判断を持たず、詳細内のみから判断 API に送る', async () => {
    const { calls } = renderPage();
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    expect(within(card).queryByRole('button', { name: /候補から除外/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    const decisions = await within(panel).findByRole('region', { name: '候補の判断' });
    fireEvent.click(within(decisions).getByRole('button', { name: '候補から除外' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/subscriptions/review-decisions?span=1',
        body: { vendorKey: 'spotify', decision: 'dismissed', baseRevision: 7 },
      }),
    );
  });

  const reviewData = {
    ...fixtureScreen,
    kpis: { ...fixtureScreen.kpis, reviewCandidates: 3 },
    rows: [unregistered, ...fixtureRows],
  };

  async function openUnregisteredDecisions() {
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(1);
    expect(within(card).getByRole('button', { name: '他2件を候補一覧で見る →' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'この候補を詳しく見る →' }));
    const panel = await detailPanel();
    return within(panel).findByRole('region', { name: '候補の判断' });
  }

  it('未登録の候補は詳細内の一か所から取引名ごと除外できる', async () => {
    const { calls } = renderPage({ data: reviewData, detail: unregisteredDetail });
    const decisions = await openUnregisteredDecisions();
    fireEvent.click(within(decisions).getByRole('button', { name: '架空動画を候補から除外' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors/exclusions',
        body: { partner: '架空動画', baseRevision: 7 },
      }),
    );
  });

  it('未登録の候補を詳細内で採用すると登録済みの判断に切り替わり、後の送信は前の応答の revision を base にする', async () => {
    const { calls } = renderPage({ data: reviewData, detail: unregisteredDetail });
    const decisions = await openUnregisteredDecisions();
    fireEvent.click(within(decisions).getByRole('button', { name: '架空動画を候補として採用' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors',
        body: { name: '架空動画', aliases: [], accounts: [], baseRevision: 7 },
      }),
    );
    await operationItem(['完了', '登録'], 3_000);
    // 採用で取引名は登録へまとまるので、未登録向けの「取引名ごと除外」は出さず、登録済みの判断だけを出す
    const panel = await detailPanel();
    const after = await within(panel).findByRole('region', { name: '候補の判断' });
    await waitFor(() =>
      expect(within(after).queryByRole('button', { name: '架空動画を候補から除外' })).toBeNull(),
    );
    fireEvent.click(within(after).getByRole('button', { name: '候補から除外' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/subscriptions/review-decisions?span=1',
        body: { vendorKey: '架空動画', decision: 'dismissed', baseRevision: 8 },
      }),
    );
  });
});

/* ---------------- 選択バーからの統合先の登録 ---------------- */

describe('選択バーからの統合先の登録', () => {
  const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };

  it('登録済みの行を選んでいなければ新しい統合先を登録でき、その統合先を自動で選ぶ', async () => {
    const { requests } = renderPage({ data, detail: unregisteredDetail });
    await kpiRegion();
    fireEvent.click(rowCheckbox('架空動画'));
    const trigger = await within(selectionBar()).findByRole('button', { name: '新しい統合先を登録' });
    fireEvent.click(trigger);
    const input = within(selectionBar()).getByRole('textbox', {
      name: '新しい統合先の名前',
    }) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    // 初期値は最初に選んだ行の表示名
    expect(input.value).toBe('架空動画');
    expect(input.getAttribute('maxlength')).toBe('120');
    fireEvent.change(input, { target: { value: '新しいクラウド' } });
    fireEvent.click(within(selectionBar()).getByRole('button', { name: '登録して統合先に選ぶ' }));

    await waitFor(() =>
      expect(sent(requests, 'POST', '/api/sub-vendors').map((request) => request.body)).toEqual([
        { name: '新しいクラウド', aliases: [], accounts: [], baseRevision: 7 },
      ]),
    );
    await waitFor(() => expect(targetSelect().value).toBe('99'));
    expect(within(selectionBar()).getByRole('status').textContent).toMatch(/登録し、統合先に選びました/);
  });

  it('既定の名前のまま登録して選択がすべてその登録にまとまったら、統合の完了と同じく選択を消す', async () => {
    const { requests } = renderPage({ data, detail: unregisteredDetail });
    await kpiRegion();
    fireEvent.click(rowCheckbox('架空動画'));
    fireEvent.click(await within(selectionBar()).findByRole('button', { name: '新しい統合先を登録' }));
    // 名前は既定 (選んだ行の表示名) のまま。登録の照合 (名前の完全一致) で選んだ行がこの登録へまとまる
    fireEvent.click(within(selectionBar()).getByRole('button', { name: '登録して統合先に選ぶ' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull());
    expect(sent(requests, 'POST', '/api/sub-vendors').map((request) => request.body)).toEqual([
      { name: '架空動画', aliases: [], accounts: [], baseRevision: 7 },
    ]);
    // 統合するものは残っていないので、統合の要求は送らない
    expect(sent(requests, 'POST', '/api/sub-vendors/merge')).toEqual([]);
    expect(rowCheckbox('架空動画').checked).toBe(false);
    // バーと一緒に消えた選択欄のフォーカスは「操作」の見出しへ移り、結果はそこで読める
    expect(document.activeElement).toBe(within(operationsRegion()).getByRole('heading', { name: '操作' }));
    expect(operationsRegion().textContent).toContain('登録');
  });

  it('統合のボタンを押せないときは、押せない理由をボタンの説明として出す', async () => {
    renderPage({ data, detail: unregisteredDetail });
    await kpiRegion();
    const description = (button: HTMLButtonElement) =>
      document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent ?? null;

    // 未登録の行だけでは統合先が決まらない
    fireEvent.click(rowCheckbox('架空動画'));
    expect(mergeButton(1).disabled).toBe(true);
    expect(description(mergeButton(1))).toBe('統合先を選ぶと統合できます。');

    // 登録済みの行 1 件だけでは、統合先が自分になり統合するものが無い
    fireEvent.click(rowCheckbox('架空動画'));
    fireEvent.click(rowCheckbox('Netflix'));
    await waitFor(() => expect(targetSelect().value).not.toBe(''));
    expect(mergeButton(1).disabled).toBe(true);
    expect(description(mergeButton(1))).toBe('統合先とは別の行か取引名も選ぶと統合できます。');

    // もう 1 件選べば押せて、理由は消える
    fireEvent.click(rowCheckbox('Notion'));
    await waitFor(() => expect(mergeButton(2).disabled).toBe(false));
    expect(mergeButton(2).getAttribute('aria-describedby')).toBeNull();
    expect(within(selectionBar()).queryByText(/統合できます。$/)).toBeNull();
  });

  it('統合先の登録をやめると開始ボタンへフォーカスを戻す', async () => {
    renderPage({ data, detail: unregisteredDetail });
    await kpiRegion();
    fireEvent.click(rowCheckbox('架空動画'));
    fireEvent.click(await within(selectionBar()).findByRole('button', { name: '新しい統合先を登録' }));
    const input = within(selectionBar()).getByRole('textbox', { name: '新しい統合先の名前' });
    expect(document.activeElement).toBe(input);
    fireEvent.click(within(selectionBar()).getByRole('button', { name: 'やめる' }));
    expect(document.activeElement).toBe(
      within(selectionBar()).getByRole('button', { name: '新しい統合先を登録' }),
    );
  });

  it('新しい統合先の重複は入力の近くで既存の選択へ案内する', async () => {
    renderPage({ data, detail: unregisteredDetail });
    await kpiRegion();
    fireEvent.click(rowCheckbox('架空動画'));
    fireEvent.click(await within(selectionBar()).findByRole('button', { name: '新しい統合先を登録' }));
    fireEvent.change(within(selectionBar()).getByRole('textbox', { name: '新しい統合先の名前' }), {
      target: { value: 'Spotify' },
    });
    fireEvent.click(within(selectionBar()).getByRole('button', { name: '登録して統合先に選ぶ' }));
    const error = await within(selectionBar()).findByRole('alert');
    expect(error.textContent).toContain('すでにあります');
    expect(error.textContent).toContain('一覧から選んでください');
  });
});

/* ---------------- 読込・空・失敗 ---------------- */

describe('読込中・空・失敗', () => {
  it('読込中は枠と見出しを先に出す', async () => {
    const gate = deferred();
    renderPage({
      handler: async (url) => {
        if (url.includes('/api/subscriptions')) {
          await gate.promise;
          return json(fixtureScreen);
        }
        return undefined;
      },
    });
    expect(screen.getByRole('heading', { name: 'サブスク一覧' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'データソースのカバー率' })).toBeTruthy();
    expect(screen.getByText('サブスクを読み込んでいます')).toBeTruthy();
    gate.resolve();
    await kpiRegion();
    expect(screen.getByRole('table', { name: 'サブスク一覧' })).toBeTruthy();
  });

  it('期間にサブスクが無ければ取込への導線を出す', async () => {
    renderPage({
      data: {
        ...fixtureScreen,
        kpis: { ...fixtureScreen.kpis, monthlyTotal: 0, annualized: 0, reviewCandidates: 0 },
        rows: [],
      },
    });
    const empty = await screen.findByText('この期間にサブスクの支払いはありません');
    expect(empty.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'データ取込へ' }).getAttribute('href')).toBe('/import');
    expect(screen.queryByRole('table', { name: 'サブスク一覧' })).toBeNull();
  });

  it('取得に失敗したら再試行できる', async () => {
    let fail = true;
    renderPage({
      handler: (url) => {
        if (url.includes('/api/subscriptions') && fail) return json({ error: 'internal' }, 500);
        return undefined;
      },
    });
    const alert = await screen.findByRole('alert');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: '再試行' }));
    await kpiRegion();
  });

  it('更新の失敗は操作の行に出し、再試行は同じ key と同じ本文で送り直す', async () => {
    let fail = true;
    const { requests } = renderPage({
      handler: (url, init) => {
        if (url.includes('/review-decisions') && init?.method === 'POST' && fail) {
          fail = false;
          return json({ error: 'internal' }, 500);
        }
        return undefined;
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    const failed = await operationItem(['失敗', '候補の判断', SERVER_FAILED], 3_000);
    // 上部の通知は読み込みの失敗だけ。失敗した操作の行も role=alert にしない
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sent(requests, 'POST', '/api/subscriptions/review-decisions')).toHaveLength(1);

    fireEvent.click(within(failed).getByRole('button', { name: /再試行/ }));
    await waitFor(() =>
      expect(sent(requests, 'POST', '/api/subscriptions/review-decisions')).toHaveLength(2),
    );
    const [first, second] = sent(requests, 'POST', '/api/subscriptions/review-decisions');
    expect(second!.key).toBe(first!.key);
    expect(second!.body).toEqual(first!.body);
    await waitFor(() => {
      const items = operationItems();
      expect(items).toHaveLength(1);
      expect(items[0]!.textContent).toContain('完了');
      expect(items[0]!.textContent).toContain('候補の判断');
    });
  });

  it('関連データの補助取得に失敗したら対象ごとの失敗と再試行を表示する', async () => {
    const { calls } = renderPage({
      path: '/subscriptions?vendor=spotify',
      handler: (url, init) => {
        if ((init?.method ?? 'GET') !== 'GET') return undefined;
        if (url === '/api/sub-vendors' || url === '/api/sub-vendors/candidates') {
          return json({ error: 'internal' }, 500);
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    expect(await within(panel).findByText('対象科目の候補を読み込めませんでした。')).toBeTruthy();
    expect(await within(panel).findByText('除外した支払先を読み込めませんでした。')).toBeTruthy();
    expect(within(panel).getAllByRole('button', { name: '再試行' })).toHaveLength(2);
    expect(getCount(calls, '/api/sub-vendors')).toBe(1);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1);
  });
});

/* ---------------- 旧 UI から移した操作 (旧 SubVendors.dom.test / subs-review.dom.test の検査を移設) ---------------- */

describe('旧 UI から移した操作', () => {
  const openRelated = async (options: Parameters<typeof renderPage>[0] = {}) => {
    const view = renderPage({ path: '/subscriptions?vendor=spotify', ...options });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(view.calls, '/api/sub-vendors/candidates')).toBe(1));
    return { ...view, panel };
  };

  it('対象科目をチェックすると accounts だけを PUT する (旧: 対象科目を編集して保存)', async () => {
    const { calls, panel } = await openRelated();
    const accounts = within(panel).getByRole('group', { name: '対象科目' });
    expect((within(accounts).getByRole('checkbox', { name: '通信費' }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(within(accounts).getByRole('checkbox', { name: '支払手数料' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        url: '/api/sub-vendors/3',
        body: { accounts: ['通信費', '支払手数料'], baseRevision: 7 },
      }),
    );
  });

  it('対象科目は処理中も続けて押せ、後の変更は前の変更を反映した一覧から本文を作る', async () => {
    const { requests, panel } = await openRelated();
    const accounts = within(panel).getByRole('group', { name: '対象科目' });
    fireEvent.click(within(accounts).getByRole('checkbox', { name: '支払手数料' }));
    fireEvent.click(within(accounts).getByRole('checkbox', { name: '通信費' }));
    expect((within(accounts).getByRole('checkbox', { name: '支払手数料' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(accounts).getByRole('checkbox', { name: '通信費' }) as HTMLInputElement).checked).toBe(
      false,
    );
    await waitFor(
      () =>
        expect(sent(requests, 'PUT', '/api/sub-vendors/3').map((request) => request.body)).toEqual([
          { accounts: ['通信費', '支払手数料'], baseRevision: 7 },
          { accounts: ['支払手数料'], baseRevision: 8 },
        ]),
      { timeout: 3_000 },
    );
  });

  it('別名を消すと残りの別名で PUT する (統合の取消)', async () => {
    const { calls, panel } = await openRelated();
    fireEvent.click(within(panel).getByRole('button', { name: '別名「SPOTIFY.COM」を削除' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        url: '/api/sub-vendors/3',
        body: { aliases: [], baseRevision: 7 },
      }),
    );
  });

  it('名前の変更が busy のまま上限に達したら失敗として残し、重複とは言わない', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    try {
      const { requests } = renderPage({
        path: '/subscriptions?vendor=spotify',
        handler: (_url, init) => (init?.method === 'PUT' ? busy() : undefined),
      });
      const panel = await detailPanel();
      fireEvent.change(await within(panel).findByRole('textbox', { name: '正規化された名称' }), {
        target: { value: 'Spotify Premium' },
      });
      fireEvent.click(within(panel).getByRole('button', { name: '保存' }));
      const puts = () => sent(requests, 'PUT', '/api/sub-vendors/3');
      await waitFor(() => expect(puts()).toHaveLength(1));
      for (const [ms, count] of [
        [1_000, 2],
        [2_000, 3],
        [4_000, 4],
      ] as const) {
        await vi.advanceTimersByTimeAsync(ms);
        await waitFor(() => expect(puts()).toHaveLength(count));
      }
      const failed = await operationItem([
        '失敗',
        '登録内容の変更',
        '別の操作が続いているため送れませんでした。少し待ってから再試行してください',
      ]);
      expect(within(failed).getByRole('button', { name: /再試行/ })).toBeTruthy();
      expect(document.body.textContent).not.toContain('すでにあります');
      expect(new Set(puts().map((request) => request.key)).size).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('「見直した」は記録だけを送る (登録内容は変えないので PUT しない)', async () => {
    const { calls, panel } = await openRelated();
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    fireEvent.click(within(review).getByRole('button', { name: '見直した' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url === '/api/sub-vendors/3/review')).toBe(true),
    );
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors')).toBeGreaterThan(vendorGets));
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(candidateGets);
  });

  it('一度も見直していなければ「まだ見直していません」、期限を過ぎたら「見直し時期」を出す', async () => {
    const { panel } = await openRelated({
      detail: { ...spotifyDetail, related: { ...spotifyDetail.related!, reviewedAt: null, reviewDue: true } },
    });
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    expect(review.textContent).toContain('まだ見直していません');
    expect(within(review).getByText('見直し時期')).toBeTruthy();
  });

  it('期限内は「見直し時期」を出さない (催促を出しすぎない)', async () => {
    const { panel } = await openRelated();
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    expect(within(review).queryByText('見直し時期')).toBeNull();
  });

  it('除外した支払先は関連データに出て、取り消すと DELETE を送る', async () => {
    const { calls, panel } = await openRelated({
      handler: (url, init) =>
        url.includes('/api/sub-vendors/candidates') && (init?.method ?? 'GET') === 'GET'
          ? json({ candidates: [], excluded: [{ id: 3, partner: '架空家賃' }], dealRows: 0 })
          : undefined,
    });
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    fireEvent.click(await within(panel).findByRole('button', { name: '架空家賃の除外を取り消す' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'DELETE',
        url: '/api/sub-vendors/exclusions/3',
        body: { baseRevision: 7 },
      }),
    );
    await waitFor(() =>
      expect(getCount(calls, '/api/sub-vendors/candidates')).toBeGreaterThan(candidateGets),
    );
    expect(getCount(calls, '/api/sub-vendors')).toBe(vendorGets);
  });

  it('登録の解除は確認ダイアログを経てから DELETE を送る', async () => {
    const { calls, panel } = await openRelated();
    fireEvent.click(within(panel).getByRole('button', { name: '登録の解除' }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: '「Spotify」の登録を解除しますか？' });
    fireEvent.click(within(dialog).getByRole('button', { name: '登録を解除する' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'DELETE',
        url: '/api/sub-vendors/3',
        body: { baseRevision: 7 },
      }),
    );
  });
});

describe('サブスク共通UIの回帰', () => {
  it('名称の上限を共有し、未編集時だけ同じ詳細の再取得へ追随する', async () => {
    const { client } = renderPage({ path: `/subscriptions?vendor=${spotifyDetail.vendorKey}` });
    const panel = await detailPanel();
    const input = (await within(panel).findByRole('textbox', {
      name: '正規化された名称',
    })) as HTMLInputElement;
    expect(input.maxLength).toBe(SUB_VENDOR_NAME_MAX);
    const refreshName = async (name: string) => {
      await act(async () => {
        client.setQueriesData<SubscriptionVendorDetail>(
          { predicate: (query) => query.queryKey[0] === 'subscriptions' && query.queryKey[2] === 'vendor' },
          (old) => (old ? { ...old, row: { ...old.row, normalizedName: name } } : old),
        );
      });
    };
    await refreshName('新しい名称');
    await waitFor(() => expect(input.value).toBe('新しい名称'));
    fireEvent.change(input, { target: { value: '編集中の名称' } });
    await refreshName('別の更新');
    expect(input.value).toBe('編集中の名称');
  });

  it('カテゴリは次回編集時に最新値を使い、編集中の入力は再取得で上書きしない', async () => {
    const { client } = renderPage({ path: `/subscriptions?vendor=${spotifyDetail.vendorKey}` });
    const panel = await detailPanel();
    const edit = await within(panel).findByRole('button', { name: 'カテゴリを変更' });
    const refreshCategory = async (category: string) => {
      await act(async () => {
        client.setQueriesData<SubscriptionVendorDetail>(
          { predicate: (query) => query.queryKey[0] === 'subscriptions' && query.queryKey[2] === 'vendor' },
          (old) => (old ? { ...old, row: { ...old.row, category } } : old),
        );
      });
    };
    await refreshCategory('新カテゴリ');
    await within(panel).findByText('新カテゴリ');
    fireEvent.click(edit);
    const input = within(panel).getByRole('combobox', { name: 'カテゴリ' }) as HTMLInputElement;
    expect(input.value).toBe('新カテゴリ');
    fireEvent.change(input, { target: { value: '入力中' } });
    await refreshCategory('更新カテゴリ');
    expect(input.value).toBe('入力中');
    fireEvent.click(within(panel).getByRole('button', { name: 'やめる' }));
    await within(panel).findByText('更新カテゴリ');
    fireEvent.click(within(panel).getByRole('button', { name: 'カテゴリを変更' }));
    expect((within(panel).getByRole('combobox', { name: 'カテゴリ' }) as HTMLInputElement).value).toBe(
      '更新カテゴリ',
    );
  });

  it('履歴取得失敗を空の履歴と区別し、再取得で復帰する', async () => {
    let fail = true;
    const { calls } = renderPage({
      handler: (url) =>
        url.split('?')[0] === '/api/subscription-operations' && fail
          ? json({ error: { code: 'internal', message: 'failed' } }, 500)
          : undefined,
    });
    await screen.findByText('操作履歴を読み込めませんでした。');
    expect(screen.getByRole('region', { name: '操作' })).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '履歴を読み直す' }));
    await waitFor(() => expect(screen.queryByText('操作履歴を読み込めませんでした。')).toBeNull());
    expect(getCount(calls, '/api/subscription-operations')).toBe(2);
  });
});
