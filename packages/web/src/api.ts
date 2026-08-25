/**
 * APIクライアント。401はグローバルイベントで通知しログイン画面へ切り替える。
 * 型は @kanjo/core の分析出力型をそのまま利用する(サーバと完全一致)。
 */
import type {
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
} from '@kanjo/core';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const AUTH_EVENT = 'kanjo:unauthorized';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new ApiError(401, 'unauthorized', '認証が必要です');
  }
  if (!res.ok) {
    let code = 'error';
    let message = `エラー(${res.status})`;
    try {
      const body = (await res.json()) as { error?: { code: string; message: string } };
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // JSONでないエラーはそのまま
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

/* -------- エンドポイント別の型 -------- */

export interface SummaryResponse {
  overview: OverviewData;
  defense: DefenseLine;
  benchmarks: Benchmark[];
}

export type Owner = 'self' | 'spouse';
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
  uses: { edits: number; rules: number };
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
    incomeByOwner: { self: number; spouse: number; unset: number };
    editedCount: number;
    conflictCount: number;
    noInstitutionCount: number;
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

export const OWNER_LABEL: Record<Owner | 'unset', string> = { self: '本人', spouse: '妻', unset: '未設定' };
export const ownerLabel = (o: Owner | null | undefined): string => OWNER_LABEL[o ?? 'unset'];

export interface ImportUnitResult {
  filename: string;
  kind: string;
  months: string[];
  rows: number;
  skipped: number;
  syntheticIds?: number;
  duplicateIds?: number;
  status: 'ok' | 'error';
  reason?: string;
}

export interface ImportHistoryRow {
  id: number;
  filename: string;
  kind: string | null;
  months: string[];
  rows: number | null;
  status: string | null;
  createdAt: string | null;
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
  split: '事業/個人・本人/妻の別',
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
export interface AiReportSection {
  id: AiSectionId;
  title: string;
  body: string;
  items: AiReportItem[];
}
export interface AiReportNeed {
  gap: string;
  action: string;
  screen: AiNeedScreen | null;
}
export interface AiReportChart {
  id: string;
  kind: 'bar' | 'line' | 'stackedBar';
  title: string;
  unit: 'yen' | 'pct' | 'count';
  labels: string[];
  series: { label: string; data: (number | null)[] }[];
  note: string;
}
export interface AiReportBody {
  version: 2;
  generatedBy: string;
  model: string | null;
  title: string;
  summary: string;
  keyFindings: { improvements: AiReportItem[]; wasted: AiReportItem[]; quickWins: AiReportItem[] };
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
