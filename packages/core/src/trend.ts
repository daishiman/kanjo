/**
 * 科目ごとの「多い / 増えている / 減っている」を統計で判定する。
 *
 * 目的は数字を並べることではなく、次の行動を1つ決められること。
 *   - どこが大きいか            → 構成比・パレート
 *   - 増えているのか減っているのか → Mann-Kendall 検定 + Theil-Sen 傾き
 *   - 増減はどこから来たのか      → 期間比較の寄与度分解(ウォーターフォール)
 *   - 記録が足りていないか        → 記帳状況の指標
 *
 * 手法の選択理由:
 * 支出は「毎月ほぼ一定 + たまに大きな単発」という形をとる。最小二乗法(OLS)は
 * 単発1件で傾きが丸ごと引っ張られるため、この形では誤判定が出やすい。
 * 順位のみを使う Mann-Kendall と、全ペアの傾きの中央値をとる Theil-Sen は
 * 外れ値に強く、月次の少ないサンプル数でも使える。
 */
import { catSeries, recordedExpIdx } from './analysis.js';
import { median, sum } from './stats.js';
import type { Dataset } from './types.js';

/* ======================== 事業と家計を同じ形に揃える ======================== */

/** 見る範囲。合算 / 事業だけ / 家計だけ */
export type ExpenseScope = 'all' | 'biz' | 'personal';
export const EXPENSE_SCOPE_LABEL: Record<ExpenseScope, string> = {
  all: '事業+家計',
  biz: '事業',
  personal: '家計',
};

export interface ExpenseSeries {
  account: string;
  side: 'biz' | 'personal';
  /** 記帳月に対応する月次の金額 */
  series: number[];
}

/**
 * 科目ごとの月次系列を、事業と家計で同じ形に揃えて取り出す。
 *
 * 事業は biz.expense(科目→月配列)、家計は personal(月→大項目→金額)と
 * 持ち方が違うだけで、意味はどちらも「その月にその科目でいくら出たか」。
 * ここで形を揃えると、以降の統計・寄与度分解・優先度判定を1本の実装で両方に当てられる。
 *
 * 事業と家計で同じ科目名(通信費など)が出ることがあるため、合算しても行は分けたままにする。
 * 足してしまうと「事業の通信費が増えた」のか「家計の通信費が増えた」のか分からなくなり、
 * 打てる手が決まらない。
 */
export function expenseSeriesByCategory(data: Dataset, scope: ExpenseScope = 'all'): ExpenseSeries[] {
  const idx = recordedExpIdx(data);
  const recordedMonths = idx.map((i) => data.months[i]);
  const out: ExpenseSeries[] = [];

  if (scope !== 'personal') {
    for (const account of data.biz.categories) {
      out.push({ account, side: 'biz', series: idx.map((i) => catSeries(data, account)[i] ?? 0) });
    }
  }

  if (scope !== 'biz') {
    const names = new Set<string>();
    for (const m of recordedMonths) {
      for (const k of Object.keys(data.personal[m]?.expense ?? {})) names.add(k);
    }
    for (const account of [...names].sort()) {
      out.push({
        account,
        side: 'personal',
        series: recordedMonths.map((m) => data.personal[m]?.expense?.[account] ?? 0),
      });
    }
  }

  return out;
}

/** 表示用の行キー。事業と家計で同名の科目があるため側を含める */
export const trendKey = (side: 'biz' | 'personal', account: string): string => `${side}:${account}`;

/* ======================== 統計プリミティブ ======================== */

/** 標準正規分布の上側確率。Abramowitz & Stegun 7.1.26 の erf 近似(誤差 1.5e-7) */
export function normalSf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  // erf(|z|/√2)
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  const upper = 0.5 * (1 - erf);
  return z >= 0 ? upper : 1 - upper;
}

