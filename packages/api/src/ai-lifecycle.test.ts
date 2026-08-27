/**
 * AI分析のレポート削除・アーカイブ、結果待ち依頼の取り消しの API/D1 回帰テスト。
 * 実データを使わず、各テスト専用のインメモリ D1 と架空のレポート行だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './index.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare;
let d1: D1Database;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  for (const filename of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
}

const request = async (path: string, method = 'GET', body?: unknown): Promise<Response> =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...auth, DB: d1 },
  );

const requestWithDb = async (database: D1Database, path: string, method = 'GET'): Promise<Response> =>
  app.request(`/api${path}`, { method, headers: { cookie } }, { ...auth, DB: database });

/** 架空の依頼行。used=true なら結果を受け取り済み(取り消せない)、expired=true なら期限切れ */
async function insertTask(
  id: string,
  {
    used = false,
    expired = false,
    reportId = null,
  }: { used?: boolean; expired?: boolean; reportId?: string | null } = {},
): Promise<void> {
  const expiresAt = new Date(Date.now() + (expired ? -1000 : 60_000)).toISOString();
  await d1
    .prepare(
      `INSERT INTO ai_tasks
       (id, user_id, period_kind, period_key, period_from, period_to, report_type,
        token_hash, expires_at, used_at, report_id, created_at)
       VALUES (?, 'default', 'range', '', '2026-01', '2026-01', 'monthly', ?, ?, ?, ?, '2026-02-01T00:00:00.000Z')`,
    )
    .bind(id, `hash-${id}`, expiresAt, used ? '2026-02-01T01:00:00.000Z' : null, reportId)
    .run();
}

/** 架空のレポート行(本文は空の第3版) */
async function insertReport(id: string, taskId: string, createdAt: string): Promise<void> {
  const body = JSON.stringify({
    version: 3,
    generatedBy: 'test',
    summary: '架空の総評です。',
    keyFindings: { improvements: [], wasted: [], quickWins: [] },
    sections: [],
    needs: [],
    charts: [],
    dataGaps: [],
  });
  await d1
    .prepare(
      `INSERT INTO ai_reports
       (id, user_id, task_id, period_kind, period_key, period_from, period_to, report_type,
        version, generated_by, title, summary, body_json, created_at)
       VALUES (?, 'default', ?, 'range', '', '2026-01', '2026-01', 'monthly', 1, 'test', ?, ?, ?, ?)`,
    )
    .bind(id, taskId, `架空レポート ${id}`, '架空の総評です。', body, createdAt)
    .run();
}

const reportIds = async (query = ''): Promise<string[]> => {
  const res = await request(`/ai/reports${query}`);
  const json = (await res.json()) as { reports: { id: string }[] };
  return json.reports.map((r) => r.id);
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'ai-lifecycle',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: d1 },
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');

  await insertTask('task-a', { used: true, reportId: 'rep-a' });
  await insertTask('task-b');
  await insertTask('task-c', { expired: true });
  await insertReport('rep-a', 'task-a', '2026-02-01T01:00:00.000Z');
  await insertReport('rep-b', 'task-a', '2026-02-02T01:00:00.000Z');
});

afterAll(async () => {
  await mf?.dispose();
});

