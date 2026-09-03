import { autoRegisterable } from '@kanjo/core';
/**
 * P8 データ取込: ZIP・CSV・Excel・HTML版互換JSONの投入と取込履歴(FR-01)。
 * 同月洗い替えの確認ダイアログを挟む。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AUTH_EVENT,
  type DeletionResult,
  type ImportHistoryRow,
  type ImportUnitResult,
  type SubsCandidate,
  api,
  apiUpload,
} from '../api.js';
import {
  DeletedNotice,
  DeletionPanel,
  ImportDiscardButton,
  ImportReplacementButton,
  ImportUndoButton,
} from '../components/ImportDeletion.js';
import { type ConflictDecision, DiffPreview } from '../components/ImportDiff.js';
import { PageHeader, PageState, describeError } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { dateTime } from '../format.js';
import { fileForUnit, retryableFiles, rootFileName } from '../import-retry.js';

const KIND_LABEL: Record<string, ReactNode> = {
  mf: 'MF明細',
  freee: 'freee仕訳',
  assets: 'MF資産推移',
  json: <Term id="mergedJson" />,
};

/** 長い月一覧を、履歴の走査に向く「開始〜終了（件数）」へ圧縮する。 */
const monthSummary = (months: readonly string[]): string => {
  const sorted = [...new Set(months)].sort();
  if (!sorted.length) return '対象月不明';
  if (sorted.length === 1) return sorted[0];
  const serialMonth = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    return Number.isFinite(year) && Number.isFinite(month) ? year * 12 + month : Number.NaN;
  };
  const continuous = sorted.every(
    (month, index) => index === 0 || serialMonth(month) === serialMonth(sorted[index - 1]) + 1,
  );
  const gapNote = continuous ? '' : '・一部月を除く';
  return `${sorted[0]} 〜 ${sorted[sorted.length - 1]}（${sorted.length}ヶ月${gapNote}）`;
};

/**
 * 取込結果の数量・状態を同じ語彙で表示する再利用単位。
 * 再取込は「どのファイルで、見送り設定を外すか」だけを親へ伝え、state は持たない。
 */
