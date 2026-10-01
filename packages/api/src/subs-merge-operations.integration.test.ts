/**
 * サブスクの統合・取り消し・並行制御の API/D1 回帰 (spec-subscriptions-merge の AC-001・002・004〜006・012〜014・017〜020)。
 * 実データを使わず、専用のインメモリ D1 と架空の freee 仕訳だけで検証する。
 *
 * fixture は freee 仕訳 (科目 サブスク・通信) だけで作る。サブスク画面 (照合後の実質支出) と
 * 他画面の subs 範囲 (monthly_agg) の両方が同じ仕訳から数えるので、1 つの fixture で両方の一致を見られる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ADMIN, loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';
import { getDb, recomputeFromDeals } from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};
const MEMBER = {
  id: 'usr_member',
  email: 'member@example.test',
  password: 'Synthetic-Member-Password-1',
} as const;

const MONTHS = ['2026-07', '2026-08'] as const;
/** 統合先・統合元・未登録の取引名・無関係の登録。和が他のどの値とも重ならない架空の月額 */
const TARGET = '架空文字起こし';
const SOURCE = 'aquavoice';
const RAW = '架空ボイス入力';
const NOTE = '架空ノート';
const VIDEO = '架空動画';
const OTHER_TENANT_VENDOR = '別テナントの音声';
const AMOUNT = { target: 1_537, source: 1_013, raw: 523, note: 811 } as const;

let mf: Miniflare;
let d1: D1Database;
let adminCookie: string;
let memberCookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

interface SendOptions {
  body?: unknown;
  /** Idempotency-Key。null なら付けない */
  key?: string | null;
  as?: 'admin' | 'member';
  /** 問い合わせを数える・失敗を差し込むときだけ差し替える */
  database?: D1Database;
}

async function send(method: string, path: string, options: SendOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    cookie: options.as === 'member' ? memberCookie : adminCookie,
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.key) headers['idempotency-key'] = options.key;
  return app.request(
    `/api${path}`,
    { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) },
    { ...auth, DB: options.database ?? d1 },
  );
}

let keySeq = 0;
const newKey = (): string => `test-key-${String(++keySeq).padStart(4, '0')}`;

interface MergeBody {
  targetId: number;
  sourceVendorIds?: number[];
  rawNames?: string[];
  baseRevision: number;
  [extra: string]: unknown;
}
const merge = (body: MergeBody, options: Omit<SendOptions, 'body'> = {}): Promise<Response> =>
  send('POST', '/sub-vendors/merge', {
    key: newKey(),
    ...options,
    body: { sourceVendorIds: [], rawNames: [], ...body },
  });
const undo = (id: string, baseRevision: number, options: Omit<SendOptions, 'body'> = {}): Promise<Response> =>
  send('POST', `/subscription-operations/${encodeURIComponent(id)}/undo`, {
    key: newKey(),
    ...options,
    body: { baseRevision },
  });

interface OperationResponse {
  operation: { id: string; kind: string; targetVendorId?: number; undoesId?: string; createdAt: string };
  revision: number;
  replayed: boolean;
}
interface ErrorBody {
  error: { code: string; message: string; retryable?: boolean };
}

/** 失敗の原因が読めるよう、200 でなければ本文を添えて落とす */
async function applied(response: Response): Promise<OperationResponse> {
  const text = await response.text();
  expect(response.status, text).toBe(200);
  return JSON.parse(text) as OperationResponse;
}
async function rejected(response: Response, status: number, code?: string): Promise<ErrorBody> {
  const text = await response.text();
  expect(response.status, text).toBe(status);
  const body = JSON.parse(text) as ErrorBody;
  if (code) expect(body.error.code).toBe(code);
  return body;
}

interface ScreenRow {
  vendorKey: string;
  vendorId: number | null;
  status: 'registered' | 'unregistered';
  normalizedName: string;
  estimatedMonthly: number;
}
interface Screen {
  rows: ScreenRow[];
  revision: number;
}
const screen = async (): Promise<Screen> => {
  const response = await send('GET', '/subscriptions');
  expect(response.status).toBe(200);
  return (await response.json()) as Screen;
};
const registered = (data: Screen, name: string): ScreenRow | undefined =>
  data.rows.find((row) => row.status === 'registered' && row.normalizedName === name);
const revisionOf = async (): Promise<number> => (await screen()).revision;

interface OperationListItem {
  id: string;
  kind: string;
  targetVendorName: string | null;
  createdAt: string;
  actorEmail: string | null;
  undoneAt: string | null;
  undoneByEmail: string | null;
  undoable: boolean;
  undoBlockedReason: string | null;
}
const operationList = async (query = ''): Promise<{ operations: OperationListItem[]; revision: number }> => {
  const response = await send('GET', `/subscription-operations${query}`);
  const text = await response.text();
  expect(response.status, text).toBe(200);
  return JSON.parse(text) as { operations: OperationListItem[]; revision: number };
};

const all = async <T>(sql: string, ...values: unknown[]): Promise<T[]> => {
  const statement = d1.prepare(sql);
  return (await (values.length ? statement.bind(...values) : statement).all<T>()).results;
};
const one = async <T>(sql: string, ...values: unknown[]): Promise<T | null> => {
  const statement = d1.prepare(sql);
  return (values.length ? statement.bind(...values) : statement).first<T>();
};
const aggregate = async (month: string, scope: string): Promise<number | null> =>
  (
    await one<{ amount: number }>(
      "SELECT amount FROM monthly_agg WHERE user_id = 'default' AND month = ? AND scope = ?",
      month,
      scope,
    )
  )?.amount ?? null;
const subsAggregates = () =>
  all<{ month: string; scope: string; amount: number }>(
    `SELECT month, scope, amount FROM monthly_agg
      WHERE user_id = 'default' AND (scope LIKE 'subs:%' OR scope = 'subs_other') ORDER BY month, scope`,
  );
const vendorRows = () =>
  all<{ user_id: string; name: string; aliases: string; accounts: string; merged_into_id: number | null }>(
    'SELECT user_id, name, aliases, accounts, merged_into_id FROM sub_vendors ORDER BY user_id, name',
  );
const operationCount = async (userId = 'default'): Promise<number> =>
  (await one<{ n: number }>('SELECT COUNT(*) AS n FROM subscription_operations WHERE user_id = ?', userId))
    ?.n ?? 0;
const claimCount = async (): Promise<number> =>
  (await one<{ n: number }>("SELECT COUNT(*) AS n FROM import_writer_claims WHERE user_id = 'default'"))?.n ??
  0;
const vendorIdOf = async (name: string, userId = 'default'): Promise<number> => {
  const row = await one<{ id: number }>(
    'SELECT id FROM sub_vendors WHERE user_id = ? AND name = ?',
    userId,
    name,
  );
  if (!row) throw new Error(`vendor ${name} missing`);
  return row.id;
};
const aliasesOf = async (name: string): Promise<string[]> => {
  const row = await one<{ aliases: string }>(
    "SELECT aliases FROM sub_vendors WHERE user_id = 'default' AND name = ?",
    name,
  );
  return JSON.parse(row?.aliases ?? '[]') as string[];
};
const isoDaysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

