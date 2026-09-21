// @vitest-environment jsdom

/**
 * 明細仕分け画面 (spec-classify-screen) の DOM 受入 (AT-01〜AT-10・AT-16〜AT-18・AT-21)。
 *
 * 置き換え前の画面は KPI も一括操作も分類ステータスの絞り込みも持たない。
 * このテストが旧 `pages/Classify.tsx` では落ちること自体が、契約が変わった証拠になる。
 * 併せて、旧テスト 8 本が守っていた契約 (削除→通知→元に戻す / 画面内 <dialog> での離脱確認 /
 * method クエリの付け外し / 全セル data-label / 名義は保存した表示名) をここへ引き継ぐ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassifyRow, ClassifyTransactionsResponse } from '../../api.js';
import { ClassifyPage } from './ClassifyPage.js';

/* -------- fixture -------- */

const crow = (over: Partial<ClassifyRow> & { id: string }): ClassifyRow => {
  const status = over.status ?? 'unsorted';
  return {
    idStable: true,
    date: '2026-08-03',
    description: '架空スーパー',
    payee: '架空スーパー',
    amount: -5440,
    institution: '架空銀行',
    instSrc: '取込値',
    csvInstitution: '架空銀行',
    paymentMethod: 'account',
    paymentMethodSource: '口座',
    csvBig: '食費',
    csvMid: '食料品',
    big: '',
    mid: '',
    catSrc: '取込値',
    cls: 'per',
    src: '既定',
    owner: null,
    ownerSrc: '既定',
    edited: false,
    conflict: false,
    origin: null,
    originKey: null,
    scopeMismatch: false,
    edit: null,
    suggestion: { cls: 'per', big: '食費', mid: '食料品', owner: null },
    suggestionLabel: '食費 / 食料品',
    confidence: 92,
    basis: 'mf_mid',
    basisText: 'MF の中項目「食料品」から導きました。',
    status,
    needsReview: over.needsReview ?? false,
    reviewReasons: over.reviewReasons ?? [],
    note: null,
    ...over,
    rowKey: over.rowKey ?? `mf:${over.id}`,
    rowKind: over.rowKind ?? 'mf',
    parentTxId: over.parentTxId ?? null,
    lineId: over.lineId ?? null,
    splitSeq: over.splitSeq ?? null,
    splitLineCount: over.splitLineCount ?? null,
    splitState: over.splitState ?? null,
    capabilities: over.capabilities ?? { quickClass: true, edit: true, split: true },
  };
};

const response = (rows: ClassifyRow[], over: Partial<ClassifyTransactionsResponse> = {}) =>
  ({
    months: ['2025-09', '2026-08'],
    month: '2026-08',
    period: { from: '2025-09', to: '2026-08' },
    summary: {
      month: '2026-08',
      count: rows.length,
      totalIncome: 0,
      bizIncome: 0,
      personalIncome: 0,
      totalExpense: 0,
      bizExpense: 0,
      personalExpense: 0,
      incomeByOwner: { business: 0, spouse: 0, family: 0, unset: 0 },
      progress: {
        total: rows.length,
        bizCount: 0,
        personalCount: rows.length,
        bySource: { 手動: 0, ルール: 0, 中項目: 0, 既定: rows.length },
        reviewPending: rows.length,
      },
      editedCount: 0,
      conflictCount: 0,
      noInstitutionCount: 0,
      nonCountableCount: 0,
    },
    transactions: rows,
    rows,
    total: rows.length,
    page: 1,
    limit: 50,
    kpi: { all: 1039, unsorted: 12, review: 4, manual: 3, done: 1024 },
    candidates: { biz: [], per: [] },
    institutions: ['架空銀行'],
    ...over,
  }) as unknown as ClassifyTransactionsResponse;

/* -------- fetch のモック -------- */

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];
let routes: Record<string, (call: Call) => unknown>;

