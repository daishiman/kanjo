import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runRenderScript } from './render-script-test-helper';

// 表見出しの固定(sticky)を、本物の styles.css を headless Chrome に描画させて実測する。
// CSS 文字列の正規表現検査では「押し出されて先頭行を隠す」不具合を捕まえられなかったため、実描画で判定する。
// URL.pathname は日本語などを含むパスをパーセントエンコードしたまま返すため fileURLToPath を使う
const SCRIPT = fileURLToPath(new URL('../scripts/check-thead-render.mjs', import.meta.url));
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));
const hasChrome = CHROME_CANDIDATES.some((p) => existsSync(p));

describe('表見出しの固定(実描画)', () => {
  if (!hasChrome && process.env.CI) {
    it('CI では Chrome が必須', () => {
      throw new Error('CI 環境に Chrome が見つかりません。CHROME_PATH を設定してください。');
    });
    return;
  }
  const run = hasChrome ? it : it.skip;
  run(
    '全ての置き方・全ての幅で、見出し行が先頭行を隠さず、読み進めると固定ヘッダー直下に固定される',
    async () => {
      const output = await runRenderScript(SCRIPT);
      expect(output).toContain('すべて合格');
    },
    120_000,
  );
});