const deal = (userId: string, month: string, partner: string, amount: number) =>
  d1
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount)
       VALUES (?,?,?,'expense',?,'サブスク・通信','サブスク・通信',?)`,
    )
    .bind(userId, month, `${month}-05`, partner, amount);

/**
 * import-lifecycle.test.ts と同じ数え方。prepare した文の実行を 1 件、batch は文の数を足す。
 * リクエスト全体を数えるので、認証とスキーマ確認のぶんは基準のリクエストで差し引く。
 */
const countingDatabase = (database: D1Database): { database: D1Database; count: () => number } => {
  let queryCount = 0;
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrapStatement(
              (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
            );
        }
        if (property === 'run' || property === 'all' || property === 'first' || property === 'raw') {
          return (...values: unknown[]) => {
            queryCount++;
            return (Reflect.get(target, property, receiver) as (...args: unknown[]) => unknown).call(
              target,
              ...values,
            );
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    return proxy;
  };
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrapStatement(target.prepare(sql));
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          queryCount += statements.length;
          return target.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database: proxy, count: () => queryCount };
};

/** 大きな batch (統合の書込み) だけを D1 の overloaded で落とす。fence の claim は小さいので通す */
const overloadedDatabase = (database: D1Database): D1Database =>
  new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) =>
          statements.length >= 8
            ? Promise.reject(new Error('D1_ERROR: D1 DB is overloaded. Too many requests queued.'))
            : target.batch(statements);
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;

const RESET_TABLES = [
  'sub_vendors',
  'sub_vendor_review_decisions',
  'sub_vendor_exclusions',
  'monthly_agg',
  'freee_deals',
  'import_writer_claims',
  'subscription_operations',
  'subscription_revisions',
  'settings_norm_rules',
  'settings_change_log',
  'restored_monthly_agg',
  'analysis_settings',
] as const;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'subs-merge-operations',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  adminCookie = await loginForTest(app, { ...auth, DB: d1 });
  memberCookie = await loginForTest(app, { ...auth, DB: d1 }, { ...MEMBER, role: 'member' });
  expect(adminCookie).not.toBe('');
  expect(memberCookie).not.toBe('');
}, 30_000);

beforeEach(async () => {
  // 旧実装 (新しい表が無い) でも fixture を作れるよう、在る表だけを空にする
  const tables = new Set(
    (await all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name),
  );
  await d1.batch(RESET_TABLES.filter((t) => tables.has(t)).map((t) => d1.prepare(`DELETE FROM ${t}`)));
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order) VALUES
          ('default',?,'[]','[]',100),
          ('default',?,'[]','[]',200),
          ('default',?,'[]','[]',300),
          ('default',?,'[]','[]',400),
          ('other-user',?,'[]','[]',100)`,
      )
      .bind(TARGET, SOURCE, NOTE, VIDEO, OTHER_TENANT_VENDOR),
    ...MONTHS.flatMap((month) => [
      deal('default', month, TARGET, AMOUNT.target),
      deal('default', month, SOURCE, AMOUNT.source),
      deal('default', month, RAW, AMOUNT.raw),
      deal('default', month, NOTE, AMOUNT.note),
      deal('other-user', month, OTHER_TENANT_VENDOR, 999_999),
    ]),
  ]);
  await recomputeFromDeals(getDb(d1), 'default');
});

afterAll(async () => {
  await mf?.dispose();
});

describe('fixture', () => {
  it('統合前は 3 行が登録済みで、月額と subs 範囲が仕訳どおり (旧実装でも通る)', async () => {
    const before = await screen();
    expect(registered(before, TARGET)?.estimatedMonthly).toBe(AMOUNT.target);
    expect(registered(before, SOURCE)?.estimatedMonthly).toBe(AMOUNT.source);
    expect(registered(before, NOTE)?.estimatedMonthly).toBe(AMOUNT.note);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target);
      expect(await aggregate(month, `subs:${SOURCE}`)).toBe(AMOUNT.source);
      expect(await aggregate(month, `subs:${NOTE}`)).toBe(AMOUNT.note);
      expect(await aggregate(month, 'subs_other')).toBe(AMOUNT.raw);
    }
    expect(JSON.stringify(before)).not.toContain('999999');
  });
});

