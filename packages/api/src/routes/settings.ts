import { zValidator } from '@hono/zod-validator';
/**
 * FR-04 予算 / P9 設定(科目正規化・未記帳月・現金補正)。
 * 正規化マップ変更は集計再生成のトリガ(spec §7.3)。
 */
import {
  DEFAULT_STAT_MIN_MONTHS,
  type MfTx,
  OWNER_VALUES,
  STAT_MIN_MONTHS_MAX,
  STAT_MIN_MONTHS_MIN,
  budgetOutlook,
  budgetTable,
  cashToTx,
  clampStatMinMonths,
  normalizeAccount,
  resolveTx,
  suggestBudgets,
} from '@kanjo/core';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  type Db,
  cashFromRow,
  editFromRow,
  effectiveRules,
  getDb,
  loadDataset,
  loadOrderedRuleRows,
  recomputeFromDeals,
  replaceInstitutionOwners,
  ruleFromRow,
  saveAgg,
  upsertEdit,
} from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const settingsRoute = new Hono<Ctx>();

/* -------- 予算(FR-04) -------- */

settingsRoute.get('/budgets', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json({ budgets: data.budgets, table: budgetTable(data), outlook: budgetOutlook(data) });
});

const budgetsSchema = z.object({
  budgets: z.record(z.string().max(60), z.number().int().nonnegative().nullable()),
});

settingsRoute.put('/budgets', zValidator('json', budgetsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { budgets } = c.req.valid('json');
  const statements = [];
  for (const [account, v] of Object.entries(budgets)) {
    statements.push(
      db.delete(s.budgets).where(and(eq(s.budgets.userId, userId), eq(s.budgets.account, account))),
    );
    if (v != null && v > 0)
      statements.push(db.insert(s.budgets).values({ userId, account, monthlyAmount: v }));
  }
  if (statements.length)
    await db.batch([
      statements[0],
      ...statements.slice(1),
      invalidateJsonSnapshotQuery(db, userId, 'budgets'),
    ]);
  return c.json({ ok: true });
});

settingsRoute.post('/budgets/suggest', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json({ suggested: suggestBudgets(data) });
});

/* -------- 設定(P9) -------- */

settingsRoute.get('/settings', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [normRows, unrecRows, cashRows, analysisRows] = await Promise.all([
    db.select().from(s.accountNormMap).where(eq(s.accountNormMap.userId, userId)),
    db.select().from(s.unrecordedMonths).where(eq(s.unrecordedMonths.userId, userId)),
    db.select().from(s.cashOverrides).where(eq(s.cashOverrides.userId, userId)),
    db.select().from(s.analysisSettings).where(eq(s.analysisSettings.userId, userId)),
  ]);
  return c.json({
    statMinMonths: clampStatMinMonths(analysisRows[0]?.statMinMonths ?? DEFAULT_STAT_MIN_MONTHS),
    statMinMonthsRange: {
      min: STAT_MIN_MONTHS_MIN,
      max: STAT_MIN_MONTHS_MAX,
      default: DEFAULT_STAT_MIN_MONTHS,
    },
    normMap: Object.fromEntries(normRows.map((r) => [r.raw, r.norm])),
    unrecordedExpMonths: unrecRows.filter((r) => r.kind === 'expense').map((r) => r.month),
    cashOverrides: Object.fromEntries(
      cashRows.map((r) => [r.month, { revenue: r.revenue ?? 0, expense: r.expense ?? 0 }]),
    ),
  });
});

const settingsSchema = z.object({
  normMap: z.record(z.string().max(60), z.string().max(60)).optional(),
  unrecordedExpMonths: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  cashOverrides: z
    .record(
      z.string().regex(/^\d{4}-\d{2}$/),
      z
        .object({ revenue: z.number().int().nonnegative(), expense: z.number().int().nonnegative() })
        .nullable(),
    )
    .optional(),
  /** AI分析の統計指標が必要とする記帳月数。既定6・3〜24 */
  statMinMonths: z.number().int().min(STAT_MIN_MONTHS_MIN).max(STAT_MIN_MONTHS_MAX).optional(),
});

