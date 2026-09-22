/**
 * 現金入力の下書き (spec-cash-screen FR-8)。
 *
 * 読み書きの規則は core の saveCashDraft / loadCashDraft にある。ここはログアウト時に
 * 端末に残った全利用者分の下書きを消すことだけを受け持つ (共用端末で次の人に見せない)。
 */
import { CASH_DRAFT_KEY_PREFIX } from './view-model.js';

export function clearAllCashDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(CASH_DRAFT_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // 消せなくても画面は止めない。下書きは次の保存で上書きされる
  }
}
