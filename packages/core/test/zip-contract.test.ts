/**
 * 証憑まとめ書き出し(ZIP)の契約。
 *
 * ZIP は自前で組み立てている(core を依存ゼロに保つため + Worker で1件ずつ流すため)。
 * 壊れた ZIP は「保存したつもりで開けない」という最悪の失敗なので、
 * バイト境界とフラグをここで固定する。
 */
import { describe, expect, it } from 'vitest';
import { buildZip, crc32, sanitizeZipName, zipCentralDirectory, zipLocalHeader } from '../src/index.js';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const u32 = (b: Uint8Array, at: number): number =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, true);
const u16 = (b: Uint8Array, at: number): number =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(at, true);

describe('crc32', () => {
  it('既知の値と一致する', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('ZIPの構造', () => {
  it('local headerは署名・CRC・サイズをそのまま持つ(格納法・圧縮なし)', () => {
    const data = bytes('領収書');
    const header = zipLocalHeader({ name: 'a.txt', crc: crc32(data), size: data.length, offset: 0 });

    expect(u32(header, 0)).toBe(0x04034b50);
    expect(u16(header, 8)).toBe(0); // 圧縮方式 = store
    expect(u32(header, 14)).toBe(crc32(data));
    expect(u32(header, 18)).toBe(data.length);
    expect(u32(header, 22)).toBe(data.length);
  });

  it('日本語ファイル名のためUTF-8フラグ(bit 11)を立てる', () => {
    const header = zipLocalHeader({ name: '索引.csv', crc: 0, size: 0, offset: 0 });
    expect(u16(header, 6) & 0x0800).toBe(0x0800);
  });

  it('central directoryはEOCDで終わり、件数が一致する', () => {
    const a = bytes('a');
    const b = bytes('bb');
    const metas = [
      { name: 'a.txt', crc: crc32(a), size: a.length, offset: 0 },
      { name: 'b.txt', crc: crc32(b), size: b.length, offset: 100 },
    ];
    const central = zipCentralDirectory(metas);

    expect(u32(central, 0)).toBe(0x02014b50);
    const eocd = central.length - 22;
    expect(u32(central, eocd)).toBe(0x06054b50);
    expect(u16(central, eocd + 8)).toBe(2);
    expect(u16(central, eocd + 10)).toBe(2);
  });

  it('buildZipはlocal headerのoffsetを積み上げ、EOCDまで通しで作る', () => {
    const zip = buildZip([
      { name: '索引.csv', data: bytes('取引年月日,取引金額,取引先') },
      { name: '2025-01/領収書.pdf', data: bytes('%PDF-') },
    ]);

    expect(u32(zip, 0)).toBe(0x04034b50);
    expect(u32(zip, zip.length - 22)).toBe(0x06054b50);
    expect(u16(zip, zip.length - 14)).toBe(2);
  });
});

describe('sanitizeZipName', () => {
  it('パス区切りを潰し、展開先を親へ逃がさない', () => {
    expect(sanitizeZipName('../../etc/passwd')).not.toContain('/');
    expect(sanitizeZipName('../../etc/passwd').startsWith('.')).toBe(false);
    expect(sanitizeZipName('a/b.txt')).toBe('a_b.txt');
  });

  it('日本語はそのまま残す(索引CSVと突き合わせるため)', () => {
    expect(sanitizeZipName('2025-01-05_コンビニ_1200円.jpg')).toBe('2025-01-05_コンビニ_1200円.jpg');
  });

  it('空になる名前でも空文字を返さない', () => {
    expect(sanitizeZipName('///').length).toBeGreaterThan(0);
  });
});
