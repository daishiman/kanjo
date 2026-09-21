// @vitest-environment jsdom

/**
 * AI分析画面の受入条件 (spec-ai-analysis-screen「DOM 受入条件」)。
 * - 一覧は依頼と実行状況に絞り、IDから詳細専用URLへ移動する
 * - 補足指示の字数と下書き復元、2 種類のコピー、clipboard に書けないときの逃げ道
 * - 実行中の 7 列と、行・ID・詳細操作から同じ詳細専用URLへ移動すること
 * - 取り込み先の自動決定、構文エラーの行表示と入力の保持、サーバの拒否理由
 * - 詳細 5 タブ、統計的事実・解釈・背景仮説の分離、版履歴・比較、URL からの復元
 * - レポート量の選択 (簡潔 / 標準 / 詳細)、既定は標準、再分析の導線
 * - 読込・空・失敗の各状態
 * 架空の依頼とレポートだけを使い、実データには触れない。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiReportBody, AiReportRow, AiTaskView } from '../../api.js';
import { AiPage } from './AiPage.js';
import { AiReportLibraryPage, AiReportPage } from './AiReportPages.js';
import { AiTaskDetailPage } from './AiTaskDetailPage.js';
import {
  AI_TASKS_REFETCH_MS,
  aiProgressText,
  aiRangeOf,
  aiTaskActions,
  aiTaskSummaryLine,
  aiTasksRefetchMs,
  readAiUrl,
} from './view-model.js';

/* ------------------------------ fixtures ------------------------------ */

const USER_ID = 'u-test';
const PERIOD = { from: '2025-09', to: '2026-08' };

type Stage = AiTaskView['stage'];
const task = (id: string, stage: Stage, seq: number, over: Partial<AiTaskView> = {}): AiTaskView => ({
  id,
  period: PERIOD,
  type: 'annual',
  label: '2025年9月〜2026年8月',
  supplement: null,
  copiedAt: null,
  copiedTarget: null,
  parentReportId: null,
  expiresAt: '2026-09-21T00:00:00.000Z',
  createdAt: `2026-09-1${seq}T00:00:00.000Z`,
  reportId: stage === 'done' ? 'rep-2' : null,
  status: stage === 'done' ? 'done' : stage === 'waiting' || stage === 'running' ? 'waiting' : 'expired',
  seq,
  displayId: `T-000${seq}`,
  stage,
  progress: stage === 'done' ? 100 : stage === 'running' ? 50 : stage === 'waiting' ? 0 : null,
  dataFetchedAt: stage === 'running' ? '2026-09-12T01:00:00.000Z' : null,
  rejectedAt: null,
  rejectCount: 0,
  canceledAt: stage === 'canceled' ? '2026-09-12T02:00:00.000Z' : null,
  ...over,
});

const row = (id: string, version: number, over: Partial<AiReportRow> = {}): AiReportRow => ({
  id,
  taskId: `task-${id}`,
  period: PERIOD,
  type: 'annual',
  label: '2025年9月〜2026年8月',
  version,
  parentReportId: version > 1 ? 'rep-1' : null,
  generatedBy: 'claude-code',
  title: '架空の年次レポート',
  summary: `架空の総評 v${version}。`,
  createdAt: `2026-09-0${version}T00:00:00.000Z`,
  archivedAt: null,
  ...over,
});

const finding = (label: string) => ({
  label,
  fact: `${label}の事実。`,
  basis: '架空の計算根拠',
  interpretation: `${label}の解釈。`,
  action: `${label}への対応`,
  expectedEffect: null,
  amount: 10000,
  priority: 'high' as const,
  chart: null,
});

