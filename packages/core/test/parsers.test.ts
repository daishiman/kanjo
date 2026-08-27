/**
 * パーサ・文字コード判別・月次洗い替えのテスト。
 * 外部ファイルを読まず、このファイル内で生成した架空データだけを使用する。
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCOUNT_NORM,
  applyFreeeDeals,
  applyMfTxs,
  decodeBuf,
  emptyDataset,
  isFreeeHeader,
  isMfHeader,
  normMonth,
  parseAmount,
  parseCSV,
  parseFreeeRows,
  parseMfRows,
} from '../src/index.js';

const freeeCsv = [
  '収支区分,発生日,勘定科目,金額,取引先',
  '収入,2026/07/01,売上高,120000,架空顧客A',
  '支出,2026/07/02,支払手数料,3000,架空SaaS',
  '支出,2026/07/03,通信費,2000,架空ベンダー',
  '支出,,通信費,500,架空の継続行',
].join('\n');

const mfCsv = [
  '計算対象,日付,金額,大項目,中項目,振替,内容,ID',
  '1,2026/07/01,200000,収入,給与,0,架空給与,tx-1',
  '1,2026/07/02,-15000,食費,外食,0,架空店舗,tx-2',
  '0,2026/07/03,-1000,日用品,雑貨,0,計算対象外,tx-3',
  '1,2026/07/04,-2000,振替,口座移動,1,振替対象,tx-4',
  '1,2026/07/05,-5000,日用品,雑貨,0,IDなし,',
].join('\n');

describe('decodeBuf', () => {
  it('UTF-8をそのまま読める', () => {
    expect(decodeBuf(new TextEncoder().encode('計算対象'))).toBe('計算対象');
  });

  it('UTF-8でないShift-JISバイト列へフォールバックする', () => {
    const shiftJis = new Uint8Array([0x8c, 0x76, 0x8e, 0x5a, 0x91, 0xce, 0x8f, 0xdb]);
    expect(decodeBuf(shiftJis)).toBe('計算対象');
  });
});

describe('parseCSV', () => {
  it('引用符・カンマ・改行を扱える', () => {
    expect(parseCSV('a,"b,1","c""x"\r\nd,e,f')).toEqual([
      ['a', 'b,1', 'c"x'],
      ['d', 'e', 'f'],
    ]);
  });

  it('全セル空の行を捨てる', () => {
    expect(parseCSV('a,b\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('normalize', () => {
  it('月と金額を正規化する', () => {
    expect(normMonth('2026/7/1')).toBe('2026-07');
    expect(normMonth('n/a')).toBeNull();
    expect(parseAmount('¥3,300')).toBe(3300);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('freee取込', () => {
  const rows = parseCSV(freeeCsv);
  const parsed = parseFreeeRows(rows, DEFAULT_ACCOUNT_NORM);

  it('ヘッダーを識別し、日付のない行だけを除外する', () => {
    expect(isFreeeHeader(rows[0])).toBe(true);
    expect(isMfHeader(rows[0])).toBe(false);
    expect(parsed.rows).toBe(3);
    expect(parsed.skipped).toBe(1);
  });

  it('科目を正規化し、同じ月を加算せず洗い替える', () => {
    const data = emptyDataset();
    data.subs.vendors = ['架空SaaS'];
    data.subs.matrix['架空SaaS'] = [];

    applyFreeeDeals(data, parsed.deals, parsed.months);
    applyFreeeDeals(data, parsed.deals, parsed.months);

    const monthIndex = data.months.indexOf('2026-07');
    expect(data.biz.revenue[monthIndex]).toBe(120000);
    expect(data.biz.expense['サブスク・通信'][monthIndex]).toBe(5000);
    expect(data.subs.matrix['架空SaaS'][monthIndex]).toBe(3000);
    expect(data.subs.other[monthIndex]).toBe(2000);
  });
});

describe('マネーフォワード取込', () => {
  const rows = parseCSV(mfCsv);
  const parsed = parseMfRows(rows);

  it('計算対象かつ振替でない行だけを取り込む', () => {
    expect(isMfHeader(rows[0])).toBe(true);
    expect(isFreeeHeader(rows[0])).toBe(false);
    expect(parsed.rows).toBe(3);
    expect(parsed.skipped).toBe(2);
  });

  it('ID欠落時に合成キーを使い、同月再取込を置換する', () => {
    expect(parsed.syntheticIds).toBe(1);
    expect(parsed.txs.at(-1)?.id).toBe('2026-07_4_-5000');
    expect(parsed.txs.at(-1)?.idStable).toBe(false);
    expect(parsed.txs[0]?.idStable).toBe(true);

    const data = emptyDataset();
    applyMfTxs(data, parsed.txs);
    applyMfTxs(data, parsed.txs);
    expect(data.mfTx).toHaveLength(3);
  });

  it('現金記帳用のcash名前空間と衝突するMF IDを検出する', () => {
    const collision = parseMfRows(
      parseCSV(
        [
          '計算対象,日付,金額,大項目,中項目,振替,内容,ID',
          '1,2026/07/06,-1000,交通費,電車,0,架空交通費,cash:1',
        ].join('\n'),
      ),
    );
    expect(collision.reservedIds).toBe(1);
  });
});
