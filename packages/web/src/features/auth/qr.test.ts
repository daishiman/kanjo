import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodeQr, qrPath } from './qr.js';

// 期待値は Python の segno 1.6.6 (error='m', mode='byte') で作った行列。
// segno は終端のあと境界に揃っていても 0 を 8 ビット足すため、その1点だけ規格 7.4.10 どおりに差し替えて出した。
const rowsOf = (text: string, mask?: number) =>
  encodeQr(text, mask).modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));
const fingerprint = (rows: string[]) => createHash('sha256').update(rows.join('\n')).digest('hex');

const OTPAUTH =
  'otpauth://totp/Focus%20Ledger:user%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Focus%20Ledger&digits=6&period=30';

describe('encodeQr', () => {
  it('型番 1 の行列が segno と1モジュール単位で一致する', () => {
    expect(rowsOf('hello')).toEqual([
      '111111100110001111111',
      '100000100110001000001',
      '101110100100101011101',
      '101110100011001011101',
      '101110100110101011101',
      '100000101001101000001',
      '111111101010101111111',
      '000000000001100000000',
      '100101101100010100000',
      '001011000010001000011',
      '000110111100110001101',
      '111011001001000001011',
      '011010110010101010000',
      '000000001101000110101',
      '111111100010010101110',
      '100000101011110110000',
      '101110100001001110001',
      '101110101101000101111',
      '101110100110100010101',
      '100000100110011000000',
      '111111101111100101010',
    ]);
    expect(encodeQr('hello')).toMatchObject({ version: 1, mask: 7, size: 21 });
  });

  it('otpauth URI は型番 8・マスク 2 になり、行列が segno と一致する', () => {
    const matrix = encodeQr(OTPAUTH);
    expect(matrix).toMatchObject({ version: 8, mask: 2, size: 49 });
    expect(fingerprint(rowsOf(OTPAUTH))).toBe(
      'ce54c62c59ecdd909e4219ca646a6d1e449bf34047047a2b0e7f5e55ee8c3ddd',
    );
  });

  it('複数ブロックに分かれる長さ (型番 13) でもインターリーブが segno と一致する', () => {
    const text = 'x'.repeat(300);
    expect(encodeQr(text)).toMatchObject({ version: 13, mask: 0 });
    expect(fingerprint(rowsOf(text))).toBe(
      'a6c4c99a50e77d18b6ddfdcbd85fffbd3b4da81e4eabc96b030a3f559d2b7fbb',
    );
  });

  it('型番 40 に収まらない長さは例外にする', () => {
    expect(() => encodeQr('x'.repeat(2400))).toThrow(RangeError);
  });

  it('path は暗いモジュールの数だけ正方形を並べ、quiet zone の分だけずらす', () => {
    const matrix = encodeQr('hello');
    const dark = matrix.modules.flat().filter(Boolean).length;
    const path = qrPath(matrix, 4);
    expect(path.match(/M/g)).toHaveLength(dark);
    expect(path.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});
