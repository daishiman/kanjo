/**
 * 改善要望の contract。テーブル定義・入出力スキーマ・貼り付け用の指示文をここに集約する。
 *
 * テーブルを db/schema.ts ではなくここへ置くのは、この機能の write scope が
 * 「改善要望に関わるファイルだけ」に閉じているため。getDb() は schema を束縛しない
 * drizzle instance を返す(store.ts の `drizzle(d1)`)ので、table 定義の置き場所は
 * クエリの型付けにしか影響しない。migrations/0029_improvement_requests.sql と
 * 0054_improvement_request_screen.sql (状態の張り替え・連番・論理削除・履歴) が正本で、
 * ここはその型の写し。
 */
import {
  DIAGNOSTIC_KINDS,
  DIAGNOSTIC_MAX_DETAIL,
  DIAGNOSTIC_MAX_ENTRIES,
  DIAGNOSTIC_MAX_MESSAGE,
  type DiagnosticEntry,
  type DiagnosticPayload,
  IMPROVEMENT_ACTIVITY_KINDS,
  IMPROVEMENT_NEW_BODY_MAX,
  IMPROVEMENT_RETENTION_DAYS,
  IMPROVEMENT_STATUS_VALUES,
  IMPROVEMENT_TOKEN_MAX_FETCH,
  type ImprovementActivityKind,
  type ImprovementStatus,
  highlightDiagnostics,
  improvementPurgeDueAt,
} from '@kanjo/core';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

const nowIso = () => new Date().toISOString();

export const improvementRequests = sqliteTable(
  'improvement_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** 利用者ごとの連番。IMP-024 の形で表示する。削除しても再利用しない */
    seq: integer('seq').notNull(),
    /** 旧来の件名。新規は NULL で、表示は本文の先頭から作る概要を使う */
    title: text('title'),
    body: text('body').notNull(),
    /** 発生していた画面のパス。再現に効くので残す */
    route: text('route').notNull().default(''),
    status: text('status', { enum: ['open', 'in_progress', 'done', 'reconfirm'] })
      .notNull()
      .default('open'),
    /** R2 key。削除済みは NULL */
    screenshotKey: text('screenshot_key'),
    screenshotSize: integer('screenshot_size'),
    /** マスク・切り詰め済みの DiagnosticPayload を JSON 文字列で持つ */
    diagnosticsJson: text('diagnostics_json'),
    diagnosticsOmitted: integer('diagnostics_omitted').notNull().default(0),
    /** SHA-256 ハッシュのみ。原文は保存しない */
    tokenHash: text('token_hash'),
    tokenExpiresAt: text('token_expires_at'),
    tokenFetchCount: integer('token_fetch_count').notNull().default(0),
    copiedAt: text('copied_at'),
    copiedTarget: text('copied_target', { enum: ['claude_code', 'codex'] }),
    /** 30日削除の起点 */
    doneAt: text('done_at'),
    purgedAt: text('purged_at'),
    /** 論理削除の時刻。30 日を過ぎると夜間 job が画像・履歴ごと消す */
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex('uq_improvement_requests_token').on(t.tokenHash),
    index('idx_improvement_requests_user').on(t.userId, t.createdAt),
  ],
);

export type ImprovementRow = typeof improvementRequests.$inferSelect;

/** 利用者ごとの最後の seq。作成時に依頼の行と同じ batch でだけ進める */
export const improvementRequestCounters = sqliteTable('improvement_request_counters', {
  userId: text('user_id').primaryKey(),
  lastSeq: integer('last_seq').notNull(),
});