export function ImportResultTable({
  results,
  retryFile,
  onRetry,
  retryAll,
}: {
  results: ImportUnitResult[];
  /** その行の再取込に使える元ファイル。手元に無ければ null を返し、ボタンを出さない */
  retryFile?: (unit: ImportUnitResult) => File | null;
  /** releaseKeep=true は「件数が減る月を見送る」を外したうえで取り込み直す意思表示 */
  onRetry?: (files: File[], opts: { releaseKeep: boolean }) => void;
  /** まとめて再取込できる失敗ファイル。2件以上のときだけ一括ボタンを出す */
  retryAll?: File[];
}) {
  const retryButton = (unit: ImportUnitResult, label: string, releaseKeep: boolean) => {
    const f = retryFile?.(unit) ?? null;
    if (!f || !onRetry) return null;
    return (
      <button
        type="button"
        className={unit.status === 'failed' ? 'primary' : undefined}
        onClick={() => onRetry([f], { releaseKeep })}
      >
        {label}
      </button>
    );
  };

  const status = (result: ImportUnitResult) => {
    if (result.status === 'committed') return <span className="pill calm">取込完了</span>;
    if (result.status === 'kept') return <span className="pill warn">前回を保持</span>;
    if (result.status === 'duplicate') return <span className="pill warn">取込済み</span>;
    return <span className="pill alert">失敗</span>;
  };

  return (
    <ul className="import-list-surface" aria-label="今回の取込結果">
      {results.map((r) => {
        const counts = r.counts;
        const savedRows = counts?.stored ?? r.rows;
        const detailLabel = r.status === 'failed' ? '失敗理由と件数' : '件数の内訳';
        return (
          <li className="import-record" key={`${r.filename}-${r.kind}`}>
            <div className="import-record-main">
              <strong className="import-file-name" title={r.filename}>
                {r.filename}
              </strong>
              <span className="import-record-count">
                <span className="num">{savedRows ?? '—'}</span> 行
              </span>
            </div>
            <div className="import-record-state">{status(r)}</div>
            <div className="import-record-meta">
              <span>{KIND_LABEL[r.kind] ?? '種別不明'}</span>
              <span title={r.months.join(', ')}>{monthSummary(r.months)}</span>
            </div>
            <div className="import-record-actions">
              {r.status === 'kept'
                ? retryButton(r, '前回を残さず再取込', true)
                : r.status === 'failed'
                  ? retryButton(r, '再取込する', false)
                  : null}
            </div>
            <details className="import-record-details">
              <summary>{detailLabel}</summary>
              <div className="import-record-detail-body">
                {counts ? (
                  <dl className="import-count-grid">
                    <div>
                      <dt title="日付を解釈できた入力行。同一IDの重複を含みます">解析行</dt>
                      <dd className="num">{counts.parsed}</dd>
                    </div>
                    <div>
                      <dt title="同一IDは最後の行だけを保存します">保存行</dt>
                      <dd className="num">{counts.stored}</dd>
                    </div>
                    <div>
                      <dt title="保存行のうち収支集計に含める行です">集計対象</dt>
                      <dd className="num">{counts.countable}</dd>
                    </div>
                    <div>
                      <dt title="保存はするが収支集計には含めない行です">集計対象外</dt>
                      <dd className="num">{counts.nonCountable}</dd>
                    </div>
                    <div>
                      <dt title="日付を解釈できず保存できなかった行です">保存不可</dt>
                      <dd className="num">{counts.rejected}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="sub">
                    旧API: 旧有効{r.rows}行・旧スキップ{r.skipped}行（内訳不明）
                  </p>
                )}

                {r.status === 'committed' ? (
                  <>
                    {(r.syntheticIds || r.duplicateIds) && (
                      <p className="sub">
                        {r.syntheticIds ? `ID補完 ${r.syntheticIds}件` : ''}
                        {r.syntheticIds && r.duplicateIds ? '・' : ''}
                        {r.duplicateIds ? `ID重複 ${r.duplicateIds}件` : ''}
                      </p>
                    )}
                    {r.kind === 'assets' && (
                      <p className="sub">
                        <Link to="/statements">決算書</Link>の<Term id="bs" />
                        に反映しました。負債は決算書で入力します。
                      </p>
                    )}
                    {r.totalMismatchMonths?.length ? (
                      <p className="sub" role="alert">
                        {r.totalMismatchMonths.join(', ')}:
                        合計欄と内訳の和が一致しません。資産は内訳の和で取り込みました。
                      </p>
                    ) : null}
                    {(r.replaced ?? [])
                      .filter((month) => month.before > month.after)
                      .map((month) => (
                        <p className="sub" role="alert" key={month.month}>
                          {month.month}: {month.before}件から{month.after}
                          件へ減少。月途中のファイルでないか確認してください。
                        </p>
                      ))}
                  </>
                ) : r.status === 'duplicate' ? (
                  <p className="sub">
                    {r.reason}。同じ内容を再適用する場合だけ、詳細設定を変更してください。
                  </p>
                ) : (
                  <p className="sub" role={r.status === 'failed' ? 'alert' : undefined}>
                    {r.reason}
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
      {results.some((r) => r.status === 'failed') && (
        <li className="import-list-footer" aria-live="polite">
          <span>失敗したファイルは反映されていません。</span>
          {onRetry && (retryAll?.length ?? 0) > 1 && (
            <button
              type="button"
              className="primary"
              onClick={() => onRetry(retryAll ?? [], { releaseKeep: false })}
            >
              失敗した{retryAll?.length}件を再取込
            </button>
          )}
        </li>
      )}
    </ul>
  );
}

export function ImportPage() {
  const qc = useQueryClient();
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [results, setResults] = useState<ImportUnitResult[] | null>(null);
  // 直前に投入したファイル。失敗した分を選び直さずに戻すためだけに持つ(送信済みなので中身は変わらない)
  const [submitted, setSubmitted] = useState<File[]>([]);
  // 現在有効な世代と同じ内容は既定でスキップする。意図的に再適用したいときだけ ON にする
  const [force, setForce] = useState(false);
  // 月の途中までのファイルを掴んだときの安全弁。既定は OFF(通常の月次取込は件数が増えるため)
  const [keepOnShrink, setKeepOnShrink] = useState(false);
  // 取込履歴から原本を戻したときの出どころ(#ID)。戻しただけで、まだ何も書き換えていないことを示す
  const [reimportedFrom, setReimportedFrom] = useState<number | null>(null);
  // 差分プレビューで決めたこと。空 = 何も選ばなかった = 今の手当てをそのまま残す(DR-11)
  const [decisions, setDecisions] = useState<ConflictDecision[]>([]);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ reset: number; remembered: number } | null>(null);
  const [replacementResult, setReplacementResult] = useState<DeletionResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const history = useQuery({
    queryKey: ['imports'],
    queryFn: () => api<{ imports: ImportHistoryRow[] }>('/imports'),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append('file', f);
      if (force) form.append('force', '1');
      if (keepOnShrink) form.append('keepOnShrink', '1');
      if (previewFingerprint) {
        form.append('resolutionPlan', JSON.stringify({ fingerprint: previewFingerprint, decisions }));
      }
      const body = await apiUpload<{
        results?: ImportUnitResult[];
        resolution?: { reset: number; remembered: number };
      }>('/imports', form, {
        // 複数ファイルの一部成功はHTTPエラーでも結果表を保つ。
        acceptErrorBody: (candidate) =>
          !!candidate && typeof candidate === 'object' && Array.isArray(Reflect.get(candidate, 'results')),
      });
      return { results: body.results ?? [], resolution: body.resolution ?? null };
    },
    onSuccess: ({ results: r, resolution }, files) => {
      setResults(r);
      setPending([]);
      setReimportedFrom(null);
      setSubmitted(files);
      setForce(false);
      // 差分解決は取込POSTの同じ確定単位で反映済み。後続PUT/PATCHは行わない。
      setApplied(resolution && (resolution.reset || resolution.remembered) ? resolution : null);
      setReplacementResult(null);
      setDecisions([]);
      setPreviewFingerprint(null);
      void qc.invalidateQueries(); // 全ページへ反映
    },
  });

  const accept = (files: FileList | File[]) => {
    const arr = [...files];
    if (arr.length) {
      setPending(arr);
      setReimportedFrom(null);
      // ファイルが変われば差分も変わる。前のファイルへの選択を持ち越さない
      setDecisions([]);
      setPreviewFingerprint(null);
      setApplied(null);
    }
  };

  const cancelPendingImport = () => {
    setPending([]);
    setReimportedFrom(null);
    setPreviewFingerprint(null);
  };

  /**
   * 取込履歴の原本(R2)を取込枠へ戻す。ここでは何も書き換えない。
   * 月単位の洗い替えは DELETE→INSERT で取り返しがつかないため、実行の確認は
   * 通常の取込と同じ「取込を実行」→ confirm に一本化する(確認の二重管理を作らない)。
   */
  const reimport = useMutation({
    mutationFn: async (row: ImportHistoryRow) => {
      const res = await fetch(`/api/imports/${row.id}/original`);
      if (res.status === 401) {
        window.dispatchEvent(new Event(AUTH_EVENT));
        throw new Error('unauthorized');
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? `原本を取り出せませんでした(${res.status})`);
      }
      const blob = await res.blob();
      return new File([blob], rootFileName(row.filename), { type: blob.type });
    },
    onSuccess: (file, row) => {
      setResults(null);
      setPending([file]);
      setReimportedFrom(row.id);
    },
  });

  const confirmAndUpload = () => {
    // 月単位洗い替えの明示(spec §10.3)
    const ok = window.confirm(
      `ファイルに含まれる月の既存データは削除して置き換えます(月単位の洗い替え)。手動判定は明細IDが一致する限り維持され、現金の記帳も残ります。${
        force
          ? '現在有効な内容と同じでも、新しい取込として再適用します。'
          : '現在有効な内容と同じファイルだけスキップします。'
      }${
        keepOnShrink ? '件数が減る月がある場合は、そのファイルを取り込まずに前回の内容を残します。' : ''
      }取込を実行しますか?`,
    );
    if (ok) upload.mutate(pending);
  };

  /** 失敗行に対応する元ファイル。手元に無ければ null(その行にはボタンを出さない) */
  const retryFile = (unit: ImportUnitResult) => fileForUnit(unit, submitted);
  const retryAll = results ? retryableFiles(results, submitted) : [];
  const historyRows = history.data?.imports ?? [];
  const historyPriority = (row: ImportHistoryRow) => {
    if (row.status !== 'committed' && row.status !== 'ok' && row.status !== 'duplicate') return 0;
    if (row.generationState === 'active' || row.generationState === 'partial') return 1;
    return 2;
  };
  const orderedHistoryRows = [...historyRows].sort((a, b) => historyPriority(a) - historyPriority(b));
  const failedHistoryCount = historyRows.filter(
    (row) =>
      row.status !== 'committed' &&
      row.status !== 'ok' &&
      row.status !== 'duplicate' &&
      row.status !== 'processing' &&
      row.status !== 'applying',
  ).length;
  return (
    <>
      <PageHeader route="import" />
      <div className="import-page">
        <section className="import-upload-panel" aria-labelledby="import-upload-title">
          <div className="import-section-heading">
            <div>
              <span className="import-eyebrow">次に処理するもの</span>
              <h2 id="import-upload-title">新しいファイルを取り込む</h2>
            </div>
            <div className="import-upload-heading-actions">
              <span className="import-file-types">CSV・ZIP・Excel・JSON</span>
              <ImportReplacementButton
                disabled={upload.isPending}
                onDeleted={(result) => {
                  setReplacementResult(result);
                  setResults(null);
                  void qc.invalidateQueries();
                }}
              />
            </div>
          </div>

          {replacementResult && (
            <DeletedNotice
              result={replacementResult}
              onUndone={() => setReplacementResult(null)}
              nextAction={{
                label: '新しいファイルを選ぶ',
                onClick: () => fileInput.current?.click(),
              }}
            />
          )}

          <div
            className={`dropzone import-dropzone${drag ? ' drag' : ''}`}
            onDragEnter={() => setDrag(true)}
            onDragOver={(event) => {
              event.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDrag(false);
              accept(event.dataTransfer.files);
            }}
          >
            <strong>ファイルをここにドロップ</strong>
            <span>マネーフォワード・freeeのファイルをまとめて選べます</span>
            <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
              ファイルを選ぶ
            </button>
          </div>
          <input
            id="import-files"
            ref={fileInput}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.zip,.json"
            className="visually-hidden"
            onChange={(event) => event.target.files && accept(event.target.files)}
          />

          <details className="import-source-guide">
            <summary>ファイルの出し方を確認</summary>
            <div className="import-source-grid">
              <div>
                <strong>マネーフォワードの明細</strong>
                <p>家計簿の収支詳細から期間を選び、CSVを保存します。</p>
                <a href="https://moneyforward.com/cf" target="_blank" rel="noreferrer">
                  収支詳細を開く
                </a>
              </div>
              <div>
                <strong>マネーフォワードの残高</strong>
                <p>資産推移からCSVを保存します。負債は決算書で手入力します。</p>
                <a href="https://moneyforward.com/bs/history" target="_blank" rel="noreferrer">
                  資産推移を開く
                </a>
              </div>
              <div>
                <strong>freeeの仕訳</strong>
                <p>取引一覧で期間を絞り、CSVまたはZIPを書き出します。</p>
                <a href="https://secure.freee.co.jp/deals#code=deals" target="_blank" rel="noreferrer">
                  取引一覧を開く
                </a>
              </div>
            </div>
          </details>
        </section>

        {pending.length > 0 && (
          <section className="import-pending-panel" aria-labelledby="import-pending-title">
            <div className="import-section-heading compact">
              <div>
                <span className="import-eyebrow">取込前</span>
                <h2 id="import-pending-title">{pending.length}件のファイルを選択中</h2>
              </div>
              <button type="button" onClick={cancelPendingImport}>
                {reimportedFrom === null ? '選択を解除' : 'やり直しをやめる'}
              </button>
            </div>
            <ul className="import-selected-files" aria-label="選択したファイル">
              {pending.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <strong>{file.name}</strong>
                  <span className="num">
                    {Math.max(1, Math.ceil(file.size / 1024)).toLocaleString('ja-JP')} KB
                  </span>
                </li>
              ))}
            </ul>

            {reimportedFrom !== null && (
              <p className="import-safe-note">
                取込履歴 #{reimportedFrom}
                の原本を戻しました。まだ何も書き換えていません。「取込を実行」したときだけ対象月を更新します。
              </p>
            )}

            <details className="import-options">
              <summary>詳細設定</summary>
              <label>
                <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                <span>
                  <strong>同じ内容でも再適用する</strong>
                  <small>通常はオフのままで問題ありません</small>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={keepOnShrink}
                  onChange={(event) => setKeepOnShrink(event.target.checked)}
                />
                <span>
                  <strong>件数が減る月は前回の内容を残す</strong>
                  <small>月途中のファイルか判断できないときに使います</small>
                </span>
              </label>
            </details>

            <DiffPreview
              files={pending}
              decisions={decisions}
              onDecisionsChange={setDecisions}
              onFingerprintChange={setPreviewFingerprint}
            />

            <div className="import-primary-actions">
              <span>対象月の既存データは、確認後にこのファイルの内容へ置き換わります。</span>
              <button
                type="button"
                className="primary"
                aria-label="取込を実行"
                onClick={confirmAndUpload}
                disabled={upload.isPending}
              >
                {upload.isPending ? '取込中…' : `${pending.length}件を取り込む`}
              </button>
            </div>
          </section>
        )}

        {applied && (
          <output className="notice info import-feedback">
            反映しました: 取込値に戻した明細 {applied.reset}件・覚えた取引先 {applied.remembered}件
          </output>
        )}
        {upload.isError && (
          <div className="notice import-feedback" role="alert">
            取込を実行できませんでした: {describeError(upload.error)} 選択したファイルは残っています。
          </div>
        )}

        {results && (
          <section className="import-section" aria-labelledby="import-results-title">
            <div className="import-section-heading">
              <div>
                <span className="import-eyebrow">今回の処理</span>
                <h2 id="import-results-title">取込結果</h2>
              </div>
              <span className="import-file-types">{results.length}件</span>
            </div>
            <ImportResultTable
              results={results}
              retryFile={retryFile}
              retryAll={retryAll}
              onRetry={(files, { releaseKeep }) => {
                if (releaseKeep) setKeepOnShrink(false);
                setPending(files);
              }}
            />
            <SubsHandoff results={results} />
          </section>
        )}

        <section id="import-history" className="import-section" aria-labelledby="import-history-title">
          <div className="import-section-heading">
            <div>
              <span className="import-eyebrow">次に処理すべき取込</span>
              <h2 id="import-history-title">取込履歴</h2>
            </div>
            {!history.isLoading && !history.isError && historyRows.length > 0 && (
              <span className={`pill ${failedHistoryCount ? 'alert' : 'calm'}`}>
                {failedHistoryCount ? `失敗 ${failedHistoryCount}件` : '要対応なし'}
              </span>
            )}
          </div>

          {history.isLoading ? (
            <PageState status="loading" />
          ) : history.isError ? (
            <PageState status="error" error={history.error} />
          ) : orderedHistoryRows.length ? (
            <ul className="import-list-surface" aria-label="取込履歴（要対応を先に表示）">
              {orderedHistoryRows.map((row) => {
                const isComplete = row.status === 'committed' || row.status === 'ok';
                const isBusy = row.status === 'processing' || row.status === 'applying';
                const isFailed = !isComplete && row.status !== 'duplicate' && !isBusy;
                const failureReason =
                  row.failureReason ?? ((row.status ?? '').replace(/^error:\s*/, '') || '理由不明');
                return (
                  <li
                    className={`import-record${isFailed ? ' needs-action' : ''}`}
                    key={row.id}
                    aria-label={`${row.filename ?? 'ファイル名不明'}の取込履歴`}
                  >
                    <div className="import-record-main">
                      <strong className="import-file-name" title={row.filename ?? undefined}>
                        {row.filename ?? 'ファイル名不明'}
                      </strong>
                      <span className="import-record-count">
                        <span className="num">{row.rows ?? '—'}</span> 行
                      </span>
                    </div>
                    <div className="import-record-state">
                      {isComplete ? (
                        <>
                          <span className="pill calm">
                            {row.status === 'ok' ? '完了（旧履歴）' : '取込完了'}
                          </span>
                          {row.generationState === 'active' && <span className="pill calm">現在有効</span>}
                          {row.generationState === 'partial' && <span className="pill warn">一部が有効</span>}
                          {row.generationState === 'superseded' && (
                            <span className="pill neutral">更新済み</span>
                          )}
                        </>
                      ) : row.status === 'duplicate' ? (
                        <span className="pill warn">取込済み</span>
                      ) : isBusy ? (
                        <span className="pill warn">{row.status === 'processing' ? '解析中' : '反映中'}</span>
                      ) : (
                        <span className="pill alert">失敗</span>
                      )}
                    </div>
                    <div className="import-record-meta">
                      <span>{(row.kind && KIND_LABEL[row.kind]) ?? '種別不明'}</span>
                      <span title={row.months.join(', ')}>{monthSummary(row.months)}</span>
                      <time dateTime={row.createdAt ?? undefined}>{dateTime(row.createdAt)}</time>
                    </div>
                    <div className="import-history-actions">
                      {reimportedFrom === row.id ? (
                        <button type="button" onClick={cancelPendingImport}>
                          やり直しをやめる
                        </button>
                      ) : row.originalRecorded === true ? (
                        <button
                          type="button"
                          className={isFailed ? 'primary' : undefined}
                          aria-label="この取込をやり直す"
                          disabled={reimport.isPending || upload.isPending}
                          onClick={() => reimport.mutate(row)}
                        >
                          {reimport.isPending && reimport.variables?.id === row.id
                            ? '原本を取得中…'
                            : 'やり直す'}
                        </button>
                      ) : (
                        <span className="sub" title="この取込は投入した原本を保存していません">
                          原本なし
                        </span>
                      )}
                      {row.cancelable === true && (
                        <ImportUndoButton importId={row.id} disabled={upload.isPending} />
                      )}
                      {row.discardable === true && (
                        <ImportDiscardButton
                          importId={row.id}
                          disabled={upload.isPending}
                          onDiscarded={reimportedFrom === row.id ? cancelPendingImport : undefined}
                        />
                      )}
                    </div>

                    {(isFailed ||
                      row.status === 'duplicate' ||
                      (reimport.isError && reimport.variables?.id === row.id)) && (
                      <details className="import-record-details">
                        <summary>{isFailed ? '失敗理由を見る' : '詳細を見る'}</summary>
                        <div className="import-record-detail-body">
                          {isFailed && <p role="alert">{failureReason}</p>}
                          {row.status === 'duplicate' && row.duplicateOf != null && (
                            <p>現在有効な履歴 #{row.duplicateOf} と同じ内容です。</p>
                          )}
                          {reimport.isError && reimport.variables?.id === row.id && (
                            <p role="alert">{(reimport.error as Error).message}</p>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <output className="import-empty-state">
              <strong>取込履歴はまだありません</strong>
              <span>上の「ファイルを選ぶ」から最初の取込を始められます。</span>
            </output>
          )}
        </section>

        {/* 消す入口は履歴の後ろで畳む。取込に来た人の最初の選択肢にしない。 */}
        <DeletionPanel />
      </div>
    </>
  );
}

/**
 * 取込のあと、サブスク候補が出ていることをその場で知らせる。
 *
 * 取込画面を閉じてしまうと、候補が出ていること自体に気づかない。
 * ここで件数だけ見せて、確認はサブスク画面に任せる(判断は1箇所にまとめる)。
 * freee を取り込んでいないときは候補が増えないので出さない。
 */
function SubsHandoff({ results }: { results: ImportUnitResult[] }) {
  const gotFreee = results.some((r) => r.status !== 'failed' && r.kind === 'freee');
  const q = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () => api<{ candidates: SubsCandidate[] }>('/sub-vendors/candidates'),
    enabled: gotFreee,
  });
  if (!gotFreee) return null;
  const sure = autoRegisterable(q.data?.candidates ?? []);
  if (!sure.length) return null;
  return (
    <div className="notice info lines">
      サブスクとして登録できそうな支払先が {sure.length}件 見つかりました。
      <br />
      毎月ほぼ同額で続いている支払先です。まとめて登録できます。
      <br />
      <Link to="/subscriptions">サブスク分析で確認する</Link>
    </div>
  );
}
