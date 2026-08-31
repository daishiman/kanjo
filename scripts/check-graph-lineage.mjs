#!/usr/bin/env node
/**
 * 設計グラフ(architecture/graph.json)と現物のズレ検査。
 *
 * 各ノードは source_lineage に「どの正本から起こしたか」の path と、その時点の
 * sha256(source_digest)を記録している。ところが照合する仕組みが無かったため、
 * 正本が archive へ移された・書き換えられたのに digest が古いまま、という状態が
 * 2世代にわたって放置された。照合自体は数行で書けるので、lint で落とす。
 *
 * 1) digest 照合 — source_path の現物の sha256 が source_digest と一致する。
 *    digest が null のノードも失敗扱い(未打刻は照合を放棄したのと同じ)。
 * 2) 孤児検出 — architecture/*.md とノードが1対1で対応する。
 *    md はあるのにノードが無い(登録漏れ)/ノードの file_path が実在しない(参照切れ)の両方向を見る。
 *   node scripts/check-graph-lineage.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const graph = JSON.parse(readFileSync(join(root, 'architecture/graph.json'), 'utf8'));
const nodes = graph.nodes ?? [];

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const errors = [];

// --- 1) digest 照合 ---
for (const node of nodes) {
  const { source_path: sourcePath, source_digest: digest } = node.source_lineage ?? {};
  if (!sourcePath) {
    errors.push(`「${node.id}」に source_lineage.source_path がありません。`);
    continue;
  }
  if (!digest) {
    errors.push(
      `「${node.id}」の source_digest が空です。${sourcePath} の sha256 を打ってください(未打刻は照合を放棄したのと同じです)。`,
    );
    continue;
  }
  const abs = join(root, sourcePath);
  if (!existsSync(abs)) {
    errors.push(
      `「${node.id}」の source_path「${sourcePath}」が実在しません。正本が移動・退避したなら source_path と source_digest を追従させてください。`,
    );
    continue;
  }
  const actual = sha256(abs);
  if (actual !== digest)
    errors.push(
      `「${node.id}」の source_digest が「${sourcePath}」の現物と一致しません(記録 ${digest} / 現物 ${actual})。正本の変更を章へ取り込んだうえで digest を打ち直してください。`,
    );
}

// --- 2) 孤児検出 ---
const ids = new Set(nodes.map((n) => n.id));
const chapters = readdirSync(join(root, 'architecture'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.replace(/\.md$/, ''));

for (const chapter of chapters)
  if (!ids.has(chapter))
    errors.push(
      `architecture/${chapter}.md が graph.json のどのノードにも登録されていません(id「${chapter}」のノードを足してください)。`,
    );
for (const node of nodes) {
  if (!node.file_path) {
    errors.push(`「${node.id}」に file_path がありません。`);
    continue;
  }
  if (!existsSync(join(root, node.file_path)))
    errors.push(`「${node.id}」の file_path「${node.file_path}」が実在しません。`);
}

if (errors.length) {
  for (const e of errors) console.error(`check-graph-lineage: ${e}`);
  process.exit(1);
}
console.log(
  `check-graph-lineage: ${nodes.length}ノードすべてが正本と一致し、architecture/*.md ${chapters.length}件に孤児はありません。`,
);