/** URL とメソッドから応答を選ぶ。未登録の GET は空の一覧を返す */
function install(rows: ClassifyRow[], extra: Record<string, (call: Call) => unknown> = {}) {
  routes = extra;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const call: Call = { url, method, body };
      calls.push(call);
      const key = Object.keys(routes).find(
        (k) => url.includes(k) && (k.includes(' ') ? true : method === 'GET'),
      );
      const matched = Object.entries(routes).find(([k]) => {
        const [m, p] = k.includes(' ') ? k.split(' ') : ['GET', k];
        return m === method && url.includes(p);
      });
      const payload = matched
        ? matched[1](call)
        : url.includes('/settings/owner-labels')
          ? { labels: { business: '事業主', spouse: '妻', family: '子', unset: '共通' } }
          : url.includes('/rules')
            ? { rules: [], usingDefaults: false }
            : url.includes('/saved-filters')
              ? { items: [] }
              : url.includes('/history')
                ? { items: [] }
                : response(rows);
      void key;
      if (payload instanceof Response) return payload;
      return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

function renderAt(path = '/classify') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ClassifyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastGetUrl = () =>
  [...calls].reverse().find((c) => c.method === 'GET' && c.url.includes('/transactions'))?.url;

beforeEach(() => {
  calls = [];
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* -------- AT-01・AT-02・AT-18 -------- */

describe('見出しと KPI', () => {
  it('AT-01 見出し・問い・説明文 2 行・使い方の導線が出る', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    expect(await screen.findByRole('heading', { name: '明細仕分け', level: 1 })).toBeTruthy();
    expect(screen.getByText('未整理の明細を、根拠を見ながら確定しますか？')).toBeTruthy();
    expect(screen.getByText('取引明細を確認し、適切な区分・カテゴリに仕分けて確定しましょう。')).toBeTruthy();
    expect(screen.getByText('自動提案を参考にしながら、必要に応じて手動で変更できます。')).toBeTruthy();
    expect(screen.getByText('明細仕分けの使い方')).toBeTruthy();
  });

  it('AT-02 KPI 4 枚が件数付きで出る。要確認に「未整理のうち」が添う', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    for (const [label, value] of [
      ['未整理', '12件'],
      ['要確認', '4件'],
      ['手動変更', '3件'],
      ['完了', '1,024件'],
    ]) {
      const card = screen.getByText(label).closest('.kpi');
      expect(card).toBeTruthy();
      expect(card?.textContent).toContain(value);
    }
    expect(screen.getByText('要確認').closest('.kpi')?.textContent).toContain('未整理のうち');
  });

  it('AT-02 KPI を押すとそのステータスだけに絞る', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    fireEvent.click(screen.getByRole('button', { name: /完了/ }));
    await waitFor(() => expect(lastGetUrl()).toContain('status=done'));
    expect(lastGetUrl()).not.toContain('unsorted');
  });

  it('AT-18 4 つの分類ステータスが件数と文言で見分けられる', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    // 色 (is-active のクラス) を見ずに、ラベルと件数だけで 4 枚を区別できること
    const cards = Array.from(document.querySelectorAll('.classify-kpis .kpi-content')).map(
      (el) => el.textContent,
    );
    expect(cards).toEqual(['未整理12件', '要確認4件', '手動変更3件', '完了1,024件']);

    const panel = screen.getByRole('region', { name: '絞り込み' });
    const checks = within(panel)
      .getAllByRole('checkbox')
      .slice(0, 4)
      .map((el) => el.getAttribute('aria-label') ?? el.closest('label')?.textContent?.trim());
    expect(checks).toEqual(['未整理 12件', '要確認 4件', '手動変更 3件', '完了 1,024件']);
  });

  it('AT-18 信頼度が数値と文言で区別される (色だけに頼らない)', async () => {
    const rows = [
      crow({ id: 'A1' }),
      crow({ id: 'A2', confidence: 68, needsReview: true, reviewReasons: ['low_confidence'] }),
      crow({
        id: 'A3',
        status: 'manual',
        big: '交際費',
        mid: '会議費',
        confidence: null,
        suggestion: { cls: null, big: null, mid: null, owner: null },
        suggestionLabel: '',
      }),
      crow({ id: 'A4', status: 'done' }),
    ];
    install(rows);
    renderAt();
    await screen.findByText('取引一覧（4件）');
    // 4 行ぶんを字面で固定する。要確認だけが文言を併記し、提案なしは 0% ではなく「—」になる
    const cells = Array.from(document.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelector('td[data-label="信頼度"]')?.textContent,
    );
    expect(cells).toEqual(['92%', '68%要確認', '—', '92%']);
  });

  it('AT-18 画面に「AI」の文字列が無い', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    expect(document.body.textContent).not.toContain('AI');
  });
});

