import { describe, expect, it } from 'vitest';
import { applyFreeeDeals } from '../src/dataset.js';
// 統合の解決 (SYS-SUBSMERGE)。置き場所に依存しないよう公開口から読む
import {
  SubVendorMergeCycleError,
  type SubVendorRecord,
  defaultMergeTarget,
  exportJSON,
  projectAccountingDataset,
  projectSubsAggregate,
  registeredVendorOf,
  resolveVendorMerges,
  sliceDataset,
  sourceNeutralSubscriptions,
  subVendorDefs,
  subsDefinitionsOf,
  subsVendorOfScope,
  subscriptionsScreen,
} from '../src/index.js';
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
  it.each(['支払手数料', 'サブスク・通信', '支払手数料/サブスク・通信'])(
    '科目参照 %s は保存集計・画面・統合投影で同じ根に一致する',
    (account) => {
      const records = [
        { id: 3, name: '第三ベンダー', aliases: ['VOICE'], accounts: ['消耗品費'] },
        { id: 1, name: 'Aqua Voice', aliases: [], mergedIntoId: 2 },
        { id: 2, name: '統合先', aliases: [], accounts: [account] },
      ];
      const resolved = resolveVendorMerges(records);
      const deals = [deal({ partner: 'Aqua Voice', amount: 980 })];
      const data = emptyDataset();
      data.subs.vendors = resolved.vendors.map((vendor) => vendor.name);
      data.subs.aliases = Object.fromEntries(resolved.vendors.map((vendor) => [vendor.name, vendor.aliases]));
      data.subs.accounts = Object.fromEntries(
        resolved.vendors.map((vendor) => [vendor.name, vendor.accounts ?? []]),
      );
      data.subs.matrix = Object.fromEntries(resolved.vendors.map((vendor) => [vendor.name, []]));
      applyFreeeDeals(data, deals, ['2026-01'], resolved.vendors);
      expect(data.subs.matrix['統合先']).toEqual([980]);
      expect(data.subs.other).toEqual([0]);
      const screen = subscriptionsScreen({
        all: data,
        deals,
        range: { from: '2026-01', to: '2026-01' },
        vendors: records.map((vendor) => ({
          ...vendor,
          accounts: vendor.accounts ?? [],
          category: null,
          reviewedAt: null,
        })),
        decisions: [],
        exclusions: [],
        generatedAt: '2026-02-01T00:00:00Z',
      });
      expect(screen.rows.find((row) => row.vendorKey === vendorKey('統合先'))?.estimatedMonthly).toBe(980);
      expect(
        projectSubsAggregate({ resolved, deals, cashDeals: [], businessBaseline: [], current: [] }),
      ).toEqual([{ month: '2026-01', scope: 'subs:統合先', amount: 980 }]);
      // 複合参照を分解して広く一致させない。科目が異なる支払は対象外のまま。
      expect(
        registeredVendorOf(
          { party: 'Aqua Voice', categoryRaw: '会議費', categoryNorm: '会議費' },
          resolved.vendors,
        ),
      ).toBeNull();
      expect(matchSubVendor('Aqua Voice', resolved.vendors, '会議費')).toBeNull();
    },
  );
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

/* ======================== 統合の解決 (specs/spec-subscriptions-merge.md) ======================== */

const rec = (over: Partial<SubVendorRecord> & { id: number; name: string }): SubVendorRecord => ({
  aliases: [],
  accounts: [],
  mergedIntoId: null,
  ...over,
});

/** 別名が vendorKey で重複していないこと */
const keysOf = (aliases: readonly string[]) => aliases.map(vendorKey);

