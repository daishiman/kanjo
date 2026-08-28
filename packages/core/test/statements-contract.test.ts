/**
 * 決算書(PL・キャッシュフロー)の契約。
 *
 * 守りたいのは3つ:
 *   - PLの縦の足し算が合う(科目 → グループ → 経費計 → 利益)
 *   - キャッシュフローが「利益と現金は違う」を表現できている
 *   - 作れないもの(BS)を黙って0円にしない
 * データは架空のものだけを使う。
 */
import { describe, expect, it } from 'vitest';
import { applyFreeeDeals } from '../src/dataset.js';
import {
  BALANCE_SHEET_SOURCES,
  PL_GROUP_ORDER,
  cashFlow,
  plGroupOf,
  profitAndLoss,
  runwayMonths,
} from '../src/statements.js';
import { type FreeeDeal, emptyDataset } from '../src/types.js';

const deal = (p: Partial<FreeeDeal>): FreeeDeal => ({
  month: '2026-01',
  date: '2026-01-10',
  io: 'expense',
  partner: '架空商店',
  accountRaw: '外注費',
  accountNorm: '外注費',
  amount: 10000,
  ...p,
});

/** 架空の仕訳から Dataset を作る(実データは使わない) */
const build = (deals: FreeeDeal[]) => {
  const data = emptyDataset();
  applyFreeeDeals(data, deals, [...new Set(deals.map((d) => d.month))].sort());
  return data;
};

