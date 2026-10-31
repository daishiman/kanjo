/** API と画面が共有する操作履歴の公開契約。保存用の本文・キーは含めない。 */
export type SubscriptionOperationKind =
  | 'merge'
  | 'unmerge'
  | 'vendor_create'
  | 'vendor_update'
  | 'vendor_delete'
  | 'review'
  | 'review_decision'
  | 'exclusion';

export type SubscriptionUndoBlockedReason =
  | 'not_merge'
  | 'already_undone'
  | 'undo_expired'
  | 'undo_blocked_by_later_operation';

/** 取り消せない理由の文言。API のエラーと画面の表示が同じ文を使う (not_merge は API が 404 not_found で返す) */
export const SUBSCRIPTION_UNDO_BLOCKED_MESSAGE: Record<
  Exclude<SubscriptionUndoBlockedReason, 'not_merge'>,
  string
> = {
  already_undone: 'すでに元に戻されています',
  undo_expired: '統合から 30 日を過ぎたため元に戻せません',
  undo_blocked_by_later_operation:
    'この統合の後に別の操作があるため元に戻せません。後の操作から順に戻してください',
};

export interface SubscriptionOperationRecord {
  id: string;
  kind: SubscriptionOperationKind;
  targetVendorName: string | null;
  createdAt: string;
  actorEmail: string | null;
  undoneAt: string | null;
  undoneByEmail: string | null;
  undoable: boolean;
  undoBlockedReason: SubscriptionUndoBlockedReason | null;
}
