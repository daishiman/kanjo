/**
 * 財務三表(PL・BS・キャッシュフロー)。
 *
 * いま持っているのは「期間中に動いた金額」(フロー)だけで、「ある時点の残高」(ストック)は無い。
 * だから作れるものと作れないものがはっきり分かれる:
 *
 *   PL(損益計算書)   … 作れる。売上と経費はどちらもフローなので、いまの仕訳で足りる
 *   キャッシュフロー … 概算まで作れる。未決済(売掛・買掛)の増減で発生と現金のズレを埋める
 *   BS(貸借対照表)   … 作れない。期首残高という初期値が要る。取引を足しても出てこない
 *
 * 作れないものを空欄で置くと「バグで出ていない」ように見えるので、
 * BS は代わりに「何を取り込めば作れるか」(BALANCE_SHEET_SOURCES)を返す。
 */
import { catSeries, recordedExpIdx } from './analysis.js';
import { hasSettlementColumns } from './settlement.js';
import { TAX_ACCOUNTS, TAX_ACCOUNT_GROUPS, type TaxAccountGroup } from './tax-accounts.js';
import type { Dataset, FreeeDeal } from './types.js';

/**
 * 経費のまとめ方は、科目を選ぶときの分類(TAX_ACCOUNT_GROUPS)をそのまま使う。
 * 決算書用にもう1つ分類を作ると、記帳の画面と決算書で科目の居場所が変わり、
 * 「さっき人件費に入れたのにここには無い」が起きる。
 * どの分類にも当てはまらない科目だけ、末尾の「その他」に落とす。
 */
export type PlGroup = TaxAccountGroup | 'その他';

export const PL_GROUP_ORDER: readonly PlGroup[] = [...TAX_ACCOUNT_GROUPS, 'その他'];

const GROUP_BY_ACCOUNT = new Map<string, PlGroup>(TAX_ACCOUNTS.map((a) => [a.name, a.group]));

/**
 * 正規化後の科目ラベル(例「サブスク・通信」)は確定申告の科目名と一致しないことがある。
 * 一致しないものは「その他」に落とす。無理に当てはめると、決算書と数字が合わなくなったとき
 * どこで曲げたのかが追えなくなる。
 */
export const plGroupOf = (account: string): PlGroup => GROUP_BY_ACCOUNT.get(account.trim()) ?? 'その他';

export interface PlRow {
  account: string;
  monthly: number[];
  total: number;
  /** 経費合計に占める割合。0..1 */
  share: number;
}

export interface PlGroupBlock {
  group: PlGroup;
  rows: PlRow[];
  monthly: number[];
  total: number;
  share: number;
}

export interface ProfitAndLoss {
  months: string[];
  revenue: { monthly: number[]; total: number };
  groups: PlGroupBlock[];
  expense: { monthly: number[]; total: number };
  /** 売上 − 経費。この帳簿には決算整理(減価償却・棚卸)が入らないので営業利益の概算 */
  profit: { monthly: number[]; total: number };
  /** 利益 ÷ 売上。売上が0なら null */
  profitRate: number | null;
  /** この表で見えないもの(画面にそのまま出す) */
  limits: string[];
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const zeros = (n: number) => new Array<number>(n).fill(0);
const addInto = (dst: number[], src: number[]) => {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i] ?? 0;
};

/**
 * 損益計算書。月別と期間合計を同時に返す(片方だけだと必ずもう片方を見たくなる)。
 * 経費は確定申告の分類でまとめる。科目を1つずつ眺めても「人に払ったか、場所に払ったか」が見えない。
 */
