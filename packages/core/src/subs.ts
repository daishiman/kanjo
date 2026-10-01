/**
 * サブスクのベンダー登録(名前+別名+対象科目)と、未登録の支払先から「サブスクらしい」候補を採点する純関数。
 * - 登録ベンダーは既定では勘定科目に関係なく、その支払先への支出をサブスクとして集計する
 *   (同じベンダーが「支払手数料」「新聞図書費」など複数科目に跨って記帳されている実データに合わせた判断)。
 * - ただし accounts を指定したベンダーは、その勘定科目で記帳された支出だけを数える
 *   (Amazon のように物販とサブスクが同じ取引先名で混ざる支払先のため)。
 * - 名前は正規化キーの完全一致、別名は部分一致(支払先に別名が含まれれば一致)。
 */
import { monthIndex } from './month.js';
import { mean, std } from './stats.js';
import type { Dataset, FreeeDeal } from './types.js';

/** 保存するベンダー別名の上限。統合後の実効 aliases には適用しない */
export const SUB_VENDOR_ALIASES_MAX = 50;
/** 対象勘定科目の件数と1件の長さ、カテゴリの上書きの長さ。登録の保存と JSON 復元が同じ値で検査する */
export const SUB_VENDOR_ACCOUNTS_MAX = 30;
export const SUB_VENDOR_ACCOUNT_NAME_MAX = 60;
export const SUB_VENDOR_CATEGORY_MAX = 20;

export interface SubVendor {
  name: string;
  aliases: string[];
  /** 照合時だけ使う統合元の正規名。保存 aliases とは別に完全一致の優先度を保つ */
  exactNames?: string[];
  /**
   * この勘定科目の原本名で記帳されたときだけサブスクに数える。
   * 旧バックアップの正規化後ラベル・原本/正規化の複合参照も読み取り時は互換照合する。
   * 空配列・未指定なら従来どおり全科目を数える。
   */
  accounts?: string[];
}

export interface SubVendorAccountRef {
  /** freee仕訳の原本科目名。永続参照の正本 */
  raw: string;
  /** 現在の表示・集計用正規化ラベル。旧保存値との後方互換にだけ使う */
  normalized: string;
}

/** 大小文字・全半角・空白・記号の違いを吸収した照合キー */
export function vendorKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[株式会社(有)(株)(株)(有)合同会社,.、。・･\-–—_/]/g, '');
}

/** 対象科目を指定していない(=全科目)か、その科目が対象に入っているベンダーだけを残す */
const eligibleForAccount = (
  vendors: readonly SubVendor[],
  account: string | SubVendorAccountRef | undefined,
): readonly SubVendor[] =>
  account === undefined
    ? vendors
    : vendors.filter((v) => {
        if (!v.accounts?.length) return true;
        if (typeof account === 'string') return v.accounts.includes(account);
        return (
          v.accounts.includes(account.raw) ||
          v.accounts.includes(account.normalized) ||
          v.accounts.includes(`${account.raw}/${account.normalized}`)
        );
      });

/**
 * 支払先が登録ベンダーのどれに当たるか。該当なしは null。
 * account を渡すとベンダーごとの対象科目で絞り込む(省略時は科目を見ず、名前・別名だけで照合する)。
 * 科目での絞り込みは照合の「前」に行う。後で弾くと、科目違いのベンダーが先にヒットしたときに
 * 本来一致すべき別のベンダーを取りこぼすため。
 */
export function matchSubVendor(
  partner: string,
  vendors: readonly SubVendor[],
  account?: string | SubVendorAccountRef,
): string | null {
  const k = vendorKey(partner);
  if (!k) return null;
  const eligible = eligibleForAccount(vendors, account);
  for (const v of eligible) {
    if (vendorKey(v.name) === k || v.exactNames?.some((name) => vendorKey(name) === k)) return v.name;
  }
  for (const v of eligible) {
    for (const a of v.aliases) {
      const ak = vendorKey(a);
      if (ak && k.includes(ak)) return v.name;
    }
  }
  return null;
}

