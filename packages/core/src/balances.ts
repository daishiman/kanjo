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
 * だからここでは「必須の負債 3 項目がそろうまで純資産は出さない」を貫く。
 */

export type BalanceSide = 'asset' | 'liability';

/**
 * 負債入力の金額上限。1 兆円を超える値は桁の入力ミスとして API 境界で止める。
 * core と API で別々の数値を持たないため、ここを単一の正本とする。
 */
export const LIABILITY_AMOUNT_MAX = 1_000_000_000_000;

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
  /**
   * 手入力の負債で「0円と入れた」か「金額を入れた」か(0046)。未入力は行を持たないことで表す。
   * 0046 より前の行と取込の行は 'amount'。省略時も 'amount' とみなす。
   */
  status?: 'zero' | 'amount';
}

/**
 * 手入力で受ける負債の種類。
 * 自由入力にすると月ごとに名前が揺れて前月と比べられなくなるので、決め打ちで並べる。
 * 並びは金額が大きくなりやすい順ではなく、思い出しやすい順にする。
 */
export const LIABILITY_CATEGORIES = [
  '借入金',
  '未払金・買掛金',
  'クレジットカード未払金',
  'その他の負債',
] as const;

export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];

/** この 3 項目が「0円または金額入力済み」で、初めて BS を完了と扱う。 */
export const REQUIRED_LIABILITY_CATEGORIES = [
  '借入金',
  '未払金・買掛金',
  'クレジットカード未払金',
] as const satisfies readonly LiabilityCategory[];

export function isRequiredLiabilityCategory(category: LiabilityCategory): boolean {
  return REQUIRED_LIABILITY_CATEGORIES.some((required) => required === category);
}

/**
 * BS 完了条件の正本。未入力は行を持たないため、必須カテゴリがすべて存在するかで判定できる。
 */
export function liabilityInputsComplete(categories: Iterable<string>): boolean {
  const entered = new Set(categories);
  return REQUIRED_LIABILITY_CATEGORIES.every((category) => entered.has(category));
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
