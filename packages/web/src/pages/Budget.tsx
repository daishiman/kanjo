/** P7 予算管理: 科目別予算の設定と予実確認(FR-04) */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type BudgetRow, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';
import { yen, yenS } from '../format.js';

const judgePill: Record<string, string> = { 超過: 'pill alert', 範囲内: 'pill neutral', 余裕: 'pill calm' };

export function BudgetPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api<{ budgets: Record<string, number>; table: BudgetRow[] }>('/budgets'),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: (budgets: Record<string, number | null>) =>
      api('/budgets', { method: 'PUT', body: JSON.stringify({ budgets }) }),
    onSuccess: () => {
      setDirty(false);
      setDraft({});
      void qc.invalidateQueries({ queryKey: ['budgets'] });
      void qc.invalidateQueries({ queryKey: ['tradeoff'] });
    },
  });
  const suggest = useMutation({
    mutationFn: () => api<{ suggested: Record<string, number> }>('/budgets/suggest', { method: 'POST' }),
    onSuccess: (r) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.suggested)) next[k] = String(v);
      setDraft(next);
      setDirty(true);
    },
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="budget" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="budget" />
        <PageState status="error" error={q.error} />
      </>
    );
  const rows = q.data.table;
  if (!rows.length)
    return (
      <>
        <PageHeader route="budget" />
        <PageState
          status="empty"
          message="freee仕訳が未取込です。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

  const valOf = (r: BudgetRow): string => draft[r.account] ?? (r.budget != null ? String(r.budget) : '');

  const submit = () => {
    const budgets: Record<string, number | null> = {};
    for (const r of rows) {
      const raw = valOf(r);
      budgets[r.account] = raw === '' ? null : Number(raw) || 0;
    }
    save.mutate(budgets);
  };

  return (
    <>
      <PageHeader route="budget" />

      <div className="toolbar">
        <button type="button" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
          推奨値をセット(固定費=直近3ヶ月平均×95% / その他=全期間平均)
        </button>
        <button
          type="button"
          onClick={() => {
            const next: Record<string, string> = {};
            for (const r of rows) next[r.account] = '';
            setDraft(next);
            setDirty(true);
          }}
        >
          全クリア
        </button>
        <button type="button" className="primary" onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending ? '保存中…' : '保存'}
        </button>
      </div>

      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>科目</th>
              <th>分類</th>
              <th>直近3ヶ月平均</th>
              <th>月次予算</th>
              <th>差異(実績−予算)</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account}>
                <td>{r.account}</td>
                <td>
                  <span className="pill neutral">{r.type}</span>
                </td>
                <td className="num">{yen(r.recentAvg)}</td>
                <td>
                  <input
                    className="num-input"
                    type="number"
                    min={0}
                    step={1000}
                    value={valOf(r)}
                    placeholder="未設定"
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [r.account]: e.target.value }));
                      setDirty(true);
                    }}
                  />
                </td>
                <td className={`num ${r.diff != null && r.diff > 0 ? 'pos' : r.diff != null ? 'neg' : ''}`}>
                  {r.diff != null ? yenS(r.diff) : '—'}
                </td>
                <td>
                  {r.judge ? (
                    <span className={judgePill[r.judge]}>{r.judge}</span>
                  ) : (
                    <span className="sub">未設定</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
