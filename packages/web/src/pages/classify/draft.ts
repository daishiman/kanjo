/**
 * 編集の下書き (spec-classify-screen 7.11)。
 *
 * 保存先は端末の localStorage だけで、サーバへは送らない。
 * 読み書きは必ず try/catch で包む。プライベートモードや容量超過で例外が出ても、
 * 下書きが使えないだけで画面そのものは動き続けるべきだから。
 */
import type { EditInput } from './view-model.js';

const PREFIX = 'kanjo:classify:draft:';
/** これより古い下書きは読み込み時に捨てる */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface Draft {
  txId: string;
  input: EditInput;
  savedAt: number;
}

const keyOf = (txId: string) => `${PREFIX}${txId}`;

export function loadDraft(txId: string, now = Date.now()): Draft | null {
  try {
    const raw = localStorage.getItem(keyOf(txId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Draft;
    if (!v || typeof v.savedAt !== 'number' || !v.input) return null;
    // 30 日を過ぎた下書きは、消したうえで「無い」として返す
    if (now - v.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(keyOf(txId));
      return null;
    }
    return { txId, input: v.input, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function saveDraft(txId: string, input: EditInput, now = Date.now()): Draft | null {
  const draft: Draft = { txId, input, savedAt: now };
  try {
    localStorage.setItem(keyOf(txId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(txId: string): void {
  try {
    localStorage.removeItem(keyOf(txId));
  } catch {
    // 消せなくても保存は済んでいる。次の読込で 30 日の期限が拾う
  }
}
