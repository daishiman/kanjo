/**
 * 設定画面(18-settings)の値の正本。
 *
 * 画面・API・夜間バックアップ・設定 JSON の復元が、保存済みの値と下書きの差分・検証・要約を
 * ここ 1 か所から取る。route や画面で数え直すと、未保存件数と保存時の変更履歴の行数、
 * 差分プレビューと実際の置き換えがずれる。
 */
import {
  CASH_OVERRIDE_AMOUNT_MAX,
  CASH_OVERRIDE_KINDS,
  CASH_OVERRIDE_MEMO_MAX,
  type CashOverrideKind,
  type CashOverrideRule,
} from './cash.js';
import {
  NORM_RULES_MAX,
  NORM_RULE_ID_PATTERN,
  NORM_RULE_KINDS,
  NORM_RULE_TEXT_MAX,
  type NormRule,
  type NormRuleKind,
  shadowedNormRules,
  vendorMatchKey,
} from './norm-rules.js';
import {
  DEFAULT_OWNER_LABELS,
  OWNER_LABEL_KEYS,
  type OwnerLabels,
  resolveOwnerLabels,
  validateOwnerLabels,
} from './owner-labels.js';
import { DEFAULT_STAT_MIN_MONTHS, STAT_MIN_MONTHS_MAX, STAT_MIN_MONTHS_MIN } from './stats.js';
import {
  TAX_ACCOUNT_MAP_ROWS_MAX,
  type TaxAccountMapRow,
  sortTaxAccountMap,
  taxAccountMapRowIssue,
} from './tax-accounts.js';
import type { OwnerKey } from './types.js';

/* -------- 型 -------- */

export interface SettingsState {
  normRules: NormRule[];
  ownerLabels: OwnerLabels;
  statMinMonths: number;
  cashOverrides: CashOverrideRule[];
  /** MF の大項目 → 勘定科目の対応表。大項目のコード単位順 (spec-classify-bulk-save FR-17) */
  taxAccountMap: TaxAccountMapRow[];
}

export interface DiffItem {
  key: string;
  kind?: string;
  raw?: string;
  before?: unknown;
  after?: unknown;
}

export interface DiffBucket {
  count: number;
  /** 最大 DIFF_ITEMS_MAX 件 */
  items: DiffItem[];
}

export interface SettingsDiff {
  normRules: { added: DiffBucket; changed: DiffBucket; removed: DiffBucket; reordered: DiffBucket };
  ownerLabels: { changed: Array<{ owner: OwnerKey; before: string; after: string }> };
  statMinMonths: { before: number; after: number } | null;
  cashOverrides: { added: DiffBucket; changed: DiffBucket; removed: DiffBucket };
  /** 大項目で突き合わせる。行の並びは値ではないので『並べ替え』は無い */
  taxAccountMap: { added: DiffBucket; changed: DiffBucket; removed: DiffBucket };
  /** 変更項目の合計。保存時に追記する変更履歴の行数と同じ(BR-19) */
  total: number;
}

export interface SettingsSummary {
  normRules: number;
  ownerLabelsSet: boolean;
  statMinMonths: number;
  cashOverrides: number;
  taxAccountMap: number;
}

export const DIFF_ITEMS_MAX = 50;

/** 変更履歴の更新者のうち、画面以外(復元・migration)の書込み(BR-20) */
export const SETTINGS_SYSTEM_ACTOR = 'system';
export const SETTINGS_SYSTEM_ACTOR_LABEL = 'システム';

/** 更新者の表示。'system' は『システム』 */
export const settingsActorLabel = (actor: string): string =>
  actor === SETTINGS_SYSTEM_ACTOR ? SETTINGS_SYSTEM_ACTOR_LABEL : actor;

