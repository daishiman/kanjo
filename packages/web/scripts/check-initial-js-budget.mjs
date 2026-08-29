import { readFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const WEB_DIR = new URL('../', import.meta.url);
const DIST_DIR = new URL('dist/', WEB_DIR);
const MANIFEST_URL = new URL('.vite/manifest.json', DIST_DIR);
// 変更前97.66KiB + eager TaxReturn約4KiBを基準に、意図しない依存流入を止める。
const MAX_INITIAL_JS_GZIP = 110 * 1024;

const manifest = JSON.parse(readFileSync(MANIFEST_URL, 'utf8'));
const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry && key === 'index.html');
if (!entryKey) throw new Error('Vite manifestにindex.html entryがありません');

const seen = new Set();
const pending = [entryKey];
let total = 0;
const files = [];
while (pending.length) {
  const key = pending.shift();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  const item = manifest[key];
  if (!item) throw new Error(`Vite manifestのstatic importが見つかりません: ${key}`);
  if (item.file?.endsWith('.js')) {
    const bytes = gzipSync(readFileSync(new URL(item.file, DIST_DIR))).byteLength;
    total += bytes;
    files.push(`${item.file}=${(bytes / 1024).toFixed(2)}KiB`);
  }
  pending.push(...(item.imports ?? []));
}

// 実行時assetsに内部manifestを含めない。
rmSync(MANIFEST_URL);
if (total > MAX_INITIAL_JS_GZIP) {
  throw new Error(
    `初期JSがbudget超過です: ${(total / 1024).toFixed(2)}KiB > ${MAX_INITIAL_JS_GZIP / 1024}KiB (${files.join(', ')})`,
  );
}
console.log(
  `初期JS budget: ${(total / 1024).toFixed(2)}KiB / ${MAX_INITIAL_JS_GZIP / 1024}KiB (${files.join(', ')})`,
);
