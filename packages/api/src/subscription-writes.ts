/**
 * サブスク登録の書込みを「操作」として記録する共通部品 (0058)。
 *
 * 書込みは 1 本の D1 batch にまとめ、先頭の文 (a) で操作の行を「現在の revision = baseRevision」の
 * ときだけ入れる。残りの文は全て「この操作の行が在る」ことを条件にするので、版が古ければ batch 全体が
 * 空振りになり、何も変えずに 409 subscription_revision_conflict を返せる。
 * 経路の登録は routes/subs.ts が持つ (字面検査のため、ここでは経路を登録しない)。
 */
import {
  type FreeeDeal,
  type SubscriptionOperationKind as OperationKind,
  SUBSCRIPTION_UNDO_BLOCKED_MESSAGE,
  SUB_VENDOR_ALIASES_MAX,
  SubVendorMergeCycleError,
  type SubVendorRecord,
  type SubsAggRow,
  type SubscriptionOperationRecord,
  type SubscriptionUndoBlockedReason as UndoBlockedReason,
  cashBizDeals,
  projectSubsAggregate,
  resolveVendorMerges,
  vendorKey,
} from '@kanjo/core';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import type { AuthEnv, AuthVariables } from './auth.js';
import { canonicalWriteBusy } from './canonical-mutation-fence.js';
import * as s from './db/schema.js';
import { INVALIDATE_JSON_ACTIVE_SQL } from './import-active.js';
import { PRIVATE_NO_STORE, errorBody } from './public-validation.js';
import {
  d1JsonPayload,
  dealFromRow,
  getDb,
  loadCashEntries,
  loadNormMap,
  normalizeFreeeDeals,
  parseStringArray,
} from './store.js';

export type SubsCtx = { Bindings: AuthEnv; Variables: AuthVariables & RequestIdVariables };
type C = Context<SubsCtx>;
type Statement = ReturnType<AuthEnv['DB']['prepare']>;

export type {
  SubscriptionOperationKind as OperationKind,
  SubscriptionUndoBlockedReason as UndoBlockedReason,
} from '@kanjo/core';

export const ALIASES_MAX = SUB_VENDOR_ALIASES_MAX;
const DAY_MS = 86_400_000;
const UNDO_WINDOW_MS = 30 * DAY_MS;
const PURGE_AFTER_MS = 400 * DAY_MS;
const SWEEP_LIMIT = 50;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;
/** 先の統合の取り消しを止めうる後続の操作の種類。SQL の IN 句もここから作る */
const LATER_KINDS = ['merge', 'vendor_update', 'vendor_delete', 'review_decision'] as const;
/**
 * subs 範囲 (subs:* と subs_other)。再計算で読む範囲と、消して入れ直す範囲は同じでなければならない
 * (ずれると、読まなかった行が消えるか、消さなかった行が二重に残る) ので、両方がこの 1 つを使う。
 */
const SUBS_SCOPE_SQL = "(scope LIKE 'subs:%' OR scope='subs_other')";
/**
 * 利用者の今の revision (書込みがまだ無ければ 0)。状態の読取り・読取りの stamp・登録の CAS が
 * 同じ式で比べないと、行が無いときの 0 の扱いがずれて CAS が素通りする。引数は bind の書き方。
 */
const revisionOf = (userParam: '?' | '?1') =>
  `COALESCE((SELECT revision FROM subscription_revisions WHERE user_id=${userParam}),0)`;

