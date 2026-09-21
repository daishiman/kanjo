/**
 * 決算書画面の表示用の純粋関数 (spec-statements-screen §1)。
 *
 * 数を数える・足すのは core の statementsScreen の責務で、ここでは文言と丸めと URL 状態だけを扱う。
 * 唯一の例外は万円表の合計列で、これも core が返した円の値を足してから丸める (丸めた値を足さない)。
 */
import type { StatementsKpi, StatementsRowKey, StatementsScreen } from '@kanjo/core';
import { deltaCls, gainCls } from '../../format.js';
import type { PeriodSelection } from '../../period.js';

export type StatementsTab = 'pl' | 'cf' | 'bs';

export const STATEMENTS_TABS: ReadonlyArray<{ key: StatementsTab; label: string }> = [
  { key: 'pl', label: '損益計算書' },
  { key: 'cf', label: 'キャッシュフロー計算書' },
  { key: 'bs', label: '貸借対照表' },
];

const ROW_KEYS: readonly StatementsRowKey[] = ['sales', 'cogs', 'gross', 'sga', 'operating'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface StatementsUrlState {
  tab: StatementsTab;
  /** 既定は sales。URL に無いときも sales を選ぶ */
  row: StatementsRowKey;
  /** 基準月。未指定・不正は null (サーバが期間の最終月に丸める) */
  ref: string | null;
}

export function readStatementsUrl(params: URLSearchParams): StatementsUrlState {
  const tab = params.get('tab');
  const row = params.get('row');
  const ref = params.get('ref');
  return {
    tab: tab === 'cf' || tab === 'bs' ? tab : 'pl',
    row: ROW_KEYS.includes(row as StatementsRowKey) ? (row as StatementsRowKey) : 'sales',
    ref: ref && MONTH_RE.test(ref) ? ref : null,
  };
}

/** 符号つきの円。0 は符号なし。マイナスは全角の − (format.ts の yenS と同じ字) */
export function signedYen(value: number): string {
  const body = `¥${Math.abs(Math.round(value)).toLocaleString('ja-JP')}`;
  return value > 0 ? `+${body}` : value < 0 ? `−${body}` : body;
}

/** 符号つきの率 (小数 1 桁)。マイナスは全角の − */
export function signedRate(rate: number): string {
  const body = `${Math.abs(rate * 100).toFixed(1)}%`;
  return rate > 0 ? `+${body}` : rate < 0 ? `−${body}` : body;
}

export type KpiKind = 'flow' | 'cash' | 'stock';

/**
 * KPI の比較行の文言。
 * - 前期のデータが無い → `前期比 —`
 * - 前期が 0 → `前期比 +¥X (—)` (率を出さない)
 * - 現金増減 → 金額だけ (率は出さない。符号が反転しうるため)
 * - 負債残高 → ラベルを `前月末比` にする (残高は時点の値)
 */
export function kpiComparison(kpi: StatementsKpi, kind: KpiKind): string {
  const label = kind === 'stock' ? '前月末比' : '前期比';
  if (kpi.previous === null || kpi.diff === null) return `${label} —`;
  const amount = signedYen(kpi.diff);
  if (kind === 'cash') return `${label} ${amount}`;
  return `${label} ${amount} (${kpi.diffRate === null ? '—' : signedRate(kpi.diffRate)})`;
}

/** 増減の矢印。色だけに頼らないため、比較行には必ず付ける */
export function arrowOf(diff: number | null): string {
  if (diff === null || diff === 0) return '';
  return diff > 0 ? '▲ ' : '▼ ';
}

/** 色クラス。負債だけ向きが逆 (増加が注意色・減少が良化色) */
export function kpiDiffClass(diff: number | null, kind: KpiKind): string {
  return kind === 'stock' ? deltaCls(diff) : gainCls(diff);
}

/** 構成比 (売上高比)。小数 1 桁、売上高 0 のときは — */
export function ratioText(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`;
}

/** 万円の表示 (四捨五入・桁区切り、単位は列見出し側に出す) */
export function manText(yenValue: number): string {
  const man = Math.round(yenValue / 10_000);
  return `${man < 0 ? '−' : ''}${Math.abs(man).toLocaleString('ja-JP')}`;
}

/** 月次表の合計列。円で足してから丸める (丸めた値を足すと合計がずれる) */
export function monthlyTotalMan(monthly: ReadonlyArray<{ amount: number }>): string {
  return manText(monthly.reduce((sum, point) => sum + point.amount, 0));
}

/** `2025-09` → `2025/9` (PL 表の列見出しの期間表記) */
export const slashMonth = (month: string) => `${month.slice(0, 4)}/${Number(month.slice(5, 7))}`;

export function shortRange(range: { from: string; to: string } | null): string {
  if (!range) return '—';
  return range.from === range.to
    ? slashMonth(range.from)
    : `${slashMonth(range.from)}-${slashMonth(range.to)}`;
}

export function addMonths(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function monthsBetween(from: string, to: string): number {
  const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return index(to) - index(from) + 1;
}

/**
 * 期間の前後移動 (§1.1)。同じ長さだけずらした任意期間を返す。
 * 全期間 (applied=null) と、データの範囲の外へ出る向きは null (ボタンを無効にする)。
 */
export function shiftedPeriod(
  meta: StatementsScreen['period']['navigation'] | undefined,
  direction: -1 | 1,
): PeriodSelection | null {
  const applied = meta?.applied;
  const full = meta?.full;
  if (!applied || !full) return null;
  const length = monthsBetween(applied.from, applied.to);
  const from = addMonths(applied.from, direction * length);
  const to = addMonths(applied.to, direction * length);
  if (direction < 0 && applied.from <= full.from) return null;
  if (direction > 0 && applied.to >= full.to) return null;
  return { mode: 'custom', from, to };
}

/** 期間内の月 (from..to) を昇順で返す。基準月の選択肢に使う */
export function monthsInPeriod(period: StatementsScreen['period']): string[] {
  if (!period.from || !period.to) return [];
  const months: string[] = [];
  for (let month = period.from; month <= period.to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** CF 不能の原因 (該当するものだけ。0 件・偽の原因は出さない) */
export function cfCauseLines(
  causes: Extract<StatementsScreen['cf'], { status: 'unavailable' }>['causes'],
): string[] {
  const lines: string[] = [];
  if (causes.unclassified > 0) lines.push(`未仕訳の取引が残っている（${causes.unclassified}件）`);
  const { months, settlementUnknown } = causes.missingCash;
  if (months > 0 || settlementUnknown) {
    const detail =
      months > 0 && settlementUnknown
        ? `（${months}か月・決済方法の列なし）`
        : months > 0
          ? `（${months}か月）`
          : '（決済方法の列が無い取込があります）';
    lines.push(`現金口座データが一部取り込まれていない${detail}`);
  }
  if (causes.accountUnset > 0)
    lines.push(`取引の勘定科目が正しく設定されていない（${causes.accountUnset}件）`);
  return lines;
}

/** 明細を開く の遷移先。計算行 (売上総利益・営業利益) は科目を持たないので null */
export function classifyLink(
  row: { key: StatementsRowKey; accounts: Array<{ account: string }> },
  lastMonth: string,
) {
  if (row.key === 'gross' || row.key === 'operating') return null;
  const account = row.accounts[0]?.account;
  if (!account) return null;
  const params = new URLSearchParams({ category: account, month: lastMonth });
  return `/classify?${params.toString()}`;
}
