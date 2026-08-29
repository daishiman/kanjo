/**
 * freee 未決済(未入金・未払)の一覧。
 *
 * freee の取引は「発生」と「決済」が別で、支払日が空のままの取引は未決済のまま残る。
 * 期日を過ぎた未払は延滞、期日を過ぎた未入金は回収漏れで、どちらも損益からは見えない
 * (損益は発生ベースで既に計上済み)。だから集計とは別に、期日の側から並べ直して見せる。
 *
 * この計算は残高を持たない。あくまで「エクスポートに書かれた支払日が空か」だけを見る。
 */
import type { FreeeDeal } from './types.js';

/** 期日が近いと見なす日数。これ以内なら支払・入金の準備を促す */
export const DUE_SOON_DAYS = 7;

export type SettlementStatus = 'overdue' | 'due_soon' | 'scheduled' | 'no_due';

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  overdue: '期日超過',
  due_soon: '期日が近い',
  scheduled: '期日待ち',
  no_due: '期日なし',
};

export interface UnsettledDeal {
  deal: FreeeDeal;
  /** 未決済の残額(円)。一部だけ決済済みならその差額 */
  remaining: number;
  dueDate: string | null;
  /** 期日を何日過ぎているか。未到来・期日なしは 0 */
  daysOverdue: number;
  status: SettlementStatus;
}

export interface UnsettledSummary {
  /** 未払(支出)の件数と残額 */
  payable: { count: number; amount: number };
  /** 未入金(収入)の件数と残額 */
  receivable: { count: number; amount: number };
  /** そのうち期日を過ぎているもの */
  overdue: { count: number; amount: number };
}

const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/**
 * その仕訳が決済列を持つ取込から来たか。
 * 列そのものが無い時期のエクスポートを「支払日が空＝未決済」と読むと全件が未決済になるため、
 * 列の不在(undefined)と空欄(null)を区別してここで弾く。
 */
export function hasSettlementColumns(deal: FreeeDeal): boolean {
  return deal.dueDate !== undefined || deal.settledDate !== undefined || deal.settledAmount !== undefined;
}

function statusOf(dueDate: string | null, today: string): { status: SettlementStatus; daysOverdue: number } {
  if (!dueDate) return { status: 'no_due', daysOverdue: 0 };
  const gap = dayNumber(dueDate) - dayNumber(today);
  if (gap < 0) return { status: 'overdue', daysOverdue: -gap };
  return { status: gap <= DUE_SOON_DAYS ? 'due_soon' : 'scheduled', daysOverdue: 0 };
}

/** 並び順の重み。急ぐものほど小さい */
const STATUS_ORDER: Record<SettlementStatus, number> = {
  overdue: 0,
  due_soon: 1,
  scheduled: 2,
  no_due: 3,
};

/**
 * 未決済の仕訳を、急ぐ順(期日超過 → 期日が近い → 期日待ち → 期日なし)で返す。
 * today は 'YYYY-MM-DD'。呼び出し側が渡すことで、この関数自身は時計を持たない。
 */
export function unsettledDeals(deals: ReadonlyArray<FreeeDeal>, today: string): UnsettledDeal[] {
  const out: UnsettledDeal[] = [];
  for (const deal of deals) {
    if (!hasSettlementColumns(deal)) continue;
    // 支払日が入っていれば、金額が足りていなくても「決済を始めた」ものとして一覧から外す。
    // 一部決済の追跡は残高の話で、エクスポート1枚からは正しく追えない。
    if (deal.settledDate) continue;
    const settled = deal.settledAmount ?? 0;
    const remaining = deal.amount - settled;
    if (remaining <= 0) continue;
    const dueDate = deal.dueDate ?? null;
    const { status, daysOverdue } = statusOf(dueDate, today);
    out.push({ deal, remaining, dueDate, daysOverdue, status });
  }
  return out.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      // 同じ状態の中では、期日超過は長く放置しているものから、それ以外は期日の近いものから
      (a.status === 'overdue'
        ? b.daysOverdue - a.daysOverdue
        : (a.dueDate ?? '').localeCompare(b.dueDate ?? '')) ||
      a.deal.date.localeCompare(b.deal.date) ||
      b.remaining - a.remaining,
  );
}

