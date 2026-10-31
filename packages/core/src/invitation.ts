/**
 * ログイン v2 の規則のうち、入出力を持たない判断をここに集める。
 *
 * core は Better Auth を知らない。api 側のフックや経路はこの関数に値を渡して結果を使うだけにし、
 * 「いつ期限切れか」「誰にセッションを作らせないか」を1か所で決める。
 * 同じ判断を api と web で別々に書くと、片方だけ直したときに画面と実際の拒否がずれる。
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** 招待の有効期間 (72 時間) */
export const INVITATION_TTL_MS = 72 * HOUR_MS;
/** パスワード再設定トークンの有効期間 (1 時間) */
export const RESET_TOKEN_TTL_MS = HOUR_MS;
/** 管理者の MFA 設定トークンの有効期間 (10 分) */
export const MFA_SETUP_TOKEN_TTL_MS = 10 * MINUTE_MS;
/** 保持ありセッションの長さ (30 日) */
export const REMEMBERED_SESSION_TTL_MS = 30 * DAY_MS;
/** 保持なしセッションの長さ (12 時間。延長しない) */
export const TRANSIENT_SESSION_TTL_MS = 12 * HOUR_MS;

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface InvitationState {
  revokedAt: Date | null;
  acceptedAt: Date | null;
  expiresAt: Date;
}

/**
 * 招待の状態 (BR-04)。取消 → 承諾済み → 期限切れ → 未承諾の順に見る。
 * 承諾済みの招待が後から期限を過ぎても「期限切れ」にはしない。承諾という事実が先に立つ。
 */
export function invitationStatus(invite: InvitationState, now: Date): InvitationStatus {
  if (invite.revokedAt) return 'revoked';
  if (invite.acceptedAt) return 'accepted';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

export function invitationExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + INVITATION_TTL_MS);
}

export function resetTokenExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + RESET_TOKEN_TTL_MS);
}

export function mfaSetupTokenExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + MFA_SETUP_TOKEN_TTL_MS);
}

/** 保持の有無からセッションの期限を決める (BR-07) */
export function sessionExpiresAt({ remember, issuedAt }: { remember: boolean; issuedAt: Date }): Date {
  return new Date(issuedAt.getTime() + (remember ? REMEMBERED_SESSION_TTL_MS : TRANSIENT_SESSION_TTL_MS));
}

/**
 * TOTP 未設定の管理者のセッションを作らせない経路か (BR-06・R-3)。
 * 既定は拒否で、例外は Google のコールバック (Google 管理者は TOTP なしで入れる) と、
 * 設定トークンで TOTP を確定させる `/mfa-setup/complete` の2つだけ。
 * path は Better Auth の basePath を除いた形 (`/sign-in/email` など) で渡す。
 */
export const TOTP_SETUP_EXEMPT_PATHS: readonly string[] = ['/callback/google', '/mfa-setup/complete'];

export function requiresTotpSetup({
  role,
  twoFactorEnabled,
  path,
}: {
  role: string;
  twoFactorEnabled: boolean;
  path: string;
}): boolean {
  if (role !== 'admin' || twoFactorEnabled) return false;
  return !TOTP_SETUP_EXEMPT_PATHS.includes(path);
}

/**
 * `next`・`callbackURL` を同じオリジンの相対パスに限る (BR-12)。
 * `//evil.example` はスキーム相対 URL、`/\evil.example` はブラウザが `//` と同じに読むので、どちらも落とす。
 */
export function isSafeRelativePath(next: unknown): next is string {
  if (typeof next !== 'string' || next.length === 0) return false;
  if (!next.startsWith('/')) return false;
  if (next.startsWith('//') || next.startsWith('/\\')) return false;
  // 制御文字 (改行やタブ) はブラウザが取り除いてから解釈するため、`/\t/evil` が `//evil` になる
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

export function safeRelativePathOr(next: unknown, fallback = '/'): string {
  return isSafeRelativePath(next) ? next : fallback;
}
