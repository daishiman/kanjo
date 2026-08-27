/**
 * Parser・fingerprint・D1 commitが共有するcanonical保存行。
 * user/import provenanceは内容同値性に含めず、DBへ永続化する業務値だけを射影する。
 */
import type { FreeeDeal, MfTx } from './types.js';

export type FreeePersistedRow = readonly [
  month: string,
  date: string,
  io: FreeeDeal['io'],
  partner: string,
  accountRaw: string,
  accountNorm: string,
  amount: number,
];

export type MfPersistedRow = readonly [
  txId: string,
  month: string,
  date: string,
  description: string,
  amount: number,
  categoryMajor: string,
  categoryMid: string,
  institution: string | null,
];

/** 添付の同一性判定を含むD1保存行。指紋とcommitで共有する。 */
export type MfPersistedIdentityRow = readonly [...MfPersistedRow, identityStable: 0 | 1];

/** slash/hyphen双方を一度ここでMM/DDへ正規化する。 */
export function normalizeMfDisplayDate(raw: string, month: string): string {
  const normalized = raw.trim().replaceAll('-', '/');
  const parts = normalized.split('/').filter(Boolean);
  const day = parts.at(-1);
  const monthPart = parts.length >= 2 ? parts.at(-2) : month.slice(5);
  const validMonth = /^\d{1,2}$/.test(monthPart ?? '') ? String(monthPart).padStart(2, '0') : month.slice(5);
  const validDay = /^\d{1,2}$/.test(day ?? '') ? String(day).padStart(2, '0') : '01';
  return `${validMonth}/${validDay}`;
}

export const freeePersistedRow = (deal: FreeeDeal): FreeePersistedRow => [
  deal.month,
  deal.date,
  deal.io,
  deal.partner,
  deal.accountRaw,
  deal.accountNorm,
  deal.amount,
];

export const mfPersistedRow = (tx: MfTx): MfPersistedRow => [
  tx.id,
  tx.m,
  `${tx.m}-${normalizeMfDisplayDate(tx.d, tx.m).slice(-2)}`,
  tx.c,
  tx.a,
  tx.big,
  tx.mid,
  tx.inst ?? null,
];

export const mfPersistedIdentityRow = (tx: MfTx): MfPersistedIdentityRow => [
  ...mfPersistedRow(tx),
  tx.idStable === true ? 1 : 0,
];

/** DBのUNIQUE(user_id,tx_id)と同じlast-write-wins。 */
export function canonicalMfTransactions(txs: readonly MfTx[]): MfTx[] {
  const byId = new Map<string, MfTx>();
  for (const tx of txs) byId.set(tx.id, { ...tx, d: normalizeMfDisplayDate(tx.d, tx.m) });
  return [...byId.values()];
}
