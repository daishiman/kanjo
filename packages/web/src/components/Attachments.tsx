/**
 * 証憑(レシート・領収書)の添付パネル。現金の記帳と取込明細の両方から同じ形で使う。
 * 追加の経路は4つ: カメラ撮影(スマホ)・ファイル選択(PC)・ドラッグ&ドロップ・クリップボード貼り付け。
 * 添付は集計に関与しないため、画面側でも他ページのキャッシュは触らず対象の一覧だけを読み直す。
 */

import {
  ATTACHMENT_MAX_PER_TARGET,
  ATTACHMENT_TYPES,
  type ReceiptStatus,
  attachmentRejectReason,
  formatAttachmentSize,
} from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  type Attachment,
  type AttachmentArchiveInventory,
  type AttachmentArchiveReconcileResponse,
  type AttachmentArchiveRecoverResponse,
  type AttachmentArchiveReport,
  type AttachmentCleanupStage,
  type AttachmentOrphansResponse,
  type AttachmentsResponse,
  api,
  apiUpload,
} from '../api.js';

/** input[accept] は MIME をそのまま並べる(HEIC は拡張子も添えないと iOS 以外で弾かれる) */
const ACCEPT = `${Object.keys(ATTACHMENT_TYPES).join(',')},.heic,.heif`;

const attachmentsKey = (targetId: string) => ['attachments', targetId] as const;
const orphanedAttachmentsKey = ['attachments', 'orphans'] as const;

const formatQuotaSize = (bytes: number): string => formatAttachmentSize(bytes).replace(/(KB|MB|B)$/, ' $1');

/** wireが応答時HEADでtrueを明言した原本だけを開く。欠落や内部stateから可用性を推測しない。 */
const originalAvailable = (attachment: Attachment): boolean => attachment.originalAvailable === true;

const cleanupStage = (attachment: Attachment): AttachmentCleanupStage =>
  attachment.cleanupStage ??
  (attachment.state === 'delete_pending'
    ? 'object_delete_pending'
    : attachment.state === 'delete_failed'
      ? 'object_delete_failed'
      : 'none');

const committedUploadAvailabilityError = (error: unknown): error is ApiError => {
  if (!(error instanceof ApiError) || error.status !== 503 || !error.body || typeof error.body !== 'object')
    return false;
  const detail = (error.body as { error?: { committed?: unknown; retryable?: unknown } }).error;
  return detail?.committed === true && detail.retryable === false;
};

function cleanupPresentation(attachment: Attachment): {
  badge: string | null;
  badgeClass: 'neutral' | 'warn';
  action: string;
  retry: boolean;
} {
  const stage = cleanupStage(attachment);
  if (stage === 'object_delete_pending')
    return {
      badge: '原本を削除中・再開可',
      badgeClass: 'neutral',
      action: '原本削除を再開する',
      retry: true,
    };
  if (stage === 'object_delete_failed')
    return { badge: '原本の削除に失敗', badgeClass: 'warn', action: '原本削除を再開する', retry: true };
  if (stage === 'metadata_delete_pending')
    return {
      badge: '原本削除済み・記録を整理中',
      badgeClass: 'neutral',
      action: '記録整理を再開する',
      retry: true,
    };
  if (stage === 'dead_letter')
    return {
      badge: '自動整理を停止・手動確認が必要',
      badgeClass: 'warn',
      action: '手動で再試行する',
      retry: true,
    };
  if (stage === 'original_missing')
    return {
      badge: '原本が保管先に見つかりません',
      badgeClass: 'warn',
      action: '管理情報を削除する',
      retry: false,
    };
  return { badge: null, badgeClass: 'neutral', action: '削除する', retry: false };
}

