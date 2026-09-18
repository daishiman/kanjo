import type { DiagnosisScreen } from '../../../api.js';
import { ratio, yen } from '../../../format.js';
import { CONFIDENCE_LABEL } from './types.js';

/**
 * 最優先の改善余地と健全性を、診断の結論として一続きに見せる。
 *
 * 健全性は点だけを出さない。要素・重み・寄与点を内訳で開けるようにしてあるのは、
 * 「なぜこの点なのか」を利用者が逆算できないと、次に何を直すかが決まらないため (FR-005)。
 */
export function DiagnosisResultCards({ screen }: { screen: DiagnosisScreen }) {
  const { health } = screen;
  const top = screen.improvements.find((row) => row.status !== '対応済み' && row.status !== '見送り');
  const coverage = health.breakdown.find((factor) => factor.key === 'coverage');
  const dropped = health.breakdown.filter((factor) => factor.score === null);
  return (
    <section className="card diagnosis-result" aria-label="診断結果">
      <div className="diagnosis-result-main">
        <p className="diagnosis-eyebrow">最優先の改善アクション</p>
        {top ? (
          <>
            <h2>{top.label}</h2>
            <p className="diagnosis-result-impact">
              <span className="num">
                {top.impactBasis === 'one_off' ? '単発' : '年間'} {yen(top.annualImpact)}
              </span>
              <span>の改善余地</span>
            </p>
            <p className="diagnosis-result-copy">{top.detail}</p>
            <dl className="diagnosis-result-meta">
              <div>
                <dt>見積りの確からしさ</dt>
                <dd>{CONFIDENCE_LABEL[top.confidence]}</dd>
              </div>
              <div>
                <dt>記帳カバー率</dt>
                <dd className="num">
                  {coverage?.actual === null || coverage?.actual === undefined
                    ? '算出不能'
                    : ratio(coverage.actual, 0)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="diagnosis-result-none">
            <h2>未対応の改善アクションはありません</h2>
            <p>現在の条件では、新たに着手する改善余地は検出されませんでした。</p>
          </div>
        )}
      </div>

      <section className="diagnosis-health" aria-label="健全性スコア">
        <p className="diagnosis-eyebrow">家計と事業の健全性</p>
        {health.score === null ? (
          <p className="sub">4 要素のいずれも算出できません。データを取り込むと点が出ます。</p>
        ) : (
          <>
            <p className="diagnosis-health-score">
              <span className="num diagnosis-health-value">{health.score}</span>
              <span className="diagnosis-health-unit">/ 100</span>
              <span
                className={`pill ${health.band === '健全' ? 'calm' : health.band === '注意' ? 'warn' : 'alert'}`}
              >
                {health.band}
              </span>
            </p>
            {dropped.length > 0 && (
              <p className="sub diagnosis-health-note">
                算出できない要素 ({dropped.map((factor) => factor.label).join(' / ')}) を除き、
                残りの重みで正規化しています。
              </p>
            )}
          </>
        )}
        <details className="diagnosis-health-breakdown">
          <summary>内訳 (要素・重み・寄与点)</summary>
          <dl className="diagnosis-health-factors">
            {health.breakdown.map((factor) => (
              <div key={factor.key}>
                <dt>{factor.label}</dt>
                <dd>
                  {factor.score === null ? (
                    factor.unavailableReason
                  ) : (
                    <span className="num">
                      {factor.score.toFixed(0)} 点 / 寄与 {factor.contribution.toFixed(1)} 点
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </section>
  );
}
