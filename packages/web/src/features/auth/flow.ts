/**
 * ログインの途中の状態 (§7.16)。/mfa はこれが無いと描けない。
 *
 * 設定トークンは URL・storage・history.state に置かず、App のメモリにだけ持つ (§7.10)。
 * 再読込で消えるのは意図どおりで、その場合は「もう一度ログインしてください。」に戻す。
 */
export type AuthFlow =
  | { kind: 'verify'; next: string }
  | { kind: 'setup'; setupToken: string; expiresAt: string; next: string };

export interface AuthFlowHandlers {
  /** ログインの続き (/mfa) へ進む */
  onFlow: (flow: AuthFlow) => void;
  /** セッションができた。認証状態を取り直してから next へ移る */
  onAuthenticated: (next: string) => Promise<void>;
}

/** /login へ戻すときに一緒に渡す文言。URL に載せず、履歴の state で渡す */
export interface LoginNotice {
  notice: string;
}

export const noticeOf = (state: unknown): string | null => {
  const notice = (state as Partial<LoginNotice> | null | undefined)?.notice;
  return typeof notice === 'string' ? notice : null;
};
