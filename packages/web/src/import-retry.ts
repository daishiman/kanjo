/**
 * 取込に失敗したファイルを、選び直さずにもう一度取込枠へ戻すための対応づけ。
 *
 * 取込結果は「投入したファイル」ではなく「解析できた単位」ごとに返る。ZIP を投げると
 * `家計.zip/07月.csv` のような名前で中身ごとに1行ずつ出るため、失敗行から元のファイルへ
 * 戻すには先頭のファイル名だけを見る必要がある。
 */
import type { ImportUnitResult } from './api.js';

/** 取込単位の名前から、投入した元ファイルの名前を取り出す(ZIP の中身は `zip名/中身名`) */
export const rootFileName = (unitFilename: string): string => unitFilename.split('/')[0] ?? unitFilename;

/**
 * 失敗した取込単位に対応する元ファイルを、投入した順で重複なく返す。
 *
 * 1つの ZIP から複数の失敗が出ても元ファイルは1つ。逆に、元ファイルが手元から消えている
 * (ページを開き直した後など)場合は戻せないので、その分は黙って落とす。呼び出し側は
 * 戻せる分が 0 件ならボタンを出さない。
 */
export function retryableFiles(results: ImportUnitResult[], submitted: File[]): File[] {
  const failed = new Set(results.filter((r) => r.status === 'failed').map((r) => rootFileName(r.filename)));
  if (failed.size === 0) return [];
  const picked = new Set<string>();
  const out: File[] = [];
  for (const file of submitted) {
    if (!failed.has(file.name) || picked.has(file.name)) continue;
    picked.add(file.name);
    out.push(file);
  }
  return out;
}

/** 取込単位1件に対応する元ファイル。手元に無ければ null(ボタンを出さない) */
export function fileForUnit(unit: ImportUnitResult, submitted: File[]): File | null {
  const name = rootFileName(unit.filename);
  return submitted.find((f) => f.name === name) ?? null;
}
