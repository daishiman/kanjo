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
  type ImportHistoryRow,
  type ImportUnitResult,
  type SubsCandidate,
  api,
  apiUpload,
} from '../api.js';
import { PageHeader, PageState, describeError } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { dateTime } from '../format.js';
import { fileForUnit, retryableFiles, rootFileName } from '../import-retry.js';

const KIND_LABEL: Record<string, ReactNode> = {
  mf: 'MF明細',
  freee: 'freee仕訳',
  json: <Term id="mergedJson" />,
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
      <button type="button" style={{ marginTop: 6 }} onClick={() => onRetry([f], { releaseKeep })}>
        {label}
      </button>
    );
  };
  return (
    <>
      <table className="data">
        <thead>
          <tr>
            <th>ファイル</th>
            <th>種別</th>
            <th>対象月</th>
            <th title="日付を解釈できた入力行。同一IDの重複を含みます">解析行</th>
            <th title="同一IDは最後の行だけを保存します">保存行</th>
            <th title="保存行のうち収支集計に含める行です">集計対象</th>
            <th title="保存はするが収支集計には含めない行です">集計対象外</th>
            <th title="日付を解釈できず保存できなかった行です">保存不可</th>
            <th>結果</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const counts = r.counts;
            return (
              <tr key={`${r.filename}-${r.kind}`}>
                <td>{r.filename}</td>
                <td>{KIND_LABEL[r.kind] ?? '不明'}</td>
                <td>{r.months.join(', ') || '—'}</td>
                <td className="num">{counts?.parsed ?? '—'}</td>
                <td className="num">{counts?.stored ?? '—'}</td>
                <td className="num">{counts?.countable ?? '—'}</td>
                <td className="num">{counts?.nonCountable ?? '—'}</td>
                <td className="num">{counts?.rejected ?? '—'}</td>
                <td>
                  {r.status === 'committed' ? (
                    <>
                      <span className="pill calm">
                        取込完了
                        {r.syntheticIds ? ` (ID補完${r.syntheticIds}件)` : ''}
                        {r.duplicateIds ? ` (ID重複${r.duplicateIds}件)` : ''}
                      </span>
                      {(r.replaced ?? [])
                        .filter((m) => m.before > m.after)
                        .map((m) => (
                          <div
                            key={m.month}
                            className="sub"
                            style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                          >
                            {m.month}: 取込前 {m.before}件 → 取込後 {m.after}
                            件。件数が減っています。月の途中までのファイルではないか確認してください(前の内容に戻すには、元のファイルを取り込み直します。次からは「件数が減る月は取り込まず、前回の内容を残す」を付けると、この置き換え自体を止められます)。
                          </div>
                        ))}
                    </>
                  ) : r.status === 'kept' ? (
                    <>
                      <span className="pill warn">前回を残しました</span>
                      <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}>
                        {r.reason}
                      </div>
                      {/* 見送り設定を外さないと同じ結果になるため、この操作で一緒に外す */}
                      {retryButton(r, '前回を残さずに取り込む', true)}
                    </>
                  ) : r.status === 'duplicate' ? (
                    <>
                      <span className="pill warn">取込済み(スキップ)</span>
                      <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}>
                        {r.reason}
                        。意図的に再適用する場合だけ「現在有効な内容と同じでも再適用する」を付けてください。
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="pill alert">失敗</span>
                      <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}>
                        {r.reason}
                      </div>
                      {retryButton(r, '再取込', false)}
                    </>
                  )}
                  {!counts && (
                    <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}>
                      旧API: 旧有効{r.rows}行・旧スキップ{r.skipped}行（内訳不明）
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {results.some((r) => r.status === 'failed') && (
        <p className="sub">
          失敗したファイルの内容は確定されていません(取込完了したファイルは反映済み)。一時的な失敗なら、同じファイルを通常どおり再実行できます。
          {onRetry && (retryAll?.length ?? 0) > 1 && (
            <>
              {' '}
              <button type="button" onClick={() => onRetry(retryAll ?? [], { releaseKeep: false })}>
                失敗した{retryAll?.length}件をまとめて再取込
              </button>
            </>
          )}
        </p>
      )}
    </>
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
      const body = await apiUpload<{ results?: ImportUnitResult[] }>('/imports', form, {
        // 複数ファイルの一部成功はHTTPエラーでも結果表を保つ。
        acceptErrorBody: (candidate) =>
          !!candidate && typeof candidate === 'object' && Array.isArray(Reflect.get(candidate, 'results')),
      });
      return body.results ?? [];
    },
    onSuccess: (r, files) => {
      setResults(r);
      setPending([]);
      setReimportedFrom(null);
      setSubmitted(files);
      setForce(false);
      void qc.invalidateQueries(); // 全ページへ反映
    },
  });

  const accept = (files: FileList | File[]) => {
    const arr = [...files];
    if (arr.length) {
      setPending(arr);
      setReimportedFrom(null);
    }
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

  return (
    <>
      <PageHeader route="import" />

      <div
        className={`dropzone${drag ? ' drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') fileInput.current?.click();
        }}
        // biome-ignore lint/a11y/useSemanticElements: ドロップゾーンはdrag系イベントとブロック要素を含むためdiv+roleで実装
        role="button"
        tabIndex={0}
      >
        <p>
          ここにファイルをドラッグ&ドロップ
          <br />
          <small>
            またはクリックして選択。マネーフォワード「収入・支出詳細」CSV / freee取引エクスポート(ZIP可) /
            HTML版の統合JSON
          </small>
        </p>
      </div>

      <div className="notice" style={{ marginTop: 12 }}>
        <strong>ファイルの取得元</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li>
            マネーフォワード ME —{' '}
            <a href="https://moneyforward.com/cf" target="_blank" rel="noreferrer">
              家計簿・収支詳細を開く
            </a>
            <br />
            期間を選び「ダウンロード」から <code>収入・支出詳細_YYYY-MM-DD_YYYY-MM-DD.csv</code> を保存
          </li>
          <li style={{ marginTop: 6 }}>
            freee 会計 —{' '}
            <a href="https://secure.freee.co.jp/deals#code=deals" target="_blank" rel="noreferrer">
              取引一覧を開く
            </a>
            <br />
            期間を絞って「エクスポート」から取引データ(CSV / ZIP)を保存
          </li>
        </ul>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.zip,.json"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && accept(e.target.files)}
      />

      {pending.length > 0 && (
        <div className="notice info" style={{ marginTop: 12 }}>
          選択中: {pending.map((f) => f.name).join(' / ')}{' '}
          <button type="button" className="primary" onClick={confirmAndUpload} disabled={upload.isPending}>
            {upload.isPending ? '取込中…' : '取込を実行'}
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setPending([]);
              setReimportedFrom(null);
            }}
          >
            取消
          </button>
          {reimportedFrom !== null && (
            <div className="sub" style={{ marginTop: 6, whiteSpace: 'normal', textAlign: 'left' }}>
              取込履歴 #{reimportedFrom}
              の原本を戻しました。まだ何も書き換えていません。内容を確かめて「取込を実行」を押すと、このファイルに含まれる月が洗い替えられます。現在有効な内容と同じ場合はスキップされます。
            </div>
          )}
          <label style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />{' '}
            現在有効な内容と同じでも再適用する(通常は不要)
          </label>
          <label style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={keepOnShrink}
              onChange={(e) => setKeepOnShrink(e.target.checked)}
            />{' '}
            件数が減る月は取り込まず、前回の内容を残す(月の途中までのファイルか自信がないとき)
          </label>
        </div>
      )}
      {upload.isError && (
        <div className="notice" role="alert">
          取込を実行できませんでした: {describeError(upload.error)}
          選択したファイルは残っています。
        </div>
      )}

      {results && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>取込結果</h2>
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
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>取込履歴</h2>
        <p className="sub">
          「この取込をやり直す」は、そのとき投入した原本を取込枠へ戻すだけです。実際の書き換えは、内容を確かめて「取込を実行」を押したときに、通常の取込と同じ確認を経て行われます。
        </p>
        {history.isLoading ? (
          <PageState status="loading" />
        ) : history.isError ? (
          <PageState status="error" error={history.error} />
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>ファイル</th>
                  <th>種別</th>
                  <th>対象月</th>
                  <th title="保存不能行を除く解析済みの入力行です">解析行</th>
                  <th>ステータス</th>
                  <th>やり直し</th>
                </tr>
              </thead>
              <tbody>
                {(history.data?.imports ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="num">{dateTime(r.createdAt)}</td>
                    <td>{r.filename}</td>
                    <td>{(r.kind && KIND_LABEL[r.kind]) ?? '不明'}</td>
                    <td>{r.months.join(', ') || '—'}</td>
                    <td className="num">{r.rows ?? '—'}</td>
                    <td>
                      {r.status === 'committed' || r.status === 'ok' ? (
                        <>
                          <span className="pill calm">{r.status === 'ok' ? '完了(旧履歴)' : '取込完了'}</span>
                          {r.generationState === 'active' && <span className="pill calm">現在有効</span>}
                          {r.generationState === 'partial' && (
                            <span className="pill warn">一部が現在有効</span>
                          )}
                          {r.generationState === 'superseded' && <span className="pill">更新済み</span>}
                        </>
                      ) : r.status === 'duplicate' ? (
                        <>
                          <span className="pill warn">取込済み(スキップ)</span>
                          {r.duplicateOf != null && (
                            <div
                              className="sub"
                              style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                            >
                              現在有効な履歴 #{r.duplicateOf} と同じ内容
                            </div>
                          )}
                        </>
                      ) : r.status === 'processing' || r.status === 'applying' ? (
                        <span className="pill warn">
                          {r.status === 'processing' ? '解析・保存中' : '反映中'}
                        </span>
                      ) : (
                        <>
                          <span className="pill alert">失敗</span>
                          <div
                            className="sub"
                            style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                          >
                            {r.failureReason ?? ((r.status ?? '').replace(/^error:\s*/, '') || '理由不明')}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {r.originalRecorded === true ? (
                        <button
                          type="button"
                          disabled={reimport.isPending || upload.isPending}
                          onClick={() => reimport.mutate(r)}
                        >
                          {reimport.isPending && reimport.variables?.id === r.id
                            ? '原本を取り出し中…'
                            : 'この取込をやり直す'}
                        </button>
                      ) : (
                        <span className="sub" title="この取込は投入した原本を保存していません">
                          原本なし
                        </span>
                      )}
                      {reimport.isError && reimport.variables?.id === r.id && (
                        <div
                          className="sub"
                          style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                          role="alert"
                        >
                          {(reimport.error as Error).message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!history.data?.imports.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      取込履歴はまだありません。上の枠にファイルを入れると、ここに結果が残ります。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
