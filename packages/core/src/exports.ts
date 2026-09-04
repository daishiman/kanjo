/**
 * 書き出し(FR-05)の純関数。
 *
 * 既存の export は matrix.csv(科目×月の集計)だけで、明細1件ずつを外に出す口が無い。
 * 集計だけだと「この金額はどの明細から来たのか」を表計算側で追えず、
 * 税理士への受け渡しや、取込結果の目視突合ができない。ここは明細の粒度で出す。
 *
 * 出す列は「取込値そのもの」ではなく「解決後の値と、その根拠」。
 * 根拠(clsSrc/catSrc/ownerSrc)を落とすと、書き出したCSVを見ても
 * 手で直した行とルールで付いた行の区別がつかなくなる。
 */
import { PAYMENT_METHOD_LABEL, paymentMethodOf } from './cash.js';
import { resolveTx } from './classify.js';
import { OWNER_LABEL } from './types.js';
import type { Dataset } from './types.js';

/** 明細CSVの列見出し。順序がそのまま出力の列順になる */
export const TRANSACTION_EXPORT_HEADER = [
  '月',
  '日付',
  '内容',
  '口座',
  '支払手段',
  '大項目',
  '中項目',
  '科目の根拠',
  '金額',
  '公私',
  '公私の根拠',
  '名義',
  '名義の根拠',
  '明細ID',
  'ID安定',
] as const;

/** 1明細=1行。値はすべて文字列か数値で、CSV側で整形しない */
export type TransactionExportRow = (string | number)[];

/**
 * 全明細を解決後の値で1行ずつ並べる。並びは 日付昇順 → 明細ID昇順(同日の順序を固定する)。
 * 集計(matrix.csv)と違い、振替除外や科目まとめを一切かけない生の明細を出す。
 */
export function transactionExportRows(data: Dataset): TransactionExportRow[] {
  const sorted = [...data.mfTx].sort((a, b) => {
    const k = `${a.m}${a.d}`.localeCompare(`${b.m}${b.d}`);
    return k !== 0 ? k : a.id.localeCompare(b.id);
  });
  return sorted.map((t) => {
    const r = resolveTx(t, data.rules, data.edits, data.institutionOwners);
    return [
      t.m,
      t.d,
      t.c,
      // 口座は振替後の値を出す。支払手段も同じ口座から導かないと、書き出しの中で食い違う
      r.inst ?? '',
      PAYMENT_METHOD_LABEL[paymentMethodOf({ id: t.id, inst: r.inst })],
      r.big,
      r.mid,
      r.catSrc,
      t.a,
      r.cls === 'biz' ? '事業' : '個人',
      r.clsSrc,
      r.owner ? OWNER_LABEL[r.owner] : OWNER_LABEL.unset,
      r.ownerSrc,
      t.id,
      t.idStable ? '1' : '0',
    ];
  });
}

/**
 * 行列をCSV本文にする。Excelで開く前提なので改行はCRLF、BOMは呼び出し側で付ける。
 * 数値はカンマ区切りにしない(表計算側で数値として読ませるため)。
 */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  const esc = (v: string | number): string => {
    const t = String(v);
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
