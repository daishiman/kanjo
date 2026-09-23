/**
 * 画面下の固定バー (spec-cash-screen FR-18)。
 * 左に下書きの保存時刻、右に選んでいるタブの追加ボタンを置く。押すと該当カードの送信と同じ処理を呼ぶ。
 */
import { Button } from '../../components/Button.js';
import type { CashTab } from './view-model.js';

export function StickyBar({
  tab,
  editing,
  busy,
  disabled,
  draftSavedLabel,
  onSubmit,
}: {
  tab: CashTab;
  editing: boolean;
  busy: boolean;
  disabled: boolean;
  draftSavedLabel: string | null;
  onSubmit: () => void;
}) {
  const label = editing
    ? '変更を保存'
    : tab === 'transit'
      ? 'この内容で交通費を追加'
      : 'この内容で現金明細を追加';
  return (
    <div className="cash-sticky">
      <span className="sub cash-draft-time">
        {draftSavedLabel ? `下書きが保存されています ${draftSavedLabel}` : ''}
      </span>
      <Button variant="primary" disabled={busy || disabled} onClick={onSubmit}>
        {busy ? '保存中…' : label}
      </Button>
    </div>
  );
}
