// @vitest-environment jsdom

/**
 * 受入A7「一覧表の 9 列すべてが常時表示される」の画面契約。
 *
 * 実装より先に書く赤いテスト (SYS-TCF-P04)。実装は SYS-TCF-P05 以降。
 * 受入とテストの対応表は `packages/core/test/total-cashflow-contract.test.ts` の冒頭にある。
 *
 * CI の headless Chrome は `pointer: none` である。表示条件を `@media (pointer: fine)` へ
 * 依存させないため、ここでは列の増減をポインタ種別に紐付けた検査を書かない。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TotalCashflowReview } from '../src/api.js';
import { TotalCashflowPage, TotalCashflowTable } from '../src/pages/analysis/TotalCashflow.js';

/** 一覧表の列見出し。9 列で確定しており、小画面でも落とさない */
const COLUMNS = [
  '月',
  '総収入',
  '総支出',
  '総収支',
  '事業費',
  '家計費',
  '事業費へ寄せた件数',
  '要確認件数',
  'トレンド',
];

const row = (over: Record<string, unknown> = {}) => ({
  month: '2026-08',
  totalIncome: 250_000,
  totalExpense: 8_300,
  totalBalance: 241_700,
  bizExpense: 3_300,
  householdExpense: 5_000,
  bizIncome: 200_000,
  householdIncome: 50_000,
  shiftedCount: 1,
  shiftedAmount: 3_300,
  reviewCount: 0,
  trend: '判定不可' as const,
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * `/total-cashflow` の応答一式。matched / freeeOnly / excluded / coverage は
 * 「freee 全件がどこへ行ったか」を答えるために常に返る。省略できる形にすると、
 * 画面が欠けた応答でも動いてしまい、抜け漏れの検査にならない。
 */
const payload = (over: Record<string, unknown> = {}) => ({
  months: [row()],
  review: [],
  matched: [],
  freeeOnly: [],
  excluded: [],
  coverage: { freeeTotal: 0, matched: 0, freeeOnly: 0, excluded: 0, mfReview: 0 },
  ...over,
});

function wrap(node: ReactNode) {
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

describe('受入A7 一覧表の 9 列が常時表示される', () => {
  it('見出しが 9 列ちょうどで、順序も固定である', async () => {
    render(<TotalCashflowTable rows={[row()]} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(9);
    expect(headers.map((cell) => cell.textContent)).toEqual(COLUMNS);
  });

  it('行が 1 件でも 3 件でも列は 9 のままで、行ごとのセルも 9 個ある', async () => {
    const { rerender } = render(<TotalCashflowTable rows={[row()]} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);

    rerender(
      <TotalCashflowTable
        rows={[row({ month: '2026-06' }), row({ month: '2026-07' }), row({ month: '2026-08' })]}
      />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);

    const bodyRows = screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(bodyRows).toHaveLength(3);
    for (const bodyRow of bodyRows) {
      expect(within(bodyRow).getAllByRole('cell')).toHaveLength(9);
    }
  });

  it('表を横スクロール領域に収め、列を落とす分岐を持たない', async () => {
    const { container } = render(<TotalCashflowTable rows={[row()]} />);
    const table = screen.getByRole('table');
    expect(table.closest('[data-total-cashflow-scroll]')).not.toBeNull();
    // 列を隠すための hidden 属性が 1 つも無いこと
    expect(container.querySelectorAll('th[hidden], td[hidden]')).toHaveLength(0);
  });

  it('記帳月数が足りない期間ではトレンド列に「判定不可」を明示し、空欄にしない', async () => {
    render(<TotalCashflowTable rows={[row({ trend: '判定不可' })]} />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(9);
    expect(cells[8]!.textContent).toBe('判定不可');
  });

  it('サーバ導出値をそのまま写し、画面側で合計を計算し直さない', async () => {
    // 総収支がサーバ側の値と食い違っていても、画面は自分で計算し直さない。
    // ここが再計算されると、どちらが正しいかを利用者が判断できなくなる。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(payload({ months: [row({ totalBalance: 999 })] }))),
    );
    wrap(<TotalCashflowPage />);

    expect(await screen.findByText('999')).toBeTruthy();
    expect(screen.queryByText('241,700')).toBeNull();
  });
});

describe('受入F3 寄せた件数と金額を同じセルに併記する', () => {
  it('件数だけでなく金額も出す', () => {
    render(<TotalCashflowTable rows={[row({ shiftedCount: 3, shiftedAmount: 300_000 })]} />);
    // 件数だけの実装だと「3」で通ってしまうので、金額まで含めた文字列で固定する
    expect(screen.getAllByRole('cell')[6]!.textContent).toBe('3 件 / 300,000');
  });

  it('金額を併記しても列は 9 のままである', () => {
    render(<TotalCashflowTable rows={[row({ shiftedCount: 3, shiftedAmount: 300_000 })]} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);
    expect(screen.getAllByRole('cell')).toHaveLength(9);
  });

  it('寄せが 0 件の月は 0 件 / 0 と書き、空欄にしない', () => {
    // 空欄だと「寄らなかった」と「まだ照合していない」が同じ見た目になる
    render(<TotalCashflowTable rows={[row({ shiftedCount: 0, shiftedAmount: 0 })]} />);
    expect(screen.getAllByRole('cell')[6]!.textContent).toBe('0 件 / 0');
  });
});

describe('受入F4 重複候補は理由付きで列挙され、0 件のときは 0 件と明示される', () => {
  const mf = (over: Partial<TotalCashflowReview['mf']> = {}): TotalCashflowReview['mf'] => ({
    date: '2026-01-15',
    displayDate: '01/15',
    content: 'アマゾンウェブサービス',
    amount: 3300,
    io: 'expense',
    institution: '三井住友カード',
    major: '通信費',
    middle: 'サーバー',
    memo: '',
    ...over,
  });

  const review: TotalCashflowReview[] = [
    {
      txId: 'mf-near',
      reason: '発生日が一致しません',
      mf: mf(),
      candidates: [
        {
          freeeIndex: 4,
          freeeKey: 'v1:freee:aws',
          date: '2026-01-17',
          partner: 'Amazon Web Services',
          amount: 3300,
          account: '通信費',
          settleAccount: '三井住友',
          dayGap: 2,
          accountConflict: false,
        },
      ],
    },
    {
      txId: 'mf-inst',
      reason: '口座不一致',
      mf: mf({ content: 'ドメイン更新', amount: 1500, institution: '楽天カード' }),
      candidates: [],
    },
  ];

  /** 要確認の表の本文行 (見出し行を除く)。1 行 = 要確認 1 件 */
  const reviewRows = (section: HTMLElement) =>
    within(section)
      .getAllByRole('row')
      .filter((r) => within(r).queryAllByRole('cell').length > 0);

  it('候補があれば件数と理由をそれぞれ出す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(payload({ months: [row({ reviewCount: 2 })], review }))),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    expect(within(section).getByRole('heading').textContent).toBe('要確認 2 件');

    // 理由は候補ごとに出す。まとめて 1 つにすると、どれがなぜ残ったか分からない
    const rows = reviewRows(section);
    expect(rows).toHaveLength(2);
    expect(rows.map((tr) => tr.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('発生日が一致しません'),
        expect.stringContaining('口座不一致'),
      ]),
    );
  });

  /*
    このテストは旧実装 (txId と理由だけを出していた頃) では必ず落ちる。
    件数と理由の存在だけを見ていた前のテストは、識別子しか出ていない画面を緑にしていた。
    要確認の目的は「利用者が同じ取引か判断できること」なので、判断材料そのものを固定する。

    件ごとに表を作る形も落とす: MF と freee は「同じ 1 行の中」に並んでいなければ、
    19 件では見出しが 19 回繰り返されて比較にならない。
  */
  it('MF 側の中身と freee 側の候補を 1 行の中の同じ列へ並べる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(payload({ months: [row({ reviewCount: 2 })], review }))),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    const first = reviewRows(section)[0]!;

    // MF 側: 日付・内容・金額・口座・分類が読める
    expect(first.textContent).toContain('2026-01-15');
    expect(first.textContent).toContain('アマゾンウェブサービス');
    expect(first.textContent).toContain('三井住友カード');
    expect(first.textContent).toContain('通信費 / サーバー');

    // freee 側: 同じ行・同じ列に並び、何日ずれているかが語で分かる
    expect(first.textContent).toContain('2026-01-17');
    expect(first.textContent).toContain('Amazon Web Services');
    expect(first.textContent).toContain('freee が 2 日あと');

    // 金額は両側に出す。片方だけだと「同額かどうか」を画面上で確かめられない
    const amount = within(first).getByRole('cell', { name: /-3,300/ });
    expect(amount.textContent).toBe('-3,300-3,300');

    // 見出しは表全体で 1 回。件ごとに表を作ると件数ぶん繰り返される
    expect(within(section).getAllByRole('table')).toHaveLength(1);

    // 内部識別子は判断の材料にならないので画面へ出さない
    expect(first.textContent).not.toContain('mf-near');
  });

  it('freee 側に候補が無いときは、空欄ではなく「相手がいない」と書く', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(payload({ months: [row({ reviewCount: 2 })], review }))),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    expect(reviewRows(section)[1]!.textContent).toContain(
      '同じ金額・同じ向きで前後 3 日以内の取引はありません',
    );
  });

  it('候補が 0 件でも節ごと消さず、0 件であることを文字で明示する', async () => {
    // 節ごと消すと「0 件だった」と「まだ数えていない」が画面上で同じ見た目になる。
    // 空欄ではなく語で断ることが受入の要求。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(payload({ months: [row({ reviewCount: 0 })] }))),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    expect(within(section).getByRole('heading').textContent).toBe('要確認 0 件');
    expect(within(section).getByText('機械では決められない重複はありません。')).toBeTruthy();
    expect(within(section).queryAllByRole('table')).toHaveLength(0);
  });
});

