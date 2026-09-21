/**
 * 一括操作バー (spec-classify-screen 7.8)。
 *
 * 選択が 1 件でもある間だけ出す。件数を読み上げるのは、
 * 押す前に「何件に効くのか」を数え直さずに済ませるため。
 */
import { useState } from 'react';
import type { ClassifyRow } from '../../api.js';
import { Button } from '../../components/Button.js';
import { amountText, dateText } from './view-model.js';

export function BulkActionBar({
  selected,
  rows,
  busy,
  onClear,
  onSave,
}: {
  selected: string[];
  rows: ClassifyRow[];
  busy: boolean;
  onClear: () => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (selected.length === 0) return null;
  const picked = rows.filter((r) => selected.includes(r.rowKey));

  return (
    <section className="classify-bulk-bar" aria-label="一括操作">
      <span>{`${selected.length} 件選択中`}</span>
      <Button variant="text" size="mini" onClick={onClear} disabled={busy}>
        選択をクリア
      </Button>
      <Button variant="primary" size="mini" onClick={onSave} disabled={busy}>
        {busy ? '保存しています…' : `選択した${selected.length}件を保存`}
      </Button>
      <button
        type="button"
        data-native-control="disclosure"
        aria-expanded={open}
        aria-label="選択中の明細を表示"
        className="classify-bulk-toggle"
        onClick={() => setOpen(!open)}
      >
        ^
      </button>
      {open && (
        <ul className="classify-bulk-list">
          {picked.map((r) => (
            <li key={r.rowKey}>
              {dateText(r.date)} {r.payee} {amountText(r.amount)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
