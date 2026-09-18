import type { DiagnosisScreen } from '../../../api.js';
import { yen } from '../../../format.js';
import { METRIC_ANNUAL_LABEL } from './types.js';

/**
 * 完了すると変わる指標。
 *
 * 出す数は core が返した 3 つ (現状・改善後・差額) だけにして、ここで割り算をしない。
 * 画面で月額へ割り直すと、表の年額と丸めの位置が変わって別の数字に見えるため (BR-002)。
 */
export function DiagnosisOutcome({ screen }: { screen: DiagnosisScreen }) {
  const { waterfall, totals } = screen;
  if (waterfall.length < 2) return null;
  const base = waterfall[0];
  const result = waterfall[waterfall.length - 1];
  const metricLabel = METRIC_ANNUAL_LABEL[screen.selection.metric];
  return (
    <section className="card diagnosis-outcome" aria-label="完了すると変わる指標">
      <h2>完了すると変わる指標</h2>
      <dl className="diagnosis-outcome-list">
        <div>
          <dt>{metricLabel}</dt>
          <dd>
            <span className="num">{yen(base.to)}</span>
            <span aria-hidden="true">→</span>
            <strong className="num">{yen(result.to)}</strong>
          </dd>
        </div>
        <div>
          <dt>未対応アクション</dt>
          <dd>
            <span className="num">{totals.activeCount} 件</span>
            <span aria-hidden="true">→</span>
            <strong className="num">0 件</strong>
          </dd>
        </div>
        <div>
          <dt>年間の改善見込み</dt>
          <dd>
            <span className="num">¥0</span>
            <span aria-hidden="true">→</span>
            <strong className="num">{yen(totals.active)}</strong>
          </dd>
        </div>
      </dl>
      <p className="sub">
        健全性スコアは実績から計算します。ステータスを変えても点は動かず、明細が入れ替わった次の取込で反映されます。
      </p>
    </section>
  );
}
