/**
 * 名義の表示名。
 *
 * 内部値 (`business` / `spouse` / `family` / `unset`) は保存・集計の鍵で、利用者に見せる語ではない。
 * 見せる語は利用者ごとに変えられる (owner_labels 表)。画面・CSV・グラフはすべて `ownerLabel()`
 * 1 か所から名義を引く。表示名の写し表を画面ごとに持つと、保存した表示名が一部の画面にしか
 * 反映されない。
 */
import { OWNER_VALUES, type OwnerKey } from './types.js';

/** 表示名を持つ名義の並び。画面の行順・ダイアログの行順もこの順 */
export const OWNER_LABEL_KEYS: readonly OwnerKey[] = [...OWNER_VALUES, 'unset'];

export type OwnerLabels = Record<OwnerKey, string>;

/** 保存値が無い名義の表示名 (spec §6.4) */
export const DEFAULT_OWNER_LABELS: Readonly<OwnerLabels> = Object.freeze({
  business: '本人',
  spouse: 'パートナー',
  family: '子ども',
  unset: 'その他',
});

/** 表示名の長さの上限 (前後の空白を除いたコードポイント数) */
export const OWNER_LABEL_MAX = 20;

/** 保存値 (部分でもよい) と既定を合わせた 4 名義ぶんの表示名 */
export function resolveOwnerLabels(saved?: Partial<Record<OwnerKey, string>> | null): OwnerLabels {
  const out = { ...DEFAULT_OWNER_LABELS };
  for (const key of OWNER_LABEL_KEYS) {
    const value = saved?.[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value.trim();
  }
  return out;
}

/** 名義 1 つの表示名。null / undefined は未設定 (`unset`) として扱う */
export function ownerLabel(
  owner: OwnerKey | null | undefined,
  saved?: Partial<Record<OwnerKey, string>> | null,
): string {
  return resolveOwnerLabels(saved)[owner ?? 'unset'];
}

// 制御文字 U+0000–U+001F と U+007F。表示名に入ると表の行や CSV の列が崩れる
// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字そのものを検出するための式
const CONTROL_CHAR = /[\u0000-\u001F\u007F]/u;

export type OwnerLabelError = 'required' | 'too_long' | 'control_char' | 'duplicate';

export type OwnerLabelsValidation =
  | { ok: true; labels: OwnerLabels }
  | { ok: false; fields: Partial<Record<OwnerKey, OwnerLabelError>> };

/**
 * 保存前の表示名の検査 (spec §6.3)。画面のダイアログとサーバが同じ関数を呼ぶ。
 *
 * - 前後の空白を除いて 1〜20 文字 (コードポイント数。絵文字 1 つは 1 文字)
 * - 制御文字を含まない (前後の空白を除く前の文字列で調べる。改行を trim で落として通さない)
 * - 4 つが互いに異なる (同じ語が 2 つあると名義別の表で行が区別できない)
 *
 * 4 キーの揃い・未知キーの拒否は API の zod が受け持つ。ここは値の規則だけを見る。
 */
export function validateOwnerLabels(input: Record<OwnerKey, string>): OwnerLabelsValidation {
  const fields: Partial<Record<OwnerKey, OwnerLabelError>> = {};
  const labels = {} as OwnerLabels;
  for (const key of OWNER_LABEL_KEYS) {
    const raw = input[key] ?? '';
    const value = raw.trim();
    labels[key] = value;
    if (CONTROL_CHAR.test(raw)) fields[key] = 'control_char';
    else if (value === '') fields[key] = 'required';
    else if ([...value].length > OWNER_LABEL_MAX) fields[key] = 'too_long';
  }
  // 重複は個別の規則を満たした値どうしで見る。空欄どうしを「重複」と二重に叱らない
  const seen = new Map<string, OwnerKey>();
  for (const key of OWNER_LABEL_KEYS) {
    if (fields[key]) continue;
    const first = seen.get(labels[key]);
    if (first) {
      fields[first] ??= 'duplicate';
      fields[key] = 'duplicate';
    } else seen.set(labels[key], key);
  }
  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, labels };
}