export const cleanAliases = (name: string, aliases: readonly string[]): string[] => {
  const seen = new Set([vendorKey(name)]);
  return aliases.filter((alias) => {
    const key = vendorKey(alias);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const cleanAccounts = (accounts: readonly string[]): string[] => [
  ...new Set(accounts.filter(Boolean)),
];

export const revisionConflict = (c: C) =>
  c.json(
    errorBody(
      'subscription_revision_conflict',
      '他の利用者の操作が先に反映されました。最新の状態で送り直してください',
    ),
    409,
  );

// ---------------------------------------------------------------------------
// 状態の読み取り (raw D1 の 1 文) と subs 範囲の入力 (3 文) を並べて読む
// ---------------------------------------------------------------------------

export interface VendorState {
  id: number;
  name: string;
  aliasesRaw: string;
  accountsRaw: string;
  aliases: string[];
  accounts: string[];
  sortOrder: number;
  mergedIntoId: number | null;
  reviewedAt: string | null;
  category: string | null;
}

export interface DecisionState {
  vendorKey: string;
  decision: string;
  ruleFingerprint: string;
  decidedAt: string;
}

export interface ReplayState {
  id: string;
  kind: OperationKind;
  targetVendorId: number | null;
  payloadJson: string | null;
  baseRevision: number;
  undoesId: string | null;
  createdAt: string;
}

export interface UndoTargetState {
  id: string;
  kind: OperationKind;
  targetVendorId: number | null;
  beforeJson: string | null;
  baseRevision: number;
  undoneAt: string | null;
  createdAt: string;
}

export interface LaterOperation {
  kind: string;
  targetVendorId: number | null;
  payloadJson: string | null;
}

interface SubsInputs {
  deals: FreeeDeal[];
  cashDeals: FreeeDeal[];
  restored: SubsAggRow[];
  current: SubsAggRow[];
}

export interface SubscriptionState {
  revision: number;
  replay: ReplayState | null;
  vendors: VendorState[];
  decisions: DecisionState[];
  undoTarget: UndoTargetState | null;
  later: LaterOperation[];
  inputs: SubsInputs | null;
}

const STATE_SQL = `SELECT
  ${revisionOf('?1')} AS revision,
  (SELECT json_object('id',id,'kind',kind,'targetVendorId',target_vendor_id,'payloadJson',payload_json,
      'baseRevision',base_revision,'undoesId',undoes_id,'createdAt',created_at)
    FROM subscription_operations WHERE user_id=?1 AND actor_user_id=?2 AND idempotency_key=?3) AS replay,
  (SELECT json_group_array(json_object('id',id,'name',name,'aliases',aliases,'accounts',accounts,
      'sortOrder',sort_order,'mergedIntoId',merged_into_id,'reviewedAt',reviewed_at,'category',category))
    FROM sub_vendors WHERE user_id=?1) AS vendors,
  (SELECT json_group_array(json_object('vendorKey',vendor_key,'decision',decision,
      'ruleFingerprint',rule_fingerprint,'decidedAt',decided_at))
    FROM sub_vendor_review_decisions WHERE user_id=?1) AS decisions,
  CASE WHEN ?5 THEN (SELECT json_group_array(json_array(month,scope,amount)) FROM restored_monthly_agg
    WHERE user_id=?1 AND (scope IN ('biz_rev','subs_other') OR scope LIKE 'biz_exp:%' OR scope LIKE 'subs:%'))
    ELSE '[]' END AS restored,
  CASE WHEN ?5 THEN (SELECT json_group_array(json_array(month,scope,amount)) FROM monthly_agg
    WHERE user_id=?1 AND ${SUBS_SCOPE_SQL})
    ELSE '[]' END AS current_subs,
  (SELECT json_object('id',id,'kind',kind,'targetVendorId',target_vendor_id,'beforeJson',before_json,
      'baseRevision',base_revision,'undoneAt',undone_at,'createdAt',created_at)
    FROM subscription_operations WHERE user_id=?1 AND id=?4) AS undo_target,
  (SELECT json_group_array(json_object('kind',kind,'targetVendorId',target_vendor_id,'payloadJson',payload_json))
    FROM subscription_operations WHERE user_id=?1 AND ?4 IS NOT NULL AND undone_at IS NULL
      AND kind IN (${LATER_KINDS.map((_, i) => `?${6 + i}`).join(',')})
      AND base_revision > COALESCE((SELECT base_revision FROM subscription_operations WHERE user_id=?1 AND id=?4),
        9007199254740991)) AS later`;

interface StateRow {
  revision: number;
  replay: string | null;
  vendors: string;
  decisions: string;
  restored: string;
  current_subs: string;
  undo_target: string | null;
  later: string;
}

const parseJson = <T>(raw: string | null | undefined, fallback: T): T => {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const aggRows = (raw: string): SubsAggRow[] =>
  parseJson<[string, string, number][]>(raw, []).map(([month, scope, amount]) => ({ month, scope, amount }));

export async function readSubscriptionState(
  c: C,
  options: { key: string | null; undoId?: string | null; withAggregates: boolean },
): Promise<SubscriptionState> {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const stateRead = c.env.DB.prepare(STATE_SQL)
    .bind(
      userId,
      c.get('actor').id,
      options.key,
      options.undoId ?? null,
      options.withAggregates ? 1 : 0,
      ...LATER_KINDS,
    )
    .first<StateRow>();
  const inputsRead = options.withAggregates
    ? Promise.all([
        loadNormMap(db, userId),
        db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
        loadCashEntries(db, userId),
      ])
    : null;
  const [row, inputs] = await Promise.all([stateRead, inputsRead]);
  if (!row) throw new Error('subscription state read returned no row');
  const vendors = parseJson<
    Omit<VendorState, 'aliasesRaw' | 'accountsRaw' | 'aliases' | 'accounts'>[] & object[]
  >(row.vendors, [])
    .map((raw) => {
      const v = raw as unknown as Omit<VendorState, 'aliasesRaw' | 'accountsRaw'> & {
        aliases: string;
        accounts: string;
      };
      return {
        ...v,
        aliasesRaw: v.aliases,
        accountsRaw: v.accounts,
        aliases: parseStringArray(v.aliases),
        accounts: parseStringArray(v.accounts),
      } satisfies VendorState;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return {
    revision: Number(row.revision),
    replay: parseJson<ReplayState | null>(row.replay, null),
    vendors,
    decisions: parseJson<DecisionState[]>(row.decisions, []),
    undoTarget: parseJson<UndoTargetState | null>(row.undo_target, null),
    later: parseJson<LaterOperation[]>(row.later, []),
    inputs: inputs
      ? {
          deals: normalizeFreeeDeals(inputs[1].map(dealFromRow), inputs[0]),
          cashDeals: cashBizDeals(inputs[2], inputs[0]),
          restored: aggRows(row.restored),
          current: aggRows(row.current_subs),
        }
      : null,
  };
}

/** 操作後の登録から subs 範囲 (subs:* と subs_other) の行を組み立て直す */
export function buildSubsRows(vendors: readonly VendorState[], inputs: SubsInputs): SubsAggRow[] {
  const records: SubVendorRecord[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    aliases: v.aliases,
    accounts: v.accounts,
    ...(v.mergedIntoId != null ? { mergedIntoId: v.mergedIntoId } : {}),
  }));
  return projectSubsAggregate({
    resolved: resolveVendorMerges(records),
    deals: inputs.deals,
    cashDeals: inputs.cashDeals,
    businessBaseline: inputs.restored,
    current: inputs.current,
  });
}

// ---------------------------------------------------------------------------
// 冪等キーと replay
// ---------------------------------------------------------------------------

/** 必須の key。無い・形式違いは 400。統合と取り消しで使う */
export function requiredKey(c: C): string | Response {
  const key = c.req.header('idempotency-key');
  if (key && IDEMPOTENCY_KEY.test(key)) return key;
  return c.json(errorBody('idempotency_key_required', 'Idempotency-Key ヘッダが無いか、形式が違います'), 400);
}

/** 任意の key。既存の書込み 9 本で使う。送られたなら形式を検査する */
export function optionalKey(c: C): string | null | Response {
  const key = c.req.header('idempotency-key');
  if (key === undefined) return null;
  return IDEMPOTENCY_KEY.test(key) ? key : requiredKey(c);
}

/** 同じ key の操作が在れば、本文の一致で replay か 422 を決める。無ければ null */
export function replayOutcome(
  c: C,
  state: SubscriptionState,
  payloadJson: string,
  kind: OperationKind,
): { replay: ReplayState; revision: number } | Response | null {
  const replay = state.replay;
  if (!replay) return null;
  if (replay.payloadJson === null) {
    return c.json(
      errorBody('idempotency_key_expired', 'この操作キーは期限を過ぎています。一覧を取り直してください'),
      422,
    );
  }
  if (replay.kind !== kind || replay.payloadJson !== payloadJson) {
    return c.json(errorBody('idempotency_key_reused', '同じ操作キーで別の内容が送られました'), 422);
  }
  return { replay, revision: replay.baseRevision + 1 };
}

/** 同じ kind の別 command も区別する。baseRevision は再送時に変えられるため本文に含めない。 */
export const subscriptionPayload = (c: C, payload: unknown): string =>
  JSON.stringify({ ...(payload as object), command: `${c.req.method} ${c.req.path}` });

/**
 * GET 同士を妨げず、更新と重なった読取りは内容を返さず409にする。
 * read には前後で一致を確かめた revision を渡すので、本文の revision を別に読み直さない。
 * 返す応答は成否 (200・404 など) を問わず必ず no-store にする (付け忘れの入口をここ 1 か所に閉じる)。
 */
export async function subscriptionReadSnapshot(
  c: C,
  read: (revision: number) => Promise<Response>,
): Promise<Response> {
  const userId = c.get('userId');
  const stamp = () =>
    c.env.DB.prepare(`/* SUBS_READ_SNAPSHOT */ SELECT
    ${revisionOf('?1')} AS revision,
    (SELECT run_id FROM import_writer_claims WHERE user_id=?1 AND expires_at>?2) AS writer,
    (SELECT json_array(COUNT(*),MAX(seq)) FROM settings_change_log WHERE user_id=?1) AS settingsRevision,
    (SELECT json_array(COUNT(*),MAX(updated_at),SUM(status='committed')) FROM import_runs WHERE user_id=?1) AS importRevision`)
      .bind(userId, Date.now())
      .first<{
        revision: number;
        writer: string | null;
        settingsRevision: string | null;
        importRevision: string | null;
      }>();
  const before = await stamp();
  if (!before) throw new Error('subscription read stamp returned no row');
  if (!before.writer) {
    const response = await read(Number(before.revision));
    const after = await stamp();
    if (
      after &&
      !after.writer &&
      before.revision === after.revision &&
      before.settingsRevision === after.settingsRevision &&
      before.importRevision === after.importRevision
    ) {
      response.headers.set('Cache-Control', PRIVATE_NO_STORE['Cache-Control']);
      return response;
    }
  }
  return canonicalWriteBusy(c);
}

/** 任意の baseRevision。送られたときだけ現在値と照合する */
export const baseMatches = (state: SubscriptionState, baseRevision: number | undefined): boolean =>
  baseRevision === undefined || baseRevision === state.revision;

// ---------------------------------------------------------------------------
// batch の組み立てと実行
// ---------------------------------------------------------------------------

/** (a) 以外の文の末尾に付ける条件。bind の末尾に userId と操作 id を足す */
export const OP_EXISTS = 'EXISTS(SELECT 1 FROM subscription_operations WHERE user_id=? AND id=?)';

export type Guard = (sql: string, ...params: unknown[]) => Statement;

export interface PlannedOperation {
  kind: OperationKind;
  key: string | null;
  targetVendorId: number | null;
  payloadJson: string | null;
  beforeJson: string | null;
  baseRevision: number;
  undoesId: string | null;
  /** 操作ごとの文 ((b) 群)。全て OP_EXISTS を末尾の条件に持つ */
  statements: (guard: Guard) => Statement[];
  /** subs 範囲を置き換えるなら、操作後の登録 */
  nextVendors: readonly VendorState[] | null;
}

export interface CommittedOperation {
  id: string;
  createdAt: string;
  revision: number;
  results: D1Result[];
  /** 操作ごとの文の結果の先頭位置 */
  firstStatementIndex: number;
}

const isUniqueViolation = (error: unknown): boolean => {
  const texts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (current instanceof Error) {
      texts.push(current.message);
      current = current.cause;
    } else {
      texts.push(String(current));
      break;
    }
  }
  return texts.some((text) => /UNIQUE constraint failed/i.test(text));
};

/**
 * 1 本の batch で操作を適用する。版が古い・同じ版の競合に負けたなら Response (409) を返す。
 * それ以外の失敗は投げ直し、overloaded なら index.ts の onError が 503 に変える。
 */
export async function commitOperation(
  c: C,
  state: SubscriptionState,
  plan: PlannedOperation,
): Promise<CommittedOperation | Response> {
  const userId = c.get('userId');
  const actorId = c.get('actor').id;
  const database = c.env.DB;
  const id = `op_${crypto.randomUUID()}`;
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const revision = plan.baseRevision + 1;
  const guard: Guard = (sql, ...params) => database.prepare(sql).bind(...params, userId, id);

  const statements: Statement[] = [
    database
      .prepare(
        `INSERT INTO subscription_operations
          (id,user_id,actor_user_id,idempotency_key,kind,target_vendor_id,payload_json,before_json,base_revision,undoes_id,created_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${revisionOf('?')}=?`,
      )
      .bind(
        id,
        userId,
        actorId,
        plan.key ?? id,
        plan.kind,
        plan.targetVendorId,
        plan.payloadJson,
        plan.beforeJson,
        plan.baseRevision,
        plan.undoesId,
        createdAt,
        userId,
        plan.baseRevision,
      ),
  ];
  const firstStatementIndex = statements.length;
  statements.push(...plan.statements(guard));
  statements.push(
    guard(
      `INSERT INTO subscription_revisions (user_id,revision,updated_at) SELECT ?,?,? WHERE ${OP_EXISTS}
        ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision, updated_at=excluded.updated_at`,
      userId,
      revision,
      createdAt,
    ),
  );
  if (plan.nextVendors) {
    if (!state.inputs) throw new Error('subs inputs were not loaded for an aggregate-changing operation');
    let rows: SubsAggRow[];
    try {
      rows = buildSubsRows(plan.nextVendors, state.inputs);
    } catch (error) {
      if (error instanceof SubVendorMergeCycleError) {
        return c.json(
          errorBody('merge_cycle', '統合の親子関係が循環します。統合先を選び直してください'),
          422,
        );
      }
      throw error;
    }
    statements.push(
      guard(`DELETE FROM monthly_agg WHERE user_id=? AND ${SUBS_SCOPE_SQL} AND ${OP_EXISTS}`, userId),
      guard(
        `INSERT INTO monthly_agg (user_id,month,scope,amount)
          SELECT ?, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]')
          FROM json_each(?) WHERE ${OP_EXISTS}`,
        userId,
        d1JsonPayload(rows.map((row) => [row.month, row.scope, row.amount])),
      ),
    );
  }
  statements.push(
    guard(`${INVALIDATE_JSON_ACTIVE_SQL} AND ${OP_EXISTS}`, userId),
    guard(
      `UPDATE subscription_operations SET payload_json=NULL, before_json=NULL WHERE id IN (
          SELECT id FROM subscription_operations WHERE user_id=? AND created_at<?
            AND (payload_json IS NOT NULL OR before_json IS NOT NULL) LIMIT ${SWEEP_LIMIT}) AND ${OP_EXISTS}`,
      userId,
      new Date(nowMs - UNDO_WINDOW_MS).toISOString(),
    ),
    guard(
      `DELETE FROM subscription_operations WHERE id IN (
          SELECT id FROM subscription_operations WHERE user_id=? AND created_at<? LIMIT ${SWEEP_LIMIT}) AND ${OP_EXISTS}`,
      userId,
      new Date(nowMs - PURGE_AFTER_MS).toISOString(),
    ),
  );

  let results: D1Result[];
  try {
    results = await database.batch(statements);
  } catch (error) {
    if (isUniqueViolation(error)) return revisionConflict(c);
    throw error;
  }
  if ((results[0]?.meta.changes ?? 0) === 0) return revisionConflict(c);
  return { id, createdAt, revision, results, firstStatementIndex };
}

// ---------------------------------------------------------------------------
// ログ (名前・email・金額・key は出さない)
// ---------------------------------------------------------------------------

export function logSubscriptionWrite(
  c: C,
  entry: { operationId: string | null; kind: OperationKind; result: string; startedAt: number },
): void {
  console.info(
    JSON.stringify({
      level: 'info',
      event: 'subscription_write',
      requestId: c.get('requestId'),
      operationId: entry.operationId,
      kind: entry.kind,
      result: entry.result,
      durationMs: Date.now() - entry.startedAt,
      actorId: c.get('actor').id,
    }),
  );
}

// ---------------------------------------------------------------------------
// 統合と取り消し
// ---------------------------------------------------------------------------

interface MergeBefore {
  restoreBarrier?: number;
  target: { id: number; aliases: string; accounts: string };
  sources: { id: number; mergedIntoId: number | null }[];
  decisions: DecisionState[];
}

export interface MergeBody {
  targetId: number;
  sourceVendorIds: number[];
  rawNames: string[];
  baseRevision: number;
}

const decisionsJson = (decisions: readonly DecisionState[]) => d1JsonPayload(decisions);

export async function handleMerge(c: C, body: MergeBody): Promise<Response> {
  const startedAt = Date.now();
  const key = requiredKey(c);
  if (typeof key !== 'string') return key;
  const userId = c.get('userId');
  const payloadJson = subscriptionPayload(c, {
    targetId: body.targetId,
    sourceVendorIds: body.sourceVendorIds,
    rawNames: body.rawNames,
  });
  const state = await readSubscriptionState(c, { key, withAggregates: true });
  const replayed = replayOutcome(c, state, payloadJson, 'merge');
  if (replayed instanceof Response) return replayed;
  if (replayed) {
    logSubscriptionWrite(c, {
      operationId: replayed.replay.id,
      kind: 'merge',
      result: 'replayed',
      startedAt,
    });
    return operationApplied(
      c,
      replayed.replay,
      { kind: 'merge', targetVendorId: replayed.replay.targetVendorId },
      replayed.revision,
      true,
    );
  }
  if (body.sourceVendorIds.length === 0 && body.rawNames.length === 0) {
    return c.json(errorBody('empty_merge', '統合する取引名かサブスクを 1 件以上選んでください'), 400);
  }
  if (body.sourceVendorIds.includes(body.targetId)) {
    return c.json(errorBody('merge_cycle', '統合先を統合元に含めることはできません'), 422);
  }
  const byId = new Map(state.vendors.map((v) => [v.id, v]));
  const target = byId.get(body.targetId);
  const sources = body.sourceVendorIds.map((id) => byId.get(id));
  if (!target || sources.some((v) => v === undefined)) {
    return c.json(errorBody('not_found', '選んだサブスクが見つかりません。一覧を取り直してください'), 404);
  }
  const sourceRows = sources as VendorState[];
  // 統合元の子孫 (BR-005 の循環) は必ず統合済みなので、ここで BR-001 の 409 として止まる。
  // それでも循環が残れば、commitOperation 内の buildSubsRows が最後の防御として 422 にする。
  if (target.mergedIntoId != null || sourceRows.some((v) => v.mergedIntoId != null))
    return revisionConflict(c);
  if (body.baseRevision !== state.revision) return revisionConflict(c);
  const aliases = cleanAliases(target.name, [...target.aliases, ...body.rawNames]);
  if (aliases.length > ALIASES_MAX) {
    return c.json(errorBody('too_many_aliases', `別名は ${ALIASES_MAX} 件までです`), 400);
  }
  // 対象科目: どれかが「全科目 (空)」なら統合後も全科目。そうでなければ和集合
  const everyAccounts = [target, ...sourceRows].map((v) => v.accounts);
  const accounts = everyAccounts.some((list) => list.length === 0) ? [] : cleanAccounts(everyAccounts.flat());

  const targetKey = vendorKey(target.name);
  const sourceKeys = sourceRows.map((v) => vendorKey(v.name)).filter((k) => k && k !== targetKey);
  const groupKeys = new Set([targetKey, ...sourceKeys]);
  const decisionByKey = new Map(state.decisions.map((d) => [d.vendorKey, d]));
  const carryFrom = decisionByKey.has(targetKey) ? undefined : sourceKeys.find((k) => decisionByKey.has(k));
  const before: MergeBefore = {
    target: { id: target.id, aliases: target.aliasesRaw, accounts: target.accountsRaw },
    sources: sourceRows.map((v) => ({ id: v.id, mergedIntoId: v.mergedIntoId })),
    decisions: state.decisions.filter((d) => groupKeys.has(d.vendorKey)),
  };
  const updates = [
    {
      id: target.id,
      aliases: JSON.stringify(aliases),
      accounts: JSON.stringify(accounts),
      mergedIntoId: null,
    },
    ...sourceRows.map((v) => ({
      id: v.id,
      aliases: v.aliasesRaw,
      accounts: v.accountsRaw,
      mergedIntoId: target.id,
    })),
  ];
  const sourceIds = new Set(body.sourceVendorIds);
  const nextVendors = state.vendors.map((v) => {
    if (v.id === target.id) return { ...v, aliases, accounts };
    return sourceIds.has(v.id) ? { ...v, mergedIntoId: target.id } : v;
  });

  const committed = await commitOperation(c, state, {
    kind: 'merge',
    key,
    targetVendorId: target.id,
    payloadJson,
    beforeJson: JSON.stringify(before),
    baseRevision: body.baseRevision,
    undoesId: null,
    nextVendors,
    statements: (guard) => [
      rewriteVendorsStatement(guard, userId, updates),
      guard(
        `UPDATE sub_vendor_review_decisions SET vendor_key=? WHERE user_id=? AND vendor_key=? AND ?=1 AND ${OP_EXISTS}`,
        targetKey,
        userId,
        carryFrom ?? '',
        carryFrom ? 1 : 0,
      ),
      guard(
        `DELETE FROM sub_vendor_review_decisions WHERE user_id=? AND vendor_key IN (SELECT value FROM json_each(?))
          AND ${OP_EXISTS}`,
        userId,
        d1JsonPayload(sourceKeys.filter((k) => k !== carryFrom)),
      ),
    ],
  });
  if (committed instanceof Response) {
    logSubscriptionWrite(c, { operationId: null, kind: 'merge', result: 'conflict', startedAt });
    return committed;
  }
  logSubscriptionWrite(c, { operationId: committed.id, kind: 'merge', result: 'applied', startedAt });
  return operationApplied(
    c,
    committed,
    { kind: 'merge', targetVendorId: target.id },
    committed.revision,
    false,
  );
}

/**
 * 統合と取り消しの成功応答。適用と再送は replayed だけが違う同じ形にする
 * (operation のキー順は id → kind → targetVendorId/undoesId → createdAt)。
 */
function operationApplied(
  c: C,
  operation: { id: string; createdAt: string },
  detail: { kind: 'merge'; targetVendorId: number | null } | { kind: 'unmerge'; undoesId: string | null },
  revision: number,
  replayed: boolean,
): Response {
  return c.json(
    { operation: { id: operation.id, ...detail, createdAt: operation.createdAt }, revision, replayed },
    200,
    PRIVATE_NO_STORE,
  );
}

function rewriteVendorsStatement(
  guard: Guard,
  userId: string,
  updates: readonly { id: number; aliases: string; accounts: string; mergedIntoId: number | null }[],
): Statement {
  return guard(
    `UPDATE sub_vendors SET aliases=json_extract(j.value,'$.aliases'), accounts=json_extract(j.value,'$.accounts'),
        merged_into_id=json_extract(j.value,'$.mergedIntoId')
      FROM json_each(?) AS j
      WHERE sub_vendors.user_id=? AND sub_vendors.id=json_extract(j.value,'$.id') AND ${OP_EXISTS}`,
    d1JsonPayload(updates),
    userId,
  );
}

const isExpired = (createdAt: string, now: number): boolean => Date.parse(createdAt) < now - UNDO_WINDOW_MS;

/** 統合が触れたベンダー (統合先と統合元) の id */
const mergeGroup = (op: { targetVendorId: number | null; beforeJson: string | null }): Set<number> => {
  const before = parseJson<MergeBefore | null>(op.beforeJson, null);
  return new Set([
    ...(op.targetVendorId != null ? [op.targetVendorId] : []),
    ...(before?.sources.map((source) => source.id) ?? []),
  ]);
};

const touchesGroup = (later: LaterOperation, group: ReadonlySet<number>): boolean => {
  if (!(LATER_KINDS as readonly string[]).includes(later.kind)) return false;
  if (later.targetVendorId != null && group.has(later.targetVendorId)) return true;
  if (later.kind !== 'merge' || later.payloadJson === null) return false;
  const payload = parseJson<{ sourceVendorIds?: number[] }>(later.payloadJson, {});
  return (payload.sourceVendorIds ?? []).some((id) => group.has(id));
};

/**
 * 元に戻せない理由。判定の順は 404 相当 (not_merge) → already_undone → undo_expired → 後続の操作。
 * 統合元がもう統合先を指していない (他の経路で書き換わった) 場合も後続の操作があったとみなす。
 */
export function undoBlockReason(
  op: Pick<UndoTargetState, 'kind' | 'undoneAt' | 'createdAt' | 'beforeJson' | 'targetVendorId'>,
  later: readonly LaterOperation[],
  now: number,
  currentMergedInto?: ReadonlyMap<number, number | null>,
): UndoBlockedReason | null {
  if (op.kind !== 'merge') return 'not_merge';
  if (op.undoneAt !== null) return 'already_undone';
  if (op.beforeJson === null || isExpired(op.createdAt, now)) return 'undo_expired';
  if (parseJson<MergeBefore | null>(op.beforeJson, null)?.restoreBarrier === 1)
    return 'undo_blocked_by_later_operation';
  const group = mergeGroup(op);
  if (later.some((row) => touchesGroup(row, group))) return 'undo_blocked_by_later_operation';
  if (currentMergedInto) {
    const before = parseJson<MergeBefore | null>(op.beforeJson, null);
    const moved = (before?.sources ?? []).some(
      (source) => currentMergedInto.get(source.id) !== op.targetVendorId,
    );
    if (moved || (op.targetVendorId != null && !currentMergedInto.has(op.targetVendorId))) {
      return 'undo_blocked_by_later_operation';
    }
  }
  return null;
}

export async function handleUndo(c: C, operationId: string, baseRevision: number): Promise<Response> {
  const startedAt = Date.now();
  const key = requiredKey(c);
  if (typeof key !== 'string') return key;
  const userId = c.get('userId');
  const payloadJson = subscriptionPayload(c, { undoesId: operationId });
  const state = await readSubscriptionState(c, { key, undoId: operationId, withAggregates: true });
  const replayed = replayOutcome(c, state, payloadJson, 'unmerge');
  if (replayed instanceof Response) return replayed;
  if (replayed) {
    logSubscriptionWrite(c, {
      operationId: replayed.replay.id,
      kind: 'unmerge',
      result: 'replayed',
      startedAt,
    });
    return operationApplied(
      c,
      replayed.replay,
      { kind: 'unmerge', undoesId: replayed.replay.undoesId },
      replayed.revision,
      true,
    );
  }
  const op = state.undoTarget;
  if (!op || op.kind !== 'merge') {
    return c.json(errorBody('not_found', '元に戻せる統合が見つかりません'), 404);
  }
  const mergedInto = new Map(state.vendors.map((v) => [v.id, v.mergedIntoId]));
  // not_merge は直前の 404 で返し済みなので、ここに来る reason は 3 種のどれかか null
  const reason = undoBlockReason(op, state.later, Date.now(), mergedInto);
  if (reason !== null && reason !== 'not_merge') {
    return c.json(
      errorBody(reason, SUBSCRIPTION_UNDO_BLOCKED_MESSAGE[reason]),
      reason === 'undo_expired' ? 410 : 409,
    );
  }
  if (baseRevision !== state.revision) return revisionConflict(c);

  const before = parseJson<MergeBefore>(op.beforeJson, {
    target: { id: 0, aliases: '[]', accounts: '[]' },
    sources: [],
    decisions: [],
  });
  const byId = new Map(state.vendors.map((v) => [v.id, v]));
  const target = byId.get(before.target.id);
  // 防御: 統合先の消失は undoBlockReason が先に 409 で止めるため通常は到達しない
  // (before_json が壊れていて parseJson の既定値 id=0 になったときだけ来る)
  if (!target) return c.json(errorBody('not_found', '元に戻せる統合が見つかりません'), 404);
  const restoredMergedInto = new Map(before.sources.map((source) => [source.id, source.mergedIntoId]));
  const updates = [
    { id: target.id, aliases: before.target.aliases, accounts: before.target.accounts, mergedIntoId: null },
    ...before.sources.flatMap((source) => {
      const current = byId.get(source.id);
      return current
        ? [
            {
              id: current.id,
              aliases: current.aliasesRaw,
              accounts: current.accountsRaw,
              mergedIntoId: source.mergedIntoId,
            },
          ]
        : [];
    }),
  ];
  const groupKeys = [target, ...before.sources.map((source) => byId.get(source.id))]
    .filter((v): v is VendorState => v !== undefined)
    .map((v) => vendorKey(v.name));
  const nextVendors = state.vendors.map((v) => {
    if (v.id === target.id) {
      return {
        ...v,
        aliasesRaw: before.target.aliases,
        accountsRaw: before.target.accounts,
        aliases: parseStringArray(before.target.aliases),
        accounts: parseStringArray(before.target.accounts),
        mergedIntoId: null,
      };
    }
    return restoredMergedInto.has(v.id) ? { ...v, mergedIntoId: restoredMergedInto.get(v.id) ?? null } : v;
  });

  const committed = await commitOperation(c, state, {
    kind: 'unmerge',
    key,
    targetVendorId: target.id,
    payloadJson,
    beforeJson: null,
    baseRevision,
    undoesId: operationId,
    nextVendors,
    statements: (guard) => [
      rewriteVendorsStatement(guard, userId, updates),
      guard(
        `UPDATE subscription_operations SET undone_at=? WHERE user_id=? AND id=? AND undone_at IS NULL AND ${OP_EXISTS}`,
        new Date().toISOString(),
        userId,
        operationId,
      ),
      guard(
        `DELETE FROM sub_vendor_review_decisions WHERE user_id=? AND vendor_key IN (SELECT value FROM json_each(?))
          AND ${OP_EXISTS}`,
        userId,
        d1JsonPayload(groupKeys),
      ),
      guard(
        `INSERT INTO sub_vendor_review_decisions (user_id,vendor_key,decision,rule_fingerprint,decided_at)
          SELECT ?, json_extract(value,'$.vendorKey'), json_extract(value,'$.decision'),
            json_extract(value,'$.ruleFingerprint'), json_extract(value,'$.decidedAt')
          FROM json_each(?) WHERE ${OP_EXISTS}
          ON CONFLICT(user_id, vendor_key) DO UPDATE SET decision=excluded.decision,
            rule_fingerprint=excluded.rule_fingerprint, decided_at=excluded.decided_at`,
        userId,
        decisionsJson(before.decisions),
      ),
    ],
  });
  if (committed instanceof Response) {
    logSubscriptionWrite(c, { operationId: null, kind: 'unmerge', result: 'conflict', startedAt });
    return committed;
  }
  logSubscriptionWrite(c, { operationId: committed.id, kind: 'unmerge', result: 'applied', startedAt });
  return operationApplied(
    c,
    committed,
    { kind: 'unmerge', undoesId: operationId },
    committed.revision,
    false,
  );
}

// ---------------------------------------------------------------------------
// 直近の操作の一覧
// ---------------------------------------------------------------------------

interface OperationListRow {
  id: string;
  kind: OperationKind;
  target_vendor_id: number | null;
  created_at: string;
  undone_at: string | null;
  before_json: string | null;
  base_revision: number;
  target_name: string | null;
  actor_email: string | null;
  undone_by_email: string | null;
}

/** revision は subscriptionReadSnapshot が前後で一致を確かめた値。no-store も snapshot が付ける */
export async function listSubscriptionOperations(c: C, limit: number, revision: number): Promise<Response> {
  const userId = c.get('userId');
  const database = c.env.DB;
  const [rows, later, vendors] = await Promise.all([
    database
      .prepare(
        `SELECT o.id, o.kind, o.target_vendor_id, o.created_at, o.undone_at, o.before_json, o.base_revision,
            v.name AS target_name, ua.email AS actor_email,
            (SELECT ub.email FROM subscription_operations x LEFT JOIN users ub ON ub.id = x.actor_user_id
              WHERE x.user_id = o.user_id AND x.undoes_id = o.id ORDER BY x.created_at LIMIT 1) AS undone_by_email
          FROM subscription_operations o
          LEFT JOIN sub_vendors v ON v.user_id = o.user_id AND v.id = o.target_vendor_id
          LEFT JOIN users ua ON ua.id = o.actor_user_id
          WHERE o.user_id = ?
          ORDER BY o.created_at DESC, o.base_revision DESC
          LIMIT ?`,
      )
      .bind(userId, limit)
      .all<OperationListRow>(),
    database
      .prepare(
        `SELECT kind, target_vendor_id AS targetVendorId, payload_json AS payloadJson, base_revision AS baseRevision
          FROM subscription_operations
          WHERE user_id = ? AND undone_at IS NULL AND kind IN (${LATER_KINDS.map(() => '?').join(',')})`,
      )
      .bind(userId, ...LATER_KINDS)
      .all<LaterOperation & { baseRevision: number }>(),
    database
      .prepare('SELECT id, merged_into_id AS mergedIntoId FROM sub_vendors WHERE user_id = ?')
      .bind(userId)
      .all<{ id: number; mergedIntoId: number | null }>(),
  ]);
  const now = Date.now();
  const mergedInto = new Map(vendors.results.map((v) => [v.id, v.mergedIntoId]));
  const operations: SubscriptionOperationRecord[] = rows.results.map((row) => {
    const reason = undoBlockReason(
      {
        kind: row.kind,
        undoneAt: row.undone_at,
        createdAt: row.created_at,
        beforeJson: row.before_json,
        targetVendorId: row.target_vendor_id,
      },
      later.results.filter((candidate) => candidate.baseRevision > row.base_revision),
      now,
      mergedInto,
    );
    return {
      id: row.id,
      kind: row.kind,
      targetVendorName: row.target_name,
      createdAt: row.created_at,
      actorEmail: row.actor_email,
      undoneAt: row.undone_at,
      undoneByEmail: row.undone_by_email,
      undoable: reason === null,
      undoBlockedReason: reason,
    };
  });
  return c.json({ operations, revision });
}
