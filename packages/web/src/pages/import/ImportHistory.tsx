/**
 * 5. 取込履歴 と 履歴の詳細ペイン (spec「5. 取込履歴」「履歴の詳細」)。
 *
 * 行の操作は core の importHistoryActions だけが決め、API の拒否と同じ表を見る。
 * 取り返しのつかない操作 (置換・取り消し・削除) は必ずアプリ内の確認を挟む。
 * 詳細ペインは URL の `?run=` で開き、再読込・共有しても同じ行を指す。
 */
import {
  IMPORT_HISTORY_ACTION_LABEL,
  IMPORT_LIMITS,
  IMPORT_RESULT_LABEL,
  IMPORT_SOURCE_LABEL,
  IMPORT_SOURCE_SHORT,
  type ImportHistoryAction,
  formatImportDateTime,
  formatImportDateTimeLong,
  formatImportPeriod,
  importHistoryActions,
  importHistoryDetail,
  importHistoryHideable,
  importRunResultText,
} from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../api-client.js';
import {
  AUTH_EVENT,
  type ImportRunCommitResponse,
  type ImportRunDetail,
  type ImportRunDetailFile,
  type ImportRunRowView,
  type ImportRunUndoPreflight,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import {
  ImportDiscardBulkButton,
  ImportDiscardButton,
  ImportUndoButton,
} from '../../components/ImportDeletion.js';
import { PageState, describeError } from '../../components/Page.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { ImportConfirm } from './ImportConfirm.js';
import { importCommitErrorText, importMonthsText } from './view-model.js';

/**
 * 置換の続き (2 本目以降) を送る。置換は続きも確定の回数に数えるので、6 ファイル目以降は 429 になりうる。
 * そのときは Retry-After だけ待って同じ要求をやり直す。待つのは 1 回の置換で最大 maxFiles 回まで。
 */
async function reimportContinuation(
  runId: string,
  payload: { filenames: string[]; intoRunId: string },
  onWait: (seconds: number) => void,
): Promise<ImportRunCommitResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api<ImportRunCommitResponse>(`/imports/runs/${runId}/reimport`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 429 || attempt >= IMPORT_LIMITS.maxFiles)
        throw caught;
      const seconds = caught.retryAfter ?? 60;
      onWait(seconds);
      await new Promise((done) => setTimeout(done, seconds * 1000));
    }
  }
}

const RESULT_TONE = { success: 'calm', partial: 'warn', failed: 'alert', undone: 'neutral' } as const;
const RESULT_ICON = { success: '✓', partial: '!', failed: '✕', undone: '↺' } as const;

type Pending =
  | { kind: 'replace' | 'undo' | 'delete'; run: ImportRunRowView }
  | { kind: 'bulk'; ids: string[] };

