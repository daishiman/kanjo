import type { BalanceRow } from '../balances.js';
/**
 * マネーフォワード「資産推移」CSVの行→月次の資産残高。
 *
 * このCSVは https://moneyforward.com/bs/history から書き出す。
 * 中身は日付ごとの1行で、列が資産の種類になっている。
 *
 *   日付, 合計（円）, 預金・現金（円）, 株式(現物)（円）, 投資信託（円）, 年金（円）, ポイント（円）
 *
 * 列は保有しているものだけが出る。持っていない種類の列は最初から存在しない。
 * だから列名を固定で当てにできず、「（円）」で終わる列を全部拾う形にする。
 *
 * 行の粒度が途中で変わるのがこのファイルの厄介なところ。
 *   直近1ヶ月 … 1日ごと(08/28, 08/27, 08/26 …)
 *   それ以前   … 月末だけ(07/31, 06/30, 05/31 …)
 * BSは「ある時点の残高」なので、月に何点もあっても使うのは1点だけ。
 * ここで月ごとに1行へ丸める。
 *
 * 「合計」列は保存しない。内訳の足し算で出せるものを別に持つと、
 * どちらかを直したときにもう片方が古いまま残る。検算にだけ使う。
 */
import { normDate, normMonth, parseAmount } from '../normalize.js';

export interface MfAssetParseResult {
  /** 月ごとに1行へ丸めた後の残高 */
  balances: BalanceRow[];
  months: string[];
  /** 日付を解釈できた入力行 */
  rows: number;
  /** 日付を解釈できず捨てた入力行 */
  skipped: number;
  /** 月内に複数あって採用しなかった行数(日次→月次の丸めで落ちた分) */
  collapsed: number;
  /** 見つかった資産の種類。画面で「何が入ったか」を出すのに使う */
  categories: string[];
  /**
   * 内訳の合計がCSVの「合計」列と合わなかった月。
   * MF側の丸めや、こちらが拾えなかった列があると起きる。
   */
  totalMismatchMonths: string[];
}

/** 「預金・現金（円）」→「預金・現金」。全角と半角のどちらの括弧でも落とす */
export const assetCategoryName = (header: string): string =>
  header
    .trim()
    .replace(/[（(]\s*円\s*[）)]\s*$/, '')
    .trim();

/**
 * 資産推移CSVかどうか。
 * 先頭列が「日付」で、「合計」の列を持つものだけを受ける。
 *
 * MFの入出金明細にも「日付」列はあるので、日付だけでは足りない。
 * 「合計」は資産推移にしか出ない列なので、これを鍵にする。
 */
export function isMfAssetHistoryHeader(header: string[]): boolean {
  const h = header.map((c) => c.trim());
  if (!h.length || !h[0].includes('日付')) return false;
  return h.some((c) => assetCategoryName(c) === '合計');
}

/**
 * 同じ月に複数の日付があるとき、どの1行を残すか。
 *
 * 残すのは「その月でいちばん新しい日付」。
 * 月末が入っていればそれが選ばれ、まだ終わっていない月では取得日が選ばれる。
 * 選んだ日付は date に残すので、画面で「8月は28日時点」と断れる。
 */
function pickLatestPerMonth(dated: ReadonlyArray<{ month: string; date: string; cells: string[] }>): {
  picked: Map<string, { date: string; cells: string[] }>;
  collapsed: number;
} {
  const picked = new Map<string, { date: string; cells: string[] }>();
  let collapsed = 0;
  for (const row of dated) {
    const prev = picked.get(row.month);
    if (!prev) {
      picked.set(row.month, { date: row.date, cells: row.cells });
      continue;
    }
    collapsed++;
    // 文字列比較で足りる。YYYY-MM-DD は辞書順と日付順が一致する
    if (row.date > prev.date) picked.set(row.month, { date: row.date, cells: row.cells });
  }
  return { picked, collapsed };
}

export function parseMfAssetHistoryRows(rows: string[][]): MfAssetParseResult {
  const header = (rows[0] ?? []).map((c) => c.trim());
  const dateIdx = header.findIndex((c) => c.includes('日付'));
  const totalIdx = header.findIndex((c) => assetCategoryName(c) === '合計');
  /** 保存対象の列。日付と合計を除いた、「（円）」付きの列すべて */
  const categoryCols = header
    .map((c, i) => ({ name: assetCategoryName(c), i }))
    .filter(({ name, i }) => i !== dateIdx && i !== totalIdx && name !== '');

  const dated: { month: string; date: string; cells: string[] }[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const raw = String(r[dateIdx] ?? '');
    const month = normMonth(raw);
    const date = normDate(raw);
    if (!month || !date) {
      skipped++;
      continue;
    }
    dated.push({ month, date, cells: r.map((c) => String(c ?? '')) });
  }

  const { picked, collapsed } = pickLatestPerMonth(dated);

  const balances: BalanceRow[] = [];
  const totalMismatchMonths: string[] = [];
  for (const [month, { date, cells }] of [...picked.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let sum = 0;
    for (const { name, i } of categoryCols) {
      const amount = parseAmount(cells[i]);
      sum += amount;
      // 0円の種類も残す。「持っていない」と「取り込めていない」を画面で区別するため
      balances.push({ month, date, side: 'asset', category: name, amount, source: 'mf' });
    }
    if (totalIdx >= 0 && parseAmount(cells[totalIdx]) !== sum) totalMismatchMonths.push(month);
  }

  return {
    balances,
    months: [...picked.keys()].sort(),
    rows: dated.length,
    skipped,
    collapsed,
    categories: categoryCols.map(({ name }) => name),
    totalMismatchMonths,
  };
}