function AttachmentList({
  attachments,
  busy,
  onDelete,
}: {
  attachments: Attachment[];
  busy: boolean;
  onDelete: (id: number) => void;
}) {
  const [copyNotice, setCopyNotice] = useState<{ id: number; ok: boolean } | null>(null);

  const copyOriginalLink = async (attachment: Attachment) => {
    const path = `/api/attachments/${attachment.id}/content`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopyNotice({ id: attachment.id, ok: true });
    } catch {
      setCopyNotice({ id: attachment.id, ok: false });
    }
  };

  return (
    <ul className="attach-list">
      {attachments.map((attachment) => {
        const presentation = cleanupPresentation(attachment);
        const canRetry = presentation.retry && attachment.retryable;
        const canOpen = originalAvailable(attachment);
        return (
          <li key={attachment.id}>
            {canOpen ? (
              <>
                <a href={`/api/attachments/${attachment.id}/content`} target="_blank" rel="noreferrer">
                  {attachment.filename}
                </a>
                <button
                  type="button"
                  className="mini"
                  aria-label={`${attachment.filename}のリンクをコピー`}
                  disabled={busy}
                  onClick={() => void copyOriginalLink(attachment)}
                >
                  リンクをコピー
                </button>
              </>
            ) : (
              <span className="attachment-filename">{attachment.filename}</span>
            )}
            <span className="sub">{formatAttachmentSize(attachment.size)}</span>
            {attachment.orphaned && <span className="pill warn">親明細なし</span>}
            {presentation.badge && (
              <span className={`pill ${presentation.badgeClass}`}>{presentation.badge}</span>
            )}
            <button
              type="button"
              className="mini"
              disabled={busy || (presentation.retry && !canRetry)}
              onClick={() => {
                if (presentation.retry || window.confirm(`「${attachment.filename}」を削除しますか?`))
                  onDelete(attachment.id);
              }}
            >
              {presentation.action}
            </button>
            {copyNotice?.id === attachment.id && (
              <span className="sub" role={copyNotice.ok ? 'status' : 'alert'}>
                {copyNotice.ok ? 'リンクをコピーしました' : 'リンクをコピーできませんでした'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type PasteReceiver = (files: File[]) => void;

export interface AttachmentDisclosure {
  openTargetId: string | null;
  isOpen: (targetId: string) => boolean;
  toggle: (targetId: string) => void;
  registerPasteReceiver: (receiver: PasteReceiver | null) => void;
}

export const nextAttachmentTarget = (current: string | null, requested: string): string | null =>
  current === requested ? null : requested;

/**
 * 画面内で開ける添付パネルを1件に限定し、ページ全体のpaste listenerもここで1つだけ所有する。
 * パネル自身は現在開いている対象のreceiverを登録するだけなので、複数行が同じ貼り付けを奪い合わない。
 */
export function useAttachmentDisclosure(): AttachmentDisclosure {
  const [openTargetId, setOpenTargetId] = useState<string | null>(null);
  const pasteReceiver = useRef<PasteReceiver | null>(null);

  const registerPasteReceiver = useCallback((receiver: PasteReceiver | null) => {
    pasteReceiver.current = receiver;
  }, []);

  useEffect(() => {
    const onPaste = (event: globalThis.ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length || !pasteReceiver.current) return;
      event.preventDefault();
      pasteReceiver.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return {
    openTargetId,
    isOpen: (targetId) => openTargetId === targetId,
    toggle: (targetId) => setOpenTargetId((current) => nextAttachmentTarget(current, targetId)),
    registerPasteReceiver,
  };
}

export interface AttachmentUploadResult {
  succeeded: File[];
  failed: Array<{ filename: string; message: string }>;
}

/**
 * 上限・重複判定を壊さないよう1件ずつ送る一方、1件の失敗では後続を止めない。
 * 成功分だけ既存件数へ加算し、部分成功を呼び出し側が正直に表示できる形で返す。
 */
export async function uploadAttachmentFiles(
  files: File[],
  existingCount: number,
  send: (file: File) => Promise<unknown>,
  remainingBytes = Number.POSITIVE_INFINITY,
): Promise<AttachmentUploadResult> {
  const result: AttachmentUploadResult = { succeeded: [], failed: [] };
  let count = existingCount;
  let remaining = remainingBytes;

  for (const file of files) {
    const reject = attachmentRejectReason({
      contentType: file.type,
      filename: file.name,
      size: file.size,
      existingCount: count,
    });
    if (reject) {
      result.failed.push({ filename: file.name, message: reject.message });
      continue;
    }
    if (file.size > remaining) {
      result.failed.push({
        filename: file.name,
        message: '保存容量の上限を超えます。不要な証憑を削除してからもう一度お試しください',
      });
      continue;
    }
    try {
      await send(file);
      result.succeeded.push(file);
      count += 1;
      remaining -= file.size;
    } catch (error) {
      result.failed.push({
        filename: file.name,
        message: error instanceof Error ? error.message : '添付できませんでした',
      });
    }
  }

  return result;
}

/** 一覧の「証憑」列に出す状態バッジ。件数だけで判断できるので一覧APIの attachmentCount で足りる */
export function ReceiptBadge({
  status,
  count,
  severity = 'warn',
}: {
  status: ReceiptStatus;
  count: number;
  /** 未添付の出し方。'quiet' は警告色をやめて薄く出す(missingReceiptSeverity が決める) */
  severity?: 'warn' | 'quiet';
}) {
  if (status === 'attached')
    return (
      <span className="pill calm" title={`${count}件の証憑を添付済み`}>
        添付あり {count}
      </span>
    );
  if (status === 'waived')
    return (
      <span className="pill neutral" title="電車代など領収書が出ない支出">
        証憑不要
      </span>
    );
  return <span className={`pill ${severity === 'warn' ? 'warn' : 'neutral'}`}>未添付</span>;
}

/** Cash / Classify で共通の「状態badge + 開閉」。ページ側は対象IDだけを渡す。 */
export function AttachmentDisclosureCell({
  targetId,
  count,
  status,
  severity,
  disclosure,
  buttonClassName = '',
  disabledReason,
}: {
  targetId: string;
  count: number;
  status?: ReceiptStatus;
  severity?: 'warn' | 'quiet';
  disclosure: AttachmentDisclosure;
  buttonClassName?: string;
  /** 安定IDがない等、この明細へ新規添付できない理由 */
  disabledReason?: string;
}) {
  const open = disclosure.isOpen(targetId);
  const visibleStatus = status ?? (count > 0 ? 'attached' : 'missing');
  return (
    <>
      <ReceiptBadge status={visibleStatus} count={count} severity={severity} />{' '}
      <button
        type="button"
        className={`mini attachment-toggle ${buttonClassName}`.trim()}
        aria-expanded={open}
        disabled={!!disabledReason}
        title={disabledReason}
        onClick={() => disclosure.toggle(targetId)}
      >
        {disabledReason
          ? 'IDなし・添付不可'
          : open
            ? '証憑を閉じる'
            : count > 0
              ? '証憑を管理'
              : '証憑を追加'}
      </button>
    </>
  );
}

/** tableの直下に開くpanel rowも共通化し、colSpanと再同期先だけを差し替える。 */
export function AttachmentDisclosureRow({
  targetId,
  colSpan,
  disclosure,
  onChanged,
  rowClassName = 'editor',
}: {
  targetId: string;
  colSpan: number;
  disclosure: AttachmentDisclosure;
  onChanged?: () => void;
  rowClassName?: string;
}) {
  if (!disclosure.isOpen(targetId)) return null;
  return (
    <tr className={rowClassName}>
      <td colSpan={colSpan}>
        <AttachmentPanel
          targetId={targetId}
          onChanged={onChanged}
          registerPasteReceiver={disclosure.registerPasteReceiver}
        />
      </td>
    </tr>
  );
}

export function AttachmentPanel({
  targetId,
  onChanged,
  registerPasteReceiver,
}: {
  targetId: string;
  /** 件数バッジを持つ一覧側の再取得。添付は集計に響かないので呼び出し側の範囲だけを更新する */
  onChanged?: () => void;
  registerPasteReceiver?: (receiver: PasteReceiver | null) => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<AttachmentUploadResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: attachmentsKey(targetId),
    queryFn: () => api<AttachmentsResponse>(`/attachments?target=${encodeURIComponent(targetId)}`),
  });
  const list = q.data?.attachments ?? [];
  const usage = q.data?.usage;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: attachmentsKey(targetId) });
    onChanged?.();
  };

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      uploadAttachmentFiles(
        files,
        list.length,
        async (file) => {
          const form = new FormData();
          form.append('target', targetId);
          form.append('file', file);
          try {
            await apiUpload('/attachments', form);
          } catch (uploadError) {
            // D1/R2 commit後のHEAD障害は再送するとduplicateになる。保存済みとして数え、警告と再取得へ誘導する。
            if (!committedUploadAvailabilityError(uploadError)) throw uploadError;
            setError(uploadError.message);
          }
        },
        usage?.remainingBytes,
      ),
    onMutate: () => {
      setError(null);
      setUploadResult(null);
    },
    onSuccess: setUploadResult,
    onError: (e: Error) => setError(e.message),
    onSettled: refresh,
  });

  const del = useMutation({
    mutationFn: (id: number) => api(`/attachments/${id}`, { method: 'DELETE' }),
    onMutate: () => setError(null),
    onSuccess: () => setError(null),
    onError: (e: Error) => setError(e.message),
    onSettled: refresh,
  });

  /** 送る前に同じ規則(core)で弾く。通信してから断られるより速く、理由も同じ文言になる */
  const accept = (files: File[]) => {
    if (!files.length) return;
    upload.mutate(files);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    accept([...e.dataTransfer.files]);
  };

  // 開いている1panelの受付関数だけを、ページ側の単一paste listenerへ渡す。
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  useEffect(() => {
    if (!registerPasteReceiver) return;
    const receive: PasteReceiver = (files) => acceptRef.current(files);
    registerPasteReceiver(receive);
    return () => registerPasteReceiver(null);
  }, [registerPasteReceiver]);

  const full = list.length >= ATTACHMENT_MAX_PER_TARGET;
  const quotaExhausted = usage !== undefined && usage.remainingBytes <= 0;
  const busy = q.isLoading || q.isError || upload.isPending || del.isPending;

  return (
    <section
      className={`attach${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-label="証憑の添付"
    >
      <div className="attach-actions">
        <button
          type="button"
          className="mini"
          disabled={full || quotaExhausted || busy}
          onClick={() => cameraRef.current?.click()}
        >
          撮影する
        </button>
        <button
          type="button"
          className="mini"
          disabled={full || quotaExhausted || busy}
          onClick={() => pickRef.current?.click()}
        >
          ファイルを選ぶ
        </button>
        <span className="sub attach-hint">
          {full
            ? `1件につき${ATTACHMENT_MAX_PER_TARGET}枚までです`
            : 'ここにドラッグ&ドロップ、または Ctrl+V(Mac は ⌘V)で貼り付けできます'}
        </span>
        <input
          ref={cameraRef}
          type="file"
          aria-label="カメラで証憑を撮影する"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            accept([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <input
          ref={pickRef}
          type="file"
          aria-label="証憑ファイルを選ぶ"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            accept([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>

      {usage && (
        <p className="sub attachment-usage" aria-label="証憑の保存容量">
          利用量 {formatQuotaSize(usage.usedBytes)} / {formatQuotaSize(usage.limitBytes)}
        </p>
      )}
      {quotaExhausted && (
        <div className="notice" role="alert">
          保存容量の上限に達しました。不要な証憑を削除してから追加してください。
        </div>
      )}

      {upload.isPending && <p className="sub">アップロード中…</p>}
      {uploadResult && uploadResult.failed.length === 0 && uploadResult.succeeded.length > 0 && (
        <output className="notice info">{uploadResult.succeeded.length}件を添付しました。</output>
      )}
      {uploadResult && uploadResult.failed.length > 0 && (
        <div className="notice" role="alert">
          <p>
            {uploadResult.succeeded.length}件を添付し、{uploadResult.failed.length}件は添付できませんでした。
          </p>
          <ul>
            {uploadResult.failed.map((failure, index) => (
              <li key={`${index}:${failure.filename}:${failure.message}`}>
                {failure.filename}: {failure.message}
              </li>
            ))}
          </ul>
          <p className="sub">失敗したファイルを確認し、もう一度選んでください。</p>
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {q.isError && (
        <div className="notice" role="alert">
          添付を読み込めませんでした: {(q.error as Error).message}{' '}
          <button type="button" className="mini" onClick={() => void q.refetch()}>
            再読み込み
          </button>
        </div>
      )}

      {list.length > 0 && <AttachmentList attachments={list} busy={busy} onDelete={(id) => del.mutate(id)} />}
      {!q.isLoading && !q.isError && !list.length && <p className="sub">まだ証憑は添付されていません。</p>}
    </section>
  );
}

/** MFの洗い替えで親明細が消えた場合も、証憑を行き止まりにしない回復用一覧。 */
export function OrphanedAttachmentRecovery() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: orphanedAttachmentsKey,
    queryFn: () => api<AttachmentOrphansResponse>('/attachments/orphans'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/attachments/${id}`, { method: 'DELETE' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: orphanedAttachmentsKey }),
  });

  if (q.isLoading) return null;
  if (q.isError)
    return (
      <section className="card attachment-recovery" aria-label="親明細が見つからない証憑">
        <div className="notice" role="alert">
          親明細が見つからない証憑を読み込めませんでした: {(q.error as Error).message}
        </div>
      </section>
    );
  const attachments = q.data?.attachments ?? [];
  if (!attachments.length) return null;

  return (
    <section className="card attachment-recovery" aria-label="親明細が見つからない証憑">
      <h2>親明細が見つからない証憑</h2>
      <p className="sub">親明細が見つからない証憑が{attachments.length}件あります。</p>
      <p className="sub">再取込で親明細が戻るまで原本を保持します。不要な場合だけ削除してください。</p>
      <AttachmentList attachments={attachments} busy={del.isPending} onDelete={(id) => del.mutate(id)} />
      {del.isError && (
        <div className="notice" role="alert">
          証憑を削除できませんでした: {(del.error as Error).message}
        </div>
      )}
    </section>
  );
}

const isArchiveInventory = (value: unknown): value is AttachmentArchiveInventory => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AttachmentArchiveInventory>;
  return (
    candidate.version === 1 &&
    candidate.basis === 'inventory-only' &&
    candidate.restoreCapable === false &&
    candidate.metadataRecoveryCapable === true &&
    typeof candidate.recoveryEndpoint === 'string' &&
    Array.isArray(candidate.records)
  );
};

async function archiveInventoryFromFile(file: File): Promise<AttachmentArchiveInventory> {
  const parsed = JSON.parse(await file.text()) as { attachmentArchive?: unknown };
  if (!isArchiveInventory(parsed.attachmentArchive))
    throw new Error('証憑アーカイブ情報を含む書き出しJSONを選んでください');
  return parsed.attachmentArchive;
}

const ARCHIVE_REQUEST_RECORD_LIMIT = 10;

const emptyArchiveReport = (): AttachmentArchiveReport => ({
  matched: 0,
  metadataMissing: 0,
  targetMissing: 0,
  missing: 0,
  mismatch: 0,
  skipped: 0,
  records: [],
});

const mergeArchiveReports = (
  left: AttachmentArchiveReport,
  right: AttachmentArchiveReport,
): AttachmentArchiveReport => ({
  matched: left.matched + right.matched,
  metadataMissing: left.metadataMissing + right.metadataMissing,
  targetMissing: left.targetMissing + right.targetMissing,
  missing: left.missing + right.missing,
  mismatch: left.mismatch + right.mismatch,
  skipped: left.skipped + (right.skipped ?? 0),
  records: [...left.records, ...right.records],
});

const archiveInventoryChunks = (inventory: AttachmentArchiveInventory): AttachmentArchiveInventory[] => {
  const chunks: AttachmentArchiveInventory[] = [];
  for (let offset = 0; offset < inventory.records.length; offset += ARCHIVE_REQUEST_RECORD_LIMIT)
    chunks.push({
      ...inventory,
      records: inventory.records.slice(offset, offset + ARCHIVE_REQUEST_RECORD_LIMIT),
    });
  return chunks;
};

async function reconcileArchive(
  attachmentArchive: AttachmentArchiveInventory,
): Promise<AttachmentArchiveReconcileResponse> {
  let report = emptyArchiveReport();
  for (const chunk of archiveInventoryChunks(attachmentArchive)) {
    const response = await api<AttachmentArchiveReconcileResponse>('/attachments/archive/reconcile', {
      method: 'POST',
      body: JSON.stringify({ attachmentArchive: chunk }),
    });
    report = mergeArchiveReports(report, response.report);
  }
  return { ok: true, report };
}

function ArchiveReport({ report }: { report: AttachmentArchiveReconcileResponse['report'] }) {
  const skipped = report.skipped ?? 0;
  const excluded = report.targetMissing + report.missing + report.mismatch + skipped;
  return (
    <div className="attachment-archive-report" aria-live="polite">
      <p className="sub">
        一致 {report.matched}件 / 管理情報の欠損 {report.metadataMissing}件 / 原本の欠損 {report.missing}件 /
        不一致 {report.mismatch}件 / 対象外 {skipped}件
      </p>
      {report.targetMissing > 0 && <p className="sub">親明細の欠損 {report.targetMissing}件</p>}
      {excluded > 0 && (
        <div className="notice" role="alert">
          原本の欠損・不一致・対象外は復旧せず、成功件数に含めません。原本が残る一致分だけ復旧できます。
        </div>
      )}
    </div>
  );
}

const isArchiveRecoverResponse = (value: unknown): value is AttachmentArchiveRecoverResponse => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AttachmentArchiveRecoverResponse>;
  return (
    typeof candidate.recovered === 'number' &&
    typeof candidate.alreadyPresent === 'number' &&
    typeof candidate.skipped === 'number' &&
    !!candidate.report &&
    typeof candidate.report.missing === 'number' &&
    typeof candidate.report.mismatch === 'number'
  );
};

async function recoverArchive(
  attachmentArchive: AttachmentArchiveInventory,
): Promise<AttachmentArchiveRecoverResponse> {
  let result: AttachmentArchiveRecoverResponse = {
    ok: true,
    recovered: 0,
    alreadyPresent: 0,
    skipped: 0,
    report: emptyArchiveReport(),
  };
  for (const chunk of archiveInventoryChunks(attachmentArchive)) {
    let chunkResult: AttachmentArchiveRecoverResponse;
    try {
      chunkResult = await api<AttachmentArchiveRecoverResponse>('/attachments/archive/recover', {
        method: 'POST',
        body: JSON.stringify({ attachmentArchive: chunk, confirm: true }),
      });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 409 && isArchiveRecoverResponse(error.body)))
        throw error;
      chunkResult = error.body;
    }
    result = {
      ok: result.ok && chunkResult.ok,
      recovered: result.recovered + chunkResult.recovered,
      alreadyPresent: result.alreadyPresent + chunkResult.alreadyPresent,
      skipped: result.skipped + chunkResult.skipped,
      report: mergeArchiveReports(result.report, chunkResult.report),
    };
  }
  return result;
}

