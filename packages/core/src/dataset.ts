/**
 * データセット操作（取込の洗い替え・月枠の確保・JSON入出力）。
 * HTML版 ensureMonth / importFreee / importMF / importJSON の挙動を忠実に移植。
 */
import { isCashTxId } from './cash.js';
import { applyClassification, overridesFromEdits } from './classify.js';
import { type SubVendor, matchSubVendor } from './subs.js';
import {
  type Cls,
  type Dataset,
  type FreeeDeal,
  type MfTx,
  OWNER_SCHEMA_VERSION,
  type Owner,
  type OwnerKey,
  type OwnerMonth,
  type Rule,
  type TxEdit,
  normalizeOwner,
} from './types.js';

const normalizeEdit = (edit: TxEdit): TxEdit => ({ ...edit, owner: normalizeOwner(edit.owner) });

const normalizeInstitutionOwners = (value: unknown): Record<string, Owner> => {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, Owner> = {};
  for (const [institution, rawOwner] of Object.entries(value as Record<string, unknown>)) {
    const owner = normalizeOwner(rawOwner);
    // null/empty is the explicit legacy spelling for "no mapping"; do not carry
    // it toward institution_owners.owner NOT NULL.
    if (owner) result[institution] = owner;
  }
  return result;
};

const normalizeOwnerMonths = (value: unknown): Record<string, Record<OwnerKey, OwnerMonth>> => {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, Record<OwnerKey, OwnerMonth>> = {};
  for (const [month, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const source = raw as Record<string, OwnerMonth | undefined>;
    for (const key of Object.keys(source)) {
      if (!['business', 'self', 'spouse', 'family', 'unset'].includes(key)) normalizeOwner(key);
    }
    result[month] = {
      business: source.business ?? source.self ?? { income: 0, expense: 0 },
      spouse: source.spouse ?? { income: 0, expense: 0 },
      family: source.family ?? { income: 0, expense: 0 },
      unset: source.unset ?? { income: 0, expense: 0 },
    };
  }
  return result;
};

export function ensureMonth(data: Dataset, m: string): number {
  if (!data.months.includes(m)) {
    data.months.push(m);
    data.months.sort();
    const i = data.months.indexOf(m);
    data.biz.revenue.splice(i, 0, 0);
    data.biz.categories.forEach((c) => data.biz.expense[c].splice(i, 0, 0));
    data.subs.vendors.forEach((v) => data.subs.matrix[v].splice(i, 0, 0));
    data.subs.other.splice(i, 0, 0);
  }
  return data.months.indexOf(m);
}

/** Dataset の登録ベンダーを照合用の定義に変換する */
export function subVendorDefs(data: Dataset): SubVendor[] {
  return data.subs.vendors.map((name) => ({
    name,
    aliases: data.subs.aliases?.[name] ?? [],
    accounts: data.subs.accounts?.[name] ?? [],
  }));
}

/**
 * freee仕訳を月単位洗い替えで反映する。
 * 対象月の売上・科目別経費・サブスクベンダー行列をゼロクリアしてから加算（HTML版と同一）。
 * 取り込んだ月は未記帳月から解除する。
 */
export function applyFreeeDeals(data: Dataset, deals: FreeeDeal[], months: string[]): void {
  const vendorDefs = subVendorDefs(data);
  months.forEach((m) => {
    const i = ensureMonth(data, m);
    data.biz.revenue[i] = 0;
    data.biz.categories.forEach((c) => {
      data.biz.expense[c][i] = 0;
    });
    data.subs.vendors.forEach((v) => {
      data.subs.matrix[v][i] = 0;
    });
    data.subs.other[i] = 0;
  });
  deals.forEach((dl) => {
    const i = ensureMonth(data, dl.month);
    const acct = dl.accountNorm;
    if (dl.io === 'income') {
      data.biz.revenue[i] += dl.amount;
    } else {
      if (!data.biz.categories.includes(acct)) {
        data.biz.categories.push(acct);
        data.biz.expense[acct] = data.months.map(() => 0);
      }
      data.biz.expense[acct][i] += dl.amount;
      // 登録ベンダーへの支払は(対象科目を絞っていなければ)科目を問わずサブスクに数える。
      // 対象科目を絞ったベンダーの科目外の支払と、未登録の支払先は「サブスク・通信」科目の分だけ「その他」へ
      const vd = matchSubVendor(dl.partner || '', vendorDefs, {
        raw: dl.accountRaw,
        normalized: acct,
      });
      if (vd) data.subs.matrix[vd][i] += dl.amount;
      else if (acct === 'サブスク・通信') data.subs.other[i] += dl.amount;
    }
  });
  data.unrecordedExpMonths = data.unrecordedExpMonths.filter((m) => !months.includes(m));
}

/** MF明細を月単位洗い替えで反映し、公私仕分けを再計算する。現金の記帳(cash:*)は取込値ではないので洗い替えの対象外 */
export function applyMfTxs(data: Dataset, txs: MfTx[]): void {
  const monthsIn = new Set(txs.map((t) => t.m));
  data.mfTx = data.mfTx.filter((t) => !monthsIn.has(t.m) || isCashTxId(t.id)).concat(txs);
  recomputeClassification(data);
}

/** ルール・手動判定・明細の現状から personal / bizPersonal を再生成する */
export function recomputeClassification(data: Dataset): void {
  data.overrides = overridesFromEdits(data.edits);
  const r = applyClassification(data.mfTx, data.rules, data.edits, data.institutionOwners);
  // mfTxが無い月（JSON復元のみの月）の集計は温存する
  data.personal = { ...data.personal, ...r.personal };
  data.bizPersonal = { ...data.bizPersonal, ...r.bizPersonal };
  data.personalByOwner = { ...data.personalByOwner, ...r.personalByOwner };
}

/** HTML版互換の統合JSONを取り込む（初期移行用） */
export function importJSON(data: Dataset, obj: Record<string, unknown>): void {
  if (obj.months) data.months = obj.months as string[];
  if (obj.biz) data.biz = obj.biz as Dataset['biz'];
  if (obj.subs) {
    // HTML版JSONには別名・対象科目が無いので、既存の登録内容は保持する
    const prevAliases = data.subs.aliases ?? {};
    const prevAccounts = data.subs.accounts ?? {};
    data.subs = {
      aliases: prevAliases,
      accounts: prevAccounts,
      ...(obj.subs as Omit<Dataset['subs'], 'aliases' | 'accounts'>),
    };
  }
  if (obj.personal) data.personal = obj.personal as Dataset['personal'];
  if (obj.budgets) data.budgets = obj.budgets as Record<string, number>;
  if (obj.cashOverride) data.cashOverride = obj.cashOverride as Dataset['cashOverride'];
  if (obj.mfTx) data.mfTx = obj.mfTx as MfTx[];
  if (obj.rules) {
    // HTML版のルールは {k, cls}。古い形式 {keyword, cls} も許容
    data.rules = (
      obj.rules as Array<{
        k?: string;
        keyword?: string;
        cls?: Cls | null;
        big?: string | null;
        mid?: string | null;
        owner?: Owner | null;
      }>
    ).map((r) => ({
      k: r.k ?? r.keyword ?? '',
      cls: r.cls ?? null,
      big: r.big ?? null,
      mid: r.mid ?? null,
      owner: normalizeOwner(r.owner),
    })) as Rule[];
  }
  // 新形式 edits を優先。HTML版の overrides({id: cls}) は cls だけの編集として取り込む
  if (obj.edits) {
    data.edits = Object.fromEntries(
      Object.entries(obj.edits as Record<string, TxEdit>).map(([id, edit]) => [id, normalizeEdit(edit)]),
    );
  } else if (obj.overrides) {
    data.edits = {};
    for (const [id, cls] of Object.entries(obj.overrides as Record<string, Cls>)) data.edits[id] = { cls };
  }
  if (obj.institutionOwners) data.institutionOwners = normalizeInstitutionOwners(obj.institutionOwners);
  if (obj.personalByOwner) data.personalByOwner = normalizeOwnerMonths(obj.personalByOwner);
  if (obj.bizPersonal) data.bizPersonal = obj.bizPersonal as Dataset['bizPersonal'];
  if (obj.unrecordedExpMonths) data.unrecordedExpMonths = [...(obj.unrecordedExpMonths as string[])];
  recomputeClassification(data);
}

/** HTML版互換の統合JSONへ書き出す */
export function exportJSON(data: Dataset): Record<string, unknown> {
  return {
    months: data.months,
    biz: data.biz,
    subs: data.subs,
    personal: data.personal,
    bizPersonal: data.bizPersonal,
    // 個人分の現金明細(cash:*)は cash_entries が正本なので、取込明細の写しには含めない
    mfTx: data.mfTx.filter((t) => !isCashTxId(t.id)),
    rules: data.rules,
    overrides: data.overrides,
    edits: data.edits,
    institutionOwners: data.institutionOwners,
    personalByOwner: data.personalByOwner,
    ownerSchemaVersion: OWNER_SCHEMA_VERSION,
    budgets: data.budgets,
    cashOverride: data.cashOverride,
    unrecordedExpMonths: data.unrecordedExpMonths,
    exportedAt: new Date().toISOString(),
  };
}
