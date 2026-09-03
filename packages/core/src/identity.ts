/**
 * 再取込を跨いだ明細の同一性解決(DR-13)と、属性値の出どころの優先順位(DR-12)。
 *
 * 同一性は2段で解く。第一は `tx_id`、第二は `stable_key`。
 * 第二が要るのは、MFが再出力のたびにID列を振り直すことがあるためで、
 * そのとき `tx_id` だけを見ていると、手当てを付けた明細が「消えて新しく現れた」ように見える。
 */
import { STABLE_KEY_VERSION, type StableKeyParts, stableKeyOf } from './fingerprint.js';
import { normalizeMfDisplayDate } from './persisted-projection.js';
import type { MfTx, TxEdit } from './types.js';

/** 明細から stable_key を作る。日付の正規化は保存経路と同じ関数を通す(複製しない)。 */
export const mfStableKey = (tx: Pick<MfTx, 'm' | 'd' | 'c' | 'a' | 'inst'>): string =>
  stableKeyOf({
    m: tx.m,
    d: normalizeMfDisplayDate(tx.d, tx.m),
    c: tx.c,
    a: tx.a,
    inst: tx.inst ?? null,
  } satisfies StableKeyParts);

/** どちらの鍵で結び付いたか。移行や不具合調査でここを見る。 */
export type IdentityMatch = 'tx-id' | 'stable-key' | 'none';

export interface IdentityResolution {
  match: IdentityMatch;
  edit: TxEdit | null;
  /** 結び付いた保存側の tx_id。`tx-id` 一致なら明細と同じ、`stable-key` 一致なら旧ID。 */
  matchedTxId: string | null;
}

/**
 * 明細1件に対応する保存済みの手当てを引く。
 *
 * `tx_id` を先に見る。見つからないときだけ `stable_key` へ落ちる。順序を逆にすると、
 * 同一性の弱い鍵が強い鍵を上書きしうる。版の違う `stable_key` とは突き合わせない。
 */
export function resolveIdentity(
  tx: Pick<MfTx, 'id' | 'm' | 'd' | 'c' | 'a' | 'inst'>,
  editsByTxId: Readonly<Record<string, TxEdit>>,
  editsByStableKey: Readonly<Record<string, { txId: string; edit: TxEdit }>> = {},
): IdentityResolution {
  const byId = editsByTxId[tx.id];
  if (byId) return { match: 'tx-id', edit: byId, matchedTxId: tx.id };

  const hit = editsByStableKey[mfStableKey(tx)];
  // 版が違う鍵は別物として扱う。作り方が変わっている以上、同じ文字列でも同じ取引とは限らない。
  if (hit && (hit.edit.fingerprintVersion ?? STABLE_KEY_VERSION) === STABLE_KEY_VERSION)
    return { match: 'stable-key', edit: hit.edit, matchedTxId: hit.txId };

  return { match: 'none', edit: null, matchedTxId: null };
}

/** 保存済みの手当てを stable_key で引ける形へ畳む。鍵が重複した場合は結び付けない(誤爆を選ばない)。 */
export function indexEditsByStableKey(
  rows: ReadonlyArray<{ txId: string; edit: TxEdit; parts: Pick<MfTx, 'm' | 'd' | 'c' | 'a' | 'inst'> }>,
): Record<string, { txId: string; edit: TxEdit }> {
  const out: Record<string, { txId: string; edit: TxEdit }> = {};
  const collided = new Set<string>();
  for (const row of rows) {
    const key = row.edit.stableKey ?? mfStableKey(row.parts);
    if (key in out) collided.add(key);
    out[key] = { txId: row.txId, edit: row.edit };
  }
  // 衝突した鍵は、どちらの手当ての持ち主か決められない。黙って片方を選ぶより結び付けない方が安全。
  for (const key of collided) delete out[key];
  return out;
}
