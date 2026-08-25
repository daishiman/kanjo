/**
 * P12 AI分析(spec §16): 期間を選んで指示文を作り、Claude Code / Codex が返した結果を読む。
 * 場面の1文: 月末に直近13ヶ月(既定)の分析をAIに頼み、要点サマリーから「すぐ効く対策」を決め、
 *            足りない情報を補って再分析する。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import {
  AI_REPORT_TYPE_LABEL,
  AI_SECTION_LABEL,
  type AiPeriod,
  type AiReportChart,
  type AiReportDetailResponse,
  type AiReportItem,
  type AiReportRow,
  type AiReportType,
  type AiTaskCreateBody,
  type AiTaskCreateResponse,
  type AiTaskView,
  ApiError,
  type SummaryResponse,
  api,
} from '../api.js';
import { PageHeader, PageState, describeError } from '../components/Page.js';
import { COLORS, VENDOR_PALETTE, yenTick } from '../components/charts.js';
import { dateTime, monthLabel, yen } from '../format.js';
import { type AppRouteId, routeMetadata } from '../routeMetadata.js';

/* -------- 年月の計算(API側 contract.ts と同じ規則) -------- */
const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthFromIndex = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const addMonths = (m: string, n: number): string => monthFromIndex(monthIndex(m) + n);
const rangeLength = (p: AiPeriod): number => monthIndex(p.to) - monthIndex(p.from) + 1;
const typeOf = (p: AiPeriod): AiReportType => {
  const n = rangeLength(p);
  return n <= 1 ? 'monthly' : n <= 13 ? 'annual' : 'longterm';
};
const monthsIn = (months: string[], p: AiPeriod): string[] => months.filter((m) => m >= p.from && m <= p.to);
const periodText = (p: AiPeriod): string =>
  p.from === p.to ? monthLabel(p.from) : `${monthLabel(p.from)}〜${monthLabel(p.to)}`;

type PresetId = 'month' | 'quarter' | 'year13' | 'year5' | 'custom';
const PRESETS: { id: Exclude<PresetId, 'custom'>; label: string; length: number; note: string }[] = [
  { id: 'month', label: '直近月', length: 1, note: '1ヶ月だけを深掘りする(月次)' },
  { id: 'quarter', label: '直近四半期', length: 3, note: '3ヶ月のまとまりで見る(年次)' },
  { id: 'year13', label: '直近13ヶ月', length: 13, note: '前年同月と比べられる(年次・既定)' },
  { id: 'year5', label: '過去5年', length: 60, note: '長期のトレンドを見る(長期)' },
];

const STATUS_PILL: Record<AiTaskView['status'], { cls: string; label: string }> = {
  waiting: { cls: 'pill warn', label: '結果待ち' },
  expired: { cls: 'pill neutral', label: '期限切れ' },
  done: { cls: 'pill calm', label: '受信済み' },
};

const PRIORITY: Record<string, { cls: string; label: string }> = {
  high: { cls: 'pill alert', label: '優先 高' },
  mid: { cls: 'pill warn', label: '優先 中' },
  low: { cls: 'pill neutral', label: '優先 低' },
};

/** 再分析の依頼(レポート詳細 → 指示文カードへ渡す) */
interface Reanalyze {
  reportId: string;
  title: string;
  version: number;
  period: AiPeriod;
}

