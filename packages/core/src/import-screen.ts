/**
 * データ取込画面 (16-import) の規則。web の送信前の判定と api の 413・画面の状態表示が同じ判定を使うよう、ここで1回だけ決める。
 *
 * - 上限値: IMPORT_LIMITS の1か所だけに置く。web と api の取込の経路は数値を書き写さず、この定数と判定関数を import する。
 * - ファイルの状態: 6 種。上から順に最初に当たったものを返す (失敗 → 取込済み → 取込不可 → 取込準備完了 → 検査中 → アップロード中)。
 * - 検証の段階: 重複 (取込済みと同一 → 重複の可能性 → 重複なし) とバリデーション (エラー → 警告あり → 問題なし)。
 * - 内容確認の要約: 取込可能なファイルだけを数える 6 項目。
 * - 取込 1 回の結果: 全成功 = 成功、混在 = 一部成功、全失敗 = 失敗。確定から外したエラーのファイルは失敗に数える。
 * - 履歴の操作: 結果と 30 日の取り消し期限から、出せる操作を1つの表で導く。
 *
 * 規則の表は docs/import-screen/rules.md にあり、core の契約テストの期待値と同じである。
 */

/* ======================== 上限値 ======================== */

/** 1 MB = 1,048,576 bytes (agent 推定・利用者未確認)。 */
export const IMPORT_MB = 1024 * 1024;

export const IMPORT_LIMITS = {
  /** 1 ファイルの大きさ */
  maxFileBytes: 25 * IMPORT_MB,
  /** 1 回の取込 (検査 ID ごとの累計) のファイル数 */
  maxFiles: 10,
  /** 1 回の取込 (検査 ID ごとの累計) の合計サイズ */
  maxTotalBytes: 30 * IMPORT_MB,
  /**
   * xlsx / ZIP の展開後の合計。
   * 実測 (docs/import-screen/design-decisions.md §8) では Workers の 128MB に収まるのは展開後およそ 15MB
   * (約 35,000 行) まで。60MB では上限の内側でもメモリ不足で落ちうるため、OI-03 の判断 (A案) で 15MB に下げた。
   * CSV は行ごとに読むのでこの上限に当たらない。
   */
  maxExpandedBytes: 15 * IMPORT_MB,
  /** xlsx / ZIP の中央ディレクトリのエントリ数 */
  maxArchiveEntries: 1_000,
  /** 一括削除 1 要求の件数 */
  maxHideIds: 100,
  /** 夜間保守の片づけ 1 回の件数 (仮置きのファイル単位) */
  cleanupBatch: 500,
  /** ファイル名 (制御文字を除いた文字数) */
  maxFilenameLength: 255,
  /** 検査 (ファイル追加を含む) の回数 / 分 / 利用者 */
  inspectionsPerMinute: 30,
  /** 確定 (再取込を含む) の回数 / 分 / 利用者 */
  commitsPerMinute: 5,
  /** 仮置きの期限 */
  stagingTtlMs: 24 * 60 * 60 * 1000,
  /** 取り消しの期限 (既存の 30 日) */
  undoWindowMs: 30 * 24 * 60 * 60 * 1000,
} as const;

/** multipart の区切りとフィールドの分の余裕。本文の上限 = 合計サイズ + これ。 */
export const IMPORT_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/** 検査・ファイル追加の要求本文の上限 (hono/body-limit の maxSize)。 */
export const importBodyLimitBytes = (): number =>
  IMPORT_LIMITS.maxTotalBytes + IMPORT_MULTIPART_OVERHEAD_BYTES;

const mbText = (bytes: number): string => `${Math.round(bytes / IMPORT_MB)}MB`;

/** 画面の注記「1 回に 10 ファイル・合計 30MB まで、1 ファイル 25MB まで」。数値は定数から描く。 */
export const importLimitsNote = (): string =>
  `1 回に ${IMPORT_LIMITS.maxFiles} ファイル・合計 ${mbText(IMPORT_LIMITS.maxTotalBytes)} まで、1 ファイル ${mbText(IMPORT_LIMITS.maxFileBytes)} まで`;

