/**
 * 科目候補(データ由来の二系統)と、公私に応じた組み合わせガード。
 *
 * - 事業(biz): freee の勘定科目(取込済みの freee 取引に実在する科目 + 設定で追加した事業科目)
 *   + 確定申告で一般に使う標準科目(TAX_ACCOUNTS)。中項目は持たない
 *   (freee の勘定科目は決算書の科目そのもの。品目列は任意入力のため候補にしない)。
 * - 個人(per): MF の大項目/中項目(取込済みの MF 明細に実在する組み合わせ + 設定で追加した家計科目)
 *   + 生活の標準費目(HOUSEHOLD_CATEGORIES。住まい・住宅ローン・税・保険など)。
 *
 * 標準の費目を混ぜるのは、取込済みの科目しか選べないと
 * 「まだその科目で払ったことがない支出」を記帳できないため。
 * 出どころ(source)は残し、実データに現れた科目は freee/MF 扱いを優先する。
 *
 * 事業には確定申告の標準科目(TAX_ACCOUNTS)、
 * 家計には生活の標準費目(HOUSEHOLD_CATEGORIES)を混ぜる。両者は別のマスタで、混ざらない。
 */
import { householdStandardPairs } from './household-categories.js';
import { TAX_ACCOUNTS } from './tax-accounts.js';
import type { Cls } from './types.js';

export type CategoryScope = Cls;
export type CandidateSource = 'freee' | 'mf' | 'custom' | 'standard';
export interface CandidateMid {
  name: string;
  source: CandidateSource;
}
export interface CandidateMajor {
  name: string;
  source: CandidateSource;
  mids: CandidateMid[];
}
export interface Candidates {
  biz: CandidateMajor[];
  per: CandidateMajor[];
}
export interface CategoryOption {
  scope: CategoryScope;
  major: string;
  mid: string;
}

const jaSort = (a: string, b: string) => a.localeCompare(b, 'ja');

/** 同名の科目が複数の出どころに現れたときに残すほう。実績 > 利用者が追加 > 最初から用意 */
const SOURCE_RANK: Record<CandidateSource, number> = { freee: 3, mf: 3, custom: 2, standard: 1 };

function buildScope(
  base: { big: string; mid: string }[],
  baseSource: CandidateSource,
  custom: { major: string; mid: string }[],
  standard: { big: string; mid: string }[] = [],
): CandidateMajor[] {
  const majors = new Map<string, { source: CandidateSource; mids: Map<string, CandidateSource> }>();
  const add = (big: string, mid: string, source: CandidateSource) => {
    const b = big.trim();
    const m = mid.trim();
    if (!b) return;
    let entry = majors.get(b);
    if (!entry) {
      entry = { source, mids: new Map() };
      majors.set(b, entry);
    } else if (SOURCE_RANK[source] > SOURCE_RANK[entry.source]) {
      entry.source = source; // 実データに現れたら「追加」「最初から用意」の扱いをやめる
    }
    if (!m) return;
    const cur = entry.mids.get(m);
    // 大項目と同じ理由で、中項目も実績のほうを残す
    if (cur === undefined || SOURCE_RANK[source] > SOURCE_RANK[cur]) entry.mids.set(m, source);
  };
  standard.forEach((p) => add(p.big, p.mid, 'standard'));
  base.forEach((p) => add(p.big, p.mid, baseSource));
  custom.forEach((o) => add(o.major, o.mid, 'custom'));
  return [...majors.entries()]
    .sort(([a], [b]) => jaSort(a, b))
    .map(([name, e]) => ({
      name,
      source: e.source,
      mids: [...e.mids.entries()]
        .sort(([a], [b]) => jaSort(a, b))
        .map(([n, source]) => ({ name: n, source })),
    }));
}

/** freee 勘定科目(名前の配列)と MF 明細(big/mid)から二系統の候補を作る */
export function buildCandidates(
  freeeAccounts: string[],
  mfPairs: { big: string; mid: string }[],
  options: CategoryOption[],
): Candidates {
  return {
    biz: buildScope(
      freeeAccounts.map((a) => ({ big: a, mid: '' })),
      'freee',
      options.filter((o) => o.scope === 'biz').map((o) => ({ major: o.major, mid: '' })),
      TAX_ACCOUNTS.map((a) => ({ big: a.name, mid: '' })),
    ),
    per: buildScope(
      mfPairs,
      'mf',
      options.filter((o) => o.scope === 'per'),
      householdStandardPairs(),
    ),
  };
}

/**
 * 公私に対して科目の組み合わせが会計上あり得るか。
 * - 事業: 大項目が freee 勘定科目の候補にあり、中項目は空
 * - 個人: 大項目が MF 候補にあり、中項目は空か、その大項目の候補にある
 */
export function categoryAllowed(
  cands: Candidates,
  cls: Cls,
  big: string | null,
  mid: string | null,
): boolean {
  const b = (big ?? '').trim();
  const m = (mid ?? '').trim();
  if (!b) return !m; // 科目未指定(取込値のまま)は常に可。中項目だけの指定は不可
  const major = cands[cls].find((x) => x.name === b);
  if (!major) return false;
  if (cls === 'biz') return !m;
  return !m || major.mids.some((x) => x.name === m);
}

/** 候補外のときに画面へ出す理由(1行) */
export function categoryRejectReason(cls: Cls): string {
  return cls === 'biz'
    ? '事業の明細の科目は、freeeの勘定科目か確定申告の標準科目から選んでください。無い科目は「事業の科目」として追加できます'
    : '個人の明細の科目は、MFの大項目/中項目か生活の標準費目から選んでください。無い科目は「家計の科目」として追加できます';
}
