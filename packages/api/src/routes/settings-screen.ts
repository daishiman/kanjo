/**
 * 設定画面 (spec-settings-screen §API契約)。
 *
 * 集計ルール・名義・統計の最低月数・現金上書きの 4 種を 1 画面で保存・復元する。
 * 値の規則・差分・変更履歴の中身は core (settings-screen / settings-json) が決め、ここは
 * D1 の読み書き・revision の照合・R2 への退避だけを担う。route で値を計算し直さない。
 */
import {
  type CashOverrideRule,
  NORM_RULE_ID_PATTERN,
  OWNER_LABEL_KEYS,
  type OwnerKey,
  type OwnerLabels,
  SETTINGS_SYSTEM_ACTOR,
  type SettingsChangeEntry,
  type SettingsChangeLogRow,
  type SettingsInput,
  type SettingsScreenView,
  type SettingsState,
  type StoredCashOverride,
  type StoredNormRule,
  diffSettings,
  exportSettings,
  migratedNormRuleId,
  settingsActorFromEmail,
  settingsActorLabel,
  settingsChangeEntries,
  settingsExportFilename,
  settingsRevision,
  settingsScreen,
  settingsStateOf,
  settingsWriteState,
  sortCashOverrides,
  validateSettingsInput,
  validateSettingsJson,
} from '@kanjo/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { invalidateJsonSnapshotStatement } from '../import-active.js';
import {
  insertJsonRows,
  settingsCashOverrideRow,
  settingsChangeLogStatements,
  settingsChangedAt,
} from '../import-lifecycle.js';
import { cashOverrideRuleFromRow, getDb, normRuleFromRow, recomputeFromDeals } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };
type SettingsContext = Context<Ctx>;

export const settingsScreenRoute = new Hono<Ctx>();

/* -------- エラーの形 (文言は spec の表と同じ) -------- */

const errorBody = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message, ...extra },
});

const SAVE_INVALID = errorBody('invalid_request', '設定を保存できませんでした。入力内容を確認してください。');
const CONFLICT = errorBody('settings_conflict', '他の画面で更新されました');
const INVALID_FILE = errorBody('invalid_settings_file', '設定ファイルの形式が正しくありません。');
const UNSUPPORTED_VERSION = errorBody(
  'unsupported_settings_version',
  'このファイルの版には対応していません。',
);
const PRE_RESTORE_FAILED = errorBody(
  'pre_restore_backup_failed',
  '現在の設定を退避できなかったため、復元を中止しました。',
);

/** 経路ごとの本文上限。超えたら本文を読む前に 413 で止める (文言は経路ごとに違う) */
export const settingsBodyLimit = (maxSize: number, message: string) =>
  bodyLimit({ maxSize, onError: (c) => c.json(errorBody('payload_too_large', message), 413) });

settingsScreenRoute.use('/settings/screen', settingsBodyLimit(64 * 1024, '保存する内容が大きすぎます。'));
settingsScreenRoute.use('/settings/restore', settingsBodyLimit(256 * 1024, 'ファイルが大きすぎます。'));
settingsScreenRoute.use('/settings/restore/*', settingsBodyLimit(256 * 1024, 'ファイルが大きすぎます。'));

/* -------- 読み出し -------- */

export interface SettingsSnapshot {
  view: SettingsScreenView;
  state: SettingsState;
  revision: string | null;
  normRules: StoredNormRule[];
  cashOverrides: StoredCashOverride[];
}

interface NormRuleRow {
  rule_id: string;
  kind: string | null;
  raw: string | null;
  norm: string | null;
  sort_order: number | null;
  enabled: number | null;
  updated_at: string;
  updated_by: string;
}

interface CashOverrideRow {
  override_id: string;
  kind: string | null;
  amount: number | null;
  scope: string | null;
  month: string | null;
  memo: string | null;
  updated_at: string;
  updated_by: string;
}