/**
 * ファイル名の長さは拒否の理由にしない。api が制御文字を除き 255 文字で切って記録する (qa-imp-decision-010)。
 */
export type ImportLimitViolationKind = 'count' | 'file' | 'total' | 'expanded' | 'entries';

export interface ImportLimitViolation {
  kind: ImportLimitViolationKind;
  /** 画面と API の message に出す理由 */
  reason: string;
  /** file のとき、超過したファイルの位置 (入力順) */
  index?: number;
}

export const importLimitReason = (kind: ImportLimitViolationKind): string => {
  switch (kind) {
    case 'count':
      return `${IMPORT_LIMITS.maxFiles} ファイル超`;
    case 'file':
      return `${mbText(IMPORT_LIMITS.maxFileBytes)} 超`;
    case 'total':
      return `合計 ${mbText(IMPORT_LIMITS.maxTotalBytes)} 超`;
    case 'expanded':
      return `展開後 ${mbText(IMPORT_LIMITS.maxExpandedBytes)} 超`;
    case 'entries':
      return `エントリ数 ${IMPORT_LIMITS.maxArchiveEntries.toLocaleString('en-US')} 件超`;
  }
};

const violation = (kind: ImportLimitViolationKind, index?: number): ImportLimitViolation =>
  index === undefined
    ? { kind, reason: importLimitReason(kind) }
    : { kind, reason: importLimitReason(kind), index };

/**
 * 送信前と API の受け付けで共通の上限判定。超過が無ければ null。
 * 判定の順は ファイル数 → 1 ファイルの大きさ → 合計。追加では既存の項目 (prior) を累計に含める。
 */
export function importLimitViolation(input: {
  files: ReadonlyArray<{ name: string; size: number }>;
  prior?: { count: number; totalBytes: number };
}): ImportLimitViolation | null {
  const priorCount = input.prior?.count ?? 0;
  const priorBytes = input.prior?.totalBytes ?? 0;
  if (priorCount + input.files.length > IMPORT_LIMITS.maxFiles) return violation('count');
  for (const [index, file] of input.files.entries()) {
    if (file.size > IMPORT_LIMITS.maxFileBytes) return violation('file', index);
  }
  const total = input.files.reduce((sum, file) => sum + file.size, priorBytes);
  if (total > IMPORT_LIMITS.maxTotalBytes) return violation('total');
  return null;
}

/** xlsx / ZIP を展開する前に、中央ディレクトリから読んだ値で判定する。超過が無ければ null。 */
export function importArchiveViolation(input: {
  entries: number;
  expandedBytes: number;
}): ImportLimitViolation | null {
  if (input.entries > IMPORT_LIMITS.maxArchiveEntries) return violation('entries');
  if (input.expandedBytes > IMPORT_LIMITS.maxExpandedBytes) return violation('expanded');
  return null;
}

/** 上限の境界の 1 例。web の送信前判定・api の 413・core の判定が同じ表を読む。 */
export interface ImportLimitBoundaryCase {
  name: string;
  /** 先に同じ検査 ID へ入れたファイル (追加の累計)。どれも上限内 */
  before: ReadonlyArray<{ name: string; size: number }>;
  /** 今回選ぶファイル。超過するときは最後の 1 件が超過を起こす */
  files: ReadonlyArray<{ name: string; size: number }>;
  expected: ImportLimitViolationKind | null;
}

const boundaryFiles = (count: number, size = 1): Array<{ name: string; size: number }> =>
  Array.from({ length: count }, (_, index) => ({ name: `boundary-${index + 1}.json`, size }));

const boundaryName = (length: number): string => `${'n'.repeat(length - '.json'.length)}.json`;

/**
 * 上限ちょうどは通り、1 つ超えると止まる境界の表。数値はすべて IMPORT_LIMITS から導く。
 * 送信前判定はファイルを 1 件ずつ累計で判定し、api は要求単位で判定するため、
 * 超過は最後の 1 件で起こるように並べる (どちらの粒度でも同じ kind になる)。
 */
