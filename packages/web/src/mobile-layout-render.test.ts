import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runRenderScript } from './render-script-test-helper';

// スマホ幅のカード化を、本物の styles.css を headless Chrome に描画させて実測する。
// jsdom はレイアウトを計算しないため、classify-mobile-cards.dom.test.tsx は
// 「stack-sm と data-label が付いていること」までしか保証できない。
// 実際に `.classify-table { min-width: 1160px }` が残っていてページ全体が横スクロールする、
// といった崩れはこちらでしか捕まらない。
// URL.pathname は日本語などを含むパスをパーセントエンコードしたまま返すため fileURLToPath を使う
const SCRIPT = fileURLToPath(new URL('../scripts/check-mobile-layout.mjs', import.meta.url));
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));
const hasChrome = CHROME_CANDIDATES.some((p) => existsSync(p));

describe('スマホ幅のカード化(実描画)', () => {
  if (!hasChrome && process.env.CI) {
    it('CI では Chrome が必須', () => {
      throw new Error('CI 環境に Chrome が見つかりません。CHROME_PATH を設定してください。');
    });
    return;
  }
  const run = hasChrome ? it : it.skip;
  run(
    'スマホ幅でページ本体が横スクロールせず、仕分け表が1行=1カードに畳まれ、操作のタップ領域が44px以上ある',
    async () => {
      const output = await runRenderScript(SCRIPT);
      expect(output).toContain('すべて合格');
    },
    120_000,
  );
});