export function AiPage() {
  const qc = useQueryClient();
  const sq = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  const tq = useQuery({ queryKey: ['ai-tasks'], queryFn: () => api<{ tasks: AiTaskView[] }>('/ai/tasks') });
  const rq = useQuery({
    queryKey: ['ai-reports'],
    queryFn: () => api<{ reports: AiReportRow[] }>('/ai/reports'),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [reanalyze, setReanalyze] = useState<Reanalyze | null>(null);
  const [typeFilter, setTypeFilter] = useState<AiReportType | ''>('');
  const [periodFilter, setPeriodFilter] = useState('');

  if (sq.isLoading || tq.isLoading || rq.isLoading)
    return (
      <>
        <PageHeader route="ai" />
        <PageState status="loading" />
      </>
    );
  if (sq.isError || tq.isError || rq.isError)
    return (
      <>
        <PageHeader route="ai" />
        <PageState status="error" error={sq.error ?? tq.error ?? rq.error} />
      </>
    );

  const months = sq.data?.overview.months ?? [];
  const tasks = tq.data?.tasks ?? [];
  const reports = rq.data?.reports ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ai-tasks'] });
    void qc.invalidateQueries({ queryKey: ['ai-reports'] });
  };
  const filtered = reports.filter(
    (r) =>
      (!typeFilter || r.type === typeFilter) &&
      (!periodFilter || (r.period.from <= periodFilter && r.period.to >= periodFilter)),
  );
  const startReanalyze = (r: Reanalyze) => {
    setReanalyze(r);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <PageHeader route="ai" />
      <PromptCard
        months={months}
        reanalyze={reanalyze}
        onCancelReanalyze={() => setReanalyze(null)}
        onCreated={() => {
          setReanalyze(null);
          refresh();
        }}
      />
      <RunCard tasks={tasks} onChanged={refresh} />
      <section className="card">
        <h2>3. 届いたレポート</h2>
        {reports.length === 0 ? (
          <p className="empty">
            まだレポートはありません。上の手順で指示文を作り、Claude Code / Codex
            で実行すると、ここに届きます。
          </p>
        ) : (
          <>
            <div className="toolbar">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AiReportType | '')}
                aria-label="レポートの型で絞り込む"
              >
                <option value="">すべての型</option>
                {(Object.keys(AI_REPORT_TYPE_LABEL) as AiReportType[]).map((t) => (
                  <option key={t} value={t}>
                    {AI_REPORT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                aria-label="対象期間に含む月で絞り込む"
              >
                <option value="">すべての期間</option>
                {[...months].reverse().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}を含む
                  </option>
                ))}
              </select>
              <span className="sub">
                {filtered.length}件{filtered.length !== reports.length ? ` / 全${reports.length}件` : ''}
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="empty">条件に合うレポートはありません。絞り込みを外してください。</p>
            ) : (
              <div className="scroll-x">
                <table className="data ai-table">
                  <thead>
                    <tr>
                      <th>届いた日時</th>
                      <th>型</th>
                      <th>対象期間</th>
                      <th>版</th>
                      <th>題名</th>
                      <th>作成元</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className={r.id === openId ? 'selected' : ''}>
                        <td>{dateTime(r.createdAt)}</td>
                        <td>{AI_REPORT_TYPE_LABEL[r.type]}</td>
                        <td>{periodText(r.period)}</td>
                        <td className="num">第{r.version}版</td>
                        <td className="wrap">{r.title}</td>
                        <td>{r.generatedBy}</td>
                        <td>
                          <button
                            type="button"
                            className="mini"
                            onClick={() => setOpenId(r.id === openId ? null : r.id)}
                          >
                            {r.id === openId ? '閉じる' : '読む'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
      {openId && <ReportDetail id={openId} onOpen={setOpenId} onReanalyze={startReanalyze} />}
    </>
  );
}

/* -------- 1. 指示文を作る -------- */

function PromptCard({
  months,
  reanalyze,
  onCancelReanalyze,
  onCreated,
}: {
  months: string[];
  reanalyze: Reanalyze | null;
  onCancelReanalyze: () => void;
  onCreated: () => void;
}) {
  const latest = months[months.length - 1] ?? '';
  const first = months[0] ?? '';
  // 取込済みデータから使えるプリセットを決める(範囲内に月が2つ以上なければ「直近月」と同じなので無効)
  const presets = useMemo(
    () =>
      PRESETS.map((p) => {
        const period: AiPeriod = { from: addMonths(latest, -(p.length - 1)), to: latest };
        const have = monthsIn(months, period).length;
        return { ...p, period, have, enabled: p.length === 1 ? have >= 1 : have >= 2 };
      }),
    [months, latest],
  );
  const defaultPreset = (): PresetId =>
    presets.find((p) => p.id === 'year13')?.enabled
      ? 'year13'
      : ([...presets].reverse().find((p) => p.enabled)?.id ?? 'month');
  const [choice, setChoice] = useState<PresetId>(defaultPreset);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(latest);
  const [supplement, setSupplement] = useState('');
  const [result, setResult] = useState<AiTaskCreateResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // 再分析: 元レポートの期間で固定し、補足情報の入力欄を開く
  useEffect(() => {
    if (!reanalyze) return;
    setChoice('custom');
    setFrom(reanalyze.period.from);
    setTo(reanalyze.period.to);
    setResult(null);
  }, [reanalyze]);

  const create = useMutation({
    mutationFn: (body: AiTaskCreateBody) =>
      api<AiTaskCreateResponse>('/ai/tasks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (r) => {
      setResult(r);
      setCopied(null);
      setSupplement('');
      onCreated();
    },
  });

  const period: AiPeriod | null =
    choice === 'custom'
      ? from && to && from <= to
        ? { from, to }
        : null
      : (presets.find((p) => p.id === choice)?.period ?? null);
  const inRange = period ? monthsIn(months, period) : [];
  const type = period ? typeOf(period) : null;

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied('コピーしました。Claude Code / Codex に貼り付けてください。');
    } catch {
      setCopied('コピーできませんでした。枠の中を全選択してコピーしてください。');
    }
  };

  if (months.length === 0) {
    return (
      <section className="card">
        <h2>1. 指示文を作る</h2>
        <p className="empty">
          取込済みのデータがありません。先に「データ取込」で freee / MF のファイルを取り込んでください。
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>1. 指示文を作る</h2>
      <p className="sub">
        分析したい期間を選ぶと、Claude Code / Codex に貼り付ける指示文ができます。取込済みのデータは{' '}
        {monthLabel(first)}〜{monthLabel(latest)}の{months.length}ヶ月分です。
      </p>
      {reanalyze && (
        <p className="notice info">
          「{reanalyze.title}」(第{reanalyze.version}
          版)を元に再分析します。下の「補足情報」に、前回のレポートで足りないとされた情報や、実行した対策を書いてください。{' '}
          <button type="button" className="mini" onClick={onCancelReanalyze}>
            再分析をやめる
          </button>
        </p>
      )}
      <div className="toolbar">
        <span className="segment">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={choice === p.id ? 'on' : ''}
              disabled={!p.enabled || !!reanalyze}
              title={p.enabled ? p.note : `取込済みの月が足りません(${p.have}ヶ月分)`}
              onClick={() => setChoice(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className={choice === 'custom' ? 'on' : ''}
            disabled={!!reanalyze}
            onClick={() => setChoice('custom')}
          >
            任意範囲
          </button>
        </span>
        <button
          type="button"
          className="primary"
          disabled={!period || inRange.length === 0 || create.isPending}
          onClick={() =>
            period &&
            create.mutate({
              ...period,
              supplement: supplement.trim() || undefined,
              parentReportId: reanalyze?.reportId,
            })
          }
        >
          {create.isPending ? '作成中…' : reanalyze ? '再分析の指示文を作る' : '指示文を作る'}
        </button>
      </div>
      {choice === 'custom' && (
        <div className="toolbar">
          <label className="sub">
            開始{' '}
            <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={!!reanalyze}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="sub">
            終了{' '}
            <select value={to} onChange={(e) => setTo(e.target.value)} disabled={!!reanalyze}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {from > to && <span className="notice">開始は終了より前の月にしてください。</span>}
        </div>
      )}
      {period && type && (
        <p className="sub">
          対象 {periodText(period)}({rangeLength(period)}ヶ月・{AI_REPORT_TYPE_LABEL[type]}レポート)。
          {inRange.length > 0
            ? ` 実データは${monthLabel(inRange[0])}〜${monthLabel(inRange[inRange.length - 1])}の${inRange.length}ヶ月分が対象です。`
            : ' この範囲に取込済みの月がありません。'}
          {presets.find((p) => p.id === choice)?.note
            ? ` ${presets.find((p) => p.id === choice)?.note}。`
            : ''}
        </p>
      )}
      <details className="prompt-box" open={!!reanalyze}>
        <summary className="sub">補足情報を添える(任意)</summary>
        <p className="sub">
          AIが知らない事情(例:
          家賃は事業用に按分済み、5月の広告費は単発のキャンペーン)を書くと、その前提で分析します。金額の明細を貼る必要はありません。
        </p>
        <textarea
          value={supplement}
          onChange={(e) => setSupplement(e.target.value.slice(0, 4000))}
          rows={4}
          aria-label="補足情報"
          placeholder="例: 2026年3月の外注費は一時的な案件。サブスクの Adobe は5月に解約済み。"
        />
      </details>
      {create.isError && <p className="notice">{describeError(create.error)}</p>}
      {result && (
        <div className="prompt-box">
          <div className="toolbar">
            <span className="badge">
              対象 {result.task.label} / 有効期限 {dateTime(result.task.expiresAt)} / 結果の受付は1回
            </span>
            <button type="button" className="primary" onClick={() => void copy()}>
              指示文をコピー
            </button>
            {copied && <span className="sub">{copied}</span>}
          </div>
          <textarea
            readOnly
            value={result.prompt}
            rows={12}
            aria-label="貼り付け用の指示文"
            onFocus={(e) => e.target.select()}
          />
          <p className="sub">
            この指示文には合鍵(トークン)が入っています。Claude Code / Codex 以外の場所に貼らないでください。
          </p>
        </div>
      )}
    </section>
  );
}

/* -------- 2. 実行する -------- */

function RunCard({ tasks, onChanged }: { tasks: AiTaskView[]; onChanged: () => void }) {
  const [pasteFor, setPasteFor] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [dataFor, setDataFor] = useState<string | null>(null);
  const [dataText, setDataText] = useState('');

  const paste = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api<{ reportId: string }>(`/ai/tasks/${id}/paste`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setPasteMsg('レポートを受け付けました。下の一覧に追加されています。');
      setPasteText('');
      setPasteFor(null);
      onChanged();
    },
    onError: (e) => setPasteMsg(e instanceof ApiError ? e.message : describeError(e)),
  });

  const submitPaste = (id: string) => {
    let body: unknown;
    try {
      body = JSON.parse(pasteText);
    } catch {
      setPasteMsg('JSONとして読めませんでした。AIが出力した { から } までをそのまま貼り付けてください。');
      return;
    }
    paste.mutate({ id, body });
  };

  const showData = async (id: string) => {
    setDataFor(id);
    setDataText('読み込み中…');
    try {
      const d = await api<unknown>(`/ai/tasks/${id}/dataset`);
      setDataText(JSON.stringify(d, null, 2));
    } catch (e) {
      setDataText(describeError(e));
    }
  };

  return (
    <section className="card">
      <h2>2. Claude Code / Codex で実行する</h2>
      <ol className="steps">
        <li>コピーした指示文を、このプロジェクトを開いた Claude Code または Codex に貼り付けて送る。</li>
        <li>AIがデータを読み、分析結果をこのアプリへ送る(1〜数分)。送れたら「受け付けID」が表示される。</li>
        <li>
          この画面を開き直す(または{' '}
          <button type="button" className="mini" onClick={onChanged}>
            更新
          </button>
          )と「3. 届いたレポート」に並ぶ。
        </li>
      </ol>
      {tasks.length > 0 && (
        <div className="scroll-x">
          <table className="data ai-table">
            <thead>
              <tr>
                <th>作成日時</th>
                <th>対象期間</th>
                <th>状態</th>
                <th>うまく送れなかったとき</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{dateTime(t.createdAt)}</td>
                  <td>
                    {t.label}
                    {t.parentReportId ? '(再分析)' : ''}
                  </td>
                  <td>
                    <span className={STATUS_PILL[t.status].cls}>{STATUS_PILL[t.status].label}</span>
                  </td>
                  <td>
                    {t.status === 'done' ? (
                      <span className="sub">—</span>
                    ) : (
                      <>
                        <button type="button" className="mini" onClick={() => void showData(t.id)}>
                          データを表示
                        </button>{' '}
                        <button
                          type="button"
                          className="mini"
                          onClick={() => {
                            setPasteFor(pasteFor === t.id ? null : t.id);
                            setPasteMsg(null);
                          }}
                        >
                          結果を貼り付ける
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dataFor && (
        <div className="prompt-box">
          <div className="toolbar">
            <span className="sub">
              AIに渡す集計データ(明細は含みません)。ネットで取れないときは、これをAIに貼り付けます。
            </span>
            <button type="button" className="mini" onClick={() => setDataFor(null)}>
              閉じる
            </button>
          </div>
          <textarea
            readOnly
            value={dataText}
            rows={10}
            aria-label="AIに渡すデータ"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
      {pasteFor && (
        <div className="prompt-box">
          <p className="sub">
            AIが送信できなかったとき、AIが出力した結果のJSONをここに貼り付けて保存します。
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            aria-label="結果JSON"
            placeholder='{"generatedBy": "codex", "summary": "...", "sections": [...] }'
          />
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              disabled={!pasteText.trim() || paste.isPending}
              onClick={() => submitPaste(pasteFor)}
            >
              保存する
            </button>
            {pasteMsg && <span className="sub">{pasteMsg}</span>}
          </div>
        </div>
      )}
      {!pasteFor && pasteMsg && <p className="notice info">{pasteMsg}</p>}
    </section>
  );
}

/* -------- 3. レポート本文 -------- */

function ReportDetail({
  id,
  onOpen,
  onReanalyze,
}: {
  id: string;
  onOpen: (id: string) => void;
  onReanalyze: (r: Reanalyze) => void;
}) {
  const q = useQuery({
    queryKey: ['ai-report', id],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${id}`),
  });
  if (q.isLoading) return <PageState status="loading" />;
  if (q.isError || !q.data) return <PageState status="error" error={q.error} />;
  const { report, previous, versions } = q.data;
  const b = report.body;
  const hasFindings =
    b.keyFindings.improvements.length + b.keyFindings.wasted.length + b.keyFindings.quickWins.length > 0;
  return (
    <article className="card report">
      <h2>{report.title}</h2>
      <p className="sub">
        {AI_REPORT_TYPE_LABEL[report.type]}レポート / {periodText(report.period)} / 第{report.version}版 /
        作成元 {b.generatedBy}
        {b.model ? `(${b.model})` : ''} / 届いた日時 {dateTime(report.createdAt)}
        {previous && (
          <>
            {' '}
            / 前回:{' '}
            <button type="button" className="mini" onClick={() => onOpen(previous.id)}>
              {previous.title}({dateTime(previous.createdAt)})を読む
            </button>
          </>
        )}
      </p>
      {versions.length > 1 && (
        <p className="sub">
          同じ期間の版:{' '}
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              className="mini"
              disabled={v.id === report.id}
              onClick={() => onOpen(v.id)}
            >
              第{v.version}版({dateTime(v.createdAt)})
            </button>
          ))}
        </p>
      )}

      <section className="report-section">
        <h3>総評</h3>
        <ReportText text={b.summary} />
      </section>

      {hasFindings && (
        <section className="report-section">
          <h3>要点サマリー</h3>
          <div className="findings">
            <FindingList title="改善すべき点" items={b.keyFindings.improvements} />
            <FindingList title="無駄なコスト" items={b.keyFindings.wasted} />
            <FindingList title="すぐ効く対策" items={b.keyFindings.quickWins} />
          </div>
        </section>
      )}

      {b.charts.length > 0 && (
        <section className="report-section">
          <h3>図表</h3>
          <div className="report-charts">
            {b.charts.map((ch) => (
              <ReportChartView key={ch.id} chart={ch} />
            ))}
          </div>
        </section>
      )}

      {b.followUp && (
        <section className="report-section">
          <h3>前回の指摘はどうなったか</h3>
          <ReportText text={b.followUp.body} />
          <ItemTable items={b.followUp.items} />
        </section>
      )}

      {b.sections.map((sec) => (
        <section key={sec.id} className="report-section">
          <h3>{sec.title || AI_SECTION_LABEL[sec.id]}</h3>
          <ReportText text={sec.body} />
          <ItemTable items={sec.items} />
        </section>
      ))}

      <section className="report-section">
        <h3>精度を上げるために必要な情報</h3>
        {b.needs.length === 0 ? (
          <p className="sub">なし(今のデータで判断できています)</p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>足りないもの</th>
                  <th>アプリでの操作</th>
                  <th>画面</th>
                </tr>
              </thead>
              <tbody>
                {b.needs.map((n, i) => (
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
              </tbody>
            </table>
          </div>
        )}
        <p className="sub">
          情報を補ったら、同じ期間で再分析できます(第{report.version + 1}版として保存されます)。{' '}
          <button
            type="button"
            className="mini"
            onClick={() =>
              onReanalyze({
                reportId: report.id,
                title: report.title,
                version: report.version,
                period: report.period,
              })
            }
          >
            この点を補って再分析する
          </button>
        </p>
      </section>

      <section className="report-section">
        <h3>データ不足(判断に使えなかったもの)</h3>
        {b.dataGaps.length === 0 ? (
          <p className="sub">なし</p>
        ) : (
          <ul>
            {b.dataGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function FindingList({ title, items }: { title: string; items: AiReportItem[] }) {
  return (
    <div className="finding">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="sub">なし</p>
      ) : (
        <ol>
          {items.map((it, i) => (
            <li key={`${i}-${it.label}`}>
              <span className="finding-label">{it.label}</span>
              {it.amount != null && <span className="num finding-amount">{yen(it.amount)}</span>}
              {it.priority && (
                <span className={PRIORITY[it.priority].cls}>{PRIORITY[it.priority].label}</span>
              )}
              {it.note && <span className="sub finding-note">{it.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ItemTable({ items }: { items: AiReportItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="scroll-x">
      <table className="data ai-table">
        <thead>
          <tr>
            <th>項目</th>
            <th className="num">金額(円)</th>
            <th>優先度</th>
            <th>補足</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={`${i}-${it.label}`}>
              <td className="wrap">{it.label}</td>
              <td className="num">{it.amount == null ? '—' : yen(it.amount)}</td>
              <td>
                {it.priority ? (
                  <span className={PRIORITY[it.priority].cls}>{PRIORITY[it.priority].label}</span>
                ) : (
                  ''
                )}
              </td>
              <td className="wrap">{it.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** AIが返した図表データを、概況と同じ Chart.js で描く(数値だけを受け取り、HTMLは受け取らない) */
function ReportChartView({ chart }: { chart: AiReportChart }) {
  const palette = [COLORS.biz, COLORS.per, COLORS.warn, COLORS.good, ...VENDOR_PALETTE.slice(4)];
  const tick =
    chart.unit === 'yen' ? yenTick : chart.unit === 'pct' ? (v: number | string) => `${v}%` : undefined;
  const stacked = chart.kind === 'stackedBar';
  return (
    <div className="report-chart">
      <h4>{chart.title}</h4>
      <Chart
        type={chart.kind === 'line' ? 'line' : 'bar'}
        height={110}
        data={{
          labels: chart.labels,
          datasets: chart.series.map((sr, i) => ({
            label: sr.label,
            data: sr.data,
            backgroundColor: `${palette[i % palette.length]}cc`,
            borderColor: palette[i % palette.length],
            borderWidth: chart.kind === 'line' ? 2 : 0,
            pointRadius: chart.kind === 'line' ? 2 : 0,
            tension: 0.2,
          })),
        }}
        options={{
          responsive: true,
          scales: {
            x: { stacked },
            y: { stacked, ticks: tick ? { callback: tick } : undefined },
          },
          plugins: { legend: { position: 'bottom', display: chart.series.length > 1 } },
        }}
      />
      {chart.note && <p className="sub">{chart.note}</p>}
    </div>
  );
}

/** プレーンテキストを段落と「- 」箇条書きに整えて表示する(HTMLとしては解釈しない) */
function ReportText({ text }: { text: string }) {
  const blocks: { kind: 'p' | 'ul'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      if (blocks.length && blocks[blocks.length - 1].lines.length) blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const li = /^[-・*]\s*(.+)$/.exec(line.trim());
    const last = blocks[blocks.length - 1];
    if (li) {
      if (last && last.kind === 'ul') last.lines.push(li[1]);
      else blocks.push({ kind: 'ul', lines: [li[1]] });
    } else if (last && last.kind === 'p') last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
  }
  return (
    <div className="report-text">
      {blocks
        .filter((bl) => bl.lines.length)
        .map((bl, i) =>
          bl.kind === 'ul' ? (
            <ul key={`ul-${i}-${bl.lines[0]}`}>
              {bl.lines.map((l, j) => (
                <li key={`${j}-${l}`}>{l}</li>
              ))}
            </ul>
          ) : (
            <p key={`p-${i}-${bl.lines[0]}`}>{bl.lines.join('\n')}</p>
          ),
        )}
    </div>
  );
}
