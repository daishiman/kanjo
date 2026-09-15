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

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  session_generation: number;
  must_change_password: number;
  temporary_password_expires_at: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

/** 外向けの利用者表現。password_hash を含めない型として定義し、漏らす経路を型で塞ぐ。 */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  mustChangePassword: row.must_change_password === 1,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
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

/** 保存済みハッシュのパラメータが現行より弱いとき真。ログイン成功時の静かな再ハッシュに使う。 */
export const needsRehash = (stored: string): boolean => {
  const parsed = parseHash(stored);
  return !parsed || parsed.iterations < PBKDF2_ITERATIONS;
};

/**
 * アカウント不在でも所要時間差を作らないための捨てハッシュ。
 * 早期 return するとメールアドレスの存否が応答時間だけで漏れる。
 */
const DUMMY_HASH_PROMISE = hashPassword('kanjo:absent-account:timing-equalizer');
export async function equalizeAbsentAccountTiming(password: string): Promise<false> {
  await verifyPasswordHash(password, await DUMMY_HASH_PROMISE);
  // 常に false。呼び出し側が「照合した結果、不一致だった」と同じ形で扱えるようにする。
  return false;
}

/** 一時パスワードは人が転記できる形にする。紛らわしい文字(0/O, 1/l/I)は入れない。 */
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export function generateTemporaryPassword(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((value) => TEMP_ALPHABET[value % TEMP_ALPHABET.length]).join('');
}

export const newUserId = (): string => crypto.randomUUID().replace(/-/g, '');

/** 一時資格情報は現在の users.password_hash と同じ行だけを正本にする。 */
export const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export const temporaryPasswordExpiresAt = (issuedAt: string): string =>
  new Date(Date.parse(issuedAt) + TEMPORARY_PASSWORD_TTL_MS).toISOString();

export const isTemporaryPasswordActive = (user: UserRow, now: string): boolean =>
  user.must_change_password !== 1 ||
  (user.temporary_password_expires_at !== null && user.temporary_password_expires_at > now);

/**
 * 一時資格情報の初回使用を原子的に消費する。
 * password_hashと期限をCAS条件に含め、同じ資格情報で並行した要求は1本だけ成功させる。
 */
export const consumeTemporaryPassword = (
  db: D1Database,
  user: Pick<
    UserRow,
    'id' | 'password_hash' | 'session_generation' | 'must_change_password' | 'temporary_password_expires_at'
  >,
  nextPasswordHash: string,
  now: string,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE users
          SET password_hash=?, temporary_password_expires_at=NULL,
              session_generation=session_generation+1, last_login_at=?, updated_at=?
        WHERE id=? AND password_hash=? AND session_generation=? AND must_change_password=1
          AND temporary_password_expires_at=? AND temporary_password_expires_at>?`,
    )
    .bind(
      nextPasswordHash,
      now,
      now,
      user.id,
      user.password_hash,
      user.session_generation,
      user.temporary_password_expires_at,
      now,
    )
    .run();

const USER_COLUMNS =
  'id,email,password_hash,role,status,session_generation,must_change_password,temporary_password_expires_at,created_at,updated_at,last_login_at';

export const findUserByEmail = (db: D1Database, email: string): Promise<UserRow | null> =>
  db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email=? LIMIT 1`)
    .bind(normalizeEmail(email))
    .first<UserRow>();

export const findUserById = (db: D1Database, id: string): Promise<UserRow | null> =>
  db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id=? LIMIT 1`).bind(id).first<UserRow>();

export const listUsers = async (db: D1Database): Promise<UserRow[]> => {
  const result = await db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at,id`).all<UserRow>();
  return result.results ?? [];
};

/** 締め出しは復旧コストが最も高い失敗モード。最後の有効な admin を失う操作は構造で止める。 */
export interface CreateUserInput {
  db: D1Database;
  email: string;
  passwordHash: string;
  role: UserRole;
  mustChangePassword: boolean;
  now: string;
}

