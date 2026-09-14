// @vitest-environment jsdom

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeInteractiveSource } from '../../../scripts/ui-contract-ast.mjs';
import { NATIVE_BUTTON_EXCEPTION_MARKERS } from './components/Button.js';
import { ANALYSIS_TABS, APP_ROUTES, type AppRouteId } from './routeMetadata.js';

/**
 * FR-003 / AC-003: 20ルートすべてが共通シェル(サイドバー・ヘッダー・フッター)を1つずつ持つ。
 * 検査したいのは「どのルートも同じ Layout を通る」ことなので、各ページの中身は差し替えて
 * データ取得の揺れを持ち込まない。ページが実際に描画されたこと(= * の Navigate で
 * トップへ落ちていないこと)は差し替えた見出しで確かめる。
 */
vi.mock('./pages/Overview.js', () => ({ OverviewPage: () => <h1>stub:OverviewPage</h1> }));
vi.mock('./pages/Analysis.js', () => ({ AnalysisPage: () => <h1>stub:AnalysisPage</h1> }));
vi.mock('./pages/Subscriptions.js', () => ({ SubscriptionsPage: () => <h1>stub:SubscriptionsPage</h1> }));
vi.mock('./pages/Household.js', () => ({ HouseholdPage: () => <h1>stub:HouseholdPage</h1> }));
vi.mock('./pages/Statements.js', () => ({ StatementsPage: () => <h1>stub:StatementsPage</h1> }));
vi.mock('./pages/Ai.js', () => ({ AiPage: () => <h1>stub:AiPage</h1> }));
vi.mock('./pages/Classify.js', () => ({ ClassifyPage: () => <h1>stub:ClassifyPage</h1> }));
vi.mock('./pages/Budget.js', () => ({ BudgetPage: () => <h1>stub:BudgetPage</h1> }));
vi.mock('./pages/Tradeoff.js', () => ({ TradeoffPage: () => <h1>stub:TradeoffPage</h1> }));
vi.mock('./pages/Import.js', () => ({ ImportPage: () => <h1>stub:ImportPage</h1> }));
vi.mock('./pages/Cash.js', () => ({ CashPage: () => <h1>stub:CashPage</h1> }));
vi.mock('./pages/Settings.js', () => ({ SettingsPage: () => <h1>stub:SettingsPage</h1> }));
vi.mock('./pages/Guide.js', () => ({ GuidePage: () => <h1>stub:GuidePage</h1> }));
vi.mock('./pages/Improvement.js', () => ({ ImprovementPage: () => <h1>stub:ImprovementPage</h1> }));

const { App } = await import('./App.js');

const PAGE_BY_ROUTE: Record<AppRouteId, string> = {
  overview: 'OverviewPage',
  import: 'ImportPage',
  cash: 'CashPage',
  classify: 'ClassifyPage',
  subscriptions: 'SubscriptionsPage',
  household: 'HouseholdPage',
  analysis: 'AnalysisPage',
  statements: 'StatementsPage',
  ai: 'AiPage',
  budget: 'BudgetPage',
  tradeoff: 'TradeoffPage',
  settings: 'SettingsPage',
  guide: 'GuidePage',
};

/** path の母数は route registry から導出し、ページ stub 名だけを実装境界として対応付ける。 */
const AUTHENTICATED_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ...APP_ROUTES.map((route) => [route.path, PAGE_BY_ROUTE[route.id]] as const),
  ...ANALYSIS_TABS.map((route) => [route.path, 'AnalysisPage'] as const),
  ['/improvement', 'ImprovementPage'],
];