describe('API 契約の回帰', () => {
  it('実効別名50件超でも export/restore が根と統合元の保存定義を保つ', async () => {
    const rootAliases = Array.from({ length: 50 }, (_, index) => `root-${index}`);
    const sourceAliases = Array.from({ length: 50 }, (_, index) => `source-${index}`);
    await d1.batch([
      d1
        .prepare("UPDATE sub_vendors SET aliases=?,accounts=? WHERE user_id='default' AND name=?")
        .bind(JSON.stringify(rootAliases), '["サブスク・通信"]', TARGET),
      d1
        .prepare("UPDATE sub_vendors SET aliases=?,accounts=? WHERE user_id='default' AND name=?")
        .bind(JSON.stringify(sourceAliases), '["通信費"]', SOURCE),
    ]);
    const merged = await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    const before = await all<{ name: string; aliases: string; accounts: string; sort_order: number }>(
      "SELECT name,aliases,accounts,sort_order FROM sub_vendors WHERE user_id='default' ORDER BY name",
    );
    const exportResponse = await send('GET', '/export/json');
    expect(exportResponse.status).toBe(200);
    const backup = (await exportResponse.json()) as {
      subs: { aliases: Record<string, string[]> };
      subVendorMetadata: unknown[];
    };
    expect(backup.subs.aliases[TARGET].length).toBeGreaterThan(50);
    // 同じ移行先でも復元した定義を古い undo が上書きしない。
    const counted = countingDatabase(d1);
    await applied(await send('POST', '/restore', { body: backup, database: counted.database }));
    expect(counted.count()).toBeLessThan(50);
    await rejected(
      await undo(merged.operation.id, await revisionOf()),
      409,
      'undo_blocked_by_later_operation',
    );
    expect(
      await all(
        "SELECT name,aliases,accounts,sort_order FROM sub_vendors WHERE user_id='default' ORDER BY name",
      ),
    ).toEqual(before);
    // 空の移行先へも統合元の別名・科目を運ぶ。
    await d1.batch([
      d1.prepare("DELETE FROM sub_vendors WHERE user_id='default'"),
      d1.prepare("DELETE FROM subscription_operations WHERE user_id='default'"),
      d1.prepare("DELETE FROM subscription_revisions WHERE user_id='default'"),
      d1.prepare("DELETE FROM import_active_targets WHERE user_id='default' AND target_key='json:global'"),
    ]);
    await applied(await send('POST', '/restore', { body: backup }));
    expect(
      await all(
        "SELECT name,aliases,accounts,sort_order FROM sub_vendors WHERE user_id='default' ORDER BY name",
      ),
    ).toEqual(before);
    const source = await one<{ parent: string }>(
      "SELECT target.name AS parent FROM sub_vendors source JOIN sub_vendors target ON target.id=source.merged_into_id WHERE source.user_id='default' AND source.name=?",
      SOURCE,
    );
    expect(source?.parent).toBe(TARGET);
    const second = (await (await send('GET', '/export/json')).json()) as typeof backup;
    expect(second.subVendorMetadata).toEqual(backup.subVendorMetadata);
    expect(second.subs.aliases).toEqual(backup.subs.aliases);
  });

  it('review の key を DELETE に再利用すると 422 で、登録を残す', async () => {
    const id = await vendorIdOf(TARGET);
    const key = newKey();
    await applied(await send('POST', `/sub-vendors/${id}/review`, { key }));
    await rejected(await send('DELETE', `/sub-vendors/${id}`, { key }), 422, 'idempotency_key_reused');
    expect(await vendorIdOf(TARGET)).toBe(id);
    expect(await revisionOf()).toBe(1);
  });

  it('統合元の完全一致は第三ベンダーの部分一致より優先され、再計算とbackupでも保たれる', async () => {
    await d1
      .prepare("UPDATE sub_vendors SET aliases='[\"aqua\"]',sort_order=50 WHERE user_id='default' AND name=?")
      .bind(NOTE)
      .run();
    await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    const amount = AMOUNT.target + AMOUNT.source;
    expect(registered(await screen(), TARGET)?.estimatedMonthly).toBe(amount);
    await recomputeFromDeals(getDb(d1), 'default');
    for (const month of MONTHS) expect(await aggregate(month, `subs:${TARGET}`)).toBe(amount);
    const backup = (await (await send('GET', '/export/json')).json()) as {
      subs: { matrix: Record<string, number[]>; exactNames?: unknown };
    };
    expect(backup.subs.matrix[TARGET]).toEqual(MONTHS.map(() => amount));
    expect(backup.subs.exactNames).toBeUndefined();
    await applied(await send('POST', '/restore', { body: backup }));
    expect(registered(await screen(), TARGET)?.estimatedMonthly).toBe(amount);
    for (const month of MONTHS) expect(await aggregate(month, `subs:${TARGET}`)).toBe(amount);
  });

  it('同じ kind の PUT と aliases でも command が違えば同じ key を拒否する', async () => {
    const id = await vendorIdOf(TARGET);
    const key = newKey();
    const body = { aliases: [RAW] };
    await applied(await send('PUT', `/sub-vendors/${id}`, { key, body }));
    await rejected(
      await send('POST', `/sub-vendors/${id}/aliases`, { key, body }),
      422,
      'idempotency_key_reused',
    );
    expect(await revisionOf()).toBe(1);
  });

  it('同じ親参照のまま別名と判断をJSON復元しても古い merge undo が上書きしない', async () => {
    const merged = await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    const backup = (await (await send('GET', '/export/json')).json()) as {
      subVendorMetadata: Array<{ name: string; aliases: string[] }>;
      subVendorReviewDecisions: unknown[];
    };
    const restoredAliases = ['復元した別名'];
    backup.subVendorMetadata.find((row) => row.name === TARGET)!.aliases = restoredAliases;
    const key = registered(await screen(), TARGET)!.vendorKey;
    backup.subVendorReviewDecisions = [
      {
        vendorKey: key,
        decision: 'dismissed',
        ruleFingerprint: 'restored-fingerprint',
        decidedAt: new Date().toISOString(),
      },
    ];
    await applied(await send('POST', '/restore', { body: backup }));
    const before = await subsAggregates();
    await rejected(
      await undo(merged.operation.id, await revisionOf()),
      409,
      'undo_blocked_by_later_operation',
    );
    expect(await subsAggregates()).toEqual(before);
    expect(await aliasesOf(TARGET)).toEqual(restoredAliases);
    expect((await operationList()).operations.find((op) => op.id === merged.operation.id)?.undoable).toBe(
      false,
    );
    expect(
      await one<{ decision: string }>(
        "SELECT decision FROM sub_vendor_review_decisions WHERE user_id='default' AND vendor_key=?",
        key,
      ),
    ).toEqual({ decision: 'dismissed' });
  });

  it('書込み投影は保存済み account_norm でなく現在の原本科目ルールを使う', async () => {
    await d1.batch([
      d1.prepare("UPDATE freee_deals SET account_norm='旧ラベル' WHERE user_id='default'"),
      d1
        .prepare(
          "INSERT INTO settings_norm_rules (user_id,rule_id,kind,raw,norm,sort_order,enabled,updated_at,updated_by) VALUES ('default','test-account','account','サブスク・通信','新ラベル',1,1,?,'system')",
        )
        .bind(new Date().toISOString()),
      d1
        .prepare("UPDATE sub_vendors SET accounts=? WHERE user_id='default' AND name=?")
        .bind('["新ラベル"]', TARGET),
    ]);
    await applied(await merge({ targetId: await vendorIdOf(TARGET), rawNames: [RAW], baseRevision: 0 }));
    for (const month of MONTHS)
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target + AMOUNT.raw);
    const afterMerge = await subsAggregates();
    await recomputeFromDeals(getDb(d1), 'default');
    expect(await subsAggregates()).toEqual(afterMerge);
  });

  it('原本のない baseline 月も merge と全体再計算で同じ根へ集計する', async () => {
    await d1.batch([
      d1
        .prepare(
          "INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES ('default','2026-06',?,100),('default','2026-06',?,200)",
        )
        .bind(`subs:${TARGET}`, `subs:${SOURCE}`),
    ]);
    await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    expect(await aggregate('2026-06', `subs:${TARGET}`)).toBe(300);
    const afterMerge = await subsAggregates();
    await recomputeFromDeals(getDb(d1), 'default');
    expect(await subsAggregates()).toEqual(afterMerge);
  });

  it('並列 GET は成功し、読取り中の更新は409にして次の取得で画面と revision を揃える', async () => {
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    let resume!: () => void;
    const resumed = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let paused = false;
    const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property) {
          if (property === 'bind') return (...args: unknown[]) => wrap(target.bind(...args), sql);
          if ((property === 'all' || property === 'raw') && /from "sub_vendors"/i.test(sql))
            return async (...args: unknown[]) => {
              if (!paused) {
                paused = true;
                enter();
                await resumed;
              }
              return (Reflect.get(target, property) as (...args: unknown[]) => unknown).apply(target, args);
            };
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    const database = new Proxy(d1, {
      get(target, property) {
        if (property === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const reading = send('GET', '/subscriptions', { database });
    await entered;
    try {
      const parallel = await Promise.all([
        send('GET', '/sub-vendors'),
        send('GET', '/subscription-operations'),
        send('GET', '/subscriptions'),
      ]);
      expect(parallel.map((response) => response.status)).toEqual([200, 200, 200]);
      await applied(await merge({ targetId: await vendorIdOf(TARGET), rawNames: [RAW], baseRevision: 0 }));
    } finally {
      resume();
    }
    const response = await reading;
    await rejected(response, 409, 'canonical_write_busy');
    const snapshot = await screen();
    expect(snapshot.revision).toBe(1);
    expect(registered(snapshot, TARGET)?.estimatedMonthly).toBe(AMOUNT.target + AMOUNT.raw);
    expect((await screen()).revision).toBe(1);
  });

  it('GET の版が変われば再読取りでquery予算を増幅せず409にする', async () => {
    let revision = 0;
    const database = new Proxy(d1, {
      get(target, property) {
        if (property === 'prepare')
          return (sql: string) => {
            if (sql.includes('SUBS_READ_SNAPSHOT')) {
              const statement = {
                bind: () => statement,
                first: async () => ({
                  revision: revision++,
                  writer: null,
                  settingsRevision: null,
                  importRevision: null,
                }),
              };
              return statement;
            }
            return target.prepare(sql);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    await rejected(await send('GET', '/subscriptions', { database }), 409, 'canonical_write_busy');
    expect(revision).toBe(2);
  });

  it('各 GET の snapshot 検査を含む実D1問い合わせは50未満に収まる', async () => {
    for (const path of ['/subscriptions', '/sub-vendors', '/subscription-operations']) {
      const counted = countingDatabase(d1);
      const response = await send('GET', path, { database: counted.database });
      expect(response.status, await response.text()).toBe(200);
      expect(counted.count(), path).toBeLessThan(50);
    }
  });
});

describe('統合 (AC-001・AC-002)', () => {
  it('統合元の行が一覧から消え、統合先の月額と subs 範囲が統合前の和になる', async () => {
    const before = await screen();
    expect(before.revision).toBe(0);
    const targetId = await vendorIdOf(TARGET);
    const response = await merge({
      targetId,
      sourceVendorIds: [await vendorIdOf(SOURCE)],
      baseRevision: before.revision,
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const result = await applied(response);
    expect(result).toMatchObject({
      operation: { kind: 'merge', targetVendorId: targetId },
      revision: 1,
      replayed: false,
    });
    expect(result.operation.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(Number.isNaN(Date.parse(result.operation.createdAt))).toBe(false);

    const after = await screen();
    expect(after.rows.filter((row) => row.normalizedName === SOURCE)).toEqual([]);
    expect(registered(after, TARGET)?.estimatedMonthly).toBe(AMOUNT.target + AMOUNT.source);
    expect(registered(after, NOTE)?.estimatedMonthly).toBe(AMOUNT.note);
    expect(after.revision).toBe(1);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target + AMOUNT.source);
      expect(await aggregate(month, `subs:${SOURCE}`)).toBeNull();
      expect(await aggregate(month, `subs:${NOTE}`)).toBe(AMOUNT.note);
      expect(await aggregate(month, 'subs_other')).toBe(AMOUNT.raw);
    }
    // 統合元の行は消さず、統合先を指す
    const source = await one<{ merged_into_id: number | null }>(
      "SELECT merged_into_id FROM sub_vendors WHERE user_id = 'default' AND name = ?",
      SOURCE,
    );
    expect(source?.merged_into_id).toBe(targetId);
  });

  it('未登録の取引名は統合先の別名になり、その額が subs_other から統合先へ移る', async () => {
    const result = await applied(
      await merge({ targetId: await vendorIdOf(TARGET), rawNames: [RAW], baseRevision: 0 }),
    );
    expect(result.revision).toBe(1);
    expect(await aliasesOf(TARGET)).toEqual([RAW]);
    const after = await screen();
    expect(after.rows.filter((row) => row.normalizedName === RAW)).toEqual([]);
    expect(registered(after, TARGET)?.estimatedMonthly).toBe(AMOUNT.target + AMOUNT.raw);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target + AMOUNT.raw);
      expect((await aggregate(month, 'subs_other')) ?? 0).toBe(0);
    }
  });

  it('GET /sub-vendors は revision と各ベンダーの mergedIntoId を返す', async () => {
    const targetId = await vendorIdOf(TARGET);
    await applied(await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }));
    const response = await send('GET', '/sub-vendors');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      vendors: Array<{ name: string; mergedIntoId: number | null }>;
      revision: number;
    };
    expect(body.revision).toBe(1);
    expect(body.vendors.find((v) => v.name === SOURCE)?.mergedIntoId).toBe(targetId);
    expect(body.vendors.find((v) => v.name === TARGET)?.mergedIntoId).toBeNull();
    expect(JSON.stringify(body)).not.toContain(OTHER_TENANT_VENDOR);
  });

  it('統合と取り消しの問い合わせは、認証とスキーマ確認のぶんを除いて 20 未満', async () => {
    const counted = countingDatabase(d1);
    const database = counted.database;
    const measure = async (run: () => Promise<Response>) => {
      const start = counted.count();
      const response = await run();
      return { response, queries: counted.count() - start };
    };
    // zValidator の 400 は handler に入らないので、認証とスキーマ確認だけの件数になる
    const baseline = await measure(() => send('GET', '/subscription-operations?limit=0', { database }));
    expect(baseline.response.status).toBe(400);
    expect(baseline.queries).toBeGreaterThan(0);

    // 統合と取り消しの件数には lease の取得・解放も含む (予算は統合 17・取り消し 18)
    const real = await measure(async () =>
      merge(
        {
          targetId: await vendorIdOf(TARGET),
          sourceVendorIds: [await vendorIdOf(SOURCE)],
          rawNames: [RAW],
          baseRevision: 0,
        },
        { database },
      ),
    );
    const operation = await applied(real.response);
    // vendorIdOf の 2 件は d1 を直に読むので数に入らない
    expect(real.queries - baseline.queries).toBeLessThan(20);
    expect(real.queries).toBeGreaterThan(baseline.queries);

    const undone = await measure(() => undo(operation.operation.id, operation.revision, { database }));
    await applied(undone.response);
    expect(undone.queries - baseline.queries).toBeLessThan(20);
  });
});

describe('連続と同時 (AC-004・AC-005)', () => {
  it('5 件を連続で送ると全件 200 で、最終の subs 範囲が最後の状態と一致する', async () => {
    const targetId = await vendorIdOf(TARGET);
    const bodies: Array<Pick<MergeBody, 'targetId' | 'sourceVendorIds' | 'rawNames'>> = [
      { targetId, sourceVendorIds: [await vendorIdOf(SOURCE)] },
      { targetId, rawNames: [RAW] },
      { targetId, sourceVendorIds: [await vendorIdOf(NOTE)] },
      { targetId, sourceVendorIds: [await vendorIdOf(VIDEO)] },
      { targetId, rawNames: ['架空追加の名前'] },
    ];
    let revision = 0;
    for (const body of bodies) {
      const result = await applied(await merge({ ...body, baseRevision: revision }));
      expect(result.revision).toBe(revision + 1);
      revision = result.revision;
    }
    const total = AMOUNT.target + AMOUNT.source + AMOUNT.raw + AMOUNT.note;
    const after = await screen();
    expect(after.revision).toBe(5);
    expect(after.rows.filter((row) => row.status === 'registered').map((row) => row.normalizedName)).toEqual([
      TARGET,
    ]);
    expect(registered(after, TARGET)?.estimatedMonthly).toBe(total);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(total);
      expect(await aggregate(month, `subs:${SOURCE}`)).toBeNull();
      expect(await aggregate(month, `subs:${NOTE}`)).toBeNull();
      expect((await aggregate(month, 'subs_other')) ?? 0).toBe(0);
    }
    expect(await operationCount()).toBe(5);
    expect(await claimCount()).toBe(0);
  });

  it('5 件を同時に送ると 200 は 1 件だけで、残りは未適用の 409、500 は 0 件', async () => {
    const targetId = await vendorIdOf(TARGET);
    const bodies: Array<Pick<MergeBody, 'targetId' | 'sourceVendorIds' | 'rawNames'>> = [
      { targetId, sourceVendorIds: [await vendorIdOf(SOURCE)] },
      { targetId, sourceVendorIds: [await vendorIdOf(NOTE)] },
      { targetId, sourceVendorIds: [await vendorIdOf(VIDEO)] },
      { targetId, rawNames: [RAW] },
      { targetId, rawNames: ['架空追加の名前'] },
    ];
    const responses = await Promise.all(bodies.map((body) => merge({ ...body, baseRevision: 0 })));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status >= 500)).toEqual([]);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(4);
    for (const response of responses.filter((r) => r.status === 409)) {
      const body = (await response.json()) as ErrorBody;
      expect(['canonical_write_busy', 'subscription_revision_conflict']).toContain(body.error.code);
    }
    // 集計は勝った 1 件の操作だけを反映する
    const winner = statuses.indexOf(200);
    const expectedTarget = [
      AMOUNT.target + AMOUNT.source,
      AMOUNT.target + AMOUNT.note,
      AMOUNT.target,
      AMOUNT.target + AMOUNT.raw,
      AMOUNT.target,
    ][winner];
    for (const month of MONTHS) expect(await aggregate(month, `subs:${TARGET}`)).toBe(expectedTarget);
    expect(await operationCount()).toBe(1);
    expect(await revisionOf()).toBe(1);
    expect(await claimCount()).toBe(0);
  });

  it('2 人が同時に送ると片方が 200、もう片方は未適用の 409 で、集計は 200 の操作と一致する', async () => {
    const targetId = await vendorIdOf(TARGET);
    const [byAdmin, byMember] = await Promise.all([
      merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }, { as: 'admin' }),
      merge({ targetId, sourceVendorIds: [await vendorIdOf(NOTE)], baseRevision: 0 }, { as: 'member' }),
    ]);
    expect([byAdmin.status, byMember.status].sort((a, b) => a - b)).toEqual([200, 409]);
    const loser = byAdmin.status === 409 ? byAdmin : byMember;
    expect(['canonical_write_busy', 'subscription_revision_conflict']).toContain(
      ((await loser.json()) as ErrorBody).error.code,
    );
    const adminWon = byAdmin.status === 200;
    const operations = await all<{ actor_user_id: string }>(
      "SELECT actor_user_id FROM subscription_operations WHERE user_id = 'default'",
    );
    expect(operations).toEqual([{ actor_user_id: adminWon ? TEST_ADMIN.id : MEMBER.id }]);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(
        AMOUNT.target + (adminWon ? AMOUNT.source : AMOUNT.note),
      );
      expect(await aggregate(month, `subs:${SOURCE}`)).toBe(adminWon ? null : AMOUNT.source);
      expect(await aggregate(month, `subs:${NOTE}`)).toBe(adminWon ? AMOUNT.note : null);
    }
  });
});