describe('統合元正規名の完全一致優先', () => {
  const rows = [
    rec({ id: 3, name: '第三ベンダー', aliases: ['VOICE', 'Aqua Voice'] }),
    rec({ id: 1, name: 'Aqua Voice', mergedIntoId: 2 }),
    rec({ id: 2, name: '統合先', accounts: ['通信費'] }),
  ];
  it('第三ベンダーの重複 alias より完全一致を優先し、部分一致と科目制限は維持する', () => {
    const { vendors } = resolveVendorMerges(rows);
    expect(matchSubVendor('Ａｑｕａ Ｖｏｉｃｅ', vendors)).toBe('統合先');
    expect(
      registeredVendorOf({ party: 'Aqua Voice', categoryRaw: '通信費', categoryNorm: '通信費' }, vendors),
    ).toBe('統合先');
    expect(matchSubVendor('Aqua Voice Pro', vendors)).toBe('第三ベンダー');
    expect(matchSubVendor('Aqua Voice', vendors, '消耗品費')).toBe('第三ベンダー');
    expect(
      matchSubVendor(
        'Aqua Voice',
        rows.map((row) => ({ ...row, mergedIntoId: null })),
      ),
    ).toBe('Aqua Voice');
  });
  it('subs 再計算にも同じ完全一致優先を使う', () => {
    expect(
      projectSubsAggregate({
        resolved: resolveVendorMerges(rows),
        deals: [deal({ partner: 'Aqua Voice', accountRaw: '通信費', accountNorm: '通信費', amount: 100 })],
        cashDeals: [],
        businessBaseline: [],
        current: [],
      }),
    ).toEqual([{ month: '2026-01', scope: 'subs:統合先', amount: 100 }]);
  });
  it('Datasetから再構築するソース中立集計も期間抽出・clone後に完全一致を保つ', () => {
    const { vendors } = resolveVendorMerges(rows);
    const data = emptyDataset();
    data.subs.vendors = vendors.map((vendor) => vendor.name);
    data.subs.aliases = Object.fromEntries(vendors.map((vendor) => [vendor.name, vendor.aliases]));
    data.subs.accounts = Object.fromEntries(vendors.map((vendor) => [vendor.name, vendor.accounts ?? []]));
    data.subs.exactNames = Object.fromEntries(
      vendors.map((vendor) => [vendor.name, vendor.exactNames ?? []]),
    );
    data.subs.matrix = Object.fromEntries(vendors.map((vendor) => [vendor.name, []]));
    const deals = [deal({ partner: 'Aqua Voice', accountRaw: '通信費', accountNorm: '通信費', amount: 100 })];
    // 第4引数なしでもDatasetの派生定義を使う経路を検証する。
    applyFreeeDeals(data, deals, ['2026-01']);
    for (const input of [
      data,
      structuredClone(data),
      projectAccountingDataset(data),
      sliceDataset(data, { from: '2026-01', to: '2026-01' }),
    ]) {
      expect(input.subs.exactNames?.['統合先']).toEqual(['Aqua Voice']);
      expect(input.subs.matrix['統合先']).toEqual([100]);
      const result = sourceNeutralSubscriptions(input, deals);
      expect(result.matrix['統合先']).toEqual([100]);
      // 期間抽出は支払のないベンダー列を除くため、列なしも誤割当てなしとして検証する。
      expect(result.matrix['第三ベンダー'] ?? [0]).toEqual([0]);
    }
    expect(exportJSON(data).subs).not.toHaveProperty('exactNames');
    expect(data.subs.exactNames?.['統合先']).toEqual(['Aqua Voice']);
  });
  it('保存 aliases を変更せず、50件超の実効 aliases を保存行の往復後にも再構築する', () => {
    const saved = [
      rec({ id: 1, name: '統合先', aliases: Array.from({ length: 50 }, (_, i) => `ROOT${i}`) }),
      rec({
        id: 2,
        name: '統合元',
        aliases: Array.from({ length: 50 }, (_, i) => `SOURCE${i}`),
        mergedIntoId: 1,
      }),
    ];
    const snapshot = JSON.stringify(saved);
    const first = resolveVendorMerges(saved);
    expect(first.vendors[0]?.aliases).toHaveLength(101);
    expect(JSON.stringify(saved)).toBe(snapshot);
    expect(resolveVendorMerges(JSON.parse(snapshot))).toEqual(first);
    expect(matchSubVendor('SOURCE49', first.vendors)).toBe('統合先');
  });
});

/**
 * 循環の例外を型で確かめる。toThrow(クラス) はクラスが未定義だと「何か投げれば合格」に
 * なり、関数が無いことの TypeError で緑になるため、クラスの実在と instanceof を別に見る。
 */
const expectCycle = (run: () => unknown) => {
  expect(typeof SubVendorMergeCycleError).toBe('function');
  let thrown: unknown = null;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(SubVendorMergeCycleError);
};

