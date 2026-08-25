/**
 * 公私仕分けと属性の解決。
 * 優先順位（属性ごと）: 手動編集(edits) > ルール(配列順で先勝ち。その属性を持つルールだけ対象) > 既定
 *   - cls  の既定: 'per'
 *   - big/mid の既定: 取込値（MFの大項目/中項目）
 *   - owner の既定: 保有金融機関→名義の設定（institutionOwners）。無ければ null（未設定）
 * 取込値と手動編集は別枠で持ち、表示・集計では「編集があればそれを、なければ取込値を」使う。
 */
import type {
  BizPersonalMonth,
  Classification,
  Cls,
  MfTx,
  Owner,
  OwnerKey,
  OwnerMonth,
  PersonalMonth,
  Rule,
  TxEdit,
} from './types.js';

export type AttrSrc = '手動' | 'ルール' | '口座' | '取込値' | '既定';

/** 明細1件の解決結果（表示・集計の共通入力） */
export interface ResolvedTx {
  cls: Cls;
  clsSrc: '手動' | 'ルール' | '既定';
  big: string;
  mid: string;
  catSrc: '手動' | 'ルール' | '取込値';
  owner: Owner | null;
  ownerSrc: '手動' | 'ルール' | '口座' | '既定';
  /** 手動編集の有無（どれか1属性でも） */
  edited: boolean;
  /** 編集時点の取込値と現在の取込値が違う（再取込でMF側の分類が変わった） */
  conflict: boolean;
}

const hayOf = (t: MfTx): string => `${t.c || ''}|${t.big || ''}|${t.mid || ''}`.toUpperCase();

export const ruleMatches = (t: MfTx, r: Rule): boolean => !!r.k && hayOf(t).includes(r.k.toUpperCase());

/** HTML版互換の公私判定（overrides = 手動のclsだけを抜き出した写像） */
export function classifyTx(t: MfTx, rules: Rule[], overrides: Record<string, Cls>): Classification {
  if (overrides[t.id]) return { cls: overrides[t.id], src: '手動' };
  for (const r of rules) {
    if (r.cls && ruleMatches(t, r)) return { cls: r.cls, src: 'ルール' };
  }
  return { cls: 'per', src: '既定' };
}

/** 全属性を優先順位に従って解決する */
export function resolveTx(
  t: MfTx,
  rules: Rule[],
  edits: Record<string, TxEdit>,
  institutionOwners: Record<string, Owner> = {},
): ResolvedTx {
  const e = edits[t.id];
  const hay = hayOf(t);
  const firstRule = <K extends 'cls' | 'big' | 'mid' | 'owner'>(key: K): Rule[K] | undefined => {
    for (const r of rules) {
      if (r[key] != null && r[key] !== '' && r.k && hay.includes(r.k.toUpperCase())) return r[key];
    }
    return undefined;
  };

  let cls: Cls = 'per';
  let clsSrc: ResolvedTx['clsSrc'] = '既定';
  if (e?.cls) {
    cls = e.cls;
    clsSrc = '手動';
  } else {
    const rc = firstRule('cls');
    if (rc) {
      cls = rc;
      clsSrc = 'ルール';
    }
  }

  let big = t.big || '';
  let mid = t.mid || '';
  let catSrc: ResolvedTx['catSrc'] = '取込値';
  const editedCat = (e?.big != null && e.big !== '') || (e?.mid != null && e.mid !== '');
  if (editedCat) {
    big = e?.big || big;
    mid = e?.mid || mid;
    catSrc = '手動';
  } else {
    const rb = firstRule('big');
    const rm = firstRule('mid');
    if (rb || rm) {
      big = rb || big;
      mid = rm || mid;
      catSrc = 'ルール';
    }
  }

  let owner: Owner | null = null;
  let ownerSrc: ResolvedTx['ownerSrc'] = '既定';
  if (e?.owner) {
    owner = e.owner;
    ownerSrc = '手動';
  } else {
    const ro = firstRule('owner');
    if (ro) {
      owner = ro;
      ownerSrc = 'ルール';
    } else if (t.inst && institutionOwners[t.inst]) {
      owner = institutionOwners[t.inst];
      ownerSrc = '口座';
    }
  }

  const edited = !!e && (!!e.cls || editedCat || !!e.owner);
  const conflict =
    editedCat && ((e?.baseBig ?? null) !== null || (e?.baseMid ?? null) !== null)
      ? (e?.baseBig ?? '') !== (t.big || '') || (e?.baseMid ?? '') !== (t.mid || '')
      : false;
  return { cls, clsSrc, big, mid, catSrc, owner, ownerSrc, edited, conflict };
}

/** edits から HTML版互換の overrides（手動cls）を導出する */
export function overridesFromEdits(edits: Record<string, TxEdit>): Record<string, Cls> {
  const out: Record<string, Cls> = {};
  for (const [id, e] of Object.entries(edits)) if (e.cls) out[id] = e.cls;
  return out;
}

export interface ClassificationResult {
  personal: Record<string, PersonalMonth>;
  bizPersonal: Record<string, BizPersonalMonth>;
  /** 個人分の名義別（本人/妻/未設定）収入・支出 */
  personalByOwner: Record<string, Record<OwnerKey, OwnerMonth>>;
}

const emptyOwners = (): Record<OwnerKey, OwnerMonth> => ({
  self: { income: 0, expense: 0 },
  spouse: { income: 0, expense: 0 },
  unset: { income: 0, expense: 0 },
});

/**
 * 全明細を月ごとに公私仕分けして集計する。
 * per: 収入=中項目別 / 支出=大項目別（絶対値。どちらも解決後の値）。biz: 収入合計=事業入金 / 支出合計=事業立替。
 */
export function applyClassification(
  mfTx: MfTx[],
  rules: Rule[],
  edits: Record<string, TxEdit>,
  institutionOwners: Record<string, Owner> = {},
): ClassificationResult {
  const byM: Record<string, MfTx[]> = {};
  mfTx.forEach((t) => {
    byM[t.m] ??= [];
    byM[t.m].push(t);
  });
  const personal: Record<string, PersonalMonth> = {};
  const bizPersonal: Record<string, BizPersonalMonth> = {};
  const personalByOwner: Record<string, Record<OwnerKey, OwnerMonth>> = {};
  Object.keys(byM).forEach((m) => {
    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    const owners = emptyOwners();
    let bIn = 0;
    let bOut = 0;
    byM[m].forEach((t) => {
      const r = resolveTx(t, rules, edits, institutionOwners);
      if (r.cls === 'biz') {
        if (t.a > 0) bIn += t.a;
        else bOut += -t.a;
        return;
      }
      const ok: OwnerKey = r.owner ?? 'unset';
      if (t.a > 0) {
        const k = r.mid || 'その他';
        inc[k] = (inc[k] || 0) + t.a;
        owners[ok].income += t.a;
      } else {
        const k = r.big || '未分類';
        exp[k] = (exp[k] || 0) - t.a;
        owners[ok].expense += -t.a;
      }
    });
    personal[m] = { income: inc, expense: exp };
    bizPersonal[m] = { income: bIn, expense: bOut };
    personalByOwner[m] = owners;
  });
  return { personal, bizPersonal, personalByOwner };
}
