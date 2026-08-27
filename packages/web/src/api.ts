/**
 * APIクライアント。401はグローバルイベントで通知しログイン画面へ切り替える。
 * 型は @kanjo/core の分析出力型をそのまま利用する(サーバと完全一致)。
 */
import type {
  AttachmentQuotaUsage,
  Benchmark,
  BudgetRow,
  Attachment as CoreAttachment,
  AttachmentCleanupStage as CoreAttachmentCleanupStage,
  DefenseLine,
  DiagnosisData,
  HouseholdData,
  MatrixData,
  OverviewData,
  SubVendor,
  SubsCandidate,
  SubscriptionsData,
  TradeoffCandidate,
} from '@kanjo/core';
import { type Owner as CoreOwner, OWNER_LABEL, OWNER_VALUES } from '@kanjo/core';

export class ApiError extends Error {
  status: number;
  code: string;
  /** 409 partial-safe responseなど、UIが失敗内訳を正直に表示するための検証済み候補body */
  body: unknown;
  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export const AUTH_EVENT = 'kanjo:unauthorized';

async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // JSONでないエラーは状態コードだけを使う
  }
  return apiErrorFromBody(res.status, body);
}

function apiErrorFromBody(status: number, body: unknown): ApiError {
  let code = 'error';
  let message = `エラー(${status})`;
  const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
  if (error?.code) code = error.code;
  if (error?.message) message = error.message;
  return new ApiError(status, code, message, body);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new ApiError(401, 'unauthorized', '認証が必要です');
  }
  if (!res.ok) throw await apiErrorFromResponse(res);
  return (await res.json()) as T;
}

/**
 * 添付のアップロード。multipart のため Content-Type をブラウザに決めさせる
 * (境界文字列を自分で書けないため、api() の JSON ヘッダをそのまま使えない)。
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  options: { acceptErrorBody?: (body: unknown) => boolean } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new ApiError(401, 'unauthorized', '認証が必要です');
  }
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw apiErrorFromBody(res.status, undefined);
    }
    if (options.acceptErrorBody?.(body)) return body as T;
    throw apiErrorFromBody(res.status, body);
  }
  return (await res.json()) as T;
}

/* -------- エンドポイント別の型 -------- */

export interface SummaryResponse {
  overview: OverviewData;
  defense: DefenseLine;
  benchmarks: Benchmark[];
}

export type Owner = CoreOwner;
export { OWNER_VALUES };
export type Cls = 'biz' | 'per';

export interface TxEditView {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  updatedAt: string | null;
}

export interface TxRow {
  id: string;
  /** MF出力のID列由来で、再取込後も同一明細と判定できる */
  idStable: boolean;
  date: string;
  description: string;
  amount: number;
  /** MF の保有金融機関(旧取込は null) */
  institution: string | null;
  /** 取込値 */
  csvBig: string;
  csvMid: string;
  /** 有効値(手動 > ルール > 取込値) */
  big: string;
  mid: string;
  catSrc: '手動' | 'ルール' | '取込値';
  cls: Cls;
  src: '手動' | 'ルール' | '既定';
  owner: Owner | null;
  ownerSrc: '手動' | 'ルール' | '口座' | '既定';
  edited: boolean;
  /** 編集後に取込値が変わった */
  conflict: boolean;
  /** 手動の科目が現在の公私の系統(事業=freee科目 / 個人=MF内訳)に無い */
  scopeMismatch: boolean;
  /** 添付されている証憑の件数(0 = 未添付) */
  attachmentCount: number;
  edit: TxEditView | null;
}

export type CandidateSource = 'freee' | 'mf' | 'custom';
export interface CandidateMajor {
  name: string;
  source: CandidateSource;
  mids: { name: string; source: CandidateSource }[];
}
/** 科目候補の二系統: biz = freee 勘定科目(決算書の科目) / per = MF 大項目・中項目(家計の内訳) */
export interface Candidates {
  biz: CandidateMajor[];
  per: CandidateMajor[];
}
export interface CategoryOptionRow {
  scope: Cls;
  major: string;
  mid: string;
  uses: { edits: number; rules: number; cashEntries: number };
}
export const SCOPE_LABEL: Record<Cls, string> = {
  biz: '事業の科目(freee勘定科目・決算書に載る)',
  per: '家計の科目(MF大項目/中項目)',
};
export const SCOPE_SHORT: Record<Cls, string> = { biz: '事業', per: '家計' };

