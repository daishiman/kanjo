import type { MiddlewareHandler } from 'hono';

/** Workerが前提とするD1 schema head。migration追加時はテストが更新漏れを検知する。 */
export const EXPECTED_D1_MIGRATION = '0038_prepare_r2_cleanup.sql';

export const SCHEMA_UNAVAILABLE_ERROR = {
  code: 'schema_unavailable',
  message: 'システムの復旧作業中です。時間をおいてもう一度お試しください',
} as const;

type SchemaState = 'ready' | 'behind' | 'inspection_error';
/** 判定と、そう判定した根拠(適用済みhead)。根拠は運用ログにだけ載せ、応答本文には出さない。 */
type SchemaInspection = { state: SchemaState; applied: string | null };
type SchemaGuardEnv = { Bindings: { DB: D1Database } };

const migrationVersion = (name: string | null): number | null => {
  const match = name?.match(/^(\d+)_.*\.sql$/);
  if (!match) return null;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : null;
};

async function inspectSchema(database: D1Database): Promise<SchemaInspection> {
  try {
    const applied = await database
      .prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1')
      .first<string>('name');
    const expectedVersion = migrationVersion(EXPECTED_D1_MIGRATION);
    const appliedVersion = migrationVersion(applied);
    const ready =
      expectedVersion !== null &&
      appliedVersion !== null &&
      (appliedVersion > expectedVersion ||
        (appliedVersion === expectedVersion && applied === EXPECTED_D1_MIGRATION));
    return { state: ready ? 'ready' : 'behind', applied: applied ?? null };
  } catch {
    return { state: 'inspection_error', applied: null };
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
  let cached: SchemaInspection | null = null;
  let cacheExpiresAt = 0;

  return async (c, next) => {
    const currentTime = now();
    if (cached === null || currentTime >= cacheExpiresAt) {
      cached = await inspectSchema(c.env.DB);
      cacheExpiresAt = currentTime + ttlMs;
    }
    if (cached.state === 'ready') {
      await next();
      return;
    }
    /*
      止めた理由をログにだけ残す。応答本文は利用者向けの一文に固定しており(内部情報を出さない)、
      そこだけを見ても「DBのmigrationが古い」と分からず原因に辿り着けなかった。
      期待headと適用headを並べれば、開発中なら `pnpm --filter @kanjo/api migrate:local` で復帰できる。
    */
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'schema_guard_blocked',
        code: SCHEMA_UNAVAILABLE_ERROR.code,
        reason: cached.state,
        expectedMigration: EXPECTED_D1_MIGRATION,
        appliedMigration: cached.applied,
      }),
    );
    return c.json({ error: SCHEMA_UNAVAILABLE_ERROR }, 503);
  };
}

/** セッション/トークン経路で同じ判定cacheを共有する。 */
export const runtimeSchemaGuard = createSchemaGuard();
