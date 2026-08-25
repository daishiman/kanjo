/**
 * P11 やりくり試算(FR-09): 新規支出の捻出元(どこを削るか)を決める。
 * 候補選択→合計捻出額と予定支出の差→捻出できる/不足を判定→メモ保存(言いっぱなし防止)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type TradeoffResponse, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';
import { yen } from '../format.js';

const kindLabel: Record<string, string> = {
  subs_dup: 'サブスク重複',
  subs_spike: 'サブスク急増',
  budget_over: '予算超過',
  above_range: 'レンジ超過',
  unexplained: '精査期待値',
};

export function TradeoffPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tradeoff'], queryFn: () => api<TradeoffResponse>('/tradeoff') });
  const [amount, setAmount] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [title, setTitle] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/tradeoff', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setChecked(new Set());
      setAmount('');
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['tradeoff'] });
    },
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="tradeoff" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="tradeoff" />
        <PageState status="error" error={q.error} />
      </>
    );
  const d = q.data;

  const amt = Number(amount) || 0;
  const selected = d.candidates.filter((c) => checked.has(c.id));
  const covered = selected.reduce((s, c) => s + c.amount, 0);
  const verdict = amt > 0 ? (covered >= amt ? 'covered' : 'insufficient') : null;

  return (
    <>
      <PageHeader route="tradeoff" />

      <div className="card">
        <h2>予定している支出</h2>
        <div className="toolbar">
          <input
            type="text"
            placeholder="内容(例: 新しいツール導入)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 240 }}
          />
          <input
            className="num-input"
            type="number"
            min={0}
            placeholder="金額(円)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="segment">
            <button type="button" className={recurring ? '' : 'on'} onClick={() => setRecurring(false)}>
              単発
            </button>
            <button type="button" className={recurring ? 'on' : ''} onClick={() => setRecurring(true)}>
              毎月発生
            </button>
          </span>
          {recurring && amt > 0 && (
            <span className="badge warn">
              年間換算 <span className="num">{yen(amt * 12)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h2>削減余地リスト(効果額の大きい順)</h2>
        {!d.candidates.length && <p className="empty">現在、検知された削減候補はありません。</p>}
        <table className="data">
          <tbody>
            {d.candidates.map((c) => (
              <tr key={c.id}>
                <td style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={checked.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setChecked(next);
                    }}
                  />
                </td>
                <td style={{ textAlign: 'left' }}>
                  <span
                    className={`pill ${c.kind.startsWith('subs') ? 'alert' : c.kind === 'budget_over' ? 'warn' : 'neutral'}`}
                  >
                    {kindLabel[c.kind]}
                  </span>{' '}
                  <strong>{c.label}</strong>
                  <div className="sub">{c.detail}</div>
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {yen(c.amount)}/月
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {amt > 0 && (
        <div className={`notice ${verdict === 'covered' ? 'info' : ''}`}>
          捻出合計 <strong className="num">{yen(covered)}</strong> − 予定支出{' '}
          <strong className="num">{yen(amt)}</strong> ={' '}
          <strong className={`num ${covered - amt >= 0 ? 'neg' : 'pos'}`}>{yen(covered - amt)}</strong>{' '}
          {verdict === 'covered' ? '→ 捻出できます' : '→ 不足しています(候補を追加するか金額を見直し)'}
          <span style={{ marginLeft: 12 }}>
            <button
              type="button"
              className="primary"
              disabled={save.isPending || !selected.length}
              onClick={() =>
                save.mutate({
                  title: title || undefined,
                  amount: amt,
                  recurring,
                  selected: selected.map((c) => ({ label: c.label, value: c.amount })),
                  covered,
                  verdict,
                })
              }
            >
              この試算を保存
            </button>
          </span>
        </div>
      )}

      <div className="card">
        <h2>保存済みの試算(翌月の実績と突合)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>日時</th>
              <th>内容</th>
              <th>予定支出</th>
              <th>捻出額</th>
              <th>判定</th>
              <th style={{ textAlign: 'left' }}>選択した削減策</th>
            </tr>
          </thead>
          <tbody>
            {d.plans.map((p) => (
              <tr key={p.id}>
                <td>{p.createdAt ?? ''}</td>
                <td>
                  {p.title ?? '—'}
                  {p.recurring && <span className="pill warn">毎月</span>}
                </td>
                <td className="num">{yen(p.amount)}</td>
                <td className="num">{yen(p.covered)}</td>
                <td>
                  {p.verdict === 'covered' ? (
                    <span className="pill calm">捻出可</span>
                  ) : (
                    <span className="pill alert">不足</span>
                  )}
                </td>
                <td style={{ textAlign: 'left' }} className="sub">
                  {p.selected.map((sel) => sel.label).join(' / ')}
                </td>
              </tr>
            ))}
            {!d.plans.length && (
              <tr>
                <td colSpan={6} className="empty">
                  保存された試算はまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
