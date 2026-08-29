import { describe, expect, it } from 'vitest';
import { RECEIPT_ZIP_MAX_FILES, receiptArchivePart, taxYearFromQuery } from './routes/tax.js';

describe('確定申告APIの対象年境界', () => {
  it('YYYYの暦年だけを受け、全期間・直近期間・任意期間をfail-closedにする', () => {
    expect(taxYearFromQuery({ year: '2025' })).toEqual({ ok: true, year: '2025' });

    for (const query of [
      {},
      { year: 'all' },
      { year: '2025', span: '1' },
      { year: '2025', from: '2025-01', to: '2025-12' },
    ]) {
      expect(taxYearFromQuery(query)).toMatchObject({ ok: false, code: 'tax_year_required' });
    }
  });
});

describe('証憑ZIPの安全な分割', () => {
  it('上限超過を無言で切り捨てず、安定したpartへ全件を一度ずつ分ける', () => {
    const rows = Array.from({ length: RECEIPT_ZIP_MAX_FILES * 2 + 1 }, (_, id) => ({ id }));

    const first = receiptArchivePart(rows, 1);
    const second = receiptArchivePart(rows, 2);
    const third = receiptArchivePart(rows, 3);

    expect(first.totalParts).toBe(3);
    expect(first.rows).toHaveLength(RECEIPT_ZIP_MAX_FILES);
    expect(second.rows).toHaveLength(RECEIPT_ZIP_MAX_FILES);
    expect(third.rows).toEqual([{ id: RECEIPT_ZIP_MAX_FILES * 2 }]);
    expect([...first.rows, ...second.rows, ...third.rows]).toEqual(rows);
  });

  it('存在しないpartを空ZIPとして返さず、明示エラーにする', () => {
    expect(() => receiptArchivePart([{ id: 1 }], 0)).toThrow('invalid_receipt_archive_part');
    expect(() => receiptArchivePart([{ id: 1 }], 2)).toThrow('invalid_receipt_archive_part');
  });
});
