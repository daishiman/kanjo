/** 支出分析 > マトリックス: 科目×月で「いつもと違う月」を見つける（仕様 §0 の画面骨格） */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type MatrixData, api } from '../../../api.js';
import { HowTo } from '../../../components/HowTo.js';
import { PageState } from '../../../components/Page.js';
import { Term } from '../../../components/Term.js';
import { pct } from '../../../format.js';
import { usePeriod } from '../../../period.js';
import { MatrixTable } from './MatrixTable.js';
import { SkewTop3 } from './SkewTop3.js';
import type { MatrixMode } from './model.js';

const MODES: [MatrixMode, string][] = [
  ['val', '金額'],
  ['mom', '前月比'],
  ['yoy', '前年同月比'],
];

/**
 * 増=赤・減=緑の凡例。Trends.tsx の DIRECTION_CLS と同じ規約だが、一般的な
 * 「赤=悪・緑=良」とは向きが逆に見えるので、色を使う画面には凡例を置く。
 * 色だけに頼らせないため、符号(+ / -)と「増えた/減った」の語を必ず添える。
 */
function ColorLegend() {
  return (
    <p className="sub">
      <strong>色の凡例</strong>(支出が基準): <span className="num pos">{pct(0.123)}</span> のように
      <strong>先頭がプラスで赤</strong>なら増えた、<span className="num neg">{pct(-0.123)}</span> のように
      <strong>先頭がマイナスで緑</strong>なら減った。
      <span className="pill neutral">未記帳</span>
      の月は合計・平均・比率から除外、比較できる前の月がないところは 空欄。色がつくのは比率(前月比・
      <Term id="yoy" />
      )で、金額表示には濃淡だけを使います。
    </p>
  );
}

export function MatrixPage() {
  const [mode, setMode] = useState<MatrixMode>('val');
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['matrix', key],
    queryFn: () => api<MatrixData>(withPeriod('/matrix')),
  });
  if (q.isLoading) return <PageState status="loading" />;
  if (q.isError || !q.data) return <PageState status="error" error={q.error} />;
  const m = q.data;
  if (!m.months.length)
    return (
      <PageState
        status="empty"
        message="比較するデータが未取込です。"
        action={
          <Link className="btn primary" to="/import">
            データ取込へ
          </Link>
        }
      />
    );

  return (
    <>
      <ColorLegend />

      <div className="toolbar">
        <span className="segment">
          {MODES.map(([k, label]) => (
            <button
              key={k}
              data-native-control="toggle"
              type="button"
              className={mode === k ? 'on' : ''}
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <a className="btn" href="/api/export/matrix.csv">
          CSVダウンロード
        </a>
      </div>

      {/* 6 列あるので狭い画面では収まらない。ページ本体をはみ出させず、表の中で横へ送る */}
      <section className="card scroll-x matrix-summary">
        <HowTo id="matrixSkew" />
        <SkewTop3 data={m} />
      </section>

      <div className="table-heading">
        <div>
          <h2>科目別の月次明細</h2>
          <p className="sub">科目は左に固定。月別の数値だけ横にスクロールできます。</p>
        </div>
        <span className="table-unit">{mode === 'val' ? '単位: 万円' : '単位: %'}</span>
      </div>
      <MatrixTable data={m} mode={mode} />
      <p className="sub">
        <Term id="unrecordedMonth" />
        は合計・平均・比率から除外。濃淡は合計行・平均行・合計列・平均列を除いた本体セルの 最小〜最大を 7
        段に分けたものです。
      </p>
    </>
  );
}
