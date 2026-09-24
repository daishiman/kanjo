/**
 * 集計ルールの節 (spec-settings-screen §7.3・§7.4)。
 *
 * 表の並び順がそのまま優先順位なので、列見出しでの並べ替えは付けない。
 * 並べ替えはハンドルのドラッグと、キーボードでも使える上へ / 下への移動ボタンの 2 通り。
 * 行を押すとその行を選び、説明パネル (RuleExplainPanel) を開く。値は全て下書きで、保存バーで確定する。
 */
import { shadowedNormRules } from '@kanjo/core';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button.js';
import { ConfirmDialog, usePendingConfirm } from '../../components/ConfirmDialog.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { type FormFieldError, type NormRuleForm, newRuleId } from './draft.js';
import {
  KIND_LABEL,
  NORM_RULES_TEXT,
  bulkDeleteTitle,
  deleteRuleTitle,
  fieldErrorText,
  normRulesLimitNote,
  selectedCountLabel,
} from './view-model.js';

export const ruleRawInputId = (ruleId: string): string => `settings-rule-raw-${ruleId}`;

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** 行の本体を押したかどうか。入力・ボタン・チェック・ハンドルの操作では行を選ばない */
const isControl = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('input, select, button, label, textarea, [draggable="true"]') !== null;

