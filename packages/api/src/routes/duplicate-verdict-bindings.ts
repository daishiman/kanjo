import { type DuplicateVerdict, type MfTx, STABLE_KEY_VERSION, mfStableKey } from '@kanjo/core';
import type * as s from '../db/schema.js';

type VerdictRow = typeof s.duplicateVerdicts.$inferSelect;

/**
 * 保存済みの重複判断を現在の明細へ結び付け直す共通境界。
 *
 * tx_id を優先し、無いときだけ現行版の stable_key へ落とす。弱い鍵が
 * 重複したときは判断を結び付けない。ハブと総収支の件数を必ず同じ定義に保つ。
 */
export function bindDuplicateVerdicts(
  rows: readonly VerdictRow[],
  mfTx: readonly MfTx[],
): DuplicateVerdict[] {
  const byTxId = new Map(rows.map((row) => [row.txId, row]));
  const byStableKey = new Map<string, VerdictRow | null>();
  for (const row of rows) {
    if (!row.stableKey) continue;
    if ((row.fingerprintVersion ?? STABLE_KEY_VERSION) !== STABLE_KEY_VERSION) continue;
    byStableKey.set(row.stableKey, byStableKey.has(row.stableKey) ? null : row);
  }

  const verdicts: DuplicateVerdict[] = [];
  for (const tx of mfTx) {
    const hit = byTxId.get(tx.id) ?? byStableKey.get(mfStableKey(tx)) ?? null;
    if (hit) verdicts.push({ txId: tx.id, verdict: hit.verdict, freeeKey: hit.freeeKey });
  }
  return verdicts;
}
