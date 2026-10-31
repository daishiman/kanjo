/** 期限付き認証artifactを1日1種類、index順に最大100件だけ削除する。4日で全表を巡回する。 */
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
): Promise<{ kind: AuthArtifactKind; deleted: number }> {
  const day = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  const kind = kinds[((day % kinds.length) + kinds.length) % kinds.length]!;
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