settingsRoute.put('/settings', zValidator('json', settingsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  let needRecompute = false;
  const statements = [];
  const consumers: Array<
    'account_norm_map' | 'unrecorded_months' | 'cash_overrides' | 'sub_vendors' | 'analysis_settings'
  > = [];

  if (b.normMap) {
    // 旧版はnormalized labelを永続参照にしていた。現在のmapを変える前に、該当する
    // account_rawへ展開して安定参照へ移す（同じlabelのrawが複数なら全てを残す）。
    const [oldNormRows, rawRows, vendorRows] = await Promise.all([
      db.select().from(s.accountNormMap).where(eq(s.accountNormMap.userId, userId)),
      db
        .selectDistinct({ raw: s.freeeDeals.accountRaw })
        .from(s.freeeDeals)
        .where(eq(s.freeeDeals.userId, userId)),
      db
        .select({ id: s.subVendors.id, accounts: s.subVendors.accounts })
        .from(s.subVendors)
        .where(eq(s.subVendors.userId, userId)),
    ]);
    const oldMap = Object.fromEntries(oldNormRows.map((row) => [row.raw, row.norm]));
    const rawAccounts = [
      ...new Set([
        ...rawRows.map((row) => row.raw ?? '').filter(Boolean),
        ...Object.keys(oldMap),
        ...Object.keys(b.normMap),
      ]),
    ].sort();
    const rawSet = new Set(rawAccounts);
    const migrated = vendorRows.flatMap((vendor) => {
      let stored: string[];
      try {
        const parsed: unknown = JSON.parse(vendor.accounts);
        stored = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch {
        stored = [];
      }
      const accounts = [
        ...new Set(
          stored.flatMap((account) => {
            const matches = rawAccounts.filter((raw) => normalizeAccount(raw, oldMap) === account);
            // 旧normalized labelと同名のrawがある場合は、どちらの意味だったか判別できない。
            // raw解釈を保持しつつ、そのlabelへ属していた全rawへ展開して取りこぼしを防ぐ。
            if (rawSet.has(account)) return [account, ...matches];
            return matches.length ? matches : [account];
          }),
        ),
      ];
      const encoded = JSON.stringify(accounts);
      return encoded === vendor.accounts ? [] : [[vendor.id, encoded] as const];
    });
    if (migrated.length) {
      const payload = JSON.stringify(migrated);
      statements.push(
        db
          .update(s.subVendors)
          .set({
            accounts: sql<string>`(
              SELECT CAST(json_extract(value, '$[1]') AS TEXT)
              FROM json_each(${payload})
              WHERE CAST(json_extract(value, '$[0]') AS INTEGER) = ${s.subVendors.id}
            )`,
          })
          .where(
            and(
              eq(s.subVendors.userId, userId),
              sql`${s.subVendors.id} IN (
                SELECT CAST(json_extract(value, '$[0]') AS INTEGER) FROM json_each(${payload})
              )`,
            ),
          ),
      );
      consumers.push('sub_vendors');
    }
    statements.push(db.delete(s.accountNormMap).where(eq(s.accountNormMap.userId, userId)));
    for (const [raw, norm] of Object.entries(b.normMap)) {
      statements.push(db.insert(s.accountNormMap).values({ userId, raw, norm }));
    }
    consumers.push('account_norm_map');
    needRecompute = true;
  }
  if (b.unrecordedExpMonths) {
    statements.push(
      db
        .delete(s.unrecordedMonths)
        .where(and(eq(s.unrecordedMonths.userId, userId), eq(s.unrecordedMonths.kind, 'expense'))),
    );
    for (const m of b.unrecordedExpMonths) {
      statements.push(db.insert(s.unrecordedMonths).values({ userId, month: m, kind: 'expense' }));
    }
    consumers.push('unrecorded_months');
  }
  if (b.cashOverrides) {
    for (const [month, v] of Object.entries(b.cashOverrides)) {
      statements.push(
        db
          .delete(s.cashOverrides)
          .where(and(eq(s.cashOverrides.userId, userId), eq(s.cashOverrides.month, month))),
      );
      if (v)
        statements.push(
          db.insert(s.cashOverrides).values({ userId, month, revenue: v.revenue, expense: v.expense }),
        );
    }
    consumers.push('cash_overrides');
  }

  // AI分析の基準月数も復元対象のdurable intent。同じbatchでpointerを無効化する。
  if (b.statMinMonths != null) {
    statements.push(
      db
        .insert(s.analysisSettings)
        .values({ userId, statMinMonths: b.statMinMonths })
        .onConflictDoUpdate({
          target: s.analysisSettings.userId,
          set: { statMinMonths: b.statMinMonths, updatedAt: new Date().toISOString() },
        }),
    );
    consumers.push('analysis_settings');
  }

  if (statements.length && consumers.length)
    await db.batch([
      statements[0],
      ...statements.slice(1),
      invalidateJsonSnapshotQuery(db, userId, consumers[0], ...consumers.slice(1)),
    ]);

  if (needRecompute) await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

/* -------- 分類の設定(名義・候補科目・手動編集の一覧) -------- */

settingsRoute.get('/classification', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  // 保有金融機関ごとの件数・名義
  const instCount = new Map<string, number>();
  let noInstitutionCount = 0;
  for (const t of data.mfTx) {
    if (!t.inst) noInstitutionCount++;
    else instCount.set(t.inst, (instCount.get(t.inst) ?? 0) + 1);
  }
  const institutions = [...instCount.entries()]
    .map(([institution, count]) => ({
      institution,
      count,
      owner: data.institutionOwners[institution] ?? null,
    }))
    .sort((a, b) => b.count - a.count);
  const byId = new Map(data.mfTx.map((t) => [t.id, t]));
  const edits = Object.entries(data.edits)
    .map(([txId, e]) => {
      const t = byId.get(txId);
      const r = t ? resolveTx(t, data.rules, data.edits, data.institutionOwners) : null;
      return {
        txId,
        month: t?.m ?? null,
        date: t?.d ?? null,
        description: t?.c ?? null,
        amount: t?.a ?? null,
        csvBig: t?.big ?? null,
        csvMid: t?.mid ?? null,
        cls: e.cls ?? null,
        big: e.big ?? null,
        mid: e.mid ?? null,
        owner: e.owner ?? null,
        baseBig: e.baseBig ?? null,
        baseMid: e.baseMid ?? null,
        updatedAt: e.updatedAt ?? null,
        /** ok: 有効 / changed: 取込値が編集時と変わった / orphan: 元明細が無い */
        status: !t ? 'orphan' : r?.conflict ? 'changed' : 'ok',
      };
    })
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return c.json({
    institutions,
    noInstitutionCount,
    institutionOwners: data.institutionOwners,
    categoryOptions: await listCategoryOptions(db, userId),
    candidates: await loadCandidates(db, userId, data.mfTx),
    edits,
  });
});

/* -------- 候補科目(追加した分)の一覧・追加・変更・削除 -------- */

const optKey = (o: { scope: string; major: string; mid: string }) => `${o.scope}\t${o.major}\t${o.mid}`;

type CategoryKey = { scope: string; major: string; mid: string };
type CategoryConsumer = { scope?: string | null; major?: string | null; mid?: string | null };
type CategoryUsageContext = {
  options: Array<typeof s.categoryOptions.$inferSelect>;
  edits: Array<typeof s.txEdits.$inferSelect>;
  rules: Array<typeof s.rules.$inferSelect>;
  cashEntries: Array<typeof s.cashEntries.$inferSelect>;
  freeeMajors: Set<string>;
  mfMajors: Set<string>;
  mfPairs: Set<string>;
  effectiveEditScopes: Map<string, 'biz' | 'per'>;
};

const pairKey = (major: string, mid: string) => `${major}\t${mid}`;

/** categoryAllowedと同じ「個人の中項目なしは大項目だけで可」の供給関係 */
const optionSupplies = (option: CategoryKey, consumer: CategoryConsumer): boolean => {
  const scope = consumer.scope;
  const mid = consumer.mid ?? '';
  if (!scope || scope !== option.scope || consumer.major !== option.major) return false;
  return scope === 'biz' ? !mid : !mid || mid === option.mid;
};

/**
 * 対象optionを取り除くとconsumerの科目が候補外になるか。
 * raw MF/freeeや他optionが供給を続ける場合は、削除・renameを過剰に防げない。
 */
const dependsOnCategoryOption = (
  target: CategoryKey,
  consumer: CategoryConsumer,
  context: CategoryUsageContext,
): boolean => {
  if (!optionSupplies(target, consumer)) return false;
  const scope = consumer.scope;
  if (!scope) return false;
  const major = consumer.major ?? '';
  const mid = consumer.mid ?? '';
  const suppliedByRaw =
    scope === 'biz'
      ? context.freeeMajors.has(major)
      : mid
        ? context.mfPairs.has(pairKey(major, mid))
        : context.mfMajors.has(major);
  if (suppliedByRaw) return false;
  return !context.options.some(
    (option) => optKey(option) !== optKey(target) && optionSupplies(option, consumer),
  );
};

async function loadCategoryUsageContext(db: Db, userId: string): Promise<CategoryUsageContext> {
  const [options, edits, rules, cashEntries, freeeRows, mfRows] = await Promise.all([
    db.select().from(s.categoryOptions).where(eq(s.categoryOptions.userId, userId)),
    db.select().from(s.txEdits).where(eq(s.txEdits.userId, userId)),
    loadOrderedRuleRows(db, userId),
    db.select().from(s.cashEntries).where(eq(s.cashEntries.userId, userId)),
    db
      .selectDistinct({ major: s.freeeDeals.accountRaw })
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.mfTransactions).where(eq(s.mfTransactions.userId, userId)),
  ]);
  const mfPairs = new Set<string>();
  const mfMajors = new Set<string>();
  for (const row of mfRows) {
    const major = row.categoryMajor ?? '';
    if (!major) continue;
    mfMajors.add(major);
    if (row.categoryMid) mfPairs.add(pairKey(major, row.categoryMid));
  }
  const resolvedRules = effectiveRules(rules);
  const editMap = Object.fromEntries(edits.map((row) => [row.txId, editFromRow(row)]));
  const txById = new Map<string, MfTx>(
    mfRows.map((row) => [
      row.txId,
      {
        id: row.txId,
        m: row.month,
        d: row.date.slice(5).replace('-', '/'),
        c: row.description,
        a: row.amount,
        big: row.categoryMajor ?? '',
        mid: row.categoryMid ?? '',
        inst: row.institution ?? undefined,
      },
    ]),
  );
  for (const entry of cashEntries.filter((row) => row.side === 'per')) {
    const tx = cashToTx(cashFromRow(entry));
    txById.set(tx.id, tx);
  }
  const effectiveEditScopes = new Map<string, 'biz' | 'per'>();
  for (const edit of edits) {
    if (edit.cls) {
      effectiveEditScopes.set(edit.txId, edit.cls);
      continue;
    }
    const tx = txById.get(edit.txId);
    if (tx) effectiveEditScopes.set(edit.txId, resolveTx(tx, resolvedRules, editMap).cls);
  }
  return {
    options,
    edits,
    rules,
    cashEntries,
    freeeMajors: new Set(freeeRows.map((row) => row.major ?? '').filter(Boolean)),
    mfMajors,
    mfPairs,
    effectiveEditScopes,
  };
}

/** 追加した候補科目と、それを使っている手動編集・ルール・現金明細の件数 */
async function listCategoryOptions(db: Db, userId: string) {
  const context = await loadCategoryUsageContext(db, userId);
  return context.options
    .map((o) => ({
      scope: o.scope,
      major: o.major,
      mid: o.mid,
      uses: {
        edits: context.edits.filter((e) =>
          dependsOnCategoryOption(
            o,
            {
              scope: context.effectiveEditScopes.get(e.txId),
              major: e.categoryMajor,
              mid: e.categoryMid,
            },
            context,
          ),
        ).length,
        rules: context.rules.filter((r) =>
          dependsOnCategoryOption(o, { scope: r.cls, major: r.categoryMajor, mid: r.categoryMid }, context),
        ).length,
        cashEntries: context.cashEntries.filter((entry) =>
          dependsOnCategoryOption(
            o,
            { scope: entry.side, major: entry.categoryMajor, mid: entry.categoryMid },
            context,
          ),
        ).length,
      },
    }))
    .sort((a, b) => optKey(a).localeCompare(optKey(b), 'ja'));
}

const optionSchema = z.object({
  scope: z.enum(['biz', 'per']),
  major: z.string().trim().min(1).max(60),
  mid: z.string().trim().max(60).default(''),
});

settingsRoute.post('/category-options', zValidator('json', optionSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (b.scope === 'biz' && b.mid)
    return c.json(
      { error: { code: 'biz_has_no_mid', message: '事業の科目(freee勘定科目)には中項目がありません' } },
      400,
    );
  const dup = await db
    .select()
    .from(s.categoryOptions)
    .where(
      and(
        eq(s.categoryOptions.userId, userId),
        eq(s.categoryOptions.scope, b.scope),
        eq(s.categoryOptions.major, b.major),
        eq(s.categoryOptions.mid, b.mid),
      ),
    );
  if (!dup.length)
    await db.insert(s.categoryOptions).values({ userId, scope: b.scope, major: b.major, mid: b.mid });
  return c.json({ ok: true, option: b, existed: dup.length > 0 }, dup.length ? 200 : 201);
});

const optionRenameSchema = z.object({
  from: optionSchema,
  to: z.object({ major: z.string().trim().min(1).max(60), mid: z.string().trim().max(60).default('') }),
});

/** 名前の変更。使用中の手動編集・ルール・現金明細も新しい名前へ追従させる */
settingsRoute.put('/category-options', zValidator('json', optionRenameSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { from, to } = c.req.valid('json');
  if (from.scope === 'biz' && to.mid)
    return c.json(
      { error: { code: 'biz_has_no_mid', message: '事業の科目(freee勘定科目)には中項目がありません' } },
      400,
    );
  const where = and(
    eq(s.categoryOptions.userId, userId),
    eq(s.categoryOptions.scope, from.scope),
    eq(s.categoryOptions.major, from.major),
    eq(s.categoryOptions.mid, from.mid),
  );
  const context = await loadCategoryUsageContext(db, userId);
  if (!context.options.some((option) => optKey(option) === optKey(from)))
    return c.json({ error: { code: 'not_found', message: '候補科目が見つかりません' } }, 404);
  const dependentEdits = context.edits.filter((edit) =>
    dependsOnCategoryOption(
      from,
      {
        scope: context.effectiveEditScopes.get(edit.txId),
        major: edit.categoryMajor,
        mid: edit.categoryMid,
      },
      context,
    ),
  );
  const dependentRules = context.rules.filter((rule) =>
    dependsOnCategoryOption(
      from,
      { scope: rule.cls, major: rule.categoryMajor, mid: rule.categoryMid },
      context,
    ),
  );
  const affectedCashRows = context.cashEntries.filter((entry) =>
    dependsOnCategoryOption(
      from,
      { scope: entry.side, major: entry.categoryMajor, mid: entry.categoryMid },
      context,
    ),
  );
  const splitIds = <T extends { categoryMid: string | null }, K>(rows: T[], key: (row: T) => K) => ({
    majorOnly: rows.filter((row) => !row.categoryMid).map(key),
    exact: rows.filter((row) => !!row.categoryMid).map(key),
  });
  const editIds = splitIds(dependentEdits, (row) => row.txId);
  const ruleIds = splitIds(dependentRules, (row) => row.id);
  const cashIds = splitIds(affectedCashRows, (row) => row.id);
  const midOrNull = to.mid || null;
  // 候補と全consumerのrenameを同じD1トランザクションで完了させる。
  await db.batch([
    db.delete(s.categoryOptions).where(where),
    db.insert(s.categoryOptions).values({ userId, scope: from.scope, major: to.major, mid: to.mid }),
    db
      .update(s.txEdits)
      .set({ categoryMajor: to.major })
      .where(and(eq(s.txEdits.userId, userId), inArray(s.txEdits.txId, editIds.majorOnly))),
    db
      .update(s.txEdits)
      .set({ categoryMajor: to.major, categoryMid: midOrNull })
      .where(and(eq(s.txEdits.userId, userId), inArray(s.txEdits.txId, editIds.exact))),
    db
      .update(s.rules)
      .set({ categoryMajor: to.major })
      .where(and(eq(s.rules.userId, userId), inArray(s.rules.id, ruleIds.majorOnly))),
    db
      .update(s.rules)
      .set({ categoryMajor: to.major, categoryMid: midOrNull })
      .where(and(eq(s.rules.userId, userId), inArray(s.rules.id, ruleIds.exact))),
    db
      .update(s.cashEntries)
      .set({ categoryMajor: to.major, updatedAt: new Date().toISOString() })
      .where(and(eq(s.cashEntries.userId, userId), inArray(s.cashEntries.id, cashIds.majorOnly))),
    db
      .update(s.cashEntries)
      .set({ categoryMajor: to.major, categoryMid: to.mid, updatedAt: new Date().toISOString() })
      .where(and(eq(s.cashEntries.userId, userId), inArray(s.cashEntries.id, cashIds.exact))),
    invalidateJsonSnapshotQuery(db, userId, 'tx_edits', 'rules', 'cash_entries'),
  ]);
  await recomputeFromDeals(db, userId, affectedCashRows.map(cashFromRow));
  return c.json({ ok: true });
});

const optionDeleteSchema = optionSchema.extend({ force: z.boolean().optional() });

/** 削除。使用中(手動編集・ルール・現金明細)なら force なしでは 409 を返し、件数を知らせる */
settingsRoute.delete('/category-options', zValidator('json', optionDeleteSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const all = await listCategoryOptions(db, userId);
  const target = all.find((o) => o.scope === b.scope && o.major === b.major && o.mid === b.mid);
  if (!target) return c.json({ error: { code: 'not_found', message: '候補科目が見つかりません' } }, 404);
  const inUse = Object.values(target.uses).reduce((sum, count) => sum + count, 0);
  if (inUse && !b.force)
    return c.json(
      {
        error: {
          code: 'in_use',
          message: `この科目は手動編集 ${target.uses.edits} 件・ルール ${target.uses.rules} 件・現金明細 ${target.uses.cashEntries} 件で使われています。削除しても使用中の値は残りますが、候補から外れます`,
        },
        uses: target.uses,
      },
      409,
    );
  await db
    .delete(s.categoryOptions)
    .where(
      and(
        eq(s.categoryOptions.userId, userId),
        eq(s.categoryOptions.scope, b.scope),
        eq(s.categoryOptions.major, b.major),
        eq(s.categoryOptions.mid, b.mid),
      ),
    );
  return c.json({ ok: true });
});

const classificationSchema = z.object({
  institutionOwners: z.record(z.string().max(100), z.enum(OWNER_VALUES).nullable()).optional(),
  /** 指定した明細の編集を取込値に戻す */
  resetEdits: z.array(z.string().max(100)).max(500).optional(),
});

settingsRoute.put('/classification', zValidator('json', classificationSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (b.institutionOwners) {
    const data = await loadDataset(db, userId);
    const map = { ...data.institutionOwners };
    for (const [inst, owner] of Object.entries(b.institutionOwners)) {
      if (owner) map[inst] = owner;
      else delete map[inst];
    }
    await replaceInstitutionOwners(db, userId, map);
  }
  if (b.resetEdits) {
    for (const txId of b.resetEdits) await upsertEdit(db, userId, txId, {});
  }
  if (b.institutionOwners || b.resetEdits) {
    const data = await loadDataset(db, userId);
    await saveAgg(db, userId, data);
  }
  return c.json({ ok: true });
});

/**
 * 正規化マップ変更時: 原本仕訳(freee_deals)から account_norm を再導出して集計を作り直す。
 * 原本の無い月(restore由来)は既存の monthly_agg 値が温存される。
 */

/* -------- 夜間バックアップの取り出し(FR-05) -------- */

/** `backups/YYYY-MM-DD.json` の日付部分だけを許す。R2 のキーを外から組み立てさせない */
const backupDateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * cron が R2 に置いた夜間バックアップの一覧。
 *
 * バックアップは取っていても、画面から取り出せなければ「戻せる」ことにならない。
 * 復元そのものは監査済みの POST /api/restore を通す方針なので、
 * ここは一覧と本文の取り出しだけを担う。
 */
settingsRoute.get('/backups', async (c) => {
  const list = await c.env.FILES.list({ prefix: 'backups/' });
  const items = list.objects
    .map((o) => ({
      date: o.key.slice('backups/'.length, 'backups/'.length + 10),
      size: o.size,
      uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : null,
    }))
    .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return c.json({ backups: items });
});

settingsRoute.get('/backups/:date', zValidator('param', backupDateSchema), async (c) => {
  const { date } = c.req.valid('param');
  const obj = await c.env.FILES.get(`backups/${date}.json`);
  if (!obj)
    return c.json(
      { error: { code: 'backup_not_found', message: 'そのバックアップは残っていません(保持は30日)' } },
      404,
    );
  return new Response(obj.body, { headers: { 'Content-Type': 'application/json' } });
});