export const IMPORT_LIMIT_BOUNDARY_CASES: ReadonlyArray<ImportLimitBoundaryCase> = (() => {
  const { maxFiles, maxFileBytes, maxTotalBytes, maxFilenameLength } = IMPORT_LIMITS;
  const rest = maxTotalBytes - maxFileBytes;
  const big = { name: 'boundary-big.json', size: maxFileBytes };
  return [
    { name: 'ファイル数ちょうど', before: [], files: boundaryFiles(maxFiles), expected: null },
    { name: 'ファイル数 +1', before: [], files: boundaryFiles(maxFiles + 1), expected: 'count' },
    { name: '1 ファイルちょうど', before: [], files: [big], expected: null },
    {
      name: '1 ファイル +1 byte',
      before: [],
      files: [{ name: big.name, size: maxFileBytes + 1 }],
      expected: 'file',
    },
    {
      name: '合計ちょうど',
      before: [],
      files: [big, { name: 'boundary-rest.json', size: rest }],
      expected: null,
    },
    {
      name: '合計 +1 byte',
      before: [],
      files: [big, { name: 'boundary-rest.json', size: rest + 1 }],
      expected: 'total',
    },
    {
      name: 'ファイル名ちょうど',
      before: [],
      files: [{ name: boundaryName(maxFilenameLength), size: 1 }],
      expected: null,
    },
    {
      name: 'ファイル名 +1 文字 (拒まず、api が 255 文字に切る)',
      before: [],
      files: [{ name: boundaryName(maxFilenameLength + 1), size: 1 }],
      expected: null,
    },
    {
      name: '追加でファイル数ちょうど',
      before: boundaryFiles(maxFiles - 1),
      files: [{ name: 'boundary-added.json', size: 1 }],
      expected: null,
    },
    {
      name: '追加でファイル数 +1',
      before: boundaryFiles(maxFiles),
      files: [{ name: 'boundary-added.json', size: 1 }],
      expected: 'count',
    },
    {
      name: '追加で合計ちょうど',
      before: [big],
      files: [{ name: 'boundary-added.json', size: rest }],
      expected: null,
    },
    {
      name: '追加で合計 +1 byte',
      before: [big],
      files: [{ name: 'boundary-added.json', size: rest + 1 }],
      expected: 'total',
    },
  ];
})();

/* ======================== 取込元 ======================== */

export type ImportSource = 'mf' | 'freee' | 'assets' | 'json';

/** 一覧・要約・詳細ペインの取込元の名前。 */
export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = {
  mf: 'マネーフォワード',
  freee: 'freee',
  assets: 'MF資産推移',
  json: '復元JSON',
};

/** 履歴の表の取込元の略称。`・` で連ねる。 */
export const IMPORT_SOURCE_SHORT: Record<ImportSource, string> = {
  mf: 'MF',
  freee: 'freee',
  assets: 'MF資産',
  json: 'JSON',
};

export const isImportSource = (value: unknown): value is ImportSource =>
  value === 'mf' || value === 'freee' || value === 'assets' || value === 'json';

const SOURCE_ORDER: readonly ImportSource[] = ['mf', 'freee', 'assets', 'json'];

/** 取込元を表示順に並べ、重複を除く。 */
export const orderedImportSources = (sources: Iterable<string | null | undefined>): ImportSource[] => {
  const set = new Set<string>();
  for (const source of sources) if (source) set.add(source);
  return SOURCE_ORDER.filter((source) => set.has(source));
};

/* ======================== 検証の段階 ======================== */

export type ImportDuplicateKind = 'none' | 'possible' | 'identical';
export type ImportValidationKind = 'checking' | 'ok' | 'warning' | 'error';

export interface ImportDuplicate {
  kind: ImportDuplicateKind;
  count: number;
}
export interface ImportValidation {
  kind: ImportValidationKind;
  count: number;
}

/** 重複の段階: 取込済みと同一 → 重複の可能性 n 件 → 重複なし。 */
export function importDuplicate(input: { identical: boolean; possibleCount: number }): ImportDuplicate {
  if (input.identical) return { kind: 'identical', count: 0 };
  if (input.possibleCount > 0) return { kind: 'possible', count: input.possibleCount };
  return { kind: 'none', count: 0 };
}

