/**
 * データの節と復元 (spec-settings-screen §7.9)。
 *
 * 出力 4 種はリンクで、設定だけは期間を付けない。復元は設定ファイルを選び、
 * 差分プレビュー (POST /api/settings/restore/preview) → 確認 → 復元 (POST /api/settings/restore) の順に進む。
 * 復元は設定 4 種だけで、取引は変わらない。
 */
import type { SettingsDiff } from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { type SettingsPreviewResponse, type SettingsRestoreResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { readFileText } from '../../file-text.js';
import { usePeriod } from '../../period.js';
import { RestorePreviewDialog } from './RestorePreviewDialog.js';
import { DATA_TEXT, EXPORT_LINKS, SETTINGS_FILE_MAX_BYTES, restoreErrorMessage } from './view-model.js';

interface Preview {
  diff: SettingsDiff;
  revision: string | null;
  settings: unknown;
}

export function DataSection({ hasDraft, onRestored }: { hasDraft: boolean; onRestored: () => void }) {
  const { withPeriod } = usePeriod();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = useMutation({
    mutationFn: async (target: File): Promise<Preview> => {
      const text = await readFileText(target);
      const result = await api<SettingsPreviewResponse>('/settings/restore/preview', {
        method: 'POST',
        body: text,
      });
      // プレビューを通った本文は JSON として読める。復元の本文には読んだ値をそのまま載せる
      return { diff: result.diff, revision: result.revision, settings: JSON.parse(text) as unknown };
    },
  });
  const restore = useMutation({
    mutationFn: (target: Preview) =>
      api<SettingsRestoreResponse>('/settings/restore', {
        method: 'POST',
        body: JSON.stringify({ baseSavedAt: target.revision, settings: target.settings }),
      }),
  });
  const dialog = useConfirmDialog({ busy: restore.isPending });

  const choose = (next: File | undefined) => {
    setDone(false);
    load.reset();
    if (!next) return;
    if (next.size > SETTINGS_FILE_MAX_BYTES) {
      setFile(null);
      setFileError(DATA_TEXT.fileTooLarge);
      return;
    }
    setFileError(null);
    setFile(next);
  };

  const open = () => {
    if (!file) return;
    setDone(false);
    restore.reset();
    load.mutate(file, {
      onSuccess: (result) => {
        setPreview(result);
        dialog.triggerRef.current = triggerRef.current;
        dialog.setOpen(true);
      },
    });
  };

  const dismiss = () => {
    if (restore.isPending) return;
    dialog.close();
    setPreview(null);
  };

  return (
    <section className="card settings-section" id="data" aria-labelledby="data-heading">
      <h2 id="data-heading">{DATA_TEXT.heading}</h2>
      <p className="sub">{DATA_TEXT.lead}</p>
      <ul className="settings-exports">
        {EXPORT_LINKS.map((link) => (
          <li key={link.key}>
            <a
              className="btn settings-export"
              href={link.withPeriod ? withPeriod(link.path) : link.path}
              download
              data-settings-internal
            >
              <strong>{link.label}</strong>
              <span>{link.detail}</span>
            </a>
          </li>
        ))}
      </ul>

      <h3>{DATA_TEXT.restoreHeading}</h3>
      <p className="sub">{DATA_TEXT.restoreLead}</p>
      <div className="settings-restore">
        <span className="settings-file">
          <label className="btn">
            {DATA_TEXT.chooseFile}
            <input
              type="file"
              className="visually-hidden"
              accept=".json,application/json"
              onChange={(e) => {
                choose(e.target.files?.[0]);
                // 同じファイルを選び直しても change が起きるように値を捨てる。ファイルは state が持つ
                e.target.value = '';
              }}
            />
          </label>
          <span className="settings-file-name">{file?.name ?? DATA_TEXT.noFile}</span>
        </span>
        <Button ref={triggerRef} variant="primary" disabled={!file || load.isPending} onClick={open}>
          {DATA_TEXT.restoreButton}
        </Button>
      </div>
      <ul className="settings-info">
        {DATA_TEXT.restoreInfo.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {fileError && (
        <p className="settings-field-error" role="alert">
          {fileError}
        </p>
      )}
      {load.isError && (
        <p className="settings-field-error" role="alert">
          {restoreErrorMessage(load.error)}
        </p>
      )}
      {done && <output className="notice">{DATA_TEXT.restored}</output>}

      {dialog.open && preview && (
        <RestorePreviewDialog
          dialog={dialog}
          title={DATA_TEXT.restoreTitle}
          diff={preview.diff}
          hasDraft={hasDraft}
          error={restore.isError ? restoreErrorMessage(restore.error) : null}
          onConfirm={() =>
            restore.mutate(preview, {
              onSuccess: () => {
                dialog.close();
                setPreview(null);
                setFile(null);
                setDone(true);
                onRestored();
              },
            })
          }
          onDismiss={dismiss}
        />
      )}
    </section>
  );
}
