/**
 * トレードオフ画面の規則 (spec-tradeoff-screen「ビジネスルールと検証」、docs/spec-v1.1.md FR-09)。
 *
 * 見直し候補・必要度・推移・試算・推奨の組み合わせはここ 1 か所で決める。
 * api と web は年額・差額の式を持たず、ここの関数を呼ぶだけにする。
 * 突合 (tradeoffReview) と防衛ライン (defenseLine) は既存のまま触らない。
 */
import { catProfile } from './analysis.js';
import { type DiagnosisImprovement, claimPart } from './diagnosis-detectors.js';
import { monthIndex, monthKey } from './month.js';
import type { Dataset } from './types.js';

/** 新しい支出の名前の上限 */
export const TRADEOFF_TITLE_MAX = 100;
/** 試算と候補のメモの上限 */
export const TRADEOFF_MEMO_MAX = 500;
/** 新しい支出の金額上限 (円) */
export const TRADEOFF_AMOUNT_MAX = 100_000_000;
/** 候補キーの長さ上限。これを超える科目×取引先は候補にしない */
export const TRADEOFF_CANDIDATE_KEY_MAX = 300;
/** 画面へ返す候補の上限 */
export const TRADEOFF_CANDIDATE_LIMIT = 50;
/** 候補に残す月額の下限 (円) */
export const TRADEOFF_MIN_MONTHLY = 1000;
/** 集計に使う直近の月数 */
export const TRADEOFF_WINDOW_MONTHS = 3;
/** 推奨の組み合わせを組む候補の数 (月額上位) */
export const TRADEOFF_COMBO_POOL = 12;
/** 推奨として返す組み合わせの数 */
export const TRADEOFF_COMBO_LIMIT = 4;
/** covered の上限。DB の整数列に安全に収まる範囲 */
export const TRADEOFF_COVERED_MAX = 10_000_000_000;

export type TradeoffNeedLevel = 'low' | 'mid' | 'high';
export type TradeoffTrendDirection = 'down' | 'flat' | 'up';
export type TradeoffCostType = '固定費' | '準変動' | 'スポット';

/** freee 経費の 1 行 (期間適用済み) */
export interface TradeoffExpenseRow {
  month: string;
  account: string;
  partner: string;
  amount: number;
}

/** 利用者が候補ごとに残した上書き。need が null なら必要度は推定のまま */
export interface TradeoffCandidateNote {
  need: TradeoffNeedLevel | null;
  memo: string | null;
}

export interface TradeoffScreenCandidate {
  key: string;
  account: string;
  /** 取引先。空なら空文字 (表示だけ『取引先なし』にする) */
  partner: string;
  monthly: number;
  annual: number;
  need: TradeoffNeedLevel;
  needSource: 'auto' | 'manual';
  trend: TradeoffTrendDirection;
  reason: string;
  memo: string | null;
  /** 検知器の改善案に当たったときの関連ページ */
  relatedTo: string | null;
}

export interface TradeoffDefense {
  monthlyMargin: number | null;
  status: 'ok' | 'tight' | 'danger' | 'nodata';
}

/** 最後に保存した試算の条件。画面の復元に使う */
export interface TradeoffLatestPlan {
  id: number;
  title: string | null;
  amount: number;
  recurring: boolean;
  startMonth: string | null;
  memo: string | null;
  keys: string[];
  /** 選んだ候補の月額合計 */
  covered: number;
  verdict: 'covered' | 'insufficient';
  createdAt: string | null;
}

export interface TradeoffScreenResponse {
  candidates: TradeoffScreenCandidate[];
  defense: TradeoffDefense;
  latest: TradeoffLatestPlan | null;
}

const TRADEOFF_CANDIDATE_KEY_PREFIX = 'v1:';

/**
 * 科目と取引先を衝突しない版付き JSON タプルにする。
 * 区切り文字の連結と異なり、どちらの文字列に記号が含まれても一意に復号できる。
 */
export const tradeoffCandidateKey = (account: string, partner: string): string =>
  `${TRADEOFF_CANDIDATE_KEY_PREFIX}${JSON.stringify([account, partner])}`;

/** 候補キーを復号する。旧形式・壊れた形・非正規の JSON は受け入れない。 */
export function parseTradeoffCandidateKey(key: string): { account: string; partner: string } | null {
  if (!key.startsWith(TRADEOFF_CANDIDATE_KEY_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(key.slice(TRADEOFF_CANDIDATE_KEY_PREFIX.length));
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== 'string' ||
      typeof parsed[1] !== 'string'
    )
      return null;
    const [account, partner] = parsed;
    return tradeoffCandidateKey(account, partner) === key ? { account, partner } : null;
  } catch {
    return null;
  }
}

