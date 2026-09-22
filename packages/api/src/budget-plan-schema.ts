/**
 * 予算対象の期間別の年額 (budget_plans, 0050) の入力検証 (spec-budget-screen BR-17・BR-24)。
 * 保存 route と JSON 復元が同じ形を使う。上限の値は core の定数が正本。
 */
import {
  BUDGET_ACCOUNT_MAX,
  BUDGET_AMOUNT_LIMIT,
  BUDGET_REASON_MAX,
  BUDGET_ROWS_MAX,
  BUDGET_START_MAX,
  BUDGET_START_MIN,
  budgetKindOf,
} from '@kanjo/core';
import { z } from 'zod';

/** 予算対象の開始月。`YYYY-MM` で 2000-01〜2100-12 */
export const budgetStartSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((value) => value >= BUDGET_START_MIN && value <= BUDGET_START_MAX);

const amountSchema = z.number().int().min(-BUDGET_AMOUNT_LIMIT).max(BUDGET_AMOUNT_LIMIT);

/** 理由は前後の空白を除いて 100 字以内。空は null */
const reasonSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= BUDGET_REASON_MAX);

export const budgetPlansPutSchema = z
  .object({
    start: budgetStartSchema,
    /** GET が返した保存版。未保存の期間は null */
    baseSavedAt: z.string().min(1).max(64).nullable(),
    rows: z
      .array(
        z
          .object({
            account: z.string().min(1).max(BUDGET_ACCOUNT_MAX),
            kind: z.enum(['income', 'expense']),
            /** null はこの科目の保存済み予算を削除する dirty patch */
            annualAmount: amountSchema.nullable(),
            planAdjustment: amountSchema.optional().default(0),
            planReason: reasonSchema,
          })
          .strict()
          // 『売上高』『その他収入』だけが income。食い違いは 400 (BR-17)
          .refine((row) => row.kind === budgetKindOf(row.account)),
      )
      .min(1)
      .max(BUDGET_ROWS_MAX)
      .refine((rows) => new Set(rows.map((row) => row.account)).size === rows.length),
  })
  .strict();

/**
 * JSON バックアップの `budgetPlans`。書き出した行をそのまま受ける。
 * 金額の範囲は DB に置いていないので、復元では整数であることだけを見る (0050 の注記)。
 */
export const budgetPlansBackupSchema = z
  .array(
    z
      .object({
        periodStart: budgetStartSchema,
        account: z.string().min(1).max(BUDGET_ACCOUNT_MAX),
        kind: z.enum(['income', 'expense']),
        annualAmount: z.number().int(),
        planAdjustment: z.number().int(),
        planReason: z.string().min(1).max(BUDGET_REASON_MAX).nullable(),
        updatedAt: z.string().min(1).max(64),
      })
      .strict(),
  )
  .refine((rows) => new Set(rows.map((row) => `${row.periodStart}\0${row.account}`)).size === rows.length);
