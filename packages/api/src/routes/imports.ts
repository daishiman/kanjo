/**
 * FR-01 取込: POST /api/imports (multipart) / GET /api/imports / POST /api/restore
 * 受領→R2原本保存→形式判定→パース→月単位洗い替え→集計再生成。
 * セキュリティ: ログ・レスポンスに明細内容や金額は含めない(件数・月・理由のみ)。
 */
import { applyFreeeDeals, applyMfTxs, cashBizDeals, importJSON, isCashTxId } from '@kanjo/core';
import { and, count, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { type ParsedUnit, parseUpload, unitFingerprint } from '../import-pipeline.js';
import {
  ensureSubVendors,
  getDb,
  loadCashEntries,
  loadDataset,
  loadNormMap,
  mergeCashTxs,
  replaceEdits,
  replaceFreeeDeals,
  replaceInstitutionOwners,
  replaceMfTxs,
  saveAgg,
} from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const importsRoute = new Hono<Ctx>();

/** 月ごとの洗い替え前後の件数。減っていれば「月の途中までのファイル」の可能性を画面で知らせる */
interface MonthReplace {
  month: string;
  before: number;
  after: number;
}

interface UnitResult {
  filename: string;
  kind: string;
  months: string[];
  rows: number;
  skipped: number;
  syntheticIds?: number;
  duplicateIds?: number;
  /** duplicate = 同じ内容を取込済みのためスキップ(force=1 で取り込み直せる) */
  status: 'ok' | 'error' | 'duplicate';
  reason?: string;
  importId?: number;
  replaced?: MonthReplace[];
}

const fmtWhen = (iso: string | null): string => {
  if (!iso) return '以前';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '以前';
  // 表示はJST(利用者は日本)
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
};

importsRoute.post('/imports', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const form = await c.req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) {
    return c.json({ error: { code: 'no_file', message: 'ファイルが指定されていません' } }, 400);
  }

  // 「同じ内容でも取り込み直す」チェック。既定は重複をスキップする
  const force = form.get('force') === '1';

  const normMap = await loadNormMap(db, userId);
  const data = await loadDataset(db, userId);
  const cashEntries = await loadCashEntries(db, userId);
  // freee 仕訳の月別件数(洗い替え前)。取込値の件数だけを数え、現金明細は含めない
  const freeeCountRows = await db
    .select({ month: s.freeeDeals.month, n: count() })
    .from(s.freeeDeals)
    .where(eq(s.freeeDeals.userId, userId))
    .groupBy(s.freeeDeals.month);
  const freeeCount = new Map(freeeCountRows.map((r) => [r.month, r.n]));
  const mfCount = new Map<string, number>();
  for (const t of data.mfTx) if (!isCashTxId(t.id)) mfCount.set(t.m, (mfCount.get(t.m) ?? 0) + 1);
  const replacedOf = (
    months: string[],
    before: Map<string, number>,
    after: Map<string, number>,
  ): MonthReplace[] =>
    months.map((m) => ({ month: m, before: before.get(m) ?? 0, after: after.get(m) ?? 0 }));

  const results: UnitResult[] = [];
  let mutated = false;

  for (const file of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    // 原本をR2へ保存(公開バケットではなくWorker経由のみ)
    const r2Key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name}`;
    await c.env.FILES.put(r2Key, buf);

    const units: ParsedUnit[] = parseUpload(file.name, buf, normMap);
    for (const u of units) {
      if (u.kind === 'error') {
        const [rec] = await db
          .insert(s.imports)
          .values({
            userId,
            filename: u.filename,
            kind: null,
            months: '',
            rowCount: 0,
            status: `error: ${u.reason}`,
            r2Key,
          })
          .returning({ id: s.imports.id });
        results.push({
          filename: u.filename,
          kind: 'unknown',
          months: [],
          rows: 0,
          skipped: 0,
          status: 'error',
          reason: u.reason,
          importId: rec.id,
        });
        continue;
      }
      // 内容指紋で重複を判定する(ファイル名が変わっていても内容が同じなら重複)
      const contentHash = await unitFingerprint(u);
      const prior = contentHash
        ? await db
            .select({ id: s.imports.id, filename: s.imports.filename, createdAt: s.imports.createdAt })
            .from(s.imports)
            .where(
              and(
                eq(s.imports.userId, userId),
                eq(s.imports.contentHash, contentHash),
                eq(s.imports.status, 'ok'),
              ),
            )
            .orderBy(desc(s.imports.id))
            .limit(1)
        : [];
      const unitMonths = u.kind === 'json' ? [] : u.months;
      const unitRows = u.kind === 'json' ? 0 : u.rows;
      if (prior.length && !force) {
        const [rec] = await db
          .insert(s.imports)
          .values({
            userId,
            filename: u.filename,
            kind: u.kind,
            months: unitMonths.join(','),
            rowCount: unitRows,
            status: 'duplicate',
            r2Key,
            contentHash,
            duplicateOf: prior[0].id,
          })
          .returning({ id: s.imports.id });
        results.push({
          filename: u.filename,
          kind: u.kind,
          months: unitMonths,
          rows: unitRows,
          skipped: 0,
          status: 'duplicate',
          reason: `${fmtWhen(prior[0].createdAt)} に「${prior[0].filename}」として取込済み(内容が同一)`,
          importId: rec.id,
        });
        continue;
      }
      if (u.kind === 'json') {
        importJSON(data, u.json);
        mergeCashTxs(data, cashEntries);
        // 復元明細・ルール等も永続化する(restoreと同じ経路)
        await persistRestore(db, userId, data);
        const months = data.months;
        const [rec] = await db
          .insert(s.imports)
          .values({
            userId,
            filename: u.filename,
            kind: 'json',
            months: months.join(','),
            rowCount: data.mfTx.length,
            status: 'ok',
            r2Key,
            contentHash,
          })
          .returning({ id: s.imports.id });
        results.push({
          filename: u.filename,
          kind: 'json',
          months,
          rows: data.mfTx.length,
          skipped: 0,
          status: 'ok',
          importId: rec.id,
        });
        mutated = true;
        continue;
      }
      const [rec] = await db
        .insert(s.imports)
        .values({
          userId,
          filename: u.filename,
          kind: u.kind,
          months: u.months.join(','),
          rowCount: u.rows,
          status: 'ok',
          r2Key,
          contentHash,
        })
        .returning({ id: s.imports.id });
      if (u.kind === 'freee') {
        // 対象月の事業分の現金明細も一緒に流し込む(洗い替えで消えないように)
        applyFreeeDeals(data, [...u.deals, ...cashBizDeals(cashEntries, normMap, u.months)], u.months);
        await replaceFreeeDeals(db, userId, u.deals, u.months, rec.id);
        const after = new Map<string, number>();
        for (const d of u.deals) after.set(d.month, (after.get(d.month) ?? 0) + 1);
        const replaced = replacedOf(u.months, freeeCount, after);
        after.forEach((n, m) => freeeCount.set(m, n));
        results.push({
          filename: u.filename,
          kind: 'freee',
          months: u.months,
          rows: u.rows,
          skipped: u.skipped,
          status: 'ok',
          importId: rec.id,
          replaced,
        });
      } else {
        applyMfTxs(data, u.txs);
        await replaceMfTxs(db, userId, u.txs, u.months, rec.id);
        const after = new Map<string, number>();
        for (const t of u.txs) after.set(t.m, (after.get(t.m) ?? 0) + 1);
        const replaced = replacedOf(u.months, mfCount, after);
        after.forEach((n, m) => mfCount.set(m, n));
        results.push({
          filename: u.filename,
          kind: 'mf',
          months: u.months,
          rows: u.rows,
          skipped: u.skipped,
          syntheticIds: u.syntheticIds,
          duplicateIds: u.duplicateIds,
          status: 'ok',
          importId: rec.id,
          replaced,
        });
      }
      mutated = true;
    }
  }

  if (mutated) {
    // 未記帳月テーブルをデータセットの現在値に同期(freee取込で解除された月を反映)
    await syncUnrecorded(db, userId, data.unrecordedExpMonths);
    await saveAgg(db, userId, data);
  }
  const ok = results.some((r) => r.status === 'ok');
  // 全件が重複スキップなら「失敗」ではなく「取込済み」として 200 で返す
  const allDuplicate = results.length > 0 && results.every((r) => r.status === 'duplicate');
  return c.json({ results, ok }, ok || allDuplicate ? 200 : 400);
});

importsRoute.get('/imports', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.imports)
    .where(eq(s.imports.userId, userId))
    .orderBy(desc(s.imports.id))
    .limit(100);
  return c.json({
    imports: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      kind: r.kind,
      months: r.months ? r.months.split(',').filter(Boolean) : [],
      rows: r.rowCount,
      status: r.status,
      duplicateOf: r.duplicateOf ?? null,
      createdAt: r.createdAt,
    })),
  });
});

/** HTML版互換JSONによる初期移行(spec §12) */
importsRoute.post('/restore', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: { code: 'bad_json', message: 'JSONを読み取れません' } }, 400);
  }
  if (!body || (!body.months && !body.mfTx && !body.biz)) {
    return c.json({ error: { code: 'bad_format', message: 'HTML版互換JSONではありません' } }, 400);
  }
  const data = await loadDataset(db, userId);
  importJSON(data, body);
  mergeCashTxs(data, await loadCashEntries(db, userId));
  await persistRestore(db, userId, data);
  await syncUnrecorded(db, userId, data.unrecordedExpMonths);
  await saveAgg(db, userId, data);
  await db.insert(s.imports).values({
    userId,
    filename: 'restore.json',
    kind: 'json',
    months: data.months.join(','),
    rowCount: data.mfTx.length,
    status: 'ok',
    r2Key: null,
  });
  return c.json({ ok: true, months: data.months, mfTxCount: data.mfTx.length, rules: data.rules.length });
});

/** restore/JSON取込時にDataset全体をテーブルへ展開する */
async function persistRestore(
  db: ReturnType<typeof getDb>,
  userId: string,
  data: Awaited<ReturnType<typeof loadDataset>>,
): Promise<void> {
  // MF明細: 全月洗い替え(現金の記帳 cash:* は cash_entries が正本なので書かない)
  const txs = data.mfTx.filter((t) => !isCashTxId(t.id));
  const months = [...new Set(txs.map((t) => t.m))];
  await replaceMfTxs(db, userId, txs, months, null);
  // JSON に含まれるサブスクのベンダーを登録に加える(集計キャッシュだけにあると次の再集計で消えるため)
  await ensureSubVendors(db, userId, data.subs.vendors);
  // ルール
  await db.delete(s.rules).where(eq(s.rules.userId, userId));
  for (let i = 0; i < data.rules.length; i++) {
    const r = data.rules[i];
    await db.insert(s.rules).values({
      userId,
      keyword: r.k,
      cls: r.cls ?? null,
      categoryMajor: r.big ?? null,
      categoryMid: r.mid ?? null,
      owner: r.owner ?? null,
      sortOrder: i,
    });
  }
  // 手動編集(公私・科目・名義)と 口座の名義
  await replaceEdits(db, userId, data.edits);
  await replaceInstitutionOwners(db, userId, data.institutionOwners);
  // 予算
  await db.delete(s.budgets).where(eq(s.budgets.userId, userId));
  for (const [account, v] of Object.entries(data.budgets)) {
    await db.insert(s.budgets).values({ userId, account, monthlyAmount: v });
  }
  // 現金補正
  await db.delete(s.cashOverrides).where(eq(s.cashOverrides.userId, userId));
  for (const [month, v] of Object.entries(data.cashOverride)) {
    await db.insert(s.cashOverrides).values({ userId, month, revenue: v.revenue, expense: v.expense });
  }
}

async function syncUnrecorded(db: ReturnType<typeof getDb>, userId: string, months: string[]): Promise<void> {
  // expense種別のみ同期(revenue種別は現状未使用だが消さない)
  await db
    .delete(s.unrecordedMonths)
    .where(and(eq(s.unrecordedMonths.userId, userId), eq(s.unrecordedMonths.kind, 'expense')));
  for (const m of months) {
    await db.insert(s.unrecordedMonths).values({ userId, month: m, kind: 'expense' });
  }
}
