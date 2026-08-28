/**
 * JSON restore が読む利用者別 canonical data の更新を、取込と同じ lease で直列化する。
 * route 側の read -> write -> recompute 全体を next() が解決するまで囲う。
 */
import type { MiddlewareHandler } from 'hono';
import type { AuthEnv } from './auth.js';
import type { JsonSnapshotMutationConsumer } from './import-active.js';
import { acquireImportWriter, releaseImportWriter } from './import-lifecycle.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export type CanonicalMutationClass = 'canonical-mutation' | 'self-managed-import' | 'not-canonical-mutation';

/**
 * balance_entries はJSONバックアップのwrite-setに入らない(復元は残高に触らない)ので
 * JsonSnapshotMutationConsumer ではないが、資産推移CSVの取込と同じ表を書く。
 * 取込の洗い替えと手入力が重なると、消した直後の行だけが残りうるのでleaseは要る。
 */
type CanonicalConsumer =
  | JsonSnapshotMutationConsumer
  | 'attachments'
  | 'category_options'
  | 'balance_entries';

export const CANONICAL_MUTATION_ROUTES: ReadonlyArray<{
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: RegExp;
  consumers: readonly CanonicalConsumer[];
}> = [
  { method: 'POST', path: /^\/api\/cash-entries$/, consumers: ['cash_entries'] },
  { method: 'PUT', path: /^\/api\/cash-entries\/[^/]+$/, consumers: ['cash_entries', 'tx_edits'] },
  {
    method: 'DELETE',
    path: /^\/api\/cash-entries\/[^/]+$/,
    consumers: ['cash_entries', 'tx_edits', 'attachments'],
  },
  // 親明細の削除/MF洗替えと添付登録を同じleaseで直列化する。
  // 同じ明細への並行POSTも件数上限を越えてcommitできない。
  { method: 'POST', path: /^\/api\/attachments$/, consumers: ['attachments'] },
  { method: 'POST', path: /^\/api\/attachments\/archive\/recover$/, consumers: ['attachments'] },
  { method: 'DELETE', path: /^\/api\/attachments\/[^/]+$/, consumers: ['attachments'] },
  { method: 'PUT', path: /^\/api\/transactions\/[^/]+\/(?:class|edit)$/, consumers: ['tx_edits'] },
  // 分割は明細そのものを内訳N行に差し替える。取込の洗替えと重なると、
  // 元の明細が消えた後の内訳だけが残りうるので同じleaseで直列化する
  { method: 'PUT', path: /^\/api\/transactions\/[^/]+\/splits$/, consumers: ['tx_splits'] },
  { method: 'PUT', path: /^\/api\/balances\/liabilities$/, consumers: ['balance_entries'] },
  { method: 'POST', path: /^\/api\/rules$/, consumers: ['rules'] },
  { method: 'PATCH', path: /^\/api\/rules$/, consumers: ['rules'] },
  { method: 'PUT', path: /^\/api\/rules\/[^/]+$/, consumers: ['rules'] },
  { method: 'DELETE', path: /^\/api\/rules\/[^/]+$/, consumers: ['rules'] },
  { method: 'PUT', path: /^\/api\/budgets$/, consumers: ['budgets'] },
  {
    method: 'PUT',
    path: /^\/api\/settings$/,
    consumers: ['account_norm_map', 'unrecorded_months', 'cash_overrides', 'analysis_settings'],
  },
  { method: 'POST', path: /^\/api\/category-options$/, consumers: ['category_options'] },
  {
    method: 'PUT',
    path: /^\/api\/category-options$/,
    consumers: ['category_options', 'tx_edits', 'rules', 'cash_entries'],
  },
  { method: 'DELETE', path: /^\/api\/category-options$/, consumers: ['category_options'] },
  { method: 'PUT', path: /^\/api\/classification$/, consumers: ['institution_owners', 'tx_edits'] },
  { method: 'POST', path: /^\/api\/sub-vendors$/, consumers: ['sub_vendors'] },
  { method: 'PUT', path: /^\/api\/sub-vendors\/[^/]+$/, consumers: ['sub_vendors'] },
  { method: 'DELETE', path: /^\/api\/sub-vendors\/[^/]+$/, consumers: ['sub_vendors'] },
  { method: 'POST', path: /^\/api\/sub-vendors\/exclusions$/, consumers: ['sub_vendor_exclusions'] },
  {
    method: 'DELETE',
    path: /^\/api\/sub-vendors\/exclusions\/[^/]+$/,
    consumers: ['sub_vendor_exclusions'],
  },
];

export const SELF_MANAGED_IMPORT_CONSUMERS: readonly JsonSnapshotMutationConsumer[] = [
  'freee_deals',
  'mf_transactions',
  'restored_monthly_agg',
];

/**
 * MECE classification:
 * - imports/restore own a longer lease that starts before their authoritative snapshot;
 * - the explicit canonical mutation set is fenced here;
 * - every other method/path is read-only or mutates a non-canonical domain.
 */
export function classifyCanonicalMutation(method: string, path: string): CanonicalMutationClass {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'POST' && (path === '/api/imports' || path === '/api/restore')) {
    return 'self-managed-import';
  }
  return CANONICAL_MUTATION_ROUTES.some((route) => route.method === normalizedMethod && route.path.test(path))
    ? 'canonical-mutation'
    : 'not-canonical-mutation';
}

export const canonicalMutationFence = (): MiddlewareHandler<Ctx> => async (c, next) => {
  if (classifyCanonicalMutation(c.req.method, c.req.path) !== 'canonical-mutation') {
    await next();
    return;
  }

  const userId = c.get('userId');
  const leaseToken = `mutation:${crypto.randomUUID()}`;
  if (!(await acquireImportWriter(c.env.DB, userId, leaseToken))) {
    return c.json(
      {
        error: {
          code: 'canonical_write_busy',
          message: '別の取込みまたは更新が進行中です。完了後に再試行してください',
        },
      },
      409,
    );
  }

  try {
    await next();
  } finally {
    try {
      await releaseImportWriter(c.env.DB, userId, leaseToken);
    } catch {
      // canonical write成功後のresponseをcleanup障害で500へ反転させない。leaseはTTLで回復する。
      console.error(JSON.stringify({ level: 'error', event: 'canonical_lease_release_failed' }));
    }
  }
};
