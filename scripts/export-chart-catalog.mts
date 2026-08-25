/**
 * 図表カタログ(packages/api/src/ai/catalog.ts)を Skill の references/chart-catalog.json に書き出す。
 * 実行: pnpm catalog:export。同期の確認は packages/api/src/ai/catalog.test.ts。
 */
import { writeFileSync } from 'node:fs';
import { CATALOG_JSON_RELATIVE, catalogJson } from '../packages/api/src/ai/catalog-json.js';

const target = new URL(`../${CATALOG_JSON_RELATIVE}`, import.meta.url);
writeFileSync(target, catalogJson());
console.log(`wrote ${decodeURIComponent(target.pathname)}`);
