/** 実appの認証済み境界を通すテスト専用の署名Cookieを生成する。 */
export async function signedSessionCookieForTest(secret: string): Promise<string> {
  const expiresAt = String(Date.now() + 60_000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expiresAt)));
  const encoded = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `kanjo_session=${expiresAt}.${encoded}`;
}