/* -------- AT-03 -------- */

describe('絞り込み (左パネル)', () => {
  it('AT-03 全項目が出る', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    const panel = screen.getByRole('region', { name: '絞り込み' });
    const q = within(panel);
    expect(q.getByText('対象月')).toBeTruthy();
    expect(q.getByText('2025年9月 - 2026年8月')).toBeTruthy();
    expect(q.getByText('分類ステータス')).toBeTruthy();
    // 件数付きで照合する。「手動変更」だけで探すと「手動変更された明細のみ」にも当たる
    for (const name of ['未整理', '要確認', '手動変更', '完了']) {
      expect(q.getByRole('checkbox', { name: new RegExp(`^${name} [\\d,]+件$`) })).toBeTruthy();
    }
    expect(q.getByLabelText('カテゴリ')).toBeTruthy();
    expect(q.getByLabelText('所有者')).toBeTruthy();
    expect(q.getByLabelText('支払い方法')).toBeTruthy();
    expect(q.getByRole('checkbox', { name: '手動変更された明細のみ' })).toBeTruthy();
    expect(q.getByPlaceholderText('取引先名・内容・メモで検索')).toBeTruthy();
    expect(q.getByText('保存したフィルタ')).toBeTruthy();
    expect(q.getByRole('button', { name: '＋ 現在の条件を保存' })).toBeTruthy();
    expect(q.getByRole('button', { name: 'フィルタをクリア' })).toBeTruthy();
  });

  it('AT-03 折りたたみで中身が閉じ、もう一度押すと開く', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    const panel = screen.getByRole('region', { name: '絞り込み' });
    const collapse = within(panel).getByRole('button', { name: '絞り込みを折りたたむ' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(within(panel).getByText('対象月')).toBeTruthy();

    fireEvent.click(collapse);
    // 閉じたら中身ごと消えること。見えたまま押せなくなるだけでは、狭い画面で場所を空けられない
    expect(within(panel).queryByText('対象月')).toBeNull();
    expect(within(panel).queryAllByRole('checkbox')).toEqual([]);
    const reopen = within(panel).getByRole('button', { name: '絞り込みを開く' });
    expect(reopen.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(reopen);
    expect(within(panel).getByText('対象月')).toBeTruthy();
    expect(within(panel).queryAllByRole('checkbox').length).toBe(5);
  });

  it('AT-03 1023px 以下では絞り込みが閉じた状態で始まる', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 1023px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('取引一覧（1件）');

    const panel = screen.getByRole('region', { name: '絞り込み' });
    const reopen = within(panel).getByRole('button', { name: '絞り込みを開く' });
    expect(reopen.getAttribute('aria-expanded')).toBe('false');
    expect(within(panel).queryByText('対象月')).toBeNull();
  });

  it('カテゴリの既定選択肢を重複表示しない', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('取引一覧（1件）');
    const category = screen.getByLabelText('カテゴリ');
    expect(within(category).getAllByRole('option', { name: 'すべてのカテゴリ' })).toHaveLength(1);
  });

  it('分類ステータスの最後の 1 つは外せない', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    const unsorted = screen.getByRole('checkbox', { name: /未整理/ }) as HTMLInputElement;
    expect(unsorted.checked).toBe(true);
    fireEvent.click(unsorted);
    await waitFor(() => expect(unsorted.checked).toBe(true));
  });

  it('支払い方法を選ぶと method クエリが付き、戻すと外れる', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('1,024件');
    fireEvent.change(screen.getByLabelText('支払い方法'), { target: { value: 'cash' } });
    await waitFor(() => expect(lastGetUrl()).toContain('method=cash'));
    fireEvent.change(screen.getByLabelText('支払い方法'), { target: { value: '' } });
    await waitFor(() => expect(lastGetUrl()).not.toContain('method='));
  });
});

/* -------- AT-04・AT-05 -------- */

