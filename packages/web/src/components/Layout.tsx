/**
 * 全ページ共通レイアウト(spec §10.1)。
 * ヘッダー: 対象期間 / 防衛ラインバッジ(FR-08 常時表示) / データ状態 / エクスポート
 * ナビ: PC=サイドバー / モバイル(〜640px)=下部固定タブバー(最頻5画面+メニュー)
 *
 * ここが持つのは「枠と、枠に固有の状態(ドロワー / ヘッダー実高さ)」だけ。
 * ナビ1項目は NavItem.tsx、期間の選択は period.tsx、書き出しは ExportMenu.tsx。
 */
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { type SummaryResponse, api } from '../api.js';
import { monthLabel, yen } from '../format.js';
import { PeriodPicker, usePeriod } from '../period.js';
import { APP_ROUTES, MOBILE_ROUTES, TABBED_ROUTE_IDS } from '../routeMetadata.js';
import { TaxYearPicker, useTaxYear } from '../tax-year.js';
import { CommandPalette } from './CommandPalette.js';
import { ExportMenu } from './ExportMenu.js';
import { ImprovementRequestButton } from './ImprovementRequestButton.js';
import { NavItem } from './NavItem.js';
import { Term } from './Term.js';

const STATUS_LABEL: Record<string, string> = {
  ok: '余裕あり',
  tight: 'ぎりぎり',
  danger: '要注意',
  nodata: 'データなし',
};

export function Layout({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  const taxYear = useTaxYear();
  const isTaxRoute = loc.pathname === '/tax' || loc.pathname.startsWith('/tax/');

  // ドロワーは Escape とルート遷移で閉じる
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 遷移で閉じるのが目的
  useEffect(() => {
    setDrawer(false);
  }, [loc.pathname]);

  // 固定ヘッダーの実高さを --header-h に反映する。狭幅ではバッジが折り返して高さが変わるため、
  // 固定値(53px)のままだと表の見出し行がヘッダーの裏に隠れる
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () =>
      document.documentElement.style.setProperty(
        '--header-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { key, withPeriod } = usePeriod();
  const summary = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });

  const d = summary.data?.defense;
  const ov = summary.data?.overview;
  const months = ov?.months ?? [];
  const period = months.length
    ? `${monthLabel(months[0])} 〜 ${monthLabel(months[months.length - 1])}`
    : 'データ未取込';
  const unrec = ov?.unrecordedExpMonths ?? [];

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        本文へスキップ
      </a>
      <CommandPalette />

      {/* aside は幅とドロワーの入れ物。名前を持つべきランドマークは中の nav なので、
          aria-label は nav 側に置く(両方に同じ名前を付けると landmark が二重になる) */}
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <Link to="/" className="brand">
          収支統合管理
          <small>freee × マネーフォワード</small>
        </Link>
        <nav className="nav" aria-label="メインナビゲーション">
          {APP_ROUTES.map((route) => (
            <div key={route.id}>
              {route.navGroup && <div className="nav-group">{route.navGroup}</div>}
              <NavItem
                to={route.path}
                icon={route.icon}
                label={route.label}
                variant="sidebar"
                end={!TABBED_ROUTE_IDS.has(route.id)}
              />
            </div>
          ))}
          {/* 改善要望は routeMetadata の業務画面ではなく、アプリ自身への窓口。
              タブバーの最頻5画面を押し出さないよう、サイドバーにだけ出す */}
          <div>
            <div className="nav-group">その他</div>
            {/* RouteIcon は routeMetadata 用の固定集合。新しい絵は足さず、
                サイドバーで未使用の scan-search を借りる */}
            <NavItem to="/improvement" icon="scan-search" label="改善要望" variant="sidebar" end />
          </div>
        </nav>
      </aside>
      {drawer && (
        <div
          className="backdrop"
          onClick={() => setDrawer(false)}
          onKeyDown={(e) => e.key === 'Escape' && setDrawer(false)}
          role="presentation"
        />
      )}

      <header className="header" ref={headerRef}>
        <Link to="/" className="header-brand">
          収支統合管理
        </Link>
        <span className="period">{isTaxRoute ? `${taxYear.year}年 1月〜12月` : period}</span>
        {isTaxRoute ? (
          <TaxYearPicker years={summary.data?.period.years ?? []} />
        ) : (
          <PeriodPicker meta={summary.data?.period} />
        )}
        <span className="spacer" />
        {d && d.status !== 'nodata' && (
          <span className={`badge ${d.status}`}>
            <Term id="defenseLine">防衛線</Term> <span className="num">{yen(d.line)}</span>
            <span className="badge-detail">
              {' '}
              / 見込 <span className="num">{yen(d.incomeEstimate)}</span>
            </span>{' '}
            {STATUS_LABEL[d.status]}
          </span>
        )}
        {unrec.length > 0 && (
          <span className="badge warn">
            <Term id="unrecordedMonth">未記帳</Term> {unrec.map((m) => monthLabel(m)).join('・')}
          </span>
        )}
        <ExportMenu />
      </header>

      <main className="main" id="main-content" key={loc.pathname}>
        {children}
      </main>

      <footer className="footer">
        明細データは外部に送信されません(アナリティクスなし)。税務上の正はfreeeの記帳です。バックアップは毎晩自動保存(30日保持)。
      </footer>

      {/* 右下に固定する。どの画面のどこまでスクロールしていても同じ位置にあり、
          「困ったらここ」を覚えれば済む。撮影は押した瞬間に始まるので、
          いま見えているものがそのまま送られる */}
      <ImprovementRequestButton />

      <nav className="tabbar" aria-label="モバイルナビゲーション">
        {MOBILE_ROUTES.map((route) => (
          // MOBILE_ROUTES の filter は推論型述語が効くので、ここでの mobileLabel は string
          <NavItem
            key={route.id}
            to={route.path}
            icon={route.icon}
            label={route.mobileLabel}
            variant="tab"
            end={!TABBED_ROUTE_IDS.has(route.id)}
          />
        ))}
        {/* .active はここだけの表現で「ドロワーが開いている」を意味する。
            現在のルートは NavItem 側の aria-current="page" が持つ */}
        <button
          type="button"
          className={`tab${drawer ? ' active' : ''}`}
          aria-expanded={drawer}
          onClick={() => setDrawer((v) => !v)}
        >
          メニュー
        </button>
      </nav>
    </div>
  );
}
