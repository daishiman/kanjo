/**
 * 一括保存 (POST /api/transactions/bulk) の API/D1 回帰 (spec-classify-screen 7.8・BR-09・BR-14・BR-15)。
 *
 * ここで押さえるのは「1 件の失敗が他の明細を巻き込まない」ことと、
 * 「提案と一致したかをサーバが判定する」ことの 2 つである。
 * 画面から送られた status を信じると、一致の定義が画面ごとに増える。
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
const get = (path: string) => app.request(`/api${path}`, { headers: { cookie } }, env());
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

const put = (path: string, body: unknown) =>
  app.request(
    `/api${path}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    },
    env(),
  );

/**
 * monthly_aggを含むbatchの末尾に制約違反を追加する。
 * edit/history/pointer/aggregateが同じbatchなら全て戻るが、後段recomputeならeditだけ残る。
 */
const failAggregateBatch = (): { database: D1Database; batches: () => string[][] } => {
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
          if (sql.some((text) => /DELETE FROM "monthly_agg"/i.test(text))) {
            raw.push(target.prepare("INSERT INTO tx_history (id) VALUES ('forced-aggregate-failure')"));
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

interface BulkBody {
  results: { txId: string; ok: boolean; status?: string; error?: { code: string; message: string } }[];
  opId: string;
  saved: number;
  failed: number;
}

interface ListRow {
  id: string;
  status: string;
  /** 提案が無い明細では null (BR-04) */
  suggestion: { cls: string | null; big: string; mid: string; owner: string | null } | null;
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-bulk',
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
        ('default','tx-cloud','2026-08','2026-08-05','架空クラウド',-3300,'事業経費','通信費',1,0,1),
        ('default','tx-cafe','2026-08','2026-08-06','架空カフェ',-560,'食費','カフェ',1,0,1),
        ('default','tx-book','2026-08','2026-08-07','架空書店',-1800,'教養・教育','書籍',1,0,1),
        ('default','tx-gym','2026-08','2026-08-09','架空ジム渋谷',-8000,'健康','ジム',1,0,1),
        ('default','tx-salon','2026-08','2026-08-10','架空サロン渋谷',-4400,'美容','美容院',1,0,1),
        ('default','tx-pen','2026-08','2026-08-11','架空文具店',-1200,'日用品','文具',1,0,1),
        ('other-user','tx-foreign','2026-08','2026-08-08','別利用者',-9999,'事業経費','通信費',1,0,1)`,
    ),
    // tx-gym の提案の出どころ。9/10 の実績なので信頼度 90 で「家計 / 健康 / ジム」を提案する
    database.prepare(
      `INSERT INTO vendor_memory (user_id,vendor_key,vendor_label,cls,category_major,category_mid,hit_count,disagree_count)
       VALUES ('default','架空ジム渋谷','架空ジム渋谷','per','健康','ジム',9,1)`,
    ),
    // 事業の科目候補を freee の勘定科目から作る。候補に無い科目は保存を弾かれる
    database.prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300)`,
    ),
    database.prepare(
      `INSERT INTO rules (user_id,keyword,cls,category_major,category_mid,owner,sort_order)
       VALUES ('default','架空クラウド','biz','通信費',NULL,'business',100)`,
    ),
  ]);
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

const rowsOf = async (): Promise<ListRow[]> => {
  const response = await get('/transactions?from=2026-08&to=2026-08&status=unsorted,review,manual,done');
  expect(response.status).toBe(200);
  return ((await response.json()) as { rows: ListRow[] }).rows;
};

describe('認証と変更系保護', () => {
  it('Cookie が無ければ 401 で、明細は 1 件も書き換わらない', async () => {
    const response = await post('/transactions/bulk', { items: [{ txId: 'tx-cafe', cls: 'per' }] }, {});
    expect(response.status).toBe(401);
    const after = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'")
      .first<{ n: number }>();
    expect(after?.n).toBe(0);
  });

  it('取込や他の更新が進行中なら 409 で、何も書かずに返す', async () => {
    // canonicalMutationFence が見る lease をテストから直接握り、取込と重なった状態を作る
    await database
      .prepare('INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at) VALUES (?,?,?,?)')
      .bind('default', 'import:other', Date.now(), Date.now() + 600_000)
      .run();
    try {
      const response = await post('/transactions/bulk', { items: [{ txId: 'tx-cafe', cls: 'per' }] });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: 'canonical_write_busy' } });
    } finally {
      await database.prepare("DELETE FROM import_writer_claims WHERE user_id='default'").run();
    }
    const after = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default'")
      .first<{ n: number }>();
    expect(after?.n).toBe(0);
  });
});

