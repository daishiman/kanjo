/**
 * 現金の記帳(口座・カード明細に出ない現金の受け渡し)。
 * 事業分(biz)は freee 仕訳と同じ形に変換して科目別集計へ合流し、
 * 個人分(per)は口座「現金」の MF 明細として仕分け・家計集計へ合流する。
 * 取込値とは別テーブルで持つため、CSV/Excel の再取込で消えない。
 */
import type { FreeeDeal, MfTx } from './types.js';

export type CashSide = 'biz' | 'per';
export type CashIo = 'income' | 'expense';

export interface CashEntry {
  id: number;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'YYYY-MM'(date から導出) */
  month: string;
  side: CashSide;
  io: CashIo;
  /** 正の整数(円)。向きは io で持つ */
  amount: number;
  /** 内容・支払先(例: 〇〇商工会議所 定例会) */
  description: string;
  /** biz: freee 勘定科目 / per: MF 大項目 */
  categoryMajor: string;
  /** per のみ(biz は空) */
  categoryMid: string;
  memo: string | null;
  /** 交通費の出発地。transitTo と対で入るか、両方 null */
  transitFrom: string | null;
  transitTo: string | null;
  /** 往復なら true(金額は既に往復分で入っている) */
  transitRound: boolean;
  /** 領収書が構造上出ない支出(電車代など)。未添付の警告対象から外す */
  receiptWaived: boolean;
}

/** 個人分の現金明細を MF 明細として扱うときの ID 接頭辞 */
export const CASH_TX_PREFIX = 'cash:';
/** 個人分の現金明細に付ける口座名 */
export const CASH_INSTITUTION = '現金';

export const cashTxId = (id: number): string => `${CASH_TX_PREFIX}${id}`;
export const isCashTxId = (id: string): boolean => id.startsWith(CASH_TX_PREFIX);

/**
 * 明細の支払手段。口座名(MFの保有金融機関)からの導出で、MF自身は支払手段を持たない。
 * - cash: 手入力した現金の記帳
 * - card: 口座名がカードを名乗るもの
 * - account: それ以外の口座(銀行・電子マネー等)
 * - unknown: 口座名が無い(列の無い時期の旧取込)
 */
export type PaymentMethod = 'cash' | 'card' | 'account' | 'unknown';

export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = ['cash', 'card', 'account', 'unknown'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  account: '口座',
  unknown: '不明',
};

/** 口座名がカードを名乗る手がかり。名寄せはせず、名前に現れた分だけを見る */
const CARD_HINTS = ['カード', 'ｶｰﾄﾞ', 'CARD', 'クレジット'];

/**
 * 明細1件の支払手段を決める。
 * 現金は ID(cash:) を正とし、口座名が編集で変わっても手入力の事実を失わない。
 */
export function paymentMethodOf(tx: { id: string; inst?: string | null }): PaymentMethod {
  if (isCashTxId(tx.id)) return 'cash';
  const inst = (tx.inst ?? '').trim();
  if (!inst) return 'unknown';
  if (inst === CASH_INSTITUTION) return 'cash';
  const upper = inst.toUpperCase();
  if (CARD_HINTS.some((hint) => upper.includes(hint))) return 'card';
  return 'account';
}
export const monthOf = (date: string): string => date.slice(0, 7);

/** 事業分の現金明細を freee 仕訳1行として扱う(科目の正規化は取込と同じ対応表を使う) */
export function cashToDeal(e: CashEntry, normMap: Record<string, string>): FreeeDeal {
  const accountRaw = e.categoryMajor;
  return {
    month: e.month,
    date: e.date,
    io: e.io,
    partner: e.description,
    accountRaw,
    accountNorm: normMap[accountRaw] ?? accountRaw,
    amount: e.amount,
  };
}

/** 個人分の現金明細を MF 明細1件として扱う(口座は「現金」) */
export function cashToTx(e: CashEntry): MfTx {
  return {
    id: cashTxId(e.id),
    m: e.month,
    d: `${e.date.slice(5, 7)}/${e.date.slice(8, 10)}`,
    c: e.description,
    a: e.io === 'income' ? e.amount : -e.amount,
    big: e.categoryMajor,
    mid: e.categoryMid,
    inst: CASH_INSTITUTION,
  };
}