/** 画面からの保存の更新者。メールアドレスのローカル部(BR-20) */
export function settingsActorFromEmail(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/* -------- 影響するもの(§7.5) -------- */

const COMMON_IMPACTS = [
  '収支のカテゴリ集計',
  '月次サマリー',
  'カテゴリ別の分析グラフ',
  'レポート出力（CSV・HTML）',
] as const;

export const SETTINGS_IMPACTS: Readonly<Record<NormRuleKind, readonly string[]>> = Object.freeze({
  vendor: [...COMMON_IMPACTS],
  account: [...COMMON_IMPACTS, '取込済みの明細の科目（保存時に集計し直します）'],
});

/* -------- 検証(BR-01〜BR-17) -------- */

export type NormRuleInput = Omit<NormRule, 'order'>;
export type CashOverrideInput = Omit<CashOverrideRule, 'overrideId'> & { overrideId?: string };

/** 保存の本文。送られた節だけを置き換える(変更の無い節は省く) */
export interface SettingsInput {
  normRules?: NormRuleInput[];
  ownerLabels?: Record<OwnerKey, string>;
  statMinMonths?: number;
  cashOverrides?: CashOverrideInput[];
  taxAccountMap?: TaxAccountMapRow[];
}

export type SettingsFieldError =
  | 'invalid_type'
  | 'too_many'
  | 'invalid_id'
  | 'duplicate_id'
  | 'invalid_kind'
  | 'required'
  | 'too_long'
  | 'control_char'
  | 'out_of_range'
  | 'invalid_scope'
  | 'invalid_month'
  | 'duplicate'
  | 'owner_label'
  /** 『カテゴリなし』は予約の値なので対応表の大項目にできない */
  | 'reserved'
  /** 勘定科目の一覧 (TAX_ACCOUNTS) に無い */
  | 'not_in_list';

export type SettingsValidation =
  | { ok: true; value: Partial<SettingsState> }
  | { ok: false; fields: Record<string, SettingsFieldError> };

// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字そのものを検出するための式
const CONTROL_CHAR = /[\u0000-\u001F\u007F]/u;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const codePoints = (s: string): number => [...s].length;

function checkText(raw: unknown, max: number, allowEmpty: boolean): SettingsFieldError | null {
  if (typeof raw !== 'string') return 'invalid_type';
  if (CONTROL_CHAR.test(raw)) return 'control_char';
  const value = raw.trim();
  if (!allowEmpty && value === '') return 'required';
  if (codePoints(value) > max) return 'too_long';
  return null;
}

/** 現金上書きの行の鍵。種別ごとに全期間 0〜1 行、同じ対象月に 0〜1 行(BR-15) */
export const cashOverrideKey = (r: Pick<CashOverrideRule, 'kind' | 'scope' | 'month'>): string =>
  `${r.kind}:${r.scope}:${r.month ?? 'all'}`;

/** 復元で振る現金上書きの行 id。(種別・範囲・月) は一意なので id も一意になる */
export const cashOverrideIdFor = (r: Pick<CashOverrideRule, 'kind' | 'scope' | 'month'>): string =>
  `o-${r.kind}-${r.month ?? 'all'}`;

/**
 * 保存・復元の値の検査。画面・API・設定 JSON の復元が同じ関数を呼ぶ。
 * 形(キーの揃い・未知キー)は呼び出し側(zod・validateSettingsJson)が見る。ここは値の規則。
 * 通れば前後の空白を除き、並び順(1 始まり)と現金上書きの id を振った値を返す。
 */
export function validateSettingsInput(input: SettingsInput): SettingsValidation {
  const fields: Record<string, SettingsFieldError> = {};
  const value: Partial<SettingsState> = {};

  if (input.normRules !== undefined) {
    const rules = input.normRules;
    if (!Array.isArray(rules)) fields.normRules = 'invalid_type';
    else if (rules.length > NORM_RULES_MAX) fields.normRules = 'too_many';
    else {
      const ids = new Set<string>();
      const out: NormRule[] = [];
      rules.forEach((r, i) => {
        const at = `normRules.${i}`;
        if (typeof r !== 'object' || r === null) {
          fields[at] = 'invalid_type';
          return;
        }
        if (typeof r.ruleId !== 'string' || !NORM_RULE_ID_PATTERN.test(r.ruleId))
          fields[`${at}.ruleId`] = 'invalid_id';
        else if (ids.has(r.ruleId)) fields[`${at}.ruleId`] = 'duplicate_id';
        else ids.add(r.ruleId);
        if (!NORM_RULE_KINDS.includes(r.kind)) fields[`${at}.kind`] = 'invalid_kind';
        const rawErr = checkText(r.raw, NORM_RULE_TEXT_MAX, false);
        if (rawErr) fields[`${at}.raw`] = rawErr;
        const normErr = checkText(r.norm, NORM_RULE_TEXT_MAX, false);
        if (normErr) fields[`${at}.norm`] = normErr;
        if (typeof r.enabled !== 'boolean') fields[`${at}.enabled`] = 'invalid_type';
        out.push({
          ruleId: String(r.ruleId),
          kind: r.kind,
          raw: String(r.raw ?? '').trim(),
          norm: String(r.norm ?? '').trim(),
          order: i + 1,
          enabled: r.enabled === true,
        });
      });
      value.normRules = out;
    }
  }

  if (input.ownerLabels !== undefined) {
    const labels = input.ownerLabels;
    if (typeof labels !== 'object' || labels === null) fields.ownerLabels = 'invalid_type';
    else if (OWNER_LABEL_KEYS.some((k) => typeof labels[k] !== 'string')) fields.ownerLabels = 'invalid_type';
    else {
      const v = validateOwnerLabels(labels);
      if (v.ok) value.ownerLabels = v.labels;
      else for (const key of Object.keys(v.fields)) fields[`ownerLabels.${key}`] = 'owner_label';
    }
  }

  if (input.statMinMonths !== undefined) {
    const n = input.statMinMonths;
    if (typeof n !== 'number' || !Number.isInteger(n)) fields.statMinMonths = 'invalid_type';
    else if (n < STAT_MIN_MONTHS_MIN || n > STAT_MIN_MONTHS_MAX) fields.statMinMonths = 'out_of_range';
    else value.statMinMonths = n;
  }

  if (input.cashOverrides !== undefined) {
    const rows = input.cashOverrides;
    if (!Array.isArray(rows)) fields.cashOverrides = 'invalid_type';
    else if (rows.length > CASH_OVERRIDE_KINDS.length * (1 + 12 * 100)) fields.cashOverrides = 'too_many';
    else {
      const keys = new Set<string>();
      const ids = new Set<string>();
      const out: CashOverrideRule[] = [];
      rows.forEach((r, i) => {
        const at = `cashOverrides.${i}`;
        if (typeof r !== 'object' || r === null) {
          fields[at] = 'invalid_type';
          return;
        }
        if (!CASH_OVERRIDE_KINDS.includes(r.kind)) fields[`${at}.kind`] = 'invalid_kind';
        const amount = r.amount;
        if (amount !== null && (typeof amount !== 'number' || !Number.isInteger(amount)))
          fields[`${at}.amount`] = 'invalid_type';
        else if (amount !== null && (amount < 0 || amount > CASH_OVERRIDE_AMOUNT_MAX))
          fields[`${at}.amount`] = 'out_of_range';
        if (r.scope !== 'all' && r.scope !== 'month') fields[`${at}.scope`] = 'invalid_scope';
        else if (r.scope === 'month' && (typeof r.month !== 'string' || !MONTH_PATTERN.test(r.month)))
          fields[`${at}.month`] = 'invalid_month';
        else if (r.scope === 'all' && r.month !== null) fields[`${at}.month`] = 'invalid_month';
        const memoErr = checkText(r.memo, CASH_OVERRIDE_MEMO_MAX, true);
        if (memoErr) fields[`${at}.memo`] = memoErr;
        const row = {
          kind: r.kind,
          amount: amount ?? null,
          scope: r.scope,
          month: r.scope === 'month' ? (r.month ?? null) : null,
          memo: typeof r.memo === 'string' ? r.memo.trim() : '',
        };
        const key = cashOverrideKey(row);
        if (keys.has(key)) fields[`${at}.month`] = 'duplicate';
        keys.add(key);
        let overrideId = r.overrideId ?? cashOverrideIdFor(row);
        if (typeof overrideId !== 'string' || !NORM_RULE_ID_PATTERN.test(overrideId))
          fields[`${at}.overrideId`] = 'invalid_id';
        else if (ids.has(overrideId)) fields[`${at}.overrideId`] = 'duplicate_id';
        overrideId = String(overrideId);
        ids.add(overrideId);
        out.push({ overrideId, ...row });
      });
      value.cashOverrides = out;
    }
  }

  if (input.taxAccountMap !== undefined) {
    const rows = input.taxAccountMap;
    if (!Array.isArray(rows)) fields.taxAccountMap = 'invalid_type';
    else if (rows.length > TAX_ACCOUNT_MAP_ROWS_MAX) fields.taxAccountMap = 'too_many';
    else {
      // 重複は空白を除いた大項目で見る。行ごとの検査 (型・予約の値・科目) は route と同じ 1 関数に任せる
      const seen = new Set<string>();
      const out: TaxAccountMapRow[] = [];
      rows.forEach((r, i) => {
        const at = `taxAccountMap.${i}`;
        if (typeof r !== 'object' || r === null) {
          fields[at] = 'invalid_type';
          return;
        }
        const issue = taxAccountMapRowIssue(r);
        if (issue?.categoryBig) fields[`${at}.categoryBig`] = issue.categoryBig;
        if (issue?.taxAccount) fields[`${at}.taxAccount`] = issue.taxAccount;
        if (typeof r.categoryBig !== 'string' || typeof r.taxAccount !== 'string') return;
        const categoryBig = r.categoryBig.trim();
        if (!issue?.categoryBig) {
          if (seen.has(categoryBig)) fields[`${at}.categoryBig`] = 'duplicate';
          seen.add(categoryBig);
        }
        out.push({ categoryBig, taxAccount: r.taxAccount });
      });
      value.taxAccountMap = sortTaxAccountMap(out);
    }
  }

  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, value };
}

