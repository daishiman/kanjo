import { zValidator } from '@hono/zod-validator';
/**
 * サブスクのベンダー登録(一覧・追加・変更・削除・統合と取り消し)と、未登録の支払先から採点した候補。
 * 書込みは全て操作として記録し (subscription-writes.ts)、登録が集計に効くときは同じ batch で
 * subs 範囲 (subs:* と subs_other) だけを置き換える。
 * 候補から外した支払先(「サブスクではない」)は集計に影響しないので、subs 範囲は変えない。
 */
import {
  type Dataset,
  type FreeeDeal,
  type PeriodRange,
  SUB_VENDOR_ACCOUNTS_MAX,
  SUB_VENDOR_ACCOUNT_NAME_MAX,
  SUB_VENDOR_CATEGORY_MAX,
  SUB_VENDOR_NAME_MAX,
  type SubscriptionsScreenInput,
  resolvePeriodQuery,
  sourceNeutralSubscriptionDeals,
  subsCandidates,
  subsReviewStatus,
  subscriptionRow,
  subscriptionVendorDetail,
  subscriptionsScreen,
  vendorKey,
} from '@kanjo/core';
import { eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import * as s from '../db/schema.js';
import { errorBody } from '../public-validation.js';
import {
  type Db,
  dealFromRow,
  getDb,
  loadDataset,
  loadSubVendorExclusions,
  loadSubVendorReviewDecisions,
  loadSubVendors,
} from '../store.js';
import {
  ALIASES_MAX,
  type CommittedOperation,
  OP_EXISTS,
  type OperationKind,
  type PlannedOperation,
  type ReplayState,
  type SubsCtx,
  type SubscriptionState,
  type VendorState,
  baseMatches,
  cleanAccounts,
  cleanAliases,
  commitOperation,
  handleMerge,
  handleUndo,
  listSubscriptionOperations,
  logSubscriptionWrite,
  optionalKey,
  readSubscriptionState,
  replayOutcome,
  revisionConflict,
  subscriptionPayload,
  subscriptionReadSnapshot,
} from '../subscription-writes.js';

type Ctx = SubsCtx;

export const subsRoute = new Hono<Ctx>();

/**
 * 明細の取引名がそのまま登録名・別名・除外名になるため、名前の上限は一つにする。
 * 既存データが持つ最大長に合わせ、120 文字は保存でき、121 文字は全経路で 400 にする。
 */
const name = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
/** 別名の上限は全経路で 50 件。カード明細の取引名は長いことがある */
const alias = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
const aliasList = z.array(alias).max(ALIASES_MAX);
/** 対象勘定科目。空配列なら従来どおり全科目を数える */
const accountList = z
  .array(z.string().trim().min(1).max(SUB_VENDOR_ACCOUNT_NAME_MAX))
  .max(SUB_VENDOR_ACCOUNTS_MAX);
/** カテゴリの上書き。null は「既定辞書に従う」へ戻す */
const category = z.string().trim().min(1).max(SUB_VENDOR_CATEGORY_MAX).nullable();
/** 既存の書込みの楽観ロック。送られたときだけ現在の revision と照合する */
const optionalBaseRevision = z.number().int().min(0).optional();
const vendorSchema = z.object({
  name,
  aliases: aliasList.default([]),
  accounts: accountList.default([]),
  baseRevision: optionalBaseRevision,
});
/** 部分更新。省いた項目は今の値を保つ */
const vendorPatchSchema = z.object({
  name: name.optional(),
  aliases: aliasList.optional(),
  accounts: accountList.optional(),
  category: category.optional(),
  baseRevision: optionalBaseRevision,
});
const baseOnlySchema = z.object({ baseRevision: optionalBaseRevision });

/** 本文が任意の経路 (review・DELETE) は text で読み、空なら baseRevision の省略とみなす */
async function optionalBaseBody(c: Context<Ctx>): Promise<{ baseRevision?: number } | Response> {
  const text = (await c.req.text()).trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return c.json(errorBody('invalid_body', '本文が JSON ではありません'), 400);
  }
  const result = baseOnlySchema.safeParse(parsed);
  return result.success ? result.data : c.json(errorBody('invalid_body', 'baseRevision が不正です'), 400);
}

