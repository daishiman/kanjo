/**
 * 設定 JSON(BR-23〜BR-29)。書き出し・検証・版の移行・バックアップ本文からの取り出し。
 *
 * 書き出しと復元、バックアップの比較と復元が同じ検証を通るように、形の検査はここ 1 か所に置く。
 * 値の規則(文字数・範囲・重複)は settings-screen の validateSettingsInput に委ねる。
 */
import type { CashOverrideRule } from './cash.js';
import type { NormRule } from './norm-rules.js';
import { OWNER_LABEL_KEYS, type OwnerLabels, resolveOwnerLabels } from './owner-labels.js';
import { type SettingsState, validateSettingsInput } from './settings-screen.js';
import { DEFAULT_STAT_MIN_MONTHS } from './stats.js';
import { DEFAULT_TAX_ACCOUNT_MAP, type TaxAccountMapRow, sortTaxAccountMap } from './tax-accounts.js';
import type { OwnerKey } from './types.js';

export const SETTINGS_JSON_FORMAT = 'kanjo-settings';
/** 版 2 で勘定科目の対応表 (taxAccountMap) を足した (spec-classify-bulk-save AC-17) */
export const SETTINGS_JSON_VERSION = 2;

export interface SettingsJsonV2 {
  format: typeof SETTINGS_JSON_FORMAT;
  version: 2;
  exportedAt: string;
  /** 配列の順が並び順 */
  normRules: Array<Omit<NormRule, 'order'>>;
  ownerLabels: OwnerLabels;
  statMinMonths: number;
  /** overrideId は含めない(復元時にサーバが振る) */
  cashOverrides: Array<Omit<CashOverrideRule, 'overrideId'>>;
  /** 大項目のコード単位順。更新日時は含めない */
  taxAccountMap: TaxAccountMapRow[];
}

export type SettingsJsonError = 'invalid_settings_file' | 'unsupported_settings_version';

export type SettingsJsonValidation =
  | { ok: true; value: SettingsState }
  | { ok: false; code: SettingsJsonError };

/** 設定 5 種 → 設定 JSON。書き出した値は必ず validateSettingsJson を通る */
export function exportSettings(state: SettingsState, exportedAt: string): SettingsJsonV2 {
  return {
    format: SETTINGS_JSON_FORMAT,
    version: SETTINGS_JSON_VERSION,
    exportedAt,
    normRules: [...state.normRules]
      .sort((a, b) => a.order - b.order)
      .map(({ ruleId, kind, raw, norm, enabled }) => ({ ruleId, kind, raw, norm, enabled })),
    ownerLabels: { ...state.ownerLabels },
    statMinMonths: state.statMinMonths,
    cashOverrides: state.cashOverrides.map(({ kind, amount, scope, month, memo }) => ({
      kind,
      amount,
      scope,
      month,
      memo,
    })),
    taxAccountMap: sortTaxAccountMap(state.taxAccountMap),
  };
}

/** 書き出しのファイル名。日付は書き出した日(UTC) */
export const settingsExportFilename = (exportedAt: string): string =>
  `kanjo-settings-${exportedAt.slice(0, 10)}.json`;

/** 初期の対応表の写し。frozen の行をそのまま渡すと、受け手が並べ替えや追記をしたときに落ちる */
const defaultTaxAccountMap = (): TaxAccountMapRow[] => DEFAULT_TAX_ACCOUNT_MAP.map((r) => ({ ...r }));

/**
 * 古い版 → 次の版の移行関数(BR-25)。キーは移行元の版。受けるのは現行版と 1 世代前だけ。
 * null は『その版としても不正』。版 1 に無いキーを持つ JSON を、移行で黙って受け入れないため。
 */
const SETTINGS_JSON_MIGRATIONS: Readonly<
  Record<number, (obj: Record<string, unknown>) => Record<string, unknown> | null>
> = Object.freeze({
  // 版 1 → 2: 対応表は migration 0059 と同じ初期の 5 行で補う
  1: (obj: Record<string, unknown>) =>
    Object.prototype.hasOwnProperty.call(obj, 'taxAccountMap')
      ? null
      : { ...obj, version: 2, taxAccountMap: defaultTaxAccountMap() },
});