interface ChangeLogRow {
  seq: number;
  target: SettingsChangeLogRow['target'];
  target_key: string;
  before: string | null;
  after: string | null;
  changed_by: string;
  changed_at: string;
  origin: SettingsChangeLogRow['origin'];
}

const changeLogFromRow = (r: ChangeLogRow): SettingsChangeLogRow => ({
  seq: r.seq,
  target: r.target,
  targetKey: r.target_key,
  before: r.before,
  after: r.after,
  changedBy: r.changed_by,
  changedAt: r.changed_at,
  origin: r.origin,
});

/** 設定 4 種と変更履歴の最新行を D1 の batch 1 回で読む (読む間に保存が挟まらない) */
export async function loadSettingsSnapshot(database: D1Database, userId: string): Promise<SettingsSnapshot> {
  const [rules, overrides, labels, stats, changes] = await database.batch<unknown>([
    database
      .prepare(
        `SELECT rule_id, kind, raw, norm, sort_order, enabled, updated_at, updated_by
           FROM settings_norm_rules WHERE user_id=? ORDER BY sort_order, rule_id`,
      )
      .bind(userId),
    database
      .prepare(
        `SELECT override_id, kind, amount, scope, month, memo, updated_at, updated_by
           FROM settings_cash_overrides WHERE user_id=?`,
      )
      .bind(userId),
    database.prepare('SELECT owner, label FROM owner_labels WHERE user_id=?').bind(userId),
    database.prepare('SELECT stat_min_months FROM analysis_settings WHERE user_id=?').bind(userId),
    database
      .prepare(
        `SELECT l.seq, l.target, l.target_key, l.before, l.after, l.changed_by, l.changed_at, l.origin
           FROM settings_change_log l
           JOIN (SELECT target, target_key, MAX(seq) AS seq FROM settings_change_log
                  WHERE user_id=? GROUP BY target, target_key) m
             ON m.target = l.target AND m.target_key = l.target_key AND m.seq = l.seq
          WHERE l.user_id=?`,
      )
      .bind(userId, userId),
  ]);

  // 並び順は 1 始まりの連番へ詰める (store の loadSettingsRuleRows と同じ)
  const normRules: StoredNormRule[] = (rules.results as NormRuleRow[]).map((r, i) => ({
    ...normRuleFromRow({
      ruleId: r.rule_id,
      kind: r.kind,
      raw: r.raw,
      norm: r.norm,
      sortOrder: r.sort_order,
      enabled: r.enabled,
    }),
    order: i + 1,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
  }));
  const cashOverrides: StoredCashOverride[] = sortCashOverrides(
    (overrides.results as CashOverrideRow[]).map((r) => ({
      ...cashOverrideRuleFromRow({
        overrideId: r.override_id,
        kind: r.kind,
        amount: r.amount,
        scope: r.scope,
        month: r.month,
        memo: r.memo,
      }),
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    })),
  );
  const labelRows = labels.results as Array<{ owner: OwnerKey; label: string }>;
  const statRow = (stats.results as Array<{ stat_min_months: number }>)[0];
  const latestChanges = (changes.results as ChangeLogRow[]).map(changeLogFromRow);

  const view = settingsScreen({
    normRules,
    cashOverrides,
    ownerLabels: labelRows.length ? Object.fromEntries(labelRows.map((r) => [r.owner, r.label])) : null,
    statMinMonths: statRow?.stat_min_months ?? null,
    latestChanges,
  });
  return { view, state: settingsStateOf(view), revision: view.savedAt, normRules, cashOverrides };
}

/* -------- 書き込み -------- */

interface WriteMeta {
  savedAt: string;
  actor: string;
  origin: 'screen' | 'restore';
}

const changedKeys = (entries: readonly SettingsChangeEntry[], target: SettingsChangeEntry['target']) =>
  new Set(entries.filter((e) => e.target === target).map((e) => e.targetKey));

