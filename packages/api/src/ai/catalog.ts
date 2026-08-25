/**
 * 図表カタログ(要望23/25)。
 * - レポートに載せられる図はここに定義した種類だけ。AIは「どの図をどう説明するか(caption)」しか選べない。
 * - 図の数値はすべてアプリ(この関数群)が集計データから計算する。AIが数字を作ることはない。
 * - 各図には「出せる条件(最低月数など)」があり、満たさない図も枠だけは必ず出す(available=false + 理由 + あと何ヶ月)。
 * - 図番号(figure)はカタログの並び順で固定。本文は「図3が示すとおり」のように番号で参照する。
 * - 同じ内容を skills/run-kanjo-accounting-report/references/chart-catalog.json に書き出し、検証スクリプトと同期する
 *   (同期はテストで確認する)。
 */
import { type Dataset, mean, std } from '@kanjo/core';
import type { PeriodTotals } from './dataset.js';
import { type Period, type ReportType, addMonths, monthIndex, rangeLength } from './period.js';

export const CHART_KINDS = ['line', 'bar', 'stackedBar', 'waterfall', 'pareto', 'band'] as const;
export type ChartKind = (typeof CHART_KINDS)[number];
export const CHART_UNITS = ['yen', 'pct', 'count'] as const;
export type ChartUnit = (typeof CHART_UNITS)[number];

/** 月別系列は最長36ヶ月まで月次、それを超える窓は四半期に丸める(要望25c: 粒度の上限) */
export const MONTHLY_LIMIT = 36;
/** 図に載せる系列(科目・支払先)の最大本数。超える分は「その他」にまとめる */
export const MAX_SERIES = 8;

export interface ChartSeries {
  label: string;
  data: (number | null)[];
  /** 描き方の役割。line=折れ線で重ねる / band=帯の上下限 / total=ウォーターフォールの合計柱 / cum=累積線(右軸) */
  role?: 'line' | 'band' | 'total' | 'cum';
}
export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

export interface CatalogEntry {
  id: string;
  figure: number;
  title: string;
  kind: ChartKind;
  unit: ChartUnit;
  /** 何を判断するための図か */
  purpose: string;
  /** 出せる条件(人が読む文) */
  condition: string;
  /** 条件の数値(記帳月数)。月数条件が無い図は 0 */
  minMonths: number;
  /** 適用するレポート型 */
  types: ReportType[];
  /** 使う元データ(GET data のパス)。要望25a の対応表 */
  requiredData: string[];
  /** 切り口(要望25補足の軸) */
  axes: string[];
  /** 図の読み方(図の下に必ず出す) */
  readingGuide: string;
}

