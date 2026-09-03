/**
 * 取込データの削除・取り消しと、その履歴。
 *
 *   POST /api/imports/:id/undo/preflight … その取込を消すと何がどうなるか
 *   POST /api/imports/:id/undo           … その取込を消す
 *   POST /api/imports/:id/discard/preflight … 非有効な履歴だけを破棄できるか確認
 *   POST /api/imports/:id/discard           … 履歴と不要になった保存原本を破棄
 *   POST /api/data/deletions/preflight   … 明細/期間/全件を消すと何がどうなるか
 *   POST /api/data/deletions             … 明細/期間/全件を消す
 *   POST /api/data/undo/:operationId     … 消したのを戻す
 *   GET  /api/data/operations            … 消した・戻した履歴
 *
 * 応答に明細の内容・金額を入れない(DR-9)。出すのは件数・月・粒度だけ。
 * 「何が消えるか」を件数でしか見せないのは不親切に見えるが、
 * 履歴はブラウザの履歴にもログにも残る。中身を出す窓をここに開けない。
 *
 * 直列化(DR-3)は canonical-mutation-fence が持つ。実行系の3経路をそこへ登録してある。
 */
import { zValidator } from '@hono/zod-validator';
import { DELETION_GRANULARITIES, IMPORT_KINDS } from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import {
  AllScopeConfirmationError,
  DELETION_UNDO_RETENTION_DAYS,
  DeletionBudgetError,
  DeletionScopeChangedError,
  UndoAlreadyDoneError,
  UndoExpiredError,
  UndoNotFoundError,
  executeDeletion,
  executeUndo,
  planDeletion,
} from '../deletion-lifecycle.js';
import {
  ImportHistoryDiscardNotAllowedError,
  ImportHistoryDiscardNotFoundError,
  ImportHistoryDiscardScopeChangedError,
  executeImportHistoryDiscard,
  planImportHistoryDiscard,
} from '../import-history-discard.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const deletionsRoute = new Hono<Ctx>();

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const deletionRequestSchema = z
  .object({
    granularity: z.enum(DELETION_GRANULARITIES as unknown as [string, ...string[]]),
    txIds: z.array(z.string().min(1)).max(5000).optional(),
    period: z
      .object({ from: z.string().regex(monthPattern), to: z.string().regex(monthPattern) })
      .strict()
      .optional(),
    kinds: z.array(z.enum(IMPORT_KINDS as unknown as [string, ...string[]])).optional(),
    /** 全件実行で利用者が画面へ入力する範囲。preflightでは任意、実行時だけ必須。 */
    confirmedPeriod: z
      .object({ from: z.string().regex(monthPattern), to: z.string().regex(monthPattern) })
      .strict()
      .optional(),
    /** preflight で見せた指紋。実行時に付ける。付いていなければ実行しない */
    fingerprint: z.string().min(1).optional(),
  })
  .strict()
  // 粒度ごとに要る項目が違う。ここで弾かないと、txIds の無い明細削除が
  // 「対象0件の削除」として素通りする
  .refine((v) => v.granularity !== 'transaction' || (v.txIds?.length ?? 0) > 0, {
    message: '明細を1件以上指定してください',
  })
  .refine((v) => v.granularity !== 'period' || !!v.period, { message: '期間を指定してください' })
  .refine((v) => !v.kinds || v.granularity === 'period' || v.granularity === 'all', {
    message: '種別は期間または全件の絞り込みにだけ指定できます',
  })
  .refine((v) => !v.period || v.period.from <= v.period.to, { message: '期間の前後が逆です' })
  .refine((v) => !v.confirmedPeriod || v.confirmedPeriod.from <= v.confirmedPeriod.to, {
    message: '確認範囲の前後が逆です',
  });

const importIdParam = z.object({ id: z.coerce.number().int().positive() }).strict();
const operationIdParam = z.object({ operationId: z.string().min(1).max(64) }).strict();

const discardErrorResponse = (error: ImportHistoryDiscardNotAllowedError) => ({
  error: {
    code: `import_history_discard_${error.reason}`,
    message:
      error.reason === 'in_progress'
        ? '処理中の取込履歴は削除できません。完了後に確認してください'
        : error.reason === 'legacy'
          ? '旧形式の取込履歴は、帳簿データとの関係を確認できないため削除できません'
          : error.reason === 'active'
            ? '現在使われている取込です。履歴ではなく「取り消す」から帳簿データを確認してください'
            : error.reason === 'has_canonical_data'
              ? 'この取込を参照する帳簿データが残っているため、履歴だけは削除できません'
              : error.reason === 'has_undo_snapshot'
                ? '取り消し用の保管データがこの取込を参照しているため、履歴はまだ削除できません'
                : 'この状態の取込履歴は削除できません',
  },
});