const bodyOf = (r: AiReportRow): AiReportBody => ({
  version: 4,
  generatedBy: r.generatedBy,
  model: 'test-model',
  title: r.title,
  analysisDepth: 'standard',
  summary: r.summary,
  keyFindings: {
    improvements: [finding('架空の改善点')],
    wasted: [],
    quickWins: [finding('架空のすぐ効く対策')],
    notes: { improvements: '', wasted: '架空の理由で該当なし', quickWins: '' },
  },
  sections: [
    {
      id: 'spend',
      title: '何にいくらかかっているか',
      body: '架空の内訳の説明。',
      items: [{ label: '架空の科目', amount: 120000, note: '架空の注記', priority: null }],
      gap: null,
    },
  ],
  followUp: null,
  needs: [{ gap: '架空の不足情報', action: '名義を割り当てる', screen: 'settings' }],
  charts: [],
  dataGaps: ['架空のデータ不足'],
  contextAnalysis: {
    externalResearch: 'off',
    questionType: 'relationship',
    question: {
      decision: '架空の費用見直しを決める',
      metric: '架空の支出額',
      comparison: '前期と当期',
      range: '2025年9月〜2026年8月',
    },
    interviewFacts: [
      {
        id: 'interview-1',
        source: 'user_reported',
        question: '対象期間に何が起きましたか',
        answer: '架空の事業所移転があった',
      },
    ],
    statisticalFacts: [
      {
        id: 'fact-1',
        statement: '架空の支出は120,000円です。',
        basis: 'sections.spend.items[0].amountの120,000円',
        evidenceRefs: ['sections.spend.items[0]'],
      },
    ],
    interpretations: [
      {
        statement: '架空の科目が見直し候補です。',
        factRefs: ['fact-1'],
        limitation: '比較対象が限られるため因果は断定できません。',
      },
    ],
    externalEvidence: [],
    causalHypotheses: [
      {
        role: 'primary',
        hypothesis: '移転に伴う支出が増加分に関連した可能性がある',
        cause: '架空の事業所移転',
        mechanism: '移転関連支出の発生',
        outcome: '架空の支出額の増加',
        evidenceFor: ['移転の利用者回答がある'],
        evidenceAgainst: ['移転前後の月別比較は未確認'],
        confounders: ['季節性'],
        falsificationCondition: '移転前後で支出に変化がなければ崩れる',
        evidenceLevel: 'user_reported',
        evidenceRefs: ['interview-1'],
        confidence: 'medium',
        validationAction: '移転前後の月別支出を確認する',
      },
      {
        role: 'alternative',
        hypothesis: '季節性による変動の可能性もある',
        cause: '架空の季節性',
        mechanism: '季節需要の変化',
        outcome: '架空の支出額の増加',
        evidenceFor: ['同じ時期に支出が集中している可能性'],
        evidenceAgainst: ['前年同期比較はデータ不足'],
        confounders: ['価格改定'],
        falsificationCondition: '前年同期に同じ変動がなければ崩れる',
        evidenceLevel: 'assumption',
        evidenceRefs: [],
        confidence: 'low',
        validationAction: '前年同期データを取り込む',
      },
    ],
  },
});

const REPORTS = [row('rep-2', 2), row('rep-1', 1)];

/* ------------------------------ fetch stub ------------------------------ */

interface Call {
  url: string;
  method: string;
  body: string | null;
}
type Handler = (call: Call) => Response | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubApi({
  tasks = [] as AiTaskView[],
  reports = REPORTS,
  extra,
}: {
  tasks?: AiTaskView[];
  reports?: AiReportRow[];
  extra?: Handler;
} = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      };
      calls.push(call);
      const hit = extra?.(call);
      if (hit) return hit;
      const { url, method } = call;
      if (url.endsWith('/auth/me')) return json({ user: { id: USER_ID } });
      if (url.includes('/summary'))
        return json({
          overview: { months: [] },
          defense: {},
          benchmarks: [],
          period: {
            applied: PERIOD,
            label: '最新1年',
            full: { from: '2023-01', to: '2026-08' },
            years: [],
            monthCount: 44,
          },
        });
      if (url.includes('/ai/inventory'))
        return json({
          period: { ...PERIOD, label: '2025年9月〜2026年8月' },
          freeeDeals: 1234,
          mfTransactions: 567,
          categories: 32,
          counterparties: 89,
        });
      if ((url.endsWith('/ai/tasks') || url.includes('/ai/tasks?')) && method === 'GET')
        return json({ tasks });
      if (url.includes('/ai/reports?archived=1')) return json({ reports, archivedCount: 0 });
      if (url.endsWith('/ai/reports')) return json({ reports, archivedCount: 0 });
      const m = url.match(/\/ai\/reports\/([\w-]+)$/);
      if (m && method === 'GET') {
        const r = reports.find((x) => x.id === m[1]);
        if (!r) return json({ error: { code: 'not_found', message: 'not found' } }, 404);
        const versions = [...reports]
          .sort((a, b) => a.version - b.version)
          .map((v) => ({ ...v, versionNote: v.version === 1 ? '初回の分析' : '架空の補足指示' }));
        return json({ report: { ...r, body: bodyOf(r) }, previous: null, versions });
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  return calls;
}

