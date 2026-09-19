import type { DiagnosisScreen } from '../../../api.js';
import { deltaCls, pct, yen, yenS } from '../../../format.js';
import { SegmentControl } from '../SegmentControl.js';
import { COMPARES, METRICS, SCOPES, type Update } from './types.js';

const labelOf = (list: readonly { id: string; label: string }[], id: string): string =>
  list.find((item) => item.id === id)?.label ?? id;

/** 増減は符号を文字で出す。色だけだと増えたのか減ったのかが読めない (AC-001) */
const signed = (value: number): string => (value > 0 ? `+${yen(value)}` : yenS(value));

/**
 * 条件の帯が選んだ範囲・指標の期間合計 (BR-004)。
 *
 * 値は総収支画面と同じ月次系列から来る。帯を切り替えても数字が動かないと、
 * 「範囲を選んだつもりが選べていない」のか「本当に同じ額」なのかを利用者が判別できない。
 */
function ScopeTotal({ screen }: { screen: DiagnosisScreen }) {
  const totals = screen.scopeTotals;
  if (!totals) return null;
  const { selection } = screen;
  const scope = labelOf(SCOPES, selection.scope);
  const metric = labelOf(METRICS, selection.metric);
  return (
    <p className="diagnosis-condition-total">
      <span className="diagnosis-condition-label">
        {scope}の{metric} (期間合計)
      </span>
      <span className="num diagnosis-condition-value">{yen(totals.current)}</span>
      {totals.diff === null ? (
        <span className="sub">{totals.baselineLabel}は取込済みの月が足りず比較できません</span>
      ) : (
        <span className="sub">
          {totals.baselineLabel}比{' '}
          <span className={`num ${deltaCls(totals.diff)}`}>{signed(totals.diff)}</span>
          {totals.rate === null ? null : <span className="num"> ({pct(totals.rate, 1)})</span>}
        </span>
      )}
    </p>
  );
}

/**
 * 条件の帯 (範囲 / 指標 / 比較対象)。
 * 選択中の値はサーバが解決した `selection` を正本にする。URL の生値を直接読まないのは、
 * 未知の値が来たときにサーバが既定へ倒した結果と帯の表示がずれないようにするため。
 */
export function DiagnosisConditions({ screen, update }: { screen: DiagnosisScreen; update: Update }) {
  const selection = screen.selection;
  return (
    <section className="card diagnosis-conditions" aria-label="診断の条件">
      <div className="diagnosis-condition-group">
        <span className="diagnosis-condition-label">分析の範囲</span>
        <SegmentControl
          ariaLabel="分析の範囲"
          kind="tabs"
          options={SCOPES}
          value={selection.scope}
          onChange={(scope) => update({ scope, action: null })}
        />
      </div>
      <div className="diagnosis-condition-group">
        <span className="diagnosis-condition-label">表示する指標</span>
        <SegmentControl
          ariaLabel="表示する指標"
          kind="toggle"
          options={METRICS}
          value={selection.metric}
          onChange={(metric) => update({ metric })}
        />
      </div>
      <div className="diagnosis-condition-group">
        <span className="diagnosis-condition-label">比較対象</span>
        <SegmentControl
          ariaLabel="比較対象"
          kind="toggle"
          options={COMPARES}
          value={selection.compare}
          onChange={(compare) => update({ compare })}
        />
      </div>
      <ScopeTotal screen={screen} />
    </section>
  );
}
