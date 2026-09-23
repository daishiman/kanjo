/**
 * データ取込画面の API 契約 (SYS-IMPORT-P04)。全 fixture は架空値のみ。
 *
 *   検査 … 明細の表を 1 行も書かず、ファイルごとの結果と要約を返す
 *   確定 … 本人の・期限内の検査 ID だけを受け、同じ選択の再送は保存済み結果を返す
 *   履歴 … 取込 1 回を 1 行で返し、取り消し・置換・非表示を run 単位で行う
 *   門   … 413 は本文を読む前、Origin 違いは 403、回数超過は 429
 *   夜間保守 … 期限切れの検査・仮置き・古い時間枠を消す
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_LIMITS,
  IMPORT_LIMIT_BOUNDARY_CASES,
  IMPORT_MB,
  importBodyLimitBytes,
  importLimitReason,
} from '@kanjo/core';
import { zipSync } from 'fflate';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import {
  IMPORT_STAGING_PREFIX,
  purgeExpiredImportRows,
  runImportStagingCleanup,
} from './import-rate-limit.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { sanitizeImportFilename } from './routes/imports.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie = '';

async function applyMigrations(database: D1Database): Promise<void> {
  const list = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of list) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, list);
}

const freeeCsv = (amount: number, day = '02'): string =>
  ['収支区分,発生日,勘定科目,金額,取引先', `支出,2026/07/${day},架空通信費,${amount},架空SaaS`].join('\n');

const mfCsv = (count: number, month = '08'): string =>
  [
    '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
    ...Array.from(
      { length: count },
      (_, index) =>
        `1,2026/${month}/${String((index % 28) + 1).padStart(2, '0')},-${index + 1},架空費,架空内訳,0,架空-${index},mf-${month}-${index},架空口座`,
    ),
  ].join('\n');

const env = () => ({ ...auth, DB: d1, FILES: files });

const request = (path: string, init: RequestInit = {}, as = cookie) =>
  app.request(
    `/api${path}`,
    { ...init, headers: { cookie: as, ...((init.headers as Record<string, string>) ?? {}) } },
    env(),
  );

const upload = (entries: Array<{ name: string; body: string | Uint8Array }>): FormData => {
  const form = new FormData();
  for (const entry of entries) form.append('file', new File([entry.body], entry.name));
  return form;
};

const postJson = (path: string, body: unknown, as = cookie) =>
  request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    as,
  );

interface InspectionFile {
  id: string;
  filename: string;
  source: string | null;
  rowCount: number;
  state: string;
  reason: string | null;
  duplicate: { kind: string; count: number };
}
interface InspectionBody {
  inspection: { id: string; expiresAt: string; files: InspectionFile[]; summary: Record<string, number> };
}

interface CommittedRun {
  id: string;
  result: string;
  files: Array<{ id: string; state: string }>;
  impact: { added: number; skipped: number; subsCandidates: number };
}

/**
 * 画面と同じ手順で確定する。1 要求で確定するのは 1 ファイルで、残りの ID が空になるまで呼び直す。
 * 各応答の run.id は同じ取込 1 回 (最初の run) を指す。
 */
async function commitAll(
  inspectionId: string,
  fileIds: string[],
  extra: Record<string, unknown> = {},
): Promise<{ runs: CommittedRun[]; files: CommittedRun['files'] }> {
  const runs: CommittedRun[] = [];
  let pending = fileIds;
  while (pending.length) {
    const response = await postJson('/imports/runs', { inspectionId, fileIds: pending, ...extra });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { run: CommittedRun; remaining: string[] };
    runs.push(body.run);
    expect(body.remaining.length).toBeLessThan(pending.length);
    pending = body.remaining;
  }
  return { runs, files: runs.flatMap((run) => run.files) };
}

async function inspect(
  entries: Array<{ name: string; body: string | Uint8Array }>,
  as = cookie,
): Promise<InspectionBody> {
  const response = await request('/imports/inspections', { method: 'POST', body: upload(entries) }, as);
  expect(response.status).toBe(201);
  return (await response.json()) as InspectionBody;
}

/** 取込の表以外 (検査・時間枠・監査・セッション) を除いた、明細側の表の行数 */
async function canonicalRowCounts(): Promise<Record<string, number>> {
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  const ignored = new Set([
    'import_inspections',
    'import_inspection_files',
    'import_rate_limits',
    'audit_log',
    'sessions',
    'users',
    'password_login_rate_limits',
  ]);
  const counts: Record<string, number> = {};
  for (const { name } of tables.results) {
    if (ignored.has(name) || !isApplicationTableForTestReset(name)) continue;
    const row = await d1.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>();
    counts[name] = row?.n ?? 0;
  }
  return counts;
}

const stagedKeys = async (): Promise<string[]> =>
  (await files.list({ prefix: IMPORT_STAGING_PREFIX })).objects.map((object) => object.key);

/** 1 分の時間枠をまたぐと回数が戻るので、枠の終わり際なら次の枠まで待つ */
async function waitForFreshRateWindow(): Promise<void> {
  const remaining = 60_000 - (Date.now() % 60_000);
  if (remaining < 10_000) await new Promise((done) => setTimeout(done, remaining + 50));
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'import-screen-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
}, 60_000);