const parseId = (raw: string): number | null => {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
};
const badId = (c: Context<Ctx>) => c.json(errorBody('bad_id', 'IDが不正です'), 400);
const vendorNotFound = (c: Context<Ctx>) => c.json(errorBody('not_found', 'ベンダーが見つかりません'), 404);
const duplicateName = (c: Context<Ctx>) =>
  c.json(errorBody('duplicate', '同じ名前のベンダーが既に登録されています'), 409);

type WritePlan = Pick<PlannedOperation, 'targetVendorId' | 'statements' | 'nextVendors'> & {
  body: (committed: CommittedOperation) => Record<string, unknown>;
};
type WriteDecision = Response | { noop: Record<string, unknown> } | WritePlan;

/**
 * 既存の書込みの共通の流れ。key と baseRevision は任意で、送られたときだけ検査する。
 * decide の判定の順は 404 → 409 (統合済み・版が古い) → 400 → no-op。no-op は記録せず現在の revision を返す。
 * replay は再送応答に足す項目を操作記録から復元する。応答本文は保存しないので、
 * 記録に残る値 (target_vendor_id など) から決まる項目だけを返せる。
 */
async function subscriptionWrite(
  c: Context<Ctx>,
  kind: OperationKind,
  options: {
    withAggregates: boolean;
    baseRevision: number | undefined;
    payload: unknown;
    replay?: (replay: ReplayState) => Record<string, unknown>;
  },
  decide: (state: SubscriptionState, stale: boolean) => WriteDecision | Promise<WriteDecision>,
): Promise<Response> {
  const startedAt = Date.now();
  const key = optionalKey(c);
  if (key instanceof Response) return key;
  const state = await readSubscriptionState(c, { key, withAggregates: options.withAggregates });
  const payloadJson = subscriptionPayload(c, options.payload);
  if (key) {
    const replayed = replayOutcome(c, state, payloadJson, kind);
    if (replayed instanceof Response) return replayed;
    if (replayed) {
      return c.json({
        ok: true,
        ...options.replay?.(replayed.replay),
        revision: replayed.revision,
        replayed: true,
      });
    }
  }
  const stale = !baseMatches(state, options.baseRevision);
  const decision = await decide(state, stale);
  if (decision instanceof Response) return decision;
  if ('noop' in decision) return c.json({ ...decision.noop, revision: state.revision });
  // 防御: どの decide も stale を 404 の後・no-op と書込みの前に 409 で返すため通常は到達しない
  if (stale) return revisionConflict(c);
  const { body, ...plan } = decision;
  const committed = await commitOperation(c, state, {
    ...plan,
    kind,
    key,
    payloadJson,
    beforeJson: null,
    baseRevision: state.revision,
    undoesId: null,
  });
  if (committed instanceof Response) {
    logSubscriptionWrite(c, { operationId: null, kind, result: 'conflict', startedAt });
    return committed;
  }
  logSubscriptionWrite(c, { operationId: committed.id, kind, result: 'applied', startedAt });
  return c.json({ ...body(committed), revision: committed.revision });
}

/** 統合済み (他の登録の配下) の行は直接変えさせない。画面が古いので 409 で取り直させる */
const blocked = (vendor: VendorState, stale: boolean): boolean => stale || vendor.mergedIntoId != null;

const replaceVendor = (vendors: readonly VendorState[], next: VendorState): VendorState[] =>
  vendors.map((v) => (v.id === next.id ? next : v));

/**
 * 登録一覧と、対象科目の選択肢(freee 原本に実際に出てくる科目名)。
 * 選択肢はサジェスト用なので、原本が無ければ空でよい。
 * revision は画面が次の書込みに付ける baseRevision (まだ書込みが無ければ 0) で、snapshot から受け取る。
 */
