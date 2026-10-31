import { type AuditResult, buildAuditStatements } from './audit-log.js';
import { newRowId } from './auth-tokens.js';
/**
 * ログイン v2 で増えた認証操作の監査 (auth_audit_log, 0050)。
 *
 * audit_log の action CHECK を広げると既存 migration の表を作り直すことになるため、
 * 招待・MFA・再設定・連携は別表に置く (design-decisions K-4)。ログイン/ログアウトの
 * 既存 action は従来どおり audit_log へ書き、画面の監査履歴は両表を合わせて読む。
 *
 * 記録するのは「誰が・誰に・何を・どうなったか」と件数だけ。メール・トークン・コードは書かない。
 */
import { TENANT_ID } from './auth.js';

export const AUTH_AUDIT_ACTIONS = [
  'admin_invite_resend',
  'admin_invite_revoke',
  'auth_invite_accept',
  'auth_invite_resend_request',
  'auth_password_reset_request',
  'auth_password_reset',
  'auth_mfa_setup_issued',
  'auth_mfa_enable',
  'auth_mfa_disable',
  'auth_mfa_backup_code_used',
  'auth_mfa_backup_codes_regenerated',
  'auth_link_add',
  'auth_link_remove',
] as const;
export type AuthAuditAction = (typeof AUTH_AUDIT_ACTIONS)[number];

/** counts_json に置ける鍵。自由な鍵を許すと、いつか本文やメールが紛れ込む。 */
export const AUTH_AUDIT_COUNT_KEYS = [
  'provider_google',
  'provider_password',
  'method_totp',
  'method_backup_code',
  'method_mfa_setup',
  'role_admin',
  'role_member',
  'backup_codes_remaining',
  'sessions_revoked',
  'mail_queued',
] as const;
export type AuthAuditCountKey = (typeof AUTH_AUDIT_COUNT_KEYS)[number];

export interface AuthV2AuditInput {
  action: AuthAuditAction;
  /** 操作した利用者。未ログインの依頼 (再送・再設定) は null。 */
  actorUserId: string | null;
  /** 対象の利用者。無い (存在を明かさない依頼) ときは 'account' だけを書く。 */
  targetUserId?: string | null;
  result: 'succeeded' | 'failed' | 'rejected';
  counts?: Partial<Record<AuthAuditCountKey, number>>;
  occurredAt?: string;
}

const SCOPE_ID = /^[0-9A-Za-z_-]{1,64}$/;

export function buildAuthV2AuditStatement(db: D1Database, input: AuthV2AuditInput): D1PreparedStatement {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.counts ?? {})) {
    if (!(AUTH_AUDIT_COUNT_KEYS as readonly string[]).includes(key)) throw new Error('auth_audit_count_key');
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('auth_audit_count_value');
    counts[key] = value as number;
  }
  const target = input.targetUserId && SCOPE_ID.test(input.targetUserId) ? input.targetUserId : null;
  const id = newRowId();
  return db
    .prepare(
      `INSERT INTO auth_audit_log
         (id,user_id,actor_user_id,operation_id,action,scope,counts_json,occurred_at,result)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      TENANT_ID,
      input.actorUserId,
      id,
      input.action,
      target ? `account:${target}` : 'account',
      JSON.stringify(counts),
      input.occurredAt ?? new Date().toISOString(),
      input.result,
    );
}

/** 本体の書込みと別に積む監査。失敗は隔離し、action と例外名だけを出す。 */
export async function writeAuthV2Audit(db: D1Database, input: AuthV2AuditInput): Promise<void> {
  try {
    await buildAuthV2AuditStatement(db, input).run();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'auth_v2_audit_write',
        action: input.action,
        name: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
}

/** 0033の既存 login/logout action へ、自由文を持たない最小ヘッダだけを書く。 */
export async function writeLegacyAuthAudit(
  db: D1Database,
  input: {
    action: 'auth_login' | 'auth_login_failed' | 'auth_logout' | 'auth_password_change';
    actorUserId: string | null;
    result: AuditResult;
  },
): Promise<void> {
  try {
    const id = newRowId();
    const plan = buildAuditStatements({
      database: db,
      auditId: id,
      operationId: id,
      userId: TENANT_ID,
      actorUserId: input.actorUserId,
      action: input.action,
      scope: { kind: 'account', userId: input.actorUserId ?? undefined },
      counts: {},
      occurredAt: new Date().toISOString(),
      result: input.result,
    });
    await db.batch(plan.statements);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'auth_audit_write',
        action: input.action,
        name: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
}

export const AUTH_AUDIT_RETENTION_DAYS = 400;

/** audit_log と同じ 400 日。index (occurred_at,id) 順に最大 limit 件だけ消す。 */
export async function runAuthAuditRetention(db: D1Database, now = new Date(), limit = 80): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTH_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `DELETE FROM auth_audit_log WHERE id IN (
         SELECT id FROM auth_audit_log WHERE occurred_at<=? ORDER BY occurred_at,id LIMIT ?
       )`,
    )
    .bind(cutoff, limit)
    .run();
  return Number(result.meta.changes ?? 0);
}
