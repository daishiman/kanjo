/**
 * 失敗した取込単位 → 投入した元ファイルの対応づけ。
 * ZIP の中身は `zip名/中身名` で返るため、元ファイル(ZIP そのもの)へ戻せることを固定する。
 */
import { describe, expect, it } from 'vitest';
import type { ImportUnitResult } from './api.js';
import { fileForUnit, retryableFiles, rootFileName } from './import-retry.js';

const unit = (filename: string, status: ImportUnitResult['status']): ImportUnitResult => ({
  filename,
  kind: 'mf',
  months: [],
  rows: 0,
  skipped: 0,
  status,
});

const file = (name: string) => new File(['x'], name);

describe('取込に失敗したファイルの再取込', () => {
  it('ZIP の中身の名前から元の ZIP を割り出す', () => {
    expect(rootFileName('家計.zip/07月.csv')).toBe('家計.zip');
    expect(rootFileName('07月.csv')).toBe('07月.csv');
  });

  it('失敗した分だけを、投入した順で返す', () => {
    const files = [file('a.csv'), file('b.csv'), file('c.csv')];
    const got = retryableFiles(
      [unit('a.csv', 'failed'), unit('b.csv', 'committed'), unit('c.csv', 'failed')],
      files,
    );
    expect(got.map((f) => f.name)).toEqual(['a.csv', 'c.csv']);
  });

  it('1つの ZIP から複数の失敗が出ても元ファイルは1件にまとめる', () => {
    const got = retryableFiles(
      [unit('家計.zip/07月.csv', 'failed'), unit('家計.zip/08月.csv', 'failed')],
      [file('家計.zip')],
    );
    expect(got.map((f) => f.name)).toEqual(['家計.zip']);
  });

  it('失敗が無ければ何も返さない', () => {
    expect(retryableFiles([unit('a.csv', 'committed')], [file('a.csv')])).toEqual([]);
  });

  it('元ファイルが手元に無ければ戻せない(ボタンを出さないため null)', () => {
    expect(fileForUnit(unit('a.csv', 'failed'), [])).toBeNull();
    expect(retryableFiles([unit('a.csv', 'failed')], [file('b.csv')])).toEqual([]);
  });

  it('ZIP の中身1件からは元の ZIP を返す', () => {
    const got = fileForUnit(unit('家計.zip/07月.csv', 'failed'), [file('家計.zip')]);
    expect(got?.name).toBe('家計.zip');
  });
});
