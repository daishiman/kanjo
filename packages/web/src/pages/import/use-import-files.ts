/**
 * 取込ファイル一覧の状態 (spec-import-screen「検査 → 確定」)。
 *
 * - 同時に選んだファイルは 1 つの multipart で送る。後からの追加は同じ検査 ID へ足す。
 * - 送る前に core の上限判定をかけ、超えたファイルは送らずに理由を行へ出す。
 * - 確定は `/imports/runs` を `remaining` が空になるまで呼び直す (1 要求 1 ファイル)。
 * - 確定時は検査 ID とファイル ID だけを送り、ファイル本体を再送しない。
 */
import { importLimitViolation } from '@kanjo/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { ApiError, api } from '../../api-client.js';
import {
  type ImportInspectionResponse,
  type ImportInspectionView,
  type ImportRunCommitResponse,
  type ImportRunImpact,
  uploadWithProgress,
} from '../../api.js';
import { describeError } from '../../components/Page.js';
import {
  type ImportItem,
  importCommitErrorText,
  importItemStatus,
  importUploadErrorText,
  newImportItem,
} from './view-model.js';

/** 確定 1 回の結果。4.取込結果 のカードと引き継ぎ (重複確認・サブスク) が読む */
export interface ImportCommitOutcome {
  runId: string | null;
  succeeded: number;
  failed: number;
  rows: number;
  errors: number;
  duplicateCandidates: number;
  subsCandidates: number;
  impact: ImportRunImpact | null;
  /** freee の取込が 1 件でも成功したか (サブスク引き継ぎの条件) */
  freeeImported: boolean;
  /** 取込全体が始まらなかった理由 (busy・予算超過など) */
  error: string | null;
}