describe('Idempotency-Key (AC-006・BR-007)', () => {
  it('同じ key と本文の再送は replayed: true で同じ id を返し、1 回分しか変わらない', async () => {
    const key = newKey();
    const body = {
      targetId: await vendorIdOf(TARGET),
      sourceVendorIds: [await vendorIdOf(SOURCE)],
      rawNames: [RAW],
      baseRevision: 0,
    };
    const first = await applied(await merge(body, { key }));
    const second = await applied(await merge(body, { key }));
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ ...first, replayed: true });
    expect(await operationCount()).toBe(1);
    expect(await revisionOf()).toBe(1);
    expect(await aliasesOf(TARGET)).toEqual([RAW]);
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target + AMOUNT.source + AMOUNT.raw);
    }

    // 同じ key で本文が違えば、上書きも二重適用もしない
    await rejected(
      await merge({ ...body, rawNames: ['架空別の名前'] }, { key }),
      422,
      'idempotency_key_reused',
    );
    expect(await operationCount()).toBe(1);
    expect(await aliasesOf(TARGET)).toEqual([RAW]);
    // key は操作者ごと。別の利用者が同じ key を送っても再送とはみなさない (base が古いので 409)
    await rejected(await merge(body, { key, as: 'member' }), 409, 'subscription_revision_conflict');
    expect(await operationCount()).toBe(1);
  });

  it('Idempotency-Key が無い・形式が違えば 400 idempotency_key_required で、何も変えない', async () => {
    const body = {
      targetId: await vendorIdOf(TARGET),
      sourceVendorIds: [await vendorIdOf(SOURCE)],
      baseRevision: 0,
    };
    for (const key of [null, 'short77', 'k'.repeat(65), 'test_key_0001', 'test key 0001']) {
      await rejected(await merge(body, { key }), 400, 'idempotency_key_required');
    }
    expect(await operationCount()).toBe(0);
    // 8 文字と 64 文字は受け付ける
    await applied(await merge(body, { key: 'abcd-123' }));
    await applied(
      await merge({ targetId: body.targetId, rawNames: [RAW], baseRevision: 1 }, { key: 'a'.repeat(64) }),
    );
    const operation = await one<{ id: string }>(
      "SELECT id FROM subscription_operations WHERE user_id = 'default' AND kind = 'merge' ORDER BY base_revision DESC",
    );
    await rejected(await undo(operation?.id ?? 'missing', 2, { key: null }), 400, 'idempotency_key_required');
    expect(await revisionOf()).toBe(2);
  });

  it('本文を消した key の再送は 422 idempotency_key_expired', async () => {
    const key = newKey();
    const body = {
      targetId: await vendorIdOf(TARGET),
      sourceVendorIds: [await vendorIdOf(SOURCE)],
      baseRevision: 0,
    };
    await applied(await merge(body, { key }));
    await d1
      .prepare(
        "UPDATE subscription_operations SET payload_json = NULL, before_json = NULL WHERE user_id = 'default'",
      )
      .run();
    await rejected(await merge(body, { key }), 422, 'idempotency_key_expired');
    expect(await operationCount()).toBe(1);
    expect(await revisionOf()).toBe(1);
  });

  it('登録の再送も同じ id を返し (replayed: true)、登録は 1 件だけ', async () => {
    const key = newKey();
    const body = { name: '架空再送' };
    const first = await send('POST', '/sub-vendors', { body, key });
    const firstText = await first.text();
    expect(first.status, firstText).toBe(200);
    const created = JSON.parse(firstText) as { ok: boolean; id: number; revision: number };
    const second = await send('POST', '/sub-vendors', { body, key });
    const secondText = await second.text();
    expect(second.status, secondText).toBe(200);
    expect(JSON.parse(secondText)).toEqual({ ...created, replayed: true });
    expect(created.id).toBe(await vendorIdOf('架空再送'));
    expect(
      await one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM sub_vendors WHERE user_id = 'default' AND name = ?",
        '架空再送',
      ),
    ).toEqual({ n: 1 });
    expect(await operationCount()).toBe(1);
  });
});

