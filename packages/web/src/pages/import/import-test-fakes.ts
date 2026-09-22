/**
 * データ取込画面の DOM テスト用の偽サーバ。本番コードからは import しない。
 *
 * 検査は XMLHttpRequest (進捗つき送信)、確定と履歴は fetch で届くので、両方を 1 つの状態で受ける。
 * vitest は import せず、テスト側が `vi.stubGlobal('fetch', server.fetch)` と
 * `vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest)` で差し込む。
 */
import { importInspectionSummary } from '@kanjo/core';
import type {
  ImportInspectionFile,
  ImportInspectionResponse,
  ImportRunCommitResponse,
  ImportRunDetail,
  ImportRunRowView,
} from '../../api.js';

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const inspectionFile = (
  over: Partial<ImportInspectionFile> & { id: string; filename: string },
): ImportInspectionFile => ({
  source: 'mf',
  periodFrom: '2026-06',
  periodTo: '2026-06',
  size: 1024,
  rowCount: 3,
  duplicate: { kind: 'none', count: 0 },
  validation: { kind: 'ok', count: 0 },
  state: 'ready',
  reason: null,
  ...over,
});

export const runRow = (over: Partial<ImportRunRowView> & { id: string }): ImportRunRowView => ({
  createdAt: '2026-09-20T01:00:00.000Z',
  sources: ['mf'],
  fileCount: 1,
  rowCount: 12,
  result: 'success',
  detail: { succeeded: 1, failed: 0, failureSummary: null },
  undoable: true,
  replaceable: true,
  undoDeadline: '2026-10-20T01:00:00.000Z',
  canHide: true,
  hasOriginal: true,
  ...over,
});

export const runDetail = (row: ImportRunRowView, over: Partial<ImportRunDetail> = {}): ImportRunDetail => ({
  ...row,
  periodFrom: '2026-06',
  periodTo: '2026-06',
  keepPrevious: true,
  impact: { added: row.rowCount, skipped: 0, subsCandidates: 0 },
  files: [
    {
      importId: 41,
      filename: '架空-2026-06.csv',
      source: row.sources[0] ?? null,
      state: 'imported',
      status: 'committed',
      rowCount: row.rowCount,
      months: ['2026-06'],
      reason: null,
      hasOriginal: row.hasOriginal,
      generationState: 'active',
      cancelable: row.undoable,
      discardable: false,
    },
  ],
  ...over,
});

type Route = (
  method: string,
  path: string,
  init: RequestInit | undefined,
) => Response | undefined | Promise<Response | undefined>;

export interface ImportServerOptions {
  /** 送られたファイルを検査したときの 1 行。既定は MF の取込準備完了 */
  inspect?: (file: File, id: string) => Partial<ImportInspectionFile>;
  runs?: ImportRunRowView[];
  details?: Record<string, ImportRunDetail>;
  /** 確定の 1 要求で、そのファイルを失敗にするか */
  commitFails?: (file: ImportInspectionFile) => string | null;
  /** 検査の送信を通信エラー (XHR の onerror) で落とすか */
  uploadFails?: (file: File) => boolean;
  /** 上の既定より先に試す経路。undefined を返すと既定へ進む */
  route?: Route;
}

