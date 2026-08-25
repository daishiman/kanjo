/**
 * P12 AI分析(spec §16): 期間を選んで指示文を作り、Claude Code / Codex が返した結果を読む。
 * 場面の1文: 月末に今月(または年間)の分析をAIに頼み、返ってきた結果から削減候補を決める。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AI_SECTION_LABEL,
  type AiPeriodKind,
  type AiReportDetailResponse,
  type AiReportRow,
  type AiTaskCreateResponse,
  type AiTaskView,
  ApiError,
  type SummaryResponse,
  api,
} from '../api.js';
import { PageHeader, PageState, describeError } from '../components/Page.js';
import { dateTime, monthLabel, yen } from '../format.js';

type Choice = 'this' | 'month' | 'year';

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

export function AiPage() {
  const qc = useQueryClient();
  const sq = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  const tq = useQuery({ queryKey: ['ai-tasks'], queryFn: () => api<{ tasks: AiTaskView[] }>('/ai/tasks') });
  const rq = useQuery({
    queryKey: ['ai-reports'],
    queryFn: () => api<{ reports: AiReportRow[] }>('/ai/reports'),
  });
  const [openId, setOpenId] = useState<string | null>(null);

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

  return (
    <>
      <PageHeader route="ai" />
      <PromptCard months={months} onCreated={refresh} />
      <RunCard tasks={tasks} onChanged={refresh} />
      <section className="card">
        <h2>3. 届いたレポート</h2>
        {reports.length === 0 ? (
          <p className="empty">
            まだレポートはありません。上の手順で指示文を作り、Claude Code / Codex
            で実行すると、ここに届きます。
          </p>
        ) : (
          <div className="scroll-x">
            <table className="data ai-table">
              <thead>
                <tr>
                  <th>届いた日時</th>
                  <th>対象期間</th>
                  <th>題名</th>
                  <th>作成元</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className={r.id === openId ? 'selected' : ''}>
                    <td>{dateTime(r.createdAt)}</td>
                    <td>{r.label}</td>
                    <td>{r.title}</td>
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
      </section>
      {openId && <ReportDetail id={openId} onOpen={setOpenId} />}
    </>
  );
}

/* -------- 1. 指示文を作る -------- */

function PromptCard({ months, onCreated }: { months: string[]; onCreated: () => void }) {
  const latest = months[months.length - 1] ?? '';
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4))))
    .sort()
    .reverse();
  const [choice, setChoice] = useState<Choice>('this');
  const [month, setMonth] = useState(latest);
  const [year, setYear] = useState(years[0] ?? '');
  const [result, setResult] = useState<AiTaskCreateResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: { kind: AiPeriodKind; key: string }) =>
      api<AiTaskCreateResponse>('/ai/tasks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (r) => {
      setResult(r);
      setCopied(null);
      onCreated();
    },
  });

  const target: { kind: AiPeriodKind; key: string } | null =
    choice === 'year'
      ? year
        ? { kind: 'year', key: year }
        : null
      : { kind: 'month', key: choice === 'this' ? latest : month };

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
      <p className="sub">分析したい期間を選ぶと、Claude Code / Codex に貼り付ける指示文ができます。</p>
      <div className="toolbar">
        <span className="segment">
          <button type="button" className={choice === 'this' ? 'on' : ''} onClick={() => setChoice('this')}>
            {latest === new Date().toISOString().slice(0, 7) ? '今月' : '直近月'}({monthLabel(latest)})
          </button>
          <button type="button" className={choice === 'month' ? 'on' : ''} onClick={() => setChoice('month')}>
            指定月
          </button>
          <button type="button" className={choice === 'year' ? 'on' : ''} onClick={() => setChoice('year')}>
            年間
          </button>
        </span>
        {choice === 'month' && (
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="対象月">
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
        {choice === 'year' && (
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="対象年">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="primary"
          disabled={!target || create.isPending}
          onClick={() => target && create.mutate(target)}
        >
          {create.isPending ? '作成中…' : '指示文を作る'}
        </button>
      </div>
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
                  <td>{t.label}</td>
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

function ReportDetail({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const q = useQuery({
    queryKey: ['ai-report', id],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${id}`),
  });
  if (q.isLoading) return <PageState status="loading" />;
  if (q.isError || !q.data) return <PageState status="error" error={q.error} />;
  const { report, previous } = q.data;
  const b = report.body;
  return (
    <article className="card report">
      <h2>{report.title}</h2>
      <p className="sub">
        {report.label} / 作成元 {b.generatedBy}
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
      <section className="report-section">
        <h3>総評</h3>
        <ReportText text={b.summary} />
      </section>
      {b.sections.map((sec) => (
        <section key={sec.id} className="report-section">
          <h3>{sec.title || AI_SECTION_LABEL[sec.id]}</h3>
          <ReportText text={sec.body} />
          {sec.items.length > 0 && (
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
                  {sec.items.map((it, i) => (
                    <tr key={`${sec.id}-${i}-${it.label}`}>
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
          )}
        </section>
      ))}
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
