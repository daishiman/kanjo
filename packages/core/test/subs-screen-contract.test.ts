/**
 * サブスク画面の算出 (SYS-SUBS-P04)。数値の正本は specs/spec-subscriptions-screen.md §13.3。
 * 前半は検算済み fixture、後半は規則ごとの境界値 (テスト名 = 規則名)。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  type MfTx,
  type PeriodRange,
  type SubscriptionsScreenInput,
  type SubscriptionsScreenVendor,
  subsCategoryOf,
  subsReviewCards,
  subsSpendAlerts,
  subscriptionRow,
  subscriptionVendorDetail,
  subscriptions,
  subscriptionsScreen,
} from '../src/index.js';
import { GENERATED_AT, PERIOD, PREVIOUS, datasetOf, fixtureInput, pay } from './subs-screen-fixture.js';

const screen = () => subscriptionsScreen(fixtureInput());
const row = (key: string, input = fixtureInput()) => {
  const found = subscriptionsScreen(input).rows.find((r) => r.vendorKey === key);
  if (!found) throw new Error(`row ${key} が無い`);
  return found;
};

describe('§13.3 検算済み fixture', () => {
  it('期間・前期間・生成時刻をそのまま返す', () => {
    const s = screen();
    expect(s.period).toEqual(PERIOD);
    expect(s.previousPeriod).toEqual(PREVIOUS);
    expect(s.generatedAt).toBe(GENERATED_AT);
  });

  it('KPI 5 枚は §13.3 の検算値と一致する', () => {
    const { kpis } = screen();
    expect(kpis.monthlyTotal).toBe(9_778);
    expect(kpis.monthlyTotalPrev).toBe(9_530);
    expect(kpis.annualized).toBe(117_336);
    expect(kpis.annualizedPrev).toBe(114_360);
    expect(kpis.last12Total).toBe(114_856);
    expect(kpis.revenueShare).toBeCloseTo(0.053863, 4);
    expect(kpis.reviewCandidates).toBe(2);
  });

  it('一覧の推定月額の和 = 合計行 = KPI 1 枚目 (年換算も同じ)', () => {
    const s = screen();
    const active = s.rows.filter((r) => r.status === 'registered' && r.active);
    expect(active).toHaveLength(8);
    expect(active.reduce((a, r) => a + r.estimatedMonthly, 0)).toBe(s.kpis.monthlyTotal);
    expect(active.reduce((a, r) => a + r.annualized, 0)).toBe(s.kpis.annualized);
    expect(s.comparisonTotal).toEqual({ monthly: 9_778, annualized: 117_336, prevMonthly: 9_530 });
  });

  it('直近12か月と売上比は既存 subscriptions() と同じ値 (別経路で数えない)', () => {
    const input = fixtureInput();
    const data = structuredClone(input.all);
    // 既存集計が読む matrix を fixture の支払いから作り、同じ値になることを確かめる
    const months = data.months.slice(12);
    data.months = months;
    data.biz.revenue = months.map(() => 180_000);
    data.subs.other = months.map(() => 0);
    const s = subscriptionsScreen(input);
    const monthlyByMonth = s.trend.months.map((_, i) => s.trend.series.reduce((a, x) => a + x.values[i]!, 0));
    data.subs.vendors = ['all'];
    data.subs.matrix = { all: monthlyByMonth };
    const now = subscriptions(data).now;
    expect(s.kpis.last12Total).toBe(now.last12Total);
    expect(s.kpis.revenueShare).toBeCloseTo(now.revenueShare ?? Number.NaN, 6);
  });

  it('見直し候補は Adobe (値上げ) と Spotify (重複)。Netflix は指紋一致の dismissed で返さない', () => {
    const s = screen();
    const pending = s.rows.filter((r) => r.review?.state === 'pending').map((r) => r.vendorKey);
    expect(pending).toEqual(['adobecreativecloud', 'spotify']);
    expect(row('netflix').review).toBeNull();

    const adobe = row('adobecreativecloud');
    expect(adobe.review).toEqual({
      state: 'pending',
      rules: ['priceUp'],
      fingerprint: 'priceUp:2728',
      reasons: ['2026年7月から ¥2,480 → ¥2,728 (+10.0%) に値上がりし、2か月続いています。'],
    });
    expect(row('spotify').review).toEqual({
      state: 'pending',
      rules: ['overlap'],
      fingerprint: 'overlap:980',
      reasons: ['同じカテゴリ「エンタメ」に継続中のサブスクが 2 件あります (月額合計 ¥2,470)。'],
    });
  });

  it('並び順は 未判断 → 判断済み → その他、群の中は推定月額の降順', () => {
    const keys = screen().rows.map((r) => r.vendorKey);
    expect(keys).toEqual([
      'adobecreativecloud',
      'spotify',
      'notion',
      'newspicks',
      'netflix',
      'amazonプライム',
      '1password',
      'googleone',
    ]);
  });

  it('検出理由カードは未判断だけを、最初の規則の表示順 → 推定月額の降順で並べる', () => {
    expect(subsReviewCards(screen().rows).map((r) => r.vendorKey)).toEqual(['adobecreativecloud', 'spotify']);
    const base = screen().rows[0]!;
    const card = (
      key: string,
      rule: 'dup' | 'overlap' | 'reviewDue',
      monthly: number,
      state: 'pending' | 'confirmed' = 'pending',
    ) => ({
      ...base,
      vendorKey: key,
      normalizedName: key,
      estimatedMonthly: monthly,
      review: { state, rules: [rule], fingerprint: `${rule}:${monthly}`, reasons: [] },
    });
    const ordered = subsReviewCards([
      card('due-big', 'reviewDue', 9_000),
      card('overlap-small', 'overlap', 500),
      card('overlap-big', 'overlap', 1_500),
      card('dup', 'dup', 100),
      card('confirmed', 'dup', 99_999, 'confirmed'),
    ]);
    expect(ordered.map((r) => r.vendorKey)).toEqual(['dup', 'overlap-big', 'overlap-small', 'due-big']);
  });

  it('Spotify の行: 代表名・照合した取引名数・カテゴリ', () => {
    const spotify = row('spotify');
    expect(spotify).toMatchObject({
      vendorId: 3,
      status: 'registered',
      displayName: 'Spotify',
      normalizedName: 'Spotify',
      matchedNameCount: 2,
      latestAmount: 980,
      estimatedMonthly: 980,
      annualized: 11_760,
      billing: 'monthly',
      active: true,
      category: 'エンタメ',
      categorySource: 'dictionary',
    });
    expect(spotify).not.toHaveProperty('sourceCount');
  });

  it('カバー率は 口座×月 の割合と、最新月まで取込済みの口座数を独立に出す', () => {
    const { coverage } = screen();
    expect(coverage.bank.percent).toBeCloseTo(35 / 36, 4);
    expect(coverage.bank).toMatchObject({ imported: 3, accounts: 3 });
    expect(coverage.card.percent).toBeCloseTo(1, 4);
    expect(coverage.card).toMatchObject({ imported: 2, accounts: 2 });
    expect(coverage.emoney.percent).toBeCloseTo(22 / 24, 4);
    expect(coverage.emoney).toMatchObject({ imported: 1, accounts: 2 });
    expect(coverage.unclassified).toBe(0);
  });

  it('年換算の比較は一覧と同じカテゴリ解決で、月額の降順', () => {
    const { comparison } = screen();
    expect(comparison.map((c) => [c.category, c.monthly, c.prevMonthly])).toEqual([
      ['クリエイティブ', 2_728, 2_480],
      ['エンタメ', 2_470, 2_470],
      ['仕事効率化', 1_650, 1_650],
      ['ニュース', 1_500, 1_500],
      ['ショッピング', 600, 600],
      ['セキュリティ', 580, 580],
      ['クラウド', 250, 250],
    ]);
    const shares = [0.279, 0.2526, 0.1687, 0.1534, 0.0614, 0.0593, 0.0256];
    comparison.forEach((c, i) => {
      expect(c.share).toBeCloseTo(shares[i]!, 3);
      expect(c.annualized).toBe(c.monthly * 12);
    });
    const rounded = comparison.reduce((a, c) => a + Math.round(c.share * 1000), 0);
    expect(rounded).toBe(1000);
  });

  it('推移は 12 本、上位 3 カテゴリ + その他、棒の和 = 直近12か月の支払額', () => {
    const { trend, kpis } = screen();
    expect(trend.months).toHaveLength(12);
    expect(trend.months[0]).toBe('2025-09');
    expect(trend.months.at(-1)).toBe('2026-08');
    expect(trend.series.map((s) => s.category)).toEqual([
      'クリエイティブ',
      'エンタメ',
      '仕事効率化',
      'その他',
    ]);
    const total = trend.series.reduce((a, s) => a + s.values.reduce((b, v) => b + v, 0), 0);
    expect(total).toBe(114_856);
    expect(total).toBe(kpis.last12Total);
  });

  it('Spotify の詳細: カード 6 / 銀行 6、計 12 件、新しい順', () => {
    const detail = subscriptionVendorDetail(fixtureInput(), 'spotify');
    expect(detail).not.toBeNull();
    expect(detail!.vendorId).toBe(3);
    expect(detail!.transactionCount).toBe(12);
    expect(detail!.bySource).toEqual([
      { source: 'card', count: 6 },
      { source: 'bank', count: 6 },
    ]);
    expect(detail!.rawNames).toEqual(
      expect.arrayContaining([
        { name: 'Spotify', source: 'card', count: 6 },
        { name: 'SPOTIFY.COM', source: 'bank', count: 6 },
      ]),
    );
    expect(detail!.recent).toHaveLength(12);
    expect(detail!.recent[0]).toEqual({
      date: '2026-08-01',
      name: 'SPOTIFY.COM',
      source: 'bank',
      amount: 980,
    });
    const dates = detail!.recent.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(detail!.estimatedMonthly).toBe(980);
    expect(detail!.annualized).toBe(11_760);
    expect(detail!.related).toEqual({
      aliases: ['SPOTIFY.COM'],
      accounts: ['通信費'],
      reviewedAt: '2026-08-01',
      reviewDue: false,
    });
  });

  it('詳細は対象行だけを導出し、全画面の KPI・推移・比較を再計算しない', () => {
    const input = fixtureInput();
    const expected = subscriptionsScreen(input).rows.find((item) => item.vendorKey === 'spotify');
    const clone = vi.spyOn(globalThis, 'structuredClone');
    clone.mockClear();
    try {
      expect(subscriptionRow(input, 'spotify')).toEqual(expected);
      expect(subscriptionVendorDetail(input, 'spotify')?.row).toEqual(expected);
      // full screen の last12 / 売上比は Dataset を clone して導出する。詳細経路はそこを通らない。
      expect(clone).not.toHaveBeenCalled();
    } finally {
      clone.mockRestore();
    }
  });

  it('期間内に行が無い vendorKey の詳細は null', () => {
    expect(subscriptionVendorDetail(fixtureInput(), 'unknown')).toBeNull();
  });

  it('全期間 (range=null) は前期間を持たない', () => {
    const s = subscriptionsScreen(fixtureInput({ range: null }));
    expect(s.previousPeriod).toBeNull();
    expect(s.kpis.monthlyTotalPrev).toBeNull();
    expect(s.kpis.annualizedPrev).toBeNull();
    expect(s.comparison.every((c) => c.prevMonthly === null)).toBe(true);
    expect(s.trend.months).toHaveLength(24);
  });
});

/* ======================== 境界値 ======================== */