/* -------- 差分(BR-27) -------- */

const bucket = (): DiffBucket => ({ count: 0, items: [] });
const push = (b: DiffBucket, item: DiffItem): void => {
  b.count += 1;
  if (b.items.length < DIFF_ITEMS_MAX) b.items.push(item);
};

const normRuleValue = (r: NormRule) => ({
  kind: r.kind,
  raw: r.raw,
  norm: r.norm,
  enabled: r.enabled,
  order: r.order,
});
const normRuleFieldsEqual = (a: NormRule, b: NormRule): boolean =>
  a.kind === b.kind && a.raw === b.raw && a.norm === b.norm && a.enabled === b.enabled;
const matchKey = (r: NormRule): string => `${r.kind}|${r.kind === 'vendor' ? vendorMatchKey(r.raw) : r.raw}`;

const cashValue = (r: CashOverrideRule) => ({
  kind: r.kind,
  amount: r.amount,
  scope: r.scope,
  month: r.month,
  memo: r.memo,
});

/**
 * 集計ルールの突き合わせ。ruleId が同じ行どうし、残りは (種別, 照合キー) が同じ行どうし。
 * 戻り値は [現在の行, 次の行] の組と、組にならなかった両側の行。
 */
function pairNormRules(current: readonly NormRule[], next: readonly NormRule[]) {
  const byId = new Map(current.map((r) => [r.ruleId, r]));
  const pairs: Array<[NormRule, NormRule]> = [];
  const used = new Set<string>();
  const unmatchedNext: NormRule[] = [];
  for (const r of next) {
    const cur = byId.get(r.ruleId);
    if (cur && !used.has(cur.ruleId)) {
      pairs.push([cur, r]);
      used.add(cur.ruleId);
    } else unmatchedNext.push(r);
  }
  const byKey = new Map<string, NormRule[]>();
  for (const r of [...current].sort((a, b) => a.order - b.order)) {
    if (used.has(r.ruleId)) continue;
    const list = byKey.get(matchKey(r)) ?? [];
    list.push(r);
    byKey.set(matchKey(r), list);
  }
  const added: NormRule[] = [];
  for (const r of unmatchedNext) {
    const cur = byKey.get(matchKey(r))?.shift();
    if (cur) {
      pairs.push([cur, r]);
      used.add(cur.ruleId);
    } else added.push(r);
  }
  const removed = current.filter((r) => !used.has(r.ruleId));
  return { pairs, added, removed };
}

