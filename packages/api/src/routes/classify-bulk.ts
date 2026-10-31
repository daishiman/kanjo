/**
 * 仕分け画面の一括保存と、明細 1 件の変更履歴 (spec-classify-bulk-save FR-02〜FR-09・BR-01〜BR-04・BR-12〜BR-14)。
 *
 * 一覧・単体編集は routes/classify.ts にあるが、一括保存は「明細ごとに成否を返す」別の関心を持つので分けている。
 *
 * - 値の解決は core の resolveBulkSaveItem 1 つで決める。画面の「保存前の内訳」と同じ答えになる
 * - 書き込みは 1 回の batch (全件か無し)。tx_edits・tx_history は json_each で束ね、明細の数に依らず文の数を一定に保つ
 * - 書く前に要求全体の D1 クエリの本数を BULK_SAVE_QUERY_LEDGER で数え、上限に収まらなければ 413 で何も書かない
 * - batch が失敗したら 200 で、保存対象の全件を write_failed にする (一部だけ書かれた状態は残らない)
 */
import {
  type BulkDraft,
  type BulkSpec,
  type Dataset,
  type MfTx,
  OWNER_VALUES,
  RESERVED_CATEGORY_MESSAGE,
  STABLE_KEY_VERSION,
  type TxEdit,
  categoryAllowed,
  isCashTxId,
  isNoCategory,
  matchesSuggestion,
  mfStableKey,
  resolveBulkSaveItem,
  resolveIncomingTx,
  resolveTx,
} from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { type HistoryEntry, historyEntries, loadHistory } from '../classify-history.js';
import { buildClassifyRow } from '../classify-row.js';
import { D1_BATCH_STATEMENT_LIMIT, D1_INVOCATION_QUERY_LIMIT } from '../d1-limits.js';
import { invalidateJsonSnapshotStatement } from '../import-active.js';
import {
  IMPORT_CLAIM_WORST_CASE_QUERY_COUNT,
  deleteJsonValues,
  insertJsonRows,
} from '../import-lifecycle.js';
import { PRIVATE_NO_STORE, errorBody } from '../public-validation.js';
import {
  type DbBatchQuery,
  LOAD_DATASET_QUERY_COUNT_WITH_SPLITS,
  editIsEmpty,
  getDb,
  loadDataset,
} from '../store.js';
import { TX_EDIT_WRITE_COLUMNS, applyManualEditWithBase, txEditWriteRow } from '../tx-edit-codec.js';
import { loadClassifyRowSource, mutationTooLarge, planClassifyMutation } from './classify.js';
import { settingsBodyLimit } from './settings-screen.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const classifyBulkRoute = new Hono<Ctx>();

/** 1 回の要求で保存できる明細の数 (BR-14) */
const MAX_BULK_ITEMS = 100;

/** 一括保存の本文の上限 (AC-24)。超えた要求は解析の前に 413 payload_too_large で断る */
export const BULK_BODY_MAX_BYTES = 256 * 1024;

/**
 * 一括保存 1 回の D1 クエリの本数 (要求全体)。D1 Free の 1 呼び出しの上限 (50) 未満に収める。
 * 明細の数に比例する文は無い。tx_edits の削除・書き込みと tx_history は json_each で束ね、
 * payload の大きさで分けた数だけが planBulkSaveQueries の引数として増える。
 */
export const BULK_SAVE_QUERY_LEDGER = {
  // 認証 (session) とスキーマの確認 (middleware)
  requestGuards: 2,
  writerLeaseWorstCase: IMPORT_CLAIM_WORST_CASE_QUERY_COUNT + 1,
  // loadDataset (分割の内訳・対応表を含む) + 現金明細 (snapshot を渡さないので loadDataset が読む) + vendor_memory
  // + category_options + distinct freee account。実数との一致はテストが数えて確かめる
  read: LOAD_DATASET_QUERY_COUNT_WITH_SPLITS + 1 + 1 + 2,
  snapshotInvalidation: 1,
  aggregateReplacement: 2,
} as const;

export function planBulkSaveQueries(writes: { deletes: number; edits: number; history: number }): {
  total: number;
  limit: number;
  accepted: boolean;
} {
  for (const n of [writes.deletes, writes.edits, writes.history]) {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid_bulk_save_query_plan');
  }
  const total =
    BULK_SAVE_QUERY_LEDGER.requestGuards +
    BULK_SAVE_QUERY_LEDGER.writerLeaseWorstCase +
    BULK_SAVE_QUERY_LEDGER.read +
    writes.deletes +
    writes.edits +
    writes.history +
    BULK_SAVE_QUERY_LEDGER.snapshotInvalidation +
    BULK_SAVE_QUERY_LEDGER.aggregateReplacement;
  return { total, limit: D1_INVOCATION_QUERY_LIMIT, accepted: total < D1_INVOCATION_QUERY_LIMIT };
}

