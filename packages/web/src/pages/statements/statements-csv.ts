/**
 * 損益計算書 (PL) の CSV 書き出し (spec-statements-screen §5)。
 *
 * - 文字列セルが `= + - @`・タブ・NUL で始まるときは先頭に `'` を付ける
 *   (表計算ソフトが数式として実行するのを防ぐ。OWASP ASVS 5.0 1.2.10)。
 * - `,` `"` 改行を含むセルは二重引用符で囲み、`"` を `""` にする (RFC 4180 2.6/2.7)。
 * - 金額は数値として書き、`'` を付けない (負の差額 `-200000` を文字列にしない)。
 * 科目名は利用者データ由来なので、必ずこの関数を通して書き出す。
 */
import type { StatementsScreen } from '@kanjo/core';

export type CsvCell = string | number | null;

const FORMULA_PREFIX = /^[=+\-@\t\0]/;

export function csvCell(value: CsvCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const guarded = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function csvText(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  // RFC 4180 の行区切りは CRLF
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** PL 5 行と、各区分の内訳科目を 1 表にする。構成比は小数 (0.63) ではなく % の数値 (63.0) */
export function statementsPlCsvRows(screen: StatementsScreen): CsvCell[][] {
  const current = `当期 (${screen.period.label})`;
  const previous = `前期 (${screen.period.previous?.label ?? '—'})`;
  const rows: CsvCell[][] = [['区分', '勘定科目', current, previous, '差額', '構成比(%)']];
  for (const row of screen.pl.rows) {
    rows.push([
      row.label,
      '',
      row.current,
      row.previous,
      row.diff,
      row.ratio === null ? null : Math.round(row.ratio * 1000) / 10,
    ]);
    if (row.key === 'gross' || row.key === 'operating') continue;
    for (const account of row.accounts) {
      rows.push([
        row.label,
        account.account,
        account.current,
        account.previous,
        account.previous === null ? null : account.current - account.previous,
        null,
      ]);
    }
  }
  return rows;
}

/**
 * ブラウザで保存させる。BOM を付けるのは Excel が UTF-8 と判定できるようにするため。
 * URL.createObjectURL が無い環境 (テスト等) では何もしない。
 */
export function downloadCsv(fileName: string, text: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