export interface MannKendall {
  /** 増加ペア数 - 減少ペア数 */
  s: number;
  /** ケンドールのタウ。-1(常に減少)〜+1(常に増加) */
  tau: number;
  /** 正規近似の検定統計量 */
  z: number;
  /** 両側p値。0.05未満で「偶然では説明しにくい傾向」とみなす */
  p: number;
  n: number;
}

/**
 * Mann-Kendall 傾向検定(同値補正つき)。
 * n<4 では検定として成立しないので p=1(傾向なしと判定できない)を返す。
 */
export function mannKendall(values: number[]): MannKendall {
  const n = values.length;
  if (n < 4) return { s: 0, tau: 0, z: 0, p: 1, n };
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(values[j] - values[i]);
  }
  // 同値(たとえば0円が並ぶ月)は分散を過大評価させるので補正する
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tieAdj = 0;
  let tiePairs = 0;
  for (const t of counts.values()) {
    if (t > 1) {
      tieAdj += t * (t - 1) * (2 * t + 5);
      tiePairs += (t * (t - 1)) / 2;
    }
  }
  const varS = ((n * (n - 1) * (2 * n + 5) - tieAdj) / 18) as number;
  const totalPairs = (n * (n - 1)) / 2;
  const tau = totalPairs - tiePairs > 0 ? s / Math.sqrt((totalPairs - tiePairs) * totalPairs) : 0;
  if (varS <= 0) return { s, tau, z: 0, p: 1, n };
  const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = z === 0 ? 1 : 2 * normalSf(Math.abs(z));
  return { s, tau, z, p: Math.min(1, p), n };
}

/**
 * Theil-Sen 推定量。全ペアの傾きの中央値で「1ヶ月あたり何円ずつ動いているか」を出す。
 * 平均ではなく中央値なので、単発の大きな支出があっても傾きが跳ねない。
 */
export function theilSen(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) slopes.push((values[j] - values[i]) / (j - i));
  }
  return median(slopes);
}

/* ======================== 科目別トレンド ======================== */

export type TrendDirection = '増加' | '減少' | '横ばい' | '判定不可';

/** 傾向を言い切るのに必要な記帳月数。これ未満は「判定不可」で、増減を断定しない */
export const TREND_MIN_MONTHS = 6;
/** 両側p値がこれ未満なら、偶然の揺れでは説明しにくいとみなす */
export const TREND_ALPHA = 0.05;

export interface CategoryTrend {
  account: string;
  /** 事業の勘定科目か、家計の大項目か */
  side: 'biz' | 'personal';
  /** 事業と家計で同名の科目があるため、行の識別にはこちらを使う */
  key: string;
  /** 期間内の合計 */
  total: number;
  /** 経費全体に占める割合。0..1 */
  share: number;
  /** 記帳月あたりの平均 */
  monthlyAvg: number;
  /** 変動係数(標準偏差÷平均)。小さいほど毎月一定 */
  cv: number;
  type: '固定費' | '準変動' | 'スポット';
  /** 1ヶ月あたりの増減額(Theil-Sen) */
  slopePerMonth: number;
  /** 平均に対する1ヶ月あたりの増減率。規模の違う科目を並べて比べるために使う */
  slopeRatio: number;
  /** 12ヶ月続いた場合の増減見込み額。「このままだと年間いくら」を言うための外挿 */
  annualImpact: number;
  mk: MannKendall;
  direction: TrendDirection;
  /** 直近3ヶ月の平均 */
  recentAvg: number;
  /** それ以前の平均 */
  priorAvg: number;
  /** 記帳月のうち、この科目に金額があった月の割合。0..1 */
  presenceRate: number;
  /** 固定費なのに金額が無い記帳月。記録漏れの疑い */
  gapMonths: string[];
  /** 月次の推移(スパークライン用) */
  series: number[];
}

/**
 * 科目ごとの規模・傾向・記録状況をまとめる。
 * 未記帳月は全ての指標から除外する(0円として混ぜると、傾向が下向きに歪む)。
 */
