import type { UiIconName } from '../../../components/UiIcon.js';
import { yen } from '../../../format.js';
import type { ReconciliationActionKind, ReconciliationResponse, ReconciliationTarget } from './api.js';

export type ReconciliationRow = ReconciliationResponse['rows'][number];
export type ReconciliationStatus = ReconciliationRow['status'];
export type ReconciliationQueue = ReconciliationRow['queues'][number];
/** 一覧は全行がMF取引起点。「ソース」ではなくfreee候補の有無を絞る。 */
export type CandidateAvailability = 'all' | 'withoutCandidate' | 'withCandidate';

export interface ReconciliationFilters {
  candidate: CandidateAvailability;
  status: ReconciliationStatus | 'all';
  month: string;
  queue: ReconciliationQueue | null;
  search: string;
}

export interface OperationRequest {
  action: ReconciliationActionKind;
  targets: ReconciliationTarget[];
}

export const INITIAL_FILTERS: ReconciliationFilters = {
  candidate: 'all',
  status: 'all',
  month: 'all',
  queue: null,
  search: '',
};

export const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  unprocessed: '未処理',
  review: '要確認',
  matched: '照合済み',
  mfOnly: 'MFのみ',
  excluded: '除外',
};

export const ACTION_LABELS: Record<ReconciliationActionKind, string> = {
  same: '『同じ取引』として照合',
  different: '『別の取引』として処理',
  'exclude-mf': '照合から除外',
  'exclude-freee': 'freeeの取引を照合から除外',
};

export const STATUS_ORDER: readonly ReconciliationStatus[] = [
  'unprocessed',
  'review',
  'matched',
  'mfOnly',
  'excluded',
];

export type QueueItem = {
  id: ReconciliationQueue;
  label: string;
  note: string;
  icon: UiIconName;
};

export const ACTION_QUEUES: readonly QueueItem[] = [
  { id: 'review', label: '要確認の候補', note: '内容を確認して照合', icon: 'alert' },
  { id: 'amountMismatch', label: '金額の差異', note: '金額が一致しません', icon: 'alert' },
  { id: 'nearDate', label: '日付の近い取引', note: '前後3日以内', icon: 'clock' },
];

export const INFO_QUEUES: readonly QueueItem[] = [
  { id: 'mfOnly', label: 'MFのみの支出', note: '総収支に計上済み・対応不要', icon: 'info' },
];

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const SUMMARY_PREVIEW_SIZE = 3;
export const NARROW_QUERY = '(max-width: 1023px)';

export const isPending = (row: ReconciliationRow) => row.status === 'review' || row.status === 'unprocessed';

export const targetOf = (row: ReconciliationRow, action: ReconciliationActionKind): ReconciliationTarget => ({
  txId: row.txId,
  ...(action === 'same' ? { freeeKey: row.freee?.freeeKey ?? row.candidateKeys[0] } : {}),
});

export const isBulkMatchable = (row: ReconciliationRow) =>
  isPending(row) && Boolean(row.freee?.freeeKey ?? row.candidateKeys[0]);

export function bulkMatchRows(rows: readonly ReconciliationRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!isBulkMatchable(row)) return false;
    const key = targetOf(row, 'same').freeeKey!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchesSearch(row: ReconciliationRow, term: string) {
  if (!term) return true;
  const haystack = [
    row.mf.content,
    row.mf.memo,
    row.mf.institution,
    row.mf.amount,
    row.freee?.partner,
    row.freee?.amount,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join('\n')
    .toLocaleLowerCase('ja');
  return haystack.includes(term.toLocaleLowerCase('ja'));
}

export function filterRows(rows: readonly ReconciliationRow[], filters: ReconciliationFilters) {
  const term = filters.search.trim();
  return rows.filter(
    (row) =>
      (filters.candidate === 'all' ||
        (filters.candidate === 'withoutCandidate' ? row.freee === null : row.freee !== null)) &&
      (filters.status === 'all' || row.status === filters.status) &&
      (filters.month === 'all' || row.month === filters.month) &&
      (filters.queue === null || row.queues.includes(filters.queue)) &&
      matchesSearch(row, term),
  );
}

export type PagerItem = number | { gapAfter: number };

/** 現在地の前後と両端だけを出し、多数ページでも操作列を横へ伸ばさない。 */
export function pagerItems(current: number, total: number): PagerItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) pages.add(2);
  if (current >= total - 2) pages.add(total - 1);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const items: PagerItem[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1]! > 1) items.push({ gapAfter: sorted[index - 1]! });
    items.push(page);
  });
  return items;
}

export const slashDate = (date: string) => date.replaceAll('-', '/');
export const signedYen = (value: number | null) => (value === null ? '—' : value === 0 ? '¥0' : yen(value));
