/**
 * 2. 取込ファイル一覧 (spec「2. 取込ファイル一覧」)。
 * 行の状態・操作・選べるかは core の判定表 (importFileState / importFileActions / importFileSelectable) だけが決める。
 * 状態は色だけで伝えず、記号と文字を並べる (WCAG 1.4.1)。狭い画面では表を横スクロールにする。
 */
import {
  IMPORT_FILE_ACTION_LABEL,
  IMPORT_SOURCE_SHORT,
  type ImportFileAction,
  formatImportFileSize,
  formatImportPeriod,
  importDuplicateLabel,
  importFileActions,
  importFileSelectable,
  importValidationLabel,
} from '@kanjo/core';
import { Button } from '../../components/Button.js';
import { IMPORT_STATE_ICON, type ImportItem, importItemStatus, importItemStatusLabel } from './view-model.js';

const DUPLICATE_TONE = { none: 'calm', possible: 'warn', identical: 'neutral' } as const;
const VALIDATION_TONE = { checking: 'neutral', ok: 'calm', warning: 'warn', error: 'alert' } as const;
const STATE_TONE = {
  uploading: 'neutral',
  inspecting: 'neutral',
  ready: 'calm',
  blocked: 'alert',
  imported: 'calm',
  failed: 'alert',
} as const;

export function ImportFileTable({
  items,
  force,
  onToggle,
  onToggleAll,
  onAction,
}: {
  items: readonly ImportItem[];
  force: boolean;
  onToggle: (key: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onAction: (key: string, action: ImportFileAction) => void;
}) {
  const rows = items.map((item) => ({ item, status: importItemStatus(item, force) }));
  const selectable = rows.filter(
    ({ item, status }) => item.commit === null && importFileSelectable(status.state),
  );
  const allChecked = selectable.length > 0 && selectable.every(({ item }) => item.checked);

  return (
    <section className="card import-step" aria-labelledby="import-files-title">
      <div className="import-step-head">
        <div>
          <h2 id="import-files-title">
            <span className="import-step-no">2.</span> 取込ファイル一覧
          </h2>
          <p className="import-step-sub">
            選択したファイルとチェック結果を確認してください。チェック済みのファイルをまとめて取り込みます。
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="import-empty">ファイルを選ぶと、ここにチェック結果が出ます</p>
      ) : (
        <div className="import-table-wrap">
          <table
            className="import-table import-file-table"
            data-table-kind="workflow"
            data-sort-reason="選んだ順が送信と検査の順なので、行の並びをその進行順に固定する"
          >
            <caption className="visually-hidden">取込ファイル一覧</caption>
            <thead>
              <tr>
                <th scope="col" className="import-col-check">
                  <label>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={selectable.length === 0}
                      onChange={(event) => onToggleAll(event.target.checked)}
                      aria-label="取込準備完了のファイルをすべて選ぶ"
                    />
                    <span aria-hidden="true">#</span>
                  </label>
                </th>
                <th scope="col">ファイル名</th>
                <th scope="col">取込元</th>
                <th scope="col">対象期間</th>
                <th scope="col">ファイルサイズ</th>
                <th scope="col">重複チェック</th>
                <th scope="col">バリデーション</th>
                <th scope="col">ステータス</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, status }, index) => {
                const inspection = item.inspection;
                const canCheck = item.commit === null && importFileSelectable(status.state);
                const actions = importFileActions(status.state);
                return (
                  <tr key={item.key} data-state={status.state}>
                    <td className="import-col-check">
                      <label>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          disabled={!canCheck}
                          onChange={(event) => onToggle(item.key, event.target.checked)}
                          aria-label={`${item.file.name} を取り込む`}
                        />
                        <span>{index + 1}</span>
                      </label>
                    </td>
                    <th scope="row" className="import-filename">
                      {item.file.name}
                    </th>
                    <td>{inspection?.source ? IMPORT_SOURCE_SHORT[inspection.source] : '-'}</td>
                    <td className="import-nowrap">
                      {formatImportPeriod(inspection?.periodFrom, inspection?.periodTo)}
                    </td>
                    <td className="import-nowrap">{formatImportFileSize(item.file.size)}</td>
                    <td>
                      {inspection ? (
                        <span className={`pill ${DUPLICATE_TONE[inspection.duplicate.kind]}`}>
                          {importDuplicateLabel(inspection.duplicate)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {inspection ? (
                        <span className={`pill ${VALIDATION_TONE[inspection.validation.kind]}`}>
                          {importValidationLabel(inspection.validation)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`pill ${STATE_TONE[status.state]} import-status`}>
                        <span aria-hidden="true">{IMPORT_STATE_ICON[status.state]}</span>{' '}
                        {importItemStatusLabel(item, status)}
                      </span>
                      {status.state === 'uploading' && (
                        <progress
                          className="import-progress"
                          max={100}
                          value={item.progress}
                          aria-label={`${item.file.name} の送信`}
                        />
                      )}
                      {status.reason && <small className="import-reason">{status.reason}</small>}
                    </td>
                    <td className="import-actions">
                      {actions.map((action) => (
                        <Button
                          key={action}
                          size="mini"
                          variant={action === 'remove' ? 'text' : 'secondary'}
                          aria-label={`${item.file.name} を${IMPORT_FILE_ACTION_LABEL[action]}`}
                          onClick={() => onAction(item.key, action)}
                        >
                          {IMPORT_FILE_ACTION_LABEL[action]}
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
  );
}