describe('レポートのアーカイブ', () => {
  it('アーカイブすると既定の一覧から消え、archived=1 と件数で分かる', async () => {
    expect(await reportIds()).toEqual(['rep-b', 'rep-a']);
    const put = await request('/ai/reports/rep-a/archive', 'PUT', { archived: true });
    expect(put.status).toBe(200);
    expect(await reportIds()).toEqual(['rep-b']);
    const res = await request('/ai/reports?archived=1');
    const json = (await res.json()) as {
      reports: { id: string; archivedAt: string | null }[];
      archivedCount: number;
    };
    expect(json.reports.map((r) => r.id)).toEqual(['rep-b', 'rep-a']);
    expect(json.archivedCount).toBe(1);
    expect(json.reports.find((r) => r.id === 'rep-a')?.archivedAt).not.toBeNull();
  });

  it('本文は消えていないので、戻せば元どおり読める', async () => {
    const detail = await request('/ai/reports/rep-a');
    expect(detail.status).toBe(200);
    await request('/ai/reports/rep-a/archive', 'PUT', { archived: false });
    expect(await reportIds()).toEqual(['rep-b', 'rep-a']);
  });

  it('他人の(存在しない)IDは404', async () => {
    const res = await request('/ai/reports/unknown/archive', 'PUT', { archived: true });
    expect(res.status).toBe(404);
  });

  it('200件より古い一致行もSQLで絞り込み、同じ母集団のアーカイブ件数を返す', async () => {
    try {
      await d1
        .prepare(
          `WITH RECURSIVE seq(n) AS (
             SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 205
           )
           INSERT INTO ai_reports
             (id,user_id,task_id,period_kind,period_key,period_from,period_to,report_type,
              version,generated_by,title,summary,body_json,created_at)
           SELECT printf('bulk-%03d', n), 'default', 'task-a', 'range', '',
                  '2030-01', '2030-01', 'monthly', 1, 'test', '架空一括', '架空', '{}',
                  datetime('2030-01-01', printf('+%d minutes', n))
             FROM seq`,
        )
        .run();
      await d1.batch([
        d1.prepare(
          `INSERT INTO ai_reports
             (id,user_id,task_id,period_kind,period_key,period_from,period_to,report_type,
              version,generated_by,title,summary,body_json,archived_at,created_at)
             VALUES ('old-long-active','default','task-a','range','','2024-01','2026-01','longterm',
                     1,'test','古い長期レポート','架空','{}',NULL,'2020-01-02T00:00:00.000Z')`,
        ),
        d1.prepare(
          `INSERT INTO ai_reports
             (id,user_id,task_id,period_kind,period_key,period_from,period_to,report_type,
              version,generated_by,title,summary,body_json,archived_at,created_at)
             VALUES ('old-long-archived','default','task-a','range','','2024-01','2026-01','longterm',
                     1,'test','古いアーカイブ','架空','{}','2020-01-03T00:00:00.000Z','2020-01-01T00:00:00.000Z')`,
        ),
      ]);

      const visible = (await (await request('/ai/reports?type=longterm&from=2025-01&to=2026-12')).json()) as {
        reports: { id: string }[];
        archivedCount: number;
      };
      expect(visible.reports.map((r) => r.id)).toEqual(['old-long-active']);
      expect(visible.archivedCount).toBe(1);

      const all = (await (
        await request('/ai/reports?type=longterm&from=2025-01&to=2026-12&archived=1')
      ).json()) as { reports: { id: string }[]; archivedCount: number };
      expect(all.reports.map((r) => r.id)).toEqual(['old-long-active', 'old-long-archived']);
      expect(all.archivedCount).toBe(1);
    } finally {
      await d1.prepare("DELETE FROM ai_reports WHERE id LIKE 'bulk-%' OR id LIKE 'old-long-%'").run();
    }
  });
});

describe('レポートの削除', () => {
  it('削除すると本文ごと消え、依頼・後続レポートの参照をすべて外す', async () => {
    await d1.batch([
      d1.prepare('UPDATE ai_tasks SET parent_report_id = ? WHERE id = ?').bind('rep-a', 'task-b'),
      d1.prepare('UPDATE ai_reports SET parent_report_id = ? WHERE id = ?').bind('rep-a', 'rep-b'),
    ]);
    const res = await request('/ai/reports/rep-a', 'DELETE');
    expect(res.status).toBe(200);
    expect(await reportIds('?archived=1')).toEqual(['rep-b']);
    expect((await request('/ai/reports/rep-a')).status).toBe(404);
    // 依頼の履歴自体は残す(いつ何を依頼したかを追えるように)
    const sourceTask = await d1
      .prepare('SELECT report_id FROM ai_tasks WHERE id = ?')
      .bind('task-a')
      .first<{ report_id: string | null }>();
    const childTask = await d1
      .prepare('SELECT parent_report_id FROM ai_tasks WHERE id = ?')
      .bind('task-b')
      .first<{ parent_report_id: string | null }>();
    const childReport = await d1
      .prepare('SELECT parent_report_id FROM ai_reports WHERE id = ?')
      .bind('rep-b')
      .first<{ parent_report_id: string | null }>();
    expect(sourceTask?.report_id).toBeNull();
    expect(childTask?.parent_report_id).toBeNull();
    expect(childReport?.parent_report_id).toBeNull();
  });

  it('無いレポートの削除は404', async () => {
    expect((await request('/ai/reports/rep-a', 'DELETE')).status).toBe(404);
  });
});

