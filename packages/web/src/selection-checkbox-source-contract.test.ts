import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const COMPONENT = 'components/SelectionCheckbox.tsx';

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });

const cssFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });

describe('選択checkboxの共通部品契約', () => {
  it('native checkboxはSelectionCheckboxだけが所有する', () => {
    const violations = sourceFiles(SOURCE_ROOT)
      .filter((path) => relative(SOURCE_ROOT, path) !== COMPONENT)
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return [...source.matchAll(/type=["']checkbox["']/g)].map((match) => ({
          file: relative(SOURCE_ROOT, path),
          line: source.slice(0, match.index).split('\n').length,
        }));
      });

    expect(violations).toEqual([]);
  });

  it('ページ固有CSSでnative checkboxの寸法を上書きしない', () => {
    const violations = cssFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return [...source.matchAll(/input\s*\[\s*type\s*=\s*["']checkbox["']\s*\]/g)].map(() =>
        relative(SOURCE_ROOT, path),
      );
    });

    expect(violations).toEqual([]);
  });
});
