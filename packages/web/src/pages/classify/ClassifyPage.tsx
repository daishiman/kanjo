/**
 * 明細仕分け画面 (spec-classify-screen 7.1)。
 *
 * この画面の役割は「絞り込み・取得・選択・保存の配線」だけに絞ってある。
 * 表示の整形は view-model の純関数、欄の並びは 7.4〜7.10 の各パネルが持つ。
 *
 * 絞り込みの正本は URL。コンポーネントの state に置くと、URL から開き直した人と
 * 画面で押して絞った人とで同じ URL が別の結果になる。
 */
import type { Candidates, SplitTemplate } from '@kanjo/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type BulkItemBody,
  type BulkSaveResponse,
  type ClassifyRow,
  type ClassifyRuleBody,
  type ClassifyRuleRow,
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
  type ClassifyFilters,
  DEFAULT_FILTERS,
  type EditInput,
  countText,
  filtersToParams,
  inputFromRow,
  isDefaultFilters,
  parseFilters,
  parseSelectionParams,
  periodRangeLabel,
  resolveBulkItem,
  selectionParams,
} from './view-model.js';
import './classify.css';

const LEAD = '未整理の明細を、根拠を見ながら確定しますか？';
const HOW_TO = [
  '取引明細を確認し、適切な区分・カテゴリに仕分けて確定しましょう。',
  '自動提案を参考にしながら、必要に応じて手動で変更できます。',
];
const EMPTY_CANDIDATES: Candidates = { biz: [], per: [] };

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
  qs.set('limit', '50');
  return qs.toString();
}

export function ClassifyPage() {
  const [params, setParams] = useSearchParams();
  const filters = parseFilters(params);
  const { selected, openTxKey } = parseSelectionParams(params);
  const { key, withPeriod } = usePeriod();
  const qc = useQueryClient();

  const [notice, setNotice] = useState<ClassifyNotice | null>(null);
  const [side, setSide] = useState<{ kind: 'split' } | { kind: 'rule'; rule: ClassifyRuleBody } | null>(null);
  const [splitTemplate, setSplitTemplate] = useState<SplitTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

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
  const rows = data?.rows ?? [];
  const allRows = data?.transactions ?? rows;
  const open = allRows.find((r) => r.rowKey === openTxKey) ?? null;

  const history = useQuery({
    queryKey: ['classify-history', open?.id],
    enabled: open != null,
    queryFn: () =>
      api<{ items: TxHistoryRow[] }>(`/transactions/${encodeURIComponent(open?.id ?? '')}/history`),
  });

  const refresh = (operation: Parameters<typeof invalidateClassificationQueries>[1] = 'edit') =>
    invalidateClassificationQueries(qc, operation);

  const setLocation = (
    next: ClassifyFilters,
    nextSelected: readonly string[] = selected,
    nextOpen: string | null = openTxKey,
  ) => setParams({ ...filtersToParams(next), ...selectionParams(nextSelected, nextOpen) }, { replace: true });
  const update = (next: ClassifyFilters) => setLocation(next);
  const setSelected = (next: string[]) => setLocation(filters, next);
  const setOpenKey = (next: string | null) => setLocation(filters, selected, next);
  const clear = () => setLocation(DEFAULT_FILTERS);

  /* -------- 一括保存 (7.8) -------- */
  const failureOf = (item: BulkItemBody, message: string): BulkFailure => {
    const row = allRows.find((candidate) => candidate.id === item.txId);
    return {
      txId: item.txId,
      rowKey: row?.rowKey ?? item.txId,
      date: row?.date ?? '',
      payee: row?.payee ?? item.txId,
      message,
      item,
    };
  };

  const bulkSave = (items: BulkItemBody[], clientFailures: BulkFailure[] = []) => {
    const n = items.length + clientFailures.length;
    if (items.length === 0) {
      setNotice({ kind: 'bulk', n, m: 0, k: n, failures: clientFailures });
      setSelected(clientFailures.map((failure) => failure.rowKey));
      return;
    }
    setBusy(true);
    api<BulkSaveResponse>('/transactions/bulk', { method: 'POST', body: JSON.stringify({ items }) })
      .then((res) => {
        const failures: BulkFailure[] = [
          ...clientFailures,
          ...res.results
            .filter((r) => !r.ok)
            .map((r) =>
              failureOf(
                items.find((item) => item.txId === r.txId) ?? { txId: r.txId },
                r.error?.message ?? '保存できませんでした。',
              ),
            ),
        ];
        setNotice({ kind: 'bulk', n, m: res.saved, k: failures.length, failures });
        setSelected(failures.map((failure) => failure.rowKey));
        refresh('bulk');
      })
      .catch(() => {
        const failures = [
          ...clientFailures,
          ...items.map((item) => failureOf(item, '通信できませんでした。同じ内容で再試行できます。')),
        ];
        setNotice({ kind: 'bulk', n, m: 0, k: failures.length, failures });
        setSelected(failures.map((failure) => failure.rowKey));
      })
      .finally(() => setBusy(false));
  };

  const retry = (failures: BulkFailure[]) => bulkSave(failures.flatMap((failure) => failure.item ?? []));

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

  const kpi = data?.kpi ?? { all: 0, unsorted: 0, review: 0, manual: 0, done: 0 };
  const candidates = data?.candidates ?? EMPTY_CANDIDATES;
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
            onRetry={retry}
            onUndo={undo}
          />

          <div className="classify-body">
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
                  sort={filters.sort}
                  selected={selected}
                  openTxKey={openTxKey}
                  onSort={(sort) => update({ ...filters, sort, page: 1 })}
                  onSelect={setSelected}
                  onOpen={(row) => {
                    setSide(null);
                    setSplitTemplate(null);
                    setOpenKey(row.rowKey);
                  }}
                  onPage={(page) => update({ ...filters, page })}
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

          <BulkActionBar
            selected={selected}
            rows={rows}
            busy={busy}
            onClear={() => setSelected([])}
            onSave={() => {
              const resolved = allRows
                .filter((row) => selected.includes(row.rowKey))
                .map((row) => ({ row, result: resolveBulkItem(row, loadDraft(row.id)?.input ?? null) }));
              const items = resolved.flatMap(({ result }) => (result.ok ? [result.item] : []));
              const failures = resolved.flatMap(({ row, result }) =>
                result.ok
                  ? []
                  : [
                      {
                        txId: row.id,
                        rowKey: row.rowKey,
                        date: row.date,
                        payee: row.payee,
                        message: result.message,
                        item: null,
                      } satisfies BulkFailure,
                    ],
              );
              bulkSave(items, failures);
            }}
          />

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
