/**
 * APIクライアント。401はグローバルイベントで通知しログイン画面へ切り替える。
 * 型は @kanjo/core の分析出力型をそのまま利用する(サーバと完全一致)。
 */
import type {
  AttachmentQuotaUsage,
  BalanceSheet,
  Benchmark,
  BudgetOutlook,
  BudgetRow,
  Candidates,
  CashFlow,
  Attachment as CoreAttachment,
  AttachmentCleanupStage as CoreAttachmentCleanupStage,
  DefenseForecast,
  DefenseLine,
  DiagnosisData,
  DiagnosticPayload,
  HouseholdData,
  MatrixData,
  OverviewData,
  ProfitAndLoss,
  ReceiptGapRow,
  ReceiptGapSummary,
  ReceiptGapUrgency,
  ReceiptSourceResolution,
  ResolvedTaxAccountSetting,
  StatementSource,
  SubVendor,
  SubsCandidate,
  SubsReviewRow,
  SubscriptionsData,
  TaxAccountSetting,
  TaxReadinessCheck,
  TaxReadinessLevel,
  TaxReturnStatement,
  TaxYear,
  TradeoffCandidate,
  TradeoffReviewRow,
  UnsettledDeal,
  UnsettledReport,
} from '@kanjo/core';
import {
  type Owner as CoreOwner,
  type ImprovementStatus,
  OWNER_LABEL,
  OWNER_VALUES,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_VALUES,
  type PaymentMethod,
} from '@kanjo/core';

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

/** 対象期間の情報。サーバが絞り込み前の Dataset から作る */
export interface PeriodMeta {
  applied: { from: string; to: string } | null;
  label: string;
  full: { from: string; to: string } | null;
  years: string[];
  monthCount: number;
}

/** 防衛ラインの実績判定に、先行き見通し(事前警告)を足したもの */
export interface DefenseLineWithForecast extends DefenseLine {
  forecast: DefenseForecast;
}

export interface SummaryResponse {
  overview: OverviewData;
  defense: DefenseLineWithForecast;
  benchmarks: Benchmark[];
  /** 絞り込み前のデータから作った期間の情報。選択肢はここから作る */
  period: PeriodMeta;
}

/* -------- 支出トレンド(規模・増減・優先度) -------- */

export type ExpenseScope = 'all' | 'biz' | 'personal';
export type TrendDirection = '増加' | '減少' | '横ばい' | '判定不可';
export type PriorityAction = '削減を検討' | '継続監視' | '記録を整える' | '対応不要';

export interface TrendRow {
  account: string;
  side: 'biz' | 'personal';
  key: string;
  total: number;
  share: number;
  monthlyAvg: number;
  /** 変動係数。小さいほど毎月一定 */
  cv: number;
  type: '固定費' | '準変動' | 'スポット';
  /** Theil-Sen の傾き(円/月) */
  slopePerMonth: number;
  slopeRatio: number;
  /** この傾きが1年続いた場合の差(円) */
  annualImpact: number;
  mk: { s: number; tau: number; z: number; p: number; n: number };
  direction: TrendDirection;
  recentAvg: number;
  priorAvg: number;
  presenceRate: number;
  /** 固定費なのに金額が立っていない月。取込漏れの疑い */
  gapMonths: string[];
  series: number[];
  action: PriorityAction;
  score: number;
  reason: string;
}

export interface TrendsResponse {
  months: string[];
  recordedMonths: string[];
  unrecordedExpMonths: string[];
  expenseTotal: number;
  monthlyAvg: number;
  rows: TrendRow[];
  pareto: {
    account: string;
    side: 'biz' | 'personal';
    key: string;
    total: number;
    share: number;
    cumShare: number;
  }[];
  coreCount: number;
  breakdown: {
    beforeMonths: string[];
    afterMonths: string[];
    beforeTotal: number;
    afterTotal: number;
    diff: number;
    rows: {
      account: string;
      side: 'biz' | 'personal';
      key: string;
      before: number;
      after: number;
      diff: number;
      contribution: number;
    }[];
  };
  counts: Record<PriorityAction, number>;
  scope: ExpenseScope;
  scopeLabel: string;
  sides: {
    side: 'biz' | 'personal';
    label: string;
    total: number;
    monthlyAvg: number;
    share: number;
    accountCount: number;
    topAccount: { account: string; total: number } | null;
  }[];
  monthlySides: { month: string; biz: number; personal: number; total: number }[];
  period: PeriodMeta;
}

