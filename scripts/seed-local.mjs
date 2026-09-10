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

/**
 * 口座。名義の出し分け(事業/配偶者/家族)を画面で確認できるようにする。
 * 実エクスポートは「1枚のカードに支出の7割が集中し、銀行は少数」という偏りを持つ。
 * 均等に散らすと名義別内訳も口座別残高も現実と違う形になるので、その偏りを写す。
 */
const INST = {
  /** 主力カード。家計支出の大半がここを通る(実データでは 96/131 行) */
  card: 'テストカード 配偶者名義',
  self: 'テスト銀行 本人普通',
  spouse: 'テスト銀行 配偶者普通',
  shinkin: 'テスト信用金庫 本人',
  second: 'テスト第二銀行 本人',
  net: 'テストネット銀行 本人',
  mall: 'テストモール(ポイント)',
};

/**
 * 毎月出る生活費。[大項目, 中項目, 内容, 基準額, ぶれ幅, 口座]
 * 大項目は実エクスポートの19種を写す。「未分類」「その他」が一定数あることまで含めて
 * 現実で、これが無いと未分類の掘り起こし導線が画面で試せない。
 */
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
  ['自動車', 'ガソリン', 'テスト石油', 7800, 2600, INST.card],
  ['健康・医療', '医療費', 'テスト薬局', 3400, 2200, INST.card],
  ['教養・教育', '習い事', 'テストスクール', 12000, 0, INST.net],
  ['保険', '生命保険', 'テスト生命', 14500, 0, INST.self],
  ['税・社会保障', '税金', 'テスト市 住民税', 21000, 0, INST.shinkin],
  ['衣服・美容', '衣服', 'テスト衣料', 6800, 5200, INST.card],
  ['交際費', '交際費', 'テスト贈答', 5200, 4000, INST.card],
  ['特別な支出', '特別な支出', 'テスト家電', 24000, 20000, INST.mall],
  ['その他', '使途不明金', 'テスト引き出し', 30000, 10000, INST.second],
  ['未分類', '未分類', 'テスト未分類決済', 4600, 3800, INST.card],
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
  /**
   * 実エクスポートの ID は43文字の不透明な文字列。8文字の連番にすると
   * 指紋計算も重複判定も「短くて規則的な ID」でしか検証されなくなるため長さを写す。
   */
  const id = () => {
    const n = ++seq;
    let s = '';
    let x = n * 2654435761;
    while (s.length < 43) {
      x = (x ^ (x << 13)) >>> 0;
      x = (x ^ (x >>> 17)) >>> 0;
      s += (x >>> 0).toString(36);
    }
    return s.slice(0, 43);
  };
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

    /*
     * --- 口座間振替(有効明細から除外されることの確認用) ---
     * 実エクスポートでは 振替=1 の行は必ず 計算対象=0 で出る(27行が完全に一致)。
     * 以前は 計算対象=1 で作っていたため、除外が「振替フラグ」だけで効いているのか
     * 「計算対象フラグ」でも効くのかを切り分けられなかった。実データの組み合わせに揃える。
     * カード引落は主力カードの当月利用額に対応する銀行側の出金なので、
     * 二重計上を防ぐためにこの行が除外される必要がある。
     */
    push([
      '0',
      day(y, m, 26),
      'カード引落',
      '-150000',
      INST.self,
      '現金・カード',
      'カード引き落とし',
      '',
      '1',
      id(),
    ]);
    push([
      '0',
      day(y, m, 27),
      'ATM引き出し',
      '-30000',
      INST.self,
      '現金・カード',
      'ATM引き出し',
      '',
      '1',
      id(),
    ]);
    /*
     * 電子マネーへのチャージ。実エクスポートでは振替16件のうち13件がこれで、
     * 「振替の大半は少額・高頻度のチャージ」という形をしている。月1件の大口だけにすると
     * 振替除外が件数の多い経路で効いているかを確かめられない。
     */
    for (let i = 0; i < 4; i++) {
      push([
        '0',
        day(y, m, 6 + i * 7),
        '電子マネーチャージ',
        '-3000',
        INST.card,
        '現金・カード',
        '電子マネー',
        '',
        '1',
        id(),
      ]);
    }
    // --- 振替ではないが計算対象外(集計から外れることの確認用) ---
    push(['0', day(y, m, 26), '集計対象外テスト行', '-9999', INST.self, 'その他', '未分類', '', '0', id()]);
  }
  return rows;
}

/* ============================ freee 仕訳 ============================ */

