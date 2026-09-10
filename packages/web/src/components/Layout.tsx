/** 全ページ共通の Focus Ledger シェル。 */
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AUTH_EVENT, type ImportHistoryRow, type SummaryResponse, api } from '../api.js';
import { monthLabel, yen } from '../format.js';
import { PeriodPicker, usePeriod } from '../period.js';
import {
  ANALYSIS_TABS,
  APP_ROUTES,
  type AppRouteId,
  MOBILE_ROUTES,
  TABBED_ROUTE_IDS,
} from '../routeMetadata.js';
import { CommandPalette, OPEN_COMMAND_PALETTE_EVENT } from './CommandPalette.js';
import { ExportMenu } from './ExportMenu.js';
import { NavItem } from './NavItem.js';
import { RouteIcon } from './RouteIcon.js';
import { Term } from './Term.js';

const ImprovementRequestButton = lazy(() =>
  import('./ImprovementRequestButton.js').then((module) => ({
    default: module.ImprovementRequestButton,
  })),
);

const IMPROVEMENT_BUTTON_FALLBACK: ReactNode = null;

const STATUS_LABEL: Record<string, string> = {
  ok: '余裕あり',
  tight: 'ぎりぎり',
  danger: '要注意',
  nodata: 'データなし',
};

type WorkflowGroup = '取込' | '整える' | '確認' | '計画' | '管理';

const ROUTE_GROUP: Record<AppRouteId, WorkflowGroup> = {
  overview: '取込',
  import: '取込',
  cash: '取込',
  classify: '整える',
  subscriptions: '整える',
  household: '整える',
  analysis: '確認',
  statements: '確認',
  ai: '確認',
  budget: '計画',
  tradeoff: '計画',
  settings: '管理',
  guide: '管理',
};

const MONTHLY_STEPS: readonly Exclude<WorkflowGroup, '管理'>[] = ['取込', '整える', '確認', '計画'];

function currentLocation(pathname: string, locked: boolean) {
  if (locked) return { group: 'ログイン', labels: ['ログイン'] };
  if (pathname === '/improvement') return { group: '管理' as const, labels: ['改善要望'] };

  const analysis = ANALYSIS_TABS.find((tab) => pathname === tab.path);
  if (analysis) return { group: '確認' as const, labels: ['支出分析', analysis.label] };

  const route = APP_ROUTES.find((candidate) =>
    candidate.path === '/' ? pathname === '/' : pathname === candidate.path,
  );
  if (!route) return { group: '管理' as const, labels: ['ページ'] };
  return { group: ROUTE_GROUP[route.id], labels: [route.label] };
}

function latestImportAt(rows: ImportHistoryRow[] | undefined): string | null {
  let latest: string | null = null;
  for (const row of rows ?? []) {
    const candidate = row.committedAt ?? row.createdAt;
    if (candidate && (!latest || candidate > latest)) latest = candidate;
  }
  return latest;
}

function updateLabel(raw: string | null): string {
  if (!raw) return '未取込';
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return '確認不可';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('mousedown', outside);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('mousedown', outside);
    };
  }, [open]);

  const logout = async () => {
    setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      window.dispatchEvent(new Event(AUTH_EVENT));
    } catch {
      setError('ログアウトできません。もう一度お試しください。');
    }
  };

  return (
    <span className="popover-host user-menu" ref={ref}>
      <button
        type="button"
        aria-label="利用者メニュー"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        利用者
      </button>
      {open && (
        <span className="popover" role="menu">
          <span className="popover-copy">ログイン中</span>
          <button type="button" className="btn" role="menuitem" onClick={() => void logout()}>
            ログアウトする
          </button>
          {error && <span role="alert">{error}</span>}
        </span>
      )}
    </span>
  );
}