/*
  要確認は実データで 19 件出た。1 件ずつ 2 回クリックさせる画面は、件数が増えるほど
  破綻する。選んでまとめて判定できること、そしてそれが 1 往復で送られることを固定する。
  1 往復であることは通信の都合ではなく、D1 のクエリ数が invocation 単位で数えられる以上、
  選ぶ件数によって保存の成否が変わらないための条件である。
*/
describe('要確認は選んでまとめて判定できる', () => {
  const item = (txId: string, dayGap: number): TotalCashflowReview => ({
    txId,
    reason: '口座不一致',
    mf: {
      date: '2026-01-01',
      displayDate: '01/01',
      content: `ノート ${txId}`,
      amount: 5980,
      io: 'expense',
      institution: '楽天カード まりこ',
      major: 'その他',
      middle: '事業経費',
      memo: '',
    },
    candidates: [
      {
        freeeIndex: 0,
        freeeKey: `v1:freee:note#${txId}`,
        date: '2026-01-01',
        partner: 'note株式会社',
        amount: 5980,
        account: '新聞図書費',
        settleAccount: '事業主借',
        dayGap,
        accountConflict: true,
      },
    ],
  });

  const review = [item('a', 0), item('b', 0), item('c', 2)];

  /** POST された本文を順に記録する fetch */
  const stub = () => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return json({ ok: true, saved: 1, rejected: [] });
        }
        return json(payload({ months: [row({ reviewCount: review.length })], review }));
      }),
    );
    return posts;
  };

  const openSection = async () => {
    stub();
    wrap(<TotalCashflowPage />);
    return await screen.findByRole('region', { name: '重複の要確認' });
  };

  it('チェックした分だけが 1 回の送信にまとまる', async () => {
    const posts = stub();
    wrap(<TotalCashflowPage />);
    const section = await screen.findByRole('region', { name: '重複の要確認' });

    const boxes = within(section).getAllByRole('checkbox', { name: /を選ぶ$/ });
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[2]!);
    expect(within(section).getByText('2 件を選択中')).toBeTruthy();

    fireEvent.click(within(section).getByRole('button', { name: '選択したものを「同じ取引」にする' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      items: [
        { txId: 'a', verdict: 'same' },
        { txId: 'c', verdict: 'same' },
      ],
    });
  });

  it('1 件も選んでいなければ一括のボタンは押せない', async () => {
    const section = await openSection();
    expect(
      (within(section).getByRole('button', { name: '選択したものを「同じ取引」にする' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  /*
    実データで残った 19 件のうち 15 件は「同じ日・同額なのに口座名の書き方が違う」組だった。
    そこへ 1 件ずつチェックを入れさせるのは、チェックを付ける操作そのものが手間になっている。
  */
  it('「同じ日・同額のものを選ぶ」で日付の一致した件だけが選ばれる', async () => {
    const section = await openSection();

    fireEvent.click(within(section).getByRole('button', { name: '同じ日・同額のものを選ぶ (2)' }));
    expect(within(section).getByText('2 件を選択中')).toBeTruthy();

    const boxes = within(section).getAllByRole('checkbox', { name: /を選ぶ$/ }) as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, true, false]);
  });

  it('すべて選ぶを押すと全件が入り、もう一度押すと空になる', async () => {
    const section = await openSection();
    const all = within(section).getByRole('checkbox', { name: 'すべて選ぶ' });

    fireEvent.click(all);
    expect(within(section).getByText('3 件を選択中')).toBeTruthy();
    fireEvent.click(all);
    expect(within(section).getByText('0 件を選択中')).toBeTruthy();
  });

  it('行ごとのボタンは従来どおり単票で送る', async () => {
    const posts = stub();
    wrap(<TotalCashflowPage />);
    const section = await screen.findByRole('region', { name: '重複の要確認' });

    fireEvent.click(within(section).getAllByRole('button', { name: '違う取引' })[1]!);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ txId: 'b', verdict: 'different' });
  });
});

