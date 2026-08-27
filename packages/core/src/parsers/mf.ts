/**
 * マネーフォワード「収入・支出詳細」の行→明細変換。HTML版 importMF を忠実に移植。
 * ヘッダー判定: 「計算対象」列を含む（部分一致）。
 */
import { normMonth, parseAmount } from '../normalize.js';
import { normalizeMfDisplayDate } from '../persisted-projection.js';
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
  /** 現金記帳の予約名前空間 `cash:` と衝突した取込ID件数 */
  reservedIds: number;
}

export function isMfHeader(header: string[]): boolean {
  return header.join(',').includes('計算対象');
}

/**
 * CSVの全明細行を保存対象として返す。計算対象=0 / 振替=1 の行も落とさず、
 * isTarget / isTransfer に原本の値を持たせて集計側で絞る。
 * skipped は日付を解釈できなかった行だけ（保存できないため）。
 * id無し行は `${month}_${行index}_${金額}` の合成キー。
 */
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
    inst: col('保有金融機関'),
    memo: col('メモ'),
  };
  const txs: MfTx[] = [];
  let skipped = 0;
  let syntheticIds = 0;
  const seen = new Set<string>();
  let duplicateIds = 0;
  let reservedIds = 0;
  rows.slice(1).forEach((r, ri) => {
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
    if (id.startsWith('cash:')) reservedIds++;
    seen.add(id);
    // 「計算対象」列が無いCSVは全行を対象とみなす（列があるときだけ 0 を非対象と読む）
    const isTarget = ci.tgt >= 0 ? r[ci.tgt] === '1' : true;
    const isTransfer = ci.tf >= 0 && r[ci.tf] === '1';
    txs.push({
      id,
      idStable: ci.id >= 0 && !!r[ci.id],
      m,
      d: normalizeMfDisplayDate(String(r[ci.dt]), m),
      c: ci.c >= 0 ? String(r[ci.c]) : '',
      a: amt,
      big: r[ci.big] || '',
      mid: r[ci.mid] || '',
      inst: ci.inst >= 0 ? String(r[ci.inst] ?? '').trim() || undefined : undefined,
      // メモは照合・監査用の原文。列なしだけundefined、列があれば空文字・空白も含めセル値を保持する。
      memo: ci.memo >= 0 ? String(r[ci.memo] ?? '') : undefined,
      isTarget,
      isTransfer,
    });
  });
  const months = [...new Set(txs.map((t) => t.m))].sort();
  return { txs, months, rows: txs.length, skipped, syntheticIds, duplicateIds, reservedIds };
}
