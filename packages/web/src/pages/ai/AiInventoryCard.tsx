/**
 * 依頼カードの右「使用するデータ」(spec-ai-analysis-screen FR-2)。
 *
 * 件数は期間だけで決まる。中身 (AI へ渡す集計値) は依頼ごとに保存されているので、
 * 表示中の期間と同じ期間の依頼を core `aiDatasetSourceTask` が 1 件選んで開く。
 * 利用者に依頼を選ばせない: 期間が同じなら渡したデータも同じだから。
 */
import { aiDatasetSourceTask } from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type AiInventoryResponse, type AiTaskView, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { describeError } from '../../components/Page.js';

export function AiInventoryCard({
  range,
  tasks,
}: {
  range: { from: string; to: string } | null;
  /** 一覧と同じ依頼。この中から同じ期間のものを選ぶ */
  tasks: AiTaskView[];
}) {
  const inventory = useQuery({
    queryKey: ['ai-inventory', range?.from, range?.to],
    queryFn: () =>
      api<AiInventoryResponse>(
        `/ai/inventory?from=${encodeURIComponent(range?.from ?? '')}&to=${encodeURIComponent(range?.to ?? '')}`,
      ),
    enabled: !!range,
  });
  const [dataset, setDataset] = useState<string | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const source = aiDatasetSourceTask(tasks, range);

  const openDataset = async () => {
    if (!source) return;
    setLoadingDataset(true);
    setDatasetError(null);
    try {
      const d = await api<unknown>(`/ai/tasks/${source.id}/dataset`);
      setDataset(JSON.stringify(d, null, 2));
    } catch (e) {
      setDatasetError(describeError(e));
    } finally {
      setLoadingDataset(false);
    }
  };

  const inv = inventory.data;
  const rows: [string, string][] = inv
    ? [
        ['対象期間', inv.period.label],
        ['freee 事業取引', `${inv.freeeDeals.toLocaleString('ja-JP')}件`],
        ['MF 家計明細', `${inv.mfTransactions.toLocaleString('ja-JP')}件`],
        ['科目数', `${inv.categories.toLocaleString('ja-JP')}件`],
        ['取引先数', `${inv.counterparties.toLocaleString('ja-JP')}件`],
      ]
    : [];

  return (
    <aside className="ai-inventory" aria-labelledby="ai-inventory-title">
      <h3 id="ai-inventory-title">使用するデータ</h3>
      {!range ? (
        <p className="sub">期間が決まると件数が出ます。</p>
      ) : inventory.isLoading ? (
        <p className="sub">件数を読み込み中…</p>
      ) : inventory.isError ? (
        <div role="alert">
          <p className="sub">件数を読み込めませんでした</p>
          <Button size="mini" onClick={() => void inventory.refetch()}>
            再読込
          </Button>
        </div>
      ) : (
        <dl className="ai-inventory-list">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="sub">AIには明細そのものではなく、月別・科目別などの集計値だけを渡します。</p>
      <Button
        size="mini"
        disabled={!source || loadingDataset}
        title={source ? undefined : 'この期間で依頼を作ると、AIに渡すデータを確認できます'}
        onClick={() => void openDataset()}
      >
        {loadingDataset ? '読み込み中…' : '使用データを確認'}
      </Button>
      {range && !source && (
        <p className="sub">この期間の依頼はまだありません。依頼を作ると中身を確認できます。</p>
      )}
      {datasetError && (
        <p className="notice" role="alert">
          {datasetError}
        </p>
      )}
      {dataset && (
        <textarea className="ai-dataset" readOnly value={dataset} rows={10} aria-label="AIに渡すデータ" />
      )}
    </aside>
  );
}