/** 招待する利用者の行とINSERTを同時に作り、監査文と同じbatchへ渡せる形にする。 */
export function prepareUserInvitation(input: CreateUserInput): {
  user: UserRow;
  statement: D1PreparedStatement;
} {
  const id = newUserId();
  const expiresAt = temporaryPasswordExpiresAt(input.now);
  const statement = input.db
    .prepare(
      `INSERT INTO users
         (id,email,password_hash,role,status,session_generation,must_change_password,temporary_password_expires_at,created_at,updated_at,last_login_at)
       VALUES (?,?,?,?,'active',1,?,?,?, ?,NULL)`,
    )
    .bind(
      id,
      normalizeEmail(input.email),
      input.passwordHash,
      input.role,
      input.mustChangePassword ? 1 : 0,
      input.mustChangePassword ? expiresAt : null,
      input.now,
      input.now,
    );
  return {
    statement,
    user: {
      id,
      email: normalizeEmail(input.email),
      password_hash: input.passwordHash,
      role: input.role,
      status: 'active',
      session_generation: 1,
      must_change_password: input.mustChangePassword ? 1 : 0,
      temporary_password_expires_at: input.mustChangePassword ? expiresAt : null,
      created_at: input.now,
      updated_at: input.now,
      last_login_at: null,
    },
  };
}

/**
 * パスワードを差し替え、同時に世代を進める。
 * 変更・再発行・停止のいずれでも既存セッションが即時に無効になるのは、この1カラムの効果。
 */
export const preparePasswordUpdateAndRevoke = (
  db: D1Database,
  userId: string,
  passwordHash: string,
  mustChangePassword: boolean,
  now: string,
): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE users
         SET password_hash=?, must_change_password=?, temporary_password_expires_at=?,
             session_generation=session_generation+1, updated_at=?
       WHERE id=?`,
    )
    .bind(
      passwordHash,
      mustChangePassword ? 1 : 0,
      mustChangePassword ? temporaryPasswordExpiresAt(now) : null,
      now,
      userId,
    );

/**
 * パスワードを変えずにセッションだけを一括失効させる。ログアウトが使う。
 *
 * Cookie の削除は「このブラウザに忘れさせる」だけで、複製された Cookie には効かない。
 * ログアウトを封じ込め手段として扱う以上、サーバー側の世代を進めて初めて契約を満たす。
 */
export const revokeSessions = (db: D1Database, userId: string, now: string): Promise<D1Result> =>
  db
    .prepare('UPDATE users SET session_generation=session_generation+1, updated_at=? WHERE id=?')
    .bind(now, userId)
    .run();

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
      `UPDATE users
         SET role=COALESCE(?,role),
             status=COALESCE(?,status),
             session_generation=CASE
               WHEN COALESCE(?,status)='suspended' AND status<>'suspended'
                 THEN session_generation+1
               ELSE session_generation
             END,
             updated_at=?
       WHERE id=?
         AND NOT (
           role='admin' AND status='active'
           AND (COALESCE(?,role)<>'admin' OR COALESCE(?,status)<>'active')
           AND NOT EXISTS (
             SELECT 1 FROM users AS other
              WHERE other.id<>users.id AND other.role='admin' AND other.status='active'
           )
         )`,
    )
    .bind(
      next.role ?? null,
      next.status ?? null,
      next.status ?? null,
      now,
      userId,
      next.role ?? null,
      next.status ?? null,
    );

export const recordLogin = (db: D1Database, userId: string, now: string): Promise<D1Result> =>
  db.prepare('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?').bind(now, now, userId).run();

export const rehashStoredPassword = (
  db: D1Database,
  userId: string,
  passwordHash: string,
  now: string,
): Promise<D1Result> =>
  db
    .prepare('UPDATE users SET password_hash=?, updated_at=? WHERE id=?')
    .bind(passwordHash, now, userId)
    .run();

/** 期限切れ一時資格情報を最大100件ずつ明示的に失効する。password_hash自体は復元不能なまま残す。 */
export const cleanupExpiredTemporaryPasswords = async (
  db: D1Database,
  now = new Date().toISOString(),
): Promise<number> => {
  const result = await db
    .prepare(
      `UPDATE users SET temporary_password_expires_at=NULL,updated_at=?
        WHERE id IN (
          SELECT id FROM users
           WHERE must_change_password=1 AND temporary_password_expires_at<=?
           ORDER BY temporary_password_expires_at,id LIMIT 100
        )`,
    )
    .bind(now, now)
    .run();
  return result.meta.changes ?? 0;
};
