/**
 * 削除の確認 (spec-cash-screen FR-14 / FR-15)。
 *
 * モーダルでなく一覧の直下に開く。押した行と消える行がずれないよう、対象の明細そのものを受け取る。
 * 失敗したときは閉じずに文を出す (利用者がもう一度押せるように)。
 * 一覧の下に開くので、開いたら「キャンセル」へフォーカスを移し、Escape で閉じる
 * (キーボードで行の「削除」を押した人が、一覧を Tab で辿り直さずに答えられるように)。
 */
import { useEffect, useRef } from 'react';
import type { CashEntry } from '../../api.js';
import { Button } from '../../components/Button.js';
import { cashAmount, cashCategoryLabel, cashDateLabel } from './view-model.js';

export function DeleteConfirm({
  targets,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  /** 1 件なら単体の確認、2 件以上なら一括の確認 */
  targets: CashEntry[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const targetKey = targets.map((e) => e.id).join(',');
  useEffect(() => {
    if (targetKey) cancelRef.current?.focus();
  }, [targetKey]);
  if (targets.length === 0) return null;
  const single = targets.length === 1 ? targets[0]! : null;
  const total = targets.reduce((sum, e) => sum + e.amount, 0);
  return (
    <div
      className="cash-confirm"
      role="alertdialog"
      aria-labelledby="cash-confirm-title"
      aria-describedby="cash-confirm-desc"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <p id="cash-confirm-title" className="cash-confirm-title">
        {single ? 'この明細を削除しますか？' : `選択した ${targets.length} 件の明細を削除しますか？`}
      </p>
      <p id="cash-confirm-desc" className="sub">
        削除すると、このデータは一覧から取り除かれます。
      </p>
      {single ? (
        <p className="cash-confirm-target">
          {cashDateLabel(single.date)} {single.description}（{cashCategoryLabel(single)}）
          <strong className="num"> {cashAmount(single.amount)} 円</strong>
        </p>
      ) : (
        <p className="cash-confirm-target">
          {targets.length} 件 / 合計 <strong className="num">{cashAmount(total)} 円</strong>
        </p>
      )}
      {error && (
        <p className="cash-error" role="alert">
          {error}
        </p>
      )}
      <div className="cash-form-actions">
        <Button ref={cancelRef} onClick={onCancel} disabled={busy}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? '削除中…' : '削除する'}
        </Button>
      </div>
    </div>
  );
}