describe('取引一覧', () => {
  it('AT-04 件数見出し・表示件数・6 列・全選択が出る', async () => {
    install([crow({ id: 'A1' })], { '/transactions': () => response([crow({ id: 'A1' })], { total: 51 }) });
    renderAt();
    expect(await screen.findByText('取引一覧（51件）')).toBeTruthy();
    expect(screen.getByText('表示件数 50件')).toBeTruthy();
    const headers = Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers.slice(1)).toEqual(['日付', '取引先', '内容', '金額', '提案カテゴリ', '信頼度']);
    expect(screen.getByRole('checkbox', { name: '表示中の明細をすべて選択' })).toBeTruthy();
    expect(screen.getByText('全51件')).toBeTruthy();
  });

  it('AT-04 2 ページ目を要求すると page=2 が付く', async () => {
    install([crow({ id: 'A1' })], { '/transactions': () => response([crow({ id: 'A1' })], { total: 51 }) });
    renderAt();
    await screen.findByText('取引一覧（51件）');
    fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
    await waitFor(() => expect(lastGetUrl()).toContain('page=2'));
  });

  it('AT-05 未整理の行に提案カテゴリと信頼度が出る。要確認は文言も併記する', async () => {
    const rows = [
      crow({ id: 'A1' }),
      crow({ id: 'A2', confidence: 68, needsReview: true, reviewReasons: ['low_confidence'] }),
    ];
    install(rows);
    renderAt();
    await screen.findByText('取引一覧（2件）');
    expect(screen.getAllByText('食費 / 食料品').length).toBeGreaterThan(0);
    expect(screen.getByText('92%')).toBeTruthy();
    const reviewCell = screen.getByText('68%').closest('td');
    expect(reviewCell?.textContent).toContain('要確認');
  });

  it('スマホ用に全セルが data-label を持つ', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('取引一覧（1件）');
    const cells = Array.from(document.querySelectorAll('tbody td'));
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('data-label')).toBeTruthy();
    const table = document.querySelector('.classify-transactions');
    expect(table?.parentElement?.classList.contains('classify-table-scroll')).toBe(true);
  });
});

/* -------- AT-06 -------- */

describe('編集パネル', () => {
  const open = async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('取引一覧（1件）');
    fireEvent.click(screen.getByText('架空スーパー', { selector: 'td[data-label="内容"] *' }));
    return screen.findByRole('heading', { name: '取引の編集' });
  };

  it('AT-06 §7.6 の欄が揃い、証憑の部品が無い', async () => {
    await open();
    for (const label of [
      'クイック仕分け',
      'カテゴリ',
      '所有者',
      '支払い方法',
      'メモ',
      '取引の履歴',
      '信頼度の根拠',
      'この条件をルールにする',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('証憑は freee 側で管理します')).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(
      screen.getByText('提案どおりに確定すると完了、提案と異なる値で確定すると手動変更になります。'),
    ).toBeTruthy();
    expect(screen.getByText('この内容で保存すると完了になります。')).toBeTruthy();
  });

  it('AT-16 未保存のまま閉じようとすると確認が出る (画面内の dialog)', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '確認用' } });
    await screen.findByText('● 未保存');
    fireEvent.click(screen.getByRole('button', { name: '編集を閉じる' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('保存していない変更があります。このまま移動しますか？');
    expect(within(dialog).getByRole('button', { name: '移動する' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'とどまる' })).toBeTruthy();
  });

  it('AT-16 入力から 1 秒後に下書きが保存され、時刻付きの文言が出る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '下書き' } });
    await vi.advanceTimersByTimeAsync(1100);
    expect(await screen.findByText(/下書きを自動保存しました \d{2}:\d{2}/)).toBeTruthy();
    expect(localStorage.getItem('kanjo:classify:draft:A1')).toContain('下書き');
  });

  // EditPanel は `key={open.rowKey}` で明細ごとに作り直されるので、下書きを読むのは
  // 開き直しの分岐 (openedId !== row.id) ではなく useState の初期化でなければ間に合わない
  it('AT-16 再読込後に同じ明細を開くと「下書きを復元」で戻る', async () => {
    // 再読込のあとを写す。画面の state は消えていて、残っているのは localStorage だけ
    localStorage.setItem(
      'kanjo:classify:draft:A1',
      JSON.stringify({
        txId: 'A1',
        input: {
          cls: 'per',
          big: '食費',
          mid: '食料品',
          owner: null,
          paymentMethod: null,
          note: '再読込前のメモ',
        },
        savedAt: Date.now(),
      }),
    );
    await open();
    expect((screen.getByLabelText('メモ') as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(await screen.findByRole('button', { name: '下書きを復元' }));
    expect((screen.getByLabelText('メモ') as HTMLTextAreaElement).value).toBe('再読込前のメモ');
  });

  it('AT-16 保存に成功すると下書きが消える', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '保存する下書き' } });
    await vi.advanceTimersByTimeAsync(1100);
    expect(localStorage.getItem('kanjo:classify:draft:A1')).toContain('保存する下書き');

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/transactions/A1/edit'))).toBe(true),
    );
    // 残ったままだと、保存済みの明細を開くたびに古い下書きの復元を勧めてしまう
    await waitFor(() => expect(localStorage.getItem('kanjo:classify:draft:A1')).toBeNull());
    expect(screen.queryByText(/下書きを自動保存しました/)).toBeNull();
  });

  it('AT-16 保存に失敗したら下書きは残る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    install([crow({ id: 'A1' })], {
      'PUT /transactions/A1/edit': () =>
        new Response(JSON.stringify({ error: { code: 'internal', message: '保存できません' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    renderAt();
    await screen.findByText('取引一覧（1件）');
    fireEvent.click(screen.getByText('架空スーパー', { selector: 'td[data-label="内容"] *' }));
    await screen.findByRole('heading', { name: '取引の編集' });
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '消えては困る下書き' } });
    await vi.advanceTimersByTimeAsync(1100);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/transactions/A1/edit'))).toBe(true),
    );
    await vi.advanceTimersByTimeAsync(50);
    // 保存を待たずに消していた頃は、通信が落ちた保存で手入力ごと消えて戻せなかった (UC-8-2・FR-17)
    expect(localStorage.getItem('kanjo:classify:draft:A1')).toContain('消えては困る下書き');
  });
});

