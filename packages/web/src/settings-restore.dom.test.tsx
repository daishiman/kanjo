// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BACKUP_RESTORE_CONFIRMATION,
  LEGACY_RESTORE_CONFIRMATION,
  LegacyRestoreNotice,
} from './pages/Settings.js';

afterEach(cleanup);

describe('初期移行の正直なDOM契約', () => {
  it('全データ復元と過剰保証せず、集計件数と現金明細の復元結果を明示する', () => {
    render(
      <LegacyRestoreNotice
        result={{
          ok: true,
          duplicate: false,
          months: ['2026-07', '2026-08'],
          mfTxCount: 12,
          rules: 3,
          cashEntries: 2,
          cashKept: 0,
          cashSkipped: 0,
        }}
      />,
    );

    expect(screen.getByText(/2件 \/ MF明細 12件 \/ 分類ルール 3件/)).toBeTruthy();
    expect(screen.getByText(/現金明細: 復元 2件 \/ 既存を保持 0件 \/ 処理上限で未復元 0件/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('全データを復元');
    expect(document.body.textContent).not.toContain('復元が完了');
  });

  it.each([
    [{ cashEntries: 0, cashKept: 4, cashSkipped: 0 }, '既存を保持 4件'],
    [{ cashEntries: 0, cashKept: 0, cashSkipped: 3 }, '処理上限で未復元 3件'],
  ])('現金明細の復元・保持・未復元の実数を示す: %s', (cash, expected) => {
    render(
      <LegacyRestoreNotice
        result={{
          ok: true,
          duplicate: false,
          months: [],
          mfTxCount: 0,
          rules: 0,
          ...cash,
        }}
      />,
    );

    expect(screen.getByText(new RegExp(expected))).toBeTruthy();
  });

  it('初期移行と夜間バックアップの確認文で、現金明細の3つの結果を予告する', () => {
    render(
      <>
        <p>{LEGACY_RESTORE_CONFIRMATION}</p>
        <p>{BACKUP_RESTORE_CONFIRMATION}</p>
      </>,
    );

    for (const confirmation of [LEGACY_RESTORE_CONFIRMATION, BACKUP_RESTORE_CONFIRMATION]) {
      expect(confirmation).toContain('移行先の現金明細が空');
      expect(confirmation).toContain('既存の現金明細は保持');
      expect(confirmation).toContain('処理上限を超えた明細は復元しません');
      expect(confirmation).not.toMatch(/現金明細.*対象外/);
      expect(confirmation).not.toContain('全データ');
    }
  });
});
