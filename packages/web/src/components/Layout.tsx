/** 全ページ共通の Focus Ledger シェル。 */
import type { AnalysisHubReport } from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AUTH_EVENT,
  type ImportHistoryRow,
  type OverviewResponse,
  type SummaryResponse,
  api,
} from '../api.js';
import { monthLabel, yen } from '../format.js';
import { clearAllBudgetDrafts } from '../pages/budget/draft.js';
import { clearAllCashDrafts } from '../pages/cash/draft.js';
import { clearAllLiabilityDrafts } from '../pages/statements/liability-draft.js';
import { PeriodPicker, usePeriod } from '../period.js';
import {
  ANALYSIS_HUB_STALE_TIME_MS,
  ANALYSIS_TABS,
  APP_ROUTES,
  type AnalysisTabId,
  type AppRouteId,
  MOBILE_ROUTES,
  TABBED_ROUTE_IDS,
  analysisHubQueryKey,
  routeContentWidth,
} from '../routeMetadata.js';
import { Button } from './Button.js';
import { CommandPalette, OPEN_COMMAND_PALETTE_EVENT } from './CommandPalette.js';
import { DeferredUiIcon as UiIcon } from './DeferredUiIcon.js';
import { ExportMenu } from './ExportMenu.js';
import { NavItem } from './NavItem.js';
import { NavigationEffects } from './NavigationEffects.js';
import { PageShell } from './Page.js';
import { ReviewCountBadge, useReviewQueue } from './ReviewQueue.js';
import { RouteIcon } from './RouteIcon.js';
import { Term } from './Term.js';

const ImprovementRequestButton = lazy(() =>
  import('./ImprovementRequestButton.js').then((module) => ({
    default: module.ImprovementRequestButton,
  })),
);

const MonthlyCloseProgress = lazy(() =>
  import('./MonthlyCloseProgress.js').then((module) => ({ default: module.MonthlyCloseProgress })),
);

const IMPROVEMENT_BUTTON_FALLBACK: ReactNode = null;

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

function currentLocation(pathname: string, locked: boolean) {
  if (locked) return { group: 'ログイン', labels: ['ログイン'] };
  if (pathname === '/improvement') return { group: '管理' as const, labels: ['改善リクエスト'] };

  const analysis = ANALYSIS_TABS.find((tab) => pathname === tab.path);
  if (analysis) return { group: '確認' as const, labels: ['支出分析', analysis.label] };

  const route = APP_ROUTES.find((candidate) =>
    candidate.path === '/'
      ? pathname === '/'
      : pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );
  if (!route) return { group: '管理' as const, labels: ['ページ'] };
  return { group: ROUTE_GROUP[route.id], labels: [route.label] };
}

