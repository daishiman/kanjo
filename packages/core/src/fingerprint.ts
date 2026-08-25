/**
 * 取込単位の「内容指紋」を作るための正規化文字列。
 * ファイル名・拡張子(CSV/Excel)・行の並び順・前後の空白の違いに依らず、明細の内容が同じなら同じ文字列になる。
 * 逆に金額・日付・行数が1つでも違えば別の文字列になる。ハッシュ化(SHA-256)は呼び出し側で行う。
 */
import type { FreeeDeal, MfTx } from './types.js';

/** 列の区切り(値に現れない制御文字) */
const SEP = '';
const cell = (v: unknown): string => String(v ?? '').trim();

/** freee 仕訳の正規化文字列。行順に依存しないよう並べ替える */
export function canonicalFreee(deals: FreeeDeal[]): string {
  const rows = deals.map((d) =>
    [d.month, d.date, d.io, d.partner, d.accountRaw, d.amount].map(cell).join(SEP),
  );
  rows.sort();
  return `freee\n${rows.join('\n')}`;
}

/** MF 明細の正規化文字列。行順に依存しないよう並べ替える */
export function canonicalMf(txs: MfTx[]): string {
  const rows = txs.map((t) => [t.id, t.m, t.d, t.c, t.a, t.big, t.mid, t.inst].map(cell).join(SEP));
  rows.sort();
  return `mf\n${rows.join('\n')}`;
}
