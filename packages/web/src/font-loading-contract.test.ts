import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MAIN_SOURCE = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const STYLE_SOURCE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const CHART_SOURCE = readFileSync(new URL('./components/charts.ts', import.meta.url), 'utf8');
const PACKAGE_JSON = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('フォント配信契約', () => {
  it('日本語UIはOS標準フォントを使い、Webフォントの日本語サブセットを配信しない', () => {
    expect(STYLE_SOURCE).toMatch(/--font-head:\s*system-ui,[\s\S]*?"Hiragino Sans",[\s\S]*?"Yu Gothic UI"/);
    expect(MAIN_SOURCE).not.toContain('zen-kaku-gothic-new');
    expect(CHART_SOURCE).not.toContain('Zen Kaku Gothic New');
    expect(PACKAGE_JSON.dependencies).not.toHaveProperty('@fontsource/zen-kaku-gothic-new');
  });

  it('金額用フォントはLatinの400と600だけを配信する', () => {
    expect(MAIN_SOURCE.match(/@fontsource\//g)).toHaveLength(2);
    expect(MAIN_SOURCE).toContain('@fontsource/ibm-plex-mono/latin-400.css');
    expect(MAIN_SOURCE).toContain('@fontsource/ibm-plex-mono/latin-600.css');
    expect(MAIN_SOURCE).not.toMatch(/@fontsource\/ibm-plex-mono\/(?!latin-(?:400|600)\.css)/);
  });

  it('見出しの強弱と図表のフォント系統を維持する', () => {
    expect(STYLE_SOURCE.match(/font-weight:\s*900/g)?.length).toBeGreaterThan(0);
    expect(STYLE_SOURCE.match(/font-weight:\s*700/g)?.length).toBeGreaterThan(0);
    expect(CHART_SOURCE).toContain('system-ui, -apple-system, BlinkMacSystemFont');
  });
});
