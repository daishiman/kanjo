/** 概況の未処理カード・表・詳細で共有する状態表現の正本。 */
import type { ReviewQueueItem } from '../api.js';
import type { UiIconName } from './UiIcon.js';

export type ReviewTone = 'danger' | 'warning' | 'info';

export const REVIEW_KIND_TONE: Record<ReviewQueueItem['kind'], ReviewTone> = {
  reconciliation: 'danger',
  classification: 'warning',
  import: 'info',
};

export const REVIEW_KIND_ICON: Record<ReviewQueueItem['kind'], UiIconName> = {
  reconciliation: 'alert',
  classification: 'warning',
  import: 'info',
};

/**
 * 表や詳細で一目で判別する短い状態語。操作名の REVIEW_KIND_LABEL とは用途を分ける。
 * 色だけに依存せず、形の異なる icon とこの語を必ず併記する。
 */
export const REVIEW_KIND_STATUS_LABEL: Record<ReviewQueueItem['kind'], string> = {
  reconciliation: '不一致',
  classification: '要仕分け',
  import: '取込',
};
