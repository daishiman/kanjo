/**
 * ルールのプレビューと適用の API/D1 回帰 (spec-classify-screen 7.10・BR-10・BR-11)。
 *
 * BR-11 の要は「見せた対象と書いた対象が同じであること」で、その担保が fingerprint である。
 * プレビュー以降に明細が動いたら、書かずに 409 を返して見直させる。
 * ここが緩むと「50 件に適用します」と見せた後で 60 件に当たる、が起こせる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const env = () => ({ ...auth, DB: database });
const post = (path: string, body: unknown, headers: Record<string, string> = { cookie }) =>
  app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env(),
  );

/** monthly_agg置換を含むbatchだけに制約違反を足し、ルール適用全体のrollbackを見る。 */
const failAggregateBatch = (injectFailure = true): { database: D1Database; batches: () => string[][] } => {
  const observed: string[][] = [];
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrap((target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values), sql);
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, sql);
    return proxy;
  };
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          const sql = statements.map((statement) => sqlByStatement.get(statement) ?? '');
          observed.push(sql);
          const raw = statements.map((statement) => originals.get(statement) ?? statement);
          if (injectFailure && sql.some((text) => /DELETE FROM "monthly_agg"/i.test(text))) {
            raw.push(target.prepare("INSERT INTO tx_history (id) VALUES ('forced-rule-aggregate-failure')"));
          }
          return target.batch(raw);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database: proxy, batches: () => observed };
};

const PERIOD = { from: '2026-08', to: '2026-08' };

interface PreviewBody {
  count: number;
  rows: {
    txId: string;
    date: string;
    payee: string;
    description: string;
    amount: number;
    after: { label: string; amount: number }[];
  }[];
  omitted: number;
  skipped: { txId: string; reason: string }[];
  fingerprint: string;
}

interface ApplyBody {
  applied: number;
  txIds: string[];
  skipped: { txId: string; reason: string }[];
  opId: string | null;
}

/** ルールは SQL で直に入れる。ここで試したいのは作成経路ではなく、対象の一致だから */
const insertRule = async (
  id: number,
  userId: string,
  over: Partial<{
    keyword: string;
    cls: string;
    big: string;
    mid: string;
    owner: string;
    splitTemplateJson: string;
  }> = {},
) => {
  await database
    .prepare(
      `INSERT INTO rules (id,user_id,keyword,cls,category_major,category_mid,owner,sort_order,split_template_json)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      userId,
      over.keyword ?? '架空ジム',
      over.cls ?? 'per',
      over.big ?? '健康',
      over.mid ?? null,
      over.owner ?? null,
      id,
      over.splitTemplateJson ?? null,
    )
    .run();
};

const resetWrites = async () => {
  await database.batch([
    database.prepare("DELETE FROM tx_history WHERE user_id='default'"),
    database.prepare("DELETE FROM tx_splits WHERE user_id='default'"),
    database.prepare("DELETE FROM tx_edits WHERE user_id='default'"),
    database.prepare("DELETE FROM rules WHERE user_id='default'"),
  ]);
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'rules-preview-apply',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  await database.batch([
    database.prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES
        ('default','gym-1','2026-08','2026-08-01','架空ジム 渋谷',-8000,'健康','ジム',1,0,1),
        ('default','gym-2','2026-08','2026-08-11','架空ジム 渋谷',-8000,'健康','ジム',1,0,1),
        ('default','gym-3','2026-08','2026-08-21','架空ジム 渋谷',-8000,'健康','ジム',1,0,1),
        ('default','other-shop','2026-08','2026-08-02','架空スーパー',-2400,'食費','食料品',1,0,1),
        ('other-user','gym-foreign','2026-08','2026-08-01','架空ジム 渋谷',-8000,'健康','ジム',1,0,1)`,
    ),
    // 他の利用者のルール。id を名指ししても届かないことを確かめる相手
    database.prepare(
      `INSERT INTO rules (id,user_id,keyword,cls,category_major,category_mid,owner,sort_order)
       VALUES (900,'other-user','架空ジム','per','健康',NULL,NULL,900)`,
    ),
  ]);
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('認証と変更系保護', () => {
  it('Cookie が無ければプレビューも適用も 401', async () => {
    expect((await post('/rules/preview', { rule: { keyword: '架空ジム' }, ...PERIOD }, {})).status).toBe(401);
    expect((await post('/rules/1/apply', { ...PERIOD, fingerprint: 'x' }, {})).status).toBe(401);
  });

  it('取込と重なると適用は 409。プレビューは読むだけなので通る', async () => {
    await resetWrites();
    await insertRule(1, 'default');
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    await database
      .prepare('INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at) VALUES (?,?,?,?)')
      .bind('default', 'import:other', Date.now(), Date.now() + 600_000)
      .run();
    try {
      // プレビューは canonical mutation ではない
      expect((await post('/rules/preview', { ruleId: 1, ...PERIOD })).status).toBe(200);
      const applied = await post('/rules/1/apply', { ...PERIOD, fingerprint: preview.fingerprint });
      expect(applied.status).toBe(409);
      expect(await applied.json()).toMatchObject({ error: { code: 'canonical_write_busy' } });
    } finally {
      await database.prepare("DELETE FROM import_writer_claims WHERE user_id='default'").run();
    }
    const wrote = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'")
      .first<{ n: number }>();
    expect(wrote?.n).toBe(0);
  });
});

