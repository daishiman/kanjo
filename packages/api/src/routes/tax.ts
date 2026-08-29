/**
 * 確定申告(FR-05 拡張)。
 *
 * 3つだけを提供する:
 *   1. 科目の申告時の扱い(決算書への割り当て・家事按分)の読み書き
 *   2. 申告できる状態かの判定と、決算書への転記シート
 *   3. 証憑のまとめ書き出し(索引つき ZIP)と、未添付の洗い出し
 *
 * 集計は packages/core の純関数に委譲し、ここは D1/R2 との受け渡しだけを持つ。
 * Dataset の読み込みは analytics.ts の loadScoped を必ず経由する
 * (直接 loadDataset を呼ぶと、このルートだけ期間の絞り込みが効かなくなる)。
 */
import { zValidator } from '@hono/zod-validator';
import {
  HOUSEHOLD_RATIO_BASIS_MAX,
  RECEIPT_INDEX_HEADER,
  type ReceiptFile,
  type ReceiptInventory,
  type ReceiptSourceOverride,
  type ReceiptSourceProfile,
  type ReceiptSourceResolution,
  TAX_ACCOUNTS,
  TAX_FORM_PRINTED_ACCOUNTS,
  TAX_FORM_SEPARATE_ACCOUNTS,
  TAX_STATEMENT_EXPORT_HEADER,
  type TaxAccountSetting,
  type TaxYear,
  type ZipEntryMeta,
  applyPeriod,
  attachmentTargetColumns,
  buildReceiptSourceProfile,
  classificationProgress,
  crc32,
  isAllowedTaxExpenseAccount,
  isMfCountable,
  normalizeReceiptSourceKeyPart,
  parseAttachmentTarget,
  parseTaxYear,
  receiptGapReportFromInventory,
  receiptIndexRows,
  receiptInventory,
  receiptInventoryTargets,
  receiptReadme,
  receiptZipPath,
  resolveReceiptSourceProfile,
  resolveTaxAccountSettings,
  resolveTx,
  sanitizeZipName,
  taxReadinessVerdict,
  taxReturnReadiness,
  taxReturnStatement,
  taxStatementExportRows,
  toCsv,
  zipCentralDirectory,
  zipLocalHeader,
} from '@kanjo/core';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { AttachmentAvailabilityError } from '../attachment-availability.js';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import { getDb, loadCashEntries } from '../store.js';
import { loadScoped } from './analytics.js';
import {
  type AvailableAttachmentRow,
  attachmentCountsFromRows,
  loadAvailableAttachmentRows,
} from './attachments.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const taxRoute = new Hono<Ctx>();

const PRIVATE_NO_STORE = 'private, no-store';

taxRoute.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', PRIVATE_NO_STORE);
});

/** HEAD+GETと他のD1/R2操作をWorkers internal subrequest 1,000回以内へ収める1分割の上限。 */
export const RECEIPT_ZIP_MAX_FILES = 400;

export type TaxYearQuery = Partial<Record<'year' | 'from' | 'to' | 'span', string>>;

/** 申告計算は暦年だけを受け、汎用期間のfail-open契約を持ち込まない。 */
export function taxYearFromQuery(
  query: TaxYearQuery,
): { ok: true; year: TaxYear } | { ok: false; code: 'tax_year_required'; message: string } {
  const year = parseTaxYear(query.year);
  if (!year || query.from !== undefined || query.to !== undefined || query.span !== undefined) {
    return {
      ok: false,
      code: 'tax_year_required',
      message: '確定申告の対象年を4桁の西暦で1年だけ指定してください',
    };
  }
  return { ok: true, year };
}

/** Workers/R2上限に余白を残し、全件を安定した複数ZIPへ分割する。 */
export function receiptArchivePart<T>(
  rows: readonly T[],
  part: number,
): { rows: T[]; part: number; totalParts: number } {
  const totalParts = Math.max(1, Math.ceil(rows.length / RECEIPT_ZIP_MAX_FILES));
  if (!Number.isSafeInteger(part) || part < 1 || part > totalParts)
    throw new Error('invalid_receipt_archive_part');
  const from = (part - 1) * RECEIPT_ZIP_MAX_FILES;
  return { rows: rows.slice(from, from + RECEIPT_ZIP_MAX_FILES), part, totalParts };
}

