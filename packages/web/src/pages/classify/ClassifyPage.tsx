/**
 * 明細仕分け画面 (spec-classify-screen 7.1・spec-classify-bulk-save)。
 *
 * この画面の役割は「絞り込み・取得・選択・保存の配線」だけに絞ってある。
 * 表示の整形は view-model の純関数、欄の並びは 7.4〜7.10 の各パネルが持つ。
 *
 * 絞り込みと選択の正本は URL。コンポーネントの state に置くと、URL から開き直した人と
 * 画面で押して絞った人とで同じ URL が別の結果になる。
 */
import { type Candidates, SELECTION_MAX, type SplitTemplate } from '@kanjo/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type BulkSaveBody,
  type BulkSaveResponse,
  type ClassifyRow,
  type ClassifyRuleBody,
  type ClassifyRuleRow,
  type ClassifySelectedResponse,
  type ClassifyTransactionsResponse,
  type SavedFilterRow,
  type TxHistoryRow,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { invalidateClassificationQueries } from '../../components/classification-invalidate.js';
import { usePeriod } from '../../period.js';
import { BulkActionBar } from './BulkActionBar.js';
import { EditPanel, type RuleDraft } from './EditPanel.js';
import { FilterPanel } from './FilterPanel.js';
import { type BulkFailure, type ClassifyNotice, ResultNotices } from './ResultNotices.js';
import { RulePreviewPanel } from './RulePreviewPanel.js';
import { SplitEditorPanel } from './SplitEditorPanel.js';
import { TransactionTable } from './TransactionTable.js';
import { loadDraft } from './draft.js';
import {
  type BulkForm,
  type ClassifyFilters,
  DEFAULT_FILTERS,
  EMPTY_BULK_FORM,
  type EditInput,
  bulkRequestFailure,
  bulkSpecOf,
  countText,
  filtersToParams,
  isDefaultFilters,
  parseFilters,
  parseSelectionParams,
  periodRangeLabel,
  planBulkSave,
  selectionParams,
} from './view-model.js';
import './classify.css';

const LEAD = '未整理の明細を、根拠を見ながら確定しますか？';
const HOW_TO = [
  '取引明細を確認し、適切な区分・カテゴリに仕分けて確定しましょう。',
  '自動提案を参考にしながら、必要に応じて手動で変更できます。',
];
const EMPTY_CANDIDATES: Candidates = { biz: [], per: [] };
const EMPTY_ROWS: ClassifyRow[] = [];

/** 一覧の取得に載せる絞り込み。既定値も省かずに送る (サーバ側の既定と食い違わせない) */
function listQuery(f: ClassifyFilters): string {
  const qs = new URLSearchParams();
  qs.set('status', f.status.join(','));
  if (f.category) qs.set('category', f.category);
  if (f.owner) qs.set('owner', f.owner);
  if (f.method) qs.set('method', f.method);
  if (f.manual) qs.set('manual', '1');
  if (f.q) qs.set('q', f.q);
  qs.set('sort', f.sort);
  qs.set('page', String(f.page));
  qs.set('limit', String(f.limit));
  return qs.toString();
}

/** 一括指定から本文を作る。指定が空なら bulk を省く (サーバは空の bulk を受けない) */
const bulkBody = (bulk: BulkSaveBody['bulk'], items: BulkSaveBody['items']): BulkSaveBody =>
  bulk && Object.keys(bulk).length > 0 ? { bulk, items } : { items };

