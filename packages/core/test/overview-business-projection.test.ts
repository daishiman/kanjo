import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  emptyDataset,
  overviewAggregate,
  overviewScopeMonths,
  totalCashflowReport,
} from '../src/index.js';

const mf = (values: Partial<MfTx> = {}): MfTx => ({
  id: 'synthetic-business-payment',
  idStable: true,
  m: '2026-06',
  d: '06/12',
  c: '架空通信サービス',
  a: -4_200,
  big: '通信費',
  mid: '利用料',
  inst: '架空銀行',
  isTarget: true,
  isTransfer: false,
  ...values,
});
const deal = (values: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-06',
  date: '2026-06-12',
  io: 'expense',
  partner: '架空通信サービス',
  accountRaw: '通信費',
  accountNorm: '通信費',
  amount: 4_200,
  ...values,
});
function dataset(txs: MfTx[]): Dataset {
  const data = emptyDataset();
  data.months = ['2026-06'];
  data.biz.revenue = [0];
  data.mfTx = txs;
  for (const tx of txs) data.edits[tx.id] = { cls: 'biz', big: '通信費', owner: 'spouse' };
  return data;
}
function business(
  data: Dataset,
  deals: FreeeDeal[] = [],
  verdicts: Parameters<typeof totalCashflowReport>[2] = [],
) {
  const report = totalCashflowReport(data, deals, verdicts);
  return overviewAggregate(
    overviewScopeMonths('business', {
      data,
      totalMonths: report.months,
      totalLedger: report.ledger,
    }),
    null,
  );
}

describe('概要の事業範囲は仕分け済みMFも表示する', () => {
  it('freeeがなくても手動で事業にした支出・収入をKPI・推移・内訳・比較へ含める', () => {
    const data = dataset([mf(), mf({ id: 'synthetic-income', a: 25_000, d: '06/20' })]);
    const value = business(data);
    expect(value.kpi).toMatchObject({ income: 25_000, expense: 4_200, balance: 20_800 });
    expect(value.trend).toEqual([{ month: '2026-06', income: 25_000, expense: 4_200, balance: 20_800 }]);
    expect(value.breakdown).toMatchObject({ total: 4_200, items: [{ label: '通信費', amount: 4_200 }] });
    expect(value.yearComparison.rows.find((row) => row.key === 'expense')?.current).toBe(4_200);
  });

  it('freeeと同じ明細はMFから追加せず、異なると判断した明細だけを追加する', () => {
    const data = dataset([mf()]);
    data.biz.categories = ['通信費'];
    data.biz.expense = { 通信費: [4_200] };
    expect(business(data, [deal()]).kpi.expense).toBe(4_200);
    expect(business(data, [deal()], [{ txId: mf().id, verdict: 'different' }]).kpi.expense).toBe(8_400);
  });

  it('要確認・振替・計算対象外・分割投影は総収支と同じ選別で追加しない', () => {
    const data = dataset([
      mf(),
      mf({ id: 'transfer', a: -8_000, isTransfer: true }),
      mf({ id: 'not-target', a: -9_000, isTarget: false }),
      mf({
        id: 'split',
        a: -1_000,
        splitProjection: {
          kind: 'split',
          parentTxId: 'parent',
          lineId: 'line',
          seq: 0,
          lineCount: 2,
          parentAmount: 2_000,
        },
      }),
    ]);
    expect(business(data, [deal({ date: '2026-06-13' })]).kpi.expense).toBe(0);
  });

  it('既存の帳簿・事業現金・JSON復元baselineの系列を落とさず、現金を再加算しない', () => {
    const data = dataset([mf(), mf({ id: 'cash:9', a: -700 })]);
    data.biz.categories = ['帳簿科目', '現金科目', '復元科目'];
    data.biz.expense = { 帳簿科目: [6_000], 現金科目: [700], 復元科目: [800] };
    data.biz.revenue = [12_000];
    const value = business(data);
    expect(value.kpi).toMatchObject({ income: 12_000, expense: 11_700, balance: 300 });
    expect(value.breakdown.total).toBe(11_700);
  });

  it('家計から事業へ分類を変えると次の読出しで事業へ移り、総合は増えない', () => {
    const data = dataset([mf()]);
    data.edits[mf().id] = { cls: 'per' };
    expect(business(data).kpi.expense).toBe(0);
    const before = totalCashflowReport(data).months[0]?.totalExpense;
    data.edits[mf().id] = { cls: 'biz', big: '通信費' };
    expect(business(data).kpi.expense).toBe(4_200);
    expect(totalCashflowReport(data).months[0]?.totalExpense).toBe(before);
  });
});
