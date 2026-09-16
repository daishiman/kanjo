import { useEffect, useRef } from 'react';
import { Button } from '../../../components/Button.js';
import { ConfirmDialog } from '../../../components/ConfirmDialog.js';
import { useConfirmDialog } from '../../../components/use-confirm-dialog.js';
import type { ReconciliationActionKind } from './api.js';
import { type ReconciliationRow, bulkMatchRows, isBulkMatchable, isPending } from './model.js';

export function SelectionActions({
  selectedRows,
  busy,
  onClear,
  onRun,
}: {
  selectedRows: readonly ReconciliationRow[];
  busy: boolean;
  onClear: () => void;
  onRun: (action: ReconciliationActionKind, rows: readonly ReconciliationRow[]) => void;
}) {
  const matchDialog = useConfirmDialog();
  const differentDialog = useConfirmDialog();
  const excludeDialog = useConfirmDialog();
  const wasBusy = useRef(false);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      matchDialog.close();
      differentDialog.close();
      excludeDialog.close();
    }
    wasBusy.current = busy;
  }, [busy, differentDialog, excludeDialog, matchDialog]);

  if (selectedRows.length === 0) return null;

  const matchRows = bulkMatchRows(selectedRows);
  const matchSkipped = selectedRows.length - matchRows.length;
  // API は「別の取引」でも freee 候補を指す行だけ受け付ける。
  // 「同じ取引」と違い、複数行が同じ候補を指す場合の重複除外は不要。
  const differentRows = selectedRows.filter(isBulkMatchable);
  const differentSkipped = selectedRows.length - differentRows.length;
  const excludeRows = selectedRows.filter(isPending);
  const excludeSkipped = selectedRows.length - excludeRows.length;

  return (
    <>
      <section className="recon-selection" aria-label="選択中の取引">
        <p>
          <span className="recon-selection-count" aria-hidden="true">
            {selectedRows.length}
          </span>
          {selectedRows.length}件選択中
          {matchRows.length < selectedRows.length && `（照合できるのは${matchRows.length}件）`}
        </p>
        <Button variant="text" onClick={onClear}>
          選択をクリア
        </Button>
        <Button
          ref={excludeDialog.triggerRef}
          variant="text"
          disabled={busy || excludeRows.length === 0}
          onClick={() => excludeDialog.setOpen(true)}
        >
          選択した取引を照合から除外
        </Button>
        <Button
          ref={differentDialog.triggerRef}
          variant="secondary"
          disabled={busy || differentRows.length === 0}
          onClick={() => differentDialog.setOpen(true)}
        >
          選択した取引を別の取引として処理
        </Button>
        <Button
          ref={matchDialog.triggerRef}
          variant="primary"
          disabled={busy || matchRows.length === 0}
          onClick={() => matchDialog.setOpen(true)}
        >
          選択した取引を照合
        </Button>
      </section>

      {excludeDialog.open && excludeRows.length > 0 && (
        <ConfirmDialog
          dialog={{ ...excludeDialog, busy }}
          title="選択した取引を照合から除外しますか？"
          confirmLabel={`${excludeRows.length}件を除外する`}
          busyLabel="除外しています…"
          onConfirm={() => onRun('exclude-mf', excludeRows)}
          onDismiss={excludeDialog.close}
        >
          <p>
            選択した{selectedRows.length}件のうち、対応待ちの{excludeRows.length}
            件を照合の対象から外します。一覧の状態は「除外」になり、対応キューと解消率から外れます。総収支の金額は変わりません。直後なら「元に戻す」で取り消せます。
          </p>
          {excludeSkipped > 0 && <p>確認のみ・照合済み・除外済みの{excludeSkipped}件は送りません。</p>}
        </ConfirmDialog>
      )}

      {differentDialog.open && differentRows.length > 0 && (
        <ConfirmDialog
          dialog={{ ...differentDialog, busy }}
          title="選択した取引を別の取引として処理しますか？"
          confirmLabel={`${differentRows.length}件を別の取引にする`}
          busyLabel="処理しています…"
          onConfirm={() => onRun('different', differentRows)}
          onDismiss={differentDialog.close}
        >
          <p>
            選択した{selectedRows.length}件のうち、未解消でfreeeの候補がある{differentRows.length}
            件を、freeeの候補とは別の取引として処理します。総収支にはMFの金額で計上されます。直後なら「元に戻す」で取り消せます。
          </p>
          {differentSkipped > 0 && (
            <p>
              freeeの候補が無い、または照合済み・MFのみ・除外済みの{differentSkipped}
              件は送らずに残します。
            </p>
          )}
        </ConfirmDialog>
      )}

      {matchDialog.open && matchRows.length > 0 && (
        <ConfirmDialog
          dialog={{ ...matchDialog, busy }}
          title="選択した取引を照合しますか？"
          confirmLabel={`${matchRows.length}件を照合する`}
          busyLabel="照合しています…"
          onConfirm={() => onRun('same', matchRows)}
          onDismiss={matchDialog.close}
        >
          <p>
            選択した{selectedRows.length}件のうち、未解消でfreeeの候補がある{matchRows.length}
            件を、それぞれの候補と同じ取引として照合します。直後なら「元に戻す」で取り消せます。
          </p>
          {matchSkipped > 0 && (
            <p>
              照合済み・MFのみ・除外済み、freeeの候補が無い、または別の選択と同じ候補を指す{matchSkipped}
              件は送らずに残します。
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
