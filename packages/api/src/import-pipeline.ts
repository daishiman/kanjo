/**
 * FR-01 取込パイプライン: ファイル1個(ZIP/CSV/Excel/HTML互換JSON)を解析して
 * 「取込単位」の配列へ展開する。ZIPは自動展開して中身を再帰判定する。
 * 形式はヘッダーで自動判定: 「収支区分」→freee / 「計算対象」→MF /
 * 「日付」+「合計（円）」→MFの資産推移(残高)。判定不能はエラー扱い。
 */
import {
  type BalanceRow,
  FINGERPRINT_VERSION,
  type FreeeDeal,
  type MfTx,
  canonicalFreee,
  canonicalMf,
  canonicalMfTransactions,
  decodeBuf,
  isFreeeHeader,
  isMfAssetHistoryHeader,
  isMfCountable,
  isMfHeader,
  parseCSV,
  parseFreeeRows,
  parseMfAssetHistoryRows,
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
  /**
   * MFの資産推移CSV。明細ではなく「ある時点の残高」なので、収支には1円も入らない。
   * 入る先は balance_entries だけで、月次集計は書き換えない。
   */
  | {
      kind: 'assets';
      filename: string;
      balances: BalanceRow[];
      months: string[];
      rows: number;
      skipped: number;
      /** 日次の行を月1点へ丸めたときに落ちた行数 */
      collapsed: number;
      categories: string[];
      /** 内訳の和がCSVの「合計」列と合わなかった月 */
      totalMismatchMonths: string[];
    }
  | { kind: 'json'; filename: string; json: Record<string, unknown> }
  | { kind: 'error'; filename: string; reason: string };

const ext = (name: string): string => name.toLowerCase().split('.').pop() ?? '';

const isZipMagic = (b: Uint8Array): boolean => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
const isXlsMagic = (b: Uint8Array): boolean => b.length > 3 && b[0] === 0xd0 && b[1] === 0xcf;

/** freeeの取引ZIPに同梱される、口座間の振替ファイルのヘッダー。 */
const isTransferHeader = (header: readonly string[]): boolean => {
  const normalized = header.map((cell) => cell.trim());
  return ['振替日', '振替元口座'].every((name) => normalized.some((cell) => cell.includes(name)));
};

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
    if (p.reservedIds > 0) {
      return {
        kind: 'error',
        filename,
        reason: 'IDがcash:で始まる明細があるため取り込めません。現金記帳と衝突しないIDで再出力してください',
      };
    }
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
  // 資産推移は「日付」列を持つので、口座明細(残高付き)の先回り拒否より前に判定する
  if (isMfAssetHistoryHeader(rows[0])) {
    const p = parseMfAssetHistoryRows(rows);
    if (!p.months.length) {
      return { kind: 'error', filename, reason: '資産推移CSVですが、日付を読める行が1行もありません' };
    }
    return {
      kind: 'assets',
      filename,
      balances: p.balances,
      months: p.months,
      rows: p.rows,
      skipped: p.skipped,
      collapsed: p.collapsed,
      categories: p.categories,
      totalMismatchMonths: p.totalMismatchMonths,
    };
  }
  return { kind: 'error', filename, reason: describeUnknownFormat(rows[0]) };
}

/**
 * 取込結果の数量契約。CSVの入力行と、ID重複を整理した永続行を同じ件数として扱わない。
 * committed時は stored = countable + nonCountable。rejected は parsed の外側にある。
 */
export interface ImportCountSummary {
  /** 日付を解釈でき、明細へ変換できた入力行（同一IDの重複を含む） */
  parsed: number;
  /** 同一IDを後勝ちで整理した正規保存行 */
  stored: number;
  /** 正規保存行のうち収支集計へ含める行 */
  countable: number;
  /** 正規保存行のうち保存はするが収支集計へ含めない行 */
  nonCountable: number;
  /** 日付を解釈できず明細として保存できない入力行 */
  rejected: number;
}

const emptyImportCountSummary = (): ImportCountSummary => ({
  parsed: 0,
  stored: 0,
  countable: 0,
  nonCountable: 0,
  rejected: 0,
});

/** parser出力から、永続化と集計が実際に使うcanonical件数を一度だけ導出する。 */
export function importCountSummary(unit: ParsedUnit, jsonMfTx: readonly MfTx[] = []): ImportCountSummary {
  if (unit.kind === 'error') return emptyImportCountSummary();
  if (unit.kind === 'assets') {
    // 残高は収支に入らない。countable(集計へ入る行)は必ず0になる
    return {
      parsed: unit.rows,
      stored: unit.balances.length,
      countable: 0,
      nonCountable: unit.balances.length,
      rejected: unit.skipped,
    };
  }
  if (unit.kind === 'freee') {
    return {
      parsed: unit.rows,
      stored: unit.deals.length,
      countable: unit.deals.length,
      nonCountable: 0,
      rejected: unit.skipped,
    };
  }

  const parsed = unit.kind === 'mf' ? unit.rows : jsonMfTx.length;
  const rejected = unit.kind === 'mf' ? unit.skipped : 0;
  const canonical = canonicalMfTransactions(unit.kind === 'mf' ? unit.txs : jsonMfTx);
  const countable = canonical.filter(isMfCountable).length;
  return {
    parsed,
    stored: canonical.length,
    countable,
    nonCountable: canonical.length - countable,
    rejected,
  };
}