/** 組になった行のうち、互いの前後関係が変わった行(並べ替えで動いた行) */
function movedPairs(pairs: ReadonlyArray<[NormRule, NormRule]>): Set<[NormRule, NormRule]> {
  const byCur = [...pairs].sort((a, b) => a[0].order - b[0].order);
  const byNext = [...pairs].sort((a, b) => a[1].order - b[1].order);
  const moved = new Set<[NormRule, NormRule]>();
  byCur.forEach((p, i) => {
    if (byNext[i] !== p) moved.add(p);
  });
  return moved;
}

function pairCashOverrides(current: readonly CashOverrideRule[], next: readonly CashOverrideRule[]) {
  const byKey = new Map(current.map((r) => [cashOverrideKey(r), r]));
  const pairs: Array<[CashOverrideRule, CashOverrideRule]> = [];
  const added: CashOverrideRule[] = [];
  const used = new Set<string>();
  for (const r of next) {
    const key = cashOverrideKey(r);
    const cur = byKey.get(key);
    if (cur && !used.has(key)) {
      pairs.push([cur, r]);
      used.add(key);
    } else added.push(r);
  }
  const removed = current.filter((r) => !used.has(cashOverrideKey(r)));
  return { pairs, added, removed };
}

const cashFieldsEqual = (a: CashOverrideRule, b: CashOverrideRule): boolean =>
  a.amount === b.amount && a.memo === b.memo;

const taxMapValue = (r: TaxAccountMapRow) => ({ categoryBig: r.categoryBig, taxAccount: r.taxAccount });

/**
 * 対応表の突き合わせ。大項目が行の鍵 (D1 の主キー (user_id, category_big) と同じ)。
 * 戻り値の各列はコード単位順なので、差分・変更履歴・未保存件数の並びが入力の並びに左右されない。
 */
function pairTaxAccountMap(current: readonly TaxAccountMapRow[], next: readonly TaxAccountMapRow[]) {
  const byBig = new Map(current.map((r) => [r.categoryBig, r]));
  const nextBigs = new Set(next.map((r) => r.categoryBig));
  const pairs: Array<[TaxAccountMapRow, TaxAccountMapRow]> = [];
  const added: TaxAccountMapRow[] = [];
  for (const r of sortTaxAccountMap(next)) {
    const cur = byBig.get(r.categoryBig);
    if (cur) pairs.push([cur, r]);
    else added.push(r);
  }
  const removed = sortTaxAccountMap(current.filter((r) => !nextBigs.has(r.categoryBig)));
  return { pairs, added, removed };
}

/**
 * 現在の設定と次の設定の差分(差分プレビュー・比較・保存の変更履歴)。
 * 行単位で数える。フィールドも並び順も変わった行は『変更』に 1 回だけ数える。
 */
