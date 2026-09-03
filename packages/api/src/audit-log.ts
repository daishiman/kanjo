/**
 * D8 の二層監査記録。
 *
 * 操作ヘッダは長期保持に必要な事実だけ、判定明細は属性ごとの根拠だけを持つ。
 * 明細本体・金額・生の明細IDはどちらにも書かない。
 * builder は実行せず D1PreparedStatement[] を返すので、delete / undo /
 * import-resolution の正本書込みと同じ D1 batch へそのまま追加できる。
 */

export const AUDIT_ACTIONS = ['delete', 'undo', 'import_resolution', 'import_discard'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESULTS = ['succeeded', 'failed', 'rejected'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const AUDIT_ATTRIBUTES = ['cls', 'category_major', 'category_mid', 'owner'] as const;
export type AuditAttribute = (typeof AUDIT_ATTRIBUTES)[number];

export const AUDIT_SOURCE_TYPES = [
  'tx_edit',
  'rule',
  'vendor_memory',
  'import',
  'default',
  'user_resolution',
  'system',
] as const;
export type AuditSourceType = (typeof AUDIT_SOURCE_TYPES)[number];

/** 操作ヘッダが持ってよいのは件数だけ。新しい件数名はここで明示的に追加する。 */
export const AUDIT_COUNT_KEYS = [
  'affected',
  'added',
  'attachments',
  'autoApplied',
  'balanceEntries',
  'candidates',
  'cashEntries',
  'changed',
  'conflicts',
  'deleted',
  'freeeDeals',
  'imports',
  'incoming',
  'inserted',
  'kept',
  'mfTx',
  'months',
  'operations',
  'overrides',
  'remembered',
  'resolved',
  'restoredMonthlyAgg',
  'targets',
  'txEdits',
  'txSplits',
  'unchanged',
  'updated',
] as const;
export type AuditCountKey = (typeof AUDIT_COUNT_KEYS)[number];

export type AuditScope =
  | { kind: 'transaction' }
  | { kind: 'import'; importId?: number }
  | { kind: 'period'; from: string; to: string }
  | { kind: 'all' };

export interface AuditDetailInput {
  /** `opaqueAuditTransactionKey` で作った値だけを受ける。 */
  txKey: string;
  attribute: AuditAttribute;
  before: string | null;
  after: string | null;
  /** 自由文ではなく snake_case の理由コード。 */
  reason: string;
  sourceType: AuditSourceType;
  /** 元のベンダー名等ではなく `opaqueAuditSourceKey` の戻り値。 */
  sourceKey?: string | null;
}

export interface AuditWriteInput {
  database: D1Database;
  auditId: string;
  userId: string;
  /** delete/undoのoperation ID、またはimport-resolutionのrun ID。 */
  operationId: string;
  action: AuditAction;
  scope: AuditScope;
  counts: Partial<Record<AuditCountKey, number>>;
  occurredAt: string;
  result: AuditResult;
  details?: readonly AuditDetailInput[];
}

export interface AuditStatementPlan {
  auditId: string;
  operationId: string;
  statements: D1PreparedStatement[];
  headerStatements: 1;
  detailStatements: number;
  detailCount: number;
  queryCount: number;
}

export class AuditValidationError extends Error {
  constructor(readonly code: string) {
    // 明細値を message に含めない。エラーログからの逆流出を防ぐ。
    super(`invalid audit record: ${code}`);
    this.name = 'AuditValidationError';
  }
}

const AUDIT_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const OPAQUE_TX_KEY = /^v1:[0-9a-f]{64}$/;
const REASON_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_DETAIL_VALUE_LENGTH = 120;
const DETAIL_JSON_CHUNK_BYTES = 80 * 1024;
const MAX_AUDIT_QUERY_COUNT = 48;

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;
const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

const validateId = (value: string, code: string): void => {
  if (!AUDIT_ID.test(value)) throw new AuditValidationError(code);
};

const validateTenantId = (value: string): void => {
  if (!value || value.length > 100 || hasControlCharacter(value)) throw new AuditValidationError('user_id');
};

const validateIso = (value: string): void => {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value)
    throw new AuditValidationError('occurred_at');
};

const scopeText = (scope: AuditScope): string => {
  switch (scope.kind) {
    case 'transaction':
      // 対象明細IDをヘッダに出さない。件数は counts で分かる。
      return 'transaction';
    case 'import':
      if (scope.importId === undefined) return 'import';
      if (!Number.isSafeInteger(scope.importId) || scope.importId < 1)
        throw new AuditValidationError('scope_import');
      return `import:${scope.importId}`;
    case 'period':
      if (!MONTH.test(scope.from) || !MONTH.test(scope.to) || scope.from > scope.to)
        throw new AuditValidationError('scope_period');
      return `period:${scope.from}..${scope.to}`;
    case 'all':
      return 'all';
  }
};

const countsJson = (counts: AuditWriteInput['counts']): string => {
  const allowed = new Set<string>(AUDIT_COUNT_KEYS);
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length > AUDIT_COUNT_KEYS.length) throw new AuditValidationError('counts_keys');
  for (const [key, value] of entries) {
    if (!allowed.has(key)) throw new AuditValidationError('counts_key');
    if (!Number.isSafeInteger(value) || value < 0) throw new AuditValidationError('counts_value');
  }
  const encoded = JSON.stringify(Object.fromEntries(entries));
  if (encoded.length > 512) throw new AuditValidationError('counts_size');
  return encoded;
};

