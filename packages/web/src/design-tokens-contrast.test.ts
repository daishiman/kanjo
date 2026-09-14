import { readFileSync } from 'node:fs';
import { COLOR, CONTRAST_ROLES, HIGH_CONTRAST_COLOR, VENDOR_EXTRA_COLORS, contrastRatio } from '@kanjo/core';
import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.2 のコントラスト検査 (FR-004 / AC-004)。
 * 文字は 1.4.3 の 4.5:1、部品の枠とチャート系列は 1.4.11 の 3:1。
 * 装飾だけの罫線 (--line) は 1.4.11 の対象外なので検査から外し、代わりに
 * 「部品の枠に使われていないこと」を styles.css から確かめる。
 */
const GROUNDS = { bg: COLOR.bg, surface: COLOR.surface } as const;

type Violation = { token: string; ground: string; ratio: number; min: number };

function audit(tokens: Record<string, string>, min: number): Violation[] {
  const violations: Violation[] = [];
  for (const [token, value] of Object.entries(tokens)) {
    for (const [ground, groundValue] of Object.entries(GROUNDS)) {
      const ratio = contrastRatio(value, groundValue);
      if (ratio < min) violations.push({ token, ground, ratio: Number(ratio.toFixed(2)), min });
    }
  }
  return violations;
}

function pick(names: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    names.map((name) => {
      const value = COLOR[name as keyof typeof COLOR];
      if (!value) throw new Error(`CONTRAST_ROLES に未定義のトークン ${name} がある`);
      return [name, value];
    }),
  );
}

describe('contrastRatio', () => {
  it('WCAG の定義どおりに計算する(黒と白は 21:1、同色は 1:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#617177', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#617177'), 10);
  });

  it('基準未満の値を入れると検査が違反を返す', () => {
    expect(audit({ imageIncome: '#599ae9' }, 3).length).toBe(2);
    expect(audit({ decorative: '#d7e0e2' }, 3).length).toBe(2);
    expect(audit({ imageWarn: '#b97000' }, 4.5).length).toBe(2);
  });
});

describe('トークンのコントラスト (FR-004)', () => {
  it('役割リストは空でなく、装飾罫線は検査対象の役割に入っていない', () => {
    expect(CONTRAST_ROLES.text.length).toBeGreaterThan(0);
    expect(CONTRAST_ROLES.controlBorder.length).toBeGreaterThan(0);
    expect(CONTRAST_ROLES.chartSeries.length).toBeGreaterThan(0);
    expect(CONTRAST_ROLES.decorativeLine).toContain('line');
    const checked = [...CONTRAST_ROLES.text, ...CONTRAST_ROLES.controlBorder, ...CONTRAST_ROLES.chartSeries];
    for (const name of CONTRAST_ROLES.decorativeLine) expect(checked).not.toContain(name);
  });

  it('文字用トークンは背景と面の双方に 4.5:1 以上', () => {
    expect(audit(pick(CONTRAST_ROLES.text), 4.5)).toEqual([]);
  });

  it('部品の枠トークンは背景と面の双方に 3:1 以上', () => {
    expect(audit(pick(CONTRAST_ROLES.controlBorder), 3)).toEqual([]);
  });

  it('チャート系列色(追加パレットを含む)は背景と面の双方に 3:1 以上', () => {
    expect(audit(pick(CONTRAST_ROLES.chartSeries), 3)).toEqual([]);
    const extras = Object.fromEntries(VENDOR_EXTRA_COLORS.map((value, index) => [`extra${index}`, value]));
    expect(audit(extras, 3)).toEqual([]);
  });

  it('系列は収入=青系・支出=赤系・純収支=ティール (BR-004)', () => {
    expect(CONTRAST_ROLES.chartSeries).toEqual(expect.arrayContaining(['income', 'expense', 'accent']));
    expect(hue(COLOR.income)).toBeGreaterThanOrEqual(200);
    expect(hue(COLOR.income)).toBeLessThanOrEqual(240);
    const expenseHue = hue(COLOR.expense);
    expect(expenseHue >= 340 || expenseHue <= 15).toBe(true);
    expect(hue(COLOR.accent)).toBeGreaterThanOrEqual(165);
    expect(hue(COLOR.accent)).toBeLessThanOrEqual(185);
  });

  it('高コントラスト設定の事業色は通常時の事業色と同じ色相で、濃い文字は淡い面に 7:1 以上', () => {
    // 事業色を青からティールへ移したとき、上書き側だけ青のまま残ったことがある
    const bizHue = hue(COLOR.biz);
    for (const value of [HIGH_CONTRAST_COLOR.bizSoft, HIGH_CONTRAST_COLOR.bizStrong]) {
      expect(Math.abs(hue(value) - bizHue)).toBeLessThanOrEqual(10);
    }
    expect(contrastRatio(HIGH_CONTRAST_COLOR.bizStrong, HIGH_CONTRAST_COLOR.bizSoft)).toBeGreaterThanOrEqual(
      7,
    );
    expect(contrastRatio(COLOR.biz, HIGH_CONTRAST_COLOR.bizSoft)).toBeGreaterThanOrEqual(3);
  });
});

