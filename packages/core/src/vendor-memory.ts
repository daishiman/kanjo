/**
 * 取引先単位の決め事(vendor_memory)と、その確信度。
 *
 * 同じ取引先へ何度も同じ手当てをしているなら、次からは黙って当ててよい。
 * ただし「何度も」を機械が勝手に決めると、2回目で勝手に当てはじめて外し続ける。
 * そこで確信度を2つの数から作り、閾値を超えるまでは候補として出すだけにする。
 */
import type { Cls, Owner } from './types.js';

/**
 * 自動適用の条件(D01)。
 *
 * 一致率だけでは分母の小ささを吸収できない。1件中1件は 1.00 だが、
 * それは「1回やった」だけである。最小件数と一致率の両方を課すのはそのため。
 */
export const VENDOR_MEMORY_MIN_HITS = 3;
export const VENDOR_MEMORY_MIN_CONFIDENCE = 0.8;

export interface VendorMemoryCounts {
  /** その決め事のとおりに手当てした回数 */
  hitCount: number;
  /** その決め事と違う手当てをした・自動適用を取り消した回数 */
  disagreeCount: number;
}

/**
 * 確信度 = 一致回数 / (一致回数 + 不一致回数)。
 * 母数が0のときは0を返す。「まだ何も分かっていない」を1.0と読ませない。
 */
export function vendorConfidence({ hitCount, disagreeCount }: VendorMemoryCounts): number {
  const total = hitCount + disagreeCount;
  return total === 0 ? 0 : hitCount / total;
}

export interface VendorMemoryRecord extends VendorMemoryCounts {
  vendorKey: string;
  vendorLabel?: string;
  cls?: Cls | null;
  big?: string | null;
  mid?: string | null;
  owner?: Owner | null;
  /** 利用者が明示的に留めた決め事。確信度によらず適用する。 */
  pinned?: boolean;
  /** 利用者が取り消した決め事。以後は適用も候補提示もしない。 */
  revoked?: boolean;
}

/** 決め事の扱い。3つ以外を作らない。 */
export type VendorMemoryDisposition =
  /** 自動で当てる */
  | 'auto-apply'
  /** 候補として見せ、当てるかは利用者が決める */
  | 'suggest'
  /** 出さない */
  | 'inactive';

export interface VendorMemoryJudgement {
  disposition: VendorMemoryDisposition;
  confidence: number;
  /** 画面へそのまま出す説明。割合ではなく件数で示す(qa-014)。 */
  reason: string;
}

/**
 * 決め事1件の扱いを決める。
 *
 * 取り消された決め事を先に落とす。pinned より先に見るのは、利用者が「もう使うな」と
 * 言ったものを pinned が復活させないため。
 */
export function judgeVendorMemory(record: VendorMemoryRecord): VendorMemoryJudgement {
  const confidence = vendorConfidence(record);
  const total = record.hitCount + record.disagreeCount;
  const 件数表記 = `過去 ${total} 件中 ${record.hitCount} 件で同じ手当て`;

  if (record.revoked) return { disposition: 'inactive', confidence, reason: '取り消し済みの決め事' };
  if (record.pinned)
    return { disposition: 'auto-apply', confidence, reason: `${件数表記}（留めているため常に適用）` };
  if (record.hitCount < VENDOR_MEMORY_MIN_HITS)
    return {
      disposition: 'suggest',
      confidence,
      reason: `${件数表記}。自動で当てるには ${VENDOR_MEMORY_MIN_HITS} 件以上が要る`,
    };
  if (confidence < VENDOR_MEMORY_MIN_CONFIDENCE)
    return {
      disposition: 'suggest',
      confidence,
      reason: `${件数表記}。食い違いがあるため自動では当てない`,
    };
  return { disposition: 'auto-apply', confidence, reason: 件数表記 };
}

/** 取引先名の正規化。表記ゆれで別の決め事にならないようにする。 */
export function normalizeVendorKey(raw: string): string {
  return (
    raw
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[\s　]+/g, '')
      // 決済代行が付ける連番・日付の接尾は取引先の同一性に関係しない
      .replace(/[0-9]{4,}$/, '')
      .trim()
  );
}

/** 手当ての結果を決め事へ反映する。一致なら hit、食い違いなら disagree を増やす。 */
export function recordVendorOutcome(
  record: VendorMemoryCounts,
  outcome: 'agree' | 'disagree',
): VendorMemoryCounts {
  return outcome === 'agree'
    ? { hitCount: record.hitCount + 1, disagreeCount: record.disagreeCount }
    : { hitCount: record.hitCount, disagreeCount: record.disagreeCount + 1 };
}
