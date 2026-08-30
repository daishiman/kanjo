import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from './components/Page.js';
import { APP_ROUTES, MOBILE_ROUTES } from './routeMetadata.js';

const PAGE_SOURCES = import.meta.glob('./pages/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const STYLE_SOURCE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const APP_SOURCE = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const ROUTED_PAGE_SOURCES = Object.entries(PAGE_SOURCES)
  .filter(([path]) => !path.endsWith('/Login.tsx') && !path.includes('.test.'))
  .map(([, source]) => source);

describe('15ルート契約', () => {
  it('パスとIDが一意で全件がナビに含まれる', () => {
    expect(APP_ROUTES).toHaveLength(15);
    expect(new Set(APP_ROUTES.map((route) => route.id)).size).toBe(15);
    expect(new Set(APP_ROUTES.map((route) => route.path)).size).toBe(15);
    expect(APP_ROUTES.every((route) => route.label && route.task && route.taskDetail)).toBe(true);
  });

  it('モバイルタブは正本ルートの部分集合', () => {
    const routeIds = new Set(APP_ROUTES.map((route) => route.id));
    expect(MOBILE_ROUTES).toHaveLength(5);
    expect(MOBILE_ROUTES.every((route) => routeIds.has(route.id))).toBe(true);
  });

  it('全15ページが共通ヘッダーを使用する', () => {
    expect(ROUTED_PAGE_SOURCES).toHaveLength(15);
    expect(ROUTED_PAGE_SOURCES.every((source) => source.includes('<PageHeader route='))).toBe(true);
    expect(ROUTED_PAGE_SOURCES.some((source) => source.includes('<h1 className="page-title"'))).toBe(false);
  });

  it('申告画面だけをcold-load短縮のためeagerにし、残りはルート単位で遅延読み込みする', () => {
    expect(APP_SOURCE.match(/lazy\(\(\) =>\s*import\('\.\/pages\//g)).toHaveLength(APP_ROUTES.length - 1);
    expect(APP_SOURCE).toMatch(/<Suspense\s+fallback=/);
    expect(APP_SOURCE.match(/import \{ \w+Page \} from '\.\/pages\//g)).toEqual([
      "import { LoginPage } from './pages/",
      "import { TaxReturnPage } from './pages/",
    ]);
    expect(APP_SOURCE).toMatch(/tax:\s*TaxReturnPage,/);
  });
});

describe('共通表示契約', () => {
  it('全ページのヘッダーが正本metadataを表示する', () => {
    for (const route of APP_ROUTES) {
      const html = renderToStaticMarkup(<PageHeader route={route.id} />);
      expect(html).toContain(route.label);
      // 用語ホバー(<Term>)で分割されるため、表示文字列で比較する
      expect(html.replace(/<[^>]+>/g, '')).toContain(route.task);
      // 内容の欠落検知は route-task-detail.test.tsx が担う(ここは表示有無のみ)
      expect(html.replace(/<[^>]+>/g, '')).toContain(route.taskDetail);
    }
  });

  it('読み込み・失敗・空を次の行動付きで表示できる', () => {
    const loading = renderToStaticMarkup(<PageState status="loading" />);
    expect(loading).toContain('読み込み中');
    expect(loading).toContain('<output');
    expect(loading).toContain('class="page-state loading"');
    expect(loading).toContain('aria-busy="true"');
    expect(STYLE_SOURCE).toMatch(/\.page-state\.loading\s*\{[^}]*100dvh/s);
    expect(renderToStaticMarkup(<PageState status="error" />)).toContain('もう一度読み込んで');
    expect(renderToStaticMarkup(<PageState status="empty" message="未取込" />)).toContain('未取込');
  });

  it('schema更新待ちは汎用サーバーエラーでなく復旧待ちと表示する', () => {
    const html = renderToStaticMarkup(
      <PageState status="error" error={new ApiError(503, 'schema_unavailable', '復旧作業中です')} />,
    );
    expect(html).toContain('システム更新の適用待ちです');
    expect(html).toContain('時間をおいて');
    expect(html).not.toContain('取込履歴');
  });

  it('KPIと年間増減率を共通表記で表示する', () => {
    expect(renderToStaticMarkup(<KpiCard label="平均経費" value="¥100" />)).toContain('平均経費');
    const annual = renderToStaticMarkup(
      <AnnualComparisonTable
        subjectLabel="科目"
        previousLabel="前年実績"
        currentLabel="当年換算"
        rows={[
          { key: 'A', label: 'A', previous: 100, current: 50, delta: -0.5 },
          { key: 'B', label: 'B', previous: 100, current: 250, delta: 1.5 },
        ]}
      />,
    );
    expect(annual).toContain('-50.0%');
    expect(annual).toContain('+150.0%');
    expect(annual).toContain('scope="col"');
    expect(annual).toContain('scope="row"');
  });
});

describe('表と横スクロール容器の契約', () => {
  // 表見出しの固定位置(sticky)は CSS 文字列の正規表現では検証しない。
  // 実描画での検証は thead-render.test.ts(scripts/check-thead-render.mjs を headless Chrome で実行)が担う。

  it('サイドバーのグループ見出しは区切り線を持つ', () => {
    expect(STYLE_SOURCE).toMatch(/\.nav-group\s*\{[^}]*border-top:\s*1px solid var\(--line\)/);
  });
});
