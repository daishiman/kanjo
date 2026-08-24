/**
 * 全ページ共通レイアウト(spec §10.1)。
 * ヘッダー: 対象期間 / 防衛ラインバッジ(FR-08) / データ状態 / エクスポート
 * サイドバー: P1〜P11ナビ(モバイルはドロワー)
 */
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { type SummaryResponse, api } from '../api.js';
import { monthLabel, yen } from '../format.js';

const NAV: { to: string; icon: string; label: string; group?: string }[] = [
  { to: '/', icon: '◎', label: '概況', group: '見る' },
  { to: '/matrix', icon: '田', label: '増減マトリクス' },
  { to: '/diagnosis', icon: '診', label: '統計診断' },
  { to: '/subscriptions', icon: 'S', label: 'サブスク分析' },
  { to: '/household', icon: '家', label: '家計' },
  { to: '/classify', icon: '仕', label: '公私仕分け', group: '整える' },
  { to: '/budget', icon: '予', label: '予算管理' },
  { to: '/tradeoff', icon: '算', label: 'やりくり試算' },
  { to: '/import', icon: '入', label: 'データ取込', group: '運用' },
  { to: '/settings', icon: '設', label: '設定' },
  { to: '/guide', icon: '?', label: '指標ガイド' },
];

const STATUS_LABEL: Record<string, string> = {
  ok: '余裕あり',
  tight: 'ぎりぎり',
  danger: '要注意',
  nodata: 'データなし',
};

export function Layout({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();

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
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <div className="brand">
          収支統合管理
          <small>freee × マネーフォワード</small>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <div key={n.to}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <NavLink
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setDrawer(false)}
              >
                <span className="icon">{n.icon}</span>
                {n.label}
              </NavLink>
            </div>
          ))}
        </nav>
      </aside>
      {drawer && (
        <div
          className="backdrop"
          onClick={() => setDrawer(false)}
          onKeyDown={() => setDrawer(false)}
          role="presentation"
        />
      )}

      <header className="header">
        <button type="button" className="menu-btn" onClick={() => setDrawer(true)} aria-label="メニュー">
          ≡
        </button>
        <h1>収支統合管理</h1>
        <span className="period">{period}</span>
        <span className="spacer" />
        {d && d.status !== 'nodata' && (
          <span
            className={`badge ${d.status}`}
            title="防衛ライン(個人生活費3ヶ月平均+事業固定費)と今月の収入見込みの対比"
          >
            防衛線 <span className="num">{yen(d.line)}</span> / 見込{' '}
            <span className="num">{yen(d.incomeEstimate)}</span> {STATUS_LABEL[d.status]}
          </span>
        )}
        {unrec.length > 0 && (
          <span className="badge warn" title="経費が未記帳の月(統計から除外)">
            未記帳 {unrec.map((m) => monthLabel(m)).join('・')}
          </span>
        )}
        <ExportMenu />
      </header>

      <main className="main" key={loc.pathname}>
        {children}
      </main>

      <footer className="footer">
        明細データは外部に送信されません(アナリティクスなし)。税務上の正はfreeeの記帳です。バックアップは毎晩自動保存(30日保持)。
      </footer>
    </div>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}>
        書き出し ▾
      </button>
      {open && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 8,
            display: 'grid',
            gap: 6,
            zIndex: 30,
            width: 200,
          }}
        >
          <a className="btn" href="/api/export/json" onClick={() => setOpen(false)}>
            統合データJSON
          </a>
          <a className="btn" href="/api/export/matrix.csv" onClick={() => setOpen(false)}>
            マトリクスCSV
          </a>
        </span>
      )}
    </span>
  );
}
