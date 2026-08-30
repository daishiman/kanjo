/** P2 増減マトリクス: 科目×月で「増えた/減った」を特定する */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type MatrixData, api } from '../../api.js';
import { DataTable, termColumn } from '../../components/DataTable.js';
import { MatrixMoversChart } from '../../components/FinancialCharts.js';
import { HowTo } from '../../components/HowTo.js';
import { PageState } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { deltaCls, monthShort, pct, yen } from '../../format.js';
import { usePeriod } from '../../period.js';

type Mode = 'val' | 'mom' | 'yoy';

/**
 * 増=赤・減=緑の凡例。Trends.tsx の DIRECTION_CLS と同じ規約だが、一般的な
 * 「赤=悪・緑=良」とは向きが逆に見えるので、色を使う画面には凡例を置く。
 * 色だけに頼らせないため、符号(+ / -)と「増えた/減った」の語を必ず添える。
 * 見本の色クラスは cell() と同じ deltaCls の出力(pos / neg)をそのまま使う。
 */
function ColorLegend() {
  return (
    <p className="sub">
      <strong>色の凡例</strong>(支出が基準): <span className="num pos">{pct(0.123)}</span> のように
      <strong>先頭がプラスで赤</strong>なら増えた、<span className="num neg">{pct(-0.123)}</span> のように
      <strong>先頭がマイナスで緑</strong>なら減った。
      <span className="pill neutral">未記帳</span>の月は年計・比率から除外、比較できる前の月がないところは
      「—」。色がつくのは比率(前月比・前年同月比・前年比)で、金額表示には色をつけません。
    </p>
  );
}

export function MatrixPage() {
  const [mode, setMode] = useState<Mode>('val');
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['matrix', key],
    queryFn: () => api<MatrixData>(withPeriod('/matrix')),
  });
  if (q.isLoading)
    return (
      <>
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageState status="error" error={q.error} />
      </>
    );
  const m = q.data;
  if (!m.months.length)
    return (
      <>
        <PageState
          status="empty"
          message="比較するデータが未取込です。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

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
      <ColorLegend />

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

      <section className="card matrix-summary">
        <HowTo id="matrixMovers" />
        <MatrixMoversChart data={m} />
      </section>

      <div className="table-heading">
        <div>
          <h2>科目別の月次明細</h2>
          <p className="sub">科目は左に固定。月別の数値だけ横にスクロールできます。</p>
        </div>
        <span className="table-unit">{mode === 'val' ? '単位: 円' : '単位: %'}</span>
      </div>
      <div className="card scroll-x matrix-table-card">
        <DataTable
          className="data matrix-table"
          caption={<caption className="visually-hidden">科目別の月次増減明細</caption>}
          columns={[
            '科目',
            ...m.months.map((mm) => ({
              label: `${mm.slice(2, 4)}/${monthShort(mm)}`,
              title: mm,
            })),
            ...m.years.map((y) => `${y}年計`),
            termColumn('yoy'),
          ]}
        >
          {m.rows.map((r) => (
            <tr key={r.label} className={r.isTotal ? 'total' : ''}>
              <th scope="row">{r.label}</th>
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
        </DataTable>
      </div>
      <p className="sub">
        <Term id="unrecordedMonth" />
        は年計・比率から除外。前年比は今年の
        <Term id="annualized" /> ÷ 前年実績。
      </p>
    </>
  );
}
