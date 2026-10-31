// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/**
 * 現金入力画面の操作の流れ (spec-cash-screen FR-1〜FR-13 / SYS-CASH-P04〜P06)。
 *
 * API はメモリ上の偽サーバで受ける。一覧の応答は書き込みのたびに作り直すので、
 * 「成功後に query を無効化して取り直す」ことを画面の表示で確かめられる。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の現金画面 (`pages/Cash.tsx` 一枚) は ./CashPage.js を持たず、担当者・業務の目的・
 * 下書き・元に戻す・一括削除・URL の月を持たない。対象期間カードとタブも無い。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CashEntry } from '../../api.js';
import { CashPage } from './CashPage.js';

const RANGE = { from: '2026-07', to: '2026-08' };
const USER = 'u1';
const DRAFT_KEY = `kanjo:cash-draft:v1:${USER}`;

const entry = (patch: Partial<CashEntry> = {}): CashEntry => ({
  id: 1,
  date: '2026-08-05',
  month: '2026-08',
  side: 'biz',
  io: 'expense',
  amount: 1_200,
  description: 'コピー用紙',
  categoryMajor: '消耗品費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  owner: 'business',
  transitPurpose: null,
  ...patch,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, message: string) => json({ error: { code: 'x', message } }, status);

type Override = (method: string, path: string, body: unknown) => Response | undefined;

/** メモリ上の偽サーバ。削除した行は deleted に移し、戻しで live へ戻す */
function server(initial: CashEntry[] = [], override?: Override) {
  const live = new Map(initial.map((e) => [e.id, e]));
  const deleted = new Map<number, CashEntry>();
  let nextId = 100;
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(req), 'http://localhost');
      const path = url.pathname.replace(/^\/api/, '');
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path: `${path}${url.search}`, body });
      const custom = override?.(method, path, body);
      if (custom) return custom;
      if (path === '/auth/me') {
        return json({
          authenticated: true,
          user: { id: USER, email: 'a@example.com', role: 'admin', status: 'active' },
        });
      }
      if (path === '/summary') {
        return json({
          period: {
            applied: RANGE,
            full: RANGE,
            label: '2026年7月 〜 2026年8月',
            years: ['2026'],
            monthCount: 2,
          },
        });
      }
      if (path === '/cash-entries' && method === 'GET') {
        return json({
          entries: [...live.values()],
          candidates: {
            biz: [
              { name: '消耗品費', source: 'freee', mids: [] },
              { name: '旅費交通費', source: 'freee', mids: [] },
            ],
            per: [{ name: '食費', source: 'mf', mids: [] }],
          },
          months: ['2026-07', '2026-08'],
          duplicates: [],
        });
      }
      if (path === '/cash-entries' && method === 'POST') {
        const b = body as Record<string, unknown>;
        const created = entry({
          id: nextId++,
          date: String(b.date),
          month: String(b.date).slice(0, 7),
          side: b.side as CashEntry['side'],
          io: b.io as CashEntry['io'],
          amount: Number(b.amount),
          description: String(b.description),
          categoryMajor: String(b.big),
          transitFrom: (b.transitFrom as string | null) ?? null,
          transitTo: (b.transitTo as string | null) ?? null,
          transitRound: Boolean(b.transitRound),
          receiptWaived: Boolean(b.receiptWaived),
          owner: b.owner as CashEntry['owner'],
          transitPurpose: (b.transitPurpose as string | null) ?? null,
        });
        live.set(created.id, created);
        return json({ entry: created }, 201);
      }
      const one = path.match(/^\/cash-entries\/(\d+)(\/restore)?$/);
      if (one) {
        const id = Number(one[1]);
        if (one[2]) {
          const e = deleted.get(id);
          if (!e) return fail(404, 'not found');
          deleted.delete(id);
          live.set(id, e);
          return json({ entry: e });
        }
        const e = live.get(id);
        if (!e) return fail(404, 'not found');
        if (method === 'DELETE') {
          live.delete(id);
          deleted.set(id, e);
          return json({ ok: true, id, deletedAt: '2026-08-26T00:00:00Z' });
        }
        if (method === 'PUT') {
          const b = body as Record<string, unknown>;
          const next = { ...e, amount: Number(b.amount), description: String(b.description) };
          live.set(id, next);
          return json({ entry: next });
        }
      }
      if (path === '/cash-entries/bulk-delete') {
        const ids = (body as { ids: number[] }).ids;
        if (ids.some((id) => !live.has(id))) return fail(404, 'not found');
        for (const id of ids) {
          deleted.set(id, live.get(id)!);
          live.delete(id);
        }
        return json({ ok: true, ids, deletedAt: '2026-08-26T00:00:00Z' });
      }
      if (path === '/cash-entries/bulk-restore') {
        const ids = (body as { ids: number[] }).ids;
        if (ids.some((id) => !deleted.has(id))) return fail(404, 'not found');
        const entries = ids.map((id) => {
          const e = deleted.get(id)!;
          deleted.delete(id);
          live.set(id, e);
          return e;
        });
        return json({ entries });
      }
      return fail(404, 'not found');
    }),
  );
  return { calls, live, deleted };
}