describe('統計の基準月数の設定', () => {
  const getSettings = async (): Promise<{
    statMinMonths: number;
    statMinMonthsRange: { min: number; max: number; default: number };
  }> => (await (await request('/settings')).json()) as never;

  it('未設定なら既定の6ヶ月で、変えられる範囲も一緒に返す', async () => {
    const s = await getSettings();
    expect(s.statMinMonths).toBe(6);
    expect(s.statMinMonthsRange).toMatchObject({ min: 3, max: 24, default: 6 });
  });

  it('保存すると次に開いたときも残る', async () => {
    expect((await request('/settings', 'PUT', { statMinMonths: 12 })).status).toBe(200);
    expect((await getSettings()).statMinMonths).toBe(12);
    // 上書きも効く(1行だけを持つ設計なので増え続けない)
    expect((await request('/settings', 'PUT', { statMinMonths: 4 })).status).toBe(200);
    expect((await getSettings()).statMinMonths).toBe(4);
  });

  it('範囲外は保存せず断る(黙って丸めない)', async () => {
    expect((await request('/settings', 'PUT', { statMinMonths: 2 })).status).toBe(400);
    expect((await request('/settings', 'PUT', { statMinMonths: 25 })).status).toBe(400);
    expect((await getSettings()).statMinMonths).toBe(4);
  });
});

describe('依頼の取り消し', () => {
  it('結果待ち・期限切れの依頼は消せる', async () => {
    expect((await request('/ai/tasks/task-b', 'DELETE')).status).toBe(200);
    expect((await request('/ai/tasks/task-c', 'DELETE')).status).toBe(200);
    const res = await request('/ai/tasks');
    const json = (await res.json()) as { tasks: { id: string }[] };
    expect(json.tasks.map((t) => t.id)).toEqual(['task-a']);
  });

  it('受信済みの依頼はレポートの出所なので消さない(409)', async () => {
    const res = await request('/ai/tasks/task-a', 'DELETE');
    expect(res.status).toBe(409);
    expect((await res.json()) as { code: string }).toMatchObject({ code: 'already_done' });
  });

  it('SELECT後に結果受信が割り込んでもCAS削除せず409にする', async () => {
    await insertTask('task-race');
    let raced = false;
    const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, prop) {
          if (prop === 'bind') return (...values: unknown[]) => wrapStatement(target.bind(...values));
          if (prop === 'run')
            return async () => {
              if (!raced) {
                raced = true;
                await d1
                  .prepare('UPDATE ai_tasks SET used_at = ? WHERE id = ?')
                  .bind('2026-02-01T01:00:00.000Z', 'task-race')
                  .run();
              }
              return target.run();
            };
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    const raceDb = new Proxy(d1, {
      get(target, prop) {
        if (prop === 'prepare')
          return (query: string) => {
            const statement = target.prepare(query);
            return /delete\s+from\s+["`]?ai_tasks/i.test(query) ? wrapStatement(statement) : statement;
          };
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const res = await requestWithDb(raceDb, '/ai/tasks/task-race', 'DELETE');
    expect(res.status).toBe(409);
    expect(raced).toBe(true);
    expect(
      await d1.prepare('SELECT used_at FROM ai_tasks WHERE id = ?').bind('task-race').first(),
    ).toMatchObject({ used_at: '2026-02-01T01:00:00.000Z' });
    await d1.prepare('DELETE FROM ai_tasks WHERE id = ?').bind('task-race').run();
  });

  it('無い依頼の取り消しは404', async () => {
    expect((await request('/ai/tasks/unknown', 'DELETE')).status).toBe(404);
  });
});
