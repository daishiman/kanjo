import { zValidator } from '@hono/zod-validator';
/**
 * FR-02 公私仕分け: 明細一覧・手動編集(公私/科目/名義)・ルールCRUD。
 * 変更(PUT/POST/DELETE/PATCH)は即時に monthly_agg を再生成する(spec §7.3)。
 *
 * 手動編集は tx_edits(同一性キー = MF の ID 列)に取込値とは別枠で保存し、再取込でも保持する。
 */
import {
  type AppliedSplitLine,
  type Candidates,
  type Cls,
  DEFAULT_RULES,
  type Dataset,
  MAX_SPLIT_LINES,
  MIN_SPLIT_LINES,
  OWNER_VALUES,
  PAYMENT_METHOD_VALUES,
  type Rule,
  type RuleTargetRow,
  type RuleTargetSpec,
  SPLIT_MEMO_MAX_LENGTH,
  STABLE_KEY_VERSION,
  type SplitTemplate,
  type TxEdit,
  type TxSplit,
  applySplitTemplate,
  buildCandidates,
  categoryAllowed,
  categoryRejectReason,
  classificationProgress,
  classifyCounts,
  classifyStatus,
  classifySuggestion,
  countableMfTxs,
  isCashTxId,
  matchesSuggestion,
  mfStableKey,
  parseSplitTemplate,
  payeeOf,
  paymentMethodFor,
  paymentMethodOf,
  projectAccountingDataset,
  resolveIncomingTx,
  resolvePeriodQuery,
  resolveTx,
  ruleMatches,
  ruleTargets,
  splitTemplateIssues,
  sum,
  validateSplits,
  vendorMemoryEditContributes,
} from '@kanjo/core';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import {
  historyEntries,
  historyWriteQueries,
  saveEditQueries,
  splitHistoryEntries,
} from '../classify-history.js';
import { buildClassifyRow, buildRuleTargetRows, stripSortKeys } from '../classify-row.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  D1BulkPayloadError,
  type Db,
  type DbBatchQuery,
  aggregateReplacementQueries,
  editIsEmpty,
  editWriteQueries,
  getDb,
  loadDataset,
  loadOrderedRuleRows,
  loadVendorMemories,
  ruleFromRow,
  splitFromRow,
  splitReplacementQueries,
  toBatch,
} from '../store.js';
import { applyManualEditWithBase, materializeManualFallback } from '../tx-edit-codec.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const classifyRoute = new Hono<Ctx>();
const ownerSchema = z.enum(OWNER_VALUES);

/** D1 batchのquery上限。集約置換も必ずこの中に含める。 */
const CLASSIFY_BATCH_STATEMENTS = 50;

type MutationPlan = { queries: DbBatchQuery[]; accounting: Dataset };

/**
 * canonical変更後の集約を副作用なしで先に作り、同じbatchへ連結する。
 * aggregateReplacementQueries内のJSON payload上限もここでbatch実行前に検査される。
 */
function planClassifyMutation(
  db: Db,
  userId: string,
  canonical: Dataset,
  queries: DbBatchQuery[],
): MutationPlan | null {
  const accounting = projectAccountingDataset(canonical);
  let aggregate: ReturnType<typeof aggregateReplacementQueries>;
  try {
    aggregate = aggregateReplacementQueries(db, userId, accounting);
  } catch (error) {
    if (error instanceof D1BulkPayloadError) return null;
    throw error;
  }
  const planned = [...queries, ...aggregate];
  return planned.length <= CLASSIFY_BATCH_STATEMENTS ? { queries: planned, accounting } : null;
}

const mutationTooLarge = {
  error: {
    code: 'too_many_classify_changes',
    message: '変更量が多すぎるため、対象を絞ってください',
  },
};

/** Dataset上のeditもDBと同じ「空なら行を消す」規則で更新する。 */
function applyDatasetEdit(data: Dataset, txId: string, next: TxEdit): void {
  if (editIsEmpty(next)) delete data.edits[txId];
  else data.edits[txId] = { ...next };
}

/**
 * 科目候補(二系統): 事業 = freee 取引に実在する勘定科目、個人 = MF 明細に実在する大項目/中項目。
 * それぞれに設定画面で追加した候補(category_options.scope)を合わせる。科目を推測で作らない。
 */
export async function loadCandidates(
  db: Db,
  userId: string,
  txs: { big: string; mid: string }[],
): Promise<Candidates> {
  const [opts, deals] = await Promise.all([
    db.select().from(s.categoryOptions).where(eq(s.categoryOptions.userId, userId)),
    db
      .selectDistinct({ account: s.freeeDeals.accountRaw })
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, userId)),
  ]);
  return buildCandidates(
    deals.map((d) => d.account ?? '').filter(Boolean),
    txs,
    opts.map((o) => ({ scope: o.scope, major: o.major, mid: o.mid })),
  );
}

const invalidCategory = (cls: 'biz' | 'per') => ({
  error: { code: 'invalid_category', message: categoryRejectReason(cls) },
});

/**
 * 一覧の query。単月 (month) と期間 (from/to) の両方を受ける。
 * from/to を足したのは、月をまたいで未整理を片付ける使い方を仕様が求めるためで、
 * month しか渡さない既存の呼出し元は from=to=month として同じ結果になる。
 */
const MAX_PERIOD_MONTHS = 36;
/** 1 ページの行数。仕様が 50 で固定している */
const PAGE_LIMIT = 50;
const monthPattern = /^\d{4}-\d{2}$/;
const statusValues = ['unsorted', 'review', 'manual', 'done'] as const;
type StatusFilter = (typeof statusValues)[number];

