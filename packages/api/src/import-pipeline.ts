/**
 * FR-01 取込パイプライン: ファイル1個(ZIP/CSV/Excel/HTML互換JSON)を解析して
 * 「取込単位」の配列へ展開する。ZIPは自動展開して中身を再帰判定する。
 * 形式はヘッダーで自動判定: 「収支区分」→freee / 「計算対象」→MF。判定不能はエラー扱い。
 */
import {
  type FreeeDeal,
  type MfTx,
  decodeBuf,
  isFreeeHeader,
  isMfHeader,
  parseCSV,
  parseFreeeRows,
  parseMfRows,
} from '@kanjo/core';
import { unzipSync } from 'fflate';
import * as XLSX from 'xlsx';

export type ParsedUnit =
  | { kind: 'freee'; filename: string; deals: FreeeDeal[]; months: string[]; rows: number; skipped: number }
  | {
      kind: 'mf';
      filename: string;
      txs: MfTx[];
      months: string[];
      rows: number;
      skipped: number;
      syntheticIds: number;
      duplicateIds: number;
    }
  | { kind: 'json'; filename: string; json: Record<string, unknown> }
  | { kind: 'error'; filename: string; reason: string };

const ext = (name: string): string => name.toLowerCase().split('.').pop() ?? '';

const isZipMagic = (b: Uint8Array): boolean => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
const isXlsMagic = (b: Uint8Array): boolean => b.length > 3 && b[0] === 0xd0 && b[1] === 0xcf;

function rowsFromXlsx(buf: Uint8Array): string[][] {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  return rows.map((r) => r.map((c) => String(c ?? '')));
}

function classifyRows(filename: string, rows: string[][], normMap: Record<string, string>): ParsedUnit {
  if (!rows.length) return { kind: 'error', filename, reason: '空のファイルです' };
  if (isFreeeHeader(rows[0])) {
    const p = parseFreeeRows(rows, normMap);
    return { kind: 'freee', filename, deals: p.deals, months: p.months, rows: p.rows, skipped: p.skipped };
  }
  if (isMfHeader(rows[0])) {
    const p = parseMfRows(rows);
    return {
      kind: 'mf',
      filename,
      txs: p.txs,
      months: p.months,
      rows: p.rows,
      skipped: p.skipped,
      syntheticIds: p.syntheticIds,
      duplicateIds: p.duplicateIds,
    };
  }
  const head = rows[0].slice(0, 8).join(', ');
  return {
    kind: 'error',
    filename,
    reason: `形式を判定できません(「収支区分」「計算対象」列が見つかりません)。ヘッダー: ${head}`,
  };
}

function parseJsonUnit(filename: string, text: string): ParsedUnit {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    if (obj && typeof obj === 'object' && ('mfTx' in obj || 'months' in obj || 'biz' in obj)) {
      return { kind: 'json', filename, json: obj };
    }
    return { kind: 'error', filename, reason: 'HTML版互換JSONではありません(months/biz/mfTxがありません)' };
  } catch {
    return { kind: 'error', filename, reason: 'JSONとして読み取れません' };
  }
}

/** 1ファイルを取込単位の配列へ展開する(ZIPは再帰展開) */
export function parseUpload(
  filename: string,
  buf: Uint8Array,
  normMap: Record<string, string>,
  depth = 0,
): ParsedUnit[] {
  const e = ext(filename);
  if (depth > 2) return [{ kind: 'error', filename, reason: 'ZIPの入れ子が深すぎます' }];

  if (e === 'zip' || (isZipMagic(buf) && e !== 'xlsx' && e !== 'xls')) {
    // xlsxもPK圧縮のため、拡張子zip以外のPKは中身で判別する
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(buf);
    } catch {
      return [{ kind: 'error', filename, reason: 'ZIPを展開できません' }];
    }
    if (entries['[Content_Types].xml']) {
      return [classifyRows(filename, rowsFromXlsx(buf), normMap)];
    }
    const units: ParsedUnit[] = [];
    for (const [name, data] of Object.entries(entries)) {
      const base = name.split('/').pop() ?? name;
      if (!base || base.startsWith('.') || name.endsWith('/') || name.includes('__MACOSX')) continue;
      units.push(...parseUpload(`${filename}/${base}`, data, normMap, depth + 1));
    }
    return units.length ? units : [{ kind: 'error', filename, reason: 'ZIPに取込対象がありません' }];
  }

  if (e === 'xlsx' || e === 'xls' || isXlsMagic(buf)) {
    try {
      return [classifyRows(filename, rowsFromXlsx(buf), normMap)];
    } catch {
      return [{ kind: 'error', filename, reason: 'Excelファイルを読み取れません' }];
    }
  }

  if (e === 'json') {
    return [parseJsonUnit(filename, decodeBuf(buf))];
  }

  // 既定: CSVとしてデコード(UTF-8 fatal → Shift-JIS)
  const text = decodeBuf(buf);
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return [parseJsonUnit(filename, text)];
  return [classifyRows(filename, parseCSV(text), normMap)];
}
