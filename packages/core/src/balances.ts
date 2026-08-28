/**
 * 残高(貸借対照表)の組み立て。
 *
 * PLやCFは取引を足せば出るが、BSは足し算では出ない。
 * 「10万円使った」を何回足しても、いま口座にいくらあるかは分からない。
 * 残高そのものを外から入れるしかない。
 *
 * 入れ方は2通りある。
 *   資産 … MFの資産推移CSV(https://moneyforward.com/bs/history)を取り込む
 *   負債 … 画面で手入力する
 *
 * 負債を手入力にしているのは、MFの資産推移CSVに負債の列が無いため。
 * クレジットカードの未払いや借入は、このCSVのどこにも出てこない。
 * 資産だけで純資産を名乗ると、未払いの分だけ実態より良く見える。
 * だからここでは「負債が1件も無い月の純資産は出さない」を貫く。
 */

export type BalanceSide = 'asset' | 'liability';

/** 残高1件。「いつ時点の」「どちら側の」「何が」「いくら」 */
export interface BalanceRow {
  /** 'YYYY-MM' */
  month: string;
  /**
   * その月で採用した日付 'YYYY-MM-DD'。
   * 月末とは限らない。まだ終わっていない月は取得日が入る。
   */
  date: string;
  side: BalanceSide;
  /** 「預金・現金」「クレジットカード未払金」など */
  category: string;
  amount: number;
  /** mf=CSV取込 / manual=手入力。手入力を取込で消さないための区別 */
  source: 'mf' | 'manual';
}

/**
 * 手入力で受ける負債の種類。
 * 自由入力にすると月ごとに名前が揺れて前月と比べられなくなるので、決め打ちで並べる。
 * 並びは金額が大きくなりやすい順ではなく、思い出しやすい順にする。
 */
export const LIABILITY_CATEGORIES: readonly string[] = [
  'クレジットカード未払金',
  '借入金',
  '未払金・買掛金',
  'その他の負債',
];

export interface BalanceSheetLine {
  category: string;
  amount: number;
}

export interface BalanceSheetMonth {
  month: string;
  /** この月の残高がいつ時点のものか */
  asOf: string;
  /** 月末に達していない月。当月を見ているときに立つ */
  partial: boolean;
  assets: BalanceSheetLine[];
  assetTotal: number;
  liabilities: BalanceSheetLine[];
  liabilityTotal: number;
  /** 資産 − 負債。負債が1件も入っていない月は null(出さない) */
  netAssets: number | null;
}

export interface BalanceSheet {
  months: BalanceSheetMonth[];
  /** 表の列に使う。月によって持っている種類が違っても列がずれないように、全月の和集合を返す */
  assetCategories: string[];
  liabilityCategories: string[];
  /** 負債が1件も入っていない月。画面で名指しして入力を促す */
  monthsWithoutLiabilities: string[];
  /** この表に入っていないもの */
  limits: string[];
}

/** 'YYYY-MM' の末日。月末に達しているかの判定に使う */
export function lastDayOfMonth(month: string): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const year = Number(m[1]);
  const mon = Number(m[2]);
  // 翌月の0日 = 当月の末日
  const day = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${m[1]}-${m[2]}-${String(day).padStart(2, '0')}`;
}

/**
 * 負債の入力が無い月の純資産をどう返すか。
 *
 * 資産だけは毎月CSVで入るが、負債は手入力なので入れ忘れる月が必ず出る。
 * そのとき「純資産 = 資産」と出してしまうと、未払いを返し終えた月と
 * 入力し忘れた月が画面上で同じ顔になる。
 *
 * hasLiabilityInput は「その月に負債の行が1件でもあるか」。
 * 0円と入力した月は true(返し終えたことが分かっている)、
 * 一度も触っていない月は false(分からない)。
 */
function netAssetsOf(assetTotal: number, liabilityTotal: number, hasLiabilityInput: boolean): number | null {
  // 触っていない月は空欄のまま置く。埋めた数字は、後から「入力し忘れ」だと気づけない
  if (!hasLiabilityInput) return null;
  return assetTotal - liabilityTotal;
}

/**
 * 残高の行から月次のBSを組む。
 * 行が1件も無ければ空のBSを返す(画面側が「取り込めば作れる」を出す)。
 */
export function buildBalanceSheet(rows: ReadonlyArray<BalanceRow>): BalanceSheet {
  const byMonth = new Map<string, BalanceRow[]>();
  for (const row of rows) {
    const list = byMonth.get(row.month);
    if (list) list.push(row);
    else byMonth.set(row.month, [row]);
  }

  const assetCategories = new Set<string>();
  const liabilityCategories = new Set<string>();
  const monthsWithoutLiabilities: string[] = [];

  const months: BalanceSheetMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const assets = list.filter((r) => r.side === 'asset');
      const liabilities = list.filter((r) => r.side === 'liability');
      for (const r of assets) assetCategories.add(r.category);
      for (const r of liabilities) liabilityCategories.add(r.category);

      const assetTotal = assets.reduce((s, r) => s + r.amount, 0);
      const liabilityTotal = liabilities.reduce((s, r) => s + r.amount, 0);
      if (!liabilities.length) monthsWithoutLiabilities.push(month);

      // 残高の日付は資産側が持っている。手入力の負債は月しか持たない
      const asOf =
        assets
          .map((r) => r.date)
          .sort()
          .at(-1) ?? lastDayOfMonth(month);

      return {
        month,
        asOf,
        partial: asOf !== '' && asOf < lastDayOfMonth(month),
        assets: assets.map((r) => ({ category: r.category, amount: r.amount })),
        assetTotal,
        liabilities: liabilities.map((r) => ({ category: r.category, amount: r.amount })),
        liabilityTotal,
        netAssets: netAssetsOf(assetTotal, liabilityTotal, liabilities.length > 0),
      };
    });

  const limits = [
    '事業と家計を分けていません。MFに連携した口座がすべて混ざった残高です。',
    '負債は手入力です。入力していない月は純資産を出しません。',
    '口座ごとの内訳は入りません。MFのCSVが種類ごとの合計しか持っていないためです。',
  ];

  return {
    months,
    assetCategories: [...assetCategories],
    liabilityCategories: [...liabilityCategories],
    monthsWithoutLiabilities,
    limits,
  };
}