export const CHART_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'trend_ma',
    figure: 1,
    title: '売上・経費の推移と3ヶ月移動平均',
    kind: 'line',
    unit: 'yen',
    purpose: '経費の水準が上がっているのか下がっているのかを、月ごとのブレをならして見る',
    condition: '記帳済みの月が6ヶ月以上(移動平均を3点以上引くため)',
    minMonths: 6,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['biz.revenue', 'biz.expenseTotal', 'stats.expenseMovingAvg3', 'unrecordedExpenseMonths'],
    axes: ['期間(対象期間の前12ヶ月〜終了月)', '区分(事業)'],
    readingGuide:
      '実線の経費が点線の移動平均より上にある月は「ふだんより多い月」。移動平均そのものが右肩上がりなら水準が上がっている。未記帳の月は線が途切れる。',
  },
  {
    id: 'composition',
    figure: 2,
    title: '対象期間の経費構成比',
    kind: 'bar',
    unit: 'pct',
    purpose: 'どの科目が経費の大半を占めているかを一目で見る',
    condition: '対象期間に記帳済みの経費が1円以上',
    minMonths: 1,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['summary.current.expenseByAccount', 'summary.current.expense'],
    axes: ['項目(freee勘定科目)', '期間(対象期間)'],
    readingGuide:
      '上位2科目で全体の6割を超えていれば、その2科目を見直すのが最も効く。「その他」は上位8科目以外の合計。',
  },
  {
    id: 'contribution',
    figure: 3,
    title: '前期からの増減の寄与度分解',
    kind: 'waterfall',
    unit: 'yen',
    purpose: '経費が前期からいくら増減し、どの科目がいくら押し上げ/押し下げたかを分ける',
    condition: '対象期間と、直前の同じ長さの期間の両方に記帳済みの月がある',
    minMonths: 0,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['summary.previous.expenseByAccount', 'summary.current.expenseByAccount'],
    axes: ['項目(freee勘定科目)', '期間(前期→対象期間)'],
    readingGuide:
      '左端が前期の合計、右端が対象期間の合計。間の柱が科目ごとの増減で、上向き(赤)が増加、下向き(緑)が減少。柱が長い科目が増減の主因。',
  },
  {
    id: 'distribution',
    figure: 4,
    title: '月次経費の分布と外れ値',
    kind: 'band',
    unit: 'yen',
    purpose: '経費が「いつもの範囲」に収まっているか、飛び抜けた月がないかを見る',
    condition: '記帳済みの月が6ヶ月以上(平均と標準偏差を求めるため)',
    minMonths: 6,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['biz.expenseTotal', 'unrecordedExpenseMonths', 'stats.recordedMonths'],
    axes: ['期間(対象期間の前12ヶ月〜終了月)', '区分(事業)'],
    readingGuide:
      '帯は平均±2標準偏差(いつもの範囲)。帯の外に出た月が外れ値で、その月の科目を stats.outliers で確認する。帯が広いほど月ごとのブレが大きい。',
  },
  {
    id: 'yoy',
    figure: 5,
    title: '前年同月との比較',
    kind: 'bar',
    unit: 'yen',
    purpose: '季節性(毎年その月は多い)なのか、今年だけ増えたのかを切り分ける',
    condition: '対象期間の各月に対応する前年同月が記帳済み。対象期間が13ヶ月以内(長期は図1で見る)',
    minMonths: 13,
    types: ['monthly', 'annual'],
    requiredData: ['biz.expenseTotal', 'summary.yearAgo.months', 'unrecordedExpenseMonths'],
    axes: ['期間(対象期間 vs 前年同期)', '区分(事業)'],
    readingGuide: '2本の柱の差が前年同月比。前年も同じ月に多ければ季節性、今年だけ多ければ今年固有の要因。',
  },
  {
    id: 'fixed_variable_bep',
    figure: 6,
    title: '固定費・変動費と損益分岐点',
    kind: 'stackedBar',
    unit: 'yen',
    purpose: '売上がどこまで落ちても赤字にならないか(安全余裕)を見る',
    condition: '記帳済みの月が6ヶ月以上、かつ売上のある月が3ヶ月以上(固定費の判定と損益分岐点の計算に必要)',
    minMonths: 6,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: [
      'biz.expenseByAccount',
      'stats.accountProfiles.*.type',
      'biz.revenue',
      'pl.breakEven.monthly',
      'pl.breakEven.available',
    ],
    axes: ['区分(固定費/変動費)', '期間(対象期間の前12ヶ月〜終了月)'],
    readingGuide:
      '積み上げ柱の下段が固定費(毎月ほぼ一定の科目)、上段が変動費。横線が損益分岐点(固定費の直近3ヶ月平均)。売上の折れ線が横線を下回る月は固定費を賄えていない。',
  },
  {
    id: 'pareto',
    figure: 7,
    title: '科目別パレート図',
    kind: 'pareto',
    unit: 'yen',
    purpose: '少数の科目が経費の大半を占めるかを確かめ、見直す順番を決める',
    condition: '対象期間に金額のある科目が3つ以上',
    minMonths: 0,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['summary.current.expenseByAccount'],
    axes: ['項目(freee勘定科目)', '期間(対象期間)'],
    readingGuide:
      '柱は科目別金額(大きい順)、折れ線は累積構成比。折れ線が80%に達するまでの科目が「まず見直す対象」。',
  },
  {
    id: 'subs_vendor',
    figure: 8,
    title: 'サブスク支払先別の月次推移',
    kind: 'stackedBar',
    unit: 'yen',
    purpose: 'サブスクの合計と、どの支払先が増えているかを見る',
    condition: 'サブスクの支払先が1件以上登録され、期間内に支払いがある',
    minMonths: 0,
    types: ['monthly', 'annual', 'longterm'],
    requiredData: ['subscriptions.vendors', 'subscriptions.other'],
    axes: ['項目(サブスク登録ベンダー)', '期間(対象期間の前12ヶ月〜終了月)'],
    readingGuide:
      '柱の高さがサブスク合計。同じ色の帯が急に厚くなった月は値上げか二重払い(subscriptions.alerts を確認)。「その他」は未登録の支払先。',
  },
];

