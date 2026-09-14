import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPOGRAPHY } from '@kanjo/core';
import { describe, expect, it } from 'vitest';

const WEB_PACKAGE = new URL('../', import.meta.url);
const STYLE_SOURCE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const CHART_SOURCE = readFileSync(new URL('./components/charts.ts', import.meta.url), 'utf8');
const PACKAGE_JSON = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function nonTestSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) {
      return ['coverage', 'dist', 'node_modules', 'test-support'].includes(name)
        ? []
        : nonTestSourceFiles(fullPath);
    }
    return /\.(?:[cm]?js|css|html|ts|tsx)$/.test(name) && !/\.(?:test|spec)\./.test(name) ? [fullPath] : [];
  });
}

const WEB_PACKAGE_PATH = fileURLToPath(WEB_PACKAGE);
const SOURCE_FILES = nonTestSourceFiles(WEB_PACKAGE_PATH);
const SOURCE_TEXT = SOURCE_FILES.map((path) => ({
  path: relative(WEB_PACKAGE_PATH, path),
  text: readFileSync(path, 'utf8'),
}));
const ALL_SOURCE = SOURCE_TEXT.map(({ text }) => text).join('\n');

describe('フォント配信契約', () => {
  it('日本語UIはOS標準フォントを使い、Webフォントの日本語サブセットを配信しない', () => {
    expect(STYLE_SOURCE).toMatch(/--font-head:\s*system-ui,[\s\S]*?"Hiragino Sans",[\s\S]*?"Yu Gothic UI"/);
    expect(ALL_SOURCE).not.toContain('zen-kaku-gothic-new');
    expect(CHART_SOURCE).not.toContain('Zen Kaku Gothic New');
    expect(PACKAGE_JSON.dependencies).not.toHaveProperty('@fontsource/zen-kaku-gothic-new');
  });

  it('全非test sourceとdependenciesで、自己配信するのは IBM Plex Mono Latin 400/600 だけ', () => {
    const imports = [...ALL_SOURCE.matchAll(/['"](@fontsource\/[^'"]+)['"]/g)]
      .map((match) => match[1])
      .sort();
    const expectedImports = TYPOGRAPHY.fontMonoWeights
      .map((weight) => `@fontsource/ibm-plex-mono/latin-${weight}.css`)
      .sort();
    const fontDependencies = [
      PACKAGE_JSON.dependencies,
      PACKAGE_JSON.devDependencies,
      PACKAGE_JSON.optionalDependencies,
      PACKAGE_JSON.peerDependencies,
    ]
      .flatMap((dependencies) => Object.keys(dependencies ?? {}))
      .filter((name) => name.startsWith('@fontsource/'))
      .sort();

    expect(imports).toEqual(expectedImports);
    expect(fontDependencies).toEqual(['@fontsource/ibm-plex-mono']);
  });

  it('非test sourceから外部フォントURLや独自 @font-face を読み込まない', () => {
    const violations = SOURCE_TEXT.flatMap(({ path, text }) => {
      const remoteFont = /(?:fonts\.(?:googleapis|gstatic)\.com|https?:\/\/[^\s"')]+\.(?:woff2?|ttf|otf))/gi;
      const matches = [...text.matchAll(remoteFont)].map((match) => `${path}: ${match[0]}`);
      if (/@font-face\s*\{/i.test(text)) matches.push(`${path}: @font-face`);
      return matches;
    });
    expect(violations).toEqual([]);
  });

  it('IBM Plex Mono を使う CSS rule は、配信済みの400または600を明示する', () => {
    const cssWithoutComments = STYLE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    const monoRules = [
      ...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*font-family:\s*var\(--font-mono\)[^{}]*)\}/g),
    ];
    const violations = monoRules.flatMap(([, selector, declarations]) => {
      const weight = declarations.match(/font-weight:\s*(\d+)/)?.[1];
      return weight && TYPOGRAPHY.fontMonoWeights.includes(Number(weight) as 400 | 600)
        ? []
        : [`${selector.trim()}: ${weight ?? '未指定'}`];
    });
    expect(monoRules.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('見出しの強弱と図表のフォント系統を維持する', () => {
    expect(STYLE_SOURCE.match(/font-weight:\s*900/g)?.length).toBeGreaterThan(0);
    expect(STYLE_SOURCE.match(/font-weight:\s*700/g)?.length).toBeGreaterThan(0);
    // 図のフォントは正本 TYPOGRAPHY.fontHead を経由する(styles.css の --font-head と同じ値)
    expect(CHART_SOURCE).toMatch(/Chart\.defaults\.font\.family\s*=\s*TYPOGRAPHY\.fontHead/);
    expect(TYPOGRAPHY.fontHead).toContain('system-ui, -apple-system, BlinkMacSystemFont');
  });

  it('非test CSSの文字サイズは正本scale・inherit・非文字形状の0だけを使う', () => {
    const cssWithoutComments = STYLE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    const allowed = new Set([
      ...Object.keys(TYPOGRAPHY.scale).map((step) => `var(--fs-${step})`),
      'inherit',
      '0',
    ]);
    const violations = [...cssWithoutComments.matchAll(/font-size:\s*([^;]+);/g)]
      .map((match) => match[1]?.trim() ?? '')
      .filter((value) => !allowed.has(value));
    expect(violations).toEqual([]);
  });
});
