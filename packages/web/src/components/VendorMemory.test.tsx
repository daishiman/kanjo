// @vitest-environment jsdom

/**
 * 取引先の決め事の一覧と、明細に付く印の契約(T14)。
 *
 * 見張っているのは3つ。
 *   1. 今どう動いているかが読める。適用内容・扱い・確信度・件数・最終適用日。
 *   2. 止める・留める・直す・当て直す の4操作がその場でできる。
 *   3. 自動で当たった明細には印が付き、そこから決め事へ辿れる。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VendorMemoryRow } from '../api.js';
import { VendorMemoryBadge, VendorMemorySettings, appliedText } from './VendorMemory.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const memory = (over: Partial<VendorMemoryRow> = {}): VendorMemoryRow => ({
  vendorKey: '架空サーバ',
  vendorLabel: '架空サーバ',
  cls: 'biz',
  big: '通信費',
  mid: '',
  owner: null,
  hitCount: 9,
  disagreeCount: 0,
  pinned: false,
  revoked: false,
  disposition: 'auto-apply',
  confidence: 1,
  reason: '9件',
  updatedAt: '2026-08-20T09:00:00.000Z',
  ...over,
});

const stubFetch = (memories: VendorMemoryRow[]) => {
  const calls: Array<{ path: string; method: string; body: string | null }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = decodeURIComponent(String(input));
      calls.push({ path, method: init?.method ?? 'GET', body: (init?.body as string) ?? null });
      if (path === '/api/vendor-memory') return json({ memories });
      if (path.endsWith('/reapply'))
        return json({
          vendorKey: '架空サーバ',
          disposition: 'auto-apply',
          reason: '9件',
          matched: 9,
          applied: 4,
          withdrawn: 0,
        });
      if (path.startsWith('/api/vendor-memory/')) return json(memories[0]);
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

function renderWith(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('決め事の一覧', () => {
  it('取引先・適用内容・確信度・適用件数・最終適用日を出す', async () => {
    stubFetch([memory()]);
    renderWith(<VendorMemorySettings />);

    expect(await screen.findByText('架空サーバ')).toBeTruthy();
    expect(screen.getByText('事業 / 通信費')).toBeTruthy();
    expect(screen.getByText('自動で当てる')).toBeTruthy();
    // 列の順は 取引先 / 適用内容 / 扱い / 確信度 / 適用件数 / 最終適用日 / 操作
    const cells = screen.getByText('架空サーバ').closest('tr')?.querySelectorAll('td') ?? [];
    expect(cells[3]?.textContent).toBe('1.00');
    expect(cells[4]?.textContent).toBe('9件');
    // 最終適用日は日時で出す(「いつから当たっているか」が分からないと止める判断ができない)
    expect(cells[5]?.textContent).toContain('2026');
  });

  it('扱いの理由を件数の言葉で出す。割合だけにしない', async () => {
    stubFetch([
      memory({
        vendorKey: '架空スタンド',
        vendorLabel: '架空スタンド',
        hitCount: 2,
        disposition: 'suggest',
        confidence: 1,
        reason: '2件。自動で当てるには 3 件以上が要る',
      }),
    ]);
    renderWith(<VendorMemorySettings />);

    expect(await screen.findByText('2件。自動で当てるには 3 件以上が要る')).toBeTruthy();
    expect(screen.getByText('候補として出す')).toBeTruthy();
  });

  it('食い違いがあれば件数を添える', async () => {
    stubFetch([memory({ disagreeCount: 2 })]);
    renderWith(<VendorMemorySettings />);
    expect(await screen.findByText('9件(食い違い2件)')).toBeTruthy();
  });

  it('1件も無ければ表を出さず、どうすれば増えるかを書く', async () => {
    stubFetch([]);
    renderWith(<VendorMemorySettings />);
    expect(
      await screen.findByText(
        'まだ決め事はありません。同じ取引先を3回以上同じように手当てすると、ここに出ます。',
      ),
    ).toBeTruthy();
  });

  it('何も決まっていない決め事を「— / —」で見せない', () => {
    expect(appliedText(memory({ cls: null, big: null, mid: null, owner: null }))).toBe(
      '(何も決めていません)',
    );
    expect(appliedText(memory({ cls: 'per', big: '食費', mid: '外食', owner: 'spouse' }))).toContain(
      '家計 / 食費 / 外食',
    );
  });
});

describe('決め事の操作', () => {
  it('取り消せる', async () => {
    const calls = stubFetch([memory()]);
    renderWith(<VendorMemorySettings />);

    fireEvent.click(await screen.findByRole('button', { name: '取り消す' }));

    await waitFor(() => {
      const patch = calls.find((call) => call.method === 'PATCH');
      expect(patch?.path).toBe('/api/vendor-memory/架空サーバ');
      expect(JSON.parse(patch?.body ?? '{}')).toEqual({ revoked: true });
    });
  });

  it('取り消し済みなら、戻す側のボタンになる', async () => {
    stubFetch([memory({ revoked: true, disposition: 'inactive', reason: '取り消されています' })]);
    renderWith(<VendorMemorySettings />);

    expect(await screen.findByRole('button', { name: '取り消しをやめる' })).toBeTruthy();
    expect(screen.getByText('取り消し済み')).toBeTruthy();
  });

  it('件数によらず当てるように留められる', async () => {
    const calls = stubFetch([memory({ hitCount: 2, disposition: 'suggest' })]);
    renderWith(<VendorMemorySettings />);

    fireEvent.click(await screen.findByRole('button', { name: '件数によらず当てる' }));

    await waitFor(() =>
      expect(JSON.parse(calls.find((call) => call.method === 'PATCH')?.body ?? '{}')).toEqual({
        pinned: true,
      }),
    );
  });

  it('内容を直せる。開くまでは入力欄を出さない', async () => {
    const calls = stubFetch([memory()]);
    renderWith(<VendorMemorySettings />);

    await screen.findByText('架空サーバ');
    expect(screen.queryByLabelText('架空サーバの大項目')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '内容を直す' }));
    fireEvent.change(screen.getByLabelText('架空サーバの大項目'), { target: { value: '支払手数料' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(JSON.parse(calls.find((call) => call.method === 'PATCH')?.body ?? '{}')).toEqual({
        big: '支払手数料',
        mid: null,
      }),
    );
  });

  it('過去の明細へ当て直せる。何件動いたかを言葉で返す', async () => {
    const calls = stubFetch([memory()]);
    renderWith(<VendorMemorySettings />);

    fireEvent.click(await screen.findByRole('button', { name: '過去の明細へ当て直す' }));

    await waitFor(() =>
      expect(calls.some((call) => call.path === '/api/vendor-memory/架空サーバ/reapply')).toBe(true),
    );
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('9件');
    expect(notice.textContent).toContain('4件に当て');
    // 人が選んだ手当てを巻き込まないことを、その場で言い切る(DR-6)
    expect(notice.textContent).toContain('あなたが選んだ手当ては外していません');
  });
});

describe('明細に付く印', () => {
  it('自動で当たっている明細に印が付き、決め事の一覧へ辿れる', async () => {
    renderWith(<VendorMemoryBadge origin="vendor_memory" originKey="架空サーバ" />);

    const badge = screen.getByText('決め事');
    expect(badge.getAttribute('href')).toBe('/settings#vendor-memory');
    expect(badge.getAttribute('title')).toContain('保存された適用由来');
  });

  it('値一致ではなくprovenanceだけを表示条件にする', () => {
    const { container } = renderWith(<VendorMemoryBadge origin="manual" originKey="架空サーバ" />);
    expect(container.textContent).toBe('');
  });

  it('origin_keyが無い壊れたprovenanceには印を付けない', () => {
    const { container } = renderWith(<VendorMemoryBadge origin="vendor_memory" originKey={null} />);
    expect(container.textContent).toBe('');
  });
});

describe('一覧に出さないもの', () => {
  it('明細の内容・金額は1件も出ない(DR-9)', async () => {
    stubFetch([memory()]);
    const { container } = renderWith(<VendorMemorySettings />);

    await screen.findByText('架空サーバ');
    const table = within(container).getByRole('table');
    // 出るのは取引先・適用内容・件数だけ。金額の記号も明細IDも出ない
    expect(table.textContent).not.toContain('¥');
    expect(table.textContent).not.toMatch(/tx-/);
  });
});