function LocationProbe() {
  const loc = useLocation();
  return (
    <output data-testid="location">
      {loc.pathname}
      {loc.search}
    </output>
  );
}

function mount(entry = '/ai') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/ai" element={<AiPage />} />
          <Route path="/ai/tasks/:taskId" element={<AiTaskDetailPage />} />
          <Route path="/ai/reports" element={<AiReportLibraryPage />} />
          <Route path="/ai/reports/:reportId" element={<AiReportPage />} />
        </Routes>
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const search = () => screen.getByTestId('location').textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // clipboard は各テストで差し替える。残すと他のテストが書けた扱いになる
  Reflect.deleteProperty(navigator, 'clipboard');
});

/* ------------------------------ 画面の骨格 ------------------------------ */

describe('一覧と詳細専用画面の構成', () => {
  it('一覧は 1.依頼 → 2.実行中 に絞り、レポートは別の専用画面へ分ける', async () => {
    stubApi();
    mount();
    expect(
      screen.getByRole('heading', { level: 2, name: 'AIに分析を依頼し、根拠と版を確認しますか？' }),
    ).toBeTruthy();
    const steps = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((t) => /^\d\./.test(t ?? ''));
    expect(steps).toEqual(['1. 依頼', '2. 実行中']);
    expect(screen.getByRole('link', { name: '保存済みレポート' }).getAttribute('href')).toBe('/ai/reports');
  });

  it('対象期間は共通の期間と同じ範囲を出し、使用するデータの件数を並べる', async () => {
    stubApi();
    mount();
    expect(await screen.findByText('2025年9月 - 2026年8月（1年）')).toBeTruthy();
    const inventory = screen.getByRole('complementary', { name: '使用するデータ' });
    expect(await within(inventory).findByText('1,234件')).toBeTruthy();
    expect(within(inventory).getByText('567件')).toBeTruthy();
    expect(within(inventory).getByText('32件')).toBeTruthy();
    expect(within(inventory).getByText('89件')).toBeTruthy();
    expect(screen.getByText(/データは自動送信されません/)).toBeTruthy();
    // 依頼がまだ無いので、AIに渡すデータは確認できない
    expect(
      (within(inventory).getByRole('button', { name: '使用データを確認' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

/* ------------------------------ 1. 依頼 ------------------------------ */

describe('1. 依頼', () => {
  it('補足指示の字数を数え、下書きを保存して開き直すと戻す', async () => {
    stubApi();
    const first = mount();
    const box = screen.getByRole('textbox', { name: 'その他の補足（任意）' }) as HTMLTextAreaElement;
    expect(screen.getByText('その他の補足 0/1000')).toBeTruthy();
    // 下書きは利用者ごとに保存する。利用者 (/auth/me) が決まる前の入力は保存先が無いので、決まるのを待つ
    await screen.findByText('2025年9月 - 2026年8月（1年）');
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.change(box, { target: { value: '架空の観点' } });
    expect(screen.getByText('その他の補足 5/1000')).toBeTruthy();
    expect(await screen.findByText(/下書きを自動保存しました/)).toBeTruthy();
    first.unmount();

    mount();
    await waitFor(() =>
      expect(
        (screen.getByRole('textbox', { name: 'その他の補足（任意）' }) as HTMLTextAreaElement).value,
      ).toBe('架空の観点'),
    );
  });

  it('レポート量は標準が既定で、利用者が簡潔・詳細へ変えられる', async () => {
    stubApi();
    mount();
    const depth = screen.getByRole('combobox', { name: 'レポートの量' }) as HTMLSelectElement;
    expect(depth.value).toBe('standard');
    expect(
      within(depth)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['簡潔（主要論点だけ）', '標準（おすすめ）', '詳細（対立仮説・限界も詳しく）']);
    fireEvent.change(depth, { target: { value: 'detailed' } });
    expect(depth.value).toBe('detailed');
  });

  it('Claude Code 用のコピーは依頼を作り、コピー先を記録し、下書きを消す', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const created = task('t-new', 'waiting', 5);
    const calls = stubApi({
      extra: ({ url, method }) => {
        if (url.endsWith('/ai/tasks') && method === 'POST')
          return json({ task: created, prompt: '架空のプロンプト' }, 201);
        if (url.endsWith('/ai/tasks/t-new/copied')) return json({ ok: true });
        return undefined;
      },
    });
    mount();
    await screen.findByText('2025年9月 - 2026年8月（1年）');
    fireEvent.click(screen.getByRole('button', { name: 'プロンプトをコピー' }));

    expect(
      await screen.findByText('コピーしました。Claude Code に貼り付けて実行してください。'),
    ).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('架空のプロンプト');
    const post = calls.find((c) => c.url.endsWith('/ai/tasks') && c.method === 'POST');
    const request = JSON.parse(post?.body ?? '{}');
    expect(request.from).toBe(PERIOD.from);
    expect(request.to).toBe(PERIOD.to);
    expect(request.target).toBe('claude_code');
    expect(request.supplement).toContain('レポート量: standard');
    expect(request.supplement).toContain('知りたいこと: 未回答');
    const copied = calls.find((c) => c.url.endsWith('/copied'));
    expect(JSON.parse(copied?.body ?? '{}')).toEqual({ target: 'claude_code' });
    expect(window.localStorage.getItem(`kanjo:ai:supplement-draft:${USER_ID}`)).toBeNull();
    // 作った依頼を選択中にする
    await waitFor(() => expect(search()).toBe('/ai/tasks/t-new'));
  });

  it('ヒアリングと詳細量をプロンプトに明示し、事実と背景仮説の分離に使える', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => {}) },
      configurable: true,
    });
    const calls = stubApi({
      extra: ({ url, method }) => {
        if (url.endsWith('/ai/tasks') && method === 'POST')
          return json({ task: task('t-new', 'waiting', 5), prompt: '架空のプロンプト' }, 201);
        if (url.endsWith('/ai/tasks/t-new/copied')) return json({ ok: true });
        return undefined;
      },
    });
    mount();
    await screen.findByText('2025年9月 - 2026年8月（1年）');
    fireEvent.change(screen.getByRole('combobox', { name: 'レポートの量' }), {
      target: { value: 'detailed' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '今回いちばん知りたいこと' }), {
      target: { value: '費用が増減した理由を知りたい' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '対象期間に起きた変化' }), {
      target: { value: '4月に架空の移転' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'プロンプトをコピー' }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/copied'))).toBe(true));
    const posted = JSON.parse(
      calls.find((call) => call.url.endsWith('/ai/tasks') && call.method === 'POST')?.body ?? '{}',
    );
    expect(posted.supplement).toContain('レポート量: detailed');
    expect(posted.supplement).toContain('知りたいこと: 費用が増減した理由を知りたい');
    expect(posted.supplement).toContain('対象期間に起きた変化: 4月に架空の移転');
  });

  it('clipboard に書けないときは選択できる欄にプロンプトを出し、コピー済みとは記録しない', async () => {
    const calls = stubApi({
      extra: ({ url, method }) =>
        url.endsWith('/ai/tasks') && method === 'POST'
          ? json({ task: task('t-new', 'waiting', 5), prompt: '架空のプロンプト' }, 201)
          : undefined,
    });
    mount();
    await screen.findByText('2025年9月 - 2026年8月（1年）');
    // 宛先は依頼の条件として選ぶ。ボタンは1つで、選んだ相手ぶんの指示文ができる
    fireEvent.change(screen.getByLabelText('実行する相手'), { target: { value: 'codex' } });
    fireEvent.click(screen.getByRole('button', { name: 'プロンプトをコピー' }));

    const fallback = (await screen.findByRole('textbox', {
      name: '貼り付け用のプロンプト',
    })) as HTMLTextAreaElement;
    expect(fallback.value).toBe('架空のプロンプト');
    // 選んだ宛先は依頼の作成時に渡る (指示文はトークンを含むので後から作り直せない)
    const posted = calls.find((c) => c.url.endsWith('/ai/tasks') && c.method === 'POST');
    expect(JSON.parse(posted?.body ?? '{}').target).toBe('codex');
    expect(calls.some((c) => c.url.endsWith('/copied'))).toBe(false);
  });
});

/* ------------------------------ 2. 実行中から専用画面へ ------------------------------ */

describe('2. 実行中と依頼詳細', () => {
  it('7 列の表を出す', async () => {
    stubApi({
      tasks: [task('t-done', 'done', 1), task('t-wait', 'waiting', 2), task('t-run', 'running', 3)],
    });
    mount();
    const table = await screen.findByRole('table', { name: '依頼した分析タスクの一覧' });
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(heads).toEqual(['ID', 'ステータス', '依頼期間', '作成日時', '進捗', '依頼内容', '操作']);
  });

  it('ID を押すと依頼の詳細専用URLへ移動する', async () => {
    stubApi({
      tasks: [
        task('t-wait', 'waiting', 2, {
          copiedAt: '2026-01-31T09:00:00.000Z',
          copiedTarget: 'codex',
        }),
        task('t-run', 'running', 3),
      ],
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'T-0002' }));
    await waitFor(() => expect(search()).toBe('/ai/tasks/t-wait'));
    expect(await screen.findByRole('heading', { name: '分析依頼の状況' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /待機中 補足指示なし/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '次にすること' })).toBeTruthy();
    expect(screen.getByText(/Codexへ 2026\/01\/31 18:00にコピー済み/)).toBeTruthy();
  });

  it('完了の「詳細」は依頼専用URLでレポートを開く', async () => {
    stubApi({ tasks: [task('t-done', 'done', 1)] });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: '詳細' }));
    await waitFor(() => expect(search()).toBe('/ai/tasks/t-done'));
    expect(await screen.findByRole('heading', { name: /架空の年次レポート v2/ })).toBeTruthy();
  });

  it('依頼が 1 件も無ければその旨を案内する', async () => {
    stubApi();
    mount();
    expect(await screen.findByText('まだ依頼はありません')).toBeTruthy();
  });
});

