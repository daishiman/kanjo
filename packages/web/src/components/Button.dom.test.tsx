// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button.js';

afterEach(cleanup);

describe('共通ボタン (FR-003: 主/副/危険/テキスト)', () => {
  it.each([
    ['primary', 'btn primary'],
    ['secondary', 'btn'],
    ['danger', 'btn danger-btn'],
    ['text', 'btn linklike'],
  ] as const)('%s は styles.css の既存クラス「%s」を付ける', (variant, expected) => {
    render(<Button variant={variant}>保存</Button>);
    expect(screen.getByRole('button', { name: '保存' }).className).toBe(expected);
  });

  it('既定は副ボタンで type="button"(フォーム内で意図せず送信しない)', () => {
    render(<Button>閉じる</Button>);
    const button = screen.getByRole('button', { name: '閉じる' });
    expect(button.className).toBe('btn');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-component')).toBe('Button');
  });

  it('size と className は後ろに足し、type と ref は呼び出し側の指定を通す', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} variant="primary" size="mini" className="wide" type="submit">
        送信
      </Button>,
    );
    const button = screen.getByRole('button', { name: '送信' });
    expect(button.className).toBe('btn primary mini wide');
    expect(button.getAttribute('type')).toBe('submit');
    expect(ref.current).toBe(button);
  });

  it('text variant は基本ボタンより後の実効規則で透明面・枠なし・下線に戻す', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const baseRuleAt = css.indexOf('button,\n.btn {');
    const textRuleAt = css.indexOf('.btn.linklike {');
    const textRule = css.slice(textRuleAt, css.indexOf('}', textRuleAt) + 1);

    expect(baseRuleAt).toBeGreaterThan(-1);
    expect(textRuleAt).toBeGreaterThan(baseRuleAt);
    expect(textRule).toMatch(/background:\s*(?:none|transparent);/);
    expect(textRule).toMatch(/border:\s*0;/);
    expect(textRule).toMatch(/text-decoration:\s*underline;/);
  });

  it('標準・mini・textのどの variant も共通の操作領域契約を打ち消さない', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const miniRuleAt = css.indexOf('\nbutton.mini {') + 1;
    const miniRule = css.slice(miniRuleAt, css.indexOf('}', miniRuleAt) + 1);

    expect(miniRule).not.toMatch(/min-(?:height|block-size):/);
    expect(css).not.toMatch(/\.btn\.mini\s*{[^}]*min-height:/s);
    expect(css).not.toMatch(/\.btn\.linklike\s*{[^}]*min-height:\s*(?!var\(--tap-target-min\))/s);
  });

  it('実在する操作要素taxonomyの hit area を共通契約と44px以上に保つ', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const contractSelector = ':where(a[href], button, input:not([type="hidden"]), textarea, select, summary)';
    const contractAt = css.indexOf(contractSelector);
    const contractRule = css.slice(contractAt, css.indexOf('}', contractAt) + 1);

    expect(contractAt).toBeGreaterThan(-1);
    expect(contractRule).toContain('min-height: var(--tap-target-min);');
    expect(contractRule).toContain('min-width: var(--tap-target-min);');
    expect(css).toMatch(/a\[href\]\s*{[^}]*display:\s*inline-flex;/s);

    const interactive = /(^|[\s,>+~])(?:button|a|input|textarea|select|summary)\b|\.btn\b/;
    const offenders = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((match) => {
      const selector = (match[1] ?? '').trim();
      if (!interactive.test(selector)) return [];
      const declarations = match[2] ?? '';
      const explicitHeights = [...declarations.matchAll(/min-(?:block-size|height):\s*([^;]+)/g)];
      return explicitHeights.flatMap((height) => {
        const value = height[1]?.trim() ?? '';
        const pixels = value.match(/^(\d+)px$/)?.[1];
        const preservesContract = value === 'var(--tap-target-min)' || (pixels && Number(pixels) >= 44);
        return preservesContract ? [] : [`${selector}: ${value}`];
      });
    });

    expect(offenders).toEqual([]);
  });
});