/** 原本を 1 つ保存させる。jsdom など URL.createObjectURL が無い環境では何もしない */
async function downloadOriginal(importId: number, filename: string | null): Promise<void> {
  const res = await fetch(`/api/imports/${importId}/original`);
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new Error('ログインし直してください');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `原本を取り出せませんでした(${res.status})`);
  }
  const blob = await res.blob();
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `import-${importId}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadRunFiles(runId: string): Promise<number> {
  const { run } = await api<{ run: ImportRunDetail }>(`/imports/runs/${runId}`);
  const files = run.files.filter((file) => file.hasOriginal);
  if (!files.length) throw new Error('この取込の原本は保存されていません');
  for (const file of files) await downloadOriginal(file.importId, file.filename);
  return files.length;
}

export function ImportHistory({
  selectedRunId,
  onOpen,
  onClose,
  disabled,
}: {
  selectedRunId: string | null;
  onOpen: (runId: string) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const runs = useQuery({
    queryKey: ['import-runs'],
    queryFn: () => api<{ runs: ImportRunRowView[] }>('/imports/runs'),
  });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [preflight, setPreflight] = useState<ImportRunUndoPreflight | null>(null);

  const refresh = () => void qc.invalidateQueries();

  const action = useMutation({
    mutationFn: async (target: Pending): Promise<string> => {
      if (target.kind === 'replace') {
        let body = await api<ImportRunCommitResponse>(`/imports/runs/${target.run.id}/reimport`, {
          method: 'POST',
        });
        const intoRunId = body.run.id;
        let failed = body.run.files.filter((file) => file.state === 'failed').length;
        while (body.remaining.length) {
          body = await reimportContinuation(
            target.run.id,
            { filenames: body.remaining, intoRunId },
            (seconds) =>
              setNotice({
                tone: 'info',
                text: `短時間に操作が集中したため、${seconds}秒待ってから続きを置換します。`,
              }),
          );
          failed += body.run.files.filter((file) => file.state === 'failed').length;
        }
        return failed
          ? `置換しました。${failed}件のファイルは取り込めませんでした。`
          : '保存した原本で置換しました。';
      }
      if (target.kind === 'undo') {
        const plan =
          preflight ??
          (await api<ImportRunUndoPreflight>(`/imports/runs/${target.run.id}/undo/preflight`, {
            method: 'POST',
          }));
        await api(`/imports/runs/${target.run.id}/undo`, {
          method: 'POST',
          body: JSON.stringify({
            fingerprints: plan.imports.map(({ importId, fingerprint }) => ({ importId, fingerprint })),
          }),
        });
        return `取り消しました。${plan.undoRetentionDays}日以内なら「取込の削除」から元に戻せます。`;
      }
      const ids = target.kind === 'bulk' ? target.ids : [target.run.id];
      const body = await api<{ hidden: number }>('/imports/runs/hide', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      return `${body.hidden}件の履歴を削除しました。取り込んだデータは変わりません。`;
    },
    onSuccess: (text, target) => {
      setNotice({ tone: 'info', text });
      finishDialog();
      setPending(null);
      setPreflight(null);
      if (target.kind === 'bulk' || target.kind === 'delete') {
        setChecked(new Set());
        if (target.kind === 'delete' && target.run.id === selectedRunId) onClose();
        if (target.kind === 'bulk' && selectedRunId && target.ids.includes(selectedRunId)) onClose();
      }
      refresh();
    },
    onError: (error) => {
      setNotice({ tone: 'warn', text: importCommitErrorText(error) });
      finishDialog();
      setPending(null);
      setPreflight(null);
      refresh();
    },
  });
  const dialog = useConfirmDialog({ busy: action.isPending });
  // 応答を受けた時点ではまだ busy なので close() は効かない。開閉を直接戻し、押したボタンへフォーカスを返す
  function finishDialog() {
    dialog.setOpen(false);
    dialog.triggerRef.current?.focus();
  }

  const download = useMutation({
    mutationFn: downloadRunFiles,
    onSuccess: (count) => setNotice({ tone: 'info', text: `${count}件の原本を保存しました。` }),
    onError: (error) => setNotice({ tone: 'warn', text: describeError(error) }),
  });

  const ask = async (event: MouseEvent<HTMLButtonElement>, target: Pending) => {
    dialog.triggerRef.current = event.currentTarget;
    setNotice(null);
    setPreflight(null);
    if (target.kind === 'undo') {
      // 何が消えるかを数えてから確認する。数えられなければ確認を開かない
      try {
        setPreflight(
          await api<ImportRunUndoPreflight>(`/imports/runs/${target.run.id}/undo/preflight`, {
            method: 'POST',
          }),
        );
      } catch (error) {
        setNotice({ tone: 'warn', text: importCommitErrorText(error) });
        return;
      }
    }
    setPending(target);
    dialog.setOpen(true);
  };

  const onRowAction = (
    event: MouseEvent<HTMLButtonElement>,
    run: ImportRunRowView,
    name: ImportHistoryAction,
  ) => {
    if (name === 'detail') onOpen(run.id);
    else if (name === 'files') download.mutate(run.id);
    else void ask(event, { kind: name, run });
  };

  const rows = runs.data?.runs ?? [];
  const hideable = rows.filter((run) => run.canHide && importHistoryHideable(run.result));
  const checkedIds = [...checked].filter((id) => hideable.some((run) => run.id === id));
  const now = Date.now();

  return (
    <>
      <section className="card import-step import-history" aria-labelledby="import-history-title">
        <div className="import-step-head">
          <div>
            <h2 id="import-history-title">
              <span className="import-step-no">5.</span> 取込履歴
            </h2>
            <p className="import-step-sub">
              過去の取込履歴です。ファイルの再取得や、誤って取り込んだデータの取り消しができます。
            </p>
          </div>
          <Button
            variant="danger"
            disabled={disabled || checkedIds.length === 0 || action.isPending}
            onClick={(event) => void ask(event, { kind: 'bulk', ids: checkedIds })}
          >
            選択した履歴を一括削除
          </Button>
        </div>
        {notice && (
          <p className={`notice ${notice.tone}`} role={notice.tone === 'warn' ? 'alert' : 'status'}>
            {notice.text}
          </p>
        )}
        {runs.isLoading ? (
          <PageState status="loading" />
        ) : runs.isError ? (
          <div className="notice warn" role="alert">
            取込履歴を読み込めませんでした。{describeError(runs.error)}{' '}
            <Button size="mini" onClick={() => void runs.refetch()}>
              再読込
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="import-empty">まだ取込履歴はありません</p>
        ) : (
          <div className="import-table-wrap">
            <table
              className="import-table import-history-table"
              data-table-kind="workflow"
              data-sort-reason="サーバが新しい順にページ単位で返すため、手元の並べ替えは見えている頁だけを並べ替える誤解になる"
            >
              <caption className="visually-hidden">取込履歴</caption>
              <thead>
                <tr>
                  <th scope="col" className="import-col-check">
                    <span className="visually-hidden">一括削除の選択</span>
                  </th>
                  <th scope="col">取込日時</th>
                  <th scope="col">取込元</th>
                  <th scope="col">ファイル数</th>
                  <th scope="col">取込明細数</th>
                  <th scope="col">結果</th>
                  <th scope="col">詳細</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((run) => {
                  const canHide = run.canHide && importHistoryHideable(run.result);
                  const actions = importHistoryActions({ result: run.result, createdAt: run.createdAt, now });
                  return (
                    <tr key={run.id} aria-current={run.id === selectedRunId ? 'true' : undefined}>
                      <td className="import-col-check">
                        <SelectionCheckbox
                          label={`${formatImportDateTime(run.createdAt)} の履歴を一括削除に含める`}
                          labelHidden
                          disabled={!canHide || disabled}
                          checked={canHide && checked.has(run.id)}
                          onChange={(event) =>
                            setChecked((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(run.id);
                              else next.delete(run.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <th scope="row" className="import-nowrap">
                        {formatImportDateTime(run.createdAt)}
                      </th>
                      <td>
                        {run.sources.length ? run.sources.map((s) => IMPORT_SOURCE_SHORT[s]).join('・') : '-'}
                      </td>
                      <td className="num">{run.fileCount}</td>
                      <td className="num">{run.rowCount.toLocaleString('ja-JP')}</td>
                      <td>
                        <span className={`pill ${RESULT_TONE[run.result]}`}>
                          <span aria-hidden="true">{RESULT_ICON[run.result]}</span>{' '}
                          {IMPORT_RESULT_LABEL[run.result]}
                        </span>
                      </td>
                      <td>{importHistoryDetail(run.detail)}</td>
                      <td className="import-actions">
                        {actions.map((name) => (
                          <Button
                            key={name}
                            size="mini"
                            variant={
                              name === 'undo' || name === 'delete'
                                ? 'danger'
                                : name === 'detail'
                                  ? 'text'
                                  : 'secondary'
                            }
                            disabled={
                              (name !== 'detail' && disabled) ||
                              action.isPending ||
                              (name === 'files' && (!run.hasOriginal || download.isPending)) ||
                              (name === 'replace' && !run.replaceable) ||
                              (name === 'undo' && !run.undoable) ||
                              (name === 'delete' && !canHide)
                            }
                            aria-label={`${formatImportDateTime(run.createdAt)} の取込を${IMPORT_HISTORY_ACTION_LABEL[name]}`}
                            onClick={(event) => onRowAction(event, run, name)}
                          >
                            {IMPORT_HISTORY_ACTION_LABEL[name]}
                          </Button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRunId && (
        <ImportHistoryDetail
          runId={selectedRunId}
          onClose={onClose}
          downloading={download.isPending}
          onDownload={() => download.mutate(selectedRunId)}
        />
      )}

      <ImportConfirm
        dialog={dialog}
        title={confirmTitle(pending)}
        confirmLabel={confirmLabel(pending)}
        busyLabel="実行しています…"
        danger={pending?.kind !== 'replace'}
        onConfirm={() => pending && action.mutate(pending)}
      >
        {pending?.kind === 'replace' && (
          <p>保存した原本で同じ月の明細を洗い替えます。手で直した仕分けは、同じ明細に引き継がれます。</p>
        )}
        {pending?.kind === 'undo' && preflight && (
          <>
            <p>この取込で追加した明細を消します。対象月: {importMonthsText(preflight.months)}</p>
            <ul>
              <li>マネーフォワードの明細 {preflight.counts.mfTx}件</li>
              <li>freee の取引 {preflight.counts.freeeDeals}件</li>
              <li>残高の記録 {preflight.counts.balanceEntries}件</li>
            </ul>
            <p>{preflight.undoRetentionDays}日以内なら元に戻せます。</p>
          </>
        )}
        {(pending?.kind === 'delete' || pending?.kind === 'bulk') && (
          <p>履歴の行を一覧から消します。取り込んだデータ・取り消しの記録は変わりません。</p>
        )}
      </ImportConfirm>
    </>
  );
}

function confirmTitle(pending: Pending | null): string {
  if (!pending) return '';
  if (pending.kind === 'replace') return 'この取込を保存した原本で置換しますか？';
  if (pending.kind === 'undo') return 'この取込を取り消しますか？';
  if (pending.kind === 'bulk') return `選択した${pending.ids.length}件の履歴を削除しますか？`;
  return 'この履歴を削除しますか？';
}

function confirmLabel(pending: Pending | null): string {
  if (pending?.kind === 'replace') return '原本で置換する';
  if (pending?.kind === 'undo') return '明細を消して取り消す';
  return '履歴を一覧から消す';
}

/** 履歴の詳細ペイン。開いたら見出しへフォーカスを移し、× で閉じて一覧へ戻す */
function ImportHistoryDetail({
  runId,
  onClose,
  onDownload,
  downloading,
}: {
  runId: string;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const detail = useQuery({
    queryKey: ['import-runs', runId],
    queryFn: () => api<{ run: ImportRunDetail }>(`/imports/runs/${runId}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 別の履歴へ切り替えたときも見出しへフォーカスを移し直す。
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [runId]);
  const run = detail.data?.run;
  const notFound = detail.error instanceof ApiError && detail.error.status === 404;

  return (
    <aside className="card import-detail" aria-labelledby="import-detail-title">
      <div className="import-detail-head">
        <h2 id="import-detail-title" ref={heading} tabIndex={-1}>
          履歴の詳細
        </h2>
        <Button variant="text" aria-label="履歴の詳細を閉じる" onClick={onClose}>
          ×
        </Button>
      </div>
      {detail.isLoading ? (
        <PageState status="loading" />
      ) : notFound ? (
        <p className="import-empty">この取込履歴は見つかりません</p>
      ) : detail.isError || !run ? (
        <p className="notice warn" role="alert">
          詳細を読み込めませんでした。{describeError(detail.error)}
        </p>
      ) : (
        <>
          <dl className="import-detail-attrs">
            <div>
              <dt>取込日時</dt>
              <dd>{formatImportDateTimeLong(run.createdAt)}</dd>
            </div>
            <div>
              <dt>取込元</dt>
              <dd>{run.sources.length ? run.sources.map((s) => IMPORT_SOURCE_LABEL[s]).join('、') : '-'}</dd>
            </div>
            <div>
              <dt>対象期間</dt>
              <dd>{formatImportPeriod(run.periodFrom, run.periodTo)}</dd>
            </div>
            <div>
              <dt>ファイル数</dt>
              <dd>{run.fileCount}件</dd>
            </div>
            <div>
              <dt>取込明細数</dt>
              <dd>{run.rowCount.toLocaleString('ja-JP')}件</dd>
            </div>
            <div>
              <dt>結果</dt>
              <dd>
                <span className={`pill ${RESULT_TONE[run.result]}`}>
                  <span aria-hidden="true">{RESULT_ICON[run.result]}</span>{' '}
                  {importRunResultText(run.result, run.detail.succeeded, run.detail.failed)}
                </span>
              </dd>
            </div>
          </dl>
          <h3>この取込による影響</h3>
          <dl className="import-detail-impact">
            <div>
              <dt>新規追加</dt>
              <dd>{run.impact ? `${run.impact.added.toLocaleString('ja-JP')}件` : '-'}</dd>
            </div>
            <div>
              <dt>重複スキップ</dt>
              <dd>{run.impact ? `${run.impact.skipped.toLocaleString('ja-JP')}件` : '-'}</dd>
            </div>
            <div>
              <dt>サブスク候補</dt>
              <dd>{run.impact ? `${run.impact.subsCandidates}件` : '-'}</dd>
            </div>
          </dl>
          {run.files.length > 0 && (
            <ul className="import-detail-files">
              {run.files.map((file) => (
                <li key={file.importId} aria-label={`${file.filename ?? 'ファイル名不明'}の取込履歴`}>
                  <span className="import-filename">{file.filename ?? `#${file.importId}`}</span>
                  <FileStatePills file={file} />
                  <small>
                    {file.source ? IMPORT_SOURCE_SHORT[file.source] : '-'} ・{' '}
                    {file.rowCount.toLocaleString('ja-JP')}件{file.reason ? ` ・ ${file.reason}` : ''}
                  </small>
                  {/* 操作はサーバが許すときだけ出す。押せないボタンを並べても理由は伝わらない */}
                  <span className="import-detail-file-actions">
                    {file.cancelable && <ImportUndoButton importId={file.importId} />}
                    {file.discardable && <ImportDiscardButton importId={file.importId} />}
                    {/* 削除済みなのに片づけられない理由は1つ。取り消しの控えがまだ生きている */}
                    {file.generationState === 'deleted' && !file.discardable && (
                      <span className="sub" title="削除を取り消せる間は、この履歴を残します">
                        取り消し可能
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ImportDiscardBulkButton
            importIds={run.files
              .filter((file) => file.generationState === 'deleted' && file.discardable)
              .map((file) => file.importId)}
          />
          <Button disabled={!run.hasOriginal || downloading} onClick={onDownload}>
            この取込のファイルをダウンロード
          </Button>
        </>
      )}
    </aside>
  );
}

/**
 * 取込 1 ファイルの状態。旧画面の履歴と同じ語で出す。
 * データを消したファイルは「取込完了」と重ねない。消したのに完了と出るのが誤解の元。
 */
function FileStatePills({ file }: { file: ImportRunDetailFile }) {
  if (file.status === 'committed' || file.status === 'ok') {
    if (file.generationState === 'deleted') return <span className="pill neutral">データ削除済み</span>;
    return (
      <span>
        <span className="pill calm">{file.status === 'ok' ? '完了（旧履歴）' : '取込完了'}</span>
        {file.generationState === 'active' && <span className="pill calm">現在有効</span>}
        {file.generationState === 'partial' && <span className="pill warn">一部が有効</span>}
        {file.generationState === 'superseded' && <span className="pill neutral">更新済み</span>}
      </span>
    );
  }
  if (file.status === 'duplicate') return <span className="pill warn">取込済み</span>;
  if (file.status === 'processing') return <span className="pill warn">解析中</span>;
  if (file.status === 'applying') return <span className="pill warn">反映中</span>;
  return <span className="pill alert">失敗</span>;
}
