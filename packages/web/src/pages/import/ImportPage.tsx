/**
 * データ取込画面 (spec-import-screen)。問い「複数の明細ファイルを、安全に取り込みますか？」に 1 画面で答える。
 *
 * 1. ファイルを選択 → 2. 取込ファイル一覧 (検査) → 3. 取込内容の確認 → 4. 取込結果 → 5. 取込履歴。
 * 状態・操作・要約の規則は core の import-screen、画面が持つ項目の写しは view-model、
 * 送信と確定は use-import-files が持つ。ここは段の並びと確認ダイアログだけを持つ。
 */
import { IMPORT_STEPS, type ImportFileAction, importStep } from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api-client.js';
import type { SummaryResponse } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DeletionPanel } from '../../components/ImportDeletion.js';
import { PageHeader } from '../../components/Page.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { usePeriod } from '../../period.js';
import { ImportConfirm } from './ImportConfirm.js';
import { ImportFileTable } from './ImportFileTable.js';
import { ImportHistory } from './ImportHistory.js';
import { ImportResultStep, ImportSummaryStep } from './ImportReviewSteps.js';
import { ImportSelectStep } from './ImportSelectStep.js';
import { useImportFiles } from './use-import-files.js';
import {
  type ImportSummaryView,
  importKeepPreviousDescription,
  importPeriodCardText,
  importSelectionBar,
  importSummaryView,
  readImportUrl,
} from './view-model.js';
import './import.css';

const QUESTION = '複数の明細ファイルを、安全に取り込みますか？';

export function ImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { runId } = readImportUrl(searchParams);
  const { selection, key, withPeriod } = usePeriod();
  // 共通の期間タブ (Layout) と同じキー。右上のカードはその範囲を読むだけで、取込の対象は変えない
  const summary = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
  const files = useImportFiles();
  const [force, setForce] = useState(false);
  const [keepPrevious, setKeepPrevious] = useState(true);
  // 確定で検査 ID を消費した後も、判断に使った要約は結果と一緒に残す。
  const [lastSummary, setLastSummary] = useState<ImportSummaryView | null>(null);
  const confirm = useConfirmDialog({ busy: files.committing });

  const bar = importSelectionBar(files.items, force);
  const view = importSummaryView({
    items: files.items,
    force,
    inspectionId: files.inspectionId,
    serverSubsCandidates: files.subsCandidates,
  });
  // 確定の応答を受け、次の検査がまだ始まっていない間だけ「取込結果」の段にいる
  const committed = files.outcome !== null && files.inspectionId === null;
  const visibleSummary = committed && lastSummary ? lastSummary : view;
  const step = importStep({ inspectionId: files.inspectionId, committed });

  const setRun = (id: string | null) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set('run', id);
        else next.delete('run');
        return next;
      },
      { replace: true },
    );

  const onFileAction = (key: string, action: ImportFileAction) => {
    if (action === 'cancel') files.cancel(key);
    else if (action === 'remove') void files.remove(key);
    else void files.retry(key);
  };

  const runCommit = async () => {
    if (view.kind === 'ready') setLastSummary(view);
    await files.commit({
      keys: bar.commitKeys,
      keepPrevious,
      force,
    });
    confirm.setOpen(false);
    confirm.triggerRef.current?.focus();
    setForce(false);
  };

  return (
    <div className="import">
      <div className="import-title-row">
        <div className="import-title">
          <PageHeader route="import" title="データ取込" showTask={false} />
          <section className="import-intro" aria-labelledby="import-question">
            <h2 id="import-question">{QUESTION}</h2>
            <p>
              freee
              やマネーフォワードの明細ファイルをまとめて取り込み、内容を確認してから会計データに追加します。自動チェックで誤りや重複を防ぎ、安心して取り込めます。
            </p>
          </section>
        </div>
        <aside className="card import-period" aria-labelledby="import-period-title">
          <h2 id="import-period-title">対象期間（グローバル）</h2>
          <p className="import-period-range">{importPeriodCardText(summary.data?.period, selection)}</p>
          <small>サイト全体で共通の分析期間です。</small>
        </aside>
      </div>

      <ol className="import-stepper" aria-label="取込の手順">
        {IMPORT_STEPS.map((entry) => (
          <li
            key={entry.step}
            className={entry.step === step ? 'current' : entry.step < step ? 'done' : undefined}
            aria-current={entry.step === step ? 'step' : undefined}
          >
            <span className="import-stepper-no" aria-hidden="true">
              {entry.step < step ? '✓' : entry.step}
            </span>
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.caption}</small>
            </span>
          </li>
        ))}
      </ol>

      <ImportSelectStep
        disabled={files.committing}
        force={force}
        keepPrevious={keepPrevious}
        onForceChange={setForce}
        onKeepPreviousChange={setKeepPrevious}
        onFiles={(picked) => {
          setLastSummary(null);
          files.addFiles(picked);
        }}
        onReplaced={() => {
          setLastSummary(null);
          files.reset();
          files.clearOutcome();
        }}
      />

      <ImportFileTable
        items={files.items}
        force={force}
        onToggle={files.toggle}
        onToggleAll={(checked) => files.toggleAll(checked, force)}
        onAction={onFileAction}
      />

      <ImportSummaryStep view={visibleSummary} />

      <div
        className={runId ? 'import-lower-grid has-detail' : 'import-lower-grid'}
        data-layout-region="result-history-detail"
      >
        <ImportResultStep
          outcome={files.outcome}
          onRetryFailed={() => {
            setLastSummary(null);
            files.retryFailed();
          }}
        />
        <ImportHistory
          selectedRunId={runId}
          onOpen={(id) => setRun(id)}
          onClose={() => setRun(null)}
          disabled={files.committing}
        />
      </div>

      <DeletionPanel />

      {bar.selected > 0 && (
        <section className="import-selection-bar" aria-label="選択中のファイル">
          <p>
            <strong>{bar.selected} 件のファイルを選択中</strong>
            <span>
              取込可能：{bar.importable}件（エラー：{bar.errors}件）
            </span>
          </p>
          <div className="import-selection-actions">
            <Button variant="text" disabled={files.committing} onClick={files.clearSelection}>
              選択をキャンセル
            </Button>
            <Button
              variant="primary"
              disabled={bar.commitKeys.length === 0 || files.committing}
              onClick={(event) => {
                confirm.triggerRef.current = event.currentTarget;
                confirm.setOpen(true);
              }}
            >
              ✓ {bar.commitKeys.length}ファイルを取り込む
            </Button>
          </div>
        </section>
      )}

      <ImportConfirm
        dialog={confirm}
        title={`${bar.commitKeys.length}ファイルを取り込みますか？`}
        confirmLabel="会計データに追加する"
        busyLabel="取り込んでいます…"
        onConfirm={() => void runCommit()}
      >
        <p>{importKeepPreviousDescription(keepPrevious)}</p>
        {force && <p>強制再取込がオンです。取込済みと同じファイルも取り込み直します。</p>}
        <p>取り込んだ後 30 日以内なら、取込履歴から取り消せます。</p>
      </ImportConfirm>
    </div>
  );
}
