import { describe, expect, it } from 'vitest';
import { applyFreeeDeals } from '../src/dataset.js';
import {
  type SubsCandidate,
  autoRegisterable,
  matchSubVendor,
  subsCandidates,
  subsConfidence,
  vendorKey,
} from '../src/subs.js';
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

describe('ベンダーごとの対象勘定科目', () => {
  const vendors = [
    { name: '架空モール', aliases: [], accounts: ['サブスク・通信'] },
    { name: 'note株式会社', aliases: [], accounts: [] },
  ];
  it('対象科目を指定したベンダーは、その科目のときだけ一致する', () => {
    expect(matchSubVendor('架空モール', vendors, 'サブスク・通信')).toBe('架空モール');
    expect(matchSubVendor('架空モール', vendors, '消耗品費')).toBeNull();
  });
  it('対象科目が空(未指定)なら従来どおり全科目で一致する', () => {
    expect(matchSubVendor('note株式会社', vendors, '消耗品費')).toBe('note株式会社');
    expect(matchSubVendor('note株式会社', vendors, 'サブスク・通信')).toBe('note株式会社');
  });
  it('科目を渡さなければ絞り込まない(登録済み判定など、科目を見ない用途)', () => {
    expect(matchSubVendor('架空モール', vendors)).toBe('架空モール');

    expect(
      matchSubVendor('架空モール', [{ ...vendors[0], accounts: ['架空通信原'] }], {
        raw: '架空通信原',
        normalized: '架空新通信区分',
      }),
    ).toBe('架空モール');
  });
  it('科目違いのベンダーが先に並んでいても、後続の一致するベンダーを取りこぼさない', () => {
    const both = [
      { name: '架空モール', aliases: [], accounts: ['消耗品費'] },
      { name: '架空モール決済', aliases: ['架空モール'], accounts: ['サブスク・通信'] },
    ];
    expect(matchSubVendor('架空モール', both, 'サブスク・通信')).toBe('架空モール決済');
  });
});

describe('applyFreeeDeals の対象科目しぼり', () => {
  it('対象科目を絞ったベンダーは、科目外の支払をサブスクに数えない', () => {
    const data = emptyDataset();
    data.subs.vendors = ['架空モール'];
    data.subs.aliases = {};
    data.subs.accounts = { 架空モール: ['サブスク・通信'] };
    data.subs.matrix = { 架空モール: [] };
    applyFreeeDeals(
      data,
      [
        deal({ partner: '架空モール', amount: 980 }),
        deal({ partner: '架空モール', accountRaw: '消耗品費', accountNorm: '消耗品費', amount: 12000 }),
      ],
      ['2026-01'],
    );
    expect(data.subs.matrix['架空モール'][0]).toBe(980);
    // 科目外の物販はサブスクにも「その他」にも入らず、経費側にだけ残る
    expect(data.subs.other[0]).toBe(0);
    expect(data.biz.expense['消耗品費'][0]).toBe(12000);
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

  it('「サブスクではない」と記録した支払先は表記ゆれを含めて候補から外れる', () => {
    const deals: FreeeDeal[] = [
      ...months.map((m) => deal({ month: m, partner: '架空定額サービス', amount: 1980 })),
      ...months.map((m) => deal({ month: m, partner: '架空家賃', amount: 80000 })),
    ];
    expect(subsCandidates(deals, [], 20, []).map((x) => x.partner)).toEqual(['架空家賃', '架空定額サービス']);
    // 除外は正規化キーで突き合わせるので、全角・空白のゆれがあっても効く
    expect(subsCandidates(deals, [], 20, ['架空 家賃']).map((x) => x.partner)).toEqual(['架空定額サービス']);
  });
});

/**
 * 取込直後の「まとめて登録」で、何を最初から選んでおくかの契約。
 *
 * sure は画面を開いた時点でチェックが入る=事実上の自動登録なので、
 * 「毎月・ほぼ同額・3ヶ月以上」の3つが揃ったときだけに限る。
 * どれか1つでは、たまたま2ヶ月続いた買い物と区別がつかない。
 */
describe('サブスク候補の確度', () => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];

  it('毎月ほぼ同額で3ヶ月以上続く支払先だけを、まとめて登録の対象にする', () => {
    const deals: FreeeDeal[] = [
      ...months.map((m) => deal({ month: m, partner: '架空定額サービス', amount: 1980 })),
      // 毎月あるが金額がバラバラ。従量課金や物販が混ざるとこうなる
      ...months.map((m, i) => deal({ month: m, partner: '架空従量課金', amount: 1000 + i * 4000 })),
      // 4ヶ月のうち2ヶ月だけ。単発の買い物が2回あっただけの可能性が残る
      deal({ month: '2026-01', partner: '架空バラ買い', amount: 800 }),
      deal({ month: '2026-04', partner: '架空バラ買い', amount: 900 }),
    ];
    const byName = new Map(subsCandidates(deals, []).map((c) => [c.partner, c]));
    expect(subsConfidence(byName.get('架空定額サービス') as SubsCandidate)).toBe('sure');
    expect(subsConfidence(byName.get('架空従量課金') as SubsCandidate)).toBe('likely');
    expect(subsConfidence(byName.get('架空バラ買い') as SubsCandidate)).toBe('weak');
    expect(autoRegisterable([...byName.values()]).map((c) => c.partner)).toEqual(['架空定額サービス']);
  });

  it('科目がサブスク・通信でなくても、毎月同額なら対象にする', () => {
    // 同じベンダーが支払手数料・新聞図書費に散る実データがあるため、科目は必須条件にしない
    const deals = months.map((m) =>
      deal({
        month: m,
        partner: '架空顧問料',
        accountRaw: '支払手数料',
        accountNorm: '支払手数料',
        amount: 33000,
      }),
    );
    const [c] = subsCandidates(deals, []);
    expect(c.accounts).toEqual(['支払手数料']);
    expect(subsConfidence(c)).toBe('sure');
  });

  it('抜けのある支払先は、まとめて登録に混ぜない', () => {
    // 4ヶ月中3ヶ月(連続率0.75)。隔月・年払いの契約はここに落ちて、目で見て判断する
    const deals = ['2026-01', '2026-02', '2026-04'].map((m) =>
      deal({ month: m, partner: '架空隔月サービス', amount: 2000 }),
    );
    const [c] = subsCandidates(deals, []);
    expect(subsConfidence(c)).toBe('likely');
    expect(autoRegisterable([c])).toEqual([]);
  });
});
