/**
 * 3. レポートの右「詳細」 (spec-ai-analysis-screen FR-9〜FR-13)。
 *
 * 本文は 5 タブ (要約 / 根拠データ / 背景仮説 / 改善提案 / 関連リンク) に分ける。振り分けは core `aiReportTabs` が決め、
 * ここは描くだけにする。版履歴・版の比較・関連ページへのリンクはタブに関わらず常に出す
 * (どのタブを読んでいても「これは何版目か」「どこで直せるか」を見失わないため)。
 */
import {
  AI_ANALYSIS_DEPTH_LABEL,
  AI_REPORT_TABS,
  AI_REPORT_TAB_LABEL,
  type AiReportTab,
  aiDateTimeLabel,
  aiPeriodRangeLabel,
  aiReportTabs,
} from '@kanjo/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type KeyboardEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AI_FINDING_LABEL,
  AI_REPORT_TYPE_LABEL,
  AI_SECTION_LABEL,
  type AiPeriod,
  type AiReportDetailResponse,
  ApiError,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable } from '../../components/DataTable.js';
import { describeError } from '../../components/Page.js';
import { ReportChartView } from '../../components/ReportChart.js';
import { Term, linkTerms } from '../../components/Term.js';
import { type AppRouteId, routeMetadata } from '../../routeMetadata.js';
import { AiContextAnalysis } from './AiContextAnalysis.js';
import { AiReportHistory } from './AiReportHistory.js';
import { FINDING_KEYS, FindingList, ItemTable, ReportText, linkFigures } from './report-body.js';

/** 再分析の起点。依頼カードへ渡し、parentReportId として新しい依頼に付ける */
export interface Reanalyze {
  reportId: string;
  title: string;
  version: number;
  period: AiPeriod;
  mode: 'revise' | 'supplement';
}

export function reanalyzeHref(value: Reanalyze): string {
  const query = new URLSearchParams({
    reanalyze: value.reportId,
    mode: value.mode,
  });
  return `/ai?${query.toString()}`;
}

/** 関連ページ (spec の「関連ページへのリンク」)。総収支は分析のタブなので経路を直接持つ */
const RELATED_LINKS: { label: string; path: string; note: string }[] = [
  { label: '仕分けを開く', path: routeMetadata('classify').path, note: '事業・個人の振り分けや科目を直す' },
  { label: '予算を開く', path: routeMetadata('budget').path, note: '提案をもとに月の予算を決める' },
  { label: '総収支を開く', path: '/analysis/total-cashflow', note: '事業と家計を合わせた収支を確かめる' },
];