beforeEach(async () => {
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name)))
    await d1.prepare(`DELETE FROM "${name}"`).run();
  const listed = await files.list();
  for (const object of listed.objects) await files.delete(object.key);
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('検査', () => {
  it('明細の表を 1 行も書かず、ファイルごとの結果と要約を返し、原本を仮置きする', async () => {
    const before = await canonicalRowCounts();
    const body = await inspect([
      { name: 'freee.csv', body: freeeCsv(1200) },
      { name: 'mf.csv', body: mfCsv(3) },
      { name: 'broken.csv', body: 'これは明細ではありません' },
    ]);
    expect(await canonicalRowCounts()).toEqual(before);

    const [freee, mf, broken] = body.inspection.files;
    expect(freee.source).toBe('freee');
    expect(freee.state).toBe('ready');
    expect(mf.source).toBe('mf');
    expect(mf.rowCount).toBe(3);
    expect(mf.state).toBe('ready');
    expect(broken.state).toBe('blocked');
    expect(broken.reason).not.toBeNull();
    expect(body.inspection.summary.fileCount).toBe(3);
    expect(body.inspection.summary.errorCount).toBe(1);
    expect(body.inspection.summary.importableCount).toBe(2);

    const staged = await stagedKeys();
    expect(staged).toHaveLength(3);
    const expires = Date.parse(body.inspection.expiresAt) - Date.now();
    expect(expires).toBeGreaterThan(IMPORT_LIMITS.stagingTtlMs - 60_000);
    expect(expires).toBeLessThanOrEqual(IMPORT_LIMITS.stagingTtlMs);
  });

  it('ファイルの追加と削除は同じ検査 ID の上で行い、期限は延ばさない', async () => {
    const first = await inspect([{ name: 'freee.csv', body: freeeCsv(100) }]);
    const added = await request(`/imports/inspections/${first.inspection.id}/files`, {
      method: 'POST',
      body: upload([{ name: 'mf.csv', body: mfCsv(2) }]),
    });
    expect(added.status).toBe(200);
    const addedBody = (await added.json()) as InspectionBody;
    expect(addedBody.inspection.files.map((file) => file.filename)).toEqual(['freee.csv', 'mf.csv']);
    expect(addedBody.inspection.expiresAt).toBe(first.inspection.expiresAt);

    const removed = await request(
      `/imports/inspections/${first.inspection.id}/files/${addedBody.inspection.files[0].id}`,
      { method: 'DELETE' },
    );
    expect(removed.status).toBe(200);
    const removedBody = (await removed.json()) as InspectionBody;
    expect(removedBody.inspection.files.map((file) => file.filename)).toEqual(['mf.csv']);
    expect(await stagedKeys()).toHaveLength(1);
  });

  it('取込済みと同一のファイルは、強制しない限り取込不可になる', async () => {
    const first = await inspect([{ name: 'freee.csv', body: freeeCsv(700) }]);
    const committed = await postJson('/imports/runs', {
      inspectionId: first.inspection.id,
      fileIds: first.inspection.files.map((file) => file.id),
    });
    expect(committed.status).toBe(201);

    const again = await inspect([{ name: 'freee.csv', body: freeeCsv(700) }]);
    expect(again.inspection.files[0].duplicate.kind).toBe('identical');
    expect(again.inspection.files[0].state).toBe('blocked');
    expect(again.inspection.files[0].reason).toBe('取込済みと同一');
  });

  it('ZIP のエントリ 1,000 件は検査に通り、1,001 件は展開せずに取込不可にする', async () => {
    const entries = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`e-${index}.txt`, new Uint8Array([0x30])]),
      );
    const body = await inspect([
      { name: 'ok.zip', body: zipSync(entries(IMPORT_LIMITS.maxArchiveEntries)) },
      { name: 'over.zip', body: zipSync(entries(IMPORT_LIMITS.maxArchiveEntries + 1)) },
    ]);
    const [ok, over] = body.inspection.files;
    expect(ok.reason ?? '').not.toContain('エントリ数');
    expect(over.state).toBe('blocked');
    expect(over.reason).toBe('エントリ数 1,000 件超');
    // 上限超過は仮置きもしない
    expect(await stagedKeys()).toHaveLength(1);
  });

  it('ファイル名は制御文字とパスの区切りを除き、256 文字は拡張子を残して 255 文字に切る', async () => {
    const long = `${'あ'.repeat(252)}.csv`;
    expect([...long]).toHaveLength(256);
    const body = await inspect([{ name: long, body: freeeCsv(10) }]);
    const recorded = body.inspection.files[0].filename;
    expect([...recorded]).toHaveLength(IMPORT_LIMITS.maxFilenameLength);
    expect(recorded.endsWith('.csv')).toBe(true);
    expect(body.inspection.files[0].source).toBe('freee');

    expect(sanitizeImportFilename('a/b\\c\u0000.csv')).toBe('a_b_c.csv');
    expect(sanitizeImportFilename('\u0007')).toBe('import');
  });
});