function stubFetch(authenticated: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/auth/me')) {
        return authenticated
          ? new Response(JSON.stringify({ authenticated: true }), {
              headers: { 'Content-Type': 'application/json' },
            })
          : new Response(JSON.stringify({ error: 'unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
      }
      const body = path.includes('/imports')
        ? { imports: [] }
        : {
            overview: { months: ['2026-08'], unrecordedExpMonths: [] },
            period: {
              applied: null,
              label: '全期間',
              full: { from: '2025-09', to: '2026-08' },
              years: ['2026', '2025'],
              monthCount: 12,
            },
          };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function expectOneShell(container: HTMLElement) {
  expect(container.querySelectorAll('aside.sidebar')).toHaveLength(1);
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('20ルートの共通シェル (FR-003)', () => {
  it('母数は認証後19 + ログイン1 = 20', () => {
    expect(AUTHENTICATED_ROUTES.length).toBe(APP_ROUTES.length + ANALYSIS_TABS.length + 1);
    expect(AUTHENTICATED_ROUTES.length + 1).toBe(20); // 承認済み20 route の退行検知
    expect(new Set(AUTHENTICATED_ROUTES.map(([path]) => path)).size).toBe(AUTHENTICATED_ROUTES.length);
  });

  it.each(AUTHENTICATED_ROUTES)('%s はサイドバー・ヘッダー・フッターを1つずつ持つ', async (path, page) => {
    stubFetch(true);
    const { container } = renderApp(path);
    expect(await screen.findByRole('heading', { name: `stub:${page}` })).toBeTruthy();
    expectOneShell(container);
  });

  it('ログイン(未認証で LoginPage を Layout locked に描画)も同じシェルを1つずつ持つ', async () => {
    stubFetch(false);
    const { container } = renderApp('/');
    expect(await screen.findByRole('button', { name: /ログイン/ })).toBeTruthy();
    expect(container.querySelector('.shell-locked')).not.toBeNull();
    expectOneShell(container);
  });
});

describe('標準操作は共通 Button を通る (FR-003 / requirements-baseline §3.2)', () => {
  // jsdom 環境では import.meta.url が file: にならないので、vitest の実行位置(packages/web)から辿る
  const srcDir = `${resolve(process.cwd(), 'src')}/`;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === 'test-support' ? [] : sourceFiles(full);
      return name.endsWith('.tsx') && !name.includes('.test.') ? [full] : [];
    });
  }

  /** className={...} の式を波括弧の対応で切り出す(テンプレートリテラルの ${} を含むため正規表現では取れない) */
  function classNameExpressions(source: string): string[] {
    const found: string[] = [];
    for (const match of source.matchAll(/className=/g)) {
      const start = (match.index ?? 0) + match[0].length;
      const opener = source[start];
      if (opener === '"' || opener === "'") {
        const end = source.indexOf(opener, start + 1);
        found.push(source.slice(start, end + 1));
      } else if (opener === '{') {
        let depth = 0;
        for (let index = start; index < source.length; index++) {
          if (source[index] === '{') depth++;
          else if (source[index] === '}' && --depth === 0) {
            found.push(source.slice(start, index + 1));
            break;
          }
        }
      }
    }
    return found;
  }

  const primaryLiterals = sourceFiles(srcDir).flatMap((file) =>
    classNameExpressions(readFileSync(file, 'utf8')).flatMap((expression) =>
      [...expression.matchAll(/(["'`])((?:(?!\1).)*)\1/g)]
        .map((literal) => literal[2] ?? '')
        .filter((literal) => /(^|\s)primary(\s|$)/.test(literal))
        .map((literal) => ({ file: file.slice(srcDir.length), literal })),
    ),
  );

  const nativeButtons = sourceFiles(srcDir).flatMap((file) => {
    if (file.endsWith('/components/Button.tsx')) return [];
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/<button\b[\s\S]*?>/g)].map((match) => {
      const tag = match[0];
      const line = source.slice(0, match.index).split('\n').length;
      return {
        location: `${file.slice(srcDir.length)}:${line}`,
        tag: tag.replace(/\s+/g, ' '),
        // sort の aria-sort は button 自身ではなく親 th に置くのが ARIA の契約
        parentContext: source.slice(Math.max(0, (match.index ?? 0) - 600), match.index),
      };
    });
  });

  const astViolations = sourceFiles(srcDir).flatMap((file) =>
    analyzeInteractiveSource(readFileSync(file, 'utf8'), file.slice(srcDir.length), {
      exceptionMarkers: NATIVE_BUTTON_EXCEPTION_MARKERS,
    }),
  );

  it('走査が主操作ボタンを1件以上見つけている', () => {
    expect(primaryLiterals.length).toBeGreaterThan(10);
  });

  it('className に primary を含む全件が btn も含む', () => {
    const offenders = primaryLiterals.filter(({ literal }) => !/(^|\s)btn(\s|$)/.test(literal));
    expect(offenders).toEqual([]);
  });

  it('native button は ARIA 固有 control の閉じた例外taxonomyだけに限る', () => {
    const markerPattern = new RegExp(
      `data-native-control=["'](${NATIVE_BUTTON_EXCEPTION_MARKERS.join('|')})["']`,
    );
    const offenders = nativeButtons
      .filter(({ tag }) => !markerPattern.test(tag))
      .map(({ location, tag }) => `${location} ${tag}`);

    expect(nativeButtons.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('native button の例外markerは種別ごとに必要な ARIA 状態と一体である', () => {
    const requiredSemantics: Record<(typeof NATIVE_BUTTON_EXCEPTION_MARKERS)[number], RegExp[]> = {
      disclosure: [/aria-expanded=/],
      'menu-trigger': [/aria-expanded=/, /aria-haspopup=["']menu["']/],
      tab: [/role=["']tab["']/, /aria-selected=/],
      toggle: [/aria-pressed=/],
      sort: [/className=["']th-sort["']/, /aria-sort=/],
    };
    const offenders = nativeButtons.flatMap(({ location, tag, parentContext }) => {
      const marker = tag.match(/data-native-control=["']([^"']+)["']/)?.[1];
      if (!marker || !(marker in requiredSemantics)) return [];
      const semantics = marker === 'sort' ? `${parentContext}\n${tag}` : tag;
      return requiredSemantics[marker as keyof typeof requiredSemantics].every((pattern) =>
        pattern.test(semantics),
      )
        ? []
        : [`${location} ${marker}`];
    });

    expect(offenders).toEqual([]);
  });

  it('production JSXのbutton相当要素をASTで意味分類し、未分類を拒否する', () => {
    expect(astViolations).toEqual([]);
  });

  it('input submit・role button・onClick非button・dynamic input・marker偽装を反例として拒否する', () => {
    const fixture = `
      export const Fixture = () => <>
        <input type="submit" value="保存" />
        <a role="button">保存</a>
        <div onClick={() => save()}>保存</div>
        <a href="/next" onClick={() => save()}>保存</a>
        <input type={kind} />
        <button data-native-control="toggle" aria-pressed="false">保存</button>
      </>;
    `;
    expect(
      analyzeInteractiveSource(fixture, 'fixture.tsx', {
        exceptionMarkers: NATIVE_BUTTON_EXCEPTION_MARKERS,
      }),
    ).toEqual([
      'fixture.tsx:3 input[type=submit] bypasses the shared Button',
      'fixture.tsx:4 role=button bypasses the shared Button',
      'fixture.tsx:5 div with onClick bypasses the shared Button',
      'fixture.tsx:6 a with onClick bypasses the shared Button',
      'fixture.tsx:7 dynamic input type can bypass the shared Button',
      'fixture.tsx:8 native toggle marker is not backed by dynamic aria-pressed state',
    ]);
  });

  it('共通 PageShell が route metadata の reading/data 幅を実描画へ渡す', async () => {
    stubFetch(true);
    const reading = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'stub:OverviewPage' })).toBeTruthy();
    expect(reading.container.querySelector('main.page-shell--reading')).not.toBeNull();
    cleanup();

    const data = renderApp('/analysis/matrix');
    expect(await screen.findByRole('heading', { name: 'stub:AnalysisPage' })).toBeTruthy();
    expect(data.container.querySelector('main.page-shell--data')).not.toBeNull();
  });
});