export const importDuplicateLabel = (d: ImportDuplicate): string => {
  if (d.kind === 'identical') return '取込済みと同一';
  if (d.kind === 'possible') return `重複の可能性 ${d.count}件`;
  return '重複なし';
};

/**
 * バリデーションの段階: エラー → 警告あり → 問題なし。
 * エラー = パースできない、または保存できる行が 0 行。警告 = 取り込めるが集計対象外として読み飛ばした行がある。
 * 数は エラーなら 1 (そのファイル)、警告なら読み飛ばした行数。
 */
export function importValidation(input: { error: boolean; rows: number; skipped: number }): ImportValidation {
  if (input.error || input.rows === 0) return { kind: 'error', count: 1 };
  if (input.skipped > 0) return { kind: 'warning', count: input.skipped };
  return { kind: 'ok', count: 0 };
}

export const importValidationLabel = (v: ImportValidation): string => {
  if (v.kind === 'checking') return 'チェック中';
  if (v.kind === 'error') return `エラー ${v.count}件`;
  if (v.kind === 'warning') return '警告あり';
  return '問題なし';
};

/* ======================== ファイルの状態 ======================== */

export type ImportFileState = 'uploading' | 'inspecting' | 'ready' | 'blocked' | 'imported' | 'failed';

export const IMPORT_FILE_STATE_LABEL: Record<ImportFileState, string> = {
  uploading: 'アップロード中',
  inspecting: '検査中',
  ready: '取込準備完了',
  blocked: '取込不可',
  imported: '取込済み',
  failed: '失敗',
};

export interface ImportFileStateInput {
  /** 確定の結果。まだ確定していなければ null */
  commit: 'committed' | 'failed' | null;
  /** 送信前の上限判定の超過理由 */
  limitViolation: string | null;
  /** 送信が済んだか (応答を待っている間は true) */
  uploaded: boolean;
  /** 検査結果。まだ無ければ null */
  inspection: { validation: ImportValidation; duplicate: ImportDuplicate; errorReason: string | null } | null;
  /** 強制再取込 */
  force: boolean;
  /** 送信の失敗理由 (web の送信だけが持つ。api は渡さない) */
  uploadError?: string | null;
}

export interface ImportFileStatus {
  state: ImportFileState;
  /** 取込不可・失敗の理由 */
  reason: string | null;
}

/** ファイルの状態。上から順に最初に当たったものを返す。 */
export function importFileState(input: ImportFileStateInput): ImportFileStatus {
  if (input.commit === 'failed') return { state: 'failed', reason: null };
  if (input.commit === 'committed') return { state: 'imported', reason: null };
  if (input.uploadError) return { state: 'failed', reason: input.uploadError };
  if (input.limitViolation) return { state: 'blocked', reason: input.limitViolation };
  const inspection = input.inspection;
  if (inspection) {
    if (inspection.validation.kind === 'error')
      return { state: 'blocked', reason: inspection.errorReason ?? '取り込めない形式です' };
    if (inspection.duplicate.kind === 'identical' && !input.force)
      return { state: 'blocked', reason: '取込済みと同一' };
    return { state: 'ready', reason: null };
  }
  if (input.uploaded) return { state: 'inspecting', reason: null };
  return { state: 'uploading', reason: null };
}

export type ImportFileAction = 'cancel' | 'remove' | 'retry';

export const IMPORT_FILE_ACTION_LABEL: Record<ImportFileAction, string> = {
  cancel: 'キャンセル',
  remove: '削除',
  retry: '再試行',
};

/** ステータスごとの操作。 */
export function importFileActions(state: ImportFileState): ImportFileAction[] {
  switch (state) {
    case 'uploading':
      return ['cancel'];
    case 'ready':
      return ['remove'];
    case 'blocked':
      return ['retry', 'remove'];
    case 'failed':
      return ['retry'];
    default:
      return [];
  }
}

/** 取込可否: 取込準備完了だけが選べて、確定に含められる。 */
export const importFileSelectable = (state: ImportFileState): boolean => state === 'ready';