describe('外部への送信', () => {
  /**
   * 取込の経路 (検査・追加・確定・履歴) は、利用者の明細を外部ホストへ送らない (spec の S6)。
   * globalThis.fetch を記録係に差し替え、localhost 以外への要求を数える。外部宛ては実際には送らない。
   * miniflare の D1 / R2 はローカルの通信なので数えない。
   */
  it('検査から確定・履歴まで、localhost 以外への要求は 0 件', async () => {
    const original = globalThis.fetch;
    const external: string[] = [];
    const local = new Set(['localhost', '127.0.0.1', '[::1]']);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (!local.has(url.hostname)) {
        external.push(url.origin);
        return new Response(null, { status: 599 });
      }
      return original(input, init);
    }) as typeof fetch;
    try {
      // 記録係が、アプリの見る global に付いていることを先に確かめる
      await globalThis.fetch('https://detector.invalid/');
      expect(external).toEqual(['https://detector.invalid']);
      external.length = 0;

      const body = await inspect([{ name: 'freee.csv', body: freeeCsv(1500) }]);
      const added = await request(`/imports/inspections/${body.inspection.id}/files`, {
        method: 'POST',
        body: upload([{ name: 'mf.csv', body: mfCsv(2) }]),
      });
      expect(added.status).toBe(200);
      const fileIds = ((await added.json()) as InspectionBody).inspection.files.map((file) => file.id);
      const { runs } = await commitAll(body.inspection.id, fileIds);
      expect((await request('/imports/runs')).status).toBe(200);
      expect((await request(`/imports/runs/${runs[0]?.id}`)).status).toBe(200);
      expect(external).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('確定', () => {
  it('確定応答を受け取れなくても同じ選択を再送すれば残りへ進み、完了後の再送は二重取込しない', async () => {
    // 初回の multipart 1 要求で 3 ファイルを同じ検査 ID に載せる。
    const body = await inspect([
      { name: 'freee.csv', body: freeeCsv(910) },
      { name: 'mf-08.csv', body: mfCsv(2) },
      { name: 'mf-09.csv', body: mfCsv(1, '09') },
    ]);
    const payload = {
      inspectionId: body.inspection.id,
      fileIds: body.inspection.files.map((file) => file.id),
    };
    expect(payload.fileIds).toHaveLength(3);
    const inspections = await d1
      .prepare('SELECT COUNT(*) AS n FROM import_inspections WHERE id=?')
      .bind(payload.inspectionId)
      .first<{ n: number }>();
    expect(inspections?.n).toBe(1);

    // 1 件目の応答だけをクライアントが失ったとみなし、元と同じ payload を再送する。
    const first = await postJson('/imports/runs', payload);
    expect(first.status).toBe(201);
    const recovered = await postJson('/imports/runs', payload);
    expect(recovered.status).toBe(201);
    const recoveredBody = (await recovered.json()) as { run: CommittedRun; remaining: string[] };
    expect(recoveredBody.run.files.map((file) => file.id)).toEqual([payload.fileIds[0]]);
    expect(recoveredBody.remaining).toEqual(payload.fileIds.slice(1));

    // ここからは Web と同じく remaining だけを次へ渡し、全ファイルの結果が 1 回ずつ届く。
    const second = await postJson('/imports/runs', {
      ...payload,
      fileIds: recoveredBody.remaining,
    });
    expect(second.status).toBe(201);
    const secondBody = (await second.json()) as { run: CommittedRun; remaining: string[] };
    expect(secondBody.run.files.map((file) => file.id)).toEqual([payload.fileIds[1]]);
    expect(secondBody.remaining).toEqual([payload.fileIds[2]]);
    const third = await postJson('/imports/runs', { ...payload, fileIds: secondBody.remaining });
    expect(third.status).toBe(201);
    const thirdBody = (await third.json()) as { run: CommittedRun; remaining: string[] };
    expect(thirdBody.run.files.map((file) => file.id)).toEqual([payload.fileIds[2]]);
    expect(thirdBody.remaining).toEqual([]);
    expect(
      [...recoveredBody.run.files, ...secondBody.run.files, ...thirdBody.run.files].map((file) => file.id),
    ).toEqual(payload.fileIds);

    const beforeReplay = await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>();
    const replay = await postJson('/imports/runs', payload);
    expect(replay.status).toBe(201);
    const replayBody = (await replay.json()) as { run: CommittedRun; remaining: string[] };
    expect(replayBody.run.id).toBe(thirdBody.run.id);
    expect(replayBody.run.files.map((file) => file.id)).toEqual(payload.fileIds);
    expect(replayBody.remaining).toEqual([]);
    const afterReplay = await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>();
    expect(afterReplay?.n).toBe(beforeReplay?.n);

    const recorded = await d1
      .prepare('SELECT file_count,row_count FROM import_runs WHERE id=?')
      .bind(thirdBody.run.id)
      .first<{ file_count: number; row_count: number }>();
    expect(recorded).toEqual({ file_count: 3, row_count: 4 });
  });

  it('本人の検査 ID だけで明細を書き、同じ選択の再送は取込を増やさず同じ結果を返す', async () => {
    const body = await inspect([
      { name: 'freee.csv', body: freeeCsv(900) },
      { name: 'mf.csv', body: mfCsv(4) },
    ]);
    const payload = {
      inspectionId: body.inspection.id,
      fileIds: body.inspection.files.map((file) => file.id),
    };
    // 1 要求 1 ファイル: 2 ファイルは 2 要求になり、どちらも同じ取込 1 回を返す
    const { runs: calls, files: committedFiles } = await commitAll(payload.inspectionId, payload.fileIds);
    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((call) => call.id)).size).toBe(1);
    const run = calls[calls.length - 1] as CommittedRun;
    expect(run.result).toBe('success');
    expect(committedFiles.map((file) => file.state)).toEqual(['imported', 'imported']);
    expect(run.impact.added).toBe(calls.reduce((max, call) => Math.max(max, call.impact.added), 0));

    const recorded = await d1
      .prepare('SELECT file_count,row_count,result,keep_previous FROM import_runs WHERE id=?')
      .bind(run.id)
      .first<{ file_count: number; row_count: number; result: string; keep_previous: number }>();
    expect(recorded).toEqual({ file_count: 2, row_count: 5, result: 'success', keep_previous: 1 });
    // 2 本目は子の run で、値を持たず親を指す
    const children = await d1
      .prepare('SELECT file_count FROM import_runs WHERE parent_run_id=?')
      .bind(run.id)
      .all<{ file_count: number | null }>();
    expect(children.results).toEqual([{ file_count: null }]);

    // 仮置きは片づけ、再送の照合に必要な結果だけを期限まで残す
    expect(await stagedKeys()).toEqual([]);
    const left = await d1
      .prepare('SELECT error_kind,r2_key FROM import_inspection_files ORDER BY position')
      .all<{ error_kind: string | null; r2_key: string | null }>();
    expect(left.results).toEqual([
      { error_kind: 'committed', r2_key: null },
      { error_kind: 'committed', r2_key: null },
    ]);

    const beforeReplay = await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>();
    const second = await postJson('/imports/runs', payload);
    expect(second.status).toBe(201);
    const replay = (await second.json()) as { run: CommittedRun; remaining: string[] };
    expect(replay.run.id).toBe(run.id);
    expect(replay.remaining).toEqual([]);
    const afterReplay = await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>();
    expect(afterReplay?.n).toBe(beforeReplay?.n);

    // 完了記録は再送にだけ使い、検査のファイル構成は後から変えられない
    const addAfterCommit = await request(`/imports/inspections/${body.inspection.id}/files`, {
      method: 'POST',
      body: upload([{ name: 'later.csv', body: freeeCsv(1) }]),
    });
    expect(addAfterCommit.status).toBe(404);
    const deleteAfterCommit = await request(
      `/imports/inspections/${body.inspection.id}/files/${body.inspection.files[0].id}`,
      { method: 'DELETE' },
    );
    expect(deleteAfterCommit.status).toBe(404);
  });

  it('本人以外の検査 ID と期限切れの検査 ID は、どちらも同じ 404 にする', async () => {
    const mine = await inspect([{ name: 'freee.csv', body: freeeCsv(300) }]);
    const other = await loginForTest(
      app,
      { ...auth, DB: d1 },
      {
        id: 'usr_test_other',
        email: 'other@example.test',
        password: 'synthetic-other-password',
        role: 'member',
      },
    );
    const stolen = await postJson(
      '/imports/runs',
      { inspectionId: mine.inspection.id, fileIds: mine.inspection.files.map((file) => file.id) },
      other,
    );
    expect(stolen.status).toBe(404);
    const stolenBody = await stolen.json();
    const stolenFiles = await request(
      `/imports/inspections/${mine.inspection.id}/files`,
      { method: 'POST', body: upload([{ name: 'x.csv', body: freeeCsv(1) }]) },
      other,
    );
    expect(stolenFiles.status).toBe(404);

    await d1
      .prepare('UPDATE import_inspections SET expires_at=? WHERE id=?')
      .bind(new Date(Date.now() - 1000).toISOString(), mine.inspection.id)
      .run();
    const expired = await postJson('/imports/runs', {
      inspectionId: mine.inspection.id,
      fileIds: mine.inspection.files.map((file) => file.id),
    });
    expect(expired.status).toBe(404);
    expect(await expired.json()).toEqual(stolenBody);
  });

  it('最初の確定で選ばなかったファイルは外し、完了済みファイルの再送は同じ結果を返す', async () => {
    const body = await inspect([
      { name: 'freee.csv', body: freeeCsv(60) },
      { name: 'mf.csv', body: mfCsv(2) },
      { name: 'mf-09.csv', body: mfCsv(1, '09') },
    ]);
    const [freee, , mf09] = body.inspection.files;
    const first = await postJson('/imports/runs', {
      inspectionId: body.inspection.id,
      fileIds: [freee.id, mf09.id],
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { run: CommittedRun; remaining: string[] };
    expect(firstBody.remaining).toEqual([mf09.id]);
    // 選ばなかった mf.csv は仮置きごと外れ、残りは mf-09.csv だけ
    expect(await stagedKeys()).toHaveLength(1);
    const reselect = await postJson('/imports/runs', {
      inspectionId: body.inspection.id,
      fileIds: body.inspection.files.map((file) => file.id),
    });
    expect(reselect.status).toBe(404);
    const last = await postJson('/imports/runs', { inspectionId: body.inspection.id, fileIds: [mf09.id] });
    expect(last.status).toBe(201);
    expect(((await last.json()) as { run: CommittedRun; remaining: string[] }).remaining).toEqual([]);
    expect(await stagedKeys()).toEqual([]);
    const again = await postJson('/imports/runs', { inspectionId: body.inspection.id, fileIds: [mf09.id] });
    expect(again.status).toBe(201);
    expect(((await again.json()) as { run: CommittedRun; remaining: string[] }).remaining).toEqual([]);
    const { runs } = (await (await request('/imports/runs')).json()) as {
      runs: Array<{ id: string; fileCount: number }>;
    };
    expect(runs).toEqual([expect.objectContaining({ id: firstBody.run.id, fileCount: 2 })]);
  });

  it('取込不可のファイルだけを選んだ確定は 400 で、検査はそのまま選び直せる', async () => {
    const body = await inspect([
      { name: 'broken.csv', body: '明細ではない' },
      { name: 'freee.csv', body: freeeCsv(50) },
    ]);
    const [broken, freee] = body.inspection.files;
    const rejected = await postJson('/imports/runs', {
      inspectionId: body.inspection.id,
      fileIds: [broken.id],
    });
    expect(rejected.status).toBe(400);
    const retried = await postJson('/imports/runs', {
      inspectionId: body.inspection.id,
      fileIds: [freee.id],
    });
    expect(retried.status).toBe(201);
  });
});

describe('履歴', () => {
  async function commitRun(entries: Array<{ name: string; body: string | Uint8Array }>): Promise<string> {
    const body = await inspect(entries);
    const { runs } = await commitAll(
      body.inspection.id,
      body.inspection.files.map((file) => file.id),
    );
    return (runs[0] as CommittedRun).id;
  }

  it('取込 1 回を 1 行で返し、詳細はファイルごとの行を持つ。別テナントの取込 ID は 404', async () => {
    const runId = await commitRun([
      { name: 'freee.csv', body: freeeCsv(500) },
      { name: 'mf.csv', body: mfCsv(2) },
    ]);
    const list = await request('/imports/runs');
    expect(list.status).toBe(200);
    const { runs } = (await list.json()) as {
      runs: Array<{
        id: string;
        fileCount: number;
        rowCount: number;
        result: string;
        undoable: boolean;
        canHide: boolean;
      }>;
    };
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: runId,
      fileCount: 2,
      rowCount: 3,
      result: 'success',
      undoable: true,
      canHide: false,
    });

    const detail = await request(`/imports/runs/${runId}`);
    expect(detail.status).toBe(200);
    const { run } = (await detail.json()) as {
      run: { files: Array<{ filename: string; state: string; hasOriginal: boolean }>; impact: unknown };
    };
    expect(run.files.map((file) => file.filename).sort()).toEqual(['freee.csv', 'mf.csv']);
    expect(run.files.every((file) => file.state === 'imported' && file.hasOriginal)).toBe(true);
    expect(run.impact).not.toBeNull();

    const other = await loginForTest(
      app,
      { ...auth, DB: d1 },
      {
        id: 'usr_test_other',
        email: 'other@example.test',
        password: 'synthetic-other-password',
        role: 'member',
      },
    );
    // 取込の履歴は業務データと同じく共有テナント (user_id) のもの。同じ家計の別メンバーには見える
    expect((await request(`/imports/runs/${runId}`, {}, other)).status).toBe(200);
    // 別テナントの取込 ID は、存在していても 404 で区別させない
    await d1
      .prepare(
        `INSERT INTO import_runs (id,user_id,status,created_at,updated_at,file_count,row_count,result)
         VALUES ('run-foreign','tenant-foreign','committed','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',1,1,'success')`,
      )
      .run();
    expect((await request('/imports/runs/run-foreign')).status).toBe(404);
    const listed = (await (await request('/imports/runs')).json()) as { runs: Array<{ id: string }> };
    expect(listed.runs.map((entry) => entry.id)).toEqual([runId]);
  });

  it('取り消しは確認した指紋で run の全ファイルを戻し、取り消し済みの履歴だけ非表示にできる', async () => {
    const runId = await commitRun([{ name: 'freee.csv', body: freeeCsv(800) }]);
    // 成功した取込は非表示にできない
    const blocked = await postJson('/imports/runs/hide', { ids: [runId] });
    expect(blocked.status).toBe(409);

    const preflight = await request(`/imports/runs/${runId}/undo/preflight`, { method: 'POST' });
    expect(preflight.status).toBe(200);
    const plan = (await preflight.json()) as { imports: Array<{ importId: number; fingerprint: string }> };
    expect(plan.imports).toHaveLength(1);

    const mismatched = await postJson(`/imports/runs/${runId}/undo`, {
      fingerprints: [{ importId: plan.imports[0].importId + 999, fingerprint: plan.imports[0].fingerprint }],
    });
    expect(mismatched.status).toBe(409);

    const undone = await postJson(`/imports/runs/${runId}/undo`, {
      fingerprints: plan.imports.map(({ importId, fingerprint }) => ({ importId, fingerprint })),
    });
    expect(undone.status).toBe(200);
    // lease は解放済み
    const claims = await d1.prepare('SELECT COUNT(*) AS n FROM import_writer_claims').first<{ n: number }>();
    expect(claims?.n).toBe(0);

    const { runs } = (await (await request('/imports/runs')).json()) as {
      runs: Array<{ result: string; canHide: boolean; undoable: boolean }>;
    };
    expect(runs[0]).toMatchObject({ result: 'undone', canHide: true, undoable: false });
    expect((await request(`/imports/runs/${runId}/undo/preflight`, { method: 'POST' })).status).toBe(409);

    const hidden = await postJson('/imports/runs/hide', { ids: [runId] });
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ hidden: 1 });
    expect(((await (await request('/imports/runs')).json()) as { runs: unknown[] }).runs).toEqual([]);
    // 非表示は記録を消さない
    const row = await d1
      .prepare('SELECT hidden_at FROM import_runs WHERE id=?')
      .bind(runId)
      .first<{ hidden_at: string }>();
    expect(row?.hidden_at).not.toBeNull();
  });

  it('非表示は 1 回 100 件までで、他人の ID が混ざれば 404', async () => {
    const tooMany = await postJson('/imports/runs/hide', {
      ids: Array.from({ length: IMPORT_LIMITS.maxHideIds + 1 }, (_, index) => `run-${index}`),
    });
    expect(tooMany.status).toBe(400);
    const unknown = await postJson('/imports/runs/hide', { ids: ['run-not-mine'] });
    expect(unknown.status).toBe(404);
  });

  it('失敗した履歴 100 件は 1 回で非表示にでき、明細の表は 1 行も変わらない', async () => {
    const runId = await commitRun([{ name: 'mf.csv', body: mfCsv(2) }]);
    const owner = await d1
      .prepare('SELECT user_id FROM import_runs WHERE id=?')
      .bind(runId)
      .first<{ user_id: string }>();
    const ids = Array.from({ length: IMPORT_LIMITS.maxHideIds }, (_, index) => `run-failed-${index}`);
    await d1.batch(
      ids.map((id) =>
        d1
          .prepare(
            `INSERT INTO import_runs (id,user_id,status,created_at,updated_at,file_count,row_count,result)
             VALUES (?,?,'committed','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',1,0,'failed')`,
          )
          .bind(id, owner?.user_id),
      ),
    );
    const before = await canonicalRowCounts();

    const hidden = await postJson('/imports/runs/hide', { ids });
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ hidden: IMPORT_LIMITS.maxHideIds });
    // 非表示は hidden_at を埋めるだけで、行は消さない
    expect(await canonicalRowCounts()).toEqual(before);
    const { runs } = (await (await request('/imports/runs')).json()) as { runs: Array<{ id: string }> };
    expect(runs.map((entry) => entry.id)).toEqual([runId]);
  });

  it('置換は保存した原本で強制再取込し、複数ファイルでも新しい取込 1 回として記録する', async () => {
    const runId = await commitRun([
      { name: 'mf.csv', body: mfCsv(3) },
      { name: 'freee.csv', body: freeeCsv(40) },
    ]);
    const replaced = await request(`/imports/runs/${runId}/reimport`, { method: 'POST' });
    expect(replaced.status).toBe(201);
    const first = (await replaced.json()) as { run: CommittedRun; remaining: string[] };
    expect(first.run.id).not.toBe(runId);
    expect(first.remaining).toHaveLength(1);
    const next = await postJson(`/imports/runs/${runId}/reimport`, {
      filenames: first.remaining,
      intoRunId: first.run.id,
    });
    expect(next.status).toBe(201);
    const second = (await next.json()) as { run: CommittedRun; remaining: string[] };
    expect(second.run.id).toBe(first.run.id);
    expect(second.remaining).toEqual([]);
    expect(second.run.result).toBe('success');
    const { runs } = (await (await request('/imports/runs')).json()) as {
      runs: Array<{ id: string; fileCount: number }>;
    };
    expect(runs.map((entry) => entry.id).sort()).toEqual([runId, first.run.id].sort());
    expect(runs.find((entry) => entry.id === first.run.id)?.fileCount).toBe(2);
    // 他人の run へは足せない
    const bogus = await postJson(`/imports/runs/${runId}/reimport`, {
      filenames: ['mf.csv'],
      intoRunId: 'run-not-mine',
    });
    expect(bogus.status).toBe(404);
  });
});