/** 未決済の件数と残額を、未払・未入金・期日超過に分けて数える */
export function unsettledSummary(rows: ReadonlyArray<UnsettledDeal>): UnsettledSummary {
  const sum: UnsettledSummary = {
    payable: { count: 0, amount: 0 },
    receivable: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
  };
  for (const row of rows) {
    const bucket = row.deal.io === 'expense' ? sum.payable : sum.receivable;
    bucket.count += 1;
    bucket.amount += row.remaining;
    if (row.status === 'overdue') {
      sum.overdue.count += 1;
      sum.overdue.amount += row.remaining;
    }
  }
  return sum;
}

/** 入金・支払の予定を月単位でまとめた1行 */
export interface SettlementMonth {
  /** 'YYYY-MM'。期日の無い分は month が null の行に集める */
  month: string | null;
  /** その月に入る予定の額 */
  receipt: number;
  /** その月に出る予定の額 */
  payment: number;
  /** receipt − payment。マイナスなら、その月は現金が減る */
  net: number;
  /** 期日をすでに過ぎている分。予定ではなく「本来もう動いていたはずの額」 */
  overdue: number;
  count: number;
}

/** 未決済APIが返す一式。core→API→webで同じ契約を使う。 */
export interface UnsettledReport {
  /** 期日超過を判定した基準日 */
  today: string;
  rows: UnsettledDeal[];
  summary: UnsettledSummary;
  schedule: SettlementMonth[];
}

/**
 * 未決済を期日の月ごとに束ね、これから現金がいつ動くかを並べる。
 *
 * 決算書のキャッシュフローが「もう起きたこと」を現金に直すのに対し、こちらは「これから起きること」。
 * 損益にも過去のキャッシュフローにも出てこない、将来の入出金予定だけを示す。
 * 手元残高は含まないため、この差引だけで資金不足かどうかは判定しない。
 *
 * 期日を過ぎた分は、過ぎた月ではなく今月に寄せる。回収も支払も、実際に動くとしたらこれから先だから。
 * 期日の無い分は月に割り当てられないので、末尾の month=null にまとめて「予定に数えられない額」として残す。
 */
export function settlementSchedule(rows: ReadonlyArray<UnsettledDeal>, today: string): SettlementMonth[] {
  const thisMonth = today.slice(0, 7);
  const byMonth = new Map<string | null, SettlementMonth>();
  const at = (month: string | null): SettlementMonth => {
    let m = byMonth.get(month);
    if (!m) {
      m = { month, receipt: 0, payment: 0, net: 0, overdue: 0, count: 0 };
      byMonth.set(month, m);
    }
    return m;
  };
  for (const row of rows) {
    const month = row.dueDate ? (row.status === 'overdue' ? thisMonth : row.dueDate.slice(0, 7)) : null;
    const m = at(month);
    if (row.deal.io === 'expense') m.payment += row.remaining;
    else m.receipt += row.remaining;
    if (row.status === 'overdue') m.overdue += row.remaining;
    m.count += 1;
  }
  for (const m of byMonth.values()) m.net = m.receipt - m.payment;
  return [...byMonth.values()].sort((a, b) => {
    // 期日なしは予定として読めないので、月のある行をすべて出しきってから最後に置く
    if (a.month === null) return 1;
    if (b.month === null) return -1;
    return a.month.localeCompare(b.month);
  });
}

/** 未決済の明細・集計・月別予定を、APIがそのまま返せる一つの契約へまとめる。 */
export function unsettledReport(deals: ReadonlyArray<FreeeDeal>, today: string): UnsettledReport {
  const rows = unsettledDeals(deals, today);
  return {
    today,
    rows,
    summary: unsettledSummary(rows),
    schedule: settlementSchedule(rows, today),
  };
}