subsRoute.get('/sub-vendors', async (c) =>
  subscriptionReadSnapshot(c, async (revision) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const [vendors, dealRows, mfRows] = await Promise.all([
      loadSubVendors(db, userId),
      db
        .selectDistinct({ accountRaw: s.freeeDeals.accountRaw })
        .from(s.freeeDeals)
        .where(eq(s.freeeDeals.userId, userId)),
      db
        .selectDistinct({
          categoryMajor: s.mfTransactions.categoryMajor,
          categoryMid: s.mfTransactions.categoryMid,
        })
        .from(s.mfTransactions)
        .where(eq(s.mfTransactions.userId, userId)),
    ]);
    const accountOptions = [
      ...new Set(
        [
          ...dealRows.map((row) => row.accountRaw ?? ''),
          ...mfRows.flatMap((row) => [
            row.categoryMajor ?? '',
            row.categoryMid ?? '',
            row.categoryMajor && row.categoryMid ? `${row.categoryMajor}/${row.categoryMid}` : '',
          ]),
        ].filter(Boolean),
      ),
    ].sort();
    // 解約し忘れは金額の異常では拾えないので、最後に見直した日から四半期で催促する
    const review = subsReviewStatus(
      vendors.map((v) => ({ id: v.id, name: v.name, reviewedAt: v.reviewedAt })),
      new Date().toISOString().slice(0, 10),
    );
    return c.json({ vendors, accountOptions, review, revision });
  }),
);

/** 制御文字 (U+0000〜U+001F と U+007F) を含むか。正規表現に制御文字を書かないため文字コードで見る */
const hasControlChar = (value: string): boolean =>
  [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
const mergeSchema = z.object({
  targetId: z.number().int().positive(),
  sourceVendorIds: z
    .array(z.number().int().positive())
    .max(ALIASES_MAX)
    .refine((ids) => new Set(ids).size === ids.length, { message: '統合元が重複しています' }),
  rawNames: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(SUB_VENDOR_NAME_MAX)
        .refine((value) => !hasControlChar(value), { message: '制御文字は使えません' }),
    )
    .max(ALIASES_MAX),
  baseRevision: z.number().int().min(0),
});

/**
 * 統合。統合元の登録は消さずに統合先を指させ (merged_into_id)、生の取引名は統合先の別名に足す。
 * `:id` 系より前に登録する (merge を id として読ませない)。
 */
subsRoute.post('/sub-vendors/merge', zValidator('json', mergeSchema), async (c) =>
  handleMerge(c, c.req.valid('json')),
);

const operationIdParam = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) });
const undoSchema = z.object({ baseRevision: z.number().int().min(0) });

/** 統合の取り消し。30 日以内で、後続の操作がその統合に触れていないときだけ戻せる */
subsRoute.post(
  '/subscription-operations/:id/undo',
  zValidator('param', operationIdParam),
  zValidator('json', undoSchema),
  async (c) => handleUndo(c, c.req.valid('param').id, c.req.valid('json').baseRevision),
);

subsRoute.post('/sub-vendors', zValidator('json', vendorSchema), async (c) => {
  const userId = c.get('userId');
  const { baseRevision, ...b } = c.req.valid('json');
  const aliases = cleanAliases(b.name, b.aliases);
  const accounts = cleanAccounts(b.accounts);
  return subscriptionWrite(
    c,
    'vendor_create',
    {
      withAggregates: true,
      baseRevision,
      payload: b,
      // 作った行の id は batch で操作の行の target_vendor_id に書き込み済み。再送でも同じ id を返す
      replay: (replay) => ({ id: replay.targetVendorId }),
    },
    (state, stale) => {
      if (stale) return revisionConflict(c);
      if (state.vendors.some((v) => vendorKey(v.name) === vendorKey(b.name))) return duplicateName(c);
      const sortOrder = (state.vendors.at(-1)?.id ?? 0) + 100;
      const created: VendorState = {
        id: -1,
        name: b.name,
        aliasesRaw: JSON.stringify(aliases),
        accountsRaw: JSON.stringify(accounts),
        aliases,
        accounts,
        sortOrder,
        mergedIntoId: null,
        reviewedAt: null,
        category: null,
      };
      return {
        targetVendorId: null,
        nextVendors: [...state.vendors, created],
        statements: (guard) => [
          guard(
            `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order,created_at)
            SELECT ?,?,?,?,?,? WHERE ${OP_EXISTS} RETURNING id`,
            userId,
            b.name,
            created.aliasesRaw,
            created.accountsRaw,
            sortOrder,
            new Date().toISOString(),
          ),
          // 作った行の id は batch の中でしか分からないので、操作の行へ後から書き込む
          guard(
            `UPDATE subscription_operations
            SET target_vendor_id=(SELECT MAX(id) FROM sub_vendors WHERE user_id=? AND name=?)
            WHERE user_id=? AND id=?`,
            userId,
            b.name,
          ),
        ],
        body: (committed) => {
          const inserted = committed.results[committed.firstStatementIndex]?.results[0] as
            | { id?: number }
            | undefined;
          if (inserted?.id === undefined) throw new Error('sub vendor insert did not return an id');
          return { ok: true, id: inserted.id };
        },
      };
    },
  );
});