const handleDiscardPlanError = (error: unknown) => {
  if (error instanceof ImportHistoryDiscardNotFoundError)
    return {
      body: { error: { code: 'not_found', message: '取込履歴が見つかりません' } },
      status: 404 as const,
    };
  if (error instanceof ImportHistoryDiscardNotAllowedError)
    return { body: discardErrorResponse(error), status: 409 as const };
  return null;
};

deletionsRoute.post('/imports/:id/discard/preflight', zValidator('param', importIdParam), async (c) => {
  const { id } = c.req.valid('param');
  try {
    const plan = await planImportHistoryDiscard(c.env.DB, c.get('userId'), id);
    return c.json({
      fingerprint: plan.fingerprint,
      originalDisposition: plan.originalDisposition,
    });
  } catch (error) {
    const handled = handleDiscardPlanError(error);
    if (handled) return c.json(handled.body, handled.status);
    throw error;
  }
});

deletionsRoute.post(
  '/imports/:id/discard',
  zValidator('param', importIdParam),
  zValidator('json', z.object({ fingerprint: z.string().min(1) }).strict()),
  async (c) => {
    const { id } = c.req.valid('param');
    try {
      const result = await executeImportHistoryDiscard({
        env: c.env,
        userId: c.get('userId'),
        importId: id,
        expectedFingerprint: c.req.valid('json').fingerprint,
        operationId: crypto.randomUUID(),
      });
      return c.json(result);
    } catch (error) {
      const handled = handleDiscardPlanError(error);
      if (handled) return c.json(handled.body, handled.status);
      if (error instanceof ImportHistoryDiscardScopeChangedError)
        return c.json(
          {
            error: {
              code: 'import_history_discard_scope_changed',
              message: '確認後に取込履歴の状態が変わりました。もう一度確認してください',
            },
          },
          409,
        );
      throw error;
    }
  },
);

/** 画面へ返す preflight の形。件数と月だけを出す。 */
const preflightBody = (preflight: Awaited<ReturnType<typeof planDeletion>>) => ({
  counts: preflight.counts,
  collateral: preflight.collateral,
  months: preflight.targets.months,
  fingerprint: preflight.fingerprint,
  /** 実行時刻は未確定なので、絶対時刻ではなく実行後の保持日数を返す。 */
  undoable: true,
  undoRetentionDays: DELETION_UNDO_RETENTION_DAYS,
});

deletionsRoute.post('/imports/:id/undo/preflight', zValidator('param', importIdParam), async (c) => {
  const { id } = c.req.valid('param');
  const preflight = await planDeletion(c.env.DB, c.get('userId'), {
    granularity: 'import',
    importId: id,
  });
  return c.json(preflightBody(preflight));
});

deletionsRoute.post('/data/deletions/preflight', zValidator('json', deletionRequestSchema), async (c) => {
  const body = c.req.valid('json');
  const { fingerprint: _fingerprint, confirmedPeriod: _confirmedPeriod, ...request } = body;
  const preflight = await planDeletion(c.env.DB, c.get('userId'), request as never);
  return c.json(preflightBody(preflight));
});

const scopeChangedResponse = {
  code: 'deletion_scope_changed',
  message: '確認した内容から対象が変わりました。もう一度確認してください',
} as const;

async function runDeletion(
  database: D1Database,
  userId: string,
  request: Parameters<typeof executeDeletion>[0]['request'],
  expectedFingerprint: string | undefined,
  confirmedPeriod?: Parameters<typeof executeDeletion>[0]['confirmedPeriod'],
) {
  const operationId = crypto.randomUUID();
  const result = await executeDeletion({
    database,
    userId,
    operationId,
    request,
    expectedFingerprint,
    confirmedPeriod,
  });
  return result;
}

