import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from './components/Page.js';
import { APP_ROUTES, MOBILE_ROUTES } from './routeMetadata.js';

const PAGE_SOURCES = import.meta.glob('./pages/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const STYLE_SOURCE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const ROUTED_PAGE_SOURCES = Object.entries(PAGE_SOURCES)
  .filter(([path]) => !path.endsWith('/Login.tsx'))
  .map(([, source]) => source);

describe('11ルート契約', () => {
  it('パスとIDが一意で全件がナビに含まれる', () => {
    expect(APP_ROUTES).toHaveLength(11);
    expect(new Set(APP_ROUTES.map((route) => route.id)).size).toBe(11);
    expect(new Set(APP_ROUTES.map((route) => route.path)).size).toBe(11);
    expect(APP_ROUTES.every((route) => route.label && route.task)).toBe(true);
  });

  it('モバイルタブは正本ルートの部分集合', () => {
    const routeIds = new Set(APP_ROUTES.map((route) => route.id));
    expect(MOBILE_ROUTES).toHaveLength(4);
    expect(MOBILE_ROUTES.every((route) => routeIds.has(route.id))).toBe(true);
  });

  it('全11ページが共通ヘッダーを使用する', () => {
    expect(ROUTED_PAGE_SOURCES).toHaveLength(11);
    expect(ROUTED_PAGE_SOURCES.every((source) => source.includes('<PageHeader route='))).toBe(true);
    expect(ROUTED_PAGE_SOURCES.some((source) => source.includes('<h1 className="page-title"'))).toBe(false);
  });
});

describe('共通表示契約', () => {
  it('全ページのヘッダーが正本metadataを表示する', () => {
    for (const route of APP_ROUTES) {
      const html = renderToStaticMarkup(<PageHeader route={route.id} />);
      expect(html).toContain(route.label);
      expect(html).toContain(route.task);
    }
  });

  it('読み込み・失敗・空を次の行動付きで表示できる', () => {
    const loading = renderToStaticMarkup(<PageState status="loading" />);
    expect(loading).toContain('読み込み中');
    expect(loading).toContain('<output');
    expect(renderToStaticMarkup(<PageState status="error" />)).toContain('もう一度読み込んで');
    expect(renderToStaticMarkup(<PageState status="empty" message="未取込" />)).toContain('未取込');
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
  it('横スクロール容器内の表見出しはページヘッダー分のオフセットを持たない', () => {
    // overflow を持つ要素が sticky の基準になるため、top を 53px にすると見出し行が先頭行を隠す
    expect(STYLE_SOURCE).toMatch(/\.scroll-x table\.data thead th\s*\{[^}]*top:\s*0;/);
  });

  it('サイドバーのグループ見出しは区切り線を持つ', () => {
    expect(STYLE_SOURCE).toMatch(/\.nav-group\s*\{[^}]*border-top:\s*1px solid var\(--line\)/);
  });
});