export function diffSettings(current: SettingsState, next: SettingsState): SettingsDiff {
  const diff: SettingsDiff = {
    normRules: { added: bucket(), changed: bucket(), removed: bucket(), reordered: bucket() },
    ownerLabels: { changed: [] },
    statMinMonths: null,
    cashOverrides: { added: bucket(), changed: bucket(), removed: bucket() },
    taxAccountMap: { added: bucket(), changed: bucket(), removed: bucket() },
    total: 0,
  };

  const nr = pairNormRules(current.normRules, next.normRules);
  const moved = movedPairs(nr.pairs);
  for (const r of nr.added)
    push(diff.normRules.added, { key: r.ruleId, kind: r.kind, raw: r.raw, after: normRuleValue(r) });
  for (const p of [...nr.pairs].sort((a, b) => a[1].order - b[1].order)) {
    const [cur, nxt] = p;
    const item = {
      key: nxt.ruleId,
      kind: nxt.kind,
      raw: nxt.raw,
      before: normRuleValue(cur),
      after: normRuleValue(nxt),
    };
    if (!normRuleFieldsEqual(cur, nxt)) push(diff.normRules.changed, item);
    else if (moved.has(p)) push(diff.normRules.reordered, item);
  }
  for (const r of [...nr.removed].sort((a, b) => a.order - b.order))
    push(diff.normRules.removed, { key: r.ruleId, kind: r.kind, raw: r.raw, before: normRuleValue(r) });

  for (const owner of OWNER_LABEL_KEYS) {
    const before = current.ownerLabels[owner];
    const after = next.ownerLabels[owner];
    if (before !== after) diff.ownerLabels.changed.push({ owner, before, after });
  }

  if (current.statMinMonths !== next.statMinMonths)
    diff.statMinMonths = { before: current.statMinMonths, after: next.statMinMonths };

  const co = pairCashOverrides(current.cashOverrides, next.cashOverrides);
  for (const r of co.added)
    push(diff.cashOverrides.added, { key: cashOverrideKey(r), kind: r.kind, after: cashValue(r) });
  for (const [cur, nxt] of co.pairs)
    if (!cashFieldsEqual(cur, nxt))
      push(diff.cashOverrides.changed, {
        key: cashOverrideKey(nxt),
        kind: nxt.kind,
        before: cashValue(cur),
        after: cashValue(nxt),
      });
  for (const r of co.removed)
    push(diff.cashOverrides.removed, { key: cashOverrideKey(r), kind: r.kind, before: cashValue(r) });

  const tm = pairTaxAccountMap(current.taxAccountMap, next.taxAccountMap);
  for (const r of tm.added) push(diff.taxAccountMap.added, { key: r.categoryBig, after: taxMapValue(r) });
  for (const [cur, nxt] of tm.pairs)
    if (cur.taxAccount !== nxt.taxAccount)
      push(diff.taxAccountMap.changed, {
        key: nxt.categoryBig,
        before: taxMapValue(cur),
        after: taxMapValue(nxt),
      });
  for (const r of tm.removed)
    push(diff.taxAccountMap.removed, { key: r.categoryBig, before: taxMapValue(r) });

  diff.total =
    diff.normRules.added.count +
    diff.normRules.changed.count +
    diff.normRules.removed.count +
    diff.normRules.reordered.count +
    diff.ownerLabels.changed.length +
    (diff.statMinMonths ? 1 : 0) +
    diff.cashOverrides.added.count +
    diff.cashOverrides.changed.count +
    diff.cashOverrides.removed.count +
    diff.taxAccountMap.added.count +
    diff.taxAccountMap.changed.count +
    diff.taxAccountMap.removed.count;
  return diff;
}

/* -------- 書込み(BR-19・BR-22) -------- */

/** 変更履歴に積む 1 項目。before/after は値の JSON 文字列(作成は before=null、削除は after=null) */
export interface SettingsChangeEntry {
  target: SettingsChangeTarget;
  targetKey: string;
  before: string | null;
  after: string | null;
}

/** 統計の最低月数の変更履歴の target_key */
export const STAT_MIN_MONTHS_TARGET_KEY = 'statMinMonths';

/**
 * 次に書く設定。突き合わせた行は現在の id を引き継ぐ(差分プレビューで『変更』と見せた行を、
 * 保存で『削除+追加』にしない。『元に戻す』は id で履歴を引くので、id が変わると戻せなくなる)。
 * 並び順は配列の順で 1 から振り直す。
 */
