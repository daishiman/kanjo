/**
 * 取込前の差分プレビュー(T09)。
 *
 *   POST /api/imports/diff            … 何が増え・変わり・消えるかを見せる(書かない)
 *   POST /api/imports/diff (apply=1)  … 旧入力も書かず400で拒否する
 *
 * 既定を「書かない」にしてあるのは、プレビューが副作用を持つと、
 * 利用者が「見ただけ」のつもりで状態を動かせてしまうからである。
 * base_* と stable_key、解決選択は同じ計画を使う通常POSTの確定batchだけが書く。
 *
 * 応答に明細の内容・金額を入れない(DR-9)。衝突行が返すのは tx_id と
 * 種別・科目・名義の3つ組だけで、どの明細かは画面が手元の一覧で解決する。
 */
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import { QueryBudgetExceededError, assertQueryBudget } from '../d1-limits.js';
import * as s from '../db/schema.js';
import {
  computeImportDiff,
  importResolutionFingerprint,
  loadDiffBaseline,
  planImportDiffQueries,
} from '../import-diff.js';
import { preflightWriteSetConflicts } from '../import-lifecycle.js';
import { parseUpload, unitFingerprint } from '../import-pipeline.js';
import { effectiveRules, getDb, loadNormMap, loadOrderedRuleRows, loadVendorMemories } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const importDiffRoute = new Hono<Ctx>();

/** 正本の読み(明細・手当て)と設定読み。previewはleaseも書かない。 */
const BASELINE_READS = 2;
const SETTINGS_READS = 4;

importDiffRoute.post('/imports/diff', async (c) => {
  const userId = c.get('userId');
  const form = await c.req.formData();
  const files = form.getAll('file').filter((entry): entry is File => entry instanceof File);
  if (!files.length)
    return c.json({ error: { code: 'no_file', message: 'ファイルが指定されていません' } }, 400);
  if (files.some((file) => file.size > 25 * 1024 * 1024))
    return c.json({ error: { code: 'file_too_large', message: '1ファイルは25MB以下にしてください' } }, 413);

  if (form.get('apply') === '1') {
    return c.json(
      {
        error: {
          code: 'diff_read_only',
          message: '差分確認は読み取り専用です。基準値と選択内容は取込の確定時に保存されます',
        },
      },
      400,
    );
  }
  const db = getDb(c.env.DB);
  const normMap = await loadNormMap(db, userId);
  const units = (
    await Promise.all(
      files.map(async (file) => parseUpload(file.name, new Uint8Array(await file.arrayBuffer()), normMap)),
    )
  ).flat();

  // 差分は明細の手当てを見るためのもので、手当てが付くのは MF 明細だけである。
  // 資産推移や JSON 復元は「置き換え」であって行ごとの3点比較にならない
  const mfUnits = units.filter((candidate) => candidate.kind === 'mf');
  if (!mfUnits.length) {
    const reason = units.find((candidate) => candidate.kind === 'error');
    return c.json(
      {
        error: {
          code: 'diff_unsupported',
          message:
            reason?.kind === 'error'
              ? reason.reason
              : 'このファイルは差分の確認に対応していません(MFの入出金明細のみ)',
        },
      },
      400,
    );
  }
  const writeConflicts = preflightWriteSetConflicts(units);
  if (writeConflicts.length)
    return c.json(
      {
        error: {
          code: 'import_write_conflict',
          message: `同じ取込先を書き換えるファイルが重複しています: ${writeConflicts.join(', ')}`,
        },
      },
      400,
    );

  const months = [...new Set(mfUnits.flatMap((unit) => unit.months))].sort();
  const [{ existing, edits }, ruleRows, vendorMemories, ownerRows] = await Promise.all([
    loadDiffBaseline(c.env.DB, userId, months),
    loadOrderedRuleRows(db, userId),
    loadVendorMemories(db, userId),
    db.select().from(s.institutionOwners).where(eq(s.institutionOwners.userId, userId)),
  ]);
  const diff = computeImportDiff({
    incoming: mfUnits.flatMap((unit) => unit.txs),
    existing,
    edits,
    months,
    rules: effectiveRules(ruleRows),
    vendorMemories,
    institutionOwners: Object.fromEntries(ownerRows.map((row) => [row.institution, row.owner])),
  });
  const unitFingerprints = await Promise.all(mfUnits.map((unit) => unitFingerprint(unit)));
  if (unitFingerprints.some((value) => value === null)) throw new Error('MF fingerprintを生成できません');
  const fingerprint = await importResolutionFingerprint(unitFingerprints as string[], diff);

  const plan = planImportDiffQueries({ monthChunks: 1 });

  try {
    // 応答前に、実測が見積りを超えていないことを確かめる。
    assertQueryBudget(plan, SETTINGS_READS + BASELINE_READS);
  } catch (error) {
    if (error instanceof QueryBudgetExceededError)
      return c.json(
        {
          error: {
            code: 'diff_too_large',
            message: '一度に確認できる量を超えています。月を分けてお試しください',
          },
        },
        413,
      );
    throw error;
  }

  return c.json({
    months: diff.months,
    counts: diff.counts,
    conflicts: diff.conflicts,
    fingerprint,
    // previewは読み取り専用。base_*は確定POSTでだけ書く。
    backfilled: 0,
    automation: {
      autoApplied: diff.autoApply.length,
      candidates: diff.vendorCandidates.length,
      learned: 0,
    },
    candidates: diff.vendorCandidates,
    queries: { planned: plan.total, limit: plan.limit },
  });
});
