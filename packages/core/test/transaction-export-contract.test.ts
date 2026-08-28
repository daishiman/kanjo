import { describe, expect, it } from 'vitest';
import { TRANSACTION_EXPORT_HEADER, emptyDataset, toCsv, transactionExportRows } from '../src/index.js';
import type { Dataset, MfTx } from '../src/index.js';

/**
 * 明細CSVの書き出し契約。
 *
 * 集計CSV(matrix.csv)では「この金額はどの明細か」を追えないので明細で出す。
 * 出す値は取込値ではなく解決後の値+その根拠。根拠を落とすと
 * 手で直した行とルールで付いた行が書き出し先で区別できなくなる。
 */

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'x1',
  m: '2026-08',
  d: '08/10',
  c: 'コンビニ',
  a: -1200,
  big: '食費',
  mid: '食料品',
  ...over,
});

const ds = (over: Partial<Dataset> = {}): Dataset => ({ ...emptyDataset(), ...over });

describe('明細CSVの書き出し', () => {
  it('列は解決後の値と、その根拠を必ず含む', () => {
    expect(TRANSACTION_EXPORT_HEADER).toContain('公私の根拠');
    expect(TRANSACTION_EXPORT_HEADER).toContain('科目の根拠');
    expect(TRANSACTION_EXPORT_HEADER).toContain('名義の根拠');
  });

  it('1明細=1行で、列数は見出しと一致する', () => {
    const rows = transactionExportRows(ds({ mfTx: [tx(), tx({ id: 'x2' })] }));
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.length).toBe(TRANSACTION_EXPORT_HEADER.length);
  });

  it('手で直した科目は取込値ではなく直した値が出る', () => {
    const rows = transactionExportRows(
      ds({
        mfTx: [tx()],
        edits: { x1: { big: '接待交際費', baseBig: '食費' } },
      }),
    );
    const h = TRANSACTION_EXPORT_HEADER;
    expect(rows[0][h.indexOf('大項目')]).toBe('接待交際費');
    expect(rows[0][h.indexOf('科目の根拠')]).toBe('手動');
  });

  it('日付昇順で並ぶ(同日は明細IDで固定する)', () => {
    const rows = transactionExportRows(
      ds({
        mfTx: [
          tx({ id: 'b', d: '08/20' }),
          tx({ id: 'a', d: '08/20' }),
          tx({ id: 'c', m: '2026-07', d: '07/01' }),
        ],
      }),
    );
    const h = TRANSACTION_EXPORT_HEADER;
    expect(rows.map((r) => r[h.indexOf('明細ID')])).toEqual(['c', 'a', 'b']);
  });

  it('金額は数値のまま出す(表計算で数値として読ませる)', () => {
    const rows = transactionExportRows(ds({ mfTx: [tx({ a: -1200 })] }));
    expect(rows[0][TRANSACTION_EXPORT_HEADER.indexOf('金額')]).toBe(-1200);
  });

  it('明細が無くても落ちない', () => {
    expect(transactionExportRows(ds())).toEqual([]);
  });
});

describe('CSV化', () => {
  it('カンマ・引用符・改行を含む値を壊さない', () => {
    expect(toCsv([['a,b', 'c"d', 'e\nf']])).toBe('"a,b","c""d","e\nf"');
  });

  it('行区切りはCRLF(Excel互換)', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb');
  });

  it('数字にカンマ区切りを入れない', () => {
    expect(toCsv([[1234567]])).toBe('1234567');
  });
});