export function useImportFiles() {
  const qc = useQueryClient();
  const [items, setItemsState] = useState<ImportItem[]>([]);
  const [inspectionId, setInspectionIdState] = useState<string | null>(null);
  const [subsCandidates, setSubsCandidates] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [outcome, setOutcome] = useState<ImportCommitOutcome | null>(null);

  // 非同期の送信は最新の値を読む必要があるので、state と ref を同時に更新する
  const itemsRef = useRef<ImportItem[]>([]);
  const inspectionRef = useRef<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const cancelledKeys = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sendRef = useRef<(keys: string[]) => void>(() => undefined);
  // 選び直し (reset) 以前に始まった送信の応答を捨てるための世代
  const generation = useRef(0);

  const setItems = useCallback((next: (current: ImportItem[]) => ImportItem[]) => {
    itemsRef.current = next(itemsRef.current);
    setItemsState(itemsRef.current);
  }, []);
  const patch = useCallback(
    (key: string, change: Partial<ImportItem>) =>
      setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item))),
    [setItems],
  );
  const setInspectionId = useCallback((id: string | null) => {
    inspectionRef.current = id;
    setInspectionIdState(id);
  }, []);

  /** 検査の応答を行へ反映する。新しく現れた ID を送信順の行へ割り当て、全行を ID で結び直す */
  const applyInspection = useCallback(
    (view: ImportInspectionView, sentKeys: readonly string[]) => {
      setInspectionId(view.id);
      setSubsCandidates(view.summary.subsCandidates);
      setItems((current) => {
        const known = new Set(current.map((item) => item.serverId).filter(Boolean));
        const fresh = view.files.filter((file) => !known.has(file.id));
        const assigned = new Map(sentKeys.map((key, index) => [key, fresh[index]?.id] as const));
        const sent = new Set(sentKeys);
        const byId = new Map(view.files.map((file) => [file.id, file] as const));
        return current.map((item) => {
          const serverId = assigned.get(item.key) ?? item.serverId;
          if (!serverId) return item;
          const inspection = byId.get(serverId) ?? null;
          return {
            ...item,
            serverId,
            inspection,
            // 検査に残らなかった行 (消した・期限切れ) は検査の結び付きを外す
            ...(inspection ? {} : { serverId: null }),
            ...(sent.has(item.key) ? { uploading: false, progress: 100, uploadError: null } : {}),
          };
        });
      });
    },
    [setInspectionId, setItems],
  );

  const send = useCallback(
    (keys: string[]) => {
      const gen = generation.current;
      queue.current = queue.current.then(async () => {
        if (gen !== generation.current) return;
        const keySet = new Set(keys);
        const sentItems = itemsRef.current.filter((item) => keySet.has(item.key) && !item.limitViolation);
        if (!sentItems.length) return;
        const sentKeys = sentItems.map((item) => item.key);
        const controller = new AbortController();
        for (const key of sentKeys) controllers.current.set(key, controller);
        setItems((current) =>
          current.map((item) =>
            keySet.has(item.key) ? { ...item, uploading: true, progress: 0, uploadError: null } : item,
          ),
        );
        const form = new FormData();
        for (const item of sentItems) form.append('file', item.file);
        const current = inspectionRef.current;
        try {
          const body = await uploadWithProgress<ImportInspectionResponse>(
            current ? `/imports/inspections/${current}/files` : '/imports/inspections',
            form,
            (percent) => {
              if (gen === generation.current) {
                setItems((items) =>
                  items.map((item) => (keySet.has(item.key) ? { ...item, progress: percent } : item)),
                );
              }
            },
            controller.signal,
          );
          if (gen !== generation.current) return;
          applyInspection(body.inspection, sentKeys);
        } catch (error) {
          if (gen !== generation.current) return;
          if (error instanceof DOMException && error.name === 'AbortError') {
            const cancelled = new Set(sentKeys.filter((key) => cancelledKeys.current.delete(key)));
            const remaining = sentKeys.filter((key) => !cancelled.has(key));
            setItems((list) =>
              list
                .filter((candidate) => !cancelled.has(candidate.key))
                .map((candidate) =>
                  remaining.includes(candidate.key)
                    ? { ...candidate, uploading: false, progress: 0, uploadError: null }
                    : candidate,
                ),
            );
            if (remaining.length) sendRef.current(remaining);
            return;
          }
          // 検査が期限切れになったら、次のファイルから新しい検査を作り直す
          if (current && error instanceof ApiError && error.status === 404) setInspectionId(null);
          setItems((items) =>
            items.map((item) =>
              keySet.has(item.key)
                ? { ...item, uploading: false, uploadError: importUploadErrorText(error) }
                : item,
            ),
          );
        } finally {
          for (const key of sentKeys) {
            if (controllers.current.get(key) === controller) controllers.current.delete(key);
          }
        }
      });
    },
    [applyInspection, setInspectionId, setItems],
  );
  sendRef.current = send;

  /** 送信を全部止めて一覧を空にする。検査 ID も捨てる (サーバー側は期限で消える) */
  const reset = useCallback(() => {
    generation.current += 1;
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    cancelledKeys.current.clear();
    queue.current = Promise.resolve();
    setItems(() => []);
    setInspectionId(null);
    setSubsCandidates(0);
  }, [setInspectionId, setItems]);

  const addFiles = useCallback(
    (files: File[]) => {
      // 取込済みの一覧に足すと、結果と新しい選択が混ざる。選び直しは新しい取込として始める
      if (itemsRef.current.some((item) => item.commit !== null)) {
        reset();
        setOutcome(null);
      }
      const accepted = itemsRef.current.filter((item) => !item.limitViolation);
      let prior = {
        count: accepted.length,
        totalBytes: accepted.reduce((sum, item) => sum + item.file.size, 0),
      };
      const added: ImportItem[] = [];
      for (const file of files) {
        const violation = importLimitViolation({ files: [{ name: file.name, size: file.size }], prior });
        const item = newImportItem(file, violation?.reason ?? null);
        added.push(item);
        if (!violation) prior = { count: prior.count + 1, totalBytes: prior.totalBytes + file.size };
      }
      setItems((current) => [...current, ...added]);
      const sendable = added.filter((item) => !item.limitViolation).map((item) => item.key);
      if (sendable.length) send(sendable);
    },
    [reset, send, setItems],
  );

  const removeFromServer = useCallback(
    async (serverId: string) => {
      const id = inspectionRef.current;
      if (!id) return;
      try {
        const body = await api<ImportInspectionResponse>(`/imports/inspections/${id}/files/${serverId}`, {
          method: 'DELETE',
        });
        applyInspection(body.inspection, []);
      } catch (error) {
        // 検査が既に無い (期限切れ) なら行を消すだけで足りる
        if (error instanceof ApiError && error.status === 404) setInspectionId(null);
      }
    },
    [applyInspection, setInspectionId],
  );

  const remove = useCallback(
    async (key: string) => {
      const item = itemsRef.current.find((candidate) => candidate.key === key);
      if (!item) return;
      controllers.current.get(key)?.abort();
      setItems((current) => current.filter((candidate) => candidate.key !== key));
      if (item.serverId) await removeFromServer(item.serverId);
    },
    [removeFromServer, setItems],
  );

  const retry = useCallback(
    async (key: string) => {
      const item = itemsRef.current.find((candidate) => candidate.key === key);
      if (!item) return;
      const others = itemsRef.current.filter(
        (candidate) => candidate.key !== key && !candidate.limitViolation,
      );
      const violation = importLimitViolation({
        files: [{ name: item.file.name, size: item.file.size }],
        prior: { count: others.length, totalBytes: others.reduce((sum, other) => sum + other.file.size, 0) },
      });
      if (item.serverId) await removeFromServer(item.serverId);
      patch(key, {
        serverId: null,
        inspection: null,
        progress: 0,
        uploadError: null,
        limitViolation: violation?.reason ?? null,
        commit: null,
        commitReason: null,
      });
      if (!violation) send([key]);
    },
    [patch, removeFromServer, send],
  );

  const cancel = useCallback((key: string) => {
    cancelledKeys.current.add(key);
    controllers.current.get(key)?.abort();
  }, []);

  const toggle = useCallback((key: string, checked: boolean) => patch(key, { checked }), [patch]);

  const toggleAll = useCallback(
    (checked: boolean, force: boolean) =>
      setItems((current) =>
        current.map((item) =>
          item.commit === null && importItemStatus(item, force).state === 'ready'
            ? { ...item, checked }
            : item,
        ),
      ),
    [setItems],
  );

  /** 「選択をキャンセル」。検査前なら選んだファイルごと外し、検査後は選択だけを外す */
  const clearSelection = useCallback(() => {
    if (!inspectionRef.current) {
      reset();
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, checked: false })));
  }, [reset, setItems]);

  /** 新 API で確定する。remaining が空になるまで同じ検査 ID で呼び直す */
  const commitRuns = async (
    keys: string[],
    keepPrevious: boolean,
    force: boolean,
  ): Promise<ImportCommitOutcome> => {
    const excluded = itemsRef.current
      .filter((item) => item.commit === null && item.checked && !keys.includes(item.key))
      .map((item) => ({ item, status: importItemStatus(item, force) }))
      .filter(({ status }) => status.state === 'blocked' || status.state === 'failed');
    const byServerId = new Map(
      itemsRef.current
        .filter((item) => keys.includes(item.key) && item.serverId)
        .map((item) => [item.serverId as string, item]),
    );
    let fileIds = [...byServerId.keys()];
    let runId: string | null = null;
    let impact: ImportRunImpact | null = null;
    let duplicateCandidates = 0;
    let error: string | null = null;
    let freeeImported = false;
    const done = new Set<string>();
    while (fileIds.length) {
      try {
        const body = await api<ImportRunCommitResponse>('/imports/runs', {
          method: 'POST',
          body: JSON.stringify({ inspectionId: inspectionRef.current, fileIds, keepPrevious, force }),
        });
        runId = runId ?? body.run.id;
        impact = body.run.impact;
        duplicateCandidates += body.run.duplicateCandidates;
        for (const file of body.run.files) {
          const item = byServerId.get(file.id);
          if (!item) continue;
          done.add(file.id);
          if (file.state === 'imported' && item.inspection?.source === 'freee') freeeImported = true;
          patch(item.key, {
            commit: file.state === 'imported' ? 'committed' : 'failed',
            committedRows: file.rowCount,
            commitReason: file.reason,
            checked: false,
          });
        }
        fileIds = body.remaining;
      } catch (caught) {
        error = importCommitErrorText(caught);
        break;
      }
    }
    // 途中で止まったとき、まだ確定していない行は選んだまま残し、押し直せるようにする
    if (fileIds.length === 0) {
      for (const { item, status } of excluded) {
        patch(item.key, {
          commit: 'failed',
          commitReason: status.reason ?? '取込対象から除外されました',
          checked: false,
        });
      }
      setInspectionId(null);
    }
    const settled = itemsRef.current.filter((item) => item.serverId && done.has(item.serverId));
    const succeeded = settled.filter((item) => item.commit === 'committed');
    const failed = settled.length - succeeded.length + (fileIds.length === 0 ? excluded.length : 0);
    return {
      runId,
      succeeded: succeeded.length,
      failed,
      rows: succeeded.reduce((sum, item) => sum + (item.committedRows ?? 0), 0),
      errors: failed,
      duplicateCandidates,
      subsCandidates: impact?.subsCandidates ?? 0,
      impact,
      freeeImported,
      error,
    };
  };

  const commit = async (input: {
    keys: string[];
    keepPrevious: boolean;
    force: boolean;
  }): Promise<ImportCommitOutcome> => {
    setCommitting(true);
    try {
      const result = await commitRuns(input.keys, input.keepPrevious, input.force);
      setOutcome(result);
      if (result.succeeded || result.failed) void qc.invalidateQueries(); // 全ページへ反映
      return result;
    } catch (caught) {
      const result = { ...emptyOutcome(), error: describeError(caught) };
      setOutcome(result);
      return result;
    } finally {
      setCommitting(false);
    }
  };

  /** 失敗したファイルだけを新しい取込として送り直す (「エラーのファイルのみ再試行」) */
  const retryFailed = useCallback(() => {
    const failed = itemsRef.current.filter((item) => item.commit === 'failed').map((item) => item.file);
    reset();
    setOutcome(null);
    if (failed.length) addFiles(failed);
  }, [addFiles, reset]);

  return {
    items,
    inspectionId,
    subsCandidates,
    committing,
    outcome,
    addFiles,
    remove,
    retry,
    cancel,
    toggle,
    toggleAll,
    clearSelection,
    commit,
    retryFailed,
    reset,
    clearOutcome: () => setOutcome(null),
  };
}

function emptyOutcome(): ImportCommitOutcome {
  return {
    runId: null,
    succeeded: 0,
    failed: 0,
    rows: 0,
    errors: 0,
    duplicateCandidates: 0,
    subsCandidates: 0,
    impact: null,
    freeeImported: false,
    error: null,
  };
}
