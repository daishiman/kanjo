/**
 * 2. 実行中 (spec-ai-analysis-screen FR-4・FR-5)。
 *
 * 段階はサーバが決めて返す (`stage` / `progress`)。ここは段階ごとの操作を出し分けるだけにする。
 * キャンセルは結果の受付を止めるだけで取り返せる (再実行できる) ので確認を挟まない。
 * 削除は依頼の記録ごと消え戻せないので、共通の確認ダイアログを通す。
 */
import { AI_TASK_STAGE_LABEL, aiDateTimeLabel, aiPeriodShortLabel } from '@kanjo/core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AiTaskView } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog, usePendingConfirm } from '../../components/ConfirmDialog.js';
import { DataTable } from '../../components/DataTable.js';
import { describeError } from '../../components/Page.js';
import { AiPromptFallback } from './AiPromptFallback.js';
import { AiSelectableRow } from './AiSelectableRow.js';
import { AiTaskProgress } from './AiTaskProgress.js';
import { useAiTaskActions } from './use-ai-task-actions.js';
import { AI_STAGE_PILL, aiTaskActions, aiTaskSummaryLine } from './view-model.js';

export function AiRunTable({
  query,
  onSelect,
  onOpenReport,
  onChanged,
  onRetried,
}: {
  query: UseQueryResult<{ tasks: AiTaskView[] }>;
  onSelect: (task: AiTaskView) => void;
  onOpenReport: (task: AiTaskView) => void;
  onChanged: () => void;
  onRetried: (task: AiTaskView) => void;
}) {
  const { message, setMessage, handoff, cancel, retry, remove, busy } = useAiTaskActions({
    onChanged,
    onOpenTask: onRetried,
  });
  const confirmDelete = usePendingConfirm<AiTaskView>({ busy: remove.isPending });
  const runDelete = (t: AiTaskView) => {
    remove.mutate(t, {
      onSuccess: () => {
        setMessage(`${t.displayId} を削除しました。`);
        onChanged();
      },
      onSettled: () => confirmDelete.dismiss(),
    });
  };

  const tasks = query.data?.tasks ?? [];

  return (
    <section className="card ai-step" aria-labelledby="ai-step-run">
      <header className="ai-step-head">
        <h2 id="ai-step-run">2. 実行中</h2>
        <p className="sub">依頼した分析タスクの進行状況を確認します</p>
      </header>
      {query.isLoading ? (
        <p className="sub">依頼を読み込み中…</p>
      ) : query.isError ? (
        <div role="alert">
          <p className="sub">依頼を読み込めませんでした。{describeError(query.error)}</p>
          <Button size="mini" onClick={() => void query.refetch()}>
            再読込
          </Button>
        </div>
      ) : tasks.length === 0 ? (
        <p className="empty">まだ依頼はありません</p>
      ) : (
        <div className="scroll-x">
          <DataTable
            className="data ai-run-table"
            caption={<caption className="visually-hidden">依頼した分析タスクの一覧</caption>}
            columns={[
              'ID',
              'ステータス',
              '依頼期間',
              '作成日時',
              '進捗',
              '依頼内容',
              { label: '操作', sortable: false },
            ]}
          >
            {tasks.map((t) => {
              return (
                <AiSelectableRow key={t.id} id={`ai-task-${t.id}`} onSelect={() => onSelect(t)}>
                  <td className="num">
                    <Button
                      variant="text"
                      size="mini"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(t);
                      }}
                    >
                      {t.displayId}
                    </Button>
                  </td>
                  <td>
                    <span className={AI_STAGE_PILL[t.stage]}>{AI_TASK_STAGE_LABEL[t.stage]}</span>
                  </td>
                  <td>{aiPeriodShortLabel(t.period.from, t.period.to)}</td>
                  <td className="num">{aiDateTimeLabel(t.createdAt)}</td>
                  <td>
                    <AiTaskProgress progress={t.progress} />
                  </td>
                  <td className="ai-task-summary" title={t.supplement ?? undefined}>
                    {aiTaskSummaryLine(t.supplement)}
                  </td>
                  <td>
                    <span className="ai-row-actions">
                      {aiTaskActions(t.stage).map((a) =>
                        a === 'cancel' ? (
                          <Button
                            key={a}
                            size="mini"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessage(null);
                              cancel.mutate(t);
                            }}
                          >
                            キャンセル
                          </Button>
                        ) : a === 'detail' ? (
                          <Button
                            key={a}
                            size="mini"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenReport(t);
                            }}
                          >
                            詳細
                          </Button>
                        ) : a === 'retry' ? (
                          <Button
                            key={a}
                            size="mini"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessage(null);
                              retry.mutate(t);
                            }}
                          >
                            再実行
                          </Button>
                        ) : (
                          <Button
                            key={a}
                            size="mini"
                            variant="danger"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessage(null);
                              confirmDelete.ask(t);
                            }}
                          >
                            削除
                          </Button>
                        ),
                      )}
                    </span>
                  </td>
                </AiSelectableRow>
              );
            })}
          </DataTable>
        </div>
      )}
      {message && <output className="notice info">{message}</output>}
      {handoff && (
        <AiPromptFallback
          prompt={handoff.prompt}
          label="再実行のプロンプト"
          onOpen={() => onRetried(handoff.task)}
        />
      )}
      {confirmDelete.target && (
        <ConfirmDialog
          dialog={confirmDelete.dialog}
          title="この依頼を削除しますか？"
          // トリガーは「削除」。記録ごと消えることを確定側の語で言う
          confirmLabel="依頼の記録を消す"
          busyLabel="削除中…"
          onConfirm={() => runDelete(confirmDelete.target as AiTaskView)}
          onDismiss={confirmDelete.dismiss}
        >
          <p>
            {confirmDelete.target.displayId}(
            {aiPeriodShortLabel(confirmDelete.target.period.from, confirmDelete.target.period.to)})
          </p>
          <p className="sub">
            依頼の記録が一覧から消え、元に戻せません。同じ条件で依頼し直すことはできます。
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
