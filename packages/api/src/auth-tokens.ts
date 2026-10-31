/**
 * 認証まわりの使い捨てトークン (招待・MFA 設定・連携確認・再設定) の共通部品。
 *
 * 平文は利用者へ渡す1回だけで、D1 には SHA-256 の16進だけを置く。
 * 32 バイトの乱数なので、ハッシュに塩を足さなくても総当たりの的にならない。
 */

const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** URL にそのまま載る 32 バイトの乱数 (43 文字)。 */
export function newOpaqueToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** 受け取ったトークンの形を先に絞る。長さの桁違いな入力でハッシュを回さない。 */
export function isOpaqueToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(value);
}

/** 監査・招待の行 id。既存の表と同じく UUID を使う。 */
export const newRowId = (): string => crypto.randomUUID();

/** 表の時刻列は ISO 24 文字 (`2026-09-22T00:00:00.000Z`) に揃える。 */
export const isoAt = (date: Date): string => date.toISOString();
