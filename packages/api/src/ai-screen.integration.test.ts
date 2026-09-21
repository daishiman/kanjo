/**
 * AI分析画面の作り直し (spec-ai-analysis-screen) で増えた API の回帰テスト。
 * 取り消し・再実行・使用データ件数・段階の記録 (data 取得/差し戻し)・送信の大きさ上限・通し番号・版の説明を、
 * 各テスト専用のインメモリ D1 と架空の取引だけで確かめる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPORT_BODY_MAX_BYTES, SECTION_IDS } from './ai/contract.js';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

let mf: Miniflare;
let d1: D1Database;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const statement of statements) await database.prepare(statement).run();
  }
  await recordTestMigrationHead(database, filenames);
}

const env = () => ({ ...auth, DB: d1 });

const request = async (path: string, method = 'GET', body?: unknown): Promise<Response> =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    },
    env(),
  );

const agent = async (path: string, token: string, method = 'GET', body?: string): Promise<Response> =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body,
    },
    env(),
  );

type TaskView = {
  id: string;
  seq: number | null;
  displayId: string;
  stage: string;
  progress: number;
  status: string;
  supplement: string | null;
  parentReportId: string | null;
  period: { from: string; to: string };
  dataFetchedAt: string | null;
  rejectedAt: string | null;
  rejectCount: number;
  canceledAt: string | null;
};

/** 依頼を発行し、指示文から使い捨てトークンを取り出す */
async function issue(body: Record<string, unknown> = { from: '2026-08', to: '2026-08' }) {
  const res = await request('/ai/tasks', 'POST', body);
  expect(res.status).toBe(201);
  const json = (await res.json()) as { task: TaskView; prompt: string };
  const token = /kjo_[A-Za-z0-9_-]+/.exec(json.prompt)?.[0];
  expect(token).toBeTruthy();
  return { task: json.task, token: token as string };
}

const taskRow = async (id: string) =>
  (await d1.prepare('SELECT * FROM ai_tasks WHERE id = ?').bind(id).first()) as Record<string, unknown>;

const LONG = '本文'.repeat(50);
const finding = (label: string) => ({
  label,
  fact: '通信費が3ヶ月平均で月42,000円(前期比+12,000円)',
  basis: 'biz.expenseByAccount.通信費 の 2026-06〜2026-08 合計÷3',
  interpretation: '固定費で水準が一段上がっており、一時的なブレではない',
  action: '回線契約を1本にまとめる',
  expectedEffect: 8000,
  amount: 42000,
  priority: 'high' as const,
});
/** 架空データで出せる図 (beforeAll で data から読む)。レポートは出せる図すべてに説明を付けて参照する */
let availableCharts: { id: string; figure: number }[] = [];
const validReport = () => ({
  generatedBy: 'test',
  analysisDepth: 'standard',
  summary: `${'要約'.repeat(40)} ${availableCharts.map((c) => `図${c.figure}`).join('・')}のとおり上位2科目で6割を占める。`,
  keyFindings: {
    improvements: [finding('通信費')],
    wasted: [finding('重複サブスク')],
    quickWins: [],
    notes: { quickWins: '今期は即効性のある削減対象が見当たらなかった' },
  },
  sections: SECTION_IDS.map((id) => ({
    id,
    body: LONG,
    items: Array.from({ length: 3 }, (_, i) => ({ label: `行${i}`, amount: 1000 })),
  })),
  charts: availableCharts.map((c) => ({
    catalogId: c.id,
    caption: `図${c.figure}は架空データの推移と構成を読むための図です`,
  })),
  contextAnalysis: {
    externalResearch: 'off',
    questionType: 'trend',
    question: { decision: '費用を見直す', metric: '通信費', comparison: '直近3ヶ月', range: '対象期間' },
    interviewFacts: [],
    statisticalFacts: [],
    interpretations: [],
    externalEvidence: [],
    causalHypotheses: [],
  },
});

