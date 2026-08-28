import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeBuf, isMfHeader, parseCSV, parseMfRows } from '../src/index.js';

/**
 * 実データ回帰(FR-01)。
 *
 * 取込は「サンプルでは通るが本物のエクスポートで落ちる」が起きる。
 * マネーフォワードが列を増やす・文字コードを変える・ID列をやめる、
 * どれが起きても静かに件数が減るだけで、画面には何も出ない。
 *
 * 実データはこのリポジトリに置けない(public・.gitignore の絶対条件)ので、
 * 手元のCSVを環境変数で指したときだけ走らせる:
 *
 *   KANJO_REAL_MF_CSV=~/Downloads/収入・支出詳細_2026-08-01_2026-08-31.csv \
 *     pnpm --filter @kanjo/core test real-data
 *
 * 落ちたら「本物の書式が変わった」の合図。期待値は件数ではなく
 * 「取込が壊れていないと言える条件」だけを見る(実データの中身に依存させない)。
 */

const path = process.env.KANJO_REAL_MF_CSV;

describe.skipIf(!path)('実データ(MF収入・支出詳細)の取込', () => {
  const rows = (): string[][] => parseCSV(decodeBuf(readFileSync(path as string)));

  it('ヘッダーをMF形式として認識できる', () => {
    expect(isMfHeader(rows()[0])).toBe(true);
  });

  it('パーサが知っている列が実データに全部ある', () => {
    const header = rows()[0].join(',');
    for (const col of [
      '計算対象',
      '日付',
      '内容',
      '金額',
      '保有金融機関',
      '大項目',
      '中項目',
      '振替',
      'ID',
    ]) {
      expect(header, `列「${col}」が消えている`).toContain(col);
    }
  });

  it('1件以上取り込め、全件が捨てられていない', () => {
    const r = parseMfRows(rows());
    expect(r.rows).toBeGreaterThan(0);
    // 振替と計算対象外は正しく捨てるので skipped>0 はありうるが、
    // 「取れた件数より捨てた件数が多い」は書式が変わった疑いが濃い
    expect(r.skipped).toBeLessThan(r.rows);
  });

  it('ID列が生きている(合成キーへの退避が起きていない)', () => {
    const r = parseMfRows(rows());
    // 合成キーは再取込のたびに別IDになり、手修正が全部消える
    expect(r.syntheticIds).toBe(0);
    expect(r.duplicateIds).toBe(0);
    expect(r.reservedIds).toBe(0);
  });

  it('月・日付・口座が全件で埋まっている', () => {
    const r = parseMfRows(rows());
    for (const t of r.txs) {
      expect(t.m).toMatch(/^\d{4}-\d{2}$/);
      expect(t.d).toMatch(/^\d{2}\/\d{2}$/);
      expect(t.inst, `口座が空の明細がある: ${t.id}`).toBeTruthy();
    }
  });

  it('パーサが取りこぼしている列を報告する(将来の取込項目の候補)', () => {
    const known = ['計算対象', '日付', '内容', '金額', '保有金融機関', '大項目', '中項目', '振替', 'ID'];
    const unused = rows()[0].filter((h) => !known.some((k) => h.includes(k)));
    // 未取込列があること自体は失敗にしない。DB列の追加が要るため段階を分ける。
    // ここでは「気づかないまま増える」ことだけを防ぐ。
    expect(unused, `未取込の列: ${unused.join(', ')}`).toEqual(['メモ']);
  });
});
