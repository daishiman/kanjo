/**
 * 認証まわりの画面が使う、状態 → 文言の純関数と定数 (spec-login-v2 §7.2・§7.15)。
 *
 * 文言は §7.2 と字面で一致させる契約なので、部品の JSX に散らさずここに集める。
 * どの応答をどの文言に畳むか (列挙を防ぐために区別しない、を含む) もここだけで決める。
 */
import { ApiError } from '../../api.js';

export const MESSAGES = {
  credentialsRequired: 'メールアドレスとパスワードを入力してください。',
  emailRequired: 'メールアドレスを入力してください。',
  passwordRequired: 'パスワードを入力してください。',
  unauthorized: 'メールアドレスまたはパスワードが正しくありません。',
  notConfigured: '認証が未設定です。管理者にお問い合わせください',
  network: 'ログインに失敗しました。通信状況を確認してもう一度お試しください',
  lockedFallback: '試行回数の上限に達しました。時間をおいてもう一度お試しください',
  googleFailed:
    'Googleでログインできませんでした。招待先と同じメールアドレスのGoogleアカウントか確認してください。パスワードで登録済みの方は、ログイン後に設定画面から連携できます。',
  accepted: '受け付けました。該当するアカウントがある場合は、数分以内にメールが届きます。',
  relogin: 'もう一度ログインしてください。',
  twoFactorExpired: '時間切れです。もう一度ログインしてください。',
  invalidCode: 'コードが正しくありません。',
  inviteUnavailable:
    'この招待リンクは使えません。テナント管理者に再送を依頼するか、ログイン画面の『招待メールを再送』をご利用ください。',
  inviteGoogleMismatch: '招待されたメールアドレスのGoogleアカウントを選んでください。',
  userExists: 'このメールアドレスは登録済みです。ログインしてください。',
  resetDone: 'パスワードを再設定しました。新しいパスワードでログインしてください。',
  resetUnavailable: 'この再設定リンクは使えません。もう一度『パスワードをお忘れの方』からお試しください。',
  passwordMismatch: '確認用のパスワードが一致しません',
  passwordTooShort: 'パスワードが短すぎます。12文字以上にしてください。',
  wrongCurrentPassword: '現在のパスワードが正しくありません。',
  /** 招待の承諾・再設定・設定画面の通信失敗。§7.2 のログインの通信失敗は「ログインに」と言うので流用しない */
  requestFailed: '送信できませんでした。通信状況を確認してもう一度お試しください',
} as const;

/** 12文字は既存の validatePasswordPolicy (BR-14) の下限。最終判定はサーバが持つ */
export const PASSWORD_MIN_LENGTH = 12;

/** 既存 users と同じ正規化。前後の空白を除いて小文字にする (§7.4) */
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/** 429 の本文から待ち秒数を読む。アプリ独自の経路はトップレベル、念のため error の中も見る */
export function retryAfterSeconds(err: unknown): number | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as
    | { retryAfterSeconds?: unknown; error?: { retryAfterSeconds?: unknown } }
    | undefined;
  const value = body?.retryAfterSeconds ?? body?.error?.retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** ロック中の文言。N は retryAfterSeconds を分に切り上げる (§7.2) */
export function lockedMessage(err: unknown): string {
  const seconds = retryAfterSeconds(err);
  return seconds
    ? `試行回数の上限に達しました。約${Math.ceil(seconds / 60)}分後にもう一度お試しください`
    : MESSAGES.lockedFallback;
}

export const isNetworkFailure = (err: unknown): boolean => !(err instanceof ApiError);

/**
 * パスワードでのログインの失敗を文言に畳む。
 *
 * 不在・停止・相違を区別しない (列挙防止)。サーバが1つの 401 に畳んでいるので、画面もそれを再発明しない。
 * 400・413 のような「画面が送った形が悪い」応答は、利用者に直せる手段が無いので通信失敗と同じ文言にする。
 */
export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return lockedMessage(err);
    if (err.status === 401) return MESSAGES.unauthorized;
    if (err.status === 503) return MESSAGES.notConfigured;
  }
  return MESSAGES.network;
}

/**
 * ログイン後の移動先 (BR-12)。同じオリジンの相対パスだけを通し、それ以外は `/` にする。
 * `//host` と `/\host` はブラウザが別オリジンとして解釈するので、先頭2文字で弾く。
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  // 制御文字を含む値はブラウザごとに解釈が割れる
  for (let i = 0; i < raw.length; i += 1) if (raw.charCodeAt(i) < 0x20) return '/';
  return raw;
}

/** 未認証で業務の経路に来たときの行き先。`/` は next を付けない (戻り先が既定と同じ) */
export function loginPathFor(pathAndSearch: string): string {
  const next = sanitizeNext(pathAndSearch);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}

export type ServiceState = 'normal' | 'degraded' | 'unknown';

export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  normal: '正常',
  degraded: '一部不調',
  unknown: '確認できません',
};

/** GET /api/status の本文を3値に畳む。想定外の値は「確認できません」(§7.8) */
export function serviceStateOf(body: unknown): ServiceState {
  const status = (body as { status?: unknown } | null | undefined)?.status;
  return status === 'normal' || status === 'degraded' ? status : 'unknown';
}

export const ROLE_LABEL = { admin: '管理者', member: '一般' } as const;

/** otpauth URI から手入力用の秘密鍵 (base32) を取り出す。読めなければ空 */
export function totpSecretOf(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}
