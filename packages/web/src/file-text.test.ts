// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { readFileText } from './file-text.js';

// jsdomのFileはBlob.text()を実装していない一方、Node由来のFileは実装している。
// 実装がfile.text()に依存していると、どちらのFileが渡るかで静かに壊れる。
// 読み取り経路がどちらのFileでも成立することを、この2件で固定する。
describe('readFileText', () => {
  const body = JSON.stringify({ attachmentArchive: { version: 1 } });

  it('jsdom由来のFileを読める', async () => {
    const file = new window.File([body], 'archive.json', { type: 'application/json' });
    expect(await readFileText(file)).toBe(body);
  });

  it('グローバルのFileを読める', async () => {
    const file = new File([body], 'archive.json', { type: 'application/json' });
    expect(await readFileText(file)).toBe(body);
  });

  it('空ファイルは空文字を返す', async () => {
    const file = new window.File([], 'empty.json', { type: 'application/json' });
    expect(await readFileText(file)).toBe('');
  });
});