/** API表示に必要なdeal項目だけを公開し、集計・状態・予定の型はcore契約を再利用する。 */
type UnsettledDealView = Omit<UnsettledDeal, 'deal'> & {
  deal: Pick<UnsettledDeal['deal'], 'date' | 'io' | 'partner' | 'accountNorm' | 'amount'>;
};

/** rolling deploy中は旧Workerがscheduleを返さないため、取得境界ではoptionalとして表す。 */
export type UnsettledResponse = Omit<UnsettledReport, 'rows' | 'schedule'> & {
  rows: UnsettledDealView[];
  schedule?: UnsettledReport['schedule'];
};

export type Owner = CoreOwner;
export { OWNER_VALUES, PAYMENT_METHOD_VALUES };
export type { PaymentMethod };
export const paymentMethodLabel = (m: PaymentMethod): string => PAYMENT_METHOD_LABEL[m];
export type Cls = 'biz' | 'per';

export interface TxEditView {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  updatedAt: string | null;
}

/* -------- 明細の分割記帳 -------- */

/** 分割の1行。金額で持つ(割合は入力の手段であって、保存する形ではない) */
export interface SplitLineView {
  /** seqや並び替えと独立した内訳行の安定ID */
  lineId: string;
  amount: number;
  cls: Cls;
  big: string;
  mid: string;
  memo: string;
}

export interface SplitsResponse {
  txId: string;
  /** 元の明細の金額(絶対値)。内訳の合計はこれと一致していなければならない */
  total: number;
  description: string;
  date: string;
  state: 'ready' | 'amount_conflict';
  constraints: { minLines: number; maxLines: number; memoMaxLength: number };
  lines: SplitLineView[];
}