/**
 * 登録の変更 (部分更新)。集計に効くのは名前・別名・対象科目だけなので、
 * カテゴリだけの変更では subs 範囲を置き換えない。
 */
subsRoute.put('/sub-vendors/:id', zValidator('json', vendorPatchSchema), async (c) => {
  const userId = c.get('userId');
  const id = parseId(c.req.param('id'));
  if (id === null) return badId(c);
  const { baseRevision, ...b } = c.req.valid('json');
  const affectsTotals = b.name !== undefined || b.aliases !== undefined || b.accounts !== undefined;
  return subscriptionWrite(
    c,
    'vendor_update',
    { withAggregates: affectsTotals, baseRevision, payload: { id, ...b } },
    (state, stale) => {
      const target = state.vendors.find((v) => v.id === id);
      if (!target) return vendorNotFound(c);
      if (blocked(target, stale)) return revisionConflict(c);
      const nextName = b.name ?? target.name;
      if (state.vendors.some((v) => v.id !== id && vendorKey(v.name) === vendorKey(nextName)))
        return duplicateName(c);
      const aliases = cleanAliases(nextName, b.aliases ?? target.aliases);
      const accounts = cleanAccounts(b.accounts ?? target.accounts);
      const next: VendorState = {
        ...target,
        name: nextName,
        aliases,
        accounts,
        aliasesRaw: JSON.stringify(aliases),
        accountsRaw: JSON.stringify(accounts),
        category: b.category !== undefined ? b.category : target.category,
      };
      const unchanged =
        next.name === target.name &&
        next.aliasesRaw === target.aliasesRaw &&
        next.accountsRaw === target.accountsRaw &&
        next.category === target.category;
      if (unchanged) return { noop: { ok: true } };
      // 見直しの判断は正規化名で引く。名前が変わるなら判断も新しい名前へ付け替える (指紋は規則由来なので保てる)。
      // 付け替え先に残っている古い判断 (同名で登録し直す前の分など) は先に消す
      const fromKey = vendorKey(target.name);
      const toKey = vendorKey(nextName);
      return {
        targetVendorId: id,
        nextVendors: affectsTotals ? replaceVendor(state.vendors, next) : null,
        statements: (guard) => [
          guard(
            `UPDATE sub_vendors SET name=?, aliases=?, accounts=?, category=CASE WHEN ?=1 THEN ? ELSE category END
              WHERE user_id=? AND id=? AND ${OP_EXISTS}`,
            next.name,
            next.aliasesRaw,
            next.accountsRaw,
            b.category !== undefined ? 1 : 0,
            next.category,
            userId,
            id,
          ),
          ...(fromKey === toKey
            ? []
            : [
                guard(
                  `DELETE FROM sub_vendor_review_decisions WHERE user_id=? AND vendor_key=? AND ${OP_EXISTS}`,
                  userId,
                  toKey,
                ),
                guard(
                  `UPDATE sub_vendor_review_decisions SET vendor_key=? WHERE user_id=? AND vendor_key=? AND ${OP_EXISTS}`,
                  toKey,
                  userId,
                  fromKey,
                ),
              ]),
        ],
        body: () => ({ ok: true }),
      };
    },
  );
});