/* ------------------------------ 3. 取り込み ------------------------------ */

describe('結果の取り込み', () => {
  it('結果待ちが無ければ取り込めない', async () => {
    stubApi({ tasks: [task('t-done', 'done', 1)] });
    mount('/ai/tasks/t-done');
    expect(await screen.findByRole('heading', { name: /架空の年次レポート v2/ })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '結果のJSON' })).toBeNull();
  });

  it('結果待ちが 1 件なら取り込み先に選ぶ。構文エラーは行を示し、入力を残し、送らない', async () => {
    const calls = stubApi({ tasks: [task('t-done', 'done', 1), task('t-wait', 'waiting', 2)] });
    mount('/ai/tasks/t-wait');
    expect(await screen.findByText('取り込み先: T-0002(2025年9月〜2026年8月)')).toBeTruthy();
    const box = screen.getByRole('textbox', { name: '結果のJSON' }) as HTMLTextAreaElement;
    const broken = '{\n  "title": "x",\n  oops\n}';
    fireEvent.change(box, { target: { value: broken } });
    fireEvent.click(screen.getByRole('button', { name: '結果を取り込む' }));

    expect((await screen.findByRole('alert')).textContent).toContain('3行目で不正な文字があります');
    expect(box.value).toBe(broken);
    expect(calls.some((c) => c.url.includes('/paste'))).toBe(false);
  });

  it('サーバが形式不足で拒否したら理由を並べ、入力を残す', async () => {
    stubApi({
      tasks: [task('t-wait', 'waiting', 2)],
      extra: ({ url }) =>
        url.endsWith('/ai/tasks/t-wait/paste')
          ? json(
              {
                error: {
                  code: 'invalid_report',
                  message: 'invalid',
                  issues: [{ path: ['summary'], message: '必須です' }, '図の id が不明です'],
                },
              },
              422,
            )
          : undefined,
    });
    mount('/ai/tasks/t-wait');
    await screen.findByText(/取り込み先: T-0002/);
    const box = screen.getByRole('textbox', { name: '結果のJSON' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '{"title":"x"}' } });
    fireEvent.click(screen.getByRole('button', { name: '結果を取り込む' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('レポートの形式が足りていません');
    expect(within(alert).getByText('summary: 必須です')).toBeTruthy();
    expect(within(alert).getByText('図の id が不明です')).toBeTruthy();
    expect(box.value).toBe('{"title":"x"}');
  });

  it('取り込めたら入力を消し、保存したレポートを開く', async () => {
    let imported = false;
    const waiting = task('t-wait', 'waiting', 2);
    const done = task('t-wait', 'done', 2, { reportId: 'rep-2' });
    const calls = stubApi({
      tasks: [waiting],
      extra: ({ url, method }) => {
        if (url.endsWith('/ai/tasks/t-wait/paste')) {
          imported = true;
          return json({ ok: true, reportId: 'rep-2' });
        }
        if (url.includes('/ai/tasks?id=t-wait') && method === 'GET') {
          return json({ tasks: [imported ? done : waiting] });
        }
        return undefined;
      },
    });
    mount('/ai/tasks/t-wait');
    await screen.findByText(/取り込み先: T-0002/);
    const box = screen.getByRole('textbox', { name: '結果のJSON' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '{ "title": "x" }' } });
    fireEvent.click(screen.getByRole('button', { name: '結果を取り込む' }));

    expect(await screen.findByRole('heading', { name: /架空の年次レポート v2/ })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '結果のJSON' })).toBeNull();
    expect(search()).toBe('/ai/tasks/t-wait');
    // 整形し直さずに送る (サーバが返す位置と画面の行を揃える)
    expect(calls.find((c) => c.url.includes('/paste'))?.body).toBe('{ "title": "x" }');
  });
});