const v = (
  over: Partial<SubscriptionsScreenVendor> & { id: number; name: string },
): SubscriptionsScreenVendor => ({
  aliases: [],
  accounts: [],
  category: null,
  reviewedAt: null,
  ...over,
});

/** 名前ごとの支払い (月 → 額) から入力を作る */
function inputOf(
  payments: Record<string, Record<string, number>>,
  range: PeriodRange,
  vendors: SubscriptionsScreenVendor[],
  over: Partial<SubscriptionsScreenInput> = {},
): SubscriptionsScreenInput {
  const txs: MfTx[] = [];
  const months = new Set<string>();
  for (const [name, byMonth] of Object.entries(payments)) {
    for (const [month, amount] of Object.entries(byMonth)) {
      txs.push(pay(month, name, amount, '楽天カード'));
      months.add(month);
    }
  }
  return {
    all: datasetOf(txs, [...months].sort(), 100_000),
    deals: [],
    range,
    vendors,
    decisions: [],
    exclusions: [],
    generatedAt: GENERATED_AT,
    ...over,
  };
}

const monthsFrom = (from: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const n = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1 + i;
    return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
  });

const series = (from: string, amounts: number[]): Record<string, number> =>
  Object.fromEntries(monthsFrom(from, amounts.length).map((m, i) => [m, amounts[i]!]));

