// @vitest-environment jsdom

/**
 * 使い方画面 (spec-guide-screen / SYS-GUIDE-P04)。19-guide.png の構成・URL の復元・読込 / 失敗 / 検索 0 件を確かめる。
 *
 * /api/guide の応答は core の guideScreen で組む (API と同じ形)。本文は core の定数なので、
 * 数値の枠だけが応答に依存し、失敗しても目次・本文・検索・よくある疑問は描かれることを見る。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の /guide は指標ガイド (用語の表だけ) で、./GuidePage.js・4 ステップ・目次・URL の topic / q・
 * このページの数値・下部固定バーを持たない。
 */
import {
  CONFIDENCE_TIER_DESCRIPTION,
  GUIDE_FAQ,
  GUIDE_PERIOD_TABLE,
  GUIDE_STEPS,
  GUIDE_TOPICS,
  type GuideScreen,
  type MonthlyCloseStatus,
  guideScreen,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodProvider } from '../../period.js';
import { GuideAside } from './GuideAside.js';
import { GuidePage } from './GuidePage.js';
import { pageFacts } from './view-model.js';

const RANGE = { from: '2026-01', to: '2026-12' };

const close = (done: Record<string, boolean>): MonthlyCloseStatus => {
  const keys = ['import', 'classification', 'reconciliation', 'review'] as const;
  const steps = keys.map((key) => ({ key, label: key, done: done[key] ?? false, count: null }));
  return {
    month: '2026-12',
    steps: steps as MonthlyCloseStatus['steps'],
    doneCount: steps.filter((s) => s.done).length,
    total: 4,
    reviewedAt: null,
  };
};

const SCREEN: GuideScreen = guideScreen({
  period: { applied: RANGE, full: { from: '2025-01', to: '2026-12' }, label: '2026年1月 〜 2026年12月' },
  totals: { income: 1_200_000, expense: 950_000 },
  dataUpdatedAt: '2026-12-20T03:00:00Z',
  closeStatus: close({ import: true, classification: true }),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** /guide だけを応答し、他 (用語の現在値) は 500。guide は null で失敗、'pending' で応答しない */
function stubApi(guide: GuideScreen | null | 'pending', pendingFor?: string) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL) => {
      const url = new URL(String(req), 'http://localhost');
      const path = url.pathname.replace(/^\/api/, '');
      calls.push(`${path}${url.search}`);
      if (path === '/guide') {
        if (guide === 'pending' || url.search === pendingFor) return new Promise<Response>(() => {});
        return guide ? json({ screen: guide }) : json({ error: { code: 'x', message: 'x' } }, 500);
      }
      return json({ error: { code: 'x', message: 'x' } }, 500);
    }),
  );
  return calls;
}

let location = '';
function LocationProbe() {
  const l = useLocation();
  location = `${l.pathname}${l.search}`;
  return null;
}

function renderGuide(entry = '/guide', withPeriod = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const route = (
    <MemoryRouter initialEntries={[entry]}>
      <GuidePage />
      <LocationProbe />
    </MemoryRouter>
  );
  return render(
    <QueryClientProvider client={client}>
      {withPeriod ? <PeriodProvider>{route}</PeriodProvider> : route}
    </QueryClientProvider>,
  );
}

const selectedTab = () => screen.getByRole('tab', { selected: true });
const bottomBar = () => document.querySelector('.guide-bottom-bar') as HTMLElement;
const facts = () =>
  screen.getByRole('heading', { name: 'このページの数値' }).closest('section') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  location = '';
});

