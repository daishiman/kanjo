#!/usr/bin/env node
/**
 * ローカル検証用の匿名サンプルを生成し、起動中の wrangler dev(既定 8787)へ取り込む。
 *
 * 実データは一切使わない。生成物は `samples/` に置く(.gitignore の匿名サンプル例外)。
 * 決定的な擬似乱数を使うので、何度実行しても同じ明細になる。
 *
 *   node scripts/seed-local.mjs                 # 生成 + 取込(健全なシナリオ)
 *   node scripts/seed-local.mjs --generate-only # 生成だけ
 *   KANJO_SEED_SCENARIO=tight node scripts/seed-local.mjs
 *       直近の事業入金を先細りさせ、防衛ライン割れの事前警告(FR-08)を画面で見られる状態にする
 */

import { mkdir, writeFile } from 'node:fs/promises';

const outDir = new URL('../samples/', import.meta.url);
const base = process.env.KANJO_BASE_URL ?? 'http://localhost:8787';
const password = process.env.AUTH_PASSWORD ?? 'kanjo-local-test';
const generateOnly = process.argv.includes('--generate-only');
/** 'healthy'(既定) か 'tight'。tight は直近の事業入金を落として事前警告を発火させる */
const scenario = process.env.KANJO_SEED_SCENARIO === 'tight' ? 'tight' : 'healthy';

/** xorshift32。seed 固定なので生成結果は毎回同じ */
function rng(seed) {
  let x = seed;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

/** 2025-01 〜 2026-08 の 20 ヶ月。前年同月比(13ヶ月)と季節性の下限を満たす長さ */
function months() {
  const out = [];
  for (let y = 2025; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 8) break;
      out.push({ y, m, key: `${y}-${String(m).padStart(2, '0')}` });
    }
  }
  return out;
}

