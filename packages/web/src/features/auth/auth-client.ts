/**
 * 認証の経路を呼ぶ薄い層。Better Auth のクライアントは使わず、既存の api() に揃える。
 *
 * 認証前の画面の 401 は「セッションが切れた」ではなく入力の誤りなので、
 * AUTH_EVENT (全体をログイン画面へ戻す合図) を出さない code を列挙する。
 */
import { type ApiRequestPolicy, api } from '../../api.js';

export const AUTH_FORM_POLICY: ApiRequestPolicy = {
  recoverableUnauthorizedCodes: [
    'invalid_credentials',
    'INVALID_EMAIL_OR_PASSWORD',
    'INVALID_CODE',
    'INVALID_BACKUP_CODE',
    'INVALID_TWO_FACTOR_COOKIE',
    'INVALID_PASSWORD',
    'mfa_setup_token_invalid',
    'mfa_code_invalid',
    'reauth_failed',
  ],
};

export const postAuth = <T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> =>
  api<T>(
    path,
    { method: 'POST', body: JSON.stringify(body), ...(headers ? { headers } : {}) },
    AUTH_FORM_POLICY,
  );

export type SignInResponse =
  | { twoFactorRedirect: true }
  | { mfaSetupRequired: true; setupToken: string; expiresAt: string }
  | { redirect?: boolean; token?: string; user?: unknown };

export interface SocialStart {
  url: string;
  redirect: boolean;
}

/** Google の認可を始める。保持なしは query で伝える (§API「Google でのログイン」Q-3) */
export const startGoogle = (
  body: { callbackURL: string; errorCallbackURL: string; requestSignUp?: true },
  remember = true,
): Promise<SocialStart> =>
  postAuth<SocialStart>(`/auth/sign-in/social${remember ? '' : '?remember=0'}`, {
    provider: 'google',
    ...body,
  });
