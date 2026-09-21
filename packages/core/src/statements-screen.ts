/**
 * 決算書画面 (/statements) の集計。
 *
 * 画面に出る数字 (KPI 4 枚・PL 5 行・CF の可否と原因・BS の負債 4 項目) は、すべてこの 1 関数から出る。
 * web は描くだけで、件数・合計・比を数え直さない。数え方が 2 か所にあると、
 * KPI の売上高と PL 表の売上高が食い違ったとき、どちらが正しいのか誰にも決められなくなる。
 *
 * 期間は引数で配らない。api が当期・前期の Dataset を切って渡す (analysis-hub と同じ方針)。
 */
import { catSeries } from './analysis.js';
import {
  type BalanceRow,
  LIABILITY_CATEGORIES,
  type LiabilityCategory,
  isRequiredLiabilityCategory,
  lastDayOfMonth,
  liabilityInputsComplete,
} from './balances.js';
import { resolveTx } from './classify.js';
import { countableMfTxs } from './dataset.js';
import { BALANCE_SHEET_SOURCES, type CashFlowMonth, type StatementSource, cashFlow } from './statements.js';
import type { Dataset, FreeeDeal } from './types.js';

export type StatementsRowKey = 'sales' | 'cogs' | 'gross' | 'sga' | 'operating';

/**
 * 売上原価に入れる科目の固定表 (青色申告決算書の「売上原価」欄)。
 * 期末商品棚卸高は減算する。外注工賃は決算書では経費欄なので販管費に残す。
 * ここに無い経費科目 (未知の科目を含む) はすべて販管費。利用者は上書きできない。
 */
export const STATEMENTS_COGS_ACCOUNTS: {
  readonly add: readonly string[];
  readonly subtract: readonly string[];
} = {
  add: ['仕入高', '期首商品棚卸高'],
  subtract: ['期末商品棚卸高'],
};

/** 負債の入力 4 項目。保存カテゴリは既存の LIABILITY_CATEGORIES を変えず、表示名だけを当てる */
export const STATEMENTS_LIABILITY_LINES: ReadonlyArray<{
  category: LiabilityCategory;
  label: string;
  required: boolean;
}> = LIABILITY_CATEGORIES.map((category) => ({
  category,
  label:
    category === '未払金・買掛金'
      ? '未払金'
      : category === 'クレジットカード未払金'
        ? 'クレジット未払'
        : category,
  required: isRequiredLiabilityCategory(category),
}));

export type LiabilityLineStatus = 'unset' | 'zero' | 'amount';

export interface StatementsKpi {
  value: number | null;
  previous: number | null;
  diff: number | null;
  /** diff ÷ |previous|。前期が 0 または無いとき null。現金増減は常に null (符号が反転しうるため率に意味が無い) */
  diffRate: number | null;
  /** 画面にそのまま出す文言 (`出典：仕訳データ`) */
  source: string;
  /** 画面にそのまま出す文言 (`対象期間：2025年9月 - 2026年8月` / `基準日：2026年8月末`) */
  periodLabel: string;
}

export interface StatementsPlRow {
  key: StatementsRowKey;
  label: string;
  current: number;
  previous: number | null;
  diff: number | null;
  /** 売上高比 (0..1 の小数)。売上高 0 で null */
  ratio: number | null;
  formula: string;
  source: string;
  /** 内訳。区分の行は当期金額の降順、計算行は構成要素の区分を式の順に並べる。減算する科目は負の値 */
  accounts: Array<{ account: string; current: number; previous: number | null; ratio: number | null }>;
  monthly: Array<{ month: string; amount: number }>;
}

export interface StatementsCfCauses {
  /** 期間内の明細で、明細仕分けが済んでいない (既定のまま) 件数 */
  unclassified: number;
  missingCash: { months: number; settlementUnknown: boolean };
  /** 期間内の仕訳で勘定科目が空の件数 */
  accountUnset: number;
}

export type StatementsCf =
  | { status: 'available'; months: CashFlowMonth[]; cumulative: number[]; total: number; limits: string[] }
  | { status: 'unavailable'; causes: StatementsCfCauses; limits: string[] };

export interface StatementsBsLine {
  category: LiabilityCategory;
  label: string;
  required: boolean;
  status: LiabilityLineStatus;
  /** unset は null、zero は 0 */
  amount: number | null;
}