export const CATALOG_IDS = CHART_CATALOG.map((c) => c.id);

/** 図1件の出力(GET data の charts[] と、保存時のスナップショット) */
export interface ChartResult {
  id: string;
  figure: number;
  title: string;
  kind: ChartKind;
  unit: ChartUnit;
  purpose: string;
  readingGuide: string;
  requiredData: string[];
  available: boolean;
  /** 出せない理由(available=false のとき必須) */
  reason: string | null;
  /** あと何ヶ月分あれば出せるか(月数条件の図だけ) */
  monthsNeeded: number | null;
  /** 粒度(月次 / 四半期)。available=false のとき null */
  granularity: 'month' | 'quarter' | null;
  data: ChartData | null;
  /** 要望25d: ok=出せた / source_missing=元データが無い / app_missing=アプリ側で計算できなかった(不具合) */
  status: 'ok' | 'source_missing' | 'app_missing';
  detail: string;
}

/** 図を計算するための材料。buildAgentData が組み立てる */
export interface ChartContext {
  data: Dataset;
  period: Period;
  type: ReportType;
  /** 全期間の月別事業経費合計 */
  expenseTotal: number[];
  /** 経費の3ヶ月移動平均(未記帳月は null) */
  expenseMovingAvg: (number | null)[];
  recordedCount: number;
  current: PeriodTotals | null;
  previous: PeriodTotals | null;
  yearAgo: PeriodTotals | null;
  fixedAccounts: string[];
  breakEven: { monthly: number; available: boolean };
  subsVendors: string[];
  subsMatrix: Record<string, number[]>;
  subsOther: number[];
  subsMonths: string[];
}

const round = (v: number): number => Math.round(v);
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** 図に使う月の窓: 対象期間の12ヶ月前〜終了月のうち、取込済みの月 */
export function chartWindow(months: string[], period: Period): string[] {
  const from = monthIndex(addMonths(period.from, -12));
  const to = monthIndex(period.to);
  return months.filter((m) => monthIndex(m) >= from && monthIndex(m) <= to);
}