/* ------------------------------ 3. レポート詳細 ------------------------------ */

describe('レポートの一覧と詳細', () => {
  it('一覧は検索で絞り込め、当たらなければその旨を出す', async () => {
    stubApi({
      reports: [row('rep-2', 2), row('rep-9', 1, { title: '架空の月次レポート', summary: '別の総評' })],
    });
    mount('/ai/reports');
    await screen.findByRole('button', { name: '架空の年次レポート' });
    const box = screen.getByRole('searchbox', { name: 'レポートを検索' });
    fireEvent.change(box, { target: { value: '月次' } });
    expect(screen.getByRole('button', { name: '架空の月次レポート' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '架空の年次レポート' })).toBeNull();
    fireEvent.change(box, { target: { value: '該当しない語' } });
    expect(screen.getByText('「該当しない語」に当たるレポートはありません')).toBeTruthy();
  });

  it('専用URLの report と tab から詳細を復元し、5 タブを矢印キーで移れる', async () => {
    stubApi();
    mount('/ai/reports/rep-2?tab=evidence');
    expect(await screen.findByRole('heading', { name: /架空の年次レポート v2/ })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      '要約',
      '根拠データ',
      '背景仮説',
      '改善提案',
      '関連リンク',
    ]);
    expect(screen.getByRole('tab', { name: '根拠データ' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('架空の科目');
    expect(screen.getByRole('tabpanel').textContent).toContain('架空のデータ不足');

    fireEvent.keyDown(screen.getByRole('tab', { name: '根拠データ' }), { key: 'ArrowRight' });
    await waitFor(() => expect(search()).toContain('tab=context'));
    expect(screen.getByRole('tabpanel').textContent).toContain('統計的事実');

    fireEvent.keyDown(screen.getByRole('tab', { name: '背景仮説' }), { key: 'ArrowRight' });
    await waitFor(() => expect(search()).toContain('tab=improvements'));
    expect(screen.getByRole('tabpanel').textContent).toContain('架空のすぐ効く対策');

    fireEvent.click(screen.getByRole('tab', { name: '関連リンク' }));
    await waitFor(() => expect(search()).toContain('tab=links'));
    expect(screen.getByRole('tabpanel').textContent).toContain('架空の不足情報');

    // 既定の要約タブは URL に書かない
    fireEvent.click(screen.getByRole('tab', { name: '要約' }));
    await waitFor(() => expect(search()).not.toContain('tab='));
    expect(screen.getByRole('tabpanel').textContent).toContain('架空の総評 v2。');
  });

  it('壊れた tab は既定の要約へ倒し、画面を失敗にしない', async () => {
    stubApi();
    mount('/ai/reports/rep-2?tab=unknown');
    expect(await screen.findByRole('heading', { name: /架空の年次レポート v2/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '要約' }).getAttribute('aria-selected')).toBe('true');
  });

  it('無いレポートを開くと「見つかりません」を出す', async () => {
    stubApi();
    mount('/ai/reports/rep-missing');
    expect(await screen.findByText('レポートが見つかりません')).toBeTruthy();
  });

  it('版履歴は新しい順に並び、1 つ前の版と比較できる', async () => {
    stubApi();
    mount('/ai/reports/rep-2');
    await screen.findByRole('heading', { name: /架空の年次レポート v2/ });
    expect(screen.getByText('v2(表示中)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'v1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '比較する' }));
    expect(await screen.findByText(/架空の総評 v1。/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '比較を閉じる' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'v1' }));
    await waitFor(() => expect(search()).toBe('/ai/reports/rep-1'));
    expect(await screen.findByText('v1(表示中)')).toBeTruthy();
  });

  it('版が 1 つだけなら比較できない理由を出す', async () => {
    stubApi({ reports: [row('rep-1', 1)] });
    mount('/ai/reports/rep-1');
    expect(await screen.findByText('比較できる版がありません(比較は v2 から)。')).toBeTruthy();
  });

  it('統計的事実、解釈、主仮説・対立仮説を別の領域で表示する', async () => {
    stubApi();
    mount('/ai/reports/rep-2?tab=context');
    await screen.findByRole('heading', { name: /架空の年次レポート v2/ });
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: '統計的事実' })).toBeTruthy();
    expect(within(panel).getByText('架空の支出は120,000円です。')).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: '解釈' })).toBeTruthy();
    expect(within(panel).getByText('架空の科目が見直し候補です。')).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: '背景の仮説と反証' })).toBeTruthy();
    expect(within(panel).getByText(/^主仮説: 移転に伴う支出/)).toBeTruthy();
    expect(within(panel).getByText(/^対立仮説: 季節性による変動/)).toBeTruthy();
    expect(
      within(panel).getByText('ここに出すのは因果の断定ではなく、関連から組み立てた未検証の仮説です。'),
    ).toBeTruthy();
  });

  it('改訂版の導線は元レポートと方式を依頼画面のクエリで引き継ぐ', async () => {
    stubApi();
    mount('/ai/reports/rep-2?tab=improvements');
    fireEvent.click(await screen.findByRole('button', { name: '改訂版を作る(第3版)' }));
    await waitFor(() => expect(search()).toBe('/ai?reanalyze=rep-2&mode=revise'));
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          (element.textContent?.includes('「架空の年次レポート」(第2版)を元に改訂版(次の版)を作ります') ??
            false),
      ),
    ).toBeTruthy();
  });
});

