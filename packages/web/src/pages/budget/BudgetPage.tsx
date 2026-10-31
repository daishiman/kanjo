/**
 * 予算画面のページ制御 (spec-budget-screen §7.1〜§7.14)。
 *
 * 問い合わせ・URL 状態 (`?start=` / `?account=`)・入力と下書き・保存・離脱確認だけを持ち、
 * 各カードの表示は同じディレクトリの部品へ分ける。数値は core の `applyBudgetInputs` で入力から出し直し、
 * 画面では数え直さない (FR-12)。期間は既存 `usePeriod` のもので、本画面は新しい期間状態を持たない。
 */
import { type BudgetBaseRow, type BudgetFigureRow, type BudgetInput, applyBudgetInputs } from '@kanjo/core';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { invalidateAnalysisDerived } from '../../analysis-query-invalidation.js';
import { ApiError } from '../../api-client.js';
import { type AuthState, type BudgetPlansSaveResponse, type BudgetScreenResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { usePeriod } from '../../period.js';
import { BudgetAccountPanel } from './BudgetAccountPanel.js';
import { BudgetGapCategories } from './BudgetGapCategories.js';
import { BudgetImpactCard } from './BudgetImpactCard.js';
import { BudgetKpis } from './BudgetKpis.js';
import { BudgetMonthlyChart } from './BudgetMonthlyChart.js';
import { BudgetOutlookCard } from './BudgetOutlookCard.js';
import { BudgetSaveBar } from './BudgetSaveBar.js';
import { BudgetTable } from './BudgetTable.js';
import {
  type BudgetFormRows,
  EMPTY_FORM_ROW,
  formRowOf,
  formatBudgetAmount,
  inputOf,
  parseBudgetAmount,
  useBudgetDraft,
} from './draft.js';
import {
  LEAD_LINES,
  PANEL_PLACEHOLDER,
  QUESTION,
  SAVED_NOTICE,
  STALE_NOTICE,
  TARGET_NOTE,
  TITLE,
  canRetry,
  normalizeSearch,
  resetBody,
  saveErrorMessage,
  slashRange,
  targetRangeLabel,
} from './view-model.js';
import './budget.css';

const LEAVE_MESSAGE = '保存していない変更があります。このまま移動しますか？';
const NO_INPUT: BudgetInput = { annualAmount: null, planAdjustment: 0, planReason: null };

/** 前期実績の列見出しの期間: 実績期間の終了月までの 12 か月 (BR-02) */
function prevRangeLabel(to: string): string {
  const [year, month] = to.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) - 11;
  const from = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  return slashRange(from, to);
}