function ArchiveRecoveryOutcome({ result }: { result: AttachmentArchiveRecoverResponse }) {
  const complete =
    result.report.targetMissing === 0 && result.report.missing === 0 && result.report.mismatch === 0;
  const lead = complete
    ? `管理情報を${result.recovered}件復旧しました。`
    : `管理情報を${result.recovered}件復旧しましたが、復旧できなかった記録があります。`;
  const message = `${lead}取り込み済み ${result.alreadyPresent}件 / 原本の欠損 ${result.report.missing}件 / 内容の不一致 ${result.report.mismatch}件 / 対象外 ${result.skipped}件。問題のある記録は成功件数に含めていません。原本ファイルを復元した操作ではありません。`;
  return (
    <output className={`notice ${complete ? 'info' : ''}`} role={complete ? 'status' : 'alert'}>
      {message}
    </output>
  );
}

/**
 * エクスポートJSONの在庫と現在のD1/R2を照合し、原本が同じR2に残るmetadataだけを復旧する。
 * 原本のバックアップ/復元とは表示しない。
 */
export function AttachmentArchiveRecovery() {
  const qc = useQueryClient();
  const [inventory, setInventory] = useState<AttachmentArchiveInventory | null>(null);
  const reconcile = useMutation({
    mutationFn: async (file: File) => {
      const attachmentArchive = await archiveInventoryFromFile(file);
      const response = await reconcileArchive(attachmentArchive);
      return { attachmentArchive, response };
    },
    onSuccess: ({ attachmentArchive }) => setInventory(attachmentArchive),
  });
  const recover = useMutation({
    mutationFn: recoverArchive,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: orphanedAttachmentsKey });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['cash-entries'] });
    },
  });
  const report = reconcile.data?.response.report;
  const canRecover = !!inventory && !!report && report.metadataMissing > 0;

  return (
    <section className="attachment-archive-recovery" aria-label="証憑の照合と管理情報の復旧">
      <h3>証憑の照合 / 管理情報の復旧</h3>
      <p className="sub">
        書き出しJSONと同じ保管場所を照合します。この操作は原本ファイルのバックアップや復元ではありません。
      </p>
      <label className="attachment-archive-file">
        <span>証憑アーカイブJSONを選ぶ</span>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="証憑アーカイブJSONを選ぶ"
          disabled={reconcile.isPending || recover.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              setInventory(null);
              recover.reset();
              reconcile.mutate(file);
            }
            event.target.value = '';
          }}
        />
      </label>
      {reconcile.isPending && <p className="sub">証憑の原本と管理情報を照合中…</p>}
      {reconcile.isError && (
        <div className="notice" role="alert">
          照合できませんでした: {(reconcile.error as Error).message}
        </div>
      )}
      {report && <ArchiveReport report={report} />}
      {canRecover && (
        <button
          type="button"
          className="mini"
          disabled={recover.isPending}
          onClick={() => {
            if (
              inventory &&
              window.confirm(
                '同じ保管場所に原本が残っている証憑の管理情報だけを復元します。原本ファイルの復元ではありません。続けますか?',
              )
            )
              recover.mutate(inventory);
          }}
        >
          {recover.isPending ? '管理情報を復旧中…' : '証憑の管理情報を復旧する'}
        </button>
      )}
      {report && !canRecover && report.metadataMissing === 0 && (
        <p className="sub">復旧が必要な管理情報はありません。</p>
      )}
      {recover.data && <ArchiveRecoveryOutcome result={recover.data} />}
      {recover.isError && (
        <div className="notice" role="alert">
          処理を完了できませんでした。先行するまとまりで管理情報が復旧済みの可能性があります。再度照合してください:{' '}
          {(recover.error as Error).message}
        </div>
      )}
    </section>
  );
}
