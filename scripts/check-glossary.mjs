// 用語辞書(packages/web/src/glossary.ts)の整合チェック。
// 1) 辞書の全項目が、少なくとも1画面で <Term id="…"> として使われている(画面に出ない用語を辞書に溜めない)
// 2) 画面で使っている id が辞書に存在する(型検査でも弾けるが、文字列検索でも二重に確認する)
// 3) short が空でない・全角120字以内(ホバーで読める長さ)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/web/src/', import.meta.url));
const glossary = readFileSync(join(root, 'glossary.ts'), 'utf8');
const body = glossary.slice(
  glossary.indexOf('export const GLOSSARY = {'),
  glossary.indexOf('} as const satisfies'),
);
const ids = [...body.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && !/glossary\.ts$|Term\.tsx$/.test(name))
      files.push(p);
  }
})(root);

const used = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<Term id="(\w+)"/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(relative(root, f));
  }
}

const errors = [];
for (const id of ids)
  if (!used.has(id))
    errors.push(
      `辞書の「${id}」はどの画面でも <Term id="${id}"> として使われていません。画面に出ない用語は辞書から外してください。`,
    );
for (const id of used.keys())
  if (!ids.includes(id)) errors.push(`<Term id="${id}"> が辞書にありません(${used.get(id).join(', ')})。`);
for (const m of body.matchAll(/^ {2}(\w+): \{[\s\S]*?short: '([^']*)'/gm)) {
  const [, id, short] = m;
  if (!short.trim()) errors.push(`「${id}」の short が空です。`);
  if (short.length > 120)
    errors.push(
      `「${id}」の short が長すぎます(${short.length}字 > 120)。ホバーで読める長さにしてください。`,
    );
}

if (errors.length) {
  for (const e of errors) console.error(`check-glossary: ${e}`);
  process.exit(1);
}
console.log(`check-glossary: ${ids.length}語すべてが画面で使われています。`);