describe('前回データを残す', () => {
  const entries = [
    { name: 'freee.csv', body: freeeCsv(700) },
    { name: 'mf.csv', body: mfCsv(4) },
  ];

  /** 同じ内容は検査で取込不可になるので、2 回目以降は強制して確定する */
  async function commitAgain(extra: Record<string, unknown>): Promise<CommittedRun> {
    const body = await inspect(entries);
    const { runs } = await commitAll(
      body.inspection.id,
      body.inspection.files.map((file) => file.id),
      { force: true, ...extra },
    );
    return runs[runs.length - 1] as CommittedRun;
  }

  const recordedImpact = (runId: string) =>
    d1
      .prepare(
        'SELECT added_count AS added,skipped_count AS skipped,subs_candidate_count AS subsCandidates,keep_previous FROM import_runs WHERE id=?',
      )
      .bind(runId)
      .first<{ added: number; skipped: number; subsCandidates: number; keep_previous: number }>();

  /** 明細の正本 (MF の取引と freee の取引) の行数 */
  const activeRows = async (): Promise<number> =>
    (
      await d1
        .prepare('SELECT (SELECT COUNT(*) FROM mf_transactions) + (SELECT COUNT(*) FROM freee_deals) AS n')
        .first<{ n: number }>()
    )?.n ?? 0;

  const nonZeroAggregates = async () =>
    (
      await d1
        .prepare('SELECT month,scope,amount FROM monthly_agg WHERE amount<>0 ORDER BY month,scope')
        .all()
    ).results;

  it('オンで同じファイルを確定し直しても明細は増えず、全行を飛ばしたと記録する', async () => {
    const first = await inspect(entries);
    const { runs } = await commitAll(
      first.inspection.id,
      first.inspection.files.map((file) => file.id),
    );
    const firstRun = runs[runs.length - 1] as CommittedRun;
    expect(firstRun.impact).toMatchObject({ added: 5, skipped: 0 });
    const rowsBefore = await activeRows();
    const tablesBefore = await canonicalRowCounts();
    const aggregatesBefore = await nonZeroAggregates();
    expect(rowsBefore).toBe(5);

    const again = await commitAgain({});
    expect(again.impact).toMatchObject({ added: 0, skipped: 5 });
    expect(await activeRows()).toBe(rowsBefore);
    const tablesAfter = await canonicalRowCounts();
    // 増えてよいのは取込の記録 (imports・import_runs と付随する表) だけで、明細の行数は変わらない
    for (const [name, count] of Object.entries(tablesBefore)) {
      if (name.startsWith('import') || name === 'monthly_agg') continue;
      expect(tablesAfter[name], name).toBe(count);
    }
    // monthly_agg は Dataset から作り直す派生キャッシュで、0 円の行は出入りしうる。値のある行は変わらない
    expect(await nonZeroAggregates()).toEqual(aggregatesBefore);

    // 詳細の impact は、確定時に記録した値そのもの
    const recorded = await recordedImpact(again.id);
    expect(recorded).toMatchObject({ added: 0, skipped: 5, keep_previous: 1 });
    const detail = (await (await request(`/imports/runs/${again.id}`)).json()) as {
      run: { impact: CommittedRun['impact'] };
    };
    expect(detail.run.impact).toEqual({
      added: recorded?.added,
      skipped: recorded?.skipped,
      subsCandidates: recorded?.subsCandidates,
    });
  });

  it('オフは月単位の入れ替えで、同じ内容なら明細の数は変わらず全行を追加と数える', async () => {
    const first = await inspect(entries);
    await commitAll(
      first.inspection.id,
      first.inspection.files.map((file) => file.id),
    );
    const rowsBefore = await activeRows();

    const replaced = await commitAgain({ keepPrevious: false });
    expect(replaced.impact).toMatchObject({ added: 5, skipped: 0 });
    expect(await activeRows()).toBe(rowsBefore);
    expect(await recordedImpact(replaced.id)).toMatchObject({ added: 5, skipped: 0, keep_previous: 0 });
  });
});

