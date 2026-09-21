/**
 * 依頼へ加える操作 (キャンセル・再実行・削除) の 1 か所 (spec-ai-analysis-screen FR-5)。
 *
 * 一覧 (AiRunTable) と詳細 (AiTaskDetailPage) が同じ操作を持つので、呼び出し・文言・失敗の言い換えを
 * ここへ集める。出す・出さないの判定は持たない (core `aiTaskCapabilities` が唯一の判定元)。
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { type AiTaskCreateResponse, type AiTaskView, ApiError, api } from '../../api.js';
import { describeError } from '../../components/Page.js';
import { AI_COPY_TARGET_LABEL, copyTaskPrompt } from './copy-prompt.js';

/** 競合 (409) の言い換え。一覧が古いときに起きるので、文を出して取り直す */
const CONFLICT_MESSAGE: Record<string, string> = {
  already_done: 'この依頼は結果を受信済みです。一覧を更新しました。',
  already_expired: 'この依頼は受付期間を過ぎています。一覧を更新しました。',
  not_retryable: 'この依頼は再実行できる状態ではありません。一覧を更新しました。',
  not_deletable: 'この依頼は削除できる状態ではありません。一覧を更新しました。',
};

export const aiActionMessage = (e: unknown): string =>
  e instanceof ApiError && e.status === 409
    ? (CONFLICT_MESSAGE[e.code] ?? `${e.message}。一覧を更新しました。`)
    : describeError(e);

export interface AiPromptHandoff {
  prompt: string;
  task: AiTaskView;
}

export function useAiTaskActions({
  onChanged,
  onOpenTask,
}: {
  /** 一覧を取り直す */
  onChanged: () => void;
  /** 再実行で新しくできた依頼を開く */
  onOpenTask: (task: AiTaskView) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  // clipboard へ書けなかったときだけ入る。ここに入っても「コピー済み」とは記録しない
  const [handoff, setHandoff] = useState<AiPromptHandoff | null>(null);

  const fail = (e: unknown) => {
    setMessage(aiActionMessage(e));
    onChanged();
  };

  const cancel = useMutation({
    mutationFn: (task: AiTaskView) => api<{ ok: true }>(`/ai/tasks/${task.id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      setMessage('依頼をキャンセルしました。実行中のAIは結果を送れなくなります。同じ条件で再実行できます。');
      onChanged();
    },
    onError: fail,
  });

  const retry = useMutation({
    mutationFn: (task: AiTaskView) =>
      api<AiTaskCreateResponse>(`/ai/tasks/${task.id}/retry`, { method: 'POST' }),
    onSuccess: async (created: AiTaskCreateResponse, source: AiTaskView) => {
      // 元の依頼と同じコピー先へ戻す。不明なら既定の Claude Code
      const target = source.copiedTarget ?? 'claude_code';
      if (await copyTaskPrompt(created.task.id, created.prompt, target)) {
        setHandoff(null);
        setMessage(
          `${created.task.displayId} として再実行の依頼を作り、${AI_COPY_TARGET_LABEL[target]}用プロンプトをコピーしました。`,
        );
        onOpenTask(created.task);
      } else {
        setHandoff({ prompt: created.prompt, task: created.task });
        setMessage(
          `${created.task.displayId} として再実行の依頼を作りました。下の枠の中を全選択してコピーしてください。`,
        );
        onChanged();
      }
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (task: AiTaskView) => api<{ ok: true }>(`/ai/tasks/${task.id}`, { method: 'DELETE' }),
    onError: fail,
  });

  return {
    message,
    setMessage,
    handoff,
    cancel,
    retry,
    remove,
    busy: cancel.isPending || retry.isPending || remove.isPending,
  };
}
