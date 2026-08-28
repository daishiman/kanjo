/**
 * 現金の記帳の契約テスト。
 * - 事業分は freee 仕訳と同じ経路で科目別集計に合流し、freee の再取込(月単位洗い替え)後も残る
 * - 個人分は口座「現金」の MF 明細として仕分けに合流し、MF の再取込後も残る
 * 架空データのみを使用する。
 */
import { describe, expect, it } from 'vitest';
import {
  CASH_INSTITUTION,
  type CashEntry,
  type FreeeDeal,
  TRANSIT_CATEGORY,
  TRANSIT_SAME_ACCOUNT_NOTE,
  applyFreeeDeals,
  applyMfTxs,
  cashBizDeals,
  cashToTx,
  emptyDataset,
  exportJSON,
  isCashTxId,
  shouldSwitchToTransit,
} from '../src/index.js';

const meeting: CashEntry = {
  id: 7,
  date: '2026-07-15',
  month: '2026-07',
  side: 'biz',
  io: 'expense',
  amount: 5000,
  description: '架空商工会議所 定例会',
  categoryMajor: '会議費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
};
const lunch: CashEntry = {
  id: 8,
  date: '2026-07-20',
  month: '2026-07',
  side: 'per',
  io: 'expense',
  amount: 1200,
  description: '架空食堂',
  categoryMajor: '食費',
  categoryMid: '外食',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
};

const fileDeals: FreeeDeal[] = [
  {
    month: '2026-07',
    date: '2026-07-01',
    io: 'income',
    partner: '架空顧客',
    accountRaw: '売上高',
    accountNorm: '売上高',
    amount: 100000,
  },
  {
    month: '2026-07',
    date: '2026-07-02',
    io: 'expense',
    partner: '架空ベンダー',
    accountRaw: '通信費',
    accountNorm: 'サブスク・通信',
    amount: 3000,
  },
];

describe('事業分の現金明細', () => {
  it('freee 仕訳と同じ経路で科目別集計に合流し、科目の正規化も同じ対応表を使う', () => {
    const data = emptyDataset();
    const deals = cashBizDeals([meeting, lunch], { 会議費: '会議費' });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ month: '2026-07', io: 'expense', accountNorm: '会議費', amount: 5000 });
    applyFreeeDeals(data, [...fileDeals, ...deals], ['2026-07']);
    const i = data.months.indexOf('2026-07');
    expect(data.biz.expense['会議費'][i]).toBe(5000);
    expect(data.biz.revenue[i]).toBe(100000);
  });

  it('月を絞ると対象月の分だけ返し、freee 再取込時に一緒に流し込めば消えない', () => {
    const data = emptyDataset();
    applyFreeeDeals(data, [...fileDeals, ...cashBizDeals([meeting], {})], ['2026-07']);
    // 同じ月のファイルを取り込み直す(洗い替え)。現金明細を一緒に渡す
    applyFreeeDeals(data, [...fileDeals, ...cashBizDeals([meeting], {}, ['2026-07'])], ['2026-07']);
    const i = data.months.indexOf('2026-07');
    expect(data.biz.expense['会議費'][i]).toBe(5000);
    expect(data.biz.expense['サブスク・通信'][i]).toBe(3000);
    expect(cashBizDeals([meeting], {}, ['2026-08'])).toHaveLength(0);
  });
});

describe('個人分の現金明細', () => {
  it('口座「現金」の MF 明細になり、支出は負の金額になる', () => {
    const tx = cashToTx(lunch);
    expect(tx).toEqual({
      id: 'cash:8',
      m: '2026-07',
      d: '07/20',
      c: '架空食堂',
      a: -1200,
      big: '食費',
      mid: '外食',
      inst: CASH_INSTITUTION,
    });
    expect(isCashTxId(tx.id)).toBe(true);
    expect(cashToTx({ ...lunch, io: 'income' }).a).toBe(1200);
  });

  it('MF の同じ月を再取込(洗い替え)しても残り、家計の集計に入る', () => {
    const data = emptyDataset();
    data.mfTx = [cashToTx(lunch)];
    applyMfTxs(data, [
      { id: 'A1', m: '2026-07', d: '07/01', c: '架空スーパー', a: -800, big: '食費', mid: '食料品' },
    ]);
    expect(data.mfTx.map((t) => t.id).sort()).toEqual(['A1', 'cash:8']);
    expect(data.personal['2026-07'].expense['食費']).toBe(2000);
  });

  it('統合JSONの写しには含めない(cash_entries が正本)', () => {
    const data = emptyDataset();
    data.mfTx = [cashToTx(lunch), { id: 'A1', m: '2026-07', d: '07/01', c: 'x', a: -1, big: '', mid: '' }];
    const out = exportJSON(data) as { mfTx: { id: string }[] };
    expect(out.mfTx.map((t) => t.id)).toEqual(['A1']);
  });
});

/**
 * 「通常の記帳」と「交通費(電車代)」は同じ現金明細・同じ科目に入る。
 * 違うのは入力の作法だけで、集計上は1つの旅費交通費になる。
 */
describe('交通費の入力への切り替え', () => {
  it('まだ何も入れていなければ、交通費の科目を選んだ時点で切り替える', () => {
    expect(shouldSwitchToTransit(TRANSIT_CATEGORY, { description: '', amount: 0 })).toBe(true);
    expect(shouldSwitchToTransit(' 旅費交通費 ', { description: '', amount: 0 })).toBe(true);
  });

  it('入力済みの内容や金額は勝手に捨てない', () => {
    // 切り替えると区間からの組み立てに変わり、入れた内容と金額が消える
    expect(shouldSwitchToTransit(TRANSIT_CATEGORY, { description: '高速代', amount: 0 })).toBe(false);
    expect(shouldSwitchToTransit(TRANSIT_CATEGORY, { description: '', amount: 800 })).toBe(false);
  });

  it('交通費以外の科目では切り替えない', () => {
    expect(shouldSwitchToTransit('会議費', { description: '', amount: 0 })).toBe(false);
    expect(shouldSwitchToTransit('', { description: '', amount: 0 })).toBe(false);
  });

  it('2つの入力方法が同じ科目に入ることを画面に出せる', () => {
    expect(TRANSIT_SAME_ACCOUNT_NOTE).toContain(TRANSIT_CATEGORY);
  });
});
