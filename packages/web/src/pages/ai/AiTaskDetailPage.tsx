/**
 * AI分析の依頼1件を読む専用画面。一覧と長文レポートの目的を分け、URLで再訪・共有できる。
 */
import { AI_TASK_STAGE_LABEL, aiDateTimeLabel, aiPeriodRangeLabel, aiTaskIsPending } from '@kanjo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { type AiTaskView, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { AiBackLink } from './AiBackLink.js';
import { AiImportCard } from './AiImportCard.js';
import { AiPromptFallback } from './AiPromptFallback.js';
import { AiReportDetail, reanalyzeHref } from './AiReportDetail.js';
import { AiTaskProgress } from './AiTaskProgress.js';
import { AI_COPY_TARGET_LABEL } from './copy-prompt.js';
import { useAiReportTab } from './use-ai-report-tab.js';
import { useAiTaskActions } from './use-ai-task-actions.js';
import { AI_STAGE_PILL, AI_TASKS_REFETCH_MS, aiTaskActions, aiTaskSummaryLine } from './view-model.js';
import './ai.css';

export function AiTaskDetailPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab, setTab } = useAiReportTab();
  const taskQuery = useQuery({
    queryKey: ['ai-tasks', taskId],
    queryFn: () => api<{ tasks: AiTaskView[] }>(`/ai/tasks?id=${encodeURIComponent(taskId)}`),
    // 一覧と同じ間隔・同じ「結果待ちか」の判定を使う
    refetchInterval: (query) => {
      const stage = query.state.data?.tasks.find((item) => item.id === taskId)?.stage;
      return stage && aiTaskIsPending(stage) ? AI_TASKS_REFETCH_MS : false;
    },
  });
  const task = taskQuery.data?.tasks.find((item) => item.id === taskId) ?? null;

  const invalidateTasks = () => void qc.invalidateQueries({ queryKey: ['ai-tasks'] });
  const openTask = (next: AiTaskView) => {
    invalidateTasks();
    navigate(`/ai/tasks/${encodeURIComponent(next.id)}`);
  };
  const { message, setMessage, handoff, cancel, retry, busy } = useAiTaskActions({
    onChanged: invalidateTasks,
    onOpenTask: openTask,
  });

  if (taskQuery.isLoading) return <PageState status="loading" message="分析依頼を読み込み中…" />;
  if (taskQuery.isError) return <PageState status="error" error={taskQuery.error} />;
  if (!task)
    return (
      <div className="ai ai-detail-page">
        <AiBackLink to="/ai">AI分析へ戻る</AiBackLink>
        <PageState status="empty" message="この分析依頼は見つかりません。" />
      </div>
    );

  const complete = task.stage === 'done' && !!task.reportId;
  return (
    <div className="ai ai-detail-page">
      <AiBackLink to="/ai">AI分析へ戻る</AiBackLink>
      <PageHeader
        route="ai"
        title={complete ? '分析レポート' : '分析依頼の状況'}
        lead={`${task.displayId} · ${aiPeriodRangeLabel(task.period.from, task.period.to)}`}
        showTask={false}
      />

      <section className="card ai-task-hero" aria-labelledby="ai-task-state-title">
        <div>
          <p className="sub">現在の状態</p>
          <h2 id="ai-task-state-title">
            <span className={AI_STAGE_PILL[task.stage]}>{AI_TASK_STAGE_LABEL[task.stage]}</span>{' '}
            {complete ? 'レポートができました' : aiTaskSummaryLine(task.supplement)}
          </h2>
          <AiTaskProgress progress={task.progress} />
        </div>
        <dl className="ai-task-meta">
          <div>
            <dt>依頼日時</dt>
            <dd className="num">{aiDateTimeLabel(task.createdAt)}</dd>
          </div>
          <div>
            <dt>プロンプト</dt>
            <dd>
              {task.copiedAt
                ? `${task.copiedTarget ? AI_COPY_TARGET_LABEL[task.copiedTarget] : 'コピー先不明'}へ ${aiDateTimeLabel(task.copiedAt)}にコピー済み`
                : '未コピー'}
            </dd>
          </div>
        </dl>
        {!complete && (
          <div className="ai-next-action">
            <h3>次にすること</h3>
            {task.stage === 'waiting' && (
              <p>コピー先のAIでプロンプトを実行してください。データ取得が始まると進捗が自動更新されます。</p>
            )}
            {task.stage === 'running' && (
              <p>AIがデータを読み、レポートを作っています。この画面は自動更新されます。</p>
            )}
            {(task.stage === 'failed' || task.stage === 'canceled') && (
              <p>同じ条件で新しい依頼を作り、もう一度実行できます。</p>
            )}
            <div className="toolbar">
              {/* 出す・出さないは一覧と同じ 1 つの判定元 (core aiTaskCapabilities) に任せる */}
              {aiTaskActions(task.stage).map((action) =>
                action === 'cancel' ? (
                  <Button
                    key={action}
                    disabled={busy}
                    onClick={() => {
                      setMessage(null);
                      cancel.mutate(task);
                    }}
                  >
                    {cancel.isPending ? 'キャンセル中…' : '依頼をキャンセル'}
                  </Button>
                ) : action === 'retry' ? (
                  <Button
                    key={action}
                    variant="primary"
                    disabled={busy}
                    onClick={() => {
                      setMessage(null);
                      retry.mutate(task);
                    }}
                  >
                    {retry.isPending ? '再実行を準備中…' : '同じ条件で再実行'}
                  </Button>
                ) : null,
              )}
            </div>
          </div>
        )}
      </section>
      {message && <output className="notice info">{message}</output>}
      {handoff && (
        <AiPromptFallback
          prompt={handoff.prompt}
          label="再実行のプロンプト"
          onOpen={() => openTask(handoff.task)}
        />
      )}

      {complete ? (
        <AiReportDetail
          id={task.reportId}
          tab={tab}
          onTab={setTab}
          onOpen={(reportId) => navigate(`/ai/reports/${encodeURIComponent(reportId)}`)}
          onChanged={() => void qc.invalidateQueries({ queryKey: ['ai-report'] })}
          onReanalyze={(value) => navigate(reanalyzeHref(value))}
        />
      ) : task.stage === 'waiting' || task.stage === 'running' ? (
        <AiImportCard
          tasks={[task]}
          selectedTask={task}
          onImported={async () => {
            await qc.invalidateQueries({ queryKey: ['ai-tasks'] });
          }}
        />
      ) : null}
    </div>
  );
}
