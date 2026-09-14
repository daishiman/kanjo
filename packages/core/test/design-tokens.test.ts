import { describe, expect, it } from 'vitest';
import {
  COLOR,
  CONTRAST_ROLES,
  DESIGN_SYSTEM_COLORS,
  DESIGN_TOKEN_INTEGRITY_VALUES,
  EFFECT_COLOR,
  MOTION,
  RADIUS,
  SHADOW,
  SIZE,
  SPACE,
  TYPOGRAPHY,
  stableValueJson,
} from '../src/design-tokens.js';

/**
 * 値の唯一の編集点は design-tokens.ts。このテストは値を再転記せず、
 * FINAL-UI から合意したスキーマ・役割間係・アクセシビリティ不変条件を検査する。
 */
describe('design-tokens: 正本の不変条件 (FR-001)', () => {
  it('FINAL-UI が定めた10色の役割スキーマを保つ', () => {
    expect(Object.keys(DESIGN_SYSTEM_COLORS)).toEqual([
      'bg',
      'surface',
      'line',
      'ink',
      'inkSoft',
      'primary',
      'accent',
      'warnFill',
      'danger',
      'good',
    ]);
  });

  it('役割色の正本 COLOR が10色を同じ値で含む', () => {
    for (const [name, value] of Object.entries(DESIGN_SYSTEM_COLORS)) {
      expect(COLOR[name as keyof typeof DESIGN_SYSTEM_COLORS], name).toBe(value);
    }
  });

  it('寸法・角丸・余白・文字の不変条件を保つ', () => {
    expect(SIZE.contentReadingMaxWidth).toBeLessThan(SIZE.contentDataMaxWidth);
    expect(SIZE.tapTargetMin).toBeGreaterThanOrEqual(44);
    expect(RADIUS.base).toBe(8);
    expect(SPACE.pageGutter).toBeGreaterThan(SPACE.compactPageGutter);
    expect(TYPOGRAPHY.minFontSize).toBeGreaterThanOrEqual(12);
    expect(TYPOGRAPHY.bodyFontSize.min).toBeGreaterThanOrEqual(TYPOGRAPHY.minFontSize);
    expect(TYPOGRAPHY.bodyFontSize.max).toBeGreaterThanOrEqual(TYPOGRAPHY.bodyFontSize.min);
    expect(TYPOGRAPHY.lineHeight).toBeGreaterThanOrEqual(1.5);
    expect(TYPOGRAPHY.fontMonoWeights).toEqual([400, 600]);
    expect(MOTION.chart).toBeGreaterThanOrEqual(MOTION.base);
  });

  it('不透明の役割色は小文6桁 hex である', () => {
    for (const [name, value] of Object.entries(COLOR)) {
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('半透明色と影は役割名付きの正本に集約される', () => {
    expect(Object.values(EFFECT_COLOR).every((value) => /^rgb\([^)]*\/[^)]*\)$/.test(value))).toBe(true);
    expect(Object.values(SHADOW).every((value) => /rgb\(/.test(value))).toBe(true);
    expect(CONTRAST_ROLES.decorativeLine).toContain('line');
  });
});

describe('design-tokens: integrity 境界', () => {
  it('公開する表示 token は単一 registry から導出される', () => {
    expect(DESIGN_TOKEN_INTEGRITY_VALUES.color).toBe(COLOR);
    expect(DESIGN_TOKEN_INTEGRITY_VALUES.typography).toBe(TYPOGRAPHY);
    expect(DESIGN_TOKEN_INTEGRITY_VALUES.effectColor).toBe(EFFECT_COLOR);
  });

  it('fingerprint 入力を宣言順に依存せず安定化する', () => {
    expect(stableValueJson({ z: [2, 1], a: { y: true, x: null } })).toBe(
      '{"a":{"x":null,"y":true},"z":[2,1]}',
    );
  });
});

/** 移行前の styles.css :root にあった変数名。該当トークンを正本から消さない。 */
const LEGACY_CSS_VARIABLES = [
  '--bg',
  '--surface',
  '--ink',
  '--ink-soft',
  '--line',
  '--primary',
  '--primary-hover',
  '--accent',
  '--biz',
  '--per',
  '--warn',
  '--danger',
  '--good',
  '--biz-soft',
  '--biz-soft-line',
  '--biz-strong',
  '--radius',
  '--font-head',
  '--font-mono',
  '--fs-2xs',
  '--fs-xs',
  '--fs-sm',
  '--fs-md',
  '--fs-base',
  '--fs-lg',
  '--fs-xl',
  '--fs-2xl',
  '--fs-3xl',
  '--motion-instant',
  '--motion-fast',
  '--motion-base',
  '--header-h',
  '--tabbar-h',
  '--sidebar-w',
  '--drawer-w',
  '--content-max-w',
  '--content-data-max-w',
  '--financial-chart-height',
  '--tap-target-min',
  '--nav-icon-size',
  '--tab-icon-size',
  '--nav-icon-label-gap',
  '--nav-group-gap',
] as const;

describe('design-tokens: CSS adapter との互換契約', () => {
  it('既存 consumer の CSS 変数に対応するトークンが正本にある', () => {
    const available = new Set([
      ...Object.keys(COLOR).map(
        (name) => `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      ),
      '--radius',
      '--font-head',
      '--font-mono',
      ...Object.keys(TYPOGRAPHY.scale).map((step) => `--fs-${step}`),
      '--motion-instant',
      '--motion-fast',
      '--motion-base',
      '--header-h',
      '--tabbar-h',
      '--sidebar-w',
      '--drawer-w',
      '--content-max-w',
      '--content-data-max-w',
      '--financial-chart-height',
      '--tap-target-min',
      '--nav-icon-size',
      '--tab-icon-size',
      '--nav-icon-label-gap',
      '--nav-group-gap',
    ]);
    expect(LEGACY_CSS_VARIABLES.filter((name) => !available.has(name))).toEqual([]);
  });
});