const aliasesBodySchema = z.object({
  aliases: z.array(alias).min(1).max(ALIASES_MAX),
  baseRevision: optionalBaseRevision,
});

/**
 * 名称の統合 (別名の追加)。既にある別名は無視する (冪等)。
 * 結合後に上限を超えるなら、どれを残すかを勝手に決めずに 400 で返す。
 */
subsRoute.post('/sub-vendors/:id/aliases', zValidator('json', aliasesBodySchema), async (c) => {
  const userId = c.get('userId');
  const id = parseId(c.req.param('id'));
  if (id === null) return badId(c);
  const { baseRevision, aliases: added } = c.req.valid('json');
  return subscriptionWrite(
    c,
    'vendor_update',
    { withAggregates: true, baseRevision, payload: { id, aliases: added } },
    (state, stale) => {
      const target = state.vendors.find((v) => v.id === id);
      if (!target) return vendorNotFound(c);
      if (blocked(target, stale)) return revisionConflict(c);
      const aliases = cleanAliases(target.name, [...target.aliases, ...added]);
      if (aliases.length > ALIASES_MAX) {
        return c.json(errorBody('too_many_aliases', `別名は ${ALIASES_MAX} 件までです`), 400);
      }
      const aliasesRaw = JSON.stringify(aliases);
      if (aliasesRaw === JSON.stringify(target.aliases)) return { noop: { ok: true, aliases } };
      return {
        targetVendorId: id,
        nextVendors: replaceVendor(state.vendors, { ...target, aliases, aliasesRaw }),
        statements: (guard) => [
          guard(
            `UPDATE sub_vendors SET aliases=? WHERE user_id=? AND id=? AND ${OP_EXISTS}`,
            aliasesRaw,
            userId,
            id,
          ),
        ],
        body: () => ({ ok: true, aliases }),
      };
    },
  );
});

/** 統合先とその配下 (統合元をたどった全て) の id */
const mergeFamily = (vendors: readonly VendorState[], rootId: number): Set<number> => {
  const family = new Set([rootId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const v of vendors) {
      if (v.mergedIntoId != null && family.has(v.mergedIntoId) && !family.has(v.id)) {
        family.add(v.id);
        grew = true;
      }
    }
  }
  return family;
};

/**
 * 登録の削除。統合先を消すとまとまり全体を消し、それらの取引は subs_other へ戻る。
 * 見直しの判断も一緒に消す。残すと、同じ名前で登録し直したときに古い判断が生き返る
 */
subsRoute.delete('/sub-vendors/:id', async (c) => {
  const userId = c.get('userId');
  const id = parseId(c.req.param('id'));
  if (id === null) return badId(c);
  const base = await optionalBaseBody(c);
  if (base instanceof Response) return base;
  return subscriptionWrite(
    c,
    'vendor_delete',
    { withAggregates: true, baseRevision: base.baseRevision, payload: { id } },
    (state, stale) => {
      const target = state.vendors.find((v) => v.id === id);
      if (!target) return vendorNotFound(c);
      if (blocked(target, stale)) return revisionConflict(c);
      const family = mergeFamily(state.vendors, id);
      const keys = state.vendors.filter((v) => family.has(v.id)).map((v) => vendorKey(v.name));
      return {
        targetVendorId: id,
        nextVendors: state.vendors.filter((v) => !family.has(v.id)),
        statements: (guard) => [
          guard(
            `DELETE FROM sub_vendors WHERE user_id=? AND id IN (SELECT value FROM json_each(?)) AND ${OP_EXISTS}`,
            userId,
            JSON.stringify([...family]),
          ),
          guard(
            `DELETE FROM sub_vendor_review_decisions WHERE user_id=? AND vendor_key IN (SELECT value FROM json_each(?))
              AND ${OP_EXISTS}`,
            userId,
            JSON.stringify(keys),
          ),
        ],
        body: () => ({ ok: true }),
      };
    },
  );
});

