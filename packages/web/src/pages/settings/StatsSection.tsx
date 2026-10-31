/**
 * 統計の節 (spec-settings-screen §7.7)。
 *
 * AI分析の対象月数 (最小) を整数で入れる。範囲は API が返す statMinMonthsRange に従う。
 */
import type { FormFieldError } from './draft.js';
import { STATS_TEXT, statRangeError } from './view-model.js';

export function StatsSection({
  value,
  range,
  error,
  onChange,
}: {
  value: string;
  range: { min: number; max: number };
  error: FormFieldError | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <section className="card settings-section" id="stats" aria-labelledby="stats-heading">
      <h2 id="stats-heading">{STATS_TEXT.heading}</h2>
      <p className="sub">{STATS_TEXT.lead}</p>
      <div className="settings-field">
        <label htmlFor="settings-stat-min-months">{STATS_TEXT.label}</label>
        <span className="settings-stat-input">
          <input
            id="settings-stat-min-months"
            className="num-input"
            type="number"
            inputMode="numeric"
            min={range.min}
            max={range.max}
            step={1}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={`settings-stat-info${error ? ' settings-stat-error' : ''}`}
            onChange={(e) => onChange(e.target.value)}
          />
          <span>{STATS_TEXT.unit}</span>
        </span>
        {error && (
          <span className="settings-field-error" id="settings-stat-error">
            {statRangeError(range.min, range.max)}
          </span>
        )}
      </div>
      <p className="settings-info" id="settings-stat-info">
        {STATS_TEXT.info}
      </p>
    </section>
  );
}
