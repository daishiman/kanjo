// @vitest-environment jsdom

/**
 * 決算書画面の貸借対照表(BS)の表示契約。
 *
 * BSは資産だけ自動で入り、負債は手入力という非対称な作りになっている。
 * だから固定したいのは「入っていないものが、入っているように見えないこと」。
 *   - 必須の負債に未入力がある月は、負債合計と純資産に数字を出さない(資産だけで純資産を名乗らない)
 *   - どの月の残高かを列見出しで名指しし、月末前なら何日時点かを添える
 *   - 何も選んでいない任意項目は送らない(0円として保存しない)。0円は「0円」を選んだときだけ
 * 残高がまだ1件も無いときは、「何を取り込めば作れるか」を出す。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatementsResponse } from './api.js';
import { StatementsPage } from './pages/Statements.js';
import { liabilityLines, statementsPayload } from './test-support/statements-fixture.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).AccessibleChart,
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** PUTの本文を記録する。空欄を0円として送っていないかを見るため */
function renderWith(data: StatementsResponse = statementsPayload(), path = '/statements') {
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/me'))
        return json({ authenticated: true, user: { id: 'u1', email: 'owner@example.test' } });
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return json({ ok: true, bs: data.screen.bs });
      }
      return json(data);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StatementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return puts;
}

/** 行見出しから、その行のセルを取り出す */
const rowCells = (label: string) => {
  const table = screen.getByRole('table', { name: /末の貸借対照表/ });
  const head = within(table).getByRole('rowheader', { name: label });
  return [...(head.closest('tr')?.querySelectorAll('td') ?? [])].map((td) => td.textContent);
};

const form = () => screen.getByRole('form', { name: '負債残高の入力' });
const lineGroup = (label: RegExp) => within(form()).getByRole('group', { name: label });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('決算書のBS', () => {
  it('必須の負債に未入力がある月は、負債合計と純資産に数字を出さない', async () => {
    renderWith();
    await screen.findByRole('heading', { name: '貸借対照表（BS）' });
    // 未入力時は不完全な表や図を重ねず、ここで完了できる入力行動を主にする。
    expect(screen.queryByRole('table', { name: /末の貸借対照表/ })).toBeNull();
    expect(document.getElementById('bs')?.querySelector('.financial-figure')).toBeNull();
    expect(screen.getByRole('form', { name: '負債残高の入力' })).toBeTruthy();
    expect(screen.getByText('負債残高のデータが入力されていません。')).toBeTruthy();
  });

  it('必須がそろえば合計と純資産を出し、0円は 0 として足す', async () => {
    const data = statementsPayload();
    const lines = data.screen.bs.lines.map((line) =>
      line.category === 'クレジットカード未払金' ? { ...line, status: 'zero' as const, amount: 0 } : line,
    );
    renderWith(statementsPayload({ lines }));
    await screen.findByRole('heading', { name: '貸借対照表（BS）' });
    expect(rowCells('クレジット未払')).toEqual(['¥0']);
    expect(rowCells('負債合計')).toEqual(['¥2,300,000']);
    expect(rowCells('純資産')).toEqual(['¥2,700,000']);
  });

  it('基準月を列見出しで名指しし、月末前の月には何日時点かを添える', async () => {
    const lines = liabilityLines().map((line) =>
      line.category === 'クレジットカード未払金' ? { ...line, status: 'zero' as const, amount: 0 } : line,
    );
    renderWith(statementsPayload({ lines }));
    const august = await screen.findByRole('columnheader', { name: /2026年8月末/ });
    expect(august.textContent).toContain('2026-08-28時点');
  });

  it('月末に達している月には「時点」を付けない', async () => {
    const lines = liabilityLines().map((line) =>
      line.category === 'クレジットカード未払金' ? { ...line, status: 'zero' as const, amount: 0 } : line,
    );
    renderWith(statementsPayload({ lines, referenceMonth: '2026-07' }));
    const july = await screen.findByRole('columnheader', { name: /2026年7月末/ });
    expect(july.textContent).not.toContain('時点');
  });

  it('変更した項目だけを送り、保存済みの行と未選択の任意項目は送らない', async () => {
    const puts = renderWith();
    await screen.findByRole('form', { name: '負債残高の入力' });
    fireEvent.click(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' }));
    fireEvent.click(within(form()).getByRole('button', { name: '負債残高を保存' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      month: '2026-08',
      lines: [{ category: 'クレジットカード未払金', status: 'zero' }],
    });
  });

  it('必須項目を選ばないままでは保存させず、どの項目かを名指しする', async () => {
    const puts = renderWith();
    await screen.findByRole('form', { name: '負債残高の入力' });
    fireEvent.click(within(form()).getByRole('button', { name: '負債残高を保存' }));
    expect(await screen.findByText('クレジット未払の入力方法を選択してください。')).toBeTruthy();
    expect(puts).toHaveLength(0);
  });

  it('数字でない金額のままでは保存させない', async () => {
    const puts = renderWith();
    await screen.findByRole('form', { name: '負債残高の入力' });
    const group = lineGroup(/クレジット未払/);
    fireEvent.click(within(group).getByRole('radio', { name: '金額を入力' }));
    fireEvent.change(within(group).getByLabelText('クレジット未払の金額'), { target: { value: '3万' } });
    expect(within(group).getByText(/0 以上 1 兆円以下の整数/)).toBeTruthy();
    fireEvent.click(within(form()).getByRole('button', { name: '負債残高を保存' }));
    // 送信は同期で止まる。非同期の送信が紛れていないことも待って確かめる
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(puts).toHaveLength(0);
  });

  it('仕訳が無くても、資産の残高があれば BS を隠さない', async () => {
    renderWith(statementsPayload({ plMonths: [] }));
    await screen.findByText('この期間の取引がありません');
    expect(screen.getByRole('heading', { name: '貸借対照表（BS）' })).toBeTruthy();
    expect(screen.getByRole('form', { name: '負債残高の入力' })).toBeTruthy();
  });

  it('残高が1件も無いときは、表の図の代わりに取込元を出す', async () => {
    renderWith(statementsPayload({ plMonths: [], assets: [] }));
    await screen.findByText('資産の残高はまだ取り込まれていません');
    expect(screen.queryByRole('img', { name: /資産.*負債.*純資産/ })).toBeNull();
    // 書き出す場所は、探させずにそのまま開けるようにする
    const link = screen.getByRole('link', { name: 'https://moneyforward.com/bs/history' });
    expect(link.getAttribute('href')).toBe('https://moneyforward.com/bs/history');
  });

  it('基準月の負債がそろっていれば、資産と負債・純資産の図を出す', async () => {
    const lines = liabilityLines().map((line) =>
      line.category === 'クレジットカード未払金' ? { ...line, status: 'zero' as const, amount: 0 } : line,
    );
    renderWith(statementsPayload({ lines, referenceMonth: '2026-07' }));
    await screen.findByRole('heading', { name: '貸借対照表（BS）' });
    expect(screen.getByRole('img', { name: /資産.*負債.*純資産/ })).toBeTruthy();
  });
});