export interface TransactionsResponse {
  months: string[];
  month: string | null;
  summary: {
    month: string | null;
    count: number;
    totalIncome: number;
    bizIncome: number;
    personalIncome: number;
    totalExpense: number;
    bizExpense: number;
    personalExpense: number;
    incomeByOwner: { business: number; spouse: number; family: number; unset: number };
    editedCount: number;
    conflictCount: number;
    noInstitutionCount: number;
    /** 取り込んだが集計対象外だった明細数(MFの振替・計算対象=0) */
    nonCountableCount: number;
  };
  transactions: TxRow[];
  candidates: Candidates;
}

export interface RuleRow {
  id: number;
  keyword: string;
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  sortOrder: number;
  hits: number;
}

export interface RuleBody {
  keyword: string;
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
}

export interface EditListRow {
  txId: string;
  month: string | null;
  date: string | null;
  description: string | null;
  amount: number | null;
  csvBig: string | null;
  csvMid: string | null;
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  baseBig: string | null;
  baseMid: string | null;
  updatedAt: string | null;
  status: 'ok' | 'changed' | 'orphan';
}

export interface ClassificationResponse {
  institutions: { institution: string; count: number; owner: Owner | null }[];
  noInstitutionCount: number;
  institutionOwners: Record<string, Owner>;
  categoryOptions: CategoryOptionRow[];
  candidates: Candidates;
  edits: EditListRow[];
}

export { OWNER_LABEL };
export const ownerLabel = (o: Owner | null | undefined): string => OWNER_LABEL[o ?? 'unset'];

export interface ImportCountSummary {
  /** 明細へ変換できた入力行（同一IDの重複を含む） */
  parsed: number;
  /** 今回の試行で正規保存された一意行 */
  stored: number;
  /** 保存行のうち収支集計へ含める行 */
  countable: number;
  /** 保存行のうち保存はするが収支集計へ含めない行 */
  nonCountable: number;
  /** 日付を解釈できず保存できない入力行 */
  rejected: number;
}

export interface ImportUnitResult {
  filename: string;
  kind: string;
  months: string[];
  /** 新しい件数契約。optionalはAPI/Webのローリング更新中の後方互換用 */
  counts?: ImportCountSummary;
  /** 後方互換: 旧parserの集計有効行（countsとは別定義） */
  rows: number;
  /** 後方互換: 旧parserの対象外・振替・保存不能行（countsとは別定義） */
  skipped: number;
  syntheticIds?: number;
  duplicateIds?: number;
  /** duplicate = 現在有効な取込と同じ内容のためスキップ */
  status: 'committed' | 'failed' | 'duplicate';
  reason?: string;
  /** 月ごとの洗い替え前後の件数(減っていれば月の途中までのファイルの可能性) */
  replaced?: { month: string; before: number; after: number }[];
}

export interface ImportHistoryRow {
  id: number;
  filename: string;
  kind: string | null;
  months: string[];
  /** 旧履歴を含むparser受理行。保存一意行の件数ではない */
  rows: number | null;
  status: string | null;
  duplicateOf: number | null;
  failureReason: string | null;
  generationState: 'active' | 'partial' | 'superseded' | 'legacy' | null;
  committedAt: string | null;
  createdAt: string | null;
}

/* -------- 添付(レシート・領収書) -------- */

export interface AttachmentsResponse {
  attachments: Attachment[];
  limit: number;
  /** 旧APIからの段階更新中も一覧を壊さないようoptionalで受ける */
  usage?: AttachmentQuotaUsage;
}

/** backend wireはcore反映までの移行中もoriginal_missingを正しく受信する */
export type AttachmentCleanupStage = CoreAttachmentCleanupStage | 'original_missing';

export interface Attachment extends Omit<CoreAttachment, 'cleanupStage'> {
  cleanupStage: AttachmentCleanupStage;
}