export function profitAndLoss(data: Dataset): ProfitAndLoss {
  const months = data.months;
  const n = months.length;
  const revenue = data.biz.revenue.slice(0, n);
  const revenueTotal = sum(revenue);

  const rows = data.biz.categories.map((account) => {
    const monthly = catSeries(data, account).slice(0, n);
    return { account, monthly, total: sum(monthly), share: 0 };
  });
  const expenseMonthly = zeros(n);
  for (const r of rows) addInto(expenseMonthly, r.monthly);
  const expenseTotal = sum(expenseMonthly);
  for (const r of rows) r.share = expenseTotal > 0 ? r.total / expenseTotal : 0;

  const groups: PlGroupBlock[] = [];
  for (const group of PL_GROUP_ORDER) {
    const inGroup = rows
      .filter((r) => plGroupOf(r.account) === group && r.total !== 0)
      .sort((a, b) => b.total - a.total);
    if (!inGroup.length) continue;
    const monthly = zeros(n);
    for (const r of inGroup) addInto(monthly, r.monthly);
    const total = sum(monthly);
    groups.push({
      group,
      rows: inGroup,
      monthly,
      total,
      share: expenseTotal > 0 ? total / expenseTotal : 0,
    });
  }

  const profitMonthly = revenue.map((v, i) => v - expenseMonthly[i]);
  const profitTotal = revenueTotal - expenseTotal;

  return {
    months,
    revenue: { monthly: revenue, total: revenueTotal },
    groups,
    expense: { monthly: expenseMonthly, total: expenseTotal },
    profit: { monthly: profitMonthly, total: profitTotal },
    profitRate: revenueTotal > 0 ? profitTotal / revenueTotal : null,
    limits: [
      '減価償却費・棚卸は入っていません。年度末の決算整理が別に要ります。',
      '家事按分の前の金額です。事業分だけを記帳している前提で読んでください。',
      '消費税は税込のまま集計しています。',
    ],
  };
}

export interface CashFlowMonth {
  month: string;
  /** 売上 − 経費(発生ベース) */
  profit: number;
  /** 売掛金の増加。入金がまだの売上ぶんだけ、現金は利益より少ない */
  receivableIncrease: number;
  /** 買掛金の増加。支払がまだの経費ぶんだけ、現金は利益より多い */
  payableIncrease: number;
  /** 概算の営業キャッシュフロー */
  operating: number;
}

export interface CashFlow {
  months: CashFlowMonth[];
  /** 期首を0としたときの累計。残高そのものではない */
  cumulative: number[];
  total: number;
  /** 決済列を持つ仕訳が1件も無い(=売掛・買掛のズレを見られない) */
  settlementUnknown: boolean;
  limits: string[];
}

/**
 * 概算のキャッシュフロー(営業活動のみ)。
 *
 * 正しい間接法には BS が2期分要る。ここでは代わりに、freee の決済列から
 * 「まだ入金されていない売上」「まだ払っていない経費」を月ごとに拾って利益を補正する。
 * 借入・返済・固定資産の購入(財務・投資活動)は取引エクスポートに出ないので入らない。
 */
export function cashFlow(data: Dataset, deals: ReadonlyArray<FreeeDeal>): CashFlow {
  const withColumns = deals.filter(hasSettlementColumns);
  const unsettledByMonth = new Map<string, { receivable: number; payable: number }>();
  for (const d of withColumns) {
    // settledDate が空欄のまま = その月の発生額が現金になっていない
    if (d.settledDate) continue;
    const e = unsettledByMonth.get(d.month) ?? { receivable: 0, payable: 0 };
    if (d.io === 'income') e.receivable += d.amount;
    else e.payable += d.amount;
    unsettledByMonth.set(d.month, e);
  }

  const recorded = new Set(recordedExpIdx(data));
  const months: CashFlowMonth[] = [];
  const cumulative: number[] = [];
  let running = 0;
  data.months.forEach((month, i) => {
    // 未記帳の月を0円として混ぜると、取込が遅れているだけの月が「現金が増えた月」に見える
    if (!recorded.has(i)) return;
    const expense = data.biz.categories.reduce((s, c) => s + (catSeries(data, c)[i] ?? 0), 0);
    const profit = (data.biz.revenue[i] ?? 0) - expense;
    const u = unsettledByMonth.get(month) ?? { receivable: 0, payable: 0 };
    const operating = profit - u.receivable + u.payable;
    months.push({
      month,
      profit,
      receivableIncrease: u.receivable,
      payableIncrease: u.payable,
      operating,
    });
    running += operating;
    cumulative.push(running);
  });

  return {
    months,
    cumulative,
    total: running,
    settlementUnknown: withColumns.length === 0,
    limits: [
      '借入・返済・固定資産の購入は入りません。取引エクスポートに出ないためです。',
      '累計は期首を0としたものです。実際の預金残高ではありません。',
      '正確な計算には貸借対照表が2期分必要です。下の一覧を参照してください。',
    ],
  };
}