export function categoryTrends(data: Dataset, scope: ExpenseScope = 'all'): CategoryTrend[] {
  const idx = recordedExpIdx(data);
  const recordedMonths = idx.map((i) => data.months[i]);
  const sources = expenseSeriesByCategory(data, scope);
  const grand = sum(sources.map((x) => sum(x.series)));

  const rows = sources.map(({ account, side, series }): CategoryTrend => {
    const n = series.length;
    const total = sum(series);
    const avg = n ? total / n : 0;
    const sd = n > 1 ? Math.sqrt(series.reduce((s, x) => s + (x - avg) ** 2, 0) / (n - 1)) : 0;
    const cv = avg > 0 ? sd / avg : 0;
    const mk = mannKendall(series);
    const slope = theilSen(series);
    const recent = series.slice(-3);
    const prior = series.slice(0, -3);
    const type = cv < 0.6 ? '固定費' : cv < 1.5 ? '準変動' : 'スポット';
    const present = series.filter((v) => v !== 0).length;
    const direction: TrendDirection =
      n < TREND_MIN_MONTHS ? '判定不可' : mk.p < TREND_ALPHA ? (mk.s > 0 ? '増加' : '減少') : '横ばい';

    return {
      account,
      side,
      key: trendKey(side, account),
      total,
      share: grand > 0 ? total / grand : 0,
      monthlyAvg: avg,
      cv,
      type,
      slopePerMonth: slope,
      slopeRatio: avg > 0 ? slope / avg : 0,
      annualImpact: slope * 12,
      mk,
      direction,
      recentAvg: recent.length ? sum(recent) / recent.length : 0,
      priorAvg: prior.length ? sum(prior) / prior.length : 0,
      presenceRate: n ? present / n : 0,
      // 毎月出るはずの固定費に空白月があるのは、支出が消えたのではなく取込が欠けている可能性が高い
      gapMonths: type === '固定費' ? recordedMonths.filter((_, i) => series[i] === 0) : [],
      series,
    };
  });

  return rows.filter((r) => r.total !== 0).sort((a, b) => b.total - a.total);
}

/* ======================== 期間比較の寄与度分解 ======================== */

export interface ContributionRow {
  account: string;
  side: 'biz' | 'personal';
  key: string;
  before: number;
  after: number;
  diff: number;
  /** 増減総額に対する寄与割合。総額が増えているとき、押し上げた科目が正になる */
  contribution: number;
}

export interface ContributionBreakdown {
  beforeMonths: string[];
  afterMonths: string[];
  beforeTotal: number;
  afterTotal: number;
  diff: number;
  rows: ContributionRow[];
}

/**
 * 2つの期間を比べ、経費総額の増減を科目ごとの寄与額に分解する。
 *
 * 「先月より5万増えた」だけでは動けない。5万のうち外注費が+6万、通信費が-1万、
 * と分解して初めて「外注費を見る」という次の行動が決まる。
 * 月数が違う期間を比べるため、金額は月平均に直してから引く。
 */