/* ======================== ステッパー ======================== */

export type ImportStep = 1 | 2 | 3;

export const IMPORT_STEPS: ReadonlyArray<{ step: ImportStep; title: string; caption: string }> = [
  { step: 1, title: 'ファイル選択', caption: '複数のファイルを選んでアップロード' },
  { step: 2, title: '内容確認', caption: '明細内容とチェック結果を確認' },
  { step: 3, title: '取込結果', caption: '会計データに追加' },
];

/** 検査 ID が無い = 1、検査 ID があり未確定 = 2、確定の応答を受けた = 3。 */
export function importStep(input: { inspectionId: string | null; committed: boolean }): ImportStep {
  if (input.committed) return 3;
  if (input.inspectionId) return 2;
  return 1;
}

/* ======================== 内容確認の要約 ======================== */

export interface ImportSummaryFile {
  state: ImportFileState;
  source: ImportSource | null;
  rowCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  duplicate: ImportDuplicate;
  /** 検査の段階のサブスク候補の見込み */
  subsEstimate: number;
}

export interface ImportInspectionSummary {
  fileCount: number;
  importableCount: number;
  errorCount: number;
  rowCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  sources: Array<{ source: ImportSource; count: number }>;
  duplicateCount: number;
  subsCandidates: number;
}

/** 内容確認の 6 項目。対象ファイル以外は取込可能 (取込準備完了) なファイルだけを数える。 */
export function importInspectionSummary(files: readonly ImportSummaryFile[]): ImportInspectionSummary {
  const importable = files.filter((file) => importFileSelectable(file.state));
  const bySource = new Map<ImportSource, number>();
  for (const file of importable)
    if (file.source) bySource.set(file.source, (bySource.get(file.source) ?? 0) + 1);
  const froms = importable.map((file) => file.periodFrom).filter((v): v is string => !!v);
  const tos = importable.map((file) => file.periodTo).filter((v): v is string => !!v);
  return {
    fileCount: files.length,
    importableCount: importable.length,
    errorCount: files.filter((file) => file.state === 'blocked').length,
    rowCount: importable.reduce((sum, file) => sum + file.rowCount, 0),
    periodFrom: froms.length ? froms.reduce((a, b) => (a < b ? a : b)) : null,
    periodTo: tos.length ? tos.reduce((a, b) => (a > b ? a : b)) : null,
    sources: orderedImportSources(bySource.keys()).map((source) => ({
      source,
      count: bySource.get(source) ?? 0,
    })),
    duplicateCount: importable.reduce(
      (sum, file) => sum + (file.duplicate.kind === 'possible' ? file.duplicate.count : 0),
      0,
    ),
    subsCandidates: importable.reduce((sum, file) => sum + file.subsEstimate, 0),
  };
}

/** 除外の注記。エラーのファイルが 0 件なら null。 */
export const importExclusionNote = (errorCount: number): string | null =>
  errorCount > 0
    ? `エラーのあるファイル（${errorCount}件）は取り込み対象から除外されます。エラーを修正して再試行してください。`
    : null;

/* ======================== 取込 1 回の結果 ======================== */

export type ImportRunResult = 'success' | 'partial' | 'failed';
export type ImportHistoryResult = ImportRunResult | 'undone';

export const IMPORT_RESULT_LABEL: Record<ImportHistoryResult, string> = {
  success: '成功',
  partial: '一部成功',
  failed: '失敗',
  undone: '取り消し済み',
};

/** 全成功 = 成功、1 件以上成功かつ 1 件以上失敗 = 一部成功、成功 0 件 = 失敗。 */
export function importRunResult(succeeded: number, failed: number): ImportRunResult {
  if (succeeded > 0 && failed === 0) return 'success';
  if (succeeded > 0) return 'partial';
  return 'failed';
}

/** 詳細ペインの結果「一部成功（3件成功、1件失敗）」。 */
export function importRunResultText(result: ImportHistoryResult, succeeded: number, failed: number): string {
  const label = IMPORT_RESULT_LABEL[result];
  if (result === 'undone') return label;
  return `${label}（${succeeded}件成功、${failed}件失敗）`;
}