deletionsRoute.post(
  '/imports/:id/undo',
  zValidator('param', importIdParam),
  zValidator('json', z.object({ fingerprint: z.string().min(1) }).strict()),
  async (c) => {
    const { id } = c.req.valid('param');
    try {
      const result = await runDeletion(
        c.env.DB,
        c.get('userId'),
        { granularity: 'import', importId: id },
        c.req.valid('json').fingerprint,
      );
      return c.json({
        operationId: result.operationId,
        counts: result.counts,
        months: result.targets.months,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      if (error instanceof DeletionScopeChangedError) return c.json({ error: scopeChangedResponse }, 409);
      throw error;
    }
  },
);

deletionsRoute.post('/data/deletions', zValidator('json', deletionRequestSchema), async (c) => {
  const body = c.req.valid('json');
  if (!body.fingerprint)
    return c.json(
      {
        error: {
          code: 'fingerprint_required',
          message: '削除の前に、消える内容の確認が要ります',
        },
      },
      400,
    );
  if (body.granularity === 'all' && !body.confirmedPeriod)
    return c.json(
      {
        error: {
          code: 'all_scope_confirmation_required',
          message: '全件を消すには、画面に表示された全期間を入力してください',
        },
      },
      400,
    );
  try {
    const { fingerprint, confirmedPeriod, ...request } = body;
    const result = await runDeletion(
      c.env.DB,
      c.get('userId'),
      request as never,
      fingerprint,
      confirmedPeriod,
    );
    return c.json({
      operationId: result.operationId,
      counts: result.counts,
      months: result.targets.months,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof DeletionScopeChangedError) return c.json({ error: scopeChangedResponse }, 409);
    if (error instanceof AllScopeConfirmationError)
      return c.json(
        {
          error: {
            code: `all_scope_confirmation_${error.reason}`,
            message:
              error.reason === 'required'
                ? '全件を消すには、画面に表示された全期間を入力してください'
                : '確認した期間の外に対象があります。もう一度範囲を確認してください',
          },
        },
        400,
      );
    if (error instanceof DeletionBudgetError)
      return c.json(
        {
          error: {
            code: 'deletion_too_large',
            message: '一度に消せる量を超えています。期間を分けてお試しください',
          },
        },
        413,
      );
    throw error;
  }
});

deletionsRoute.post('/data/undo/:operationId', zValidator('param', operationIdParam), async (c) => {
  const { operationId } = c.req.valid('param');
  const userId = c.get('userId');
  try {
    const result = await executeUndo({
      database: c.env.DB,
      userId,
      operationId,
      undoOperationId: crypto.randomUUID(),
    });
    return c.json({
      operationId: result.undoOperationId,
      restored: result.restored,
      months: result.months,
    });
  } catch (error) {
    if (error instanceof UndoNotFoundError)
      return c.json({ error: { code: 'not_found', message: '操作が見つかりません' } }, 404);
    if (error instanceof UndoAlreadyDoneError)
      return c.json({ error: { code: 'already_undone', message: 'この削除はすでに戻してあります' } }, 409);
    // 期限切れは「無い」ではなく「もう戻せない」。404 と区別して 410 を返す
    if (error instanceof UndoExpiredError)
      return c.json(
        {
          error: {
            code: 'undo_expired',
            message: `取り消せる期間(${DELETION_UNDO_RETENTION_DAYS}日)を過ぎています`,
          },
        },
        410,
      );
    if (error instanceof DeletionBudgetError)
      return c.json(
        {
          error: {
            code: 'undo_too_large',
            message: '一度に戻せる量を超えています。期間を分けて消した単位でお試しください',
          },
        },
        413,
      );
    throw error;
  }
});

deletionsRoute.get('/data/operations', async (c) => {
  // 400日履歴のaudit_logが正本。30日のundo metadataはdeleteの取消可否にだけ参照する。
  // detail/request/fingerprintはjoinせず、この応答経路へ持ち込まない。
  const rows = await c.env.DB.prepare(
    `SELECT a.operation_id AS id, a.action AS kind, a.scope, a.counts_json, a.result,
            a.occurred_at AS created_at, o.undone_by, o.expires_at,
            (o.id IS NOT NULL AND o.expires_at > ? AND o.undone_by IS NULL
              AND (EXISTS (SELECT 1 FROM import_deleted_rows r
                            WHERE r.operation_id=o.id AND r.user_id=a.user_id)
                OR EXISTS (SELECT 1 FROM import_deleted_targets t
                            WHERE t.operation_id=o.id AND t.user_id=a.user_id))) AS undoable
       FROM audit_log a
       LEFT JOIN import_deletion_operations o
         ON a.action='delete' AND o.id=a.operation_id AND o.user_id=a.user_id AND o.kind='delete'
      WHERE a.user_id=? AND a.action IN ('delete','undo')
      ORDER BY a.occurred_at DESC, a.id DESC LIMIT 100`,
  )
    .bind(new Date().toISOString(), c.get('userId'))
    .all<{
      id: string;
      kind: string;
      scope: string;
      counts_json: string;
      result: 'succeeded' | 'failed' | 'rejected';
      undone_by: string | null;
      expires_at: string | null;
      created_at: string;
      undoable: number;
    }>();

  return c.json({
    // scopeの安全な種類だけを復元し、import IDや期間の内容も履歴APIには出さない。
    operations: rows.results.map((row) => ({
      id: row.id,
      kind: row.kind,
      granularity: row.scope.startsWith('period:')
        ? 'period'
        : row.scope.startsWith('import:')
          ? 'import'
          : row.scope,
      counts: JSON.parse(row.counts_json) as Record<string, number>,
      undone: !!row.undone_by,
      undoable: !!row.undoable,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      result: row.result,
    })),
  });
});
