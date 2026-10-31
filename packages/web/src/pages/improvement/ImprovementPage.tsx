/**
 * 改善リクエスト画面 (specs/spec-improvement-screen.md、design/FINAL-UI/images/20-improvement.png)。
 *
 * 上段に作成フォーム、下段に一覧と詳細、下端に選択中バー、右下に知らせを置く。
 * 選択中の依頼・タブ・検索語・ページは URL に持ち、同じ URL なら同じ一覧と詳細が出る (FR-26)。
 *
 * 指示文の原文は作成時と再発行時にしか返らない (サーバはハッシュだけを持つ)。
 * 受け取った原文はこの画面のメモリにだけ置き、無ければコピーの前に再発行する (FR-18)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  type ImprovementCreateResponse,
  deleteImprovement,
  getImprovement,
  listImprovements,
  markImprovementCopied,
  reissueImprovementPrompt,
  restoreImprovement,
  setImprovementStatus,
} from '../../api.js';
import { CreateForm, IMPROVEMENT_BODY_ID } from './CreateForm.js';
import { DetailPanel } from './DetailPanel.js';
import { ImprovementList } from './ImprovementList.js';
import { SelectionBar } from './SelectionBar.js';
import { type ImprovementNotice, Toasts } from './Toasts.js';
import {
  type CopyTarget,
  type ImprovementStatus,
  type ImprovementUrlState,
  LEAD,
  QUESTION,
  TEXT,
  TITLE,
  actionErrorText,
  classifyActionError,
  copiedToast,
  readImprovementUrl,
  writeImprovementUrl,
} from './view-model.js';
import './improvement.css';

const LIST_KEY = ['improvements', 'list'] as const;
const detailKey = (id: string) => ['improvements', 'detail', id] as const;

export function ImprovementPage() {
  const [params, setParams] = useSearchParams();
  const url = readImprovementUrl(params);
  const qc = useQueryClient();

  const [notice, setNotice] = useState<ImprovementNotice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** クリップボードに書けなかったときだけ出す、手でコピーする欄 */
  const [fallback, setFallback] = useState<{ id: string; prompt: string } | null>(null);
  /** 受け取った指示文の原文。端末には保存しない */
  const prompts = useRef(new Map<string, string>());

  const go = useCallback(
    (patch: Partial<ImprovementUrlState>, replace = false) => {
      setParams(writeImprovementUrl({ ...readImprovementUrl(params), ...patch }), { replace });
    },
    [params, setParams],
  );
  const select = useCallback(
    (id: string | null) => {
      setActionError(null);
      go({ id });
    },
    [go],
  );

  const list = useQuery({
    queryKey: [...LIST_KEY, url.tab, url.q, url.page],
    queryFn: () => listImprovements({ q: url.q, tab: url.tab, page: url.page }),
    placeholderData: (prev) => prev,
  });

  const detail = useQuery({
    queryKey: detailKey(url.id ?? ''),
    queryFn: () => getImprovement(url.id as string),
    enabled: url.id !== null,
    retry: false,
  });

  // URL の id が見つからない (削除中・他の利用者・存在しない) なら、選択を外して一覧だけにする
  useEffect(() => {
    if (url.id && detail.isError && classifyActionError(detail.error) === 'not_found') {
      go({ id: null }, true);
    }
  }, [url.id, detail.isError, detail.error, go]);

  const refresh = (id?: string) => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    if (id) void qc.invalidateQueries({ queryKey: detailKey(id) });
  };

  /** 操作の失敗を読み分ける。410 と 409 と 404 は、文だけでなく画面の状態も直す */
  const onActionFailure = (id: string, error: unknown) => {
    const kind = classifyActionError(error);
    if (kind === 'purged') setActionError(TEXT.purged);
    else if (kind === 'conflict') {
      setActionError(TEXT.conflict);
      refresh(id);
    } else if (kind === 'not_found') {
      refresh();
      go({ id: null });
    } else setActionError(actionErrorText(error));
  };

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ImprovementStatus }) =>
      setImprovementStatus(id, status),
    onSuccess: (_res, { id }) => {
      setActionError(null);
      refresh(id);
    },
    onError: (e, { id }) => onActionFailure(id, e),
  });

  const reissueMut = useMutation({
    mutationFn: (id: string) => reissueImprovementPrompt(id),
    onSuccess: (res, id) => {
      prompts.current.set(id, res.prompt);
      setActionError(null);
      setNotice({ kind: 'info', text: TEXT.reissued });
      refresh(id);
    },
    onError: (e, id) => onActionFailure(id, e),
  });

  const copyMut = useMutation({
    mutationFn: async ({ id, target }: { id: string; target: CopyTarget }) => {
      let prompt = prompts.current.get(id);
      if (!prompt) {
        // 原文が手元に無い = 前の発行はもう読めない。再発行して新しい原文を得る
        prompt = (await reissueImprovementPrompt(id)).prompt;
        prompts.current.set(id, prompt);
      }
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        return { id, target, prompt, copied: false };
      }
      await markImprovementCopied(id, target);
      return { id, target, prompt, copied: true };
    },
    onSuccess: (res) => {
      setActionError(null);
      if (res.copied) {
        setFallback(null);
        setNotice({ kind: 'copied', text: copiedToast(res.target) });
      } else {
        setFallback({ id: res.id, prompt: res.prompt });
        setNotice({ kind: 'error', text: TEXT.copyFallback });
      }
      refresh(res.id);
    },
    onError: (e, { id }) => onActionFailure(id, e),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteImprovement(id),
    onSuccess: (res) => {
      setActionError(null);
      setFallback(null);
      setNotice({ kind: 'deleted', id: res.id });
      refresh();
      go({ id: null });
    },
    onError: (e, id) => onActionFailure(id, e),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreImprovement(id),
    onSuccess: (res) => {
      setNotice(null);
      refresh(res.request.id);
      go({ id: res.request.id });
    },
    onError: (e) => {
      setNotice({
        kind: 'error',
        text: classifyActionError(e) === 'not_found' ? TEXT.cannotRestore : actionErrorText(e),
      });
    },
  });

  const busy =
    statusMut.isPending ||
    reissueMut.isPending ||
    copyMut.isPending ||
    deleteMut.isPending ||
    restoreMut.isPending;

  const onCreated = (res: ImprovementCreateResponse) => {
    prompts.current.set(res.request.id, res.prompt);
    setNotice(null);
    refresh();
    // 新しい依頼は先頭のページ・すべてのタブで見つかる
    go({ id: res.request.id, tab: 'all', q: '', page: 1 });
  };

  const focusBody = () => {
    const el = document.getElementById(IMPROVEMENT_BODY_ID);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  };

  const d = url.id && detail.data?.request.id === url.id ? detail.data : undefined;
  const detailStatus =
    url.id === null
      ? 'none'
      : d
        ? 'success'
        : detail.isFetching
          ? 'pending'
          : detail.isError
            ? 'error'
            : 'pending';
  const id = url.id;

  return (
    <div className="improvement-page">
      <div className="improvement-head">
        <header className="page-heading">
          <h1 className="page-title">{TITLE}</h1>
          <h2 className="page-question">{QUESTION}</h2>
          <p className="page-task">{LEAD}</p>
        </header>
        <Link className="improvement-howto" to="/guide">
          改善リクエストの使い方
        </Link>
      </div>

      <CreateForm onCreated={onCreated} />

      <div className="improvement-panes">
        <ImprovementList
          q={url.q}
          tab={url.tab}
          data={list.data}
          status={list.isError && !list.data ? 'error' : list.data ? 'success' : 'pending'}
          selectedId={id}
          onQuery={(q) => go({ q, page: 1 }, true)}
          onTab={(tab) => go({ tab, page: 1 })}
          onPage={(page) => go({ page })}
          onSelect={(next) => select(next)}
          onRetry={() => void list.refetch()}
          onStartCreate={focusBody}
        />
        {!(list.data && list.data.counts.all === 0 && url.q === '' && !id) && (
          <DetailPanel
            detail={d}
            status={detailStatus}
            busy={busy}
            actionError={actionError}
            willReissueOnCopy={Boolean(id && !prompts.current.has(id))}
            actions={{
              onClose: () => select(null),
              onSelect: (next) => select(next),
              onRetry: () => void detail.refetch(),
              onStatus: (status) => id && statusMut.mutate({ id, status }),
              onReissue: () => id && reissueMut.mutate(id),
              onCopy: (target) => id && copyMut.mutate({ id, target }),
              onDelete: () => id && deleteMut.mutate(id),
            }}
          />
        )}
      </div>

      {fallback && fallback.id === id && (
        <section className="card improvement-fallback" aria-labelledby="improvement-fallback-title">
          <h2 id="improvement-fallback-title">指示文 (手でコピー)</h2>
          <p className="sub">{TEXT.copyFallback}</p>
          <textarea
            className="improvement-prompt"
            readOnly
            rows={10}
            value={fallback.prompt}
            onFocus={(e) => e.currentTarget.select()}
          />
        </section>
      )}

      {d && id && (
        <SelectionBar
          number={d.number}
          summary={d.summary}
          status={d.request.status}
          busy={busy}
          willReissueOnCopy={!prompts.current.has(id)}
          onCopy={(target) => copyMut.mutate({ id, target })}
          onClose={() => select(null)}
        />
      )}

      <Toasts
        notice={notice}
        busy={restoreMut.isPending}
        onUndo={(target) => restoreMut.mutate(target)}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}
