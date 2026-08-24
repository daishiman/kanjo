/**
 * 全ページ共通レイアウト(spec §10.1)。
 * ヘッダー: 対象期間 / 防衛ラインバッジ(FR-08 常時表示) / データ状態 / エクスポート
 * ナビ: PC=サイドバー / モバイル(〜640px)=下部固定タブバー(最頻4画面+メニュー)
 */
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { type SummaryResponse, api } from '../api.js';
import { monthLabel, yen } from '../format.js';
import { APP_ROUTES, MOBILE_ROUTES } from '../routeMetadata.js';

const STATUS_LABEL: Record<string, string> = {
  ok: '余裕あり',
  tight: 'ぎりぎり',
  danger: '要注意',
  nodata: 'データなし',
};

export function Layout({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();

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

  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<SummaryResponse>('/summary'),
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

      <aside className={`sidebar${drawer ? ' open' : ''}`} aria-label="メインナビゲーション">
        <Link to="/" className="brand">
          収支統合管理
          <small>freee × マネーフォワード</small>
        </Link>
        <nav className="nav">
          {APP_ROUTES.map((route) => (
            <div key={route.id}>
              {route.navGroup && <div className="nav-group">{route.navGroup}</div>}
              <NavLink
                to={route.path}
                end={route.path === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {route.label}
              </NavLink>
            </div>
          ))}
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

      <header className="header">
        <Link to="/" className="header-brand">
          収支統合管理
        </Link>
        <span className="period">{period}</span>
        <span className="spacer" />
        {d && d.status !== 'nodata' && (
          <span
            className={`badge ${d.status}`}
            title="防衛ライン(個人生活費3ヶ月平均+事業固定費)と今月の収入見込みの対比"
          >
            防衛線 <span className="num">{yen(d.line)}</span>
            <span className="badge-detail">
              {' '}
              / 見込 <span className="num">{yen(d.incomeEstimate)}</span>
            </span>{' '}
            {STATUS_LABEL[d.status]}
          </span>
        )}
        {unrec.length > 0 && (
          <span className="badge warn" title="経費が未記帳の月(統計から除外)">
            未記帳 {unrec.map((m) => monthLabel(m)).join('・')}
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

      <nav className="tabbar" aria-label="モバイルナビゲーション">
        {MOBILE_ROUTES.map((route) => (
          <NavLink
            key={route.id}
            to={route.path}
            end={route.path === '/'}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            {route.mobileLabel}
          </NavLink>
        ))}
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

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span className="popover-host" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        書き出し ▾
      </button>
      {open && (
        <span className="popover" role="menu">
          <a className="btn" role="menuitem" href="/api/export/json" onClick={() => setOpen(false)}>
            統合データJSON
          </a>
          <a className="btn" role="menuitem" href="/api/export/matrix.csv" onClick={() => setOpen(false)}>
            マトリクスCSV
          </a>
        </span>
      )}
    </span>
  );
}