/** JSON の後ろを空白で埋め、UTF-8 でちょうど size バイトの本文にする (JSON として有効なまま) */
const padTo = (json: string, size: number): string => {
  const bytes = new TextEncoder().encode(json).length;
  expect(bytes).toBeLessThanOrEqual(size);
  return json + ' '.repeat(size - bytes);
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'ai-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  cookie = await loginForTest(app, env());
  expect(cookie).not.toBe('');

  // 架空の取引: freee 4件 (科目2種・取引先2種・空の取引先1件)、MF 4件 (対象2件・振替1件・対象外1件)
  const deals: [string, string, string | null, string | null, string | null, number][] = [
    ['2026-08', 'expense', '架空通信', '通信費', '通信費', 42000],
    ['2026-08', 'expense', '架空外注', '外注費', '外注費', 90000],
    ['2026-08', 'expense', '', null, '通信費', 3000],
    ['2026-08', 'income', '架空通信', '売上高', '売上高', 300000],
    ['2026-01', 'expense', '期間外', '雑費', '雑費', 1000],
  ];
  for (const [month, io, partner, norm, raw, amount] of deals)
    await d1
      .prepare(
        `INSERT INTO freee_deals (user_id, month, date, io, partner, account_norm, account_raw, amount)
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(month, `${month}-10`, io, partner, norm, raw, amount)
      .run();
  await d1
    .prepare("UPDATE freee_deals SET memo = '架空の秘密メモ-外部送信禁止' WHERE partner = '架空通信'")
    .run();
  const txs: [string, string, number, number, string | null][] = [
    // 摘要と明細 ID は、エージェントへ渡すデータに出ないことを確かめる目印 (集計値だけを渡す)
    ['ai-line-1', '架空摘要-食費', 1, 0, '食費'],
    ['ai-line-2', '架空摘要-住居', 1, 0, '住宅'],
    ['ai-line-3', '架空摘要-振替', 1, 1, '振替'],
    ['ai-line-4', '架空摘要-対象外', 0, 0, '趣味'],
  ];
  for (const [txId, desc, isTarget, isTransfer, cat] of txs)
    await d1
      .prepare(
        `INSERT INTO mf_transactions (user_id, tx_id, month, date, description, amount, is_target, is_transfer, category_major)
         VALUES ('default', ?, '2026-08', '2026-08-05', ?, -5000, ?, ?, ?)`,
      )
      .bind(txId, desc, isTarget, isTransfer, cat)
      .run();

  // 画面用の dataset 経路 (段階を記録しない) で出せる図を調べ、発行した依頼は取り消して片付ける
  const probe = await issue();
  const payload = (await (await request(`/ai/tasks/${probe.task.id}/dataset`)).json()) as {
    charts: { id: string; figure: number; available: boolean }[];
  };
  availableCharts = payload.charts.filter((c) => c.available);
  await d1.prepare('DELETE FROM ai_tasks WHERE id = ?').bind(probe.task.id).run();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('通し番号と表示ID', () => {
  it('利用者ごとに 1 から振られ、表示IDは T- と4桁のゼロ埋め', async () => {
    const a = await issue();
    const b = await issue();
    expect(b.task.seq).toBe((a.task.seq as number) + 1);
    expect(a.task.displayId).toBe(`T-${String(a.task.seq).padStart(4, '0')}`);
    expect(a.task.stage).toBe('waiting');
    expect(a.task.status).toBe('waiting');
  });

  it('同時発行で (user_id, seq) に衝突したら 1 回だけ採り直し、500 にしない', async () => {
    const before = await issue();
    const rivalSeq = (before.task.seq as number) + 1;
    // 最初の ai_tasks INSERT の直前に、別の要求が同じ seq を先に取った状態を本物の D1 に作る。
    // drizzle が包んだ本物の UNIQUE 違反で採り直しの経路を通すため、エラーは偽造しない。
    let raced = false;
    const racingDb = new Proxy(d1, {
      get(target, prop) {
        if (prop !== 'prepare') return Reflect.get(target, prop, target);
        return (sql: string) => {
          const stmt = target.prepare(sql);
          if (raced || !/^insert into "ai_tasks"/i.test(sql)) return stmt;
          raced = true;
          return new Proxy(stmt, {
            get(s, p) {
              if (p !== 'bind') return Reflect.get(s, p, s);
              return (...params: unknown[]) => {
                const bound = s.bind(...params);
                return new Proxy(bound, {
                  get(b, m) {
                    const fn = Reflect.get(b, m, b);
                    if (typeof fn !== 'function') return fn;
                    return async (...args: unknown[]) => {
                      await target
                        .prepare(
                          `INSERT INTO ai_tasks (id, user_id, period_from, period_to, report_type, token_hash, expires_at, created_at, seq)
                           SELECT 'rival-task', user_id, period_from, period_to, report_type, 'rival-hash', expires_at, created_at, ?
                           FROM ai_tasks WHERE id = ?`,
                        )
                        .bind(rivalSeq, before.task.id)
                        .run();
                      return fn.apply(b, args);
                    };
                  },
                });
              };
            },
          });
        };
      },
    });
    const res = await app.request(
      '/api/ai/tasks',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ from: '2026-08', to: '2026-08' }),
      },
      { ...auth, DB: racingDb },
    );
    expect(raced).toBe(true);
    expect(res.status).toBe(201);
    const { task } = (await res.json()) as { task: TaskView };
    expect(task.seq).toBe(rivalSeq + 1);
    expect((await taskRow('rival-task'))?.seq).toBe(rivalSeq);
  });
});

describe('使用するデータの件数', () => {
  it('期間内だけを数え、振替・対象外を除き、科目は freee と MF を別に数える', async () => {
    const res = await request('/ai/inventory?from=2026-08&to=2026-08');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      period: { from: '2026-08', to: '2026-08', label: expect.any(String) },
      freeeDeals: 4,
      mfTransactions: 2,
      // freee: 通信費・外注費・売上高 (空の norm は raw で補う) / MF: 食費・住宅
      categories: 5,
      counterparties: 2,
    });
  });

  it('期間の指定が正しくなければ 400 invalid_request', async () => {
    for (const q of ['from=2026-09&to=2026-08', 'from=2026-8&to=2026-08', '']) {
      const res = await request(`/ai/inventory?${q}`);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_request');
    }
  });
});

describe('取り消し', () => {
  it('待機中の依頼を取り消すと canceled になり、2回目は時刻を変えずに 200', async () => {
    const { task, token } = await issue();
    const first = await request(`/ai/tasks/${task.id}/cancel`, 'POST');
    expect(first.status).toBe(200);
    const j1 = (await first.json()) as { ok: boolean; task: TaskView };
    expect(j1.task.stage).toBe('canceled');
    expect(j1.task.canceledAt).not.toBeNull();
    const again = await request(`/ai/tasks/${task.id}/cancel`, 'POST');
    expect(again.status).toBe(200);
    expect(((await again.json()) as { task: TaskView }).task.canceledAt).toBe(j1.task.canceledAt);

    // 取り消し後はエージェントのトークンが 401 (取り消しの文言)
    const data = await agent(`/ai/tasks/${task.id}/data`, token);
    expect(data.status).toBe(401);
    expect(((await data.json()) as { error: { message: string } }).error.message).toBe(
      'この依頼は取り消されました。アプリで指示文を作り直してください',
    );
    // 画面からの貼り付けも 409
    const paste = await request(`/ai/tasks/${task.id}/paste`, 'POST', validReport());
    expect(paste.status).toBe(409);
    expect(((await paste.json()) as { error: { code: string } }).error.code).toBe('task_canceled');
    // 行は残る (削除は別操作)
    expect(await taskRow(task.id)).toBeTruthy();
  });

  it('受信済みは 409 already_done、期限切れは 409 already_expired、他人・存在しない依頼は 404', async () => {
    const { task, token } = await issue();
    const sent = await agent(`/ai/tasks/${task.id}/report`, token, 'POST', JSON.stringify(validReport()));
    expect(sent.status).toBe(201);
    const done = await request(`/ai/tasks/${task.id}/cancel`, 'POST');
    expect(done.status).toBe(409);
    expect(((await done.json()) as { error: { code: string } }).error.code).toBe('already_done');

    const expired = await issue();
    await d1
      .prepare('UPDATE ai_tasks SET expires_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), expired.task.id)
      .run();
    const ex = await request(`/ai/tasks/${expired.task.id}/cancel`, 'POST');
    expect(ex.status).toBe(409);
    expect(((await ex.json()) as { error: { code: string } }).error.code).toBe('already_expired');
    const expiredPaste = await request(`/ai/tasks/${expired.task.id}/paste`, 'POST', validReport());
    expect(expiredPaste.status).toBe(409);
    expect(((await expiredPaste.json()) as { error: { code: string } }).error.code).toBe('already_expired');
    expect((await taskRow(expired.task.id)).used_at).toBeNull();
    expect(
      await d1
        .prepare('SELECT COUNT(*) AS n FROM ai_reports WHERE task_id = ?')
        .bind(expired.task.id)
        .first<number>('n'),
    ).toBe(0);

    await d1
      .prepare(
        `INSERT INTO ai_tasks (id, user_id, period_kind, period_key, period_from, period_to, report_type, token_hash, expires_at, created_at)
         VALUES ('other-task', 'someone-else', 'range', '', '2026-08', '2026-08', 'monthly', 'h-other', ?, '2026-08-01T00:00:00.000Z')`,
      )
      .bind(new Date(Date.now() + 60_000).toISOString())
      .run();
    for (const id of ['other-task', 'no-such-task']) {
      expect((await request(`/ai/tasks/${id}/cancel`, 'POST')).status).toBe(404);
      expect((await request(`/ai/tasks/${id}/retry`, 'POST')).status).toBe(404);
    }
    expect((await taskRow('other-task')).canceled_at).toBeNull();
  });

  it('本文が 4KB を超える取り消し要求は 413', async () => {
    const { task } = await issue();
    const res = await request(
      `/ai/tasks/${task.id}/cancel`,
      'POST',
      JSON.stringify({ pad: 'x'.repeat(5000) }),
    );
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('payload_too_large');
    expect((await taskRow(task.id)).canceled_at).toBeNull();
  });

  it('実行中 50%・75% も取り消せ、取り消し後のトークンでのレポート送信は 401 で保存されない', async () => {
    const running = await issue();
    expect((await agent(`/ai/tasks/${running.task.id}/data`, running.token)).status).toBe(200);
    const rejected = await issue();
    await agent(`/ai/tasks/${rejected.task.id}/report`, rejected.token, 'POST', '{"summary": ');
    for (const [t, progress] of [
      [running, 50],
      [rejected, 75],
    ] as const) {
      const before = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
      expect(before.tasks.find((x) => x.id === t.task.id)?.progress).toBe(progress);
      const res = await request(`/ai/tasks/${t.task.id}/cancel`, 'POST');
      expect(res.status).toBe(200);
      expect(((await res.json()) as { task: TaskView }).task.stage).toBe('canceled');
      const sent = await agent(
        `/ai/tasks/${t.task.id}/report`,
        t.token,
        'POST',
        JSON.stringify(validReport()),
      );
      expect(sent.status).toBe(401);
      expect((await taskRow(t.task.id)).used_at).toBeNull();
    }
  });
});

describe('再実行', () => {
  it('キャンセルした依頼を、期間・補足指示・再分析元を引き継いで新しい番号とトークンで発行する', async () => {
    const { task, token } = await issue({ from: '2026-07', to: '2026-08', supplement: '通信費を重点的に' });
    await request(`/ai/tasks/${task.id}/cancel`, 'POST');
    const res = await request(`/ai/tasks/${task.id}/retry`, 'POST');
    expect(res.status).toBe(201);
    const json = (await res.json()) as { task: TaskView; prompt: string };
    expect(json.task.id).not.toBe(task.id);
    expect(json.task.seq).toBeGreaterThan(task.seq as number);
    expect(json.task.period).toEqual({ from: '2026-07', to: '2026-08' });
    expect(json.task.supplement).toBe('通信費を重点的に');
    expect(json.task.stage).toBe('waiting');
    const newToken = /kjo_[A-Za-z0-9_-]+/.exec(json.prompt)?.[0];
    expect(newToken).not.toBe(token);
    // 元の行は取り消し済みのまま残る
    expect((await taskRow(task.id)).canceled_at).not.toBeNull();
  });

  it('待機中・完了の依頼は 409 not_retryable', async () => {
    const { task } = await issue();
    const res = await request(`/ai/tasks/${task.id}/retry`, 'POST');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_retryable');

    const done = await issue();
    const sent = await agent(
      `/ai/tasks/${done.task.id}/report`,
      done.token,
      'POST',
      JSON.stringify(validReport()),
    );
    expect(sent.status).toBe(201);
    const again = await request(`/ai/tasks/${done.task.id}/retry`, 'POST');
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe('not_retryable');
  });

  it('失敗 (結果なしで期限切れ) の依頼は再実行でき、期間を引き継ぐ', async () => {
    const { task } = await issue({ from: '2026-06', to: '2026-07' });
    await d1
      .prepare('UPDATE ai_tasks SET expires_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), task.id)
      .run();
    const list = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
    expect(list.tasks.find((x) => x.id === task.id)?.stage).toBe('failed');
    const res = await request(`/ai/tasks/${task.id}/retry`, 'POST');
    expect(res.status).toBe(201);
    const json = (await res.json()) as { task: TaskView };
    expect(json.task.period).toEqual({ from: '2026-06', to: '2026-07' });
    expect(json.task.stage).toBe('waiting');
  });
});

describe('背景分析のないレポート', () => {
  it('contextAnalysis が無くても受理し、本文には null で残す (契約 v3 を壊さない)', async () => {
    const { task, token } = await issue();
    const { contextAnalysis: _omitted, ...withoutContext } = validReport();
    const res = await agent(`/ai/tasks/${task.id}/report`, token, 'POST', JSON.stringify(withoutContext));
    expect(res.status).toBe(201);
    const { reportId } = (await res.json()) as { reportId: string };
    const row = (await d1
      .prepare('SELECT body_json FROM ai_reports WHERE id = ?')
      .bind(reportId)
      .first()) as { body_json: string };
    const body = JSON.parse(row.body_json) as { contextAnalysis: unknown; sections: unknown[] };
    expect(body.contextAnalysis).toBeNull();
    expect(body.sections).toHaveLength(SECTION_IDS.length);
  });
});

describe('依頼の削除', () => {
  it('結果待ち (待機中・実行中) は削除できず 409 not_deletable (取り消しの担当)', async () => {
    const waiting = await issue();
    const res = await request(`/ai/tasks/${waiting.task.id}`, 'DELETE');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_deletable');
    expect(await taskRow(waiting.task.id)).toBeTruthy();

    // データ取得済み = 実行中。こちらも行が残る
    const running = await issue();
    expect((await agent(`/ai/tasks/${running.task.id}/data`, running.token)).status).toBe(200);
    const list = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
    expect(list.tasks.find((x) => x.id === running.task.id)?.stage).toBe('running');
    const res2 = await request(`/ai/tasks/${running.task.id}`, 'DELETE');
    expect(res2.status).toBe(409);
    expect(((await res2.json()) as { error: { code: string } }).error.code).toBe('not_deletable');
    expect(await taskRow(running.task.id)).toBeTruthy();
  });

  it('キャンセル・失敗の依頼は削除でき、受信済みは 409 not_deletable', async () => {
    const canceled = await issue();
    expect((await request(`/ai/tasks/${canceled.task.id}/cancel`, 'POST')).status).toBe(200);
    expect((await request(`/ai/tasks/${canceled.task.id}`, 'DELETE')).status).toBe(200);
    expect(await taskRow(canceled.task.id)).toBeNull();

    const failed = await issue();
    await d1
      .prepare('UPDATE ai_tasks SET expires_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), failed.task.id)
      .run();
    expect((await request(`/ai/tasks/${failed.task.id}`, 'DELETE')).status).toBe(200);
    expect(await taskRow(failed.task.id)).toBeNull();

    const done = await issue();
    const sent = await agent(
      `/ai/tasks/${done.task.id}/report`,
      done.token,
      'POST',
      JSON.stringify(validReport()),
    );
    expect(sent.status).toBe(201);
    const res = await request(`/ai/tasks/${done.task.id}`, 'DELETE');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_deletable');
    expect(await taskRow(done.task.id)).toBeTruthy();
  });
});

describe('コピー先ごとの指示文', () => {
  const promptOf = async (body: Record<string, unknown>): Promise<string> => {
    const res = await request('/ai/tasks', 'POST', { from: '2026-08', to: '2026-08', ...body });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { task: TaskView; prompt: string };
    await d1.prepare('DELETE FROM ai_tasks WHERE id = ?').bind(json.task.id).run();
    return json.prompt;
  };

  it('宛先を変えると、道具の名前と Skill の置き場所が実際に変わる', async () => {
    const claude = await promptOf({ target: 'claude_code' });
    const codex = await promptOf({ target: 'codex' });
    expect(claude).toContain('Claude Code で');
    expect(claude).toContain('.claude/skills/run-kanjo-accounting-report/SKILL.md');
    expect(codex).toContain('Codex で');
    expect(codex).toContain('.agents/skills/run-kanjo-accounting-report/SKILL.md');
    // トークン・依頼IDを除いた本文が、宛先ごとに違うことを確かめる
    const mask = (p: string) =>
      p.replace(/kjo_[A-Za-z0-9_-]+/g, 'TOKEN').replace(/tasks\/[0-9a-f-]+/g, 'tasks/ID');
    expect(mask(claude)).not.toBe(mask(codex));
  });

  it('宛先を送ってこない依頼は Claude Code 宛て', async () => {
    expect(await promptOf({})).toContain('Claude Code で');
  });

  it('再実行はコピー済みの宛先を引き継ぐ', async () => {
    const { task } = await issue();
    expect((await request(`/ai/tasks/${task.id}/copied`, 'POST', { target: 'codex' })).status).toBe(200);
    expect((await request(`/ai/tasks/${task.id}/cancel`, 'POST')).status).toBe(200);
    const res = await request(`/ai/tasks/${task.id}/retry`, 'POST');
    expect(res.status).toBe(201);
    expect(((await res.json()) as { prompt: string }).prompt).toContain('Codex で');
  });
});

describe('エージェントへ渡すデータ', () => {
  it('集計値だけで、明細ID・摘要・freeeメモを含まない', async () => {
    const { task, token } = await issue();
    const res = await agent(`/ai/tasks/${task.id}/data`, token);
    expect(res.status).toBe(200);
    const text = await res.text();
    // 同じ明細は科目の集計には入っている (データ自体が渡っていないのに通る検査にしない)
    expect(text).toContain('住宅');
    expect(text).not.toContain('架空摘要');
    expect(text).not.toContain('ai-line-');
    expect(text).not.toContain('架空の秘密メモ-外部送信禁止');
  });

  it('payload構築中に取り消されたら、応答直前CASが負けてデータを返さない', async () => {
    const { task, token } = await issue();
    let raced = false;
    const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property) {
          if (property === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
          const value = Reflect.get(target, property, target);
          if ((property === 'all' || property === 'run' || property === 'raw') && typeof value === 'function')
            return async (...args: unknown[]) => {
              if (!raced) {
                raced = true;
                await d1
                  .prepare('UPDATE ai_tasks SET canceled_at = ? WHERE id = ?')
                  .bind(new Date().toISOString(), task.id)
                  .run();
              }
              return value.apply(target, args);
            };
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    const racingDb = new Proxy(d1, {
      get(target, property) {
        if (property === 'prepare')
          return (sql: string) => {
            const statement = target.prepare(sql);
            return /update\s+"ai_tasks"\s+set\s+"data_fetched_at"/i.test(sql) ? wrap(statement) : statement;
          };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const response = await app.request(
      `/api/ai/tasks/${task.id}/data`,
      { headers: { authorization: `Bearer ${token}` } },
      { ...auth, DB: racingDb },
    );
    expect(raced).toBe(true);
    expect(response.status).toBe(401);
    expect((await taskRow(task.id)).data_fetched_at).toBeNull();
  });
});

describe('レポート保存の原子性と版競合', () => {
  it('report INSERTが失敗したらtask claimもrollbackする', async () => {
    const { task, token } = await issue();
    await d1
      .prepare(
        `CREATE TRIGGER reject_ai_report_for_test BEFORE INSERT ON ai_reports
         BEGIN SELECT RAISE(ABORT, 'synthetic insert failure'); END`,
      )
      .run();
    try {
      const response = await agent(
        `/ai/tasks/${task.id}/report`,
        token,
        'POST',
        JSON.stringify(validReport()),
      );
      expect(response.status).toBe(500);
      expect(await taskRow(task.id)).toMatchObject({ used_at: null, report_id: null });
      expect(
        await d1
          .prepare('SELECT COUNT(*) AS n FROM ai_reports WHERE task_id = ?')
          .bind(task.id)
          .first<number>('n'),
      ).toBe(0);
    } finally {
      await d1.prepare('DROP TRIGGER reject_ai_report_for_test').run();
    }
  });

  it('同じ系列の2依頼を同時受信しても版番号を重複させない', async () => {
    const left = await issue();
    const right = await issue();
    const responses = await Promise.all(
      [left, right].map(({ task, token }) =>
        agent(`/ai/tasks/${task.id}/report`, token, 'POST', JSON.stringify(validReport())),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([201, 201]);
    const versions = await d1
      .prepare('SELECT version FROM ai_reports WHERE task_id IN (?, ?) ORDER BY version')
      .bind(left.task.id, right.task.id)
      .all<{ version: number }>();
    expect(new Set(versions.results.map((row) => row.version)).size).toBe(2);
  });

  it('版競合後の再claimにも負けた三者競合では201を返さない', async () => {
    const current = await issue();
    let batchCalls = 0;
    const racingDb = new Proxy(d1, {
      get(target, property) {
        if (property === 'batch')
          return async () => {
            batchCalls += 1;
            if (batchCalls === 1) throw new Error('UNIQUE constraint failed: ai_reports.version');
            return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }];
          };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const response = await app.request(
      `/api/ai/tasks/${current.task.id}/report`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${current.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(validReport()),
      },
      { ...auth, DB: racingDb },
    );
    expect(batchCalls).toBe(2);
    expect(response.status).toBe(401);
    expect(await taskRow(current.task.id)).toMatchObject({ used_at: null, report_id: null });
  });

  it('同じ依頼の同時受信は1件だけ保存する', async () => {
    const current = await issue();
    const responses = await Promise.all([
      agent(`/ai/tasks/${current.task.id}/report`, current.token, 'POST', JSON.stringify(validReport())),
      agent(`/ai/tasks/${current.task.id}/report`, current.token, 'POST', JSON.stringify(validReport())),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 401]);
    expect(
      await d1
        .prepare('SELECT COUNT(*) AS n FROM ai_reports WHERE task_id = ?')
        .bind(current.task.id)
        .first<number>('n'),
    ).toBe(1);
  });
});

describe('一覧上限に依存しないdeep-linkと版履歴', () => {
  it('最新20件より古いURL指定taskも専用取得で該当1件を返す', async () => {
    const oldest = await issue();
    for (let index = 0; index < 20; index++) await issue();
    const normal = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
    expect(normal.tasks).toHaveLength(20);
    expect(normal.tasks.some((task) => task.id === oldest.task.id)).toBe(false);
    const linked = (await (await request(`/ai/tasks?id=${encodeURIComponent(oldest.task.id)}`)).json()) as {
      tasks: TaskView[];
    };
    expect(linked.tasks).toHaveLength(1);
    expect(linked.tasks[0]?.id).toBe(oldest.task.id);
  });

  it('100件より古い版も同じ系列ならすべて返す', async () => {
    const sourceBody = await d1
      .prepare('SELECT body_json FROM ai_reports LIMIT 1')
      .first<string>('body_json');
    expect(sourceBody).toBeTruthy();
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 101)
         INSERT INTO ai_reports
           (id,user_id,task_id,period_kind,period_key,period_from,period_to,report_type,version,
            generated_by,title,summary,body_json,created_at)
         SELECT printf('history-%03d', n),'default',printf('history-task-%03d', n),'range','',
                '2032-01','2032-01','monthly',n,'test','架空履歴','架空の履歴',?,
                datetime('2032-01-01', printf('+%d minutes', n))
         FROM seq`,
      )
      .bind(sourceBody)
      .run();
    try {
      const response = await request('/ai/reports/history-001');
      expect(response.status).toBe(200);
      const detail = (await response.json()) as { versions: { id: string; version: number }[] };
      expect(detail.versions).toHaveLength(101);
      expect(detail.versions.at(-1)).toMatchObject({ id: 'history-101', version: 101 });
    } finally {
      await d1.prepare("DELETE FROM ai_reports WHERE id LIKE 'history-%'").run();
    }
  });
});