describe('413: 本文を読む前に拒否する', () => {
  const overTotal = IMPORT_LIMITS.maxTotalBytes + 1;

  it('Content-Length が本文の上限を超えれば、本文を 1 byte も読まずに 413', async () => {
    let pulled = false;
    // highWaterMark 0: 既定の 1 だと作った直後に 1 回 pull され、読まれたかどうかを区別できない
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
          throw new Error('本文を読んではいけない');
        },
      },
      { highWaterMark: 0 },
    );
    const response = await app.request(
      '/api/imports/inspections',
      {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'multipart/form-data; boundary=synthetic',
          'content-length': String(importBodyLimitBytes() + 1),
        },
        body: stream,
        duplex: 'half',
      } as RequestInit,
      env(),
    );
    expect(response.status).toBe(413);
    expect(pulled).toBe(false);
    const count = await d1.prepare('SELECT COUNT(*) AS n FROM import_inspections').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('旧来の POST /imports にも同じ本文の上限が掛かる', async () => {
    const response = await app.request(
      '/api/imports',
      {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'multipart/form-data; boundary=synthetic',
          'content-length': String(importBodyLimitBytes() + 1),
        },
        body: new ReadableStream<Uint8Array>({}, { highWaterMark: 0 }),
        duplex: 'half',
      } as RequestInit,
      env(),
    );
    expect(response.status).toBe(413);
  });

  it('旧来の POST /imports も 11 ファイルは 413 にし、1 件も取り込まない (互換経路)', async () => {
    const before = await canonicalRowCounts();
    const entries = Array.from({ length: IMPORT_LIMITS.maxFiles + 1 }, (_, index) => ({
      name: `mf-${index}.csv`,
      body: mfCsv(1, String((index % 12) + 1).padStart(2, '0')),
    }));
    const response = await request('/imports', { method: 'POST', body: upload(entries) });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('payload_too_large');
    expect(await canonicalRowCounts()).toEqual(before);
  });

  it('ファイル合計 30MB+1 byte は本文を読んだ直後・パースの前に 413、検査も仮置きも作らない', async () => {
    const form = upload([
      { name: 'a.csv', body: new Uint8Array(15 * IMPORT_MB) },
      { name: 'b.csv', body: new Uint8Array(15 * IMPORT_MB + 1) },
    ]);
    // boundary は Response ごとに変わるので、同じ 1 つから型と本文を取る
    const encoded = new Response(form);
    const contentType = encoded.headers.get('content-type') ?? '';
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const response = await request('/imports/inspections', {
      method: 'POST',
      headers: { 'content-type': contentType, 'content-length': String(bytes.byteLength) },
      body: bytes,
    });
    expect(response.status).toBe(413);
    const error = ((await response.json()) as { error: { message: string } }).error;
    expect(error.message).toContain('合計 30MB');
    expect(await stagedKeys()).toEqual([]);
    const count = await d1.prepare('SELECT COUNT(*) AS n FROM import_inspections').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('本文の上限を超えれば Content-Length が無くても 413 にする', async () => {
    const chunk = new Uint8Array(IMPORT_MB);
    let sent = 0;
    const limit = overTotal + 64 * 1024 + 1;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= limit) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        sent += chunk.byteLength;
      },
    });
    const response = await app.request(
      '/api/imports/inspections',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'multipart/form-data; boundary=synthetic' },
        body: stream,
        duplex: 'half',
      } as RequestInit,
      env(),
    );
    expect(response.status).toBe(413);
    expect(await stagedKeys()).toEqual([]);
  });

  it('11 ファイル・1 ファイル 25MB+1 byte・合計 30MB+1 byte は 413、境界ちょうどは通る', async () => {
    const eleven = await request('/imports/inspections', {
      method: 'POST',
      body: upload(
        Array.from({ length: IMPORT_LIMITS.maxFiles + 1 }, (_, index) => ({
          name: `f${index}.csv`,
          body: freeeCsv(index + 1),
        })),
      ),
    });
    expect(eleven.status).toBe(413);

    const tenOk = await request('/imports/inspections', {
      method: 'POST',
      body: upload(
        Array.from({ length: IMPORT_LIMITS.maxFiles }, (_, index) => ({
          name: `f${index}.csv`,
          body: freeeCsv(index + 1, String(index + 1).padStart(2, '0')),
        })),
      ),
    });
    expect(tenOk.status).toBe(201);

    const oversizedFile = await request('/imports/inspections', {
      method: 'POST',
      body: upload([{ name: 'big.csv', body: new Uint8Array(IMPORT_LIMITS.maxFileBytes + 1) }]),
    });
    expect(oversizedFile.status).toBe(413);
  });

  it('追加でも検査 ID ごとの累計で 11 ファイル目を 413 にする', async () => {
    const first = await inspect(
      Array.from({ length: IMPORT_LIMITS.maxFiles }, (_, index) => ({
        name: `f${index}.csv`,
        body: freeeCsv(index + 1),
      })),
    );
    const eleventh = await request(`/imports/inspections/${first.inspection.id}/files`, {
      method: 'POST',
      body: upload([{ name: 'f10.csv', body: freeeCsv(11) }]),
    });
    expect(eleventh.status).toBe(413);
  });
});

