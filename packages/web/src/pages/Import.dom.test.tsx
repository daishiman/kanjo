// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
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

    expect(screen.getByRole('columnheader', { name: '保存行' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '解析行' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '集計対象' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '集計対象外' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '保存不可' })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/ID重複1件/)).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: '有効行' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'スキップ' })).toBeNull();
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

    const row = screen.getByRole('row', { name: /anonymous-legacy\.csv/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[3].textContent).toBe('—');
    expect(cells[4].textContent).toBe('—');
    expect(cells[5].textContent).toBe('—');
    expect(cells[6].textContent).toBe('—');
    expect(cells[7].textContent).toBe('—');
    expect(within(row).getByText('旧API: 旧有効8行・旧スキップ3行（内訳不明）')).toBeTruthy();
    expect(within(row).queryByText(/解析8行・保存8行/)).toBeNull();
  });
});