/**
 * 未登録の支払先を「サブスクらしさ」順に。freee 原本仕訳が無ければ空。
 * 「サブスクではない」と記録した支払先は候補から外し、取り消せるよう excluded として返す。
 */
subsRoute.get('/sub-vendors/candidates', async (c) =>
  subscriptionReadSnapshot(c, async () => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const [vendors, excluded, rows, data] = await Promise.all([
      loadSubVendors(db, userId),
      loadSubVendorExclusions(db, userId),
      db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
      loadDataset(db, userId),
    ]);
    const sourceNeutralDeals = sourceNeutralSubscriptionDeals(data, rows.map(dealFromRow));
    return c.json({
      candidates: subsCandidates(
        sourceNeutralDeals,
        vendors,
        20,
        excluded.map((e) => e.partner),
      ),
      excluded,
      dealRows: sourceNeutralDeals.length,
    });
  }),
);

const exclusionSchema = z.object({
  partner: z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX),
  baseRevision: optionalBaseRevision,
});

/** 「これはサブスクではない」の記録。集計は変わらないので subs 範囲は置き換えない */
subsRoute.post('/sub-vendors/exclusions', zValidator('json', exclusionSchema), async (c) => {
  const userId = c.get('userId');
  const { partner, baseRevision } = c.req.valid('json');
  const key = vendorKey(partner);
  if (!key) return c.json(errorBody('invalid_partner', '支払先の名前が空です'), 400);
  return subscriptionWrite(
    c,
    'exclusion',
    { withAggregates: false, baseRevision, payload: { partner } },
    async (_state, stale) => {
      if (stale) return revisionConflict(c);
      const existing = await loadSubVendorExclusions(getDb(c.env.DB), userId);
      // 同じ支払先を二度押しても増やさない (表記ゆれは照合キーで吸収)
      if (existing.some((e) => vendorKey(e.partner) === key)) return { noop: { ok: true } };
      return {
        targetVendorId: null,
        nextVendors: null,
        statements: (guard) => [
          guard(
            `INSERT INTO sub_vendor_exclusions (user_id,partner,vendor_key,created_at) SELECT ?,?,?,? WHERE ${OP_EXISTS}`,
            userId,
            partner,
            key,
            new Date().toISOString(),
          ),
        ],
        body: () => ({ ok: true }),
      };
    },
  );
});

/** 除外の取り消し。候補一覧に戻る */
subsRoute.delete('/sub-vendors/exclusions/:id', async (c) => {
  const userId = c.get('userId');
  const id = parseId(c.req.param('id'));
  if (id === null) return badId(c);
  const base = await optionalBaseBody(c);
  if (base instanceof Response) return base;
  return subscriptionWrite(
    c,
    'exclusion',
    { withAggregates: false, baseRevision: base.baseRevision, payload: { id } },
    async (_state, stale) => {
      const existing = await loadSubVendorExclusions(getDb(c.env.DB), userId);
      if (!existing.some((e) => e.id === id))
        return c.json(errorBody('not_found', '除外の記録が見つかりません'), 404);
      if (stale) return revisionConflict(c);
      return {
        targetVendorId: null,
        nextVendors: null,
        statements: (guard) => [
          guard(`DELETE FROM sub_vendor_exclusions WHERE user_id=? AND id=? AND ${OP_EXISTS}`, userId, id),
        ],
        body: () => ({ ok: true }),
      };
    },
  );
});