const SVC = v({ id: 1, name: '架空サービス', reviewedAt: '2027-12-01' });

describe('年額払い', () => {
  const annualCase = (gap: number) => {
    const [first] = monthsFrom('2025-01', 1);
    const last = monthsFrom('2025-01', gap + 1).at(-1)!;
    return row(
      '架空サービス',
      inputOf({ 架空サービス: { [first!]: 12_000, [last]: 12_000 } }, { from: first!, to: last }, [SVC]),
    );
  };
  it.each([11, 12, 13])('間隔 %i か月は年額払い (最新額 ÷ 12)', (gap) => {
    const r = annualCase(gap);
    expect(r.billing).toBe('annual');
    expect(r.estimatedMonthly).toBe(1_000);
    expect(r.latestAmount).toBe(12_000);
  });
  it.each([10, 14])('間隔 %i か月は月払い扱い', (gap) => {
    const r = annualCase(gap);
    expect(r.billing).toBe('monthly');
    expect(r.estimatedMonthly).toBe(12_000);
  });
});

describe('継続中', () => {
  const monthly = series('2026-01', [500, 500, 500]);
  const at = (to: string) =>
    row('架空サービス', inputOf({ 架空サービス: monthly }, { from: '2026-01', to }, [SVC]));
  it('月払いで最新月に支払いあり は継続中', () => expect(at('2026-03').active).toBe(true));
  it('月払いで前月だけあり は継続中', () => expect(at('2026-04').active).toBe(true));
  it('月払いで 2 か月前が最後 は継続中でない (合計にも入らない)', () => {
    const input = inputOf({ 架空サービス: monthly }, { from: '2026-01', to: '2026-05' }, [SVC]);
    expect(row('架空サービス', input).active).toBe(false);
    expect(subscriptionsScreen(input).kpis.monthlyTotal).toBe(0);
  });
  it('年額払いで直近 12 か月に支払いあり は継続中', () => {
    const input = inputOf(
      { 架空サービス: { '2025-01': 12_000, '2026-01': 12_000 } },
      { from: '2026-01', to: '2026-12' },
      [SVC],
    );
    expect(row('架空サービス', input)).toMatchObject({ billing: 'annual', active: true });
  });
});

