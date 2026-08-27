import { spawnSync } from 'node:child_process';

/** wrangler の migration list 出力だけを fail-closed に解析する adapter。 */

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
const SEMVER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?`;
const WRANGLER_BANNER = new RegExp(`^⛅️?\\s+wrangler ${SEMVER}(?: \\(update available ${SEMVER}\\))?$`);
const BANNER_SEPARATOR = /^(?:─{3,}|-{3,})$/;
const RESOURCE_LOCATION = /^Resource location:\s+remote$/;
const TABLE_TOP = /^┌─+┐$/;
const TABLE_DIVIDER = /^├─+┤$/;
const TABLE_BOTTOM = /^└─+┘$/;
const TABLE_CELL = /^│\s*(.*?)\s*│$/;
const KNOWN_WARNING_HEADING = /^(?:▲\s*)?\[WARNING\]\s+Processing wrangler\.jsonc configuration:$/;
const KNOWN_WARNING_DETAIL = /^-\s*"secrets" fields are experimental\.$/;

export const NO_PENDING_MARKER = '✅ No migrations to apply!';
export const PENDING_MARKER = 'Migrations to be applied:';
export const MIGRATION_NAME = /^\d{4}_[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;

export function normalizeOutput(value) {
  return value.replace(ANSI_ESCAPE, '').replaceAll('\r\n', '\n').trim();
}

const nonEmptyLines = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function hasKnownPreamble(lines) {
  return (
    lines.length === 0 ||
    (lines.length === 3 &&
      WRANGLER_BANNER.test(lines[0]) &&
      BANNER_SEPARATOR.test(lines[1]) &&
      RESOURCE_LOCATION.test(lines[2]))
  );
}

function parsePendingTable(lines) {
  if (
    lines.length < 4 ||
    !TABLE_TOP.test(lines[0]) ||
    TABLE_CELL.exec(lines[1])?.[1] !== 'Name' ||
    !TABLE_DIVIDER.test(lines[2]) ||
    !TABLE_BOTTOM.test(lines.at(-1))
  ) {
    return null;
  }

  const filenames = [];
  for (const line of lines.slice(3, -1)) {
    const filename = TABLE_CELL.exec(line)?.[1];
    if (filename === undefined || !MIGRATION_NAME.test(filename)) return null;
    filenames.push(filename);
  }
  return [...new Set(filenames)];
}

/**
 * stdout 全体を消費し、既知の banner + 状態別本文だけを受理する。
 * marker は独立行でちょうど一度だけ現れる必要がある。
 */
export function parseMigrationListOutput(normalizedStdout) {
  const lines = nonEmptyLines(normalizedStdout);
  const pendingIndexes = lines.flatMap((line, index) => (line === PENDING_MARKER ? [index] : []));
  const noPendingIndexes = lines.flatMap((line, index) => (line === NO_PENDING_MARKER ? [index] : []));
  if (pendingIndexes.length + noPendingIndexes.length !== 1) return null;

  const markerIndex = pendingIndexes[0] ?? noPendingIndexes[0];
  if (!hasKnownPreamble(lines.slice(0, markerIndex))) return null;

  if (noPendingIndexes.length === 1) {
    return markerIndex === lines.length - 1 ? { state: 'no-pending', body: NO_PENDING_MARKER } : null;
  }

  const bodyLines = lines.slice(markerIndex);
  const filenames = parsePendingTable(bodyLines.slice(1));
  return filenames === null ? null : { state: 'pending', body: bodyLines.join('\n'), filenames };
}

/** 実際に観測された wrangler.jsonc secrets 警告だけを許容する。 */
export function isAcceptableStderr(normalizedStderr) {
  if (normalizedStderr === '') return true;
  const lines = nonEmptyLines(normalizedStderr);
  return lines.length === 2 && KNOWN_WARNING_HEADING.test(lines[0]) && KNOWN_WARNING_DETAIL.test(lines[1]);
}

/** command 結果を Deploy/Migrate 共通の判別型へ正規化する。 */
export function parseWranglerMigrationListResult({ exitCode, stdout = '', stderr = '', error }) {
  if (error !== undefined || exitCode !== 0) return { state: 'command-failure' };
  if (!isAcceptableStderr(normalizeOutput(stderr))) return { state: 'unparseable', reason: 'stderr' };
  return parseMigrationListOutput(normalizeOutput(stdout)) ?? { state: 'unparseable', reason: 'stdout' };
}

/** Wrangler 呼び出しの引数・上限・返却形を一つに固定する。 */
export function runWranglerMigrationList() {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@kanjo/api', 'exec', 'wrangler', 'd1', 'migrations', 'list', 'kanjo-db', '--remote'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    },
  );

  return {
    error: result.error,
    exitCode: result.status,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}
