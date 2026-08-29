/**
 * 証憑(領収書)の申告時の取り出し。
 *
 * 添付そのものは attachments.ts が既に持っている。ここが埋めるのは、
 * 申告の直前になって初めて困る2つ:
 *
 *   1. **どの経費に領収書が無いのか分からない**
 *      明細を1件ずつ開いて確かめるしかない状態だと、件数が増えた時点で誰も確かめなくなる。
 *      未添付を金額つきで一覧にし、上から潰せば終わる形にする。
 *
 *   2. **まとめて取り出せない**
 *      1件ずつしか落とせないと、税理士へ渡すのも、保存要件の説明もできない。
 *      年度ぶんを ZIP にし、日付・金額・取引先で引ける索引を同梱する。
 *
 * 電子帳簿保存法(電子取引データの保存)が求めるのは、突き詰めれば
 * 「日付・金額・取引先で検索できること」と「訂正削除の履歴が分かること」。
 * ここはその1つ目に、ファイル名と索引CSVの両方で応える。
 * ファイル名だけに寄せると OS の検索に依存し、索引だけに寄せると
 * ZIP を展開した人が個々のファイルを見分けられない。両方要る。
 */
import {
  type CashEntry,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  cashTxId,
  isCashTxId,
  paymentMethodOf,
} from './cash.js';
import { resolveTx } from './classify.js';
import type { TaxYear } from './tax-return.js';
import { isMfCountable } from './types.js';
import type { Dataset } from './types.js';

/** 証憑が要るのに付いていない明細1件 */
export interface ReceiptGapRow {
  /** 添付先の wire 形式 ID(現金は 'cash:<id>')。そのまま添付APIへ渡せる */
  txId: string;
  /** 'YYYY-MM' */
  month: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 内容・支払先 */
  description: string;
  /** 支出額(正の数) */
  amount: number;
  /** 帳簿上の科目 */
  account: string;
  paymentMethod: PaymentMethod;
  attachmentCount: number;
  /** 領収書が構造上出ない支出(電車代など)として明示的に免除されているか */
  waived: boolean;
}

/**
 * 未添付をどれだけ急いで埋めるべきか。
 *
 * - must     … 無いと経費として通しにくい。最優先で埋める
 * - should   … 埋めたほうがよい。カード・口座の利用明細が一次的な裏づけにはなる
 * - optional … 実務上そこまで求められない。時間が余ったら
 */
export type ReceiptGapUrgency = 'must' | 'should' | 'optional';

export const RECEIPT_GAP_URGENCY_LABEL: Record<ReceiptGapUrgency, string> = {
  must: '要対応',
  should: '推奨',
  optional: '後で確認',
};

/**
 * 少額の目安。これ未満は、カード・口座払いなら後回しでよいとみなす。
 * 3,000円という数字自体に法令上の根拠は無い。「1件あたり数分かかる添付作業に
 * 見合うか」という運用上の線なので、利用者の感覚に合わせて動かしてよい。
 */
export const RECEIPT_MINOR_AMOUNT = 3_000;

/**
 * これ以上は支払手段によらず原本を求める額。
 * 3万円はこのアプリ内で作業順を決めるための運用上の目安。
 * 証憑の法的な要否や特例適用を判定する金額ではない。
 */
export const RECEIPT_MAJOR_AMOUNT = 30_000;

/**
 * 未添付1件の緊急度。
 *
 * 軸は2つだけ。**代替証憑があるか**(支払手段)と**金額の帯**。
 * 科目名はあえて見ない。科目は利用者が自由に付けられる文字列なので、
 * 「交際費なら must」のような名前一致を入れると、名前を変えた瞬間に
 * 静かに緊急度が下がる。気づけない誤りは作らない。
 */
export function receiptGapUrgency(row: ReceiptGapRow): ReceiptGapUrgency {
  // 免除済みは一覧に出ないが、単体で呼ばれても優先度を上げない
  if (row.waived) return 'optional';
  if (row.amount >= RECEIPT_MAJOR_AMOUNT) return 'must';

  // 現金は口座履歴という裏づけが無い。手段が不明なものも、確かめるまでは現金と同じ扱い
  const noTrail = row.paymentMethod === 'cash' || row.paymentMethod === 'unknown';
  if (noTrail) return row.amount >= RECEIPT_MINOR_AMOUNT ? 'must' : 'should';

  // カード・口座は利用明細が一次的な裏づけになるので、1段ずつ下げる
  return row.amount >= RECEIPT_MINOR_AMOUNT ? 'should' : 'optional';
}

