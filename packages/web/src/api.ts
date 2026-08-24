/**
 * APIクライアント。401はグローバルイベントで通知しログイン画面へ切り替える。
 * 型は @kanjo/core の分析出力型をそのまま利用する(サーバと完全一致)。
 */
import type {
  BudgetRow,
  DefenseLine,
  DiagnosisData,
  HouseholdData,
  MatrixData,
  OverviewData,
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
}

export interface TxRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  big: string;
  mid: string;
  cls: 'biz' | 'per';
  src: '手動' | 'ルール' | '既定';
}

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
  };
  transactions: TxRow[];
}

export interface RuleRow {
  id: number;
  keyword: string;
  cls: 'biz' | 'per';
  sortOrder: number;
  hits: number;
}

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
  BudgetRow,
  DefenseLine,
  DiagnosisData,
  HouseholdData,
  MatrixData,
  OverviewData,
  SubscriptionsData,
  TradeoffCandidate,
};