async function loadTaxSettings(
  db: ReturnType<typeof getDb>,
  userId: string,
  year: TaxYear,
): Promise<TaxAccountSetting[]> {
  const rows = await db
    .select()
    .from(s.taxAccountSettings)
    .where(and(eq(s.taxAccountSettings.userId, userId), eq(s.taxAccountSettings.taxYear, Number(year))));
  return rows.map((r) => ({
    taxYear: String(r.taxYear) as TaxYear,
    account: r.account,
    taxAccount: r.taxAccount,
    businessPercent: r.businessPercent,
    basis: r.basis,
    updatedAt: r.updatedAt,
  }));
}

function taxYearRequest(c: Parameters<typeof loadScoped>[0]): TaxYear | Response {
  const parsed = taxYearFromQuery({
    year: c.req.query('year'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    span: c.req.query('span'),
  });
  return parsed.ok ? parsed.year : c.json({ error: { code: parsed.code, message: parsed.message } }, 400);
}

async function loadTaxYearScoped(c: Parameters<typeof loadScoped>[0], year: TaxYear) {
  const scoped = await loadScoped(c);
  const expected = { from: `${year}-01`, to: `${year}-12` };
  // 汎用期間は「データが無い年」を全期間へfallbackする。申告ではfallbackさせず、空の暦年として扱う。
  return {
    data: applyPeriod(scoped.data, expected),
    period: { ...scoped.period, applied: expected, label: `${year}年 1月〜12月` },
  };
}

async function buildTaxYearBundle(c: Parameters<typeof loadScoped>[0], year: TaxYear) {
  const { data, period } = await loadTaxYearScoped(c, year);
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [settings, cashEntries] = await Promise.all([
    loadTaxSettings(db, userId, year),
    loadCashEntries(db, userId),
  ]);
  const inventory = receiptInventory(data, { year, cashEntries });
  const attachmentRows = await loadAvailableAttachmentRows(
    db,
    c.env.FILES,
    userId,
    receiptInventoryTargets(inventory),
  );
  const attachmentCounts = attachmentCountsFromRows(attachmentRows);
  const receipts = receiptGapReportFromInventory(inventory, { attachmentCounts });
  const resolvedSettings = resolveTaxAccountSettings(year, data.biz.categories, settings);
  const statement = taxReturnStatement(data, year, settings);
  const resolved = data.mfTx
    .filter(isMfCountable)
    .map((tx) => resolveTx(tx, data.rules, data.edits, data.institutionOwners));
  const progress = classificationProgress(resolved);
  const bizAdvanceTotal = Object.values(data.bizPersonal).reduce(
    (sum, month) => sum + (month.expense ?? 0),
    0,
  );
  const checks = taxReturnReadiness({
    year,
    statement,
    unconfirmedPolicies: resolvedSettings
      .filter((setting) => setting.status === 'unconfirmed')
      .map((setting) => setting.account),
    reviewPending: progress.reviewPending,
    txTotal: progress.total,
    receipts: receipts.summary,
    ratioUnsetAccounts: resolvedSettings
      .filter((setting) => setting.status === 'unconfirmed' && setting.taxAccount)
      .map((setting) => setting.taxAccount as string),
    bizAdvanceTotal,
    coveredMonths: statement.months,
  });
  const verdict = taxReadinessVerdict(checks);
  const receiptFileCount = attachmentRows.length;
  return {
    data,
    period,
    year,
    settings,
    resolvedSettings,
    statement,
    inventory,
    attachmentRows,
    attachmentCounts,
    receipts,
    checks,
    verdict,
    receiptArchive: {
      fileCount: receiptFileCount,
      maxFilesPerPart: RECEIPT_ZIP_MAX_FILES,
      parts: Math.max(1, Math.ceil(receiptFileCount / RECEIPT_ZIP_MAX_FILES)),
    },
  };
}

const receiptTargetIdFromRow = (row: { targetKind: 'cash' | 'mf'; targetKey: string }): string =>
  row.targetKind === 'cash' ? `cash:${row.targetKey}` : row.targetKey;

/** 永続profile/overrideをpure domainの解決入力へ変換する。 */
async function loadReceiptSourceResolutions(
  db: ReturnType<typeof getDb>,
  userId: string,
  inventory: ReceiptInventory,
): Promise<Map<string, ReceiptSourceResolution>> {
  const [storedProfiles, storedOverrides] = await Promise.all([
    db.select().from(s.receiptSourceProfiles).where(eq(s.receiptSourceProfiles.userId, userId)),
    db.select().from(s.receiptSourceOverrides).where(eq(s.receiptSourceOverrides.userId, userId)),
  ]);
  const profiles: ReceiptSourceProfile[] = storedProfiles.map((row) => ({
    profileKey: row.profileKey,
    merchantKey: row.merchantKey,
    serviceName: row.serviceName,
    sourceUrl: row.sourceUrl,
    loginAccount: row.loginAccount ?? '',
    memo: row.memo ?? '',
  }));
  const overrides: ReceiptSourceOverride[] = [];
  for (const row of storedOverrides) {
    const transactionId = receiptTargetIdFromRow(row);
    if (row.profileKey) {
      overrides.push({ transactionId, profileKey: row.profileKey });
      continue;
    }
    if (row.serviceName && row.sourceUrl) {
      const inlineProfile: ReceiptSourceProfile = {
        profileKey: `override::${transactionId}`,
        // 明細だけの値は他の同merchant明細へ継承候補として漏らさない。
        merchantKey: `override::${transactionId}`,
        serviceName: row.serviceName,
        sourceUrl: row.sourceUrl,
        loginAccount: row.loginAccount ?? '',
        memo: row.memo ?? '',
      };
      profiles.push(inlineProfile);
      overrides.push({ transactionId, profileKey: inlineProfile.profileKey });
    } else {
      overrides.push({ transactionId, profileKey: '__invalid_override__' });
    }
  }

  return new Map(
    inventory.items.map((item) => [
      item.attachmentTargetId,
      resolveReceiptSourceProfile(
        {
          transactionId: item.attachmentTargetId,
          month: item.month,
          merchant: item.description,
        },
        profiles,
        overrides,
      ),
    ]),
  );
}

/**
 * 画面1枚ぶん。申告準備の判定・転記シート・科目設定をまとめて返す。
 * 分けて4回叩かせると、どれか1つだけ古い状態で画面に出る。
 */
taxRoute.get('/tax/overview', async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const bundle = await buildTaxYearBundle(c, requestedYear);

  return c.json({
    period: bundle.period,
    year: bundle.year,
    statement: bundle.statement,
    checks: bundle.checks,
    verdict: bundle.verdict,
    receipts: bundle.receipts.summary,
    receiptArchive: bundle.receiptArchive,
    externalReceiptSources: bundle.inventory.externalSources,
    settings: bundle.resolvedSettings,
    /** 支出の転記先だけを用途別に分け、収入・事業主貸を選択肢へ混ぜない。 */
    taxAccountOptions: {
      printed: [...TAX_FORM_PRINTED_ACCOUNTS],
      additional: TAX_ACCOUNTS.map((account) => account.name).filter(
        (name) =>
          isAllowedTaxExpenseAccount(name) &&
          !TAX_FORM_PRINTED_ACCOUNTS.includes(name) &&
          !TAX_FORM_SEPARATE_ACCOUNTS.includes(name),
      ),
      separate: [...TAX_FORM_SEPARATE_ACCOUNTS],
    },
  });
});

