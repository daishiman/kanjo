// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImportUnitResult } from '../api.js';
import { ImportResultTable } from './Import.js';

afterEach(cleanup);

describe('取込結果の件数表示', () => {
  it('保存行・集計対象外・保存不能を明示し、解析行と保存行が違っても嘘をつかない', () => {
    const results: ImportUnitResult[] = [
      {
        filename: 'anonymous-counts.csv',
        kind: 'mf',
        months: ['2026-12'],
        counts: { parsed: 3, stored: 2, countable: 1, nonCountable: 1, rejected: 1 },
        rows: 1,
        skipped: 3,
        duplicateIds: 1,
        status: 'committed',
      },
    ];

    render(<ImportResultTable results={results} />);

    const record = screen.getByText('anonymous-counts.csv').closest('.import-record') as HTMLElement;
    const scope = within(record);
    expect(scope.getByText('取込完了')).toBeTruthy();
    expect(scope.getByText('2', { selector: '.import-record-count .num' })).toBeTruthy();
    expect(scope.getByText('2026-12')).toBeTruthy();

    fireEvent.click(scope.getByText('件数の内訳'));
    expect(scope.getByText('解析行')).toBeTruthy();
    expect(scope.getByText('保存行')).toBeTruthy();
    expect(scope.getByText('集計対象')).toBeTruthy();
    expect(scope.getByText('集計対象外')).toBeTruthy();
    expect(scope.getByText('保存不可')).toBeTruthy();
    expect(scope.getByText(/ID重複 1件/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('旧APIレスポンスはスキップ内訳を新件数に推測せず不明と示す', () => {
    const results: ImportUnitResult[] = [
      {
        filename: 'anonymous-legacy.csv',
        kind: 'mf',
        months: ['2026-11'],
        rows: 8,
        skipped: 3,
        status: 'committed',
      },
    ];

    render(<ImportResultTable results={results} />);

    const record = screen.getByText('anonymous-legacy.csv').closest('.import-record') as HTMLElement;
    const scope = within(record);
    fireEvent.click(scope.getByText('件数の内訳'));
    expect(scope.getByText('旧API: 旧有効8行・旧スキップ3行（内訳不明）')).toBeTruthy();
    expect(scope.queryByText(/解析8行・保存8行/)).toBeNull();
    expect(scope.queryByText('解析行')).toBeNull();
  });

  it('連続する対象月を範囲と件数に圧縮して走査しやすくする', () => {
    render(
      <ImportResultTable
        results={[
          {
            filename: 'anonymous-range.csv',
            kind: 'freee',
            months: ['2026-01', '2026-02', '2026-03'],
            rows: 3,
            skipped: 0,
            status: 'committed',
          },
        ]}
      />,
    );

    expect(screen.getByText('2026-01 〜 2026-03（3ヶ月）')).toBeTruthy();
  });

  it('対象月が連続していないときは連続範囲のように見せない', () => {
    render(
      <ImportResultTable
        results={[
          {
            filename: 'anonymous-gapped-range.csv',
            kind: 'mf',
            months: ['2026-01', '2026-03'],
            rows: 2,
            skipped: 0,
            status: 'committed',
          },
        ]}
      />,
    );

    const summary = screen.getByText('2026-01 〜 2026-03（2ヶ月・一部月を除く）');
    expect(summary).toHaveProperty('title', '2026-01, 2026-03');
  });
});