describe('入力の境界 (BR-001〜BR-006)', () => {
  it('統合元は 50 件まで受理し、51 件と重複は 400', async () => {
    await d1
      .prepare(
        `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order)
         WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 50)
         SELECT 'default', '架空一括' || i, '[]', '[]', 1000 + i FROM n`,
      )
      .run();
    const bulk = (
      await all<{ id: number }>("SELECT id FROM sub_vendors WHERE name LIKE '架空一括%' ORDER BY id")
    ).map((row) => row.id);
    expect(bulk).toHaveLength(50);
    const targetId = await vendorIdOf(TARGET);
    const sourceId = await vendorIdOf(SOURCE);

    await rejected(await merge({ targetId, sourceVendorIds: [...bulk, sourceId], baseRevision: 0 }), 400);
    await rejected(await merge({ targetId, sourceVendorIds: [sourceId, sourceId], baseRevision: 0 }), 400);
    expect(await operationCount()).toBe(0);

    await applied(await merge({ targetId, sourceVendorIds: bulk, baseRevision: 0 }));
    const merged = await all<{ merged_into_id: number | null }>(
      "SELECT merged_into_id FROM sub_vendors WHERE name LIKE '架空一括%'",
    );
    expect(merged.every((row) => row.merged_into_id === targetId)).toBe(true);
  });

  it('取引名は 120 文字まで受理し、121 文字・51 件・制御文字・空は 400', async () => {
    const targetId = await vendorIdOf(TARGET);
    const invalid: string[][] = [
      ['あ'.repeat(121)],
      Array.from({ length: 51 }, (_, i) => `架空取引${i}`),
      ['架空\u0007名前'],
      ['架空\n名前'],
      [''],
      ['   '],
    ];
    for (const rawNames of invalid) await rejected(await merge({ targetId, rawNames, baseRevision: 0 }), 400);
    expect(await operationCount()).toBe(0);
    await applied(await merge({ targetId, rawNames: ['あ'.repeat(120)], baseRevision: 0 }));
    expect(await aliasesOf(TARGET)).toEqual(['あ'.repeat(120)]);
  });

  it('統合後の別名が 50 件を超えるなら 400 too_many_aliases で、何も変えない', async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `架空別名${String(i).padStart(2, '0')}`);
    await d1
      .prepare("UPDATE sub_vendors SET aliases = ? WHERE user_id = 'default' AND name = ?")
      .bind(JSON.stringify(fifty), TARGET)
      .run();
    await rejected(
      await merge({ targetId: await vendorIdOf(TARGET), rawNames: ['架空五十一番目'], baseRevision: 0 }),
      400,
      'too_many_aliases',
    );
    expect(await aliasesOf(TARGET)).toEqual(fifty);
    expect(await operationCount()).toBe(0);
  });

  it('統合元と取引名が両方空なら 400 empty_merge、自己統合は 422 merge_cycle', async () => {
    const targetId = await vendorIdOf(TARGET);
    await rejected(await merge({ targetId, baseRevision: 0 }), 400, 'empty_merge');
    await rejected(
      await merge({ targetId, sourceVendorIds: [targetId], baseRevision: 0 }),
      422,
      'merge_cycle',
    );
    await rejected(
      await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE), targetId], baseRevision: 0 }),
      422,
      'merge_cycle',
    );
    expect(await operationCount()).toBe(0);
    expect(await revisionOf()).toBe(0);
  });

  it('統合済みの行を統合先・統合元に選ぶと 409 subscription_revision_conflict で未適用', async () => {
    const targetId = await vendorIdOf(TARGET);
    const sourceId = await vendorIdOf(SOURCE);
    const noteId = await vendorIdOf(NOTE);
    await applied(await merge({ targetId, sourceVendorIds: [sourceId], baseRevision: 0 }));
    const before = await vendorRows();
    await rejected(
      await merge({ targetId: sourceId, sourceVendorIds: [noteId], baseRevision: 1 }),
      409,
      'subscription_revision_conflict',
    );
    await rejected(
      await merge({ targetId: noteId, sourceVendorIds: [sourceId], baseRevision: 1 }),
      409,
      'subscription_revision_conflict',
    );
    expect(await vendorRows()).toEqual(before);
    expect(await operationCount()).toBe(1);
    expect(await revisionOf()).toBe(1);
  });

  it('統合元の子を統合先に選ぶ循環 (BR-005) も、統合済みの行として 409 で止め未適用 (BR-001 が先)', async () => {
    const parentId = await vendorIdOf(TARGET);
    const childId = await vendorIdOf(SOURCE);
    await applied(await merge({ targetId: parentId, sourceVendorIds: [childId], baseRevision: 0 }));
    const revision = await revisionOf();
    await rejected(
      await merge({ targetId: childId, sourceVendorIds: [parentId], baseRevision: revision }),
      409,
      'subscription_revision_conflict',
    );
    expect(await revisionOf()).toBe(revision);
    expect(
      await one<{ merged_into_id: number | null }>(
        'SELECT merged_into_id FROM sub_vendors WHERE id = ?',
        parentId,
      ),
    ).toEqual({ merged_into_id: null });
    expect(await operationCount()).toBe(1);
  });

  it('テナントに無い id は 404 で、他テナントの行は変わらない (AC-012)', async () => {
    const targetId = await vendorIdOf(TARGET);
    const otherId = await vendorIdOf(OTHER_TENANT_VENDOR, 'other-user');
    const before = await vendorRows();
    await rejected(
      await merge({ targetId: otherId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }),
      404,
      'not_found',
    );
    await rejected(await merge({ targetId, sourceVendorIds: [otherId], baseRevision: 0 }), 404, 'not_found');
    await rejected(await merge({ targetId, sourceVendorIds: [999_999], baseRevision: 0 }), 404, 'not_found');
    await rejected(await merge({ targetId: 999_999, rawNames: [RAW], baseRevision: 0 }), 404, 'not_found');
    expect(await vendorRows()).toEqual(before);
    expect(await operationCount()).toBe(0);
    expect(await operationCount('other-user')).toBe(0);
  });

  it('本文の user_id と actor は無視し、テナントと操作者はセッションから取る', async () => {
    await applied(
      await merge(
        {
          targetId: await vendorIdOf(TARGET),
          sourceVendorIds: [await vendorIdOf(SOURCE)],
          baseRevision: 0,
          user_id: 'other-user',
          userId: 'other-user',
          actor: 'usr_evil',
          actorUserId: 'usr_evil',
        },
        { as: 'member' },
      ),
    );
    expect(
      await all<{ user_id: string; actor_user_id: string }>(
        'SELECT user_id, actor_user_id FROM subscription_operations',
      ),
    ).toEqual([{ user_id: 'default', actor_user_id: MEMBER.id }]);
    const other = await one<{ aliases: string; merged_into_id: number | null }>(
      "SELECT aliases, merged_into_id FROM sub_vendors WHERE user_id = 'other-user'",
    );
    expect(other).toEqual({ aliases: '[]', merged_into_id: null });
  });
});

