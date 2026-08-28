// 用語辞書(packages/web/src/glossary.ts)の整合チェック。
// 1) 辞書の全項目が、少なくとも1画面で使われている(画面に出ない用語を辞書に溜めない)
// 2) 画面で使っている id が辞書に存在する(型検査でも弾けるが、文字列検索でも二重に確認する)
// 「使われている」の形は2つある。自由文やラベルに置く <Term id="…"> と、
// 表の見出しに置く termColumn('…')。後者は見出しの文言も辞書から引くので、同じく画面に出る。
// 3) short が空でない・全角120字以内(ホバーで読める長さ)
// 4) 別名(aliases)が空でなく、別々の用語で取り合いにならない(同じ表記の重複・別用語の別名を丸ごと含む表記を禁じる)
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

/** 画面から用語を指す書き方。どちらもホバーの説明が出る */
const USE_PATTERNS = [/<Term id="(\w+)"/g, /termColumn\('(\w+)'/g];

const used = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const pattern of USE_PATTERNS)
    for (const m of src.matchAll(pattern)) {
      if (!used.has(m[1])) used.set(m[1], []);
      used.get(m[1]).push(relative(root, f));
    }
}

const errors = [];
for (const id of ids)
  if (!used.has(id))
    errors.push(
      `辞書の「${id}」はどの画面でも <Term id="${id}"> / termColumn('${id}') として使われていません。画面に出ない用語は辞書から外してください。`,
    );
for (const id of used.keys())
  if (!ids.includes(id))
    errors.push(`画面が指す用語「${id}」が辞書にありません(${used.get(id).join(', ')})。`);
for (const m of body.matchAll(/^ {2}(\w+): \{[\s\S]*?short: '([^']*)'/gm)) {
  const [, id, short] = m;
  if (!short.trim()) errors.push(`「${id}」の short が空です。`);
  if (short.length > 120)
    errors.push(
      `「${id}」の short が長すぎます(${short.length}字 > 120)。ホバーで読める長さにしてください。`,
    );
}

// --- 別名(表記ゆれ)の検査 ---
// 自由文のホバー化(linkTerms)は「長い表記から順に、いちばん左に出たもの」を採るため、
// 別名が別の用語の別名を丸ごと含むと、どちらの説明が出るかが表記ゆれ次第で変わってしまう。
const starts = [...body.matchAll(/^ {2}(\w+): \{/gm)];
/** id -> その用語が自由文で拾う表記の一覧(aliases 未指定なら term 1件) */
const aliasesById = new Map();
for (const [index, start] of starts.entries()) {
  const src = body.slice(start.index, starts[index + 1]?.index ?? body.length);
  const term = /\bterm: '([^']*)'/.exec(src)?.[1] ?? '';
  const aliasBlock = /\baliases: \[([\s\S]*?)\]/.exec(src)?.[1];
  const list = aliasBlock ? [...aliasBlock.matchAll(/'([^']*)'/g)].map((m) => m[1]) : [term];
  aliasesById.set(start[1], list);
}

const aliasOwner = new Map();
for (const [id, list] of aliasesById) {
  if (!list.length) errors.push(`「${id}」の aliases が空です。省略するか、1件以上の表記を入れてください。`);
  for (const text of list) {
    if (!text.trim()) errors.push(`「${id}」に空の別名があります。`);
    const owner = aliasOwner.get(text);
    if (owner && owner !== id)
      errors.push(
        `別名「${text}」を「${owner}」と「${id}」が取り合っています。どちらか一方に寄せてください。`,
      );
    aliasOwner.set(text, id);
  }
}
for (const [text, id] of aliasOwner)
  for (const [other, otherId] of aliasOwner)
    if (id !== otherId && text !== other && text.includes(other))
      errors.push(
        `別名「${text}」(${id})が別の用語の別名「${other}」(${otherId})を丸ごと含みます。どちらが出るか表記次第になるため、表記を分けてください。`,
      );

if (errors.length) {
  for (const e of errors) console.error(`check-glossary: ${e}`);
  process.exit(1);
}
console.log(
  `check-glossary: ${ids.length}語すべてが画面で使われています(表記ゆれの別名 ${aliasOwner.size}件)。`,
);
