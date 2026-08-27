// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LEGACY_RESTORE_CONFIRMATION, LegacyRestoreNotice } from './pages/Settings.js';

afterEach(cleanup);

describe('初期移行の正直なDOM契約', () => {
  it('全データ復元と過剰保証せず、集計件数と証憑の対象外を明示する', () => {
    render(
      <LegacyRestoreNotice
        result={{ ok: true, duplicate: false, months: ['2026-07', '2026-08'], mfTxCount: 12, rules: 3 }}
      />,
    );

    expect(screen.getByText(/2件 \/ MF明細 12件 \/ 分類ルール 3件/)).toBeTruthy();
    expect(screen.getByText(/現金明細、証憑の原本と管理情報はこの操作の対象外/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('全データを復元');
    expect(document.body.textContent).not.toContain('復元が完了');
  });

  it('確認文言でも証憑を対象外と明言する', () => {
    expect(LEGACY_RESTORE_CONFIRMATION).toContain('集計・分類・設定データ');
    expect(LEGACY_RESTORE_CONFIRMATION).toContain('現金明細');
    expect(LEGACY_RESTORE_CONFIRMATION).toContain('証憑の原本と管理情報は対象外');
    expect(LEGACY_RESTORE_CONFIRMATION).not.toContain('全データ');
  });
});
