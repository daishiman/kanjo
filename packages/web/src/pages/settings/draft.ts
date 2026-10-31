/**
 * 設定画面の入力状態と、ブラウザ内の下書き (spec-settings-screen §7.12〜§7.14)。
 *
 * 入力は 4 節 (集計ルール・名義・統計・現金上書き) を 1 つのフォームで持ち、1 回の保存で送る。
 * 下書きのキーは `kanjo:settings:draft:{userId}`、値は `{ v: 1, savedAt, baseSavedAt, 変更のある節だけ }`。
 * 節の値は入力欄の文字列のまま持つ (§データ: 下書き)。
 * 下書きに無い節は新しい保存済みの値を採り、在る節は下書きを残す (他の画面の更新を上書きしない)。
 * 形が壊れている・v が 1 でない・30 日を過ぎた下書きは捨てる。ログアウトで接頭辞のキーを全て消す。
 * 未保存件数・値の検証は core (countSettingsChanges・validateSettingsInput) に任せる。
 */
import {
  CASH_OVERRIDE_AMOUNT_MAX,
  CASH_OVERRIDE_KINDS,
  type CashOverrideInput,
  type CashOverrideKind,
  type NormRuleInput,
  type NormRuleKind,
  OWNER_LABEL_KEYS,
  type OwnerKey,
  type OwnerLabelError,
  type SettingsFieldError,
  type SettingsInput,
  type SettingsScreenView,
  type SettingsState,
  countSettingsChanges,
  validateOwnerLabels,
  validateSettingsInput,
} from '@kanjo/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { settingsDraftKey } from './draft-storage.js';

export { SETTINGS_DRAFT_PREFIX, clearAllSettingsDrafts, settingsDraftKey } from './draft-storage.js';

const DRAFT_DELAY_MS = 800;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* -------- フォームの形 -------- */

export interface NormRuleForm {
  ruleId: string;
  kind: NormRuleKind;
  raw: string;
  norm: string;
  enabled: boolean;
  /** まだ保存していない行 (説明パネルの『未保存』と、元に戻すの無効化に使う) */
  isNew: boolean;
}

export interface CashOverrideForm {
  overrideId: string;
  kind: CashOverrideKind;
  /** 入力欄の文字列。空欄は「上書きしない」で、'0' とは別の値 */
  amount: string;
  scope: 'all' | 'month';
  /** 'YYYY-MM'。全期間の行は '' */
  month: string;
  memo: string;
  isNew: boolean;
}

export interface SettingsForm {
  normRules: NormRuleForm[];
  ownerLabels: Record<OwnerKey, string>;
  statMinMonths: string;
  cashOverrides: CashOverrideForm[];
}

type Section = keyof SettingsForm;
const SECTIONS: readonly Section[] = ['normRules', 'ownerLabels', 'statMinMonths', 'cashOverrides'];

/** 集計ルールの行 id。推測できない値にする (BR-02) */
export const newRuleId = (): string => crypto.randomUUID();
export const newOverrideId = (): string => `new-${crypto.randomUUID()}`;

/** 未設定の全期間の行。id は保存済みの行 (o-…) と重ならない固定値にする */
export const blankAllRow = (kind: CashOverrideKind): CashOverrideForm => ({
  overrideId: `blank-${kind}`,
  kind,
  amount: '',
  scope: 'all',
  month: '',
  memo: '',
  isNew: true,
});

/** 種別ごとに全期間の行を 1 行ずつ置く (未設定なら空の行)。並びは 支払い → 受け取り、全期間 → 月の昇順 */
export function withAllRows(rows: readonly CashOverrideForm[]): CashOverrideForm[] {
  const out: CashOverrideForm[] = [];
  for (const kind of CASH_OVERRIDE_KINDS) {
    const own = rows.filter((r) => r.kind === kind);
    const all = own.find((r) => r.scope === 'all') ?? blankAllRow(kind);
    out.push(all, ...own.filter((r) => r !== all));
  }
  return out;
}

/** 保存済みの値を入力欄の形にする */
export function formOf(
  view: Pick<SettingsScreenView, 'normRules' | 'ownerLabels' | 'statMinMonths' | 'cashOverrides'>,
): SettingsForm {
  return {
    normRules: view.normRules.map((r) => ({
      ruleId: r.ruleId,
      kind: r.kind,
      raw: r.raw,
      norm: r.norm,
      enabled: r.enabled,
      isNew: false,
    })),
    ownerLabels: { ...view.ownerLabels },
    statMinMonths: String(view.statMinMonths),
    cashOverrides: withAllRows(
      view.cashOverrides.map((r) => ({
        overrideId: r.overrideId,
        kind: r.kind,
        amount: r.amount == null ? '' : String(r.amount),
        scope: r.scope,
        month: r.month ?? '',
        memo: r.memo,
        isNew: false,
      })),
    ),
  };
}