/**
 * 保存・復元の batch。差分のあった節だけを置き換え、変更履歴と JSON snapshot の無効化を同じ batch に並べる。
 * 行ごとの updated_at・updated_by は、変わった行だけ今回の値にし、変わらない行は保存済みの値を保つ。
 */
export function settingsWriteStatements(
  database: D1Database,
  userId: string,
  snapshot: SettingsSnapshot,
  next: SettingsState,
  entries: readonly SettingsChangeEntry[],
  meta: WriteMeta,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  const user = [{ column: 'user_id', value: userId }];

  const normChanged = changedKeys(entries, 'norm_rule');
  if (normChanged.size) {
    const stored = new Map(snapshot.normRules.map((r) => [r.ruleId, r]));
    statements.push(database.prepare('DELETE FROM settings_norm_rules WHERE user_id=?').bind(userId));
    statements.push(
      ...insertJsonRows(
        database,
        'settings_norm_rules',
        ['rule_id', 'kind', 'raw', 'norm', 'sort_order', 'enabled', 'updated_at', 'updated_by'],
        next.normRules.map((r) => {
          const keep = !normChanged.has(r.ruleId) ? stored.get(r.ruleId) : undefined;
          return [
            r.ruleId,
            r.kind,
            r.raw,
            r.norm,
            r.order,
            r.enabled ? 1 : 0,
            keep?.updatedAt ?? meta.savedAt,
            keep?.updatedBy ?? meta.actor,
          ];
        }),
        user,
      ),
    );
  }

  const cashChanged = changedKeys(entries, 'cash_override');
  if (cashChanged.size) {
    const stored = new Map(snapshot.cashOverrides.map((r) => [r.overrideId, r]));
    statements.push(database.prepare('DELETE FROM settings_cash_overrides WHERE user_id=?').bind(userId));
    statements.push(
      ...insertJsonRows(
        database,
        'settings_cash_overrides',
        ['override_id', 'kind', 'amount', 'scope', 'month', 'memo', 'updated_at', 'updated_by'],
        next.cashOverrides.map((r: CashOverrideRule) => {
          const keep = !cashChanged.has(r.overrideId) ? stored.get(r.overrideId) : undefined;
          return [
            ...settingsCashOverrideRow(r),
            keep?.updatedAt ?? meta.savedAt,
            keep?.updatedBy ?? meta.actor,
          ];
        }),
        user,
      ),
    );
  }

  if (changedKeys(entries, 'owner_label').size) {
    statements.push(database.prepare('DELETE FROM owner_labels WHERE user_id=?').bind(userId));
    statements.push(
      ...insertJsonRows(
        database,
        'owner_labels',
        ['owner', 'label', 'updated_at'],
        OWNER_LABEL_KEYS.map((owner) => [owner, next.ownerLabels[owner], meta.savedAt]),
        user,
      ),
    );
  }

  if (changedKeys(entries, 'stat_min_months').size) {
    statements.push(
      database
        .prepare(
          `INSERT INTO analysis_settings (user_id, stat_min_months, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET stat_min_months=excluded.stat_min_months, updated_at=excluded.updated_at`,
        )
        .bind(userId, next.statMinMonths, meta.savedAt),
    );
  }

  statements.push(
    ...settingsChangeLogStatements(
      database,
      userId,
      entries.map((e) => [e.target, e.targetKey, e.before, e.after] as const),
      { changedAt: meta.savedAt, changedBy: meta.actor, origin: meta.origin },
    ),
    invalidateJsonSnapshotStatement(database, userId, 'settings_change_log'),
  );
  return statements;
}

/** 勘定科目ルールの差分は取込済み明細の科目を変えるので、保存後に集計し直す */
function touchesAccountRules(entries: readonly SettingsChangeEntry[]): boolean {
  return entries.some((e) => {
    if (e.target !== 'norm_rule') return false;
    return [e.before, e.after].some((v) => {
      if (v == null) return false;
      try {
        return (JSON.parse(v) as { kind?: unknown }).kind === 'account';
      } catch {
        return false;
      }
    });
  });
}

