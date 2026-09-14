/**
 * 認証(FR-06 / アカウントログイン)。
 *
 * 資格情報はメールアドレス + パスワード。セッション Cookie の署名対象は
 * 「利用者ID . 有効期限 . 世代」の3要素で、Cookie から操作者を特定できる。
 * 世代は D1 の users.session_generation と照合するため、パスワード変更・再発行・停止の
 * いずれでもセッション表を持たずに即時失効が効く。
 *
 * ACCESS_AUD + ACCESS_TEAM_DOMAIN が設定されていれば Cloudflare Access の JWT を検証する経路も
 * 残す(サーバ側実装のみ。ログイン画面の UI からは除去済み)。
 * 未認証で /api のデータへアクセスできる状態は存在しない。
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { type UserRow, findUserByEmail, findUserById } from './users.js';

export interface AuthEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  SESSION_SECRET?: string;
  /** 非secret override。正本・validation・fallbackはlogin-rate-limit.tsに集約する。 */
  PASSWORD_LOGIN_WINDOW_SECONDS?: string;
  PASSWORD_LOGIN_MAX_FAILURES?: string;
  PASSWORD_LOGIN_LOCK_SECONDS?: string;
  PASSWORD_LOGIN_STALE_AFTER_SECONDS?: string;
}

/**
 * 業務データのテナントキー。利用者アカウントの導入後もこの値は動かさない。
 * 明細・取引・カテゴリへ所有者列を足さない設計(account-login-database の決定2)のため、
 * 「誰が操作したか」は actor として別に持ち、audit_log.actor_user_id へ書く。
 */
export const TENANT_ID = 'default';

export interface SessionActor {
  id: string;
  email: string;
  role: 'admin' | 'member';
  mustChangePassword: boolean;
}

export type AuthVariables = {
  /** 既存業務データの共有テナントキー。認証主体IDではない。 */
  userId: string;
  actor: SessionActor;
  /** 現在のCookieが持つ絶対期限。パスワード変更でTTLを延長しないために引き継ぐ。 */
  sessionExpiresAt: number | null;
};

const COOKIE = 'kanjo_session';

/** 既定の帰結は画面のマイクロコピーで開示する。ここはその正本。 */
export const SESSION_TTL_MS = Object.freeze({
  remembered: 30 * 24 * 60 * 60 * 1000,
  transient: 12 * 60 * 60 * 1000,
});

export const sessionTtlMs = (remember: boolean): number =>
  remember ? SESSION_TTL_MS.remembered : SESSION_TTL_MS.transient;

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

/** 署名対象。要素数が3でない payload は旧形式として構造的に拒否される。 */
const sessionPayload = (userId: string, expiresAt: number, generation: number): string =>
  `${userId}.${expiresAt}.${generation}`;

export async function issueSession(
  c: Context,
  secret: string,
  user: Pick<UserRow, 'id' | 'session_generation'>,
  remember: boolean,
): Promise<void> {
  const ttl = sessionTtlMs(remember);
  await issueSessionUntil(c, secret, user, Date.now() + ttl);
}

/** 元の絶対期限を維持してCookieだけを新しい世代へ載せ替える。 */
export async function issueSessionUntil(
  c: Context,
  secret: string,
  user: Pick<UserRow, 'id' | 'session_generation'>,
  expiresAt: number,
): Promise<void> {
  const ttl = Math.max(1_000, expiresAt - Date.now());
  const payload = sessionPayload(user.id, expiresAt, user.session_generation);
  const sig = b64url(await hmac(secret, payload));
  setCookie(c, COOKIE, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: Math.floor(ttl / 1000),
  });
}

export function clearSession(c: Context): void {
  setCookie(c, COOKIE, '', { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 0 });
}

interface SessionClaims {
  userId: string;
  generation: number;
  expiresAt: number;
}