const clsSchema = z.enum(['biz', 'per']);
const categorySchema = z.string().max(60);
const ownerSchema = z.enum(OWNER_VALUES);
const paymentMethodSchema = z.enum(['cash', 'card', 'account']);

/** 下書きの値の欄。今の個別編集と同じ制約 (BR-12) */
const draftFields = {
  cls: clsSchema.nullable().optional(),
  big: categorySchema.nullable().optional(),
  mid: categorySchema.nullable().optional(),
  owner: ownerSchema.nullable().optional(),
  paymentMethod: paymentMethodSchema.nullable().optional(),
  note: z.string().max(200).nullable().optional(),
};
type DraftValues = z.infer<z.ZodObject<typeof draftFields>>;

/** 新形式 `{ txId, draft }`。値の欄と draft を 1 つの item に混ぜたら受けない */
const draftItemSchema = z.object({ txId: z.string().min(1), draft: z.object(draftFields).strict() }).strict();
/** 旧形式: 値の欄を item に直接持つ (今の画面が送る形)。値は下書きとして扱う */
const legacyItemSchema = z.object({ txId: z.string().min(1), ...draftFields });

/** 一括指定。値のある欄だけを送る (null は受けない) */
const bulkSchema = z
  .object({
    cls: clsSchema.optional(),
    big: categorySchema.optional(),
    mid: categorySchema.optional(),
    owner: ownerSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
  })
  .strict();

const bodySchema = z.object({
  bulk: bulkSchema.optional(),
  items: z.array(z.unknown()).min(1).max(MAX_BULK_ITEMS),
});

const INVALID_BODY = errorBody('invalid_body', '入力を確認してください');
const DUPLICATE_ITEMS = errorBody('invalid_body', '同じ明細が複数回含まれています');
const RESERVED_BULK = errorBody('invalid_body', RESERVED_CATEGORY_MESSAGE);
const MID_WITHOUT_BIG = errorBody('invalid_body', 'カテゴリ (中) はカテゴリ (大) と一緒に指定してください');
const BULK_MISMATCH = errorBody('invalid_body', '指定したカテゴリ (大) が指定した区分に合いません');

type ItemErrorCode = 'not_found' | 'invalid_item' | 'split_line_not_supported' | 'no_value' | 'write_failed';
// 明細ごとの失敗も要求全体のエラー本文と同じ errorBody で作り、画面が同じ code→文言の対応で読めるようにする
type ItemResult =
  | { txId: string; ok: true; status: string }
  | ({ txId: string; ok: false } & ReturnType<typeof errorBody>);

const itemFailure = (txId: string, code: ItemErrorCode, message: string): ItemResult => ({
  txId,
  ok: false,
  ...errorBody(code, message),
});
const INVALID_ITEM_MESSAGE = '入力を確認してください';
/** 分割の親・内訳行・崩れた分割の親に共通の拒否 (FR-08。文言は前サイクルから変えない) */
const SPLIT_REJECT_MESSAGE = '分割済みの明細は内訳から編集してください';
const WRITE_FAILED_MESSAGE = '保存できませんでした';

const txIdOf = (raw: unknown): string | null => {
  const id = raw !== null && typeof raw === 'object' ? (raw as { txId?: unknown }).txId : undefined;
  return typeof id === 'string' ? id : null;
};

/** 値の欄が 1 つも無い下書きは下書きでない (提案・今の値から埋める明細と同じに扱う) */
function toDraft(v: DraftValues): BulkDraft | null {
  const hasValue = Object.values(v).some((value) => value !== undefined);
  if (!hasValue) return null;
  // 大・中・支払方法・メモは省略 (undefined) を「送らない」として core へそのまま渡す
  return {
    cls: v.cls ?? null,
    big: v.big,
    mid: v.mid,
    owner: v.owner ?? null,
    paymentMethod: v.paymentMethod,
    note: v.note,
  };
}

/** item を新形式・旧形式のどちらかとして読む。どちらでもなければ null (invalid_item) */
function parseItem(raw: unknown): { txId: string; draft: BulkDraft | null } | null {
  if (raw !== null && typeof raw === 'object' && 'draft' in raw) {
    const parsed = draftItemSchema.safeParse(raw);
    return parsed.success ? { txId: parsed.data.txId, draft: toDraft(parsed.data.draft) } : null;
  }
  const parsed = legacyItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { txId, ...values } = parsed.data;
  return { txId, draft: toDraft(values) };
}

/** tx_history の列 (user_id は scalar で渡す)。行は historyWriteQueries と同じ id・値で作る */
const HISTORY_WRITE_COLUMNS = [
  'id',
  'tx_id',
  'changed_at',
  'field',
  'before_value',
  'after_value',
  'source',
  'confidence',
  'op_id',
] as const;