describe('上限は web の送信前判定と同じ共通境界表どおり', () => {
  /** 中身は 0 埋め。JSON として即座に読めず取込不可になるだけで、上限の判定には影響しない */
  const sized = (files: ReadonlyArray<{ name: string; size: number }>) =>
    files.map(({ name, size }) => ({ name, body: new Uint8Array(size) }));

  it.each(IMPORT_LIMIT_BOUNDARY_CASES)(
    '$name',
    async (entry) => {
      let path = '/imports/inspections';
      if (entry.before.length) {
        const before = await inspect(sized(entry.before));
        path = `/imports/inspections/${before.inspection.id}/files`;
      }
      const response = await request(path, { method: 'POST', body: upload(sized(entry.files)) });
      if (entry.expected) {
        expect(response.status).toBe(413);
        const error = ((await response.json()) as { error: { message: string } }).error;
        expect(error.message).toContain(importLimitReason(entry.expected));
      } else {
        expect([200, 201]).toContain(response.status);
      }
    },
    60_000,
  );
});

describe('403 と 429', () => {
  it('Origin が自サイトと違う変更要求は 403、同じなら通る', async () => {
    const forbidden = await request('/imports/inspections', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: upload([{ name: 'freee.csv', body: freeeCsv(1) }]),
    });
    expect(forbidden.status).toBe(403);
    const hide = await request('/imports/runs/hide', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['x'] }),
    });
    expect(hide.status).toBe(403);
    const same = await request('/imports/inspections', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: upload([{ name: 'freee.csv', body: freeeCsv(1) }]),
    });
    expect(same.status).toBe(201);
    // 読み取りは Origin を問わない
    const read = await request('/imports/runs', { headers: { origin: 'https://evil.example' } });
    expect(read.status).toBe(200);
  });

  it('検査は 1 分 30 回まで、31 回目は 429 と Retry-After', async () => {
    await waitForFreshRateWindow();
    for (let index = 0; index < IMPORT_LIMITS.inspectionsPerMinute; index++) {
      const response = await request('/imports/inspections', { method: 'POST', body: new FormData() });
      expect(response.status).toBe(400);
    }
    const limited = await request('/imports/inspections', { method: 'POST', body: new FormData() });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });

  it('確定は 1 分 5 回まで、6 回目は 429。検査の回数とは別に数える', async () => {
    await waitForFreshRateWindow();
    for (let index = 0; index < IMPORT_LIMITS.commitsPerMinute; index++) {
      const response = await postJson('/imports/runs', { inspectionId: 'none', fileIds: ['none'] });
      expect(response.status).toBe(404);
    }
    const limited = await postJson('/imports/runs', { inspectionId: 'none', fileIds: ['none'] });
    expect(limited.status).toBe(429);
    await inspect([{ name: 'freee.csv', body: freeeCsv(1) }]);
  });

  it('互換用の旧 POST /imports も確定と同じく 1 分 5 回まで、6 回目は 429', async () => {
    await waitForFreshRateWindow();
    for (let index = 0; index < IMPORT_LIMITS.commitsPerMinute; index++) {
      const response = await request('/imports', { method: 'POST', body: new FormData() });
      expect(response.status).toBe(400);
    }
    const limited = await request('/imports', { method: 'POST', body: new FormData() });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });

  it('10 ファイルの確定は続きの要求を数えず、取込 1 回として 1 回だけ数える', async () => {
    await waitForFreshRateWindow();
    const months = Array.from({ length: IMPORT_LIMITS.maxFiles }, (_, index) =>
      String(index + 1).padStart(2, '0'),
    );
    const body = await inspect(months.map((month) => ({ name: `mf-${month}.csv`, body: mfCsv(1, month) })));
    const { runs } = await commitAll(
      body.inspection.id,
      body.inspection.files.map((file) => file.id),
    );
    expect(runs).toHaveLength(IMPORT_LIMITS.maxFiles);
    expect(new Set(runs.map((run) => run.id)).size).toBe(1);
    // 残りの枠は commitsPerMinute - 1 回。使い切った次が 429
    for (let index = 1; index < IMPORT_LIMITS.commitsPerMinute; index++) {
      const response = await postJson('/imports/runs', { inspectionId: 'none', fileIds: ['none'] });
      expect(response.status).toBe(404);
    }
    const limited = await postJson('/imports/runs', { inspectionId: 'none', fileIds: ['none'] });
    expect(limited.status).toBe(429);
  });
});

