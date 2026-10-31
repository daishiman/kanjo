/**
 * 明細が 1 件も無い月の空状態 (spec-cash-screen FR-17)。
 * 「サンプルデータを表示」は画面の中だけの見本で、保存も集計もしない。
 */
import { Button } from '../../components/Button.js';

export function EmptyState({
  showingSamples,
  onStart,
  onToggleSamples,
}: {
  showingSamples: boolean;
  onStart: () => void;
  onToggleSamples: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <output> は文中の要素しか入れられず、見出しとボタンを持つ空の状態を包めない
    <div className="cash-empty" role="status">
      <p className="cash-empty-title">現金・交通費の明細がありません</p>
      <p className="sub">上のフォームから現金明細を入力して、記録を始めましょう。</p>
      <div className="cash-form-actions">
        <Button variant="primary" onClick={onStart}>
          はじめての明細を入力
        </Button>
        <Button aria-pressed={showingSamples} onClick={onToggleSamples}>
          {showingSamples ? 'サンプルを隠す' : 'サンプルデータを表示'}
        </Button>
      </div>
    </div>
  );
}
