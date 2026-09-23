// @vitest-environment jsdom

/**
 * トレードオフ画面の描画・状態・操作 (SYS-TRADEOFF-P04、spec-tradeoff-screen「受入基準」の DOM テスト)。
 *
 * 推奨の組み合わせと試算の期待値は手書きせず core の `tradeoffCombos` / `tradeoffSimulation` で作る。
 * 画面が式を複製してずれたらここで落ちる。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の画面 (`pages/Tradeoff.tsx`) は旧応答 (budgets / plans / review) を読む 1 枚の表で、
 * 1〜3 の段・計算例・右の試算結果・選択中バー・必要度の上書き・最新の記録の復元を持たない。
 * `./TradeoffPage.js` 自体が存在しない。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type TradeoffLatestPlan,
  type TradeoffScreenCandidate,
  type TradeoffScreenResponse,
  parseTradeoffCandidateKey,
  tradeoffCandidateKey,
  tradeoffCombos,
  tradeoffSimulation,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradeoffPage } from './TradeoffPage.js';
import { sameCandidateKeys } from './view-model.js';

const RENT = tradeoffCandidateKey('地代家賃', '架空不動産');
const OUTSOURCE = tradeoffCandidateKey('外注費', '架空デザイン');
const TELECOM = tradeoffCandidateKey('通信費', '架空通信');
const ADS = tradeoffCandidateKey('広告宣伝費', '架空広告');

function cand(
  key: string,
  monthly: number,
  over: Partial<TradeoffScreenCandidate> = {},
): TradeoffScreenCandidate {
  const parsed = parseTradeoffCandidateKey(key);
  if (!parsed) throw new Error(`invalid fixture key: ${key}`);
  const { account, partner } = parsed;
  return {
    key,
    account,
    partner,
    monthly,
    annual: monthly * 12,
    need: 'mid',
    needSource: 'auto',
    trend: 'flat',
    reason: '準変動・直近 3 か月は横ばい',
    memo: null,
    relatedTo: null,
    ...over,
  };
}

/** API 結合テストと同じ 4 候補 (月額の降順) */
const CANDIDATES: TradeoffScreenCandidate[] = [
  cand(RENT, 60000, {
    need: 'high',
    reason: '固定費・直近 3 か月は横ばい・地代家賃 の固定費を見直す',
    relatedTo: '/subscriptions?account=地代家賃',
  }),
  cand(OUTSOURCE, 25000, { need: 'low', trend: 'down', reason: '準変動・直近 3 か月は減少' }),
  cand(TELECOM, 25000, { need: 'high', needSource: 'manual', reason: '固定費・直近 3 か月は横ばい' }),
  cand(ADS, 13000, { need: 'low', trend: 'up', memo: '展示会の前だけ', reason: '展示会の前だけ' }),
];