export function settingsWriteState(current: SettingsState, next: SettingsState): SettingsState {
  const nr = pairNormRules(current.normRules, next.normRules);
  const inheritedRule = new Map(nr.pairs.map(([cur, nxt]) => [nxt, cur.ruleId]));
  const normRules = [...next.normRules]
    .sort((a, b) => a.order - b.order)
    .map((r, i) => ({ ...r, ruleId: inheritedRule.get(r) ?? r.ruleId, order: i + 1 }));

  const co = pairCashOverrides(current.cashOverrides, next.cashOverrides);
  const inheritedCash = new Map(co.pairs.map(([cur, nxt]) => [nxt, cur.overrideId]));
  const taken = new Set(co.pairs.map(([cur]) => cur.overrideId));
  const cashOverrides = next.cashOverrides.map((r) => {
    let overrideId = inheritedCash.get(r);
    if (overrideId === undefined) {
      // 突き合わなかった行の id が、引き継いだ id と重なることがある(画面で行を消して別の行に同じ id が付いた等)
      overrideId = taken.has(r.overrideId) ? cashOverrideIdFor(r) : r.overrideId;
      for (let n = 2; taken.has(overrideId); n += 1) overrideId = `${cashOverrideIdFor(r)}-${n}`;
      taken.add(overrideId);
    }
    return { ...r, overrideId };
  });

  return {
    normRules,
    ownerLabels: { ...next.ownerLabels },
    statMinMonths: next.statMinMonths,
    cashOverrides,
    // 大項目が鍵なので引き継ぐ id は無い。並びだけ D1 の ORDER BY と揃える
    taxAccountMap: sortTaxAccountMap(next.taxAccountMap),
  };
}

/**
 * 変更履歴の項目(打ち切らない全件)。数え方は diffSettings と同じで、件数は diff.total と一致する。
 * next は settingsWriteState を通した値を渡す(targetKey は書く行の id)。
 * 集計ルールの値は migration 0053 と同じ {kind, raw, norm, enabled, order}。
 */
export function settingsChangeEntries(current: SettingsState, next: SettingsState): SettingsChangeEntry[] {
  const out: SettingsChangeEntry[] = [];
  const json = (v: unknown): string => JSON.stringify(v);

  const nr = pairNormRules(current.normRules, next.normRules);
  const moved = movedPairs(nr.pairs);
  for (const r of nr.added)
    out.push({ target: 'norm_rule', targetKey: r.ruleId, before: null, after: json(normRuleValue(r)) });
  for (const p of [...nr.pairs].sort((a, b) => a[1].order - b[1].order)) {
    const [cur, nxt] = p;
    if (normRuleFieldsEqual(cur, nxt) && !moved.has(p)) continue;
    out.push({
      target: 'norm_rule',
      targetKey: nxt.ruleId,
      before: json(normRuleValue(cur)),
      after: json(normRuleValue(nxt)),
    });
  }
  for (const r of [...nr.removed].sort((a, b) => a.order - b.order))
    out.push({ target: 'norm_rule', targetKey: r.ruleId, before: json(normRuleValue(r)), after: null });

  for (const owner of OWNER_LABEL_KEYS) {
    const before = current.ownerLabels[owner];
    const after = next.ownerLabels[owner];
    if (before !== after)
      out.push({ target: 'owner_label', targetKey: owner, before: json(before), after: json(after) });
  }

  if (current.statMinMonths !== next.statMinMonths)
    out.push({
      target: 'stat_min_months',
      targetKey: STAT_MIN_MONTHS_TARGET_KEY,
      before: json(current.statMinMonths),
      after: json(next.statMinMonths),
    });

  const co = pairCashOverrides(current.cashOverrides, next.cashOverrides);
  for (const r of co.added)
    out.push({ target: 'cash_override', targetKey: r.overrideId, before: null, after: json(cashValue(r)) });
  for (const [cur, nxt] of co.pairs)
    if (!cashFieldsEqual(cur, nxt))
      out.push({
        target: 'cash_override',
        targetKey: nxt.overrideId,
        before: json(cashValue(cur)),
        after: json(cashValue(nxt)),
      });
  for (const r of co.removed)
    out.push({ target: 'cash_override', targetKey: r.overrideId, before: json(cashValue(r)), after: null });

  const tm = pairTaxAccountMap(current.taxAccountMap, next.taxAccountMap);
  for (const r of tm.added)
    out.push({
      target: 'tax_account_map',
      targetKey: r.categoryBig,
      before: null,
      after: json(taxMapValue(r)),
    });
  for (const [cur, nxt] of tm.pairs)
    if (cur.taxAccount !== nxt.taxAccount)
      out.push({
        target: 'tax_account_map',
        targetKey: nxt.categoryBig,
        before: json(taxMapValue(cur)),
        after: json(taxMapValue(nxt)),
      });
  for (const r of tm.removed)
    out.push({
      target: 'tax_account_map',
      targetKey: r.categoryBig,
      before: json(taxMapValue(r)),
      after: null,
    });
  return out;
}

/* -------- 未保存件数(§7.14) -------- */

/**
 * 保存済みと下書きの未保存件数。フィールド単位で数える。
 * 行の追加・削除は 1 行 1 項目、並び順の変更は動いた行ごとに 1 項目。
 * 画面の下書きは行 id を持つので、集計ルールは ruleId、現金上書きは overrideId で突き合わせる。
 */
