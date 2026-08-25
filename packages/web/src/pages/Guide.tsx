/** P10 指標ガイド: 指標の意味とベンチマーク(FR-07)。実データを差し込んで解説する */
import { useQuery } from '@tanstack/react-query';
import { type DiagnosisData, type SummaryResponse, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';
import { pct, ratio, yen } from '../format.js';

export function GuidePage() {
  const sq = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  const dq = useQuery({ queryKey: ['diagnosis'], queryFn: () => api<DiagnosisData>('/diagnosis') });
  if (sq.isLoading || dq.isLoading)
    return (
      <>
        <PageHeader route="guide" />
        <PageState status="loading" />
      </>
    );
  if (sq.isError || dq.isError)
    return (
      <>
        <PageHeader route="guide" />
        <PageState status="error" error={sq.error} />
      </>
    );
  const ov = sq.data?.overview;
  const d = dq.data;
  const def = sq.data?.defense;
  const bench = sq.data?.benchmarks ?? [];
  const judgePill: Record<string, string> = {
    目安内: 'pill calm',
    目安外: 'pill warn',
    データ不足: 'pill neutral',
  };

  const rows: { term: string; desc: string; now: string; bench: string }[] = [
    {
      term: '防衛ライン(最低稼得基準額)',
      desc: '個人生活費の直近3ヶ月平均+事業固定費。毎月最低これだけ出ていく=これ以上稼ぐ必要がある金額。',
      now: def && def.status !== 'nodata' ? yen(def.line) : '—',
      bench: '収入見込みが110%以上で「余裕」、100%未満は「要注意」',
    },
    {
      term: 'CV(変動係数)',
      desc: '標準偏差÷平均。月ごとのブレの大きさ。小さいほど毎月同じ額=固定費。',
      now: d ? d.kpi.expenseCv.toFixed(2) : '—',
      bench: '0.6未満=固定費 / 0.6〜1.5=準変動 / 1.5超=スポット',
    },
    {
      term: 'zスコア',
      desc: '(直近値−平均)÷標準偏差。直近月が普段からどれだけ離れているか。',
      now: '科目別に診断ページで表示',
      bench: 'z≥2で「要確認」、1≤z<2「やや高い」、z≤−1「低め」',
    },
    {
      term: '損益分岐点(BEP)',
      desc: '固定費に分類された科目の直近3ヶ月平均合計。これを下回る月商だと赤字。',
      now: d ? yen(d.bep.breakEven) : '—',
      bench: d ? `安全余裕率 ${pct(d.bep.safetyMargin, 0)}(30%以上が望ましい)` : '—',
    },
    {
      term: 'パレート(累積構成比)',
      desc: '経費を大きい順に並べたときの累積比率。上位少数の科目が大半を占める。',
      now: ov ? `上位2科目で${(ov.top2Share * 100).toFixed(0)}%` : '—',
      bench: '82%以内の科目が管理の主戦場',
    },
    {
      term: '年換算',
      desc: '今年の実績合計÷記帳月数×12。年の途中でも通年ペースで比較するための値。',
      now: ov ? yen(ov.kpi.currYearAnnualized) : '—',
      bench: `前年実績${ov ? yen(ov.kpi.prevYearExpense) : '—'}との比較で増減を判断`,
    },
    {
      term: 'サブスク重複疑い',
      desc: '月額がそのベンダーの中央値の1.8倍超かつ2万円超(中央値5千円超)。二重契約の可能性。',
      now: 'サブスク分析ページで表示',
      bench: '急増は3倍超かつ1.5万円超',
    },
    {
      term: '説明可能率',
      desc: '個人支出のうち「未分類」「現金・カード」以外の割合。家計の見える化の度合い。',
      now: '家計ページで表示',
      bench: '80%以上を維持したい',
    },
  ];

  return (
    <>
      <PageHeader route="guide" />

      <div className="card scroll-x">
        <h2>ベンチマーク(いまの数字と目安)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>指標</th>
              <th>現在値</th>
              <th>目安</th>
              <th>判定</th>
              <th style={{ textAlign: 'left' }}>算出元</th>
            </tr>
          </thead>
          <tbody>
            {bench.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 700 }}>{b.label}</td>
                <td className="num">{ratio(b.value, 1)}</td>
                <td className="num">{b.guide}</td>
                <td>
                  <span className={judgePill[b.judge]}>{b.judge}</span>
                </td>
                <td style={{ textAlign: 'left' }} className="sub">
                  {b.basis}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sub">
          目安は参考実装(収支管理ダッシュボード)と同じ。個人事業の一般的な水準で、業種により前後します。
        </p>
      </div>

      <div className="card scroll-x">
        <h2>指標の意味</h2>
        <table className="data">
          <thead>
            <tr>
              <th>指標</th>
              <th style={{ textAlign: 'left' }}>意味</th>
              <th>現在値</th>
              <th style={{ textAlign: 'left' }}>目安</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.term}>
                <td style={{ fontWeight: 700 }}>{r.term}</td>
                <td style={{ textAlign: 'left' }}>{r.desc}</td>
                <td className="num">{r.now}</td>
                <td style={{ textAlign: 'left' }} className="sub">
                  {r.bench}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>データ充足度チェック</h2>
        <table className="data" style={{ maxWidth: 620 }}>
          <tbody>
            <tr>
              <td>取込済み期間</td>
              <td className="num">
                {ov?.months.length
                  ? `${ov.months[0]} 〜 ${ov.months[ov.months.length - 1]}(${ov.months.length}ヶ月)`
                  : '未取込'}
              </td>
            </tr>
            <tr>
              <td>売上のある月</td>
              <td className="num">{ov ? `${ov.kpi.revenueMonths}ヶ月` : '—'}</td>
            </tr>
            <tr>
              <td>未記帳月(統計から除外)</td>
              <td className="num">{ov?.unrecordedExpMonths.join(', ') || 'なし'}</td>
            </tr>
          </tbody>
        </table>
        <p className="sub">統計指標(CV・z・レンジ)は6ヶ月以上のデータで信頼性が上がります。</p>
      </div>
    </>
  );
}