const settingsSchema = z.object({
  settings: z
    .array(
      z.object({
        account: z.string().min(1).max(60),
        taxAccount: z.string().min(1).max(60),
        businessPercent: z.number().int().min(0).max(100),
        basis: z.string().max(HOUSEHOLD_RATIO_BASIS_MAX).nullable(),
      }),
    )
    .max(300),
});

/**
 * 科目の扱いをまとめて保存する。
 * 1科目ずつ保存すると、画面の途中で失敗したとき「一部だけ按分が効いた申告額」が出る。
 */
taxRoute.put('/tax/accounts', zValidator('json', settingsSchema), async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { settings } = c.req.valid('json');
  const accounts = new Set<string>();

  for (const row of settings) {
    if (accounts.has(row.account))
      return c.json(
        { error: { code: 'invalid_input', message: `${row.account}: 同じ科目が重複しています` } },
        400,
      );
    accounts.add(row.account);
    if (!isAllowedTaxExpenseAccount(row.taxAccount))
      return c.json(
        {
          error: {
            code: 'invalid_input',
            message: `経費の転記先として使えない科目です: ${row.taxAccount}`,
          },
        },
        400,
      );
    // 按分したのに根拠が無い状態を保存させない。根拠は税務調査で最初に聞かれる
    if (row.businessPercent < 100 && !row.basis?.trim())
      return c.json(
        {
          error: {
            code: 'invalid_input',
            message: `${row.account}: 家事按分には根拠の記入が必要です(例: 作業部屋6畳 / 全体30畳)`,
          },
        },
        400,
      );
  }

  const now = new Date().toISOString();
  const remove = db
    .delete(s.taxAccountSettings)
    .where(
      and(eq(s.taxAccountSettings.userId, userId), eq(s.taxAccountSettings.taxYear, Number(requestedYear))),
    );
  const invalidate = invalidateJsonSnapshotQuery(db, userId, 'tax_account_settings');
  if (settings.length === 0) {
    await db.batch([remove, invalidate]);
    return c.json({ ok: true, year: requestedYear, saved: 0 });
  }

  const payload = JSON.stringify(
    settings.map((row) => [
      row.account,
      row.taxAccount,
      row.businessPercent,
      row.businessPercent < 100 ? row.basis?.trim() : null,
    ]),
  );
  const insert = db.insert(s.taxAccountSettings).select(sql`
    SELECT
      ${userId},
      ${Number(requestedYear)},
      CAST(json_extract(value, '$[0]') AS TEXT),
      CAST(json_extract(value, '$[1]') AS TEXT),
      CAST(json_extract(value, '$[2]') AS INTEGER),
      CASE WHEN json_extract(value, '$[3]') IS NULL
        THEN NULL ELSE CAST(json_extract(value, '$[3]') AS TEXT) END,
      ${now}
    FROM json_each(${payload})
  `);
  await db.batch([remove, insert, invalidate]);
  return c.json({ ok: true, year: requestedYear, saved: settings.length });
});