describe('要求そのものが成り立たない場合 (BR-14)', () => {
  it('101 件は 400。上限は 100 件', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ txId: `tx-${i}`, cls: 'per' }));
    const response = await post('/transactions/bulk', { items });
    expect(response.status).toBe(400);
  });

  it('同じ明細を 2 回含めると 400。どちらの指定が勝ったか読めなくなるため', async () => {
    const response = await post('/transactions/bulk', {
      items: [
        { txId: 'tx-cafe', cls: 'per' },
        { txId: 'tx-cafe', cls: 'biz' },
      ],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_body' } });
  });

  it('空の items は 400', async () => {
    expect((await post('/transactions/bulk', { items: [] })).status).toBe(400);
  });

  // 画面の textarea は maxLength=200 で止めるが、止まるのは画面だけである。
  // 直接叩かれた 201 字をサーバが受けると、画面が編集できない長さのメモが表に残る
  it('メモ 201 字は 400。上限は 200 字', async () => {
    expect((await put('/transactions/tx-cafe/edit', { note: 'あ'.repeat(201) })).status).toBe(400);
    expect((await put('/transactions/tx-cafe/edit', { note: 'あ'.repeat(200) })).status).toBe(200);
  });
});

describe('明細ごとの成否 (7.8・BR-09・BR-15)', () => {
  it('他の利用者の明細と未知の明細は not_found、他の明細は保存される', async () => {
    const before = await rowsOf();
    const cloud = before.find((r) => r.id === 'tx-cloud');
    expect(cloud).toBeTruthy();
    // 画面が見せたのと同じ提案をそのまま送る。一致の判定はサーバが持つ (BR-09)
    const suggestion = cloud?.suggestion;
    expect(suggestion?.cls).toBe('biz');

    const response = await post('/transactions/bulk', {
      items: [
        {
          txId: 'tx-cloud',
          cls: suggestion?.cls,
          big: suggestion?.big,
          mid: suggestion?.mid,
          owner: suggestion?.owner,
        },
        { txId: 'tx-foreign', cls: 'biz' },
        { txId: 'tx-nowhere', cls: 'per' },
      ],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as BulkBody;

    // 応答の形。results は要求と同じ並びで、saved+failed が件数に一致する
    expect(body.results).toHaveLength(3);
    expect(body.saved).toBe(1);
    expect(body.failed).toBe(2);
    expect(body.saved + body.failed).toBe(body.results.length);
    expect(typeof body.opId).toBe('string');
    expect(body.results[0]).toEqual({ txId: 'tx-cloud', ok: true, status: 'done' });
    expect(body.results[1]).toMatchObject({ txId: 'tx-foreign', ok: false, error: { code: 'not_found' } });
    expect(body.results[2]).toMatchObject({ txId: 'tx-nowhere', ok: false, error: { code: 'not_found' } });

    // 他の利用者の明細は 1 文字も動かない
    const foreign = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE user_id='other-user'")
      .first<{ n: number }>();
    expect(foreign?.n).toBe(0);

    // BR-15: 一括で保存したことが履歴から分かる
    const history = await database
      .prepare("SELECT field, source, op_id FROM tx_history WHERE user_id='default' AND tx_id='tx-cloud'")
      .all<{ field: string; source: string; op_id: string }>();
    expect(history.results.length).toBeGreaterThan(0);
    for (const row of history.results) {
      expect(row.source).toBe('bulk');
      expect(row.op_id).toBe(body.opId);
    }
  });

  it('提案と 1 つでも違えば manual として保存される (BR-09)', async () => {
    const response = await post('/transactions/bulk', {
      items: [{ txId: 'tx-cafe', cls: 'per', note: '打合せ' }],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as BulkBody;
    expect(body.results[0]).toEqual({ txId: 'tx-cafe', ok: true, status: 'manual' });
    const saved = await database
      .prepare("SELECT matched_proposal FROM tx_edits WHERE user_id='default' AND tx_id='tx-cafe'")
      .first<{ matched_proposal: number | null }>();
    expect(saved?.matched_proposal).toBe(0);
  });

  it('候補に無い科目は明細単位で弾かれ、同じ要求の他の明細は保存される', async () => {
    const response = await post('/transactions/bulk', {
      items: [
        { txId: 'tx-book', cls: 'biz', big: '存在しない科目' },
        { txId: 'tx-cafe', cls: 'per', note: '再保存' },
      ],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as BulkBody;
    expect(body.results[0]).toMatchObject({ txId: 'tx-book', ok: false, error: { code: 'invalid_item' } });
    expect(body.results[1]).toMatchObject({ txId: 'tx-cafe', ok: true });
    expect(body.saved).toBe(1);
    expect(body.failed).toBe(1);
    // 弾かれた明細には手当ても履歴も残らない
    const book = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default' AND tx_id='tx-book'")
      .first<{ n: number }>();
    expect(book?.n).toBe(0);
  });

  it('集約確定に失敗したらedit/history/pointer/monthly_aggをまとめて戻す', async () => {
    await database
      .prepare(
        `INSERT OR REPLACE INTO import_active_targets
           (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','json:global','before-classify',999,'2026-08-01')`,
      )
      .run();
    const beforeEdit = await database
      .prepare("SELECT * FROM tx_edits WHERE user_id='default' AND tx_id='tx-cafe'")
      .first<Record<string, unknown>>();
    const beforeHistory = await database
      .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default' AND tx_id='tx-cafe'")
      .first<number>('n');
    const beforeAgg = (
      await database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
    ).results;
    const observed = failAggregateBatch();
    const response = await app.request(
      '/api/transactions/tx-cafe/edit',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ note: '原子性失敗注入' }),
      },
      { ...auth, DB: observed.database },
    );
    expect(response.status).toBe(500);

    await expect(
      database
        .prepare("SELECT * FROM tx_edits WHERE user_id='default' AND tx_id='tx-cafe'")
        .first<Record<string, unknown>>(),
    ).resolves.toEqual(beforeEdit);
    await expect(
      database
        .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default' AND tx_id='tx-cafe'")
        .first<number>('n'),
    ).resolves.toBe(beforeHistory);
    await expect(
      database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
        .then((result) => result.results),
    ).resolves.toEqual(beforeAgg);
    await expect(
      database
        .prepare(
          "SELECT COUNT(*) AS n FROM import_active_targets WHERE user_id='default' AND target_key='json:global' AND content_hash='before-classify'",
        )
        .first<number>('n'),
    ).resolves.toBe(1);

    const mutationBatches = observed
      .batches()
      .filter((batch) => batch.some((sql) => /(?:DELETE FROM|INSERT INTO) "tx_edits"/i.test(sql)));
    expect(mutationBatches).toHaveLength(1);
    expect(mutationBatches[0]?.some((sql) => /DELETE FROM "monthly_agg"/i.test(sql))).toBe(true);
    expect(mutationBatches[0]?.some((sql) => /(?:DELETE FROM|INSERT INTO) "tx_history"/i.test(sql))).toBe(
      true,
    );
    expect(mutationBatches[0]?.some((sql) => /DELETE FROM "import_active_targets"/i.test(sql))).toBe(true);
  });

  it('一括保存の集約確定失敗は明細をwrite_failedとし、正本も履歴も残さない', async () => {
    const beforeAgg = (
      await database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
    ).results;
    const observed = failAggregateBatch();
    const response = await app.request(
      '/api/transactions/bulk',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ items: [{ txId: 'tx-book', cls: 'per' }] }),
      },
      { ...auth, DB: observed.database },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      saved: 0,
      failed: 1,
      results: [{ txId: 'tx-book', ok: false, error: { code: 'write_failed' } }],
    });
    await expect(
      database
        .prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE user_id='default' AND tx_id='tx-book'")
        .first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      database
        .prepare("SELECT COUNT(*) AS n FROM tx_history WHERE user_id='default' AND tx_id='tx-book'")
        .first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      database
        .prepare("SELECT month,scope,amount FROM monthly_agg WHERE user_id='default' ORDER BY month,scope")
        .all()
        .then((result) => result.results),
    ).resolves.toEqual(beforeAgg);
    expect(
      observed.batches().filter((batch) => batch.some((sql) => /DELETE FROM "monthly_agg"/i.test(sql))),
    ).toHaveLength(1);
  });
});