/** drizzle の集計の置き換えを、json_each の文 (D1 直) と同じ batch に並べる形へ直す (store.ts recomputePlanStatements と同じ) */
function d1Statement(database: D1Database, query: DbBatchQuery): D1PreparedStatement {
  if (!('toSQL' in query) || typeof query.toSQL !== 'function')
    throw new Error('invalid_bulk_save_statement');
  const built = query.toSQL();
  return database.prepare(built.sql).bind(...built.params);
}

interface SaveTarget {
  index: number;
  txId: string;
  tx: MfTx;
  next: TxEdit;
  entries: HistoryEntry[];
}

classifyBulkRoute.use(
  '/transactions/bulk',
  settingsBodyLimit(BULK_BODY_MAX_BYTES, 'リクエストが大きすぎます'),
);

classifyBulkRoute.post('/transactions/bulk', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(INVALID_BODY, 400, PRIVATE_NO_STORE);
  }
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) return c.json(INVALID_BODY, 400, PRIVATE_NO_STORE);
  const raw = parsedBody.data.items;
  const bulk: BulkSpec | null = parsedBody.data.bulk ?? null;
  const ids = raw.map(txIdOf).filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) return c.json(DUPLICATE_ITEMS, 400, PRIVATE_NO_STORE);
  // 一括指定の値の範囲外は全明細に同じく効くので、明細ごとでなく要求全体の 400 にする (BR-04)
  const bulkBig = bulk?.big?.trim() ?? '';
  if (isNoCategory(bulkBig)) return c.json(RESERVED_BULK, 400, PRIVATE_NO_STORE);
  if (bulk?.mid?.trim() && !bulkBig) return c.json(MID_WITHOUT_BIG, 400, PRIVATE_NO_STORE);

  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  // 選択の読み出しと同じ関数で引き直す。画面に出した行と保存で判定する行の提案・状態を揃える
  const { data, vendorMemories, candidates, ctx } = await loadClassifyRowSource(db, userId);
  if (bulk?.cls && bulkBig && !categoryAllowed(candidates, bulk.cls, bulkBig, bulk.mid?.trim() || null))
    return c.json(BULK_MISMATCH, 400, PRIVATE_NO_STORE);

  const txById = new Map(data.mfTx.map((t) => [t.id, t]));
  // 正常に分割した親は一覧に現れず、内訳行の parentTxId からしか辿れない
  const splitParents = new Set(
    data.mfTx.flatMap((t) => (t.splitProjection?.kind === 'split' ? [t.splitProjection.parentTxId] : [])),
  );
  const now = new Date().toISOString();
  const opId = crypto.randomUUID();
  const results: ItemResult[] = new Array(raw.length);
  const targets: SaveTarget[] = [];

  raw.forEach((rawItem, index) => {
    const item = parseItem(rawItem);
    if (!item) {
      results[index] = itemFailure(txIdOf(rawItem) ?? '', 'invalid_item', INVALID_ITEM_MESSAGE);
      return;
    }
    const { txId, draft } = item;
    const tx = txById.get(txId);
    if (!tx || tx.splitProjection) {
      results[index] =
        tx || splitParents.has(txId)
          ? itemFailure(txId, 'split_line_not_supported', SPLIT_REJECT_MESSAGE)
          : itemFailure(txId, 'not_found', '明細が見つかりません');
      return;
    }
    const cur: TxEdit = data.edits[txId] ?? {};
    const row = buildClassifyRow(tx, ctx);
    // 『カテゴリなし』は下書きに入れられない。今の値 (一覧の行の値。取込値を含む) がそれなら、
    // 送り返すのは変更でないので通す (PUT と同じ)
    if (draft?.big != null && isNoCategory(draft.big) && !isNoCategory(row.big)) {
      results[index] = itemFailure(txId, 'invalid_item', RESERVED_CATEGORY_MESSAGE);
      return;
    }
    const resolution = resolveBulkSaveItem({
      bulk,
      draft,
      suggestion: row.suggestion,
      current: { cls: row.cls, big: row.big, mid: row.mid, owner: row.owner, note: row.note },
      status: row.status,
      paymentMethod: row.edit?.paymentMethod ?? null,
      candidates,
    });
    if (!resolution.ok) {
      // 確定済みで変わる値が無い明細は、書かずに成功として返す (履歴も残さない)
      if (resolution.code === 'no_change') results[index] = { txId, ok: true, status: row.status };
      else
        results[index] = itemFailure(
          txId,
          resolution.code === 'no_value' ? 'no_value' : 'invalid_item',
          resolution.reason,
        );
      return;
    }

    const { patch } = resolution;
    const incoming = resolveIncomingTx(tx, data.rules, data.institutionOwners, vendorMemories);
    const next = applyManualEditWithBase(cur, patch, incoming);
    next.updatedAt = now;
    if (!isCashTxId(txId)) {
      next.stableKey = mfStableKey(tx);
      next.fingerprintVersion = STABLE_KEY_VERSION;
    }
    // 提案一致フラグは分類の欄を含む保存だけが動かす (PUT の isDecision と同じ。BR-09)
    const isDecision =
      patch.cls !== undefined ||
      patch.big !== undefined ||
      patch.mid !== undefined ||
      patch.owner !== undefined;
    if (isDecision) {
      const effective = resolveTx(tx, data.rules, { ...data.edits, [txId]: next }, data.institutionOwners);
      next.matchedProposal = matchesSuggestion(row.suggestion, {
        cls: effective.cls,
        big: effective.big,
        mid: effective.mid,
        owner: effective.owner,
      })
        ? 1
        : 0;
    } else if (cur.matchedProposal != null) {
      next.matchedProposal = cur.matchedProposal;
    }
    targets.push({ index, txId, tx, next, entries: historyEntries(cur, next) });
  });

  const respond = () => {
    const saved = results.filter((r) => r.ok).length;
    return c.json({ results, opId, saved, failed: results.length - saved }, 200, PRIVATE_NO_STORE);
  };
  if (targets.length === 0) return respond();

  const edits = { ...data.edits };
  for (const t of targets) {
    if (editIsEmpty(t.next)) delete edits[t.txId];
    else edits[t.txId] = { ...t.next };
  }
  const canonicalAfter: Dataset = { ...data, edits };

  const database = c.env.DB;
  const deleteStatements = deleteJsonValues(
    database,
    'tx_edits',
    userId,
    'tx_id',
    targets.map((t) => t.txId),
  );
  const editStatements = insertJsonRows(
    database,
    'tx_edits',
    TX_EDIT_WRITE_COLUMNS,
    targets.filter((t) => !editIsEmpty(t.next)).map((t) => txEditWriteRow(t.txId, t.next, now)),
    [{ column: 'user_id', value: userId }],
  );
  // 一括で保存したことが履歴から分かるように、提案一致でも source は bulk、信頼度は持たない (BR-13・BR-15)
  const historyStatements = insertJsonRows(
    database,
    'tx_history',
    HISTORY_WRITE_COLUMNS,
    targets.flatMap((t) =>
      t.entries.map((e, i) => [
        `${opId}:${t.txId}:${e.field}:${i}`,
        t.txId,
        now,
        e.field,
        e.before,
        e.after,
        'bulk',
        null,
        opId,
      ]),
    ),
    [{ column: 'user_id', value: userId }],
  );

  const ledger = planBulkSaveQueries({
    deletes: deleteStatements.length,
    edits: editStatements.length,
    history: historyStatements.length,
  });
  // 集計の置き換えは単体編集と同じ検査の関数で作る。束ねた JSON が D1_JSON_BIND_SAFE_BYTES (2MB に余白を取った 1.9MB) を
  // 超えるか、文の数が D1_BATCH_STATEMENT_LIMIT を超えると null になる
  const mutation = ledger.accepted ? planClassifyMutation(db, userId, canonicalAfter, []) : null;
  if (!mutation) return c.json(mutationTooLarge, 413, PRIVATE_NO_STORE);
  const statements = [
    ...deleteStatements,
    ...editStatements,
    ...historyStatements,
    invalidateJsonSnapshotStatement(database, userId, 'tx_edits'),
    ...mutation.queries.map((query) => d1Statement(database, query)),
  ];
  if (statements.length > D1_BATCH_STATEMENT_LIMIT) return c.json(mutationTooLarge, 413, PRIVATE_NO_STORE);

  try {
    await database.batch(statements);
  } catch {
    // batch は全件か無し。保存対象の全件を再試行できる失敗として返す (FR-15)
    for (const t of targets) results[t.index] = itemFailure(t.txId, 'write_failed', WRITE_FAILED_MESSAGE);
    return respond();
  }
  const ctxAfter = { ...ctx, edits };
  for (const t of targets)
    results[t.index] = { txId: t.txId, ok: true, status: buildClassifyRow(t.tx, ctxAfter).status };
  return respond();
});

const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() });

classifyBulkRoute.get('/transactions/:txId/history', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const parsed = historyQuery.safeParse(c.req.query());
  if (!parsed.success)
    return c.json(errorBody('invalid_query', '件数の指定が正しくありません'), 400, PRIVATE_NO_STORE);
  const txId = c.req.param('txId');
  const data = await loadDataset(db, userId);
  if (!data.mfTx.some((t) => t.id === txId))
    return c.json(errorBody('not_found', '明細が見つかりません'), 404, PRIVATE_NO_STORE);
  const items = await loadHistory(db, userId, txId, parsed.data.limit ?? 20);
  return c.json({ items }, 200, PRIVATE_NO_STORE);
});