const transactionsQuery = z.object({
  month: z.string().regex(monthPattern).optional(),
  from: z.string().regex(monthPattern).optional(),
  to: z.string().regex(monthPattern).optional(),
  // 画面の期間切替が出す形 (usePeriod の selectionToQuery と同じ語彙)。
  // 年・直近 n 年はデータの最終月が要るのでサーバ側で from/to へ解決する
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  span: z.enum(['1', '2', '3']).optional(),
  all: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .refine((vs): vs is StatusFilter[] => vs.every((v) => statusValues.some((s) => s === v)), {
      message: 'status',
    }),
  category: z.string().max(60).optional(),
  owner: z.string().optional(),
  method: z.string().optional(),
  manual: z.string().optional(),
  cls: z.string().optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(['date_desc', 'date_asc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  // 50 だけを受ける。可変にすると KPI とページ番号の意味が呼出し側ごとにずれる (C5)
  limit: z.coerce
    .number()
    .int()
    .refine((v) => v === PAGE_LIMIT, { message: 'limit' })
    .optional(),
});

const invalidQuery = {
  error: { code: 'invalid_query', message: '絞り込みの指定が正しくありません' },
};

/**
 * 見る月の一覧を決める。
 *
 * 受ける形は 3 通りある。
 * - month / from / to: 呼び出し側が月を名指しする。36 か月を超えたら 400 にする。
 * - year / span / all: 画面の期間切替が出す形。終点はデータの最終月なので、
 *   ここで from/to へ解決する (クライアントは最終月を知らない)。
 * - 何も無い: 最新月だけ。既存の呼び出し元の意味を変えないための既定。
 *
 * 全期間 (all) と、データに無い年の指定は上限の 36 か月へ丸める。
 * 空の画面や無制限の走査に倒すより、実際に適用した期間を period で返すほうが
 * 画面の見出しと中身が一致する。
 */
function periodMonths(
  months: readonly string[],
  q: { month?: string; from?: string; to?: string; year?: string; span?: string; all?: string },
): string[] | null {
  const latest = months[months.length - 1] ?? null;
  const capped = (): string[] => months.slice(-MAX_PERIOD_MONTHS);

  if (!q.month && !q.from && !q.to) {
    if (q.year || q.span) {
      const range = resolvePeriodQuery({ months: [...months] }, { year: q.year, span: q.span });
      if (!range) return capped();
      return months.filter((m) => m >= range.from && m <= range.to);
    }
    if (q.all) return capped();
  }

  const from = q.from ?? q.month ?? q.to ?? latest;
  const to = q.to ?? q.month ?? q.from ?? latest;
  if (!from || !to) return [];
  if (from > to) return null;
  const span =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
  if (span + 1 > MAX_PERIOD_MONTHS) return null;
  const hit = months.filter((m) => m >= from && m <= to);

  // 互換: 単月 month だけを渡す既存の呼出し元には、その月に明細が無いとき最新月を返す。
  // 旧実装がそうしていた。ここで空を返すと、取込直後などに画面が「月が無い」で止まる。
  // from/to (新しい画面の期間) では寄せない。見出しの期間と中身が食い違うほうが読めない。
  if (hit.length === 0 && q.month && !q.from && !q.to && latest) return [latest];
  return hit;
}

classifyRoute.get('/transactions', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const parsed = transactionsQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json(invalidQuery, 400);
  const query = parsed.data;
  const [data, vendorMemories] = await Promise.all([loadDataset(db, userId), loadVendorMemories(db, userId)]);
  const cls = query.cls ?? '';
  const owner = query.owner ?? '';
  const q = (query.q ?? '').toUpperCase();
  const manualOnly = query.manual === '1';
  const method = query.method ?? '';
  const statusFilter = new Set<StatusFilter>(query.status);
  const sort = query.sort ?? 'date_desc';
  const page = query.page ?? 1;

  // 仕分けの対象は収支集計に載る明細だけ。MFの振替・計算対象外はDBには残すが
  // 一覧にも summary にも入れない(入れると家計/事業の集計と合計が食い違う)
  const countable = countableMfTxs(data.mfTx);
  const months = [...new Set(countable.map((t) => t.m))].sort();
  const period = periodMonths(months, query);
  if (period === null) return c.json(invalidQuery, 400);
  /** 互換: 単月しか見ない既存の呼出し元に返す「いまの月」 */
  const m = period[period.length - 1] ?? null;
  const inPeriod = new Set(period);

  const txs = countable.filter((t) => inPeriod.has(t.m));
  /** 同期間に取り込まれたが集計対象外だった件数(振替・計算対象=0)。取込漏れとの取り違えを防ぐため件数だけ返す */
  const nonCountableCount = data.mfTx.filter((t) => inPeriod.has(t.m)).length - txs.length;
  const candidates = await loadCandidates(db, userId, data.mfTx);
  const resolved = txs.map((t) => ({
    t,
    r: resolveTx(t, data.rules, data.edits, data.institutionOwners),
  }));
  const ctx = {
    rules: data.rules,
    edits: data.edits,
    institutionOwners: data.institutionOwners,
    vendorMemories,
    candidates,
  };
  const rows = txs.map((t) => buildClassifyRow(t, ctx));

  // KPI は期間内の全件から数える。絞り込みで KPI まで動くと「残り何件か」が読めなくなる
  const kpi = classifyCounts(
    rows.map((r) => ({ status: r.status, needsReview: r.needsReview, reviewReasons: r.reviewReasons })),
  );

  const matched = rows
    .filter((r) => {
      if ((cls === 'biz' || cls === 'per') && r.cls !== cls) return false;
      if (OWNER_VALUES.some((value) => value === owner)) {
        if (r.owner !== owner) return false;
      } else if (owner === 'unset' && r.owner !== null) return false;
      if (manualOnly && r.status !== 'manual') return false;
      if (query.category && r.big !== query.category) return false;
      if (statusFilter.size > 0) {
        const hit =
          (statusFilter.has('review') && r.needsReview) || statusFilter.has(r.status as StatusFilter);
        if (!hit) return false;
      }
      if (PAYMENT_METHOD_VALUES.some((value) => value === method) && r.paymentMethod !== method) return false;
      if (
        q &&
        !`${r.description}|${r.payee}|${r.big}|${r.mid}|${r.csvBig}|${r.csvMid}|${r.institution ?? ''}|${r.csvInstitution ?? ''}|${r.note ?? ''}`
          .toUpperCase()
          .includes(q)
      )
        return false;
      return true;
    })
    // 日付の降順(既定)。同じ日付は取引 id の昇順にして並びを安定させる。
    // 分割の内訳は親の直後に来るよう groupKey で束ねる
    .sort(
      (a, b) =>
        (sort === 'date_asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) ||
        a.groupKey.localeCompare(b.groupKey) ||
        (a.splitSeq ?? 0) - (b.splitSeq ?? 0),
    )
    .map(stripSortKeys);

  const total = matched.length;
  const pageRows = matched.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const pick = (f: (x: { t: (typeof txs)[number]; r: ReturnType<typeof resolveTx> }) => boolean) =>
    sum(resolved.filter(f).map((x) => x.t.a));
  const summary = {
    month: m,
    count: txs.length,
    totalIncome: pick((x) => x.t.a > 0),
    bizIncome: pick((x) => x.r.cls === 'biz' && x.t.a > 0),
    personalIncome: pick((x) => x.r.cls === 'per' && x.t.a > 0),
    totalExpense: -pick((x) => x.t.a < 0),
    bizExpense: -pick((x) => x.r.cls === 'biz' && x.t.a < 0),
    personalExpense: -pick((x) => x.r.cls === 'per' && x.t.a < 0),
    /** 個人収入の名義別 */
    incomeByOwner: {
      business: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'business'),
      spouse: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'spouse'),
      family: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === 'family'),
      unset: pick((x) => x.r.cls === 'per' && x.t.a > 0 && x.r.owner === null),
    },
    /** 当期間の仕分けの進み具合(件数)。フィルタ前の期間全体で数える */
    progress: classificationProgress(resolved.map((x) => x.r)),
    editedCount: resolved.filter((x) => x.r.edited).length,
    conflictCount: resolved.filter((x) => x.r.conflict).length,
    /** 保有金融機関が無い明細数(旧取込。MF再取込で埋まる) */
    noInstitutionCount: resolved.filter((x) => !x.r.inst).length,
    /** 取り込んだが集計対象外だった明細数(MFの振替・計算対象=0)。0なら注記を出さない */
    nonCountableCount,
  };
  /**
   * 口座の振替先候補。取込に現れた保有金融機関と、名義を割り当て済みの口座を合わせる。
   * 科目と同じく、存在しない口座を推測で作らない(利用者が持っている口座だけを出す)。
   */
  const institutions = [
    ...new Set([
      ...data.mfTx.map((tx) => tx.inst ?? '').filter(Boolean),
      ...Object.values(data.edits)
        .map((edit) => edit.inst ?? '')
        .filter(Boolean),
      ...Object.keys(data.institutionOwners),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'ja'));
  return c.json({
    months,
    month: m,
    period: { from: period[0] ?? null, to: m },
    summary,
    /**
     * 互換: 旧画面が読む項目名。ページングは掛けない。
     *
     * `rows` と同じ 50 件にすると、月を名指しして全件を読む旧クライアントが
     * 51 件目以降を黙って失う。配列の型は変わらないので
     * 型検査にも出ない。ページングは新しい画面が読む `rows` だけの約束にする。
     */
    transactions: matched,
    rows: pageRows,
    total,
    page,
    limit: PAGE_LIMIT,
    kpi,
    candidates,
    institutions,
  });
});