describe('段階の記録', () => {
  it('データ取得は初回の時刻だけを残し、進行を実行中 50% にする', async () => {
    const { task, token } = await issue();
    expect((await agent(`/ai/tasks/${task.id}/data`, token)).status).toBe(200);
    const first = (await taskRow(task.id)).data_fetched_at;
    expect(first).not.toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect((await agent(`/ai/tasks/${task.id}/data`, token)).status).toBe(200);
    expect((await taskRow(task.id)).data_fetched_at).toBe(first);
    const list = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
    const view = list.tasks.find((t) => t.id === task.id) as TaskView;
    expect(view.stage).toBe('running');
    expect(view.progress).toBe(50);
  });

  it('契約違反の送信 (構文・形・内容) は差し戻しとして回数を数え、受信後は数えない', async () => {
    const { task, token } = await issue();
    const post = (body: string) => agent(`/ai/tasks/${task.id}/report`, token, 'POST', body);
    const bad = await post('{ not json');
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('invalid_json');
    expect((await post(JSON.stringify({ summary: 'x' }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...validReport(), sections: [] }))).status).toBe(400);
    const row = await taskRow(task.id);
    expect(row.reject_count).toBe(3);
    expect(row.rejected_at).not.toBeNull();
    const view = (await (await request('/ai/tasks')).json()) as { tasks: TaskView[] };
    expect(view.tasks.find((t) => t.id === task.id)?.progress).toBe(75);

    expect((await post(JSON.stringify(validReport()))).status).toBe(201);
    // 受信済みのトークンは agentGuard が 401 で止めるので回数は増えない
    expect((await post('{ not json')).status).toBe(401);
    expect((await taskRow(task.id)).reject_count).toBe(3);
  });
});

