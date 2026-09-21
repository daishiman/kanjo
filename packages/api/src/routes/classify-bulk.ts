/**
 * 仕分け画面の一括保存と、明細 1 件の変更履歴 (spec-classify-screen)。
 *
 * 一覧・単体編集は routes/classify.ts にあるが、一括保存は
 * 「明細ごとに成否を返す」「D1 の batch を明細の境界で切る」という別の関心を持つので分けている。
 */
import { zValidator } from '@hono/zod-validator';
import {
  type Dataset,
  OWNER_VALUES,
  STABLE_KEY_VERSION,
  type TxEdit,
  categoryAllowed,
  classifySuggestion,
  isCashTxId,
  matchesSuggestion,
  mfStableKey,
  projectAccountingDataset,
  resolveIncomingTx,
  resolveTx,
} from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import { loadHistory, saveEditQueries } from '../classify-history.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  type DbBatchQuery,
  aggregateReplacementQueries,
  editIsEmpty,
  getDb,
  loadDataset,
  loadVendorMemories,
  toBatch,
} from '../store.js';
import { applyManualEditWithBase } from '../tx-edit-codec.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const classifyBulkRoute = new Hono<Ctx>();

/** 1 回の D1 batch に載せる文の上限。明細の境界でしか切らない */
const MAX_BATCH_STATEMENTS = 50;
/** 1 回の要求で保存できる明細の数 (BR-14) */
const MAX_BULK_ITEMS = 100;

const itemSchema = z.object({
  txId: z.string().min(1),
  cls: z.enum(['biz', 'per']).nullable().optional(),
  big: z.string().max(60).nullable().optional(),
  mid: z.string().max(60).nullable().optional(),
  owner: z.enum(OWNER_VALUES).nullable().optional(),
  paymentMethod: z.enum(['cash', 'card', 'account']).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});
const bulkSchema = z.object({ items: z.array(z.unknown()).min(1).max(MAX_BULK_ITEMS) });

const invalidBody = (message: string) => ({ error: { code: 'invalid_body', message } });

type ItemError = { code: string; message: string };
type ItemResult = { txId: string; ok: boolean; status?: string; error?: ItemError };

/**
 * 明細の境界で batch を切る。
 * 1 明細ぶんの文が 2 つの batch に割れると、片方だけ成功したときに
 * 「編集は保存されたが履歴が無い」行が残ってしまう。
 */