/* -------- 交通費(0010) -------- */

/** 交通費の既定科目。候補に無ければ画面側で選び直す */
export const TRANSIT_CATEGORY = '旅費交通費';

/**
 * 「通常の記帳」と「交通費(電車代)」は保存先も科目も同じ1つの現金明細で、
 * 違うのは入力の作法だけ(区間と片道運賃から金額・内容文を組み立て、証憑不要にする)。
 * 画面にこの1行を出して、2つの旅費交通費が別勘定に見えるのを防ぐ。
 */
export const TRANSIT_SAME_ACCOUNT_NOTE =
  '交通費も通常の記帳も同じ「旅費交通費」に入ります。違うのは入力方法だけです。';

/**
 * 通常の記帳で交通費の科目を選んだとき、交通費の入力に切り替えてよいか。
 * 内容や金額を入れたあとに切り替えると、それを捨てることになる。
 * まだ何も入れていないときだけ自動で切り替え、入力済みなら画面から誘うだけにする。
 */
export function shouldSwitchToTransit(
  big: string,
  entered: { description: string; amount: number },
): boolean {
  if (big.trim() !== TRANSIT_CATEGORY) return false;
  return !entered.description.trim() && entered.amount <= 0;
}

export interface TransitInput {
  from: string;
  to: string;
  /** 片道の金額(円) */
  oneWayAmount: number;
  round: boolean;
}

/**
 * 区間と片道金額から、記帳1件分の金額と内容文を組み立てる。
 * 電車代は領収書が出ないため、ここで作った明細は receiptWaived = true で保存する。
 */
export function buildTransitEntry(input: TransitInput): { amount: number; description: string } {
  const from = input.from.trim();
  const to = input.to.trim();
  const amount = input.round ? input.oneWayAmount * 2 : input.oneWayAmount;
  return {
    amount,
    description: `電車代 ${from}→${to}(${input.round ? '往復' : '片道'})`,
  };
}

/** 区間の入力が成立しているか(片方だけの入力を弾く) */
export function transitInputError(input: TransitInput): string | null {
  if (!input.from.trim() || !input.to.trim()) return '出発地と到着地の両方を入力してください';
  if (!Number.isInteger(input.oneWayAmount) || input.oneWayAmount <= 0)
    return '片道の金額を1円以上の整数で入力してください';
  if (input.oneWayAmount * (input.round ? 2 : 1) > 1_000_000_000) return '金額が大きすぎます';
  return null;
}

export type ReceiptStatus = 'attached' | 'waived' | 'missing';

/**
 * 明細の証憑状態。「添付あり」「証憑不要」「未添付」の3つに分ける。
 * 未添付は不備ではなく「まだ貼っていない」ことを示すだけで、集計には一切影響しない。
 */
export function receiptStatus(entry: { receiptWaived: boolean }, attachmentCount: number): ReceiptStatus {
  if (attachmentCount > 0) return 'attached';
  return entry.receiptWaived ? 'waived' : 'missing';
}

/** 事業支出でレシート未添付を警告色にする下限(円)。これ未満は薄く出すだけ */
export const RECEIPT_WARN_THRESHOLD = 1_000;

/**
 * 未添付をどのくらい強く出すか。
 * 'warn' は黄色のバッジで目を引かせ、'quiet' は薄い灰色で「まだ貼っていない」とだけ伝える。
 * 現金の記帳は1件ずつ手で入れるため件数は少ないが、全件が黄色だと画面が警告だらけになり
 * 本当に貼るべき1件が埋もれる。どこで線を引くかは運用の判断。
 */
