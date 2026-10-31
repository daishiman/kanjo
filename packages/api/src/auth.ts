import { getSessionCookie } from 'better-auth/cookies';
/** Better Auth を正本にした認証境界。Cloudflare Access の既存分岐だけを薄い adapter として残す。 */
import type { MiddlewareHandler } from 'hono';
import {
  type AuthScope,
  type BetterAuthEnv,
  type KanjoAuth,
  createAuth,
  newAuthScope,
} from './better-auth.js';
import { type UserRow, findUserByEmail } from './users.js';

export interface AuthEnv extends BetterAuthEnv {
  FILES: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
}

export const TENANT_ID = 'default';

export type AuthMode = 'better-auth' | 'cloudflare-access' | 'unconfigured' | 'invalid';

/** Accessはaudienceとteam domainの組でだけ有効。片側設定は認証を開けず構成エラーへ倒す。 */
export function resolveAuthMode(
  env: Pick<AuthEnv, 'ACCESS_AUD' | 'ACCESS_TEAM_DOMAIN' | 'BETTER_AUTH_SECRET'>,
): AuthMode {
  const hasAudience = Boolean(env.ACCESS_AUD?.trim());
  const hasTeamDomain = Boolean(env.ACCESS_TEAM_DOMAIN?.trim());
  if (hasAudience !== hasTeamDomain) return 'invalid';
  if (hasAudience) return 'cloudflare-access';
  if (env.BETTER_AUTH_SECRET) return 'better-auth';
  return 'unconfigured';
}

/** 公開認証入口と保護APIが同じモード判定を使うための上流gate。 */
export function authModePolicy(): MiddlewareHandler<{ Bindings: AuthEnv }> {
  return async (c, next) => {
    const mode = resolveAuthMode(c.env);
    if (mode === 'invalid') {
      return c.json(
        { error: { code: 'access_config_invalid', message: 'Access認証の設定が不完全です' } },
        503,
      );
    }
    if (
      mode === 'cloudflare-access' &&
      c.req.path.startsWith('/api/auth/') &&
      c.req.path !== '/api/auth/me'
    ) {
      return c.json(
        { error: { code: 'access_mode', message: 'Access認証ではアプリ内ログインを使用できません' } },
        400,
      );
    }
    return next();
  };
}

export interface SessionActor {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

export type AuthVariables = {
  userId: string;
  actor: SessionActor;
  sessionCreatedAt?: Date | string;
  auth?: KanjoAuth;
  authScope?: AuthScope;
};

export const actorOf = (user: Pick<UserRow, 'id' | 'email' | 'role'>): SessionActor => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

/** status より後、Better Auth handler と保護 API より前に1度だけ置く。 */
export function authRuntime(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVariables }> {
  return async (c, next) => {
    const mode = resolveAuthMode(c.env);
    if (mode === 'invalid') {
      return c.json(
        { error: { code: 'access_config_invalid', message: 'Access認証の設定が不完全です' } },
        503,
      );
    }
    if (mode !== 'better-auth') {
      if (
        (c.req.path.startsWith('/api/auth/') && c.req.path !== '/api/auth/me') ||
        mode !== 'cloudflare-access'
      ) {
        return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
      }
      return next();
    }
    const isAuthEndpoint = c.req.path.startsWith('/api/auth/');
    const hasSessionCookie = Boolean(getSessionCookie(c.req.raw, { cookiePrefix: 'kanjo' }));
    if (!isAuthEndpoint && !hasSessionCookie) {
      return next();
    }
    const waitUntil = (promise: Promise<unknown>): void => {
      const tracked = promise.catch((error) =>
        console.error(
          JSON.stringify({
            level: 'error',
            job: 'auth_background',
            name: error instanceof Error ? error.name : 'UnknownError',
          }),
        ),
      );
      try {
        c.executionCtx.waitUntil(tracked);
      } catch {
        void tracked;
      }
    };
    const scope = newAuthScope(waitUntil);
    c.set('authScope', scope);
    c.set('auth', createAuth(c.env, scope, c.req.url));
    return next();
  };
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function b64urlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function fetchJwks(teamDomain: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000) return jwksCache.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('jwks_fetch_failed');
  const body = (await response.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

async function verifyAccessJwt(token: string, audience: string, teamDomain: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(decoder.decode(b64urlDecode(parts[0]))) as { kid?: string; alg?: string };
    const payload = JSON.parse(decoder.decode(b64urlDecode(parts[1]))) as {
      aud?: string | string[];
      exp?: number;
      iss?: string;
      email?: string;
    };
    const validAudience = Array.isArray(payload.aud)
      ? payload.aud.includes(audience)
      : payload.aud === audience;
    if (
      header.alg !== 'RS256' ||
      !validAudience ||
      !payload.exp ||
      payload.exp * 1000 < Date.now() ||
      payload.iss !== `https://${teamDomain}`
    )
      return null;
    const jwk = (await fetchJwks(teamDomain)).find((candidate) => candidate.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlDecode(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? (payload.email ?? null) : null;
  } catch {
    return null;
  }
}

/** Access assertionからactive userを確定する唯一の境界。保護APIと/auth/meが共有する。 */
export async function authenticateAccessUser(
  env: Pick<AuthEnv, 'DB' | 'ACCESS_AUD' | 'ACCESS_TEAM_DOMAIN'>,
  assertion: string | undefined,
): Promise<UserRow | null> {
  if (!assertion) return null;
  const email = await verifyAccessJwt(assertion, env.ACCESS_AUD, env.ACCESS_TEAM_DOMAIN);
  const user = email ? await findUserByEmail(env.DB, email) : null;
  return user?.status === 'active' ? user : null;
}

const unauthorized = { error: { code: 'unauthorized', message: '認証が必要です' } } as const;

/** Better Auth session を毎回D1で照合し、停止・失効を即時反映する。 */
export function authGuard(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVariables }> {
  return async (c, next) => {
    if (resolveAuthMode(c.env) === 'cloudflare-access') {
      const user = await authenticateAccessUser(c.env, c.req.header('Cf-Access-Jwt-Assertion'));
      if (!user) return c.json(unauthorized, 401);
      c.set('userId', TENANT_ID);
      c.set('actor', actorOf(user));
      return next();
    }

    const auth = c.get('auth');
    if (!auth) return c.json(unauthorized, 401);
    // Cookieが無い要求はD1へ触れる前に止める。認証前のDoS面とschema gateの順序を固定する。
    if (!getSessionCookie(c.req.raw, { cookiePrefix: 'kanjo' })) return c.json(unauthorized, 401);
    const result = (await auth.api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
      query: { disableCookieCache: true },
    })) as {
      response: null | {
        session: { createdAt: Date | string };
        user: { id: string; email: string; role: 'admin' | 'member'; status: 'active' | 'suspended' };
      };
      headers?: Headers;
    };
    const session = result?.response;
    if (!session || session.user.status !== 'active') return c.json(unauthorized, 401);
    result.headers?.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') c.header('Set-Cookie', value, { append: true });
    });
    c.set('userId', TENANT_ID);
    c.set('actor', actorOf(session.user));
    c.set('sessionCreatedAt', session.session.createdAt);
    return next();
  };
}

export function adminGuard(): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVariables }> {
  return async (c, next) => {
    if (c.get('actor')?.role !== 'admin') {
      return c.json({ error: { code: 'forbidden', message: '管理者のみが実行できます' } }, 403);
    }
    return next();
  };
}