describe('値上げ (priceUp)', () => {
  const rulesOf = (amounts: number[]) =>
    row(
      '架空サービス',
      inputOf({ 架空サービス: series('2026-01', amounts) }, { from: '2026-01', to: '2026-04' }, [SVC]),
    ).review?.rules ?? [];
  it('+5.0% が 2 か月 は当たる', () => expect(rulesOf([1_000, 1_000, 1_050, 1_050])).toEqual(['priceUp']));
  it('+4.9% は当たらない', () => expect(rulesOf([1_000, 1_000, 1_049, 1_049])).toEqual([]));
  it('+5% が 1 か月だけ は当たらない', () => expect(rulesOf([1_000, 1_000, 1_050, 1_000])).toEqual([]));
});

describe('重複 (overlap)', () => {
  const range = { from: '2026-01', to: '2026-03' };
  const pays = (names: string[]) =>
    Object.fromEntries(names.map((n) => [n, series('2026-01', [1_000, 1_000, 1_000])]));
  const vendors = (names: string[]) =>
    names.map((name, i) => v({ id: i + 1, name, reviewedAt: '2026-03-01' }));
  it('同カテゴリ継続中 2 件 は当たる', () => {
    const s = subscriptionsScreen(inputOf(pays(['Netflix', 'Hulu']), range, vendors(['Netflix', 'Hulu'])));
    expect(s.rows.every((r) => r.review?.rules.includes('overlap'))).toBe(true);
  });
  it('1 件 は当たらない', () => {
    const s = subscriptionsScreen(
      inputOf(pays(['Netflix', 'Notion']), range, vendors(['Netflix', 'Notion'])),
    );
    expect(s.rows.every((r) => r.review === null)).toBe(true);
  });
  it('『その他』の 2 件 は当たらない', () => {
    const s = subscriptionsScreen(inputOf(pays(['架空A', '架空B']), range, vendors(['架空A', '架空B'])));
    expect(s.rows.map((r) => r.category)).toEqual(['その他', 'その他']);
    expect(s.rows.every((r) => r.review === null)).toBe(true);
  });
});