describe('プレビューの入力 (7.10)', () => {
  it('下書きと既存ルールの両方、またはどちらも無しは 400', async () => {
    await resetWrites();
    await insertRule(1, 'default');
    expect((await post('/rules/preview', { rule: { keyword: 'a' }, ruleId: 1, ...PERIOD })).status).toBe(400);
    expect((await post('/rules/preview', { ...PERIOD })).status).toBe(400);
  });

  it('他の利用者のルールは、プレビューも適用も 404', async () => {
    expect((await post('/rules/preview', { ruleId: 900, ...PERIOD })).status).toBe(404);
    const applied = await post('/rules/900/apply', { ...PERIOD, fingerprint: 'x' });
    expect(applied.status).toBe(404);
  });

  it('期間が逆順なら 400', async () => {
    await resetWrites();
    await insertRule(1, 'default');
    const response = await post('/rules/preview', { ruleId: 1, from: '2026-09', to: '2026-08' });
    expect(response.status).toBe(400);
  });

  it('残額の行がちょうど 1 行でない分割の型は 400 (BR-10)', async () => {
    // 全行が固定額だと、端数が誰にも渡らない。合計が元の金額に一致しなくなる
    const allFixed = await post('/rules/preview', {
      rule: {
        keyword: '架空ジム',
        splitTemplate: {
          lines: [
            { kind: 'fixed', amount: 3000, cls: 'per' },
            { kind: 'fixed', amount: 5000, cls: 'biz' },
          ],
        },
      },
      ...PERIOD,
    });
    expect(allFixed.status).toBe(400);
    expect(await allFixed.json()).toMatchObject({ error: { code: 'invalid_body' } });

    // 残額が 2 行あると、どちらにいくら入るかが決まらない
    const twoRemainders = await post('/rules/preview', {
      rule: {
        keyword: '架空ジム',
        splitTemplate: {
          lines: [
            { kind: 'remainder', cls: 'per' },
            { kind: 'remainder', cls: 'biz' },
          ],
        },
      },
      ...PERIOD,
    });
    expect(twoRemainders.status).toBe(400);
    expect(await twoRemainders.json()).toMatchObject({ error: { code: 'invalid_body' } });
  });
});

