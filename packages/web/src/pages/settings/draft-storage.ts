/**
 * 設定の下書きのキーと、ログアウト時の一括消去。
 *
 * 共通シェル (Layout) から呼ぶので初期 JS に入る。core の検証などを連れてこないよう、
 * 依存を持たないこのモジュールに分けている (下書きの読み書きは draft.ts)。
 */
export const SETTINGS_DRAFT_PREFIX = 'kanjo:settings:draft:';

export const settingsDraftKey = (userId: string): string => `${SETTINGS_DRAFT_PREFIX}${userId}`;

/** ログアウト時に全利用者の設定の下書きを消す */
export function clearAllSettingsDrafts(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(SETTINGS_DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // localStorage が使えない環境では下書き自体が無い
  }
}
