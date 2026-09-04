/**
 * 公私仕分けと属性の解決。
 * 優先順位（属性ごと）: 手動編集 > ルール > materialize済みvendor memory > 既定。
 * vendor memory由来のeditだけは、後から効いたルールに譲る。
 *   - cls  の既定: 'per'
 *   - big/mid の既定: 取込値（MFの大項目/中項目）
 *   - owner の既定: 保有金融機関→名義の設定（institutionOwners）。無ければ null（未設定）
 * 取込値と手動編集は別枠で持ち、表示・集計では「編集があればそれを、なければ取込値を」使う。
 */
import {
  TX_EDIT_BASE_BITS,
  type ThreeWayByAttr,
  conflictingAttrs,
  resolveThreeWayAttrs,
} from './three-way.js';
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
import {
  type VendorMemoryDisposition,
  type VendorMemoryRecord,
  judgeVendorMemory,
  normalizeVendorKey,
} from './vendor-memory.js';

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
  /** 振替後の口座(保有金融機関)。手当てが無ければ取込値そのまま。 */
  inst: string | null;
  instSrc: '手動' | '取込値';
  /** 手動編集の有無（どれか1属性でも） */
  edited: boolean;
  /**
   * 編集時点の取込値と現在の取込値が違う（再取込でMF側の分類が変わった）。
   * `threeWay` から導出した明細単位の要約であり、独立した判定ではない。
   * 既存の画面・API はこの真偽1つだけを読む（D02 の互換方針）。
   */
  conflict: boolean;
  /** 属性ごとの3点比較(DR-10)。どの属性が衝突したかはここだけが持つ。 */
  threeWay: ThreeWayByAttr;
}

const hayOf = (t: MfTx): string => `${t.c || ''}|${t.big || ''}|${t.mid || ''}`.toUpperCase();

export const ruleMatches = (t: MfTx, r: Rule): boolean => !!r.k && hayOf(t).includes(r.k.toUpperCase());

export type IncomingValueSource = 'rules' | 'vendor_memory' | 'import';

/**
 * tx_edit を除いた「今回入ってくる有効値」。
 *
 * MF原本は cls / owner を直接運ばない。その2属性を空欄扱いにせず、ルール、適用可能な
 * 取引先の決め事、取込/既定の順で解く。手動編集時のbaseと再取込のincomingは必ずこの
 * 関数を通し、同じ明細を経路ごとに別の基準で比較しない。
 */
export interface IncomingResolvedTx {
  cls: Cls;
  big: string;
  mid: string;
  owner: Owner | null;
  sources: Record<'cls' | 'big' | 'mid' | 'owner', IncomingValueSource>;
  vendorMemory: VendorMemoryRecord | null;
  vendorDisposition: VendorMemoryDisposition | null;
}

export function resolveIncomingTx(
  t: MfTx,
  rules: readonly Rule[],
  institutionOwners: Readonly<Record<string, Owner>> = {},
  vendorMemories: readonly VendorMemoryRecord[] = [],
): IncomingResolvedTx {
  const hay = hayOf(t);
  const firstRule = <K extends 'cls' | 'owner'>(key: K): Rule[K] | undefined => {
    for (const rule of rules) {
      if (rule[key] != null && rule.k && hay.includes(rule.k.toUpperCase())) {
        return rule[key];
      }
    }
    return undefined;
  };
  const categoryRule = rules.find(
    (rule) =>
      ((rule.big != null && rule.big !== '') || (rule.mid != null && rule.mid !== '')) &&
      rule.k &&
      hay.includes(rule.k.toUpperCase()),
  );

  // DBは利用者+vendor_keyを一意にするが、純関数へ壊れた入力が来ても黙って先勝ちしない。
  const memoryMatches = vendorMemories.filter((memory) => memory.vendorKey === normalizeVendorKey(t.c));
  const vendorMemory = memoryMatches.length === 1 ? memoryMatches[0]! : null;
  const vendorDisposition = vendorMemory ? judgeVendorMemory(vendorMemory).disposition : null;
  const eligibleMemory = vendorDisposition === 'auto-apply' ? vendorMemory : null;

  const ruleCls = firstRule('cls');
  const cls = ruleCls ?? eligibleMemory?.cls ?? 'per';
  const clsSource: IncomingValueSource = ruleCls ? 'rules' : eligibleMemory?.cls ? 'vendor_memory' : 'import';

  let big = t.big || '';
  let mid = t.mid || '';
  let bigSource: IncomingValueSource = 'import';
  let midSource: IncomingValueSource = 'import';
  if (categoryRule) {
    // 科目は1本のルールが組として所有する。下位の決め事と半分ずつ混ぜない。
    if (categoryRule.big) {
      big = categoryRule.big;
      mid = categoryRule.mid || '';
      bigSource = 'rules';
      midSource = 'rules';
    } else if (categoryRule.mid) {
      mid = categoryRule.mid;
      midSource = 'rules';
    }
  } else {
    if (eligibleMemory?.big) {
      big = eligibleMemory.big;
      bigSource = 'vendor_memory';
      mid = eligibleMemory.mid || '';
      midSource = 'vendor_memory';
    } else if (eligibleMemory?.mid) {
      mid = eligibleMemory.mid;
      midSource = 'vendor_memory';
    }
  }

  const ruleOwner = firstRule('owner');
  const accountOwner = t.inst ? institutionOwners[t.inst] : undefined;
  const owner = ruleOwner ?? eligibleMemory?.owner ?? accountOwner ?? null;
  const ownerSource: IncomingValueSource = ruleOwner
    ? 'rules'
    : eligibleMemory?.owner
      ? 'vendor_memory'
      : 'import';

  return {
    cls,
    big,
    mid,
    owner,
    sources: { cls: clsSource, big: bigSource, mid: midSource, owner: ownerSource },
    vendorMemory,
    vendorDisposition,
  };
}

