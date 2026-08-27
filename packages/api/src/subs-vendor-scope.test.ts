/**
 * サブスク登録の「対象勘定科目しぼり」と、候補一覧の「サブスクではない」記録の API/D1 回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空仕訳だけで検証する。
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

  await d1.batch([
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