export interface StatementsBs {
  referenceMonth: string;
  /** 基準月で採用した最新の資産残高日 */
  asOf: string;
  /** asOf が基準月の月末前か */
  partial: boolean;
  lines: StatementsBsLine[];
  /** 必須 3 項目がどれも unset でない */
  complete: boolean;
  /** 以下は BS 表を描くための追加 (仕様 3.1 の形は保ったまま増やしている) */
  assets: Array<{ category: string; amount: number }>;
  assetTotal: number;
  /** 図に渡す負債値。必須項目が未入力の間は null で、0 円と誤認させない */
  liabilities: Array<{ category: LiabilityCategory; amount: number }> | null;
  /** complete=false のとき null (未入力を 0 と取り違えない) */
  liabilityTotal: number | null;
  netAssets: number | null;
  /** 資産が無いときに画面が示す取込元 */
  sources: readonly StatementSource[];
}

export interface StatementsPeriodNavigation {
  applied: { from: string; to: string } | null;
  full: { from: string; to: string } | null;
  years: string[];
  monthCount: number;
}

export interface StatementsScreen {
  period: {
    from: string;
    to: string;
    label: string;
    previous: { from: string; to: string; label: string } | null;
    navigation: StatementsPeriodNavigation;
  };
  kpis: {
    sales: StatementsKpi;
    operatingProfit: StatementsKpi;
    cashChange: StatementsKpi;
    liabilities: StatementsKpi & { referenceMonth: string; incomplete: boolean };
  };
  pl: { rows: StatementsPlRow[] };
  cf: StatementsCf;
  bs: StatementsBs;
}

export interface StatementsScreenInput {
  current: Dataset;
  /** 直前の同じ長さの期間で切った Dataset。その範囲にデータの月が無ければ null */
  previous: Dataset | null;
  /** 全期間の freee 仕訳 (期間での絞り込みは core が行う) */
  deals: ReadonlyArray<FreeeDeal>;
  /** 全期間の残高行 */
  balances: ReadonlyArray<BalanceRow>;
  /** 基準月 'YYYY-MM'。期間外・不正は期間の最終月に丸める */
  referenceMonth?: string | null;
  /** API の期間選択情報。screen-only 応答で前後期へ移動するために使う */
  navigation?: StatementsPeriodNavigation;
}

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
const monthText = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;

export const statementsPeriodLabel = (from: string, to: string): string =>
  !from ? '' : from === to ? monthText(from) : `${monthText(from)} - ${monthText(to)}`;

/** 前期比。前期が無い・0 のときは率を出さない (0 除算を「+∞%」と見せない) */
export function statementsChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { diff: null, diffRate: null };
  const diff = current - previous;
  return { diff, diffRate: previous === 0 ? null : diff / Math.abs(previous) };
}