const TOP_KEYS = [
  'format',
  'version',
  'exportedAt',
  'normRules',
  'ownerLabels',
  'statMinMonths',
  'cashOverrides',
  'taxAccountMap',
];
const NORM_RULE_KEYS = ['ruleId', 'kind', 'raw', 'norm', 'enabled'];
const CASH_OVERRIDE_KEYS = ['kind', 'amount', 'scope', 'month', 'memo'];
const TAX_ACCOUNT_MAP_KEYS = ['categoryBig', 'taxAccount'];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** キーの集合が期待どおりか(未知キー・欠落キーを拒否する。BR-24) */
const hasExactKeys = (obj: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
};

/**
 * 設定 JSON の検証(BR-24)。形・版・値のどれか 1 つでも不正なら何も返さない。
 * 通れば並び順と現金上書きの id(決定論)を振った設定 5 種を返す。対応表は版を問わず
 * 大項目のコード単位順 (版 1 から補った初期の 5 行も並べ替える。書き出しと D1 の並びに揃える)。
 * どの欄が不正かは外に出さない(qa-settings-security-web-003)。
 */
export function validateSettingsJson(input: unknown): SettingsJsonValidation {
  if (!isPlainObject(input) || input.format !== SETTINGS_JSON_FORMAT)
    return { ok: false, code: 'invalid_settings_file' };
  const version = input.version;
  if (typeof version !== 'number' || !Number.isInteger(version))
    return { ok: false, code: 'invalid_settings_file' };
  if (version > SETTINGS_JSON_VERSION || version < SETTINGS_JSON_VERSION - 1)
    return { ok: false, code: 'unsupported_settings_version' };
  let obj: Record<string, unknown> = input;
  for (let v = version; v < SETTINGS_JSON_VERSION; v += 1) {
    const migrate = SETTINGS_JSON_MIGRATIONS[v];
    if (!migrate) return { ok: false, code: 'unsupported_settings_version' };
    const next = migrate(obj);
    if (!next) return { ok: false, code: 'invalid_settings_file' };
    obj = next;
  }

  if (!hasExactKeys(obj, TOP_KEYS) || typeof obj.exportedAt !== 'string')
    return { ok: false, code: 'invalid_settings_file' };
  const { normRules, ownerLabels, statMinMonths, cashOverrides, taxAccountMap } = obj;
  if (
    !Array.isArray(normRules) ||
    !normRules.every((r) => isPlainObject(r) && hasExactKeys(r, NORM_RULE_KEYS))
  )
    return { ok: false, code: 'invalid_settings_file' };
  if (!isPlainObject(ownerLabels) || !hasExactKeys(ownerLabels, OWNER_LABEL_KEYS))
    return { ok: false, code: 'invalid_settings_file' };
  if (
    !Array.isArray(cashOverrides) ||
    !cashOverrides.every((r) => isPlainObject(r) && hasExactKeys(r, CASH_OVERRIDE_KEYS))
  )
    return { ok: false, code: 'invalid_settings_file' };
  if (
    !Array.isArray(taxAccountMap) ||
    !taxAccountMap.every((r) => isPlainObject(r) && hasExactKeys(r, TAX_ACCOUNT_MAP_KEYS))
  )
    return { ok: false, code: 'invalid_settings_file' };

  const checked = validateSettingsInput({
    normRules: normRules as SettingsJsonV2['normRules'],
    ownerLabels: ownerLabels as Record<OwnerKey, string>,
    statMinMonths: statMinMonths as number,
    cashOverrides: cashOverrides as SettingsJsonV2['cashOverrides'],
    taxAccountMap: taxAccountMap as SettingsJsonV2['taxAccountMap'],
  });
  if (!checked.ok) return { ok: false, code: 'invalid_settings_file' };
  const v = checked.value;
  return {
    ok: true,
    value: {
      normRules: v.normRules ?? [],
      ownerLabels: v.ownerLabels ?? resolveOwnerLabels(null),
      statMinMonths: v.statMinMonths ?? DEFAULT_STAT_MIN_MONTHS,
      cashOverrides: v.cashOverrides ?? [],
      taxAccountMap: v.taxAccountMap ?? [],
    },
  };
}