/** 未添付の集計。画面の見出しと、申告準備チェックの両方がこれを読む */
export interface ReceiptGapSummary {
  /** 証憑が要る事業支出の件数(免除を除く) */
  requiredCount: number;
  attachedCount: number;
  missingCount: number;
  /** 運用優先度が「要対応」の未添付。申告準備のblocked判定にそのまま使う。 */
  mustMissingCount: number;
  /** 未添付ぶんの金額合計 */
  missingAmount: number;
  /** 0..1。1 なら全件に証憑がある */
  coverage: number;
  byUrgency: Record<ReceiptGapUrgency, { count: number; amount: number }>;
}

export interface ReceiptGapReport {
  summary: ReceiptGapSummary;
  /** 未添付の一覧。緊急度が高い順 → 金額が大きい順 */
  rows: (ReceiptGapRow & { urgency: ReceiptGapUrgency })[];
}

/** このアプリ内で証憑を紐づけられる、対象年の事業支出1件。 */
export interface ReceiptInventoryItem extends ReceiptGapRow {
  /** MF分割子行でも必ず親取引ID。 */
  attachmentTargetId: string;
  source: 'mf' | 'cash';
  /** 分割後に事業支出が複数科目にまたがる場合の内訳。 */
  accounts: string[];
}

export interface ReceiptInventory {
  year: TaxYear;
  items: ReceiptInventoryItem[];
  /** freee側の原本は二重管理せず、別系統の確認対象と明示する。 */
  externalSources: readonly [{ source: 'freee'; responsibility: 'external-confirmation' }];
}

export interface ReceiptInventoryInput {
  year: TaxYear;
  /** freeeに投影される事業現金を、証憑棚卸しにだけ合流させる。 */
  cashEntries?: readonly CashEntry[];
  /** 旧データ等、CashEntry以外で明示的に証憑不要とした親ID。 */
  waivedTxIds?: readonly string[];
}

/** 'YYYY-MM' と MF の 'MM/DD' から 'YYYY-MM-DD' を組む。年跨ぎは月キー側を信じる */
export function receiptDate(month: string, d: string): string {
  const parts = d.split('/');
  const day = parts.length >= 2 ? parts[parts.length - 1] : '01';
  return `${month}-${day.padStart(2, '0')}`;
}

export interface ReceiptGapFromInventoryInput {
  /** 添付先の wire 形式 ID → 添付件数 */
  attachmentCounts: Record<string, number>;
  /** これ未満の支出は一覧に出さない。既定 0(全件) */
  minAmount?: number;
}

export interface ReceiptGapInput extends ReceiptInventoryInput, ReceiptGapFromInventoryInput {}

type InventoryBuilder = {
  txId: string;
  month: string;
  date: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  source: 'mf' | 'cash';
  accounts: Set<string>;
  waived: boolean;
};

/**
 * 対象年の証憑棚卸し。MF分割は子行を数えず、証憑の添付先である親取引へ1本化する。
 */