export function NormRulesSection({
  rules,
  errors,
  limit,
  selectedId,
  onSelect,
  onChange,
}: {
  rules: NormRuleForm[];
  errors: Record<string, FormFieldError>;
  limit: number;
  selectedId: string | null;
  onSelect: (ruleId: string | null) => void;
  onChange: (next: NormRuleForm[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const confirmDelete = usePendingConfirm<string>();
  const bulk = useConfirmDialog();

  // 消えた行のチェックは外す (他の画面の更新・リセット・一括削除のあと)
  const ids = useMemo(() => new Set(rules.map((r) => r.ruleId)), [rules]);
  const liveChecked = useMemo(() => new Set([...checked].filter((id) => ids.has(id))), [checked, ids]);
  // 上の行に隠れる行は入力のたびに数え直す (保存前の並びで判定する)
  const shadowed = useMemo(
    () =>
      shadowedNormRules(
        rules.map((r, i) => ({ ...r, raw: r.raw.trim(), norm: r.norm.trim(), order: i + 1 })),
      ),
    [rules],
  );
  const suggestions = useMemo(
    () =>
      [...new Set(rules.map((r) => r.norm.trim()).filter((v) => v !== ''))].sort((a, b) =>
        a.localeCompare(b, 'ja'),
      ),
    [rules],
  );

  // 追加した行の元の表記へフォーカスを移す (描画の後で探す)
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(ruleRawInputId(focusId))?.focus();
    setFocusId(null);
  }, [focusId]);

  const atLimit = rules.length >= limit;
  const allChecked = rules.length > 0 && liveChecked.size === rules.length;
  const setRule = (ruleId: string, patch: Partial<NormRuleForm>) =>
    onChange(rules.map((r) => (r.ruleId === ruleId ? { ...r, ...patch } : r)));
  const remove = (targets: ReadonlySet<string>) => {
    const selectedIndex = selectedId ? rules.findIndex((rule) => rule.ruleId === selectedId) : -1;
    const next = rules.filter((r) => !targets.has(r.ruleId));
    onChange(next);
    setChecked(new Set());
    if (selectedId && targets.has(selectedId)) {
      const adjacent = next[Math.min(selectedIndex, next.length - 1)];
      onSelect(adjacent?.ruleId ?? null);
    }
  };
  const setEnabled = (enabled: boolean) =>
    onChange(rules.map((r) => (liveChecked.has(r.ruleId) ? { ...r, enabled } : r)));
  const add = () => {
    if (atLimit) return;
    const ruleId = newRuleId();
    onChange([...rules, { ruleId, kind: 'vendor', raw: '', norm: '', enabled: true, isNew: true }]);
    onSelect(ruleId);
    setFocusId(ruleId);
  };
  const toggle = (ruleId: string, on: boolean) =>
    setChecked((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      if (on) next.add(ruleId);
      else next.delete(ruleId);
      return next;
    });
  const deleting = rules.find((r) => r.ruleId === confirmDelete.target);

  return (
    <section className="card settings-section" id="norm-rules" aria-labelledby="norm-rules-heading">
      <h2 id="norm-rules-heading">{NORM_RULES_TEXT.heading}</h2>
      <p className="sub">{NORM_RULES_TEXT.lead}</p>
      <div className="settings-rules-main">
        <h3>{NORM_RULES_TEXT.subheading}</h3>
        {liveChecked.size > 0 && (
          <div className="settings-bulk" role="toolbar" aria-label="選択した集計ルールの操作">
            <span>{selectedCountLabel(liveChecked.size)}</span>
            <Button
              variant="danger"
              size="mini"
              ref={(node) => {
                bulk.triggerRef.current = node;
              }}
              onClick={() => bulk.setOpen(true)}
            >
              削除
            </Button>
            <Button size="mini" onClick={() => setEnabled(false)}>
              無効にする
            </Button>
            <Button size="mini" onClick={() => setEnabled(true)}>
              有効にする
            </Button>
          </div>
        )}
        <div className="settings-table-wrap">
          <table
            className="data settings-rules-table"
            data-table-kind="workflow"
            data-sort-reason="並び順そのものが優先順位で、並べ替えると意味が変わるため"
          >
            <caption className="visually-hidden">{NORM_RULES_TEXT.subheading}</caption>
            <thead>
              <tr>
                <th scope="col" className="settings-col-check">
                  <SelectionCheckbox
                    label="すべての集計ルールを選択"
                    labelHidden
                    checked={allChecked}
                    indeterminate={liveChecked.size > 0 && !allChecked}
                    disabled={rules.length === 0}
                    onChange={(e) => setChecked(e.target.checked ? new Set(ids) : new Set())}
                  />
                </th>
                <th scope="col" className="settings-col-handle">
                  <span className="visually-hidden">並べ替え</span>
                </th>
                <th scope="col" className="settings-col-kind">
                  {NORM_RULES_TEXT.kind}
                </th>
                <th scope="col" className="settings-col-raw">
                  {NORM_RULES_TEXT.raw}
                </th>
                <th scope="col" className="settings-col-norm">
                  {NORM_RULES_TEXT.norm}
                </th>
                <th scope="col" className="settings-col-actions">
                  {NORM_RULES_TEXT.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="settings-empty">
                    <p>{NORM_RULES_TEXT.empty}</p>
                    <Button onClick={add}>{NORM_RULES_TEXT.add}</Button>
                  </td>
                </tr>
              )}
              {rules.map((rule, index) => {
                const at = `normRules.${index}`;
                const rawError = errors[`${at}.raw`];
                const normError = errors[`${at}.norm`];
                const selected = rule.ruleId === selectedId;
                const classes = [
                  'settings-rule-row',
                  selected ? 'selected' : '',
                  rule.enabled ? '' : 'is-disabled',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは行の中の入力へのフォーカスで同じ行を選ぶ (onFocus)
                  <tr
                    key={rule.ruleId}
                    className={classes}
                    aria-selected={selected}
                    onClick={(event) => {
                      if (!isControl(event.target)) onSelect(rule.ruleId);
                    }}
                    onFocus={() => {
                      if (!selected) onSelect(rule.ruleId);
                    }}
                    onDragOver={(event) => {
                      if (dragIndex !== null) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragIndex !== null && dragIndex !== index) onChange(move(rules, dragIndex, index));
                      setDragIndex(null);
                    }}
                  >
                    <td className="settings-col-check">
                      <SelectionCheckbox
                        label={`${rule.raw || '新しいルール'}を選択`}
                        labelHidden
                        checked={liveChecked.has(rule.ruleId)}
                        onChange={(e) => toggle(rule.ruleId, e.target.checked)}
                      />
                    </td>
                    <td className="settings-col-handle">
                      <Button
                        size="mini"
                        className="settings-handle"
                        draggable="true"
                        aria-label={`「${rule.raw || '新しいルール'}」を並べ替え`}
                        aria-keyshortcuts="ArrowUp ArrowDown"
                        title="ドラッグ、または上下矢印キーで並べ替え"
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                          event.preventDefault();
                          const destination = event.key === 'ArrowUp' ? index - 1 : index + 1;
                          if (destination >= 0 && destination < rules.length)
                            onChange(move(rules, index, destination));
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', rule.ruleId);
                          setDragIndex(index);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                      >
                        移動
                      </Button>
                      <span className="settings-move">
                        <Button
                          size="mini"
                          aria-label="上へ移動"
                          disabled={index === 0}
                          onClick={() => onChange(move(rules, index, index - 1))}
                        >
                          ↑
                        </Button>
                        <Button
                          size="mini"
                          aria-label="下へ移動"
                          disabled={index === rules.length - 1}
                          onClick={() => onChange(move(rules, index, index + 1))}
                        >
                          ↓
                        </Button>
                      </span>
                    </td>
                    <td className="settings-col-kind">
                      <select
                        aria-label={NORM_RULES_TEXT.kind}
                        value={rule.kind}
                        onChange={(e) =>
                          setRule(rule.ruleId, { kind: e.target.value as NormRuleForm['kind'] })
                        }
                      >
                        <option value="account">{KIND_LABEL.account}</option>
                        <option value="vendor">{KIND_LABEL.vendor}</option>
                      </select>
                      {!rule.enabled && <span className="settings-badge">{NORM_RULES_TEXT.disabled}</span>}
                    </td>
                    <td className="settings-col-raw">
                      <input
                        id={ruleRawInputId(rule.ruleId)}
                        type="text"
                        aria-label={NORM_RULES_TEXT.raw}
                        aria-invalid={rawError ? true : undefined}
                        aria-describedby={rawError ? `${ruleRawInputId(rule.ruleId)}-error` : undefined}
                        value={rule.raw}
                        onChange={(e) => setRule(rule.ruleId, { raw: e.target.value })}
                      />
                      {rawError && (
                        <span className="settings-field-error" id={`${ruleRawInputId(rule.ruleId)}-error`}>
                          {fieldErrorText(`${at}.raw`, rawError)}
                        </span>
                      )}
                      {shadowed[rule.ruleId] && (
                        <span className="settings-note">{NORM_RULES_TEXT.shadowed}</span>
                      )}
                    </td>
                    <td className="settings-col-norm">
                      <input
                        type="text"
                        list="settings-norm-suggestions"
                        aria-label={NORM_RULES_TEXT.norm}
                        aria-invalid={normError ? true : undefined}
                        aria-describedby={normError ? `settings-rule-norm-${rule.ruleId}-error` : undefined}
                        value={rule.norm}
                        onChange={(e) => setRule(rule.ruleId, { norm: e.target.value })}
                      />
                      {normError && (
                        <span className="settings-field-error" id={`settings-rule-norm-${rule.ruleId}-error`}>
                          {fieldErrorText(`${at}.norm`, normError)}
                        </span>
                      )}
                    </td>
                    <td className="settings-col-actions">
                      <Button
                        variant="danger"
                        size="mini"
                        aria-label={NORM_RULES_TEXT.deleteLabel}
                        onClick={(event) => {
                          confirmDelete.dialog.triggerRef.current = event.currentTarget;
                          confirmDelete.ask(rule.ruleId);
                        }}
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <datalist id="settings-norm-suggestions">
          {suggestions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        {rules.length > 0 && (
          <div className="settings-rules-add">
            <Button onClick={add} disabled={atLimit}>
              {NORM_RULES_TEXT.add}
            </Button>
          </div>
        )}
        {(atLimit || errors.normRules === 'too_many') && <p className="sub">{normRulesLimitNote(limit)}</p>}
      </div>

      {confirmDelete.target && (
        <ConfirmDialog
          dialog={confirmDelete.dialog}
          title={deleteRuleTitle(deleting?.raw ?? '')}
          confirmLabel="削除する"
          busyLabel="削除しています…"
          dismissLabel="キャンセル"
          onConfirm={() => {
            const target = confirmDelete.target as string;
            confirmDelete.dismiss();
            remove(new Set([target]));
          }}
          onDismiss={confirmDelete.dismiss}
        >
          <p>{NORM_RULES_TEXT.deleteBody}</p>
        </ConfirmDialog>
      )}
      {bulk.open && (
        <ConfirmDialog
          dialog={bulk}
          title={bulkDeleteTitle(liveChecked.size)}
          confirmLabel="削除する"
          busyLabel="削除しています…"
          dismissLabel="キャンセル"
          onConfirm={() => {
            const targets = liveChecked;
            bulk.close();
            remove(targets);
          }}
          onDismiss={() => bulk.close()}
        >
          <p>{NORM_RULES_TEXT.deleteBody}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
