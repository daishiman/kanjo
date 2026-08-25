/**
 * 取込の内容指紋(正規化文字列)の契約テスト。
 * ファイル名・行順・空白が違っても同じ内容なら一致し、金額や行数が違えば一致しない。
 */
import { describe, expect, it } from 'vitest';
import {
  type FreeeDeal,
  type MfTx,
  canonicalFreee,
  canonicalMf,
  parseCSV,
  parseFreeeRows,
  parseMfRows,
} from '../src/index.js';

const freeeCsv = (rows: string[]) => ['収支区分,発生日,勘定科目,金額,取引先', ...rows].join('\n');
const r1 = '収入,2026/07/01,売上高,120000,架空顧客A';
const r2 = '支出,2026/07/02,支払手数料,3000,架空SaaS';

describe('canonicalFreee', () => {
  it('行の並び順・前後の空白が違っても同じ', () => {
    const a = parseFreeeRows(parseCSV(freeeCsv([r1, r2])), {}).deals;
    const b = parseFreeeRows(parseCSV(freeeCsv([r2, `${r1} `])), {}).deals;
    expect(canonicalFreee(a)).toBe(canonicalFreee(b));
  });
  it('金額が1円違えば別、行が1つ多くても別', () => {
    const base = parseFreeeRows(parseCSV(freeeCsv([r1, r2])), {}).deals;
    const amt = parseFreeeRows(parseCSV(freeeCsv([r1, r2.replace('3000', '3001')])), {}).deals;
    const more = parseFreeeRows(parseCSV(freeeCsv([r1, r2, r2])), {}).deals;
    expect(canonicalFreee(amt)).not.toBe(canonicalFreee(base));
    expect(canonicalFreee(more)).not.toBe(canonicalFreee(base));
  });
  it('科目の正規化対応表が違っても内容指紋は同じ(取込値だけを見る)', () => {
    const rows = parseCSV(freeeCsv([r1, r2]));
    const a = parseFreeeRows(rows, {}).deals;
    const b = parseFreeeRows(rows, { 支払手数料: 'サブスク・通信' }).deals;
    expect(canonicalFreee(a)).toBe(canonicalFreee(b));
  });
});

describe('canonicalMf', () => {
  const header = '計算対象,日付,金額,大項目,中項目,振替,内容,ID';
  const m1 = '1,2026/07/01,-800,食費,食料品,0,架空スーパー,ID001';
  const m2 = '1,2026/07/02,-1200,食費,外食,0,架空食堂,ID002';
  const parse = (rows: string[]): MfTx[] => parseMfRows(parseCSV([header, ...rows].join('\n'))).txs;

  it('行の並び順が違っても同じ', () => {
    expect(canonicalMf(parse([m1, m2]))).toBe(canonicalMf(parse([m2, m1])));
  });
  it('金額・件数が違えば別', () => {
    expect(canonicalMf(parse([m1, m2.replace('-1200', '-1300')]))).not.toBe(canonicalMf(parse([m1, m2])));
    expect(canonicalMf(parse([m1]))).not.toBe(canonicalMf(parse([m1, m2])));
  });
  it('freee と MF は同じ行でも別系統として区別する', () => {
    const d: FreeeDeal[] = [];
    expect(canonicalFreee(d)).not.toBe(canonicalMf([]));
  });
});