/* -------- AT-07・AT-08 -------- */

describe('一括保存', () => {
  const select = async () => {
    const rows = [crow({ id: 'A1' }), crow({ id: 'A2' }), crow({ id: 'A3' })];
    install(rows, {
      'POST /transactions/bulk': () => ({
        opId: 'op1',
        saved: 2,
        failed: 1,
        results: [
          { txId: 'A1', ok: true },
          { txId: 'A2', ok: true },
          { txId: 'A3', ok: false, error: { code: 'invalid_body', message: 'カテゴリが不正です' } },
        ],
      }),
    });
    renderAt();
    await screen.findByText('取引一覧（3件）');
    fireEvent.click(screen.getByRole('checkbox', { name: '表示中の明細をすべて選択' }));
    return rows;
  };

  it('AT-07 一括操作バーが出る', async () => {
    await select();
    expect(await screen.findByText('3 件選択中')).toBeTruthy();
    expect(screen.getByRole('button', { name: '選択をクリア' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '選択した3件を保存' })).toBeTruthy();
  });

  it('AT-08 部分失敗の通知が出て、再試行は失敗の 1 件だけを送る', async () => {
    await select();
    fireEvent.click(await screen.findByRole('button', { name: '選択した3件を保存' }));
    expect(
      await screen.findByText('選択した3件のうち2件を保存しました。1件はエラーのため保存できませんでした。'),
    ).toBeTruthy();
    const retry = screen.getByRole('button', { name: '失敗した1件のみ再試行' });
    fireEvent.click(retry);
    await waitFor(() => {
      const posts = calls.filter((c) => c.method === 'POST' && c.url.includes('/transactions/bulk'));
      expect(posts.length).toBe(2);
      expect((posts[1].body as { items: { txId: string }[] }).items.map((i) => i.txId)).toEqual(['A3']);
    });
  });

  it('通信が全失敗しても選択と元のpayloadを保ち、同じ内容で再試行する', async () => {
    const rows = [crow({ id: 'A1' }), crow({ id: 'A2' })];
    let attempts = 0;
    install(rows, {
      'POST /transactions/bulk': () => {
        attempts += 1;
        throw new Error('synthetic network failure');
      },
    });
    renderAt();
    await screen.findByText('取引一覧（2件）');
    fireEvent.click(screen.getByRole('checkbox', { name: '表示中の明細をすべて選択' }));
    fireEvent.click(screen.getByRole('button', { name: '選択した2件を保存' }));
    expect(await screen.findByText('選択した2件を保存できませんでした。')).toBeTruthy();
    expect(await screen.findByText('2 件選択中')).toBeTruthy();

    const first = calls.find((call) => call.method === 'POST' && call.url.includes('/transactions/bulk'));
    fireEvent.click(screen.getByRole('button', { name: '失敗した2件のみ再試行' }));
    await waitFor(() => expect(attempts).toBe(2));
    const posts = calls.filter((call) => call.method === 'POST' && call.url.includes('/transactions/bulk'));
    expect(posts[1].body).toEqual(first?.body);
  });
});

