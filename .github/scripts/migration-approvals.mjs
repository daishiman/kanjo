import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { MIGRATION_NAME } from './wrangler-output.mjs';

/**
 * 行や列を失う D1 migration の承認を、PR の中で済ませるための台帳。
 *
 * 以前は merge 後に承認 manifest を作って Migrate を手動実行していた。
 * その手順は忘れられやすく、止まった Deploy の後ろに merge が積み上がって
 * 本番が何日も古いままになった (0049・0057)。
 * 承認を merge 前の PR へ移し、「merge = 承認」にする。Deploy は台帳の
 * sha256 と本文が一致する migration だけを自動適用する。
 */

export const APPROVALS_PATH = '.github/migration-approvals.json';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** 台帳の形を検査し、filename → 承認 の Map を返す。形が崩れていれば throw する。 */
export function parseApprovals(json) {
  const doc = JSON.parse(json);
  if (
    doc?.schema_version !== 1 ||
    !MIGRATION_NAME.test(doc?.baseline ?? '') ||
    !Array.isArray(doc?.approvals)
  ) {
    throw new Error('migration-approvals-contract-invalid');
  }
  const byName = new Map();
  for (const entry of doc.approvals) {
    if (
      !MIGRATION_NAME.test(entry?.filename ?? '') ||
      !/^[a-f0-9]{64}$/.test(entry?.sha256 ?? '') ||
      !isNonEmptyString(entry?.reason) ||
      !isNonEmptyString(entry?.approved_by) ||
      byName.has(entry.filename)
    ) {
      throw new Error(`migration-approvals-entry-invalid: ${entry?.filename ?? '(no filename)'}`);
    }
    byName.set(entry.filename, entry);
  }
  return { baseline: doc.baseline, byName };
}

export function readApprovals(repositoryRoot) {
  return parseApprovals(readFileSync(resolve(repositoryRoot, APPROVALS_PATH), 'utf8'));
}

/** 本文 sql の migration filename が承認済みか。本文が承認後に変わっていれば未承認。 */
export function isApproved(approvals, filename, sql) {
  return approvals.byName.get(filename)?.sha256 === sha256(sql);
}

/**
 * PR ゲート: baseline より後の migration で、破壊的な SQL を含むのに承認が無い・
 * 承認後に本文が変わったものを列挙する。baseline 以前は本番へ適用済みなので見ない。
 */
export function unapprovedDestructiveMigrations({ migrationsDir, approvals, findings }) {
  const problems = [];
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => MIGRATION_NAME.test(filename))
    .sort();
  for (const filename of filenames) {
    if (filename <= approvals.baseline) continue;
    const sql = readFileSync(resolve(migrationsDir, filename), 'utf8');
    const labels = findings(sql);
    const entry = approvals.byName.get(filename);
    if (entry && entry.sha256 !== sha256(sql)) {
      problems.push(
        `${filename}: 承認後に本文が変わりました。内容を確かめて ${APPROVALS_PATH} の sha256 を更新してください`,
      );
    } else if (labels.length > 0 && !entry) {
      problems.push(`${filename}: ${labels.join(' / ')} — ${APPROVALS_PATH} に承認を追加してください`);
    }
  }
  for (const filename of approvals.byName.keys()) {
    if (!filenames.includes(filename))
      problems.push(`${filename}: 承認がありますが migration が見つかりません`);
  }
  return problems;
}