export function ClassifyPage() {
  const [params, setParams] = useSearchParams();
  const filters = parseFilters(params);
  const { selected, openTxKey } = parseSelectionParams(params);
  const { key, withPeriod } = usePeriod();
  const qc = useQueryClient();

  // 保存の応答を待つ間に利用者がページや絞り込みを変えうる。react-router の関数形の
  // setSearchParams は取り出した描画の値を渡すので、確定した最新の URL をここに写しておく
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);

  const [notice, setNotice] = useState<ClassifyNotice | null>(null);
  const [side, setSide] = useState<{ kind: 'split' } | { kind: 'rule'; rule: ClassifyRuleBody } | null>(null);
  const [splitTemplate, setSplitTemplate] = useState<SplitTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<BulkForm>(EMPTY_BULK_FORM);
  /** URL の sel から外した「見つからない明細」。件数と内訳には残す (FR-04) */
  const [lost, setLost] = useState<string[]>([]);
  /** 見出しの全選択が上限で止まったか (AC-20) */
  const [capped, setCapped] = useState(false);

  const qs = listQuery(filters);
  const list = useQuery({
    queryKey: ['classify', key, qs],
    queryFn: () => api<ClassifyTransactionsResponse>(withPeriod(`/transactions?${qs}`)),
    placeholderData: keepPreviousData,
  });
  const savedFilters = useQuery({
    queryKey: ['classify-saved-filters'],
    queryFn: () => api<{ items: SavedFilterRow[] }>('/saved-filters'),
  });
  const rules = useQuery({
    queryKey: ['classify-rules'],
    queryFn: () => api<{ rules: ClassifyRuleRow[] }>('/rules'),
  });

  const data = list.data;
  const rows = data?.rows ?? EMPTY_ROWS;
  const onPage = new Set(rows.map((r) => r.rowKey));

  /* -------- 表示外の選択の読み出し (FR-09・AC-18) -------- */
  // 表示中の行は一覧の応答をそのまま使い、それ以外だけを key で読む
  const offPage = selected.filter((k) => !onPage.has(k));
  const picked = useQuery({
    queryKey: ['classify', 'selected', offPage],
    enabled: data != null && offPage.length > 0,
    queryFn: () =>
      api<ClassifySelectedResponse>(
        `/transactions/selected?keys=${offPage.map((k) => encodeURIComponent(k)).join(',')}`,
      ),
    placeholderData: keepPreviousData,
  });
  const extra = offPage.length > 0 ? (picked.data?.rows ?? EMPTY_ROWS) : EMPTY_ROWS;
  const byKey = new Map<string, ClassifyRow>();
  for (const row of [...rows, ...extra]) if (!byKey.has(row.rowKey)) byKey.set(row.rowKey, row);
  const selectedRows = selected.flatMap((k) => byKey.get(k) ?? []);
  // 前の key の答え (placeholder) の missing で外すと、読み込み中の明細まで消してしまう
  const settledMissing =
    offPage.length > 0 && picked.data && !picked.isPlaceholderData ? picked.data.missing : [];
  const pendingKeys = selected.filter((k) => !byKey.has(k) && !settledMissing.includes(k));

  const missingSignature = JSON.stringify(
    settledMissing.filter((k) => selected.includes(k) && !onPage.has(k)),
  );
  useEffect(() => {
    const gone: string[] = JSON.parse(missingSignature);
    if (gone.length === 0) return;
    setLost((prev) => [...new Set([...prev, ...gone])]);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const rest = parseSelectionParams(prev).selected.filter((k) => !gone.includes(k));
        if (rest.length > 0) next.set('sel', rest.join(','));
        else next.delete('sel');
        return next;
      },
      { replace: true },
    );
  }, [missingSignature, setParams]);

  const open =
    rows.find((r) => r.rowKey === openTxKey) ?? selectedRows.find((r) => r.rowKey === openTxKey) ?? null;

  const history = useQuery({
    queryKey: ['classify-history', open?.id],
    enabled: open != null,
    queryFn: () =>
      api<{ items: TxHistoryRow[] }>(`/transactions/${encodeURIComponent(open?.id ?? '')}/history`),
  });

  const refresh = (operation: Parameters<typeof invalidateClassificationQueries>[1] = 'edit') =>
    invalidateClassificationQueries(qc, operation);

  const setLocation = (patch: {
    filters?: ClassifyFilters;
    selected?: readonly string[];
    open?: string | null;
  }) => {
    const prev = latestParams.current;
    const current = parseSelectionParams(prev);
    setParams(
      {
        ...filtersToParams(patch.filters ?? parseFilters(prev)),
        ...selectionParams(
          patch.selected ?? current.selected,
          patch.open !== undefined ? patch.open : current.openTxKey,
        ),
      },
      { replace: true },
    );
  };
  const update = (next: ClassifyFilters) => setLocation({ filters: next });
  const setSelected = (next: readonly string[]) => setLocation({ selected: next });
  const setOpenKey = (next: string | null) => setLocation({ open: next });
  const clear = () => setLocation({ filters: DEFAULT_FILTERS });
  const clearSelection = () => {
    setLost([]);
    setCapped(false);
    setSelected([]);
  };

  const kpi = data?.kpi ?? { all: 0, unsorted: 0, review: 0, manual: 0, done: 0 };
  const candidates = data?.candidates ?? EMPTY_CANDIDATES;

  /* -------- 一括保存 (spec-classify-bulk-save FR-02〜FR-07・FR-16) -------- */
  const bulk = bulkSpecOf(form);
  const plan = planBulkSave(selectedRows, bulk, candidates, (id) => loadDraft(id)?.input ?? null);
  const selectedCount = selected.length + lost.length;

  const sendBulk = (body: BulkSaveBody) => {
    // 応答の txId を明細へ結ぶ。送った時点で見えていた行から引く
    const known = new Map([...rows, ...extra].map((row) => [row.id, row]));
    setBusy(true);
    api<BulkSaveResponse>('/transactions/bulk', { method: 'POST', body: JSON.stringify(body) })
      .then((res) => {
        const failed = res.results.filter((r) => !r.ok);
        if (failed.length === 0) {
          setNotice({
            kind: 'bulk',
            n: body.items.length,
            m: res.saved,
            k: 0,
            failures: [],
            retryBody: null,
          });
          setForm(EMPTY_BULK_FORM);
          clearSelection();
        } else {
          const failures: BulkFailure[] = failed.map((r) => {
            const row = known.get(r.txId);
            return {
              txId: r.txId,
              date: row?.date ?? '',
              payee: row?.payee ?? r.txId,
              message: r.error?.message ?? '保存できませんでした',
            };
          });
          // 送り直して直るのは書き込みの失敗だけ。見つからない・合わない明細は同じ答えになる
          const retryIds = new Set(failed.filter((r) => r.error?.code === 'write_failed').map((r) => r.txId));
          const retryItems = body.items.filter((item) => retryIds.has(item.txId));
          setNotice({
            kind: 'bulk',
            n: body.items.length,
            m: res.saved,
            k: failures.length,
            failures,
            retryBody: retryItems.length > 0 ? bulkBody(body.bulk, retryItems) : null,
          });
          setLost([]);
          setCapped(false);
          setSelected(retryItems.flatMap((item) => known.get(item.txId)?.rowKey ?? []));
        }
        refresh('bulk');
      })
      .catch((error: unknown) => {
        const failure = bulkRequestFailure(error);
        // 401 はログイン切れの扱いに任せる
        if (!failure) return;
        setNotice({ kind: 'request', message: failure.message, retryBody: failure.retry ? body : null });
        // 書き込まれたか分からない失敗は、一覧と選択の読み出しを読み直して今の状態を見せる
        if (failure.reload) void qc.invalidateQueries({ queryKey: ['classify'] });
      })
      .finally(() => setBusy(false));
  };

  /* -------- 1 件の保存・削除 (7.6・7.7) -------- */
  // Promise を返す。編集パネルはこれが解決したときだけ下書きを捨てる (UC-8-2・FR-17)
  const saveOne = (row: ClassifyRow, input: EditInput): Promise<void> => {
    setBusy(true);
    return api(`/transactions/${encodeURIComponent(row.id)}/edit`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
      .then(() => {
        refresh('edit');
      })
      .finally(() => setBusy(false));
  };

  const deleteOne = (row: ClassifyRow) => {
    const request = { granularity: 'transaction' as const, txIds: [row.id] };
    setBusy(true);
    api<{ fingerprint: string }>('/data/deletions/preflight', {
      method: 'POST',
      body: JSON.stringify(request),
    })
      .then((pre) =>
        api<{ operationId: string }>('/data/deletions', {
          method: 'POST',
          body: JSON.stringify({ ...request, fingerprint: pre.fingerprint }),
        }),
      )
      .then((res) => {
        setNotice({ kind: 'delete', n: 1, operationId: res.operationId });
        setOpenKey(null);
        refresh('delete');
      })
      .finally(() => setBusy(false));
  };

  const undo = (operationId: string) => {
    setBusy(true);
    api(`/data/undo/${encodeURIComponent(operationId)}`, { method: 'POST' })
      .then(() => {
        setNotice({ kind: 'undo' });
        refresh('undo');
      })
      .finally(() => setBusy(false));
  };

  /* -------- 保存したフィルタ (7.4) -------- */
  const saveFilter = (name: string) => {
    const query = {
      status: filters.status,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.owner ? { owner: filters.owner } : {}),
      ...(filters.method ? { method: filters.method } : {}),
      ...(filters.manual ? { manual: true } : {}),
      ...(filters.q ? { q: filters.q } : {}),
      sort: filters.sort,
    };
    void api('/saved-filters', { method: 'POST', body: JSON.stringify({ name, query }) }).then(() =>
      refresh('saved-filter'),
    );
  };

  const header = <PageHeader route="classify" title="明細仕分け" showTask={false} lead={LEAD} />;

  const makeRule = (draft: RuleDraft, input: EditInput) =>
    setSide({
      kind: 'rule',
      rule: {
        keyword: draft.keyword || draft.payee,
        payee: draft.payee,
        scope: draft.scope,
        cls: input.cls,
        big: input.big,
        mid: input.mid,
        owner: input.owner,
        splitTemplate,
      },
    });

  return (
    <div className={`classify-page${dirty ? ' is-dirty' : ''}`}>
      {header}
      <details className="classify-howto">
        <summary>明細仕分けの使い方</summary>
        {HOW_TO.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {/* 事業を個人の支払い方法で払った行はここで区分と支払い方法の両方を決める。
            用語の意味は辞書側に置き、この行から引けるようにする。 */}
        <p>
          事業の支出を個人の口座・カードで払った行は、区分を「事業」、支払い方法を個人のものにして確定する (
          <Term id="bizAdvance">事業立替</Term>)。
        </p>
      </details>

      {list.isLoading && !data ? (
        <PageState status="loading" />
      ) : list.isError && !data ? (
        <PageState status="error" message="明細を読み込めませんでした。" error={list.error} />
      ) : (
        <>
          <div className="classify-kpis">
            {(
              [
                { id: 'unsorted', label: '未整理', value: kpi.unsorted, note: '確定を待っています' },
                {
                  id: 'review',
                  label: '要確認',
                  value: kpi.review,
                  note: `未整理のうち${countText(kpi.review)}`,
                },
                { id: 'manual', label: '手動変更', value: kpi.manual, note: '提案と異なる値で確定' },
                { id: 'done', label: '完了', value: kpi.done, note: '提案どおりに確定' },
              ] as const
            ).map((card) => {
              const active = filters.status.length === 1 && filters.status[0] === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  data-native-control="toggle"
                  aria-pressed={active}
                  className={`kpi${active ? ' is-active' : ''}`}
                  onClick={() => update({ ...filters, status: [card.id], page: 1 })}
                >
                  <span className="kpi-content">
                    <span className="label">{card.label}</span>
                    <span className="value">{countText(card.value)}</span>
                  </span>
                  <span className="note">{card.note}</span>
                </button>
              );
            })}
          </div>

          <ResultNotices
            notice={notice}
            busy={busy}
            onDismiss={() => setNotice(null)}
            onRetry={sendBulk}
            onUndo={undo}
          />

          <div className={`classify-body${open ? ' has-open' : ''}`}>
            <FilterPanel
              filters={filters}
              onChange={update}
              kpi={kpi}
              candidates={candidates}
              periodLabel={periodRangeLabel(data?.period?.from ?? null, data?.period?.to ?? null)}
              saved={savedFilters.data?.items ?? []}
              onApplySaved={(row) =>
                update({ ...DEFAULT_FILTERS, ...(row.query as unknown as Partial<ClassifyFilters>), page: 1 })
              }
              onDeleteSaved={(row) => {
                void api(`/saved-filters/${encodeURIComponent(row.id)}`, { method: 'DELETE' }).then(() =>
                  qc.invalidateQueries({ queryKey: ['classify-saved-filters'] }),
                );
              }}
              onSaveCurrent={saveFilter}
              onClear={clear}
            />

            <div className="classify-main">
              {kpi.all === 0 ? (
                <PageState status="empty" message="この期間の明細はありません。" />
              ) : (data?.total ?? 0) === 0 ? (
                <PageState
                  status="empty"
                  message="条件に合う明細はありません。"
                  action={
                    <Button variant="secondary" onClick={clear} disabled={isDefaultFilters(filters)}>
                      フィルタをクリア
                    </Button>
                  }
                />
              ) : (
                <TransactionTable
                  rows={rows}
                  total={data?.total ?? 0}
                  page={filters.page}
                  limit={data?.limit ?? filters.limit}
                  pageSize={filters.limit}
                  sort={filters.sort}
                  selected={selected}
                  selectionMax={SELECTION_MAX - lost.length}
                  openTxKey={openTxKey}
                  onSort={(sort) => update({ ...filters, sort, page: 1 })}
                  onSelect={(next, stopped) => {
                    setCapped(stopped);
                    setSelected(next);
                  }}
                  onOpen={(row) => {
                    setSide(null);
                    setSplitTemplate(null);
                    setOpenKey(row.rowKey);
                  }}
                  onPage={(page) => update({ ...filters, page })}
                  onPageSize={(limit) => update({ ...filters, limit, page: 1 })}
                />
              )}
            </div>

            <div className="classify-side">
              {open == null ? (
                <p className="sub classify-side-empty">明細を選ぶと、ここで編集できます。</p>
              ) : (
                <EditPanel
                  key={open.rowKey}
                  row={open}
                  candidates={candidates}
                  history={history.data?.items ?? []}
                  historyError={history.isError}
                  rules={(rules.data?.rules ?? []).filter((r) => r.payee === open.payee)}
                  busy={busy}
                  onClose={() => setOpenKey(null)}
                  onSave={(input) => saveOne(open, input)}
                  onDelete={() => deleteOne(open)}
                  onSplit={() => setSide({ kind: 'split' })}
                  onMakeRule={makeRule}
                  onDirtyChange={setDirty}
                />
              )}
            </div>
          </div>

          {selectedCount > 0 && (
            <BulkActionBar
              count={selectedCount}
              keys={selected}
              rows={selectedRows}
              pendingKeys={pendingKeys}
              loadError={picked.isError}
              plan={plan}
              lostCount={lost.length}
              capped={capped}
              form={form}
              candidates={candidates}
              busy={busy}
              onFormChange={setForm}
              onClear={clearSelection}
              onSave={() => sendBulk(bulkBody(bulk, plan.items))}
            />
          )}

          {open && side && (
            <div className="classify-lower" aria-label="詳細操作">
              {side.kind === 'split' ? (
                <SplitEditorPanel
                  row={open}
                  candidates={candidates}
                  onClose={() => setSide(null)}
                  onSaved={(template) => {
                    setSplitTemplate(template);
                    setSide(null);
                    refresh('split');
                  }}
                />
              ) : (
                <RulePreviewPanel
                  rule={side.rule}
                  period={{ from: data?.period?.from ?? '', to: data?.period?.to ?? '' }}
                  onClose={() => setSide(null)}
                  onApplied={() => {
                    setSide(null);
                    refresh('rule');
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
