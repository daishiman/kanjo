import type { DiagnosisData } from '../../../api.js';
import { DataTable, termColumn } from '../../../components/DataTable.js';
import { HowTo } from '../../../components/HowTo.js';
import { KpiCard } from '../../../components/Page.js';
import { Term } from '../../../components/Term.js';
import { pct, yen } from '../../../format.js';
import type { Update } from './types.js';

const judgePill: Record<string, string> = {
  要確認: 'pill alert',
  やや高い: 'pill warn',
  低め: 'pill calm',
  通常レンジ: 'pill neutral',
};

const kindLabel: Record<string, string> = {
  cut: '削減',
  watch: '監視',
  invest: '投資',
  fix: '固定費',
};

/**
 * 科目別プロファイルと自動診断 (FR-011)。
 *
 * 作り直す前の診断画面はこの 2 つが主役だったが、統計そのものを読みたい場面は多くない。
 * 既定は閉じ、開いたかどうかを URL (`stats=1`) に残して共有・再訪で同じ状態に戻す。
 * `details` を制御下に置くため onToggle で URL を書き換える (open は URL が正本)。
 */
export function DiagnosisLegacyStats({
  data,
  open,
  update,
}: {
  data: DiagnosisData;
  open: boolean;
  update: Update;
}) {
  return (
    <details
      className="card diagnosis-legacy"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        if (next !== open) update({ stats: next ? '1' : null });
      }}
    >
      <summary>統計の詳細 (科目別プロファイルと自動診断)</summary>

      <div className="kpis diagnosis-legacy-kpis">
        <KpiCard
          label={
            <>
              経費 平均 / <Term id="median" /> ({data.kpi.months}ヶ月)
            </>
          }
          value={yen(data.kpi.expenseMean)}
          note={
            <span className="num">
              中央値 {yen(data.kpi.expenseMedian)} / <Term id="cv" /> {data.kpi.expenseCv.toFixed(2)}
            </span>
          }
        />
        <KpiCard label={<Term id="fixedCost" />} value={yen(data.kpi.fixedCost)} />
        <KpiCard
          label={<Term id="breakEven" />}
          value={yen(data.bep.breakEven)}
          note={
            <span className="num">
              <Term id="safetyMargin" /> {pct(data.bep.safetyMargin, 0)}
            </span>
          }
        />
        <KpiCard
          label={`平均月商 (売上${data.bep.revenueMonths}ヶ月)`}
          value={yen(data.bep.avgRevenue)}
          note={
            <span className="num">
              <Term id="expenseRatio" /> {pct(data.kpi.expenseRatio, 0)}
            </span>
          }
        />
      </div>

      <div className="scroll-x">
        <h3>
          科目別プロファイル(
          <Term id="unrecordedMonth" />
          は除外)
        </h3>
        <HowTo id="diagnosisProfile" />
        <DataTable
          columns={[
            '科目',
            termColumn('classification'),
            '直近3ヶ月平均',
            '平均',
            termColumn('median'),
            termColumn('cv'),
            termColumn('range'),
            termColumn('zScore'),
            termColumn('judge'),
            termColumn('signal'),
          ]}
        >
          {data.entries.map((entry) => (
            <tr key={entry.account}>
              <td>{entry.account}</td>
              <td>
                <span className="pill neutral">{entry.profile.type}</span>
              </td>
              <td className="num">{yen(entry.profile.rAvg)}</td>
              <td className="num">{yen(entry.profile.mean)}</td>
              <td className="num">{yen(entry.profile.med)}</td>
              <td className="num">{entry.profile.cv.toFixed(2)}</td>
              <td className="num">
                {yen(entry.range.lo)}〜{yen(entry.range.hi)}
              </td>
              <td className="num">{entry.profile.z.toFixed(1)}</td>
              <td>
                <span className={judgePill[entry.judge]}>{entry.judge}</span>
              </td>
              <td>
                {entry.signals.map((signal) => (
                  <span
                    key={signal}
                    className={`pill ${signal === '契約見直し対象' ? 'warn' : signal === '上昇' ? 'alert' : 'calm'}`}
                  >
                    {signal}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <h3>自動診断</h3>
      {data.autoDiagnosis.map((item) => (
        <div key={item.title} className="diagnosis-auto-row">
          <span
            className={`pill ${item.kind === 'cut' ? 'alert' : item.kind === 'watch' ? 'warn' : 'neutral'}`}
          >
            {kindLabel[item.kind] ?? item.tag}
          </span>{' '}
          <strong>{item.title}</strong> <span className="num">{item.value}</span>
          <div className="sub">{item.body}</div>
        </div>
      ))}
    </details>
  );
}