describe('送信の大きさ上限 (4 MiB)', () => {
  it('ちょうど 4 MiB の契約適合レポートは保存され、1 バイト超えは 413 で差し戻し回数も増えない', async () => {
    const exact = await issue();
    const body = padTo(JSON.stringify(validReport()), REPORT_BODY_MAX_BYTES);
    const ok = await agent(`/ai/tasks/${exact.task.id}/report`, exact.token, 'POST', body);
    expect(ok.status).toBe(201);

    const over = await issue();
    const big = padTo(JSON.stringify(validReport()), REPORT_BODY_MAX_BYTES + 1);
    const res = await agent(`/ai/tasks/${over.task.id}/report`, over.token, 'POST', big);
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
      '送信できる大きさを超えています',
    );
    expect((await taskRow(over.task.id)).reject_count).toBe(0);
    expect((await taskRow(over.task.id)).used_at).toBeNull();

    const pasteOver = await issue();
    expect((await request(`/ai/tasks/${pasteOver.task.id}/paste`, 'POST', big)).status).toBe(413);
    // 画面からの貼り付けも、上限ちょうどは保存される
    const pasteExact = await issue();
    expect((await request(`/ai/tasks/${pasteExact.task.id}/paste`, 'POST', body)).status).toBe(201);
    expect((await taskRow(pasteExact.task.id)).used_at).not.toBeNull();
  });
});

