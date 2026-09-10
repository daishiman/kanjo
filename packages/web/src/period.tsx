/**
 * 対象期間の選択を全画面で共有する。
 *
 * 選択そのもの(年 / 直近n年 / 任意期間)だけを持ち、実際の月への解決はサーバに任せる。
 * 「直近1年」がどの月からかはデータの最終月で決まるので、
 * クライアントで解決しようとすると「期間を知るための問い合わせが期間に依存する」循環になる。
 *
 * 保存先は localStorage。URLのクエリに置くとナビゲーションのたびに落ちる。
 */
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SpanYears = 1 | 2 | 3;

export type PeriodSelection =
  | { mode: 'all' }
  | { mode: 'year'; year: string }
  | { mode: 'span'; span: SpanYears }
  | { mode: 'custom'; from: string; to: string };

export const SPAN_LABEL: Record<SpanYears, string> = {
  1: '直近1年',
  2: '直近2年',
  3: '直近3年',
};

/** サーバが返す、絞り込み前のデータから作った期間の情報 */
export interface PeriodMeta {
  applied: { from: string; to: string } | null;
  label: string;
  full: { from: string; to: string } | null;
  years: string[];
  monthCount: number;
}

const STORAGE_KEY = 'kanjo:period';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 保存値の検証。壊れていれば全期間に倒す(選択が読めないだけで画面が出ないのは避ける) */
export function parseSelection(raw: string | null): PeriodSelection {
  if (!raw) return { mode: 'all' };
  try {
    const v = JSON.parse(raw) as PeriodSelection;
    if (v?.mode === 'year' && /^\d{4}$/.test(v.year)) return v;
    if (v?.mode === 'span' && [1, 2, 3].includes(v.span)) return v;
    if (v?.mode === 'custom' && MONTH_RE.test(v.from) && MONTH_RE.test(v.to) && v.from <= v.to) return v;
  } catch {
    // 壊れた保存値は捨てる
  }
  return { mode: 'all' };
}

/** 選択をAPIのクエリ文字列にする。全期間のときは空文字(パラメータを付けない) */
export function selectionToQuery(sel: PeriodSelection): string {
  if (sel.mode === 'year') return `year=${sel.year}`;
  if (sel.mode === 'span') return `span=${sel.span}`;
  if (sel.mode === 'custom' && MONTH_RE.test(sel.from) && MONTH_RE.test(sel.to) && sel.from <= sel.to) {
    return `from=${sel.from}&to=${sel.to}`;
  }
  return '';
}

interface PeriodContextValue {
  selection: PeriodSelection;
  setSelection: (s: PeriodSelection) => void;
  /** react-query の queryKey に混ぜる安定した識別子 */
  key: string;
  /** api() に渡すパスへ期間クエリを足す */
  withPeriod: (path: string) => string;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<PeriodSelection>(() => {
    try {
      return parseSelection(localStorage.getItem(STORAGE_KEY));
    } catch {
      // プライベートモードなどで localStorage が使えない環境でも動かす
      return { mode: 'all' };
    }
  });

  const setSelection = useCallback((s: PeriodSelection) => {
    setSelectionState(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // 保存できなくても、そのセッションの間は選択が効く
    }
  }, []);

  const value = useMemo<PeriodContextValue>(() => {
    const qs = selectionToQuery(selection);
    return {
      selection,
      setSelection,
      key: qs || 'all',
      withPeriod: (path: string) => (qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path),
    };
  }, [selection, setSelection]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

/**
 * Provider の外でも落ちないようにする。Provider を足し忘れた画面が
 * 白画面になるより、全期間で表示されたほうが害が小さい。
 */
const FALLBACK: PeriodContextValue = {
  selection: { mode: 'all' },
  setSelection: () => {},
  key: 'all',
  withPeriod: (p) => p,
};

export const usePeriod = (): PeriodContextValue => useContext(PeriodContext) ?? FALLBACK;

/**
 * 対象期間の選択UI(tax-year.tsx が context と TaxYearPicker を同居させているのと同じ形)。
 *
 * 年・直近n年・任意期間を1つのselectにまとめる。選択肢は必ずサーバが返した
 * 絞り込み前の年一覧から作る(絞り込み後から作ると、2025年を選んだ瞬間に
 * 2026年が選択肢から消えて戻れなくなる)。
 */
export function PeriodPicker({ meta, disabled = false }: { meta?: PeriodMeta; disabled?: boolean }) {
  const { selection, setSelection } = usePeriod();
  const years = meta?.years ?? [];
  const full = meta?.full ?? null;

  const detailValue =
    selection.mode === 'year'
      ? `year:${selection.year}`
      : selection.mode === 'custom'
        ? 'custom'
        : selection.mode === 'all'
          ? 'all'
          : '';

  const onSelect = (v: string) => {
    if (v === 'all') return setSelection({ mode: 'all' });
    if (v.startsWith('year:')) return setSelection({ mode: 'year', year: v.slice(5) });
    // 任意期間は、いまの全体期間を初期値にしておく。空欄から始めると必ず1回は無効になる
    setSelection({ mode: 'custom', from: full?.from ?? '', to: full?.to ?? '' });
  };

  const setCustom = (patch: Partial<{ from: string; to: string }>) => {
    if (selection.mode !== 'custom') return;
    const next: PeriodSelection = { ...selection, ...patch };
    // 入力途中の空値や from > to は selectionToQuery が送信対象から外す。
    setSelection(next);
  };

  if (disabled) {
    return (
      <fieldset className="period-picker is-locked" disabled>
        <legend className="visually-hidden">全体期間</legend>
        <span>1年</span>
        <span>2年</span>
        <span>3年</span>
        <span>任意</span>
        <span className="visually-hidden">ログイン後に選択できます</span>
      </fieldset>
    );
  }

  return (
    <fieldset className="period-picker" aria-label="全体期間">
      <legend className="visually-hidden">全体期間</legend>
      <div className="period-presets">
        {([1, 2, 3] as SpanYears[]).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}年で表示`}
            aria-pressed={selection.mode === 'span' && selection.span === n}
            onClick={() => setSelection({ mode: 'span', span: n })}
          >
            {n}年
          </button>
        ))}
        <details className={`period-detail${detailValue ? ' current' : ''}`}>
          <summary aria-label={`任意期間を選ぶ${detailValue ? `(現在: ${meta?.label ?? '任意'})` : ''}`}>
            任意
          </summary>
          <div className="period-popover">
            <label htmlFor="period-select">表示範囲</label>
            <select
              id="period-select"
              className="period-select"
              aria-label="任意期間の種類"
              value={detailValue}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="" disabled>
                期間を選ぶ
              </option>
              <option value="all">全期間</option>
              {years.map((y) => (
                <option key={y} value={`year:${y}`}>
                  {y}年
                </option>
              ))}
              <option value="custom">開始月と終了月を指定</option>
            </select>
            {selection.mode === 'custom' && (
              <div className="period-months">
                <label>
                  <span>開始月</span>
                  <input
                    type="month"
                    className="period-month"
                    aria-label="開始月"
                    min={full?.from}
                    max={full?.to}
                    value={selection.from}
                    onChange={(e) => setCustom({ from: e.target.value })}
                  />
                </label>
                <span aria-hidden="true">〜</span>
                <label>
                  <span>終了月</span>
                  <input
                    type="month"
                    className="period-month"
                    aria-label="終了月"
                    min={full?.from}
                    max={full?.to}
                    value={selection.to}
                    onChange={(e) => setCustom({ to: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        </details>
      </div>
    </fieldset>
  );
}