describe('統合の解決 (resolveVendorMerges・AC-003)', () => {
  it('統合の無い行は並び順のまま照合一覧になり、名前は自分へ写る', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 1, name: '架空文字起こし', aliases: ['KAKU MOJI'] }),
      rec({ id: 2, name: '架空メモ', accounts: ['通信費'] }),
    ]);
    expect(resolved.vendors).toEqual([
      { name: '架空文字起こし', aliases: ['KAKU MOJI'], accounts: [] },
      { name: '架空メモ', aliases: [], accounts: ['通信費'] },
    ]);
    expect(resolved.rootNameOf.get('架空文字起こし')).toBe('架空文字起こし');
    expect(resolved.rootNameOf.get('架空メモ')).toBe('架空メモ');
  });

  it('連鎖 (C→B→A) は根の A まで辿り、統合元は照合一覧から消える', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 1, name: 'A社', aliases: ['A-ONE'] }),
      rec({ id: 2, name: 'B社', aliases: ['B-TWO'], mergedIntoId: 1 }),
      rec({ id: 3, name: 'C社', aliases: ['C-THREE'], mergedIntoId: 2 }),
    ]);
    expect(resolved.vendors.map((v) => v.name)).toEqual(['A社']);
    expect(resolved.rootNameOf.get('B社')).toBe('A社');
    expect(resolved.rootNameOf.get('C社')).toBe('A社');
    // 根の別名は自分の別名が先頭に残り、統合元の名前と別名が足される
    const aliases = resolved.vendors[0]!.aliases;
    expect(aliases[0]).toBe('A-ONE');
    expect(new Set(keysOf(aliases))).toEqual(
      new Set(['A-ONE', 'B社', 'B-TWO', 'C社', 'C-THREE'].map(vendorKey)),
    );
  });

  it('統合元の別名が根の別名と表記ゆれで重なるときは1つにまとめる', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 1, name: '架空文字起こし', aliases: ['AQUA VOICE'] }),
      rec({ id: 2, name: 'Aqua Voice', aliases: ['ａｑｕａｖｏｉｃｅ', 'AQUAVOICE INC'], mergedIntoId: 1 }),
    ]);
    const aliases = resolved.vendors[0]!.aliases;
    expect(keysOf(aliases)).toHaveLength(new Set(keysOf(aliases)).size);
    expect(new Set(keysOf(aliases))).toEqual(new Set(['aquavoice', 'aquavoiceinc']));
  });

  it('統合元の対象科目は根へ足さない (統合時に和集合を書き込むため)', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 1, name: '架空文字起こし', accounts: ['通信費'] }),
      rec({ id: 2, name: 'Aqua Voice', accounts: ['支払手数料'], mergedIntoId: 1 }),
    ]);
    expect(resolved.vendors[0]!.accounts).toEqual(['通信費']);
  });

  it('根は元の並び順を保つ (統合元が根より前に並んでいても)', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 5, name: '架空X' }),
      rec({ id: 6, name: '架空Y', mergedIntoId: 7 }),
      rec({ id: 7, name: '架空Z' }),
    ]);
    expect(resolved.vendors.map((v) => v.name)).toEqual(['架空X', '架空Z']);
    expect(resolved.rootNameOf.get('架空Y')).toBe('架空Z');
  });

  it('参照先の無い mergedIntoId は統合なしとして一覧に残す', () => {
    const resolved = resolveVendorMerges([
      rec({ id: 1, name: '架空文字起こし' }),
      rec({ id: 2, name: '架空孤児', mergedIntoId: 999 }),
    ]);
    expect(resolved.vendors.map((v) => v.name)).toEqual(['架空文字起こし', '架空孤児']);
    expect(resolved.rootNameOf.get('架空孤児')).toBe('架空孤児');
  });

  it('自己統合は SubVendorMergeCycleError', () => {
    const run = () => resolveVendorMerges([rec({ id: 1, name: 'A社', mergedIntoId: 1 })]);
    expectCycle(run);
  });

  it('循環 (A→B→A) は SubVendorMergeCycleError', () => {
    const run = () =>
      resolveVendorMerges([
        rec({ id: 1, name: 'A社', mergedIntoId: 2 }),
        rec({ id: 2, name: 'B社', mergedIntoId: 1 }),
      ]);
    expectCycle(run);
  });

  it('根から外れた循環 (C→A→B→A) も SubVendorMergeCycleError', () => {
    const run = () =>
      resolveVendorMerges([
        rec({ id: 1, name: 'A社', mergedIntoId: 2 }),
        rec({ id: 2, name: 'B社', mergedIntoId: 1 }),
        rec({ id: 3, name: 'C社', mergedIntoId: 1 }),
      ]);
    expectCycle(run);
  });
});

