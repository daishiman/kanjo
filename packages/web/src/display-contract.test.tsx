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
const PUBLIC_ROUTES_SOURCE = readFileSync(
  new URL('./features/auth/PublicRoutes.tsx', import.meta.url),
  'utf8',
);
const AUTHENTICATED_APP_SOURCE = readFileSync(new URL('./AuthenticatedApp.tsx', import.meta.url), 'utf8');
// Improvement は routeMetadata の業務ルートではない。認証UIは features/auth/ だけを正本とする。
const NON_ROUTED_PAGES = ['/Improvement.tsx'];
// 実装を下位ディレクトリへ分けたページ (例: pages/household/) は、ルートの import 先に再輸出だけを残す。
// 契約は再輸出の先の実体に掛ける (再輸出の1行だけを見て PageHeader 無しと判定しない)
const NESTED_PAGE_SOURCES = import.meta.glob('./pages/*/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
// classify は利用されていなかった pages/Classify.tsx wrapper を削除し、
// AuthenticatedApp が実体を直接 lazy import する。契約の対象に実体を明示する。
const DIRECT_ROUTED_PAGE_PATHS = ['./pages/classify/ClassifyPage.tsx'] as const;
const REEXPORT = /^export \{ \w+ \} from '(\.\/[\w/]+)\.js';$/m;
const resolvePageSource = (source: string): string => {
  const target = REEXPORT.exec(source)?.[1];
  if (!target) return source;
  const nested = NESTED_PAGE_SOURCES[`./pages/${target.slice(2)}.tsx`];
  if (nested === undefined) throw new Error(`再輸出の先が見つからない: ${target}`);
  return nested;
};
const ROUTED_PAGE_SOURCES = Object.entries(PAGE_SOURCES)
  .filter(([path]) => !NON_ROUTED_PAGES.some((name) => path.endsWith(name)) && !path.includes('.test.'))
  .map(([, source]) => resolvePageSource(source))
  .concat(
    DIRECT_ROUTED_PAGE_PATHS.map((path) => {
      const source = NESTED_PAGE_SOURCES[path];
      if (source === undefined) throw new Error(`直接ルートの実体が見つからない: ${path}`);
      return source;
    }),
  );

describe('業務ルート契約', () => {
  it('パスとIDが一意で全件がナビに含まれる', () => {
    expect(new Set(APP_ROUTES.map((route) => route.id)).size).toBe(APP_ROUTES.length);
    expect(new Set(APP_ROUTES.map((route) => route.path)).size).toBe(APP_ROUTES.length);
    expect(APP_ROUTES.every((route) => route.label && route.task && route.taskDetail)).toBe(true);
  });

  it('モバイルタブは正本ルートの部分集合', () => {
    const routeIds = new Set(APP_ROUTES.map((route) => route.id));
    // 領収書の廃止で5枚目が無くなり4枚。他の画面をタブへ繰り上げてはいない
    expect(MOBILE_ROUTES.map((route) => route.id)).toEqual(['overview', 'analysis', 'classify', 'import']);
    expect(MOBILE_ROUTES.every((route) => routeIds.has(route.id))).toBe(true);
  });

  it('全業務ページが共通ヘッダーを使用する', () => {
    expect(ROUTED_PAGE_SOURCES).toHaveLength(APP_ROUTES.length);
    expect(ROUTED_PAGE_SOURCES.every((source) => /<PageHeader\s+route=/.test(source))).toBe(true);
    expect(ROUTED_PAGE_SOURCES.some((source) => source.includes('<h1 className="page-title"'))).toBe(false);
  });

  it('業務ルートは全てルート単位の遅延読み込みで、eagerな同期importは未認証のログイン画面だけに限る', () => {
    // 業務ルートは正本の件数、routeMetadata 外は改善要望1枚と AI分析の子ルート3枚が lazy。
    // 同期 import を許すのは業務画面へ入る「門」だけ: 未認証のログイン画面 (LoginContainer)。
    // 門で「読み込み中…」を挟むと、締め出されたのか読み込み中なのかが利用者に判別できない。
    // 一時パスワードの門 (PasswordChange) は login-v2 で無くなった (decision-004)。
    // 公開経路の残り (/mfa・/invite/accept・/reset-password・/help・/privacy) は PublicRoutes が lazy で持つ。
    // 件数ではなく名前の完全一致で固定する。2枚目が黙って増えたらここで落ちる。
    // routeMetadata の外にある lazy ページは名前で列挙し、黙って増えたら落ちるようにする
    expect([...AUTHENTICATED_APP_SOURCE.matchAll(/^const (\w+) = lazy\(/gm)].map((m) => m[1])).toEqual([
      'ImprovementPage',
      'AiTaskDetailPage',
      'AiReportLibraryPage',
      'AiReportPage',
    ]);
    expect(AUTHENTICATED_APP_SOURCE.match(/lazy\(\(\) =>\s*import\('\.\/pages\//g)).toHaveLength(
      APP_ROUTES.length + 4,
    );
    expect(AUTHENTICATED_APP_SOURCE).toMatch(/<Suspense\s+fallback=/);
    expect(APP_SOURCE).toMatch(/const AuthenticatedApp = lazy\(/);
    expect(APP_SOURCE).toContain("import('./AuthenticatedApp.js')");
    expect(APP_SOURCE).toMatch(/<Suspense\s+fallback=/);
    expect(APP_SOURCE).not.toMatch(/lazy\(\(\) =>\s*import\('\.\/pages\//);
    expect(APP_SOURCE.match(/import \{ \w+ \} from '\.\/pages\//g)).toBeNull();
    expect(APP_SOURCE.match(/import \{ \w+ \} from '\.\/features\//g)).toEqual([
      "import { PublicRoutes } from './features/",
    ]);
    expect(PUBLIC_ROUTES_SOURCE.match(/^import \{ \w+ \} from '\.\/\w+\.js';$/gm)).toEqual([
      "import { LoginContainer } from './LoginContainer.js';",
    ]);
    expect([...PUBLIC_ROUTES_SOURCE.matchAll(/^const (\w+) = lazy\(/gm)].map((m) => m[1])).toEqual([
      'MfaPage',
      'InviteAcceptPage',
      'ResetPasswordPage',
      'HelpPage',
      'PrivacyPage',
    ]);
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

describe('ログイン画面の見た目契約', () => {
  it('メール欄も共通入力の枠・文字・面を使う', () => {
    expect(STYLE_SOURCE).toMatch(/input\[type="text"\],\s*input\[type="email"\],\s*input\[type="password"\]/);
  });

  it('ログイン操作はアイコンと文字を flex で離し、チェックは視覚24pxと操作44pxを両立する', () => {
    expect(STYLE_SOURCE).toMatch(/\.login-google\s*\{[^}]*display:\s*inline-flex/s);
    expect(STYLE_SOURCE).toMatch(/\.login-remember-control\s*\{[^}]*min-height:\s*var\(--tap-target-min\)/s);
    expect(STYLE_SOURCE).toMatch(
      /\.login-remember input\s*\{[^}]*width:\s*var\(--tap-target-min\)[^}]*height:\s*var\(--tap-target-min\)/s,
    );
    expect(STYLE_SOURCE).toMatch(
      /\.login-remember-control span::before\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s,
    );
  });

  it('デスクトップのフッターは3項目を縦線で区切る', () => {
    expect(STYLE_SOURCE).toMatch(
      /\.login-footer-item\s*\+\s*\.login-footer-item\s*\{[^}]*border-left:\s*1px solid var\(--line\)/s,
    );
  });
});

describe('表と横スクロール容器の契約', () => {
  // 表見出しの固定位置(sticky)は CSS 文字列の正規表現では検証しない。
  // 実描画での検証は thead-render.test.ts(scripts/check-thead-render.mjs を headless Chrome で実行)が担う。

  it('サイドバーのグループ見出しは区切り線を持つ', () => {
    expect(STYLE_SOURCE).toMatch(/\.nav-group\s*\{[^}]*border-top:\s*1px solid/);
  });
});
