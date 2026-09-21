import { aiDateTimeLabel } from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AI_FINDING_LABEL, type AiReportDetailResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable, termColumn } from '../../components/DataTable.js';
import { describeError } from '../../components/Page.js';
import { yen } from '../../format.js';
import { FINDING_KEYS, firstLine } from './report-body.js';

type Report = AiReportDetailResponse['report'];

/** 版履歴と2版比較。レポート本文の表示責務から独立して取得・選択状態を持つ。 */
export function AiReportHistory({
  data,
  onOpen,
}: { data: AiReportDetailResponse; onOpen: (id: string) => void }) {
  const { report, versions } = data;
  const index = versions.findIndex((v) => v.id === report.id);
  const defaultBase = index > 0 ? versions[index - 1].id : null;
  const [left, setLeft] = useState<string | null>(defaultBase);
  const [right, setRight] = useState(report.id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLeft(defaultBase);
    setRight(report.id);
    setOpen(false);
  }, [report.id, defaultBase]);

  const canCompare = versions.length > 1 && !!left && left !== right;
  return (
    <>
      <section className="report-section" aria-labelledby="ai-versions-title">
        <h4 id="ai-versions-title">レポートの版履歴</h4>
        <div className="scroll-x">
          <DataTable
            className="data ai-version-table"
            columns={[termColumn('reportVersion'), '作成日時', '版の説明']}
          >
            {[...versions].reverse().map((version) => (
              <tr key={version.id} className={version.id === report.id ? 'ai-row-selected' : undefined}>
                <td className="num">
                  {version.id === report.id ? (
                    <span>v{version.version}(表示中)</span>
                  ) : (
                    <Button variant="text" size="mini" onClick={() => onOpen(version.id)}>
                      v{version.version}
                    </Button>
                  )}
                </td>
                <td className="num">{aiDateTimeLabel(version.createdAt)}</td>
                <td className="wrap">{version.versionNote}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </section>

      <section className="report-section" aria-labelledby="ai-compare-title">
        <h4 id="ai-compare-title">2つの版を比較</h4>
        {versions.length < 2 ? (
          <p className="sub">比較できる版がありません(比較は v2 から)。</p>
        ) : (
          <div className="toolbar">
            <label className="sub">
              比較元{' '}
              <select value={left ?? ''} onChange={(event) => setLeft(event.target.value || null)}>
                <option value="">選ぶ</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="sub">
              比較先{' '}
              <select value={right} onChange={(event) => setRight(event.target.value)}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version}
                  </option>
                ))}
              </select>
            </label>
            <Button size="mini" disabled={!canCompare} onClick={() => setOpen(!open)}>
              {open ? '比較を閉じる' : '比較する'}
            </Button>
          </div>
        )}
        {open && canCompare && left && <CompareView leftId={left} rightId={right} />}
      </section>
    </>
  );
}

/** 数値の再計算はせず、保存済みの本文を並列表示する。 */
function CompareView({ leftId, rightId }: { leftId: string; rightId: string }) {
  const left = useQuery({
    queryKey: ['ai-report', leftId],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${leftId}`),
  });
  const right = useQuery({
    queryKey: ['ai-report', rightId],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${rightId}`),
  });
  if (left.isLoading || right.isLoading) return <p className="sub">比較する版を読み込み中…</p>;
  if (!left.data || !right.data)
    return (
      <p className="notice" role="alert">
        {describeError(left.error ?? right.error)}
      </p>
    );
  const columns: Report[] = [left.data.report, right.data.report];
  return (
    <div className="compare-grid">
      {columns.map((report) => (
        <div key={report.id} className="compare-col">
          <h5>
            v{report.version}({aiDateTimeLabel(report.createdAt)})
          </h5>
          <p className="sub">総評</p>
          <p className="wrap">{firstLine(report.body.summary, 160)}</p>
          {FINDING_KEYS.map((key) => (
            <div key={key}>
              <p className="sub">{AI_FINDING_LABEL[key]}</p>
              {report.body.keyFindings[key].length === 0 ? (
                <p className="sub">なし</p>
              ) : (
                <ul>
                  {report.body.keyFindings[key].map((finding, index) => (
                    <li key={`${index}-${finding.label}`}>
                      <span className="finding-label">{finding.label}</span>
                      {finding.amount != null && (
                        <span className="num finding-amount">{yen(finding.amount)}</span>
                      )}
                      <span className="sub finding-note">{finding.fact}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="sub">出せた図</p>
          <p className="wrap">
            {report.body.charts.filter((chart) => chart.available).length} / {report.body.charts.length}枚(
            {report.body.charts
              .filter((chart) => chart.available)
              .map((chart) => `図${chart.figure}`)
              .join('・') || 'なし'}
            )
          </p>
        </div>
      ))}
    </div>
  );
}
