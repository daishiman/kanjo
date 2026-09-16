import { Button } from '../../../components/Button.js';
import { UiIcon } from '../../../components/UiIcon.js';
import type { ReconciliationActionKind, ReconciliationActionResponse } from './api.js';
import { ACTION_LABELS } from './model.js';

const FAILURE_LABELS: Record<string, string> = {
  not_found: '明細が見つかりません',
  freee_key_required: 'freeeの候補がありません',
  freee_not_found: 'freeeの取引が見つかりません',
  tx_id_required: 'MoneyForwardの明細が指定されていません',
  unstable_identity: '同じ内容の明細が複数あり特定できません',
  no_candidate: 'freeeの候補がありません',
  freee_not_pairable: '向き・日付が合わず同じ取引として照合できません',
  duplicate_target: '同じ明細を重ねて指定しています',
  freee_excluded: 'freeeの候補が照合から除外されています',
  freee_already_matched: 'freeeの候補が別の明細と照合済みです',
  not_matchable: '照合の条件に合わず同じ取引にできません。別の取引として処理してください',
  target_not_actionable: 'すでに判断済みの明細のため、この操作は必要ありません',
};

export function OperationResult({
  response,
  action,
}: {
  response: ReconciliationActionResponse;
  action: ReconciliationActionKind;
}) {
  const failed = response.results.filter((item) => !item.ok);
  const reasons = [
    ...new Set(failed.map((item) => FAILURE_LABELS[item.reason ?? ''] ?? '保存できない明細です')),
  ];
  return (
    <div
      className={`recon-message${failed.length ? ' is-partial' : ' is-done'}`}
      // biome-ignore lint/a11y/useSemanticElements: output は phrasing content に限られ、結果の本文 p を入れられないため status を付ける。
      role="status"
      aria-label="操作の結果"
    >
      <UiIcon name={failed.length ? 'warning' : 'check'} />
      <p>
        {response.saved}件を保存しました（{ACTION_LABELS[action]}）。
        {failed.length > 0 && `${failed.length}件は保存できませんでした（${reasons.join('、')}）。`}
      </p>
    </div>
  );
}

export function FailureNotice({
  message,
  retryable,
  busy,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="recon-message is-error" role="alert">
      <p>{message}</p>
      {retryable && (
        <Button variant="secondary" onClick={onRetry} disabled={busy}>
          <UiIcon name="refresh" />
          再試行する
        </Button>
      )}
    </div>
  );
}