describe('二重請求・急増 (dup / spike) は既存 alerts と同じ境界', () => {
  const cases: [string, number[]][] = [
    ['中央値 6,000 に 20,001 (dup と spike)', [...Array(11).fill(6_000), 20_001]],
    ['中央値 6,000 に 20,000 (2 万円以下なので dup でない)', [...Array(11).fill(6_000), 20_000]],
    ['中央値 5,000 に 30,000 (中央値 5 千円以下なので dup でない)', [...Array(11).fill(5_000), 30_000]],
    ['中央値 5,000 に 15,000 (1.5 万円以下なので spike でない)', [...Array(11).fill(5_000), 15_000]],
  ];
  it.each(cases)('%s', (_label, amounts) => {
    const months = monthsFrom('2025-09', 12);
    const expected = [
      ...new Set(subsSpendAlerts('架空サービス', months, amounts).map((a) => a.type as string)),
    ].sort();
    const got = (
      row('架空サービス', inputOf({ 架空サービス: series('2025-09', amounts) }, PERIOD, [SVC])).review
        ?.rules ?? []
    ).filter((r) => r === 'dup' || r === 'spike');
    expect([...got].sort()).toEqual(expected);
  });
  it('二重請求の理由文は金額・中央値・倍率を書く', () => {
    const r = row(
      '架空サービス',
      inputOf({ 架空サービス: series('2025-09', [...Array(11).fill(6_000), 20_001]) }, PERIOD, [SVC]),
    );
    expect(r.review?.reasons[0]).toBe(
      '2026年8月の支払い ¥20,001 が通常 (¥6,000) の 3.3 倍です。二重請求の可能性があります。',
    );
  });
});

describe('期限切れ (reviewDue)', () => {
  const at = (reviewedAt: string | null) =>
    row(
      '架空サービス',
      inputOf(
        { 架空サービス: series('2026-01', [500, 500, 500, 500, 500, 500]) },
        { from: '2026-01', to: '2026-06' },
        [v({ id: 1, name: '架空サービス', reviewedAt })],
      ),
    ).review;
  it('見直しから 2 か月 は当たらない', () => expect(at('2026-04-10')).toBeNull());
  it('見直しから 3 か月 は当たる', () =>
    expect(at('2026-03-10')).toMatchObject({
      rules: ['reviewDue'],
      reasons: ['最後の見直しから 3 か月たっています。'],
    }));
  it('reviewedAt が null は当たる', () =>
    expect(at(null)).toMatchObject({ rules: ['reviewDue'], reasons: ['まだ一度も見直していません。'] }));
});