/** 桁区切り・空白・円記号を外した 0 以上の整数。空は null、読めない・範囲外は undefined */
export function parseAmount(raw: string): number | null | undefined {
  const text = raw.replace(/[,，\s¥￥円]/g, '');
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= CASH_OVERRIDE_AMOUNT_MAX ? value : undefined;
}

/** 統計の月数。整数として読めなければ undefined (範囲は core が見る) */
export function parseMonths(raw: string): number | undefined {
  const text = raw.trim();
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

/** 空の全期間の行 (金額もメモも無い) は「未設定」で、保存する行ではない */
const isBlankAllRow = (r: CashOverrideForm): boolean =>
  r.scope === 'all' && r.amount.trim() === '' && r.memo.trim() === '';

/** 入力欄 → 設定 4 種。読めない数値は NaN にし、保存済みと必ず違う値として数える */
export function stateOf(form: SettingsForm): SettingsState {
  return {
    normRules: form.normRules.map((r, i) => ({
      ruleId: r.ruleId,
      kind: r.kind,
      raw: r.raw.trim(),
      norm: r.norm.trim(),
      order: i + 1,
      enabled: r.enabled,
    })),
    ownerLabels: Object.fromEntries(OWNER_LABEL_KEYS.map((k) => [k, form.ownerLabels[k].trim()])) as Record<
      OwnerKey,
      string
    >,
    statMinMonths: parseMonths(form.statMinMonths) ?? Number.NaN,
    cashOverrides: form.cashOverrides
      .filter((r) => !isBlankAllRow(r))
      .map((r) => {
        const amount = parseAmount(r.amount);
        return {
          overrideId: r.overrideId,
          kind: r.kind,
          amount: amount === undefined ? Number.NaN : amount,
          scope: r.scope,
          month: r.scope === 'month' ? r.month : null,
          memo: r.memo.trim(),
        };
      }),
  };
}

/** 未保存の項目数 (§7.14)。行の突き合わせと数え方は core と同じ */
export const unsavedCount = (saved: SettingsForm, form: SettingsForm): number =>
  countSettingsChanges(stateOf(saved), stateOf(form));

/* -------- 検証 -------- */

export type FormFieldError = SettingsFieldError | 'not_integer';

export interface FormValidation {
  ok: boolean;
  /** `normRules.{i}.raw` などフォームの行番号で引く鍵 */
  fields: Record<string, FormFieldError>;
  owners: Partial<Record<OwnerKey, OwnerLabelError>>;
}

/**
 * 画面の検証。4 節すべてを core の validateSettingsInput に渡し、行番号をフォームと揃える。
 * 数値として読めない欄は core に渡す前に画面側で止める (core は型しか見られない)。
 */
export function validateForm(form: SettingsForm): FormValidation {
  const fields: Record<string, FormFieldError> = {};
  const months = parseMonths(form.statMinMonths);
  if (months === undefined) fields.statMinMonths = 'not_integer';
  const cashOverrides = form.cashOverrides.map((r, i) => {
    const amount = parseAmount(r.amount);
    if (amount === undefined) fields[`cashOverrides.${i}.amount`] = 'not_integer';
    return {
      overrideId: r.overrideId,
      kind: r.kind,
      amount: amount ?? null,
      scope: r.scope,
      month: r.scope === 'month' ? r.month : null,
      memo: r.memo,
    };
  });
  const result = validateSettingsInput({
    normRules: form.normRules.map(({ ruleId, kind, raw, norm, enabled }) => ({
      ruleId,
      kind,
      raw,
      norm,
      enabled,
    })),
    ownerLabels: form.ownerLabels,
    statMinMonths: months ?? 0,
    cashOverrides,
  });
  if (!result.ok)
    for (const [key, code] of Object.entries(result.fields)) {
      // 読めない月数は画面側の文言を優先する。名義の理由は validateOwnerLabels から取り直す
      if (key === 'statMinMonths' && months === undefined) continue;
      if (key.startsWith('ownerLabels.')) continue;
      fields[key] ??= code;
    }
  const owners = validateOwnerLabels(form.ownerLabels);
  const ownerFields = owners.ok ? {} : owners.fields;
  return { ok: Object.keys(fields).length === 0 && owners.ok, fields, owners: ownerFields };
}

/* -------- 保存の本文 -------- */

const sectionOf = (state: SettingsState, section: Section): string => JSON.stringify(state[section]);

/**
 * PUT /api/settings/screen の本文。変更のある節だけを入れる。
 * 集計ルールと現金上書きは節ごと全件を送る (送った節が丸ごと置き換わる)。新しい現金上書きは id を省く。
 */
export function savePayloadOf(
  saved: SettingsForm,
  form: SettingsForm,
  baseSavedAt: string | null,
): SettingsInput & { baseSavedAt: string | null } {
  const before = stateOf(saved);
  const after = stateOf(form);
  const changed = (section: Section) => sectionOf(before, section) !== sectionOf(after, section);
  const body: SettingsInput & { baseSavedAt: string | null } = { baseSavedAt };
  if (changed('normRules'))
    body.normRules = after.normRules.map(
      ({ ruleId, kind, raw, norm, enabled }): NormRuleInput => ({ ruleId, kind, raw, norm, enabled }),
    );
  if (changed('ownerLabels')) body.ownerLabels = after.ownerLabels;
  if (changed('statMinMonths')) body.statMinMonths = after.statMinMonths;
  if (changed('cashOverrides')) {
    const isNew = new Set(form.cashOverrides.filter((r) => r.isNew).map((r) => r.overrideId));
    body.cashOverrides = after.cashOverrides.map(
      ({ overrideId, ...rest }): CashOverrideInput =>
        isNew.has(overrideId) ? rest : { overrideId, ...rest },
    );
  }
  return body;
}

/* -------- 下書き -------- */

interface Draft {
  base: SettingsForm;
  form: SettingsForm;
}

/** 端末に置く形。変更のある節だけを持つ */
type StoredDraft = Partial<SettingsForm> & { v: 1; savedAt: string; baseSavedAt: string | null };

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isRuleForm(value: unknown): value is NormRuleForm {
  if (!isRecord(value)) return false;
  return (
    typeof value.ruleId === 'string' &&
    (value.kind === 'account' || value.kind === 'vendor') &&
    typeof value.raw === 'string' &&
    typeof value.norm === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.isNew === 'boolean'
  );
}

function isCashForm(value: unknown): value is CashOverrideForm {
  if (!isRecord(value)) return false;
  return (
    typeof value.overrideId === 'string' &&
    CASH_OVERRIDE_KINDS.includes(value.kind as CashOverrideKind) &&
    typeof value.amount === 'string' &&
    (value.scope === 'all' || value.scope === 'month') &&
    typeof value.month === 'string' &&
    typeof value.memo === 'string' &&
    typeof value.isNew === 'boolean'
  );
}

/** 下書きの節の形を確かめる。在る節は全て正しい形でなければ下書きごと捨てる */
function sectionsOf(value: Record<string, unknown>): Partial<SettingsForm> | null {
  const out: Partial<SettingsForm> = {};
  const { normRules, ownerLabels, statMinMonths, cashOverrides } = value;
  if (normRules !== undefined) {
    if (!Array.isArray(normRules) || !normRules.every(isRuleForm)) return null;
    out.normRules = normRules;
  }
  if (ownerLabels !== undefined) {
    if (!isRecord(ownerLabels) || !OWNER_LABEL_KEYS.every((k) => typeof ownerLabels[k] === 'string'))
      return null;
    out.ownerLabels = ownerLabels as Record<OwnerKey, string>;
  }
  if (statMinMonths !== undefined) {
    if (typeof statMinMonths !== 'string') return null;
    out.statMinMonths = statMinMonths;
  }
  if (cashOverrides !== undefined) {
    if (!Array.isArray(cashOverrides) || !cashOverrides.every(isCashForm)) return null;
    out.cashOverrides = cashOverrides;
  }
  return out;
}

/**
 * 下書きを新しい保存済みの値に合わせる。
 * 節ごとに、下書きがその節の base と同じ (触っていない) なら保存済みを採り、違えば下書きを残す。
 * 残した節の行は、保存済みに在る行と新規の行だけにする (他で消された行を生き返らせない)。
 * 結果が保存済みと同じなら下書きは無い (null)。
 */
export function rebaseDraft(draft: Draft, saved: SettingsForm): Draft | null {
  const form = { ...saved };
  for (const section of SECTIONS) {
    if (same(draft.form[section], draft.base[section])) continue;
    if (section === 'normRules') {
      const ids = new Set(saved.normRules.map((r) => r.ruleId));
      form.normRules = draft.form.normRules.filter((r) => r.isNew || ids.has(r.ruleId));
    } else if (section === 'cashOverrides') {
      const ids = new Set(saved.cashOverrides.filter((r) => !r.isNew).map((r) => r.overrideId));
      form.cashOverrides = withAllRows(
        draft.form.cashOverrides.filter((r) => r.isNew || ids.has(r.overrideId)),
      );
    } else if (section === 'ownerLabels') form.ownerLabels = draft.form.ownerLabels;
    else form.statMinMonths = draft.form.statMinMonths;
  }
  return same(form, saved) ? null : { base: saved, form };
}

/** 端末の下書きを読み、保存済みの値に重ねる。捨てる条件に当たれば null */
function readDraft(key: string, saved: SettingsForm, now: number): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    const savedAt =
      isRecord(value) && typeof value.savedAt === 'string' ? Date.parse(value.savedAt) : Number.NaN;
    const sections = isRecord(value) ? sectionsOf(value) : null;
    if (
      !isRecord(value) ||
      value.v !== 1 ||
      Number.isNaN(savedAt) ||
      now - savedAt > DRAFT_TTL_MS ||
      !sections
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return rebaseDraft({ base: saved, form: { ...saved, ...sections } }, saved);
  } catch {
    // 壊れた下書きは捨てる (保存済みの値から始める)
    return null;
  }
}