interface ApplyResult {
  savedAt: string | null;
  changes: number;
  recomputed: boolean;
}

async function applySettings(
  c: SettingsContext,
  snapshot: SettingsSnapshot,
  target: SettingsState,
  meta: { actor: string; origin: 'screen' | 'restore' },
): Promise<ApplyResult> {
  const userId = c.get('userId');
  const next = settingsWriteState(snapshot.state, target);
  const entries = settingsChangeEntries(snapshot.state, next);
  if (entries.length === 0) return { savedAt: snapshot.revision, changes: 0, recomputed: false };

  const savedAt = settingsChangedAt(new Date().toISOString(), snapshot.revision);
  await c.env.DB.batch(
    settingsWriteStatements(c.env.DB, userId, snapshot, next, entries, { savedAt, ...meta }),
  );
  const recomputed = touchesAccountRules(entries);
  if (recomputed) await recomputeFromDeals(getDb(c.env.DB), userId);
  return { savedAt, changes: entries.length, recomputed };
}

/* -------- 旧経路の写し (BR-22) -------- */

/** 旧 PUT /api/settings・PUT /api/settings/owner-labels が送る値。送らなかった節は変えない */
export interface LegacySettingsPatch {
  normMap?: Record<string, string>;
  cashOverrides?: Record<string, { revenue: number; expense: number } | null>;
  statMinMonths?: number;
  ownerLabels?: OwnerLabels;
}

/**
 * 旧経路の値を設定 4 種の形へ写す。写し方は migration 0051・0052 と全データ復元 (BR-29) と同じ。
 * - normMap は勘定科目の行の全件。同じ元の表記の行は id・並び順を保ち、無い行は消し、新しい行は末尾へ
 * - cashOverrides は送った月の月指定の行だけを置き換える (0 と null は写さない。全期間の行は残す)
 */
export function legacySettingsTarget(current: SettingsState, patch: LegacySettingsPatch): SettingsState {
  let normRules = current.normRules;
  if (patch.normMap) {
    const map = patch.normMap;
    const kept = current.normRules.flatMap((r) => {
      if (r.kind !== 'account') return [r];
      return Object.hasOwn(map, r.raw) ? [{ ...r, norm: map[r.raw], enabled: true }] : [];
    });
    const known = new Set(kept.filter((r) => r.kind === 'account').map((r) => r.raw));
    const added = Object.keys(map)
      .filter((raw) => !known.has(raw))
      .sort()
      .map((raw) => ({
        ruleId: migratedNormRuleId(raw),
        kind: 'account' as const,
        raw,
        norm: map[raw],
        enabled: true,
      }));
    normRules = [...kept, ...added].map((r, i) => ({ ...r, order: i + 1 }));
  }

  let cashOverrides = current.cashOverrides;
  if (patch.cashOverrides) {
    const months = patch.cashOverrides;
    const rows: CashOverrideRule[] = cashOverrides.filter(
      (r) => r.scope !== 'month' || !Object.hasOwn(months, r.month ?? ''),
    );
    for (const month of Object.keys(months).sort()) {
      const v = months[month];
      if (v?.expense)
        rows.push({
          overrideId: `m-p-${month}`,
          kind: 'payment',
          amount: v.expense,
          scope: 'month',
          month,
          memo: '',
        });
      if (v?.revenue)
        rows.push({
          overrideId: `m-r-${month}`,
          kind: 'receipt',
          amount: v.revenue,
          scope: 'month',
          month,
          memo: '',
        });
    }
    cashOverrides = rows;
  }

  return {
    normRules,
    ownerLabels: patch.ownerLabels ? { ...patch.ownerLabels } : current.ownerLabels,
    statMinMonths: patch.statMinMonths ?? current.statMinMonths,
    cashOverrides,
  };
}