/** 「いま見直した」の記録。契約内容そのものは変えないので集計の作り直しは要らない */
subsRoute.post('/sub-vendors/:id/review', async (c) => {
  const userId = c.get('userId');
  const id = parseId(c.req.param('id'));
  if (id === null) return badId(c);
  const base = await optionalBaseBody(c);
  if (base instanceof Response) return base;
  const reviewedAt = new Date().toISOString();
  return subscriptionWrite(
    c,
    'review',
    { withAggregates: false, baseRevision: base.baseRevision, payload: { id } },
    (state, stale) => {
      const target = state.vendors.find((v) => v.id === id);
      if (!target) return c.json(errorBody('not_found', 'その登録はありません'), 404);
      if (blocked(target, stale)) return revisionConflict(c);
      return {
        targetVendorId: id,
        nextVendors: null,
        statements: (guard) => [
          guard(
            `UPDATE sub_vendors SET reviewed_at=? WHERE user_id=? AND id=? AND ${OP_EXISTS}`,
            reviewedAt,
            userId,
            id,
          ),
        ],
        body: () => ({ ok: true, reviewedAt }),
      };
    },
  );
});

/** 画面の期間 query。from/to > year > span の順に効き、何も無ければ全期間 (web の「全期間」) */
export interface SubscriptionsPeriodQuery {
  from?: string;
  to?: string;
  year?: string;
  span?: string;
}

const periodQueryOf = (c: Context<Ctx>): SubscriptionsPeriodQuery => ({
  from: c.req.query('from'),
  to: c.req.query('to'),
  year: c.req.query('year'),
  span: c.req.query('span'),
});

/**
 * サブスク画面の core 入力を組む。画面・詳細・判断の保存・サイドバーのバッジが同じ入口を通る
 * (バッジと KPI 5 枚目を別経路で数えない。spec §12.2)。
 *
 * freee 原本は期間で絞らずに渡す。前期間との比較と期間の切り出しは core が行う。
 * 読み込み済みの Dataset・freee 原本があれば受け取り、二度読まない。
 */
export async function loadSubscriptionsInput(
  db: Db,
  userId: string,
  query: SubscriptionsPeriodQuery,
  preloaded: { all?: Dataset; deals?: readonly FreeeDeal[] } = {},
): Promise<SubscriptionsScreenInput> {
  const [all, deals, vendors, decisions, exclusions] = await Promise.all([
    preloaded.all ?? loadDataset(db, userId),
    preloaded.deals ??
      db
        .select()
        .from(s.freeeDeals)
        .where(eq(s.freeeDeals.userId, userId))
        .then((rows) => rows.map(dealFromRow)),
    loadSubVendors(db, userId),
    loadSubVendorReviewDecisions(db, userId),
    loadSubVendorExclusions(db, userId),
  ]);
  const range: PeriodRange | null = resolvePeriodQuery(all, query);
  return {
    all,
    deals,
    range,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      aliases: v.aliases,
      accounts: v.accounts ?? [],
      category: v.category,
      reviewedAt: v.reviewedAt,
      mergedIntoId: v.mergedIntoId,
    })),
    decisions: decisions.map((d) => ({
      vendorKey: d.vendorKey,
      decision: d.decision,
      ruleFingerprint: d.ruleFingerprint,
    })),
    exclusions: exclusions.map((e) => e.partner),
    generatedAt: new Date().toISOString(),
  };
}

/** 画面 1 本ぶんの集計。取引の実体は返さず、詳細で 1 ベンダーぶんだけ返す (spec §13.1) */
subsRoute.get('/subscriptions', async (c) =>
  subscriptionReadSnapshot(c, async (revision) => {
    const input = await loadSubscriptionsInput(getDb(c.env.DB), c.get('userId'), periodQueryOf(c));
    return c.json({ ...subscriptionsScreen(input), revision });
  }),
);

/** 行を選んだあとだけ取る詳細。未登録の候補も返す (関連データは登録済みだけ) */
subsRoute.get('/subscriptions/vendors/:key', async (c) =>
  subscriptionReadSnapshot(c, async () => {
    const input = await loadSubscriptionsInput(getDb(c.env.DB), c.get('userId'), periodQueryOf(c));
    const detail = subscriptionVendorDetail(input, c.req.param('key'));
    if (!detail) return c.json(errorBody('not_found', 'そのサブスクはありません'), 404);
    return c.json(detail);
  }),
);

const vendorKeyField = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
const decisionSchema = z.object({
  vendorKey: vendorKeyField,
  decision: z.enum(['confirmed', 'dismissed']),
  baseRevision: optionalBaseRevision,
});

