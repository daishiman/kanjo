/**
 * バックアップの節 (spec-settings-screen §7.10)。
 *
 * 夜間の自動バックアップ (R2・30日保持) の一覧から、設定だけを比較・復元する。
 * 取引は戻さない。復元は差分プレビュー → 確認 → 復元の順で、データの節の復元と同じ確認を使う。
 * 失敗した回は中身が無いので、比較・復元の口を止める。
 */
import type { SettingsDiff } from '@kanjo/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type BackupCompareResponse,
  type BackupItem,
  type SettingsPreviewResponse,
  type SettingsRestoreResponse,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { usePendingConfirm } from '../../components/ConfirmDialog.js';
import { DataTable } from '../../components/DataTable.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { RestorePreviewDialog } from './RestorePreviewDialog.js';
import {
  BACKUPS_TEXT,
  DATA_TEXT,
  SAME_CONTENT,
  backupBadge,
  backupDateLabel,
  backupMemo,
  backupSizeLabel,
  diffLines,
  restoreErrorMessage,
} from './view-model.js';

export const BACKUPS_QUERY_KEY = ['backups'] as const;

const BADGE_CLASS = {
  最新: 'settings-badge is-latest',
  成功: 'settings-badge is-ok',
  失敗: 'settings-badge is-failed',
};

interface Preview {
  date: string;
  diff: SettingsDiff;
  revision: string | null;
}

export function BackupsSection({ hasDraft, onRestored }: { hasDraft: boolean; onRestored: () => void }) {
  const list = useQuery({
    queryKey: BACKUPS_QUERY_KEY,
    queryFn: () => api<{ backups: BackupItem[] }>('/backups'),
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState(false);

  const compare = usePendingConfirm<string>();
  const load = useMutation({
    mutationFn: (date: string) =>
      api<SettingsPreviewResponse>(`/backups/${encodeURIComponent(date)}/restore/preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  });
  const restore = useMutation({
    mutationFn: (target: Preview) =>
      api<SettingsRestoreResponse>(`/backups/${encodeURIComponent(target.date)}/restore`, {
        method: 'POST',
        body: JSON.stringify({ baseSavedAt: target.revision }),
      }),
  });
  const dialog = useConfirmDialog({ busy: restore.isPending });

  const openRestore = (date: string, trigger: HTMLButtonElement) => {
    setDone(false);
    restore.reset();
    load.mutate(date, {
      onSuccess: (result) => {
        setPreview({ date, diff: result.diff, revision: result.revision });
        dialog.triggerRef.current = trigger;
        dialog.setOpen(true);
      },
    });
  };
  const dismissRestore = () => {
    if (restore.isPending) return;
    dialog.close();
    setPreview(null);
  };

  const backups = list.data?.backups ?? [];

  return (
    <section className="card settings-section" id="backups" aria-labelledby="backups-heading">
      <h2 id="backups-heading">{BACKUPS_TEXT.heading}</h2>
      <p className="sub">{BACKUPS_TEXT.lead}</p>
      <div className="settings-backups-layout">
        <div className="settings-backups-main">
          {list.isError && (
            <p className="settings-field-error" role="alert">
              {BACKUPS_TEXT.loadFailed}
            </p>
          )}
          {list.isSuccess && backups.length === 0 && <p className="sub">{BACKUPS_TEXT.empty}</p>}
          {backups.length > 0 && (
            <DataTable
              className="data stack-sm settings-backups-table"
              caption={<caption className="visually-hidden">{BACKUPS_TEXT.heading}</caption>}
              columns={BACKUPS_TEXT.columns.map((label) => ({ label, sortable: false }))}
            >
              {backups.map((b) => {
                const failed = b.status === 'failed';
                const badge = backupBadge(b);
                const [dateCol, sizeCol, statusCol, memoCol, actionCol] = BACKUPS_TEXT.columns;
                return (
                  <tr key={b.date}>
                    <td data-label={dateCol}>{backupDateLabel(b)}</td>
                    <td className="num" data-label={sizeCol}>
                      {backupSizeLabel(b.size)}
                    </td>
                    <td data-label={statusCol}>
                      <span className={BADGE_CLASS[badge]}>{badge}</span>
                    </td>
                    <td data-label={memoCol}>{backupMemo(b)}</td>
                    <td data-label={actionCol}>
                      <span className="settings-row-actions">
                        <Button
                          size="mini"
                          disabled={failed}
                          aria-label={`${backupDateLabel(b)}の${BACKUPS_TEXT.compare}`}
                          onClick={(e) => {
                            compare.dialog.triggerRef.current = e.currentTarget;
                            compare.ask(b.date);
                          }}
                        >
                          {BACKUPS_TEXT.compare}
                        </Button>
                        <Button
                          size="mini"
                          disabled={failed || load.isPending || restore.isPending}
                          aria-label={`${backupDateLabel(b)}の${BACKUPS_TEXT.restore}`}
                          onClick={(e) => openRestore(b.date, e.currentTarget)}
                        >
                          {BACKUPS_TEXT.restore}
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          {load.isError && (
            <p className="settings-field-error" role="alert">
              {restoreErrorMessage(load.error)}
            </p>
          )}
          {done && <output className="notice">{DATA_TEXT.restored}</output>}
        </div>
        <aside className="settings-info settings-backups-about" aria-labelledby="backups-about-heading">
          <h3 id="backups-about-heading">{BACKUPS_TEXT.aboutHeading}</h3>
          <p>{BACKUPS_TEXT.about}</p>
        </aside>
      </div>

      {compare.target && (
        <CompareDialog date={compare.target} dialog={compare.dialog} onClose={compare.dismiss} />
      )}
      {dialog.open && preview && (
        <RestorePreviewDialog
          dialog={dialog}
          title={BACKUPS_TEXT.restoreTitle(preview.date)}
          diff={preview.diff}
          hasDraft={hasDraft}
          error={restore.isError ? restoreErrorMessage(restore.error) : null}
          onConfirm={() =>
            restore.mutate(preview, {
              onSuccess: () => {
                dialog.close();
                setPreview(null);
                setDone(true);
                onRestored();
              },
            })
          }
          onDismiss={dismissRestore}
        />
      )}
    </section>
  );
}

/** 比較は読むだけ。確定の口を持たず『閉じる』だけを置く */
function CompareDialog({
  date,
  dialog,
  onClose,
}: {
  date: string;
  dialog: ReturnType<typeof useConfirmDialog>;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ['backup-compare', date],
    queryFn: () => api<BackupCompareResponse>(`/backups/${encodeURIComponent(date)}/compare`),
    // 比較は開いた時点の現在の設定と比べる。前に開いたときの結果を使い回さない
    staleTime: 0,
    gcTime: 0,
  });
  return (
    <dialog
      ref={dialog.bind}
      className="deletion-confirm-dialog settings-compare-dialog"
      aria-labelledby={dialog.titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="confirm-dialog-body">
        <h3 ref={dialog.titleRef} id={dialog.titleId} tabIndex={-1}>
          {BACKUPS_TEXT.compareTitle(date)}
        </h3>
        {q.isPending && <p className="sub">読み込んでいます…</p>}
        {q.isError && (
          <p className="settings-field-error" role="alert">
            {restoreErrorMessage(q.error)}
          </p>
        )}
        {q.isSuccess &&
          (q.data.diff.total === 0 ? (
            <p>{SAME_CONTENT}</p>
          ) : (
            <ul className="settings-diff">
              {diffLines(q.data.diff).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ))}
        <div className="deletion-run-actions">
          <Button variant="secondary" onClick={onClose}>
            {BACKUPS_TEXT.close}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
