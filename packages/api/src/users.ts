/**
 * 利用者ドメイン(FR-Account-Login)。
 *
 * 認証と監査の主体としてだけ利用者を持つ。業務データには所有者列を足さない。
 * パスワードは復元不能な形でのみ保存し、平文はどの経路にも残さない。
 */

/**
 * WebCrypto PBKDF2 の反復。本番 Workers は 100,000 を超えると deriveBits が NotSupportedError になるため、
 * 実行環境が受け付ける上限の 100,000 を採る (password-hash-workerd.test.ts で固定)。
 */
export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;
const HASH_PREFIX = 'pbkdf2-sha256';

/** パスワードの下限。上限は DoS 防止であって強度要件ではない。 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * 認証の正本は Better Auth の "user" 表 (0059)。パスワードは account(providerId='credential') に置き、
 * この行には持たない。列名は Better Auth の camelCase のまま読む。
 */
export interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  twoFactorEnabled: number | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

/** 外向けの利用者表現。資格情報を含めない型として定義し、漏らす経路を型で塞ぐ。 */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AccountUserDetails extends PublicUser {
  twoFactorEnabled: boolean;
  providers: Array<'credential' | 'google'>;
  authAccounts: Array<{ id: string; providerId: 'credential' | 'google' }>;
}

export const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  createdAt: row.createdAt,
  lastLoginAt: row.lastLoginAt,
});

const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64urlDecode = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

/** 保存前の正規化。UNIQUE 制約と合わせて、表記ゆれによる重複登録を二重で止める。 */
export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string): boolean => email.length <= 254 && EMAIL.test(email);

/**
 * 明白に弱いパスワードだけを拒否する。辞書照合は持たない。
 * 「強度判定を厳しくする」より「失効を確実にする」側へ防御の重心を置いている(security 設計)。
 */
const OBVIOUS_WEAK = ['password', 'passw0rd', '123456789012', 'qwertyuiop', 'administrator', 'letmeinplease'];

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `パスワードは${PASSWORD_MAX_LENGTH}文字以下にしてください`;
  const lowered = password.toLowerCase();
  if (OBVIOUS_WEAK.some((weak) => lowered.includes(weak)))
    return '推測されやすい語を含むパスワードは使用できません';
  if (/^(.)\1+$/.test(password)) return '同じ文字の繰り返しは使用できません';
  return null;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    DERIVED_BITS,
  );
  return new Uint8Array(bits);
}

/** 自己記述形式。将来 iterations を上げてもログイン時の再ハッシュで段階的に吸収できる。 */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(password, salt, iterations);
  return `${HASH_PREFIX}$${iterations}$${b64url(salt)}$${b64url(derived)}`;
}

interface ParsedHash {
  iterations: number;
  salt: Uint8Array;
  derived: Uint8Array;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) return null;
  if (!/^\d+$/.test(parts[1])) return null;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1) return null;
  try {
    return { iterations, salt: b64urlDecode(parts[2]), derived: b64urlDecode(parts[3]) };
  } catch {
    return null;
  }
}

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
};

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const derived = await derive(password, parsed.salt, parsed.iterations);
  return constantTimeEqual(derived, parsed.derived);
}

const USER_COLUMNS = 'id,email,role,status,"twoFactorEnabled","createdAt","updatedAt","lastLoginAt"';

export const findUserByEmail = (db: D1Database, email: string): Promise<UserRow | null> =>
  db
    .prepare(`SELECT ${USER_COLUMNS} FROM "user" WHERE email=? LIMIT 1`)
    .bind(normalizeEmail(email))
    .first<UserRow>();

export const findUserById = (db: D1Database, id: string): Promise<UserRow | null> =>
  db.prepare(`SELECT ${USER_COLUMNS} FROM "user" WHERE id=? LIMIT 1`).bind(id).first<UserRow>();

/** Better Auth session とCloudflare Accessが共有する本人DTOの唯一の組立て口。 */
export async function findAccountUserDetails(
  db: D1Database,
  userId: string,
): Promise<AccountUserDetails | null> {
  const user = await findUserById(db, userId);
  if (!user) return null;
  const accounts = await db
    .prepare(
      `SELECT id,"providerId" AS providerId FROM account
        WHERE "userId"=? AND "providerId" IN ('credential','google') ORDER BY "providerId",id`,
    )
    .bind(userId)
    .all<{ id: string; providerId: 'credential' | 'google' }>();
  const authAccounts = accounts.results ?? [];
  return {
    ...toPublicUser(user),
    twoFactorEnabled: user.twoFactorEnabled === 1,
    providers: authAccounts.map(({ providerId }) => providerId),
    authAccounts,
  };
}

export const listUsers = async (db: D1Database): Promise<UserRow[]> => {
  const result = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM "user" ORDER BY "createdAt",id`)
    .all<UserRow>();
  return result.results ?? [];
};

/** パスワードの資格情報。Google だけで入る利用者には無い。 */
export const findCredentialHash = async (db: D1Database, userId: string): Promise<string | null> =>
  (await db
    .prepare(`SELECT password FROM account WHERE "userId"=? AND "providerId"='credential' LIMIT 1`)
    .bind(userId)
    .first<string>('password')) ?? null;

/**
 * role/statusを1文で更新し、最後の有効adminを失わせる要求はWHEREで原子的に0件化する。
 * 事前countを置かないため、並行した降格・停止でも不変条件が破れない。
 */
export const prepareUserAdminUpdate = (
  db: D1Database,
  userId: string,
  next: { role?: UserRole; status?: UserStatus },
  now: string,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE "user"
         SET role=COALESCE(?,role),
             status=COALESCE(?,status),
             "updatedAt"=?
       WHERE id=?
         AND NOT (
           role='admin' AND status='active'
           AND (COALESCE(?,role)<>'admin' OR COALESCE(?,status)<>'active')
           AND NOT EXISTS (
             SELECT 1 FROM "user" AS other
              WHERE other.id<>"user".id AND other.role='admin' AND other.status='active'
           )
         )`,
    )
    .bind(next.role ?? null, next.status ?? null, now, userId, next.role ?? null, next.status ?? null);

/**
 * 停止した利用者、またはmemberからadminへ昇格する利用者のセッションを消す。
 * 昇格前のmember sessionを残すとMFAを経ずにadmin権限へ変わるため、再認証を必須にする。
 */
export const prepareSuspendedSessionPurge = (
  db: D1Database,
  userId: string,
  purgeForAdminPromotion = false,
): D1PreparedStatement =>
  db
    .prepare(
      `DELETE FROM session WHERE "userId"=?
         AND (?=1 OR EXISTS (SELECT 1 FROM "user" WHERE id=? AND status='suspended'))`,
    )
    .bind(userId, purgeForAdminPromotion ? 1 : 0, userId);
