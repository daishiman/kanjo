/**
 * wrangler の人間向け出力を fail-closed に解析する共通ヘルパ。
 *
 * wrangler は判定本文の前にバナー(版数・区切り線・Resource location)を出し、
 * 設定内容によっては stderr へ警告を出す。厳密一致で解析すると、
 * それだけで Deploy と Migrate の両方が停止する(2026-08-27 の事象)。
 * ここでは「既知の目印を1つだけ含む」ことを条件にし、
 * 未知の形式は従来どおり拒否する。
 */

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');

export const NO_PENDING_MARKER = '✅ No migrations to apply!';
export const PENDING_MARKER = 'Migrations to be applied:';
export const MIGRATION_NAME = /^\d{4}_[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;

/** wrangler の警告見出し。これに続くインデント行までを1ブロックとして許容する。 */
const WARNING_HEADING = /^(?:▲\s*)?\[WARNING\]/;

export function normalizeOutput(value) {
  return value.replace(ANSI_ESCAPE, '').replaceAll('\r\n', '\n').trim();
}

/**
 * 判定に使える本文を取り出す。
 * 目印が両方ある、またはどちらも無い出力は判定不能として null を返す。
 */
export function migrationListBody(normalizedStdout) {
  const pendingIndex = normalizedStdout.indexOf(PENDING_MARKER);
  const noPendingIndex = normalizedStdout.indexOf(NO_PENDING_MARKER);
  const hasPending = pendingIndex >= 0;
  const hasNoPending = noPendingIndex >= 0;
  if (hasPending === hasNoPending) return null;
  return hasPending
    ? { state: 'pending', body: normalizedStdout.slice(pendingIndex) }
    : { state: 'no-pending', body: normalizedStdout.slice(noPendingIndex) };
}

/**
 * wrangler が stderr へ出した内容を、検査続行してよい無害な出力とみなすか判定する。
 *
 * 判定材料は正規化済み(ANSI除去・trim済み)の stderr 文字列ひとつ。
 * 空文字列は必ず true。ここで true を返した stderr は以降の判定で無視される。
 */
export function isAcceptableStderr(normalizedStderr) {
  if (normalizedStderr === '') return true;
  let insideWarningBlock = false;
  for (const line of normalizedStderr.split('\n')) {
    if (line.trim() === '') continue;
    if (WARNING_HEADING.test(line.trim())) {
      insideWarningBlock = true;
      continue;
    }
    // 警告見出しに続くインデント行だけを同じブロックの一部として許容する
    if (insideWarningBlock && /^\s/.test(line)) continue;
    return false;
  }
  return true;
}

/** pending 本文から migration ファイル名を重複なく取り出す。 */
export function pendingFilenamesFromBody(body) {
  const matches = body.match(/\b\d{4}_[A-Za-z0-9][A-Za-z0-9._-]*\.sql\b/g) ?? [];
  return [...new Set(matches)];
}
