/**
 * データ取込画面の変更要求に掛ける 2 つの門 (security 章 / spec の共通規則)。
 *
 *   importOriginGuard   … /api/imports* の POST・DELETE で Origin が自サイトと違えば 403
 *   consumeImportRateLimit … 利用者 × 経路の種別 × 1 分の時間枠で回数を数え、超えたら 429
 *
 * レート制限はログイン用 (password_login_rate_limits) と表を分ける。取込は認証済みの
 * 利用者に掛けるので鍵は user_id で、IP は使わない。
 *
 *   purgeExpiredImportRows  … 検査を作る要求のついでに、期限切れの検査と古い時間枠を 500 件ずつ消す
 *   runImportStagingCleanup … 夜間保守で、R2 の仮置きを 500 件ずつ消す (D1 は使わない)
 */
import { IMPORT_LIMITS } from '@kanjo/core';
import type { Context, MiddlewareHandler } from 'hono';

export type ImportRateLimitKind = 'inspection' | 'commit';

/** 1 分あたりの上限。検査はファイルの追加も数える (qa-imp-decision-008)。 */
export const IMPORT_RATE_LIMITS: Readonly<Record<ImportRateLimitKind, number>> = Object.freeze({
  inspection: IMPORT_LIMITS.inspectionsPerMinute,
  commit: IMPORT_LIMITS.commitsPerMinute,
});

export const IMPORT_RATE_WINDOW_MS = 60_000;

/** 夜間保守で消す古い時間枠の目安。直近の枠だけ残れば判定には足りる。 */
export const IMPORT_RATE_STALE_MS = 24 * 60 * 60 * 1000;

export interface ImportRateLimitDecision {
  allowed: boolean;
  count: number;
  /** 超過時に Retry-After へ入れる秒数 (1 以上) */
  retryAfterSeconds: number;
}

export const importRateWindowStart = (now: number): number =>
  Math.floor(now / IMPORT_RATE_WINDOW_MS) * IMPORT_RATE_WINDOW_MS;

/**
 * 1 本の UPSERT で数えて、数えた後の値で判定する。読んでから書く 2 本にしないのは、
 * 同じ枠へ同時に来た要求が両方とも「まだ余裕がある」と読んでしまうのを避けるため。
 */
