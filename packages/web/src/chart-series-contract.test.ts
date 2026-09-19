import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOR, CONTRAST_ROLES, MOTION, contrastRatio } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { analyzeChartColorSource } from '../../../scripts/ui-contract-ast.mjs';
import {
  chartAnimation,
  chartDecorativeFill,
  chartSeriesColor,
  installChartThemeSync,
} from './components/charts.js';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });
}

/** react-chartjs-2 を実際に import する production consumer を母数にする。 */
const CHART_SOURCES = sourceFiles(sourceRoot).filter((path) =>
  readFileSync(path, 'utf8').includes("from 'react-chartjs-2'"),
);

describe('チャート系列の描画契約 (BR-004)', () => {
  it('実描画する全 consumer を自動検出している', () => {
    expect(CHART_SOURCES.map((path) => relative(sourceRoot, path)).sort()).toEqual([
      'components/FinancialCharts.tsx',
      'components/ReportChart.tsx',
      'pages/Ai.tsx',
      'pages/Overview.tsx',
      'pages/Subscriptions.tsx',
      'pages/analysis/TotalCashflow.tsx',
      'pages/analysis/trends/ChangeFactors.tsx',
      'pages/analysis/trends/TrendSeriesPanel.tsx',
      'pages/household/HouseholdSeries.tsx',
    ]);
  });

  it('判別用の全 semantic series role は背景・面に 3:1 以上', () => {
    const failures = CONTRAST_ROLES.chartSeries.flatMap((name) =>
      [COLOR.bg, COLOR.surface]
        .map((ground) => ({ name, ground, ratio: contrastRatio(chartSeriesColor(name), ground) }))
        .filter(({ ratio }) => ratio < 3),
    );
    expect(failures).toEqual([]);
  });

  it.each(CHART_SOURCES)('%s は系列色へ16進alpha suffixを直接連結しない', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source.match(/\$\{[^}]+\}[0-9a-f]{2}/gi) ?? []).toEqual([]);
  });

  it('Chart color property は AST で semantic/decorative role に分類される', () => {
    const violations = CHART_SOURCES.flatMap((path) =>
      analyzeChartColorSource(readFileSync(path, 'utf8'), relative(sourceRoot, path)),
    );
    expect(violations).toEqual([]);
  });

  it('未分類の生色とdecorative fillを系列輪郭に使う反例を拒否する', () => {
    const source = `
      const data = { datasets: [
        { backgroundColor: '#fff' },
        { borderColor: chartDecorativeFill(COLORS.good, 0.2) }
      ] };
    `;
    expect(analyzeChartColorSource(source, 'fixture.tsx')).toEqual([
      'fixture.tsx:3 backgroundColor is not derived from a semantic chart role',
      'fixture.tsx:4 borderColor cannot use a decorative fill',
    ]);
  });

  it('任意関数・未由来identifierの chart color を拒否する', () => {
    const source =
      'const data = { datasets: [{ backgroundColor: pickUnknown() }, { borderColor: arbitraryToken }] };';
    expect(analyzeChartColorSource(source, 'fixture.tsx')).toEqual([
      'fixture.tsx:1 backgroundColor is not derived from an approved semantic chart role',
      'fixture.tsx:1 borderColor is not derived from an approved semantic chart role',
    ]);
  });

  it('allowlist風の変数名でもraw値を束縛した色は拒否する', () => {
    const source = `
      const colors = ['#fff'];
      const palette = ['#000'];
      const data = { datasets: [{ backgroundColor: colors }, { borderColor: palette[0] }] };
    `;
    expect(analyzeChartColorSource(source, 'fixture.tsx')).toEqual([
      'fixture.tsx:4 backgroundColor is not derived from an approved semantic chart role',
      'fixture.tsx:4 borderColor is not derived from an approved semantic chart role',
    ]);
  });

  it('map callback内でCOLORSへ言及するだけでは未由来returnを許可しない', () => {
    const source = `
      const data = { datasets: [{
        backgroundColor: rows.map((row) => {
          void COLORS.good;
          return row.untrustedColor;
        })
      }] };
    `;
    expect(analyzeChartColorSource(source, 'fixture.tsx')).toEqual([
      'fixture.tsx:3 backgroundColor is not derived from an approved semantic chart role',
    ]);
  });

  it('透明色は装飾レイヤー専用 helper が生成し、不透明系列とは別契約になる', () => {
    expect(chartDecorativeFill(COLOR.good, 0.5)).toBe(`${COLOR.good}80`);
    expect(chartSeriesColor('good')).toBe(COLOR.good);
  });

  it('図の motion は token 正本へ追随する', () => {
    expect(chartAnimation()).toEqual({ duration: MOTION.chart });
  });

  it('contrast/theme変更時にChart defaultsと既存instanceを更新するhookを持つ', () => {
    let listener: (() => void) | undefined;
    let inkSoft: string = COLOR.inkSoft;
    let line: string = COLOR.line;
    const query = {
      addEventListener: (_type: string, next: () => void) => {
        listener = next;
      },
      removeEventListener: () => undefined,
    };
    const refresh = installChartThemeSync({
      matchMedia: () => query,
      readColor: (name) => (name === 'inkSoft' ? inkSoft : line),
    });
    inkSoft = COLOR.ink;
    line = COLOR.controlBorder;
    listener?.();
    expect(refresh.current()).toEqual({ color: COLOR.ink, borderColor: COLOR.controlBorder });
    refresh.dispose();
  });
});