const plan = (over: Partial<TradeoffLatestPlan> = {}): TradeoffLatestPlan => ({
  id: 7,
  title: '新しい業務ツール',
  amount: 80000,
  recurring: true,
  startMonth: '2026-10',
  memo: '年契約の見積もり',
  keys: [RENT, OUTSOURCE],
  covered: 85000,
  verdict: 'covered',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

function payload(over: Partial<TradeoffScreenResponse> = {}): TradeoffScreenResponse {
  return {
    candidates: CANDIDATES,
    defense: { monthlyMargin: null, status: 'nodata' },
    latest: null,
    ...over,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>;

/**
 * URL ごとに応答を返す fetch。GET /api/tradeoff は呼ばれるたびに `gets` の次の要素を返す
 * (最後の要素は使い回す)。取り直しの有無は GET の回数で見る。
 */
function server(opts: { gets?: (TradeoffScreenResponse | Handler)[]; post?: Handler; put?: Handler } = {}) {
  const gets = opts.gets ?? [payload()];
  let getCount = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.startsWith('/api/summary')) {
      return json({
        period: { label: '2026/01〜2026/06', applied: null, full: null, years: [], monthCount: 6 },
      });
    }
    if (url.startsWith('/api/tradeoff/candidates/') && method === 'PUT') {
      return opts.put ? opts.put(init, url) : json({ ok: true, candidate: CANDIDATES[0] });
    }
    if (url.startsWith('/api/tradeoff') && method === 'POST') {
      return opts.post ? opts.post(init, url) : json({ ok: true, id: 8, plan: plan({ id: 8 }) }, 201);
    }
    if (url.startsWith('/api/tradeoff') && method === 'GET') {
      const next = gets[Math.min(getCount, gets.length - 1)];
      getCount += 1;
      return typeof next === 'function' ? next(init, url) : json(next);
    }
    return json({ error: { code: 'not_found', message: url } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  const tradeoffGets = () =>
    fetchMock.mock.calls.filter(
      ([u, i]) => String(u).startsWith('/api/tradeoff') && (i?.method ?? 'GET') === 'GET',
    ).length;
  return { fetchMock, tradeoffGets };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tradeoff']}>
        <TradeoffPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ready = () => screen.findByRole('heading', { name: /見直し候補の選択/ });
const panel = () => screen.getByRole('region', { name: '試算結果' });
const bar = () => screen.queryByRole('region', { name: '選択中の候補' });
/** dt の直後の dd の文字 (右パネル・選択中バーで同じ語の値を取り出す) */
const figureOf = (scope: HTMLElement, term: string) => {
  const dt = within(scope).getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
};
const setAmount = (value: string) => fireEvent.change(screen.getByLabelText('金額'), { target: { value } });
const pick = (label: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name: label }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('画面の骨格 (O1)', () => {
  it('見出し・問い・分析期間・1〜3 の段・計算例・右の試算結果と計算の前提が描かれる', async () => {
    server();
    renderPage();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'トレードオフ' })).toBeTruthy();
    expect(screen.getByText('新しい支出を増やすなら、何を見直しますか？')).toBeTruthy();
    const period = screen.getByRole('complementary', { name: '分析期間' });
    await waitFor(() => expect(within(period).getByText('2026/01〜2026/06')).toBeTruthy());

    expect(screen.getByRole('heading', { name: /1\.\s*新しい支出を設定/ })).toBeTruthy();
    expect(screen.getByLabelText('支出名')).toBeTruthy();
    expect(screen.getByLabelText('金額')).toBeTruthy();
    const freq = screen.getByRole('group', { name: '支払いの頻度' });
    expect(within(freq).getByRole('button', { name: '単発' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(freq).getByRole('button', { name: '毎月' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('開始月')).toBeTruthy();
    expect(screen.getByLabelText('メモ')).toBeTruthy();

    expect(screen.getByRole('searchbox', { name: '候補を検索' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'カテゴリ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '選択をすべてクリア' })).toBeTruthy();
    const table = screen.getByRole('table', { name: '見直し候補' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      '選択',
      '#',
      'カテゴリ・取引先',
      '月額',
      '年額',
      '必要度',
      '直近の推移',
      '損益・メモ',
    ]);

    expect(screen.getByRole('heading', { name: /3\.\s*推奨の組み合わせ/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '計算例' })).toBeTruthy();
    const examples = screen.getByRole('region', { name: '計算例' });
    // O2 の 2 例 (毎月 80,000 / 削減 85,000・単発 300,000 / 削減 50,000)
    expect(within(examples).getByText(/960,000/)).toBeTruthy();
    expect(within(examples).getByText(/1,020,000/)).toBeTruthy();
    expect(within(examples).getAllByText(/300,000/).length).toBeGreaterThan(0);
    expect(within(examples).getByText(/600,000/)).toBeTruthy();

    const result = panel();
    for (const term of ['新しい支出（年間）', '見直しによる削減額（年間）', '差額（年間）']) {
      expect(within(result).getByText(term, { selector: 'dt' })).toBeTruthy();
    }
    expect(within(result).getByRole('heading', { name: '防衛ラインへの影響' })).toBeTruthy();
    expect(within(result).getByRole('heading', { name: '計算の前提' })).toBeTruthy();
    for (const line of [
      '毎月の支出は月額×12、単発の支出は発生月だけに計上',
      '見直しの削減は選んだ候補の月額合計×12',
      '税・手数料は考慮しない',
      '開始月は年額に影響しない',
    ]) {
      expect(within(result).getByText(line)).toBeTruthy();
    }
  });

  it('正本画像と同じく、説明+期間カード、1・2+右試算、3+計算例の構造に分ける', async () => {
    server();
    const { container } = renderPage();
    await ready();
    const hero = container.querySelector('.tradeoff-hero');
    const period = container.querySelector('.tradeoff-period.card');
    const layout = container.querySelector('.tradeoff-layout');
    const primary = container.querySelector('.tradeoff-primary');
    const side = container.querySelector('.tradeoff-side');
    const recommendation = container.querySelector('.tradeoff-recommendations');
    const calculations = container.querySelector('.tradeoff-calculations');
    expect(hero?.contains(period)).toBe(true);
    expect(layout?.contains(primary)).toBe(true);
    expect(layout?.contains(side)).toBe(true);
    expect(primary?.querySelectorAll(':scope > .tradeoff-step')).toHaveLength(2);
    expect(primary?.contains(recommendation)).toBe(false);
    expect(primary?.contains(calculations)).toBe(false);
    expect(recommendation?.parentElement).toBe(layout);
    expect(calculations?.parentElement).toBe(layout);
  });

  it('開始月の既定は今日の翌月', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-15T09:00:00+09:00') });
    try {
      server();
      renderPage();
      await ready();
      expect((screen.getByLabelText('開始月') as HTMLInputElement).value).toBe('2027-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('保存済み試算の一覧と翌月の突合を出さない (FR-14)', async () => {
    server({ gets: [payload({ latest: plan() })] });
    renderPage();
    await ready();
    expect(screen.queryByText(/保存済み|達成|一部達成|未達|記帳待ち|翌月の実績/)).toBeNull();
  });
});

describe('状態', () => {
  it('取得中は読込の表示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(await screen.findByText('データを読み込み中…')).toBeTruthy();
  });

  it('失敗は失敗の文と再読込', async () => {
    server({ gets: [() => json({ error: { code: 'internal', message: 'x' } }, 500)] });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/サーバー側で処理に失敗しました/)).toBeTruthy();
    expect(within(alert).getByRole('button', { name: '再読み込みする' })).toBeTruthy();
  });

  it('候補が空なら表の代わりに文を出し、試算結果は削減 0 で出す', async () => {
    server({ gets: [payload({ candidates: [] })] });
    renderPage();
    expect(await screen.findByText('直近 3 か月に月 1,000 円以上の事業経費がありません')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '見直し候補' })).toBeNull();
    setAmount('10000');
    expect(figureOf(panel(), '見直しによる削減額（年間）')).toMatch(/^¥?0/);
    expect(figureOf(panel(), '新しい支出（年間）')).toContain('120,000');
  });

  it('新しい支出が未入力なら推奨は空の文', async () => {
    server();
    renderPage();
    await ready();
    expect(screen.getByText('選べる候補で新しい支出の年額に届く組み合わせはありません')).toBeTruthy();
  });

  it('選択 0 件では選択中バーを出さない', async () => {
    server();
    renderPage();
    await ready();
    expect(bar()).toBeNull();
    pick(/外注費/);
    expect(bar()).not.toBeNull();
    fireEvent.click(within(bar() as HTMLElement).getByRole('button', { name: '選択をクリア' }));
    expect(bar()).toBeNull();
  });
});

describe('候補表 (FR-5 / FR-6)', () => {
  it('必要度は文字で出し、上書き済みに『手動』、推移は矢印と文字、メモは損益・メモの欄に出る', async () => {
    server();
    renderPage();
    await ready();
    const rows = within(screen.getByRole('table', { name: '見直し候補' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(4);
    const [rent, outsource, telecom, ads] = rows;
    expect(within(rent).getByText('高')).toBeTruthy();
    expect(within(rent).getByText('→ 横ばい')).toBeTruthy();
    expect(within(rent).getByText('60,000', { exact: false })).toBeTruthy();
    expect(within(rent).getByText('720,000', { exact: false })).toBeTruthy();
    expect(within(outsource).getByText('低')).toBeTruthy();
    expect(within(outsource).getByText('↓ 減少')).toBeTruthy();
    expect(within(telecom).getByText('手動')).toBeTruthy();
    expect(within(rent).queryByText('手動')).toBeNull();
    expect(within(ads).getByText('↑ 増加')).toBeTruthy();
    expect(within(ads).getByText('展示会の前だけ')).toBeTruthy();
  });

  it('月額降順の 10 件を出し、『すべて表示』で残りを出す', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      cand(tradeoffCandidateKey('雑費', `取引先${String(i).padStart(2, '0')}`), 30000 - i * 1000),
    );
    server({ gets: [payload({ candidates: many })] });
    renderPage();
    await ready();
    const table = screen.getByRole('table', { name: '見直し候補' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('12 件中 10 件を表示')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'すべて表示' }));
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByText('12 件中 12 件を表示')).toBeTruthy();
  });

  it('検索はカテゴリ名・取引先名の部分一致、カテゴリ絞込は科目の完全一致', async () => {
    server();
    renderPage();
    await ready();
    const table = screen.getByRole('table', { name: '見直し候補' });
    fireEvent.change(screen.getByRole('searchbox', { name: '候補を検索' }), { target: { value: '架空通' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('通信費')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: '候補を検索' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'カテゴリ' }), { target: { value: '外注費' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('外注費')).toBeTruthy();
  });

  it('『選択をすべてクリア』は選択だけを外し、絞り込みは残す', async () => {
    server();
    renderPage();
    await ready();
    pick(/地代家賃/);
    fireEvent.change(screen.getByRole('searchbox', { name: '候補を検索' }), { target: { value: '架空' } });
    fireEvent.click(screen.getByRole('button', { name: '選択をすべてクリア' }));
    expect(bar()).toBeNull();
    expect((screen.getByRole('searchbox', { name: '候補を検索' }) as HTMLInputElement).value).toBe('架空');
  });
});

describe('試算 (FR-4 / FR-10 / FR-11、O2)', () => {
  it('毎月 80,000 と 地代家賃+外注費 (85,000/月) で捻出の文、右パネルと選択中バーの差額が同じ', async () => {
    server();
    renderPage();
    await ready();
    setAmount('80000');
    pick(/地代家賃/);
    pick(/外注費/);
    const expected = tradeoffSimulation({ amount: 80000, recurring: true }, [60000, 25000], null);
    expect(expected.annualDiff).toBe(-60000);
    const result = panel();
    expect(figureOf(result, '新しい支出（年間）')).toContain('960,000');
    expect(figureOf(result, '見直しによる削減額（年間）')).toContain('1,020,000');
    expect(within(result).getByText('年間 60,000 円を捻出できます')).toBeTruthy();
    const selection = bar() as HTMLElement;
    expect(within(selection).getByText('2 件を選択中')).toBeTruthy();
    expect(figureOf(selection, '差額（年間）')).toBe(figureOf(result, '差額（年間）'));
    expect(figureOf(selection, '削減額（年間）')).toBe(figureOf(result, '見直しによる削減額（年間）'));
  });

  it('右パネルの支出名・頻度・月額と選択件数・削減月額は同じ試算状態から描く', async () => {
    server();
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('支出名'), { target: { value: '新規採用ツール' } });
    setAmount('80000');
    pick(/地代家賃/);
    pick(/外注費/);
    const expense = screen.getByRole('region', { name: '新しい支出（追加コスト）' });
    const saving = screen.getByRole('region', { name: '見直しによる削減額（選択合計）' });
    expect(figureOf(expense, '支出名')).toBe('新規採用ツール');
    expect(figureOf(expense, '頻度')).toBe('毎月');
    expect(figureOf(expense, '月額')).toContain('80,000');
    expect(figureOf(saving, '選択件数')).toBe('2 件');
    expect(figureOf(saving, '削減額（月額）')).toContain('85,000');
    expect(figureOf(saving, '見直しによる削減額（年間）')).toContain('1,020,000');
  });

  it('毎月 100,000 と 外注費+通信費 (50,000/月) は支出増の警告', async () => {
    server();
    renderPage();
    await ready();
    setAmount('100000');
    pick(/外注費/);
    pick(/通信費/);
    const result = panel();
    expect(within(result).getByRole('alert')).toBeTruthy();
    expect(within(result).getByText('年間 600,000 円の支出増になります')).toBeTruthy();
    expect(figureOf(bar() as HTMLElement, '差額（年間）')).toBe(figureOf(result, '差額（年間）'));
  });

  it('単発 300,000 は金額そのものを年額にする', async () => {
    server();
    renderPage();
    await ready();
    setAmount('300000');
    fireEvent.click(screen.getByRole('button', { name: '単発' }));
    pick(/外注費/);
    pick(/通信費/);
    expect(figureOf(panel(), '新しい支出（年間）')).toContain('300,000');
    expect(within(panel()).getByText('年間 300,000 円を捻出できます')).toBeTruthy();
  });

  it('開始月を変えても試算は変わらない (FR-3)', async () => {
    server();
    renderPage();
    await ready();
    setAmount('80000');
    pick(/地代家賃/);
    const before = figureOf(panel(), '差額（年間）');
    fireEvent.change(screen.getByLabelText('開始月'), { target: { value: '2027-12' } });
    expect(figureOf(panel(), '差額（年間）')).toBe(before);
  });

  it('防衛ラインが無い (nodata) と判定を出さず文を出す', async () => {
    server();
    renderPage();
    await ready();
    setAmount('80000');
    const result = panel();
    expect(
      within(result).getByText('記帳済みの月が無いため、防衛ラインへの影響は計算できません'),
    ).toBeTruthy();
    expect(within(result).queryByText('維持')).toBeNull();
    expect(within(result).queryByText('割れる')).toBeNull();
  });

  it('月の余裕があれば 余裕 → 試算後 と 維持 / 割れる を文字で出す', async () => {
    server({ gets: [payload({ defense: { monthlyMargin: 5000, status: 'ok' } })] });
    renderPage();
    await ready();
    setAmount('60000');
    fireEvent.click(screen.getByRole('button', { name: '単発' }));
    const result = panel();
    expect(within(result).getByText('維持')).toBeTruthy();
    expect(within(result).getByText(/60,000.*→.*0/)).toBeTruthy();
    setAmount('60001');
    expect(within(result).getByText('割れる')).toBeTruthy();
  });
});

describe('推奨の組み合わせ (FR-8)', () => {
  it('core と同じ上位 4 件を出し、行を選ぶと選択が置き換わり、理由と関連ページが出る', async () => {
    server();
    renderPage();
    await ready();
    setAmount('80000');
    const combos = tradeoffCombos(CANDIDATES, 960000);
    const table = screen.getByRole('table', { name: '推奨の組み合わせ' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim());
    expect(headers).toEqual(['組み合わせ内容', '削減額（年間）', '充足度', '実行のしやすさ', 'リスク']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(combos.length);
    const top = combos[0];
    expect(within(rows[0]).getByText(`${top.sufficiency}%`)).toBeTruthy();
    expect(within(rows[0]).getByText(top.ease)).toBeTruthy();
    expect(within(rows[0]).getByText(top.risk)).toBeTruthy();

    pick(/通信費/);
    fireEvent.click(within(rows[0]).getByRole('button'));
    const selection = bar() as HTMLElement;
    expect(within(selection).getByText(`${top.keys.length} 件を選択中`)).toBeTruthy();
    for (const key of top.keys) {
      const account = CANDIDATES.find((candidate) => candidate.key === key)?.account;
      if (!account) throw new Error(`missing fixture candidate: ${key}`);
      expect((screen.getByRole('checkbox', { name: new RegExp(account) }) as HTMLInputElement).checked).toBe(
        true,
      );
    }
    expect((screen.getByRole('checkbox', { name: /通信費/ }) as HTMLInputElement).checked).toBe(
      top.keys.includes(TELECOM),
    );
    const reason = screen.getByRole('region', { name: 'この組み合わせの理由' });
    expect(within(reason).getByText(top.reason)).toBeTruthy();
    // 当たりのある候補 (地代家賃) にだけ関連ページのリンクを出す
    const links = within(reason).queryAllByRole('link');
    const expectedLinks = top.keys.filter((k) => CANDIDATES.find((c) => c.key === k)?.relatedTo);
    expect(links).toHaveLength(expectedLinks.length);
    if (expectedLinks.length) expect(links[0].getAttribute('href')).toContain('/subscriptions');
  });
});

describe('記録と復元 (FR-12 / FR-13)', () => {
  it('最新の記録を 1.新しい支出と選択へ復元し、期間に無い候補は外して件数を知らせる', async () => {
    server({ gets: [payload({ latest: plan({ keys: [RENT, '旅費交通費|消えた取引先'] }) })] });
    renderPage();
    await ready();
    expect((screen.getByLabelText('支出名') as HTMLInputElement).value).toBe('新しい業務ツール');
    expect((screen.getByLabelText('金額') as HTMLInputElement).value).toBe('80000');
    expect((screen.getByLabelText('開始月') as HTMLInputElement).value).toBe('2026-10');
    expect((screen.getByLabelText('メモ') as HTMLTextAreaElement).value).toBe('年契約の見積もり');
    expect(screen.getByRole('button', { name: '毎月' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('checkbox', { name: /地代家賃/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('1 件の候補は現在の期間に無いため外しました')).toBeTruthy();
    expect(within(bar() as HTMLElement).getByText('1 件を選択中')).toBeTruthy();
  });

  it('『この試算を記録する』は導出値を送らず、成功したら取り直して完了を近くに出す', async () => {
    const { fetchMock, tradeoffGets } = server();
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('支出名'), { target: { value: '新しい業務ツール' } });
    setAmount('80000');
    pick(/地代家賃/);
    pick(/外注費/);
    fireEvent.click(screen.getByRole('button', { name: 'この試算を記録する' }));
    await waitFor(() => expect(tradeoffGets()).toBe(2));
    expect(within(bar() as HTMLElement).getByRole('status').textContent).toBe('この試算を記録しました');
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST');
    const body = JSON.parse(String(post?.[1]?.body));
    expect(body).toEqual({
      title: '新しい業務ツール',
      amount: 80000,
      recurring: true,
      startMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
      memo: null,
      keys: [RENT, OUTSOURCE],
    });
    expect(Object.keys(body)).not.toContain('covered');
    expect(Object.keys(body)).not.toContain('verdict');
  });

  it('候補が期間から消えていた (422) なら文を出して取り直し、入力は残す', async () => {
    const { tradeoffGets } = server({
      post: () => json({ error: { code: 'unknown_candidate', message: 'x' } }, 422),
    });
    renderPage();
    await ready();
    setAmount('80000');
    pick(/地代家賃/);
    fireEvent.click(screen.getByRole('button', { name: 'この試算を記録する' }));
    expect(
      await within(bar() as HTMLElement).findByText('選んだ候補が現在の期間にありません。取り直しました'),
    ).toBeTruthy();
    await waitFor(() => expect(tradeoffGets()).toBe(2));
    expect((screen.getByLabelText('金額') as HTMLInputElement).value).toBe('80000');
  });

  it('送信中は記録ボタンを押せない', async () => {
    server({ post: () => new Promise<Response>(() => {}) });
    renderPage();
    await ready();
    setAmount('80000');
    pick(/地代家賃/);
    const button = screen.getByRole('button', { name: 'この試算を記録する' }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
  });

  it('金額が未入力なら記録ボタンを押せず、理由を近くに出す', async () => {
    server();
    renderPage();
    await ready();
    pick(/地代家賃/);
    const selection = bar() as HTMLElement;
    const button = within(selection).getByRole('button', { name: 'この試算を記録する' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(within(selection).getByText('新しい支出の金額を入力すると記録できます')).toBeTruthy();
  });

  it('不正な金額は入力欄と CTA の近くに直し方を出す', async () => {
    server();
    renderPage();
    await ready();
    setAmount('100000001');
    pick(/地代家賃/);
    const amount = screen.getByLabelText('金額');
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('金額は 1 円〜1 億円の整数で入力してください')).toBeTruthy();
    expect(
      within(bar() as HTMLElement).getByText('金額を 1 円〜1 億円の整数に直すと記録できます'),
    ).toBeTruthy();
  });

  it('POST 失敗を CTA の近くに出し、入力と選択を残す', async () => {
    server({ post: () => json({ error: { code: 'internal', message: 'x' } }, 500) });
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('支出名'), { target: { value: '新規採用ツール' } });
    setAmount('80000');
    pick(/地代家賃/);
    fireEvent.click(screen.getByRole('button', { name: 'この試算を記録する' }));
    const selection = bar() as HTMLElement;
    expect((await within(selection).findByRole('alert')).textContent).toBe(
      '記録できませんでした。入力は残っています',
    );
    expect((screen.getByLabelText('支出名') as HTMLInputElement).value).toBe('新規採用ツール');
    expect((screen.getByRole('checkbox', { name: /地代家賃/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('記録後の再取得が失敗しても取得済み画面と入力を残す', async () => {
    const { tradeoffGets } = server({
      gets: [payload(), () => json({ error: { code: 'internal', message: 'x' } }, 500)],
    });
    renderPage();
    await ready();
    setAmount('80000');
    pick(/地代家賃/);
    fireEvent.click(screen.getByRole('button', { name: 'この試算を記録する' }));
    await waitFor(() => expect(tradeoffGets()).toBe(2));
    expect(
      await screen.findByText(
        '最新情報を再取得できませんでした。表示中の入力と試算結果はそのまま確認できます。',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: /2\.\s*見直し候補の選択/ })).toBeTruthy();
    expect((screen.getByLabelText('金額') as HTMLInputElement).value).toBe('80000');
    expect((screen.getByRole('checkbox', { name: /地代家賃/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe('必要度とメモの上書き (FR-7)', () => {
  it('必要度を変えると 1 候補だけ PUT し、tradeoff を取り直す', async () => {
    const { fetchMock, tradeoffGets } = server();
    renderPage();
    await ready();
    fireEvent.change(screen.getByRole('combobox', { name: /外注費.*必要度/ }), { target: { value: 'high' } });
    await waitFor(() => expect(tradeoffGets()).toBe(2));
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT');
    expect(String(put?.[0])).toBe(`/api/tradeoff/candidates/${encodeURIComponent(OUTSOURCE)}`);
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ need: 'high', memo: null });
  });

  it('『自動に戻す』は need を null で送り、既存のメモは残す', async () => {
    const { fetchMock } = server();
    renderPage();
    await ready();
    fireEvent.change(screen.getByRole('combobox', { name: /広告宣伝費.*必要度/ }), {
      target: { value: 'auto' },
    });
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ need: null, memo: '展示会の前だけ' });
  });

  it('メモの保存は手動の必要度を保ったまま送る', async () => {
    const { fetchMock } = server();
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: /通信費.*メモを編集/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /通信費.*のメモ/ }), {
      target: { value: '来月解約' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'メモを保存' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ need: 'high', memo: '来月解約' });
  });

  it('上書きに失敗したら行に文を出す', async () => {
    server({ put: () => json({ error: { code: 'internal', message: 'x' } }, 500) });
    renderPage();
    await ready();
    fireEvent.change(screen.getByRole('combobox', { name: /外注費.*必要度/ }), { target: { value: 'high' } });
    expect(await screen.findByText('必要度を保存できませんでした。もう一度お試しください')).toBeTruthy();
  });

  it('メモの保存に失敗しても編集を閉じず、入力値を残す', async () => {
    server({ put: () => json({ error: { code: 'internal', message: 'x' } }, 500) });
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: /通信費.*メモを編集/ }));
    const memo = screen.getByRole('textbox', { name: /通信費.*のメモ/ }) as HTMLTextAreaElement;
    fireEvent.change(memo, { target: { value: '来月解約' } });
    fireEvent.click(screen.getByRole('button', { name: 'メモを保存' }));
    expect(await screen.findByText('メモを保存できませんでした。入力内容は残っています')).toBeTruthy();
    expect(memo.value).toBe('来月解約');
    expect(screen.getByRole('button', { name: 'メモを保存' })).toBeTruthy();
  });
});

describe('見た目の約束 (C2)', () => {
  const dir = resolve(process.cwd(), 'src/pages/tradeoff');
  const sources = readdirSync(dir)
    .filter((f) => /\.(tsx?|css)$/.test(f) && !f.includes('.test.'))
    .map((f) => ({ f, text: readFileSync(resolve(dir, f), 'utf8') }));

  it('画面の部品が揃っている', () => {
    const names = sources.map((s) => s.f);
    for (const f of ['TradeoffPage.tsx', 'view-model.ts', 'tradeoff.css']) expect(names).toContain(f);
  });

  it('色の直書きが無い', () => {
    const hits = sources.flatMap(({ f, text }) =>
      (text.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/gi) ?? []).map((m) => `${f}: ${m}`),
    );
    expect(hits).toEqual([]);
  });

  it('右カラム幅・タップ領域・sticky 位置はデザイントークンを使う', () => {
    const css = sources.find((source) => source.f === 'tradeoff.css')?.text ?? '';
    expect(css).toContain('var(--aside-panel-w)');
    expect(css).toContain('var(--tap-target-min)');
    expect(css).toContain('top: calc(var(--header-h) + 16px)');
    expect(css).not.toMatch(/\b320px\b|min-height:\s*44px/);
  });

  it('候補キー配列は join せず要素ごとに比較する', () => {
    expect(sameCandidateKeys(['a,b', 'c'], ['a', 'b,c'])).toBe(false);
    expect(sameCandidateKeys(['a,b', 'c'], ['a,b', 'c'])).toBe(true);
  });

  it('ボタンは共通 Button、ページは PageHeader / PageState / PageActions を使う', () => {
    const page = sources.find((s) => s.f === 'TradeoffPage.tsx')?.text ?? '';
    for (const part of ['PageHeader', 'PageState']) expect(page).toContain(part);
    expect(page).not.toContain('<PageShell');
    expect(sources.some(({ text }) => text.includes('PageActions'))).toBe(true);
    const usesButton = sources.some(({ text }) => text.includes("from '../../components/Button.js'"));
    expect(usesButton).toBe(true);
  });
});