function persistDraft(key: string, draft: Draft | null, baseSavedAt: string | null): void {
  try {
    if (!draft) {
      localStorage.removeItem(key);
      return;
    }
    const stored: StoredDraft = { v: 1, savedAt: new Date().toISOString(), baseSavedAt };
    for (const section of SECTIONS)
      if (!same(draft.form[section], draft.base[section]))
        Object.assign(stored, { [section]: draft.form[section] });
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // localStorage が使えない環境でも入力と保存はできる
  }
}

/**
 * 設定画面の入力と下書き。userId と保存済みの値が揃うまでは下書きを読み書きしない
 * (読込前の空の状態で、端末に残った下書きを消さないため)。
 */
export function useSettingsDraft({
  userId,
  saved,
  savedAt,
}: {
  userId: string | null;
  saved: SettingsForm | null;
  /** 保存済みの revision。下書きに baseSavedAt として残す */
  savedAt: string | null;
}) {
  const key = userId ? settingsDraftKey(userId) : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const latest = useRef({ key, readyKey, draft, savedAt });
  latest.current = { key, readyKey, draft, savedAt };
  const savedSignature = saved ? JSON.stringify(saved) : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 利用者か保存済みの値が変わったときだけ合わせ直す。
  useEffect(() => {
    if (!key || !saved) return;
    if (latest.current.readyKey !== key) {
      setDraft(readDraft(key, saved, Date.now()));
      setReadyKey(key);
      return;
    }
    setDraft((current) => (current ? rebaseDraft(current, saved) : null));
  }, [key, savedSignature]);

  // 入力が止まって 800ms 後に下書きへ書く。保存済みの値に戻したら下書きを消す
  useEffect(() => {
    if (!key || readyKey !== key) return;
    const timer = window.setTimeout(() => persistDraft(key, draft, savedAt), DRAFT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, readyKey, draft, savedAt]);

  // 書込み待ちの間にタブを閉じたり画面を離れても、最後の入力を失わない
  useEffect(() => {
    const flush = () => {
      const current = latest.current;
      if (current.key && current.readyKey === current.key)
        persistDraft(current.key, current.draft, current.savedAt);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const form = draft?.form ?? saved;

  /** 入力を変える。保存済みと同じ形に戻ったら下書きは無い */
  const update = useCallback(
    (change: (current: SettingsForm) => SettingsForm) => {
      if (!saved) return;
      setDraft((current) => {
        const next = change(current?.form ?? saved);
        return same(next, saved) ? null : { base: current?.base ?? saved, form: next };
      });
    },
    [saved],
  );

  /** 下書きを捨てる (変更をリセット・保存成功・復元成功) */
  const discard = useCallback(() => {
    setDraft(null);
    if (key) persistDraft(key, null, null);
  }, [key]);

  const count = useMemo(() => (saved && form ? unsavedCount(saved, form) : 0), [saved, form]);
  return { form, update, discard, count, hasDraft: draft != null };
}
