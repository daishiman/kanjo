/** P9 設定: 科目正規化・未記帳月・現金補正・エクスポート/復元(FR-05) */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { type SettingsResponse, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';

export function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<SettingsResponse>('/settings') });
  const [normDraft, setNormDraft] = useState<[string, string][] | null>(null);
  const [unrecDraft, setUnrecDraft] = useState<string | null>(null);
  const [cashDraft, setCashDraft] = useState<{ month: string; revenue: string; expense: string }>({
    month: '',
    revenue: '',
    expense: '',
  });
  const restoreInput = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setNormDraft(null);
      setUnrecDraft(null);
      void qc.invalidateQueries();
    },
  });

  const restore = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return api('/restore', { method: 'POST', body: text });
    },
    onSuccess: () => void qc.invalidateQueries(),
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="settings" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="settings" />
        <PageState status="error" error={q.error} />
      </>
    );
  const s = q.data;
  const norm = normDraft ?? Object.entries(s.normMap);
  const unrec = unrecDraft ?? s.unrecordedExpMonths.join(', ');

  return (
    <>
      <PageHeader route="settings" />

      <div className="card">
        <h2>科目正規化マップ(freee勘定科目 → 集計上の科目)</h2>
        <p className="sub">変更すると全期間の集計が作り直されます。</p>
        <table className="data" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>元の勘定科目</th>
              <th>正規化後</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {norm.map(([raw, to], i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 行は位置で編集するドラフト。内容をkeyにすると入力のたびに再マウントされフォーカスを失う
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={raw}
                    onChange={(e) => {
                      const next = [...norm] as [string, string][];
                      next[i] = [e.target.value, to];
                      setNormDraft(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => {
                      const next = [...norm] as [string, string][];
                      next[i] = [raw, e.target.value];
                      setNormDraft(next);
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="mini danger-btn"
                    onClick={() => setNormDraft(norm.filter((_, j) => j !== i))}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setNormDraft([...norm, ['', '']])}>
            行を追加
          </button>
          <button
            type="button"
            className="primary"
            disabled={!normDraft || save.isPending}
            onClick={() => save.mutate({ normMap: Object.fromEntries(norm.filter(([a, b]) => a && b)) })}
          >
            正規化マップを保存
          </button>
        </div>
      </div>

      <div className="card">
        <h2>未記帳月(経費統計から除外する月)</h2>
        <div className="toolbar">
          <input
            type="text"
            style={{ width: 320 }}
            placeholder="YYYY-MM をカンマ区切り(例: 2026-07)"
            value={unrec}
            onChange={(e) => setUnrecDraft(e.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={unrecDraft === null || save.isPending}
            onClick={() =>
              save.mutate({
                unrecordedExpMonths: unrec
                  .split(',')
                  .map((v) => v.trim())
                  .filter((v) => /^\d{4}-\d{2}$/.test(v)),
              })
            }
          >
            保存
          </button>
        </div>
      </div>

      <div className="card">
        <h2>現金補正(銀行実測値の上書き表示)</h2>
        <p className="sub">
          登録済み:{' '}
          {Object.entries(s.cashOverrides)
            .map(([m, v]) => `${m}(入金${v.revenue.toLocaleString()}/支出${v.expense.toLocaleString()})`)
            .join(' / ') || 'なし'}
        </p>
        <div className="toolbar">
          <input
            type="text"
            placeholder="YYYY-MM"
            style={{ width: 100 }}
            value={cashDraft.month}
            onChange={(e) => setCashDraft({ ...cashDraft, month: e.target.value })}
          />
          <input
            className="num-input"
            type="number"
            placeholder="入金"
            value={cashDraft.revenue}
            onChange={(e) => setCashDraft({ ...cashDraft, revenue: e.target.value })}
          />
          <input
            className="num-input"
            type="number"
            placeholder="支出"
            value={cashDraft.expense}
            onChange={(e) => setCashDraft({ ...cashDraft, expense: e.target.value })}
          />
          <button
            type="button"
            className="primary"
            disabled={!/^\d{4}-\d{2}$/.test(cashDraft.month) || save.isPending}
            onClick={() =>
              save.mutate({
                cashOverrides: {
                  [cashDraft.month]: {
                    revenue: Number(cashDraft.revenue) || 0,
                    expense: Number(cashDraft.expense) || 0,
                  },
                },
              })
            }
          >
            登録
          </button>
          <button
            type="button"
            disabled={!/^\d{4}-\d{2}$/.test(cashDraft.month) || save.isPending}
            onClick={() => save.mutate({ cashOverrides: { [cashDraft.month]: null } })}
          >
            指定月を削除
          </button>
        </div>
      </div>

      <div className="card">
        <h2>エクスポート / 復元</h2>
        <div className="toolbar">
          <a className="btn" href="/api/export/json">
            統合データJSONをダウンロード
          </a>
          <a className="btn" href="/api/export/matrix.csv">
            マトリクスCSV(BOM付きUTF-8)
          </a>
          <button type="button" onClick={() => restoreInput.current?.click()} disabled={restore.isPending}>
            {restore.isPending ? '復元中…' : 'HTML版JSONから復元(初期移行)'}
          </button>
          <input
            ref={restoreInput}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && window.confirm('JSONの内容で全データを復元します。よろしいですか?')) restore.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
        {restore.isSuccess && <p className="sub">復元が完了しました。</p>}
        {restore.isError && (
          <div className="notice">復元に失敗しました: {(restore.error as Error).message}</div>
        )}
      </div>
    </>
  );
}