/** 月額を年額にする式の唯一の置き場所 */
const annualizeMonthly = (monthly: number): number => monthly * 12;

/** コード単位の比較。localeCompare は実行環境で順序が揺れるので使わない */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 窓の最初と最後の月の額から推移を出す。±10% ちょうどは横ばいに入れる */
export function tradeoffTrend(first: number, last: number): TradeoffTrendDirection {
  if (first === 0) return last > 0 ? 'up' : 'flat';
  // 小数の誤差で境界が揺れないよう、整数のまま比べる
  if (last * 10 > first * 11) return 'up';
  if (last * 10 < first * 9) return 'down';
  return 'flat';
}

/** 必要度の推定 (決定 010)。上から順に最初に当たった行を採る */
export function tradeoffNeed(type: TradeoffCostType, trend: TradeoffTrendDirection): TradeoffNeedLevel {
  if (type === '固定費' && trend !== 'down') return 'high';
  if (type === 'スポット') return 'low';
  if (trend === 'down') return 'low';
  return 'mid';
}

const TREND_WORD: Record<TradeoffTrendDirection, string> = { flat: '横ばい', up: '増加', down: '減少' };

export function tradeoffReason(input: {
  type: TradeoffCostType;
  trend: TradeoffTrendDirection;
  improvementLabel: string | null;
  memo: string | null;
}): string {
  if (input.memo) return input.memo;
  const base = `${input.type}・直近 ${TRADEOFF_WINDOW_MONTHS} か月は${TREND_WORD[input.trend]}`;
  return input.improvementLabel ? `${base}・${input.improvementLabel}` : base;
}

/** 候補の集計に使う月。期間の終了月から遡る暦の 3 か月 (古い順)。期間に月が無ければ空 */
export function tradeoffWindowMonths(data: Dataset): string[] {
  if (!data.months.length) return [];
  const end = monthIndex(data.months[data.months.length - 1]);
  return Array.from({ length: TRADEOFF_WINDOW_MONTHS }, (_, i) =>
    monthKey(end - TRADEOFF_WINDOW_MONTHS + 1 + i),
  );
}

/**
 * 見直し候補を作る。期間の終了月から遡る暦の 3 か月を科目×取引先で集計し、
 * 月額 1,000 円以上を月額の降順 (同額はキー順) で最大 50 件返す。
 */
export function buildTradeoffCandidates(
  data: Dataset,
  rows: readonly TradeoffExpenseRow[],
  options: {
    improvements: readonly DiagnosisImprovement[];
    notes?: ReadonlyMap<string, TradeoffCandidateNote>;
  },
): TradeoffScreenCandidate[] {
  const window = tradeoffWindowMonths(data);
  if (!window.length) return [];
  const slot = new Map(window.map((m, i) => [m, i]));

  const groups = new Map<string, { account: string; partner: string; amounts: number[] }>();
  for (const r of rows) {
    const i = slot.get(r.month);
    if (i === undefined) continue;
    const key = tradeoffCandidateKey(r.account, r.partner);
    if (key.length > TRADEOFF_CANDIDATE_KEY_MAX) continue;
    let g = groups.get(key);
    if (!g) {
      g = { account: r.account, partner: r.partner, amounts: window.map(() => 0) };
      groups.set(key, g);
    }
    g.amounts[i] += r.amount;
  }

  const out: TradeoffScreenCandidate[] = [];
  for (const [key, g] of groups) {
    const monthly = Math.round(g.amounts.reduce((a, b) => a + b, 0) / TRADEOFF_WINDOW_MONTHS);
    if (monthly < TRADEOFF_MIN_MONTHLY) continue;
    const type = catProfile(data, g.account).type as TradeoffCostType;
    const trend = tradeoffTrend(g.amounts[0], g.amounts[g.amounts.length - 1]);
    const claim = `business:category:${claimPart(g.account)}`;
    const hit = options.improvements.find((imp) => imp.claimKeys.includes(claim)) ?? null;
    const note = options.notes?.get(key) ?? null;
    const memo = note?.memo ?? null;
    const manual = note?.need != null;
    out.push({
      key,
      account: g.account,
      partner: g.partner,
      monthly,
      annual: annualizeMonthly(monthly),
      need: manual ? (note?.need as TradeoffNeedLevel) : tradeoffNeed(type, trend),
      needSource: manual ? 'manual' : 'auto',
      trend,
      reason: tradeoffReason({ type, trend, improvementLabel: hit?.label ?? null, memo }),
      memo,
      relatedTo: hit?.nextAction.to ?? null,
    });
  }
  out.sort((a, b) => b.monthly - a.monthly || byCodeUnit(a.key, b.key));
  return out.slice(0, TRADEOFF_CANDIDATE_LIMIT);
}