const receiptSourceFieldsSchema = z
  .object({
    serviceName: z.string().trim().min(1).max(120),
    sourceUrl: z.string().trim().min(1).max(2_000),
    loginAccount: z.string().trim().max(254),
    memo: z.string().trim().max(500),
  })
  .strict();

const receiptSourceMutationSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('merchant-profile'),
      targetId: z.string().min(1).max(205),
      fields: receiptSourceFieldsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal('transaction-override'),
      targetId: z.string().min(1).max(205),
      fields: receiptSourceFieldsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal('select-profile'),
      targetId: z.string().min(1).max(205),
      profileKey: z.string().min(3).max(400),
    })
    .strict(),
  z.object({ mode: z.literal('inherit'), targetId: z.string().min(1).max(205) }).strict(),
]);

async function taxReceiptSourceTarget(c: Parameters<typeof loadScoped>[0], year: TaxYear, targetId: string) {
  const { data } = await loadTaxYearScoped(c, year);
  const cashEntries = await loadCashEntries(getDb(c.env.DB), c.get('userId'));
  return receiptInventory(data, { year, cashEntries }).items.find(
    (item) => item.attachmentTargetId === targetId,
  );
}

/** 証憑取得先を同merchantへ継承、明細だけ上書き、または曖昧候補から明示選択する。 */
taxRoute.put('/tax/receipt-sources', zValidator('json', receiptSourceMutationSchema), async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const input = c.req.valid('json');
  const item = await taxReceiptSourceTarget(c, requestedYear, input.targetId);
  if (!item)
    return c.json(
      { error: { code: 'receipt_source_target_not_found', message: '対象年の事業支出が見つかりません' } },
      404,
    );
  const target = parseAttachmentTarget(item.attachmentTargetId);
  if (!target) throw new Error('invalid_receipt_inventory_target');
  const { targetKind, targetKey } = attachmentTargetColumns(target);
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const merchantKey = normalizeReceiptSourceKeyPart(item.description);
  if (!merchantKey)
    return c.json(
      { error: { code: 'invalid_receipt_source_merchant', message: '取得先を継承する取引先名がありません' } },
      400,
    );
  const overrideTarget = [
    s.receiptSourceOverrides.userId,
    s.receiptSourceOverrides.targetKind,
    s.receiptSourceOverrides.targetKey,
  ];

  if (input.mode === 'inherit') {
    const remove = db
      .delete(s.receiptSourceOverrides)
      .where(
        and(
          eq(s.receiptSourceOverrides.userId, userId),
          eq(s.receiptSourceOverrides.targetKind, targetKind),
          eq(s.receiptSourceOverrides.targetKey, targetKey),
        ),
      );
    await db.batch([remove, invalidateJsonSnapshotQuery(db, userId, 'receipt_source_overrides')]);
    return c.json({ ok: true, year: requestedYear, targetId: item.attachmentTargetId, mode: input.mode });
  }

  if (input.mode === 'select-profile') {
    const [selected] = await db
      .select({ profileKey: s.receiptSourceProfiles.profileKey })
      .from(s.receiptSourceProfiles)
      .where(
        and(
          eq(s.receiptSourceProfiles.userId, userId),
          eq(s.receiptSourceProfiles.profileKey, input.profileKey),
        ),
      );
    if (!selected)
      return c.json(
        { error: { code: 'receipt_source_profile_not_found', message: '取得先の候補が見つかりません' } },
        404,
      );
    const upsert = db
      .insert(s.receiptSourceOverrides)
      .values({ userId, targetKind, targetKey, merchantKey, profileKey: selected.profileKey })
      .onConflictDoUpdate({
        target: overrideTarget,
        set: {
          merchantKey,
          profileKey: selected.profileKey,
          serviceName: null,
          sourceUrl: null,
          loginAccount: null,
          memo: null,
          updatedAt: new Date().toISOString(),
        },
      });
    await db.batch([upsert, invalidateJsonSnapshotQuery(db, userId, 'receipt_source_overrides')]);
    return c.json({ ok: true, year: requestedYear, targetId: item.attachmentTargetId, mode: input.mode });
  }

  const built = buildReceiptSourceProfile(item.description, input.fields);
  if (!built.ok)
    return c.json(
      {
        error: {
          code: 'invalid_receipt_source',
          message: '取得先URLは認証情報を含まないhttp://またはhttps://で入力してください',
        },
        issues: built.issues,
      },
      400,
    );
  const now = new Date().toISOString();

  if (input.mode === 'transaction-override') {
    const upsert = db
      .insert(s.receiptSourceOverrides)
      .values({
        userId,
        targetKind,
        targetKey,
        merchantKey,
        profileKey: null,
        serviceName: built.profile.serviceName,
        sourceUrl: built.profile.sourceUrl,
        loginAccount: built.profile.loginAccount || null,
        memo: built.profile.memo || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: overrideTarget,
        set: {
          merchantKey,
          profileKey: null,
          serviceName: built.profile.serviceName,
          sourceUrl: built.profile.sourceUrl,
          loginAccount: built.profile.loginAccount || null,
          memo: built.profile.memo || null,
          updatedAt: now,
        },
      });
    await db.batch([upsert, invalidateJsonSnapshotQuery(db, userId, 'receipt_source_overrides')]);
    return c.json({ ok: true, year: requestedYear, targetId: item.attachmentTargetId, mode: input.mode });
  }

  const existingProfiles = await db
    .select({ profileKey: s.receiptSourceProfiles.profileKey })
    .from(s.receiptSourceProfiles)
    .where(
      and(
        eq(s.receiptSourceProfiles.userId, userId),
        eq(s.receiptSourceProfiles.merchantKey, built.profile.merchantKey),
      ),
    );
  const futureProfileKeys = new Set(existingProfiles.map((row) => row.profileKey));
  futureProfileKeys.add(built.profile.profileKey);
  const upsertProfile = db
    .insert(s.receiptSourceProfiles)
    .values({
      userId,
      ...built.profile,
      loginAccount: built.profile.loginAccount || null,
      memo: built.profile.memo || null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [s.receiptSourceProfiles.userId, s.receiptSourceProfiles.profileKey],
      set: {
        merchantKey: built.profile.merchantKey,
        serviceName: built.profile.serviceName,
        sourceUrl: built.profile.sourceUrl,
        loginAccount: built.profile.loginAccount || null,
        memo: built.profile.memo || null,
        updatedAt: now,
      },
    });
  const currentSelection =
    futureProfileKeys.size === 1
      ? db
          .delete(s.receiptSourceOverrides)
          .where(
            and(
              eq(s.receiptSourceOverrides.userId, userId),
              eq(s.receiptSourceOverrides.targetKind, targetKind),
              eq(s.receiptSourceOverrides.targetKey, targetKey),
            ),
          )
      : db
          .insert(s.receiptSourceOverrides)
          .values({
            userId,
            targetKind,
            targetKey,
            merchantKey,
            profileKey: built.profile.profileKey,
          })
          .onConflictDoUpdate({
            target: overrideTarget,
            set: {
              merchantKey,
              profileKey: built.profile.profileKey,
              serviceName: null,
              sourceUrl: null,
              loginAccount: null,
              memo: null,
              updatedAt: now,
            },
          });
  await db.batch([
    upsertProfile,
    currentSelection,
    invalidateJsonSnapshotQuery(db, userId, 'receipt_source_profiles', 'receipt_source_overrides'),
  ]);
  return c.json({
    ok: true,
    year: requestedYear,
    targetId: item.attachmentTargetId,
    mode: input.mode,
    profile: built.profile,
  });
});