/*
  「取り込んだ内容に抜け漏れはないでしょうか」「一致しているものが表示されていない」への答え。
  一致した組を画面に出さない限り、寄った件数が正しいかを利用者が確かめる手立てが無い。
  件数は 3 つの内訳が freee 総数へ足し合わさる形で見せる。
*/
describe('freee 全件の行き先を件数と中身で示す', () => {
  const freee = (over: Record<string, unknown> = {}) => ({
    freeeIndex: 0,
    freeeKey: 'v1:freee:one',
    month: '2026-08',
    date: '2026-08-05',
    partner: '架空クラウド',
    amount: 3300,
    io: 'expense' as const,
    account: '通信費',
    settleAccount: '三井住友',
    ...over,
  });
  const mfSide = {
    date: '2026-08-05',
    displayDate: '08/05',
    content: 'アマゾンウェブサービス',
    amount: 3300,
    io: 'expense' as const,
    institution: '三井住友カード',
    major: '通信費',
    middle: 'サーバー',
    memo: '',
  };
  const body = payload({
    matched: [
      { mfTxId: 'mf-1', freeeIndex: 0, freeeKey: 'v1:freee:one', by: 'auto', mf: mfSide, freee: freee() },
    ],
    freeeOnly: [freee({ freeeIndex: 1, freeeKey: 'v1:freee:two', partner: '架空アプリ', amount: 2900 })],
    excluded: [
      {
        ...freee({ freeeIndex: 2, freeeKey: 'v1:freee:three', partner: '架空アプリ', amount: 2900 }),
        reason: '同じ支払を 2 回登録していた',
      },
    ],
    coverage: { freeeTotal: 3, matched: 1, freeeOnly: 1, excluded: 1, mfReview: 0 },
  });

  const openSection = async (posts: unknown[] = []) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method && init.method !== 'GET') {
          posts.push({ method: init.method, body: JSON.parse(String(init.body)) });
          return json({ ok: true });
        }
        return json(body);
      }),
    );
    wrap(<TotalCashflowPage />);
    return await screen.findByRole('region', { name: 'freee 取引の行き先' });
  };

  it('一致・相手なし・除外の件数が freee の総数へ足し合わさる形で出る', async () => {
    const section = await openSection();
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe(
      '取り込んだ freee 3 件の行き先',
    );
    // 内訳を足すと総数になることを、画面の文言そのもので固定する
    const summary = section.textContent ?? '';
    expect(summary).toContain('一致 1 件');
    expect(summary).toContain('MF に相手なし 1 件');
    expect(summary).toContain('二重登録として外した 1 件');
    expect(summary).toContain('＝ 3 件');
  });

  it('一致した組は MF と freee の両方の中身を並べ、自動かあなたの判断かを書く', async () => {
    const section = await openSection();
    const table = within(section).getAllByRole('table')[0]!;
    const cells = within(table)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells).toContain('アマゾンウェブサービス');
    expect(cells).toContain('架空クラウド');
    expect(cells).toContain('-3,300');
    expect(cells).toContain('自動 (日付と金額が一致)');
  });

  it('外した取引は理由つきで残り、総額へ戻せる', async () => {
    const posts: unknown[] = [];
    const section = await openSection(posts);
    expect(section.textContent).toContain('同じ支払を 2 回登録していた');

    fireEvent.click(within(section).getByRole('button', { name: '総額へ戻す' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ method: 'DELETE', body: { freeeKey: 'v1:freee:three' } });
  });

  it('二重登録として外すときは理由の記入を必ず挟む', async () => {
    const posts: unknown[] = [];
    const section = await openSection(posts);

    fireEvent.click(within(section).getAllByRole('button', { name: '二重登録として外す' })[0]!);
    const submit = within(section).getByRole('button', { name: '外す' }) as HTMLButtonElement;
    // 理由が空のままでは押せない。理由の読めない除外を残さない
    expect(submit.disabled).toBe(true);

    fireEvent.change(within(section).getByRole('textbox'), { target: { value: '二重登録' } });
    fireEvent.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      method: 'POST',
      body: { freeeKey: 'v1:freee:one', reason: '二重登録' },
    });
  });
});