export interface SubsCandidate {
  partner: string;
  /** 支払があった月数 */
  activeMonths: number;
  /** 初回〜最終月の月数(連続性の分母) */
  spanMonths: number;
  count: number;
  total: number;
  /** 支払があった月の平均月額 */
  avgMonthly: number;
  /** 月額のブレ(CV)。小さいほど定額 */
  cv: number;
  accounts: string[];
  lastMonth: string;
  /** サブスクらしさ 0〜100 */
  score: number;
  /** 採点の根拠(画面にそのまま出す) */
  reasons: string[];
}

/**
 * 登録外の支払先を「サブスクらしさ」順に並べる。
 * 採点: 毎月続いている(連続率) 50点 / 金額が一定(CV) 30点 / 科目がサブスク・通信 20点。
 * 1ヶ月しか出ていない支払先は候補にしない(単発の買い物)。
 * excludedPartners に入れた支払先(「サブスクではない」と記録したもの)は候補から外す。
 * 候補は上位 limit 件しか出ないため、除外できないと本当に見たい候補が埋もれる。
 * vendors は統合元を別の行に残した保存行のままでもよい。登録済みの判定は統合を根へ畳んでから行う
 * (統合元の名前は完全一致の優先度を保ちつつ根の別名にもなる。畳まずに照合すると候補にも出る)。
 */
