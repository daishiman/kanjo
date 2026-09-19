// @vitest-environment jsdom

/**
 * 診断画面の表示契約 (テスト計画 §7 / AC-001・AC-005)。
 *
 * この画面の目的は「いま何にいくら効くのかを 1 枚で決める」ことなので、
 * ブロックが揃うこと・判断が色ではなく文字で読めること・選択が URL に残ること・
 * 実行先のリンクが絞込付きで向くこと・旧 Worker の応答で新ブロックを出さないことを固定する。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の画面は科目別プロファイルと自動診断だけを開いた状態で出す。条件の帯・
 * 健全性カード・改善アクションの表・ウォーターフォール・診断根拠・選択バーが無く、
 * `?action=` も読まないので、最初の 1 件を除くすべてが落ちる。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DiagnosisImprovement,
  DiagnosisResponse,
  DiagnosisScreen as DiagnosisScreenType,
} from './api.js';
import { DiagnosisPage } from './pages/analysis/Diagnosis.js';

// jsdom には canvas が無く、Chart.js が実サイズを測ろうとして落ちる。
// ここで見たいのは表と操作なので、グラフは差し替える
vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

// 検知器 id はレジストリに無い架空の値にする。画面が id を知らずに描けること (ADR-001) の裏づけで、
// core の registry-no-branch 検査 (web/api に検知器 id リテラル 0 件) もこのファイルを走査する
const improvement = (over: Partial<DiagnosisImprovement> = {}): DiagnosisImprovement => ({
  id: 'demo_fixed_cost',
  action_key: 'demo_fixed_cost:外注費',
  target: '外注費',
  label: '外注費 の固定費を見直す',
  detail: '直近3ヶ月平均 ¥300,000 の固定費。契約の棚卸しで 15% の圧縮を見込む。',
  severity: 'high',
  annualImpact: 540_000,
  monthlyImpact: 45_000,
  effort: 'medium',
  confidence: 'medium',
  impactBasis: 'recurring_monthly',
  scope: 'business',
  metric: 'expense',
  claimKeys: ['business:category:demo'],
  evidence: [
    {
      label: '直近3ヶ月平均',
      value: 300_000,
      baseline: 280_000,
      period: '2026-01〜2026-03',
      source: 'freee 取引 (科目別集計)',
    },
  ],
  nextAction: { label: '契約を棚卸しする', to: '/subscriptions?account=外注費' },
  status: '未着手',
  note: null,
  decided_at: null,
  ...over,
});

const SECOND = improvement({
  id: 'demo_unclassified',
  action_key: 'demo_unclassified:未分類',
  target: '未分類',
  label: '未分類の明細を減らす',
  detail: '直近月の未分類が ¥100,000 ある。',
  severity: 'low',
  annualImpact: 360_000,
  monthlyImpact: 30_000,
  effort: 'low',
  confidence: 'low',
  nextAction: { label: '分類する', to: '/classify?filter=未仕分け' },
});

const baseData: DiagnosisResponse = {
  entries: [
    {
      account: '外注費',
      profile: {
        mean: 280_000,
        sd: 20_000,
        cv: 0.07,
        med: 280_000,
        rAvg: 300_000,
        pAvg: 270_000,
        slope: 0.11,
        z: 1.0,
        lastVal: 300_000,
        type: '固定費',
        total: 3_360_000,
      },
      range: { lo: 260_000, hi: 300_000 },
      judge: 'やや高い',
      signals: ['上昇'],
    },
  ],
  kpi: {
    expenseMean: 500_000,
    expenseMedian: 480_000,
    expenseCv: 0.12,
    expenseSd: 60_000,
    months: 12,
    fixedCost: 300_000,
    totalRecent: 500_000,
    avgRevenue: 1_000_000,
    expenseRatio: 0.5,
  },
  bep: { breakEven: 600_000, avgRevenue: 1_000_000, revenueMonths: 12, safetyMargin: 0.4 },
  autoDiagnosis: [
    { kind: 'cut', tag: '削減', title: '外注費が上昇', body: '直近3ヶ月で上昇。', value: '¥300,000' },
  ],
};

const screenPart: Omit<DiagnosisScreenType, keyof DiagnosisResponse> = {
  selection: { scope: 'total', metric: 'expense', compare: 'previous' },
  improvements: [improvement(), SECOND],
  health: {
    score: 62,
    band: '注意',
    breakdown: [
      {
        key: 'fixed_cost_ratio',
        label: '固定費比率',
        actual: 0.3,
        score: 70,
        weight: 30,
        contribution: 21,
        unavailableReason: null,
      },
      {
        key: 'savings_rate',
        label: '貯蓄率',
        actual: 0.1,
        score: 50,
        weight: 30,
        contribution: 15,
        unavailableReason: null,
      },
      {
        key: 'stability',
        label: '収支の安定性',
        actual: null,
        score: null,
        weight: 0,
        contribution: 0,
        unavailableReason: '対象月が 3 ヶ月に満たないため',
      },
      {
        key: 'coverage',
        label: '記帳カバー率',
        actual: 1,
        score: 100,
        weight: 40,
        contribution: 40,
        unavailableReason: null,
      },
    ],
  },
  waterfall: [
    { key: 'base', label: '現状の年間経費', from: 0, to: 6_000_000, kind: 'base' },
    {
      key: 'demo_fixed_cost:外注費',
      label: '外注費 の固定費を見直す',
      from: 5_460_000,
      to: 6_000_000,
      kind: 'cut',
    },
    {
      key: 'demo_unclassified:未分類',
      label: '未分類の明細を減らす',
      from: 5_100_000,
      to: 5_460_000,
      kind: 'cut',
    },
    { key: 'result', label: '改善後の年間経費', from: 0, to: 5_100_000, kind: 'result' },
  ],
  signals: [
    {
      label: '外注費 の固定費を見直す',
      detail: '年間 ¥540,000 の改善余地。',
      tone: 'alert',
    },
  ],
  evidence: [
    {
      source: 'freee 取引 (事業)',
      period: '2025-04〜2026-03',
      coverage: 1,
      summary: '科目 8 件、記帳済み 12 / 12 ヶ月。',
      to: '/import',
    },
    {
      source: 'MoneyForward 明細 (個人)',
      period: '2025-04〜2026-03',
      coverage: null,
      summary: '明細 120 件、直近月の説明可能率 算出不能。',
      to: '/import',
    },
  ],
  totals: { active: 900_000, activeCount: 2, collapsed: 0, collapsedCount: 0 },
  scopeTotals: {
    current: 6_000_000,
    baseline: 5_000_000,
    diff: 1_000_000,
    rate: 0.2,
    baselineLabel: '前12か月',
    baselineRange: { from: '2024-04', to: '2025-03' },
    byScope: { total: 6_000_000, business: 4_500_000, household: 1_500_000 },
  },
};

const payload = (over: Partial<DiagnosisResponse> = {}): DiagnosisResponse => ({
  ...baseData,
  ...screenPart,
  ...over,
});

/** 呼ばれた URL と PATCH の本文を記録する。条件の切り替えと保存がサーバへ届くかを見るため */
function renderWith(over: Partial<DiagnosisResponse> = {}, initialEntry = '/analysis/diagnosis') {
  const calls: { url: string; method: string; body: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', body: (init?.body as string) ?? null });
      const body = init?.method === 'PATCH' ? { action_key: 'x', status: '対応中' } : payload(over);
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <DiagnosisPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('診断画面の表示', () => {
  it('既定の条件で、判断に必要なブロックが上から順に揃う', async () => {
    renderWith();
    await screen.findByRole('region', { name: '改善アクションの優先順位' });
    for (const name of [
      '診断の条件',
      '健全性スコア',
      '主なシグナル',
      '改善アクションの優先順位',
      '完了すると変わる指標',
      '診断の根拠',
    ]) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    // 合計はサーバの totals をそのまま出す (画面で足し直さない)
    const actions = screen.getByRole('region', { name: '改善アクションの優先順位' });
    expect(actions.textContent).toContain('未対応 2 件');
    expect(actions.textContent).toContain('¥900,000');
    // 健全性は点と区分の両方
    const health = screen.getByRole('region', { name: '健全性スコア' });
    expect(health.textContent).toContain('62');
    expect(health.textContent).toContain('注意');
    // 算出できない要素は 0 点ではなく理由を出す
    expect(health.textContent).toContain('対象月が 3 ヶ月に満たないため');
    // 初回はサーバ順位の先頭にある未対応 1 件を選び、根拠と実行先をすぐ確認できる
    expect(screen.getByRole('region', { name: '課題の詳細' }).textContent).toContain(
      '外注費 の固定費を見直す',
    );
    expect(screen.getByRole('region', { name: '選択中の課題' }).textContent).toContain(
      '外注費 の固定費を見直す',
    );
  });

  it('条件の帯は選んだ範囲×指標の期間合計と前期間比を出す (AC-006)', async () => {
    renderWith();
    const conditions = await screen.findByRole('region', { name: '診断の条件' });
    expect(conditions.textContent).toContain('総合の支出 (期間合計)');
    expect(conditions.textContent).toContain('¥6,000,000');
    expect(conditions.textContent).toContain('前12か月比');
    expect(conditions.textContent).toContain('+¥1,000,000');
  });

  it('範囲を切り替えるとサーバへ新しい条件で取り直す (AC-006)', async () => {
    // 帯が数値へ効いていることの要は「切り替えが取得条件になる」こと。
    // 画面側で絞り込むと、総収支画面と同じ経路で足した値でなくなる
    const calls = renderWith();
    fireEvent.click(await screen.findByRole('tab', { name: '事業' }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('scope=business'))).toBe(true));
  });

  it('比較できる月が揃わないときは差分ではなく理由を出す (BR-006)', async () => {
    renderWith({
      scopeTotals: {
        current: 6_000_000,
        baseline: null,
        diff: null,
        rate: null,
        baselineLabel: '前年同期',
        baselineRange: { from: '2024-04', to: '2025-03' },
        byScope: { total: 6_000_000, business: 4_500_000, household: 1_500_000 },
      },
    });
    const conditions = await screen.findByRole('region', { name: '診断の条件' });
    expect(conditions.textContent).toContain('前年同期は取込済みの月が足りず比較できません');
    expect(conditions.textContent).not.toContain('前年同期比');
  });

  it('統計の詳細は既定で閉じている', async () => {
    renderWith();
    const summary = await screen.findByText('統計の詳細 (科目別プロファイルと自動診断)');
    expect((summary.closest('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('統計の詳細は URL (stats=1) で開いた状態が復元する', async () => {
    // 共有した URL や再訪で同じ状態に戻れないと、閉じた情報は二度と見られない
    renderWith({}, '/analysis/diagnosis?stats=1');
    const summary = await screen.findByText('統計の詳細 (科目別プロファイルと自動診断)');
    expect((summary.closest('details') as HTMLDetailsElement).open).toBe(true);
    expect(summary.closest('details')?.textContent).toContain('外注費');
  });

  it('行を選ぶと詳細パネルが 3 タブで開き、選択が URL に載る', async () => {
    const calls = renderWith();
    fireEvent.click(await screen.findByRole('button', { name: '外注費 の固定費を見直す' }));

    const detail = await screen.findByRole('region', { name: '課題の詳細' });
    expect(
      within(detail)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['概要', '関連データ', '明細サンプル']);
    expect(screen.getByRole('region', { name: '選択中の課題' })).toBeTruthy();

    // 保存を押すと、URL エンコードした action_key 宛の PATCH になる
    const state = within(detail).getByText('対応状況とメモ').closest('details') as HTMLDetailsElement;
    fireEvent.click(within(state).getByText('対応中'));
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true));
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url).toContain(encodeURIComponent('demo_fixed_cost:外注費'));
    expect(JSON.parse(patch?.body ?? '{}').status).toBe('対応中');
  });

  it('実行先のリンクは絞込クエリ付きで向く', async () => {
    renderWith();
    fireEvent.click(await screen.findByRole('button', { name: '未分類の明細を減らす' }));
    const selection = await screen.findByRole('region', { name: '選択中の課題' });
    const link = within(selection).getByRole('link', { name: '分類する' }) as HTMLAnchorElement;
    // core が組んだ遷移先をそのまま Link へ渡す (FR-009)。画面側で組み立て直さない
    expect(link.getAttribute('href')).toBe('/classify?filter=未仕分け');
  });

  it('優先度・ステータス・手間・確からしさが色ではなく文字で読める', async () => {
    renderWith();
    const row = (await screen.findByRole('button', { name: '外注費 の固定費を見直す' })).closest(
      'tr',
    ) as HTMLElement;
    expect(row.textContent).toContain('高'); // 優先度
    expect(row.textContent).toContain('ふつう'); // 対応の手間
    expect(row.textContent).toContain('未着手'); // ステータス

    fireEvent.click(await screen.findByRole('button', { name: '外注費 の固定費を見直す' }));
    const detail = await screen.findByRole('region', { name: '課題の詳細' });
    expect(detail.textContent).toContain('見積りの確からしさ');
    expect(detail.textContent).toContain('ふつう');
  });

  it('対応済みは既定で畳み、畳んだ件数と合計を注記する', async () => {
    renderWith({
      improvements: [improvement({ status: '対応済み' }), SECOND],
      totals: { active: 360_000, activeCount: 1, collapsed: 540_000, collapsedCount: 1 },
    });
    const actions = await screen.findByRole('region', { name: '改善アクションの優先順位' });
    expect(actions.textContent).toContain('対応済み・見送り 1 件');
    expect(actions.textContent).toContain('¥540,000');
    expect(screen.queryByRole('button', { name: '外注費 の固定費を見直す' })).toBeNull();

    fireEvent.click(within(actions).getByText('対応済み・見送りも表示'));
    expect(screen.getByRole('button', { name: '外注費 の固定費を見直す' })).toBeTruthy();
  });

  it('改善余地を持たない旧 Worker の応答では、新ブロックを出さず統計だけを見せる', async () => {
    // rolling deploy の途中で新しい画面が古い Worker に当たっても壊さない
    renderWith({
      selection: undefined,
      improvements: undefined,
      health: undefined,
      waterfall: undefined,
      signals: undefined,
      evidence: undefined,
      totals: undefined,
    });
    expect(await screen.findByText('統計の詳細 (科目別プロファイルと自動診断)')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '改善アクションの優先順位' })).toBeNull();
    expect(screen.queryByRole('region', { name: '健全性スコア' })).toBeNull();
  });

  it('診断できるデータが無ければ取込へ誘導する', async () => {
    renderWith({ entries: [], improvements: [] });
    expect(await screen.findByRole('link', { name: 'データ取込へ' })).toBeTruthy();
  });

  it('取込済みで改善候補が 0 件なら、空の表ではなく専用状態を出す', async () => {
    renderWith({
      improvements: [],
      totals: { active: 0, activeCount: 0, collapsed: 0, collapsedCount: 0 },
      waterfall: [
        { key: 'base', label: '現状の年間経費', from: 0, to: 6_000_000, kind: 'base' },
        { key: 'result', label: '改善後の年間経費', from: 0, to: 6_000_000, kind: 'result' },
      ],
    });
    const actions = await screen.findByRole('region', { name: '改善アクションの優先順位' });
    expect(actions.textContent).toContain('未対応の改善アクションはありません');
    expect(within(actions).getByRole('link', { name: '取込状況を確認する' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '選択中の課題' })).toBeNull();
  });

  it('収入の候補が0件でも未取込画面へ落とさず、該当なしの次行動を示す', async () => {
    renderWith({
      entries: [],
      selection: { scope: 'total', metric: 'income', compare: 'previous' },
      improvements: [],
      totals: { active: 0, activeCount: 0, collapsed: 0, collapsedCount: 0 },
      waterfall: [
        { key: 'base', label: '現状の年間収入', from: 0, to: 3_600_000, kind: 'base' },
        { key: 'result', label: '改善後の年間収入', from: 0, to: 3_600_000, kind: 'result' },
      ],
      signals: [],
      kpi: { ...baseData.kpi, months: 12 },
    });
    const actions = await screen.findByRole('region', { name: '改善アクションの優先順位' });
    expect(actions.textContent).toContain('未対応の改善アクションはありません');
    expect(within(actions).getByRole('link', { name: '取込状況を確認する' })).toBeTruthy();
    expect(actions.textContent).not.toContain('未対応です');
    expect(screen.queryByRole('link', { name: 'データ取込へ' })).toBeNull();
  });

  it('収入の改善候補を最優先に選び、推移画面への実行先と年間収入の変化を示す', async () => {
    const income = improvement({
      id: 'demo_income',
      action_key: 'demo_income:business',
      target: 'business',
      label: '事業収入の落ち込みを立て直す',
      detail: '直近3ヶ月平均が、その前3ヶ月平均より減少している。',
      metric: 'income',
      monthlyImpact: 100_000,
      annualImpact: 1_200_000,
      effort: 'high',
      nextAction: {
        label: '減少要因を確認する',
        to: '/analysis/trends?scope=business&metric=income',
      },
    });
    renderWith({
      selection: { scope: 'business', metric: 'income', compare: 'previous' },
      improvements: [income],
      totals: { active: 1_200_000, activeCount: 1, collapsed: 0, collapsedCount: 0 },
      waterfall: [
        { key: 'base', label: '現状の年間収入', from: 0, to: 10_800_000, kind: 'base' },
        { key: income.action_key, label: income.label, from: 10_800_000, to: 12_000_000, kind: 'gain' },
        { key: 'result', label: '改善後の年間収入', from: 0, to: 12_000_000, kind: 'result' },
      ],
      signals: [{ label: income.label, detail: '年内 ¥1,200,000 の改善見込み。', tone: 'alert' }],
      scopeTotals: {
        current: 10_800_000,
        baseline: 12_000_000,
        diff: -1_200_000,
        rate: -0.1,
        baselineLabel: '前12か月',
        baselineRange: { from: '2024-04', to: '2025-03' },
        byScope: { total: 10_800_000, business: 10_800_000, household: 0 },
      },
    });

    expect((await screen.findByRole('region', { name: '診断結果' })).textContent).toContain(income.label);
    const selection = screen.getByRole('region', { name: '選択中の課題' });
    expect(
      (within(selection).getByRole('link', { name: '減少要因を確認する' }) as HTMLAnchorElement).getAttribute(
        'href',
      ),
    ).toBe('/analysis/trends?scope=business&metric=income');
    expect(screen.getByRole('region', { name: '完了すると変わる指標' }).textContent).toContain('年間収入');
    expect(screen.queryByText(/未対応です|まだ表示できません/)).toBeNull();
  });

  it('対応済みを保存した後は、表・詳細・固定CTAが次の未対応候補へそろって移る', async () => {
    let settled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          settled = true;
          return new Response(JSON.stringify({ action_key: improvement().action_key, status: '対応済み' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify(
            payload(
              settled
                ? {
                    improvements: [improvement({ status: '対応済み' }), SECOND],
                    totals: {
                      active: SECOND.annualImpact,
                      activeCount: 1,
                      collapsed: 540_000,
                      collapsedCount: 1,
                    },
                    waterfall: [
                      { key: 'base', label: '現状の年間経費', from: 0, to: 6_000_000, kind: 'base' },
                      {
                        key: SECOND.action_key,
                        label: SECOND.label,
                        from: 5_640_000,
                        to: 6_000_000,
                        kind: 'cut',
                      },
                      { key: 'result', label: '改善後の年間経費', from: 0, to: 5_640_000, kind: 'result' },
                    ],
                    signals: [{ label: SECOND.label, detail: '単発の改善見込み。', tone: 'watch' }],
                  }
                : {},
            ),
          ),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={['/analysis/diagnosis?action=demo_fixed_cost%3A%E5%A4%96%E6%B3%A8%E8%B2%BB']}
        >
          <DiagnosisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const detail = await screen.findByRole('region', { name: '課題の詳細' });
    fireEvent.click(within(detail).getByText('対応済み'));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: '課題の詳細' }).textContent).toContain(SECOND.label),
    );
    expect(screen.queryByRole('button', { name: improvement().label })).toBeNull();
    expect(screen.getByRole('region', { name: '選択中の課題' }).textContent).toContain(SECOND.label);
    expect(
      within(screen.getByRole('region', { name: '選択中の課題' })).getByRole('link', { name: '分類する' }),
    ).toBeTruthy();
  });

  it('単発の改善見込みを月額と表示しない', async () => {
    renderWith({
      improvements: [
        improvement({
          impactBasis: 'one_off',
          annualImpact: 45_000,
          monthlyImpact: 45_000,
        }),
      ],
      totals: { active: 45_000, activeCount: 1, collapsed: 0, collapsedCount: 0 },
    });
    const detail = await screen.findByRole('region', { name: '課題の詳細' });
    expect(detail.textContent).toContain('単発の改善見込み');
    expect(detail.textContent).toContain('単発 ¥45,000');
    expect(detail.textContent).not.toContain('月 ¥45,000');
  });
});