const MONTHS = months();
const day = (y, m, d) => `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

/* ============================ MF 明細 ============================ */

const MF_HEADER = [
  '計算対象',
  '日付',
  '内容',
  '金額（円）',
  '保有金融機関',
  '大項目',
  '中項目',
  'メモ',
  '振替',
  'ID',
];

/** 口座。名義の出し分け(事業/配偶者/家族)を画面で確認できるようにする */
const INST = {
  self: 'テスト銀行 本人普通',
  spouse: 'テスト銀行 配偶者普通',
  card: 'テストカード',
};

/** 毎月出る生活費。[大項目, 中項目, 内容, 基準額, ぶれ幅, 口座] */
const LIVING = [
  ['食費', '食料品', 'テストスーパー', 62000, 12000, INST.card],
  ['食費', '外食', 'テスト食堂', 18000, 9000, INST.card],
  ['日用品', '日用品', 'テストドラッグ', 9500, 3500, INST.card],
  ['水道・光熱費', '電気代', 'テスト電力', 11000, 4200, INST.self],
  ['水道・光熱費', 'ガス・水道', 'テストガス', 7200, 2400, INST.self],
  ['通信費', '携帯電話', 'テストモバイル', 8800, 600, INST.card],
  ['住宅', '家賃', 'テスト不動産 家賃', 128000, 0, INST.self],
  ['趣味・娯楽', '書籍', 'テスト書店', 4200, 3000, INST.card],
  ['交通費', '電車', 'テスト交通 IC チャージ', 6000, 2000, INST.card],
];

/** サブスク。事業立替(事業の経費を個人カードで払う)として扱わせる */
const SUBS = [
  ['Anthropic Claude', 'テストAI', 'サブスク・通信', 3000],
  ['GitHub', 'テスト開発', 'サブスク・通信', 1800],
  ['Adobe CC', 'テスト制作', 'サブスク・通信', 6480],
  ['Notion', 'テスト業務', 'サブスク・通信', 1200],
];

function mfRows() {
  const rand = rng(20260827);
  const rows = [MF_HEADER];
  let seq = 0;
  const id = () => `MF${String(++seq).padStart(6, '0')}`;
  const push = (r) => rows.push(r);

  for (const { y, m, key } of MONTHS) {
    // --- 収入: 給与(本人)・配偶者給与・事業入金 ---
    push(['1', day(y, m, 25), 'テスト商事 給与', '285000', INST.self, '収入', '給与', '', '0', id()]);
    push(['1', day(y, m, 25), 'テスト工業 給与', '182000', INST.spouse, '収入', '給与', '', '0', id()]);
    // 事業入金は月によって変動。3の倍数月は大口
    let biz = m % 3 === 0 ? 480000 : 240000 + Math.round(rand() * 90000);
    // tight シナリオ: 最後の4ヶ月で受注が細っていく様子を作る。
    // 給与(本人+配偶者=467,000)だけでは防衛ラインに届かない水準まで落とし、
    // 「直近月が割れ、翌月見込みも割れる」= warn を画面で再現できるようにする。
    if (scenario === 'tight') {
      const fromEnd = MONTHS.length - 1 - MONTHS.findIndex((x) => x.key === key);
      const taper = [10000, 30000, 80000, 150000][fromEnd];
      if (taper !== undefined) biz = taper;
    }
    push([
      '1',
      day(y, m, 15),
      'テストクライアント 入金',
      String(biz),
      INST.self,
      '収入',
      '事業収入',
      '',
      '0',
      id(),
    ]);

    // --- 生活費 ---
    for (const [big, mid, name, basis, jitter, inst] of LIVING) {
      const amt = basis + Math.round((rand() - 0.5) * jitter);
      push(['1', day(y, m, 3 + (seq % 20)), name, String(-amt), inst, big, mid, '', '0', id()]);
    }

    // --- サブスク(事業立替) ---
    for (const [vendor, , , price] of SUBS) {
      let amt = price;
      // 重複検知(中央値の1.8倍超かつ2万円超)を 2026-05 の Anthropic で再現
      if (vendor === 'Anthropic Claude' && key === '2026-05') amt = price * 12;
      // 急増検知(3倍超かつ1.5万円超)を 2026-07 の Adobe で再現
      if (vendor === 'Adobe CC' && key === '2026-07') amt = price * 4;
      push([
        '1',
        day(y, m, 10),
        `${vendor} 月額`,
        String(-amt),
        INST.card,
        '通信費',
        'サブスク',
        '',
        '0',
        id(),
      ]);
    }

    // --- 口座間振替(有効明細から除外されることの確認用) ---
    push(['1', day(y, m, 26), 'カード引落', '-150000', INST.self, 'その他', '振替', '', '1', id()]);
    // --- 計算対象外(除外されることの確認用) ---
    push(['0', day(y, m, 26), '集計対象外テスト行', '-9999', INST.self, 'その他', '未分類', '', '0', id()]);
  }
  return rows;
}

/* ============================ freee 仕訳 ============================ */

const FREEE_HEADER = [
  '収支区分',
  '発生日',
  '取引先',
  '勘定科目',
  '金額',
  '支払期日',
  '支払日',
  '支払口座',
  '支払金額',
];

/** [勘定科目, 取引先, 基準額, ぶれ幅] */
const FREEE_EXPENSE = [
  ['支払手数料', 'テスト決済', 4800, 1200],
  ['通信費', 'テストISP', 6600, 0],
  ['地代家賃', 'テスト不動産', 55000, 0],
  ['外注費', 'テストパートナー', 120000, 80000],
  ['旅費交通費', 'テスト交通', 18000, 12000],
  ['消耗品費', 'テスト事務用品', 9000, 6000],
  ['広告宣伝費', 'テスト広告', 30000, 25000],
];

function freeeRows() {
  const rand = rng(88881234);
  const rows = [FREEE_HEADER];
  const lastKey = MONTHS[MONTHS.length - 1].key;

  for (const { y, m, key } of MONTHS) {
    // --- 売上 ---
    const sales = m % 3 === 0 ? 620000 : 340000 + Math.round(rand() * 120000);
    // 直近2ヶ月の売上は「未入金(支払日が空)」にして未決済一覧を確認できるようにする
    const unsettledSale = key === lastKey || key === MONTHS[MONTHS.length - 2].key;
    rows.push([
      '収入',
      day(y, m, 20),
      'テストクライアント',
      '売上高',
      String(sales),
      day(y, m === 12 ? 1 : m + 1, 28),
      unsettledSale ? '' : day(y, m === 12 ? 1 : m + 1, 28),
      unsettledSale ? '' : 'テスト銀行 事業',
      unsettledSale ? '' : String(sales),
    ]);

    // --- 経費 ---
    for (const [acct, vendor, basis, jitter] of FREEE_EXPENSE) {
      const amt = basis + Math.round((rand() - 0.5) * jitter);
      // 外注費だけ最終月を未払にする(期日超過の確認用)
      const unpaid = acct === '外注費' && key === lastKey;
      rows.push([
        '支出',
        day(y, m, 5 + (amt % 20)),
        vendor,
        acct,
        String(amt),
        day(y, m, 28),
        unpaid ? '' : day(y, m, 28),
        unpaid ? '' : 'テスト銀行 事業',
        unpaid ? '' : String(amt),
      ]);
    }
  }
  return rows;
}

/* ============================ 出力・取込 ============================ */

/** RFC4180 最小。カンマ・引用符・改行だけを囲う */
function toCsv(rows) {
  return `${rows
    .map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)).join(','))
    .join('\r\n')}\r\n`;
}

/**
 * 1リクエストに載せる (domain × month) unit 数を抑えるため、年ごとに分ける。
 * FR-01 の 49 D1 query 予算は unit 数に比例するので、20ヶ月×2ドメインを一度に投げると
 * R2/run を作る前に 413 で弾かれる(仕様どおりの安全弁)。
 */
function splitByYear(rows) {
  const header = rows[0];
  const byYear = new Map();
  for (const r of rows.slice(1)) {
    const y = r[1].slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, [header]);
    byYear.get(y).push(r);
  }
  return byYear;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  /** @type {Array<{name: string, csv: string}>} */
  const files = [];
  for (const [domain, rows] of [
    ['mf', mfRows()],
    ['freee', freeeRows()],
  ]) {
    for (const [year, yearRows] of splitByYear(rows)) {
      const name = `sample-${domain}-${year}.csv`;
      const csv = toCsv(yearRows);
      await writeFile(new URL(name, outDir), csv, 'utf8');
      console.log(`生成: samples/${name} (${yearRows.length - 1} 行)`);
      files.push({ name, csv });
    }
  }
  if (generateOnly) return;

  // --- ログイン ---
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) {
    throw new Error(`ログイン失敗 ${login.status}: ${await login.text()}`);
  }
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('セッションCookieを取得できませんでした');

  // --- 取込(force=1 で毎回洗い替え。ローカル検証用。1ファイルずつ直列に投げる) ---
  for (const { name, csv } of files) {
    const form = new FormData();
    form.append('file', new File([csv], name, { type: 'text/csv' }));
    form.append('force', '1');
    const res = await fetch(`${base}/api/imports`, { method: 'POST', headers: { cookie }, body: form });
    const body = await res.text();
    if (!res.ok) throw new Error(`取込失敗 ${name} ${res.status}: ${body}`);
    const parsed = JSON.parse(body);
    const units = parsed.units ?? parsed.results ?? [];
    console.log(`取込: ${name} → ${parsed.status ?? 'ok'} (${units.length} unit)`);
  }

  const json = async (path, method, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} 失敗 ${res.status}: ${await res.text()}`);
    return res.json();
  };

  // --- 仕分けルール(先勝ち)。事業入金とサブスクを事業へ寄せる ---
  const rules = [
    { keyword: 'テストクライアント 入金', cls: 'biz', owner: 'business' },
    { keyword: 'Anthropic', cls: 'biz' },
    { keyword: 'GitHub', cls: 'biz' },
    { keyword: 'Adobe', cls: 'biz' },
    { keyword: 'Notion', cls: 'biz' },
  ];
  const existing = await (await fetch(`${base}/api/rules`, { headers: { cookie } })).json();
  const known = new Set((existing.rules ?? []).map((r) => r.keyword));
  for (const rule of rules) {
    if (known.has(rule.keyword)) continue;
    await json('/api/rules', 'POST', rule);
  }
  console.log(`仕分けルール: ${rules.length} 件を確認/登録`);

  // --- 口座の名義。MF `保有金融機関` 列から名義別内訳を出せるようにする ---
  await json('/api/classification', 'PUT', {
    institutionOwners: {
      'テスト銀行 本人普通': 'business',
      'テスト銀行 配偶者普通': 'spouse',
      テストカード: 'family',
    },
  });
  console.log('口座の名義: 3 口座を設定');

  // --- 予算。予実差異と「予算超過」の捻出候補を出せるようにする ---
  await json('/api/budgets', 'PUT', {
    budgets: {
      サブスク・通信: 9000,
      外注費: 100000,
      広告宣伝費: 20000,
      旅費交通費: 15000,
    },
  });
  console.log('予算: 4 科目を設定');

  console.log('テストデータの投入が完了しました。');
}

await main();