/*
  同じ日に同じ額の freee 取引が複数あるとき、「同じ取引」だけでは機械にはどちらとも読める。
  利用者が選んだ相手を送れないと、見て決めた組と実際に寄る組がずれる。
*/
describe('候補が複数あるときは組む相手を選べる', () => {
  const cand = (freeeIndex: number, partner: string) => ({
    freeeIndex,
    freeeKey: `v1:freee:${partner}`,
    date: '2026-08-09',
    partner,
    amount: 2900,
    account: '通信費',
    settleAccount: '三井住友',
    dayGap: 3,
    accountConflict: false,
  });
  const two: TotalCashflowReview = {
    txId: 'mf-pick',
    reason: '発生日が一致しません',
    mf: {
      date: '2026-08-12',
      displayDate: '08/12',
      content: '架空アプリ',
      amount: 2900,
      io: 'expense',
      institution: '三井住友カード',
      major: '通信費',
      middle: 'サブスク',
      memo: '',
    },
    candidates: [cand(0, 'A社'), cand(1, 'B社')],
  };
  const one: TotalCashflowReview = { ...two, txId: 'mf-single', candidates: [cand(0, 'A社')] };

  const open = async (review: TotalCashflowReview[]) => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return json({ ok: true });
        }
        return json(payload({ months: [row({ reviewCount: review.length })], review }));
      }),
    );
    wrap(<TotalCashflowPage />);
    return { section: await screen.findByRole('region', { name: '重複の要確認' }), posts };
  };

  it('選んだ候補が「同じ取引」と一緒に送られる', async () => {
    const { section, posts } = await open([two]);
    const radios = within(section).getAllByRole('radio');
    expect(radios).toHaveLength(2);

    fireEvent.click(radios[1]!);
    fireEvent.click(within(section).getAllByRole('button', { name: '同じ取引' })[0]!);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ txId: 'mf-pick', verdict: 'same', freeeKey: 'v1:freee:B社' });
  });

  it('候補が 1 件しかない組には選択肢を出さず、名指しも付けない', async () => {
    const { section, posts } = await open([one]);
    expect(within(section).queryAllByRole('radio')).toHaveLength(0);

    fireEvent.click(within(section).getAllByRole('button', { name: '同じ取引' })[0]!);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ txId: 'mf-single', verdict: 'same' });
  });

  it('「違う取引」には相手の名指しを付けない', async () => {
    const { section, posts } = await open([two]);
    fireEvent.click(within(section).getAllByRole('radio')[0]!);
    fireEvent.click(within(section).getAllByRole('button', { name: '違う取引' })[0]!);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ txId: 'mf-pick', verdict: 'different' });
  });
});
