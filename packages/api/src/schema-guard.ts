import type { MiddlewareHandler } from 'hono';

/** Workerが前提とするD1 schema head。migration追加時はテストが更新漏れを検知する。 */
export const EXPECTED_D1_MIGRATION = '0026_balance_entries.sql';

export const SCHEMA_UNAVAILABLE_ERROR = {
  code: 'schema_unavailable',
  message: 'システムの復旧作業中です。時間をおいてもう一度お試しください',
} as const;

type SchemaState = 'ready' | 'behind' | 'inspection_error';
type SchemaGuardEnv = { Bindings: { DB: D1Database } };

const migrationVersion = (name: string | null): number | null => {
  const match = name?.match(/^(\d+)_.*\.sql$/);
  if (!match) return null;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : null;
};

async function inspectSchema(database: D1Database): Promise<SchemaState> {
  try {
    const applied = await database
      .prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1')
      .first<string>('name');
    const expectedVersion = migrationVersion(EXPECTED_D1_MIGRATION);
    const appliedVersion = migrationVersion(applied);
    return expectedVersion !== null &&
      appliedVersion !== null &&
      (appliedVersion > expectedVersion ||
        (appliedVersion === expectedVersion && applied === EXPECTED_D1_MIGRATION))
      ? 'ready'
      : 'behind';
  } catch {
    return 'inspection_error';
  }
}

/**
 * 認証後・業務D1アクセス前に使うfail-closed guard。
 * cacheはrequestやPromiseを持たず、判定結果と期限のscalarだけを保持する。
 */
export function createSchemaGuard({
  now = Date.now,
  ttlMs = 30_000,
}: {
  now?: () => number;
  ttlMs?: number;
} = {}): MiddlewareHandler<SchemaGuardEnv> {
  let cachedState: SchemaState | null = null;
  let cacheExpiresAt = 0;

  return async (c, next) => {
    const currentTime = now();
    if (cachedState === null || currentTime >= cacheExpiresAt) {
      cachedState = await inspectSchema(c.env.DB);
      cacheExpiresAt = currentTime + ttlMs;
    }
    if (cachedState === 'ready') {
      await next();
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'schema_guard_blocked',
        code: SCHEMA_UNAVAILABLE_ERROR.code,
        reason: cachedState,
      }),
    );
    return c.json({ error: SCHEMA_UNAVAILABLE_ERROR }, 503);
  };
}

/** セッション/トークン経路で同じ判定cacheを共有する。 */
export const runtimeSchemaGuard = createSchemaGuard();