describe('変更履歴 (GET /api/transactions/:txId/history)', () => {
  it('他の利用者の明細は 404 で、履歴の存在も漏らさない', async () => {
    const response = await get('/transactions/tx-foreign/history');
    expect(response.status).toBe(404);
  });

  it('自分の明細は新しい順に読める', async () => {
    const response = await get('/transactions/tx-cafe/history');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { field: string; source: string; changedAt: string }[] };
    expect(body.items.length).toBeGreaterThan(0);
    const changedAt = body.items.map((i) => i.changedAt);
    expect(changedAt).toEqual([...changedAt].sort().reverse());
  });

  it('件数の指定が範囲外なら 400', async () => {
    expect((await get('/transactions/tx-cafe/history?limit=0')).status).toBe(400);
    expect((await get('/transactions/tx-cafe/history?limit=999')).status).toBe(400);
  });
});

/** 1 明細ぶんの履歴の指紋。項目・由来・操作 id の三点が揃って初めて 1 つの変更として読める */
const historyOf = (txId: string) =>
  database
    .prepare(
      'SELECT field, source, op_id FROM tx_history WHERE user_id=? AND tx_id=? ORDER BY changed_at, id',
    )
    .bind('default', txId)
    .all<{ field: string; source: string; op_id: string }>()
    .then((r) => r.results);