describe('選択・編集対象のURL正本', () => {
  it('sel/txから選択と右編集を復元する', async () => {
    install([crow({ id: 'A1' })]);
    renderAt('/classify?sel=mf%3AA1&tx=mf%3AA1');
    await screen.findByRole('heading', { name: '取引の編集' });
    expect(
      (screen.getByRole('checkbox', { name: /A1|2026\/08\/03 架空スーパー/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText('1 件選択中')).toBeTruthy();
  });
});

/* -------- AT-10 -------- */

describe('分割明細の編集', () => {
  /** 12,000 円の明細を開き、分割パネルまで進める。spec 7.9 の文言は金額に依存する */
  const openSplit = async () => {
    install([crow({ id: 'S1', amount: -12000, description: '架空家電', payee: '架空家電' })], {
      'GET /splits': () => ({
        txId: 'S1',
        total: 12000,
        description: '架空家電',
        date: '2026-08-03',
        state: 'ready',
        constraints: { minLines: 2, maxLines: 20, memoMaxLength: 100 },
        lines: [],
      }),
    });
    renderAt();
    await screen.findByText('取引一覧（1件）');
    fireEvent.click(screen.getByText('架空家電', { selector: 'td[data-label="内容"] *' }));
    await screen.findByRole('heading', { name: '取引の編集' });
    fireEvent.click(screen.getByRole('button', { name: '分割' }));
    return screen.findByRole('region', { name: '分割明細の編集' });
  };

  it('AT-10 §7.9 の一致の文言が完全一致で出て、不一致では保存を押せない', async () => {
    const panel = await openSplit();
    const amounts = () => within(panel).getAllByLabelText('金額');
    const save = () => within(panel).getByRole('button', { name: '分割を保存' });

    // 入れ終える前は不一致。合計が合っていないのに保存できると、元の金額と内訳がずれたまま残る
    expect(save().hasAttribute('disabled')).toBe(true);

    fireEvent.change(amounts()[0], { target: { value: '8000' } });
    fireEvent.change(amounts()[1], { target: { value: '4000' } });
    expect(
      within(panel).getByText('金額の合計が元の取引金額と一致しています。(8,000円 + 4,000円 = 12,000円)'),
    ).toBeTruthy();
    expect(save().hasAttribute('disabled')).toBe(false);

    fireEvent.change(amounts()[1], { target: { value: '3000' } });
    expect(within(panel).getByText(/差額 1,000円/)).toBeTruthy();
    expect(save().hasAttribute('disabled')).toBe(true);
  });
});

/* -------- AT-11 -------- */

describe('ルール適用プレビュー', () => {
  it('AT-11 §7.10 の件数・表・注意文が出て、適用の要求が期間と指紋を運ぶ', async () => {
    install([crow({ id: 'R1' })], {
      'POST /rules/preview': () => ({
        fingerprint: 'fp-rule-1',
        count: 3,
        omitted: 1,
        rows: [
          {
            txId: 'R1',
            date: '2026-08-03',
            payee: '架空スーパー',
            description: '架空スーパー',
            amount: -5440,
            after: [{ label: '会議費 / 打合せ', amount: 5440 }],
          },
        ],
      }),
      'POST /rules/apply': () => ({ applied: 3 }),
    });
    renderAt();
    await screen.findByText('取引一覧（1件）');
    fireEvent.click(screen.getByText('架空スーパー', { selector: 'td[data-label="内容"] *' }));
    await screen.findByRole('heading', { name: '取引の編集' });
    fireEvent.click(screen.getByRole('button', { name: 'ルールを作成' }));

    const panel = await screen.findByRole('region', { name: 'ルールの影響プレビュー' });
    expect(await within(panel).findByText('今後 3 件に適用')).toBeTruthy();
    expect(within(panel).getByText('→ 会議費 / 打合せ')).toBeTruthy();
    expect(within(panel).getByText('ほか 1 件')).toBeTruthy();
    expect(
      within(panel).getByText('上記の 3 件の取引に対して、同じ仕分けを自動で適用できます。'),
    ).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'ルールを作成して適用' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/rules/apply'))).toBe(true));
    // 指紋を運ばないと、プレビュー以降に対象が変わっても気づけないまま書き換わる
    const applyCall = calls.find((c) => c.url.includes('/rules/apply'));
    expect(applyCall?.body).toMatchObject({
      fingerprint: 'fp-rule-1',
      from: '2025-09',
      to: '2026-08',
      rule: expect.objectContaining({ keyword: '架空スーパー' }),
    });
  });
});

/* -------- AT-09 -------- */

describe('削除と取消', () => {
  it('AT-09 削除すると通知が出て、元に戻すと一覧へ戻る', async () => {
    const counts = { mfTx: 1, freeeDeals: 0, balanceEntries: 0 };
    const all = [crow({ id: 'A1' }), crow({ id: 'A2', description: '架空書店', payee: '架空書店' })];
    // 削除の前後で一覧の中身を変える。通知の文言だけを見ても、行が戻ったかは分からない
    let removed = false;
    install(all, {
      '/transactions': () => {
        const rows = removed ? all.slice(1) : all;
        return response(rows, { total: rows.length });
      },
      'POST /data/deletions/preflight': () => ({
        fingerprint: 'fp1',
        counts,
        months: ['2026-08'],
        granularity: 'transaction',
      }),
      'POST /data/deletions': () => {
        removed = true;
        return { operationId: 'op-del-1', counts, expiresAt: '2026-10-20T00:00:00.000Z' };
      },
      'POST /data/undo/op-del-1': () => {
        removed = false;
        return { ok: true, restored: counts };
      },
    });
    renderAt();
    await screen.findByText('取引一覧（2件）');
    const deletedRow = () => screen.queryByText('架空スーパー', { selector: 'td[data-label="内容"] *' });
    fireEvent.click(deletedRow() as HTMLElement);
    await screen.findByRole('heading', { name: '取引の編集' });
    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この明細を消す' }));
    expect(await screen.findByText('1件の明細を削除しました。')).toBeTruthy();
    // 先に消えたことを確かめる。消えていなければ「戻った」も確かめようがない
    await waitFor(() => expect(deletedRow()).toBeNull());
    expect(screen.getByText('取引一覧（1件）')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('削除を元に戻しました。')).toBeTruthy();
    await waitFor(() => expect(deletedRow()).not.toBeNull());
    expect(screen.getByText('取引一覧（2件）')).toBeTruthy();
  });
});

/* -------- AT-17 -------- */

describe('画面の状態', () => {
  it('AT-17 期間内 0 件は空の文言を出す', async () => {
    install([], {
      '/transactions': () =>
        response([], { total: 0, kpi: { all: 0, unsorted: 0, review: 0, manual: 0, done: 0 } }),
    });
    renderAt();
    expect(await screen.findByText('この期間の明細はありません。')).toBeTruthy();
  });

  it('AT-17 絞り込み結果 0 件は一覧の位置に文言とクリアを出す', async () => {
    install([], { '/transactions': () => response([], { total: 0 }) });
    renderAt();
    expect(await screen.findByText('条件に合う明細はありません。')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'フィルタをクリア' }).length).toBeGreaterThan(0);
  });

  it('AT-17 取得に失敗したら失敗の文言を出す', async () => {
    install([], {
      '/transactions': () =>
        new Response(JSON.stringify({ error: { code: 'error', message: 'だめ' } }), { status: 500 }),
    });
    renderAt();
    expect(await screen.findByText('明細を読み込めませんでした。')).toBeTruthy();
  });

  it('明細を選んでいないときの案内が出る', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    expect(await screen.findByText('明細を選ぶと、ここで編集できます。')).toBeTruthy();
  });
});

/* -------- AT-21 -------- */

describe('外部への送信', () => {
  it('AT-21 fetch の宛先が同じオリジンの /api だけである', async () => {
    install([crow({ id: 'A1' })]);
    renderAt();
    await screen.findByText('取引一覧（1件）');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.url.startsWith('/api')).toBe(true);
  });
});
