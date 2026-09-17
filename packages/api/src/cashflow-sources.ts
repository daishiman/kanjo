import type { DuplicateVerdict, FreeeDeal, FreeeExclusion, MfExclusion, MfTx } from '@kanjo/core';
import { eq } from 'drizzle-orm';
import * as s from './db/schema.js';
import { bindDuplicateVerdicts, bindMfExclusions } from './routes/duplicate-verdict-bindings.js';
import { type Db, dealFromRow } from './store.js';

/**
 * freee と MF の消し込み・除外判定に必要な読み取りソース。
 *
 * 4 表のテナント分離、DB 行の core 型への変換、現在の MF 明細への
 * stable key 再結合はこの境界だけで行う。呼び出し側は集計に必要な形
 * (MF 除外の行、または txId の集合) に変えるだけにする。
 */
export interface CashflowSources {
  deals: FreeeDeal[];
  verdicts: DuplicateVerdict[];
  freeeExclusions: FreeeExclusion[];
  mfExclusions: MfExclusion[];
}

/** userId を必須にし、4 表が別テナントの行を読む経路を作らない。 */
export async function loadCashflowSources(
  db: Db,
  userId: string,
  mfTx: readonly MfTx[],
): Promise<CashflowSources> {
  const [dealRows, verdictRows, exclusionRows, mfExclusionRows] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
    db.select().from(s.mfTxExclusions).where(eq(s.mfTxExclusions.userId, userId)),
  ]);

  return {
    deals: dealRows.map(dealFromRow),
    verdicts: bindDuplicateVerdicts(verdictRows, mfTx),
    freeeExclusions: exclusionRows.map((row) => ({
      freeeKey: row.freeeKey,
      reason: row.reason,
      reasonCode: row.reasonCode ?? undefined,
      memo: row.memo ?? undefined,
    })),
    mfExclusions: bindMfExclusions(mfExclusionRows, mfTx),
  };
}
