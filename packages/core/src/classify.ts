/**
 * 公私仕分け。HTML版 classifyTx / applyClassification を忠実に移植（変更禁止）。
 */
import type { BizPersonalMonth, Classification, Cls, MfTx, PersonalMonth, Rule } from './types.js';

/** 優先順位: 手動 > ルール先勝ち（内容|大項目|中項目 を大文字化して部分一致） > 既定 per */
export function classifyTx(t: MfTx, rules: Rule[], overrides: Record<string, Cls>): Classification {
  if (overrides[t.id]) return { cls: overrides[t.id], src: '手動' };
  const hay = `${t.c || ''}|${t.big || ''}|${t.mid || ''}`.toUpperCase();
  for (const r of rules) {
    if (r.k && hay.includes(r.k.toUpperCase())) return { cls: r.cls, src: 'ルール' };
  }
  return { cls: 'per', src: '既定' };
}

export interface ClassificationResult {
  personal: Record<string, PersonalMonth>;
  bizPersonal: Record<string, BizPersonalMonth>;
}

/**
 * 全明細を月ごとに公私仕分けして集計する。
 * per: 収入=中項目別 / 支出=大項目別（絶対値）。biz: 収入合計=事業入金 / 支出合計=事業立替。
 */
export function applyClassification(
  mfTx: MfTx[],
  rules: Rule[],
  overrides: Record<string, Cls>,
): ClassificationResult {
  const byM: Record<string, MfTx[]> = {};
  mfTx.forEach((t) => {
    byM[t.m] ??= [];
    byM[t.m].push(t);
  });
  const personal: Record<string, PersonalMonth> = {};
  const bizPersonal: Record<string, BizPersonalMonth> = {};
  Object.keys(byM).forEach((m) => {
    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    let bIn = 0;
    let bOut = 0;
    byM[m].forEach((t) => {
      if (classifyTx(t, rules, overrides).cls === 'biz') {
        if (t.a > 0) bIn += t.a;
        else bOut += -t.a;
        return;
      }
      if (t.a > 0) {
        const k = t.mid || 'その他';
        inc[k] = (inc[k] || 0) + t.a;
      } else {
        const k = t.big || '未分類';
        exp[k] = (exp[k] || 0) - t.a;
      }
    });
    personal[m] = { income: inc, expense: exp };
    bizPersonal[m] = { income: bIn, expense: bOut };
  });
  return { personal, bizPersonal };
}
