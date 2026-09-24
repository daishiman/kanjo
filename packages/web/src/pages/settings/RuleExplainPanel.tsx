/**
 * この設定の説明 (spec-settings-screen §7.5)。
 *
 * 選択中の集計ルールの下書きの値・影響先・最終更新を出し、直前の保存値へ戻す口を持つ。
 * 元に戻すは確認を挟まない。下書きへ戻すだけで、保存するまで確定せず、保存バーのリセットで取り消せるため。
 */
import type { SettingsScreenNormRule } from '@kanjo/core';
import { useState } from 'react';
import { type SettingsHistoryResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import type { NormRuleForm } from './draft.js';
import { PANEL_TEXT, panelDateLabel, updatedByLabel } from './view-model.js';

export function RuleExplainPanel({
  rule,
  saved,
  impacts,
  onClose,
  onUndo,
  emptyMessage = PANEL_TEXT.empty,
}: {
  rule: NormRuleForm | null;
  /** 保存済みの行。新規行には無い */
  saved: SettingsScreenNormRule | undefined;
  impacts: readonly string[];
  onClose?: () => void;
  onUndo: (previous: NonNullable<SettingsHistoryResponse['previous']>) => void;
  emptyMessage?: string;
}) {
  if (!rule) {
    return (
      <aside className="card settings-panel settings-panel-empty" aria-labelledby="settings-panel-heading">
        <div className="settings-panel-head">
          <h3 id="settings-panel-heading">{PANEL_TEXT.heading}</h3>
        </div>
        <p className="sub">{emptyMessage}</p>
        <a className="btn" href="#norm-rules" data-settings-internal>
          集計ルールへ移動
        </a>
      </aside>
    );
  }

  return (
    <SelectedRuleExplainPanel
      rule={rule}
      saved={saved}
      impacts={impacts}
      onClose={onClose ?? (() => undefined)}
      onUndo={onUndo}
    />
  );
}

function SelectedRuleExplainPanel({
  rule,
  saved,
  impacts,
  onClose,
  onUndo,
}: {
  rule: NormRuleForm;
  saved: SettingsScreenNormRule | undefined;
  impacts: readonly string[];
  onClose: () => void;
  onUndo: (previous: NonNullable<SettingsHistoryResponse['previous']>) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ruleId: string; text: string } | null>(null);
  const isNew = rule.isNew || !saved;
  const canUndo = saved?.canUndo ?? false;

  const undo = async () => {
    setPending(true);
    setMessage(null);
    try {
      const history = await api<SettingsHistoryResponse>(
        `/settings/history?ruleId=${encodeURIComponent(rule.ruleId)}`,
      );
      if (history.previous) onUndo(history.previous);
      else setMessage({ ruleId: rule.ruleId, text: PANEL_TEXT.undoNotFound });
    } catch {
      setMessage({ ruleId: rule.ruleId, text: PANEL_TEXT.undoFailed });
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="card settings-panel" aria-labelledby="settings-panel-heading">
      <div className="settings-panel-head">
        <h3 id="settings-panel-heading">{PANEL_TEXT.heading}</h3>
        <Button variant="text" size="mini" aria-label={PANEL_TEXT.close} onClick={onClose}>
          ×
        </Button>
      </div>
      <h4>{PANEL_TEXT.subheading}</h4>
      <dl className="settings-panel-fields">
        <dt>{PANEL_TEXT.raw}</dt>
        <dd>{rule.raw || '—'}</dd>
        <dt>{PANEL_TEXT.norm}</dt>
        <dd>{rule.norm || '—'}</dd>
        <dt>{PANEL_TEXT.impacts}</dt>
        <dd>
          <ul>
            {impacts.map((impact) => (
              <li key={impact}>{impact}</li>
            ))}
          </ul>
        </dd>
        <dt>{PANEL_TEXT.updated}</dt>
        <dd>
          {isNew ? (
            PANEL_TEXT.unsaved
          ) : (
            <>
              {panelDateLabel(saved?.updatedAt ?? '')}
              <br />
              {updatedByLabel(saved?.updatedBy ?? '')}
            </>
          )}
        </dd>
      </dl>
      <Button disabled={!canUndo || pending} onClick={() => void undo()}>
        {PANEL_TEXT.undo}
      </Button>
      {!isNew && !saved?.canUndo && <p className="sub">{PANEL_TEXT.noPrevious}</p>}
      {message && message.ruleId === rule.ruleId && (
        <p className="sub">
          <output>{message.text}</output>
        </p>
      )}
      <h4>{PANEL_TEXT.hintHeading}</h4>
      <p className="sub">{PANEL_TEXT.hint}</p>
    </aside>
  );
}