let location = '';
function LocationProbe() {
  const loc = useLocation();
  location = `${loc.pathname}${loc.search}`;
  return null;
}

function show(path = '/cash?month=2026-08') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <CashPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const card = (kind: 'normal' | 'transit') => {
  const el = document.querySelector<HTMLElement>(`[data-cash-card="${kind}"]`);
  if (!el) throw new Error(`card ${kind} is missing`);
  return within(el);
};
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const pickCategory = (name: string) => {
  fireEvent.click(card('normal').getByRole('button', { name: '勘定科目を選ぶ' }));
  fireEvent.click(card('normal').getByRole('button', { name }));
};
const sticky = () => document.querySelector<HTMLElement>('.cash-sticky')!;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('見出し・対象期間・タブ', () => {
  it('問いと説明、対象期間カード、2 つのタブを出す', async () => {
    server();
    show();
    expect(screen.getByRole('heading', { level: 1, name: '現金入力' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: '現金と交通費を、漏れなく記録しますか？' }),
    ).toBeTruthy();
    expect(screen.getByText(/日々の現金の支払いや受け取り、交通費を記録します。/)).toBeTruthy();
    expect(screen.getByText('対象期間（グローバル）')).toBeTruthy();
    expect(screen.getByText('サイト全体で共通の分析期間です。')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    fireEvent.click(screen.getByRole('tab', { name: /交通費入力/ }));
    await waitFor(() => expect(location).toContain('tab=transit'));
    expect(screen.getByRole('tab', { name: /交通費入力/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('領収書欄の代わりに freee への案内を出す', async () => {
    server();
    show();
    await screen.findByText('現金・交通費の明細がありません');
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(card('normal').getByText('領収書は freee に保管してください')).toBeTruthy();
  });
});

describe('読込・空・失敗の状態', () => {
  it('取得が終わるまでは読込中を出し、合計を出さない', async () => {
    server([entry()]);
    show();
    expect(screen.getByText('データを読み込み中…')).toBeTruthy();
    expect(screen.queryByRole('list', { name: '合計' })).toBeNull();
    expect(await screen.findByText('コピー用紙')).toBeTruthy();
  });

  it('一覧の取得に失敗したら文と再読込を出し、再読込で取り直す', async () => {
    let broken = true;
    server([entry()], (method, path) =>
      broken && method === 'GET' && path === '/cash-entries' ? fail(500, 'boom') : undefined,
    );
    show();
    expect((await screen.findByRole('alert')).textContent).toContain('現金明細を読み込めませんでした');
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: '再読込' }));
    expect(await screen.findByText('コピー用紙')).toBeTruthy();
  });

  it('対象期間の取得に失敗したら期間なしで一覧を読まず、期間から再読込する', async () => {
    let broken = true;
    const api = server([entry()], (method, path) =>
      broken && method === 'GET' && path === '/summary' ? fail(500, 'period unavailable') : undefined,
    );
    show();

    const period = within(screen.getByRole('complementary', { name: '対象期間' }));
    expect((await period.findByRole('alert')).textContent).toContain('対象期間を取得できませんでした');
    expect(api.calls.some((c) => c.path.startsWith('/cash-entries'))).toBe(false);

    broken = false;
    fireEvent.click(period.getByRole('button', { name: '対象期間を再読込' }));
    expect(await screen.findByText('コピー用紙')).toBeTruthy();
    expect(api.calls.some((c) => c.path === '/cash-entries?from=2026-07&to=2026-08')).toBe(true);
  });

  it('絞り込みの結果だけが 0 件なら空状態でなく「条件に合う明細がありません」を出し、条件をクリアで戻る', async () => {
    server([entry()]);
    show('/cash?month=2026-08&q=存在しない語');
    expect(await screen.findByText('条件に合う明細がありません')).toBeTruthy();
    expect(screen.queryByText('現金・交通費の明細がありません')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '条件をクリア' }));
    expect(await screen.findByText('コピー用紙')).toBeTruthy();
    expect(location).not.toContain('q=');
  });
});

describe('交通費の区間', () => {
  it('交通費カードだけで日付・事業個人・担当者・個人カテゴリを確認・変更できる', async () => {
    server();
    show('/cash?month=2026-08&tab=transit');
    await screen.findByText('現金・交通費の明細がありません');
    const t = card('transit');

    expect(t.getByLabelText(/^日付/)).toBeTruthy();
    expect(t.getByRole('group', { name: /事業 \/ 個人/ })).toBeTruthy();
    expect(t.getByLabelText(/^担当者/)).toBeTruthy();
    fireEvent.click(t.getByLabelText('個人'));
    expect(t.getByText('カテゴリ')).toBeTruthy();
  });

  it('入替で出発駅と到着駅を入れ替え、合計は往復 (既定) なら片道の 2 倍、外すと片道を出す', async () => {
    server();
    show('/cash?month=2026-08&tab=transit');
    await screen.findByText('現金・交通費の明細がありません');
    const from = card('transit').getByRole('textbox', { name: /^出発駅/ }) as HTMLInputElement;
    const to = card('transit').getByRole('textbox', { name: /^到着駅/ }) as HTMLInputElement;
    type(from, '架空駅A');
    type(to, '架空駅B');
    fireEvent.click(card('transit').getByRole('button', { name: '出発駅と到着駅を入れ替える' }));
    expect([from.value, to.value]).toEqual(['架空駅B', '架空駅A']);
    type(card('transit').getByLabelText(/^片道運賃/), '280');
    const total = card('transit').getByLabelText('合計金額（円）');
    expect(total.textContent).toBe('560');
    fireEvent.click(card('transit').getByLabelText('往復'));
    expect(total.textContent).toBe('280');
  });
});

describe('空の月', () => {
  it('「はじめての明細を入力」で日付欄へ移り、サンプルは合計に入らず操作できない', async () => {
    server();
    show('/cash?month=2026-08&tab=transit');
    await screen.findByText('現金・交通費の明細がありません');
    fireEvent.click(screen.getByRole('button', { name: 'はじめての明細を入力' }));
    await waitFor(() => expect(location).not.toContain('tab=transit'));
    expect(document.activeElement).toBe(card('normal').getByLabelText(/^日付/));

    fireEvent.click(screen.getByRole('button', { name: 'サンプルデータを表示' }));
    expect(await screen.findAllByText('サンプル')).not.toHaveLength(0);
    expect(screen.getByText('サンプルは合計に含まれません')).toBeTruthy();
    for (const b of screen.getAllByRole('button', { name: '編集' }))
      expect((b as HTMLButtonElement).disabled).toBe(true);
    const totals = within(screen.getByRole('list', { name: '合計' }));
    expect(totals.getAllByText('0 円')).toHaveLength(3);
  });
});

describe('追加', () => {
  it('通常入力を送ると日付・事業 / 個人・担当者を残して他を空にし、一覧を取り直す', async () => {
    const api = server();
    show();
    await screen.findByText('現金・交通費の明細がありません');
    const n = card('normal');
    type(n.getByLabelText(/^日付/), '2026-08-20');
    type(n.getByLabelText(/^金額（円）/), '3300');
    type(n.getByLabelText(/^内容・摘要/), '文房具');
    pickCategory('消耗品費');
    fireEvent.click(within(sticky()).getByRole('button', { name: 'この内容で現金明細を追加' }));

    await screen.findByText('文房具');
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/cash-entries');
    expect(post?.body).toMatchObject({
      date: '2026-08-20',
      side: 'biz',
      io: 'expense',
      amount: 3300,
      description: '文房具',
      big: '消耗品費',
      owner: 'business',
      receiptWaived: false,
    });
    expect((n.getByLabelText(/^日付/) as HTMLInputElement).value).toBe('2026-08-20');
    expect((n.getByLabelText(/^担当者/) as HTMLSelectElement).value).toBe('business');
    expect((n.getByLabelText(/^金額（円）/) as HTMLInputElement).value).toBe('');
    expect((n.getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('表示中と違う月に追加したら、その月へ移れる知らせを出す', async () => {
    server([entry()]);
    show();
    await screen.findByText('コピー用紙');
    const n = card('normal');
    type(n.getByLabelText(/^日付/), '2026-07-10');
    type(n.getByLabelText(/^金額（円）/), '500');
    type(n.getByLabelText(/^内容・摘要/), '切手');
    pickCategory('消耗品費');
    fireEvent.click(n.getByRole('button', { name: '現金明細を追加 →' }));

    fireEvent.click(await screen.findByRole('button', { name: 'その月を表示' }));
    await waitFor(() => expect(location).toContain('month=2026-07'));
    expect(await screen.findByText('切手')).toBeTruthy();
  });

  it('API の 400 は文をそのまま出し、入力を保持する', async () => {
    server([], (method, path) =>
      method === 'POST' && path === '/cash-entries' ? fail(400, '日付が期間の外です') : undefined,
    );
    show();
    await screen.findByText('現金・交通費の明細がありません');
    const n = card('normal');
    type(n.getByLabelText(/^金額（円）/), '800');
    type(n.getByLabelText(/^内容・摘要/), 'ペン');
    pickCategory('消耗品費');
    fireEvent.click(n.getByRole('button', { name: '現金明細を追加 →' }));
    expect((await n.findByRole('alert')).textContent).toBe('日付が期間の外です');
    expect((n.getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('ペン');
  });

  it('交通費は往復で片道の 2 倍を送り、証憑不要と業務の目的を付ける', async () => {
    const api = server();
    show('/cash?month=2026-08&tab=transit');
    await screen.findByText('現金・交通費の明細がありません');
    const t = card('transit');
    type(t.getByLabelText(/^出発駅 /), '名古屋');
    type(t.getByLabelText(/^到着駅/), '金山');
    type(t.getByLabelText(/^片道運賃（円）/), '280');
    type(t.getByLabelText(/^業務の目的/), '客先訪問');
    expect(t.getByLabelText('合計金額（円）').textContent).toBe('560');
    fireEvent.click(within(sticky()).getByRole('button', { name: 'この内容で交通費を追加' }));

    await waitFor(() => expect(api.live.size).toBe(1));
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/cash-entries');
    expect(post?.body).toMatchObject({
      amount: 560,
      big: '旅費交通費',
      transitFrom: '名古屋',
      transitTo: '金山',
      transitRound: true,
      receiptWaived: true,
      transitPurpose: '客先訪問',
    });
  });
});

describe('変更', () => {
  it('保存前の作成入力を、編集の取消後にそのまま戻す', async () => {
    server([entry()]);
    show();
    const n = card('normal');
    await screen.findByText('コピー用紙');
    type(n.getByLabelText(/^内容・摘要/), '作成途中の下書き');

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    type(n.getByLabelText(/^内容・摘要/), '編集中の値');
    fireEvent.click(n.getByRole('button', { name: '編集をやめる' }));

    expect((n.getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('作成途中の下書き');
  });

  it('保存済みの作成下書きを編集成功後に戻し、編集値で下書きを汚さない', async () => {
    server([entry()]);
    show();
    const n = card('normal');
    await screen.findByText('コピー用紙');
    type(n.getByLabelText(/^内容・摘要/), '次に追加する明細');
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toContain('次に追加する明細'));

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    type(n.getByLabelText(/^内容・摘要/), 'コピー用紙 A3');
    fireEvent.click(n.getByRole('button', { name: '変更を保存' }));

    expect(await screen.findByText('変更を保存しました。')).toBeTruthy();
    expect((n.getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('次に追加する明細');
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
    expect(localStorage.getItem(DRAFT_KEY)).toContain('次に追加する明細');
    expect(localStorage.getItem(DRAFT_KEY)).not.toContain('コピー用紙 A3');
  });

  it('送信元でないタブが選択中でも、入力エラーを送信元カードに出してそのタブへ移る', async () => {
    server();
    show();
    await screen.findByText('現金・交通費の明細がありません');

    fireEvent.click(card('transit').getByRole('button', { name: '交通費として追加 →' }));

    expect(card('transit').getByRole('alert')).toBeTruthy();
    expect(card('normal').queryByRole('alert')).toBeNull();
    await waitFor(() => expect(location).toContain('tab=transit'));
  });

  it('編集中に行が消えていたら文を出して編集をやめ、一覧を取り直す', async () => {
    const api = server([entry()], (method) => (method === 'PUT' ? fail(404, 'not found') : undefined));
    show();
    fireEvent.click(await screen.findByRole('button', { name: '編集' }));
    const n = card('normal');
    expect(n.getByRole('heading', { name: '現金明細の変更' })).toBeTruthy();
    const before = api.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/cash-entries')).length;
    fireEvent.click(n.getByRole('button', { name: '変更を保存' }));

    expect(await screen.findByText('この明細は削除されたか、見つかりません')).toBeTruthy();
    expect(n.getByRole('heading', { name: '現金明細の入力' })).toBeTruthy();
    await waitFor(() =>
      expect(
        api.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/cash-entries')).length,
      ).toBeGreaterThan(before),
    );
  });

  it('390pxで元タブと異なる明細の更新が404なら、元タブへ戻してエラーを見せる', async () => {
    const innerWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    try {
      server([entry()], (method) => (method === 'PUT' ? fail(404, 'not found') : undefined));
      show('/cash?month=2026-08&tab=transit');
      fireEvent.click(await screen.findByRole('button', { name: '編集' }));
      expect(screen.getByRole('tab', { name: /通常入力/ }).getAttribute('aria-selected')).toBe('true');

      fireEvent.click(card('normal').getByRole('button', { name: '変更を保存' }));

      await waitFor(() => expect(location).toContain('tab=transit'));
      expect(screen.getByRole('tab', { name: /交通費入力/ }).getAttribute('aria-selected')).toBe('true');
      expect(card('transit').getByRole('alert').textContent).toContain(
        'この明細は削除されたか、見つかりません',
      );
      expect(card('normal').queryByRole('alert')).toBeNull();
    } finally {
      innerWidth.mockRestore();
    }
  });

  it('保存に成功したら編集をやめ、変更した値が一覧に出る', async () => {
    server([entry()]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: '編集' }));
    const n = card('normal');
    type(n.getByLabelText(/^内容・摘要/), 'コピー用紙 A3');
    fireEvent.click(n.getByRole('button', { name: '変更を保存' }));
    expect(await screen.findByText('変更を保存しました。')).toBeTruthy();
    expect(await screen.findByText('コピー用紙 A3')).toBeTruthy();
    expect(n.getByRole('heading', { name: '現金明細の入力' })).toBeTruthy();
  });
});

describe('削除と元に戻す', () => {
  it('確認してから削除し、「元に戻す」で戻せる', async () => {
    const api = server([entry()]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    const dialog = within(screen.getByRole('alertdialog'));
    expect(dialog.getByText('この明細を削除しますか？')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: '削除する' }));

    expect(await screen.findByText('明細を削除しました。')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('コピー用紙')).toBeNull());
    expect(api.deleted.has(1)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('明細を元に戻しました。')).toBeTruthy();
    expect(await screen.findByText('コピー用紙')).toBeTruthy();
  });

  it('戻せなくなっていたら「この明細はもう戻せません」を出す', async () => {
    server([entry()], (method, path) => (path.endsWith('/restore') ? fail(404, 'gone') : undefined));
    show();
    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    fireEvent.click(await screen.findByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('この明細はもう戻せません')).toBeTruthy();
  });

  it('削除に失敗したら確認欄を開いたまま文を出す', async () => {
    server([entry()], (method) => (method === 'DELETE' ? fail(500, '保存できませんでした') : undefined));
    show();
    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toBeTruthy());
  });

  it('一括削除して、まとめて元に戻せる', async () => {
    const api = server([entry(), entry({ id: 2, description: '付箋', date: '2026-08-06' })]);
    show();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'このページをすべて選択' }));
    fireEvent.click(screen.getByRole('button', { name: '選択した 2 件を削除' }));
    expect(
      within(screen.getByRole('alertdialog')).getByText('選択した 2 件の明細を削除しますか？'),
    ).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    expect(await screen.findByText('2 件の明細を削除しました。')).toBeTruthy();
    expect(api.deleted.size).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    await waitFor(() => expect(api.live.size).toBe(2));
  });

  it('一括削除の 404 は取り直して選択を消す', async () => {
    server([entry(), entry({ id: 2, description: '付箋' })], (method, path) =>
      path === '/cash-entries/bulk-delete' ? fail(404, 'not found') : undefined,
    );
    show();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'このページをすべて選択' }));
    fireEvent.click(screen.getByRole('button', { name: '選択した 2 件を削除' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^選択した \d+ 件を削除$/ })).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('下書き', () => {
  it('入力の 500ms 後に利用者ごとに保存し、開き直すと戻る。クリアで消える', async () => {
    server();
    const first = show();
    await screen.findByText('現金・交通費の明細がありません');
    type(card('normal').getByLabelText(/^内容・摘要/), '下書きの摘要');
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toContain('下書きの摘要'), {
      timeout: 2_000,
    });
    first.unmount();

    show();
    await waitFor(() =>
      expect((card('normal').getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('下書きの摘要'),
    );
    expect(within(sticky()).getByText(/下書きが保存されています/)).toBeTruthy();

    fireEvent.click(card('normal').getByRole('button', { name: '両方の入力をクリア' }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect((card('normal').getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('');
  });

  it('編集中は下書きを保存しない', async () => {
    server([entry()]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: '編集' }));
    type(card('normal').getByLabelText(/^内容・摘要/), '編集中の値');
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('localStorage が例外を投げても画面を描き、入力とクリアを続けられる', async () => {
    const denied = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const spies = [
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied),
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied),
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied),
    ];
    try {
      server([entry()]);
      show();
      expect(await screen.findByText('コピー用紙')).toBeTruthy();
      type(card('normal').getByLabelText(/^内容・摘要/), '保存できない下書き');
      await act(() => new Promise((r) => setTimeout(r, 700)));
      expect(spies[1]!.mock.calls.length).toBeGreaterThan(0);
      expect((card('normal').getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe(
        '保存できない下書き',
      );
      fireEvent.click(card('normal').getByRole('button', { name: '両方の入力をクリア' }));
      expect((card('normal').getByLabelText(/^内容・摘要/) as HTMLInputElement).value).toBe('');
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('キーボード操作', () => {
  it('タブはネイティブのボタンで、フォーカスして押せる', async () => {
    server();
    show();
    const transit = screen.getByRole('tab', { name: /交通費入力/ });
    expect(transit.tagName).toBe('BUTTON');
    expect(transit.getAttribute('tabindex')).not.toBe('-1');
    transit.focus();
    expect(document.activeElement).toBe(transit);
    fireEvent.click(transit);
    await waitFor(() => expect(transit.getAttribute('aria-selected')).toBe('true'));
  });

  it('削除の確認を開くと「キャンセル」へフォーカスが移り、Escape で閉じる', async () => {
    const api = server([entry()]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    const dialog = screen.getByRole('alertdialog');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'キャンセル' })),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.deleted.size).toBe(0);
  });

  it('削除すると「元に戻す」へフォーカスが移る', async () => {
    server([entry()]);
    show();
    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    const undo = await screen.findByRole('button', { name: '元に戻す' });
    await waitFor(() => expect(document.activeElement).toBe(undo));
  });
});

describe('体裁', () => {
  it('コードポイント上限の絵文字を入力でき、超過分だけを切る', async () => {
    server();
    show();
    await screen.findByText('現金・交通費の明細がありません');
    const description = card('normal').getByLabelText(/^内容・摘要/) as HTMLInputElement;
    type(description, '😀'.repeat(61));
    expect([...description.value]).toHaveLength(60);
  });

  it('cash.css は色をトークンでだけ指定する (生の hex / rgb / hsl を持たない)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/pages/cash/cash.css'), 'utf8');
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
  });
});
