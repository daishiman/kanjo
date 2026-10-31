/**
 * 現金入力画面 (spec-cash-screen)。
 *
 * 規則は view-model (その先の core) にあり、ここは状態を持って部品へ配るだけにする。
 * - 期間は共通の usePeriod。一覧 API へは同じ from / to を渡す。
 * - 月・絞り込み・ページ・タブは URL に置く (戻る / 共有で同じ一覧が出る)。
 * - 入力途中の値は利用者ごとに localStorage へ下書きする。編集中は保存しない。
 * - 書き込みの後は集計が全画面に波及するので、query を全部無効化する。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api-client.js';
import {
  type AuthState,
  type CashBulkDeleteResponse,
  type CashDeleteResponse,
  type CashEntriesResponse,
  type CashEntry,
  type CashEntryBody,
  type SummaryResponse,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { HowTo } from '../../components/HowTo.js';
import { PageHeader, describeError } from '../../components/Page.js';
import { useOwnerLabels } from '../../owner-labels.js';
import { usePeriod } from '../../period.js';
import { CashDuplicateNotice } from './CashDuplicateNotice.js';
import { CashList } from './CashList.js';
import { DeleteConfirm } from './DeleteConfirm.js';
import { EmptyState } from './EmptyState.js';
import { NormalEntryCard } from './NormalEntryCard.js';
import { type CashNotice, ResultNotices } from './ResultNotices.js';
import type { CandidatesState } from './SharedEntryFields.js';
import { StickyBar } from './StickyBar.js';
import { TransitEntryCard } from './TransitEntryCard.js';
import {
  CASH_LIMITS,
  type CashFilter,
  type CashNormalDraft,
  type CashTab,
  type CashTransitDraft,
  type CashUrlState,
  DRAFT_SAVE_DELAY_MS,
  EMPTY_CASH_FILTER,
  addedElsewhereNotice,
  browserDraftStorage,
  cashBulkIdsError,
  cashDraftTimeLabel,
  cashListMonths,
  cashListView,
  cashPeriodLabel,
  clearCashDraft,
  defaultCashMonth,
  emptyNormalDraft,
  emptyTransitDraft,
  entryToForms,
  loadCashDraft,
  normalBody,
  normalError,
  paginateCash,
  readCashUrl,
  resetFormsAfterCreate,
  sampleCashEntries,
  saveCashDraft,
  todayIso,
  transitBody,
  transitError,
  visibleSelection,
  writeCashUrl,
} from './view-model.js';
import './cash.css';

const TITLE = '現金入力';
const QUESTION = '現金と交通費を、漏れなく記録しますか？';
const LEAD = (
  <>
    日々の現金の支払いや受け取り、交通費を記録します。
    <br />
    適切に分類することで、正確な会計データを作成できます。
  </>
);
const EMPTY_CANDIDATES = { biz: [], per: [] };
const NOT_FOUND_ON_EDIT = 'この明細は削除されたか、見つかりません';

interface CreationDraftSnapshot {
  normal: CashNormalDraft;
  transit: CashTransitDraft;
  tab: CashTab;
  savedAt: string | null;
  dirty: boolean;
}

/** API の 400 は最初の 1 件の文をそのまま出す。それ以外は共通の言い方 */
const writeErrorText = (error: unknown): string =>
  error instanceof ApiError && error.status === 400 ? error.message : describeError(error);

const isNotFound = (error: unknown): boolean => error instanceof ApiError && error.status === 404;