export interface AttachmentOrphansResponse {
  attachments: Attachment[];
  usage?: AttachmentQuotaUsage;
}

export interface AttachmentArchiveRecord {
  r2Key: string;
  target: { kind: 'cash' | 'mf'; key: string };
  filename: string;
  contentType: string;
  size: number;
  contentHash: string;
  createdAt: string;
}

export interface AttachmentArchiveInventory {
  version: 1;
  basis: 'inventory-only';
  restoreCapable: false;
  metadataRecoveryCapable: true;
  /** データ由来URLは使わず、UIは固定した同一オリジンAPIだけを呼ぶ */
  recoveryEndpoint: string;
  records: AttachmentArchiveRecord[];
}

export type AttachmentArchiveRecordStatus =
  | 'matched'
  | 'metadata_missing'
  | 'target_missing'
  | 'missing'
  | 'mismatch'
  | 'skipped';

export interface AttachmentArchiveReport {
  matched: number;
  metadataMissing: number;
  targetMissing: number;
  missing: number;
  mismatch: number;
  skipped: number;
  records: { r2Key: string; status: AttachmentArchiveRecordStatus }[];
}

export interface AttachmentArchiveReconcileResponse {
  ok: true;
  report: AttachmentArchiveReport;
}

export interface AttachmentArchiveRecoverResponse {
  /** 409でも検証一致分は復旧済みのpartial-safe responseを返す */
  ok: boolean;
  recovered: number;
  alreadyPresent: number;
  skipped: number;
  report: AttachmentArchiveReport;
}

export interface LegacyRestoreResponse {
  ok: true;
  duplicate: boolean;
  months: string[];
  mfTxCount: number;
  rules: number;
}

export type { AttachmentQuotaUsage };

/* -------- 現金の記帳 -------- */

export interface CashEntry {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  month: string;
  side: Cls;
  io: 'income' | 'expense';
  /** 正の整数(円)。向きは io */
  amount: number;
  description: string;
  /** 事業: freee勘定科目 / 家計: MF大項目 */
  categoryMajor: string;
  categoryMid: string;
  memo: string | null;
  transitFrom: string | null;
  transitTo: string | null;
  transitRound: boolean;
  /** 領収書が構造上出ない支出(電車代など) */
  receiptWaived: boolean;
  /** 添付されている証憑の件数 */
  attachmentCount: number;
}

export interface CashEntryBody {
  date: string;
  side: Cls;
  io: 'income' | 'expense';
  amount: number;
  description: string;
  big: string;
  mid: string;
  memo: string | null;
  transitFrom: string | null;
  transitTo: string | null;
  transitRound: boolean;
  receiptWaived: boolean;
}

export interface CashEntriesResponse {
  entries: CashEntry[];
  candidates: Candidates;
  months: string[];
}

export interface SettingsResponse {
  normMap: Record<string, string>;
  unrecordedExpMonths: string[];
  cashOverrides: Record<string, { revenue: number; expense: number }>;
}

export interface TradeoffResponse {
  candidates: TradeoffCandidate[];
  budgets: BudgetRow[];
  plans: {
    id: number;
    title: string | null;
    amount: number;
    recurring: boolean;
    selected: { label: string; value: number }[];
    covered: number | null;
    verdict: string | null;
    createdAt: string | null;
  }[];
}

export type {
  Benchmark,
  BudgetRow,
  DefenseLine,
  DiagnosisData,
  HouseholdData,
  MatrixData,
  OverviewData,
  SubVendor,
  SubsCandidate,
  SubscriptionsData,
  TradeoffCandidate,
};

export interface SubVendorRow extends SubVendor {
  id: number;
}

/* -------- AI分析(spec §16) -------- */

export type AiReportType = 'monthly' | 'annual' | 'longterm';
export const AI_REPORT_TYPE_LABEL: Record<AiReportType, string> = {
  monthly: '月次',
  annual: '年次',
  longterm: '長期',
};
export interface AiPeriod {
  from: string;
  to: string;
}
export type AiSectionId = 'spend' | 'change' | 'reduction' | 'split' | 'subscriptions';
export const AI_SECTION_LABEL: Record<AiSectionId, string> = {
  spend: '何にいくらかかっているか',
  change: '前年・前月との増減と要因',
  reduction: '削減余地と根拠・優先順位',
  split: '事業/個人・名義(事業/妻/家族)の別',
  subscriptions: 'サブスクの整理候補',
};
/** 「精度を上げるために必要な情報」で案内できる画面 */
export type AiNeedScreen =
  | 'import'
  | 'classify'
  | 'settings'
  | 'budget'
  | 'subscriptions'
  | 'household'
  | 'overview';