export function receiptInventory(data: Dataset, input: ReceiptInventoryInput): ReceiptInventory {
  const waivedIds = new Set(input.waivedTxIds ?? []);
  const cashByTarget = new Map((input.cashEntries ?? []).map((entry) => [cashTxId(entry.id), entry]));
  const grouped = new Map<string, InventoryBuilder>();

  for (const tx of data.mfTx) {
    if (tx.m.slice(0, 4) !== input.year || !isMfCountable(tx) || tx.a >= 0) continue;
    const resolved = resolveTx(tx, data.rules, data.edits, data.institutionOwners);
    if (resolved.cls !== 'biz') continue;

    const targetId = tx.splitProjection?.kind === 'split' ? tx.splitProjection.parentTxId : tx.id;
    const account = resolved.mid ? `${resolved.big} / ${resolved.mid}` : resolved.big;
    const current = grouped.get(targetId);
    if (current) {
      current.amount += Math.abs(tx.a);
      current.accounts.add(account);
      continue;
    }
    const cashEntry = cashByTarget.get(targetId);
    grouped.set(targetId, {
      txId: targetId,
      month: tx.m,
      date: receiptDate(tx.m, tx.d),
      description: tx.c,
      amount: Math.abs(tx.a),
      paymentMethod: paymentMethodOf({ ...tx, id: targetId }),
      source: isCashTxId(targetId) ? 'cash' : 'mf',
      accounts: new Set([account]),
      waived: waivedIds.has(targetId) || cashEntry?.receiptWaived === true,
    });
  }

  // 事業現金は freee 集計に入るため MF 明細には現れない。ここで証憑対象だけを補う。
  for (const entry of input.cashEntries ?? []) {
    if (entry.month.slice(0, 4) !== input.year || entry.side !== 'biz' || entry.io !== 'expense') continue;
    const targetId = cashTxId(entry.id);
    if (grouped.has(targetId)) continue;
    grouped.set(targetId, {
      txId: targetId,
      month: entry.month,
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      paymentMethod: 'cash',
      source: 'cash',
      accounts: new Set([
        entry.categoryMid ? `${entry.categoryMajor} / ${entry.categoryMid}` : entry.categoryMajor,
      ]),
      waived: entry.receiptWaived || waivedIds.has(targetId),
    });
  }

  const items = [...grouped.values()]
    .map((row): ReceiptInventoryItem => {
      const accounts = [...row.accounts].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja'));
      return {
        txId: row.txId,
        attachmentTargetId: row.txId,
        month: row.month,
        date: row.date,
        description: row.description,
        amount: row.amount,
        account: accounts.join(' / '),
        accounts,
        paymentMethod: row.paymentMethod,
        source: row.source,
        attachmentCount: 0,
        waived: row.waived,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.txId.localeCompare(b.txId));

  return {
    year: input.year,
    items,
    externalSources: [{ source: 'freee', responsibility: 'external-confirmation' }],
  };
}

/** authoritativeな添付件数を取る前に、R2 HEAD対象を親IDで一意に固定する。 */
export function receiptInventoryTargets(inventory: ReceiptInventory): string[] {
  return [...new Set(inventory.items.map((item) => item.attachmentTargetId))].sort();
}

/**
 * 事業経費のうち証憑が付いていないものを洗い出す。
 *
 * 対象は「この帳簿で証憑を貼れる明細」= MF 取込明細と現金の記帳だけ。
 * freee 側で記帳した仕訳は freee に証憑があるため、ここでは扱わない
 * (二重に「未添付」と言われても、利用者はこの画面では直せない)。
 */
export function receiptGapReportFromInventory(
  inventory: ReceiptInventory,
  input: ReceiptGapFromInventoryInput,
): ReceiptGapReport {
  const min = input.minAmount ?? 0;

  let requiredCount = 0;
  let attachedCount = 0;
  const rows: (ReceiptGapRow & { urgency: ReceiptGapUrgency })[] = [];

  for (const item of inventory.items) {
    const count = input.attachmentCounts[item.attachmentTargetId] ?? 0;
    const isWaived = item.waived;
    if (!isWaived) {
      requiredCount++;
      if (count > 0) attachedCount++;
    }
    if (count > 0 || isWaived) continue;

    const row: ReceiptGapRow = { ...item, attachmentCount: count };
    rows.push({ ...row, urgency: receiptGapUrgency(row) });
  }

  const rank: Record<ReceiptGapUrgency, number> = { must: 0, should: 1, optional: 2 };
  rows.sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.amount - a.amount);

  const byUrgency: Record<ReceiptGapUrgency, { count: number; amount: number }> = {
    must: { count: 0, amount: 0 },
    should: { count: 0, amount: 0 },
    optional: { count: 0, amount: 0 },
  };
  for (const r of rows) {
    byUrgency[r.urgency].count++;
    byUrgency[r.urgency].amount += r.amount;
  }

  return {
    // 集計は常に期間全体を見る。minAmount は「一覧に出すか」だけを決める。
    // 少額を隠した状態で添付率まで良く見えると、隠した瞬間に終わったと錯覚する。
    summary: {
      requiredCount,
      attachedCount,
      missingCount: rows.length,
      mustMissingCount: byUrgency.must.count,
      missingAmount: rows.reduce((s, r) => s + r.amount, 0),
      coverage: requiredCount > 0 ? attachedCount / requiredCount : 1,
      byUrgency,
    },
    rows: min > 0 ? rows.filter((r) => r.amount >= min) : rows,
  };
}

/** 後方互換の便宜関数。棚卸しと gap 判定の実装は必ず上の2段階を通る。 */
export function receiptGapReport(data: Dataset, input: ReceiptGapInput): ReceiptGapReport {
  const inventory = receiptInventory(data, input);
  return receiptGapReportFromInventory(inventory, input);
}

/* ======================== 書き出し ======================== */

/**
 * 索引CSVの列。電子帳簿保存法が求める検索項目(取引年月日・取引金額・取引先)を先頭3列に置く。
 * 税務職員に「この3列で絞り込めます」と言えることが、この並びの目的。
 */
export const RECEIPT_INDEX_HEADER = [
  '取引年月日',
  '取引金額',
  '取引先',
  '科目',
  '支払手段',
  'ファイル名',
  '明細ID',
  '添付日時',
] as const;

/** ZIP に入れる証憑1件の情報。R2 からの読み出しは API 側が持つ */
export interface ReceiptFile {
  txId: string;
  date: string;
  amount: number;
  partner: string;
  account: string;
  paymentMethod: PaymentMethod;
  /** 添付の連番(同じ明細に複数枚あるとき) */
  seq: number;
  /** 元のファイル名の拡張子 */
  ext: string;
  createdAt: string;
}

/** 親target IDから、同じ入力で常に同じになる短い識別子を作る。 */
export function receiptTargetSuffix(targetId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < targetId.length; index++) {
    hash ^= targetId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * ZIP 内のファイル名。「日付_取引先_金額円」を先頭に置く。
 * 展開してファイル名を見ただけで、どの取引の証憑か分かる並びにする。
 * 名前順に並べるとそのまま日付順になるのも、この順序を選ぶ理由。
 */
export function receiptFileName(f: ReceiptFile): string {
  const partner =
    f.partner
      .replace(/\s+/g, ' ')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .slice(0, 40) || '取引先不明';
  const target = receiptTargetSuffix(f.txId);
  const seq = f.seq > 1 ? `_${f.seq}` : '';
  return `${f.date}_${partner}_${f.amount}円_${target}${seq}.${f.ext}`;
}

/** 月フォルダに分ける。年度ぶんを1階層に並べると数百件で見られなくなる */
export function receiptZipPath(f: ReceiptFile): string {
  return `${f.date.slice(0, 7)}/${receiptFileName(f)}`;
}

export function receiptIndexRows(files: readonly ReceiptFile[]): (string | number)[][] {
  return [...files]
    .sort((a, b) => a.date.localeCompare(b.date) || a.txId.localeCompare(b.txId) || a.seq - b.seq)
    .map((f) => [
      f.date,
      f.amount,
      f.partner,
      f.account,
      PAYMENT_METHOD_LABEL[f.paymentMethod],
      receiptZipPath(f),
      f.txId,
      f.createdAt,
    ]);
}

/** ZIP に同梱する読み手向けの説明。展開した人が索引の使い方に迷わないようにする */
export function receiptReadme(period: string, count: number, generatedAt: string): string {
  return [
    '# 証憑(領収書)の書き出し',
    '',
    `対象期間: ${period}`,
    `件数: ${count}件`,
    `作成日時: ${generatedAt}`,
    '',
    '## 中身',
    '',
    '- `索引.csv` … 取引年月日・取引金額・取引先で検索するための一覧(Excelでそのまま開けます)',
    '- `YYYY-MM/` … 月ごとのフォルダ。ファイル名は「日付_取引先_金額円_取引識別子」',
    '',
    '## 探し方',
    '',
    '1. `索引.csv` を開く',
    '2. 取引年月日・取引金額・取引先のいずれかで絞り込む',
    '3. 「ファイル名」列のパスをこのフォルダ内でたどる',
    '',
    '## 注意',
    '',
    '- この書き出しは控えです。原本は引き続きシステム側に保存されています。',
    '- 電子帳簿保存法の要件は、保存方法や事業規模によって異なります。',
    '  最終的な判断は所轄の税務署・税理士に確認してください。',
  ].join('\n');
}
