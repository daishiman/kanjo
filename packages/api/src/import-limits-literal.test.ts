/**
 * 取込の上限値は core の IMPORT_LIMITS の 1 か所だけに置く (spec-import-screen / P04)。
 *
 * web の送信前判定と api の 413 が別々に数値を書くと、片方だけ直したときに「画面は通すのに
 * サーバが 413」「画面は止めるのにサーバは通す」がずれて起きる。取込の経路のソースを字面で読み、
 * 上限値の書き写しが 0 件であることを固定する。
 *
 * 0 件は「調べて 0 件」と「調べる対象が無くて 0 件」を区別する必要があるので、
 * 対象ファイルの件数・定数を import していること・検出器が書き写しを実際に拾えることも同時に見る。
 * 旧 routes/imports.ts は `file.size > 25 * 1024 * 1024` を持っていたため、この検査で落ちる。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_LIMITS, IMPORT_MB } from '@kanjo/core';
import { describe, expect, it } from 'vitest';

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** 取込の経路。検査・確定・履歴の API と、データ取込画面の本番コード (テストと偽サーバは除く) */
const IMPORT_PATH_FILES = [
  'api/src/routes/imports.ts',
  'api/src/import-pipeline.ts',
  'web/src/pages/import/ImportConfirm.tsx',
  'web/src/pages/import/ImportFileTable.tsx',
  'web/src/pages/import/ImportHistory.tsx',
  'web/src/pages/import/ImportPage.tsx',
  'web/src/pages/import/ImportReviewSteps.tsx',
  'web/src/pages/import/ImportSelectStep.tsx',
  'web/src/pages/import/use-import-files.ts',
  'web/src/pages/import/view-model.ts',
] as const;

/** 上限値を import して使うはずのファイル (web の送信前判定と api の 413) */
const LIMIT_CONSUMERS = [
  'api/src/routes/imports.ts',
  'web/src/pages/import/ImportSelectStep.tsx',
  'web/src/pages/import/use-import-files.ts',
  'web/src/pages/import/view-model.ts',
] as const;

/** コメントの中の説明文 (「25MB まで」など) は書き写しに数えない */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const mb = (bytes: number): number => bytes / IMPORT_MB;
const digits = (n: number): string => String(n).split('').join('_?');

/** IMPORT_LIMITS の値から、書き写しとみなす字面を作る。値を変えれば検出器も追従する */
function literalPatterns(): Array<{ name: string; pattern: RegExp }> {
  const byteLimits = [
    ['maxFileBytes', IMPORT_LIMITS.maxFileBytes],
    ['maxTotalBytes', IMPORT_LIMITS.maxTotalBytes],
    ['maxExpandedBytes', IMPORT_LIMITS.maxExpandedBytes],
  ] as const;
  const patterns = byteLimits.flatMap(([name, bytes]) => [
    {
      name: `${name} (${mb(bytes)} * 1024 * 1024)`,
      pattern: new RegExp(`\\b${mb(bytes)}\\s*\\*\\s*(1024|IMPORT_MB)\\b`),
    },
    { name: `${name} (${bytes})`, pattern: new RegExp(`\\b${digits(bytes)}\\b`) },
    { name: `${name} (${mb(bytes)}MB)`, pattern: new RegExp(`\\b${mb(bytes)}\\s*MB\\b`) },
  ]);
  return [
    ...patterns,
    { name: 'maxFiles (.max(10))', pattern: new RegExp(`\\.max\\(\\s*${IMPORT_LIMITS.maxFiles}\\s*\\)`) },
    {
      name: 'maxFiles (10 ファイル)',
      pattern: new RegExp(`\\b${IMPORT_LIMITS.maxFiles}\\s*(ファイル|files?)\\b`),
    },
    {
      name: 'maxArchiveEntries (1000)',
      // 「60 * 1000」のような掛け算の右辺は時間の単位 (ミリ秒) なので数えない
      pattern: new RegExp(`(?<!\\*\\s*)\\b${digits(IMPORT_LIMITS.maxArchiveEntries)}\\b`),
    },
  ];
}

const findLiterals = (source: string): string[] => {
  const code = stripComments(source);
  return literalPatterns()
    .filter(({ pattern }) => pattern.test(code))
    .map(({ name }) => name);
};

const read = (file: string): string => readFileSync(resolve(packagesDir, file), 'utf8');

describe('取込の経路に上限値の書き写しが無い', () => {
  it('対象の 10 ファイルをすべて読めて、どれも空ではない', () => {
    expect(IMPORT_PATH_FILES).toHaveLength(10);
    for (const file of IMPORT_PATH_FILES) expect(read(file).length, file).toBeGreaterThan(0);
  });

  it('検出器は、上限値の書き写しの典型を 1 件ずつ拾い、時差などの無関係な数は拾わない', () => {
    expect(findLiterals('if (file.size > 25 * 1024 * 1024) return;')).toEqual([
      'maxFileBytes (25 * 1024 * 1024)',
    ]);
    expect(findLiterals('const MAX = 31_457_280;')).toEqual(['maxTotalBytes (31457280)']);
    expect(findLiterals('<small>1 ファイル 60MB まで</small>')).toEqual(['maxExpandedBytes (60MB)']);
    expect(findLiterals('z.array(z.string()).max(10)')).toEqual(['maxFiles (.max(10))']);
    expect(findLiterals('if (entries > 1000) throw error;')).toEqual(['maxArchiveEntries (1000)']);
    expect(findLiterals('const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);')).toEqual([]);
    expect(findLiterals('// 1 ファイル 25MB まで (IMPORT_LIMITS)')).toEqual([]);
  });

  it.each(IMPORT_PATH_FILES)('%s は上限値を書き写していない', (file) => {
    expect(findLiterals(read(file))).toEqual([]);
  });

  it.each(LIMIT_CONSUMERS)('%s は core の上限 (定数か判定関数) を import して使う', (file) => {
    const source = read(file);
    expect(source).toMatch(/from '@kanjo\/core'/);
    expect(source).toMatch(/\b(IMPORT_LIMITS|importLimitViolation|importLimitsNote|importBodyLimitBytes)\b/);
  });
});