export async function consumeImportRateLimit(
  database: D1Database,
  userId: string,
  kind: ImportRateLimitKind,
  now: number,
): Promise<ImportRateLimitDecision> {
  const windowStart = importRateWindowStart(now);
  const row = await database
    .prepare(
      `INSERT INTO import_rate_limits (user_id, kind, window_start, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, kind, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(userId, kind, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + IMPORT_RATE_WINDOW_MS - now) / 1000));
  return { allowed: count <= IMPORT_RATE_LIMITS[kind], count, retryAfterSeconds };
}

/** 429 の応答。待ち時間は画面が文言にする。 */
export function importRateLimitedResponse(c: Context, decision: ImportRateLimitDecision): Response {
  c.header('Retry-After', String(decision.retryAfterSeconds));
  return c.json(
    {
      error: {
        code: 'rate_limited',
        message: `短時間に操作が集中しました。${decision.retryAfterSeconds}秒ほど待ってからやり直してください`,
      },
    },
    429,
  );
}

/**
 * Origin が自サイトと一致するか。Origin ヘッダーが無い要求 (同一オリジンの一部の送信や
 * テストの直接呼び出し) は通す。Cookie は SameSite=Strict で別サイトからの要求には
 * 付かないため、この門は Cookie 属性が将来緩んだときの二重の塞ぎとして置く。
 */
export function isSameSiteOrigin(origin: string | undefined, host: string | undefined, url: string): boolean {
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const selfHost = host || new URL(url).host;
  return originHost === selfHost;
}

export const importOriginGuard = (): MiddlewareHandler => async (c, next) => {
  const method = c.req.method;
  if (method === 'POST' || method === 'DELETE') {
    if (!isSameSiteOrigin(c.req.header('Origin'), c.req.header('Host'), c.req.url))
      return c.json(
        { error: { code: 'forbidden_origin', message: 'この画面の外からの操作は受け付けません' } },
        403,
      );
  }
  await next();
};

/** 仮置きの R2 key の接頭辞。夜間保守は 1 回 cleanupBatch 件まで消し、残りは翌日に回す (qa-imp-decision-010)。 */
export const IMPORT_STAGING_PREFIX = 'import-staging/';

/** 確定の途中 (committing) の検査は、期限からこれだけ過ぎるまで消さない。 */
const COMMITTING_GRACE_MS = 60 * 60 * 1000;

export interface ImportStagingCleanupSummary {
  staged: number;
}

export interface ImportExpiredRowsSummary {
  inspections: number;
  rateWindows: number;
}

/**
 * 期限切れの行の片づけ (D1 は 2 本)。夜間保守ではなく、検査を新しく作る要求のついでに実行する。
 *
 * 夜間保守は 1 invocation 50 query の枠を 8 job で使い切っており、後から来たこの機能が
 * 枠を取ると既存 job の枠を削ることになる。掃除が要る量は検査を作った回数に比例するので、
 * 作った本人の要求へ相乗りさせれば量に見合った頻度で片づく。
 * 検査の行を消すとファイルの行は外部キー (ON DELETE CASCADE) で一緒に消える。
 */
export async function purgeExpiredImportRows(
  database: D1Database,
  now: number = Date.now(),
): Promise<ImportExpiredRowsSummary> {
  const batch = IMPORT_LIMITS.cleanupBatch;
  const expiredBefore = new Date(now).toISOString();
  const committingBefore = new Date(now - COMMITTING_GRACE_MS).toISOString();
  const inspections = await database
    .prepare(
      `DELETE FROM import_inspections WHERE id IN (
       SELECT id FROM import_inspections
        WHERE expires_at < ? AND (status = 'open' OR expires_at < ?)
        ORDER BY expires_at LIMIT ?)
     RETURNING id`,
    )
    .bind(expiredBefore, committingBefore, batch)
    .all<{ id: string }>();
  const rateWindows = await database
    .prepare(
      `DELETE FROM import_rate_limits WHERE rowid IN (
       SELECT rowid FROM import_rate_limits WHERE window_start < ? LIMIT ?)`,
    )
    .bind(now - IMPORT_RATE_STALE_MS, batch)
    .run();

  return {
    // meta.changes は外部キーで一緒に消えたファイルの行も数えるので、消した検査の行は RETURNING で数える
    inspections: inspections.results.length,
    rateWindows: rateWindows.meta.changes ?? 0,
  };
}

/**
 * 夜間保守の 1 job。D1 を 1 本も使わないので夜間の query 予算の表には載せない。
 *
 * R2 の仮置きは D1 の行ではなく置いた時刻で選ぶ。検査の期限は最初の検査から 24 時間で、
 * 追加したファイルもその期限より前に置かれるため、置いてから 24 時間を過ぎた仮置きは
 * 必ず期限切れの検査のものである。行を消した後に R2 の削除が失敗しても、
 * 確定の途中で落ちて行だけ消えても、翌日以降に同じ規則で拾える。
 */
export async function runImportStagingCleanup(
  env: { FILES: R2Bucket },
  now: number = Date.now(),
): Promise<ImportStagingCleanupSummary> {
  const batch = IMPORT_LIMITS.cleanupBatch;
  const listed = await env.FILES.list({ prefix: IMPORT_STAGING_PREFIX, limit: batch * 2 });
  const staleBefore = now - IMPORT_LIMITS.stagingTtlMs;
  const staleKeys = listed.objects
    .filter((object) => object.uploaded.getTime() < staleBefore)
    .slice(0, batch)
    .map((object) => object.key);
  if (staleKeys.length) await env.FILES.delete(staleKeys);

  return { staged: staleKeys.length };
}
