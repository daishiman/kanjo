import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  describeUnknownFormat,
  importCountSummary,
  legacyImportCountAliases,
  parseUpload,
  unitFingerprint,
} from './import-pipeline.js';

describe('describeUnknownFormat: 読めないファイルの理由を言葉で返す', () => {
  it('MFの振替ファイル(本番で実際に失敗した形式)を名指しする', () => {
    const r = describeUnknownFormat(['振替日', '振替元口座', '振替先口座', '金額(円)']);
    expect(r).toContain('振替');
    expect(r).toContain('収入・支出詳細');
  });
  it('残高付きの口座明細を名指しする', () => {
    expect(describeUnknownFormat(['日付', '摘要', '残高'])).toContain('口座明細');
  });
  it('freeeの仕訳帳を名指しし、取引エクスポートへ誘導する', () => {
    expect(describeUnknownFormat(['借方勘定科目', '借方金額'])).toContain('仕訳帳');
  });
  it('判定不能なら先頭列を示す(明細の中身は含めない)', () => {
    const r = describeUnknownFormat(['a', 'b', 'c']);
    expect(r).toContain('形式を判定できません');
    expect(r).toContain('a, b, c');
  });
});

describe('Excel取込', () => {
  it('SheetJS公式配布版でMF互換xlsxを解析できる', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['計算対象', '日付', '金額', '大項目', '中項目', '振替', '内容', 'ID', '保有金融機関'],
        ['1', '2026/08/01', '-1200', '日用品', '雑貨', '0', '架空店舗', 'xlsx-1', '架空銀行'],
      ]),
      '収入・支出詳細',
    );
    const bytes = new Uint8Array(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));

    expect(parseUpload('anonymous.xlsx', bytes, {})).toMatchObject([
      {
        kind: 'mf',
        rows: 1,
        txs: [{ id: 'xlsx-1', m: '2026-08', a: -1200, inst: '架空銀行' }],
      },
    ]);
  });
});

describe('MF IDの永続同一性', () => {
  it('cash:で始まるIDを現金記帳との衝突としてファイル単位で拒否する', () => {
    const csv = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,ID',
      '1,2026/08/01,-1200,日用品,雑貨,0,架空店舗,cash:42',
    ].join('\n');
    expect(parseUpload('anonymous.csv', new TextEncoder().encode(csv), {})).toEqual([
      {
        kind: 'error',
        filename: 'anonymous.csv',
        reason: 'IDがcash:で始まる明細があるため取り込めません。現金記帳と衝突しないIDで再出力してください',
      },
    ]);
  });

  it('解析行・ID重複整理後の保存行・集計対象外・保存不能を混同しない', () => {
    const csv = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,ID',
      '0,2026/08/01,-100,架空費,旧値,0,架空旧値,shared-id',
      '1,2026/08/02,-200,架空費,新値,0,架空新値,shared-id',
      '1,2026/08/03,-300,架空費,振替,1,架空振替,transfer-id',
      '1,日付不明,-400,架空費,不正,0,架空不正,rejected-id',
    ].join('\n');
    const [unit] = parseUpload('anonymous-counts.csv', new TextEncoder().encode(csv), {});

    expect(unit).toMatchObject({
      kind: 'mf',
      rows: 3,
      skipped: 1,
      duplicateIds: 1,
    });
    expect(unit && importCountSummary(unit)).toEqual({
      parsed: 3,
      stored: 2,
      countable: 1,
      nonCountable: 1,
      rejected: 1,
    });
    expect(unit && legacyImportCountAliases(unit)).toEqual({ rows: 1, skipped: 3 });
  });
});

describe('MFの資産推移CSV', () => {
  const csv = (...lines: string[]) =>
    new TextEncoder().encode(['日付,合計（円）,預金・現金（円）,投資信託（円）', ...lines].join('\n'));

  it('残高付きの口座明細と間違えず、資産推移として受ける', () => {
    // どちらも「日付」列を持つので、先に口座明細として蹴られると資産推移が一切入らない
    const [unit] = parseUpload('資産推移.csv', csv('2026/08/31,300,100,200'), {});
    expect(unit).toMatchObject({
      kind: 'assets',
      months: ['2026-08'],
      categories: ['預金・現金', '投資信託'],
    });
  });

  it('日次の行を月ごと1点にまとめ、まとめた数を数える', () => {
    const [unit] = parseUpload(
      '資産推移.csv',
      csv('2026/08/28,300,100,200', '2026/08/27,280,80,200', '2026/07/31,240,40,200'),
      {},
    );
    expect(unit).toMatchObject({ kind: 'assets', rows: 3, collapsed: 1, months: ['2026-07', '2026-08'] });
    // 残高は収支ではないので、集計対象は0件。取り込んだ実感は非集計側で見せる
    expect(unit && importCountSummary(unit)).toMatchObject({ countable: 0, nonCountable: 4 });
    expect(unit && legacyImportCountAliases(unit)).toEqual({ rows: 4, skipped: 1 });
  });

  it('合計欄と内訳の和が合わない月を控える', () => {
    // 列が欠けたCSVを黙って取り込むと、資産が実際より少ないBSができる
    const [unit] = parseUpload('資産推移.csv', csv('2026/08/31,999,100,200'), {});
    expect(unit).toMatchObject({ kind: 'assets', totalMismatchMonths: ['2026-08'] });
  });

  it('日次の行が増えても、月末残高が同じなら同じ内容として扱う', async () => {
    const [a] = parseUpload('a.csv', csv('2026/08/31,300,100,200'), {});
    const [b] = parseUpload('b.csv', csv('2026/08/31,300,100,200', '2026/08/30,290,90,200'), {});
    const [c] = parseUpload('c.csv', csv('2026/08/31,500,300,200'), {});
    expect(a && (await unitFingerprint(a))).toBe(b && (await unitFingerprint(b)));
    expect(a && (await unitFingerprint(a))).not.toBe(c && (await unitFingerprint(c)));
  });

  it('日付を1行も読めないCSVは、理由を言って断る', () => {
    expect(parseUpload('資産推移.csv', csv('日付不明,300,100,200'), {})).toEqual([
      {
        kind: 'error',
        filename: '資産推移.csv',
        reason: '資産推移CSVですが、日付を読める行が1行もありません',
      },
    ]);
  });
});
