/** P9 設定: 分類の設定(ルール・名義・候補科目・手動編集)・科目正規化・未記帳月・現金補正・エクスポート/復元(FR-05) */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { type LegacyRestoreResponse, type SettingsResponse, api } from '../api.js';
import { AttachmentArchiveRecovery } from '../components/Attachments.js';
import { ClassificationSettings } from '../components/ClassificationSettings.js';
import { PageHeader, PageState } from '../components/Page.js';
import { readFileText } from '../file-text.js';

export const LEGACY_RESTORE_CONFIRMATION =
  '集計・分類・設定データを初期移行します。現金明細、証憑の原本と管理情報は対象外です。続けますか?';

export function LegacyRestoreNotice({ result }: { result: LegacyRestoreResponse }) {
  if (result.duplicate)
    return <p className="sub">同じ集計データは取り込み済みです。現金明細と証憑は変更していません。</p>;
  return (
    <p className="sub">
      集計データを取り込みました(対象月 {result.months.length}件 / MF明細 {result.mfTxCount}件 / 分類ルール{' '}
      {result.rules}件)。現金明細、証憑の原本と管理情報はこの操作の対象外です。
    </p>
  );
}

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
  const [statDraft, setStatDraft] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setNormDraft(null);
      setUnrecDraft(null);
      setStatDraft(null);
      void qc.invalidateQueries();
    },
  });

  const restore = useMutation({
    mutationFn: async (file: File) => {
      const text = await readFileText(file);
      return api<LegacyRestoreResponse>('/restore', { method: 'POST', body: text });
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
  const statRange = s.statMinMonthsRange;
  const stat = statDraft ?? String(s.statMinMonths);
  const statValue = Number(stat);
  const statValid = Number.isInteger(statValue) && statValue >= statRange.min && statValue <= statRange.max;

  return (
    <>
      <PageHeader route="settings" />

      <ClassificationSettings />

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
        <h2>AI分析の統計の基準月数</h2>
        <p className="sub">
          平均・標準偏差・移動平均・固定費/変動費の判定に、記帳済みの月が何ヶ月あれば「判断してよい」とするかの
          基準です。既定は{statRange.default}ヶ月({statRange.min}〜{statRange.max}
          ヶ月)。短くすると早く図が出ますが、少ない月数で決めるぶん外れやすくなります。
          年で決まる指標(前年同月比・季節性)は暦の周期が要るので、この設定では短くなりません。
        </p>
        <div className="toolbar">
          <label htmlFor="stat-min-months">記帳済みの月が</label>
          <input
            id="stat-min-months"
            className="num-input"
            type="number"
            min={statRange.min}
            max={statRange.max}
            step={1}
            value={stat}
            onChange={(e) => setStatDraft(e.target.value)}
          />
          <span>ヶ月以上で統計を使う</span>
          <button
            type="button"
            className="primary"
            disabled={statDraft === null || !statValid || save.isPending}
            onClick={() => save.mutate({ statMinMonths: statValue })}
          >
            保存
          </button>
          {statDraft !== null && !statValid && (
            <span className="sub">
              {statRange.min}〜{statRange.max} の整数で入力してください。
            </span>
          )}
        </div>
        <p className="sub">
          変更は次に作る指示文から反映されます(保存済みのレポートの図は当時の基準のまま残ります)。
        </p>
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
        <h2>データの書き出し / 初期移行</h2>
        <p className="sub">集計・分類・設定データの書き出しと、旧HTML版からの初期移行用です。</p>
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
            aria-label="初期移行用JSONを選ぶ"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && window.confirm(LEGACY_RESTORE_CONFIRMATION)) restore.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
        {restore.isSuccess && <LegacyRestoreNotice result={restore.data} />}
        {restore.isError && (
          <div className="notice">
            初期移行に失敗しました。データは反映されていません: {(restore.error as Error).message}
          </div>
        )}
        <AttachmentArchiveRecovery />
      </div>
    </>
  );
}