describe('プレビューと適用の一致 (BR-11)', () => {
  it('プレビューの件数と適用した件数が一致し、対象も同じ', async () => {
    await resetWrites();
    await insertRule(1, 'default');
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(3);
    expect(preview.omitted).toBe(0);
    expect(preview.rows.map((r) => r.txId).sort()).toEqual(['gym-1', 'gym-2', 'gym-3']);
    // キーワードに当たらない明細は候補に入らない
    expect(preview.rows.some((r) => r.txId === 'other-shop')).toBe(false);

    const applied = (await (
      await post('/rules/1/apply', { ...PERIOD, fingerprint: preview.fingerprint })
    ).json()) as ApplyBody;
    expect(applied.applied).toBe(preview.count);
    expect(applied.txIds.sort()).toEqual(['gym-1', 'gym-2', 'gym-3']);
    expect(typeof applied.opId).toBe('string');

    // 他の利用者の同名の明細は動かない
    const foreign = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='other-user'")
      .first<{ n: number }>();
    expect(foreign?.n).toBe(0);

    // 履歴は 1 回の適用ぶんが同じ op_id・source='rule' で残る
    const history = await database
      .prepare("SELECT DISTINCT source, op_id FROM tx_history WHERE user_id='default'")
      .all<{ source: string; op_id: string }>();
    expect(history.results).toEqual([{ source: 'rule', op_id: applied.opId }]);
  });

  it('プレビュー以降に対象が変わったら、1 件も書かずに 409', async () => {
    await resetWrites();
    await insertRule(1, 'default');
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    // 対象を 1 件増やす。プレビューの時点では 3 件だった
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','gym-late','2026-08','2026-08-28','架空ジム 渋谷',-8000,'健康','ジム',1,0,1)`,
      )
      .run();
    try {
      const stale = await post('/rules/1/apply', { ...PERIOD, fingerprint: preview.fingerprint });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({ error: { code: 'preview_stale' } });
      const wrote = await database
        .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'")
        .first<{ n: number }>();
      expect(wrote?.n).toBe(0);

      // 取り直したプレビューなら通り、増えた 1 件も対象に入る
      const fresh = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
      expect(fresh.count).toBe(4);
      const applied = (await (
        await post('/rules/1/apply', { ...PERIOD, fingerprint: fresh.fingerprint })
      ).json()) as ApplyBody;
      expect(applied.applied).toBe(4);
    } finally {
      await database.prepare("DELETE FROM mf_transactions WHERE tx_id='gym-late'").run();
    }
  });

  it('対象が 0 件なら書かずに applied=0 を返す', async () => {
    await resetWrites();
    await insertRule(1, 'default', { keyword: 'どこにも無い店' });
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(0);
    const applied = (await (
      await post('/rules/1/apply', { ...PERIOD, fingerprint: preview.fingerprint })
    ).json()) as ApplyBody;
    expect(applied).toMatchObject({ applied: 0, txIds: [], opId: null });
  });

  it('既存ルールの複数chunkすべてがcanonical/history/pointer/集約を同居させる', async () => {
    await resetWrites();
    const template = {
      lines: [
        { kind: 'fixed', amount: 3000, cls: 'biz', big: '福利厚生費' },
        { kind: 'remainder', cls: 'per', big: '健康', mid: 'ジム' },
      ],
    };
    await insertRule(1, 'default', { splitTemplateJson: JSON.stringify(template) });
    const extras = Array.from({ length: 9 }, (_, index) =>
      database
        .prepare(
          `INSERT INTO mf_transactions
             (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
           VALUES (?,?,?,?,?,?,?,?,1,0,1)`,
        )
        .bind(
          'default',
          `gym-chunk-${index}`,
          '2026-08',
          `2026-08-${String(index + 12).padStart(2, '0')}`,
          '架空ジム 追加',
          -8000,
          '健康',
          'ジム',
        ),
    );
    await database.batch(extras);
    try {
      const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
      expect(preview.count).toBe(12);
      const observed = failAggregateBatch(false);
      const response = await app.request(
        '/api/rules/1/apply',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ ...PERIOD, fingerprint: preview.fingerprint }),
        },
        { ...auth, DB: observed.database },
      );
      expect(response.status, await response.clone().text()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ applied: 12 });

      const chunks = observed
        .batches()
        .filter((batch) => batch.some((sql) => /DELETE FROM "monthly_agg"/i.test(sql)));
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.some((sql) => /(?:DELETE FROM|INSERT INTO) "tx_splits"/i.test(sql))).toBe(true);
        expect(chunk.some((sql) => /(?:DELETE FROM|INSERT INTO) "tx_edits"/i.test(sql))).toBe(true);
        expect(chunk.some((sql) => /INSERT INTO "tx_history"/i.test(sql))).toBe(true);
        expect(chunk.some((sql) => /DELETE FROM "import_active_targets"/i.test(sql))).toBe(true);
      }
    } finally {
      await database.prepare("DELETE FROM mf_transactions WHERE tx_id LIKE 'gym-chunk-%'").run();
      await resetWrites();
    }
  });
});

