/**
 * 認証(FR-06)。二段構え:
 *  - ACCESS_AUD + ACCESS_TEAM_DOMAIN が設定されていれば Cloudflare Access のJWTを検証(第一候補)
 *  - 未設定時はアプリ内セッション認証(パスワード + HMAC署名 HttpOnly Cookie)を既定で有効化
 * 未認証で /api のデータへアクセスできる状態は存在しない。
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

export interface AuthEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  AUTH_PASSWORD?: string;
  SESSION_SECRET?: string;
}

const COOKIE = 'kanjo_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14日

const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

const b64url = (b: Uint8Array): string =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function b64urlDecode(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** 長さ・内容ともタイミング非依存の比較(SHA-256ダイジェスト同士を比較) */
async function timingSafeEq(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function issueSession(c: Context, secret: string): Promise<void> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = b64url(await hmac(secret, exp));
  setCookie(c, COOKIE, `${exp}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSession(c: Context): void {
  setCookie(c, COOKIE, '', { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 0 });
}

async function verifySessionCookie(c: Context, secret: string): Promise<boolean> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = b64url(await hmac(secret, exp));
  return timingSafeEq(sig, want);
}

export async function verifyPassword(input: string, expected: string): Promise<boolean> {
  return timingSafeEq(input, expected);
}

/* ---------------- Cloudflare Access JWT (RS256) ---------------- */

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

// JWKSはリクエスト横断のキャッシュ(リクエスト固有状態ではない)
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function fetchJwks(teamDomain: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 1000 * 60 * 60) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('jwks fetch failed');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

async function verifyAccessJwt(token: string, aud: string, teamDomain: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))) as {
    kid?: string;
    alg?: string;
  };
  if (header.alg !== 'RS256') return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as {
    aud?: string | string[];
    exp?: number;
    iss?: string;
    email?: string;
  };
  const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
  if (!audOk) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  const keys = await fetchJwks(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlDecode(parts[2]),
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  return ok ? (payload.email ?? 'access-user') : null;
}

/** /api 配下(認証エンドポイント以外)を保護するミドルウェア */
export function authGuard(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: { userId: string } }> {
  return async (c, next) => {
    const env = c.env;
    if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
      const token = c.req.header('Cf-Access-Jwt-Assertion');
      if (token) {
        try {
          const email = await verifyAccessJwt(token, env.ACCESS_AUD, env.ACCESS_TEAM_DOMAIN);
          if (email) {
            c.set('userId', 'default');
            return next();
          }
        } catch {
          // 検証失敗は未認証として扱う(詳細はログに残さない)
        }
      }
      return c.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, 401);
    }
    if (!env.SESSION_SECRET) {
      return c.json(
        { error: { code: 'auth_not_configured', message: '認証が未設定です(SESSION_SECRET)' } },
        503,
      );
    }
    if (await verifySessionCookie(c, env.SESSION_SECRET)) {
      c.set('userId', 'default');
      return next();
    }
    return c.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, 401);
  };
}