describe('統合先の既定 (defaultMergeTarget・FR-003)', () => {
  it('選んだ行のうち登録済みで推定月額が最大の行を返す', () => {
    expect(
      defaultMergeTarget([
        { vendorKey: 'unreg', status: 'unregistered', estimatedMonthly: 9_000 },
        { vendorKey: 'small', status: 'registered', estimatedMonthly: 1_000 },
        { vendorKey: 'large', status: 'registered', estimatedMonthly: 3_000 },
      ]),
    ).toBe('large');
  });

  it('同額なら先に並ぶ行を返す', () => {
    expect(
      defaultMergeTarget([
        { vendorKey: 'first', status: 'registered', estimatedMonthly: 3_000 },
        { vendorKey: 'second', status: 'registered', estimatedMonthly: 3_000 },
      ]),
    ).toBe('first');
  });

  it('登録済みの行が無ければ null (未登録の行は統合先になれない)', () => {
    expect(
      defaultMergeTarget([{ vendorKey: 'unreg', status: 'unregistered', estimatedMonthly: 9_000 }]),
    ).toBeNull();
    expect(defaultMergeTarget([])).toBeNull();
  });
});

describe('照合の順序 (FR-009: 科目で先に絞ってから名前を見る)', () => {
  // 別名 AMAZON が部分一致する科目違いのベンダーが先に並ぶ
  const defs = [
    { name: '架空物販', aliases: ['AMAZON'], accounts: ['消耗品費'] },
    { name: '架空クラウド', aliases: ['AMAZON WEB SERVICES'], accounts: ['通信費'] },
  ];
  const fact = { party: 'AMAZON WEB SERVICES JAPAN', categoryRaw: '通信費', categoryNorm: 'サブスク・通信' };

  it('registeredVendorOf は科目の合う後ろのベンダーを返す', () => {
    expect(registeredVendorOf(fact, defs)).toBe('架空クラウド');
  });

  it('applyFreeeDeals (matchSubVendor) と同じベンダーに割り当てる', () => {
    const viaMatch = matchSubVendor(fact.party, defs, {
      raw: fact.categoryRaw,
      normalized: fact.categoryNorm,
    });
    expect(registeredVendorOf(fact, defs)).toBe(viaMatch);
  });

  it('どのベンダーの科目にも合わなければ null', () => {
    expect(registeredVendorOf({ ...fact, categoryRaw: '会議費', categoryNorm: '会議費' }, defs)).toBeNull();
  });
});

describe('統合後の照合の一致 (AC-002 の core 側)', () => {
  const records = [
    rec({ id: 1, name: 'Aqua Voice', aliases: ['AQUAVOICE'], mergedIntoId: 2 }),
    rec({ id: 2, name: '架空文字起こし', aliases: ['KAKU MOJI'] }),
  ];
  const months = ['2026-01', '2026-02'];
  const deals = months.flatMap((m) => [
    deal({ month: m, date: `${m}-05`, partner: 'AQUAVOICE INC', amount: 1_500 }),
    deal({ month: m, date: `${m}-07`, partner: 'KAKU MOJI', amount: 2_000 }),
  ]);

  it('applyFreeeDeals は統合元の取引を根の列へ足し、統合元の列を作らない', () => {
    const { vendors } = resolveVendorMerges(records);
    const data = emptyDataset();
    data.subs.vendors = vendors.map((v) => v.name);
    data.subs.aliases = Object.fromEntries(vendors.map((v) => [v.name, v.aliases]));
    data.subs.accounts = Object.fromEntries(vendors.map((v) => [v.name, v.accounts ?? []]));
    data.subs.matrix = Object.fromEntries(vendors.map((v) => [v.name, []]));
    applyFreeeDeals(data, deals, months);
    expect(data.subs.matrix['架空文字起こし']).toEqual([3_500, 3_500]);
    expect(data.subs.matrix['Aqua Voice']).toBeUndefined();
    expect(data.subs.other).toEqual([0, 0]);
  });

  it('registeredVendorOf も同じ取引を同じ根へ割り当てる', () => {
    const { vendors } = resolveVendorMerges(records);
    for (const d of deals) {
      const fact = { party: d.partner, categoryRaw: d.accountRaw, categoryNorm: d.accountNorm };
      expect(registeredVendorOf(fact, vendors)).toBe(
        matchSubVendor(d.partner, vendors, { raw: d.accountRaw, normalized: d.accountNorm }),
      );
      expect(registeredVendorOf(fact, vendors)).toBe('架空文字起こし');
    }
  });
});