describe('revision の衝突 (AC-014・BR-008)', () => {
  it('revision が 8 のとき base 7 の統合と PUT は 409 で、sub_vendors・操作・revision が変わらない', async () => {
    await d1
      .prepare("INSERT INTO subscription_revisions (user_id, revision, updated_at) VALUES ('default', 8, ?)")
      .bind(new Date().toISOString())
      .run();
    expect(await revisionOf()).toBe(8);
    const targetId = await vendorIdOf(TARGET);
    const sourceId = await vendorIdOf(SOURCE);
    const before = await vendorRows();

    await rejected(
      await merge({ targetId, sourceVendorIds: [sourceId], baseRevision: 7 }),
      409,
      'subscription_revision_conflict',
    );
    await rejected(
      await send('PUT', `/sub-vendors/${targetId}`, { body: { category: '音楽', baseRevision: 7 } }),
      409,
      'subscription_revision_conflict',
    );
    expect(await vendorRows()).toEqual(before);
    expect(await operationCount()).toBe(0);
    expect(await revisionOf()).toBe(8);

    const result = await applied(await merge({ targetId, sourceVendorIds: [sourceId], baseRevision: 8 }));
    expect(result.revision).toBe(9);
  });
});

describe('取り消し (AC-013・AC-017・AC-019・BR-009)', () => {
  it('別の利用者の統合を取り消すと、統合前と同じ行・月額・subs 範囲に戻り、両方の actor が残る', async () => {
    const monthlyOf = (data: Screen) =>
      Object.fromEntries(
        data.rows
          .filter((row) => row.status === 'registered')
          .map((row) => [row.normalizedName, row.estimatedMonthly]),
      );
    const beforeScreen = monthlyOf(await screen());
    const beforeAggregates = await subsAggregates();
    const beforeVendors = await vendorRows();

    const merged = await applied(
      await merge(
        {
          targetId: await vendorIdOf(TARGET),
          sourceVendorIds: [await vendorIdOf(SOURCE)],
          rawNames: [RAW],
          baseRevision: 0,
        },
        { as: 'member' },
      ),
    );
    expect(await subsAggregates()).not.toEqual(beforeAggregates);

    const undone = await applied(await undo(merged.operation.id, merged.revision, { as: 'admin' }));
    expect(undone).toMatchObject({
      operation: { kind: 'unmerge', undoesId: merged.operation.id },
      revision: 2,
      replayed: false,
    });
    expect(monthlyOf(await screen())).toEqual(beforeScreen);
    expect(await subsAggregates()).toEqual(beforeAggregates);
    expect(await vendorRows()).toEqual(beforeVendors);

    const rows = await all<{ id: string; kind: string; actor_user_id: string; undoes_id: string | null }>(
      "SELECT id, kind, actor_user_id, undoes_id FROM subscription_operations WHERE user_id = 'default' ORDER BY base_revision",
    );
    expect(rows).toEqual([
      { id: merged.operation.id, kind: 'merge', actor_user_id: MEMBER.id, undoes_id: null },
      {
        id: undone.operation.id,
        kind: 'unmerge',
        actor_user_id: TEST_ADMIN.id,
        undoes_id: merged.operation.id,
      },
    ]);
    const list = await operationList();
    expect(list.operations.map((op) => [op.kind, op.actorEmail])).toEqual([
      ['unmerge', TEST_ADMIN.email],
      ['merge', MEMBER.email],
    ]);
    expect(list.operations[1]).toMatchObject({
      undoneByEmail: TEST_ADMIN.email,
      undoable: false,
      undoBlockedReason: 'already_undone',
    });
    expect(list.operations[1]?.undoneAt).not.toBeNull();
  });

  it('二重の取り消しは 409 already_undone、unmerge・テナントに無い id は 404、形式違いの id は 400', async () => {
    const merged = await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    const undone = await applied(await undo(merged.operation.id, 1));
    await rejected(await undo(merged.operation.id, 2), 409, 'already_undone');
    await rejected(await undo(undone.operation.id, 2), 404, 'not_found');
    await rejected(await undo('op_missing', 2), 404, 'not_found');
    await rejected(await undo('bad!id', 2), 400);
    await rejected(await undo('a'.repeat(65), 2), 400);
    expect(await revisionOf()).toBe(2);
  });

  it('他テナントへ付け替えた操作は取り消せず 404 (AC-012)', async () => {
    const merged = await applied(
      await merge({
        targetId: await vendorIdOf(TARGET),
        sourceVendorIds: [await vendorIdOf(SOURCE)],
        baseRevision: 0,
      }),
    );
    await d1
      .prepare("UPDATE subscription_operations SET user_id = 'other-user' WHERE id = ?")
      .bind(merged.operation.id)
      .run();
    await rejected(await undo(merged.operation.id, 1), 404, 'not_found');
    expect((await operationList()).operations).toEqual([]);
    const source = await one<{ merged_into_id: number | null }>(
      "SELECT merged_into_id FROM sub_vendors WHERE user_id = 'default' AND name = ?",
      SOURCE,
    );
    expect(source?.merged_into_id).toBe(await vendorIdOf(TARGET));
  });

  it('同じ統合先への後続の統合があると先の取り消しは 409 blocked で、後から順に戻せる (AC-017)', async () => {
    const targetId = await vendorIdOf(TARGET);
    const first = await applied(
      await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }),
    );
    const second = await applied(await merge({ targetId, rawNames: [RAW], baseRevision: 1 }));

    const listed = await operationList();
    expect(listed.operations.map((op) => [op.id, op.undoable, op.undoBlockedReason])).toEqual([
      [second.operation.id, true, null],
      [first.operation.id, false, 'undo_blocked_by_later_operation'],
    ]);
    await rejected(await undo(first.operation.id, 2), 409, 'undo_blocked_by_later_operation');
    expect(await revisionOf()).toBe(2);

    await applied(await undo(second.operation.id, 2));
    await applied(await undo(first.operation.id, 3));
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBe(AMOUNT.target);
      expect(await aggregate(month, `subs:${SOURCE}`)).toBe(AMOUNT.source);
      expect(await aggregate(month, 'subs_other')).toBe(AMOUNT.raw);
    }
  });

  it('29 日前の統合は取り消せ、31 日前と変更前の内容を消した統合は 410 undo_expired (AC-019)', async () => {
    const targetId = await vendorIdOf(TARGET);
    const sourceId = await vendorIdOf(SOURCE);
    const setCreatedAt = (id: string, days: number) =>
      d1
        .prepare('UPDATE subscription_operations SET created_at = ? WHERE id = ?')
        .bind(isoDaysAgo(days), id)
        .run();

    const recent = await applied(await merge({ targetId, sourceVendorIds: [sourceId], baseRevision: 0 }));
    await setCreatedAt(recent.operation.id, 29);
    await applied(await undo(recent.operation.id, 1));

    const old = await applied(await merge({ targetId, sourceVendorIds: [sourceId], baseRevision: 2 }));
    await setCreatedAt(old.operation.id, 31);
    await rejected(await undo(old.operation.id, 3), 410, 'undo_expired');

    const noteId = await vendorIdOf(NOTE);
    const cleared = await applied(
      await merge({ targetId: noteId, sourceVendorIds: [await vendorIdOf(VIDEO)], baseRevision: 3 }),
    );
    await d1
      .prepare('UPDATE subscription_operations SET before_json = NULL WHERE id = ?')
      .bind(cleared.operation.id)
      .run();
    await rejected(await undo(cleared.operation.id, 4), 410, 'undo_expired');
    expect(await revisionOf()).toBe(4);
  });
});

