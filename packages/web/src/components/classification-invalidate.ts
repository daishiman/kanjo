/**
 * 仕分け結果に触れたときに作り直す問い合わせの一覧。
 * 科目の追加(CategoryPicker)と設定画面(ClassificationSettings)の両方から使うため、
 * どちらにも依存しない場所に置く。
 */
import { useQueryClient } from '@tanstack/react-query';

export function useInvalidateClassification() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['rules'] });
    void qc.invalidateQueries({ queryKey: ['classification'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['household'] });
    void qc.invalidateQueries({ queryKey: ['cash-entries'] });
  };
}