/** 署名・期限・形式だけを見る。世代の突合は DB を引く verifySession 側で行う。 */
async function readSessionCookie(c: Context, secret: string): Promise<SessionClaims | null> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  const parts = raw.split('.');
  // 旧形式(exp.sig の2要素)はここで落ちる。SESSION_SECRET ローテーションと併せた二段の無効化。
  if (parts.length !== 4) return null;
  const [userId, exp, generation, sig] = parts;
  if (!userId || !/^\d+$/.test(exp) || !/^\d+$/.test(generation)) return null;
  if (Number(exp) < Date.now()) return null;
  const want = b64url(await hmac(secret, sessionPayload(userId, Number(exp), Number(generation))));
  if (!(await timingSafeEq(sig, want))) return null;
  return { userId, generation: Number(generation), expiresAt: Number(exp) };
}

/** Cookie の主張を D1 の現在値と突き合わせる。世代・停止のいずれでも即時に失効する。 */
export async function verifySession(
  c: Context,
  secret: string,
  db: D1Database,
): Promise<{ user: UserRow; expiresAt: number } | null> {
  const claims = await readSessionCookie(c, secret);
  if (!claims) return null;
  const user = await findUserById(db, claims.userId);
  if (!user) return null;
  if (user.status !== 'active') return null;
  if (user.session_generation !== claims.generation) return null;
  return { user, expiresAt: claims.expiresAt };
}

export const actorOf = (user: UserRow): SessionActor => ({
  id: user.id,
  email: user.email,
  role: user.role,
  mustChangePassword: user.must_change_password === 1,
});

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
  return ok ? (payload.email ?? null) : null;
}

const unauthorized = { error: { code: 'unauthorized', message: '認証が必要です' } } as const;

/** /api 配下(認証エンドポイント以外)を保護するミドルウェア */
export function authGuard(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVariables }> {
  return async (c, next) => {
    const env = c.env;
    if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
      const token = c.req.header('Cf-Access-Jwt-Assertion');
      if (token) {
        try {
          const email = await verifyAccessJwt(token, env.ACCESS_AUD, env.ACCESS_TEAM_DOMAIN);
          // Access を通っても、利用者として登録され有効でなければ通さない。
          // 認可の正本はあくまで users であり、外部 IdP の主張を素通しにしない。
          const user = email ? await findUserByEmail(env.DB, email) : null;
          if (user && user.status === 'active') {
            c.set('userId', TENANT_ID);
            c.set('actor', actorOf(user));
            c.set('sessionExpiresAt', null);
            return next();
          }
        } catch {
          // 検証失敗は未認証として扱う(詳細はログに残さない)
        }
      }
      return c.json(unauthorized, 401);
    }
    if (!env.SESSION_SECRET) {
      return c.json(
        { error: { code: 'auth_not_configured', message: '認証が未設定です(SESSION_SECRET)' } },
        503,
      );
    }
    const session = await verifySession(c, env.SESSION_SECRET, env.DB);
    if (!session) return c.json(unauthorized, 401);
    c.set('userId', TENANT_ID);
    c.set('actor', actorOf(session.user));
    c.set('sessionExpiresAt', session.expiresAt);
    return next();
  };
}

/**
 * 強制パスワード変更の抑止。UI のレンダリング分岐だけでは URL 直打ちで回避されるため、
 * サーバ側でも本人のパスワード変更以外を拒否する。
 */
export function mustChangePasswordFence(): MiddlewareHandler<{
  Bindings: AuthEnv;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const actor = c.get('actor');
    if (actor?.mustChangePassword) {
      return c.json(
        {
          error: {
            code: 'password_change_required',
            message: '一時パスワードの変更が必要です',
          },
        },
        403,
      );
    }
    return next();
  };
}

/** 管理系の認可。UI のメニュー非表示は補助であり、判定の正本はここの 403。 */
export function adminGuard(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVariables }> {
  return async (c, next) => {
    const actor = c.get('actor');
    if (actor?.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: '管理者のみが実行できます' } }, 403);
    }
    return next();
  };
}