export interface TradeoffSimulationResult {
  annualCost: number;
  monthlySaving: number;
  annualSaving: number;
  /** 年額 − 削減。正なら支出増 */
  annualDiff: number;
  verdict: 'covered' | 'insufficient';
  /** 防衛ラインの年間の余裕。nodata なら null */
  marginAnnual: number | null;
  afterMargin: number | null;
  defense: 'keep' | 'break' | null;
}

/**
 * 試算 (決定 005 / 009)。毎月は ×12、単発はそのまま年額にする。
 * 開始月は記録のためだけに受け取り、結果には効かせない。
 */
export function tradeoffSimulation(
  input: { amount: number; recurring: boolean; startMonth?: string | null },
  monthlies: readonly number[],
  monthlyMargin: number | null,
): TradeoffSimulationResult {
  const annualCost = input.recurring ? annualizeMonthly(input.amount) : input.amount;
  const monthlySaving = monthlies.reduce((a, b) => a + b, 0);
  const annualSaving = annualizeMonthly(monthlySaving);
  const annualDiff = annualCost - annualSaving;
  const marginAnnual = monthlyMargin === null ? null : annualizeMonthly(monthlyMargin);
  const afterMargin = marginAnnual === null ? null : marginAnnual - annualDiff;
  return {
    annualCost,
    monthlySaving,
    annualSaving,
    annualDiff,
    verdict: annualDiff <= 0 ? 'covered' : 'insufficient',
    marginAnnual,
    afterMargin,
    defense: afterMargin === null ? null : afterMargin >= 0 ? 'keep' : 'break',
  };
}

export function tradeoffDefenseMargin(defense: {
  diff: number;
  status: TradeoffDefense['status'];
}): TradeoffDefense {
  return {
    monthlyMargin: defense.status === 'nodata' ? null : Math.round(defense.diff),
    status: defense.status,
  };
}

export const isValidTradeoffCovered = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= TRADEOFF_COVERED_MAX;

export interface TradeoffCombo {
  keys: string[];
  count: number;
  monthlySaving: number;
  annualSaving: number;
  excess: number;
  /** 削減 ÷ 新しい支出 の % (切り捨て) */
  sufficiency: number;
  lowCount: number;
  highCount: number;
  ease: '易しい' | '普通' | '難しい';
  risk: '低' | '中' | '高';
  reason: string;
}

/** しやすさ・リスクの写し方 (FR-09)。N 件のうち 低 L 件・高 H 件 */
function comboLabels(n: number, low: number, high: number): Pick<TradeoffCombo, 'ease' | 'risk'> {
  const ease = low * 2 >= n ? '易しい' : low >= 1 ? '普通' : '難しい';
  const risk = high === 0 ? '低' : high === 1 ? '中' : '高';
  return { ease, risk };
}

/**
 * 推奨の組み合わせ (決定 003)。月額上位 12 件から 2〜4 件を選び、
 * 新しい支出の年額に届くものを 5 段の順で並べて上位 4 件を返す。
 */
export function tradeoffCombos(
  candidates: readonly TradeoffScreenCandidate[],
  annualCost: number,
): TradeoffCombo[] {
  if (annualCost <= 0) return [];
  const pool = [...candidates]
    .sort((a, b) => b.monthly - a.monthly || byCodeUnit(a.key, b.key))
    .slice(0, TRADEOFF_COMBO_POOL);

  const found: TradeoffCombo[] = [];
  const pick: TradeoffScreenCandidate[] = [];
  const walk = (start: number): void => {
    if (pick.length >= 2) {
      const monthlySaving = pick.reduce((a, c) => a + c.monthly, 0);
      const annualSaving = annualizeMonthly(monthlySaving);
      if (annualSaving >= annualCost) {
        const lowCount = pick.filter((c) => c.need === 'low').length;
        const highCount = pick.filter((c) => c.need === 'high').length;
        found.push({
          keys: pick.map((c) => c.key),
          count: pick.length,
          monthlySaving,
          annualSaving,
          excess: annualSaving - annualCost,
          sufficiency: Math.floor((annualSaving * 100) / annualCost),
          lowCount,
          highCount,
          ...comboLabels(pick.length, lowCount, highCount),
          reason: `${pick.length} 件で年間 ${annualSaving.toLocaleString()} 円を削減、必要度 高 を ${highCount} 件含む`,
        });
      }
    }
    if (pick.length === 4) return;
    for (let i = start; i < pool.length; i += 1) {
      pick.push(pool[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);

  found.sort(
    (a, b) =>
      a.highCount - b.highCount ||
      b.lowCount - a.lowCount ||
      a.excess - b.excess ||
      a.count - b.count ||
      byCodeUnit(a.keys.join(''), b.keys.join('')),
  );
  return found.slice(0, TRADEOFF_COMBO_LIMIT);
}
