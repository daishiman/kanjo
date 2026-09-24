import { zValidator } from '@hono/zod-validator';
/**
 * 夜間バックアップの一覧・比較・設定だけの復元 (FR-05 / spec-settings-screen §API契約)。
 *
 * バックアップは取っていても、画面から中身を比べて戻せなければ「戻せる」ことにならない。
 * 全データの復元は監査済みの POST /api/restore を通す。ここが戻すのは設定 4 種だけで、
 * 書き込みは設定ファイルの復元と同じ restoreSettings を通す。
 */
import { type SettingsState, diffSettings, settingsJsonFromBackup, validateSettingsJson } from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { loadSettingsSnapshot, restoreSettings, settingsBodyLimit } from './settings-screen.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const backupsRoute = new Hono<Ctx>();

export const BACKUP_PREFIX = 'backups/';
export const PRE_RESTORE_PREFIX = 'backups/pre-restore/';
const BACKUP_KEY = /^backups\/(\d{4}-\d{2}-\d{2})(\.failed)?\.json$/;

/** `backups/YYYY-MM-DD.json` の日付部分だけを許す。R2 のキーを外から組み立てさせない */
const backupDateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const INVALID = { error: { code: 'invalid_request', message: '入力内容を確認してください' } };
const dateParam = zValidator('param', backupDateSchema, (result, c) => {
  if (!result.success) return c.json(INVALID, 400);
});

const NOT_FOUND = {
  error: { code: 'backup_not_found', message: 'そのバックアップは残っていません(保持は30日)' },
};
const UNREADABLE = {
  error: { code: 'backup_settings_unreadable', message: 'このバックアップの設定は読み取れません。' },
};

export interface BackupListItem {
  date: string;
  size: number | null;
  uploaded: string | null;
  status: 'success' | 'failed';
  memo: string;
  summary: unknown;
  formatVersion: string | null;
  latest: boolean;
  reason: string | null;
}

const parseSummary = (raw: string | undefined): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** R2 の一覧を cursor を追って全件取る (1 回の list は 1000 件まで) */
export async function listAllBackups(files: R2Bucket): Promise<R2Object[]> {
  const out: R2Object[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await files.list({ prefix: BACKUP_PREFIX, include: ['customMetadata'], cursor });
    out.push(...page.objects);
    if (!page.truncated) return out;
    cursor = page.cursor;
  }
}

/**
 * 一覧の行。退避 (pre-restore/) は出さない。同じ日付に成功と失敗があれば成功を採る。
 * customMetadata の無い回 (この機能より前の回) は成功・『自動バックアップ』・要約なし。
 */
export function backupListItems(objects: readonly R2Object[]): BackupListItem[] {
  const byDate = new Map<string, BackupListItem>();
  for (const o of objects) {
    if (o.key.startsWith(PRE_RESTORE_PREFIX)) continue;
    const m = BACKUP_KEY.exec(o.key);
    if (!m) continue;
    const [, date, failedSuffix] = m;
    const meta = o.customMetadata ?? {};
    const failed = failedSuffix != null || meta.status === 'failed';
    const item: BackupListItem = {
      date,
      size: failed ? null : o.size,
      uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : null,
      status: failed ? 'failed' : 'success',
      memo: meta.memo ?? '自動バックアップ',
      summary: failed ? null : parseSummary(meta.summary),
      formatVersion: meta.formatVersion ?? null,
      latest: false,
      reason: failed ? (meta.reason ?? 'put_failed') : null,
    };
    const seen = byDate.get(date);
    if (!seen || (seen.status === 'failed' && item.status === 'success')) byDate.set(date, item);
  }
  const items = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = items.find((i) => i.status === 'success');
  if (latest) latest.latest = true;
  return items;
}

backupsRoute.get('/backups', async (c) => {
  return c.json({ backups: backupListItems(await listAllBackups(c.env.FILES)) });
});

backupsRoute.get('/backups/:date', dateParam, async (c) => {
  const { date } = c.req.valid('param');
  const obj = await c.env.FILES.get(`${BACKUP_PREFIX}${date}.json`);
  if (!obj) return c.json(NOT_FOUND, 404);
  return new Response(obj.body, { headers: { 'Content-Type': 'application/json' } });
});

type BackupSettings = { ok: true; value: SettingsState } | { ok: false; status: 404 | 422; body: unknown };

/** バックアップ本文から設定 4 種を読む。古い形 (normMap・月ごとの cashOverride) も core が写す */
async function backupSettings(files: R2Bucket, date: string): Promise<BackupSettings> {
  const obj = await files.get(`${BACKUP_PREFIX}${date}.json`);
  if (!obj) return { ok: false, status: 404, body: NOT_FOUND };
  let body: unknown;
  try {
    body = await obj.json();
  } catch {
    return { ok: false, status: 422, body: UNREADABLE };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return { ok: false, status: 422, body: UNREADABLE };
  const exportedAt = obj.uploaded instanceof Date ? obj.uploaded.toISOString() : `${date}T00:00:00.000Z`;
  const checked = validateSettingsJson(settingsJsonFromBackup(body as Record<string, unknown>, exportedAt));
  return checked.ok ? checked : { ok: false, status: 422, body: UNREADABLE };
}

backupsRoute.get('/backups/:date/compare', dateParam, async (c) => {
  const { date } = c.req.valid('param');
  const settings = await backupSettings(c.env.FILES, date);
  if (!settings.ok) return c.json(settings.body, settings.status);
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  return c.json({ date, diff: diffSettings(snapshot.state, settings.value), revision: snapshot.revision });
});

backupsRoute.use('/backups/:date/restore/*', settingsBodyLimit(1024, 'リクエストが大きすぎます'));
backupsRoute.use('/backups/:date/restore', settingsBodyLimit(1024, 'リクエストが大きすぎます'));

backupsRoute.post('/backups/:date/restore/preview', dateParam, async (c) => {
  const { date } = c.req.valid('param');
  const settings = await backupSettings(c.env.FILES, date);
  if (!settings.ok) return c.json(settings.body, settings.status);
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  return c.json({
    valid: true,
    diff: diffSettings(snapshot.state, settings.value),
    revision: snapshot.revision,
  });
});

const restoreBody = z.object({ baseSavedAt: z.string().max(40).nullable() }).strict();

backupsRoute.post('/backups/:date/restore', dateParam, async (c) => {
  const { date } = c.req.valid('param');
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  const body = restoreBody.safeParse(raw);
  if (!body.success) return c.json(INVALID, 400);
  // R2 の本文は fence の内側でこの 1 回だけ読む (プレビュー後に差し替わっても、書くのは読んだ値)
  const settings = await backupSettings(c.env.FILES, date);
  if (!settings.ok) return c.json(settings.body, settings.status);
  return restoreSettings(c, body.data.baseSavedAt, settings.value);
});
