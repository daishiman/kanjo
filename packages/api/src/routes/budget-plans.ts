/**
 * 予算画面 (spec-budget-screen) の取得と保存。
 *
 * 数値はすべて core の `budgetScreen` / `budgetPlansView` が出す。ここでは計算し直さない。
 * 旧 `/api/budgets` 系 (settings.ts) は互換のため残し、この画面は使わない。
 */
import { zValidator } from '@hono/zod-validator';
import { budgetPlansView, budgetScreen, defaultBudgetStart } from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import { budgetPlansPutSchema, budgetStartSchema } from '../budget-plan-schema.js';
import { invalidateJsonSnapshotStatement } from '../import-active.js';
import { chunkJsonRowsByBytes, insertJsonRows } from '../import-lifecycle.js';
import { INVALID_PUBLIC_REQUEST, publicJsonValidator } from '../public-validation.js';
import { loadScoped } from './analytics.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const budgetPlansRoute = new Hono<Ctx>();

const invalidQuery = (result: { success: boolean }, c: { json: (body: unknown, status: 400) => Response }) =>
  result.success ? undefined : c.json(INVALID_PUBLIC_REQUEST, 400);

/** 実績期間 (span/year/from/to) は loadScoped に任せるので、ここでは start だけを見る */
const screenQuerySchema = z.object({ start: budgetStartSchema.optional() });
const plansQuerySchema = z.object({ start: budgetStartSchema });

const revisionOf = async (database: D1Database, userId: string, start: string): Promise<string | null> => {
  const row = await database
    .prepare(
      `SELECT MAX(updated_at) AS saved_at
       FROM budget_plans
       WHERE user_id=? AND period_start=?`,
    )
    .bind(userId, start)
    .first<{ saved_at: string | null }>();
  return row?.saved_at ?? null;
};

/** 同じミリ秒内の連続保存でも、直前とは異なるRFC 3339時刻を発行する。 */
const nextRevision = (baseSavedAt: string | null): string => {
  const baseTime = baseSavedAt === null ? Number.NaN : Date.parse(baseSavedAt);
  return new Date(Math.max(Date.now(), Number.isFinite(baseTime) ? baseTime + 1 : 0)).toISOString();
};

const conflict = {
  error: {
    code: 'budget_plan_conflict',
    message: '予算が別の画面で更新されています。最新の内容を読み直してください',
  },
} as const;

budgetPlansRoute.get('/budget-screen', zValidator('query', screenQuerySchema, invalidQuery), async (c) => {
  const { start } = c.req.valid('query');
  const { data, all, period } = await loadScoped(c);
  // 開始月の既定 (実績期間の終了月の翌月) は core と同じ関数で決め、その期間の保存行だけを渡す。
  // 行は loadDataset が budgets と同じ 1 文で読んだもの (追加の問合せ無し)
  const target = start ?? defaultBudgetStart(period.applied ?? period.full);
  const plans = (all.budgetPlans ?? []).filter((plan) => plan.periodStart === target);
  const result = budgetScreen({ data, all, range: period.applied, start: target, plans });
  return c.json({ ...result, revision: result.savedAt, period });
});

budgetPlansRoute.get('/budget-plans', zValidator('query', plansQuerySchema, invalidQuery), async (c) => {
  const { start } = c.req.valid('query');
  const { all } = await loadScoped(c);
  const plans = (all.budgetPlans ?? []).filter((plan) => plan.periodStart === start);
  const result = budgetPlansView(all.budgets, start, plans);
  return c.json({ ...result, revision: result.savedAt });
});

budgetPlansRoute.put('/budget-plans', publicJsonValidator(budgetPlansPutSchema), async (c) => {
  const userId = c.get('userId');
  const { start, baseSavedAt, rows } = c.req.valid('json');

  // canonicalMutationFence が同一利用者の更新を直列化した内側で比較するため、
  // 照合からbatch完了まで別の canonical mutation が割り込まない。
  const currentSavedAt = await revisionOf(c.env.DB, userId, start);
  if (currentSavedAt !== baseSavedAt) return c.json(conflict, 409);

  const savedAt = nextRevision(baseSavedAt);
  const accounts = rows.map((row) => [row.account] as const);
  const upserts = rows.filter((row) => row.annualAmount !== null);
  const deleteStatements = chunkJsonRowsByBytes(accounts).map((payload) =>
    c.env.DB.prepare(
      `DELETE FROM budget_plans
         WHERE user_id=? AND period_start=?
           AND account IN (
             SELECT CAST(json_extract(item.value,'$[0]') AS TEXT)
             FROM json_each(?) AS item
           )`,
    ).bind(userId, start, payload),
  );

  // dirty 科目だけを置換する。同じ batch 内なので、途中で失敗すれば削除も含めて戻る。
  await c.env.DB.batch([
    ...deleteStatements,
    ...insertJsonRows(
      c.env.DB,
      'budget_plans',
      ['account', 'kind', 'annual_amount', 'plan_adjustment', 'plan_reason'],
      upserts.map((row) => [row.account, row.kind, row.annualAmount, row.planAdjustment, row.planReason]),
      [
        { column: 'user_id', value: userId },
        { column: 'period_start', value: start },
        { column: 'updated_at', value: savedAt },
      ],
    ),
    // 削除だけのpatchでも、残った行を同じ期間revisionへ進める。
    c.env.DB.prepare('UPDATE budget_plans SET updated_at=? WHERE user_id=? AND period_start=?').bind(
      savedAt,
      userId,
      start,
    ),
    invalidateJsonSnapshotStatement(c.env.DB, userId, 'budget_plans'),
  ]);
  const revision = await revisionOf(c.env.DB, userId, start);
  return c.json({ ok: true as const, start, count: rows.length, savedAt: revision, revision });
});