export function createImportServer(options: ImportServerOptions = {}) {
  const calls: string[] = [];
  const bodies: Array<{ path: string; body: unknown }> = [];
  const uploadBatches: string[][] = [];
  let inspection: { id: string; files: ImportInspectionFile[] } | null = null;
  let seq = 0;
  let runSeq = 0;
  // 同じ検査の続きの確定は、最初の要求の run id を親にする
  let parentRun: string | null = null;

  const view = (): ImportInspectionResponse => {
    const files = inspection?.files ?? [];
    return {
      inspection: {
        id: inspection?.id ?? 'insp-none',
        expiresAt: '2026-09-22T12:00:00.000Z',
        files,
        summary: importInspectionSummary(files.map((file) => ({ ...file, subsEstimate: 0 }))),
      },
    };
  };

  const addFile = (file: File) => {
    seq += 1;
    const id = `file-${seq}`;
    inspection?.files.push(
      inspectionFile({ id, filename: file.name, size: file.size, ...options.inspect?.(file, id) }),
    );
  };

  /** XHR (検査の送信) の受け口 */
  const upload = (method: string, path: string, body: unknown): { status: number; body: unknown } => {
    calls.push(`${method} ${path}`);
    const files =
      body instanceof FormData
        ? body.getAll('file').filter((file): file is File => file instanceof File)
        : [];
    uploadBatches.push(files.map((file) => file.name));
    if (!files.length)
      return { status: 400, body: { error: { code: 'bad_request', message: 'file がありません' } } };
    if (path === '/api/imports/inspections') {
      inspection = { id: `insp-${seq + 1}`, files: [] };
      for (const file of files) addFile(file);
      return { status: 201, body: view() };
    }
    const match = path.match(/^\/api\/imports\/inspections\/([^/]+)\/files$/);
    if (match && inspection && match[1] === inspection.id) {
      for (const file of files) addFile(file);
      return { status: 200, body: view() };
    }
    return {
      status: 404,
      body: { error: { code: 'inspection_not_found', message: '検査が見つかりません' } },
    };
  };

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    if (typeof init?.body === 'string') bodies.push({ path, body: JSON.parse(init.body) });
    const custom = await options.route?.(method, path, init);
    if (custom) return custom;

    const removal = path.match(/^\/api\/imports\/inspections\/([^/]+)\/files\/([^/]+)$/);
    if (removal && method === 'DELETE' && inspection) {
      inspection.files = inspection.files.filter((file) => file.id !== removal[2]);
      return jsonResponse(view());
    }
    if (path === '/api/imports/runs' && method === 'POST' && inspection) {
      const request = JSON.parse(String(init?.body)) as { fileIds: string[] };
      // 最初の要求で選ばなかったファイルは、その場で検査から外れる
      if (!parentRun) inspection.files = inspection.files.filter((file) => request.fileIds.includes(file.id));
      const [first, ...rest] = request.fileIds;
      const target = inspection.files.find((file) => file.id === first);
      if (!target)
        return jsonResponse(
          { error: { code: 'nothing_to_import', message: '取り込めるファイルがありません' } },
          400,
        );
      if (!parentRun) {
        runSeq += 1;
        parentRun = `run-${runSeq}`;
      }
      const reason = options.commitFails?.(target) ?? null;
      const response: ImportRunCommitResponse = {
        run: {
          id: parentRun,
          result: reason ? 'failed' : 'success',
          files: [
            {
              id: target.id,
              filename: target.filename,
              state: reason ? 'failed' : 'imported',
              rowCount: reason ? 0 : target.rowCount,
              reason,
            },
          ],
          impact: { added: target.rowCount, skipped: 0, subsCandidates: 0 },
          duplicateCandidates: target.duplicate.kind === 'possible' ? target.duplicate.count : 0,
        },
        remaining: rest,
      };
      if (!rest.length) {
        inspection = null;
        parentRun = null;
      }
      return jsonResponse(response, 201);
    }
    if (path === '/api/imports/runs' || path.startsWith('/api/imports/runs?'))
      return jsonResponse({ runs: options.runs ?? [] });
    const detail = path.match(/^\/api\/imports\/runs\/([^/?]+)$/);
    if (detail && method === 'GET') {
      const found = options.details?.[detail[1]];
      return found
        ? jsonResponse({ run: found })
        : jsonResponse({ error: { code: 'not_found', message: '見つかりません' } }, 404);
    }
    if (path.startsWith('/api/summary')) return jsonResponse({});
    if (path === '/api/data/operations') return jsonResponse({ operations: [] });
    if (path === '/api/sub-vendors/candidates') return jsonResponse({ candidates: [] });
    if (path === '/api/total-cashflow') return jsonResponse({ months: [] });
    if (path === '/api/imports' && method === 'GET') return jsonResponse({ imports: [] });
    throw new Error(`unexpected request: ${method} ${path}`);
  };

  /** 送信を 1 タスク遅らせて返す XHR。進捗は 1 回だけ 100% を報せる */
  class FakeXhr {
    status = 0;
    responseText = '';
    upload: {
      onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
    } = {
      onprogress: null,
    };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private method = 'GET';
    private url = '';
    private aborted = false;
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    abort() {
      this.aborted = true;
      this.onabort?.();
    }
    send(body: unknown) {
      setTimeout(() => {
        if (this.aborted) return;
        const files =
          body instanceof FormData
            ? body.getAll('file').filter((file): file is File => file instanceof File)
            : [];
        if (files.some((file) => options.uploadFails?.(file))) {
          calls.push(`${this.method} ${this.url}`);
          this.onerror?.();
          return;
        }
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
        const result = upload(this.method, this.url, body);
        this.status = result.status;
        this.responseText = JSON.stringify(result.body);
        this.onload?.();
      }, 0);
    }
  }

  return {
    calls,
    bodies,
    uploadBatches,
    fetch,
    XMLHttpRequest: FakeXhr,
    /** 今の検査のファイル (確定で消費されたら空) */
    inspectionFiles: () => inspection?.files ?? [],
  };
}

/** ファイル選択の隠し input に流し込む */
export function chooseImportFiles(files: File[]) {
  const input = document.querySelector('input#import-files') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export const csvFile = (name: string, body = '計算対象,日付\n1,2026/06/10\n') =>
  new File([body], name, { type: 'text/csv' });
