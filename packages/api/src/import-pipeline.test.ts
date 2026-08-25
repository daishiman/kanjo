import { describe, expect, it } from 'vitest';
import { describeUnknownFormat } from './import-pipeline.js';

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