/* ------------------------------ 読込と失敗 ------------------------------ */

describe('読込と失敗の状態', () => {
  it('依頼一覧の取得に失敗したら理由と再読込を出し、依頼フォームは動かす', async () => {
    stubApi({
      extra: ({ url, method }) =>
        (url.endsWith('/ai/tasks') && method === 'GET') || url.endsWith('/ai/reports')
          ? json({ error: { code: 'internal', message: 'x' } }, 500)
          : undefined,
    });
    mount();
    expect(await screen.findByText(/依頼を読み込めませんでした/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '再読込' })).toBeTruthy();
    expect(await screen.findByText('2025年9月 - 2026年8月（1年）')).toBeTruthy();
  });

  it('保存済みレポート一覧の取得失敗は専用画面で再読込できる', async () => {
    stubApi({
      extra: ({ url }) =>
        url.endsWith('/ai/reports') ? json({ error: { code: 'internal', message: 'x' } }, 500) : undefined,
    });
    mount('/ai/reports');
    expect(await screen.findByText(/レポートを読み込めませんでした/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '再読込' })).toBeTruthy();
  });

  it('依頼一覧の読み込み中はその旨を出す', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    mount();
    expect(screen.getByText('依頼を読み込み中…')).toBeTruthy();
    expect(screen.getByText('期間を読み込み中…')).toBeTruthy();
  });

  it('レポート専用URLの読み込み中はその旨を出す', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    mount('/ai/reports/rep-2');
    expect(screen.getByText('レポートを読み込み中…')).toBeTruthy();
  });
});

