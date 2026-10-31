import type { TradeoffSimulationResult } from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { PageActions } from '../../components/Page.js';
import { yen } from '../../format.js';
import { signedYen } from './view-model.js';

/**
 * 下部の選択中バー (FR-11 / FR-12)。1 件以上選んだときだけ出す。
 * 削減額と差額は右の試算結果と同じ `tradeoffSimulation` の結果を読み、別に計算しない。
 */
export function SelectionBar({
  count,
  result,
  canSubmit,
  disabledReason,
  busy,
  status,
  onClear,
  onSubmit,
}: {
  count: number;
  result: TradeoffSimulationResult;
  /** 金額が 1〜1 億円の整数で入っているか */
  canSubmit: boolean;
  /** CTA を押せないとき、次にすべきこと */
  disabledReason: string | null;
  busy: boolean;
  status: { tone: 'success' | 'error'; text: string } | null;
  onClear: () => void;
  onSubmit: () => void;
}) {
  if (!count) return null;
  return (
    // 名前付きの section は region として読まれる (画面下端の固定バー)
    <section className="tradeoff-selection" aria-label="選択中の候補">
      <p aria-live="polite">{count} 件を選択中</p>
      <dl className="tradeoff-selection-figures">
        <div>
          <dt>削減額（年間）</dt>
          <dd className="num">{yen(result.annualSaving)}</dd>
        </div>
        <div>
          <dt>差額（年間）</dt>
          <dd className={`num ${result.annualDiff > 0 ? 'tradeoff-over' : 'tradeoff-ok'}`}>
            {signedYen(result.annualDiff)}
          </dd>
        </div>
      </dl>
      <PageActions className="tradeoff-selection-actions">
        <Button onClick={onClear}>選択をクリア</Button>
        <Button
          variant="primary"
          disabled={busy || !canSubmit}
          aria-describedby={disabledReason ? 'tradeoff-submit-help' : undefined}
          onClick={onSubmit}
        >
          {busy ? '記録中…' : 'この試算を記録する'}
        </Button>
      </PageActions>
      {(disabledReason || status) && (
        <div className="tradeoff-selection-feedback">
          {disabledReason && <p id="tradeoff-submit-help">{disabledReason}</p>}
          {status && (
            <p
              className={`tradeoff-submit-status tradeoff-submit-status--${status.tone}`}
              role={status.tone === 'error' ? 'alert' : 'status'}
            >
              {status.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
