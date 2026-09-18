/**
 * マトリックスの表から導く値（仕様 §9.1 の派生値）。
 *
 * 合計・平均・濃淡の分母・偏りが大きい3点は、どれも**同じ「未記帳月を除く」規約**（§9.3）の上に
 * 立っている。規約が散ると、画面と CSV と API で同じ表から違う数字が出る。ここが規約の 1 か所目
 * であり、`recordedIndexes` を通らない集計をこのファイルの外に作らない。
 *
 * 偏りの定義は `analysis.ts` の `zScores` だけを使う。同じ表を行方向に見れば行内偏り、
 * 列方向に見れば月内偏りになるので、軸ごとに別の式を書く必要は無い。
 */
import { zScores } from './analysis.js';
import { mean, sum } from './stats.js';

/**
 * 記帳済み月の位置（§9.3: 未記帳月は合計・平均・比率・濃淡から除く）。
 *
 * 未記帳は「使わなかった」ではなく「まだ記録していない」なので 0 として数えない。
 * 0 を混ぜると平均が下がり標準偏差が上がり、記帳済みの月がどれも平均より上に見える。
 */
export function recordedIndexes(months: readonly string[], unrecordedMonths: readonly string[]): number[] {
  const unrecorded = new Set(unrecordedMonths);
  return months.flatMap((m, i) => (unrecorded.has(m) ? [] : [i]));
}

export interface MatrixSummary {
  total: number;
  /** 未記帳月を除いた月数で割る（§9.3）。対象が 0 件なら 0。 */
  average: number;
}

/** 1 行の期間合計と平均（§3.2 の `合計` 列・`平均` 列）。 */
export function matrixRowSummary(series: readonly number[], recorded: readonly number[]): MatrixSummary {
  const values = recorded.map((i) => series[i] ?? 0);
  return { total: sum(values), average: values.length > 0 ? mean(values) : 0 };
}

/** 1 列（1 か月）の合計と平均（§3.2 の `合計` 行・`平均` 行）。行は本体行だけを渡す。 */
export function matrixColumnSummary(
  rows: readonly { series: readonly number[] }[],
  monthIndex: number,
): MatrixSummary {
  const values = rows.map((r) => r.series[monthIndex] ?? 0);
  return { total: sum(values), average: values.length > 0 ? mean(values) : 0 };
}

/**
 * 濃淡の分母を取る対象（§3.3）。本体行 × 記帳済み月のセルだけを 1 本に並べる。
 *
 * 合計行・平均行・合計列・平均列を外すのはこの関数の役目である。`heatScaleOf` は
 * 渡された値の min/max を取るだけで、どの行が合計かを知らない。
 */
export function matrixBodyValues(
  rows: readonly { series: readonly number[] }[],
  recorded: readonly number[],
): number[] {
  return rows.flatMap((r) => recorded.map((i) => r.series[i] ?? 0));
}

export interface MatrixSkewRow {
  key: string;
  label: string;
  /** `months` と同じ長さ。合計行・平均行はここに入れない（呼び出し側で除く）。 */
  series: readonly number[];
}

export interface MatrixSkewInput {
  months: readonly string[];
  unrecordedMonths: readonly string[];
  rows: readonly MatrixSkewRow[];
  /**
   * 表示期間の外にある実データ（`YYYY-MM` → 行キー → 金額）。
   * 前年同月比は表示期間外でも実データがあれば参照する（§9.3）ため、窓の外を渡せる口を持つ。
   */
  outside?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface MatrixSkewPoint {
  rank: number;
  rowKey: string;
  rowLabel: string;
  month: string;
  amount: number;
  /** `max(月内偏り, 行内偏り) + max(0, 前月比)`。順位の根拠を表示側が再計算しないで済むよう返す。 */
  score: number;
  momRate: number | null;
  yoyRate: number | null;
}

/** 選定の途中で持つ値。`rowIndex` は同点判定の「行の固定順」に使う。 */
interface Candidate extends MatrixSkewPoint {
  rowIndex: number;
  monthIndex: number;
}

/** 前年同月の `YYYY-MM`。 */
function prevYearMonth(month: string): string {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
}

/**
 * 同点の決着（§5.1 の規則4）。`sort` の比較関数としてそのまま使う。
 * 負を返せば a が先（上位）。
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.score !== b.score) return b.score - a.score;
  // 金額は降順（大きいほうが先）
  if (a.amount !== b.amount) return b.amount - a.amount;
  // 月は新しいほうが先。monthIndex が大きいほど新しい
  if (a.monthIndex !== b.monthIndex) return b.monthIndex - a.monthIndex;
  // 行は仕様の固定順（仕入高 → … → その他）。rowIndex が小さいほうが先
  return a.rowIndex - b.rowIndex;
}

export function matrixSkewTop(input: MatrixSkewInput, limit = 3): MatrixSkewPoint[] {
  const { months, rows } = input;
  const unrecorded = new Set(input.unrecordedMonths);
  const recorded = recordedIndexes(months, input.unrecordedMonths);
  if (recorded.length === 0 || rows.length === 0) return [];

  // 行内偏り: その行の記帳済み月だけを 1 本の系列として見る
  const rowZ = rows.map((row) => {
    const z = zScores(recorded.map((i) => row.series[i] ?? 0));
    return new Map(recorded.map((i, k) => [i, z[k] ?? 0]));
  });

  // 月内偏り: その月の全行を 1 本の系列として見る
  const monthZ = new Map(
    recorded.map((i) => {
      const z = zScores(rows.map((row) => row.series[i] ?? 0));
      return [i, new Map(rows.map((row, r) => [row.key, z[r] ?? 0]))];
    }),
  );

  /** 前月比。直前の月が未記帳、または 0 のときは算出しない（既存 `Matrix.tsx` の規約と同じ）。 */
  const momOf = (row: MatrixSkewRow, i: number): number | null => {
    const prev = months[i - 1];
    if (i === 0 || prev === undefined || unrecorded.has(prev)) return null;
    const p = row.series[i - 1] ?? 0;
    return p > 0 ? (row.series[i] ?? 0) / p - 1 : null;
  };

  /** 前年同月比。表の中に前年同月があればそれを、無ければ窓の外の実データを見る。 */
  const yoyOf = (row: MatrixSkewRow, i: number): number | null => {
    const month = months[i] as string;
    const prevMonth = prevYearMonth(month);
    const inTable = months.indexOf(prevMonth);
    const base =
      inTable >= 0 && !unrecorded.has(prevMonth)
        ? (row.series[inTable] ?? 0)
        : (input.outside?.[prevMonth]?.[row.key] ?? 0);
    return base > 0 ? (row.series[i] ?? 0) / base - 1 : null;
  };

  const candidates: Candidate[] = [];
  for (const [r, row] of rows.entries()) {
    for (const i of recorded) {
      const month = months[i] as string;
      const amount = row.series[i] ?? 0;
      if (amount <= 0) continue;
      const skew = Math.max(rowZ[r]?.get(i) ?? 0, monthZ.get(i)?.get(row.key) ?? 0);
      const momRate = momOf(row, i);
      candidates.push({
        rank: 0,
        rowKey: row.key,
        rowLabel: row.label,
        month,
        amount,
        score: skew + Math.max(0, momRate ?? 0),
        momRate,
        yoyRate: yoyOf(row, i),
        rowIndex: r,
        monthIndex: i,
      });
    }
  }

  return candidates
    .sort(compareCandidates)
    .slice(0, Math.max(0, limit))
    .map(({ rowIndex: _r, monthIndex: _m, ...point }, k) => ({ ...point, rank: k + 1 }));
}