export function countSettingsChanges(saved: SettingsState, draft: SettingsState): number {
  let n = 0;

  const savedRules = new Map(saved.normRules.map((r) => [r.ruleId, r]));
  const draftIds = new Set(draft.normRules.map((r) => r.ruleId));
  const pairs: Array<[NormRule, NormRule]> = [];
  for (const r of draft.normRules) {
    const cur = savedRules.get(r.ruleId);
    if (!cur) {
      n += 1;
      continue;
    }
    pairs.push([cur, r]);
    if (cur.kind !== r.kind) n += 1;
    if (cur.raw !== r.raw) n += 1;
    if (cur.norm !== r.norm) n += 1;
    if (cur.enabled !== r.enabled) n += 1;
  }
  n += saved.normRules.filter((r) => !draftIds.has(r.ruleId)).length;
  n += movedPairs(pairs).size;

  for (const owner of OWNER_LABEL_KEYS) if (saved.ownerLabels[owner] !== draft.ownerLabels[owner]) n += 1;
  if (saved.statMinMonths !== draft.statMinMonths) n += 1;

  const savedCash = new Map(saved.cashOverrides.map((r) => [r.overrideId, r]));
  const draftCashIds = new Set(draft.cashOverrides.map((r) => r.overrideId));
  for (const r of draft.cashOverrides) {
    const cur = savedCash.get(r.overrideId);
    if (!cur) {
      n += 1;
      continue;
    }
    if (cur.kind !== r.kind) n += 1;
    if (cur.amount !== r.amount) n += 1;
    if (cur.scope !== r.scope) n += 1;
    if (cur.month !== r.month) n += 1;
    if (cur.memo !== r.memo) n += 1;
  }
  n += saved.cashOverrides.filter((r) => !draftCashIds.has(r.overrideId)).length;

  // 対応表の行は科目 1 欄だけが値。大項目を変えた行は『削除+追加』として 2 項目になる
  const tm = pairTaxAccountMap(saved.taxAccountMap, draft.taxAccountMap);
  n += tm.added.length + tm.removed.length;
  n += tm.pairs.filter(([cur, nxt]) => cur.taxAccount !== nxt.taxAccount).length;
  return n;
}

/* -------- 要約(BR-31) -------- */

export function summarizeSettings(state: SettingsState, ownerLabelsSaved: boolean): SettingsSummary {
  return {
    normRules: state.normRules.length,
    ownerLabelsSet: ownerLabelsSaved,
    statMinMonths: state.statMinMonths,
    cashOverrides: state.cashOverrides.length,
    taxAccountMap: state.taxAccountMap.length,
  };
}

/* -------- 画面の値(GET /api/settings/screen) -------- */

export type SettingsChangeTarget =
  | 'norm_rule'
  | 'owner_label'
  | 'stat_min_months'
  | 'cash_override'
  | 'tax_account_map';
export type SettingsChangeOrigin = 'screen' | 'restore' | 'migration';

/** 変更履歴 1 行(settings_change_log) */
export interface SettingsChangeLogRow {
  seq: number;
  target: SettingsChangeTarget;
  targetKey: string;
  /** 項目の値の JSON 文字列。作成は null */
  before: string | null;
  /** 削除は null */
  after: string | null;
  changedBy: string;
  changedAt: string;
  origin: SettingsChangeOrigin;
}

export interface StoredNormRule extends NormRule {
  updatedAt: string;
  updatedBy: string;
}

export interface StoredCashOverride extends CashOverrideRule {
  updatedAt: string;
  updatedBy: string;
}

export interface SettingsScreenInput {
  normRules: readonly StoredNormRule[];
  cashOverrides: readonly StoredCashOverride[];
  /** tax_account_map の保存値 (並びは問わない) */
  taxAccountMap: readonly TaxAccountMapRow[];
  /** owner_labels の保存値。1 行も無ければ null */
  ownerLabels: Partial<Record<OwnerKey, string>> | null;
  /** analysis_settings の保存値。無ければ null */
  statMinMonths: number | null;
  /** 対象・キーごとの変更履歴の最新行 */
  latestChanges: readonly SettingsChangeLogRow[];
}

export interface SettingsScreenNormRule extends NormRule {
  updatedAt: string;
  updatedBy: string;
  canUndo: boolean;
  shadowedBy: string | null;
}

export interface SettingsScreenCashOverride extends CashOverrideRule {
  updatedAt: string;
  updatedBy: string;
}

export interface SettingsScreenView {
  savedAt: string | null;
  normRules: SettingsScreenNormRule[];
  ownerLabels: OwnerLabels;
  ownerLabelsSaved: boolean;
  statMinMonths: number;
  statMinMonthsRange: { min: number; max: number; default: number };
  cashOverrides: SettingsScreenCashOverride[];
  /** 大項目のコード単位順 */
  taxAccountMap: TaxAccountMapRow[];
  impacts: { account: string[]; vendor: string[] };
  limits: { normRules: number; text: number; memo: number };
}

