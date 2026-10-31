/**
 * 4 ステップ (取込む → 整える → 確認 → 計画) と各段の『元画面を開く →』(spec-guide-screen FR-3)。
 * データが 0 件のときは『取込む』を強調し、最初の一歩を示す。
 */
import { Link } from 'react-router-dom';
import { GUIDE_STEPS, GUIDE_STEP_OPEN_LABEL } from './view-model.js';

export function GuideSteps({ emphasizeImport }: { emphasizeImport: boolean }) {
  return (
    <section className="card guide-steps" aria-labelledby="guide-steps-title">
      <h2 id="guide-steps-title" className="visually-hidden">
        使い方の 4 ステップ
      </h2>
      <ol className="guide-steps-list">
        {GUIDE_STEPS.map((step, index) => {
          const emphasized = emphasizeImport && step.key === 'import';
          return (
            <li key={step.key} className={`guide-step${emphasized ? ' is-emphasized' : ''}`}>
              <div className="guide-step-head">
                <span className="guide-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="guide-step-title">
                  <strong>{step.label}</strong>
                  <span className="sub">{step.sub}</span>
                </span>
              </div>
              <p className="guide-step-desc">{step.desc}</p>
              <Link
                className={emphasized ? 'btn primary guide-step-open' : 'guide-step-open'}
                to={step.destination.path}
                aria-label={`${step.label}: ${step.destination.label}を開く`}
              >
                {GUIDE_STEP_OPEN_LABEL}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