export function Layout({ children, locked = false }: { children: ReactNode; locked?: boolean }) {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  const location = currentLocation(loc.pathname, locked);

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
    enabled: !locked,
  });
  const imports = useQuery({
    queryKey: ['imports'],
    queryFn: () => api<{ imports: ImportHistoryRow[] }>('/imports'),
    enabled: !locked,
    staleTime: 60_000,
  });

  const d = summary.data?.defense;
  const ov = summary.data?.overview;
  const months = ov?.months ?? [];
  const period = months.length
    ? `${monthLabel(months[0])} 〜 ${monthLabel(months[months.length - 1])}`
    : '未取込';
  const unrec = ov?.unrecordedExpMonths ?? [];
  const latestAt = latestImportAt(imports.data?.imports);
  const freshness = locked
    ? 'ログイン後'
    : imports.isLoading
      ? '確認中'
      : imports.isError
        ? '確認不可'
        : updateLabel(latestAt);

  const lockedNav = (route: (typeof APP_ROUTES)[number]) => (
    <span className="nav-locked" aria-disabled="true" title={`${route.label}(ログイン後に利用)`}>
      <RouteIcon name={route.icon} />
      <span className="nav-label">{route.label}</span>
    </span>
  );
  return (
    <div className={`shell${locked ? ' shell-locked' : ''}`}>
      <a href="#main-content" className="skip-link">
        本文へスキップ
      </a>
      {!locked && <CommandPalette />}

      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        {locked ? (
          <div className="brand" aria-label="Focus Ledger">
            <span className="brand-name">Focus Ledger</span>
            <small>月次クローズ</small>
          </div>
        ) : (
          <Link to="/" className="brand">
            <span className="brand-name">Focus Ledger</span>
            <small>収支統合管理</small>
          </Link>
        )}

        <section className="workflow-progress" aria-label="月次進捗">
          <div className="workflow-progress-head">
            <span>月次進捗</span>
            <strong>
              {location.group === '管理' || location.group === 'ログイン' ? '業務外' : '現在地'}
            </strong>
          </div>
          <ol>
            {MONTHLY_STEPS.map((step, index) => (
              <li key={step} className={location.group === step ? 'current' : undefined}>
                <span className="step-number">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p>{locked ? 'ログイン後に確認' : `未記録 ${unrec.length}ヶ月`}</p>
        </section>

        <nav className="nav" aria-label="メインナビゲーション">
          {APP_ROUTES.map((route) => {
            const subTabs = route.id === 'analysis' ? ANALYSIS_TABS : null;
            return (
              <div key={route.id}>
                {route.navGroup && (
                  <div className={`nav-group${location.group === route.navGroup ? ' current' : ''}`}>
                    {route.navGroup}
                  </div>
                )}
                {locked ? (
                  lockedNav(route)
                ) : (
                  <NavItem
                    to={route.path}
                    icon={route.icon}
                    label={route.label}
                    variant="sidebar"
                    end={!TABBED_ROUTE_IDS.has(route.id) || subTabs !== null}
                  />
                )}
                {subTabs && (
                  <div className="nav-sub">
                    {subTabs.map((tab) =>
                      locked ? (
                        <span
                          key={tab.id}
                          className="nav-locked"
                          aria-disabled="true"
                          title={`${tab.label}(ログイン後に利用)`}
                        >
                          <RouteIcon name={tab.icon} />
                          <span className="nav-label">{tab.label}</span>
                        </span>
                      ) : (
                        <NavItem
                          key={tab.id}
                          to={tab.path}
                          icon={tab.icon}
                          label={tab.label}
                          variant="sidebar"
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div>
            {locked ? (
              <span className="nav-locked" aria-disabled="true" title="改善要望(ログイン後に利用)">
                <RouteIcon name="scan-search" />
                <span className="nav-label">改善要望</span>
              </span>
            ) : (
              <NavItem to="/improvement" icon="scan-search" label="改善要望" variant="sidebar" end />
            )}
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
        {locked ? (
          <span className="header-brand">Focus Ledger</span>
        ) : (
          <Link to="/" className="header-brand">
            Focus Ledger
          </Link>
        )}
        <nav className="header-location" aria-label="現在地">
          <span>{location.group}</span>
          {location.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </nav>
        <span className="header-period" title={`表示中: ${period}`}>
          <span className="header-period-label">全体期間</span>
          <PeriodPicker meta={summary.data?.period} disabled={locked} />
        </span>
        <span className="spacer" />
        <span className="header-status" aria-label="データ状態">
          {locked ? (
            <span className="status-fact">防衛線 ログイン後</span>
          ) : d && d.status !== 'nodata' ? (
            <span className={`badge header-defense ${d.status}`}>
              <Term id="defenseLine">防衛線</Term> <span className="num">{yen(d.line)}</span>
              <span className="badge-detail">
                {' '}
                / 見込 <span className="num">{yen(d.incomeEstimate)}</span>
              </span>{' '}
              {STATUS_LABEL[d.status]}
            </span>
          ) : (
            <span className="badge header-defense header-defense-placeholder" aria-hidden="true">
              防衛線 <span className="num">¥000,000</span>
              <span className="badge-detail">
                {' '}
                / 見込 <span className="num">¥000,000</span>
              </span>{' '}
              要注意
            </span>
          )}
          <span className={`status-fact${unrec.length > 0 ? ' warn' : ''}`}>
            <Term id="unrecordedMonth">未記録</Term> {locked ? '—' : `${unrec.length}ヶ月`}
          </span>
          <span className="status-fact" title={latestAt ?? undefined}>
            最終更新 {freshness}
          </span>
        </span>
        <span className="header-actions" aria-label="共通操作">
          <button
            type="button"
            className="header-action search-action"
            aria-label="画面を検索"
            disabled={locked}
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          >
            検索 <kbd>⌘K</kbd>
          </button>
          {locked ? (
            <button type="button" className="header-action" disabled>
              書き出し
            </button>
          ) : (
            <ExportMenu />
          )}
          {locked ? (
            <a className="header-action" href="#privacy-help">
              ヘルプ
            </a>
          ) : (
            <Link className="header-action" to="/guide">
              使い方
            </Link>
          )}
          {locked ? <span className="status-fact">未ログイン</span> : <UserMenu />}
        </span>
      </header>

      <main className="main" id="main-content" key={loc.pathname}>
        {children}
      </main>

      <footer className="footer">
        <div className="footer-trust">
          <span>取込データは外部送信しません</span>
          <span>税務上の正本はfreeeです</span>
          <span>毎晩バックアップ(30日保持)</span>
        </div>
        <nav className="footer-links" aria-label="信頼とデータの確認先">
          {locked ? <a href="#privacy-help">データ出典</a> : <Link to="/guide">データ出典</Link>}
          {locked ? <span>復元設定はログイン後</span> : <Link to="/settings">復元設定</Link>}
          <details id="privacy-help">
            <summary>プライバシー</summary>
            <p>取り込んだ明細は収支管理と復元のためにだけ使用します。</p>
          </details>
          <details>
            <summary>利用規約</summary>
            <p>本ツールの集計結果は参考情報です。申告前にfreeeの帳簿と照合してください。</p>
          </details>
          <span>Focus Ledger v1</span>
        </nav>
      </footer>

      {!locked && (
        <Suspense fallback={IMPROVEMENT_BUTTON_FALLBACK}>
          <ImprovementRequestButton />
        </Suspense>
      )}

      <nav className="tabbar" aria-label="モバイルナビゲーション">
        {!locked &&
          MOBILE_ROUTES.map((route) => (
            <NavItem
              key={route.id}
              to={route.path}
              icon={route.icon}
              label={route.mobileLabel}
              variant="tab"
              end={!TABBED_ROUTE_IDS.has(route.id)}
            />
          ))}
        <button
          type="button"
          className={`tab${drawer ? ' active' : ''}`}
          aria-expanded={drawer}
          onClick={() => setDrawer((value) => !value)}
        >
          メニュー
        </button>
      </nav>
    </div>
  );
}
