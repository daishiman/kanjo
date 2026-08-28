/** P10 指標ガイド: 指標の意味とベンチマーク(FR-07)。実データを差し込んで解説する */
import { useQuery } from '@tanstack/react-query';
import { type DiagnosisData, type SummaryResponse, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';
import { pct, ratio, yen } from '../format.js';
import { ABBREVIATIONS, GLOSSARY, GUIDE_ORDER, type GlossaryEntry, type TermId } from '../glossary.js';

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

  // 用語の意味と目安は glossary.ts が正本。ここでは「現在値」と、実データで補える目安だけを足す。
  const now: Partial<Record<TermId, string>> = {
    defenseLine: def && def.status !== 'nodata' ? yen(def.line) : '—',
    breakEven: d ? yen(d.bep.breakEven) : '—',
    safetyMargin: d ? pct(d.bep.safetyMargin, 0) : '—',
    expenseRatio: d ? pct(d.kpi.expenseRatio, 0) : '—',
    annualized: ov ? yen(ov.kpi.currYearAnnualized) : '—',
    pareto: ov ? `上位2科目で${(ov.top2Share * 100).toFixed(0)}%` : '—',
    cv: d ? d.kpi.expenseCv.toFixed(2) : '—',
    fixedCost: d ? yen(d.kpi.fixedCost) : '—',
    median: d ? yen(d.kpi.expenseMedian) : '—',
    pl: '決算書ページで表示',
    cashFlow: '決算書ページで表示',
    // BS・ランウェイ・BCPは残高が要る。まだ出せないことを「—」で流さず、条件を書く
    bs: '残高のCSV取込後に作成(決算書ページ参照)',
    runway: 'BSの取込後に算出',
    bcp: '手元資金が固定費の何ヶ月分かで判断',
    zScore: '科目別に診断ページで表示',
    range: '科目別に診断ページで表示',
    subsDup: 'サブスク分析ページで表示',
    subsSpike: 'サブスク分析ページで表示',
    revenueShare: 'サブスク分析ページで表示',
    explainability: '家計ページで表示',
    savingsRate: '家計ページで表示',
    unrecordedMonth: ov?.unrecordedExpMonths.length ? ov.unrecordedExpMonths.join(', ') : 'なし',
  };
  const benchNow: Partial<Record<TermId, string>> = {
    annualized: `前年実績${ov ? yen(ov.kpi.prevYearExpense) : '—'}との比較で増減を判断`,
  };
  const rows = GUIDE_ORDER.map((id) => {
    const e = GLOSSARY[id] as GlossaryEntry;
    return {
      id,
      term: e.term,
      desc: e.desc ?? e.short,
      now: now[id] ?? '—',
      bench: benchNow[id] ?? e.bench ?? '—',
    };
  });

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

      {/*
        略語だけは意味より先に「何の略か」を出す。
        CV・BS のようなアルファベット2文字は、意味の説明を読んでも
        元の言葉が分からないままだと、資料や税理士との会話で結び付かない。
      */}
      <div className="card scroll-x">
        <h2>略語の読み方</h2>
        <p className="sub lines">
          この画面やレポートに出てくるアルファベットの略語です。
          <br />
          元の英語と、日本語での呼び方を並べています。
        </p>
        <table className="data stack-sm">
          <thead>
            <tr>
              <th scope="col">略語</th>
              <th scope="col" style={{ textAlign: 'left' }}>
                元の言葉
              </th>
              <th scope="col" style={{ textAlign: 'left' }}>
                日本語
              </th>
              <th scope="col" style={{ textAlign: 'left' }}>
                意味
              </th>
            </tr>
          </thead>
          <tbody>
            {ABBREVIATIONS.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.abbr.abbr}</th>
                <td style={{ textAlign: 'left' }} data-label="元の言葉">
                  {a.abbr.full}
                </td>
                <td style={{ textAlign: 'left' }} data-label="日本語">
                  {a.abbr.ja}
                </td>
                <td style={{ textAlign: 'left' }} className="sub" data-label="意味">
                  {a.meaning}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card scroll-x">
        <h2>用語の意味</h2>
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
              <tr key={r.id}>
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
        <p className="sub">
          統計指標(CV・z・レンジ)は6ヶ月以上のデータで信頼性が上がります。各画面の点線つきの用語にマウスを乗せる(スマホではタップ)と、同じ説明が出ます。
        </p>
      </div>
    </>
  );
}
