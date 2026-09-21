/**
 * AI分析画面のページ制御 (spec-ai-analysis-screen FR-1・FR-6〜FR-10・FR-14)。
 *
 * URL 状態 (`task` / `report` / `tab`) と一覧の取得、選択中の決定だけを持つ。各段の表示は同じディレクトリの部品へ分ける。
 * 期間は既存 `usePeriod` のもので、本画面は新しい期間状態を持たない (共通の期間タブと同じ値を読む)。
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  type AiReportDetailResponse,
  type AiTaskView,
  type AuthState,
  type SummaryResponse,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';
import type { Reanalyze } from './AiReportDetail.js';
import { AiRequestCard } from './AiRequestCard.js';
import { AiRunTable } from './AiRunTable.js';
import { aiRangeOf, aiTasksRefetchMs } from './view-model.js';
import './ai.css';

const QUESTION = 'AIに分析を依頼し、根拠と版を確認しますか？';

export function AiPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { key, withPeriod } = usePeriod();
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });
  const howto = useRef<HTMLDetailsElement>(null);
  // 共通の期間タブ (Layout) と同じキー。範囲の表示と依頼・件数の from / to を同じ値にする (FR-1)
  const summary = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
  const tasksQuery = useQuery({
    queryKey: ['ai-tasks'],
    queryFn: () => api<{ tasks: AiTaskView[] }>('/ai/tasks'),
    placeholderData: (previous) => previous,
    refetchInterval: (q) => aiTasksRefetchMs(q.state.data?.tasks),
  });
  const reportId = searchParams.get('reanalyze');
  const mode = searchParams.get('mode');
  const reanalyzeQuery = useQuery({
    queryKey: ['ai-report', reportId],
    queryFn: () => api<AiReportDetailResponse>(`/ai/reports/${encodeURIComponent(reportId ?? '')}`),
    enabled: !!reportId && (mode === 'revise' || mode === 'supplement'),
  });
  const parent = reanalyzeQuery.data?.report;
  const reanalyze: Reanalyze | null =
    parent && (mode === 'revise' || mode === 'supplement')
      ? { reportId: parent.id, title: parent.title, version: parent.version, period: parent.period, mode }
      : null;

  const tasks = tasksQuery.data?.tasks ?? [];
  const range = aiRangeOf(summary.data?.period);
  const userId = auth.data?.user?.id ?? null;

  if (reportId && (mode === 'revise' || mode === 'supplement') && reanalyzeQuery.isLoading) {
    return <PageState status="loading" message="元のレポートを読み込み中…" />;
  }
  if (reportId && (mode === 'revise' || mode === 'supplement') && reanalyzeQuery.isError) {
    return <PageState status="error" error={reanalyzeQuery.error} />;
  }

  const invalidateTasks = () => void qc.invalidateQueries({ queryKey: ['ai-tasks'] });
  const openDetail = (task: AiTaskView) => navigate(`/ai/tasks/${encodeURIComponent(task.id)}`);

  return (
    <div className="ai">
      <div className="ai-title-row">
        <PageHeader route="ai" title="AI分析" showTask={false} />
        <span className="ai-title-actions">
          <Link className="btn" to="/ai/reports">
            保存済みレポート
          </Link>
          <Button
            variant="text"
            className="ai-howto-link"
            onClick={() => {
              if (howto.current) howto.current.open = true;
              howto.current?.scrollIntoView?.({ block: 'start' });
            }}
          >
            ⓘ AI分析の使い方
          </Button>
        </span>
      </div>
      <details ref={howto} className="ai-howto" id="ai-howto">
        <summary>AI分析の使い方</summary>
        <ol>
          <li>「1. 依頼」で期間と補足指示を決め、Claude Code用またはCodex用のプロンプトをコピーします。</li>
          <li>
            コピーしたプロンプトを Claude Code / Codex に貼り付けて実行し、「2.
            実行中」で進み具合を確かめます。
          </li>
          <li>
            完了した依頼IDを開くと、専用画面でレポートを読めます。後からは「保存済みレポート」から開けます。
          </li>
        </ol>
      </details>
      <section className="ai-intro" aria-labelledby="ai-question">
        <h2 id="ai-question">{QUESTION}</h2>
        <p>社内の取引データをもとに、Claude Code / Codex で分析を実行します。</p>
        <p>ここでは、分析の依頼から実行状況の確認、結果レポートの取り込み・確認までを行えます。</p>
      </section>

      <AiRequestCard
        range={range}
        periodMeta={summary.data?.period}
        periodLoading={summary.isLoading}
        userId={userId}
        tasks={tasks}
        reanalyze={reanalyze}
        onCancelReanalyze={() => {
          const next = new URLSearchParams(searchParams);
          for (const key of ['reanalyze', 'mode']) next.delete(key);
          setSearchParams(next, { replace: true });
        }}
        onCreated={(task) => {
          invalidateTasks();
          openDetail(task);
        }}
        onCopied={invalidateTasks}
      />

      <AiRunTable
        query={tasksQuery}
        onSelect={openDetail}
        onOpenReport={(t) => openDetail(t)}
        onChanged={invalidateTasks}
        onRetried={(task) => {
          invalidateTasks();
          openDetail(task);
        }}
      />
    </div>
  );
}