export function AiReportDetail({
  id,
  tab,
  onTab,
  onOpen,
  onChanged,
  onReanalyze,
}: {
  id: string | null;
  tab: AiReportTab;
  onTab: (tab: AiReportTab) => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onReanalyze: (r: Reanalyze) => void;
}) {
  const q = useQuery({
    queryKey: ['ai-report', id],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${id}`),
    enabled: !!id,
    // 404 は取り直しても変わらない
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 2,
  });

  return (
    <section className="ai-panel ai-report-detail" id="ai-report-detail" aria-label="レポートの詳細">
      {!id ? (
        <p className="empty">レポートを選ぶと内容が出ます</p>
      ) : q.isLoading ? (
        <p className="sub">レポートを読み込み中…</p>
      ) : q.isError || !q.data ? (
        q.error instanceof ApiError && q.error.status === 404 ? (
          <p className="empty">レポートが見つかりません</p>
        ) : (
          <div role="alert">
            <p className="sub">{describeError(q.error)}</p>
            <Button size="mini" onClick={() => void q.refetch()}>
              再読込
            </Button>
          </div>
        )
      ) : (
        <ReportBody
          data={q.data}
          tab={tab}
          onTab={onTab}
          onOpen={onOpen}
          onChanged={onChanged}
          onReanalyze={onReanalyze}
        />
      )}
    </section>
  );
}

function ReportBody({
  data,
  tab,
  onTab,
  onOpen,
  onChanged,
  onReanalyze,
}: {
  data: AiReportDetailResponse;
  tab: AiReportTab;
  onTab: (tab: AiReportTab) => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onReanalyze: (r: Reanalyze) => void;
}) {
  const { report, versions } = data;
  const b = report.body;
  const view = aiReportTabs(b);
  const latestVersion = Math.max(report.version, ...versions.map((v) => v.version));
  const [message, setMessage] = useState<string | null>(null);

  const archive = useMutation({
    mutationFn: (archived: boolean) =>
      api<{ ok: true }>(`/ai/reports/${report.id}/archive`, {
        method: 'PUT',
        body: JSON.stringify({ archived }),
      }),
    onSuccess: (_r, archived) => {
      setMessage(
        archived ? 'アーカイブしました。「アーカイブを表示」から戻せます。' : 'アーカイブから戻しました。',
      );
      onChanged();
    },
    onError: (e) => setMessage(describeError(e)),
  });

  const reanalyzeArg = (mode: Reanalyze['mode']): Reanalyze => ({
    reportId: report.id,
    title: report.title,
    version: report.version,
    period: report.period,
    mode,
  });

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = AI_REPORT_TABS.indexOf(tab);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = AI_REPORT_TABS[(i + step + AI_REPORT_TABS.length) % AI_REPORT_TABS.length];
    onTab(next);
    document.getElementById(`ai-tab-${next}`)?.focus();
  };

  return (
    <article className="ai-report">
      <header className="ai-report-head">
        <h3>
          {report.title} v{report.version}
          {report.version === latestVersion && <span className="pill calm">最新版</span>}
          {report.archivedAt && <span className="pill neutral">アーカイブ中</span>}
        </h3>
        <span className="ai-row-actions">
          <Button size="mini" disabled={archive.isPending} onClick={() => archive.mutate(!report.archivedAt)}>
            {report.archivedAt ? 'アーカイブから戻す' : 'アーカイブ'}
          </Button>
        </span>
      </header>
      <dl className="ai-report-meta">
        <div>
          <dt>作成日時</dt>
          <dd className="num">{aiDateTimeLabel(report.createdAt)}</dd>
        </div>
        <div>
          <dt>対象期間</dt>
          <dd>{aiPeriodRangeLabel(report.period.from, report.period.to)}</dd>
        </div>
        <div>
          <dt>
            <Term id="reportType" />
          </dt>
          <dd>{AI_REPORT_TYPE_LABEL[report.type]}レポート</dd>
        </div>
        <div>
          <dt>作成元</dt>
          <dd>
            {b.generatedBy}
            {b.model ? `(${b.model})` : ''}
          </dd>
        </div>
        <div>
          <dt>ステータス</dt>
          <dd>{report.archivedAt ? 'アーカイブ中' : '保存済み'}</dd>
        </div>
        <div>
          <dt>レポート量</dt>
          <dd>{AI_ANALYSIS_DEPTH_LABEL[b.analysisDepth]}</dd>
        </div>
      </dl>
      {message && <output className="notice info">{message}</output>}

      <div className="ai-tabs" role="tablist" aria-label="レポートの内容">
        {AI_REPORT_TABS.map((t) => (
          <button
            key={t}
            data-native-control="tab"
            type="button"
            role="tab"
            id={`ai-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`ai-tabpanel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className={tab === t ? 'on' : ''}
            onKeyDown={onTabKey}
            onClick={() => onTab(t)}
          >
            {AI_REPORT_TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div
        className="ai-tabpanel"
        role="tabpanel"
        id={`ai-tabpanel-${tab}`}
        aria-labelledby={`ai-tab-${tab}`}
      >
        {tab === 'summary' && (
          <>
            <p className="notice info">
              読み方: 統計的事実 → 解釈 →
              背景の仮説の順で分けています。仮説の反証・限界は「背景仮説」で確認できます。
            </p>
            <section className="report-section">
              <h4>総評</h4>
              <ReportText text={view.summary.summary} />
            </section>
            <section className="report-section">
              <h4>主な発見</h4>
              {view.summary.highlights.length === 0 ? (
                <p className="sub">なし</p>
              ) : (
                <ul className="ai-highlights">
                  {view.summary.highlights.map((h, i) => (
                    <li key={`${i}-${h.label}`}>
                      <span className="finding-label">{h.label}</span>
                      <span className="finding-note">{h.fact}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="report-section">
              <h4>次に取るべきアクション</h4>
              {view.summary.actions.length === 0 ? (
                <p className="sub">なし</p>
              ) : (
                <ol className="ai-actions">
                  {view.summary.actions.map((a, i) => (
                    <li key={`${i}-${a}`}>{a}</li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
        {tab === 'evidence' && (
          <>
            <section className="report-section">
              <h4>図表</h4>
              <p className="sub lede">
                図の数値はすべてアプリが計算し、AIは読み解きの文だけを書きます。出せない図も枠を残し、
                あと何ヶ月分のデータで出せるかを示します。用語: <Term id="contribution" /> /{' '}
                <Term id="sigmaBand" /> / <Term id="movingAvg" /> / <Term id="pareto" />
              </p>
              {view.evidence.charts.length === 0 ? (
                <p className="sub">
                  この版は図表が固定される前(第2版以前の形式)に届いたため図はありません。「改訂版を作る」で作り直すと図が付きます。
                </p>
              ) : (
                <div className="report-charts">
                  {view.evidence.charts.map((ch) => (
                    <ReportChartView key={ch.id} chart={ch} caption={linkFigures(ch.caption)} />
                  ))}
                </div>
              )}
            </section>
            {view.evidence.sections.map((sec) => (
              <section key={sec.id} className="report-section">
                <h4>{sec.title || AI_SECTION_LABEL[sec.id]}</h4>
                <ReportText text={sec.body} />
                {sec.gap && <p className="notice">この節は行数が足りていません: {linkTerms(sec.gap)}</p>}
                <ItemTable items={sec.items} />
              </section>
            ))}
            <section className="report-section">
              <h4>データ不足(判断に使えなかったもの)</h4>
              {view.evidence.dataGaps.length === 0 ? (
                <p className="sub">なし</p>
              ) : (
                <ul className="lede">
                  {view.evidence.dataGaps.map((g) => (
                    <li key={g}>{linkTerms(g)}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        {tab === 'context' && <AiContextAnalysis body={b} />}
        {tab === 'improvements' && (
          <>
            <section className="report-section">
              <h4>要点サマリー</h4>
              <p className="sub lede">
                各項目は「事実(数値と計算根拠)→ 解釈 → 次のアクション(期待効果)」の順に固定しています。
              </p>
              <div className="findings">
                {FINDING_KEYS.map((k) => (
                  <FindingList
                    key={k}
                    title={AI_FINDING_LABEL[k]}
                    items={view.improvements.keyFindings[k]}
                    note={b.keyFindings.notes[k]}
                    depth={b.analysisDepth}
                  />
                ))}
              </div>
            </section>
            {view.improvements.followUp && (
              <section className="report-section">
                <h4>前回の指摘はどうなったか</h4>
                <ReportText text={view.improvements.followUp.body} />
                <ItemTable items={view.improvements.followUp.items} />
              </section>
            )}
            <p className="toolbar">
              <Button size="mini" onClick={() => onReanalyze(reanalyzeArg('revise'))}>
                改訂版を作る(第{latestVersion + 1}版)
              </Button>
              <Button size="mini" onClick={() => onReanalyze(reanalyzeArg('supplement'))}>
                この点を補って再分析
              </Button>
            </p>
          </>
        )}
        {tab === 'links' && (
          <section className="report-section">
            <h4>精度を上げるために必要な情報</h4>
            {view.links.needs.length === 0 ? (
              <p className="sub">なし(今のデータで判断できています)</p>
            ) : (
              <div className="scroll-x">
                <DataTable columns={['足りないもの', 'アプリでの操作', '画面']}>
                  {view.links.needs.map((n, i) => (
                    <tr key={`${i}-${n.gap}`}>
                      <td className="wrap">{n.gap}</td>
                      <td className="wrap">{n.action}</td>
                      <td>
                        {n.screen ? (
                          <Link to={routeMetadata(n.screen as AppRouteId).path}>
                            {routeMetadata(n.screen as AppRouteId).label}へ
                          </Link>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </div>
            )}
            <p className="sub">
              情報を補ったら、同じ期間で再分析できます(第{latestVersion + 1}版として保存されます)。{' '}
              <Button size="mini" onClick={() => onReanalyze(reanalyzeArg('supplement'))}>
                この点を補って再分析する
              </Button>
            </p>
          </section>
        )}
      </div>

      <section className="report-section" aria-labelledby="ai-related-title">
        <h4 id="ai-related-title">関連ページへのリンク</h4>
        <ul className="ai-related">
          {RELATED_LINKS.map((l) => (
            <li key={l.path}>
              <Link to={l.path}>{l.label}</Link> <span className="sub">{l.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <AiReportHistory data={data} onOpen={onOpen} />
    </article>
  );
}