/* -------- バックアップ本文からの取り出し(BR-28・BR-29) -------- */

/** 勘定科目ルールの移行 id。migration 0051 の 'm-' || lower(hex(raw)) と同じ */
export function migratedNormRuleId(raw: string): string {
  let hex = '';
  for (const byte of new TextEncoder().encode(raw)) hex += byte.toString(16).padStart(2, '0');
  return `m-${hex}`;
}

/**
 * 全データ JSON・夜間バックアップの本文 → 設定 JSON の形。検証はしない(validateSettingsJson へ渡す)。
 * 新しい本文は normRules・cashOverrideRules・ownerLabels・analysisSettings・taxAccountMap を持つ。
 * 古い本文(新表なし)は normMap を勘定科目ルールへ、cashOverride の月の値を月指定の現金上書きへ写し、
 * 名義が無ければ既定にする(migration 0051・0052 の写しと同じ意味。0 と未設定は写さない)。
 * 対応表の無い本文 (0059 より前) は初期の 5 行で補う。空の配列は利用者が全部消した状態なので補わない。
 */
export function settingsJsonFromBackup(body: Record<string, unknown>, exportedAt: string): SettingsJsonV2 {
  const normRules: SettingsJsonV2['normRules'] = Array.isArray(body.normRules)
    ? [...(body.normRules as NormRule[])]
        .sort((a, b) => a.order - b.order)
        .map(({ ruleId, kind, raw, norm, enabled }) => ({ ruleId, kind, raw, norm, enabled }))
    : isPlainObject(body.normMap)
      ? Object.keys(body.normMap)
          .sort()
          .map((raw) => ({
            ruleId: migratedNormRuleId(raw),
            kind: 'account' as const,
            raw,
            norm: String((body.normMap as Record<string, unknown>)[raw]),
            enabled: true,
          }))
      : [];

  let cashOverrides: SettingsJsonV2['cashOverrides'] = [];
  if (Array.isArray(body.cashOverrideRules)) {
    cashOverrides = (body.cashOverrideRules as CashOverrideRule[]).map(
      ({ kind, amount, scope, month, memo }) => ({
        kind,
        amount,
        scope,
        month,
        memo,
      }),
    );
  } else if (isPlainObject(body.cashOverride)) {
    const byMonth = body.cashOverride as Record<string, { revenue?: unknown; expense?: unknown }>;
    for (const month of Object.keys(byMonth).sort()) {
      const v = byMonth[month] ?? {};
      if (typeof v.expense === 'number' && v.expense !== 0)
        cashOverrides.push({ kind: 'payment', amount: v.expense, scope: 'month', month, memo: '' });
      if (typeof v.revenue === 'number' && v.revenue !== 0)
        cashOverrides.push({ kind: 'receipt', amount: v.revenue, scope: 'month', month, memo: '' });
    }
  }

  const analysis = isPlainObject(body.analysisSettings) ? body.analysisSettings : {};
  const statMinMonths =
    typeof analysis.statMinMonths === 'number' ? analysis.statMinMonths : DEFAULT_STAT_MIN_MONTHS;
  const ownerLabels = resolveOwnerLabels(
    isPlainObject(body.ownerLabels) ? (body.ownerLabels as Partial<Record<OwnerKey, string>>) : null,
  );
  // 行の形が崩れた本文はそのまま渡し、検証で落とす (ここで捨てると壊れた本文が『対応表なし』に化ける)
  const taxAccountMap: SettingsJsonV2['taxAccountMap'] = Array.isArray(body.taxAccountMap)
    ? ((body.taxAccountMap as unknown[]).map((r) =>
        isPlainObject(r) ? { categoryBig: r.categoryBig, taxAccount: r.taxAccount } : r,
      ) as TaxAccountMapRow[])
    : defaultTaxAccountMap();

  return {
    format: SETTINGS_JSON_FORMAT,
    version: SETTINGS_JSON_VERSION,
    exportedAt,
    normRules,
    ownerLabels,
    statMinMonths,
    cashOverrides,
    taxAccountMap,
  };
}