export function subsCandidates(
  deals: FreeeDeal[],
  vendors: readonly (SubVendor | SubVendorRecord)[],
  limit = 20,
  excludedPartners: string[] = [],
): SubsCandidate[] {
  const registered = matchableVendors(vendors);
  const excluded = new Set(excludedPartners.map(vendorKey).filter(Boolean));
  const groups = new Map<
    string,
    { partner: string; byMonth: Map<string, number>; count: number; accounts: Set<string> }
  >();
  for (const d of deals) {
    if (d.io !== 'expense' || d.amount <= 0) continue;
    const partner = d.partner.trim();
    // 登録済みかどうかは科目を見ずに判定する。対象科目を絞ったベンダーでも「登録済み」であることに変わりはなく、
    // 候補に出しても「これはサブスク」で二重登録になるだけのため。
    if (!partner || matchSubVendor(partner, registered)) continue;
    const key = vendorKey(partner);
    if (!key || excluded.has(key)) continue;
    let g = groups.get(key);
    if (!g) {
      g = { partner, byMonth: new Map(), count: 0, accounts: new Set() };
      groups.set(key, g);
    }
    g.byMonth.set(d.month, (g.byMonth.get(d.month) ?? 0) + d.amount);
    g.count++;
    g.accounts.add(d.accountNorm || d.accountRaw);
  }
  const out: SubsCandidate[] = [];
  for (const g of groups.values()) {
    const months = [...g.byMonth.keys()].sort();
    if (months.length < 2) continue;
    const amounts = months.map((m) => g.byMonth.get(m) ?? 0);
    const span = monthIndex(months[months.length - 1]) - monthIndex(months[0]) + 1;
    const continuity = months.length / span;
    const avg = mean(amounts);
    const cv = avg > 0 ? std(amounts) / avg : 0;
    const isSubsAccount = g.accounts.has('サブスク・通信');
    const reasons: string[] = [];
    let score = 0;
    const contPts = Math.round(50 * continuity);
    score += contPts;
    reasons.push(`${span}ヶ月中${months.length}ヶ月に支払`);
    const cvPts = Math.round(30 * Math.max(0, 1 - Math.min(cv, 1)));
    score += cvPts;
    reasons.push(cv < 0.15 ? '毎回ほぼ同額' : cv < 0.6 ? '金額は準変動' : '金額のブレが大きい');
    if (isSubsAccount) {
      score += 20;
      reasons.push('科目がサブスク・通信');
    }
    out.push({
      partner: g.partner,
      activeMonths: months.length,
      spanMonths: span,
      count: g.count,
      total: amounts.reduce((s, x) => s + x, 0),
      avgMonthly: Math.round(avg),
      cv: Math.round(cv * 100) / 100,
      accounts: [...g.accounts].sort(),
      lastMonth: months[months.length - 1],
      score,
      reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total).slice(0, limit);
}

/**
 * 候補をどこまで自動で信じてよいか。
 *
 * 点数(0〜100)をそのまま出しても「何点なら登録していいのか」が分からず、結局1件ずつ考えることになる。
 * そこで3段階に丸めて、まとめて登録できるものと、目で見るものを分ける。
 *
 * - sure   … 取込直後にまとめて登録してよい。あとから「登録を外す」で戻せる
 * - likely … 1件ずつ確かめる。中身は合っていることが多いが、単発の可能性も残る
 * - weak   … 既定では出さない。探しにきた人だけが見る
 */
export type SubsConfidence = 'sure' | 'likely' | 'weak';

export const SUBS_CONFIDENCE_LABEL: Record<SubsConfidence, string> = {
  sure: 'ほぼ確実',
  likely: 'たぶんサブスク',
  weak: '可能性は低い',
};

/**
 * 判定の根拠は score だけに頼らない。
 * score は連続率・金額の一定さ・科目の3つを足した合成値なので、
 * 「たまたま合計が高いだけ(3ヶ月連続だが金額はバラバラ)」を弾けない。
 * 実際に効くのは「毎月続いている」ことなので、連続率と月数も一緒に見る。
 */
export function subsConfidence(c: SubsCandidate): SubsConfidence {
  const continuity = c.spanMonths > 0 ? c.activeMonths / c.spanMonths : 0;

  /*
   * sure は3条件をすべて満たしたときだけ。and で繋ぐのは、どれか1つでは言い切れないため。
   *   - 3ヶ月以上   … 2ヶ月連続は「先月と今月たまたま買った」で普通に起きる
   *   - 連続率 0.8以上 … 抜けが1〜2割まで。年払いや隔月の契約はここで likely に落ちる
   *   - CV 0.25未満 … 毎回ほぼ同じ額。従量課金や物販が混ざると必ずこれを超える
   * 科目が「サブスク・通信」かどうかは条件に入れない。実データでは同じベンダーが
   * 支払手数料・新聞図書費に散っており、科目を必須にすると本命が軒並み likely に落ちる。
   */
  if (c.activeMonths >= 3 && continuity >= 0.8 && c.cv < 0.25) return 'sure';

  /*
   * weak は「期間の半分以下しか払っていない」ものだけに絞る。
   * 候補表は既定で全件出す(隠すと探しにきた人が見つけられない)ので、
   * ここは色を分けて後回しにする合図であって、除外ではない。
   */
  if (continuity <= 0.5 || c.activeMonths < 2) return 'weak';
  return 'likely';
}

/** まとめて登録してよい候補だけを取り出す */
export const autoRegisterable = (list: SubsCandidate[]): SubsCandidate[] =>
  list.filter((c) => subsConfidence(c) === 'sure');

/**
 * sub_vendors の1行。mergedIntoId は統合先の id を指し、null なら統合されていない。
 * 統合は行を消さずに付け替えるだけにして、取り消しで元の行へ戻せるようにしている。
 */
export interface SubVendorRecord extends SubVendor {
  id: number;
  mergedIntoId?: number | null;
}

/** 統合を解いた照合一覧 (根だけ) と、統合元を含む全ての名前 → 根の名前 */
export interface ResolvedSubVendors {
  vendors: SubVendor[];
  rootNameOf: ReadonlyMap<string, string>;
}

/** 自己統合・循環した統合。書き込み側が防ぐので、読めた時点で保存データが壊れている */
export class SubVendorMergeCycleError extends Error {
  constructor(readonly vendorName: string) {
    super(`サブスクの統合が循環しています: ${vendorName}`);
    this.name = 'SubVendorMergeCycleError';
  }
}

/**
 * 統合を根まで辿り、照合に使う一覧を作る。画面・再計算・支出の射影の3経路がこれを通すことで、
 * 同じ取引が同じ根へ割り当たる (統合元が一覧に残る不具合はこの1か所を通さない経路から起きていた)。
 * - 根は元の並び順を保つ。照合は先に並ぶベンダーを優先するため、並びを変えると割当てが動く
 * - 根の別名 = 根の別名 + 統合元の名前・別名。vendorKey で重複を除き、根の名前と同じものは足さない
 * - 統合元の正規名は exactNames にも保持し、第三ベンダーの部分一致より優先する
 * - 統合元の対象科目は足さない (統合の操作が和集合を根へ書き込むので、ここで足すと二重になる)
 * - 参照先の無い mergedIntoId は統合なしとして扱う
 */
export function resolveVendorMerges(rows: readonly SubVendorRecord[]): ResolvedSubVendors {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const rootOf = (row: SubVendorRecord): SubVendorRecord => {
    const seen = new Set<number>([row.id]);
    let current = row;
    for (;;) {
      const nextId = current.mergedIntoId;
      if (nextId == null) return current;
      if (seen.has(nextId)) throw new SubVendorMergeCycleError(row.name);
      const next = byId.get(nextId);
      if (!next) return current;
      seen.add(nextId);
      current = next;
    }
  };

  const rootNameOf = new Map<string, string>();
  const mergedInto = new Map<number, SubVendorRecord[]>();
  for (const row of rows) {
    const root = rootOf(row);
    rootNameOf.set(row.name, root.name);
    if (root !== row) mergedInto.set(root.id, [...(mergedInto.get(root.id) ?? []), row]);
  }

  const vendors = rows
    .filter((row) => rootOf(row) === row)
    .map((root) => {
      const rootKey = vendorKey(root.name);
      const seen = new Set<string>();
      const aliases: string[] = [];
      const add = (alias: string, fromSource: boolean) => {
        const key = vendorKey(alias);
        // 根の名前と同じ別名を統合元から足すと、根の完全一致が部分一致へ広がるので足さない
        if (!key || seen.has(key) || (fromSource && key === rootKey)) return;
        seen.add(key);
        aliases.push(alias);
      };
      for (const alias of root.aliases) add(alias, false);
      for (const source of mergedInto.get(root.id) ?? []) {
        add(source.name, true);
        for (const alias of source.aliases) add(alias, true);
      }
      const sources = mergedInto.get(root.id) ?? [];
      return {
        name: root.name,
        aliases,
        accounts: [...(root.accounts ?? [])],
        ...(sources.length ? { exactNames: sources.map((source) => source.name) } : {}),
      };
    });
  return { vendors, rootNameOf };
}

/**
 * 解決済みの照合一覧 (根だけ) を Dataset.subs の別名・完全一致名・対象科目の表へ写す (subVendorDefs の逆向き)。
 * 読み出し・バックアップ・JSON 復元・subs 範囲の組み立てが同じ表を持つよう、この1か所で作る。
 * vendors の列は含めない。読み出しは集計キャッシュに残る登録外の名前も並べるので、呼び出し側が決める
 */
export function subsDefinitionsOf(
  resolved: ResolvedSubVendors,
): Required<Pick<Dataset['subs'], 'aliases' | 'exactNames' | 'accounts'>> {
  return {
    aliases: Object.fromEntries(resolved.vendors.map((vendor) => [vendor.name, vendor.aliases])),
    exactNames: Object.fromEntries(resolved.vendors.map((vendor) => [vendor.name, vendor.exactNames ?? []])),
    accounts: Object.fromEntries(resolved.vendors.map((vendor) => [vendor.name, vendor.accounts ?? []])),
  };
}

const isVendorRecord = (vendor: SubVendor | SubVendorRecord): vendor is SubVendorRecord =>
  'id' in vendor && typeof vendor.id === 'number';

/** 統合を含む保存行なら根へ畳んだ照合一覧を、統合を含まない (解決済みを含む) 一覧ならそのまま返す */
function matchableVendors(vendors: readonly (SubVendor | SubVendorRecord)[]): SubVendor[] {
  const records = vendors.filter(isVendorRecord);
  const hasMerge = records.length === vendors.length && records.some((row) => row.mergedIntoId != null);
  return hasMerge ? resolveVendorMerges(records).vendors : [...vendors];
}
