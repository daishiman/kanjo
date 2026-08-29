/**
 * 自前で組み立てた ZIP が、実際に展開できることの確認。
 *
 * core/zip.ts は依存ゼロで書いている(core に依存を持ち込まない・Worker で1件ずつ流すため)。
 * バイト単位のテストだけだと「仕様どおりに間違えている」を見逃すので、
 * ここでは別実装(fflate)に展開させて往復させる。証憑の書き出しは、
 * 壊れていても税務調査の当日まで気づけない種類の失敗なので、実物で確かめる。
 */
import { RECEIPT_INDEX_HEADER, buildZip, receiptZipPath, sanitizeZipName, toCsv } from '@kanjo/core';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('証憑ZIPの往復', () => {
  it('日本語のファイル名と中身が、別実装で展開しても壊れない', () => {
    const indexCsv = `﻿${toCsv([[...RECEIPT_INDEX_HEADER], ['2025-01-05', 1200, 'コンビニ']])}`;
    const receipt = encoder.encode('%PDF-1.7 領収書の中身');
    const path = receiptZipPath({
      txId: 'mf-1',
      date: '2025-01-05',
      amount: 1200,
      partner: 'コンビニ',
      account: '消耗品費',
      paymentMethod: 'cash',
      seq: 1,
      ext: 'pdf',
      createdAt: '2025-02-01T10:00:00.000Z',
    });

    const zip = buildZip([
      { name: '索引.csv', data: encoder.encode(indexCsv) },
      { name: path.split('/').map(sanitizeZipName).join('/'), data: receipt },
    ]);

    const unzipped = unzipSync(zip);
    expect(Object.keys(unzipped).sort()).toEqual(['索引.csv', path].sort());
    // Excel が文字化けしないよう BOM を付けている。バイトで比べる(decode は BOM を落とす)
    expect(unzipped['索引.csv']).toEqual(encoder.encode(indexCsv));
    expect(unzipped[path]).toEqual(receipt);
  });

  it('件数が多くても、順番と中身が入れ替わらない', () => {
    const files = Array.from({ length: 120 }, (_, i) => ({
      name: `2025-${String((i % 12) + 1).padStart(2, '0')}/領収書_${i}.txt`,
      data: encoder.encode(`receipt-${i}`),
    }));

    const unzipped = unzipSync(buildZip(files));
    expect(Object.keys(unzipped)).toHaveLength(files.length);
    for (const f of files) expect(decoder.decode(unzipped[f.name])).toBe(decoder.decode(f.data));
  });

  it('空のZIP(対象0件)でも展開できる', () => {
    expect(Object.keys(unzipSync(buildZip([])))).toEqual([]);
  });
});