const validateDetail = (detail: AuditDetailInput): void => {
  if (!OPAQUE_TX_KEY.test(detail.txKey)) throw new AuditValidationError('tx_key');
  if (!(AUDIT_ATTRIBUTES as readonly string[]).includes(detail.attribute))
    throw new AuditValidationError('attribute');
  for (const value of [detail.before, detail.after]) {
    if (value !== null && (value.length > MAX_DETAIL_VALUE_LENGTH || hasControlCharacter(value)))
      throw new AuditValidationError('attribute_value');
  }
  if (!REASON_CODE.test(detail.reason)) throw new AuditValidationError('reason_code');
  if (!(AUDIT_SOURCE_TYPES as readonly string[]).includes(detail.sourceType))
    throw new AuditValidationError('source_type');
  const sourceKey = detail.sourceKey ?? null;
  const needsSourceKey = ['tx_edit', 'rule', 'vendor_memory', 'user_resolution'].includes(detail.sourceType);
  if (needsSourceKey && !sourceKey) throw new AuditValidationError('source_key_required');
  if (sourceKey && !new RegExp(`^${detail.sourceType}:v1:[0-9a-f]{64}$`).test(sourceKey))
    throw new AuditValidationError('source_key');
};

/** 行境界で分け、1文のJSON bindを80KiB以下に保つ。保存先にJSON列は作らない。 */
const chunkDetails = (rows: ReadonlyArray<readonly unknown[]>): string[] => {
  const chunks: string[] = [];
  let items: string[] = [];
  let bytes = 2;
  for (const row of rows) {
    const encoded = JSON.stringify(row);
    const rowBytes = byteLength(encoded);
    if (rowBytes + 2 > DETAIL_JSON_CHUNK_BYTES) throw new AuditValidationError('detail_row_size');
    const separator = items.length ? 1 : 0;
    if (items.length && bytes + separator + rowBytes > DETAIL_JSON_CHUNK_BYTES) {
      chunks.push(`[${items.join(',')}]`);
      items = [];
      bytes = 2;
    }
    items.push(encoded);
    bytes += rowBytes + (items.length > 1 ? 1 : 0);
  }
  if (items.length) chunks.push(`[${items.join(',')}]`);
  return chunks;
};

/**
 * ヘッダ1文+属性明細のまとめ書き文を作る。ここではDBに触れない。
 * 呼び出し側は `plan.statements` を正本書込みと同じ `database.batch(...)`
 * へ追加し、既存のquery plannerに `plan.queryCount` を足す。
 */
