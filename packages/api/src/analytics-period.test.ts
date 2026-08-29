import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 期間の絞り込みが全ての分析ルートに効いていることの契約。
 *
 * 集計に Dataset を使うルートが1つでも loadDataset を直接呼んでいると、
 * 「期間を絞ったのにこの画面だけ全期間のまま」になる。画面を見ても気づけない不整合なので、
 * ここで「Dataset を読むのは loadScoped 経由だけ」を機械的に固定する。
 */

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(here, 'routes/analytics.ts'), 'utf8');
const TAX_SOURCE = readFileSync(resolve(here, 'routes/tax.ts'), 'utf8');

describe('分析ルートの期間対応', () => {
  it('Dataset の読み込みは loadScoped の中の1箇所だけ', () => {
    expect(SOURCE.match(/loadDataset\(/g)).toHaveLength(1);
    expect(SOURCE).toMatch(/async function loadScoped\([\s\S]*?loadDataset\(/);
  });

  it('Dataset を使うルートは全て loadScoped から受け取る', () => {
    // ルート本体で分割代入している data が、loadScoped の戻り値以外から来ていないこと
    const routes = [...SOURCE.matchAll(/analyticsRoute\.get\('([^']+)'[\s\S]*?\n\}\);/g)];
    expect(routes.length).toBeGreaterThan(5);
    for (const [body, path] of routes) {
      if (!/\bdata\b/.test(body)) continue; // Dataset を使わないルート(/unsettled, /export/json)
      expect(body, `${path} が loadScoped を経由していない`).toContain('await loadScoped(c)');
    }
  });

  it('4種類の期間指定をすべて受ける', () => {
    for (const q of ['from', 'to', 'year', 'span']) {
      expect(SOURCE).toContain(`c.req.query('${q}')`);
    }
  });

  it('選択肢は絞り込み前のデータから作る', () => {
    // 絞り込み後から作ると、2025年を選んだ瞬間に2026年が選択肢から消えて戻れなくなる
    expect(SOURCE).toMatch(/years:\s*availableYears\(all\)/);
    expect(SOURCE).toMatch(/full:\s*fullRange\(all\)/);
  });

  it('壊れた期間指定でも 400 にしない', () => {
    // 古いブックマークや保存値で画面が出なくなるのを避け、全期間に倒す
    expect(SOURCE).not.toMatch(/resolvePeriodQuery[\s\S]{0,200}?\b400\b/);
  });
});

describe('確定申告ルートの期間対応', () => {
  it('Dataset を loadScoped 経由でしか読まない', () => {
    // 転記シートだけ全期間のまま出ると、選んだ年と違う金額を申告することになる
    expect(TAX_SOURCE).not.toMatch(/loadDataset\(/);
    expect(TAX_SOURCE).toContain("from './analytics.js'");
  });

  it('申告計算はexact-year境界を通し、共通bundleだけがloadScopedへ接続する', () => {
    expect(TAX_SOURCE.match(/await loadScoped\(c\)/g)).toHaveLength(1);
    expect(TAX_SOURCE).toMatch(/async function loadTaxYearScoped[\s\S]*?await loadScoped\(c\)/);
    expect(TAX_SOURCE).toMatch(/async function buildTaxYearBundle[\s\S]*?loadTaxYearScoped/);

    const dataRoutes = [...TAX_SOURCE.matchAll(/taxRoute\.(get|put)\('([^']+)'[\s\S]*?\n\}\);/g)].filter(
      ([body]) => /buildTaxYearBundle/.test(body),
    );
    expect(dataRoutes.length).toBeGreaterThanOrEqual(4);
    for (const [body, , path] of dataRoutes) {
      expect(body, `${path} が対象年をfail-closedにしていない`).toContain('taxYearRequest(c)');
    }
  });
});