describe('手動の変更履歴 (AT-15・BR-15)', () => {
  it('手で 1 項目だけ変えると manual の履歴が 1 件だけ残り、同じ値の保存では増えない', async () => {
    expect(await historyOf('tx-pen')).toHaveLength(0);

    const first = await put('/transactions/tx-pen/edit', { cls: 'per' });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { historyOpId: string | null; status: string };
    expect(firstBody.historyOpId).toBeTruthy();

    const afterFirst = await historyOf('tx-pen');
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]).toEqual({ field: 'cls', source: 'manual', op_id: firstBody.historyOpId });

    // 値が変わらない保存では 1 行も書かない。押し直すたびに履歴が伸びると監査に使えない
    const again = await put('/transactions/tx-pen/edit', { cls: 'per' });
    expect(again.status).toBe(200);
    expect((await again.json()) as { historyOpId: string | null }).toMatchObject({ historyOpId: null });
    expect(await historyOf('tx-pen')).toHaveLength(1);

    // 別の項目を変えれば、その 1 項目ぶんだけが別の操作として増える
    const second = await put('/transactions/tx-pen/edit', { owner: 'family' });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { historyOpId: string | null };
    const afterSecond = await historyOf('tx-pen');
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond[1]).toEqual({ field: 'owner', source: 'manual', op_id: secondBody.historyOpId });
    expect(secondBody.historyOpId).not.toBe(firstBody.historyOpId);
  });
});

describe('分割の変更履歴 (AT-15・BR-15)', () => {
  // tx-book は -1800。内訳の合計は必ず 1800 にする
  const twoLines = [
    { cls: 'per', big: '教養・教育', mid: '書籍', amount: 1000 },
    { cls: 'per', big: '食費', mid: 'カフェ', amount: 800 },
  ];

  it('分割は split の履歴を 1 件だけ残し、同じ内訳の保存では増えない', async () => {
    expect(await historyOf('tx-book')).toHaveLength(0);

    expect((await put('/transactions/tx-book/splits', { lines: twoLines })).status).toBe(200);
    const afterSplit = await historyOf('tx-book');
    expect(afterSplit).toHaveLength(1);
    expect(afterSplit[0]).toMatchObject({ field: 'split', source: 'split' });
    expect(afterSplit[0]?.op_id).toBeTruthy();

    // 同じ内訳をもう一度保存しても増えない。lineId は毎回作り直されるので、
    // 同一性を lineId で見ていたらここで必ず 2 件になる
    expect((await put('/transactions/tx-book/splits', { lines: twoLines })).status).toBe(200);
    expect(await historyOf('tx-book')).toHaveLength(1);
  });

  it('件数が同じでも金額を付け替えれば残り、解除も 1 件として残る', async () => {
    const before = await historyOf('tx-book');

    // 2 行のままだが内訳が動く。件数だけを見ていたらこの変更は消える
    const moved = [
      { cls: 'per', big: '教養・教育', mid: '書籍', amount: 1500 },
      { cls: 'per', big: '食費', mid: 'カフェ', amount: 300 },
    ];
    expect((await put('/transactions/tx-book/splits', { lines: moved })).status).toBe(200);
    const afterMove = await historyOf('tx-book');
    expect(afterMove).toHaveLength(before.length + 1);
    expect(afterMove.at(-1)).toMatchObject({ field: 'split', source: 'split' });

    // 分割の解除。after は「0 行に分割」ではなく null で残す
    expect((await put('/transactions/tx-book/splits', { lines: [] })).status).toBe(200);
    const afterClear = await historyOf('tx-book');
    expect(afterClear).toHaveLength(before.length + 2);

    const last = await database
      .prepare('SELECT before_value, after_value FROM tx_history WHERE op_id=?')
      .bind(afterClear.at(-1)?.op_id)
      .first<{ before_value: string | null; after_value: string | null }>();
    expect(last?.before_value).toContain('2行に分割');
    expect(last?.after_value).toBeNull();

    // 解除済みの状態でもう一度解除しても増えない
    expect((await put('/transactions/tx-book/splits', { lines: [] })).status).toBe(200);
    expect(await historyOf('tx-book')).toHaveLength(before.length + 2);
  });
});