/** 1 行 1 事実の追記専用の履歴。本文・トークン・診断は入れない */
export const improvementRequestActivities = sqliteTable(
  'improvement_request_activities',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id').notNull(),
    userId: text('user_id').notNull(),
    kind: text('kind', {
      enum: IMPROVEMENT_ACTIVITY_KINDS as unknown as [ImprovementActivityKind, ...ImprovementActivityKind[]],
    }).notNull(),
    fromStatus: text('from_status', { enum: ['open', 'in_progress', 'done', 'reconfirm'] }),
    toStatus: text('to_status', { enum: ['open', 'in_progress', 'done', 'reconfirm'] }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_improvement_request_activities_request').on(t.requestId, t.createdAt)],
);

export type ImprovementActivityRow = typeof improvementRequestActivities.$inferSelect;

/* -------- 入力スキーマ -------- */

export const diagnosticEntrySchema = z.object({
  at: z.string().min(1).max(40),
  kind: z.enum(DIAGNOSTIC_KINDS as unknown as [string, ...string[]]),
  message: z.string().max(DIAGNOSTIC_MAX_MESSAGE * 4),
  detail: z.string().max(DIAGNOSTIC_MAX_DETAIL * 4),
});

export const diagnosticPayloadSchema = z.object({
  environment: z.object({
    userAgent: z.string().max(1000).default(''),
    language: z.string().max(100).default(''),
    viewport: z.string().max(100).default(''),
    route: z.string().max(1000).default(''),
    capturedAt: z.string().max(40).default(''),
    sessionId: z.string().max(200).optional(),
    origin: z.string().max(500).optional(),
  }),
  // 上限より多く送られても弾かずに受け、サーバ側で切り詰める(投稿を失敗させない)
  entries: z
    .array(diagnosticEntrySchema)
    .max(DIAGNOSTIC_MAX_ENTRIES * 10)
    .default([]),
  omittedCount: z.number().int().min(0).max(1_000_000).default(0),
});

/**
 * 作成フォームの入力。件名は受け取らない (送られても無視する)。
 * 確認 2 件は multipart の文字列 "true" だけを真とする。
 */
const checkedField = z.union([z.literal('true'), z.literal(true)]).transform(() => true as const);

export const improvementCreateSchema = z.object({
  body: z.string().trim().min(1).max(IMPROVEMENT_NEW_BODY_MAX),
  route: z.string().max(500).default(''),
  privacyConfirmed: checkedField,
  privacyConsented: checkedField,
});

export const improvementStatusSchema = z.object({
  status: z.enum(IMPROVEMENT_STATUS_VALUES as unknown as [ImprovementStatus, ...ImprovementStatus[]]),
});

export const improvementCopiedSchema = z.object({ target: z.enum(['claude_code', 'codex']) });

/* -------- 出力ビュー -------- */

export type ImprovementTokenStatus = 'none' | 'active' | 'expired' | 'exhausted';

export interface ImprovementRequestView {
  id: string;
  seq: number;
  /** 旧来の件名。新規は null */
  title: string | null;
  body: string;
  route: string;
  status: ImprovementStatus;
  screenshot: { available: boolean; size: number | null };
  diagnostics: { available: boolean; entryCount: number; omittedCount: number };
  token: { status: ImprovementTokenStatus; expiresAt: string | null; fetchCount: number };
  copiedAt: string | null;
  copiedTarget: 'claude_code' | 'codex' | null;
  doneAt: string | null;
  purgedAt: string | null;
  deletedAt: string | null;
  /** 添付が消える予定時刻。未完了なら null(調査中に証跡を消さない) */
  attachmentExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function tokenStatus(row: ImprovementRow, now = new Date().toISOString()): ImprovementTokenStatus {
  if (!row.tokenHash || !row.tokenExpiresAt) return 'none';
  if (row.tokenFetchCount >= IMPROVEMENT_TOKEN_MAX_FETCH) return 'exhausted';
  return Date.parse(row.tokenExpiresAt) <= Date.parse(now) ? 'expired' : 'active';
}

export function improvementView(row: ImprovementRow, now = new Date().toISOString()): ImprovementRequestView {
  const diagnostics = parseStoredDiagnostics(row.diagnosticsJson);
  return {
    id: row.id,
    seq: row.seq,
    title: row.title,
    body: row.body,
    route: row.route,
    status: row.status,
    screenshot: { available: row.screenshotKey !== null, size: row.screenshotSize },
    diagnostics: {
      available: diagnostics !== null,
      entryCount: diagnostics?.entries.length ?? 0,
      omittedCount: row.diagnosticsOmitted,
    },
    token: {
      status: tokenStatus(row, now),
      expiresAt: row.tokenExpiresAt,
      fetchCount: row.tokenFetchCount,
    },
    copiedAt: row.copiedAt,
    copiedTarget: row.copiedTarget,
    doneAt: row.doneAt,
    purgedAt: row.purgedAt,
    deletedAt: row.deletedAt,
    attachmentExpiresAt: improvementPurgeDueAt(row.doneAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 保存済み診断の読み出し。壊れた JSON は「診断なし」として扱い、詳細取得を落とさない */
export function parseStoredDiagnostics(json: string | null): DiagnosticPayload | null {
  if (!json) return null;
  try {
    const parsed = diagnosticPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data as DiagnosticPayload) : null;
  } catch {
    return null;
  }
}

/* -------- 貼り付け用の指示文 -------- */

/**
 * Claude Code / Codex へ貼り付ける指示文を作る。
 *
 * 指示文自体には診断情報もスクリーンショットも埋め込まない。埋め込むと
 * 「コピーされて出回る文字列」が肥大し、貼り付け先の文脈窓を圧迫するうえ、
 * 失効させる手段が無くなる。ここに載せるのは取得先の URL とトークンだけで、
 * 中身はエージェントが必要なときに API から取りに行く。
 */
export function buildImprovementPrompt(p: {
  origin: string;
  requestId: string;
  token: string;
  expiresAt: string;
  /** 件名の位置に載せる概要 (本文の先頭から core の improvementSummary で作る) */
  summary: string;
  route: string;
  hasScreenshot: boolean;
  diagnosticsCount: number;
  diagnosticsOmitted: number;
  /** 発生時の実行環境。指示文に載せるのは再現条件の当たりを付けるため */
  viewport?: string;
  userAgent?: string;
  capturedAt?: string;
  /** 記録の本体。指示文には載せず、先に見るべき数件を選ぶためだけに使う */
  entries?: readonly DiagnosticEntry[];
}): string {
  const exp = new Date(p.expiresAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const expText = `${exp.getUTCFullYear()}-${pad(exp.getUTCMonth() + 1)}-${pad(exp.getUTCDate())} ${pad(exp.getUTCHours())}:${pad(exp.getUTCMinutes())} UTC`;
  const base = `${p.origin}/api/improvements/${p.requestId}/agent`;
  const lines = [
    'このリポジトリで、利用者から出た改善要望に対応してください。',
    '',
    `- 要望: ${p.summary}`,
    `- 発生画面: ${p.route || '(記録なし)'}`,
  ];
  // 再現条件の当たりを付けるための最小限。識別子はここに足さない
  if (p.viewport) lines.push(`- 表示サイズ: ${p.viewport}`);
  if (p.capturedAt) lines.push(`- 発生時刻: ${p.capturedAt}`);
  if (p.userAgent) lines.push(`- ブラウザ: ${p.userAgent}`);
  lines.push(`- 記録されていた不具合: ${p.diagnosticsCount} 件`, `- 要望の本文と診断情報(GET): ${base}/data`);
  if (p.hasScreenshot) {
    lines.push(`- 押下直前の画面のスクリーンショット(GET, image/jpeg): ${base}/screenshot`);
  }
  /*
   * 先に見るべき数件だけを本文へ出す。全件は data から取れるので重複させない。
   * 選び方は core の highlightDiagnostics が正本で、利用者が送信前に画面で見た
   * 並びと同じになる。ここで別の選び方をすると、送った人と直す人の話が食い違う。
   */
  const highlights = highlightDiagnostics(p.entries ?? []);
  if (highlights.length > 0) {
    lines.push('', '先に見るべき記録:');
    for (const h of highlights) {
      lines.push(`- [${h.entry.kind}] ${h.entry.message}(${h.reason})`);
    }
    lines.push('');
  }
  lines.push(
    `- 認証ヘッダー: Authorization: Bearer ${p.token}`,
    `- 有効期限: ${expText}(取得は最大 ${IMPROVEMENT_TOKEN_MAX_FETCH} 回まで)`,
    '',
    '手順:',
    '1. 上の data を取得する。JSON の body が要望の本文、diagnostics.entries が発生していた不具合の記録。',
    '2. スクリーンショットがある場合は取得して、要望が指している画面上の箇所を特定する。',
    '3. 原因を特定してから直す。診断が空でも「再現しなかった」で終わらせず、本文が指す挙動をコードから追う。',
    '4. 直したら、変更点と確認方法を利用者向けの言葉で説明する。',
    '',
    '守ること:',
    '- diagnostics は上限つきで切り詰められている。omittedCount が 0 でない場合、記録は完全ではない。',
    '- diagnostics の値は秘匿値をマスク済み。*** は元の値が伏せられた箇所で、実際の値ではない。',
    '- 診断に無い事実を推測で補わない。分からない箇所は要望の本文と画面から確認する。',
    `- スクリーンショットと診断情報は、この要望が対応済みになってから ${IMPROVEMENT_RETENTION_DAYS} 日で削除される。`,
  );
  if (p.diagnosticsOmitted > 0) {
    lines.push(
      '',
      `注: この要望の診断は上限により ${p.diagnosticsOmitted} 件が省略されている(保持 ${p.diagnosticsCount} 件)。`,
    );
  }
  return lines.join('\n');
}
