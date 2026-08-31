import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * ここに残すのは「実描画では観測できない CSS 契約」だけ。
 *
 * かつてこのファイルは
 *   - 6ファイルに 'FinancialFigure' という文字列が含まれること
 *   - styles.css が container-type / 固定高 / 44px / focus-visible / reduced-motion を書いていること
 * を課していたが、どちらもソース文字列への正規表現で、
 * import を残して呼び出しをやめても、セレクタを改名しても緑のままだった。
 *
 * 移設先:
 *   - FinancialFigure の実使用(6 surface 全部) → scripts/check-financial-visuals.mjs。
 *     Matrix / Statements / Overview / Trends / Subscriptions / Household / AI report の実ルートで
 *     [data-financial-figure] の件数と意味要素8種を実DOMで検査している。
 *   - container-type / 固定高 / 44px / focus-visible / reduced-motion / display:none でないこと
 *     → scripts/check-mobile-financial-layout.mjs。FinancialFigure.tsx を実描画して実測している。
 *
 * :active と env(safe-area-inset-bottom) だけは headless で観測できない
 * (押下中の計測が不安定、safe-area は headless では常に 0)ため、宣言の存在で固定する。
 */
describe('実描画では観測できない財務figureのCSS契約', () => {
  const css = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8');

  it('展開操作に押下中の手掛かりがある', () => {
    expect(css).toMatch(/\.financial-figure__details\s*>\s*summary:active/);
  });

  it('下部の余白がsafe-areaを見込む', () => {
    expect(css).toContain('env(safe-area-inset-bottom');
  });
});
