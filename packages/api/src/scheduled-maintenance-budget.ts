/**
 * 夜間 scheduledMaintenance 全体の D1 query 予算。
 *
 * Cloudflare Workers Free は 1 invocation 50 queries が上限である。各 job が個別に
 * 「50未満」を名乗っても同じ invocation では合算されるため、ここで7 jobを一度だけ
 * 合成する。batch() も中の statement 数で数える。
 */

/** 上限そのものは使い切らず、常に 1 query 以上を残す。 */
export const SCHEDULED_D1_QUERY_LIMIT = 50;
export const SCHEDULED_D1_QUERY_ACCEPTED_MAX = SCHEDULED_D1_QUERY_LIMIT - 1;

/** 現行 job 群の安全側上限。新規 job は既存枠を再配分しない限り追加できない。 */
export const SCHEDULED_D1_QUERY_PLAN_MAX = 46;

/** attachment reconciler は通常上限10件を保ち、夜間経路だけ3件へ絞る。 */
export const SCHEDULED_ATTACHMENT_JOB_LIMIT = 3;

export const SCHEDULED_MAINTENANCE_JOB_NAMES = [
  'nightly_backup',
  'attachment_maintenance',
  'password_login_rate_limit_cleanup',
  'improvement_retention',
  'deletion_undo_retention',
  'audit_header_retention',
  'audit_detail_retention',
] as const;

export type ScheduledMaintenanceJobName = (typeof SCHEDULED_MAINTENANCE_JOB_NAMES)[number];

export class ScheduledMaintenanceBudgetError extends Error {
  constructor(
    readonly code: 'job_set' | 'query_count' | 'query_limit',
    readonly planned: number,
  ) {
    // job名以外の利用者情報・金融内容・R2 keyを載せない。
    super(`invalid scheduled maintenance budget: code=${code} planned=${planned}`);
    this.name = 'ScheduledMaintenanceBudgetError';
  }
}

export interface ScheduledMaintenanceD1Plan {
  readonly jobs: Readonly<Record<ScheduledMaintenanceJobName, number>>;
  readonly total: number;
  readonly limit: number;
  readonly acceptedMax: number;
}

/**
 * 宣言漏れ・未知job・非整数・50到達をfail-closedにする。
 * テストから壊れた候補を直接渡せるよう、module初期化だけに検査を埋め込まない。
 */
export function planScheduledMaintenanceD1Queries(
  candidate: Readonly<Record<string, number>>,
): ScheduledMaintenanceD1Plan {
  const expected = new Set<string>(SCHEDULED_MAINTENANCE_JOB_NAMES);
  const actual = Object.keys(candidate);
  if (
    actual.length !== SCHEDULED_MAINTENANCE_JOB_NAMES.length ||
    actual.some((name) => !expected.has(name)) ||
    SCHEDULED_MAINTENANCE_JOB_NAMES.some((name) => !(name in candidate))
  )
    throw new ScheduledMaintenanceBudgetError('job_set', 0);

  const values = SCHEDULED_MAINTENANCE_JOB_NAMES.map((name) => candidate[name]);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 1))
    throw new ScheduledMaintenanceBudgetError('query_count', 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total > SCHEDULED_D1_QUERY_PLAN_MAX || total > SCHEDULED_D1_QUERY_ACCEPTED_MAX)
    throw new ScheduledMaintenanceBudgetError('query_limit', total);

  return Object.freeze({
    jobs: Object.freeze({ ...candidate }) as Readonly<Record<ScheduledMaintenanceJobName, number>>,
    total,
    limit: SCHEDULED_D1_QUERY_LIMIT,
    acceptedMax: SCHEDULED_D1_QUERY_ACCEPTED_MAX,
  });
}

export const SCHEDULED_MAINTENANCE_D1_PLAN = planScheduledMaintenanceD1Queries({
  // loadBackupPayload は全canonical tableを1 statement snapshotで読む。
  nightly_backup: 1,
  // retention enqueue(1) + due scan(1) + 3 job × worst 6 statements。
  attachment_maintenance: 2 + 6 * SCHEDULED_ATTACHMENT_JOB_LIMIT,
  password_login_rate_limit_cleanup: 1,
  // due scan(1) + R2成功IDの集合更新(1) + orphan照合(1)。
  improvement_retention: 3,
  // expired sweep(6) + bytes(1) + capacity候補(1) + early sweep(4)。
  deletion_undo_retention: 12,
  // before metrics + expired delete + after metrics。
  audit_header_retention: 3,
  // headerと同じ3本 + capacity候補 + delete + final metrics。
  audit_detail_retention: 6,
});
