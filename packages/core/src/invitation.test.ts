import { describe, expect, it } from 'vitest';
import {
  invitationExpiresAt,
  invitationStatus,
  isSafeRelativePath,
  mfaSetupTokenExpiresAt,
  requiresTotpSetup,
  resetTokenExpiresAt,
  safeRelativePathOr,
  sessionExpiresAt,
} from './invitation.js';

const T0 = new Date('2026-09-22T00:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 60 * 60 * 1000;

describe('invitationStatus (BR-04)', () => {
  const base = { revokedAt: null, acceptedAt: null, expiresAt: later(HOUR) };

  it('未承諾・期限切れ・承諾済み・取消を区別する', () => {
    expect(invitationStatus(base, T0)).toBe('pending');
    expect(invitationStatus(base, later(HOUR))).toBe('expired');
    expect(invitationStatus({ ...base, acceptedAt: T0 }, T0)).toBe('accepted');
    expect(invitationStatus({ ...base, revokedAt: T0 }, T0)).toBe('revoked');
  });

  it('取消 > 承諾済み > 期限切れ の優先で決める', () => {
    const past = later(-HOUR);
    expect(invitationStatus({ revokedAt: T0, acceptedAt: T0, expiresAt: past }, T0)).toBe('revoked');
    expect(invitationStatus({ revokedAt: null, acceptedAt: T0, expiresAt: past }, T0)).toBe('accepted');
  });
});

describe('期限', () => {
  it('招待 72 時間・再設定 1 時間・MFA 設定 10 分', () => {
    expect(invitationExpiresAt(T0)).toEqual(later(72 * HOUR));
    expect(resetTokenExpiresAt(T0)).toEqual(later(HOUR));
    expect(mfaSetupTokenExpiresAt(T0)).toEqual(later(10 * 60 * 1000));
  });

  it('保持ありは 30 日、保持なしは 12 時間 (BR-07)', () => {
    expect(sessionExpiresAt({ remember: true, issuedAt: T0 })).toEqual(later(30 * 24 * HOUR));
    expect(sessionExpiresAt({ remember: false, issuedAt: T0 })).toEqual(later(12 * HOUR));
  });
});

describe('requiresTotpSetup (BR-06)', () => {
  it('TOTP 未設定の管理者は、例外 2 経路以外すべて拒否する', () => {
    for (const path of ['/sign-in/email', '/two-factor/verify-totp', '/get-session', '/unknown']) {
      expect(requiresTotpSetup({ role: 'admin', twoFactorEnabled: false, path })).toBe(true);
    }
    expect(requiresTotpSetup({ role: 'admin', twoFactorEnabled: false, path: '/callback/google' })).toBe(
      false,
    );
    expect(requiresTotpSetup({ role: 'admin', twoFactorEnabled: false, path: '/mfa-setup/complete' })).toBe(
      false,
    );
  });

  it('設定済みの管理者と一般利用者は求めない', () => {
    expect(requiresTotpSetup({ role: 'admin', twoFactorEnabled: true, path: '/sign-in/email' })).toBe(false);
    expect(requiresTotpSetup({ role: 'member', twoFactorEnabled: false, path: '/sign-in/email' })).toBe(
      false,
    );
  });
});

describe('isSafeRelativePath (BR-12)', () => {
  it('同一オリジンの相対パスだけを通す', () => {
    expect(isSafeRelativePath('/')).toBe(true);
    expect(isSafeRelativePath('/settings?tab=account')).toBe(true);
    for (const bad of [
      '',
      'settings',
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      '/\t/evil',
      null,
      1,
    ]) {
      expect(isSafeRelativePath(bad)).toBe(false);
    }
  });

  it('不正な値は既定の / に置き換える', () => {
    expect(safeRelativePathOr('//evil.example')).toBe('/');
    expect(safeRelativePathOr('/cash')).toBe('/cash');
  });
});
