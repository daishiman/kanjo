/**
 * データセット操作（取込の洗い替え・月枠の確保・JSON入出力）。
 * HTML版 ensureMonth / importFreee / importMF / importJSON の挙動を忠実に移植。
 */
import { applyClassification } from './classify.js';
import type { Cls, Dataset, FreeeDeal, MfTx, Rule } from './types.js';

export function ensureMonth(data: Dataset, m: string): number {
  if (!data.months.includes(m)) {
    data.months.push(m);
    data.months.sort();
    const i = data.months.indexOf(m);
    data.biz.revenue.splice(i, 0, 0);
    data.biz.categories.forEach((c) => data.biz.expense[c].splice(i, 0, 0));
    data.subs.vendors.forEach((v) => data.subs.matrix[v].splice(i, 0, 0));
    data.subs.other.splice(i, 0, 0);
  }
  return data.months.indexOf(m);
}

/**
 * freee仕訳を月単位洗い替えで反映する。
 * 対象月の売上・科目別経費・サブスクベンダー行列をゼロクリアしてから加算（HTML版と同一）。
 * 取り込んだ月は未記帳月から解除する。
 */
export function applyFreeeDeals(data: Dataset, deals: FreeeDeal[], months: string[]): void {
  months.forEach((m) => {
    const i = ensureMonth(data, m);
    data.biz.revenue[i] = 0;
    data.biz.categories.forEach((c) => {
      data.biz.expense[c][i] = 0;
    });
    data.subs.vendors.forEach((v) => {
      data.subs.matrix[v][i] = 0;
    });
    data.subs.other[i] = 0;
  });
  deals.forEach((dl) => {
    const i = ensureMonth(data, dl.month);
    const acct = dl.accountNorm;
    if (dl.io === 'income') {
      data.biz.revenue[i] += dl.amount;
    } else {
      if (!data.biz.categories.includes(acct)) {
        data.biz.categories.push(acct);
        data.biz.expense[acct] = data.months.map(() => 0);
      }
      data.biz.expense[acct][i] += dl.amount;
      if (acct === 'サブスク・通信') {
        const vd = dl.partner || '';
        if (data.subs.vendors.includes(vd)) data.subs.matrix[vd][i] += dl.amount;
        else data.subs.other[i] += dl.amount;
      }
    }
  });
  data.unrecordedExpMonths = data.unrecordedExpMonths.filter((m) => !months.includes(m));
}

/** MF明細を月単位洗い替えで反映し、公私仕分けを再計算する */
export function applyMfTxs(data: Dataset, txs: MfTx[]): void {
  const monthsIn = new Set(txs.map((t) => t.m));
  data.mfTx = data.mfTx.filter((t) => !monthsIn.has(t.m)).concat(txs);
  recomputeClassification(data);
}

/** ルール・手動判定・明細の現状から personal / bizPersonal を再生成する */
export function recomputeClassification(data: Dataset): void {
  const r = applyClassification(data.mfTx, data.rules, data.overrides);
  // mfTxが無い月（JSON復元のみの月）の集計は温存する
  data.personal = { ...data.personal, ...r.personal };
  data.bizPersonal = { ...data.bizPersonal, ...r.bizPersonal };
}

/** HTML版互換の統合JSONを取り込む（初期移行用） */
export function importJSON(data: Dataset, obj: Record<string, unknown>): void {
  if (obj.months) data.months = obj.months as string[];
  if (obj.biz) data.biz = obj.biz as Dataset['biz'];
  if (obj.subs) data.subs = obj.subs as Dataset['subs'];
  if (obj.personal) data.personal = obj.personal as Dataset['personal'];
  if (obj.budgets) data.budgets = obj.budgets as Record<string, number>;
  if (obj.cashOverride) data.cashOverride = obj.cashOverride as Dataset['cashOverride'];
  if (obj.mfTx) data.mfTx = obj.mfTx as MfTx[];
  if (obj.rules) {
    // HTML版のルールは {k, cls}。古い形式 {keyword, cls} も許容
    data.rules = (obj.rules as Array<{ k?: string; keyword?: string; cls: Cls }>).map((r) => ({
      k: r.k ?? r.keyword ?? '',
      cls: r.cls,
    })) as Rule[];
  }
  if (obj.overrides) data.overrides = obj.overrides as Record<string, Cls>;
  if (obj.bizPersonal) data.bizPersonal = obj.bizPersonal as Dataset['bizPersonal'];
  if (obj.unrecordedExpMonths) data.unrecordedExpMonths = [...(obj.unrecordedExpMonths as string[])];
  recomputeClassification(data);
}

/** HTML版互換の統合JSONへ書き出す */
export function exportJSON(data: Dataset): Record<string, unknown> {
  return {
    months: data.months,
    biz: data.biz,
    subs: data.subs,
    personal: data.personal,
    bizPersonal: data.bizPersonal,
    mfTx: data.mfTx,
    rules: data.rules,
    overrides: data.overrides,
    budgets: data.budgets,
    cashOverride: data.cashOverride,
    unrecordedExpMonths: data.unrecordedExpMonths,
    exportedAt: new Date().toISOString(),
  };
}