describe('ルール作成と適用の一括command', () => {
  it('対象0件でもルールだけを保存する', async () => {
    await resetWrites();
    const rule = { keyword: 'どこにも無い店', cls: 'per', scope: 'unconfirmed' };
    const preview = (await (await post('/rules/preview', { rule, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(0);

    const applied = await post('/rules/apply', { rule, ...PERIOD, fingerprint: preview.fingerprint });
    expect(applied.status, await applied.clone().text()).toBe(201);
    await expect(applied.json()).resolves.toMatchObject({ applied: 0, txIds: [], opId: null });
    expect(
      await database
        .prepare("SELECT COUNT(*) AS n FROM rules WHERE user_id='default' AND keyword='どこにも無い店'")
        .first('n'),
    ).toBe(1);
    expect(
      await database.prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'").first('n'),
    ).toBe(0);
  });

  it('プレビュー後に対象が動いたらルールも履歴も書かない', async () => {
    await resetWrites();
    const rule = { keyword: '架空ジム', cls: 'per', big: '健康', scope: 'unconfirmed' };
    const preview = (await (await post('/rules/preview', { rule, ...PERIOD })).json()) as PreviewBody;
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','atomic-late','2026-08','2026-08-28','架空ジム 追加',-8000,'健康','ジム',1,0,1)`,
      )
      .run();
    try {
      const stale = await post('/rules/apply', { rule, ...PERIOD, fingerprint: preview.fingerprint });
      expect(stale.status).toBe(409);
      expect(
        await database.prepare("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'").first('n'),
      ).toBe(0);
      expect(
        await database.prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'").first('n'),
      ).toBe(0);
    } finally {
      await database.prepare("DELETE FROM mf_transactions WHERE tx_id='atomic-late'").run();
    }
  });

  it('ルール/履歴/pointer/集約の同一batch失敗で片側を残さない', async () => {
    await resetWrites();
    await database
      .prepare(
        `INSERT OR REPLACE INTO import_active_targets
           (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','json:global','before-rule-apply',999,'2026-08-01')`,
      )
      .run();
    const rule = { keyword: '架空ジム', cls: 'per' as const };
    const preview = (await (await post('/rules/preview', { rule, ...PERIOD })).json()) as PreviewBody;
    const beforeAgg = (
      await database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
    ).results;
    const observed = failAggregateBatch();
    const response = await app.request(
      '/api/rules/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ rule, ...PERIOD, fingerprint: preview.fingerprint }),
      },
      { ...auth, DB: observed.database },
    );
    expect(response.status).toBe(500);
    await expect(
      database.prepare("SELECT COUNT(*) AS n FROM rules WHERE user_id='default'").first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      database.prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'").first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
        .then((result) => result.results),
    ).resolves.toEqual(beforeAgg);
    await expect(
      database
        .prepare(
          "SELECT COUNT(*) AS n FROM import_active_targets WHERE user_id='default' AND target_key='json:global' AND content_hash='before-rule-apply'",
        )
        .first<number>('n'),
    ).resolves.toBe(1);
    const mutation = observed
      .batches()
      .find((batch) => batch.some((sql) => /DELETE FROM "monthly_agg"/i.test(sql)));
    expect(mutation?.some((sql) => /INSERT INTO "rules"/i.test(sql))).toBe(true);
    expect(mutation?.some((sql) => /INSERT INTO "tx_history"/i.test(sql))).toBe(true);
    expect(mutation?.some((sql) => /DELETE FROM "import_active_targets"/i.test(sql))).toBe(true);
  });
});

describe('分割の型を持つルール (BR-10)', () => {
  const template = {
    lines: [
      { kind: 'fixed', amount: 3000, cls: 'biz', big: '福利厚生費', memo: '事業分' },
      { kind: 'remainder', cls: 'per', big: '健康', mid: 'ジム' },
    ],
  };

  it('内訳の合計は元の取引金額に一致し、親は決着済みになる (AT-14・BR-10)', async () => {
    await resetWrites();
    await insertRule(1, 'default', { splitTemplateJson: JSON.stringify(template) });
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(3);
    for (const row of preview.rows) {
      // プレビューの時点で合計が一致している。画面はこの値をそのまま見せる
      expect(row.after.reduce((sum, a) => sum + a.amount, 0)).toBe(Math.abs(row.amount));
      expect(row.after.map((a) => a.amount)).toEqual([3000, 5000]);
    }

    const applied = (await (
      await post('/rules/1/apply', { ...PERIOD, fingerprint: preview.fingerprint })
    ).json()) as ApplyBody;
    expect(applied.applied).toBe(3);

    const splits = await database
      .prepare(
        "SELECT tx_id, seq, amount, cls, parent_amount FROM tx_splits WHERE user_id='default' ORDER BY tx_id, seq",
      )
      .all<{ tx_id: string; seq: number; amount: number; cls: string; parent_amount: number }>();
    expect(splits.results).toHaveLength(6);
    for (const txId of ['gym-1', 'gym-2', 'gym-3']) {
      const lines = splits.results.filter((r) => r.tx_id === txId);
      expect(lines.map((l) => l.amount)).toEqual([3000, 5000]);
      expect(lines.reduce((sum, l) => sum + l.amount, 0)).toBe(lines[0]?.parent_amount);
      expect(lines.map((l) => l.cls)).toEqual(['biz', 'per']);
    }

    // BR-01: 内訳を持った明細は一覧で決着済みとして出る。未整理に戻らない
    const listed = await app.request(
      '/api/transactions?from=2026-08&to=2026-08&status=unsorted,review,manual,done',
      { headers: { cookie } },
      env(),
    );
    const rows = (
      (await listed.json()) as {
        rows: {
          id: string;
          description: string;
          status: string;
          amount: number;
          splitLineCount: number | null;
        }[];
      }
    ).rows;
    // 一覧には親ではなく内訳行が出る。3 明細 × 2 行
    const gym = rows.filter((r) => r.description.includes('架空ジム'));
    expect(gym).toHaveLength(6);
    for (const line of gym) {
      // 分割は利用者の決定として扱う。未整理へは戻らない
      expect(line.status).toBe('manual');
      expect(line.splitLineCount).toBe(2);
    }
    // 一覧の金額の合計も元の 3 明細ぶんのまま。分割で総額が動かない
    expect(gym.reduce((sum, line) => sum + Math.abs(line.amount), 0)).toBe(8000 * 3);

    // 履歴には「何行に分割したか」が残る
    const history = await database
      .prepare("SELECT DISTINCT field, after_value FROM tx_history WHERE user_id='default'")
      .all<{ field: string; after_value: string }>();
    expect(history.results).toEqual([{ field: 'split', after_value: '2行に分割' }]);
  });

  it('固定額が元の金額を超える明細は対象から外れ、理由が残る', async () => {
    await resetWrites();
    await insertRule(1, 'default', {
      splitTemplateJson: JSON.stringify({
        lines: [
          { kind: 'fixed', amount: 99_000, cls: 'biz', big: '福利厚生費' },
          { kind: 'remainder', cls: 'per', big: '健康' },
        ],
      }),
    });
    const preview = (await (await post('/rules/preview', { ruleId: 1, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(0);
    expect(preview.skipped.map((s) => s.txId).sort()).toEqual(['gym-1', 'gym-2', 'gym-3']);
    expect(preview.skipped[0]?.reason).toBeTruthy();
  });
});

describe('migration 0046 が既存行を書き換えないこと (AT-20)', () => {
  it('新しい列を知らないルールは scope=all・payee/split_template_json が NULL のまま読める', async () => {
    await resetWrites();
    // 0046 より前の書き方。新しい列を一切指定しない
    await database
      .prepare(
        `INSERT INTO rules (id,user_id,keyword,cls,category_major,category_mid,owner,sort_order)
         VALUES (42,'default','架空ジム','per','健康',NULL,NULL,42)`,
      )
      .run();
    const row = await database
      .prepare("SELECT scope, payee, split_template_json FROM rules WHERE user_id='default' AND id=42")
      .first<{ scope: string; payee: string | null; split_template_json: string | null }>();
    // 既定の 'all' は、この列を持たなかった頃の挙動と同じ
    expect(row).toEqual({ scope: 'all', payee: null, split_template_json: null });

    // 既定のまま全件に当たる。列が増えても対象が変わらない
    const preview = (await (await post('/rules/preview', { ruleId: 42, ...PERIOD })).json()) as PreviewBody;
    expect(preview.count).toBe(3);
  });

  it('matched_proposal を持たない手当ては手動変更として扱う (BR-01)', async () => {
    await resetWrites();
    await database
      .prepare(
        `INSERT INTO tx_edits (user_id,tx_id,cls,base_known,origin) VALUES ('default','gym-1','per',1,'manual')`,
      )
      .run();
    const row = await database
      .prepare(
        "SELECT matched_proposal, payment_method FROM tx_edits WHERE user_id='default' AND tx_id='gym-1'",
      )
      .first<{ matched_proposal: number | null; payment_method: string | null }>();
    expect(row).toEqual({ matched_proposal: null, payment_method: null });
  });
});
