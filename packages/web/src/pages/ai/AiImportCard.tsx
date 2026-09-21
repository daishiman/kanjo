/**
 * 3. レポートの左下「結果の取り込み」 (spec-ai-analysis-screen FR-8)。
 *
 * AIが送信できなかったときに、出力された JSON を貼り付けて保存する。
 * 構文の誤りは送る前に行・列で示し (core `jsonErrorPosition`)、サーバの拒否は理由を並べる。
 * どの失敗でも入力は消さない (直して送り直せるように)。
 */
import { aiJsonErrorMessage, aiTaskIsPending, jsonErrorPosition } from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { type AiTaskView, ApiError, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { describeError } from '../../components/Page.js';

/** サーバの issues は {path,message} の配列 (validator) か文字列の配列 (normalize)。どちらも 1 行の文にする */
export function aiIssueLines(body: unknown): string[] {
  const issues = (body as { error?: { issues?: unknown } } | undefined)?.error?.issues;
  if (!Array.isArray(issues)) return [];
  return issues
    .map((i) => {
      if (typeof i === 'string') return i;
      if (i && typeof i === 'object') {
        const { path, message } = i as { path?: unknown; message?: unknown };
        const where = Array.isArray(path) ? path.join('.') : typeof path === 'string' ? path : '';
        return where ? `${where}: ${String(message ?? '')}` : String(message ?? '');
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, 20);
}

/** 取り込み先: 選択中の依頼が結果待ちならそれ、そうでなく結果待ちが 1 件だけならそれ */
export function aiImportTarget(tasks: AiTaskView[], selected: AiTaskView | null): AiTaskView | null {
  if (selected && aiTaskIsPending(selected.stage)) return selected;
  const pending = tasks.filter((t) => aiTaskIsPending(t.stage));
  return pending.length === 1 ? pending[0] : null;
}

interface ImportError {
  text: string;
  issues: string[];
}

function importErrorOf(e: unknown): ImportError {
  if (e instanceof ApiError) {
    if (e.status === 409 && e.code === 'already_done')
      return { text: 'この依頼は結果を受信済みです。', issues: [] };
    if (e.status === 409 && e.code === 'task_canceled')
      return { text: 'この依頼はキャンセル済みです。再実行してから取り込んでください。', issues: [] };
    if (e.status === 413)
      return {
        text: '送信できる大きさを超えています。AIの出力をそのまま貼り付けているか確認してください。',
        issues: [],
      };
    if (e.code === 'invalid_report' || e.code === 'missing_sections')
      return {
        text: 'レポートの形式が足りていません。次の点を直して、もう一度取り込んでください。',
        issues: aiIssueLines(e.body),
      };
    if (e.code === 'invalid_json') return { text: 'JSONとして読めませんでした。', issues: [] };
  }
  return { text: describeError(e), issues: [] };
}

export function AiImportCard({
  tasks,
  selectedTask,
  onImported,
}: {
  tasks: AiTaskView[];
  selectedTask: AiTaskView | null;
  onImported: (reportId: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<ImportError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const target = aiImportTarget(tasks, selectedTask);

  const paste = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api<{ ok: true; reportId: string }>(`/ai/tasks/${id}/paste`, { method: 'POST', body }),
    onSuccess: (r) => {
      setText('');
      setError(null);
      setDone('取り込みました。レポートとして保存し、右に内容を出しています。');
      onImported(r.reportId);
    },
    onError: (e) => setError(importErrorOf(e)),
  });

  const submit = () => {
    if (!target) return;
    setDone(null);
    const position = jsonErrorPosition(text);
    if (position) {
      setError({ text: aiJsonErrorMessage(position), issues: [] });
      return;
    }
    // 読めた本文をそのまま送る (整形し直すと、サーバが返す位置と画面の行がずれる)
    paste.mutate({ id: target.id, body: text });
  };

  return (
    <section className="ai-panel" aria-labelledby="ai-import-title">
      <h3 id="ai-import-title">結果の取り込み</h3>
      <p className="sub">
        {target
          ? `取り込み先: ${target.displayId}(${target.label})`
          : '取り込み先の依頼がありません。「2. 実行中」で結果待ちの依頼を選んでください。'}
      </p>
      <textarea
        value={text}
        rows={6}
        aria-label="結果のJSON"
        placeholder='{"generatedBy": "claude-code", "summary": "...", "sections": [...] }'
        onChange={(e) => setText(e.target.value)}
      />
      <div className="toolbar">
        <Button variant="primary" disabled={!target || !text.trim() || paste.isPending} onClick={submit}>
          {paste.isPending ? '取り込み中…' : '結果を取り込む'}
        </Button>
        <Button
          disabled={!text || paste.isPending}
          onClick={() => {
            setText('');
            setError(null);
          }}
        >
          クリア
        </Button>
      </div>
      {error && (
        <div className="notice" role="alert">
          <p>{error.text}</p>
          {error.issues.length > 0 && (
            <ul className="ai-issues">
              {error.issues.map((line, i) => (
                // 同じ文が並ぶことがあるので位置も鍵にする
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {done && <output className="sub">{done}</output>}
      <p className="sub">取り込み後、レポートとして保存され、内容の確認や版の管理ができます。</p>
    </section>
  );
}