describe('後から提案が変わっても区分は変わらない (AT-13)', () => {
  const suggestionOf = async (txId: string) => {
    const row = (await rowsOf()).find((r) => r.id === txId);
    expect(row).toBeTruthy();
    return row as ListRow;
  };

  it('提案どおりに確定した明細は、提案が別のカテゴリへ変わっても完了のまま', async () => {
    const before = await suggestionOf('tx-gym');
    // 取引先の決め事だけが提案を出している。まだ手当てしていないので未整理
    expect(before.status).toBe('unsorted');
    expect(before.suggestion).toMatchObject({ cls: 'per', big: '健康', mid: 'ジム' });

    const saved = await put('/transactions/tx-gym/edit', { cls: 'per', big: '健康', mid: 'ジム' });
    expect(saved.status).toBe(200);
    expect((await saved.json()) as { status: string }).toMatchObject({ status: 'done' });

    // 提案そのものを別のカテゴリへ動かす。画面の提案列は確かに変わる
    await database
      .prepare(
        "UPDATE vendor_memory SET category_major='美容', category_mid='美容院' WHERE user_id='default' AND vendor_key='架空ジム渋谷'",
      )
      .run();
    const after = await suggestionOf('tx-gym');
    expect(after.suggestion).toMatchObject({ big: '美容', mid: '美容院' });
    // それでも区分は保存した時点の判定のまま。提案を読み直して区分を決めると、
    // 利用者が何もしていないのに完了が手動変更へ落ちる
    expect(after.status).toBe('done');
    const edit = await database
      .prepare("SELECT matched_proposal FROM tx_edits WHERE user_id='default' AND tx_id='tx-gym'")
      .first<{ matched_proposal: number | null }>();
    expect(edit?.matched_proposal).toBe(1);
  });

  it('提案と違えて確定した明細は、あとから提案が同じ値になっても手動変更のまま', async () => {
    const before = await suggestionOf('tx-salon');
    // 提案の出どころが無い状態で確定する。どの提案とも一致しないので手動変更になる
    expect(before.suggestion).toBe(null);

    const saved = await put('/transactions/tx-salon/edit', { cls: 'per', big: '美容', mid: '美容院' });
    expect(saved.status).toBe(200);
    expect((await saved.json()) as { status: string }).toMatchObject({ status: 'manual' });

    // あとから、保存した値とそっくりの決め事ができる
    await database
      .prepare(
        `INSERT INTO vendor_memory (user_id,vendor_key,vendor_label,cls,category_major,category_mid,hit_count,disagree_count)
         VALUES ('default','架空サロン渋谷','架空サロン渋谷','per','美容','美容院',9,1)`,
      )
      .run();
    const after = await suggestionOf('tx-salon');
    expect(after.suggestion).toMatchObject({ cls: 'per', big: '美容', mid: '美容院' });
    // 利用者が自分で決めたことは消えない。手動変更のままにする
    expect(after.status).toBe('manual');
    const edit = await database
      .prepare("SELECT matched_proposal FROM tx_edits WHERE user_id='default' AND tx_id='tx-salon'")
      .first<{ matched_proposal: number | null }>();
    expect(edit?.matched_proposal).toBe(0);
  });
});
