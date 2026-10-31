/**
 * 集計ルール(設定画面)。種別 account(勘定科目) と vendor(取引先) を 1 つの一覧で持つ。
 *
 * - account: 取込時に freee の勘定科目を正規化する。既存 normalizeAccount と同じく元の表記の完全一致。
 * - vendor: 集計時に明細の内容から家計の大項目を決める。照合キーは NFKC → toLowerCase → trim。
 *
 * どちらも有効な行を並び順に見て、最初に当たった行が効く(BR-04・BR-07)。
 */

export type NormRuleKind = 'account' | 'vendor';

export interface NormRule {
  ruleId: string;
  kind: NormRuleKind;
  raw: string;
  norm: string;
  /** 1 始まり */
  order: number;
  enabled: boolean;
}

export const NORM_RULE_KINDS: readonly NormRuleKind[] = ['account', 'vendor'];
export const NORM_RULES_MAX = 500;
export const NORM_RULE_TEXT_MAX = 60;
/**
 * 画面で作る行は 1〜64 字 (BR-02)。migration 0051 で写した行の id は 'm-' + raw の UTF-8 の16進で、
 * 日本語 11 字を超える raw では 64 字を超える (raw は最長 60 字 = 180 バイト)。写した行も保存できるよう別に受ける。
 */
export const NORM_RULE_ID_PATTERN = /^(?:[A-Za-z0-9_-]{1,64}|m-(?:[0-9a-f]{2}){1,180})$/;

/** 集計ルール(取引先)で決まった明細のカテゴリの由来(BR-08) */
export const NORM_RULE_CAT_SRC = '集計ルール';

/** 取引先ルールの照合キー。NFKC → 大文字小文字の畳み込み → 前後空白除去 */
export function vendorMatchKey(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim();
}

const byOrder = (a: NormRule, b: NormRule): number => a.order - b.order;

/**
 * 有効な勘定科目行 → 既存 normalizeAccount の map。
 * 同じ元の表記の行が複数あるときは並び順の最初の行を使う。
 */
export function accountNormMap(rules: readonly NormRule[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rule of [...rules].sort(byOrder)) {
    if (rule.kind !== 'account' || !rule.enabled) continue;
    if (!Object.prototype.hasOwnProperty.call(map, rule.raw)) map[rule.raw] = rule.norm;
  }
  return map;
}

/** 有効な取引先ルールを並び順に見て、最初に照合キーが一致した行を返す */
export function resolveVendorRule(content: string, rules: readonly NormRule[]): NormRule | null {
  const key = vendorMatchKey(content);
  if (!key) return null;
  let hit: NormRule | null = null;
  for (const rule of rules) {
    if (rule.kind !== 'vendor' || !rule.enabled) continue;
    if (vendorMatchKey(rule.raw) !== key) continue;
    if (!hit || rule.order < hit.order) hit = rule;
  }
  return hit;
}

/**
 * 同じ種別・同じ照合キーで、上に優先される行がある行の id(BR-10 の注記用)。
 * 勘定科目は完全一致、取引先は照合キーで比べる。
 */
export function shadowedNormRules(rules: readonly NormRule[]): Record<string, string> {
  const first = new Map<string, NormRule>();
  const shadowed: Record<string, string> = {};
  for (const rule of [...rules].sort(byOrder)) {
    if (!rule.enabled) continue;
    const key = `${rule.kind}|${rule.kind === 'vendor' ? vendorMatchKey(rule.raw) : rule.raw}`;
    const top = first.get(key);
    if (top) shadowed[rule.ruleId] = top.ruleId;
    else first.set(key, rule);
  }
  return shadowed;
}