describe('指紋 (fingerprint)', () => {
  const vendors = [
    v({ id: 1, name: 'Netflix', reviewedAt: '2026-06-01' }),
    v({ id: 2, name: 'Hulu', reviewedAt: '2026-06-01' }),
  ];
  const dismissed = [
    { vendorKey: 'netflix', decision: 'dismissed' as const, ruleFingerprint: 'overlap:1490' },
  ];
  const netflix = (
    netflixAmounts: number[],
    range = { from: '2026-01', to: '2026-04' },
    reviewedAt = '2026-06-01',
  ) =>
    row(
      'netflix',
      inputOf(
        {
          Netflix: series('2026-01', netflixAmounts),
          Hulu: series('2026-01', [1_026, 1_026, 1_026, 1_026, 1_026]),
        },
        range,
        vendors.map((x) => ({ ...x, reviewedAt })),
        { decisions: dismissed },
      ),
    ).review;
  it('規則が同じで基準金額が同じ dismissed は返さない', () =>
    expect(netflix([1_490, 1_490, 1_490, 1_490])).toBeNull());
  it('基準金額が変わると未判断で返す', () =>
    expect(netflix([1_490, 1_490, 1_490, 1_590])).toMatchObject({
      state: 'pending',
      fingerprint: 'overlap:1590',
    }));
  it('規則が増えると未判断で返す', () =>
    expect(netflix([1_490, 1_490, 1_490, 1_490], undefined, '2025-12-01')).toMatchObject({
      state: 'pending',
      fingerprint: 'overlap+reviewDue:1490',
    }));
  it('月だけが変わっても返さない', () =>
    expect(netflix([1_490, 1_490, 1_490, 1_490, 1_490], { from: '2026-02', to: '2026-05' })).toBeNull());
  it('confirmed は指紋に関係なく判断済みとして返す', () => {
    const r = row(
      'netflix',
      inputOf(
        { Netflix: series('2026-01', [1_490, 1_490]), Hulu: series('2026-01', [1_026, 1_026]) },
        { from: '2026-01', to: '2026-02' },
        vendors,
        { decisions: [{ vendorKey: 'netflix', decision: 'confirmed', ruleFingerprint: 'x:0' }] },
      ),
    );
    expect(r.review?.state).toBe('confirmed');
  });
});

describe('カテゴリ', () => {
  it('辞書に当たる → 辞書のカテゴリ', () =>
    expect(subsCategoryOf('Amazon Prime Video')).toEqual({ category: 'エンタメ', source: 'dictionary' }));
  it('当たらない → その他', () =>
    expect(subsCategoryOf('架空サービス')).toEqual({ category: 'その他', source: 'dictionary' }));
  it('sub_vendors.category があれば辞書より優先', () =>
    expect(subsCategoryOf('Netflix', '仕事効率化')).toEqual({ category: '仕事効率化', source: 'override' }));
  it('au は完全一致だけ (部分一致で誤爆しない)', () => {
    expect(subsCategoryOf('au').category).toBe('通信');
    expect(subsCategoryOf('Audible').category).toBe('その他');
  });
  it('楽天はショッピングに寄せない。楽天モバイルは通信', () => {
    expect(subsCategoryOf('楽天モバイル').category).toBe('通信');
    expect(subsCategoryOf('楽天市場').category).toBe('その他');
  });
});

describe('未登録の候補', () => {
  it('2 か月以上続く未登録の取引先を vendorId=null で出し、合計には入れない', () => {
    const s = subscriptionsScreen(
      inputOf({ 架空クラウド: series('2026-01', [800, 800, 800]) }, { from: '2026-01', to: '2026-03' }, []),
    );
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ vendorId: null, status: 'unregistered', review: null });
    expect(s.kpis.monthlyTotal).toBe(0);
  });
  it('未登録の候補には見直しの判断を適用しない (登録か除外で決める)', () => {
    const decided = (decision: 'confirmed' | 'dismissed') =>
      subscriptionsScreen(
        inputOf(
          { 架空クラウド: series('2026-01', [800, 800, 850, 850]) },
          { from: '2026-01', to: '2026-04' },
          [],
          {
            decisions: [{ vendorKey: '架空クラウド', decision, ruleFingerprint: 'priceUp:850' }],
          },
        ),
      ).rows[0]?.review;
    expect(decided('confirmed')).toMatchObject({ state: 'pending', rules: ['priceUp'] });
    expect(decided('dismissed')).toMatchObject({ state: 'pending', rules: ['priceUp'] });
  });
  it('除外した取引先は候補に出さない', () => {
    const s = subscriptionsScreen(
      inputOf({ 架空クラウド: series('2026-01', [800, 800, 800]) }, { from: '2026-01', to: '2026-03' }, [], {
        exclusions: ['架空クラウド'],
      }),
    );
    expect(s.rows).toHaveLength(0);
  });
});
