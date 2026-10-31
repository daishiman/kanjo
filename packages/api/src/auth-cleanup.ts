import { runAuthAuditRetention } from './auth-audit.js';
import { cleanupStaleAuthRateLimits } from './auth-rate-limit.js';

/** 期限付き認証artifactを1回1種類、index順に最大100件だけ削除する。 */
export type AuthArtifactKind = 'mfa_setup_token' | 'link_confirmation_token' | 'session' | 'verification';

const kinds: readonly AuthArtifactKind[] = [
  'mfa_setup_token',
  'link_confirmation_token',
  'session',
  'verification',
];

export async function cleanupExpiredAuthArtifacts(
  db: D1Database,
  now = new Date(),
  cycleDay = Math.floor(now.getTime() / (24 * 60 * 60 * 1000)),
): Promise<{ kind: AuthArtifactKind; deleted: number }> {
  const kind = kinds[((cycleDay % kinds.length) + kinds.length) % kinds.length]!;
  const cutoff = now.toISOString();
  const sql =
    kind === 'mfa_setup_token'
      ? `DELETE FROM mfa_setup_token WHERE id IN (
           SELECT id FROM mfa_setup_token WHERE expires_at<=? ORDER BY expires_at,id LIMIT 100)`
      : kind === 'link_confirmation_token'
        ? `DELETE FROM link_confirmation_token WHERE id IN (
             SELECT id FROM link_confirmation_token WHERE expires_at<=? ORDER BY expires_at,id LIMIT 100)`
        : kind === 'session'
          ? `DELETE FROM "session" WHERE id IN (
               SELECT id FROM "session" WHERE "expiresAt"<=? ORDER BY "expiresAt",id LIMIT 100)`
          : `DELETE FROM verification WHERE id IN (
               SELECT id FROM verification WHERE "expiresAt"<=? ORDER BY "expiresAt",id LIMIT 100)`;
  const result = await db.prepare(sql).bind(cutoff).run();
  return { kind, deleted: Number(result.meta.changes ?? 0) };
}

/**
 * 夜間invocationの上限を守り、認証保守は常に2 queriesに収める。
 * rate-limitは毎日、監査の400日超掃除と期限artifactは日替わり。
 * artifactの巡回番号も2日単位に進め、8日で4種類すべてを掃除する。
 * セッション/tokenの有効期限は掃除とは独立して各要求で検証する。
 */
export async function runScheduledAuthCleanup(db: D1Database, now = new Date()) {
  const day = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  const [rateLimitsDeleted, retention] = await Promise.all([
    cleanupStaleAuthRateLimits(db, now.getTime()),
    day % 2 === 0
      ? runAuthAuditRetention(db, now).then((deleted) => ({ kind: 'auth_audit_log' as const, deleted }))
      : cleanupExpiredAuthArtifacts(db, now, Math.floor(day / 2)),
  ]);
  return { rateLimitsDeleted, ...retention };
}