/**
 * 旧経路の書込みと同じ batch に並べる、新表と変更履歴 (由来 screen) の statement。
 * 変わらなければ空で、revision は進まない。
 */
export async function legacySettingsStatements(
  database: D1Database,
  userId: string,
  patch: LegacySettingsPatch,
  actor: string,
): Promise<{ statements: D1PreparedStatement[]; touchesAccountRules: boolean }> {
  const snapshot = await loadSettingsSnapshot(database, userId);
  const next = settingsWriteState(snapshot.state, legacySettingsTarget(snapshot.state, patch));
  const entries = settingsChangeEntries(snapshot.state, next);
  if (entries.length === 0) return { statements: [], touchesAccountRules: false };
  const savedAt = settingsChangedAt(new Date().toISOString(), snapshot.revision);
  return {
    statements: settingsWriteStatements(database, userId, snapshot, next, entries, {
      savedAt,
      actor,
      origin: 'screen',
    }),
    touchesAccountRules: touchesAccountRules(entries),
  };
}

/** baseSavedAt は GET で受け取った savedAt。保存が 1 度も無ければ null */
const baseSavedAtSchema = z.string().max(40).nullable();

async function readJson(c: SettingsContext): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await c.req.json() };
  } catch {
    return { ok: false };
  }
}

/* -------- GET /api/settings/screen -------- */

settingsScreenRoute.get('/settings/screen', async (c) => {
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  return c.json(snapshot.view);
});

/* -------- PUT /api/settings/screen -------- */

const normRuleShape = z
  .object({
    ruleId: z.unknown(),
    kind: z.unknown(),
    raw: z.unknown(),
    norm: z.unknown(),
    enabled: z.unknown(),
  })
  .strict();
const cashOverrideShape = z
  .object({
    overrideId: z.unknown().optional(),
    kind: z.unknown(),
    amount: z.unknown(),
    scope: z.unknown(),
    month: z.unknown(),
    memo: z.unknown(),
  })
  .strict();
const saveSchema = z
  .object({
    baseSavedAt: baseSavedAtSchema,
    normRules: z.array(normRuleShape).optional(),
    ownerLabels: z.record(z.string(), z.unknown()).optional(),
    statMinMonths: z.unknown().optional(),
    cashOverrides: z.array(cashOverrideShape).optional(),
  })
  .strict();

settingsScreenRoute.put('/settings/screen', async (c) => {
  const raw = await readJson(c);
  const parsed = raw.ok ? saveSchema.safeParse(raw.body) : null;
  if (!parsed?.success) return c.json(SAVE_INVALID, 400);
  const { baseSavedAt, ...input } = parsed.data;

  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  if (baseSavedAt !== snapshot.revision) return c.json(CONFLICT, 409);

  const checked = validateSettingsInput(input as SettingsInput);
  if (!checked.ok)
    return c.json(
      errorBody(SAVE_INVALID.error.code, SAVE_INVALID.error.message, { fields: checked.fields }),
      400,
    );

  const result = await applySettings(
    c,
    snapshot,
    { ...snapshot.state, ...checked.value },
    { actor: settingsActorFromEmail(c.get('actor').email), origin: 'screen' },
  );
  return c.json({ ok: true, ...result });
});

/* -------- GET /api/settings/history -------- */

const historyQuery = z.object({ ruleId: z.string().regex(NORM_RULE_ID_PATTERN) });

