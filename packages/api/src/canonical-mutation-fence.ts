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
  | 'category_options'
  | 'balance_entries'
  | 'overrides'
  | 'duplicate_verdicts'
  | 'freee_deal_exclusions'
  | 'mf_tx_exclusions'
  | 'reconciliation_actions'
  | 'owner_labels'
  /*
   * 0046: 明細仕分けの作業台。どちらも JSON バックアップの write-set には入らない
   * (復元はフィルタも履歴も書き戻さない) が、取込の洗い替えと重なると
   * 「消えかけの明細に一括保存が当たる」「消えた明細の履歴だけが残る」が作れる。
   */
  | 'saved_filters'
  | 'tx_history';

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
    consumers: ['cash_entries', 'tx_edits'],
  },
  {
    method: 'PUT',
    path: /^\/api\/transactions\/[^/]+\/(?:class|edit)$/,
    consumers: ['tx_edits', 'tx_history'],
  },
  // 分割は明細そのものを内訳N行に差し替える。取込の洗替えと重なると、
  // 元の明細が消えた後の内訳だけが残りうるので同じleaseで直列化する
  { method: 'PUT', path: /^\/api\/transactions\/[^/]+\/splits$/, consumers: ['tx_splits', 'tx_history'] },
  { method: 'PUT', path: /^\/api\/balances\/liabilities$/, consumers: ['balance_entries'] },
  // 取込データの削除・取り消し。取込の洗替えと重なると、
  // 消した直後に同じCSVが入って半分だけ戻る状態が作れるので同じleaseで直列化する(DR-3)
  {
    method: 'POST',
    path: /^\/api\/imports\/[^/]+\/undo$/,
    consumers: ['mf_transactions', 'freee_deals', 'balance_entries'],
  },
  {
    method: 'POST',
    path: /^\/api\/imports\/[^/]+\/discard$/,
    consumers: [],
  },
  {
    method: 'POST',
    path: /^\/api\/data\/deletions$/,
    consumers: ['mf_transactions', 'freee_deals', 'balance_entries', 'restored_monthly_agg', 'overrides'],
  },
  {
    method: 'POST',
    path: /^\/api\/data\/undo\/[^/]+$/,
    consumers: ['mf_transactions', 'freee_deals', 'balance_entries', 'restored_monthly_agg', 'overrides'],
  },
  // 取引先の決め事。当て直しは手当て(tx_edits)を書き換えるため、
  // 取込の洗替えと重なると「消えかけの明細に決め事を当てる」が起きうる
  { method: 'PATCH', path: /^\/api\/vendor-memory\/[^/]+$/, consumers: ['vendor_memory'] },
  {
    method: 'POST',
    path: /^\/api\/vendor-memory\/[^/]+\/reapply$/,
    consumers: ['vendor_memory', 'tx_edits'],
  },
  // 概況の保留と月次レビュー。復元の write-set に入るので、復元と重ねない
  { method: 'PUT', path: /^\/api\/review-queue\/snoozes\/[^/]+\/[^/]+$/, consumers: ['review_snoozes'] },
  { method: 'DELETE', path: /^\/api\/review-queue\/snoozes\/[^/]+\/[^/]+$/, consumers: ['review_snoozes'] },
  { method: 'PUT', path: /^\/api\/monthly-close\/[^/]+\/review$/, consumers: ['monthly_close_reviews'] },
  { method: 'DELETE', path: /^\/api\/monthly-close\/[^/]+\/review$/, consumers: ['monthly_close_reviews'] },
  /*
   * 0042: 総収支の判断・除外・取消。復元の write-set に入るので、復元と重ねない。
   *
   * ここを外すと「除外を保存している間に復元が走り、外した鍵だけが新しいデータに残る」
   * が作れる。除外は freee 側の取引を総額から落とすので、残った鍵は
   * 誰の取引にも当たらないまま金額を減らし続ける。
   */
  {
    method: 'POST',
    path: /^\/api\/total-cashflow\/verdicts$/,
    consumers: ['duplicate_verdicts', 'total_cashflow_operations'],
  },
  {
    method: 'POST',
    path: /^\/api\/total-cashflow\/freee-exclusions$/,
    consumers: ['freee_deal_exclusions', 'total_cashflow_operations'],
  },
  {
    method: 'DELETE',
    path: /^\/api\/total-cashflow\/freee-exclusions$/,
    consumers: ['freee_deal_exclusions', 'total_cashflow_operations'],
  },
  // 取消は判断・除外のどちらへも書き戻しうるので、両方を consumer に挙げる
  {
    method: 'POST',
    path: /^\/api\/total-cashflow\/operations\/[^/]+\/undo$/,
    consumers: ['duplicate_verdicts', 'freee_deal_exclusions', 'total_cashflow_operations'],
  },
  /*
   * 0041: 照合画面の一括判断と取消 (PR #54)。
   *
   * 総収支の判断表と同じ duplicate_verdicts / freee_deal_exclusions を触るので、
   * consumer を共有させて直列化する。共有させないと、照合で除外した行を
   * 総収支が「まだある」前提で読んだまま書き戻す窓が開く。
   */
  {
    method: 'POST',
    path: /^\/api\/reconciliation\/actions$/,
    consumers: ['duplicate_verdicts', 'freee_deal_exclusions', 'mf_tx_exclusions', 'reconciliation_actions'],
  },
  {
    method: 'POST',
    path: /^\/api\/reconciliation\/actions\/[^/]+\/undo$/,
    consumers: ['duplicate_verdicts', 'freee_deal_exclusions', 'mf_tx_exclusions', 'reconciliation_actions'],
  },
  // 一括保存は明細 N 件の手当てと履歴をまとめて書く
  { method: 'POST', path: /^\/api\/transactions\/bulk$/, consumers: ['tx_edits', 'tx_history'] },
  { method: 'POST', path: /^\/api\/rules$/, consumers: ['rules'] },
  // ルール適用は手当て・内訳・履歴へ同時に書く。プレビューは読むだけなので対象外
  {
    method: 'POST',
    path: /^\/api\/rules\/apply$/,
    consumers: ['rules', 'tx_edits', 'tx_splits', 'tx_history'],
  },
  {
    method: 'POST',
    path: /^\/api\/rules\/[^/]+\/apply$/,
    consumers: ['rules', 'tx_edits', 'tx_splits', 'tx_history'],
  },
  { method: 'POST', path: /^\/api\/saved-filters$/, consumers: ['saved_filters'] },
  { method: 'DELETE', path: /^\/api\/saved-filters\/[^/]+$/, consumers: ['saved_filters'] },
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
  /*
   * 0043: 名義の表示名。復元の write-set には入らない (JSON バックアップは表示名を持たない) が、
   * 名義の割当て (PUT /classification) と同じ利用者設定の更新なので、同じ変更系保護の下で直列化する。
   * 4 名義を 1 回で差し替えるため、2 つの保存が重なると名義ごとに別の保存の値が残りうる。
   */
  { method: 'PUT', path: /^\/api\/settings\/owner-labels$/, consumers: ['owner_labels'] },
  { method: 'POST', path: /^\/api\/sub-vendors$/, consumers: ['sub_vendors'] },
  {
    method: 'PUT',
    path: /^\/api\/sub-vendors\/[^/]+$/,
    consumers: ['sub_vendors', 'sub_vendor_review_decisions'],
  },
  // 名称の統合 (別名の追加)。別名は集計の正本に効くので PUT と同じく lease で直列化する
  { method: 'POST', path: /^\/api\/sub-vendors\/[^/]+\/aliases$/, consumers: ['sub_vendors'] },
  {
    method: 'DELETE',
    path: /^\/api\/sub-vendors\/[^/]+$/,
    consumers: ['sub_vendors', 'sub_vendor_review_decisions'],
  },
  // 見直し日と候補への判断もbackup/restore対象。restore snapshotと重ねない
  { method: 'POST', path: /^\/api\/sub-vendors\/[^/]+\/review$/, consumers: ['sub_vendors'] },
  {
    method: 'POST',
    path: /^\/api\/subscriptions\/review-decisions$/,
    consumers: ['sub_vendor_review_decisions'],
  },
  {
    method: 'DELETE',
    path: /^\/api\/subscriptions\/review-decisions$/,
    consumers: ['sub_vendor_review_decisions'],
  },
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