const quarterOf = (m: string): string =>
  `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;

/**
 * 月別の値を窓に切り出し、36ヶ月を超える窓は四半期合計に丸める。
 * null(未記帳)は四半期でも null のまま(足せない値を 0 として足さない)。
 */
export function bucketize(
  window: string[],
  value: (m: string) => number | null,
): { labels: string[]; values: (number | null)[]; granularity: 'month' | 'quarter' } {
  if (window.length <= MONTHLY_LIMIT) {
    return { labels: window, values: window.map((m) => value(m)), granularity: 'month' };
  }
  const labels: string[] = [];
  const values: (number | null)[] = [];
  for (const m of window) {
    const q = quarterOf(m);
    const v = value(m);
    if (labels[labels.length - 1] !== q) {
      labels.push(q);
      values.push(v);
    } else {
      const last = values[values.length - 1];
      values[values.length - 1] = last == null || v == null ? null : last + v;
    }
  }
  return { labels, values, granularity: 'quarter' };
}

type BuildOutcome =
  | { available: true; granularity: 'month' | 'quarter'; data: ChartData }
  | { available: false; reason: string; monthsNeeded: number | null; status: 'source_missing' };

type Builder = (ctx: ChartContext) => BuildOutcome;

const unavailable = (reason: string, monthsNeeded: number | null = null): BuildOutcome => ({
  available: false,
  reason,
  monthsNeeded,
  status: 'source_missing',
});

const needMonths = (have: number, need: number, what: string): BuildOutcome =>
  unavailable(`${what}には記帳済みの月が${need}ヶ月必要です(現在${have}ヶ月)。`, need - have);

/** 科目別合計を大きい順に並べ、MAX_SERIES を超える分を「その他」にまとめる */
function topAccounts(
  byAccount: Record<string, number>,
  limit = MAX_SERIES,
): { label: string; value: number }[] {
  const rows = Object.entries(byAccount)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
  return [...head, { label: 'その他', value: rest }];
}

const builders: Record<string, Builder> = {
  trend_ma: (ctx) => {
    const win = chartWindow(ctx.data.months, ctx.period);
    const un = new Set(ctx.data.unrecordedExpMonths);
    const recorded = win.filter((m) => !un.has(m)).length;
    if (recorded < 6) return needMonths(recorded, 6, '移動平均');
    const idx = (m: string) => ctx.data.months.indexOf(m);
    const rev = bucketize(win, (m) => ctx.data.biz.revenue[idx(m)] ?? 0);
    const exp = bucketize(win, (m) => (un.has(m) ? null : (ctx.expenseTotal[idx(m)] ?? 0)));
    const ma =
      exp.granularity === 'month'
        ? win.map((m) => ctx.expenseMovingAvg[idx(m)] ?? null)
        : // 四半期に丸めた場合は四半期合計の3点移動平均を引き直す
          exp.values.map((_, i, arr) => {
            const w = arr.slice(Math.max(0, i - 2), i + 1);
            if (w.length < 3 || w.some((v) => v == null)) return null;
            return round(mean(w as number[]));
          });
    return {
      available: true,
      granularity: exp.granularity,
      data: {
        labels: exp.labels,
        series: [
          { label: '売上', data: rev.values },
          { label: '経費', data: exp.values },
          { label: '経費の3点移動平均', data: ma.map((v) => (v == null ? null : round(v))), role: 'line' },
        ],
      },
    };
  },
  composition: (ctx) => {
    const cur = ctx.current;
    if (!cur || cur.expense <= 0) return unavailable('対象期間に記帳済みの経費がありません。');
    const rows = topAccounts(cur.expenseByAccount);
    return {
      available: true,
      granularity: 'month',
      data: {
        labels: rows.map((r) => r.label),
        series: [{ label: '構成比', data: rows.map((r) => round3(r.value / cur.expense)) }],
      },
    };
  },
  contribution: (ctx) => {
    const cur = ctx.current;
    const prev = ctx.previous;
    if (!cur || cur.recordedExpenseMonths.length === 0)
      return unavailable('対象期間に記帳済みの月がありません。');
    if (!prev || prev.recordedExpenseMonths.length === 0) {
      const n = rangeLength(ctx.period);
      return unavailable(
        `直前の同じ長さの期間(${prev?.from ?? addMonths(ctx.period.from, -n)}〜)に記帳済みの月がありません。`,
        n,
      );
    }
    const accounts = new Set([...Object.keys(cur.expenseByAccount), ...Object.keys(prev.expenseByAccount)]);
    const deltas = [...accounts]
      .map((a) => ({ label: a, value: (cur.expenseByAccount[a] ?? 0) - (prev.expenseByAccount[a] ?? 0) }))
      .filter((d) => d.value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const head = deltas.slice(0, MAX_SERIES);
    const rest = deltas.slice(MAX_SERIES).reduce((s, d) => s + d.value, 0);
    const steps = rest !== 0 ? [...head, { label: 'その他', value: rest }] : head;
    return {
      available: true,
      granularity: 'month',
      data: {
        labels: ['前期合計', ...steps.map((d) => d.label), '対象期間合計'],
        series: [
          { label: '合計', data: [prev.expense, ...steps.map(() => null), cur.expense], role: 'total' },
          { label: '増減', data: [null, ...steps.map((d) => d.value), null] },
        ],
      },
    };
  },
  distribution: (ctx) => {
    const win = chartWindow(ctx.data.months, ctx.period);
    const un = new Set(ctx.data.unrecordedExpMonths);
    const rec = win.filter((m) => !un.has(m));
    if (rec.length < 6) return needMonths(rec.length, 6, '分布(平均±2σ)');
    const idx = (m: string) => ctx.data.months.indexOf(m);
    const vals = rec.map((m) => ctx.expenseTotal[idx(m)] ?? 0);
    const mu = mean(vals);
    const sd = std(vals);
    return {
      available: true,
      granularity: 'month',
      data: {
        labels: rec,
        series: [
          { label: '経費', data: vals },
          { label: '平均', data: rec.map(() => round(mu)), role: 'line' },
          { label: '平均+2σ', data: rec.map(() => round(mu + 2 * sd)), role: 'band' },
          { label: '平均−2σ', data: rec.map(() => round(Math.max(0, mu - 2 * sd))), role: 'band' },
        ],
      },
    };
  },
  yoy: (ctx) => {
    if (ctx.type === 'longterm')
      return unavailable('長期レポートでは年別の推移(図1)で見るため、この図は出しません。');
    const cur = ctx.current;
    const ya = ctx.yearAgo;
    if (!cur || cur.recordedExpenseMonths.length === 0)
      return unavailable('対象期間に記帳済みの月がありません。');
    const un = new Set(ctx.data.unrecordedExpMonths);
    const yaRecorded = ya ? ya.months.filter((m) => !un.has(m)) : [];
    if (yaRecorded.length === 0) {
      const first = ctx.data.months[0];
      const need = first ? Math.max(0, monthIndex(first) - monthIndex(addMonths(ctx.period.from, -12))) : 12;
      return unavailable(
        `前年同期(${addMonths(ctx.period.from, -12)}〜)の記帳データがありません。`,
        need || 12,
      );
    }
    const idx = (m: string) => ctx.data.months.indexOf(m);
    const at = (m: string): number | null => {
      const i = idx(m);
      return i < 0 || un.has(m) ? null : (ctx.expenseTotal[i] ?? 0);
    };
    const labels = cur.months;
    return {
      available: true,
      granularity: 'month',
      data: {
        labels: labels.map((m) => `${m.slice(5, 7).replace(/^0/, '')}月`),
        series: [
          { label: '対象期間', data: labels.map(at) },
          { label: '前年同月', data: labels.map((m) => at(addMonths(m, -12))) },
        ],
      },
    };
  },
  fixed_variable_bep: (ctx) => {
    if (ctx.recordedCount < 6) return needMonths(ctx.recordedCount, 6, '固定費/変動費の判定');
    if (!ctx.breakEven.available)
      return unavailable('売上のある月が3ヶ月未満か固定費がゼロのため、損益分岐点を計算できません。');
    const win = chartWindow(ctx.data.months, ctx.period);
    const un = new Set(ctx.data.unrecordedExpMonths);
    const idx = (m: string) => ctx.data.months.indexOf(m);
    const fixedSet = new Set(ctx.fixedAccounts);
    const fixedAt = (m: string): number | null => {
      if (un.has(m)) return null;
      const i = idx(m);
      return ctx.data.biz.categories
        .filter((c) => fixedSet.has(c))
        .reduce((s, c) => s + (ctx.data.biz.expense[c]?.[i] ?? 0), 0);
    };
    const fixed = bucketize(win, fixedAt);
    const total = bucketize(win, (m) => (un.has(m) ? null : (ctx.expenseTotal[idx(m)] ?? 0)));
    const rev = bucketize(win, (m) => ctx.data.biz.revenue[idx(m)] ?? 0);
    const perBucket = fixed.granularity === 'quarter' ? 3 : 1;
    return {
      available: true,
      granularity: fixed.granularity,
      data: {
        labels: fixed.labels,
        series: [
          { label: '固定費', data: fixed.values },
          {
            label: '変動費',
            data: total.values.map((t, i) =>
              t == null || fixed.values[i] == null ? null : t - (fixed.values[i] as number),
            ),
          },
          { label: '売上', data: rev.values, role: 'line' },
          {
            label: '損益分岐点',
            data: fixed.labels.map(() => round(ctx.breakEven.monthly * perBucket)),
            role: 'line',
          },
        ],
      },
    };
  },
  pareto: (ctx) => {
    const cur = ctx.current;
    const rows = cur ? Object.entries(cur.expenseByAccount).filter(([, v]) => v > 0) : [];
    if (rows.length < 3) return unavailable(`対象期間に金額のある科目が${rows.length}件で、3件未満です。`);
    const sorted = rows.sort((a, b) => b[1] - a[1]).slice(0, 12);
    const total = rows.reduce((s, [, v]) => s + v, 0);
    let cum = 0;
    const cumShare = sorted.map(([, v]) => {
      cum += v;
      return round3(cum / total);
    });
    return {
      available: true,
      granularity: 'month',
      data: {
        labels: sorted.map(([a]) => a),
        series: [
          { label: '金額', data: sorted.map(([, v]) => v) },
          { label: '累積構成比', data: cumShare, role: 'cum' },
        ],
      },
    };
  },
  subs_vendor: (ctx) => {
    if (ctx.subsVendors.length === 0)
      return unavailable('サブスクの支払先が登録されていません(サブスク分析ページで登録できます)。');
    const win = chartWindow(ctx.subsMonths, ctx.period);
    const idx = (m: string) => ctx.subsMonths.indexOf(m);
    const totals = ctx.subsVendors.map((v) => ({
      vendor: v,
      total: win.reduce((s, m) => s + (ctx.subsMatrix[v]?.[idx(m)] ?? 0), 0),
    }));
    if (totals.every((t) => t.total === 0)) return unavailable('期間内にサブスクの支払いがありません。');
    const sorted = totals.filter((t) => t.total > 0).sort((a, b) => b.total - a.total);
    const head = sorted.slice(0, MAX_SERIES);
    const tail = sorted.slice(MAX_SERIES).map((t) => t.vendor);
    const series: ChartSeries[] = [];
    let labels: string[] = win;
    let granularity: 'month' | 'quarter' = 'month';
    for (const h of head) {
      const b = bucketize(win, (m) => ctx.subsMatrix[h.vendor]?.[idx(m)] ?? 0);
      labels = b.labels;
      granularity = b.granularity;
      series.push({ label: h.vendor, data: b.values });
    }
    const other = bucketize(
      win,
      (m) => tail.reduce((s, v) => s + (ctx.subsMatrix[v]?.[idx(m)] ?? 0), 0) + (ctx.subsOther[idx(m)] ?? 0),
    );
    if (other.values.some((v) => (v ?? 0) > 0)) series.push({ label: 'その他', data: other.values });
    return { available: true, granularity, data: { labels, series } };
  },
};

/** カタログの全図を固定順で計算する。計算が例外を投げた図は app_missing として枠だけ返す(要望25d) */
export function buildCharts(ctx: ChartContext): ChartResult[] {
  return CHART_CATALOG.map((entry) => {
    const base = {
      id: entry.id,
      figure: entry.figure,
      title: entry.title,
      kind: entry.kind,
      unit: entry.unit,
      purpose: entry.purpose,
      readingGuide: entry.readingGuide,
      requiredData: entry.requiredData,
    };
    const builder = builders[entry.id];
    if (!builder) {
      return {
        ...base,
        available: false,
        reason: 'アプリにこの図の計算が実装されていません。',
        monthsNeeded: null,
        granularity: null,
        data: null,
        status: 'app_missing',
        detail: `builder not found: ${entry.id}`,
      };
    }
    try {
      const r = builder(ctx);
      if (r.available) {
        return {
          ...base,
          available: true,
          reason: null,
          monthsNeeded: null,
          granularity: r.granularity,
          data: r.data,
          status: 'ok',
          detail: '',
        };
      }
      return {
        ...base,
        available: false,
        reason: r.reason,
        monthsNeeded: r.monthsNeeded,
        granularity: null,
        data: null,
        status: r.status,
        detail: r.reason,
      };
    } catch (e) {
      return {
        ...base,
        available: false,
        reason: 'アプリ側の計算でエラーが起きました(元データの不足ではありません)。',
        monthsNeeded: null,
        granularity: null,
        data: null,
        status: 'app_missing',
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  });
}

/** 図に載せた数字の総量(ペイロード計測用) */
export function chartPoints(charts: ChartResult[]): number {
  return charts.reduce(
    (s, c) => s + (c.data ? c.data.series.reduce((t, sr) => t + sr.data.length, 0) : 0),
    0,
  );
}
