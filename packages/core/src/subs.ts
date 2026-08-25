/**
 * サブスクのベンダー登録(名前+別名)と、未登録の支払先から「サブスクらしい」候補を採点する純関数。
 * - 登録ベンダーは勘定科目に関係なく、その支払先への支出をサブスクとして集計する
 *   (同じベンダーが「支払手数料」「新聞図書費」など複数科目に跨って記帳されている実データに合わせた判断)。
 * - 名前は正規化キーの完全一致、別名は部分一致(支払先に別名が含まれれば一致)。
 */
import { mean, std } from './stats.js';
import type { FreeeDeal } from './types.js';

export interface SubVendor {
  name: string;
  aliases: string[];
}

/** 大小文字・全半角・空白・記号の違いを吸収した照合キー */
export function vendorKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[株式会社(有)(株)(株)(有)合同会社,.、。・･\-–—_/]/g, '');
}

/** 支払先が登録ベンダーのどれに当たるか。該当なしは null */
export function matchSubVendor(partner: string, vendors: SubVendor[]): string | null {
  const k = vendorKey(partner);
  if (!k) return null;
  for (const v of vendors) if (vendorKey(v.name) === k) return v.name;
  for (const v of vendors) {
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

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/**
 * 登録外の支払先を「サブスクらしさ」順に並べる。
 * 採点: 毎月続いている(連続率) 50点 / 金額が一定(CV) 30点 / 科目がサブスク・通信 20点。
 * 1ヶ月しか出ていない支払先は候補にしない(単発の買い物)。
 */
export function subsCandidates(deals: FreeeDeal[], vendors: SubVendor[], limit = 20): SubsCandidate[] {
  const groups = new Map<
    string,
    { partner: string; byMonth: Map<string, number>; count: number; accounts: Set<string> }
  >();
  for (const d of deals) {
    if (d.io !== 'expense' || d.amount <= 0) continue;
    const partner = d.partner.trim();
    if (!partner || matchSubVendor(partner, vendors)) continue;
    const key = vendorKey(partner);
    if (!key) continue;
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
