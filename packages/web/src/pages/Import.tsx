/**
 * P8 データ取込: ZIP・CSV・Excel・HTML版互換JSONの投入と取込履歴(FR-01)。
 * 同月洗い替えの確認ダイアログを挟む。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef, useState } from 'react';
import { AUTH_EVENT, type ImportHistoryRow, type ImportUnitResult, api } from '../api.js';
import { PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { dateTime } from '../format.js';

const KIND_LABEL: Record<string, ReactNode> = {
  mf: 'MF明細',
  freee: 'freee仕訳',
  json: <Term id="mergedJson" />,
};

export function ImportPage() {
  const qc = useQueryClient();
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [results, setResults] = useState<ImportUnitResult[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const history = useQuery({
    queryKey: ['imports'],
    queryFn: () => api<{ imports: ImportHistoryRow[] }>('/imports'),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append('file', f);
      const res = await fetch('/api/imports', { method: 'POST', body: form });
      if (res.status === 401) {
        window.dispatchEvent(new Event(AUTH_EVENT));
        throw new Error('unauthorized');
      }
      const body = (await res.json()) as { results?: ImportUnitResult[]; error?: { message: string } };
      if (!res.ok && !body.results)
        throw new Error(body.error?.message ?? `取込に失敗しました(${res.status})`);
      return body.results ?? [];
    },
    onSuccess: (r) => {
      setResults(r);
      setPending([]);
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
      'ファイルに含まれる月の既存データは削除して置き換えます(月単位の洗い替え)。手動判定は明細IDが一致する限り維持されます。取込を実行しますか?',
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
        </div>
      )}
      {upload.isError && (
        <div className="notice" role="alert">
          取込を実行できませんでした: {(upload.error as Error).message}
          。選択したファイルは残っています。通信状態を確認して、もう一度「取込を実行」を押してください。
        </div>
      )}

      {results && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>取込結果</h2>
          <table className="data">
            <thead>
              <tr>
                <th>ファイル</th>
                <th>種別</th>
                <th>対象月</th>
                <th>有効行</th>
                <th>スキップ</th>
                <th>結果</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.filename}-${r.kind}`}>
                  <td>{r.filename}</td>
                  <td>{KIND_LABEL[r.kind] ?? '不明'}</td>
                  <td>{r.months.join(', ') || '—'}</td>
                  <td className="num">{r.rows}</td>
                  <td className="num">{r.skipped}</td>
                  <td>
                    {r.status === 'ok' ? (
                      <span className="pill calm">
                        成功
                        {r.syntheticIds ? ` (ID補完${r.syntheticIds}件)` : ''}
                        {r.duplicateIds ? ` (ID重複${r.duplicateIds}件)` : ''}
                      </span>
                    ) : (
                      <>
                        <span className="pill alert">失敗</span>
                        <div
                          className="sub"
                          style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                        >
                          {r.reason}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.some((r) => r.status === 'error') && (
            <p className="sub">
              失敗したファイルの内容は反映されていません(成功したファイルは反映済み)。理由に沿ってファイルを出力し直し、もう一度取り込んでください。
            </p>
          )}
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
                  <th>件数</th>
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
                      {r.status === 'ok' ? (
                        <span className="pill calm">成功</span>
                      ) : (
                        <>
                          <span className="pill alert">失敗</span>
                          <div
                            className="sub"
                            style={{ marginTop: 4, whiteSpace: 'normal', textAlign: 'left' }}
                          >
                            {(r.status ?? '').replace(/^error:\s*/, '') || '理由不明'}
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