/* -------- 手動編集(公私・大項目・中項目・名義) -------- */

const clsSchema = z.object({ cls: z.enum(['biz', 'per']).nullable() });
const derivedMutationError = {
  error: {
    code: 'split_line_read_only',
    message: '分割後の内訳は「内訳を編集」からまとめて変更してください',
  },
};

/** 互換: 公私だけを変える */
classifyRoute.put('/transactions/:txId/class', zValidator('json', clsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const { cls } = c.req.valid('json');
  const [data, vendorMemories] = await Promise.all([loadDataset(db, userId), loadVendorMemories(db, userId)]);
  const tx = data.mfTx.find((candidate) => candidate.id === txId);
  if (!tx) return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  if (tx.splitProjection?.kind === 'split') return c.json(derivedMutationError, 409);
  const cur: TxEdit = data.edits[txId] ?? {};
  const incoming = resolveIncomingTx(tx, data.rules, data.institutionOwners, vendorMemories);
  const fallback = resolveIncomingTx(tx, data.rules, data.institutionOwners);
  const next =
    cur.origin === 'vendor_memory' && cls === null
      ? materializeManualFallback(cur, incoming, fallback)
      : applyManualEditWithBase(cur, { cls }, incoming);
  Object.assign(next, {
    updatedAt: new Date().toISOString(),
    ...(isCashTxId(txId) ? {} : { stableKey: mfStableKey(tx), fingerprintVersion: STABLE_KEY_VERSION }),
  });
  const disagreeOriginKey =
    cur.origin === 'vendor_memory' && (cls === null || cls !== cur.cls) ? cur.originKey : null;
  const now = new Date().toISOString();
  const { queries } = saveEditQueries(db, userId, txId, {
    before: cur,
    next,
    now,
    opId: crypto.randomUUID(),
    source: 'manual',
    disagreeOriginKey,
  });
  applyDatasetEdit(data, txId, next);
  const mutation = planClassifyMutation(db, userId, data, [
    ...queries,
    invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  await db.batch(toBatch(mutation.queries));
  return c.json({ ok: true, txId, cls });
});

const editSchema = z.object({
  cls: z.enum(['biz', 'per']).nullable().optional(),
  big: z.string().max(60).nullable().optional(),
  mid: z.string().max(60).nullable().optional(),
  owner: ownerSchema.nullable().optional(),
  /** 口座(保有金融機関)の振替。null は「取込値の口座に戻す」 */
  inst: z.string().max(100).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
  /** 支払方法の手動上書き(BR-13)。null は「明細から判定した値に戻す」 */
  paymentMethod: z.enum(['cash', 'card', 'account']).nullable().optional(),
  /** true: 全属性を取込値に戻す(編集行を消す) */
  reset: z.boolean().optional(),
});

/**
 * 属性ごとの編集。送られた属性だけ更新し、null は「その属性の編集を外す(取込値/ルールに戻す)」。
 * 科目を編集したときは現在の取込値を base_* に控え、再取込で取込値が変わったことを検知できるようにする。
 */
classifyRoute.put('/transactions/:txId/edit', zValidator('json', editSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const b = c.req.valid('json');
  const [data, vendorMemories] = await Promise.all([loadDataset(db, userId), loadVendorMemories(db, userId)]);
  const tx = data.mfTx.find((t) => t.id === txId);
  if (!tx) return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  if (tx.splitProjection?.kind === 'split') return c.json(derivedMutationError, 409);
  const cur: TxEdit = data.edits[txId] ?? {};
  const incoming = resolveIncomingTx(tx, data.rules, data.institutionOwners, vendorMemories);
  const fallback = resolveIncomingTx(tx, data.rules, data.institutionOwners);
  const suppressMemory = b.reset && cur.origin === 'vendor_memory';
  const next: TxEdit = b.reset
    ? suppressMemory
      ? materializeManualFallback(cur, incoming, fallback)
      : {}
    : applyManualEditWithBase(cur, b, incoming);
  if (!b.reset || suppressMemory) {
    next.updatedAt = new Date().toISOString();
    if (!isCashTxId(txId)) {
      next.stableKey = mfStableKey(tx);
      next.fingerprintVersion = STABLE_KEY_VERSION;
    }
    if (next.big || next.mid) {
      // 会計上あり得ない組み合わせのガード: 編集後の公私(手動 > ルール > 既定)に対する候補で判定する
      const probe = { ...data.edits, [txId]: { ...next, big: null, mid: null } };
      const effCls = resolveTx(tx, data.rules, probe, data.institutionOwners).cls;
      const cands = await loadCandidates(db, userId, data.mfTx);
      if (!categoryAllowed(cands, effCls, next.big ?? null, next.mid ?? null))
        return c.json(invalidCategory(effCls), 400);
    }
  }
  const changedVendorValue =
    cur.origin === 'vendor_memory' &&
    (b.reset ||
      (b.cls !== undefined && b.cls !== cur.cls) ||
      (b.big !== undefined && (b.big || null) !== (cur.big ?? null)) ||
      (b.mid !== undefined && (b.mid || null) !== (cur.mid ?? null)) ||
      (b.owner !== undefined && b.owner !== cur.owner));
  // 確定 (区分・カテゴリ・名義のいずれかを含む保存) だけが提案一致フラグを動かす (BR-09)。
  // メモや支払方法だけの保存でフラグが動くと、完了/手動変更の意味が保存内容と無関係になる
  const isDecision =
    !b.reset && (b.cls !== undefined || b.big !== undefined || b.mid !== undefined || b.owner !== undefined);
  const suggestion = classifySuggestion(tx, tx.c, data.rules, vendorMemories);
  let matched = false;
  if (isDecision) {
    const probe = { ...data.edits, [txId]: next };
    const effective = resolveTx(tx, data.rules, probe, data.institutionOwners);
    matched = matchesSuggestion(suggestion.suggestion, {
      cls: effective.cls,
      big: effective.big,
      mid: effective.mid,
      owner: effective.owner,
    });
    next.matchedProposal = matched ? 1 : 0;
  } else if (!b.reset && cur.matchedProposal != null) {
    next.matchedProposal = cur.matchedProposal;
  }

  const now = new Date().toISOString();
  const opId = crypto.randomUUID();
  const { queries, entries } = saveEditQueries(db, userId, txId, {
    before: cur,
    next,
    now,
    opId,
    // 提案どおりの確定は『自動提案を受け入れた』履歴として残す (BR-15)
    source: matched ? 'auto' : 'manual',
    confidence: matched ? suggestion.confidence : null,
    disagreeOriginKey: changedVendorValue ? cur.originKey : null,
  });
  applyDatasetEdit(data, txId, next);
  const mutation = planClassifyMutation(db, userId, data, [
    ...queries,
    invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  await db.batch(toBatch(mutation.queries));

  const after = await loadDataset(db, userId);
  const afterTx = after.mfTx.find((t) => t.id === txId) ?? tx;
  const candidates = await loadCandidates(db, userId, after.mfTx);
  const row = stripSortKeys(
    buildClassifyRow(afterTx, {
      rules: after.rules,
      edits: after.edits,
      institutionOwners: after.institutionOwners,
      vendorMemories,
      candidates,
    }),
  );
  return c.json({
    ok: true,
    txId,
    row,
    status: row.status,
    historyOpId: entries.length > 0 ? opId : null,
    // 互換: 旧画面が読む項目
    resolved: resolveTx(afterTx, after.rules, after.edits, after.institutionOwners),
    edit: after.edits[txId] ?? null,
  });
});

/* -------- 分割記帳(1つの引き落としを用途ごとに小分けする) -------- */

const splitLineSchema = z.object({
  lineId: z.string().uuid().optional(),
  amount: z.number().int().positive(),
  cls: z.enum(['biz', 'per']),
  big: z.string().min(1),
  mid: z.string().default(''),
  /** 内訳1行の名義。null/未指定は元の明細の名義に従う */
  owner: ownerSchema.nullable().optional(),
  memo: z.string().max(SPLIT_MEMO_MAX_LENGTH).optional(),
});
/**
 * 内訳はまるごと差し替える(行ごとのCRUDにしない)。
 * 1行ずつ更新すると、途中の状態が「合計が合わない分割」としてDBに残る。
 * 全部まとめて受け取れば、保存されているものは常に合計が合っている。
 */
const splitsSchema = z.object({ lines: z.array(splitLineSchema).max(MAX_SPLIT_LINES) });

/** 元の明細を分割前の姿で引く(loadDatasetは分割適用後なので、そちらからは取れない) */
async function loadRawTx(db: Db, userId: string, txId: string) {
  const rows = await db
    .select()
    .from(s.mfTransactions)
    .where(and(eq(s.mfTransactions.userId, userId), eq(s.mfTransactions.txId, txId)))
    .limit(1);
  return rows[0] ?? null;
}

const splitRowsOf = (db: Db, userId: string, txId: string) =>
  db
    .select()
    .from(s.txSplits)
    .where(and(eq(s.txSplits.userId, userId), eq(s.txSplits.txId, txId)))
    .orderBy(asc(s.txSplits.seq));

classifyRoute.get('/transactions/:txId/splits', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const tx = await loadRawTx(db, userId, txId);
  if (!tx) return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  if (tx.identityStable !== 1)
    return c.json(
      {
        error: {
          code: 'unstable_identity',
          message: '安定した明細IDがないため分割できません。MFを再取り込みしてください',
        },
      },
      409,
    );
  const rows = await splitRowsOf(db, userId, txId);
  return c.json({
    txId,
    // 内訳は常に正の数で持つ。収入か支出かは元の明細の符号が決める
    total: Math.abs(tx.amount),
    description: tx.description,
    date: tx.date,
    state: rows.some((row) => row.parentAmount !== Math.abs(tx.amount)) ? 'amount_conflict' : 'ready',
    constraints: {
      minLines: MIN_SPLIT_LINES,
      maxLines: MAX_SPLIT_LINES,
      memoMaxLength: SPLIT_MEMO_MAX_LENGTH,
    },
    lines: rows.map((r) => ({
      lineId: r.lineId,
      amount: r.amount,
      cls: r.cls,
      big: r.categoryMajor,
      mid: r.categoryMid,
      owner: r.owner ?? null,
      memo: r.memo ?? '',
    })),
  });
});

classifyRoute.put('/transactions/:txId/splits', zValidator('json', splitsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const [data, storedRows] = await Promise.all([
    loadDataset(db, userId, undefined, { withSplits: false }),
    db.select().from(s.txSplits).where(eq(s.txSplits.userId, userId)),
  ]);
  data.txSplits = storedRows.map(splitFromRow);
  const tx = data.mfTx.find((candidate) => candidate.id === txId && !isCashTxId(candidate.id));
  if (!tx) return c.json({ error: { code: 'not_found', message: '明細が見つかりません' } }, 404);
  if (tx.idStable !== true)
    return c.json(
      {
        error: {
          code: 'unstable_identity',
          message: '安定した明細IDがないため分割できません。MFを再取り込みしてください',
        },
      },
      409,
    );

  const { lines } = c.req.valid('json');
  const total = Math.abs(tx.a);

  const issues = lines.length
    ? validateSplits(
        total,
        lines.map((l) => ({
          cls: l.cls,
          categoryMajor: l.big,
          categoryMid: l.mid,
          amount: l.amount,
          ...(l.memo ? { memo: l.memo } : {}),
        })),
      )
    : [];
  if (issues.length)
    return c.json({ error: { code: 'invalid_split', message: issues[0].message, issues } }, 400);

  // 科目は公私ごとの候補に無いものを弾く(通常の科目編集と同じ基準)
  const cands = await loadCandidates(db, userId, data.mfTx);
  for (const l of lines)
    if (!categoryAllowed(cands, l.cls, l.big, l.mid || null)) return c.json(invalidCategory(l.cls), 400);

  const now = new Date().toISOString();
  const existingForParent = new Map(
    data.txSplits.filter((row) => row.txId === txId).map((row) => [row.lineId, row]),
  );
  const claimedElsewhere = new Set(data.txSplits.filter((row) => row.txId !== txId).map((row) => row.lineId));
  const canonicalLines: TxSplit[] = lines.map((line, index) => {
    const lineId = line.lineId ?? crypto.randomUUID();
    const existing = existingForParent.get(lineId);
    return {
      txId,
      lineId,
      seq: index + 1,
      parentAmount: total,
      amount: line.amount,
      cls: line.cls,
      categoryMajor: line.big,
      categoryMid: line.mid,
      // 未指定は「元の明細の名義に従う」。キーを置かないことでその既定を表す
      ...(line.owner ? { owner: line.owner } : {}),
      ...(line.memo ? { memo: line.memo } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  });
  if (
    new Set(canonicalLines.map((row) => row.lineId)).size !== canonicalLines.length ||
    canonicalLines.some((row) => claimedElsewhere.has(row.lineId))
  ) {
    return c.json(
      {
        error: {
          code: 'duplicate_split_line_id',
          message: '内訳行の識別子が重複しています。再読込してください',
        },
      },
      409,
    );
  }

  data.txSplits = data.txSplits.filter((row) => row.txId !== txId).concat(canonicalLines);
  // 差し替える前の内訳。履歴の before はここから作る (BR-15)
  const previousLines = [...existingForParent.values()].sort((a, b) => a.seq - b.seq);
  const mutation = planClassifyMutation(db, userId, data, [
    ...splitReplacementQueries(db, userId, txId, canonicalLines, now),
    ...historyWriteQueries(db, userId, txId, splitHistoryEntries(previousLines, canonicalLines), {
      source: 'split',
      opId: crypto.randomUUID(),
      changedAt: now,
    }),
    invalidateJsonSnapshotQuery(db, userId, 'tx_splits'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  await db.batch(toBatch(mutation.queries));
  return c.json({
    ok: true,
    txId,
    lines: canonicalLines.map((row) => ({
      lineId: row.lineId,
      amount: row.amount,
      cls: row.cls,
      big: row.categoryMajor,
      mid: row.categoryMid,
      owner: row.owner ?? null,
      memo: row.memo ?? '',
    })),
  });
});

/* -------- ルールCRUD(表示順=評価順・先勝ち) -------- */

async function listRules(db: Db, userId: string) {
  return loadOrderedRuleRows(db, userId);
}

classifyRoute.get('/rules', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await listRules(db, userId);
  const data = await loadDataset(db, userId);
  // ルール誤爆対策: 各ルールの影響件数(キーワードが最初に当たる明細数)
  const hitCount = new Map<number, number>();
  const rules: Rule[] = rows.map(ruleFromRow);
  for (const t of data.mfTx) {
    for (let i = 0; i < rules.length; i++) {
      if (ruleMatches(t, rules[i])) {
        hitCount.set(rows[i].id, (hitCount.get(rows[i].id) ?? 0) + 1);
        break;
      }
    }
  }
  return c.json({
    rules: rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      cls: r.cls ?? null,
      big: r.categoryMajor ?? null,
      mid: r.categoryMid ?? null,
      owner: r.owner ?? null,
      payee: r.payee ?? null,
      scope: r.scope ?? 'all',
      splitTemplate: parseSplitTemplate(r.splitTemplateJson),
      sortOrder: r.sortOrder,
      hits: hitCount.get(r.id) ?? 0,
    })),
    usingDefaults: rows.length === 0,
  });
});

/**
 * 分割の型 (BR-10)。行の形はここで、行の組み合わせ (残額はちょうど 1 行など) は
 * core の splitTemplateIssues で見る。組み合わせの規則を zod へ写すと、
 * プレビュー・適用・画面のどこかで判定がずれる。
 */
const splitTemplateSchema = z.object({
  lines: z
    .array(
      z.object({
        kind: z.enum(['fixed', 'remainder']),
        amount: z.number().int().optional(),
        cls: z.enum(['biz', 'per']),
        big: z.string().max(60).optional(),
        mid: z.string().max(60).optional(),
        owner: ownerSchema.optional(),
        memo: z.string().max(SPLIT_MEMO_MAX_LENGTH).optional(),
      }),
    )
    .min(MIN_SPLIT_LINES)
    .max(MAX_SPLIT_LINES),
});

const ruleBody = {
  keyword: z.string().min(1).max(100),
  cls: z.enum(['biz', 'per']).nullable().optional(),
  big: z.string().max(60).nullable().optional(),
  mid: z.string().max(60).nullable().optional(),
  owner: ownerSchema.nullable().optional(),
  /** 取引先の正規化キー (BR-12)。キーワードに重ねて対象を絞る */
  payee: z.string().max(100).nullable().optional(),
  /** 適用範囲。既定の all は、この列を持たない既存ルールの挙動と同じ */
  scope: z.enum(['all', 'unconfirmed']).optional(),
  splitTemplate: splitTemplateSchema.nullable().optional(),
};

const invalidBody = (message: string) => ({ error: { code: 'invalid_body', message } });

/** 分割の型の組み合わせ検査。core と同じ 1 つの規則を通す */
function splitTemplateError(template: SplitTemplate | null | undefined) {
  if (!template) return null;
  const issues = splitTemplateIssues(template, MAX_SPLIT_LINES);
  return issues.length ? invalidBody(issues[0]) : null;
}
const hasAttr = (b: {
  cls?: string | null;
  big?: string | null;
  mid?: string | null;
  owner?: string | null;
}) => !!(b.cls || b.big || b.mid || b.owner);
const ruleSchema = z.object({ ...ruleBody, top: z.boolean().optional() });

const ruleFromBody = (b: z.infer<typeof ruleSchema>): Rule => ({
  k: b.keyword,
  cls: b.cls ?? null,
  big: b.big || null,
  mid: b.mid || null,
  owner: b.owner ?? null,
  payee: b.payee || null,
  scope: b.scope ?? 'all',
  splitTemplate: b.splitTemplate ?? null,
});

/** ルールの科目ガード: 科目を指定するなら公私も指定し、その系統の候補にあること */
async function ruleCategoryError(
  db: Db,
  userId: string,
  b: { cls?: string | null; big?: string | null; mid?: string | null },
) {
  if (!b.big && !b.mid) return null;
  if (b.cls !== 'biz' && b.cls !== 'per')
    return {
      error: {
        code: 'rule_needs_cls',
        message: '科目を指定するルールは、先に公私(事業/個人)を選んでください',
      },
    };
  const data = await loadDataset(db, userId);
  const cands = await loadCandidates(db, userId, data.mfTx);
  return categoryAllowed(cands, b.cls, b.big ?? null, b.mid ?? null) ? null : invalidCategory(b.cls);
}

classifyRoute.post('/rules', zValidator('json', ruleSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (!hasAttr(b))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  const catErr = await ruleCategoryError(db, userId, b);
  if (catErr) return c.json(catErr, 400);
  const tplErr = splitTemplateError(b.splitTemplate);
  if (tplErr) return c.json(tplErr, 400);
  const [rows, data] = await Promise.all([listRules(db, userId), loadDataset(db, userId)]);
  const payee = b.payee || null;
  const scope = b.scope ?? 'all';
  // 同じ「何に当てるか」のルールを二重に持たせない。
  // 当てる先が同じなら、後から作った方は静かに効かなくなる (先勝ち) ので、作らせない方が親切
  if (
    rows.length
      ? rows.some(
          (r) => r.keyword === b.keyword && (r.payee ?? null) === payee && (r.scope ?? 'all') === scope,
        )
      : DEFAULT_RULES.some(
          (r) => r.k === b.keyword && (r.payee ?? null) === payee && (r.scope ?? 'all') === scope,
        )
  )
    return c.json({ error: { code: 'duplicate_rule', message: '同じ条件のルールがすでにあります' } }, 409);
  const sortOrder = b.top
    ? (rows[0]?.sortOrder ?? 1) - 1
    : rows.length
      ? rows[rows.length - 1]!.sortOrder + 1
      : DEFAULT_RULES.length + 1;
  const defaults: DbBatchQuery[] = rows.length
    ? []
    : DEFAULT_RULES.map((rule, index) =>
        db.insert(s.rules).values({ userId, keyword: rule.k, cls: rule.cls, sortOrder: index + 1 }),
      );
  const nextRule = ruleFromBody(b);
  data.rules = b.top ? [nextRule, ...data.rules] : [...data.rules, nextRule];
  const insert = db
    .insert(s.rules)
    .values({
      userId,
      keyword: b.keyword,
      cls: b.cls ?? null,
      categoryMajor: b.big || null,
      categoryMid: b.mid || null,
      owner: b.owner ?? null,
      payee,
      scope,
      splitTemplateJson: b.splitTemplate ? JSON.stringify(b.splitTemplate) : null,
      sortOrder,
    })
    .returning({ id: s.rules.id });
  const mutation = planClassifyMutation(db, userId, data, [
    ...defaults,
    insert,
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  const results = await db.batch(toBatch(mutation.queries));
  const [rec] = results[defaults.length] as { id: number }[];
  return c.json(
    {
      ok: true,
      id: rec.id,
      rule: {
        id: rec.id,
        keyword: b.keyword,
        cls: b.cls ?? null,
        big: b.big || null,
        mid: b.mid || null,
        owner: b.owner ?? null,
        payee,
        scope,
        splitTemplate: b.splitTemplate ?? null,
        sortOrder,
      },
    },
    201,
  );
});

classifyRoute.put('/rules/:id', zValidator('json', z.object(ruleBody)), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const b = c.req.valid('json');
  if (!hasAttr(b))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  const catErr = await ruleCategoryError(db, userId, b);
  if (catErr) return c.json(catErr, 400);
  const tplErr = splitTemplateError(b.splitTemplate);
  if (tplErr) return c.json(tplErr, 400);
  const [rows, data] = await Promise.all([listRules(db, userId), loadDataset(db, userId)]);
  const nextRule = ruleFromBody(b);
  data.rules = rows.length
    ? rows.map((row) => (row.id === id ? nextRule : ruleFromRow(row)))
    : [...DEFAULT_RULES];
  const mutation = planClassifyMutation(db, userId, data, [
    db
      .update(s.rules)
      .set({
        keyword: b.keyword,
        cls: b.cls ?? null,
        categoryMajor: b.big || null,
        categoryMid: b.mid || null,
        owner: b.owner ?? null,
        payee: b.payee || null,
        scope: b.scope ?? 'all',
        splitTemplateJson: b.splitTemplate ? JSON.stringify(b.splitTemplate) : null,
      })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  await db.batch(toBatch(mutation.queries));
  return c.json({ ok: true });
});

classifyRoute.delete('/rules/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const [rows, data] = await Promise.all([listRules(db, userId), loadDataset(db, userId)]);
  const remaining = rows.filter((row) => row.id !== id);
  data.rules = remaining.length ? remaining.map(ruleFromRow) : [...DEFAULT_RULES];
  const mutation = planClassifyMutation(db, userId, data, [
    db.delete(s.rules).where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
  ]);
  if (!mutation) return c.json(mutationTooLarge, 413);
  await db.batch(toBatch(mutation.queries));
  return c.json({ ok: true });
});

const reorderSchema = z.object({ order: z.array(z.number().int()).max(200) });

classifyRoute.patch('/rules', zValidator('json', reorderSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { order } = c.req.valid('json');
  const rows = await loadOrderedRuleRows(db, userId);
  const expected = new Set(rows.map((row) => row.id));
  if (
    order.length !== rows.length ||
    new Set(order).size !== order.length ||
    order.some((id) => !expected.has(id))
  ) {
    return c.json(
      { error: { code: 'invalid_rule_order', message: 'ルール全件を重複なく並べてください' } },
      400,
    );
  }
  const updates = order.map((id, i) =>
    db
      .update(s.rules)
      .set({ sortOrder: i })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id))),
  );
  if (updates.length) {
    const data = await loadDataset(db, userId);
    const byId = new Map(rows.map((row) => [row.id, row]));
    data.rules = order.map((id) => ruleFromRow(byId.get(id)!));
    const mutation = planClassifyMutation(db, userId, data, [
      ...updates,
      invalidateJsonSnapshotQuery(db, userId, 'rules'),
    ]);
    if (!mutation) return c.json(mutationTooLarge, 413);
    await db.batch(toBatch(mutation.queries));
  }
  return c.json({ ok: true });
});

/* -------- ルールのプレビューと適用 (BR-10・BR-11) -------- */

/** プレビューの 1 ページ。件数だけは全件を数え、行は先頭のこれだけを返す */
const RULE_PREVIEW_ROWS = 50;
/** 1 回の batch に載せる文の上限。明細の境界でしか切らない */
const RULE_BATCH_STATEMENTS = CLASSIFY_BATCH_STATEMENTS;

const CLS_TEXT: Record<Cls, string> = { biz: '事業', per: '家計' };

/** 適用後の 1 行の見出し。画面が辞書を持たずに読めるよう api で文字にする */
const afterLabel = (cls: Cls | null, big: string | null, mid: string | null): string =>
  [cls ? CLS_TEXT[cls] : null, big || null, mid || null].filter((x): x is string => !!x).join(' / ') ||
  '(変更なし)';

interface RulePlanTarget {
  txId: string;
  date: string;
  payee: string;
  description: string;
  amount: number;
  after: { label: string; amount: number }[];
  /** 分割の型があるときだけ。無ければ tx_edits も tx_splits も書かない */
  lines: AppliedSplitLine[] | null;
}

interface RulePlan {
  targets: RulePlanTarget[];
  skipped: { txId: string; reason: 'remainder_not_positive' }[];
}

/**
 * ルールが何をするかを 1 か所で決める。プレビューと適用がこの関数を共有するので、
 * 「見えていたものと違うものが変わった」が起きない (O4・AT-11)。
 */
function buildRulePlan(rule: RuleTargetSpec, rows: readonly RuleTargetRow[]): RulePlan {
  const targets: RulePlanTarget[] = [];
  const skipped: RulePlan['skipped'] = [];
  for (const row of ruleTargets(rule, rows)) {
    const base = {
      txId: row.txId,
      date: row.tx.d,
      payee: payeeOf(row.content),
      description: row.content,
      amount: row.tx.a,
    };
    if (rule.splitTemplate) {
      const lines = applySplitTemplate(row.tx.a, rule.splitTemplate);
      // 残額が 0 以下 = この金額にはこの型を当てられない。件数に数えず、理由を返す
      if (!lines) {
        skipped.push({ txId: row.txId, reason: 'remainder_not_positive' });
        continue;
      }
      targets.push({
        ...base,
        after: lines.map((l) => ({ label: afterLabel(l.cls, l.big, l.mid), amount: l.amount })),
        lines,
      });
      continue;
    }
    targets.push({
      ...base,
      after: [{ label: afterLabel(rule.cls ?? null, rule.big ?? null, rule.mid ?? null), amount: row.tx.a }],
      lines: null,
    });
  }
  // 並びは日付の昇順。同じ日付は txId で決め、プレビューと fingerprint を決定論にする
  targets.sort((a, b) => a.date.localeCompare(b.date) || a.txId.localeCompare(b.txId));
  skipped.sort((a, b) => a.txId.localeCompare(b.txId));
  return { targets, skipped };
}

/** 対象と適用後の値を並べた文字列の SHA-256。プレビューと適用の間で対象が動いたかを見る */
async function planFingerprint(plan: RulePlan): Promise<string> {
  const text = plan.targets
    .map((t) => `${t.txId}\u0001${t.after.map((a) => `${a.label}=${a.amount}`).join('\u0002')}`)
    .join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const periodBody = {
  from: z.string().regex(monthPattern),
  to: z.string().regex(monthPattern),
};

const previewSchema = z.object({
  rule: z.object(ruleBody).nullable().optional(),
  ruleId: z.union([z.number().int(), z.string()]).nullable().optional(),
  ...periodBody,
});

/** 期間内の明細から、ルールの対象候補を組む。プレビューと適用で同じ材料を使う */
async function ruleScope(db: Db, userId: string, from: string, to: string) {
  const [data, vendorMemories] = await Promise.all([loadDataset(db, userId), loadVendorMemories(db, userId)]);
  const countable = countableMfTxs(data.mfTx);
  const months = [...new Set(countable.map((t) => t.m))].sort();
  const period = periodMonths(months, { from, to });
  if (period === null) return null;
  const inPeriod = new Set(period);
  const candidates = await loadCandidates(db, userId, data.mfTx);
  const ctx = {
    rules: data.rules,
    edits: data.edits,
    institutionOwners: data.institutionOwners,
    vendorMemories,
    candidates,
  };
  return {
    data,
    rows: buildRuleTargetRows(
      countable.filter((t) => inPeriod.has(t.m)),
      ctx,
    ),
  };
}

/** 保存済みルールの行を、core が読む形 (RuleTargetSpec) にする */
const ruleSpecFromRow = (r: typeof s.rules.$inferSelect): RuleTargetSpec => ({
  k: r.keyword,
  payee: r.payee ?? null,
  scope: r.scope ?? 'all',
  cls: r.cls ?? null,
  big: r.categoryMajor ?? null,
  mid: r.categoryMid ?? null,
  owner: r.owner ?? null,
  splitTemplate: parseSplitTemplate(r.splitTemplateJson),
});

classifyRoute.post('/rules/preview', zValidator('json', previewSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const hasDraft = !!b.rule;
  const hasId = b.ruleId !== undefined && b.ruleId !== null;
  // 下書きと既存ルールの両方を受けると、どちらを見せたのか後から分からなくなる
  if (hasDraft === hasId)
    return c.json(invalidBody('ルールの下書きか既存のルールのどちらかを指定してください'), 400);

  let spec: RuleTargetSpec;
  if (b.rule) {
    const tplErr = splitTemplateError(b.rule.splitTemplate);
    if (tplErr) return c.json(tplErr, 400);
    spec = {
      k: b.rule.keyword,
      payee: b.rule.payee || null,
      scope: b.rule.scope ?? 'all',
      cls: b.rule.cls ?? null,
      big: b.rule.big ?? null,
      mid: b.rule.mid ?? null,
      owner: b.rule.owner ?? null,
      splitTemplate: b.rule.splitTemplate ?? null,
    };
  } else {
    const id = Number(b.ruleId);
    if (!Number.isInteger(id)) return c.json(invalidBody('ルールの指定が正しくありません'), 400);
    const [row] = await db
      .select()
      .from(s.rules)
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id)));
    if (!row) return c.json({ error: { code: 'not_found', message: 'ルールが見つかりません' } }, 404);
    spec = ruleSpecFromRow(row);
  }

  const scope = await ruleScope(db, userId, b.from, b.to);
  if (!scope) return c.json(invalidBody('期間の指定が正しくありません'), 400);
  const plan = buildRulePlan(spec, scope.rows);
  return c.json({
    count: plan.targets.length,
    rows: plan.targets.slice(0, RULE_PREVIEW_ROWS).map(({ lines: _lines, ...row }) => row),
    omitted: Math.max(0, plan.targets.length - RULE_PREVIEW_ROWS),
    skipped: plan.skipped,
    fingerprint: await planFingerprint(plan),
  });
});

const applySchema = z.object({ ...periodBody, fingerprint: z.string().min(1).max(128) });

/**
 * ルール適用の1明細単位write-set。既存ルール適用と「作成+適用」が同じ不変条件を使う。
 */
interface RuleApplyUnit {
  txId: string;
  queries: DbBatchQuery[];
  splits: TxSplit[] | null;
  edit: TxEdit | null;
}

function ruleApplyUnits(args: {
  db: Db;
  userId: string;
  scope: NonNullable<Awaited<ReturnType<typeof ruleScope>>>;
  spec: RuleTargetSpec;
  plan: RulePlan;
  now: string;
  opId: string;
}): RuleApplyUnit[] {
  const { db, userId, scope, spec, plan, now, opId } = args;
  return plan.targets.map((target) => {
    const queries: DbBatchQuery[] = [];
    let splits: TxSplit[] | null = null;
    let edit: TxEdit | null = null;
    if (target.lines) {
      splits = target.lines.map((line, index) => ({
        txId: target.txId,
        lineId: crypto.randomUUID(),
        seq: index + 1,
        parentAmount: Math.abs(target.amount),
        amount: line.amount,
        cls: line.cls,
        categoryMajor: line.big,
        categoryMid: line.mid,
        ...(line.owner ? { owner: line.owner } : {}),
        ...(line.memo ? { memo: line.memo } : {}),
        createdAt: now,
        updatedAt: now,
      }));
      queries.push(...splitReplacementQueries(db, userId, target.txId, splits, now));
      const base = scope.data.edits[target.txId] ?? {};
      edit = { ...base, origin: 'manual', matchedProposal: 1, updatedAt: now };
      queries.push(...editWriteQueries(db, userId, target.txId, edit, { now }));
    }
    queries.push(
      ...historyWriteQueries(
        db,
        userId,
        target.txId,
        target.lines
          ? [{ field: 'split', before: null, after: `${target.lines.length}行に分割` }]
          : historyEntries(undefined, {
              cls: spec.cls ?? null,
              big: spec.big ?? null,
              mid: spec.mid ?? null,
              owner: spec.owner ?? null,
            }),
        { source: 'rule', opId, changedAt: now },
      ),
    );
    return { txId: target.txId, queries, splits, edit };
  });
}

/** ルール適用の未確定write-setをDatasetへ重ね、同じ状態から集約を作る。 */
function applyRuleUnitsToDataset(data: Dataset, units: readonly RuleApplyUnit[]): void {
  for (const unit of units) {
    if (!unit.splits || !unit.edit) continue;
    data.txSplits = data.txSplits.filter((row) => row.txId !== unit.txId).concat(unit.splits);
    applyDatasetEdit(data, unit.txId, unit.edit);
  }
}

/** aggregate 2文 + edit/splitのポインタ無効化2文を予約して、明細境界で分ける。 */
function chunkRuleApplyUnits(units: readonly RuleApplyUnit[]): RuleApplyUnit[][] {
  const limit = RULE_BATCH_STATEMENTS - 4;
  const chunks: RuleApplyUnit[][] = [];
  let current: RuleApplyUnit[] = [];
  let count = 0;
  for (const unit of units) {
    if (current.length > 0 && count + unit.queries.length > limit) {
      chunks.push(current);
      current = [];
      count = 0;
    }
    current.push(unit);
    count += unit.queries.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

const createApplySchema = z.object({
  rule: z.object({ ...ruleBody, top: z.boolean().optional() }),
  ...periodBody,
  fingerprint: z.string().min(1).max(128),
});

/** プレビューした下書きを、ルール作成と対象への適用まで1つのbatchで確定する。 */
classifyRoute.post('/rules/apply', zValidator('json', createApplySchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (!hasAttr(b.rule))
    return c.json(
      { error: { code: 'empty_rule', message: '公私・大項目・中項目・名義のいずれかを指定してください' } },
      400,
    );
  const catErr = await ruleCategoryError(db, userId, b.rule);
  if (catErr) return c.json(catErr, 400);
  const tplErr = splitTemplateError(b.rule.splitTemplate);
  if (tplErr) return c.json(tplErr, 400);

  const rows = await listRules(db, userId);
  const payee = b.rule.payee || null;
  const ruleScopeValue = b.rule.scope ?? 'all';
  if (
    rows.some(
      (row) =>
        row.keyword === b.rule.keyword &&
        (row.payee ?? null) === payee &&
        (row.scope ?? 'all') === ruleScopeValue,
    )
  )
    return c.json({ error: { code: 'duplicate_rule', message: '同じ条件のルールがすでにあります' } }, 409);

  const spec: RuleTargetSpec = {
    k: b.rule.keyword,
    payee,
    scope: ruleScopeValue,
    cls: b.rule.cls ?? null,
    big: b.rule.big ?? null,
    mid: b.rule.mid ?? null,
    owner: b.rule.owner ?? null,
    splitTemplate: b.rule.splitTemplate ?? null,
  };
  const scope = await ruleScope(db, userId, b.from, b.to);
  if (!scope) return c.json(invalidBody('期間の指定が正しくありません'), 400);
  const plan = buildRulePlan(spec, scope.rows);
  if ((await planFingerprint(plan)) !== b.fingerprint)
    return c.json(
      { error: { code: 'preview_stale', message: '対象の明細が変わりました。プレビューを更新します。' } },
      409,
    );

  const now = new Date().toISOString();
  const opId = plan.targets.length ? crypto.randomUUID() : null;
  const defaults: DbBatchQuery[] = rows.length
    ? []
    : DEFAULT_RULES.map((rule, index) =>
        db.insert(s.rules).values({ userId, keyword: rule.k, cls: rule.cls, sortOrder: index + 1 }),
      );
  const sortOrder = b.rule.top
    ? (rows[0]?.sortOrder ?? 1) - 1
    : (rows[rows.length - 1]?.sortOrder ?? defaults.length) + 1;
  const insert = db.insert(s.rules).values({
    userId,
    keyword: b.rule.keyword,
    cls: b.rule.cls ?? null,
    categoryMajor: b.rule.big || null,
    categoryMid: b.rule.mid || null,
    owner: b.rule.owner ?? null,
    payee,
    scope: ruleScopeValue,
    splitTemplateJson: b.rule.splitTemplate ? JSON.stringify(b.rule.splitTemplate) : null,
    sortOrder,
  });
  const units = ruleApplyUnits({
    db,
    userId,
    scope,
    spec,
    plan,
    now,
    opId: opId ?? crypto.randomUUID(),
  });
  const nextRule: Rule = {
    k: spec.k,
    cls: spec.cls ?? null,
    big: spec.big ?? null,
    mid: spec.mid ?? null,
    owner: spec.owner ?? null,
    payee: spec.payee ?? null,
    scope: spec.scope ?? 'all',
    splitTemplate: spec.splitTemplate ?? null,
  };
  scope.data.rules = b.rule.top ? [nextRule, ...scope.data.rules] : [...scope.data.rules, nextRule];
  applyRuleUnitsToDataset(scope.data, units);
  const queries: DbBatchQuery[] = [
    ...defaults,
    insert,
    ...units.flatMap((unit) => unit.queries),
    invalidateJsonSnapshotQuery(db, userId, 'rules'),
    ...(plan.targets.length
      ? [
          invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
          invalidateJsonSnapshotQuery(db, userId, 'tx_splits'),
        ]
      : []),
  ];
  // ルール作成と適用は分割不可。ルールだけ/履歴だけを残さない。
  const mutation = planClassifyMutation(db, userId, scope.data, queries);
  if (!mutation)
    return c.json(
      {
        error: {
          code: 'too_many_rule_changes',
          message: '対象が多すぎるため、期間または条件を絞ってください',
        },
      },
      413,
    );

  await db.batch(toBatch(mutation.queries));
  return c.json(
    {
      applied: plan.targets.length,
      txIds: plan.targets.map((target) => target.txId),
      skipped: plan.skipped,
      opId,
    },
    201,
  );
});

classifyRoute.post('/rules/:id/apply', zValidator('json', applySchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json(invalidBody('ルールの指定が正しくありません'), 400);
  const b = c.req.valid('json');
  const [row] = await db
    .select()
    .from(s.rules)
    .where(and(eq(s.rules.userId, userId), eq(s.rules.id, id)));
  if (!row) return c.json({ error: { code: 'not_found', message: 'ルールが見つかりません' } }, 404);

  const scope = await ruleScope(db, userId, b.from, b.to);
  if (!scope) return c.json(invalidBody('期間の指定が正しくありません'), 400);
  const spec = ruleSpecFromRow(row);
  const plan = buildRulePlan(spec, scope.rows);
  // 対象を計算し直して照合する。プレビュー以降に明細が動いていたら、何も書かずに返す
  if ((await planFingerprint(plan)) !== b.fingerprint)
    return c.json(
      { error: { code: 'preview_stale', message: '対象の明細が変わりました。プレビューを更新します。' } },
      409,
    );
  if (plan.targets.length === 0) return c.json({ applied: 0, txIds: [], skipped: plan.skipped, opId: null });

  const now = new Date().toISOString();
  const opId = crypto.randomUUID();
  // 明細 1 件ぶんの文をひとかたまりにする。途中で割れると
  // 「分割は書けたが履歴が無い」明細ができてしまう
  const units = ruleApplyUnits({ db, userId, scope, spec, plan, now, opId });

  // 全chunkのquery/payload budgetを、1文も書く前に確定する。
  // 各chunkは canonical + pointer + monthly_agg を同じbatchに持つ。
  let working = scope.data;
  const planned: { txIds: string[]; queries: DbBatchQuery[] }[] = [];
  for (const chunk of chunkRuleApplyUnits(units)) {
    const candidate = structuredClone(working);
    applyRuleUnitsToDataset(candidate, chunk);
    const touchesSplits = chunk.some((unit) => unit.splits !== null);
    const mutation = planClassifyMutation(db, userId, candidate, [
      ...chunk.flatMap((unit) => unit.queries),
      ...(touchesSplits
        ? [
            invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
            invalidateJsonSnapshotQuery(db, userId, 'tx_splits'),
          ]
        : []),
    ]);
    if (!mutation) return c.json(mutationTooLarge, 413);
    planned.push({ txIds: chunk.map((unit) => unit.txId), queries: mutation.queries });
    working = mutation.accounting;
  }
  const txIds: string[] = [];
  for (const chunk of planned) {
    await db.batch(toBatch(chunk.queries));
    txIds.push(...chunk.txIds);
  }
  return c.json({ applied: txIds.length, txIds, skipped: plan.skipped, opId });
});
