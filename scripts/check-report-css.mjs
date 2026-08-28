#!/usr/bin/env node
/**
 * レポートCSSの写しがズレていないかの検査。
 *
 * 正本: skills/report-design-system/assets/report.css
 * 写し: packages/core/src/report-css.ts の REPORT_CSS
 *
 * 単一HTMLで配る都合上CSSをTSへ写さざるを得ないが、写しは必ずズレる。
 * 「デザインシステムを更新したのにレポートだけ古い」を lint で落とす。
 *   node scripts/check-report-css.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const source = readFileSync(join(root, 'skills/report-design-system/assets/report.css'), 'utf8');
const ts = readFileSync(join(root, 'packages/core/src/report-css.ts'), 'utf8');

const m = ts.match(/export const REPORT_CSS = `([\s\S]*)`;\n$/);
if (!m) {
  console.error('report-css.ts から REPORT_CSS を取り出せない。手で構造を変えていないか確認する');
  process.exit(1);
}
if (m[1] !== source) {
  console.error(
    '差分: packages/core/src/report-css.ts が skills/report-design-system/assets/report.css と一致しない',
  );
  console.error('正本を直したうえで、写しを作り直すこと(手編集しない)');
  process.exit(1);
}
console.log('レポートCSS: 正本と一致');