describe('候補の登録済み判定は統合を解いてから (subsCandidates)', () => {
  // 統合元が別の行のまま (生の行) 届く経路がある: GET /sub-vendors/candidates・AI 相談の材料・取込の影響
  const records = [
    rec({ id: 1, name: 'Aqua Voice', mergedIntoId: 2 }),
    rec({ id: 2, name: '架空文字起こし' }),
  ];
  const months = ['2026-01', '2026-02', '2026-03'];
  // 統合元の名前を含むが、名前そのものではない支払先。根では統合元の名前が別名 (部分一致) になるので根に数えられる
  const deals = months.flatMap((m) => [
    deal({ month: m, date: `${m}-05`, partner: 'Aqua Voice Pro', amount: 1_500 }),
    deal({ month: m, date: `${m}-09`, partner: '架空未登録ツール', amount: 900 }),
  ]);

  it('生の行を渡しても、集計で根に数えられる支払先は候補に出ない', () => {
    expect(subsCandidates(deals, records).map((c) => c.partner)).toEqual(['架空未登録ツール']);
  });

  it('候補は解決済みの照合一覧のどれにも当たらない支払先だけで、解決済みを渡しても同じ', () => {
    const { vendors } = resolveVendorMerges(records);
    const partners = [...new Set(deals.map((d) => d.partner))];
    const unregistered = partners.filter((p) => matchSubVendor(p, vendors) === null);
    const fromRaw = subsCandidates(deals, records).map((c) => c.partner);
    expect([...fromRaw].sort()).toEqual([...unregistered].sort());
    expect(subsCandidates(deals, vendors).map((c) => c.partner)).toEqual(fromRaw);
  });
});

describe('subs 範囲の組み立て (projectSubsAggregate)', () => {
  const resolved = () =>
    resolveVendorMerges([
      rec({ id: 1, name: 'Aqua Voice', aliases: ['AQUAVOICE'], mergedIntoId: 2 }),
      rec({ id: 2, name: '架空文字起こし', aliases: ['KAKU MOJI'] }),
    ]);
  const byKey = (rows: readonly { month: string; scope: string; amount: number }[]) =>
    [...rows].sort((a, b) => `${a.month}|${a.scope}`.localeCompare(`${b.month}|${b.scope}`));

  it('再計算月は組み直し、freee の無い月は baseline を根へ寄せて足し、範囲外の月は持ち越す', () => {
    const rows = projectSubsAggregate({
      resolved: resolved(),
      deals: [
        deal({ month: '2026-03', partner: 'AQUAVOICE INC', amount: 1_500 }),
        deal({ month: '2026-03', partner: 'KAKU MOJI', amount: 2_000 }),
        deal({ month: '2026-03', partner: '架空未登録', amount: 700 }),
        deal({
          month: '2026-03',
          partner: '架空ランチ',
          accountRaw: '会議費',
          accountNorm: '会議費',
          amount: 1_000,
        }),
      ],
      cashDeals: [deal({ month: '2026-04', partner: 'KAKU MOJI', amount: 2_000 })],
      businessBaseline: [
        { month: '2026-02', scope: 'subs:Aqua Voice', amount: 1_500 },
        { month: '2026-02', scope: 'subs:架空文字起こし', amount: 2_000 },
        { month: '2026-02', scope: 'subs:架空削除済み', amount: 300 },
        { month: '2026-02', scope: 'subs_other', amount: 100 },
        { month: '2026-04', scope: 'subs:Aqua Voice', amount: 1_200 },
      ],
      current: [
        { month: '2026-01', scope: 'subs:Aqua Voice', amount: 1_500 },
        { month: '2026-01', scope: 'subs:架空文字起こし', amount: 2_000 },
        { month: '2026-01', scope: 'subs:架空削除済み', amount: 50 },
        { month: '2026-01', scope: 'subs_other', amount: 30 },
        // 再計算月の古い値は捨てる
        { month: '2026-03', scope: 'subs:Aqua Voice', amount: 999 },
      ],
    });
    expect(byKey(rows)).toEqual(
      byKey([
        { month: '2026-01', scope: 'subs:架空文字起こし', amount: 3_500 },
        { month: '2026-01', scope: 'subs_other', amount: 30 },
        { month: '2026-02', scope: 'subs:架空文字起こし', amount: 3_500 },
        { month: '2026-02', scope: 'subs_other', amount: 100 },
        { month: '2026-03', scope: 'subs:架空文字起こし', amount: 3_500 },
        { month: '2026-03', scope: 'subs_other', amount: 700 },
        { month: '2026-04', scope: 'subs:架空文字起こし', amount: 3_200 },
      ]),
    );
  });

  it('金額が 0 の行は出さない', () => {
    const rows = projectSubsAggregate({
      resolved: resolved(),
      deals: [deal({ month: '2026-03', partner: 'KAKU MOJI', amount: 2_000 })],
      cashDeals: [],
      businessBaseline: [],
      current: [{ month: '2026-01', scope: 'subs_other', amount: 0 }],
    });
    expect(rows).toEqual([{ month: '2026-03', scope: 'subs:架空文字起こし', amount: 2_000 }]);
  });
});