describe('損益計算書', () => {
  const deals = [
    deal({ month: '2026-01', io: 'income', accountRaw: '売上高', accountNorm: '売上高', amount: 500000 }),
    deal({ month: '2026-02', io: 'income', accountRaw: '売上高', accountNorm: '売上高', amount: 300000 }),
    deal({ month: '2026-01', accountRaw: '外注費', accountNorm: '外注費', amount: 120000 }),
    deal({ month: '2026-02', accountRaw: '外注費', accountNorm: '外注費', amount: 80000 }),
    deal({ month: '2026-01', accountRaw: '地代家賃', accountNorm: '地代家賃', amount: 60000 }),
  ];

  it('売上 − 経費 = 利益が、月別でも合計でも一致する', () => {
    const pl = profitAndLoss(build(deals));
    pl.months.forEach((_, i) => {
      expect(pl.profit.monthly[i]).toBe(pl.revenue.monthly[i] - pl.expense.monthly[i]);
    });
    expect(pl.profit.total).toBe(pl.revenue.total - pl.expense.total);
    expect(pl.revenue.total).toBe(800000);
    expect(pl.expense.total).toBe(260000);
  });

  it('グループの合計は中の科目の合計と一致し、全グループを足すと経費計になる', () => {
    const pl = profitAndLoss(build(deals));
    for (const g of pl.groups) {
      expect(g.total).toBe(g.rows.reduce((s, r) => s + r.total, 0));
    }
    expect(pl.groups.reduce((s, g) => s + g.total, 0)).toBe(pl.expense.total);
  });

  it('グループの並びは科目を選ぶときと同じ分類を使い、未知の科目だけ「その他」に落ちる', () => {
    // 決算書用に別の分類を作ると、記帳画面で入れた科目が決算書で行方不明になる
    expect(PL_GROUP_ORDER[PL_GROUP_ORDER.length - 1]).toBe('その他');
    expect(plGroupOf('架空の新科目')).toBe('その他');
    const pl = profitAndLoss(build(deals));
    const order = pl.groups.map((g) => PL_GROUP_ORDER.indexOf(g.group));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('金額が0の科目は行に出さない(眺める行数を増やさない)', () => {
    const pl = profitAndLoss(build(deals));
    for (const g of pl.groups) for (const r of g.rows) expect(r.total).not.toBe(0);
  });

  it('売上が0なら利益率は null(0除算で Infinity を出さない)', () => {
    const pl = profitAndLoss(build([deal({ amount: 1000 })]));
    expect(pl.profitRate).toBeNull();
  });

  it('この表に入っていないものを必ず添える', () => {
    // 減価償却が入っていないことに気づかないまま利益を見ると、確定申告の数字と食い違う
    expect(profitAndLoss(build(deals)).limits.length).toBeGreaterThan(0);
  });
});

describe('キャッシュフロー', () => {
  const settled = { dueDate: null, settledDate: '2026-01-31', settleAccount: null, settledAmount: null };
  const unsettled = { dueDate: '2026-02-28', settledDate: null, settleAccount: null, settledAmount: null };

  it('入金待ちの売上ぶんだけ、営業CFは利益より小さくなる', () => {
    const deals = [
      deal({ io: 'income', accountRaw: '売上高', accountNorm: '売上高', amount: 500000, ...unsettled }),
      deal({ amount: 100000, ...settled }),
    ];
    const cf = cashFlow(build(deals), deals);
    expect(cf.months).toHaveLength(1);
    const m = cf.months[0];
    expect(m.profit).toBe(400000);
    expect(m.receivableIncrease).toBe(500000);
    expect(m.operating).toBe(-100000);
    expect(cf.settlementUnknown).toBe(false);
  });

  it('支払待ちの経費ぶんは足し戻す(まだ現金が出ていない)', () => {
    const deals = [
      deal({ io: 'income', accountRaw: '売上高', accountNorm: '売上高', amount: 500000, ...settled }),
      deal({ amount: 100000, ...unsettled }),
    ];
    const cf = cashFlow(build(deals), deals);
    expect(cf.months[0].payableIncrease).toBe(100000);
    expect(cf.months[0].operating).toBe(500000);
  });

  it('累計は各月の営業CFを足し上げたもので、最後が合計と一致する', () => {
    const deals = [
      deal({
        month: '2026-01',
        io: 'income',
        accountRaw: '売上高',
        accountNorm: '売上高',
        amount: 300000,
        ...settled,
      }),
      deal({ month: '2026-01', amount: 100000, ...settled }),
      deal({
        month: '2026-02',
        io: 'income',
        accountRaw: '売上高',
        accountNorm: '売上高',
        amount: 200000,
        ...settled,
      }),
      deal({ month: '2026-02', amount: 50000, ...settled }),
    ];
    const cf = cashFlow(build(deals), deals);
    expect(cf.cumulative).toEqual([200000, 350000]);
    expect(cf.total).toBe(350000);
  });

  it('決済列の無い取込は「ズレが不明」と分かるようにする(全件決済済みと決めつけない)', () => {
    const deals = [deal({ io: 'income', accountRaw: '売上高', accountNorm: '売上高', amount: 100000 })];
    expect(cashFlow(build(deals), deals).settlementUnknown).toBe(true);
  });
});

describe('貸借対照表', () => {
  it('作れない代わりに、何を取り込めば作れるかを持っている', () => {
    // 空欄を出すと「バグで出ていない」に見える。取るべきCSVを示すほうが次に進める
    expect(BALANCE_SHEET_SOURCES.length).toBeGreaterThan(0);
    for (const s of BALANCE_SHEET_SOURCES) {
      expect(s.where).not.toBe('');
      expect(s.columns.length).toBeGreaterThan(0);
      expect(['freee', 'MF']).toContain(s.service);
    }
  });

  it('取る順番が1から抜けなく振ってあり、並び順と一致する', () => {
    // 番号が飛ぶと「2番が見つからない」で止まる。並びと番号がずれても同じ
    expect(BALANCE_SHEET_SOURCES.map((s) => s.step)).toEqual(BALANCE_SHEET_SOURCES.map((_, i) => i + 1));
  });

  it('最初に取るのは銀行口座の残高(MF)', () => {
    // 全口座がMFに連携済みなら、1ファイルで現預金がそろう。ここだけで手元資金は見える
    const first = BALANCE_SHEET_SOURCES[0];
    expect(first.service).toBe('MF');
    expect(first.columns).toContain('残高');
  });

  it('プラン制限や列の欠けで詰まる手順には、代わりの手を書いておく', () => {
    // 「CSVが出せない」で止まったとき、次にどうするかが同じ行に無いと進めない
    const withNote = BALANCE_SHEET_SOURCES.filter((s) => s.note);
    expect(withNote.length).toBeGreaterThanOrEqual(3);
  });

  it('ランウェイは固定費が0なら null(割れない数字を0ヶ月と言わない)', () => {
    expect(runwayMonths(3000000, 500000)).toBe(6);
    expect(runwayMonths(3000000, 0)).toBeNull();
  });
});