describe('19-guide.png の構成', () => {
  it('このページの数値は入力配列の順が変わっても項目名と値を対応させる', () => {
    render(
      <MemoryRouter>
        <GuideAside
          load="ready"
          facts={[...pageFacts(SCREEN)].reverse()}
          onRetry={() => {}}
          query=""
          onQuery={() => {}}
        />
      </MemoryRouter>,
    );
    const values = [...facts().querySelectorAll('dd')].map((dd) => dd.textContent);
    expect(values).toEqual(pageFacts(SCREEN).map((fact) => fact.value));
  });

  it('見出し・4 ステップ・目次 7 項目・月次の流れ・総収支・右カラム 3 枚・よくある疑問・下部固定バーを出す', async () => {
    stubApi(SCREEN);
    renderGuide();

    expect(screen.getByRole('heading', { level: 1, name: '使い方' })).toBeTruthy();

    // 4 ステップ: 順と行き先
    const steps = screen
      .getByRole('heading', { name: '使い方の 4 ステップ' })
      .closest('section') as HTMLElement;
    const openLinks = within(steps).getAllByRole('link');
    expect(openLinks.map((a) => a.getAttribute('href'))).toEqual(GUIDE_STEPS.map((s) => s.destination.path));
    expect(openLinks.map((a) => a.textContent)).toEqual(GUIDE_STEPS.map(() => '元画面を開く →'));

    // 目次: 7 項目、既定は月次の流れ
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(GUIDE_TOPICS.map((t) => t.label));
    expect(selectedTab().textContent).toBe('月次の流れ');

    // 月次の流れのステッパー: 取込・整える は完了、確認・計画 は未完了 (monthlyCloseStatus の実進捗)
    const stepper = await waitFor(() => {
      const list = document.querySelector('.guide-stepper') as HTMLElement;
      expect(list.getAttribute('aria-busy')).toBe('false');
      return list;
    });
    expect(
      within(stepper)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('.guide-stepper-state')?.textContent),
    ).toEqual(['完了', '完了', '未完了', '未完了']);
    expect(within(stepper).getByText('月次レビュー')).toBeTruthy();

    // 総収支: 収入 − 支出 = 純収支 (+ の符号つき)
    expect(await screen.findByText('¥1,200,000')).toBeTruthy();
    expect(screen.getByText('¥950,000')).toBeTruthy();
    expect(screen.getByText('+¥250,000')).toBeTruthy();
    expect(screen.getByRole('heading', { name: GUIDE_PERIOD_TABLE.title })).toBeTruthy();

    // 右カラム
    const factCard = facts();
    expect([...factCard.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      '選択中の期間',
      '期間の定義',
      'データの出所',
      '最終更新',
    ]);
    expect([...factCard.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(
      pageFacts(SCREEN).map((f) => f.value),
    );
    expect(pageFacts(SCREEN)[0].value).toContain('2026年1月 〜 2026年12月');
    expect(screen.getByRole('navigation', { name: '関連ページ' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'ガイド内を検索' })).toBeTruthy();

    // よくある疑問: 5 行、信頼度の確認の条件は core の段階の説明
    const faq = screen.getByRole('heading', { name: GUIDE_FAQ.title }).closest('section') as HTMLElement;
    expect(within(faq).getAllByRole('rowheader')).toHaveLength(GUIDE_FAQ.rows.length);
    expect(within(faq).getByText(CONFIDENCE_TIER_DESCRIPTION)).toBeTruthy();

    // 下部固定バー
    expect(within(bottomBar()).getByText('月次の流れ')).toBeTruthy();
    expect(within(bottomBar()).getByRole('link', { name: '総収支を開く →' }).getAttribute('href')).toBe(
      '/analysis/total-cashflow',
    );
  });

  it('取込が 0 件なら『取込む』を強調し、進捗は未完了・総収支は ¥0', async () => {
    stubApi(
      guideScreen({
        period: { applied: null, full: null, label: '全期間' },
        totals: null,
        dataUpdatedAt: null,
        closeStatus: null,
      }),
    );
    renderGuide();
    await waitFor(() => expect(document.querySelector('.guide-step.is-emphasized')).toBeTruthy());
    expect(document.querySelector('.guide-step.is-emphasized strong')?.textContent).toBe('取込む');
    const states = [...document.querySelectorAll('.guide-stepper-state')].map((s) => s.textContent);
    expect(states).toEqual(['未完了', '未完了', '未完了', '未完了']);
    expect(screen.getAllByText('¥0').length).toBeGreaterThanOrEqual(3);
  });
});

describe('URL の topic / q', () => {
  it('topic を復元し、本文と下部固定バーがそのトピックになる', () => {
    stubApi(SCREEN);
    renderGuide('/guide?topic=budget');
    expect(selectedTab().textContent).toBe('予算');
    expect(within(bottomBar()).getByRole('link', { name: '予算を開く →' }).getAttribute('href')).toBe(
      '/budget',
    );
  });

  it('未知の topic は月次の流れに倒す', () => {
    stubApi(SCREEN);
    renderGuide('/guide?topic=nope');
    expect(selectedTab().textContent).toBe('月次の流れ');
  });

  it('目次を選ぶと URL の topic を書き、月次の流れに戻すとキーごと消す (期間などのキーは残す)', () => {
    stubApi(SCREEN);
    renderGuide('/guide?from=2026-01&to=2026-12');
    fireEvent.click(screen.getByRole('tab', { name: '照合' }));
    expect(location).toBe('/guide?from=2026-01&to=2026-12&topic=reconcile');
    fireEvent.click(screen.getByRole('tab', { name: '月次の流れ' }));
    expect(location).toBe('/guide?from=2026-01&to=2026-12');
  });

  it('q を復元して目次とよくある疑問を絞り、検索語は API へ送らない', () => {
    const calls = stubApi(SCREEN);
    renderGuide('/guide?q=重複');
    expect((screen.getByRole('searchbox', { name: 'ガイド内を検索' }) as HTMLInputElement).value).toBe(
      '重複',
    );
    const faq = screen.getByRole('heading', { name: GUIDE_FAQ.title }).closest('section') as HTMLElement;
    // 「重複」は重複候補の疑問と、家計・事業の範囲の説明 (重複計上を避ける) に当たる
    expect(
      within(faq)
        .getAllByRole('rowheader')
        .map((th) => th.querySelector('strong')?.textContent),
    ).toEqual(['なぜ重複候補があるのか？', '家計・事業の範囲はどう分けている？']);
    expect(screen.getAllByRole('tab').length).toBeLessThan(GUIDE_TOPICS.length);
    expect(calls.some((c) => c.includes('q='))).toBe(false);
  });

  it('共有 URL の topic が検索結果から外れたら、URL・選択タブ・本文・下部バーを最初の一致へ揃える', async () => {
    stubApi(SCREEN);
    renderGuide('/guide?topic=budget&q=振替');
    const first = screen.getAllByRole('tab')[0];
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(within(bottomBar()).getByText(first.textContent ?? '')).toBeTruthy();
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(first.id);
    await waitFor(() =>
      expect(new URLSearchParams(location.split('?')[1]).get('topic')).toBe(
        first.id.replace('guide-tab-', ''),
      ),
    );
  });

  it('入力した検索語は URL の q に入り、空にすると q だけ消して選択中のトピックを保つ', () => {
    stubApi(SCREEN);
    renderGuide();
    const box = screen.getByRole('searchbox', { name: 'ガイド内を検索' });
    fireEvent.change(box, { target: { value: '予算' } });
    expect(new URLSearchParams(location.split('?')[1]).get('q')).toBe('予算');
    expect(selectedTab().textContent).toBe('予算');
    expect(within(bottomBar()).getByText('予算')).toBeTruthy();
    fireEvent.change(box, { target: { value: '' } });
    expect(location).toBe('/guide?topic=budget');
  });
});

describe('読込・失敗・検索 0 件', () => {
  it('読込中は数値の枠を骨組みにし、本文と目次は先に出す', () => {
    stubApi('pending');
    renderGuide();
    expect(screen.getAllByRole('tab')).toHaveLength(GUIDE_TOPICS.length);
    expect(within(facts()).getAllByText('読み込み中')).toHaveLength(4);
    expect(document.querySelector('.guide-stepper')?.getAttribute('aria-busy')).toBe('true');
  });

  it('失敗したら数値の枠だけ「取得できませんでした」と再読み込みを出し、本文・検索・疑問は使える', async () => {
    stubApi(null);
    renderGuide();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('数値を取得できませんでした');
    expect(within(alert).getByRole('button', { name: '再読み込みする' })).toBeTruthy();
    expect(within(facts()).getAllByText('取得できませんでした')).toHaveLength(4);
    expect(screen.getByText('進捗を取得できませんでした')).toBeTruthy();
    // 総収支の 3 枚も値を出さない
    expect(screen.queryByText('¥0')).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(GUIDE_TOPICS.length);
    expect(screen.getAllByRole('rowheader').length).toBeGreaterThanOrEqual(GUIDE_FAQ.rows.length);
  });

  it('検索 0 件は本文と下部バーも空にし、旧トピックの案内を見せない', () => {
    stubApi(SCREEN);
    renderGuide('/guide?q=該当しない語zzqq');
    expect(screen.getByText('該当するガイドがありません')).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('検索語に当たる疑問はありません。')).toBeTruthy();
    expect(screen.getByRole('region', { name: '検索結果' }).textContent).toContain(
      '一致する項目がありません',
    );
    expect(document.querySelector('.guide-bottom-bar')).toBeNull();
  });

  it('FAQ のみ一致したときは FAQ を残し、本文・下部バーには旧トピックを表示しない', () => {
    stubApi(SCREEN);
    renderGuide('/guide?topic=budget&q=なぜ重複候補があるのか？');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('本文に一致する項目はありません')).toBeTruthy();
    expect(screen.getByRole('region', { name: '検索結果' }).textContent).toContain(
      '一致する疑問を下で確認できます',
    );
    expect(screen.getByRole('rowheader', { name: /なぜ重複候補があるのか/ })).toBeTruthy();
    expect(document.querySelector('.guide-bottom-bar')).toBeNull();
  });

  it('期間を切り替えた直後は旧期間の数値を表示せず、新しい期間の応答を待つ', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'span', span: 1 }));
    const calls = stubApi(SCREEN, '?from=2025-01&to=2025-12');
    renderGuide('/guide', true);
    expect(await screen.findByText('¥1,200,000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '前の期間へ' }));
    await waitFor(() => expect(calls).toContain('/guide?from=2025-01&to=2025-12'));
    expect(screen.queryByText('¥1,200,000')).toBeNull();
    expect(within(facts()).getAllByText('読み込み中')).toHaveLength(4);
    expect(screen.getByLabelText('対象期間').textContent).toContain('読み込み中');
  });

  it('用語の現在値も共通期間で取得し、期間移動で取得し直す', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'span', span: 1 }));
    const calls = stubApi(SCREEN);
    renderGuide('/guide?topic=terms', true);
    await waitFor(() => {
      expect(calls).toContain('/summary?span=1');
      expect(calls).toContain('/diagnosis?span=1');
    });
    await screen.findByText('2026年1月 〜 2026年12月');
    fireEvent.click(screen.getByRole('button', { name: '前の期間へ' }));
    await waitFor(() => {
      expect(calls).toContain('/summary?from=2025-01&to=2025-12');
      expect(calls).toContain('/diagnosis?from=2025-01&to=2025-12');
    });
  });
});