describe('部品の枠は装飾罫線を参照しない (BR-003)', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const controlSelector = /(^|[\s,>+~(])(input|textarea|select)\b|checkbox/;

  /** `selector { body }` の組を、@media の入れ子を無視して平らに取り出す */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').trim(),
    body: match[2] ?? '',
  }));

  it('入力欄・選択欄・チェックボックスの規則を1件以上見つけている', () => {
    expect(rules.filter((rule) => controlSelector.test(rule.selector)).length).toBeGreaterThan(0);
  });

  it('border 系の宣言に var(--line) を使っていない', () => {
    const offenders = rules
      .filter((rule) => controlSelector.test(rule.selector))
      .filter((rule) => /border[\w-]*\s*:[^;]*var\(--line\)/.test(rule.body))
      .map((rule) => rule.selector);
    expect(offenders).toEqual([]);
  });

  it('同じ規則で塗りと文字色をトークン指定した組は、すべて 4.5:1 以上', () => {
    // 淡い塗り(--biz-soft など)は文字用トークンの一覧に入らないので、実際の組み合わせを CSS から拾う。
    // --row-bg のような規則ローカルの変数は正本に無いので数えない
    const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    const token = (name: string) => COLOR[camel(name) as keyof typeof COLOR] as string | undefined;
    const pairs = rules.flatMap((rule) => {
      const ground = rule.body.match(/background(?:-color)?\s*:\s*var\(--([\w-]+)\)\s*;/)?.[1];
      const ink = rule.body.match(/(?:^|[;\s])color\s*:\s*var\(--([\w-]+)\)/)?.[1];
      const [fg, bg] = [ink && token(ink), ground && token(ground)];
      return fg && bg ? [{ selector: rule.selector, ink, ground, ratio: contrastRatio(fg, bg) }] : [];
    });
    expect(pairs.length).toBeGreaterThan(10);
    expect(pairs.filter((pair) => pair.ratio < 4.5)).toEqual([]);
  });

  it('入力欄の枠は --control-border、hover は --control-border-hover を使う', () => {
    const base = rules.find(
      (rule) => rule.selector.includes('input[type="text"]') && /border\s*:/.test(rule.body),
    );
    expect(base?.body).toMatch(/border\s*:[^;]*var\(--control-border\)/);
    const hover = rules.find((rule) => /input:hover/.test(rule.selector));
    expect(hover?.body).toMatch(/border-color\s*:\s*var\(--control-border-hover\)/);
  });

  it('共通Buttonの枠と操作領域は識別可能な意味トークンを使う', () => {
    const button = rules.find((rule) => rule.selector === '.btn');
    expect(button?.body).toMatch(/border-color\s*:\s*var\(--control-border\)/);
    expect(button?.body).toMatch(/min-height\s*:\s*var\(--tap-target-min\)/);
    const hover = rules.find((rule) => rule.selector === '.btn:hover:not(:disabled)');
    expect(hover?.body).toMatch(/border-color\s*:\s*var\(--control-border-hover\)/);
  });
});

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (raw * 60 + 360) % 360;
}
