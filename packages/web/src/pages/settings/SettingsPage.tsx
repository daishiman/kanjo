/**
 * 設定画面のページ制御 (spec-settings-screen §7.1〜§7.14)。
 *
 * 問い合わせ・入力と下書き・1 回の保存・リセット・離脱確認だけを持ち、各節の表示は同じディレクトリの部品へ分ける。
 * 集計ルール・名義・統計・現金上書きの 4 種は保存バーの 1 回の保存 (PUT /api/settings/screen) でまとめて確定する。
 * 未保存件数・差分・検証は core の関数から出し、画面では数え直さない。
 */
import type { SettingsScreenNormRule } from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invalidateAnalysisDerived } from '../../analysis-query-invalidation.js';
import { ApiError } from '../../api-client.js';
import { type AuthState, type SettingsSaveResponse, type SettingsScreenResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { OWNER_LABELS_QUERY_KEY } from '../../owner-labels.js';
import { AccountSection } from './AccountSection.js';
import { BACKUPS_QUERY_KEY, BackupsSection } from './BackupsSection.js';
import { CashOverridesSection } from './CashOverridesSection.js';
import { DataSection } from './DataSection.js';
import { NormRulesSection } from './NormRulesSection.js';
import { OtherAdminSection } from './OtherAdminSection.js';
import { OwnerLabelsSection } from './OwnerLabelsSection.js';
import { RuleExplainPanel } from './RuleExplainPanel.js';
import { SettingsSaveBar } from './SettingsSaveBar.js';
import { SettingsSectionNav } from './SettingsSectionNav.js';
import { SettingsWorkspace } from './SettingsWorkspace.js';
import { StatsSection } from './StatsSection.js';
import { type SettingsForm, formOf, savePayloadOf, useSettingsDraft, validateForm } from './draft.js';
import {
  CONFLICT,
  LEAD_LINES,
  LOAD_FAILED,
  PANEL_TEXT,
  QUESTION,
  RELOAD,
  SAVE_TEXT,
  TITLE,
  canRetry,
  resetTitle,
  saveErrorMessage,
} from './view-model.js';
import './settings.css';

export const SETTINGS_SCREEN_QUERY_KEY = ['settings-screen'] as const;

export function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });
  const query = useQuery({
    queryKey: SETTINGS_SCREEN_QUERY_KEY,
    queryFn: () => api<SettingsScreenResponse>('/settings/screen'),
  });
  const data = query.data;
  const userId = auth.data?.user?.id ?? null;

  // 保存済みの値のフォーム形。問い合わせの結果が同じなら同じ参照を返し、下書きの合わせ直しを起こさない
  const savedRef = useRef<{ data: SettingsScreenResponse; form: SettingsForm } | null>(null);
  if (data && savedRef.current?.data !== data) savedRef.current = { data, form: formOf(data) };
  const saved = data ? (savedRef.current?.form ?? null) : null;

  const draft = useSettingsDraft({ userId, saved, savedAt: data?.savedAt ?? null });
  const form = draft.form;
  const validation = form ? validateForm(form) : null;
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [inspectorClosed, setInspectorClosed] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'conflict' | null>(null);

  // 最初に扱う有効なルールを見せる。明示的に閉じた後は、再描画や再取得で勝手に開かない。
  useEffect(() => {
    if (!form || inspectorClosed) return;
    if (selectedRuleId && form.normRules.some((rule) => rule.ruleId === selectedRuleId)) return;
    setSelectedRuleId(form.normRules.find((rule) => rule.enabled)?.ruleId ?? null);
  }, [form, inspectorClosed, selectedRuleId]);

  const update = (change: (current: SettingsForm) => SettingsForm) => {
    setNotice(null);
    draft.update(change);
  };

  /** 設定が変わった後に、設定から導く画面を読み直させる */
  const refreshDerived = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: SETTINGS_SCREEN_QUERY_KEY }),
      qc.invalidateQueries({ queryKey: OWNER_LABELS_QUERY_KEY }),
      qc.invalidateQueries({ queryKey: ['settings'] }),
      qc.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY }),
      invalidateAnalysisDerived(qc),
    ]);
  };

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof savePayloadOf>) =>
      api<SettingsSaveResponse>('/settings/screen', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: async () => {
      // 保存済みの値を読み直してから下書きを捨てる。先に捨てると古い値が一瞬戻って見える
      await refreshDerived();
      draft.discard();
      setNotice('saved');
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || error.status !== 409 || error.code !== 'settings_conflict') return;
      // 他の画面での保存。読み直すと下書きは新しい保存値の上へ載せ直される
      setNotice('conflict');
      return qc.invalidateQueries({ queryKey: SETTINGS_SCREEN_QUERY_KEY });
    },
  });

  const count = draft.count;
  const invalid = validation ? !validation.ok : false;
  const canSave = count > 0 && !invalid && !save.isPending && !query.isFetching;
  const submit = () => {
    if (!saved || !form || !data || !canSave) return;
    setNotice(null);
    save.mutate(savePayloadOf(saved, form, data.savedAt));
  };

  const onRestored = () => {
    draft.discard();
    setNotice(null);
    save.reset();
    void refreshDerived();
  };

  // リセットの確認 (§7.12)
  const reset = useConfirmDialog();
  const resetRef = useRef<HTMLButtonElement>(null);

  // 離脱確認 (§7.12)。節ナビ・書き出しのように画面の中で完結するリンクと、同じ画面のハッシュだけの移動は除く
  const leave = useConfirmDialog();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = count > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      if (anchor.dataset.settingsInternal !== undefined) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(`${url.pathname}${url.search}${url.hash}`);
      leave.setOpen(true);
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, leave.setOpen]);

  const header = <PageHeader route="settings" title={TITLE} lead={<LeadLines />} showTask={false} />;
  const ready = Boolean(data && saved && form && validation);
  const selectedRule = form?.normRules.find((r) => r.ruleId === selectedRuleId) ?? null;
  const savedRule: SettingsScreenNormRule | undefined =
    selectedRule && data ? data.normRules.find((r) => r.ruleId === selectedRule.ruleId) : undefined;
  const selectRule = (ruleId: string | null) => {
    setSelectedRuleId(ruleId);
    if (ruleId) setInspectorClosed(false);
  };

  const inspector = inspectorClosed ? null : (
    <RuleExplainPanel
      key={selectedRule?.ruleId ?? 'empty'}
      rule={selectedRule}
      saved={savedRule}
      impacts={selectedRule && data ? data.impacts[selectedRule.kind] : []}
      emptyMessage={
        query.isLoading
          ? '集計ルールを読み込んでいます。読み込み後に影響先を確認できます。'
          : query.isError
            ? '集計ルールを読み込めませんでした。再読み込みすると影響先を確認できます。'
            : PANEL_TEXT.empty
      }
      onClose={() => {
        setSelectedRuleId(null);
        setInspectorClosed(true);
      }}
      onUndo={(previous) => {
        if (!selectedRule) return;
        update((current) => ({
          ...current,
          normRules: current.normRules.map((r) =>
            r.ruleId === selectedRule.ruleId
              ? {
                  ...r,
                  kind: previous.kind,
                  raw: previous.raw,
                  norm: previous.norm,
                  enabled: previous.enabled,
                }
              : r,
          ),
        }));
      }}
    />
  );

  return (
    <div className="settings" aria-busy={query.isFetching}>
      {header}
      <SettingsWorkspace
        navigation={<SettingsSectionNav key={ready ? 'ready' : 'pending'} />}
        inspector={inspector}
        primary={
          <div className="settings-sections">
            {notice === 'conflict' && (
              <div className="notice settings-notice" role="alert">
                {CONFLICT}
              </div>
            )}
            {query.isLoading ? (
              <PageState status="loading" />
            ) : !data || !saved || !form || !validation ? (
              <PageState
                status="error"
                message={LOAD_FAILED}
                error={query.error}
                action={
                  <Button variant="primary" onClick={() => void query.refetch()}>
                    {RELOAD}
                  </Button>
                }
              />
            ) : (
              <NormRulesSection
                rules={form.normRules}
                errors={validation.fields}
                limit={data.limits.normRules}
                selectedId={selectedRule?.ruleId ?? null}
                onSelect={selectRule}
                onChange={(normRules) => update((current) => ({ ...current, normRules }))}
              />
            )}
          </div>
        }
      >
        <div className="settings-sections">
          {data && saved && form && validation && (
            <>
              <OwnerLabelsSection
                values={form.ownerLabels}
                errors={validation.owners}
                onChange={(key, value) =>
                  update((current) => ({
                    ...current,
                    ownerLabels: { ...current.ownerLabels, [key]: value },
                  }))
                }
              />
              <StatsSection
                value={form.statMinMonths}
                range={data.statMinMonthsRange}
                error={validation.fields.statMinMonths}
                onChange={(statMinMonths) => update((current) => ({ ...current, statMinMonths }))}
              />
              <CashOverridesSection
                rows={form.cashOverrides}
                errors={validation.fields}
                onChange={(cashOverrides) => update((current) => ({ ...current, cashOverrides }))}
              />
              <DataSection hasDraft={dirty} onRestored={onRestored} />
              <BackupsSection hasDraft={dirty} onRestored={onRestored} />
            </>
          )}
          <AccountSection />
          <OtherAdminSection />
        </div>
      </SettingsWorkspace>

      {notice === 'saved' && <output className="notice settings-notice">{SAVE_TEXT.saved}</output>}
      {save.isError && notice !== 'conflict' && (
        <div className="notice settings-notice settings-save-error" role="alert">
          <span>{saveErrorMessage(save.error)}</span>
          {canRetry(save.error) && (
            <Button size="mini" onClick={submit}>
              {SAVE_TEXT.retry}
            </Button>
          )}
        </div>
      )}

      {ready && (
        <SettingsSaveBar
          count={count}
          invalid={invalid}
          saving={save.isPending}
          canSave={canSave}
          resetRef={resetRef}
          onReset={() => {
            reset.triggerRef.current = resetRef.current;
            reset.setOpen(true);
          }}
          onSave={submit}
        />
      )}

      {reset.open && (
        <ConfirmDialog
          dialog={reset}
          title={resetTitle(count)}
          confirmLabel={SAVE_TEXT.resetConfirm}
          busyLabel={SAVE_TEXT.resetBusy}
          dismissLabel="キャンセル"
          onConfirm={() => {
            draft.discard();
            setSelectedRuleId(null);
            setNotice(null);
            reset.close();
          }}
          onDismiss={() => reset.close()}
        />
      )}

      {leave.open && (
        <ConfirmDialog
          dialog={leave}
          title={SAVE_TEXT.leave}
          confirmLabel={SAVE_TEXT.leaveConfirm}
          busyLabel={SAVE_TEXT.leaveBusy}
          dismissLabel={SAVE_TEXT.leaveDismiss}
          onConfirm={() => {
            leave.close();
            if (leaveTo) navigate(leaveTo);
          }}
          onDismiss={() => leave.close()}
        />
      )}
    </div>
  );
}

function LeadLines() {
  return (
    <>
      <strong className="settings-question">{QUESTION}</strong>
      <br />
      {LEAD_LINES[0]}
      <br />
      {LEAD_LINES[1]}
    </>
  );
}