/** HTML版互換の公私判定（overrides = 手動のclsだけを抜き出した写像） */
export function classifyTx(t: MfTx, rules: Rule[], overrides: Record<string, Cls>): Classification {
  if (overrides[t.id]) return { cls: overrides[t.id], src: '手動' };
  for (const r of rules) {
    if (r.cls && ruleMatches(t, r)) return { cls: r.cls, src: 'ルール' };
  }
  return { cls: 'per', src: '既定' };
}

/**
 * 名義の既定(institutionOwners)を引くときに、どちらの口座を根拠にするか。
 *
 * 口座を振り替えた明細は「取込時の口座」と「振替後の口座」の2つを持つ。名義の既定は
 * 口座→名義の対応表から引くので、どちらを根拠にするかで既定の名義が変わりうる。
 * 手動で名義を指定した明細はどちらでも結果が同じ(手動が最優先)なので、効くのは
 * 名義を指定していない明細だけである。
 *
 * @param t 取込のままの明細(t.inst は取込値)
 * @param resolvedInst 振替後の口座。振替していなければ t.inst と同じ
 */
function ownerBasisTx(t: MfTx, resolvedInst: string | null): MfTx {
  // 振替後の口座で引く。取込時の口座で引くと、口座を直したあとも名義が前の口座に紐づいたままになり、
  // 画面の「口座」由来バッジが指す口座と実際の引き当て先が食い違う。名義を手で決めた明細は
  // 手動が最優先なのでここは効かず、動くのは名義を人がまだ決めていない明細だけである。
  return resolvedInst === (t.inst ?? null) ? t : { ...t, inst: resolvedInst ?? undefined };
}

/** 全属性を優先順位に従って解決する */
export function resolveTx(
  t: MfTx,
  rules: Rule[],
  edits: Record<string, TxEdit>,
  institutionOwners: Record<string, Owner> = {},
): ResolvedTx {
  const e = t.projectedEdit ?? edits[t.id];
  // 口座の振替は3点比較に載せない(TxEdit.inst の注記)。手当てがあればそれ、無ければ取込値。
  const editedInst = e?.inst != null && e.inst !== '' ? e.inst : null;
  const inst = editedInst ?? t.inst ?? null;
  const instSrc: ResolvedTx['instSrc'] = editedInst ? '手動' : '取込値';
  // vendor_memoryは取込確定時にprovenance付きtx_editへmaterializeする。
  // 表示だけ動的適用する第二経路を作らない。
  const ownerBasis = ownerBasisTx(t, inst);
  const incoming = resolveIncomingTx(ownerBasis, rules, institutionOwners);
  const vendorEdit = e?.origin === 'vendor_memory';

  let cls: Cls = incoming.cls;
  let clsSrc: ResolvedTx['clsSrc'] = incoming.sources.cls === 'rules' ? 'ルール' : '既定';
  if (e?.cls && (!vendorEdit || incoming.sources.cls !== 'rules')) {
    cls = e.cls;
    clsSrc = '手動';
  }

  let big = incoming.big;
  let mid = incoming.mid;
  let catSrc: ResolvedTx['catSrc'] =
    incoming.sources.big === 'rules' || incoming.sources.mid === 'rules' ? 'ルール' : '取込値';
  const editedCat = (e?.big != null && e.big !== '') || (e?.mid != null && e.mid !== '');
  // 科目は「大項目+中項目」を1組として上書きする。大項目を指定したら中項目は指定値(無ければ空)に置き換え、
  // 取込値の中項目が残って「事業科目なのにMFの中項目付き」のような系統違いにならないようにする
  const categoryRuled = incoming.sources.big === 'rules' || incoming.sources.mid === 'rules';
  if (editedCat && (!vendorEdit || !categoryRuled)) {
    if (e?.big) {
      big = e.big;
      mid = e.mid || '';
    } else {
      mid = e?.mid || mid;
    }
    catSrc = '手動';
  }

  let owner: Owner | null = incoming.owner;
  let ownerSrc: ResolvedTx['ownerSrc'] =
    incoming.sources.owner === 'rules'
      ? 'ルール'
      : ownerBasis.inst && institutionOwners[ownerBasis.inst]
        ? '口座'
        : '既定';
  if (e?.owner && (!vendorEdit || incoming.sources.owner !== 'rules')) {
    owner = e.owner;
    ownerSrc = '手動';
  }

  const edited = !!e && (!!e.cls || editedCat || !!e.owner || !!editedInst);
  const activeManualAttrs =
    (e?.cls ? TX_EDIT_BASE_BITS.cls : 0) |
    (editedCat ? TX_EDIT_BASE_BITS.big | TX_EDIT_BASE_BITS.mid : 0) |
    (e?.owner ? TX_EDIT_BASE_BITS.owner : 0);

  // 原本が直接運ばないcls/ownerも、編集baseと同じresolverの有効値をincomingにする。
  const threeWay = resolveThreeWayAttrs(
    {
      cls: e?.baseCls ?? null,
      big: e?.baseBig ?? null,
      mid: e?.baseMid ?? null,
      owner: e?.baseOwner ?? null,
    },
    { cls, big, mid, owner },
    { cls: incoming.cls, big: incoming.big, mid: incoming.mid, owner: incoming.owner },
    e?.baseKnown,
  );
  return {
    cls,
    clsSrc,
    big,
    mid,
    catSrc,
    owner,
    ownerSrc,
    inst,
    instSrc,
    edited,
    conflict: conflictingAttrs(threeWay).some((attr) => (activeManualAttrs & TX_EDIT_BASE_BITS[attr]) !== 0),
    threeWay,
  };
}

