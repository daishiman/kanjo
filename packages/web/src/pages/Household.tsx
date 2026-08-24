/** P6 家計: 個人分の月次比較を確認する(仕分け反映後) */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type HouseholdData, api } from '../api.js';
import { deltaCls, monthLabel, yen, yenS } from '../format.js';

export function HouseholdPage() {
  const q = useQuery({ queryKey: ['household'], queryFn: () => api<HouseholdData>('/household') });
  const [sel, setSel] = useState<string | null>(null);
  if (q.isLoading) return <p>読み込み中…</p>;
  if (q.isError || !q.data) return <p>読み込みに失敗しました</p>;
  const d = q.data;
  if (!d.months.length) return <p className="empty">MF明細が未取込です。</p>;

  const month = sel && d.months.includes(sel) ? sel : d.months[d.months.length - 1];
  const mi = d.months.indexOf(month);
  const prev = mi > 0 ? d.months[mi - 1] : null;
  const cur = d.personal[month];
  const pv = prev ? d.personal[prev] : null;
  const bp = d.bizPersonal[month];

  const expTotal = Object.values(cur.expense).reduce((s, v) => s + v, 0);
  const incTotal = Object.values(cur.income).reduce((s, v) => s + v, 0);
  const cats = Object.entries(cur.expense).sort((a, b) => b[1] - a[1]);
  const incCats = Object.entries(cur.income).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <h1 className="page-title">家計</h1>
      <p className="page-task">個人分の月次比較を確認する(公私仕分け反映後)。</p>

      <div className="toolbar">
        <select value={month} onChange={(e) => setSel(e.target.value)}>
          {d.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        {d.explainability && d.explainability.month === month && (
          <span className={`badge ${d.explainability.rate >= 0.8 ? 'ok' : 'warn'}`}>
            説明可能率 {(d.explainability.rate * 100).toFixed(0)}%(未分類+カード引落{' '}
            {yen(d.explainability.unexplained)})
          </span>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="label">個人収入</div>
          <div className="value">{yen(incTotal)}</div>
        </div>
        <div className="kpi">
          <div className="label">個人支出</div>
          <div className="value">{yen(expTotal)}</div>
        </div>
        <div className="kpi">
          <div className="label">収支</div>
          <div className="value">{yenS(incTotal - expTotal)}</div>
        </div>
        {bp && (
          <div className="kpi">
            <div className="label">事業入金 / 事業立替(参考)</div>
            <div className="value" style={{ color: 'var(--biz)', fontSize: 16 }}>
              {yen(bp.income)} / {yen(bp.expense)}
            </div>
          </div>
        )}
      </div>

      <div className="card scroll-x">
        <h2>支出内訳(大項目別{prev ? ` / 前月 ${monthLabel(prev)} 比` : ''})</h2>
        <table className="data">
          <thead>
            <tr>
              <th>大項目</th>
              <th>{monthLabel(month)}</th>
              {prev && <th>前月</th>}
              {prev && <th>増減</th>}
            </tr>
          </thead>
          <tbody>
            {cats.map(([k, v]) => {
              const p = pv?.expense[k] ?? 0;
              return (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="num">{yen(v)}</td>
                  {prev && <td className="num">{yen(p)}</td>}
                  {prev && <td className={`num ${deltaCls(v - p)}`}>{yenS(v - p)}</td>}
                </tr>
              );
            })}
            <tr className="total">
              <td>支出計</td>
              <td className="num">{yen(expTotal)}</td>
              {prev && pv && (
                <td className="num">{yen(Object.values(pv.expense).reduce((s, v) => s + v, 0))}</td>
              )}
              {prev && pv && (
                <td
                  className={`num ${deltaCls(expTotal - Object.values(pv.expense).reduce((s, v) => s + v, 0))}`}
                >
                  {yenS(expTotal - Object.values(pv.expense).reduce((s, v) => s + v, 0))}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card scroll-x">
        <h2>収入内訳(中項目別)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>中項目</th>
              <th>{monthLabel(month)}</th>
            </tr>
          </thead>
          <tbody>
            {incCats.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{yen(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