export function missingReceiptSeverity(entry: {
  io: 'income' | 'expense';
  side: 'biz' | 'per';
  amount: number;
}): 'warn' | 'quiet' {
  // 収入は証憑を求める性質の取引ではない。
  if (entry.io === 'income') return 'quiet';
  // 家計は自分用の記録で、税務上の裏付けを求められない。
  if (entry.side === 'per') return 'quiet';
  // 事業の支出でも少額は経費の裏付けとして問われにくい。
  // ここを 0 にすれば全件が黄色に戻る(運用で調整する前提の唯一のつまみ)。
  return entry.amount >= RECEIPT_WARN_THRESHOLD ? 'warn' : 'quiet';
}

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  attached: '添付あり',
  waived: '証憑不要',
  missing: '未添付',
};

/* -------- 二重計上の検知 -------- */

/** 突合の強さ。日付が一致するかどうかだけが違う */
export type DuplicateConfidence = 'same_day' | 'near_day';

/** 現金の記帳と freee 仕訳が同じ支払いを指している疑い */
export interface CashDealDuplicate {
  /** 疑いのある現金の記帳 */
  cashEntryId: number;
  cashDate: string;
  /** 突合できた freee 仕訳(取込由来のみ) */
  deal: FreeeDeal;
  confidence: DuplicateConfidence;
  /** 現金の記帳から見た日付の差(日)。同日は 0 */
  dayGap: number;
}

/** near_day として拾う日数の上限。これを超えると別の支払いとみなす */
export const DUPLICATE_NEAR_DAY_LIMIT = 3;

const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/**
 * 現金の記帳(事業分)と、取込由来の freee 仕訳の二重計上候補を返す。
 *
 * 突合は「同額・同じ入出金・同じ勘定科目(正規化後)」を必須とし、日付は同日(same_day)と
 * 3日以内(near_day)を区別する。現金で払った日と freee へ登録した日はずれることがあるため、
 * 日付一致だけに絞ると見逃す。逆に額や科目まで緩めると誤検知が実用に耐えないため広げない。
 *
 * deals には取込由来の仕訳だけを渡すこと。現金由来の仕訳(cashBizDeals)を混ぜると自分自身と一致する。
 * 判定はあくまで候補で、消し込みはしない(同じ日に同科目・同額の支払いが本当に2件あることがある)。
 */
export function findCashDealDuplicates(
  entries: CashEntry[],
  deals: FreeeDeal[],
  normMap: Record<string, string> = {},
): CashDealDuplicate[] {
  const targets = entries.filter((e) => e.side === 'biz');
  if (targets.length === 0 || deals.length === 0) return [];

  const byKey = new Map<string, FreeeDeal[]>();
  for (const deal of deals) {
    const key = `${deal.io}|${deal.amount}|${deal.accountNorm}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(deal);
    else byKey.set(key, [deal]);
  }

  const out: CashDealDuplicate[] = [];
  for (const entry of targets) {
    // 科目は cashToDeal と同じ規則で正規化してから突合する(表記違いで取りこぼさない)
    const account = normMap[entry.categoryMajor] ?? entry.categoryMajor;
    for (const deal of byKey.get(`${entry.io}|${entry.amount}|${account}`) ?? []) {
      const dayGap = Math.abs(dayNumber(entry.date) - dayNumber(deal.date));
      if (dayGap > DUPLICATE_NEAR_DAY_LIMIT) continue;
      out.push({
        cashEntryId: entry.id,
        cashDate: entry.date,
        deal,
        confidence: dayGap === 0 ? 'same_day' : 'near_day',
        dayGap,
      });
    }
  }
  // 疑いの強い順(同日 → 日付が近い順)に出し、同じ強さでは記帳の新しい順
  return out.sort((a, b) => a.dayGap - b.dayGap || b.cashEntryId - a.cashEntryId);
}

/** 事業分だけを freee 仕訳の配列にする(対象月を絞れる) */
export function cashBizDeals(
  entries: CashEntry[],
  normMap: Record<string, string>,
  months?: string[],
): FreeeDeal[] {
  const ms = months ? new Set(months) : null;
  return entries
    .filter((e) => e.side === 'biz' && (!ms || ms.has(e.month)))
    .map((e) => cashToDeal(e, normMap));
}