export interface AiTaskView {
  id: string;
  period: AiPeriod;
  type: AiReportType;
  label: string;
  supplement: string | null;
  parentReportId: string | null;
  expiresAt: string;
  createdAt: string;
  reportId: string | null;
  status: 'waiting' | 'expired' | 'done';
}
export interface AiReportItem {
  label: string;
  amount: number | null;
  note: string;
  priority: 'high' | 'mid' | 'low' | null;
}
/** 要点1件 = 事実(数値+計算根拠) → 解釈 → 次のアクション(期待効果) の3段(spec §16 v3) */
export interface AiReportFinding {
  label: string;
  fact: string;
  basis: string;
  interpretation: string;
  action: string;
  expectedEffect: number | null;
  amount: number | null;
  priority: 'high' | 'mid' | 'low' | null;
  /** 根拠にした図のカタログ id。無ければ null */
  chart: string | null;
}
export type AiFindingKey = 'improvements' | 'wasted' | 'quickWins';
export const AI_FINDING_LABEL: Record<AiFindingKey, string> = {
  improvements: '改善すべき点',
  wasted: '無駄なコスト',
  quickWins: 'すぐ効く対策',
};
export interface AiReportKeyFindings {
  improvements: AiReportFinding[];
  wasted: AiReportFinding[];
  quickWins: AiReportFinding[];
  /** 0件だった区分の理由(なぜ無いか) */
  notes: Record<AiFindingKey, string>;
}
export interface AiReportSection {
  id: AiSectionId;
  title: string;
  body: string;
  items: AiReportItem[];
  /** 最低行数を満たせなかった理由(データ不足)。満たしていれば null */
  gap: string | null;
}
export interface AiReportNeed {
  gap: string;
  action: string;
  screen: AiNeedScreen | null;
}
export type AiChartKind = 'line' | 'bar' | 'stackedBar' | 'waterfall' | 'pareto' | 'band';
export interface AiChartSeries {
  label: string;
  data: (number | null)[];
  role?: 'line' | 'band' | 'total' | 'cum';
}
/** 図表カタログ1枚分の凍結スナップショット。数値はすべてアプリ側の計算結果(AIは caption だけを書く) */
export interface AiReportChart {
  id: string;
  figure: number;
  title: string;
  kind: AiChartKind;
  unit: 'yen' | 'pct' | 'count';
  purpose: string;
  readingGuide: string;
  available: boolean;
  reason: string | null;
  monthsNeeded: number | null;
  granularity: 'month' | 'quarter' | null;
  data: { labels: string[]; series: AiChartSeries[] } | null;
  status: 'ok' | 'source_missing' | 'app_missing';
  caption: string;
}
export interface AiReportBody {
  version: 3;
  generatedBy: string;
  model: string | null;
  title: string;
  summary: string;
  keyFindings: AiReportKeyFindings;
  sections: AiReportSection[];
  followUp: { body: string; items: AiReportItem[] } | null;
  needs: AiReportNeed[];
  charts: AiReportChart[];
  dataGaps: string[];
}
export interface AiReportRow {
  id: string;
  taskId: string;
  period: AiPeriod;
  type: AiReportType;
  label: string;
  version: number;
  parentReportId: string | null;
  generatedBy: string;
  title: string;
  summary: string;
  createdAt: string;
}
export interface AiTaskCreateBody extends AiPeriod {
  supplement?: string;
  parentReportId?: string;
}
export interface AiTaskCreateResponse {
  task: AiTaskView;
  prompt: string;
}
export interface AiReportDetailResponse {
  report: AiReportRow & { body: AiReportBody };
  previous: AiReportRow | null;
  versions: AiReportRow[];
}