/** revision。その利用者の変更履歴の changed_at の最大値(BR-22) */
export function settingsRevision(changes: readonly Pick<SettingsChangeLogRow, 'changedAt'>[]): string | null {
  let max: string | null = null;
  for (const c of changes) if (max === null || c.changedAt > max) max = c.changedAt;
  return max;
}

const byOrder = (a: NormRule, b: NormRule): number => a.order - b.order;

/** 現金上書きの並び: 支払い → 受け取り、全期間 → 月の昇順 */
export function sortCashOverrides<T extends CashOverrideRule>(rows: readonly T[]): T[] {
  const kindIndex = (k: CashOverrideKind) => CASH_OVERRIDE_KINDS.indexOf(k);
  return [...rows].sort(
    (a, b) =>
      kindIndex(a.kind) - kindIndex(b.kind) ||
      (a.scope === b.scope ? 0 : a.scope === 'all' ? -1 : 1) ||
      (a.month ?? '').localeCompare(b.month ?? ''),
  );
}

/** 保存済みの行と変更履歴の最新行から、設定画面の値を組む(決定論) */
export function settingsScreen(input: SettingsScreenInput): SettingsScreenView {
  const latest = new Map(input.latestChanges.map((c) => [`${c.target}|${c.targetKey}`, c]));
  const rules = [...input.normRules].sort(byOrder);
  const shadowed = shadowedNormRules(rules);
  const ownerLabelsSaved = input.ownerLabels != null && Object.keys(input.ownerLabels).length > 0;
  return {
    savedAt: settingsRevision(input.latestChanges),
    normRules: rules.map((r) => {
      const log = latest.get(`norm_rule|${r.ruleId}`);
      return {
        ruleId: r.ruleId,
        kind: r.kind,
        raw: r.raw,
        norm: r.norm,
        order: r.order,
        enabled: r.enabled,
        updatedAt: log?.changedAt ?? r.updatedAt,
        updatedBy: settingsActorLabel(log?.changedBy ?? r.updatedBy),
        canUndo: log != null && log.before != null,
        shadowedBy: shadowed[r.ruleId] ?? null,
      };
    }),
    ownerLabels: resolveOwnerLabels(input.ownerLabels),
    ownerLabelsSaved,
    statMinMonths: input.statMinMonths ?? DEFAULT_STAT_MIN_MONTHS,
    statMinMonthsRange: {
      min: STAT_MIN_MONTHS_MIN,
      max: STAT_MIN_MONTHS_MAX,
      default: DEFAULT_STAT_MIN_MONTHS,
    },
    cashOverrides: sortCashOverrides(input.cashOverrides).map((r) => {
      const log = latest.get(`cash_override|${r.overrideId}`);
      return {
        overrideId: r.overrideId,
        kind: r.kind,
        amount: r.amount,
        scope: r.scope,
        month: r.month,
        memo: r.memo,
        updatedAt: log?.changedAt ?? r.updatedAt,
        updatedBy: settingsActorLabel(log?.changedBy ?? r.updatedBy),
      };
    }),
    taxAccountMap: sortTaxAccountMap(input.taxAccountMap),
    impacts: { account: [...SETTINGS_IMPACTS.account], vendor: [...SETTINGS_IMPACTS.vendor] },
    limits: { normRules: NORM_RULES_MAX, text: NORM_RULE_TEXT_MAX, memo: CASH_OVERRIDE_MEMO_MAX },
  };
}

/** 画面の値 → 設定 5 種(差分・未保存件数・書き出しの入力) */
export function settingsStateOf(
  view: Pick<
    SettingsScreenView,
    'normRules' | 'ownerLabels' | 'statMinMonths' | 'cashOverrides' | 'taxAccountMap'
  >,
): SettingsState {
  return {
    normRules: view.normRules.map(({ ruleId, kind, raw, norm, order, enabled }) => ({
      ruleId,
      kind,
      raw,
      norm,
      order,
      enabled,
    })),
    ownerLabels: { ...view.ownerLabels },
    statMinMonths: view.statMinMonths,
    cashOverrides: view.cashOverrides.map(({ overrideId, kind, amount, scope, month, memo }) => ({
      overrideId,
      kind,
      amount,
      scope,
      month,
      memo,
    })),
    taxAccountMap: sortTaxAccountMap(view.taxAccountMap),
  };
}

/**
 * 設定が 1 つも保存されていない状態(空状態の判定・既定値)。
 * 対応表も空。初期の 5 行は migration 0059 と版 1 の JSON の移行が入れるもので、『保存なし』の意味ではない。
 */
export const EMPTY_SETTINGS_STATE: Readonly<SettingsState> = Object.freeze({
  normRules: [],
  ownerLabels: { ...DEFAULT_OWNER_LABELS },
  statMinMonths: DEFAULT_STAT_MIN_MONTHS,
  cashOverrides: [],
  taxAccountMap: [],
});