/* ------------------------------ view-model ------------------------------ */

describe('view-model', () => {
  it('readAiUrl はタブだけを読み、旧 task/report クエリは状態として復元しない', () => {
    expect(readAiUrl(new URLSearchParams('task=t-1&report=rep_2&tab=links'))).toEqual({ tab: 'links' });
    expect(readAiUrl(new URLSearchParams('task=t-1&report=rep_2&tab=nope'))).toEqual({ tab: 'summary' });
  });

  it('進捗と依頼内容の表記', () => {
    expect(aiProgressText(0)).toBe('0%');
    expect(aiProgressText(75)).toBe('75%');
    expect(aiProgressText(null)).toBe('-');
    expect(aiTaskSummaryLine(null)).toBe('補足指示なし');
    expect(aiTaskSummaryLine('1行目\n2行目')).toBe('1行目');
  });

  it('段階ごとの操作', () => {
    expect(aiTaskActions('waiting')).toEqual(['cancel']);
    expect(aiTaskActions('running')).toEqual(['cancel']);
    expect(aiTaskActions('done')).toEqual(['detail']);
    expect(aiTaskActions('failed')).toEqual(['retry', 'delete']);
    expect(aiTaskActions('canceled')).toEqual(['retry', 'delete']);
  });

  it('結果待ちがあるあいだだけ 10 秒ごとに取り直す', () => {
    expect(AI_TASKS_REFETCH_MS).toBe(10_000);
    expect(aiTasksRefetchMs([{ stage: 'done' }, { stage: 'running' }])).toBe(10_000);
    expect(aiTasksRefetchMs([{ stage: 'waiting' }])).toBe(10_000);
    expect(aiTasksRefetchMs([{ stage: 'done' }, { stage: 'failed' }, { stage: 'canceled' }])).toBe(false);
    expect(aiTasksRefetchMs([])).toBe(false);
    expect(aiTasksRefetchMs(undefined)).toBe(false);
  });

  it('aiRangeOf は絞り込み後の範囲、全期間なら取込済みの全範囲を返す', () => {
    const meta = {
      applied: PERIOD,
      label: '',
      full: { from: '2023-01', to: '2026-08' },
      years: [],
      monthCount: 44,
    };
    expect(aiRangeOf(meta)).toEqual(PERIOD);
    expect(aiRangeOf({ ...meta, applied: null })).toEqual({ from: '2023-01', to: '2026-08' });
    expect(aiRangeOf(undefined)).toBeNull();
  });
});
