import type { TradeoffCombo, TradeoffScreenCandidate } from '@kanjo/core';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { yen } from '../../format.js';
import { StepHeading } from './StepHeading.js';
import { candidateName, relatedLabel, sameCandidateKeys } from './view-model.js';

/**
 * 3.推奨の組み合わせ (FR-8)。上位 4 件と、選んだ組み合わせの理由・関連ページを出す。
 * 並びと充足度・しやすさ・リスク・理由の文は core の `tradeoffCombos` の結果をそのまま出す。
 */
export function RecommendationTable({
  combos,
  candidates,
  chosen,
  onChoose,
}: {
  combos: readonly TradeoffCombo[];
  candidates: readonly TradeoffScreenCandidate[];
  /** 選んだ組み合わせ (候補表の選択がこの組み合わせと同じ間だけ渡る) */
  chosen: TradeoffCombo | null;
  onChoose: (combo: TradeoffCombo) => void;
}) {
  const id = useId();
  const byKey = new Map(candidates.map((c) => [c.key, c]));
  const names = (keys: readonly string[]) =>
    keys.map((k) => {
      const c = byKey.get(k);
      return c ? candidateName(c) : k;
    });
  const related = chosen
    ? chosen.keys.flatMap((k) => {
        const c = byKey.get(k);
        return c?.relatedTo ? [c] : [];
      })
    : [];

  return (
    <section className="card tradeoff-step tradeoff-recommendations" aria-labelledby={`${id}-h`}>
      <StepHeading
        id={`${id}-h`}
        number={3}
        title="推奨の組み合わせ"
        description="支出への影響と実行しやすさのバランスから、候補の組み合わせを比較できます。"
      />
      <div className="tradeoff-recommendation-layout">
        {combos.length === 0 ? (
          <p className="empty">選べる候補で新しい支出の年額に届く組み合わせはありません</p>
        ) : (
          <div className="tradeoff-scroll">
            <table
              className="data tradeoff-combos"
              aria-label="推奨の組み合わせ"
              data-table-kind="workflow"
              data-sort-reason="core が決めたリスク・しやすさ・超過額の順位をそのまま見せ、画面で並べ替えない"
            >
              <thead>
                <tr>
                  <th scope="col" className="left">
                    組み合わせ内容
                  </th>
                  <th scope="col">削減額（年間）</th>
                  <th scope="col">充足度</th>
                  <th scope="col">実行のしやすさ</th>
                  <th scope="col">リスク</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((combo) => {
                  const isChosen = Boolean(chosen && sameCandidateKeys(chosen.keys, combo.keys));
                  return (
                    <tr key={JSON.stringify(combo.keys)} className={isChosen ? 'is-selected' : undefined}>
                      <td className="left">
                        <Button variant="text" aria-pressed={isChosen} onClick={() => onChoose(combo)}>
                          {names(combo.keys).join(' ＋ ')}
                        </Button>
                      </td>
                      <td className="num">{yen(combo.annualSaving)}</td>
                      <td className="num">{`${combo.sufficiency}%`}</td>
                      <td>{combo.ease}</td>
                      <td>{combo.risk}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <section className="tradeoff-reason" aria-label="この組み合わせの理由">
          <h3>選択中の組み合わせの理由</h3>
          {chosen ? (
            <>
              <p>{chosen.reason}</p>
              {related.length > 0 && (
                <ul>
                  {related.map((candidate) => (
                    <li key={candidate.key}>
                      <Link to={candidate.relatedTo as string}>
                        {candidateName(candidate)}: {relatedLabel(candidate.relatedTo as string)}を見る
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="sub">表から組み合わせを選ぶと、推奨理由と関連ページをここに表示します。</p>
          )}
        </section>
      </div>
    </section>
  );
}
