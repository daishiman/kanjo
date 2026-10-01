/**
 * サブスク登録の「対象勘定科目しぼり」と、候補一覧の「サブスクではない」記録の API/D1 回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空仕訳だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
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

let mf: Miniflare;
let d1: D1Database;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  // 実行時スキーマガードは d1_migrations の先頭名で判定するため、テストD1にも台帳を記録する。
  await recordTestMigrationHead(database, filenames);
}

async function request(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...auth, DB: d1 },
  );
}

/** 架空の freee 経費仕訳を原本テーブルへ直接入れる(取込経路はここでの検証対象ではない) */
const insertDeal = (month: string, partner: string, account: string, amount: number) =>
  d1
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount)
       VALUES ('default',?,?,'expense',?,?,?,?)`,
    )
    .bind(month, `${month}-05`, partner, account, account, amount);

/**
 * 仕訳を入れたあと、取込と同じく集計全体を作り直す。
 * サブスクの書込みは subs の範囲 (subs:<名前> と subs_other) しか書き換えないので、
 * 事業経費 (biz_exp:*) の行は取込の時点で出来ている、という本番の前提をテストでも揃える。
 */
const importDeals = async (deals: D1PreparedStatement[]): Promise<void> => {
  await d1.batch(deals);
  await recomputeFromDeals(getDb(d1), 'default');
};

const aggregate = async (month: string, scope: string): Promise<number | null> => {
  const row = await d1
    .prepare('SELECT amount FROM monthly_agg WHERE user_id = ? AND month = ? AND scope = ?')
    .bind('default', month, scope)
    .first<{ amount: number }>();
  return row?.amount ?? null;
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'subs-vendor-scope',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');

  await importDeals([
    d1.prepare(
      "INSERT INTO account_norm_map (user_id,raw,norm) VALUES ('default','架空通信原','サブスク・通信')",
    ),
    // 対象科目しぼりの検証用: 同じ支払先がサブスクと物販に跨る
    insertDeal('2026-01', '架空モール', '架空通信原', 980),
    insertDeal('2026-01', '架空モール', '消耗品費', 12000),
    // 候補の検証用: 未登録で2ヶ月以上続く支払先
    insertDeal('2026-01', '架空家賃', '地代家賃', 80000),
    insertDeal('2026-02', '架空家賃', '地代家賃', 80000),
  ]);
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
});

describe('登録した支払先の対象勘定科目', () => {
  it('対象科目を指定すると、その科目の支払だけをサブスクに数える', async () => {
    const created = await request('/sub-vendors', 'POST', {
      name: '架空モール',
      aliases: [],
      accounts: ['架空通信原'],
    });
    expect(created.status).toBe(200);

    // 科目外の 12,000 円は合算されない
    expect(await aggregate('2026-01', 'subs:架空モール')).toBe(980);
    expect(await aggregate('2026-01', 'biz_exp:消耗品費')).toBe(12000);
  });

  it('一覧は対象科目を返し、選択肢には原本に出てくる科目が並ぶ', async () => {
    const res = await request('/sub-vendors');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      vendors: Array<{ name: string; accounts?: string[] }>;
      accountOptions: string[];
    };
    expect(body.vendors.find((v) => v.name === '架空モール')?.accounts).toEqual(['架空通信原']);
    expect(body.accountOptions).toContain('消耗品費');
    expect(body.accountOptions).toContain('架空通信原');
  });

  it('正規化ラベルを変えてもraw参照は外れず、旧normalized参照もrawへ移行する', async () => {
    const res = await request('/settings', 'PUT', { normMap: { 架空通信原: '架空新通信区分' } });
    expect(res.status).toBe(200);
    expect(await aggregate('2026-01', 'subs:架空モール')).toBe(980);
    const list = (await (await request('/sub-vendors')).json()) as {
      vendors: Array<{ name: string; accounts: string[] }>;
    };
    expect(list.vendors.find((v) => v.name === '架空モール')?.accounts).toEqual(['架空通信原']);
  });

  it('旧normalized labelと同名rawが衝突しても、raw解釈を保ちつつ属する全rawへ展開する', async () => {
    await d1.batch([
      d1.prepare(
        `INSERT INTO account_norm_map (user_id,raw,norm) VALUES
             ('default','架空共通原','架空旧共通区分'),
             ('default','架空旧共通区分','架空別区分')`,
      ),
      d1.prepare(
        `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order)
           VALUES ('default','架空衝突モール','[]','["架空旧共通区分"]',99)`,
      ),
    ]);

    const res = await request('/settings', 'PUT', {
      normMap: {
        架空共通原: '架空新共通区分',
        架空旧共通区分: '架空別区分',
      },
    });
    expect(res.status).toBe(200);
    const row = await d1
      .prepare("SELECT accounts FROM sub_vendors WHERE user_id='default' AND name='架空衝突モール'")
      .first<{ accounts: string }>();
    expect(new Set(JSON.parse(row?.accounts ?? '[]'))).toEqual(new Set(['架空旧共通区分', '架空共通原']));
  });

  it('対象科目を空に戻すと全科目を数える(従来の挙動)', async () => {
    const list = await request('/sub-vendors');
    const { vendors } = (await list.json()) as { vendors: Array<{ id: number; name: string }> };
    const id = vendors.find((v) => v.name === '架空モール')?.id;
    expect(id).toBeDefined();

    const updated = await request(`/sub-vendors/${id}`, 'PUT', {
      name: '架空モール',
      aliases: [],
      accounts: [],
    });
    expect(updated.status).toBe(200);
    expect(await aggregate('2026-01', 'subs:架空モール')).toBe(12980);
  });
});

describe('候補一覧の「サブスクではない」', () => {
  const candidatePartners = async (): Promise<{ partners: string[]; excluded: string[] }> => {
    const res = await request('/sub-vendors/candidates');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      candidates: Array<{ partner: string }>;
      excluded: Array<{ id: number; partner: string }>;
    };
    return {
      partners: body.candidates.map((c) => c.partner),
      excluded: body.excluded.map((e) => e.partner),
    };
  };

  it('記録した支払先は候補から消え、取り消すと戻る', async () => {
    expect((await candidatePartners()).partners).toContain('架空家賃');

    const excluded = await request('/sub-vendors/exclusions', 'POST', { partner: '架空家賃' });
    expect(excluded.status).toBe(200);
    const after = await candidatePartners();
    expect(after.partners).not.toContain('架空家賃');
    expect(after.excluded).toEqual(['架空家賃']);

    const id = await d1
      .prepare('SELECT id FROM sub_vendor_exclusions WHERE user_id = ? AND partner = ?')
      .bind('default', '架空家賃')
      .first<{ id: number }>();
    const undone = await request(`/sub-vendors/exclusions/${id?.id}`, 'DELETE');
    expect(undone.status).toBe(200);
    const restored = await candidatePartners();
    expect(restored.partners).toContain('架空家賃');
    expect(restored.excluded).toEqual([]);
  });

  it('同じ支払先を二度記録しても増やさず、存在しない取り消しは404', async () => {
    expect((await request('/sub-vendors/exclusions', 'POST', { partner: '架空家賃' })).status).toBe(200);
    expect((await request('/sub-vendors/exclusions', 'POST', { partner: '架空 家賃' })).status).toBe(200);
    const rows = await d1
      .prepare('SELECT COUNT(*) AS n FROM sub_vendor_exclusions WHERE user_id = ?')
      .bind('default')
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);

    expect((await request('/sub-vendors/exclusions/999999', 'DELETE')).status).toBe(404);
  });
});

let mergeSeq = 0;
/** 名前で指定して統合する。冪等キーは呼ぶたびに変える (同じキーは前の応答の再送になる) */
const merge = async (targetName: string, sourceName: string): Promise<Response> => {
  const listed = (await (await request('/sub-vendors')).json()) as {
    vendors: Array<{ id: number; name: string }>;
    revision: number;
  };
  const idOf = (name: string) => listed.vendors.find((v) => v.name === name)?.id;
  return app.request(
    '/api/sub-vendors/merge',
    {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        'idempotency-key': `scope-merge-${String(++mergeSeq).padStart(4, '0')}`,
      },
      body: JSON.stringify({
        targetId: idOf(targetName),
        sourceVendorIds: [idOf(sourceName)],
        rawNames: [],
        baseRevision: listed.revision,
      }),
    },
    { ...auth, DB: d1 },
  );
};

describe('統合したときの対象勘定科目 (FR-007)', () => {
  const accountsOf = async (name: string): Promise<string[]> => {
    const row = await d1
      .prepare("SELECT accounts FROM sub_vendors WHERE user_id = 'default' AND name = ?")
      .bind(name)
      .first<{ accounts: string }>();
    return JSON.parse(row?.accounts ?? 'null') as string[];
  };

  it('両方に対象科目があれば和集合になり、科目外の支払は統合後も数えない', async () => {
    await importDeals([
      insertDeal('2026-05', '架空音声A', '架空通信原', 700),
      insertDeal('2026-05', '架空音声A', '消耗品費', 300),
      insertDeal('2026-05', '架空音声B', '架空回線原', 400),
    ]);
    for (const [name, accounts] of [
      ['架空音声A', ['架空通信原']],
      ['架空音声B', ['架空回線原']],
    ] as const) {
      expect((await request('/sub-vendors', 'POST', { name, aliases: [], accounts })).status).toBe(200);
    }
    expect(await aggregate('2026-05', 'subs:架空音声A')).toBe(700);
    expect(await aggregate('2026-05', 'subs:架空音声B')).toBe(400);

    const merged = await merge('架空音声B', '架空音声A');
    expect(merged.status, await merged.text()).toBe(200);
    expect(new Set(await accountsOf('架空音声B'))).toEqual(new Set(['架空回線原', '架空通信原']));
    expect(await aggregate('2026-05', 'subs:架空音声B')).toBe(1100);
    expect(await aggregate('2026-05', 'subs:架空音声A')).toBeNull();
    expect(await aggregate('2026-05', 'biz_exp:消耗品費')).toBe(300);
  });

  it('どちらかの対象科目が空 (全科目) なら、統合後も空のまま全科目を数える', async () => {
    await importDeals([
      insertDeal('2026-06', '架空音声C', '架空回線原', 250),
      insertDeal('2026-06', '架空音声C', '消耗品費', 50),
      insertDeal('2026-06', '架空音声D', '架空通信原', 600),
      insertDeal('2026-06', '架空音声D', '消耗品費', 70),
    ]);
    for (const [name, accounts] of [
      ['架空音声C', []],
      ['架空音声D', ['架空通信原']],
    ] as const) {
      expect((await request('/sub-vendors', 'POST', { name, aliases: [], accounts })).status).toBe(200);
    }
    expect(await aggregate('2026-06', 'subs:架空音声C')).toBe(300);
    expect(await aggregate('2026-06', 'subs:架空音声D')).toBe(600);

    const merged = await merge('架空音声D', '架空音声C');
    expect(merged.status, await merged.text()).toBe(200);
    expect(await accountsOf('架空音声D')).toEqual([]);
    expect(await aggregate('2026-06', 'subs:架空音声D')).toBe(970);
    expect(await aggregate('2026-06', 'subs:架空音声C')).toBeNull();
  });
});

describe('統合後の候補一覧 (AC-002)', () => {
  it('統合元の名前を含む支払先は、統合後に根へ数えられ、候補からも消える', async () => {
    await importDeals([
      insertDeal('2026-07', '架空録音X', '架空通信原', 500),
      insertDeal('2026-08', '架空録音X', '架空通信原', 500),
      // 統合元の名前を含むが名前そのものではない。統合前は未登録 (名前は完全一致でしか照合しない)
      insertDeal('2026-07', '架空録音X Pro', '架空通信原', 300),
      insertDeal('2026-08', '架空録音X Pro', '架空通信原', 300),
      insertDeal('2026-07', '架空録音Y', '架空通信原', 400),
    ]);
    for (const name of ['架空録音X', '架空録音Y']) {
      expect((await request('/sub-vendors', 'POST', { name, aliases: [], accounts: [] })).status).toBe(200);
    }
    const candidates = async (): Promise<string[]> => {
      const res = await request('/sub-vendors/candidates');
      expect(res.status).toBe(200);
      return ((await res.json()) as { candidates: Array<{ partner: string }> }).candidates.map(
        (c) => c.partner,
      );
    };
    expect(await candidates()).toContain('架空録音X Pro');

    const merged = await merge('架空録音Y', '架空録音X');
    expect(merged.status, await merged.text()).toBe(200);
    // 根では統合元の名前が別名 (部分一致) になるので、Pro も根に数える
    expect(await aggregate('2026-07', 'subs:架空録音Y')).toBe(1200);
    // 候補 API は統合元を別の行に残した保存行を読む。集計と同じく根へ畳んでから判定する
    expect(await candidates()).not.toContain('架空録音X Pro');
  });
});