describe('期限切れの行の片づけ', () => {
  it('期限切れの検査と古い時間枠を消し、期限内は残す', async () => {
    const kept = await inspect([{ name: 'keep.csv', body: freeeCsv(1) }]);
    const expired = await inspect([{ name: 'old.csv', body: freeeCsv(2) }]);
    await d1
      .prepare('UPDATE import_inspections SET expires_at=? WHERE id=?')
      .bind(new Date(Date.now() - 1000).toISOString(), expired.inspection.id)
      .run();
    await d1
      .prepare('INSERT INTO import_rate_limits (user_id,kind,window_start,count) VALUES (?,?,?,?)')
      .bind('usr_test_admin', 'inspection', Date.now() - 2 * 24 * 60 * 60 * 1000, 3)
      .run();

    const purged = await purgeExpiredImportRows(d1, Date.now());
    expect(purged.inspections).toBe(1);
    expect(purged.rateWindows).toBe(1);
    const files0 = await d1
      .prepare('SELECT COUNT(*) AS n FROM import_inspection_files WHERE inspection_id=?')
      .bind(expired.inspection.id)
      .first<{ n: number }>();
    expect(files0?.n).toBe(0);
    const remaining = await d1.prepare('SELECT id FROM import_inspections').all<{ id: string }>();
    expect(remaining.results.map((row) => row.id)).toEqual([kept.inspection.id]);
  });

  it('検査を新しく作る要求が、期限切れの検査をついでに消す(夜間保守に頼らない)', async () => {
    const expired = await inspect([{ name: 'old.csv', body: freeeCsv(1) }]);
    await d1
      .prepare('UPDATE import_inspections SET expires_at=? WHERE id=?')
      .bind(new Date(Date.now() - 1000).toISOString(), expired.inspection.id)
      .run();

    const fresh = await inspect([{ name: 'new.csv', body: freeeCsv(2) }]);

    const remaining = await d1.prepare('SELECT id FROM import_inspections').all<{ id: string }>();
    expect(remaining.results.map((row) => row.id)).toEqual([fresh.inspection.id]);
  });
});

describe('夜間保守の片づけ', () => {
  it('置いてから 24 時間を過ぎた仮置きだけを消す(D1 は読まない)', async () => {
    await inspect([{ name: 'a.csv', body: freeeCsv(1) }]);
    await inspect([{ name: 'b.csv', body: freeeCsv(2) }]);

    const now = Date.now();
    const first = await runImportStagingCleanup({ FILES: files }, now);
    // 仮置きはまだ 24 時間経っていないので残す
    expect(first.staged).toBe(0);

    const later = await runImportStagingCleanup({ FILES: files }, now + IMPORT_LIMITS.stagingTtlMs + 60_000);
    expect(later.staged).toBe(2);
    expect(await stagedKeys()).toEqual([]);
  });
});
