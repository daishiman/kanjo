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

// jsdom には canvas が無く、Chart.js は context を取れずに例外を投げる。例外はテストを
// 落とさずスタックだけを積むので、本当の失敗を覆い隠す。ここで見たいのは表と判定作業の
// 中身なので、グラフは他の画面テストと同じ差し替えを使う
vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('../src/test-support/chart-test-doubles.js')).SilentChart,
}));

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
  reviewAmount: 0,
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
  // 0041 で足した画面用の一式。既定は「取込前」に当たる形にしてあり、
  // summary / workbench が null の月は新しい節ごと出ない (0 を並べると「0 円だった」と読める)
  summary: null,
  series: [],
  workbench: null,
  autoMatches: [],
  lastOperation: null,
  period: { applied: null, label: '全期間', full: null, years: [], monthCount: 0 },
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

describe('要確認の件数と金額を同じセルに併記する', () => {
  it('保留中の金額を DOM 上で読める', () => {
    render(<TotalCashflowTable rows={[row({ reviewCount: 2, reviewAmount: 203_300 })]} />);
    expect(screen.getAllByRole('cell')[7]!.textContent).toBe('2 件 / 203,300');
  });
});

describe('AC-001 総収支画面の構成要素', () => {
  const totals = (income: number, expense: number) => ({
    income,
    expense,
    balance: income - expense,
  });

  const segmentSummary = (income: number, expense: number, prevIncome: number, prevExpense: number) => {
    const current = totals(income, expense);
    const previousYear = totals(prevIncome, prevExpense);
    const change = (key: 'income' | 'expense' | 'balance') => ({
      diff: current[key] - previousYear[key],
      rate: previousYear[key] === 0 ? null : (current[key] - previousYear[key]) / previousYear[key],
    });
    return {
      ...current,
      previousYear,
      change: { income: change('income'), expense: change('expense'), balance: change('balance') },
    };
  };

  const candidate = (over: Record<string, unknown> = {}) => ({
    freeeIndex: 0,
    freeeKey: 'v1:freee:aws#0',
    date: '2026-01-17',
    partner: 'Amazon Web Services',
    amount: 3300,
    account: '通信費',
    settleAccount: '三井住友',
    dayGap: 2,
    accountConflict: false,
    score: 82,
    ...over,
  });

  const reviewItem = (
    txId: string,
    candidates: unknown[] = [candidate()],
    mfOver: Record<string, unknown> = {},
  ) => ({
    txId,
    reason: '発生日が一致しません',
    mf: {
      date: '2026-01-15',
      displayDate: '01/15',
      content: 'アマゾンウェブサービス',
      amount: 3300,
      io: 'expense' as const,
      institution: '三井住友カード',
      major: '通信費',
      middle: 'サーバー',
      memo: '',
      cls: 'biz' as const,
      clsSrc: '中項目',
      ...mfOver,
    },
    candidates,
  });

  const full = (over: Record<string, unknown> = {}) =>
    payload({
      summary: {
        total: segmentSummary(250_000, 8_300, 200_000, 10_000),
        biz: segmentSummary(200_000, 3_300, 160_000, 4_000),
        household: segmentSummary(50_000, 5_000, 40_000, 6_000),
      },
      series: [
        {
          month: '2026-07',
          total: totals(240_000, 8_000),
          biz: totals(190_000, 3_000),
          household: totals(50_000, 5_000),
        },
        {
          month: '2026-08',
          total: totals(250_000, 8_300),
          biz: totals(200_000, 3_300),
          household: totals(50_000, 5_000),
        },
      ],
      workbench: {
        duplicates: [reviewItem('mf-dup')],
        needsReview: [reviewItem('mf-rev', []), reviewItem('mf-rev2', [])],
        excluded: [],
        progress: {
          duplicates: { total: 4, decided: 3 },
          needsReview: { total: 2, decided: 0 },
          excluded: { total: 0, decided: 0 },
        },
      },
      autoMatches: [],
      period: {
        applied: { from: '2026-07', to: '2026-08' },
        label: '2026年',
        full: null,
        years: [],
        monthCount: 2,
      },
      ...over,
    });

  const renderPage = async (body: unknown) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(body)),
    );
    const view = wrap(<TotalCashflowPage />);
    await screen.findByRole('region', { name: '期間の収支' });
    return view;
  };

  it('期間の収支・推移グラフ・判定作業が同時に出る', async () => {
    await renderPage(full());

    for (const label of ['期間の収支', '重複・除外の判定作業']) {
      expect(screen.getByRole('region', { name: label })).toBeTruthy();
    }
    // KPI は 3 枚。減ると「純収支だけ出ている」状態を緑にしてしまう。
    // 「総収入」は一覧表の列見出しにも出るので、期間の収支の中だけを見る
    const kpis = within(screen.getByRole('region', { name: '期間の収支' }));
    for (const label of ['総収入', '総支出', '純収支']) {
      expect(kpis.getByText(label)).toBeTruthy();
    }
    expect(screen.getByRole('tablist', { name: '判定作業の区分' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('判定の入口をワークベンチ1つに集約し、左ナビを作業順に並べる', async () => {
    await renderPage(full());

    expect(screen.getAllByRole('region', { name: '重複・除外の判定作業' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: '重複の要確認' })).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.textContent).toMatch(/^重複候補 1/);
    expect(tabs[1]?.textContent).toMatch(/^freee除外 0/);
    expect(tabs[2]?.textContent).toMatch(/^要確認 2/);
  });

  it('先頭明細の詳細を初期表示する', async () => {
    await renderPage(full());

    const detail = screen.getByRole('complementary', { name: '選択中の明細の詳細' });
    expect(within(detail).getByText('MoneyForward の明細')).toBeTruthy();
    expect(within(detail).getByText('アマゾンウェブサービス')).toBeTruthy();
  });

  it('表示中の明細を検索・判定状態で絞り、全選択できる', async () => {
    const duplicates = [
      reviewItem('mf-aws', [candidate()], { content: 'AWS 利用料', amount: 3300 }),
      reviewItem('mf-notion', [candidate({ freeeKey: 'v1:freee:notion#0', partner: 'Notion Labs' })], {
        content: 'Notion 月額',
        amount: 1200,
      }),
    ];
    await renderPage(
      full({
        workbench: {
          duplicates,
          needsReview: [],
          excluded: [],
          progress: {
            duplicates: { total: 2, decided: 0 },
            needsReview: { total: 0, decided: 0 },
            excluded: { total: 0, decided: 0 },
          },
        },
      }),
    );

    const workbench = within(screen.getByRole('region', { name: '重複・除外の判定作業' }));
    fireEvent.change(workbench.getByRole('searchbox', { name: '取引内容・金額で検索' }), {
      target: { value: 'Notion' },
    });
    fireEvent.change(workbench.getByRole('combobox', { name: '判定状態で絞り込む' }), {
      target: { value: 'undecided' },
    });

    expect(workbench.queryByText('AWS 利用料')).toBeNull();
    expect(workbench.getAllByText('Notion 月額')).toHaveLength(2);
    const all = workbench.getByRole('checkbox', { name: '表示中の1件をすべて選択' });
    fireEvent.click(all);
    expect(workbench.getByText('1 件選択中')).toBeTruthy();
  });

  it('下部選択バーから同じ・別・安全な除外を実行できる', async () => {
    const posts: unknown[] = [];
    const body = full();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return json({ ok: true, saved: 1, operationId: 'op-1' });
        }
        return json(body);
      }),
    );
    wrap(<TotalCashflowPage />);

    const workbench = within(await screen.findByRole('region', { name: '重複・除外の判定作業' }));
    fireEvent.click(workbench.getByRole('checkbox', { name: /mf-dup|2026-01-15.*選ぶ/ }));
    const bar = within(workbench.getByRole('region', { name: '選択中の操作' }));
    expect(bar.getByRole('button', { name: '同じ取引にする' })).toBeTruthy();
    expect(bar.getByRole('button', { name: '別の取引にする' })).toBeTruthy();
    expect((bar.getByRole('button', { name: '集計から除外' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(bar.getByRole('button', { name: '別の取引にする' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ txId: 'mf-dup', verdict: 'different' });
  });

  it('対応候補が無い選択では一括除外を無効にする', async () => {
    await renderPage(full());
    const workbench = within(screen.getByRole('region', { name: '重複・除外の判定作業' }));
    fireEvent.click(workbench.getByRole('tab', { name: /^要確認/ }));
    fireEvent.click(workbench.getByRole('checkbox', { name: '表示中の2件をすべて選択' }));
    const bar = within(workbench.getByRole('region', { name: '選択中の操作' }));
    const exclude = bar.getByRole('button', {
      name: '集計から除外',
    }) as HTMLButtonElement;
    expect(exclude.disabled).toBe(true);
  });

  it('自動一致の候補を新しい名称で表示し、1取引を1行7セルに収める', async () => {
    await renderPage(
      full({
        autoMatches: [
          {
            txId: 'mf-auto',
            freeeIndex: 0,
            freeeKey: 'v1:freee:auto#0',
            by: 'auto',
            score: 92,
            verdict: null,
            mf: reviewItem('mf-auto').mf,
            freee: {
              freeeIndex: 0,
              freeeKey: 'v1:freee:auto#0',
              month: '2026-01',
              date: '2026-01-15',
              partner: 'Amazon Web Services',
              amount: 3300,
              io: 'expense',
              account: '通信費',
              settleAccount: '三井住友',
            },
          },
        ],
      }),
    );

    expect(screen.queryByRole('region', { name: '完全一致候補' })).toBeNull();
    const section = within(screen.getByRole('region', { name: '自動一致の候補' }));
    const dataRows = section
      .getAllByRole('row')
      .filter((item) => within(item).queryAllByRole('cell').length > 0);
    expect(dataRows).toHaveLength(1);
    expect(within(dataRows[0]!).getAllByRole('cell')).toHaveLength(7);
  });

  it('9列の月次表を「月次の内訳を表示」の中で既定閉じにする', async () => {
    await renderPage(full());

    const summary = screen.getByText('月次の内訳を表示');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(within(details as HTMLElement).getByRole('table')).toBeTruthy();
  });

  it('freeeの検算情報は小さな詳細に縮約し、除外と自動一致を再掲しない', async () => {
    await renderPage(
      full({
        coverage: { freeeTotal: 3, matched: 1, freeeOnly: 1, excluded: 1, mfReview: 0 },
        matched: [],
        freeeOnly: [],
        excluded: [],
      }),
    );

    const summary = screen.getByText('freee取引の検算を表示');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(details?.textContent).toContain('一致 1 件');
    expect(details?.textContent).toContain('残り 1 件');
    expect(details?.textContent).toContain('除外 1 件');
    expect(within(details as HTMLElement).queryAllByRole('table')).toHaveLength(0);
    expect(within(details as HTMLElement).queryByRole('button', { name: '総額へ戻す' })).toBeNull();
  });

  it('区分の切替は総合・事業・家計の 3 つで、選んだ区分の金額へ入れ替わる', async () => {
    await renderPage(full());

    const radios = screen.getAllByRole('radio', { name: /総合|事業|家計/ });
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['total', 'biz', 'household']);

    // 総合の総収入 250,000 から、事業の 200,000 へ入れ替わること。
    // 「切替が押せる」だけの検査だと、値が動かない実装でも緑になる。
    // 同じ金額は一覧表にも出るので、期間の収支の中だけを見る
    const kpis = () => within(screen.getByRole('region', { name: '期間の収支' }));
    expect(kpis().getByText('¥250,000')).toBeTruthy();
    fireEvent.click(radios[1]!);
    expect(kpis().getByText('¥200,000')).toBeTruthy();
    expect(kpis().queryByText('¥250,000')).toBeNull();
  });

  it('前年同期がそろっていれば差額と率を、欠けていればその旨を出す', async () => {
    const { unmount } = await renderPage(full());
    expect(screen.getByText('前年同期 ¥200,000')).toBeTruthy();
    unmount();
    cleanup();

    const missing = segmentSummary(250_000, 8_300, 0, 0);
    await renderPage(
      full({
        summary: {
          total: { ...missing, previousYear: null, change: null },
          biz: { ...missing, previousYear: null, change: null },
          household: { ...missing, previousYear: null, change: null },
        },
      }),
    );
    // 0 円と書くと「前年は 0 円だった」と読める。そろっていないことを文字で言う
    expect(screen.getAllByText('前年同期のデータがそろっていません').length).toBeGreaterThan(0);
  });

  it('色は CSS 変数だけで渡し、描画の宣言へ直書きしない', async () => {
    const { container } = await renderPage(full());
    const declarations = [...container.querySelectorAll('[style]')].flatMap((el) =>
      (el.getAttribute('style') ?? '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean),
    );
    // `--series-color: #...` はトークンの受け渡しなので許す。禁じたいのは
    // color / background などの描画宣言に 16 進が直接入ること (chartSeriesColor を迂回した印)
    const offenders = declarations.filter((decl) => !decl.startsWith('--') && /#[0-9a-f]{3,8}\b/i.test(decl));
    expect(offenders).toEqual([]);
  });
});

describe('BR-007 判定の進捗は区分ごとに出す', () => {
  it('選んだ区分の「N 件中 M 件」を出し、区分を変えると数も変わる', async () => {
    const body = {
      ...payload(),
      summary: null,
      workbench: {
        duplicates: [],
        needsReview: [],
        excluded: [],
        progress: {
          duplicates: { total: 4, decided: 3 },
          needsReview: { total: 7, decided: 1 },
          excluded: { total: 2, decided: 2 },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(body)),
    );
    wrap(<TotalCashflowPage />);

    await screen.findByText('4 件中 3 件の判定が完了しました');
    fireEvent.click(screen.getByRole('tab', { name: /要確認/ }));
    // 全体の合計だけを出すと、残り 1 件と残り 6 件が同じ進捗に見える
    expect(screen.getByText('7 件中 1 件の判定が完了しました')).toBeTruthy();
  });
});

describe('U-001 取消の失敗は種類で言い分ける', () => {
  const pane = (over: Record<string, unknown> = {}) => ({
    txId: 'mf-undo',
    reason: '発生日が一致しません',
    mf: {
      date: '2026-01-15',
      displayDate: '01/15',
      content: 'アマゾンウェブサービス',
      amount: 3300,
      io: 'expense' as const,
      institution: '三井住友カード',
      major: '通信費',
      middle: 'サーバー',
      memo: '',
      cls: 'biz' as const,
      clsSrc: '中項目',
    },
    candidates: [
      {
        freeeIndex: 0,
        freeeKey: 'v1:freee:aws#0',
        date: '2026-01-17',
        partner: 'Amazon Web Services',
        amount: 3300,
        account: '通信費',
        settleAccount: '三井住友',
        dayGap: 2,
        accountConflict: false,
        score: 82,
      },
    ],
    ...over,
  });

  /**
   * 判定を 1 件保存して「元に戻す」を出し、その取消が `status` で失敗する場面を作る。
   *
   * 取消の導線は詳細ペインの中にしかない。一覧の行から押しただけでは出ないので、
   * 日付を押して詳細を開くところまでが前提条件になる。
   */
  const undoFailingWith = async (status: number, code: string) => {
    const body = payload({
      workbench: {
        duplicates: [pane()],
        needsReview: [],
        excluded: [],
        progress: {
          duplicates: { total: 1, decided: 0 },
          needsReview: { total: 0, decided: 0 },
          excluded: { total: 0, decided: 0 },
        },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/undo')) return json({ error: { code, message: 'x' } }, status);
        if ((init?.method ?? 'GET') === 'POST') return json({ ok: true, saved: 1, operationId: 'op-1' });
        return json(body);
      }),
    );
    wrap(<TotalCashflowPage />);

    const workbench = within(await screen.findByRole('region', { name: '重複・除外の判定作業' }));
    fireEvent.click(workbench.getByRole('button', { name: '2026-01-15' }));
    const detail = within(await screen.findByRole('complementary', { name: '選択中の明細の詳細' }));
    fireEvent.click(detail.getByRole('button', { name: '別の取引' }));
    fireEvent.click(await screen.findByRole('button', { name: '元に戻す' }));
  };

  it('書き込みが混み合っただけなら、やり直せると伝えて導線を残す', async () => {
    await undoFailingWith(409, 'canonical_write_busy');

    expect(await screen.findByText('別の更新と重なりました。もう一度お試しください')).toBeTruthy();
    // 直せば通る失敗なので、押す先を消さない
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeTruthy();
  });

  it('対象が最新でなくなっていたら、再読込を促して導線を消す', async () => {
    await undoFailingWith(409, 'stale_operation');

    expect(
      await screen.findByText('別の画面で新しい操作があったため取り消せません。画面を再読込してください'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
  });
});
