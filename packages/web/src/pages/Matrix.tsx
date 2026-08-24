/** P2 増減マトリクス: 科目×月で「増えた/減った」を特定する */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type MatrixData, api } from '../api.js';
import { deltaCls, monthShort, pct, yen } from '../format.js';

type Mode = 'val' | 'mom' | 'yoy';

export function MatrixPage() {
  const [mode, setMode] = useState<Mode>('val');
  const q = useQuery({ queryKey: ['matrix'], queryFn: () => api<MatrixData>('/matrix') });
  if (q.isLoading) return <p>読み込み中…</p>;
  if (q.isError || !q.data) return <p>読み込みに失敗しました</p>;
  const m = q.data;
  if (!m.months.length) return <p className="empty">データ未取込です。</p>;

  const un = new Set(m.unrecordedExpMonths);
  const mi = new Map(m.months.map((mm, i) => [mm, i]));

  const cell = (series: number[], i: number): { text: string; cls: string } => {
    const v = series[i];
    if (un.has(m.months[i])) return { text: '未記帳', cls: 'pill neutral' };
    if (mode === 'val') return { text: v ? yen(v) : '—', cls: '' };
    if (mode === 'mom') {
      const p = i > 0 ? series[i - 1] : 0;
      if (!p || un.has(m.months[i - 1])) return { text: '—', cls: '' };
      const r = v / p - 1;
      return { text: pct(r), cls: deltaCls(r) };
    }
    const prevM = `${Number(m.months[i].slice(0, 4)) - 1}${m.months[i].slice(4)}`;
    const pi = mi.get(prevM);
    if (pi === undefined || !series[pi] || un.has(prevM)) return { text: '—', cls: '' };
    const r = v / series[pi] - 1;
    return { text: pct(r), cls: deltaCls(r) };
  };

  return (
    <>
      <h1 className="page-title">増減マトリクス</h1>
      <p className="page-task">科目×月で「増えた/減った」を特定する(増=赤・減=緑)。</p>

      <div className="toolbar">
        <span className="segment">
          {(
            [
              ['val', '金額'],
              ['mom', '前月比'],
              ['yoy', '前年同月比'],
            ] as [Mode, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>
              {label}
            </button>
          ))}
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <a className="btn" href="/api/export/matrix.csv">
          CSVダウンロード
        </a>
      </div>

      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>科目</th>
              {m.months.map((mm) => (
                <th key={mm} title={mm}>
                  {mm.slice(2, 4)}/{monthShort(mm)}
                </th>
              ))}
              {m.years.map((y) => (
                <th key={y}>{y}年計</th>
              ))}
              <th>前年比(換算)</th>
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.label} className={r.isTotal ? 'total' : ''}>
                <td>{r.label}</td>
                {m.months.map((mm, i) => {
                  const c = cell(r.series, i);
                  return (
                    <td key={mm} className={`num ${c.cls}`}>
                      {c.text}
                    </td>
                  );
                })}
                {r.yearTotals.map((t) => (
                  <td key={t.year} className="num">
                    {yen(t.total)}
                  </td>
                ))}
                <td className={`num ${deltaCls(r.yoy)}`}>{pct(r.yoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub">未記帳月は年計・比率から除外。前年比は今年の年換算 ÷ 前年実績。</p>
    </>
  );
}