describe('解決済み一覧から Dataset.subs の表を作る (subsDefinitionsOf)', () => {
  const resolved = () =>
    resolveVendorMerges([
      rec({ id: 1, name: 'Aqua Voice', aliases: ['AQUAVOICE'], accounts: ['支払手数料'], mergedIntoId: 2 }),
      rec({ id: 2, name: '架空文字起こし', aliases: ['KAKU MOJI'], accounts: ['通信費'] }),
      rec({ id: 3, name: '架空動画', aliases: [] }),
    ]);

  it('根だけを鍵にし、統合の無い根の完全一致名は空配列、vendors の列は持たない', () => {
    expect(subsDefinitionsOf(resolved())).toEqual({
      // AQUAVOICE は Aqua Voice と表記ゆれで重なるので resolveVendorMerges が1つにまとめる
      aliases: { 架空文字起こし: ['KAKU MOJI', 'Aqua Voice'], 架空動画: [] },
      exactNames: { 架空文字起こし: ['Aqua Voice'], 架空動画: [] },
      // 統合元の対象科目は根へ足さない (resolveVendorMerges の規則のまま写す)
      accounts: { 架空文字起こし: ['通信費'], 架空動画: [] },
    });
  });

  it('表を Dataset に載せて subVendorDefs で戻しても、統合元の取引は同じ根へ割り当たる', () => {
    const data = emptyDataset();
    data.subs.vendors = resolved().vendors.map((vendor) => vendor.name);
    Object.assign(data.subs, subsDefinitionsOf(resolved()));
    const account = { raw: '通信費', normalized: '通信費' };
    expect(matchSubVendor('Aqua Voice', subVendorDefs(data), account)).toBe('架空文字起こし');
    expect(matchSubVendor('Aqua Voice', resolved().vendors, account)).toBe('架空文字起こし');
  });
});

describe('monthly_agg の scope からベンダー名を取り出す (subsVendorOfScope)', () => {
  it('subs:<名前> は名前を返し、名前の中の : は残す', () => {
    expect(subsVendorOfScope('subs:架空文字起こし')).toBe('架空文字起こし');
    expect(subsVendorOfScope('subs:架空:プラン')).toBe('架空:プラン');
  });

  it('subs_other・事業・個人の scope は null (途中に subs: を含んでも接頭辞でなければ null)', () => {
    for (const scope of ['subs_other', 'subs', 'biz_rev', 'biz_exp:subs:架空', 'per_exp:食費']) {
      expect(subsVendorOfScope(scope)).toBeNull();
    }
  });
});
