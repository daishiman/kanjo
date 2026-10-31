import { sql } from 'drizzle-orm';
/** Better Auth が所有する D1 tables の Drizzle 正本。 */
import { customType, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 0059 は既存 D1 runtime と互換な ISO-8601 文字列を保存する。Drizzle の
// timestamp_ms (整数) は使わず、Better Auth の Date と migration の DATE を変換する。
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => 'date',
  fromDriver: (value) => new Date(value),
  toDriver: (value) => value.toISOString(),
});

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: isoDate('createdAt').notNull(),
  updatedAt: isoDate('updatedAt').notNull(),
  twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  status: text('status', { enum: ['active', 'suspended'] }).notNull(),
  lastLoginAt: isoDate('lastLoginAt'),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: isoDate('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: isoDate('createdAt').notNull(),
    updatedAt: isoDate('updatedAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rememberMe: integer('rememberMe', { mode: 'boolean' }),
  },
  (table) => [
    index('session_userId_idx').on(table.userId),
    index('session_expiresAt_idx').on(table.expiresAt),
  ],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: isoDate('accessTokenExpiresAt'),
    refreshTokenExpiresAt: isoDate('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: isoDate('createdAt').notNull(),
    updatedAt: isoDate('updatedAt').notNull(),
  },
  (table) => [
    index('account_userId_idx').on(table.userId),
    uniqueIndex('account_one_credential_per_user_idx')
      .on(table.userId)
      .where(sql`${table.providerId} = 'credential'`),
  ],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: isoDate('expiresAt').notNull(),
    createdAt: isoDate('createdAt').notNull(),
    updatedAt: isoDate('updatedAt').notNull(),
  },
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expiresAt_idx').on(table.expiresAt),
  ],
);

export const twoFactor = sqliteTable(
  'twoFactor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backupCodes').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: integer('verified', { mode: 'boolean' }),
    failedVerificationCount: integer('failedVerificationCount'),
    lockedUntil: isoDate('lockedUntil'),
  },
  (table) => [
    index('twoFactor_secret_idx').on(table.secret),
    uniqueIndex('twoFactor_userId_idx').on(table.userId),
  ],
);

export const authSchema = { user, session, account, verification, twoFactor };
