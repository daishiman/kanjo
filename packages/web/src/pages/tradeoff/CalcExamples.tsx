import { useId } from 'react';
import { CALC_EXAMPLES, diffSentence, plain } from './view-model.js';

/** 計算例 (FR-9)。固定の 2 例を core の試算関数に通した結果で、式を画面に複製しない */
export function CalcExamples() {
  const id = useId();
  return (
    <section className="card tradeoff-step tradeoff-calculations" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>計算例</h2>
      <ul className="tradeoff-examples">
        {CALC_EXAMPLES.map((e) => (
          <li key={e.label}>
            <strong>{e.label}</strong>
            <p>{`${e.recurring ? '毎月' : '単発'} ${plain(e.amount)} 円、見直し 月 ${plain(e.monthlySaving)} 円`}</p>
            <p className="num">
              {`新しい支出 ${plain(e.result.annualCost)} 円 − 削減 ${plain(e.result.annualSaving)} 円 = 差額 ${plain(e.result.annualDiff)} 円`}
            </p>
            <p className="sub">{diffSentence(e.result.annualDiff).text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