describe('版の説明', () => {
  it('各版に、その版を発行した依頼の補足指示から作った説明が付く', async () => {
    const first = await issue();
    const r1 = await agent(
      `/ai/tasks/${first.task.id}/report`,
      first.token,
      'POST',
      JSON.stringify(validReport()),
    );
    const { reportId } = (await r1.json()) as { reportId: string };
    const second = await issue({
      // URL/クライアントが別期間を送っても、親レポートの期間で固定される。
      from: '2025-01',
      to: '2025-12',
      parentReportId: reportId,
      supplement: '固定費の見直し余地を深掘り\n2行目は説明に使わない',
    });
    expect(second.task.parentReportId).toBe(reportId);
    expect(second.task.period).toEqual(first.task.period);
    const r2 = await agent(
      `/ai/tasks/${second.task.id}/report`,
      second.token,
      'POST',
      JSON.stringify(validReport()),
    );
    const { reportId: id2 } = (await r2.json()) as { reportId: string };
    const detail = (await (await request(`/ai/reports/${id2}`)).json()) as {
      versions: { version: number; versionNote: string }[];
    };
    const notes = detail.versions.map((v) => v.versionNote);
    expect(notes.at(-1)).toBe('固定費の見直し余地を深掘り');
    expect(notes.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  });
});
