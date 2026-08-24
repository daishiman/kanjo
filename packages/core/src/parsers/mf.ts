/**
 * マネーフォワード「収入・支出詳細」の行→明細変換。HTML版 importMF を忠実に移植。
 * ヘッダー判定: 「計算対象」列を含む（部分一致）。
 */
import { normMonth, parseAmount } from '../normalize.js';
import type { MfTx } from '../types.js';

export interface MfParseResult {
  txs: MfTx[];
  months: string[];
  rows: number;
  skipped: number;
  /** ID列欠落などで合成キーを使った件数（リスク検知用） */
  syntheticIds: number;
  /** ファイル内でIDが重複した件数（後勝ちで上書きされる） */
  duplicateIds: number;
}

export function isMfHeader(header: string[]): boolean {
  return header.join(',').includes('計算対象');
}

/** 有効明細 = 計算対象=1 かつ 振替≠1 のみ。id無し行は `${month}_${行index}_${金額}` の合成キー */
export function parseMfRows(rows: string[][]): MfParseResult {
  const H = rows[0] ?? [];
  const col = (n: string) => H.findIndex((h) => h.includes(n));
  const ci = {
    tgt: col('計算対象'),
    dt: col('日付'),
    amt: col('金額'),
    big: col('大項目'),
    mid: col('中項目'),
    tf: col('振替'),
    c: col('内容'),
    id: col('ID'),
  };
  const txs: MfTx[] = [];
  let skipped = 0;
  let syntheticIds = 0;
  const seen = new Set<string>();
  let duplicateIds = 0;
  rows.slice(1).forEach((r, ri) => {
    if (r[ci.tgt] !== '1' || r[ci.tf] === '1') {
      skipped++;
      return;
    }
    const m = normMonth(r[ci.dt] ?? '');
    if (!m) {
      skipped++;
      return;
    }
    const amt = parseAmount(r[ci.amt]);
    let id: string;
    if (ci.id >= 0 && r[ci.id]) {
      id = r[ci.id];
    } else {
      id = `${m}_${ri}_${amt}`;
      syntheticIds++;
    }
    if (seen.has(id)) duplicateIds++;
    seen.add(id);
    txs.push({
      id,
      m,
      d: String(r[ci.dt]).slice(5),
      c: ci.c >= 0 ? String(r[ci.c]).slice(0, 40) : '',
      a: amt,
      big: r[ci.big] || '',
      mid: r[ci.mid] || '',
    });
  });
  const months = [...new Set(txs.map((t) => t.m))].sort();
  return { txs, months, rows: txs.length, skipped, syntheticIds, duplicateIds };
}
