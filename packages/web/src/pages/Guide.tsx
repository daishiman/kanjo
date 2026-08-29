/** P10 指標ガイド: 指標の意味とベンチマーク(FR-07)。実データを差し込んで解説する */
import { useQuery } from '@tanstack/react-query';
import { type DiagnosisData, type SummaryResponse, api } from '../api.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { PageHeader } from '../components/Page.js';
import { ratio } from '../format.js';
import { ABBREVIATIONS } from '../glossary.js';
import { buildGuideSections } from '../guide-sections.js';

export function GuidePage() {
  const sq = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  const dq = useQuery({ queryKey: ['diagnosis'], queryFn: () => api<DiagnosisData>('/diagnosis') });
  const ov = sq.data?.overview;
  const bench = sq.data?.benchmarks ?? [];
  const overviewUnavailable = sq.isError
    ? '取得できませんでした'
    : sq.isLoading
      ? '読み込み中'
      : !ov
        ? '—'
        : null;
  const importedPeriod =
    overviewUnavailable ??
    (ov?.months.length
      ? `${ov.months[0]} 〜 ${ov.months[ov.months.length - 1]}(${ov.months.length}ヶ月)`
      : '未取込');
  const revenueMonths = overviewUnavailable ?? (ov ? `${ov.kpi.revenueMonths}ヶ月` : '—');
  const unrecordedMonths =
    overviewUnavailable ??
    (ov ? (ov.unrecordedExpMonths.length ? ov.unrecordedExpMonths.join(', ') : 'なし') : '—');
  const judgePill: Record<string, string> = {
    目安内: 'pill calm',
    目安外: 'pill warn',
    データ不足: 'pill neutral',
  };

  const sections = buildGuideSections(sq.data, dq.data);

  return (
    <>
      <PageHeader route="guide" />

      {(sq.isLoading || dq.isLoading) && (
        <output className="notice">現在値を読み込み中です。用語の意味と目安は先に参照できます。</output>
      )}
      {(sq.isError || dq.isError) && (
        <p className="notice warn" role="alert">
          現在値を取得できませんでした。用語の意味と目安はそのまま参照できます。
        </p>
      )}

      <div className="card scroll-x">
        <h2>ベンチマーク(いまの数字と目安)</h2>
        {sq.isLoading ? (
          <p className="sub">ベンチマークを読み込み中です。</p>
        ) : sq.isError ? (
          <p className="sub">ベンチマークの現在値は取得できませんでした。</p>
        ) : (
          <DataTable
            columns={[
              '指標',
              '現在値',
              '目安',
              termColumn('judge', { label: '判定' }),
              { label: '算出元', className: 'left' },
            ]}
          >
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
          </DataTable>
        )}
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
        <DataTable
          className="data stack-sm"
          columns={[
            '略語',
            { label: '元の言葉', className: 'left' },
            { label: '日本語', className: 'left' },
            { label: '意味', className: 'left' },
          ]}
        >
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
        </DataTable>
      </div>

      {/*
        用語は60語近くある。1枚の表に並べると目的の語まで辿り着けないので、
        「何を知りたいときに読む節か」を1行付けて分けて出す(節の定義は glossary.ts が正本)。
      */}
      {sections.map((sec) => (
        <div key={sec.title} className="card scroll-x">
          <h2>{sec.title}</h2>
          <p className="sub">{sec.lead}</p>
          <DataTable
            columns={[
              '用語',
              { label: '意味', className: 'left' },
              '現在値',
              { label: '目安・判定の基準', className: 'left' },
            ]}
          >
            {sec.rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.term}</td>
                <td style={{ textAlign: 'left' }}>{r.desc}</td>
                <td className="num">{r.now}</td>
                <td style={{ textAlign: 'left' }} className="sub">
                  {r.bench}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ))}

      <div className="card">
        <h2>データ充足度チェック</h2>
        <table className="data" style={{ maxWidth: 620 }}>
          <tbody>
            <tr>
              <td>取込済み期間</td>
              <td className="num">{importedPeriod}</td>
            </tr>
            <tr>
              <td>売上のある月</td>
              <td className="num">{revenueMonths}</td>
            </tr>
            <tr>
              <td>未記帳月(統計から除外)</td>
              <td className="num">{unrecordedMonths}</td>
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