/** 'YYYY-MM' の前月 */
export function previousMonthKey(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** 基準月を期間内へ丸める。不正・期間外は期間の最終月 */
export function resolveReferenceMonth(months: readonly string[], ref: string | null | undefined): string {
  if (ref && months.includes(ref)) return ref;
  return months.at(-1) ?? '';
}

/* -------- PL -------- */

interface Sections {
  months: string[];
  sales: number[];
  cogs: number[];
  sga: number[];
  /** 経費科目ごとの期間合計 (区分の内訳用。減算科目は負) */
  cogsAccounts: Map<string, number>;
  sgaAccounts: Map<string, number>;
  salesAccounts: Map<string, number>;
}

const accountName = (raw: string) => raw.trim() || '(科目なし)';

function sections(data: Dataset, deals: ReadonlyArray<FreeeDeal>): Sections {
  const n = data.months.length;
  const sales = data.biz.revenue.slice(0, n);
  while (sales.length < n) sales.push(0);
  const cogs = new Array<number>(n).fill(0);
  const sga = new Array<number>(n).fill(0);
  const cogsAccounts = new Map<string, number>();
  const sgaAccounts = new Map<string, number>();
  for (const account of data.biz.categories) {
    const name = account.trim();
    const series = catSeries(data, account).slice(0, n);
    const isAdd = STATEMENTS_COGS_ACCOUNTS.add.includes(name);
    const isSub = STATEMENTS_COGS_ACCOUNTS.subtract.includes(name);
    const sign = isSub ? -1 : 1;
    const target = isAdd || isSub ? cogs : sga;
    series.forEach((v, i) => {
      target[i] += sign * (v ?? 0);
    });
    const total = sign * sum(series);
    if (total === 0) continue;
    const bucket = isAdd || isSub ? cogsAccounts : sgaAccounts;
    const key = accountName(account);
    bucket.set(key, (bucket.get(key) ?? 0) + total);
  }
  // 売上の科目内訳は Dataset に無い (biz.revenue は 1 系列)。期間内の収入仕訳を科目で束ねる。
  // 合計と月別は biz.revenue を正とする (仕訳を持たない復元済みの売上も含めるため)
  const monthSet = new Set(data.months);
  const salesAccounts = new Map<string, number>();
  for (const d of deals) {
    if (d.io !== 'income' || !monthSet.has(d.month)) continue;
    const key = accountName(d.accountNorm || d.accountRaw);
    salesAccounts.set(key, (salesAccounts.get(key) ?? 0) + d.amount);
  }
  return { months: [...data.months], sales, cogs, sga, cogsAccounts, sgaAccounts, salesAccounts };
}

const ROW_META: Record<StatementsRowKey, { label: string; formula: string; source: string }> = {
  sales: {
    label: '売上高',
    formula: '売上高 ＝ 売上に関する収益の合計',
    source: '仕訳データ（収益科目の合計）',
  },
  cogs: {
    label: '売上原価',
    formula: '売上原価 ＝ 仕入高 ＋ 期首商品棚卸高 − 期末商品棚卸高',
    source: '仕訳データ（仕入高・期首商品棚卸高・期末商品棚卸高）',
  },
  gross: {
    label: '売上総利益',
    formula: '売上総利益 ＝ 売上高 − 売上原価',
    source: '損益計算書（売上高 − 売上原価）',
  },
  sga: {
    label: '販管費',
    formula: '販管費 ＝ 売上原価以外の経費科目の合計',
    source: '仕訳データ（売上原価以外の経費科目の合計）',
  },
  operating: {
    label: '営業利益',
    formula: '営業利益 ＝ 売上総利益 − 販管費',
    source: '損益計算書（売上総利益 − 販管費）',
  },
};

const ROW_ORDER: readonly StatementsRowKey[] = ['sales', 'cogs', 'gross', 'sga', 'operating'];

function plSeries(s: Sections): Record<StatementsRowKey, number[]> {
  const gross = s.sales.map((v, i) => v - s.cogs[i]);
  const operating = gross.map((v, i) => v - s.sga[i]);
  return { sales: s.sales, cogs: s.cogs, gross, sga: s.sga, operating };
}

function mergeAccounts(
  cur: Map<string, number>,
  prev: Map<string, number> | null,
): Array<{ account: string; current: number; previous: number | null }> {
  const names = new Set([...cur.keys(), ...(prev ? prev.keys() : [])]);
  return [...names]
    .map((account) => ({
      account,
      current: cur.get(account) ?? 0,
      previous: prev ? (prev.get(account) ?? 0) : null,
    }))
    .sort((a, b) => b.current - a.current || a.account.localeCompare(b.account, 'ja'));
}

function buildPl(cur: Sections, prev: Sections | null): StatementsPlRow[] {
  const c = plSeries(cur);
  const p = prev ? plSeries(prev) : null;
  const totals = (series: Record<StatementsRowKey, number[]> | null, key: StatementsRowKey) =>
    series ? sum(series[key]) : null;
  const salesTotal = sum(c.sales);
  const component = (a: StatementsRowKey, b: StatementsRowKey) => [
    { account: ROW_META[a].label, current: totals(c, a) ?? 0, previous: totals(p, a) },
    { account: ROW_META[b].label, current: -(totals(c, b) ?? 0), previous: p ? -(totals(p, b) ?? 0) : null },
  ];
  const accountsOf = (key: StatementsRowKey) => {
    switch (key) {
      case 'sales':
        return mergeAccounts(cur.salesAccounts, prev?.salesAccounts ?? null);
      case 'cogs':
        return mergeAccounts(cur.cogsAccounts, prev?.cogsAccounts ?? null);
      case 'sga':
        return mergeAccounts(cur.sgaAccounts, prev?.sgaAccounts ?? null);
      case 'gross':
        return component('sales', 'cogs');
      case 'operating':
        return component('gross', 'sga');
    }
  };
  return ROW_ORDER.map((key) => {
    const current = sum(c[key]);
    const previous = totals(p, key);
    return {
      key,
      ...ROW_META[key],
      current,
      previous,
      diff: previous === null ? null : current - previous,
      ratio: salesTotal === 0 ? null : current / salesTotal,
      accounts: accountsOf(key).map((account) => ({
        ...account,
        ratio: salesTotal === 0 ? null : account.current / salesTotal,
      })),
      monthly: cur.months.map((month, i) => ({ month, amount: c[key][i] ?? 0 })),
    };
  });
}

/* -------- CF -------- */

/**
 * operating は PL の営業利益の月次。cashFlow() は経費科目を一律に足すので、期末商品棚卸高 (減算科目) を
 * 経費として数えてしまう。そのまま使うと同じ画面の PL と CF で利益が食い違うため、利益は PL の値に差し替え、
 * 売掛・買掛の補正だけを cashFlow() から借りる。
 */
function cfOf(data: Dataset, deals: ReadonlyArray<FreeeDeal>, operating: readonly number[]): StatementsCf {
  const monthSet = new Set(data.months);
  const periodDeals = deals.filter((d) => monthSet.has(d.month));
  const flow = cashFlow(data, periodDeals);
  // 明細仕分けの「要確認」と同じ定義 (classificationProgress().reviewPending)。集計対象の明細だけを数える
  const unclassified = countableMfTxs(data.mfTx).filter(
    (t) =>
      monthSet.has(t.m) && resolveTx(t, data.rules, data.edits, data.institutionOwners).clsSrc === '既定',
  ).length;
  const causes: StatementsCfCauses = {
    unclassified,
    missingCash: {
      months: data.unrecordedExpMonths.filter((m) => monthSet.has(m)).length,
      settlementUnknown: flow.settlementUnknown,
    },
    accountUnset: periodDeals.filter((d) => !d.accountRaw.trim() && !d.accountNorm.trim()).length,
  };
  const blocked =
    causes.unclassified > 0 ||
    causes.missingCash.months > 0 ||
    causes.missingCash.settlementUnknown ||
    causes.accountUnset > 0;
  if (blocked) return { status: 'unavailable', causes, limits: flow.limits };
  const months = flow.months.map((m) => {
    const profit = operating[data.months.indexOf(m.month)] ?? 0;
    return { ...m, profit, operating: profit - m.receivableIncrease + m.payableIncrease };
  });
  let running = 0;
  const cumulative = months.map((month) => {
    running += month.operating;
    return running;
  });
  return { status: 'available', months, cumulative, total: running, limits: flow.limits };
}

/* -------- BS -------- */

function lineStatus(row: BalanceRow | undefined): { status: LiabilityLineStatus; amount: number | null } {
  if (!row) return { status: 'unset', amount: null };
  // 0046 より前に「0」を入れて保存した行は (amount, 0)。利用者が値を入れた項目なので未入力ではなく 0円 と読む
  if (row.status === 'zero' || row.amount === 0) return { status: 'zero', amount: 0 };
  return { status: 'amount', amount: row.amount };
}

function liabilityLines(balances: ReadonlyArray<BalanceRow>, month: string): StatementsBsLine[] {
  const rows = balances.filter((r) => r.side === 'liability' && r.month === month);
  return STATEMENTS_LIABILITY_LINES.map((line) => {
    const inMonth = rows.filter((r) => r.category === line.category);
    // 同じ月・同じ種類に手入力と取込が並ぶことは一意制約上無いが、あれば手入力を採る
    const row = inMonth.find((r) => r.source === 'manual') ?? inMonth[0];
    return { ...line, ...lineStatus(row) };
  });
}

const linesTotal = (lines: readonly StatementsBsLine[]) => sum(lines.map((l) => l.amount ?? 0));

/** 負債の保存後の応答にも使う。期間に依存しない BS 部分 */
export function statementsBalanceSheet(
  balances: ReadonlyArray<BalanceRow>,
  referenceMonth: string,
): StatementsBs {
  const lines = liabilityLines(balances, referenceMonth);
  const monthRows = balances.filter((row) => row.month === referenceMonth);
  const complete = liabilityInputsComplete(
    monthRows.filter((row) => row.side === 'liability').map((row) => row.category),
  );
  const assetRows = monthRows.filter((row) => row.side === 'asset');
  const assets = assetRows.map((r) => ({ category: r.category, amount: r.amount }));
  const asOf =
    assetRows
      .map((row) => row.date)
      .sort()
      .at(-1) ?? lastDayOfMonth(referenceMonth);
  const assetTotal = sum(assets.map((a) => a.amount));
  const liabilityTotal = complete ? linesTotal(lines) : null;
  const liabilities = complete
    ? lines.flatMap((line) =>
        line.amount === null ? [] : [{ category: line.category, amount: line.amount }],
      )
    : null;
  return {
    referenceMonth,
    asOf,
    partial: asOf !== '' && asOf < lastDayOfMonth(referenceMonth),
    lines,
    complete,
    assets,
    assetTotal,
    liabilities,
    liabilityTotal,
    netAssets: liabilityTotal === null ? null : assetTotal - liabilityTotal,
    sources: BALANCE_SHEET_SOURCES,
  };
}

/** 前月末の負債合計。行が 1 件も無い、または必須の未入力があれば null (比べる相手が無い) */
function previousLiabilityTotal(balances: ReadonlyArray<BalanceRow>, referenceMonth: string): number | null {
  if (!referenceMonth) return null;
  const month = previousMonthKey(referenceMonth);
  if (!balances.some((r) => r.side === 'liability' && r.month === month)) return null;
  const lines = liabilityLines(balances, month);
  return liabilityInputsComplete(
    balances.filter((row) => row.side === 'liability' && row.month === month).map((row) => row.category),
  )
    ? linesTotal(lines)
    : null;
}

/* -------- 画面 -------- */

export function statementsScreen(input: StatementsScreenInput): StatementsScreen {
  const { current, deals, balances } = input;
  const previous = input.previous && input.previous.months.length > 0 ? input.previous : null;
  const from = current.months[0] ?? '';
  const to = current.months.at(-1) ?? '';
  const periodText = statementsPeriodLabel(from, to);
  const target = `対象期間：${periodText}`;

  const cur = sections(current, deals);
  const prev = previous ? sections(previous, deals) : null;
  const rows = buildPl(cur, prev);
  const row = (key: StatementsRowKey) => rows.find((r) => r.key === key) as StatementsPlRow;

  const cf = cfOf(current, deals, plSeries(cur).operating);
  const prevCf = previous && prev ? cfOf(previous, deals, plSeries(prev).operating) : null;

  const balanceMonths = [...new Set(balances.map((balance) => balance.month))]
    .filter((month) => {
      const applied = input.navigation?.applied;
      return !applied || (month >= applied.from && month <= applied.to);
    })
    .sort();
  // 取引をまだ取り込んでいない時点で資産 CSV だけを入れても、BS は確認できるようにする。
  const referenceMonths = current.months.length > 0 ? current.months : balanceMonths;
  const referenceMonth = resolveReferenceMonth(referenceMonths, input.referenceMonth);
  const bs = statementsBalanceSheet(balances, referenceMonth);
  const prevLiabilities = previousLiabilityTotal(balances, referenceMonth);

  const flowKpi = (key: StatementsRowKey, source: string): StatementsKpi => {
    const r = row(key);
    return {
      value: r.current,
      previous: r.previous,
      ...statementsChange(r.current, r.previous),
      source,
      periodLabel: target,
    };
  };
  const cashValue = cf.status === 'available' ? cf.total : null;
  const cashPrevious = prevCf?.status === 'available' ? prevCf.total : null;
  const cashChange = statementsChange(cashValue, cashPrevious);

  return {
    period: {
      from,
      to,
      label: periodText,
      previous: previous
        ? {
            from: previous.months[0],
            to: previous.months.at(-1) as string,
            label: statementsPeriodLabel(previous.months[0], previous.months.at(-1) as string),
          }
        : null,
      navigation: input.navigation ?? {
        applied: from && to ? { from, to } : null,
        full: from && to ? { from, to } : null,
        years: [...new Set(current.months.map((month) => month.slice(0, 4)))].sort().reverse(),
        monthCount: current.months.length,
      },
    },
    kpis: {
      sales: flowKpi('sales', '出典：仕訳データ'),
      operatingProfit: flowKpi('operating', '出典：損益計算書'),
      cashChange: {
        value: cashValue,
        previous: cashPrevious,
        diff: cashChange.diff,
        diffRate: null,
        source: '出典：現金収支/キャッシュフロー',
        periodLabel: target,
      },
      liabilities: {
        value: bs.liabilityTotal,
        previous: prevLiabilities,
        ...statementsChange(bs.liabilityTotal, prevLiabilities),
        source: '出典：貸借対照表（要入力）',
        periodLabel: referenceMonth ? `基準日：${monthText(referenceMonth)}末` : '基準日：—',
        referenceMonth,
        incomplete: !bs.complete,
      },
    },
    pl: { rows },
    cf,
    bs,
  };
}
