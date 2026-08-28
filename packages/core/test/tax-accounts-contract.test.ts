/**
 * 確定申告の標準科目マスタの契約。
 *
 * この表は「科目名の一覧」ではなく「選ぶための判断材料」なので、
 * 説明や例が欠けた科目が1つでも混ざると、画面で押せない選択肢になる。
 * 名前だけ足す変更を防ぐために、持ち物を機械的に固定する。
 */
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_HINTS,
  TAX_ACCOUNTS,
  TAX_ACCOUNT_GROUPS,
  TAX_ACCOUNT_GUIDE,
  TAX_ACCOUNT_PRINCIPLE,
  commonTaxAccounts,
  suggestTaxAccounts,
  taxAccountByName,
  taxAccountsByGroup,
} from '../src/tax-accounts.js';

describe('標準科目マスタ', () => {
  it('科目名は重複しない', () => {
    const names = TAX_ACCOUNTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('どの科目にも「いつ選ぶか」と具体例がある', () => {
    for (const a of TAX_ACCOUNTS) {
      expect(a.when.length, `${a.name} に基準がない`).toBeGreaterThan(0);
      expect(a.examples.length, `${a.name} に例がない`).toBeGreaterThan(0);
      expect(a.examples.every((e) => e.trim().length > 0)).toBe(true);
    }
  });

  it('すべての科目がいずれかの分類に属し、空の分類がない', () => {
    for (const a of TAX_ACCOUNTS) expect(TAX_ACCOUNT_GROUPS).toContain(a.group);
    for (const g of TAX_ACCOUNT_GROUPS) expect(taxAccountsByGroup(g).length).toBeGreaterThan(0);
  });

  it('分類を1画面に収めるため、分類の数と1分類あたりの科目数を抑える', () => {
    // スクロールせずにクリックだけで選べることが要件。増やすなら分類の切り方から見直す
    expect(TAX_ACCOUNT_GROUPS.length).toBeLessThanOrEqual(6);
    for (const g of TAX_ACCOUNT_GROUPS) expect(taxAccountsByGroup(g).length).toBeLessThanOrEqual(8);
  });

  it('よく使う科目は最初の1画面に収まる数だけ', () => {
    const common = commonTaxAccounts();
    expect(common.length).toBeGreaterThanOrEqual(4);
    expect(common.length).toBeLessThanOrEqual(8);
    // 分類を開かずに済むのが狙いなので、業務の中心になる支出は必ず含める
    const names = common.map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['外注工賃', '通信費', '旅費交通費', '支払手数料']));
  });

  it('迷ったときの基準と前提が用意されている', () => {
    expect(TAX_ACCOUNT_GUIDE.length).toBeGreaterThanOrEqual(3);
    // 基準が指す科目は実在する名前でなければ辿れない
    for (const line of TAX_ACCOUNT_GUIDE) {
      expect(
        TAX_ACCOUNTS.some((a) => line.includes(a.name)),
        line,
      ).toBe(true);
    }
    expect(TAX_ACCOUNT_PRINCIPLE).toContain('一貫性');
  });

  it('名前から科目を引ける(取込由来の科目にも説明を付けるため)', () => {
    expect(taxAccountByName(' 通信費 ')?.group).toBe('IT・情報');
    expect(taxAccountByName('存在しない科目')).toBeNull();
  });
});

describe('内容からの科目の提案', () => {
  it('対応表の科目名は必ず実在する', () => {
    for (const h of ACCOUNT_HINTS) {
      expect(
        TAX_ACCOUNTS.some((a) => a.name === h.account),
        h.account,
      ).toBe(true);
      expect(h.keywords.length).toBeGreaterThan(0);
    }
  });

  it('手がかりが無ければ何も勧めない', () => {
    // 推測で決め打ちすると、利用者は間違いに気づけないまま毎月それを選び続ける
    expect(suggestTaxAccounts('')).toEqual([]);
    expect(suggestTaxAccounts('   ')).toEqual([]);
  });

  it('提案は重複しない', () => {
    const names = suggestTaxAccounts('Slack Zoom AWS 電車 振込').map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
