// @vitest-environment jsdom

/**
 * 明細の分割記帳の契約。
 *
 * ここで守りたいのは1つだけ: 合計が元の金額と合わないまま保存できないこと。
 * 合わない内訳が保存されると、集計は元の明細と内訳のどちらを数えるか決められず、
 * 二重計上か計上漏れのどちらかになる。
 *
 * 残額の表示も同じ理由で試験する。保存を押してから「合いません」と言われるのでは、
 * どの行をいくら直せばいいかが分からない。入力中ずっと見えている必要がある。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Candidates, SplitsResponse } from './api.js';
import { SplitEditor } from './components/SplitEditor.js';

const candidates = {
  biz: [{ name: '旅費交通費', mids: [], source: 'standard' }],
  per: [
    { name: '食費', mids: [{ name: '食料品', source: 'standard' }], source: 'standard' },
    { name: '日用品', mids: [], source: 'standard' },
  ],
} as unknown as Candidates;

const splits = (lines: SplitsResponse['lines'] = []): SplitsResponse => ({
  txId: 'A1',
  total: 100000,
  description: '架空銀行 引き落とし',
  date: '07/01',
  state: 'ready',
  constraints: { minLines: 2, maxLines: 50, memoMaxLength: 120 },
  lines,
});

/** PUT で受け取った本文を覚えておく(保存されたのが金額かどうかを見る) */
function mockFetch(initial: SplitsResponse, putError?: string) {
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        if (putError)
          return new Response(JSON.stringify({ error: { code: 'invalid_split', message: putError } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(initial), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return puts;
}

function renderEditor(onDirtyChange: (dirty: boolean) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SplitEditor
        txId="A1"
        candidates={candidates}
        defaultCls="per"
        defaultOwner={null}
        onClose={() => {}}
        onSaved={() => {}}
        onDirtyChange={onDirtyChange}
        onBusyChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

const saveButton = () => screen.getByRole('button', { name: '分割を保存' }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('明細の分割記帳', () => {
  it('元の金額と分けた合計が合わないうちは保存できない', async () => {
    mockFetch(splits());
    renderEditor();
    await screen.findByLabelText('1行目の金額');

    fireEvent.change(screen.getByLabelText('1行目の金額'), { target: { value: '30000' } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(/あと .*70,000/)).toBeTruthy();
  });

  it('はみ出しているときは、足りないときと違う言い方で知らせる', async () => {
    mockFetch(splits());
    renderEditor();
    await screen.findByLabelText('1行目の金額');

    fireEvent.change(screen.getByLabelText('1行目の金額'), { target: { value: '120000' } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(/はみ出しています/)).toBeTruthy();
  });

  it('「残りを入れる」で、他の行の合計との差額がその行に入る', async () => {
    mockFetch(splits());
    renderEditor();
    await screen.findByLabelText('1行目の金額');

    fireEvent.change(screen.getByLabelText('1行目の金額'), { target: { value: '30000' } });
    fireEvent.click(screen.getAllByRole('button', { name: '残りを入れる' })[1]);
    expect((screen.getByLabelText('2行目の金額') as HTMLInputElement).value).toBe('70000');
  });

  it('割合で入れても、保存されるのは金額のほう', async () => {
    const puts = mockFetch(splits());
    renderEditor();
    await screen.findByLabelText('1行目の金額');

    fireEvent.click(screen.getByRole('button', { name: /割合で入れる/ }));
    fireEvent.change(screen.getByLabelText('1行目の割合'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('2行目の割合'), { target: { value: '4' } });

    // 科目が入るまでは保存できない(未選択の行は集計に入らないため)
    expect(saveButton().disabled).toBe(true);
    pickCategory('食費');
    pickCategory('日用品');

    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    await waitFor(() => expect(puts).toHaveLength(1));

    const body = puts[0] as { lines: Array<{ amount: number; ratio?: number }> };
    expect(body.lines.map((l) => l.amount)).toEqual([60000, 40000]);
    expect(body.lines.every((l) => l.ratio === undefined)).toBe(true);
  });

  it('保存済みの内訳がある明細では、分割をやめる道を残す', async () => {
    const puts = mockFetch(
      splits([
        {
          lineId: '00000000-0000-4000-8000-000000000001',
          amount: 60000,
          cls: 'per',
          big: '食費',
          mid: '',
          owner: null,
          memo: '',
        },
        {
          lineId: '00000000-0000-4000-8000-000000000002',
          amount: 40000,
          cls: 'per',
          big: '日用品',
          mid: '',
          owner: null,
          memo: '',
        },
      ]),
    );
    renderEditor();
    await screen.findByLabelText('1行目の金額');

    fireEvent.click(screen.getByRole('button', { name: '分割をやめる' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ lines: [] });
  });

  it('内訳がまだ無い明細には、やめる選択肢を出さない', async () => {
    mockFetch(splits());
    renderEditor();
    await screen.findByLabelText('1行目の金額');
    expect(screen.queryByRole('button', { name: '分割をやめる' })).toBeNull();
  });

  it('draftの変更を既存の離脱ガードへ通知し、メモ上限を入力欄へ反映する', async () => {
    mockFetch(splits());
    const dirty = vi.fn();
    renderEditor(dirty);
    await screen.findByLabelText('1行目の金額');
    expect((screen.getByLabelText('1行目のメモ') as HTMLInputElement).maxLength).toBe(120);
    fireEvent.change(screen.getByLabelText('1行目の金額'), { target: { value: '1' } });
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
  });

  it('APIと共有した50行上限で追加を止める', async () => {
    const lines = Array.from({ length: 50 }, (_, index) => ({
      lineId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      amount: 2000,
      cls: 'per' as const,
      big: '食費',
      mid: '',
      owner: null,
      memo: '',
    }));
    mockFetch(splits(lines));
    renderEditor();
    await screen.findByLabelText('1行目の金額');
    expect((screen.getByRole('button', { name: /行を足す/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('保存失敗時はAPIの具体的な理由を表示する', async () => {
    mockFetch(splits(), '内訳が別の画面で更新されました');
    renderEditor();
    await screen.findByLabelText('1行目の金額');
    fireEvent.change(screen.getByLabelText('1行目の金額'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('2行目の金額'), { target: { value: '50000' } });
    pickCategory('食費');
    pickCategory('日用品');
    fireEvent.click(saveButton());
    expect(await screen.findByText('内訳が別の画面で更新されました')).toBeTruthy();
  });
});

/**
 * 科目は2クリック(分類タブ → 科目)で選ぶ。
 * 選び終えた行のボタンは科目名に変わるので、常に「まだ選んでいない先頭の行」を開く。
 */
function pickCategory(name: string) {
  fireEvent.click(screen.getAllByRole('button', { name: '科目を選ぶ' })[0]);
  fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name }));
}
