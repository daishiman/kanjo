import type { TradeoffSimulationResult } from '@kanjo/core';
import { yen } from '../../format.js';
import { diffSentence, signedYen } from './view-model.js';

const ASSUMPTIONS = [
  '毎月の支出は月額×12、単発の支出は発生月だけに計上',
  '見直しの削減は選んだ候補の月額合計×12',
  '税・手数料は考慮しない',
  '開始月は年額に影響しない',
];

/**
 * 右の試算結果 (FR-4 / FR-10)。数字は `tradeoffSimulation` の結果だけを読む。
 * 状態は色だけで伝えず、差額の警告と防衛ラインの判定は文字で出す。
 */
export function SimulationPanel({
  result,
  hasAmount,
  expense,
  selectedCount,
}: {
  result: TradeoffSimulationResult;
  hasAmount: boolean;
  expense: { title: string; amount: number | null; recurring: boolean };
  selectedCount: number;
}) {
  const diff = diffSentence(result.annualDiff);
  return (
    <section className="card tradeoff-panel" aria-label="試算結果">
      <h2>試算結果</h2>
      <section className="tradeoff-summary-block" aria-labelledby="tradeoff-new-expense-summary">
        <h3 id="tradeoff-new-expense-summary">新しい支出（追加コスト）</h3>
        <dl className="tradeoff-figures">
          <div>
            <dt>支出名</dt>
            <dd>{expense.title.trim() || '未入力'}</dd>
          </div>
          <div>
            <dt>頻度</dt>
            <dd>{expense.recurring ? '毎月' : '単発'}</dd>
          </div>
          <div>
            <dt>月額</dt>
            <dd className="num">
              {expense.recurring && expense.amount !== null ? yen(expense.amount) : '—'}
            </dd>
          </div>
          <div>
            <dt>新しい支出（年間）</dt>
            <dd className="num">{yen(result.annualCost)}</dd>
          </div>
        </dl>
      </section>

      <section className="tradeoff-summary-block" aria-labelledby="tradeoff-saving-summary">
        <h3 id="tradeoff-saving-summary">見直しによる削減額（選択合計）</h3>
        <dl className="tradeoff-figures">
          <div>
            <dt>選択件数</dt>
            <dd>{selectedCount} 件</dd>
          </div>
          <div>
            <dt>削減額（月額）</dt>
            <dd className="num">{yen(result.monthlySaving)}</dd>
          </div>
          <div>
            <dt>見直しによる削減額（年間）</dt>
            <dd className="num">{yen(result.annualSaving)}</dd>
          </div>
        </dl>
      </section>

      <dl className="tradeoff-figures tradeoff-difference">
        <div className="tradeoff-figures-total">
          <dt>差額（年間）</dt>
          <dd className={`num ${result.annualDiff > 0 ? 'tradeoff-over' : 'tradeoff-ok'}`}>
            {signedYen(result.annualDiff)}
          </dd>
        </div>
      </dl>
      {hasAmount &&
        (diff.warn ? (
          <p className="tradeoff-message tradeoff-message--warn" role="alert">
            {diff.text}
          </p>
        ) : (
          <p className="tradeoff-message tradeoff-message--ok">{diff.text}</p>
        ))}

      <h3>防衛ラインへの影響</h3>
      {result.marginAnnual == null || result.afterMargin == null ? (
        <p className="sub">記帳済みの月が無いため、防衛ラインへの影響は計算できません</p>
      ) : (
        <div className="tradeoff-defense">
          <p className="num">{`年間の余裕 ${yen(result.marginAnnual)} → 試算後 ${yen(result.afterMargin)}`}</p>
          <span className={`tradeoff-defense-verdict tradeoff-defense-verdict--${result.defense}`}>
            {result.defense === 'break' ? '割れる' : '維持'}
          </span>
        </div>
      )}

      <h3>計算の前提</h3>
      <ul className="tradeoff-assumptions">
        {ASSUMPTIONS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
