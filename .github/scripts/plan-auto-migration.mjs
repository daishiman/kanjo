import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseWranglerMigrationListResult, runWranglerMigrationList } from './wrangler-output.mjs';

/**
 * Deploy が本番D1へ自動適用してよいかを、pending migration の本文から判定する。
 *
 * 自動適用は「取り返しがつく変更」に限る。列や行を失う変更は Time Travel が
 * あっても復旧に人の判断が要るので、判定できない場合を含めて fail-closed で止め、
 * 手動の Migrate workflow へ倒す。
 */

export const BLOCKED_REMEDIATION =
  '自動適用できないD1 migrationがあります。承認manifestを用意してMigrate workflowをAPPLYで手動実行し、その後Deployを再実行してください。';

/**
 * パターン照合の前に、コメントとリテラルを空白へ潰す。
 * `-- DROP TABLE ...` のような注釈や、値の中の単語で誤検知しないため。
 * 空白で置換するのは、隣接トークンが連結して別の語に化けるのを防ぐため。
 */
export function stripSqlNoise(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, " '' ")
    .replace(/"(?:[^"]|"")*"/g, ' "" ')
    .replace(/`(?:[^`]|``)*`/g, ' `` ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 自動適用を止めるSQL。基準は「Time Travelで戻せるか」ではなく
 * 「戻すかどうかの判断に人が要るか」。緩めるのは後からできるが、失った行は戻らない。
 *
 * 索引・view・triggerのDROPは意図的に含めない。データを失わず、次のmigrationで
 * 作り直せるため、止めても人が確認することが無い。
 *
 * pattern は大文字化・1行化済みの本文へ照合するので `g` フラグは付けない
 * （lastIndex が持ち越され、2回目の照合が false になる）。
 */
export const DESTRUCTIVE_PATTERNS = [
  { label: 'テーブルを削除します（行がすべて失われます）', pattern: /\bDROP\s+TABLE\b/ },
  { label: '列を削除します（その列の値が失われます）', pattern: /\bDROP\s+COLUMN\b/ },
  { label: '行を削除します', pattern: /\bDELETE\s+FROM\b/ },
  { label: 'テーブルを空にします', pattern: /\bTRUNCATE\b/ },
  { label: '既存の行を書き換えます（条件を誤ると全行に及びます）', pattern: /\bUPDATE\s+\S+\s+SET\b/ },
  {
    label: 'テーブルまたは列の名前を変えます（旧名を読むコードが即座に落ちます）',
    pattern: /\bALTER\s+TABLE\b[^;]*\bRENAME\b/,
  },
];

/** 1つのmigration本文から、自動適用を止める理由のlabelを列挙する。 */
export function destructiveFindings(sql) {
  const normalized = stripSqlNoise(sql).toUpperCase();
  return DESTRUCTIVE_PATTERNS.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label);
}

/**
 * remote の pending を取得し、`skip` / `apply` / `blocked` のいずれかへ落とす。
 * remote を読めない・解釈できない場合は `apply` にせず `blocked` にする。
 */
export function planAutoMigration({
  migrationsDir,
  runRemoteList = runWranglerMigrationList,
  findings = destructiveFindings,
}) {
  const parsed = parseWranglerMigrationListResult(runRemoteList());
  if (parsed.state === 'no-pending') return { decision: 'skip', filenames: [], blockers: [] };
  if (parsed.state !== 'pending' || parsed.filenames.length === 0) {
    return { decision: 'blocked', filenames: [], blockers: ['本番D1のpendingを判定できませんでした'] };
  }

  const blockers = [];
  for (const filename of parsed.filenames) {
    let sql;
    try {
      sql = readFileSync(resolve(migrationsDir, filename), 'utf8');
    } catch {
      blockers.push(`${filename}: 本文を読み取れません`);
      continue;
    }
    for (const label of findings(sql)) blockers.push(`${filename}: ${label}`);
  }

  return blockers.length > 0
    ? { decision: 'blocked', filenames: parsed.filenames, blockers }
    : { decision: 'apply', filenames: parsed.filenames, blockers: [] };
}

function isMainModule() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const plan = planAutoMigration({ migrationsDir: resolve(repositoryRoot, 'migrations') });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `decision=${plan.decision}\n`);
  }

  if (plan.decision === 'blocked') {
    for (const blocker of plan.blockers) console.error(`::error::${blocker}`);
    console.error(`::error::${BLOCKED_REMEDIATION}`);
    process.exitCode = 1;
  } else if (plan.decision === 'skip') {
    console.log('✅ 適用待ちのD1 migrationはありません。');
  } else {
    console.log(`▶ 自動適用します: ${plan.filenames.join(', ')}`);
  }
}
