/**
 * P8 データ取込: ZIP・CSV・Excel・HTML版互換JSONの投入と取込履歴(FR-01)。
 * 同月洗い替えの確認ダイアログを挟む。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef, useState } from 'react';
import { type ImportHistoryRow, type ImportUnitResult, api, apiUpload } from '../api.js';
import { PageHeader, PageState, describeError } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { dateTime } from '../format.js';

const KIND_LABEL: Record<string, ReactNode> = {
  mf: 'MF明細',
  freee: 'freee仕訳',
  json: <Term id="mergedJson" />,
};

/** 取込結果の数量・状態を同じ語彙で表示する再利用単位。 */
export function ImportResultTable({ results }: { results: ImportUnitResult[] }) {
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
                            件。件数が減っています。月の途中までのファイルではないか確認してください(前の内容に戻すには、元のファイルを取り込み直します)。
                          </div>
                        ))}
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
  // 現在有効な世代と同じ内容は既定でスキップする。意図的に再適用したいときだけ ON にする
  const [force, setForce] = useState(false);
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
      const body = await apiUpload<{ results?: ImportUnitResult[] }>('/imports', form, {
        // 複数ファイルの一部成功はHTTPエラーでも結果表を保つ。
        acceptErrorBody: (candidate) =>
          !!candidate && typeof candidate === 'object' && Array.isArray(Reflect.get(candidate, 'results')),
      });
      return body.results ?? [];
    },
    onSuccess: (r) => {
      setResults(r);
      setPending([]);
      setForce(false);
      void qc.invalidateQueries(); // 全ページへ反映
    },
  });

  const accept = (files: FileList | File[]) => {
    const arr = [...files];
    if (arr.length) setPending(arr);
  };

  const confirmAndUpload = () => {
    // 月単位洗い替えの明示(spec §10.3)
    const ok = window.confirm(
      `ファイルに含まれる月の既存データは削除して置き換えます(月単位の洗い替え)。手動判定は明細IDが一致する限り維持され、現金の記帳も残ります。${
        force
          ? '現在有効な内容と同じでも、新しい取込として再適用します。'
          : '現在有効な内容と同じファイルだけスキップします。'
      }取込を実行しますか?`,
    );
    if (ok) upload.mutate(pending);
  };

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
          <button type="button" onClick={() => setPending([])}>
            取消
          </button>
          <label style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />{' '}
            現在有効な内容と同じでも再適用する(通常は不要)
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
          <ImportResultTable results={results} />
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>取込履歴</h2>
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
                  </tr>
                ))}
                {!history.data?.imports.length && (
                  <tr>
                    <td colSpan={6} className="empty">
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