export function CashPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { key, withPeriod } = usePeriod();
  const { ownerLabel } = useOwnerLabels();
  const today = todayIso();

  // 期間は共通シェルと同じ summary の query から読む (同じ key なので問い合わせは増えない)
  const summary = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
  const period = summary.data?.period;
  const range = period?.applied ?? period?.full ?? null;
  const rangeFrom = range?.from ?? null;
  const rangeTo = range?.to ?? null;
  const months = useMemo(
    () => cashListMonths(rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : null, today),
    [rangeFrom, rangeTo, today],
  );

  const list = useQuery({
    queryKey: ['cash-entries', range?.from ?? null, range?.to ?? null],
    queryFn: () =>
      api<CashEntriesResponse>(
        range
          ? `/cash-entries?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
          : '/cash-entries',
      ),
    // 期間の正本が取れないときに、無期間で全件を読むことはしない
    enabled: summary.isSuccess,
  });
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });
  const userId = auth.data?.user?.id ?? null;

  /* -------- URL の状態 -------- */
  const url = readCashUrl(params, months);
  const month = url.month ?? defaultCashMonth(months, today) ?? today.slice(0, 7);
  const setUrl = (next: CashUrlState) => setParams(writeCashUrl(next), { replace: true });
  const setTab = (tab: CashTab) => setUrl({ ...url, tab });
  const setFilter = (patch: Partial<CashFilter>) =>
    setUrl({ ...url, filter: { ...url.filter, ...patch }, page: 1 });

  /* -------- 入力欄と下書き -------- */
  const [normal, setNormal] = useState<CashNormalDraft>(() => emptyNormalDraft(today));
  const [transit, setTransit] = useState<CashTransitDraft>(emptyTransitDraft);
  const [editing, setEditing] = useState<{ id: number; tab: CashTab } | null>(null);
  const [formError, setFormError] = useState<{ tab: CashTab; message: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const dirty = useRef(false);
  const restoredFor = useRef<string | null>(null);
  const creationBeforeEdit = useRef<CreationDraftSnapshot | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // 画面を開いたとき、その利用者の下書きを 1 回だけ戻す
  useEffect(() => {
    if (!userId || restoredFor.current === userId) return;
    restoredFor.current = userId;
    const draft = loadCashDraft(browserDraftStorage(), userId);
    if (!draft) return;
    setNormal(draft.normal);
    setTransit(draft.transit);
    setDraftSavedAt(draft.savedAt);
  }, [userId]);

  // 入力の変化から 500ms 後に保存する。編集中と、利用者が触っていない間は保存しない
  useEffect(() => {
    if (!userId || editing || !dirty.current) return;
    const timer = window.setTimeout(() => {
      const saved = saveCashDraft(
        browserDraftStorage(),
        userId,
        { normal, transit },
        new Date().toISOString(),
      );
      setDraftSavedAt(saved?.savedAt ?? null);
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userId, editing, normal, transit]);

  const changeNormal = (next: CashNormalDraft, source: CashTab = 'normal') => {
    if (!editing) dirty.current = true;
    setFormError((current) => (current?.tab === source ? null : current));
    setNormal(next);
  };
  const changeTransit = (next: CashTransitDraft) => {
    if (!editing) dirty.current = true;
    setFormError((current) => (current?.tab === 'transit' ? null : current));
    setTransit(next);
  };
  const discardDraft = () => {
    dirty.current = false;
    if (userId) clearCashDraft(browserDraftStorage(), userId);
    setDraftSavedAt(null);
  };
  const clearForms = () => {
    setNormal(emptyNormalDraft(today));
    setTransit(emptyTransitDraft());
    setFormError(null);
    discardDraft();
  };
  const restoreCreationDraft = (): CashTab => {
    const snapshot = creationBeforeEdit.current;
    creationBeforeEdit.current = null;
    setEditing(null);
    if (!snapshot) {
      dirty.current = false;
      setNormal(emptyNormalDraft(today));
      setTransit(emptyTransitDraft());
      setDraftSavedAt(null);
      setUrl({ ...url, tab: 'normal' });
      return 'normal';
    }
    dirty.current = snapshot.dirty;
    setNormal(snapshot.normal);
    setTransit(snapshot.transit);
    setDraftSavedAt(snapshot.savedAt);
    setUrl({ ...url, tab: snapshot.tab });
    return snapshot.tab;
  };
  const cancelEdit = () => {
    setFormError(null);
    restoreCreationDraft();
  };

  /* -------- 一覧 -------- */
  const [showingSamples, setShowingSamples] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<CashNotice | null>(null);
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const entries = list.data?.entries ?? [];
  const view = cashListView(entries, month, url);
  const samples = view.empty && showingSamples ? sampleCashEntries(month) : [];
  const sampleIds = new Set(samples.map((e) => e.id));
  const page = samples.length > 0 ? paginateCash(samples, 1) : view.page;
  const monthIds = new Set(view.monthRows.map((e) => e.id));
  // 二重計上の疑いも表と同じ月で絞る (表に無い行の警告だけが残ると探せない)
  const duplicates = (list.data?.duplicates ?? []).filter((d) => monthIds.has(d.cashEntryId));
  const duplicateIds = new Set(duplicates.map((d) => d.cashEntryId));
  const selectedIds = visibleSelection(selected, view.filtered);
  const bulkError = selectedIds.length > CASH_LIMITS.bulkMax ? cashBulkIdsError(selectedIds) : null;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const confirmTargets = (confirmIds ?? []).flatMap((id) => byId.get(id) ?? []);

  const candidatesState: CandidatesState =
    list.isLoading || summary.isLoading ? 'loading' : list.isError || summary.isError ? 'error' : 'ready';

  /* -------- 書き込み -------- */
  const refreshAll = () => void qc.invalidateQueries();

  const add = useMutation({
    mutationFn: ({ body }: { body: CashEntryBody; tab: CashTab }) =>
      api<{ entry: CashEntry }>('/cash-entries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: ({ entry }) => {
      // 日付・事業 / 個人・担当者は残し、それ以外と下書きを空にする (resetFormsAfterCreate)
      const next = resetFormsAfterCreate(normal);
      setNormal(next.normal);
      setTransit(next.transit);
      setFormError(null);
      discardDraft();
      setShowingSamples(false);
      const elsewhere = addedElsewhereNotice(entry.date, month, months);
      setNotice(elsewhere ? { kind: 'added', ...elsewhere } : null);
      refreshAll();
    },
    onError: (error, variables) => setFormError({ tab: variables.tab, message: writeErrorText(error) }),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CashEntryBody; tab: CashTab }) =>
      api<{ entry: CashEntry }>(`/cash-entries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setFormError(null);
      restoreCreationDraft();
      setNotice({ kind: 'saved' });
      refreshAll();
    },
    onError: (error, variables) => {
      if (isNotFound(error)) {
        const restoredTab = restoreCreationDraft();
        setFormError({ tab: restoredTab, message: NOT_FOUND_ON_EDIT });
        refreshAll();
        return;
      }
      setFormError({ tab: variables.tab, message: writeErrorText(error) });
    },
  });

  const remove = useMutation({
    mutationFn: async (ids: number[]): Promise<number[]> => {
      if (ids.length === 1) {
        const res = await api<CashDeleteResponse>(`/cash-entries/${ids[0]}`, { method: 'DELETE' });
        return [res.id];
      }
      const res = await api<CashBulkDeleteResponse>('/cash-entries/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      return res.ids;
    },
    onSuccess: (ids) => {
      setConfirmIds(null);
      setConfirmError(null);
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      if (editing && ids.includes(editing.id)) cancelEdit();
      setNotice({ kind: 'deleted', ids });
      refreshAll();
    },
    onError: (error, ids) => {
      // 一括の 404 は何も変わっていない。取り直して選択を消す
      if (ids.length > 1 && isNotFound(error)) {
        setConfirmIds(null);
        setSelected(new Set());
        refreshAll();
        return;
      }
      setConfirmError(describeError(error));
    },
  });

  const undo = useMutation({
    mutationFn: (ids: number[]) =>
      ids.length === 1
        ? api(`/cash-entries/${ids[0]}/restore`, { method: 'POST' })
        : api('/cash-entries/bulk-restore', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      setNotice({ kind: 'restored' });
      refreshAll();
    },
    onError: (error, ids) => {
      if (isNotFound(error)) {
        setNotice({ kind: 'restore-gone' });
        refreshAll();
        return;
      }
      setNotice({ kind: 'deleted', ids, error: describeError(error) });
    },
  });

  const busy = add.isPending || update.isPending;
  const activeTab: CashTab = editing?.tab ?? url.tab;
  const transitBlocked =
    normal.side === 'per' && !normal.categoryMajor.trim() ? '個人の交通費はカテゴリを選んでください' : null;

  const submit = (tab: CashTab) => {
    if (!editing && url.tab !== tab) setTab(tab);
    const error = tab === 'normal' ? normalError(normal) : transitError(normal, transit);
    if (error) {
      setFormError({ tab, message: error });
      return;
    }
    const body = tab === 'normal' ? normalBody(normal) : transitBody(normal, transit);
    if (editing) update.mutate({ id: editing.id, body, tab });
    else add.mutate({ body, tab });
  };

  const startEdit = (e: CashEntry) => {
    const snapshot: CreationDraftSnapshot = {
      normal,
      transit,
      tab: url.tab,
      savedAt: draftSavedAt,
      dirty: dirty.current,
    };
    // debounce 待ちの作成入力も、編集で上書きされる前に即時保存する
    if (userId && dirty.current) {
      const saved = saveCashDraft(
        browserDraftStorage(),
        userId,
        { normal, transit },
        new Date().toISOString(),
      );
      snapshot.savedAt = saved?.savedAt ?? snapshot.savedAt;
      setDraftSavedAt(snapshot.savedAt);
    }
    creationBeforeEdit.current = snapshot;
    dirty.current = false;
    const forms = entryToForms(e, normal);
    setEditing({ id: e.id, tab: forms.tab });
    setNormal(forms.normal);
    setTransit(forms.transit);
    setFormError(null);
    setUrl({ ...url, tab: forms.tab });
    dateRef.current?.scrollIntoView?.({ block: 'center' });
  };

  const startFirstEntry = () => {
    setTab('normal');
    dateRef.current?.focus();
  };

  const toggleRow = (id: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const togglePage = (ids: number[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const draftSavedLabel = draftSavedAt && !editing ? cashDraftTimeLabel(draftSavedAt) : null;
  const listStatus =
    list.isLoading || summary.isLoading ? 'loading' : list.isError || summary.isError ? 'error' : 'ready';

  return (
    <div className="cash-page">
      <div className="cash-head">
        <PageHeader route="cash" title={TITLE} question={QUESTION} lead={LEAD} showTask={false} />
        <aside className="card cash-period" aria-label="対象期間">
          <h2>対象期間（グローバル）</h2>
          {summary.isError ? (
            <div className="cash-period-error">
              <p className="cash-error" role="alert">
                対象期間を取得できませんでした。期間を再読込してください。
              </p>
              <Button size="mini" onClick={() => void summary.refetch()}>
                対象期間を再読込
              </Button>
            </div>
          ) : (
            <>
              <p className="cash-period-range">{range ? cashPeriodLabel(range) : (period?.label ?? '—')}</p>
              <p className="sub">サイト全体で共通の分析期間です。</p>
            </>
          )}
        </aside>
      </div>

      <div className="cash-tabs" role="tablist" aria-label="入力の種類">
        {(
          [
            ['normal', '通常入力', '現金の支払いや受け取りを入力'],
            ['transit', '交通費入力', '電車・バス・タクシーなどの交通費を入力'],
          ] as const
        ).map(([tab, label, sub]) => (
          <button
            key={tab}
            type="button"
            data-native-control="tab"
            role="tab"
            id={`cash-tab-${tab}`}
            aria-selected={activeTab === tab}
            className={`cash-tab${activeTab === tab ? ' is-active' : ''}`}
            disabled={editing !== null && editing.tab !== tab}
            onClick={() => setTab(tab)}
          >
            <span className="cash-tab-label">{label}</span>
            <span className="sub">{sub}</span>
          </button>
        ))}
      </div>

      <div className={`cash-entry-grid is-${activeTab}`}>
        <NormalEntryCard
          value={normal}
          onChange={(next) => changeNormal(next, 'normal')}
          candidates={list.data?.candidates ?? EMPTY_CANDIDATES}
          candidatesState={candidatesState}
          ownerLabel={ownerLabel}
          active={activeTab === 'normal'}
          editing={editing?.tab === 'normal'}
          busy={busy}
          error={formError?.tab === 'normal' ? formError.message : null}
          draftSavedLabel={draftSavedLabel}
          dateRef={dateRef}
          onSubmit={() => submit('normal')}
          onClear={clearForms}
          onCancelEdit={cancelEdit}
          onSwitchToTransit={() => setTab('transit')}
          onActivate={() => !editing && setTab('normal')}
        />
        <TransitEntryCard
          value={transit}
          onChange={changeTransit}
          sharedValue={normal}
          onSharedChange={(next) => changeNormal(next, 'transit')}
          candidates={list.data?.candidates ?? EMPTY_CANDIDATES}
          candidatesState={candidatesState}
          ownerLabel={ownerLabel}
          active={activeTab === 'transit'}
          editing={editing?.tab === 'transit'}
          busy={busy}
          error={formError?.tab === 'transit' ? formError.message : null}
          blockedReason={transitBlocked}
          onSubmit={() => submit('transit')}
          onCancelEdit={cancelEdit}
          onSwitchToNormal={() => setTab('normal')}
          onActivate={() => !editing && setTab('transit')}
        />
      </div>

      <CashDuplicateNotice duplicates={duplicates} entries={view.monthRows} />

      <CashList
        status={listStatus}
        error={summary.error ?? list.error}
        onRetry={() => void (summary.isError ? summary.refetch() : list.refetch())}
        month={month}
        months={months}
        onMonth={(m) => {
          setSelected(new Set());
          setUrl({ ...url, month: m, page: 1 });
        }}
        filter={url.filter}
        onFilter={setFilter}
        onClearFilter={() => setUrl({ ...url, filter: { ...EMPTY_CASH_FILTER }, page: 1 })}
        categories={view.categories}
        ownerLabel={ownerLabel}
        totals={view.totals}
        showingSamples={samples.length > 0}
        page={page}
        onPage={(n) => setUrl({ ...url, page: n })}
        emptyState={
          view.empty ? (
            <EmptyState
              showingSamples={showingSamples}
              onStart={startFirstEntry}
              onToggleSamples={() => setShowingSamples((v) => !v)}
            />
          ) : null
        }
        noMatch={view.noMatch}
        sampleIds={sampleIds}
        duplicateIds={duplicateIds}
        selected={selected}
        onToggle={toggleRow}
        onTogglePage={togglePage}
        onBulkDelete={() => {
          setConfirmError(null);
          setConfirmIds(selectedIds);
        }}
        selectedCount={selectedIds.length}
        bulkError={bulkError}
        editingId={editing?.id ?? null}
        deleteBusy={remove.isPending}
        onEdit={startEdit}
        onDelete={(e) => {
          setConfirmError(null);
          setConfirmIds([e.id]);
        }}
      >
        <DeleteConfirm
          targets={confirmTargets}
          busy={remove.isPending}
          error={confirmError}
          onCancel={() => setConfirmIds(null)}
          onConfirm={() => remove.mutate(confirmTargets.map((e) => e.id))}
        />
        <ResultNotices
          notice={notice}
          busy={undo.isPending}
          onUndo={(ids) => undo.mutate(ids)}
          onShowMonth={(m) => {
            setNotice(null);
            setUrl({ ...url, month: m, page: 1 });
          }}
          onDismiss={() => setNotice(null)}
        />
      </CashList>

      <HowTo id="cashLedger" />

      <StickyBar
        tab={activeTab}
        editing={editing !== null}
        busy={busy}
        disabled={activeTab === 'transit' && transitBlocked !== null}
        draftSavedLabel={draftSavedLabel}
        onSubmit={() => submit(activeTab)}
      />
    </div>
  );
}
