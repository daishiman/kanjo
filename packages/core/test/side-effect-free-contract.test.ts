/**
 * `package.json` の `"sideEffects": false` を実態と一致させ続けるための規約テスト。
 *
 * この宣言はバンドラへの約束である。「core のモジュールは読み込むだけでは何も起きない」
 * と言い切ることで、web は `@kanjo/core` のバレル経由で 1 つ値を import しても、
 * 使っていないモジュールを初期チャンクへ道連れにせずに済む。
 *
 * 宣言を入れる前、web の初期 JS には誰も呼んでいない `tax-accounts` と
 * `household-categories` が約 9KB 分載っていた (初期 JS budget 109.6KiB → 103.0KiB)。
 * 逆に言えば、core のどれか 1 ファイルが読み込み時に副作用を持った瞬間、
 * この宣言は嘘になり、バンドラはそれを落としたまま動く壊れ方をする。
 * 型検査にもテストにも映らない壊れ方なので、宣言そのものを検査する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// URL の pathname はパーセントエンコードされる。日本語を含む作業ディレクトリでも
// 実在するパスを得るため fileURLToPath を通す。
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** 検査対象は src 直下の実装ファイル。テストと型定義は成果物に入らないので除く。 */
function sourceFiles(): string[] {
  return readdirSync(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
    .sort();
}

/**
 * 読み込んだだけで走るコードを、トップレベルの「文」として検出する。
 *
 * TypeScript のパーサーは使えない (core は依存ゼロが前提)。代わりに biome が
 * 保証しているインデントを借りる — トップレベルの文は必ず列 0 から始まる。
 * 括弧の対応でネストを数える方法も試したが、正規表現リテラル (`/[(]/` など) が
 * 数を狂わせるため採らなかった。
 *
 * 通すもの: `export const TAX_ACCOUNTS = [...]` のような純粋なデータ定義、
 * `export const f = () => g()` のように呼び出しが関数の中にあるもの。
 * 落とすもの: `console.log(...)` や `table.set(...)` のように、読み込みの瞬間に
 * 走る文。グローバルへの代入も宣言で始まらないのでここに含まれる。
 */
function moduleSideEffects(source: string): string[] {
  const reasons: string[] = [];
  // 複数行の import/export や配列リテラルの閉じは列 0 に来る。文の始まりではない。
  const CONTINUATION = /^[}\])\,;.:?|&+\-*/=<>`]/;
  const DECLARATION =
    /^(import|export|const|let|var|function|async|class|abstract|type|interface|enum|declare)\b/;

  let inBlockComment = false;
  let inTemplate = false;

  source.split('\n').forEach((raw, index) => {
    const lineNo = index + 1;
    let rest = raw;

    // コメント・テンプレートリテラルの内側は、列 0 から始まっていてもコードではない。
    if (inBlockComment) {
      const end = rest.indexOf('*/');
      if (end === -1) return;
      inBlockComment = false;
      rest = rest.slice(end + 2);
    }
    if (inTemplate) {
      const end = rest.indexOf('`');
      if (end === -1) return;
      inTemplate = false;
      rest = rest.slice(end + 1);
    }

    const code = rest.split('//')[0] ?? '';
    const opened = code.lastIndexOf('/*');
    if (opened !== -1 && code.indexOf('*/', opened) === -1) inBlockComment = true;
    if ((code.match(/`/g)?.length ?? 0) % 2 === 1) inTemplate = true;

    const text = rest.trim();
    if (!text || rest !== raw) return; // 空行と、コメント/テンプレートの続きだった行
    if (/^\s/.test(raw)) return; // インデントされている = トップレベルではない
    if (text.startsWith('//') || text.startsWith('/*') || text.startsWith('*')) return;
    if (CONTINUATION.test(text)) return;
    if (DECLARATION.test(text)) return;

    reasons.push(`${lineNo}行目が読み込み時に走る文である (宣言ではない): ${text}`);
  });

  return reasons;
}

describe('core は読み込みだけでは何も起こさない (sideEffects: false)', () => {
  it('検査が空振りしていない', () => {
    // 「違反 0 件」と「0 件しか調べていない」を区別する。
    // core は 40 ファイル以上ある。極端に少ないなら glob か除外条件が壊れている。
    expect(sourceFiles().length).toBeGreaterThan(30);
  });

  it('副作用のあるコードを実際に検出できる', () => {
    // 検査そのものの検算。これが落ちるなら moduleSideEffects が何も見ていない。
    const guilty = [
      "import { x } from './a.js';\nconsole.log('読み込んだだけで出る');\nexport const y = 1;\n",
      "export const table = new Map();\ntable.set('読み込み時に書き換わる', 1);\n",
    ];
    for (const source of guilty) {
      expect(moduleSideEffects(source).length).toBeGreaterThan(0);
    }
  });

  it('全モジュールが副作用を持たない', () => {
    const violations: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(join(SRC, file), 'utf8');
      for (const reason of moduleSideEffects(source)) {
        violations.push(`${file}: ${reason}`);
      }
    }
    expect(violations, 'package.json の "sideEffects": false と矛盾するモジュール').toEqual([]);
  });
});
