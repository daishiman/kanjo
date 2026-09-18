/**
 * サブスク画面の更新系。読み取りは画面側の useQuery が持ち、ここは送るだけにする。
 * 失敗は ApiError のまま投げ、画面上部の通知が文言に言い換える (楽観更新はしない)。
 */
import type { SubsReviewDecisionKind } from '@kanjo/core';
import { type SubVendorExclusionRow, type SubVendorRow, api } from '../../api.js';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export interface SubVendorsResponse {
  vendors: SubVendorRow[];
  accountOptions: string[];
}

export interface SubCandidatesResponse {
  excluded: SubVendorExclusionRow[];
}

/**
 * 指紋はサーバが「表示中と同じ期間」で求める。期間を付け忘れると全期間の指紋で保存され、
 * 直近 1 年などの表示では指紋が合わずに候補が消えない。呼び出し側の usePeriod().withPeriod を必ず渡す。
 */
export const postReviewDecision = (
  vendorKey: string,
  decision: SubsReviewDecisionKind,
  withPeriod: (path: string) => string,
) => api<{ ok: true }>(withPeriod('/subscriptions/review-decisions'), json('POST', { vendorKey, decision }));

export const deleteReviewDecision = (vendorKey: string) =>
  api<{ ok: true }>('/subscriptions/review-decisions', json('DELETE', { vendorKey }));

export const postSubVendor = (name: string) =>
  api<{ ok: true }>('/sub-vendors', json('POST', { name, aliases: [], accounts: [] }));

export const putSubVendor = (
  id: number,
  patch: { name?: string; aliases?: string[]; accounts?: string[]; category?: string | null },
) => api<{ ok: true }>(`/sub-vendors/${id}`, json('PUT', patch));

export const postSubVendorAliases = (id: number, aliases: string[]) =>
  api<{ ok: true; aliases: string[] }>(`/sub-vendors/${id}/aliases`, json('POST', { aliases }));

export const deleteSubVendor = (id: number) => api<{ ok: true }>(`/sub-vendors/${id}`, { method: 'DELETE' });

export const postExclusion = (partner: string) =>
  api<{ ok: true }>('/sub-vendors/exclusions', json('POST', { partner }));

export const deleteExclusion = (id: number) =>
  api<{ ok: true }>(`/sub-vendors/exclusions/${id}`, { method: 'DELETE' });

export const postVendorReview = (id: number) =>
  api<{ ok: true; reviewedAt: string }>(`/sub-vendors/${id}/review`, { method: 'POST' });