describe('掃除 (BR-013・AC-019)', () => {
  const seedOldOperations = (days: number, withBody: boolean) =>
    d1
      .prepare(
        `INSERT INTO subscription_operations
          (id,user_id,actor_user_id,idempotency_key,kind,target_vendor_id,payload_json,before_json,base_revision,undoes_id,undone_at,created_at)
         WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
         SELECT 'op_old_' || i, 'default', ?, 'old-key-' || i, 'vendor_update', NULL, ?, ?, 100000 + i, NULL, NULL, ?
           FROM n`,
      )
      .bind(TEST_ADMIN.id, withBody ? '{}' : null, withBody ? '{}' : null, isoDaysAgo(days))
      .run();
  const oldWithBody = async () =>
    (
      await one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM subscription_operations
          WHERE id LIKE 'op_old_%' AND (payload_json IS NOT NULL OR before_json IS NOT NULL)`,
      )
    )?.n ?? 0;
  const oldRows = async () =>
    (await one<{ n: number }>("SELECT COUNT(*) AS n FROM subscription_operations WHERE id LIKE 'op_old_%'"))
      ?.n ?? 0;

  it('30 日を過ぎた行の本文と変更前の内容は、1 回の書込みで 50 件まで NULL になる', async () => {
    await seedOldOperations(31, true);
    expect(await oldWithBody()).toBe(60);
    const targetId = await vendorIdOf(TARGET);
    const first = await applied(
      await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }),
    );
    expect(await oldWithBody()).toBe(10);
    await applied(await merge({ targetId, rawNames: [RAW], baseRevision: 1 }));
    expect(await oldWithBody()).toBe(0);
    // 行そのものは消さない。新しい操作の本文は残る
    expect(await oldRows()).toBe(60);
    const fresh = await one<{ payload_json: string | null; before_json: string | null }>(
      'SELECT payload_json, before_json FROM subscription_operations WHERE id = ?',
      first.operation.id,
    );
    expect(fresh?.payload_json).not.toBeNull();
    expect(fresh?.before_json).not.toBeNull();
  });

  it('400 日を過ぎた行は、1 回の書込みで 50 件まで消える', async () => {
    await seedOldOperations(401, false);
    expect(await oldRows()).toBe(60);
    const targetId = await vendorIdOf(TARGET);
    await applied(await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }));
    expect(await oldRows()).toBe(10);
    await applied(await merge({ targetId, rawNames: [RAW], baseRevision: 1 }));
    expect(await oldRows()).toBe(0);
    expect(await operationCount()).toBe(2);
  });
});

describe('並行制御の失敗は未適用で返す (O2)', () => {
  it('別の書込みが lease を持つ間は 409 canonical_write_busy で、何も変えない', async () => {
    const before = await vendorRows();
    const beforeAggregates = await subsAggregates();
    await d1
      .prepare('INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at) VALUES (?,?,?,?)')
      .bind('default', 'import:other', Date.now(), Date.now() + 600_000)
      .run();
    try {
      const body = await rejected(
        await merge({
          targetId: await vendorIdOf(TARGET),
          sourceVendorIds: [await vendorIdOf(SOURCE)],
          baseRevision: 0,
        }),
        409,
        'canonical_write_busy',
      );
      expect(body.error.message).toBe('別の取込みまたは更新が進行中です。完了後に再試行してください');
    } finally {
      await d1.prepare("DELETE FROM import_writer_claims WHERE user_id = 'default'").run();
    }
    expect(await vendorRows()).toEqual(before);
    expect(await subsAggregates()).toEqual(beforeAggregates);
    expect(await operationCount()).toBe(0);
  });

  it('D1 が overloaded を返すと 503 d1_overloaded (retryable) で、未適用のまま lease を返す', async () => {
    const before = await vendorRows();
    const beforeAggregates = await subsAggregates();
    const key = newKey();
    const body = {
      targetId: await vendorIdOf(TARGET),
      sourceVendorIds: [await vendorIdOf(SOURCE)],
      baseRevision: 0,
    };
    const failed = await rejected(
      await merge(body, { key, database: overloadedDatabase(d1) }),
      503,
      'd1_overloaded',
    );
    expect(failed.error.retryable).toBe(true);
    expect(await vendorRows()).toEqual(before);
    expect(await subsAggregates()).toEqual(beforeAggregates);
    expect(await operationCount()).toBe(0);
    expect(await claimCount()).toBe(0);
    // 同じ key の自動再送は、未適用だったので新しい操作として通る
    const retried = await applied(await merge(body, { key }));
    expect(retried.replayed).toBe(false);
    expect(retried.revision).toBe(1);
  });
});

describe('操作の一覧 (GET /api/subscription-operations)', () => {
  it('limit は 1〜20 (既定 20) で、範囲外は 400', async () => {
    const targetId = await vendorIdOf(TARGET);
    await applied(await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }));
    await applied(await merge({ targetId, rawNames: [RAW], baseRevision: 1 }));
    expect((await operationList('?limit=1')).operations).toHaveLength(1);
    expect((await operationList('?limit=20')).operations).toHaveLength(2);
    const byDefault = await operationList();
    expect(byDefault.operations).toHaveLength(2);
    expect(byDefault.revision).toBe(2);
    for (const query of ['?limit=0', '?limit=21', '?limit=abc']) {
      expect((await send('GET', `/subscription-operations${query}`)).status).toBe(400);
    }
  });

  it('新しい順に返し、本文・変更前・key を含めず、users に居ない操作者は null・停止中の操作者は email', async () => {
    const targetId = await vendorIdOf(TARGET);
    const mergeKey = newKey();
    const merged = await applied(
      await merge(
        { targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 },
        { key: mergeKey, as: 'member' },
      ),
    );
    await d1
      .prepare(
        `INSERT INTO subscription_operations
          (id,user_id,actor_user_id,idempotency_key,kind,target_vendor_id,payload_json,before_json,base_revision,created_at)
         VALUES
          ('op_ghost','default','usr_deleted','ghost-key-0001','vendor_update',?,'{}','{}',50,?),
          ('op_other','other-user','usr_other','other-key-0001','vendor_update',NULL,'{}','{}',1,?)`,
      )
      .bind(await vendorIdOf(NOTE), new Date(Date.now() + 60_000).toISOString(), new Date().toISOString())
      .run();
    await d1.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").bind(MEMBER.id).run();
    try {
      const response = await send('GET', '/subscription-operations');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      const text = await response.text();
      expect(response.status, text).toBe(200);
      const list = JSON.parse(text) as { operations: OperationListItem[] };
      expect(list.operations.map((op) => [op.id, op.actorEmail, op.targetVendorName])).toEqual([
        ['op_ghost', null, NOTE],
        [merged.operation.id, MEMBER.email, TARGET],
      ]);
      for (const hidden of ['payload', 'before', 'idempotency', mergeKey, 'ghost-key-0001', 'op_other']) {
        expect(text).not.toContain(hidden);
      }
    } finally {
      await d1.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(MEMBER.id).run();
    }
  });
});

describe('ログ (AC-020)', () => {
  const printable = (value: unknown): string =>
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === 'string'
        ? value
        : (JSON.stringify(value) ?? String(value));

  it('統合・取り消し・一覧のログに取引名・別名・email・金額が出ず、操作 id は出る', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const merged = await applied(
        await merge(
          {
            targetId: await vendorIdOf(TARGET),
            sourceVendorIds: [await vendorIdOf(SOURCE)],
            rawNames: [RAW],
            baseRevision: 0,
          },
          { as: 'member' },
        ),
      );
      await applied(await undo(merged.operation.id, merged.revision));
      await operationList();
      const logged = spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => args.map(printable).join(' '))
        .join('\n');
      expect(logged).toContain(merged.operation.id);
      // 書込みの記録は決まった 8 キーだけで、名前や本文を足す余地を残さない
      const writes = spies
        .flatMap((spy) => spy.mock.calls)
        .flatMap((args) => args.filter((arg): arg is string => typeof arg === 'string'))
        .flatMap((line) => {
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            return parsed?.event === 'subscription_write' ? [parsed] : [];
          } catch {
            return [];
          }
        });
      expect(writes.map((entry) => [entry.kind, entry.result, entry.operationId])).toEqual([
        ['merge', 'applied', merged.operation.id],
        ['unmerge', 'applied', expect.stringMatching(/^op_/)],
      ]);
      for (const entry of writes) {
        expect(Object.keys(entry).sort()).toEqual(
          ['actorId', 'durationMs', 'event', 'kind', 'level', 'operationId', 'requestId', 'result'].sort(),
        );
      }
      for (const secret of [TARGET, SOURCE, RAW, TEST_ADMIN.email, MEMBER.email]) {
        expect(logged).not.toContain(secret);
      }
      const amounts = [AMOUNT.target, AMOUNT.source, AMOUNT.raw, AMOUNT.target + AMOUNT.source + AMOUNT.raw];
      for (const amount of amounts) {
        // id の中の数字列を誤検知しないよう、英数字に挟まれていない金額だけを探す
        expect(logged).not.toMatch(new RegExp(`(?<![0-9A-Za-z])${amount}(?![0-9A-Za-z])`));
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('既存の書込み 9 本 (AC-018・互換)', () => {
  const latestOperation = () =>
    one<{ kind: string; actor_user_id: string; base_revision: number }>(
      `SELECT kind, actor_user_id, base_revision FROM subscription_operations
        WHERE user_id = 'default' ORDER BY base_revision DESC LIMIT 1`,
    );
  /** 1 本の書込みが、revision を 1 進め、actor 付きの操作を 1 行残したか */
  const expectRecorded = async (response: Response, kind: string, before: number): Promise<void> => {
    const text = await response.text();
    expect(response.status, text).toBe(200);
    expect((JSON.parse(text) as { revision?: number }).revision).toBe(before + 1);
    expect(await revisionOf()).toBe(before + 1);
    expect(await latestOperation()).toEqual({ kind, actor_user_id: TEST_ADMIN.id, base_revision: before });
  };

  it('baseRevision を送らなくても 200 で、それぞれ revision を 1 進め、actor 付きで操作を記録する', async () => {
    let revision = await revisionOf();
    expect(revision).toBe(0);
    const step = async (response: Promise<Response>, kind: string) => {
      await expectRecorded(await response, kind, revision);
      revision++;
    };

    await step(send('POST', '/sub-vendors', { body: { name: '架空新規' } }), 'vendor_create');
    const created = await vendorIdOf('架空新規');
    await step(send('PUT', `/sub-vendors/${created}`, { body: { category: '音楽' } }), 'vendor_update');
    await step(
      send('POST', `/sub-vendors/${created}/aliases`, { body: { aliases: ['架空新規の別名'] } }),
      'vendor_update',
    );
    await step(send('POST', `/sub-vendors/${created}/review`), 'review');

    const noteKey = (await screen()).rows.find((row) => row.normalizedName === NOTE)?.vendorKey ?? '';
    await step(
      send('POST', '/subscriptions/review-decisions', {
        body: { vendorKey: noteKey, decision: 'confirmed' },
      }),
      'review_decision',
    );
    await step(
      send('DELETE', '/subscriptions/review-decisions', { body: { vendorKey: noteKey } }),
      'review_decision',
    );

    await step(send('POST', '/sub-vendors/exclusions', { body: { partner: '架空除外先' } }), 'exclusion');
    const exclusion = await one<{ id: number }>(
      "SELECT id FROM sub_vendor_exclusions WHERE user_id = 'default'",
    );
    await step(send('DELETE', `/sub-vendors/exclusions/${exclusion?.id ?? 0}`), 'exclusion');

    await step(send('DELETE', `/sub-vendors/${created}`), 'vendor_delete');
    expect(revision).toBe(9);
    expect(await operationCount()).toBe(9);
  });

  it('失敗した書込み (404・409・422・400) では revision も操作も進まない', async () => {
    const targetId = await vendorIdOf(TARGET);
    const noop = async (response: Promise<Response>, status: number) => {
      const res = await response;
      expect(res.status, await res.text()).toBe(status);
      expect(await revisionOf()).toBe(0);
      expect(await operationCount()).toBe(0);
    };
    await noop(send('PUT', '/sub-vendors/999999', { body: { category: '音楽' } }), 404);
    await noop(send('PUT', `/sub-vendors/${targetId}`, { body: { category: '音楽', baseRevision: 5 } }), 409);
    await noop(merge({ targetId, sourceVendorIds: [targetId], baseRevision: 0 }), 422);
    await noop(merge({ targetId, baseRevision: 0 }), 400);
    await noop(send('POST', '/sub-vendors', { body: { name: '' } }), 400);
    await noop(send('DELETE', '/sub-vendors/999999'), 404);
  });

  it('統合済みの行への PUT・別名・見直し日・削除は 409 subscription_revision_conflict で未適用', async () => {
    const sourceId = await vendorIdOf(SOURCE);
    await applied(
      await merge({ targetId: await vendorIdOf(TARGET), sourceVendorIds: [sourceId], baseRevision: 0 }),
    );
    const before = await vendorRows();
    await rejected(
      await send('PUT', `/sub-vendors/${sourceId}`, { body: { category: '音楽' } }),
      409,
      'subscription_revision_conflict',
    );
    await rejected(
      await send('POST', `/sub-vendors/${sourceId}/aliases`, { body: { aliases: ['架空別名'] } }),
      409,
      'subscription_revision_conflict',
    );
    await rejected(
      await send('POST', `/sub-vendors/${sourceId}/review`),
      409,
      'subscription_revision_conflict',
    );
    await rejected(await send('DELETE', `/sub-vendors/${sourceId}`), 409, 'subscription_revision_conflict');
    expect(await vendorRows()).toEqual(before);
    expect(await revisionOf()).toBe(1);
  });

  it('統合先を削除すると統合元もまとめて消え、その取引は subs_other へ戻る', async () => {
    const targetId = await vendorIdOf(TARGET);
    await applied(await merge({ targetId, sourceVendorIds: [await vendorIdOf(SOURCE)], baseRevision: 0 }));
    const deleted = await send('DELETE', `/sub-vendors/${targetId}`);
    expect(deleted.status, await deleted.text()).toBe(200);
    expect(
      (
        await all<{ name: string }>("SELECT name FROM sub_vendors WHERE user_id = 'default' ORDER BY name")
      ).map((row) => row.name),
    ).toEqual([NOTE, VIDEO].sort());
    for (const month of MONTHS) {
      expect(await aggregate(month, `subs:${TARGET}`)).toBeNull();
      expect(await aggregate(month, `subs:${SOURCE}`)).toBeNull();
      expect(await aggregate(month, 'subs_other')).toBe(AMOUNT.target + AMOUNT.source + AMOUNT.raw);
    }
  });
});