export interface StatementSource {
  /** 取ってくる CSV の名前 */
  name: string;
  service: 'freee' | 'MF';
  /** どこから書き出すか */
  where: string;
  /**
   * 書き出す画面のURL。メニューをたどらずに直接開けるものだけ入れる。
   * freee側は事業所IDが入るため人によってURLが変わるので持たない。
   */
  url?: string;
  /** 最低限そろっていてほしい列 */
  columns: string[];
  /** その CSV で何が作れるようになるか */
  use: string;
  /** つまずきやすい点(プラン制限・列の有無など) */
  note?: string;
  /**
   * 取る順番。1 から順に取れば、途中でやめても手前まででは形になる。
   * 「全部そろえないと始まらない」に見えると、最初の1つも取られない。
   */
  step: number;
}

/**
 * 貸借対照表を作るために取り込む必要がある CSV の一覧。
 *
 * BS は残高の表なので、取引をいくら足しても出てこない。期首残高という初期値が要る。
 *
 * 1番だけは取込に対応済みで、入れれば資産の部がそのまま埋まる。
 * 残りはまだ受け口が無く、画面では「何を取れば何が増えるか」を示すにとどめる。
 *
 * 並びは「取る順番」であって、重要度順ではない。
 * 資産推移(step 1)を先に置くのは、MF に全口座が連携されていれば
 * 1ファイルで現預金がそろい、そこだけで手元資金の見通しが立つため。
 */
export const BALANCE_SHEET_SOURCES: readonly StatementSource[] = [
  {
    step: 1,
    name: '資産推移(全口座の残高)',
    service: 'MF',
    where: '資産 → 資産推移 → 期間を選ぶ → CSVダウンロード',
    url: 'https://moneyforward.com/bs/history',
    // 列は保有している種類の分だけ出る。持っていない種類の列は最初から存在しない
    columns: ['日付', '合計（円）', '預金・現金（円）', '株式(現物)（円）', '投資信託（円）'],
    use: 'MFに連携した全口座の残高。取り込むとBSの資産の部がそのまま埋まります。',
    note: 'CSV出力はプレミアム限定です。負債の列は無いので、クレカ未払いと借入は画面で手入力してください。',
  },
  {
    step: 2,
    name: '口座別の入出金明細',
    service: 'MF',
    where: '口座 → 対象の口座を開く → 入出金明細のCSVダウンロード',
    url: 'https://moneyforward.com/accounts',
    columns: ['日付', '内容', '金額', '残高'],
    use: '口座ごとの残高。資産推移が出せないときの代わりになります。',
    note: '残高の列が付かない金融機関があります。その口座は通帳・アプリの残高を手で入れてください。',
  },
  {
    step: 3,
    name: '試算表',
    service: 'freee',
    where: 'レポート → 試算表 → 期間を選ぶ → CSV書き出し',
    columns: ['勘定科目', '期首残高', '借方合計', '貸方合計', '残高'],
    use: '事業側の残高。現金・預金・売掛金・買掛金が全部そろい、月次でBSが組めます。',
    note: '決算前でも出せます。まずはこれで期中の残高を押さえるのが早いです。',
  },
  {
    step: 4,
    name: '貸借対照表',
    service: 'freee',
    where: '決算 → 決算書 → 貸借対照表 → CSV書き出し',
    columns: ['勘定科目', '期首残高', '借方', '貸方', '期末残高'],
    use: 'BSの骨格そのもの。元入金・事業主貸借もここから取れます。',
    note: '確定申告を済ませた年度だけ出せます。今期の途中では試算表を使ってください。',
  },
  {
    step: 5,
    name: '仕訳帳',
    service: 'freee',
    where: '決算 → 仕訳帳 → 期間を選ぶ → CSV書き出し',
    columns: ['取引日', '借方勘定科目', '借方金額', '貸方勘定科目', '貸方金額', '摘要'],
    use: 'PLに決算整理(減価償却・棚卸・振替)が入り、精度が上がります。',
  },
  {
    step: 6,
    name: '固定資産台帳',
    service: 'freee',
    where: '決算 → 固定資産台帳 → CSV書き出し',
    columns: ['資産名', '取得日', '取得価額', '償却方法', '当期償却額', '期末簿価'],
    use: '減価償却費の内訳と、固定資産の残高が分かります。',
  },
];

/** 手元資金が何ヶ月もつか。事業継続計画(BCP)で最初に見る数字 */
export function runwayMonths(cashOnHand: number, monthlyFixedCost: number): number | null {
  if (monthlyFixedCost <= 0) return null;
  return Math.round((cashOnHand / monthlyFixedCost) * 10) / 10;
}