/**
 * 見直し候補への判断。指紋はクライアントから受け取らず、サーバが core で求めて保存する。
 *
 * 求めるときはこのベンダーへの既存の判断を外す。除外済みの行は候補から消えているため、
 * そのままでは「除外 → 確認済み」への切り替えで指紋が取れない。
 * 判断は集計には効かないが、バックアップから復元する利用者の判断なので操作として記録する。
 */
subsRoute.post('/subscriptions/review-decisions', zValidator('json', decisionSchema), async (c) => {
  const userId = c.get('userId');
  const { vendorKey: key, decision, baseRevision } = c.req.valid('json');
  return subscriptionWrite(
    c,
    'review_decision',
    { withAggregates: false, baseRevision, payload: { vendorKey: key, decision } },
    async (state, stale) => {
      const input = await loadSubscriptionsInput(getDb(c.env.DB), userId, periodQueryOf(c));
      const row = subscriptionRow(
        { ...input, decisions: input.decisions.filter((d) => d.vendorKey !== key) },
        key,
      );
      if (!row || row.status !== 'registered') {
        return c.json(errorBody('not_found', '登録済みのサブスクではありません'), 404);
      }
      if (stale) return revisionConflict(c);
      if (!row.review) return c.json(errorBody('not_candidate', '見直し候補ではありません'), 409);
      const fingerprint = row.review.fingerprint;
      const current = state.decisions.find((d) => d.vendorKey === key);
      if (current?.decision === decision && current.ruleFingerprint === fingerprint) {
        return { noop: { ok: true, vendorKey: key, decision, fingerprint, decidedAt: current.decidedAt } };
      }
      const decidedAt = new Date().toISOString();
      return {
        targetVendorId: row.vendorId,
        nextVendors: null,
        statements: (guard) => [
          guard(
            `INSERT INTO sub_vendor_review_decisions (user_id,vendor_key,decision,rule_fingerprint,decided_at)
              SELECT ?,?,?,?,? WHERE ${OP_EXISTS}
              ON CONFLICT(user_id,vendor_key) DO UPDATE SET decision=excluded.decision,
                rule_fingerprint=excluded.rule_fingerprint, decided_at=excluded.decided_at`,
            userId,
            key,
            decision,
            fingerprint,
            decidedAt,
          ),
        ],
        body: () => ({ ok: true, vendorKey: key, decision, fingerprint, decidedAt }),
      };
    },
  );
});

/** 判断の取消。候補は規則から毎回導くので、行を消せば未判断に戻る */
subsRoute.delete(
  '/subscriptions/review-decisions',
  zValidator('json', z.object({ vendorKey: vendorKeyField, baseRevision: optionalBaseRevision })),
  async (c) => {
    const userId = c.get('userId');
    const { vendorKey: key, baseRevision } = c.req.valid('json');
    return subscriptionWrite(
      c,
      'review_decision',
      { withAggregates: false, baseRevision, payload: { vendorKey: key, decision: null } },
      (state, stale) => {
        if (!state.decisions.some((d) => d.vendorKey === key)) {
          return c.json(errorBody('not_found', '判断の記録がありません'), 404);
        }
        if (stale) return revisionConflict(c);
        return {
          targetVendorId: state.vendors.find((v) => vendorKey(v.name) === key)?.id ?? null,
          nextVendors: null,
          statements: (guard) => [
            guard(
              `DELETE FROM sub_vendor_review_decisions WHERE user_id=? AND vendor_key=? AND ${OP_EXISTS}`,
              userId,
              key,
            ),
          ],
          body: () => ({ ok: true }),
        };
      },
    );
  },
);

/** 統合などの操作の履歴 (新しい順)。取り消せるかと、取り消せない理由も返す */
subsRoute.get(
  '/subscription-operations',
  zValidator('query', z.object({ limit: z.coerce.number().int().min(1).max(20).default(20) })),
  async (c) =>
    subscriptionReadSnapshot(c, (revision) =>
      listSubscriptionOperations(c, c.req.valid('query').limit, revision),
    ),
);