/** provenanceは保存値が実際に1属性以上寄与するときだけ表示する。 */
export function vendorMemoryEditContributes(
  t: MfTx,
  rules: readonly Rule[],
  edit: TxEdit | undefined,
): boolean {
  if (edit?.origin !== 'vendor_memory' || !edit.originKey) return false;
  const incoming = resolveIncomingTx(t, rules);
  const categoryRuled = incoming.sources.big === 'rules' || incoming.sources.mid === 'rules';
  return (
    (!!edit.cls && incoming.sources.cls !== 'rules') ||
    (!!edit.owner && incoming.sources.owner !== 'rules') ||
    ((!!edit.big || !!edit.mid) && !categoryRuled)
  );
}

/** edits から HTML版互換の overrides（手動cls）を導出する */
export function overridesFromEdits(edits: Record<string, TxEdit>): Record<string, Cls> {
  const out: Record<string, Cls> = {};
  for (const [id, e] of Object.entries(edits)) if (e.cls) out[id] = e.cls;
  return out;
}

/** 仕分けの進み具合（1ヶ月分）。金額ではなく「何件を人が見たか」を表す。 */
export interface ClassificationProgress {
  /** 対象件数 */
  total: number;
  /** 事業と判定された件数 */
  bizCount: number;
  /** 個人と判定された件数 */
  personalCount: number;
  /** 判定の出どころ別の件数。合計は total に一致する */
  bySource: { 手動: number; ルール: number; 既定: number };
  /**
   * まだ人もルールも触っていない件数（clsSrc === '既定'）。
   * cls の既定は 'per' なので「個人」に見えるが判断されたわけではない。ここが 0 なら当月の仕分けは一巡している。
   */
  reviewPending: number;
}

/**
 * 解決済み明細から仕分けの進み具合を数える。
 * 「未分類」という状態は resolveTx に無いため、残作業は clsSrc === '既定' で数える。
 */
export function classificationProgress(
  resolved: Pick<ResolvedTx, 'cls' | 'clsSrc'>[],
): ClassificationProgress {
  const bySource: ClassificationProgress['bySource'] = { 手動: 0, ルール: 0, 既定: 0 };
  let bizCount = 0;
  let personalCount = 0;
  for (const r of resolved) {
    bySource[r.clsSrc] += 1;
    if (r.cls === 'biz') bizCount += 1;
    else personalCount += 1;
  }
  return { total: resolved.length, bizCount, personalCount, bySource, reviewPending: bySource.既定 };
}

export interface ClassificationResult {
  personal: Record<string, PersonalMonth>;
  bizPersonal: Record<string, BizPersonalMonth>;
  /** 個人分の名義別（事業/妻/家族/未設定）収入・支出 */
  personalByOwner: Record<string, Record<OwnerKey, OwnerMonth>>;
}

const emptyOwners = (): Record<OwnerKey, OwnerMonth> => ({
  business: { income: 0, expense: 0 },
  spouse: { income: 0, expense: 0 },
  family: { income: 0, expense: 0 },
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
