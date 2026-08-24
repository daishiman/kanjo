/**
 * パーサ・文字コード判別・取込洗い替えのテスト（合成フィクスチャのみ使用）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCOUNT_NORM,
  DEFAULT_SUB_VENDORS,
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

const here = dirname(fileURLToPath(import.meta.url));
const raw = (name: string) => readFileSync(join(here, 'fixtures', name));

describe('decodeBuf: UTF-8 fatal → Shift-JIS フォールバック', () => {
  it('UTF-8をそのまま読める', () => {
    const t = decodeBuf(raw('mf-synth-utf8.csv'));
    expect(t).toContain('計算対象');
  });
  it('Shift-JISを自動判別して読める', () => {
    const t = decodeBuf(raw('mf-synth-sjis.csv'));
    expect(t).toContain('計算対象');
    expect(t).toContain('給与振込');
  });
});

describe('parseCSV', () => {
  it('引用符・カンマ・改行を扱える', () => {
    expect(parseCSV('a,"b,1","c""x"\r\nd,e,f')).toEqual([
      ['a', 'b,1', 'c"x'],
      ['d', 'e', 'f'],
    ]);
  });
  it('全セル空の行は捨てる', () => {
    expect(parseCSV('a,b\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('normalize', () => {
  it('normMonth', () => {
    expect(normMonth('2026/7/1')).toBe('2026-07');
    expect(normMonth('2026-12-31')).toBe('2026-12');
    expect(normMonth('n/a')).toBeNull();
  });
  it('parseAmount はカンマ・円記号を除去', () => {
    expect(parseAmount('110,000')).toBe(110000);
    expect(parseAmount('¥3,300')).toBe(3300);
    expect(parseAmount('-6,524')).toBe(-6524);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('freee取込', () => {
  const rows = parseCSV(decodeBuf(raw('freee-synth.csv')));
  it('ヘッダー判定: 収支区分 → freee', () => {
    expect(isFreeeHeader(rows[0])).toBe(true);
    expect(isMfHeader(rows[0])).toBe(false);
  });
  const parsed = parseFreeeRows(rows, DEFAULT_ACCOUNT_NORM);
  it('発生日の無い継続行はスキップ', () => {
    expect(parsed.skipped).toBe(1);
    expect(parsed.rows).toBe(6); // 有効仕訳行数（継続行を除く）
  });
  it('科目正規化: 支払手数料/通信費 → サブスク・通信', () => {
    const accts = new Set(parsed.deals.map((d) => d.accountNorm));
    expect(accts.has('サブスク・通信')).toBe(true);
    expect(accts.has('支払手数料')).toBe(false);
  });
  it('月次洗い替えでデータセットへ反映（売上・科目・ベンダー行列）', () => {
    const data = emptyDataset();
    data.subs.vendors = [...DEFAULT_SUB_VENDORS];
    DEFAULT_SUB_VENDORS.forEach((v) => {
      data.subs.matrix[v] = [];
    });
    applyFreeeDeals(data, parsed.deals, parsed.months);
    expect(data.months).toEqual(['2026-06', '2026-07']);
    const i7 = data.months.indexOf('2026-07');
    expect(data.biz.revenue[i7]).toBe(165000); // 110,000 + 55,000
    expect(data.biz.expense['サブスク・通信'][i7]).toBe(29004 + 3300);
    expect(data.subs.matrix.Anthropic[i7]).toBe(29004); // 既知ベンダー
    expect(data.subs.other[i7]).toBe(3300); // 未知ベンダー
    expect(data.biz.expense['新聞図書費'][i7]).toBe(5980);
    // 同月再取込 → 加算ではなく置換
    applyFreeeDeals(data, parsed.deals, parsed.months);
    expect(data.biz.revenue[data.months.indexOf('2026-07')]).toBe(165000);
  });
  it('取り込んだ月は未記帳月から解除される', () => {
    const data = emptyDataset();
    data.unrecordedExpMonths = ['2026-07', '2026-08'];
    applyFreeeDeals(data, parsed.deals, parsed.months);
    expect(data.unrecordedExpMonths).toEqual(['2026-08']);
  });
});

describe('MF取込', () => {
  const rows = parseCSV(decodeBuf(raw('mf-synth-sjis.csv')));
  it('ヘッダー判定: 計算対象 → MF', () => {
    expect(isMfHeader(rows[0])).toBe(true);
    expect(isFreeeHeader(rows[0])).toBe(false);
  });
  const parsed = parseMfRows(rows);
  it('計算対象=1 かつ 振替≠1 のみ有効化', () => {
    expect(parsed.rows).toBe(5);
    expect(parsed.skipped).toBe(2);
  });
  it('ID欠落行は合成キー（月_行_金額）', () => {
    const synth = parsed.txs.find((t) => t.c === 'ID無し行');
    expect(synth?.id).toBe('2026-07_5_-1200');
    expect(parsed.syntheticIds).toBe(1);
  });
  it('月次洗い替え: 同月は置換される', () => {
    const data = emptyDataset();
    applyMfTxs(data, parsed.txs);
    expect(data.mfTx.length).toBe(5);
    applyMfTxs(data, parsed.txs);
    expect(data.mfTx.length).toBe(5);
  });
});