export interface TxRow {
  id: string;
  /** React表示key。canonical identityとしてAPIへ送り返さない */
  rowKey: string;
  rowKind: 'mf' | 'cash' | 'split';
  parentTxId: string | null;
  lineId: string | null;
  splitSeq: number | null;
  splitLineCount: number | null;
  splitState: 'amount_conflict' | 'identity_unstable' | null;
  capabilities: { quickClass: boolean; edit: boolean; split: boolean; attach: boolean };
  /** split childは親MFへ正規化済み */
  attachmentTargetId: string | null;
  /** MF出力のID列由来で、再取込後も同一明細と判定できる */
  idStable: boolean;
  date: string;
  description: string;
  amount: number;
  /** MF の保有金融機関(旧取込は null) */
  institution: string | null;
  /** 支払手段(口座名と現金IDからの導出) */
  paymentMethod: PaymentMethod;
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

/**
 * 科目候補の二系統: biz = freee 勘定科目 + 確定申告の標準科目 / per = MF 大項目・中項目(家計の内訳)。
 * 出どころ(source)が増えたときに画面だけ古い型のままになるのを避けるため、core の型をそのまま使う。
 */
export type { CandidateMajor, CandidateSource, Candidates } from '@kanjo/core';
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
    /** 当月の仕分けの進み具合(件数)。reviewPending は人もルールも触っていない残り件数 */
    progress: {
      total: number;
      bizCount: number;
      personalCount: number;
      bySource: { 手動: number; ルール: number; 既定: number };
      reviewPending: number;
    };
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
  /** 資産推移CSVで、合計欄と内訳の和が合わなかった月(列が欠けている可能性) */
  totalMismatchMonths?: string[];
  /**
   * duplicate = 現在有効な取込と同じ内容のためスキップ。
   * kept = 「前回を残す」指定で、件数が減る洗い替えを実行しなかった(既存データは無傷)
   */
  status: 'committed' | 'failed' | 'duplicate' | 'kept';
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
  /** 投入原本をR2に保存済み=やり直し(再取込)の入口を出せる。旧APIからの段階更新中はundefined */
  originalRecorded?: boolean;
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

/** 現金の記帳と freee 仕訳が同じ支払いを指している疑い(候補のみ。消し込みはしない) */
export interface CashDealDuplicate {
  cashEntryId: number;
  cashDate: string;
  deal: { date: string; partner: string; accountNorm: string; amount: number };
  /** same_day は同日、near_day は数日ずれ */
  confidence: 'same_day' | 'near_day';
  dayGap: number;
}

export interface CashEntriesResponse {
  entries: CashEntry[];
  candidates: Candidates;
  months: string[];
  duplicates: CashDealDuplicate[];
}

export interface SettingsResponse {
  normMap: Record<string, string>;
  unrecordedExpMonths: string[];
  cashOverrides: Record<string, { revenue: number; expense: number }>;
  /** AI分析の統計指標が必要とする記帳月数(既定6) */
  statMinMonths: number;
  statMinMonthsRange: { min: number; max: number; default: number };
}

/** 夜間バックアップ(R2 に30日保持)の一覧行 */
export interface BackupItem {
  date: string;
  size: number;
  uploaded: string | null;
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
  /** 立てた計画が翌月に効いたかの突合(plans と同じ id で対応する) */
  review: TradeoffReviewRow[];
}

/* -------- 決算書(PL・キャッシュフロー・BSの取込元) -------- */

export interface StatementsResponse {
  pl: ProfitAndLoss;
  cf: CashFlow;
  /** 残高。1件も入っていなければ months が空になる */
  bs: BalanceSheet;
  /** 手入力で受ける負債の種類。画面の入力欄をこの並びで作る */
  liabilityCategoryOptions: string[];
  /** BSがまだ作れないときに出す「何を取り込めば作れるか」 */
  balanceSheetSources: StatementSource[];
  period: PeriodMeta;
}

export type {
  BalanceSheet,
  Benchmark,
  BudgetOutlook,
  BudgetRow,
  CashFlow,
  DefenseForecast,
  DefenseLine,
  DiagnosisData,
  HouseholdData,
  MatrixData,
  OverviewData,
  ProfitAndLoss,
  ReceiptGapRow,
  ReceiptGapSummary,
  ReceiptGapUrgency,
  StatementSource,
  SubVendor,
  SubsCandidate,
  SubsReviewRow,
  SubscriptionsData,
  TaxAccountSetting,
  TaxReadinessCheck,
  TaxReadinessLevel,
  TaxReturnStatement,
  TradeoffCandidate,
  TradeoffReviewRow,
};

export interface SubVendorRow extends SubVendor {
  id: number;
}

/** 「これはサブスクではない」と記録した支払先(候補一覧から外れる) */
export interface SubVendorExclusionRow {
  id: number;
  partner: string;
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
  /** 指示文を最後にコピーした日時。null は一度もコピーしていない */
  copiedAt: string | null;
  copiedTarget: 'claude_code' | 'codex' | null;
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
export type AiChartKind = 'line' | 'bar' | 'stackedBar' | 'waterfall' | 'pareto' | 'band' | 'heatmap';
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
  /** アーカイブした日時。null = 通常表示 */
  archivedAt: string | null;
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

/* -------- 確定申告(転記シート・家事按分・証憑) -------- */

/**
 * 申告画面1枚ぶん。判定・転記シート・科目設定を1回で受け取る。
 * 分けて取ると、按分を保存した直後に判定だけ古い、という画面が出る。
 */
export interface TaxOverviewResponse {
  period: PeriodMeta;
  year: TaxYear;
  statement: TaxReturnStatement;
  checks: TaxReadinessCheck[];
  verdict: TaxReadinessLevel;
  receipts: ReceiptGapSummary;
  /** 帳簿の全科目に保存済み設定を重ねたもの。未保存行は候補値つきの未確認statusで並ぶ */
  settings: ResolvedTaxAccountSetting[];
  taxAccountOptions: { printed: string[]; additional: string[]; separate: string[] };
  receiptArchive: { fileCount: number; maxFilesPerPart: number; parts: number };
  externalReceiptSources: readonly [{ source: 'freee'; responsibility: 'external-confirmation' }];
}

export interface TaxReceiptGapsResponse {
  period: PeriodMeta;
  year: TaxYear;
  summary: ReceiptGapSummary;
  rows: (ReceiptGapRow & { urgency: ReceiptGapUrgency; receiptSource: ReceiptSourceResolution })[];
  checks: TaxReadinessCheck[];
  verdict: TaxReadinessLevel;
  receiptArchive: { fileCount: number; maxFilesPerPart: number; parts: number };
  externalReceiptSources: readonly [{ source: 'freee'; responsibility: 'external-confirmation' }];
}

/* -------- 改善要望(system-spec D5〜D9) -------- */

export interface ImprovementRequestView {
  id: string;
  title: string;
  body: string;
  route: string;
  status: ImprovementStatus;
  screenshot: { available: boolean; size: number | null };
  diagnostics: { available: boolean; entryCount: number; omittedCount: number };
  token: {
    status: 'none' | 'active' | 'expired' | 'exhausted';
    expiresAt: string | null;
    fetchCount: number;
  };
  copiedAt: string | null;
  copiedTarget: 'claude_code' | 'codex' | null;
  doneAt: string | null;
  purgedAt: string | null;
  /** 添付が消える予定時刻。未完了は null(調査中に証跡を消さない) */
  attachmentExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementCreateResponse {
  request: ImprovementRequestView;
  /** トークン原文を含む指示文。作成時のこの1回だけ返る */
  prompt: string;
  /** 画像を受け付けなかった理由。null は問題なし */
  screenshotRejected: 'too_large' | 'unsupported_type' | null;
  diagnosticsRejected: boolean;
}

export interface ImprovementDetailResponse {
  request: ImprovementRequestView;
  diagnostics: DiagnosticPayload | null;
}

export const listImprovements = () => api<{ requests: ImprovementRequestView[] }>('/improvements');

export const getImprovement = (id: string) => api<ImprovementDetailResponse>(`/improvements/${id}`);

/**
 * 改善要望の投稿。スクリーンショットは multipart で送るため apiUpload を使う。
 * 画像が無くても投稿は成立する(撮影の失敗は投稿の失敗ではない)。
 */
export function createImprovement(input: {
  title: string;
  body: string;
  route: string;
  diagnostics: DiagnosticPayload;
  screenshot: File | null;
}): Promise<ImprovementCreateResponse> {
  const form = new FormData();
  form.set('title', input.title);
  form.set('body', input.body);
  form.set('route', input.route);
  form.set('diagnostics', JSON.stringify(input.diagnostics));
  if (input.screenshot) form.set('screenshot', input.screenshot);
  return apiUpload<ImprovementCreateResponse>('/improvements', form);
}

/** 指示文の作り直し。前に配った指示文はこの時点で失効する */
export const reissueImprovementPrompt = (id: string) =>
  api<{ prompt: string; expiresAt: string }>(`/improvements/${id}/prompt`, { method: 'POST' });

export const markImprovementCopied = (id: string, target: 'claude_code' | 'codex') =>
  api<{ ok: true; copiedAt: string }>(`/improvements/${id}/copied`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });

export const setImprovementStatus = (id: string, status: ImprovementStatus) =>
  api<{ request: ImprovementRequestView }>(`/improvements/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });

/** スクリーンショットの取得先。R2 の公開URLではなく必ず Worker を通す */
export const improvementScreenshotUrl = (id: string) => `/api/improvements/${id}/screenshot`;