export function BudgetPage() {
  const [params, setParams] = useSearchParams();
  const startParam = params.get('start');
  const accountParam = params.get('account');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { key, withPeriod } = usePeriod();
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });
  const userId = auth.data?.user?.id ?? null;
  const query = useQuery({
    queryKey: ['budget-screen', key, startParam],
    queryFn: () =>
      api<BudgetScreenResponse>(
        withPeriod(startParam ? `/budget-screen?start=${encodeURIComponent(startParam)}` : '/budget-screen'),
      ),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Record<string, string | null>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(patch)) {
          if (value === null) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  // 読めない開始月は URL から外して既定の予算対象で取り直す (§API契約)
  const invalidStart = query.error instanceof ApiError && query.error.status === 400 && startParam !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 400 へ変わったときだけ URL を正規化する。
  useEffect(() => {
    if (invalidStart) update({ start: null });
  }, [invalidStart]);

  const data = query.data && !query.data.empty ? query.data : null;
  const rows: BudgetBaseRow[] = data?.rows ?? [];
  const saved = useMemo<BudgetFormRows>(
    () => Object.fromEntries(rows.map((row) => [row.account, formRowOf(row.saved)])),
    [rows],
  );
  const draft = useBudgetDraft({ userId, start: data?.start ?? null, saved });
  const form = draft.rows;
  const unsaved = useMemo(() => new Set(draft.unsaved), [draft.unsaved]);

  const inputs = useMemo<Record<string, BudgetInput>>(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.account,
          inputOf(form[row.account] ?? EMPTY_FORM_ROW) ?? row.saved ?? NO_INPUT,
        ]),
      ),
    [rows, form],
  );
  const figures = useMemo(() => (data ? applyBudgetInputs(data, inputs) : null), [data, inputs]);
  const figureOf = useMemo(
    () => new Map<string, BudgetFigureRow>((figures?.rows ?? []).map((row) => [row.account, row])),
    [figures],
  );
  const amountInvalid = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => parseBudgetAmount(form[row.account]?.annualAmount ?? '') === undefined)
          .map((row) => row.account),
      ),
    [rows, form],
  );
  const adjustmentInvalid = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => parseBudgetAmount(form[row.account]?.planAdjustment ?? '') === undefined)
          .map((row) => row.account),
      ),
    [rows, form],
  );
  const allEmpty =
    rows.length > 0 && rows.every((row) => parseBudgetAmount(form[row.account]?.annualAmount ?? '') === null);

  // 診断からの受け口: 最初に開いた URL の科目が一覧にあれば、その行に絞る (§7.10)
  const [fromDiagnosis, setFromDiagnosis] = useState<string | null>(accountParam);
  const accountRow = accountParam ? (rows.find((row) => row.account === accountParam) ?? null) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 一覧が出てから、一覧に無い科目を URL から外す。
  useEffect(() => {
    if (data && accountParam && !accountRow) {
      update({ account: null });
      setFromDiagnosis(null);
    }
  }, [data, accountParam, accountRow]);
  const defaultAccount =
    accountParam === null ? rows.find((row) => row.account === '人件費')?.account : undefined;
  // 参照画面と同じく、人件費がある場合は根拠パネルを初期表示する。診断絞込みとは区別する。
  // biome-ignore lint/correctness/useExhaustiveDependencies: URLのaccountと取得結果が揃った時だけ正規化する。
  useEffect(() => {
    if (defaultAccount) update({ account: defaultAccount });
  }, [defaultAccount]);
  const filtering = fromDiagnosis !== null && accountRow !== null && fromDiagnosis === accountParam;

  const [search, setSearch] = useState('');
  const needle = normalizeSearch(search);
  const visibleRows = filtering
    ? rows.filter((row) => row.account === fromDiagnosis)
    : needle === ''
      ? rows
      : rows.filter((row) => normalizeSearch(row.account).includes(needle));

  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<'saved' | 'stale' | null>(null);

  // 他画面での保存: 自分の保存以外で保存済みの値が変わったら知らせる (§エラー・例外・回復)
  const savedSignature = JSON.stringify(saved);
  const lastSaved = useRef<{ start: string | null; signature: string } | null>(null);
  const ownSave = useRef(false);
  useEffect(() => {
    if (!data) return;
    const previous = lastSaved.current;
    lastSaved.current = { start: data.start, signature: savedSignature };
    if (!previous || previous.start !== data.start || previous.signature === savedSignature) return;
    if (ownSave.current) ownSave.current = false;
    else setNotice('stale');
  }, [data, savedSignature]);

  const save = useMutation({
    mutationFn: (body: { start: string; baseSavedAt: string | null; rows: unknown[] }) =>
      api<BudgetPlansSaveResponse>('/budget-plans', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      ownSave.current = true;
      draft.clear();
      setNotice('saved');
      void invalidateAnalysisDerived(qc);
      return qc.invalidateQueries({ queryKey: ['budget-screen'] });
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || error.status !== 409) return;
      setNotice('stale');
      return qc.invalidateQueries({ queryKey: ['budget-screen'] });
    },
  });
  const saving = save.isPending;
  const canSave =
    unsaved.size > 0 &&
    amountInvalid.size === 0 &&
    adjustmentInvalid.size === 0 &&
    !saving &&
    !query.isFetching &&
    !allEmpty;

  const submit = () => {
    if (!data?.start || !canSave) return;
    setNotice(null);
    const body = rows
      .filter((row) => unsaved.has(row.account))
      .flatMap((row) => {
        const input = inputOf(form[row.account] ?? EMPTY_FORM_ROW);
        if (!input) return [];
        return [
          {
            account: row.account,
            kind: row.kind,
            annualAmount: input.annualAmount,
            planAdjustment: input.planAdjustment,
            planReason: input.planReason,
          },
        ];
      });
    save.mutate({ start: data.start, baseSavedAt: data.savedAt, rows: body });
  };

  // リセットの確認。targets が null なら全行を戻す
  const reset = useConfirmDialog();
  const [resetTargets, setResetTargets] = useState<string[] | null>(null);
  const tableResetRef = useRef<HTMLButtonElement>(null);
  const barResetRef = useRef<HTMLButtonElement>(null);
  const openReset = (targets: string[] | null, trigger: HTMLButtonElement | null) => {
    setResetTargets(targets);
    reset.triggerRef.current = trigger;
    reset.setOpen(true);
  };

  // 離脱確認 (§7.11)
  const leave = useConfirmDialog();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = unsaved.size > 0;
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
      if (anchor.dataset.budgetInternal !== undefined) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
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

  // Ctrl/⌘+K: 検索欄にフォーカスが無ければ検索欄へ移し、コマンドパレットへ渡さない (BR-20)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      const input = searchRef.current;
      if (!input || document.activeElement === input) return;
      event.preventDefault();
      event.stopPropagation();
      input.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const header = <PageHeader route="budget" title={TITLE} lead={<LeadLines />} showTask={false} />;

  if (query.isLoading || (invalidStart && !query.data))
    return (
      <>
        {header}
        <PageState status="loading" />
      </>
    );
  if (!query.data)
    return (
      <>
        {header}
        <PageState status="error" message="予算を読み込めませんでした。" error={query.error} />
      </>
    );
  if (!data || !figures) {
    return (
      <>
        {header}
        <PageState
          status="empty"
          message="予算の計算に使える実績がありません。"
          action={
            <Link className="btn primary" to="/import">
              データ取込
            </Link>
          }
        />
      </>
    );
  }

  const targetLabel = data.targetMonths.length
    ? slashRange(data.targetMonths[0] as string, data.targetMonths[data.targetMonths.length - 1] as string)
    : '—';
  const prevLabel = data.actualRange ? prevRangeLabel(data.actualRange.to) : '—';
  const selectedRow = accountRow;
  const selectedFigure = selectedRow ? figureOf.get(selectedRow.account) : undefined;
  const selectedForm = selectedRow ? (form[selectedRow.account] ?? EMPTY_FORM_ROW) : EMPTY_FORM_ROW;

  return (
    <div className={`budget${query.isPlaceholderData ? ' is-stale' : ''}`} aria-busy={query.isFetching}>
      <div className="budget-head">
        {header}
        <div className="budget-target">
          <label htmlFor="budget-start">予算対象</label>
          <select
            id="budget-start"
            aria-label="予算対象の開始月"
            value={data.start ?? ''}
            onChange={(event) => update({ start: event.target.value })}
          >
            {data.startOptions.map((start) => (
              <option key={start} value={start}>
                {targetRangeLabel(rangeFrom(start))}
              </option>
            ))}
          </select>
          <p className="budget-target-note">{TARGET_NOTE}</p>
        </div>
      </div>

      {notice === 'stale' && <output className="notice budget-notice">{STALE_NOTICE}</output>}

      <BudgetKpis kpi={figures.kpi} defenseMonthly={data.defenseLine.monthly} />

      <div className="budget-grid-2">
        <BudgetMonthlyChart monthly={figures.monthly} boundary={figures.boundary} />
        <BudgetOutlookCard outlook={figures.outlook} />
      </div>

      {filtering && (
        <output className="notice" aria-label="診断からの絞り込み">
          診断からの絞り込み: {fromDiagnosis} ·{' '}
          <Link
            to={startParam ? `/budget?start=${encodeURIComponent(startParam)}` : '/budget'}
            data-budget-internal=""
            onClick={() => setFromDiagnosis(null)}
          >
            すべて表示
          </Link>
        </output>
      )}

      <div className="budget-grid-main">
        <BudgetTable
          rows={visibleRows}
          figures={figureOf}
          form={form}
          unsaved={unsaved}
          invalid={amountInvalid}
          checked={checked}
          selected={selectedRow?.account ?? null}
          query={search}
          noMatch={visibleRows.length === 0 && needle !== ''}
          prevLabel={prevLabel}
          targetLabel={targetLabel}
          searchRef={searchRef}
          resetRef={tableResetRef}
          onQuery={setSearch}
          onCheck={(account, on) =>
            setChecked((previous) => {
              const next = new Set(previous);
              if (on) next.add(account);
              else next.delete(account);
              return next;
            })
          }
          onCheckAll={(on) => setChecked(on ? new Set(visibleRows.map((row) => row.account)) : new Set())}
          onAmount={(account, value) => draft.setRow(account, { annualAmount: value })}
          onAmountBlur={(account) =>
            draft.setRow(account, { annualAmount: formatBudgetAmount(form[account]?.annualAmount ?? '') })
          }
          onOpen={(account) => update({ account })}
          onSuggest={() => {
            const targets = checked.size > 0 ? [...checked] : rows.map((row) => row.account);
            draft.setAnnualAmounts(
              Object.fromEntries(targets.map((account) => [account, figureOf.get(account)?.suggestion ?? 0])),
            );
          }}
          onResetAll={() => openReset(checked.size > 0 ? [...checked] : null, tableResetRef.current)}
        />
        {selectedRow && selectedFigure ? (
          <BudgetAccountPanel
            key={selectedRow.account}
            row={selectedRow}
            figure={selectedFigure}
            form={selectedForm}
            unsaved={unsaved.has(selectedRow.account)}
            adjustmentInvalid={adjustmentInvalid.has(selectedRow.account)}
            appliedSuggestion={parseBudgetAmount(selectedForm.annualAmount) === selectedFigure.suggestion}
            onClose={() => {
              setFromDiagnosis(null);
              update({ account: null });
            }}
            onApply={() => draft.setAnnualAmounts({ [selectedRow.account]: selectedFigure.suggestion })}
            onRevert={() => draft.revert([selectedRow.account])}
            onAdjustment={(value) => draft.setRow(selectedRow.account, { planAdjustment: value })}
            onAdjustmentBlur={() =>
              draft.setRow(selectedRow.account, {
                planAdjustment: formatBudgetAmount(selectedForm.planAdjustment),
              })
            }
            onReason={(value) => draft.setRow(selectedRow.account, { planReason: value })}
          />
        ) : (
          <aside className="card budget-panel budget-panel-empty" aria-label="科目パネル">
            <p>{PANEL_PLACEHOLDER}</p>
          </aside>
        )}
      </div>

      <div className="budget-grid-2">
        <BudgetGapCategories gaps={figures.gaps} onOpen={(account) => update({ account })} />
        <BudgetImpactCard impact={figures.impact} />
      </div>

      {notice === 'saved' && <output className="notice budget-notice">{SAVED_NOTICE}</output>}
      {save.isError && (
        <div className="notice budget-notice budget-error" role="alert">
          <span>{saveErrorMessage(save.error)}</span>
          {canRetry(save.error) && (
            <Button size="mini" onClick={submit}>
              再試行
            </Button>
          )}
        </div>
      )}

      <BudgetSaveBar
        unsavedCount={unsaved.size}
        savedAt={data.savedAt}
        draftSavedAt={draft.savedAt}
        allEmpty={allEmpty}
        canSave={canSave}
        saving={saving}
        resetRef={barResetRef}
        onReset={() => openReset(null, barResetRef.current)}
        onSave={submit}
      />

      {reset.open && (
        <ConfirmDialog
          dialog={reset}
          title="入力を保存済みの値に戻しますか？"
          confirmLabel="戻す"
          busyLabel="戻しています…"
          dismissLabel="キャンセル"
          onConfirm={() => {
            draft.revert(resetTargets);
            setChecked(new Set());
            reset.close();
          }}
          onDismiss={() => reset.close()}
        >
          <p>{resetBody(unsaved.size, resetTargets ? resetTargets.length : null)}</p>
        </ConfirmDialog>
      )}

      {leave.open && (
        <ConfirmDialog
          dialog={leave}
          title={LEAVE_MESSAGE}
          confirmLabel="移動する"
          busyLabel="移動しています…"
          dismissLabel="とどまる"
          onConfirm={() => {
            leave.close();
            if (leaveTo) navigate(leaveTo);
          }}
          onDismiss={() => leave.close()}
        >
          <p>未保存の {unsaved.size} 項目は下書きとしてこの端末に残ります。</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function LeadLines() {
  return (
    <>
      <strong className="budget-question">{QUESTION}</strong>
      <br />
      {LEAD_LINES[0]}
      <br />
      {LEAD_LINES[1]}
    </>
  );
}

/** 開始月から 12 か月の月の列 (予算対象の選択肢のラベル) */
function rangeFrom(start: string): string[] {
  const [year, month] = start.split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, offset) => {
    const index = year * 12 + (month - 1) + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}