/**
 * 実エクスポート(取引フォーマット)の17列。パーサは列名で位置を引くので順序非依存だが、
 * 9列の簡易版だけを流していると 税区分・品目・部門・メモタグ といった
 * 「実ファイルには必ず居るが実装が使っていない列」を一度も通さないことになる。
 * 未使用列が増えても取込が壊れないことを、この形で毎回確かめる。
 */
const FREEE_HEADER = [
  '収支区分',
  '管理番号',
  '発生日',
  '支払期日',
  '取引先',
  '勘定科目',
  '税区分',
  '金額',
  '税計算区分',
  '税額',
  '備考',
  '品目',
  '部門',
  'メモタグ（複数指定可、カンマ区切り）',
  '支払日',
  '支払口座',
  '支払金額',
];

/** 実エクスポートで観測した発生列。管理番号・支払期日・部門は常に空だった */
const FREEE_EMPTY_COLUMNS = { 管理番号: '', 支払期日: '', 部門: '' };

/**
 * 経費。[勘定科目, 取引先, 基準額, ぶれ幅, 税区分, 品目]
 * 実データは通信費が18/30行と偏り、税区分は 課対仕入10% / 非課仕入 / 対象外 の3種が混在する。
 * 税区分が1種類しかないと、税額0の行(非課・対象外)を通る経路が検証されない。
 */
const FREEE_EXPENSE = [
  ['通信費', 'テストAI', 3000, 0, '課対仕入10%', 'テストLLMサブスク'],
  ['通信費', 'テスト開発', 1800, 0, '課対仕入10%', 'テスト開発サブスク'],
  ['通信費', 'テスト制作', 6480, 0, '課対仕入10%', 'テスト制作サブスク'],
  ['通信費', 'テスト業務', 1200, 0, '課対仕入10%', 'テスト業務サブスク'],
  ['通信費', 'テストクラウド', 400, 0, '課対仕入10%', 'テストストレージ'],
  ['新聞図書費', 'テスト書籍', 2400, 1200, '課対仕入10%', 'テスト技術書'],
  ['旅費交通費', 'テスト交通', 18000, 12000, '課対仕入10%', 'テスト移動費'],
  ['会議費', 'テストカフェ', 1800, 900, '課対仕入10%', 'テスト打合せ'],
  ['交際費', 'テスト商工団体', 5000, 0, '対象外', 'テスト団体会費'],
  ['研修費', 'テストセミナー', 12000, 8000, '課対仕入10%', 'テスト研修受講'],
  ['消耗品費', 'テスト事務用品', 9000, 6000, '課対仕入10%', 'テスト備品'],
  ['支払手数料', 'テスト決済', 450, 0, '非課仕入', 'テスト事務手数料'],
];

/**
 * その経費を「事業主借(個人の財布で立替)」で決済したことにするか。
 *
 * ここがトータル収支の3つの表の分かれ目になる。個人カードで立て替えた経費は
 * MF 側にも決済行として現れるので freee と MF に同じ支出が2回載る。この重複を
 * 消し込むのが「一致した」表。一方、事業口座から直接払った経費は MF に現れないので
 * 「マネーフォワードに相手がいないフリー」に入る — これは重複ではなく、
 * 単に家計簿を通っていないだけ、というのが今回の画面の説明そのもの。
 *
 * MF 側で決済行を作っているのは SUBS の4ベンダー(テストAI/テスト開発/テスト制作/テスト業務)だけ。
 * ここで true を返す取引先が SUBS に無いと、MF に相手がいないのに「一致した」表を
 * 期待することになり、サンプルとして矛盾する。
 *
 * 実データは30行すべてが事業主借だったが、それをそのまま写すと freee の全件が
 * 「一致した」表へ入り、今回是正した「相手がいないフリー」の表が空になって画面を確認できない。
 * 実データから写すのは列の形と勘定科目・税区分の分布までとし、決済形態は
 * 3つの表すべてに行が流れる配分にする。
 *
 * @param {string} vendor 取引先
 * @returns {boolean} true=事業主借(MFにも出る) / false=事業口座払い(MFには出ない)
 */
function isOwnerAdvance(vendor) {
  return MF_SETTLED_VENDORS.has(vendor);
}

/**
 * MF 側に決済行を作っている取引先。SUBS の2列目(freee の取引先名)から導出する。
 * 手書きの配列で二重管理すると、SUBS を足したのにここを直し忘れた時に
 * 「MF には出るが freee は事業口座払い」という説明のつかない組み合わせが静かに生まれる。
 */
