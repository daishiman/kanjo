import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const EXEMPT_KINDS = new Set(['layout', 'matrix', 'hierarchy', 'comparison', 'workflow']);

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : name.endsWith('.tsx') ? [path] : [];
  });

describe('表のソート適用範囲', () => {
  it('生のtableはソート対象か、並べ替えない構造上の理由を必ず明示する', () => {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const file of tsxFiles(SOURCE_ROOT)) {
      if (file.endsWith('/components/DataTable.tsx')) continue;
      const source = readFileSync(file, 'utf8');
      const tags = source.match(/<table\b[^>]*>/gs) ?? [];
      tags.forEach((tag, index) => {
        const kind = tag.match(/data-table-kind=["']([^"']+)["']/)?.[1];
        const label = `${relative(SOURCE_ROOT, file)}#${index + 1}`;
        if (!kind) {
          missing.push(label);
          return;
        }
        if (kind === 'sortable') {
          if (!source.includes('SortableTableHeader')) invalid.push(`${label}: sortableに共通見出しが無い`);
          return;
        }
        const reason = tag.match(/data-sort-reason=["']([^"']+)["']/)?.[1] ?? '';
        if (!EXEMPT_KINDS.has(kind) || reason.length < 10)
          invalid.push(`${label}: 例外taxonomyまたは理由が不正`);
      });
    }

    expect(missing, '無言でソート対象外になっている表').toEqual([]);
    expect(invalid, 'ソート例外契約に反する表').toEqual([]);
  });
});
