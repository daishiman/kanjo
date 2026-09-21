/**
 * 仕分け結果に触れたときに作り直す問い合わせの一覧。
 * 科目の追加(CategoryPicker)と設定画面(ClassificationSettings)の両方から使うため、
 * どちらにも依存しない場所に置く。
 */
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { invalidateAnalysisDerived } from '../analysis-query-invalidation.js';

export type ClassificationMutation = 'edit' | 'bulk' | 'split' | 'rule' | 'delete' | 'undo' | 'saved-filter';

const SHARED_KEYS = [
  ['classify'],
  ['classify-history'],
  ['classification'],
  ['transactions'],
  ['review-queue'],
  ['overview'],
  ['summary'],
  ['household'],
  ['cash-entries'],
] as const;

/** mutationの影響先を1か所に集め、画面ごとの無効化漏れを防ぐ。 */
export function invalidateClassificationQueries(qc: QueryClient, operation: ClassificationMutation): void {
  if (operation === 'saved-filter') {
    void qc.invalidateQueries({ queryKey: ['classify-saved-filters'] });
    return;
  }
  for (const queryKey of SHARED_KEYS) void qc.invalidateQueries({ queryKey: [...queryKey] });
  if (operation === 'rule') {
    void qc.invalidateQueries({ queryKey: ['rules'] });
    void qc.invalidateQueries({ queryKey: ['classify-rules'] });
  }
  void invalidateAnalysisDerived(qc);
}

export function useInvalidateClassification() {
  const qc = useQueryClient();
  // mutation onSuccess にそのまま渡しても応答bodyをoperationと誤解しないよう無引数に保つ。
  return () => invalidateClassificationQueries(qc, 'edit');
}
