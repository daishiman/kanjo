import type { StatementsScreen } from '@kanjo/core';
/**
 * 決算書画面のページ制御 (spec-statements-screen §1・§2)。
 *
 * URL 状態 (`tab` / `row` / `ref`) と取得だけを持ち、各節の表示は同じディレクトリの部品へ分ける。
 * 画面の数字は応答の `screen` (core の statementsScreen) だけから読む。
 * 上部の 3 項目は見た目はタブだが意味論はページ内ナビ (nav + aria-current)。3 節は隠さずすべて描画する。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { type StatementsResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { KpiCard, PageHeader, PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';
import { StatementsBs } from './StatementsBs.js';
import { StatementsCf } from './StatementsCf.js';
import { StatementsKpis } from './StatementsKpis.js';
import { StatementsPl } from './StatementsPl.js';
import { STATEMENTS_TABS, type StatementsTab, readStatementsUrl, shiftedPeriod } from './view-model.js';
import './statements.css';

const TITLE = '損益・資金・残高は、整合していますか？';
const LEAD =
  '損益計算書・キャッシュフロー計算書・貸借対照表のつながりを確認し、決算の整合性をチェックしましょう。';

type Patch = Partial<Record<'tab' | 'row' | 'ref', string | null>>;

function PeriodRange({ screen }: { screen: StatementsScreen | undefined }) {
  const { setSelection } = usePeriod();
  const meta = screen?.period.navigation;
  const previous = shiftedPeriod(meta, -1);
  const next = shiftedPeriod(meta, 1);
  const label = screen?.period.label ?? '全期間';
  return (
    <div className="stmt-range" aria-label="対象期間">
      <Button
        size="mini"
        aria-label="前の期間へ"
        disabled={!previous}
        onClick={() => previous && setSelection(previous)}
      >
        ‹
      </Button>
      <span className="stmt-range-label">{label}</span>
      <Button size="mini" aria-label="次の期間へ" disabled={!next} onClick={() => next && setSelection(next)}>
        ›
      </Button>
    </div>
  );
}

/** 節へ移る要求。リンクの遷移 state に載せ、行の選択など他の URL 更新ではフォーカスを動かさない */
interface SectionFocusState {
  focusSection?: StatementsTab;
}

function SectionNav({
  current,
  hrefFor,
}: { current: StatementsTab; hrefFor: (tab: StatementsTab) => string }) {
  // 実リンクにする (中クリック・新しいタブで開いても同じ節が選ばれる)。フォーカス移動は遷移後の effect が担う
  return (
    <nav className="stmt-nav" aria-label="計算書">
      {STATEMENTS_TABS.map((tab) => (
        <Link
          key={tab.key}
          to={hrefFor(tab.key)}
          replace
          preventScrollReset
          state={{ focusSection: tab.key } satisfies SectionFocusState}
          aria-current={tab.key === current ? 'location' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function EmptyKpis() {
  return (
    <div className="kpis stmt-kpis">
      {['売上高', '営業利益', '現金増減', '負債残高'].map((label) => (
        <KpiCard key={label} label={label} value="—" />
      ))}
    </div>
  );
}

export function StatementsPage() {
  const [params, setParams] = useSearchParams();
  const url = readStatementsUrl(params);
  const { key, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: ['statements', key, url.ref],
    queryFn: () =>
      api<StatementsResponse>(
        withPeriod(url.ref ? `/statements?ref=${encodeURIComponent(url.ref)}` : '/statements'),
      ),
    placeholderData: keepPreviousData,
  });
  /** × で閉じた状態。URL の row を消すと既定の sales に戻るため、閉じたことは画面内で覚える */
  const [closed, setClosed] = useState(false);
  const headings = useRef<Partial<Record<StatementsTab, HTMLHeadingElement | null>>>({});

  const update = useCallback(
    (patch: Patch) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            if (value === null) next.delete(name);
            else next.set(name, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const focusSection = useCallback((tab: StatementsTab) => {
    const heading = headings.current[tab];
    if (!heading) return;
    heading.scrollIntoView?.({ block: 'start' });
    heading.focus({ preventScroll: true });
  }, []);

  // 再読込・共有された URL の ?tab= の節へ、最初の描画のあとで 1 回だけ移る
  const scrolled = useRef(false);
  const ready = Boolean(query.data?.screen.pl.rows[0]?.monthly.length);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回の描画完了時だけ移る。
  useEffect(() => {
    if (!ready || scrolled.current) return;
    scrolled.current = true;
    if (params.has('tab')) focusSection(url.tab);
  }, [ready]);

  // ナビのリンクで来たときだけ、その節の見出しへ移る。同じ節をもう一度押しても location.key は変わる
  const location = useLocation();
  const requested = (location.state as SectionFocusState | null)?.focusSection;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 遷移ごと (location.key) に 1 回だけ移る。
  useEffect(() => {
    if (requested) focusSection(requested);
  }, [location.key]);

  // サーバが丸めた基準月と URL が違うときは URL を置き換える (spec §3 ref)
  const referenceMonth = query.data?.screen.bs.referenceMonth;
  useEffect(() => {
    if (!referenceMonth || query.isPlaceholderData) return;
    if (url.ref !== null && url.ref !== referenceMonth) update({ ref: referenceMonth });
  }, [referenceMonth, url.ref, query.isPlaceholderData, update]);

  const header = (
    <div className="stmt-intro">
      <PageHeader route="statements" title={TITLE} lead={LEAD} showTask={false} />
      <PeriodRange screen={query.data?.screen} />
    </div>
  );

  if (query.isLoading)
    return (
      <>
        {header}
        <PageState status="loading" />
      </>
    );
  if (!query.data)
    return (
      <>
        {header}
        <PageState status="error" error={query.error} />
      </>
    );

  const response = query.data;
  const screen = response.screen;
  const bsSection = (
    <StatementsBs
      screen={screen}
      onMonth={(month) => update({ ref: month })}
      headingRef={(element) => {
        headings.current.bs = element;
      }}
    />
  );

  if (!screen.pl.rows[0]?.monthly.length)
    return (
      <>
        {header}
        <EmptyKpis />
        <section className="card stmt-empty" aria-labelledby="stmt-empty-title">
          <h2 id="stmt-empty-title">この期間の取引がありません</h2>
          <p className="sub">
            仕訳を取り込むと、損益計算書・キャッシュフロー計算書・貸借対照表を表示できます。
          </p>
          <Link className="btn primary" to="/import">
            データ取込へ
          </Link>
        </section>
        {/* 資産推移CSVだけを入れた直後でも残高を隠さない。残高も無ければ BS 節が取込元を案内する */}
        {bsSection}
      </>
    );

  const hrefFor = (tab: StatementsTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    return `?${next.toString()}`;
  };

  return (
    <div className={`statements${query.isPlaceholderData ? ' is-stale' : ''}`} aria-busy={query.isFetching}>
      {header}
      <StatementsKpis kpis={screen.kpis} />
      <SectionNav current={url.tab} hrefFor={hrefFor} />
      <StatementsPl
        screen={screen}
        selected={closed ? null : url.row}
        onSelect={(row) => {
          setClosed(false);
          update({ row });
        }}
        onClose={() => {
          setClosed(true);
          update({ row: null });
        }}
        headingRef={(element) => {
          headings.current.pl = element;
        }}
      />
      <StatementsCf
        cf={screen.cf}
        headingRef={(element) => {
          headings.current.cf = element;
        }}
      />
      {bsSection}
    </div>
  );
}