function chunkByItem<T extends { queries: DbBatchQuery[] }>(units: T[], limit: number): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let count = 0;
  for (const unit of units) {
    if (current.length > 0 && count + unit.queries.length > limit) {
      groups.push(current);
      current = [];
      count = 0;
    }
    current.push(unit);
    count += unit.queries.length;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

classifyBulkRoute.post('/transactions/bulk', zValidator('json', bulkSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const raw = c.req.valid('json').items;
  const ids = raw.map((item) => (item as { txId?: unknown })?.txId);
  if (new Set(ids).size !== ids.length) return c.json(invalidBody('同じ明細が複数回含まれています'), 400);

  const [data, vendorMemories] = await Promise.all([loadDataset(db, userId), loadVendorMemories(db, userId)]);
  const candidates = await loadCandidates(db, userId, data.mfTx);
  const now = new Date().toISOString();
  const opId = crypto.randomUUID();

  const results: ItemResult[] = [];
  const units: {
    index: number;
    txId: string;
    status: string;
    next: TxEdit;
    queries: DbBatchQuery[];
  }[] = [];

  raw.forEach((rawItem, index) => {
    const parsed = itemSchema.safeParse(rawItem);
    const txId =
      typeof (rawItem as { txId?: unknown })?.txId === 'string' ? (rawItem as { txId: string }).txId : '';
    if (!parsed.success) {
      results[index] = {
        txId,
        ok: false,
        error: { code: 'invalid_item', message: '入力を確認してください' },
      };
      return;
    }
    const item = parsed.data;
    const tx = data.mfTx.find((t) => t.id === item.txId);
    if (!tx) {
      results[index] = {
        txId: item.txId,
        ok: false,
        error: { code: 'not_found', message: '明細が見つかりません' },
      };
      return;
    }
    if (tx.splitProjection) {
      results[index] = {
        txId: item.txId,
        ok: false,
        error: { code: 'split_line_not_supported', message: '分割済みの明細は内訳から編集してください' },
      };
      return;
    }
    const cur: TxEdit = data.edits[item.txId] ?? {};
    const incoming = resolveIncomingTx(tx, data.rules, data.institutionOwners, vendorMemories);
    const next = applyManualEditWithBase(cur, item, incoming);
    next.updatedAt = now;
    if (!isCashTxId(item.txId)) {
      next.stableKey = mfStableKey(tx);
      next.fingerprintVersion = STABLE_KEY_VERSION;
    }
    const probe = { ...data.edits, [item.txId]: next };
    const effective = resolveTx(tx, data.rules, probe, data.institutionOwners);
    if (!categoryAllowed(candidates, effective.cls, next.big ?? null, next.mid ?? null)) {
      results[index] = {
        txId: item.txId,
        ok: false,
        error: { code: 'invalid_item', message: '科目が公私の系統と合いません' },
      };
      return;
    }
    const suggestion = classifySuggestion(tx, tx.c, data.rules, vendorMemories);
    const matched = matchesSuggestion(suggestion.suggestion, {
      cls: effective.cls,
      big: effective.big,
      mid: effective.mid,
      owner: effective.owner,
    });
    next.matchedProposal = matched ? 1 : 0;
    const { queries } = saveEditQueries(db, userId, item.txId, {
      before: cur,
      next,
      now,
      opId,
      // 一括で保存したことが履歴から分かるように、提案一致でも bulk を使う (BR-15)
      source: 'bulk',
      confidence: matched ? suggestion.confidence : null,
    });
    units.push({ index, txId: item.txId, status: matched ? 'done' : 'manual', next, queries });
  });

  let working: Dataset = data;
  // pointer無効化1文 + monthly_agg置換2文を各batchに予約する。
  for (const group of chunkByItem(units, MAX_BATCH_STATEMENTS - 3)) {
    try {
      const candidate = structuredClone(working);
      for (const unit of group) {
        if (editIsEmpty(unit.next)) delete candidate.edits[unit.txId];
        else candidate.edits[unit.txId] = { ...unit.next };
      }
      const accounting = projectAccountingDataset(candidate);
      // JSON bindの2MB上限もaggregateReplacementQueriesがここで事前検査する。
      const queries = [
        ...group.flatMap((u) => u.queries),
        invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
        ...aggregateReplacementQueries(db, userId, accounting),
      ];
      if (queries.length > MAX_BATCH_STATEMENTS) throw new Error('classify_bulk_query_budget');
      await db.batch(toBatch(queries));
      working = accounting;
      for (const u of group) results[u.index] = { txId: u.txId, ok: true, status: u.status };
    } catch {
      // この batch の明細だけを失敗にする。前の batch の成功は取り消さない
      for (const u of group)
        results[u.index] = {
          txId: u.txId,
          ok: false,
          error: { code: 'write_failed', message: '保存できませんでした' },
        };
    }
  }

  const saved = results.filter((r) => r.ok).length;
  return c.json({ results, opId, saved, failed: results.length - saved });
});

const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() });

classifyBulkRoute.get('/transactions/:txId/history', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const parsed = historyQuery.safeParse(c.req.query());
  if (!parsed.success)
    return c.json({ error: { code: 'invalid_query', message: '件数の指定が正しくありません' } }, 400);
  const txId = c.req.param('txId');
  const data = await loadDataset(db, userId);
  if (!data.mfTx.some((t) => t.id === txId))
    return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  const items = await loadHistory(db, userId, txId, parsed.data.limit ?? 20);
  return c.json({ items });
});
