/**
 * 名義の節 (spec-settings-screen §7.6)。
 *
 * 4 名義の表示名を 2 列 × 2 段で並べる。検証は core の validateOwnerLabels を画面と API で共有する。
 */
import type { OwnerKey, OwnerLabelError } from '@kanjo/core';
import { OWNER_ERROR_TEXT, OWNER_FIELDS, OWNER_TEXT } from './view-model.js';

export function OwnerLabelsSection({
  values,
  errors,
  onChange,
}: {
  values: Record<OwnerKey, string>;
  errors: Partial<Record<OwnerKey, OwnerLabelError>>;
  onChange: (key: OwnerKey, value: string) => void;
}) {
  return (
    <section className="card settings-section" id="owner-labels" aria-labelledby="owner-labels-heading">
      <h2 id="owner-labels-heading">{OWNER_TEXT.heading}</h2>
      <p className="sub">{OWNER_TEXT.lead}</p>
      <div className="settings-owner-grid">
        {OWNER_FIELDS.map((field) => {
          const id = `settings-owner-${field.key}`;
          const error = errors[field.key];
          return (
            <div className="settings-field" key={field.key}>
              <label htmlFor={id}>{field.label}</label>
              <input
                id={id}
                type="text"
                value={values[field.key]}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-example${error ? ` ${id}-error` : ''}`}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
              <span className="settings-note" id={`${id}-example`}>
                {field.example}
              </span>
              {error && (
                <span className="settings-field-error" id={`${id}-error`}>
                  {OWNER_ERROR_TEXT[error]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
