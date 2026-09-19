import type { DiagnosisSignal } from '../../../api.js';
import { TONE_LABEL, TONE_PILL } from './types.js';

/** 主なシグナル。件数の上限 (3) は core 側 (DIAGNOSIS_SIGNAL_LIMIT) が決める (BR-009) */
export function DiagnosisSignals({ signals }: { signals: readonly DiagnosisSignal[] }) {
  if (!signals.length) return null;
  return (
    <section className="card diagnosis-signals" aria-label="主なシグナル">
      <h2>主なシグナル</h2>
      <ul className="diagnosis-signal-list">
        {signals.slice(0, 3).map((signal, index) => (
          <li key={signal.label} className="diagnosis-signal">
            <span className="diagnosis-signal-rank num" aria-label={`${index + 1}位`}>
              {index + 1}
            </span>
            <span className="diagnosis-signal-body">
              <strong>{signal.label}</strong>
              <span className="sub">{signal.detail}</span>
            </span>
            <span className={TONE_PILL[signal.tone]}>{TONE_LABEL[signal.tone]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