/** 結果の見出し。成功 0 件なら null (見出しは失敗の文だけにする)。 */
export function importResultHeadline(succeeded: number, failed: number): string[] {
  const lines: string[] = [];
  if (succeeded > 0) lines.push(`${succeeded} 件のファイルを正常に取り込みました`);
  if (failed > 0) {
    lines.push(`エラーのあった ${failed} 件のファイルは取り込みませんでした。`);
    if (succeeded > 0) lines.push('取り込んだデータは会計データに追加されています。');
  }
  return lines;
}

/** 履歴の表の「詳細」列: 成功だけなら「-」、失敗だけなら失敗理由の要約、混在なら「成功 n / 失敗 n」。 */
export function importHistoryDetail(input: {
  succeeded: number;
  failed: number;
  failureSummary: string | null;
}): string {
  if (input.failed === 0) return '-';
  if (input.succeeded === 0) return input.failureSummary ?? `失敗 ${input.failed}`;
  return `成功 ${input.succeeded} / 失敗 ${input.failed}`;
}

/* ======================== 履歴の操作 ======================== */

export type ImportHistoryAction = 'detail' | 'files' | 'replace' | 'undo' | 'delete';

export const IMPORT_HISTORY_ACTION_LABEL: Record<ImportHistoryAction, string> = {
  detail: '詳細',
  files: '取込ファイル',
  replace: '置換',
  undo: '取り消し',
  delete: '削除',
};

/** 取り消しの期限。作成から 30 日ちょうどまでは期限内。 */
export const importUndoDeadline = (createdAt: string): string =>
  new Date(Date.parse(createdAt) + IMPORT_LIMITS.undoWindowMs).toISOString();

export const importWithinUndoWindow = (createdAt: string, now: number): boolean =>
  now <= Date.parse(createdAt) + IMPORT_LIMITS.undoWindowMs;

/** 行の状態から出せる操作。API の拒否と画面のボタン表示がこの表だけを見る。 */
export function importHistoryActions(input: {
  result: ImportHistoryResult;
  createdAt: string;
  now: number;
}): ImportHistoryAction[] {
  if (input.result === 'failed' || input.result === 'undone') return ['detail', 'files', 'delete'];
  if (!importWithinUndoWindow(input.createdAt, input.now)) return ['detail', 'files'];
  if (input.result === 'success') return ['detail', 'files', 'replace', 'undo'];
  return ['detail', 'files', 'undo'];
}

/** 一括削除 (記録の非表示) の対象になるか。取り消し済み・失敗だけ。 */
export const importHistoryHideable = (result: ImportHistoryResult): boolean =>
  result === 'failed' || result === 'undone';

/* ======================== 表示の書式 ======================== */

/** 対象期間「2026/08/01 - 2026/08/31」。片方でも欠ければ「-」。 */
export function formatImportPeriod(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return '-';
  return `${from.replaceAll('-', '/')} - ${to.replaceAll('-', '/')}`;
}

/** ファイルサイズ「2.4 MB」「980 KB」。1 MB 未満は KB の整数 (最小 1 KB)。 */
export function formatImportFileSize(bytes: number): string {
  if (bytes >= IMPORT_MB) return `${(bytes / IMPORT_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 履歴の取込日時「2026/09/10 10:15」(JST)。読めない値は「-」。 */
export function formatImportDateTime(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(t)) return '-';
  const d = new Date(t + JST_OFFSET_MS);
  return `${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 詳細ペインの取込日時「2026年9月10日 10:15」(JST)。 */
export function formatImportDateTimeLong(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(t)) return '-';
  const d = new Date(t + JST_OFFSET_MS);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 月の一覧 (YYYY-MM) から対象期間の開始日と終了日。 */
export function importPeriodFromMonths(months: readonly string[]): {
  from: string | null;
  to: string | null;
} {
  const valid = months.filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (!valid.length) return { from: null, to: null };
  const last = valid[valid.length - 1];
  const [y, m] = last.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${valid[0]}-01`, to: `${last}-${pad2(end)}` };
}