export function buildAuditStatements(input: AuditWriteInput): AuditStatementPlan {
  validateId(input.auditId, 'audit_id');
  validateTenantId(input.userId);
  validateId(input.operationId, 'operation_id');
  if (!(AUDIT_ACTIONS as readonly string[]).includes(input.action)) throw new AuditValidationError('action');
  if (!(AUDIT_RESULTS as readonly string[]).includes(input.result)) throw new AuditValidationError('result');
  validateIso(input.occurredAt);
  const scope = scopeText(input.scope);
  const counts = countsJson(input.counts);
  const details = input.details ?? [];
  for (const detail of details) validateDetail(detail);

  const detailChunks = chunkDetails(
    details.map((detail) => [
      detail.txKey,
      detail.attribute,
      detail.before,
      detail.after,
      detail.reason,
      detail.sourceType,
      detail.sourceKey ?? null,
    ]),
  );
  const queryCount = 1 + detailChunks.length;
  if (queryCount > MAX_AUDIT_QUERY_COUNT) throw new AuditValidationError('query_budget');

  const header = input.database
    .prepare(
      `INSERT INTO audit_log
         (id,user_id,operation_id,action,scope,counts_json,occurred_at,result)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(
      input.auditId,
      input.userId,
      input.operationId,
      input.action,
      scope,
      counts,
      input.occurredAt,
      input.result,
    );
  const detailStatements = detailChunks.map((payload) =>
    input.database
      .prepare(
        `INSERT INTO audit_log_detail
           (audit_id,user_id,tx_key,attribute,before_value,after_value,reason_code,source_type,source_key,occurred_at)
         SELECT ?,?,
                CAST(json_extract(item.value,'$[0]') AS TEXT),
                CAST(json_extract(item.value,'$[1]') AS TEXT),
                json_extract(item.value,'$[2]'),
                json_extract(item.value,'$[3]'),
                CAST(json_extract(item.value,'$[4]') AS TEXT),
                CAST(json_extract(item.value,'$[5]') AS TEXT),
                json_extract(item.value,'$[6]'),?
           FROM json_each(?) AS item`,
      )
      .bind(input.auditId, input.userId, input.occurredAt, payload),
  );

  return {
    auditId: input.auditId,
    operationId: input.operationId,
    statements: [header, ...detailStatements],
    headerStatements: 1,
    detailStatements: detailStatements.length,
    detailCount: details.length,
    queryCount,
  };
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** 利用者・操作間で同じidentityを照合できない、同一操作内の属性相関用key。 */
export async function opaqueAuditTransactionKey(
  userId: string,
  operationId: string,
  txIdentity: string,
): Promise<string> {
  if (!userId || !operationId || !txIdentity) throw new AuditValidationError('tx_identity');
  return `v1:${await sha256Hex(`${userId}\u0000${operationId}\u0000${txIdentity}`)}`;
}

/** rule/vendor名等の生値を detail へ書かないための不透明 source key。 */
export async function opaqueAuditSourceKey(
  userId: string,
  sourceType: AuditSourceType,
  sourceIdentity: string,
): Promise<string> {
  if (!(AUDIT_SOURCE_TYPES as readonly string[]).includes(sourceType) || !userId || !sourceIdentity)
    throw new AuditValidationError('source_identity');
  return `${sourceType}:v1:${await sha256Hex(`${userId}\u0000${sourceType}\u0000${sourceIdentity}`)}`;
}

export const AUDIT_HEADER_RETENTION_DAYS = 400;
export const AUDIT_DETAIL_RETENTION_DAYS = 90;
export const AUDIT_DETAIL_BUDGET_BYTES = 300 * 1024 * 1024;
/** 1回で消す行の上限。ID bindはD1の100個制限内。残りは次回が拾う。 */
export const AUDIT_RETENTION_BATCH = 80;

export interface AuditLayerMetrics {
  rows: number;
  /** 列のUTF-8 byte数+固定overheadの安全側概算。明細値そのものは読み出さない。 */
  bytes: number;
}

export interface AuditRetentionResult {
  layer: 'header' | 'detail';
  expired: number;
  /** 容量上限のため保持期限前に消した行数。headerは常0。 */
  early: number;
  before: AuditLayerMetrics;
  after: AuditLayerMetrics;
  queries: number;
}

const HEADER_BYTES = `96
  + length(CAST(id AS BLOB))
  + length(CAST(user_id AS BLOB))
  + length(CAST(operation_id AS BLOB))
  + length(CAST(action AS BLOB))
  + length(CAST(scope AS BLOB))
  + length(CAST(counts_json AS BLOB))
  + length(CAST(occurred_at AS BLOB))
  + length(CAST(result AS BLOB))`;
const DETAIL_BYTES = `96
  + length(CAST(audit_id AS BLOB))
  + length(CAST(user_id AS BLOB))
  + length(CAST(tx_key AS BLOB))
  + length(CAST(attribute AS BLOB))
  + coalesce(length(CAST(before_value AS BLOB)),0)
  + coalesce(length(CAST(after_value AS BLOB)),0)
  + length(CAST(reason_code AS BLOB))
  + length(CAST(source_type AS BLOB))
  + coalesce(length(CAST(source_key AS BLOB)),0)
  + length(CAST(occurred_at AS BLOB))`;

const retentionCutoff = (now: string, days: number): string => {
  validateIso(now);
  if (!Number.isSafeInteger(days) || days < 1) throw new AuditValidationError('retention_days');
  return new Date(Date.parse(now) - days * 24 * 60 * 60 * 1000).toISOString();
};

const readMetrics = async (
  database: D1Database,
  table: 'audit_log' | 'audit_log_detail',
  expression: string,
): Promise<AuditLayerMetrics> => {
  const row = await database
    .prepare(`SELECT count(*) AS rows, coalesce(sum(${expression}),0) AS bytes FROM ${table}`)
    .first<{ rows: number; bytes: number }>();
  return { rows: Number(row?.rows ?? 0), bytes: Number(row?.bytes ?? 0) };
};

/** audit_log の400日保持。detail/undo退避の掃除は呼ばない。 */
export async function runAuditHeaderRetention(
  env: { DB: D1Database },
  now = new Date().toISOString(),
  limit = AUDIT_RETENTION_BATCH,
): Promise<AuditRetentionResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > AUDIT_RETENTION_BATCH)
    throw new AuditValidationError('retention_limit');
  const before = await readMetrics(env.DB, 'audit_log', HEADER_BYTES);
  const deleted = await env.DB.prepare(
    `DELETE FROM audit_log
        WHERE id IN (
          SELECT id FROM audit_log WHERE occurred_at <= ? ORDER BY occurred_at,id LIMIT ?
        )`,
  )
    .bind(retentionCutoff(now, AUDIT_HEADER_RETENTION_DAYS), limit)
    .run();
  const after = await readMetrics(env.DB, 'audit_log', HEADER_BYTES);
  return {
    layer: 'header',
    expired: Number(deleted.meta.changes ?? 0),
    early: 0,
    before,
    after,
    queries: 3,
  };
}

/**
 * audit_log_detail の90日保持と300MB上限。header/undo退避の掃除は呼ばない。
 * 期限分を掃除しても上限以上なら、期限内の古い行を一度に最大80行だけ掃除する。
 */
export async function runAuditDetailRetention(
  env: { DB: D1Database },
  now = new Date().toISOString(),
  limit = AUDIT_RETENTION_BATCH,
  budgetBytes = AUDIT_DETAIL_BUDGET_BYTES,
): Promise<AuditRetentionResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > AUDIT_RETENTION_BATCH)
    throw new AuditValidationError('retention_limit');
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 1)
    throw new AuditValidationError('retention_budget');

  let queries = 0;
  const before = await readMetrics(env.DB, 'audit_log_detail', DETAIL_BYTES);
  queries += 1;
  const expiredDelete = await env.DB.prepare(
    `DELETE FROM audit_log_detail
        WHERE id IN (
          SELECT id FROM audit_log_detail WHERE occurred_at <= ? ORDER BY occurred_at,id LIMIT ?
        )`,
  )
    .bind(retentionCutoff(now, AUDIT_DETAIL_RETENTION_DAYS), limit)
    .run();
  queries += 1;
  let after = await readMetrics(env.DB, 'audit_log_detail', DETAIL_BYTES);
  queries += 1;
  let early = 0;

  if (after.rows > 0 && after.bytes >= budgetBytes) {
    const candidates = await env.DB.prepare(
      `SELECT id, ${DETAIL_BYTES} AS bytes
           FROM audit_log_detail
          ORDER BY occurred_at,id
          LIMIT ?`,
    )
      .bind(limit)
      .all<{ id: number; bytes: number }>();
    queries += 1;
    const ids: number[] = [];
    let projectedBytes = after.bytes;
    for (const row of candidates.results ?? []) {
      if (projectedBytes < budgetBytes) break;
      ids.push(row.id);
      projectedBytes -= Number(row.bytes);
    }
    if (ids.length) {
      const holes = ids.map(() => '?').join(',');
      const capacityDelete = await env.DB.prepare(`DELETE FROM audit_log_detail WHERE id IN (${holes})`)
        .bind(...ids)
        .run();
      queries += 1;
      early = Number(capacityDelete.meta.changes ?? 0);
      after = await readMetrics(env.DB, 'audit_log_detail', DETAIL_BYTES);
      queries += 1;
    }
  }

  return {
    layer: 'detail',
    expired: Number(expiredDelete.meta.changes ?? 0),
    early,
    before,
    after,
    queries,
  };
}