/** 証憑が付いていない事業経費。金額と緊急度で並んだまま返す */
taxRoute.get('/tax/receipt-gaps', async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const bundle = await buildTaxYearBundle(c, requestedYear);
  const report = receiptGapReportFromInventory(bundle.inventory, {
    attachmentCounts: bundle.attachmentCounts,
    minAmount: Number(c.req.query('min') ?? 0) || 0,
  });
  const sourceResolutions = await loadReceiptSourceResolutions(
    getDb(c.env.DB),
    c.get('userId'),
    bundle.inventory,
  );
  return c.json({
    period: bundle.period,
    year: bundle.year,
    ...report,
    rows: report.rows.map((row) => ({
      ...row,
      receiptSource: sourceResolutions.get(row.txId) ?? {
        state: 'unmatched',
        profile: null,
        candidates: [],
        inheritedFrom: null,
        overrideState: 'none',
      },
    })),
    checks: bundle.checks,
    verdict: bundle.verdict,
    receiptArchive: bundle.receiptArchive,
    externalReceiptSources: bundle.inventory.externalSources,
  });
});

/* -------- 書き出し -------- */

const csvResponse = (rows: (string | number)[][], filename: string): Response =>
  // Excel互換のためBOM付きUTF-8
  new Response(`﻿${toCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': PRIVATE_NO_STORE,
      'X-Content-Type-Options': 'nosniff',
    },
  });

type TaxYearBundle = Awaited<ReturnType<typeof buildTaxYearBundle>>;

/** 申告準備が未完了なら、完成物として誤用できる書き出しを返さない。 */
function blockedTaxExport(c: Parameters<typeof loadScoped>[0], bundle: TaxYearBundle): Response | null {
  if (bundle.verdict !== 'blocked') return null;
  return c.json(
    {
      error: {
        code: 'tax_export_blocked',
        message: '未確認・要対応の項目を解消してから確定申告の準備データを書き出してください',
      },
      year: bundle.year,
      checks: bundle.checks.filter((check) => check.level === 'blocked'),
    },
    409,
  );
}

/**
 * 決算書への転記シート。上から順に決算書の欄へ書き写せば終わる並びで出す。
 * 按分の根拠も同じ行に置く(別ファイルにすると数年後に率の理由が再現できない)。
 */
taxRoute.get('/export/tax/statement.csv', async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const bundle = await buildTaxYearBundle(c, requestedYear);
  const blocked = blockedTaxExport(c, bundle);
  if (blocked) return blocked;
  const rows: (string | number)[][] = [
    [`${bundle.year}年 確定申告の準備・決算書転記シート`],
    [`対象期間: ${bundle.period.label}`],
    ['freee / e-Taxへの転記補助です。申告書の生成や適法性を保証するものではありません。'],
    [],
    [...TAX_STATEMENT_EXPORT_HEADER],
    ...taxStatementExportRows(bundle.statement),
  ];
  return csvResponse(rows, `確定申告準備_転記シート_${bundle.year}.csv`);
});

/**
 * 決算書科目つきの経費明細。転記シートの1行がどの支出から来たのかを追える粒度で出す。
 * 税理士へ渡す・自分で検算する、のどちらもこれが無いとできない。
 */
taxRoute.get('/export/tax/expenses.csv', async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const bundle = await buildTaxYearBundle(c, requestedYear);
  const blocked = blockedTaxExport(c, bundle);
  if (blocked) return blocked;
  const { statement } = bundle;

  const rows: (string | number)[][] = [
    [`${bundle.year}年 確定申告の準備・科目別経費内訳`],
    ['帳簿科目単位の内訳です。個別取引明細ではありません。'],
    [],
    ['決算書の科目', '区分', '帳簿科目', '按分前', '事業割合(%)', '申告額', '家事分', '按分の根拠'],
  ];
  const push = (label: string, list: typeof statement.printedRows) => {
    for (const r of list)
      for (const src of r.sources)
        rows.push([
          r.taxAccount,
          label,
          src.account,
          src.gross,
          src.businessPercent ?? 100,
          src.amount,
          src.gross - src.amount,
          src.basis ?? '',
        ]);
  };
  push('印字欄', statement.printedRows);
  push('空欄に記入', statement.blankRows);
  push('専用欄', statement.separateRows);
  for (const u of statement.unassigned)
    rows.push(['(未割当)', '要対応', u.account, u.gross, '', 0, '', '決算書の科目を割り当ててください']);

  return csvResponse(rows, `確定申告準備_科目別経費内訳_${bundle.year}.csv`);
});

/**
 * 証憑のまとめ書き出し。索引CSVと説明を同梱した ZIP を返す。
 *
 * R2 から1件ずつ読んでは流し、読み終えたら捨てる。
 * 全件をメモリに載せる作りだと、証憑が数十MBある時点で Worker が落ちる。
 */
taxRoute.get('/export/tax/receipts.zip', async (c) => {
  const requestedYear = taxYearRequest(c);
  if (requestedYear instanceof Response) return requestedYear;
  const bundle = await buildTaxYearBundle(c, requestedYear);
  const blocked = blockedTaxExport(c, bundle);
  if (blocked) return blocked;
  if (bundle.receipts.summary.missingCount > 0)
    return c.json(
      {
        error: {
          code: 'receipt_archive_incomplete',
          message: '対象年の事業支出すべてに証憑原本が揃ってからZIPを書き出してください',
        },
        year: bundle.year,
        receipts: bundle.receipts.summary,
      },
      409,
    );

  const itemByTarget = new Map(bundle.inventory.items.map((item) => [item.attachmentTargetId, item]));
  const seqByTarget = new Map<string, number>();
  const allFiles: { row: AvailableAttachmentRow; meta: ReceiptFile }[] = [];
  const sortedRows = [...bundle.attachmentRows].sort((left, right) => {
    const leftTarget = left.targetKind === 'cash' ? `cash:${left.targetKey}` : left.targetKey;
    const rightTarget = right.targetKind === 'cash' ? `cash:${right.targetKey}` : right.targetKey;
    const leftDate = itemByTarget.get(leftTarget)?.date ?? '';
    const rightDate = itemByTarget.get(rightTarget)?.date ?? '';
    return (
      leftDate.localeCompare(rightDate) ||
      leftTarget.localeCompare(rightTarget) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id - right.id
    );
  });
  for (const row of sortedRows) {
    const targetId = row.targetKind === 'cash' ? `cash:${row.targetKey}` : row.targetKey;
    const item = itemByTarget.get(targetId);
    if (!item) throw new Error('receipt_inventory_attachment_mismatch');
    const seq = (seqByTarget.get(targetId) ?? 0) + 1;
    seqByTarget.set(targetId, seq);
    allFiles.push({
      row,
      meta: {
        txId: targetId,
        date: item.date,
        amount: item.amount,
        partner: item.description,
        account: item.account,
        paymentMethod: item.paymentMethod,
        seq,
        ext: row.filename.split('.').pop()?.toLowerCase() || 'bin',
        createdAt: row.createdAt,
      },
    });
  }

  const requestedPart = c.req.query('part');
  if (bundle.receiptArchive.parts > 1 && requestedPart === undefined)
    return c.json(
      {
        error: {
          code: 'receipt_archive_part_required',
          message: `証憑は${bundle.receiptArchive.parts}個のZIPに分けて書き出します。partを指定してください`,
        },
        year: bundle.year,
        receiptArchive: bundle.receiptArchive,
      },
      409,
    );
  const partNumber = requestedPart === undefined ? 1 : Number(requestedPart);
  let part: ReturnType<typeof receiptArchivePart<(typeof allFiles)[number]>>;
  try {
    part = receiptArchivePart(allFiles, partNumber);
  } catch {
    return c.json(
      { error: { code: 'invalid_receipt_archive_part', message: '存在するZIPの番号を指定してください' } },
      400,
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const metas: ZipEntryMeta[] = [];
    let offset = 0;
    const put = async (name: string, bytes: Uint8Array, date?: Date) => {
      const meta: ZipEntryMeta = { name, crc: crc32(bytes), size: bytes.length, offset, date };
      const header = zipLocalHeader(meta);
      await writer.write(header);
      await writer.write(bytes);
      offset += header.length + bytes.length;
      metas.push(meta);
    };

    // 索引と実ファイルを同じ集合にするため、原本を1件でも取得できなければZIP全体を中断する。
    for (const f of part.rows) {
      let object: R2ObjectBody | null;
      try {
        object = await c.env.FILES.get(f.row.r2Key);
      } catch {
        throw new AttachmentAvailabilityError('get_failed');
      }
      if (!object) throw new AttachmentAvailabilityError('get_failed');
      const bytes = new Uint8Array(await object.arrayBuffer());
      const path = receiptZipPath(f.meta).split('/').map(sanitizeZipName).join('/');
      await put(path, bytes, new Date(f.row.createdAt));
    }

    const encoder = new TextEncoder();
    const selectedMetas = part.rows.map((file) => file.meta);
    const indexCsv = encoder.encode(
      `﻿${toCsv([[...RECEIPT_INDEX_HEADER], ...receiptIndexRows(selectedMetas)])}`,
    );
    const readme = encoder.encode(
      receiptReadme(
        `${bundle.period.label}（${part.part}/${part.totalParts}）`,
        selectedMetas.length,
        new Date().toISOString().slice(0, 19).replace('T', ' '),
      ),
    );
    await put('索引.csv', indexCsv);
    await put('README.md', readme);

    await writer.write(zipCentralDirectory(metas));
    await writer.close();
  })().catch(() => {
    // 途中で失敗したら壊れた ZIP を渡さない。切断させて再実行させる
    void writer.abort();
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        `確定申告準備_証憑_${bundle.year}_${part.part}of${part.totalParts}.zip`,
      )}`,
      'Cache-Control': PRIVATE_NO_STORE,
      'X-Content-Type-Options': 'nosniff',
      'X-Receipt-Archive-Part': String(part.part),
      'X-Receipt-Archive-Parts': String(part.totalParts),
    },
  });
});
