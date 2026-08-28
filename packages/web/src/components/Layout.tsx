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
import { type PeriodMeta, type PeriodSelection, SPAN_LABEL, type SpanYears, usePeriod } from '../period.js';
import { APP_ROUTES, MOBILE_ROUTES } from '../routeMetadata.js';
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

      <header className="header" ref={headerRef}>
        <Link to="/" className="header-brand">
          収支統合管理
        </Link>
        <span className="period">{period}</span>
        <PeriodPicker meta={summary.data?.period} />
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

/**
 * 対象期間の選択。
 *
 * 年・直近n年・任意期間を1つのselectにまとめる。選択肢は必ずサーバが返した
 * 絞り込み前の年一覧から作る(絞り込み後から作ると、2025年を選んだ瞬間に
 * 2026年が選択肢から消えて戻れなくなる)。
 */
function PeriodPicker({ meta }: { meta?: PeriodMeta }) {
  const { selection, setSelection } = usePeriod();
  const years = meta?.years ?? [];
  const full = meta?.full ?? null;

  const value =
    selection.mode === 'year'
      ? `year:${selection.year}`
      : selection.mode === 'span'
        ? `span:${selection.span}`
        : selection.mode === 'custom'
          ? 'custom'
          : 'all';

  const onSelect = (v: string) => {
    if (v === 'all') return setSelection({ mode: 'all' });
    if (v.startsWith('year:')) return setSelection({ mode: 'year', year: v.slice(5) });
    if (v.startsWith('span:')) return setSelection({ mode: 'span', span: Number(v.slice(5)) as SpanYears });
    // 任意期間は、いまの全体期間を初期値にしておく。空欄から始めると必ず1回は無効になる
    setSelection({ mode: 'custom', from: full?.from ?? '', to: full?.to ?? '' });
  };

  const setCustom = (patch: Partial<{ from: string; to: string }>) => {
    if (selection.mode !== 'custom') return;
    const next: PeriodSelection = { ...selection, ...patch };
    // from > to の瞬間はサーバが全期間に倒すので、入力途中でも画面は壊れない
    setSelection(next);
  };

  return (
    <span className="period-picker">
      <label className="visually-hidden" htmlFor="period-select">
        対象期間
      </label>
      <select
        id="period-select"
        className="period-select"
        value={value}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="all">全期間</option>
        {([1, 2, 3] as SpanYears[]).map((n) => (
          <option key={n} value={`span:${n}`}>
            {SPAN_LABEL[n]}
          </option>
        ))}
        {years.map((y) => (
          <option key={y} value={`year:${y}`}>
            {y}年
          </option>
        ))}
        <option value="custom">期間を指定…</option>
      </select>
      {selection.mode === 'custom' && (
        <>
          <input
            type="month"
            className="period-month"
            aria-label="開始月"
            min={full?.from}
            max={full?.to}
            value={selection.from}
            onChange={(e) => setCustom({ from: e.target.value })}
          />
          <span aria-hidden="true">〜</span>
          <input
            type="month"
            className="period-month"
            aria-label="終了月"
            min={full?.from}
            max={full?.to}
            value={selection.to}
            onChange={(e) => setCustom({ to: e.target.value })}
          />
        </>
      )}
    </span>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { withPeriod } = usePeriod();
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
          <a
            className="btn"
            role="menuitem"
            href={withPeriod('/api/export/matrix.csv')}
            onClick={() => setOpen(false)}
          >
            マトリクスCSV
          </a>
        </span>
      )}
    </span>
  );
}
