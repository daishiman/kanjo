#!/usr/bin/env node
/**
 * プロジェクト固有スキルの同期。
 * 正本: skills/<name>/ → 配布先: .claude/skills/<name>/ (Claude Code), .agents/skills/<name>/ (Codex)
 * キット(aidd-agent-kit)が管理するスキルとは別物で、キット更新でも消えない(マニフェスト管理外のため)。
 *   node scripts/sync-project-skills.mjs          … 同期(上書き)
 *   node scripts/sync-project-skills.mjs --check  … 差分があれば終了コード1(CI用)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const SOURCE = join(root, 'skills');
const TARGETS = [join(root, '.claude', 'skills'), join(root, '.agents', 'skills')];
const check = process.argv.includes('--check');

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

function same(a, b) {
  return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

let drift = 0;
for (const skill of readdirSync(SOURCE)) {
  const src = join(SOURCE, skill);
  if (!statSync(src).isDirectory()) continue;
  const files = walk(src);
  for (const target of TARGETS) {
    const dst = join(target, skill);
    const dstFiles = existsSync(dst) ? walk(dst) : [];
    const stale = dstFiles.filter((f) => !files.includes(f));
    const changed = files.filter((f) => !same(join(src, f), join(dst, f)));
    if (changed.length === 0 && stale.length === 0) continue;
    drift += changed.length + stale.length;
    if (check) {
      for (const f of changed) console.log(`差分: ${relative(root, join(dst, f))}`);
      for (const f of stale) console.log(`余分: ${relative(root, join(dst, f))}`);
      continue;
    }
    rmSync(dst, { recursive: true, force: true });
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    console.log(`同期: ${relative(root, dst)} (${files.length} files)`);
  }
}

if (check && drift > 0) {
  console.error('スキルの配布先が正本と食い違っています。pnpm run skills:sync を実行してください。');
  process.exit(1);
}
if (drift === 0) console.log('スキルの配布先は正本と一致しています。');
