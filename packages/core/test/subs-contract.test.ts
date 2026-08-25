import { describe, expect, it } from 'vitest';
import { applyFreeeDeals } from '../src/dataset.js';
import { matchSubVendor, subsCandidates, vendorKey } from '../src/subs.js';
import { type FreeeDeal, emptyDataset } from '../src/types.js';

const deal = (p: Partial<FreeeDeal>): FreeeDeal => ({
  month: '2026-01',
  date: '2026-01-05',
  io: 'expense',
  partner: '架空SaaS',
  accountRaw: '支払手数料',
  accountNorm: 'サブスク・通信',
  amount: 3000,
  ...p,
});

describe('ベンダー照合(名前は完全一致・別名は部分一致、表記ゆれを吸収)', () => {
  const vendors = [
    { name: 'Open AI', aliases: ['openai'] },
    { name: 'note株式会社', aliases: [] },
  ];
  it('全半角・空白・大小文字・法人格の違いを同じキーにする', () => {
    expect(vendorKey('ＯＰＥＮ ＡＩ')).toBe(vendorKey('OpenAI'));
    expect(vendorKey('note株式会社')).toBe(vendorKey('note'));
  });
  it('名前の完全一致・別名の部分一致で登録名を返し、無関係は null', () => {
    expect(matchSubVendor('open ai', vendors)).toBe('Open AI');
    expect(matchSubVendor('OPENAI, LLC', vendors)).toBe('Open AI');
    expect(matchSubVendor('note', vendors)).toBe('note株式会社');
    expect(matchSubVendor('架空クラウド', vendors)).toBeNull();
  });
});

describe('applyFreeeDeals のサブスク集計', () => {
  it('登録ベンダーは科目を問わず集計し、未登録はサブスク・通信の分だけ「その他」に入る', () => {
    const data = emptyDataset();
    data.subs.vendors = ['note株式会社'];
    data.subs.aliases = {};
    data.subs.matrix = { note株式会社: [] };
    applyFreeeDeals(
      data,
      [
        deal({ partner: 'note株式会社', accountRaw: '新聞図書費', accountNorm: '新聞図書費', amount: 500 }),
        deal({ partner: 'note株式会社', amount: 1000 }),
        deal({ partner: '架空クラウド', amount: 2000 }),
        deal({ partner: '架空文具店', accountRaw: '消耗品費', accountNorm: '消耗品費', amount: 400 }),
      ],
      ['2026-01'],
    );
    expect(data.subs.matrix['note株式会社'][0]).toBe(1500);
    expect(data.subs.other[0]).toBe(2000);
    // 科目別の経費は従来どおり
    expect(data.biz.expense['新聞図書費'][0]).toBe(500);
    expect(data.biz.expense['消耗品費'][0]).toBe(400);
  });
});

describe('サブスク候補の採点', () => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
  it('毎月同額・サブスク科目の支払先が最上位、単発は候補にならない、登録済みは除外', () => {
    const deals: FreeeDeal[] = [
      ...months.map((m) => deal({ month: m, partner: '架空定額サービス', amount: 1980 })),
      deal({ month: '2026-01', partner: '架空バラ買い', accountNorm: '消耗品費', amount: 800 }),
      deal({ month: '2026-04', partner: '架空バラ買い', accountNorm: '消耗品費', amount: 9000 }),
      deal({ month: '2026-02', partner: '架空単発', amount: 50000 }),
      ...months.map((m) => deal({ month: m, partner: '登録済み', amount: 5000 })),
    ];
    const c = subsCandidates(deals, [{ name: '登録済み', aliases: [] }]);
    expect(c.map((x) => x.partner)).toEqual(['架空定額サービス', '架空バラ買い']);
    expect(c[0].score).toBe(100);
    expect(c[0].reasons).toContain('毎回ほぼ同額');
    expect(c[0].avgMonthly).toBe(1980);
    expect(c[1].spanMonths).toBe(4);
    expect(c[1].activeMonths).toBe(2);
    expect(c[1].score).toBeLessThan(60);
  });
});