settingsScreenRoute.get('/settings/history', async (c) => {
  const query = historyQuery.safeParse(c.req.query());
  if (!query.success) return c.json(errorBody('invalid_request', '入力内容を確認してください'), 400);
  const { ruleId } = query.data;
  const row = await c.env.DB.prepare(
    `SELECT before, changed_by, changed_at FROM settings_change_log
      WHERE user_id=? AND target='norm_rule' AND target_key=? ORDER BY seq DESC LIMIT 1`,
  )
    .bind(c.get('userId'), ruleId)
    .first<{ before: string | null; changed_by: string; changed_at: string }>();
  if (!row) return c.json(errorBody('not_found', '元に戻せる値がありません。'), 404);

  let previous: { kind: string; raw: string; norm: string; enabled: boolean; order: number } | null = null;
  if (row.before != null) {
    const v = JSON.parse(row.before) as {
      kind: string;
      raw: string;
      norm: string;
      enabled: unknown;
      order: number;
    };
    // migration 0053 の行は enabled を 0/1 で持つ。画面へは真偽値で返す
    previous = {
      kind: v.kind,
      raw: v.raw,
      norm: v.norm,
      enabled: v.enabled === true || v.enabled === 1,
      order: v.order,
    };
  }
  return c.json({
    ruleId,
    previous,
    lastChangedAt: row.changed_at,
    lastChangedBy: settingsActorLabel(row.changed_by),
  });
});

/* -------- GET /api/settings/export -------- */

settingsScreenRoute.get('/settings/export', async (c) => {
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  const exportedAt = new Date().toISOString();
  return new Response(JSON.stringify(exportSettings(snapshot.state, exportedAt), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${settingsExportFilename(exportedAt)}"`,
      'Cache-Control': 'no-store',
    },
  });
});

/* -------- 設定ファイルからの復元 -------- */

type ParsedSettings = { ok: true; value: SettingsState } | { ok: false; status: 400; body: unknown };

function parseSettingsFile(input: unknown): ParsedSettings {
  const checked = validateSettingsJson(input);
  if (checked.ok) return checked;
  return {
    ok: false,
    status: 400,
    body: checked.code === 'unsupported_settings_version' ? UNSUPPORTED_VERSION : INVALID_FILE,
  };
}

settingsScreenRoute.post('/settings/restore/preview', async (c) => {
  const raw = await readJson(c);
  if (!raw.ok) return c.json(INVALID_FILE, 400);
  const parsed = parseSettingsFile(raw.body);
  if (!parsed.ok) return c.json(parsed.body, parsed.status);
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  return c.json({
    valid: true,
    diff: diffSettings(snapshot.state, parsed.value),
    revision: snapshot.revision,
  });
});

/** R2 の退避キー。RFC3339 の : と . はキーに使わない */
export const preRestoreKey = (at: string): string => `backups/pre-restore/${at.replace(/[:.]/g, '-')}.json`;

/**
 * 設定だけの復元 (ファイル・夜間バックアップ共通)。
 * 照合 → 検証済みの値 → 現在の設定を R2 へ退避 → batch (origin restore、更新者 system) → 必要なら再集計。
 */
export async function restoreSettings(
  c: SettingsContext,
  baseSavedAt: string | null,
  target: SettingsState,
): Promise<Response> {
  const snapshot = await loadSettingsSnapshot(c.env.DB, c.get('userId'));
  if (baseSavedAt !== snapshot.revision) return c.json(CONFLICT, 409);

  const now = new Date().toISOString();
  const key = preRestoreKey(now);
  try {
    await c.env.FILES.put(key, JSON.stringify(exportSettings(snapshot.state, now)), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch {
    return c.json(PRE_RESTORE_FAILED, 500);
  }

  const result = await applySettings(c, snapshot, target, {
    actor: SETTINGS_SYSTEM_ACTOR,
    origin: 'restore',
  });
  return c.json({ ok: true, ...result, preRestoreKey: key });
}

const restoreSchema = z.object({ baseSavedAt: baseSavedAtSchema, settings: z.unknown() }).strict();

settingsScreenRoute.post('/settings/restore', async (c) => {
  const raw = await readJson(c);
  const body = raw.ok ? restoreSchema.safeParse(raw.body) : null;
  if (!body?.success) return c.json(INVALID_FILE, 400);
  const parsed = parseSettingsFile(body.data.settings);
  if (!parsed.ok) return c.json(parsed.body, parsed.status);
  return restoreSettings(c, body.data.baseSavedAt, parsed.value);
});