/** サイドバー子行の件数。照合だけは期間非依存の月次クローズを正本にする。 */
function ReviewBadge({
  id,
  count,
}: {
  id: AnalysisTabId;
  count: number | null | undefined;
}) {
  if (id !== 'reconciliation' && id !== 'total-cashflow') return null;
  if (!count) return null;
  return (
    <span
      className="badge danger nav-review-badge"
      data-testid={`nav-review-badge-${id}`}
      aria-label={`要確認${count}件`}
    >
      {count}
    </span>
  );
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
      // 同じブラウザを次に使う人へ負債・現金の下書きを残さない (spec-statements-screen §4 / spec-cash-screen FR-8)
      clearAllLiabilityDrafts();
      clearAllBudgetDrafts();
      clearAllCashDrafts();
      window.dispatchEvent(new Event(AUTH_EVENT));
    } catch {
      setError('ログアウトできません。もう一度お試しください。');
    }
  };

  return (
    <span className="popover-host user-menu" ref={ref}>
      <button
        data-native-control="menu-trigger"
        type="button"
        aria-label="利用者メニュー"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UiIcon name="circle-user" className="action-icon" />
        <span className="visually-hidden">利用者</span>
      </button>
      {open && (
        <span className="popover" role="menu">
          <span className="popover-copy">ログイン中</span>
          <Button role="menuitem" onClick={() => void logout()}>
            ログアウトする
          </Button>
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
  // 概況の未処理カード・アクションバーと同じ queryKey。数え方を 1 か所に保つ (AC-002)
  const reviewQueue = useReviewQueue({ enabled: !locked });
  // 概況本体と同じ queryKey / queryFn。React Query が同時要求を1本へ束ね、sidebarも同じcloseStatusを読む。
  const overview = useQuery({
    queryKey: ['overview', 'total', key],
    queryFn: () => api<OverviewResponse>(withPeriod('/overview?scope=total')),
    enabled: !locked && loc.pathname === '/',
  });
  // 月次クローズは全画面で出す。概況以外は件数と同じ /review-queue の closeStatus を読む
  const closeStatus = reviewQueue.data?.closeStatus ?? overview.data?.closeStatus;
  const reconciliationCount = closeStatus?.steps.find((step) => step.key === 'reconciliation')?.count;
  // 旧 Worker など形の違う応答では件数を出さない (0 件と誤読させない)
  const overviewBadge =
    typeof reviewQueue.data?.total === 'number' ? (
      <ReviewCountBadge count={reviewQueue.data.total} />
    ) : undefined;
  const routeBadge = (routeId: AppRouteId) => {
    if (!reviewQueue.data) return routeId === 'overview' ? overviewBadge : undefined;
    if (routeId === 'overview') return overviewBadge;
    const counts = reviewQueue.data.counts;
    if (!counts) return undefined;
    if (routeId === 'import') return <ReviewCountBadge count={counts.import} />;
    if (routeId === 'classify') return <ReviewCountBadge count={counts.classification} />;
    if (routeId === 'subscriptions' && reviewQueue.data.subscriptionCandidates)
      return <ReviewCountBadge count={reviewQueue.data.subscriptionCandidates} />;
    return undefined;
  };
  // ハブ画面と同じキー。支出分析を開いていてもリクエストは 1 本にまとまる
  const hub = useQuery({
    queryKey: analysisHubQueryKey(key),
    queryFn: () => api<AnalysisHubReport>(withPeriod('/analysis/hub')),
    enabled: !locked,
    staleTime: ANALYSIS_HUB_STALE_TIME_MS,
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
      {!locked && <NavigationEffects />}
      <a href="#main-content" className="skip-link">
        本文へスキップ
      </a>
      {!locked && <CommandPalette />}

      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        {locked ? (
          <div className="brand" aria-label="Focus Ledger">
            <UiIcon name="brand-bars" className="brand-mark" />
            <span className="brand-copy">
              <span className="brand-name">Focus Ledger</span>
              <small>月次クローズ</small>
            </span>
          </div>
        ) : (
          <Link to="/" className="brand">
            <UiIcon name="brand-bars" className="brand-mark" />
            <span className="brand-copy">
              <span className="brand-name">Focus Ledger</span>
              <small>収支統合管理</small>
            </span>
          </Link>
        )}

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
                    badge={
                      route.id === 'analysis' || route.id === 'statements' ? (
                        <>
                          {routeBadge(route.id)}
                          <UiIcon name="chevron-right" className="nav-chevron" />
                        </>
                      ) : (
                        routeBadge(route.id)
                      )
                    }
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
                        <span key={tab.id} className="nav-sub-row">
                          <NavItem to={tab.path} icon={tab.icon} label={tab.label} variant="sidebar" />
                          <ReviewBadge
                            id={tab.id}
                            count={
                              tab.id === 'reconciliation'
                                ? // closeStatus が無い rolling deploy 中だけ hub 件数へ退避する。
                                  (reconciliationCount ??
                                  hub.data?.views?.reconciliation?.actionRequiredCount)
                                : hub.data?.views?.['total-cashflow']?.reviewCount
                            }
                          />
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div>
            {locked ? (
              <span className="nav-locked" aria-disabled="true" title="改善リクエスト(ログイン後に利用)">
                <RouteIcon name="scan-search" />
                <span className="nav-label">改善リクエスト</span>
              </span>
            ) : (
              <NavItem to="/improvement" icon="scan-search" label="改善リクエスト" variant="sidebar" end />
            )}
          </div>
        </nav>
        {!locked && (
          <Suspense fallback={null}>
            <MonthlyCloseProgress status={closeStatus} />
          </Suspense>
        )}
      </aside>
      {drawer && (
        <button
          type="button"
          data-native-control="disclosure"
          aria-expanded={drawer}
          aria-label="ナビゲーションを閉じる"
          className="backdrop"
          onClick={() => setDrawer(false)}
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
            <span className="status-fact">防衛ライン ログイン後</span>
          ) : d && d.status !== 'nodata' ? (
            <span className={`badge header-defense ${d.status}`}>
              <UiIcon name="shield-check" className="status-icon" />
              <Term id="defenseLine">防衛ライン</Term>：
              {d.status === 'ok' ? '正常' : d.status === 'tight' ? '注意' : '要対応'}
              <span className="badge-detail">
                {' '}
                <span className="num">{yen(d.line)}</span> / 見込{' '}
                <span className="num">{yen(d.incomeEstimate)}</span>
              </span>
            </span>
          ) : (
            <span className="badge header-defense header-defense-placeholder" aria-hidden="true">
              防衛ライン：要対応
              <span className="badge-detail">
                {' '}
                <span className="num">¥000,000</span> / 見込 <span className="num">¥000,000</span>
              </span>
            </span>
          )}
          <span className={`status-fact${unrec.length > 0 ? ' warn' : ''}`}>
            <Term id="unrecordedMonth">未記録</Term> {locked ? '—' : `${unrec.length}か月`}
          </span>
          <span className="status-fact" title={latestAt ?? undefined}>
            最終更新 {freshness}
          </span>
        </span>
        <span className="header-actions" aria-label="共通操作">
          <Button
            className="header-action search-action"
            aria-label="画面を検索"
            disabled={locked}
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          >
            <UiIcon name="search" className="action-icon" />
            <span className="visually-hidden">検索</span>
            <kbd>⌘K</kbd>
          </Button>
          {locked ? (
            <Button className="header-action" disabled>
              書き出し
            </Button>
          ) : (
            <ExportMenu />
          )}
          {locked ? (
            <a className="header-action" href="#privacy-help">
              ヘルプ
            </a>
          ) : (
            <Link className="header-action" to="/guide" aria-label="使い方">
              <UiIcon name="help" className="action-icon" />
              <span className="visually-hidden">使い方</span>
            </Link>
          )}
          {locked ? <span className="status-fact">未ログイン</span> : <UserMenu />}
        </span>
      </header>

      <PageShell width={routeContentWidth(loc.pathname)} id="main-content" key={loc.pathname}>
        {children}
      </PageShell>

      <footer className="footer">
        <div className="footer-trust">
          <span>
            <UiIcon name="lock" className="trust-icon" />
            アプリからは自動送信しません。AI実行時は確認した集計データを選択したAIへ渡します
          </span>
          <span>
            <UiIcon name="badge-check" className="trust-icon" />
            税務上の正本はfreeeです
          </span>
          <span>
            <UiIcon name="cloud" className="trust-icon" />
            毎晩バックアップ(30日保持)
          </span>
        </div>
        <nav className="footer-links" aria-label="信頼とデータの確認先">
          <details>
            <summary>利用規約</summary>
            <p>本ツールの集計結果は参考情報です。申告前にfreeeの帳簿と照合してください。</p>
          </details>
          <details id="privacy-help">
            <summary>プライバシー</summary>
            <p>取り込んだ明細は収支管理と復元のためにだけ使用します。</p>
          </details>
          {locked ? <a href="#privacy-help">データ出典</a> : <Link to="/guide">データ出典</Link>}
          <span>v1.0</span>
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
          data-native-control="disclosure"
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
