/**
 * 1. ファイルを選択 (spec「1. ファイルを選択」)。
 * ドロップ領域・上限の注記・対応サービスの案内・詳細設定 (強制再取込 / 前回データを残す)。
 * 上限の数値は core の `importLimitsNote` から描き、字面で書かない。
 */
import { importLimitsNote } from '@kanjo/core';
import { type ReactNode, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DeletionResult } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DeletedNotice, ImportReplacementButton } from '../../components/ImportDeletion.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { Term } from '../../components/Term.js';
import { importKeepPreviousDescription } from './view-model.js';

/** 受け付ける拡張子。既存の ZIP・JSON (HTML 版互換) も引き続き受ける */
export const IMPORT_ACCEPT = '.csv,.txt,.xlsx,.xls,.zip,.json';

const SERVICES: ReadonlyArray<{
  id: string;
  name: string;
  target: string;
  steps: readonly string[];
  note?: ReactNode;
  href: string;
}> = [
  {
    id: 'mf',
    name: 'マネーフォワード',
    target: '家計簿（キャッシュフロー）',
    steps: [
      '家計簿の「収支内訳」または「入出金」から期間を選び、CSV を保存します。',
      '残高を取り込むときは「資産推移」から CSV を保存します。負債は決算書で手入力します。',
    ],
    note: (
      <>
        資産推移は<Link to="/statements">決算書</Link>の<Term id="bs" />
        に反映します。
      </>
    ),
    href: 'https://moneyforward.com/cf',
  },
  {
    id: 'freee',
    name: 'freee',
    target: '取引（取引先・取引明細）',
    steps: ['取引一覧で期間を絞り、CSV または ZIP を書き出します。'],
    href: 'https://secure.freee.co.jp/deals#code=deals',
  },
];

export function ImportSelectStep({
  disabled,
  force,
  keepPrevious,
  onForceChange,
  onKeepPreviousChange,
  onFiles,
  onReplaced,
}: {
  disabled: boolean;
  force: boolean;
  keepPrevious: boolean;
  onForceChange: (value: boolean) => void;
  onKeepPreviousChange: (value: boolean) => void;
  onFiles: (files: File[]) => void;
  onReplaced: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<DeletionResult | null>(null);
  const accept = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (files.length) onFiles(files);
  };

  return (
    <section className="card import-step" aria-labelledby="import-select-title">
      <div className="import-step-head">
        <div>
          <h2 id="import-select-title">
            <span className="import-step-no">1.</span> ファイルを選択
          </h2>
          <p className="import-step-sub">
            複数の明細ファイルを選択するか、ここにドラッグ＆ドロップしてください。
          </p>
        </div>
        <ImportReplacementButton
          disabled={disabled}
          onDeleted={(result) => {
            setReplacement(result);
            onReplaced();
          }}
        />
      </div>

      {replacement && (
        <DeletedNotice
          result={replacement}
          onUndone={() => setReplacement(null)}
          nextAction={{ label: '新しいファイルを選ぶ', onClick: () => input.current?.click() }}
        />
      )}

      <div className="import-select-grid">
        <div
          className={`dropzone import-dropzone${drag ? ' drag' : ''}`}
          data-testid="import-dropzone"
          onDragEnter={() => setDrag(true)}
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            if (!disabled) accept(event.dataTransfer.files);
          }}
        >
          <strong>ここにファイルをドラッグ＆ドロップ</strong>
          <span>
            CSV、Excel (.xlsx、.xls)、テキスト (.txt)、HTML 版の
            <Term id="mergedJson" /> (.json) に対応しています。複数ファイルを同時に選択できます。
          </span>
          <Button variant="primary" disabled={disabled} onClick={() => input.current?.click()}>
            ファイルを選択
          </Button>
          <small className="import-limits-note">{importLimitsNote()}</small>
          <input
            id="import-files"
            ref={input}
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            className="visually-hidden"
            aria-label="取り込むファイル"
            onChange={(event) => {
              accept(event.target.files);
              // 同じファイルを続けて選び直せるようにする
              event.target.value = '';
            }}
          />
        </div>

        <aside className="import-services" aria-labelledby="import-services-title">
          <h3 id="import-services-title">対応サービスから取得する</h3>
          <p className="import-step-sub">各サービスから明細ファイルをダウンロードして取り込んでください。</p>
          <ul>
            {SERVICES.map((service) => (
              <li key={service.id}>
                <div className="import-service-row">
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.target}</small>
                  </span>
                  <button
                    type="button"
                    data-native-control="disclosure"
                    className="btn linklike"
                    aria-expanded={openGuide === service.id}
                    aria-controls={`import-guide-${service.id}`}
                    onClick={() => setOpenGuide((current) => (current === service.id ? null : service.id))}
                  >
                    取得方法を見る →
                  </button>
                </div>
                {openGuide === service.id && (
                  <div id={`import-guide-${service.id}`} className="import-service-guide">
                    <ol>
                      {service.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {service.note && <p>{service.note}</p>}
                    <a href={service.href} target="_blank" rel="noreferrer">
                      {service.name}を開く
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <details className="import-options">
        <summary>詳細設定（任意）</summary>
        <SelectionCheckbox
          checked={force}
          onChange={(event) => onForceChange(event.target.checked)}
          label={
            <span>
              <strong>強制再取込</strong>
              <small>同じ内容のファイルでも再取込を行います。</small>
            </span>
          }
        />
        <SelectionCheckbox
          checked={keepPrevious}
          onChange={(event) => onKeepPreviousChange(event.target.checked)}
          label={
            <span>
              <strong>前回データを残す</strong>
              <small>{importKeepPreviousDescription(keepPrevious)}</small>
            </span>
          }
        />
      </details>
    </section>
  );
}