export function contributionBreakdown(
  data: Dataset,
  before: readonly string[],
  after: readonly string[],
  scope: ExpenseScope = 'all',
): ContributionBreakdown {
  // 系列は記帳月の並びで作られているので、比較対象の月もその並びの位置に直す
  const recorded = recordedExpIdx(data).map((i) => data.months[i]);
  const pos = (ms: readonly string[]): number[] => ms.map((m) => recorded.indexOf(m)).filter((i) => i >= 0);
  const bi = pos(before);
  const ai = pos(after);
  const avgOf = (ids: number[], series: number[]): number =>
    ids.length ? sum(ids.map((i) => series[i] ?? 0)) / ids.length : 0;

  const rows = expenseSeriesByCategory(data, scope)
    .map(({ account, side, series }): ContributionRow => {
      const b = avgOf(bi, series);
      const a = avgOf(ai, series);
      return {
        account,
        side,
        key: trendKey(side, account),
        before: b,
        after: a,
        diff: a - b,
        contribution: 0,
      };
    })
    .filter((r) => r.before !== 0 || r.after !== 0);

  const beforeTotal = sum(rows.map((r) => r.before));
  const afterTotal = sum(rows.map((r) => r.after));
  const diff = afterTotal - beforeTotal;
  // 総額がほぼ変わらないとき、寄与割合は「1円の増減に対する比」になって発散する。
  // その場合は割合を出さず、金額だけで読ませる
  const denom = Math.abs(diff);
  for (const r of rows) r.contribution = denom > 0 ? r.diff / denom : 0;

  return {
    beforeMonths: bi.map((i) => recorded[i]),
    afterMonths: ai.map((i) => recorded[i]),
    beforeTotal,
    afterTotal,
    diff,
    rows: rows.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)),
  };
}

/* ======================== 管理優先度 ======================== */

export type PriorityAction = '削減を検討' | '継続監視' | '記録を整える' | '対応不要';

export interface PriorityJudgement {
  action: PriorityAction;
  /** 高いほど先に手を打つべき。並べ替えのキーに使う */
  score: number;
  /** なぜその判定になったかを画面にそのまま出す1文 */
  reason: string;
}

/**
 * 科目1件を「次に何をすべきか」に落とす。
 *
 * 判定に使える材料(すべて CategoryTrend が持っている):
 *   share        経費全体に占める割合(0..1)
 *   direction    '増加' | '減少' | '横ばい' | '判定不可'
 *   annualImpact このまま12ヶ月続いた場合の増減見込み額(円、負なら減少)
 *   cv / type    毎月一定か、単発か
 *   presenceRate 記帳月のうち金額があった月の割合(0..1)
 *   gapMonths    固定費なのに金額が無い月(記録漏れの疑い)
 *   mk.p         傾向の両側p値(小さいほど偶然では説明しにくい)
 */
/** 全体に占める割合がこれ以上なら、規模だけで見直す価値がある */
export const PRIORITY_LARGE_SHARE = 0.15;
/** 増えている科目のうち、削減を勧める最低の規模 */
export const PRIORITY_ACTIONABLE_SHARE = 0.05;
/** 記録の問題を、金額の大小に関わらず削減判断より前へ出すための下駄(円) */
const RECORD_FIRST_OFFSET = 100_000_000;

