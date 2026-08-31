import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const APP = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const TAX_PAGE = readFileSync(new URL('./pages/TaxReturn.tsx', import.meta.url), 'utf8');
const STYLE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const PACKAGE = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

describe('確定申告cold-loadの性能・操作領域契約', () => {
  it('TaxReturnだけをeagerにし、main→route chunkの直列requestを増やさない', () => {
    expect(APP).toContain("import { TaxReturnPage } from './pages/TaxReturn.js';");
    expect(APP).toMatch(/tax:\s*TaxReturnPage,/);
    expect(APP).not.toContain("import('./pages/TaxReturn.js')");
    expect(APP).toContain("import('./pages/TaxReceipts.js')");
  });

  // 予算は「mergeを止める」ためだけにあり、「本番配信を止める」ためには無い。
  // 文字列の存在だけを見ると、buildから検査が外れてもbuild:artifact側に残っていれば
  // 緑のままになる。どちらのscriptが呼ぶかまで固定する。
  it('初期JS予算をPRゲートのbuildで強制し、本番配信のbuild:artifactでは強制しない', () => {
    const scripts = JSON.parse(PACKAGE).scripts as Record<string, string>;
    expect(scripts['check:js-budget']).toContain('check-initial-js-budget.mjs');
    expect(scripts.build).toContain('check:js-budget');
    expect(scripts['build:artifact']).not.toContain('check:js-budget');
    // 検査の有無にかかわらず、内部manifestは配信物から必ず除く
    expect(scripts.build).toContain('strip:manifest');
    expect(scripts['build:artifact']).toContain('strip:manifest');
  });

  it('対象年・科目・保存・空状態・exportの主要操作を44px以上へ揃える', () => {
    expect(TAX_PAGE).toContain('tax-empty-action');
    expect(TAX_PAGE).toContain('tax-save-action');
    expect(TAX_PAGE).toContain('tax-export-actions');
    expect(STYLE).toMatch(
      /\.tax-year-picker select,[\s\S]*?\.tax-export-actions \.btn\s*\{\s*min-height:\s*44px;/,
    );
  });

  it('200%相当でもmobile navのラベルを分断せず、nav内だけを横スクロール可能にする', () => {
    expect(STYLE).toMatch(/\.tabbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow-x:\s*auto;/);
    expect(STYLE).toMatch(
      /\.tabbar \.tab\s*\{[\s\S]*?min-height:\s*var\(--tabbar-h\);[\s\S]*?min-width:\s*64px;[\s\S]*?white-space:\s*nowrap;/,
    );
  });

  it('狭幅の書き出しをviewport内のaction sheetにし、トリガーと項目を44px以上にする', () => {
    expect(STYLE).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*?\.header \.popover-host > button\s*\{\s*min-height:\s*44px;/,
    );
    expect(STYLE).toMatch(
      /\.header \.popover\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset-inline:\s*8px;[\s\S]*?top:\s*calc\(var\(--header-h\) \+ 4px\);[\s\S]*?width:\s*auto;[\s\S]*?max-height:[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(STYLE).toMatch(
      /\.header \.popover \.btn\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?white-space:\s*nowrap;/,
    );
  });
});