const MF_SETTLED_VENDORS = new Set(SUBS.map(([, vendor]) => vendor));

/** 内税の消費税額。課税以外(非課仕入・対象外)は税額0で出る */
function taxAmount(amount, taxClass) {
  if (taxClass !== '課対仕入10%') return 0;
  return Math.round((amount * 10) / 110);
}

/**
 * 17列を列名で埋める。位置指定で組むと、列を1本足しただけで以降が全てずれる。
 * FREEE_HEADER の順序が変わってもこの関数の呼び出し側は直さなくてよい。
 */
function freeeRow(values) {
  const filled = { ...FREEE_EMPTY_COLUMNS, ...values };
  return FREEE_HEADER.map((name) => String(filled[name] ?? ''));
}

function freeeRows() {
  const rand = rng(88881234);
  const rows = [FREEE_HEADER];
  const lastKey = MONTHS[MONTHS.length - 1].key;

  for (const { y, m, key } of MONTHS) {
    // --- 売上 ---
    const sales = m % 3 === 0 ? 620000 : 340000 + Math.round(rand() * 120000);
    // 直近2ヶ月の売上は「未入金(支払日が空)」にして未決済一覧を確認できるようにする
    const unsettledSale = key === lastKey || key === MONTHS[MONTHS.length - 2].key;
    const dueDate = day(y, m === 12 ? 1 : m + 1, 28);
    rows.push(
      freeeRow({
        収支区分: '収入',
        発生日: day(y, m, 20),
        支払期日: dueDate,
        取引先: 'テストクライアント',
        勘定科目: '売上高',
        税区分: '課対売上10%',
        金額: sales,
        税計算区分: '内税',
        税額: Math.round((sales * 10) / 110),
        品目: 'テスト受託開発',
        支払日: unsettledSale ? '' : dueDate,
        支払口座: unsettledSale ? '' : 'テスト銀行 事業',
        支払金額: unsettledSale ? '' : sales,
      }),
    );

    // --- 経費 ---
    for (const [acct, vendor, basis, jitter, taxClass, item] of FREEE_EXPENSE) {
      const amt = basis + Math.round((rand() - 0.5) * jitter);
      const date = day(y, m, 5 + (amt % 20));
      /*
       * 決済形態。実エクスポートでは30行すべてが「事業主借」= 個人の財布で立て替えた形で、
       * 事業口座からの直接支払は1件も無かった。立替は MF 側にも個人カードの決済として
       * 現れるため、同じ支出が2つの入力元に重複して載る。これがトータル収支の
       * 「一致した」表で消し込む対象そのものなので、既定を事業主借にする。
       */
      const paidFromOwner = isOwnerAdvance(vendor);
      const settleAccount = paidFromOwner ? '事業主借' : 'テスト銀行 事業';
      rows.push(
        freeeRow({
          収支区分: '支出',
          発生日: date,
          取引先: vendor,
          勘定科目: acct,
          税区分: taxClass,
          金額: amt,
          税計算区分: '内税',
          税額: taxAmount(amt, taxClass),
          品目: item,
          // 立替は発生と同日に決済される(カードを切った瞬間に支払が済んでいる)
          支払日: paidFromOwner ? date : day(y, m, 28),
          支払口座: settleAccount,
          支払金額: amt,
        }),
      );
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
function splitByYear(rows, dateColumn) {
  const header = rows[0];
  const at = header.indexOf(dateColumn);
  // 列位置を決め打ちにすると、列を1本足した時に静かに別の列で年を切り始める。
  // 年が全て同じ文字列になっても取込は成功してしまうため、ここで落とす。
  if (at < 0) throw new Error(`日付列 ${dateColumn} が見つかりません: ${header.join(',')}`);
  const byYear = new Map();
  for (const r of rows.slice(1)) {
    const y = r[at].slice(0, 4);
    if (!/^20\d{2}$/.test(y)) throw new Error(`${dateColumn} が日付ではありません: ${r[at]}`);
    if (!byYear.has(y)) byYear.set(y, [header]);
    byYear.get(y).push(r);
  }
  return byYear;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  /** @type {Array<{name: string, csv: string}>} */
  const files = [];
  for (const [domain, rows, dateColumn] of [
    ['mf', mfRows(), '日付'],
    ['freee', freeeRows(), '発生日'],
  ]) {
    for (const [year, yearRows] of splitByYear(rows, dateColumn)) {
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