const yen = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`;
const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;

export function judgePriority(t: CategoryTrend): PriorityJudgement {
  const annualSpend = t.monthlyAvg * 12;
  // 「1年でいくら動かせるか」を円で表した並べ替えキー。
  // 規模(年間支出×構成比)と勢い(増加分の年換算)を足す。単位を円に揃えることで、
  // 割合と金額という別物を重みづけで無理に混ぜずに済む
  const base = annualSpend * t.share + Math.max(0, t.annualImpact) * 2;

  // 1) 数字そのものが信用できないものが最優先。
  //    「減った」のか「取り込めていない」のかを取り違えると、以降の判断が全部狂う
  if (t.gapMonths.length > 0) {
    return {
      action: '記録を整える',
      score: RECORD_FIRST_OFFSET + annualSpend,
      reason: `毎月ほぼ一定の${t.type}なのに ${t.gapMonths.join('・')} だけ金額がない。減ったのではなく取込漏れの可能性がある`,
    };
  }

  // 2) 増減を言い切れる月数がまだ無い
  if (t.direction === '判定不可') {
    return {
      action: '継続監視',
      score: base * 0.1,
      reason: `記帳${t.mk.n}ヶ月。増えているか減っているかを言うには${TREND_MIN_MONTHS}ヶ月ぶん必要`,
    };
  }

  // 3) 増えている。スポットは毎月削れる性質ではないので、同じ増加でも優先度を落とす
  if (t.direction === '増加') {
    const weight = t.type === 'スポット' ? 0.3 : 1;
    const big = t.share >= PRIORITY_ACTIONABLE_SHARE && t.type !== 'スポット';
    return {
      action: big ? '削減を検討' : '継続監視',
      score: base * weight,
      reason: `月あたり約${yen(t.slopePerMonth)}ずつ増加(p=${t.mk.p.toFixed(3)})。このまま12ヶ月で年${yen(t.annualImpact)}増える見込み。経費全体の${pct(t.share)}`,
    };
  }

  // 4) 減っている。手を打った結果である可能性が高いので、止めずに見届ける
  if (t.direction === '減少') {
    return {
      action: '対応不要',
      score: base * 0.2,
      reason: `月あたり約${yen(Math.abs(t.slopePerMonth))}ずつ減少(p=${t.mk.p.toFixed(3)})。この向きが続いているか次月も確認する`,
    };
  }

  // 5) 横ばい。増えてはいないが、大きいものは減らしたときの効果が最も大きい
  if (t.share >= PRIORITY_LARGE_SHARE) {
    return {
      action: '削減を検討',
      score: base,
      reason: `増えてはいないが経費全体の${pct(t.share)}を占め、月あたり${yen(t.monthlyAvg)}。ここを1割下げると年${yen(annualSpend * 0.1)}効く`,
    };
  }

  return {
    action: '対応不要',
    score: base * 0.1,
    reason: `横ばいで経費全体の${pct(t.share)}。今の水準を保てていればよい`,
  };
}

export type PrioritizedTrend = CategoryTrend & PriorityJudgement;

/** 管理優先度つきの科目一覧。スコアの高い順 */
export function prioritizedTrends(data: Dataset, scope: ExpenseScope = 'all'): PrioritizedTrend[] {
  return categoryTrends(data, scope)
    .map((t) => ({ ...t, ...judgePriority(t) }))
    .sort((a, b) => b.score - a.score);
}

/* ======================== 事業と家計の突き合わせ ======================== */

export interface SideSummary {
  side: 'biz' | 'personal';
  label: string;
  total: number;
  monthlyAvg: number;
  /** 表示中スコープの合計に占める割合 */
  share: number;
  /** 金額が立った科目の数 */
  accountCount: number;
  /** その側で最も大きい科目 */
  topAccount: { account: string; total: number } | null;
}

const SIDE_LABEL: Record<'biz' | 'personal', string> = { biz: '事業', personal: '家計' };

/**
 * 事業と家計それぞれの規模。
 * 「家計のほうが事業より大きい」のような比較は、片方だけ見ていても出てこない。
 */
export function sideSummaries(data: Dataset, scope: ExpenseScope = 'all'): SideSummary[] {
  const n = recordedExpIdx(data).length;
  const src = expenseSeriesByCategory(data, scope);
  const grand = sum(src.map((x) => sum(x.series)));
  const sides: ('biz' | 'personal')[] =
    scope === 'biz' ? ['biz'] : scope === 'personal' ? ['personal'] : ['biz', 'personal'];

  return sides.map((side) => {
    const mine = src
      .map((x) => ({ account: x.account, total: sum(x.series), side: x.side }))
      .filter((x) => x.side === side && x.total !== 0)
      .sort((a, b) => b.total - a.total);
    const total = sum(mine.map((x) => x.total));
    return {
      side,
      label: SIDE_LABEL[side],
      total,
      monthlyAvg: n ? total / n : 0,
      share: grand > 0 ? total / grand : 0,
      accountCount: mine.length,
      topAccount: mine.length ? { account: mine[0].account, total: mine[0].total } : null,
    };
  });
}

/**
 * 月ごとの事業・家計・合計。スコープに関わらず両方返す。
 * どちらを見ているときでも「もう片方はどうなのか」が同じ画面で分かるようにする。
 */
export function monthlySides(
  data: Dataset,
): { month: string; biz: number; personal: number; total: number }[] {
  const src = expenseSeriesByCategory(data, 'all');
  const months = recordedExpIdx(data).map((i) => data.months[i]);
  return months.map((month, i) => {
    const at = (side: 'biz' | 'personal'): number =>
      sum(src.filter((x) => x.side === side).map((x) => x.series[i] ?? 0));
    const biz = at('biz');
    const personal = at('personal');
    return { month, biz, personal, total: biz + personal };
  });
}

/* ======================== 画面向けのまとめ ======================== */

export interface TrendsReport {
  months: string[];
  /** 未記帳を除いた、指標の計算に使った月 */
  recordedMonths: string[];
  unrecordedExpMonths: string[];
  expenseTotal: number;
  monthlyAvg: number;
  rows: PrioritizedTrend[];
  /** 累積構成比。どこまでで経費の8割に届くかを見る */
  pareto: {
    account: string;
    side: 'biz' | 'personal';
    key: string;
    total: number;
    share: number;
    cumShare: number;
  }[];
  /** 表示中のスコープ */
  scope: ExpenseScope;
  scopeLabel: string;
  /** 事業と家計それぞれの規模。同じ土俵で並べるための内訳 */
  sides: SideSummary[];
  /** 月ごとの事業・家計・合計。両方を1つの時系列で見るため */
  monthlySides: { month: string; biz: number; personal: number; total: number }[];
  /** 経費の8割を占めるのに必要な科目数。少ないほど手を打つ先が絞れている */
  coreCount: number;
  /** 期間の前半と後半の比較。増減がどの科目から来たのかの分解 */
  breakdown: ContributionBreakdown;
  /** 行動が要る科目の件数 */
  counts: Record<PriorityAction, number>;
}

/**
 * 期間内の支出を「大きい順・増えている順・記録が足りない順」に1枚へまとめる。
 * 期間の絞り込みは呼び出し側で applyPeriod 済みの Dataset を渡すことで効く。
 */
export function trendsReport(data: Dataset, scope: ExpenseScope = 'all'): TrendsReport {
  const idx = recordedExpIdx(data);
  const recordedMonths = idx.map((i) => data.months[i]);
  const rows = prioritizedTrends(data, scope);
  const expenseTotal = sum(rows.map((r) => r.total));

  let cum = 0;
  const byTotal = [...rows].sort((a, b) => b.total - a.total);
  const pareto = byTotal.map((r) => {
    cum += r.total;
    return {
      account: r.account,
      side: r.side,
      key: r.key,
      total: r.total,
      share: r.share,
      cumShare: expenseTotal > 0 ? cum / expenseTotal : 0,
    };
  });
  const coreIdx = pareto.findIndex((p) => p.cumShare >= 0.8);

  // 前半と後半で割る。奇数月のときは後半を1ヶ月多くとり、直近側を厚くする
  const half = Math.floor(recordedMonths.length / 2);
  const breakdown = contributionBreakdown(
    data,
    recordedMonths.slice(0, half),
    recordedMonths.slice(half),
    scope,
  );

  const counts: Record<PriorityAction, number> = {
    削減を検討: 0,
    継続監視: 0,
    記録を整える: 0,
    対応不要: 0,
  };
  for (const r of rows) counts[r.action]++;

  return {
    months: data.months,
    recordedMonths,
    unrecordedExpMonths: data.unrecordedExpMonths,
    expenseTotal,
    monthlyAvg: recordedMonths.length ? expenseTotal / recordedMonths.length : 0,
    rows,
    pareto,
    scope,
    scopeLabel: EXPENSE_SCOPE_LABEL[scope],
    sides: sideSummaries(data, scope),
    monthlySides: monthlySides(data),
    coreCount: coreIdx >= 0 ? coreIdx + 1 : pareto.length,
    breakdown,
    counts,
  };
}