/**
 * counts導入前のconsumerへ返す数量。旧MF parserの「有効行/スキップ」定義を維持し、
 * 新しいparsed/rejectedを別の意味でaliasしない。
 */
export function legacyImportCountAliases(
  unit: ParsedUnit,
  jsonMfTx: readonly MfTx[] = [],
): { rows: number; skipped: number } {
  if (unit.kind === 'error') return { rows: 0, skipped: 0 };
  if (unit.kind === 'freee') return { rows: unit.rows, skipped: unit.skipped };
  // 資産推移の「有効行」は保存する残高の本数。日次→月次で落とした行はskipped側へ寄せる
  if (unit.kind === 'assets') {
    return { rows: unit.balances.length, skipped: unit.skipped + unit.collapsed };
  }
  const transactions = unit.kind === 'mf' ? unit.txs : canonicalMfTransactions(jsonMfTx);
  const rows = transactions.filter(isMfCountable).length;
  return {
    rows,
    skipped: (unit.kind === 'mf' ? unit.skipped : 0) + transactions.length - rows,
  };
}

/**
 * 形式を判定できなかったときの理由文。よくある取り違え(MFの振替・口座明細、freeeの別帳票)を名指しし、
 * 代わりに出力すべきファイルを案内する。ヘッダー名のみ含め、明細内容や金額は含めない。
 */
export function describeUnknownFormat(header: string[]): string {
  const h = header.map((c) => c.trim());
  const has = (...names: string[]) => names.every((n) => h.some((c) => c.includes(n)));
  const guide =
    'このアプリが読めるのは、マネーフォワードの「家計簿 › 収入・支出詳細」CSV、マネーフォワードの「資産 › 資産推移」CSV(残高)、freeeの「取引」エクスポート(CSV/ZIP)です。';
  if (isTransferHeader(header))
    return `口座間の「振替」データのため、単体では取り込めません(口座間の移動は収支に含めません)。${guide}`;
  if (has('日付', '残高') || has('取引日', '残高')) return `口座明細(残高付き)のため取り込めません。${guide}`;
  if (has('勘定科目', '借方') || has('借方勘定科目'))
    return `freeeの仕訳帳形式のため取り込めません。freeeでは「取引」の一覧からエクスポートしてください。${guide}`;
  const head = h.slice(0, 6).join(', ');
  return `形式を判定できません(「収支区分」または「計算対象」列がありません)。${guide} 先頭の列: ${head}`;
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
    const parsedEntries: Array<{ base: string; parent: string; data: Uint8Array; units: ParsedUnit[] }> = [];
    for (const [name, data] of Object.entries(entries)) {
      const base = name.split('/').pop() ?? name;
      if (!base || base.startsWith('.') || name.endsWith('/') || name.includes('__MACOSX')) continue;
      const lastSlash = name.lastIndexOf('/');
      const parent = lastSlash < 0 ? '' : name.slice(0, lastSlash);
      parsedEntries.push({
        base,
        parent,
        data,
        units: parseUpload(`${filename}/${base}`, data, normMap, depth + 1),
      });
    }

    // freeeの標準「取引」ZIPは deals.csv と transfers.csv の2本立て。
    // transfers.csv は口座間移動で収支に含めないため、deals.csv が同じZIPで
    // freeeと確定できた場合だけ「失敗」にせず同梱ファイルとして除外する。
    // transfers.csv 単体は従来どおり対応形式への案内エラーにする。
    const freeeDealParents = new Set(
      parsedEntries
        .filter(
          ({ base, units }) =>
            base.toLowerCase() === 'deals.csv' && units.some((unit) => unit.kind === 'freee'),
        )
        .map(({ parent }) => parent),
    );
    const units = parsedEntries.flatMap(({ base, parent, data, units: entryUnits }) => {
      if (
        freeeDealParents.has(parent) &&
        base.toLowerCase() === 'transfers.csv' &&
        isTransferHeader(parseCSV(decodeBuf(data))[0] ?? [])
      )
        return [];
      return entryUnits;
    });
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

/* ------------------------- 内容指紋(重複取込の検知) ------------------------- */

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintCanonical(canonical: string): Promise<string> {
  return `v${FINGERPRINT_VERSION}:${await sha256Hex(canonical)}`;
}

/**
 * 取込単位の内容指紋(SHA-256)。現行v4 canonical write-setをhashし、旧hashと区別する。
 * 明示ID付きCSVは行順に依らない。JSONはpartial merge後のpersisted write-setが必要なため
 * import lifecycle側のrestoreWriteSetFingerprintで生成する。
 * IDなしMFは復元keyに行indexを使うため行順変更を同一視しない。
 */
export async function unitFingerprint(u: ParsedUnit): Promise<string | null> {
  let canonical: string | null = null;
  if (u.kind === 'freee') canonical = canonicalFreee(u.deals);
  if (u.kind === 'mf') canonical = canonicalMf(u.txs);
  // 残高は月ごとに1点へ丸めた後の値だけを見る。日次の行が1本増減しても、
  // 月末の残高が同じなら同じ内容として扱う(取り込み直しを重複と判定できる)
  if (u.kind === 'assets') {
    canonical = u.balances.map((b) => [b.month, b.date, b.side, b.category, b.amount].join('\t')).join('\n');
  }
  if (canonical) return fingerprintCanonical(canonical);
  return null;
}
