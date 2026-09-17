/**
 * 推移画面の比較・要因分析の境界値テスト (SYS-TRENDS-P04)。
 *
 * 実装より先に書く赤いテストである。実装は SYS-TRENDS-P05 の `trendsScreen`。
 * 規則の正本は `specs/spec-trends-screen.md` の「ビジネスルールと検証」の表。
 *
 * ## 置換前に落ちる理由
 *
 * `trendsScreen` は置換前に存在せず、比較期間・スパークライン・増減要因のどれも作られない。
 */
import { describe, expect, it } from 'vitest';
import { type PeriodRange, trendsScreen } from '../src/index.js';
import {
  MONTHS,
  dataset,
  fixture,
  mf,
  missingCompareMonthFixture,
  negativeChangeFixture,
  sameNameCategoryFixture,
} from './trend-fixture.js';

const { data, deals } = fixture();
const run = (
  range: PeriodRange | null,
  request: Parameters<typeof trendsScreen>[1] = {},
  d = data,
  ds = deals,
) => trendsScreen({ all: d, deals: ds, verdicts: [], exclusions: [], mfExcludedTxIds: [], range }, request);
const YEAR = { from: '2025-07', to: '2026-06' };

describe('比較期間', () => {
  it('前期間は直前の同じ月数、前年は 12 か月前', () => {
    expect(run(YEAR).comparePeriod).toMatchObject({ from: '2024-07', to: '2025-06' });
    const q = { from: '2026-01', to: '2026-03' };
    expect(run(q).comparePeriod).toMatchObject({ from: '2025-10', to: '2025-12', label: '前3か月' });
    expect(run(q, { compare: 'yoy' }).comparePeriod).toMatchObject({
      from: '2025-01',
      to: '2025-03',
      label: '前年同期',
    });
    expect(run(q, { compare: 'yoy' }).series.compareMonths).toEqual(['2025-01', '2025-02', '2025-03']);
  });

  it('比較の月は同じ位置の月で並び、月次差は同じ位置の月との差', () => {
    const s = run({ from: '2026-01', to: '2026-03' }, { compare: 'yoy' });
    const v = s.series.values.expense;
    expect(v.compare).toHaveLength(3);
    v.current.forEach((c, i) => expect(s.series.diff[i]).toBe(c - (v.compare?.[i] ?? 0)));
  });

  it('比較期間にデータが無ければ比較を作らない (no_data)。増減は null', () => {
    const s = run({ from: '2025-01', to: '2025-06' });
    expect(s.comparePeriod).toBeNull();
    expect(s.compareUnavailable).toBe('no_data');
    expect(s.series.values.expense.compare).toBeNull();
    expect(s.kpis.change).toEqual({ amount: null, rate: null, basis: 'compare_period' });
    expect(s.changePareto).toEqual([]);
    expect(s.topMovers).toEqual([]);
    expect(
      s.categories.every((c) => c.compare === null && c.change === null && c.contribution === null),
    ).toBe(true);
  });

  it('全期間では比較を作らず、増減は最も変化が大きい月の前月差', () => {
    const s = run(null, { compare: 'yoy' });
    expect(s.comparePeriod).toBeNull();
    expect(s.compareUnavailable).toBe('all_period');
    expect(s.selection.compare).toBe('yoy');
    expect(s.kpis.change.basis).toBe('peak_month_mom');
    const cur = s.series.values.expense.current;
    const i = s.series.months.indexOf(s.kpis.peakMonth?.month ?? '');
    expect(s.kpis.change.amount).toBe(cur[i] - cur[i - 1]);
    expect(s.kpis.change.rate).toBeCloseTo((cur[i] - cur[i - 1]) / Math.abs(cur[i - 1]), 12);
    expect(s.series.diff[0]).toBeNull();
  });

  it('比較期間の合計が 0 なら増減率は null', () => {
    const d = dataset([mf({ id: 'a', m: '2026-02', d: '02/01', a: -1_000 })], ['2026-01', '2026-02']);
    const s = run({ from: '2026-02', to: '2026-02' }, {}, d, []);
    expect(s.comparePeriod).not.toBeNull();
    expect(s.kpis.change).toEqual({ amount: 1_000, rate: null, basis: 'compare_period' });
  });

  it('比較期間の一部の月が未取込なら null を 0 に変換せず、期間の増減を表示しない', () => {
    const f = missingCompareMonthFixture();
    const s = run(
      { from: '2026-04', to: '2026-05' },
      { month: '2026-05', category: '食費', side: 'household' },
      f.data,
      f.deals,
    );

    expect(s.comparePeriod).toMatchObject({ from: '2026-02', to: '2026-03' });
    expect(s.series.values.expense.compare).toEqual([100, null]);
    expect(s.series.diff).toEqual([100, null]);
    expect(s.kpis.change).toEqual({ amount: null, rate: null, basis: 'compare_period' });
    expect(s.detail?.values.expense.compare).toBeNull();
    expect(s.detail?.drivers).toEqual([]);
    expect(s.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '食費', compare: null, change: null, contribution: null }),
      ]),
    );
    expect(s.changePareto).toEqual([]);
    expect(s.topMovers).toEqual([]);
  });
});

describe('最も変化が大きい月', () => {
  it('月次差の絶対値が最大の月を選び、既定の選択月にする', () => {
    const s = run(YEAR);
    // 2026-03 に広告費 +240,000 がある
    expect(s.kpis.peakMonth?.month).toBe('2026-03');
    expect(s.selection.month).toBe('2026-03');
    expect(s.detail?.month).toBe('2026-03');
  });

  it('同値は新しい月、全月 0 なら最新月', () => {
    const flat = dataset(
      ['2026-01', '2026-02', '2026-03'].map((m, i) =>
        mf({ id: `f${i}`, m, d: `${m.slice(5)}/01`, a: -1_000 }),
      ),
      ['2026-01', '2026-02', '2026-03'],
    );
    expect(run(null, {}, flat, []).kpis.peakMonth?.month).toBe('2026-03');
    // 月次差 +1000, -1000 → 同値は新しい月
    const zigzag = dataset(
      [
        mf({ id: 'z1', m: '2026-01', d: '01/01', a: -1_000 }),
        mf({ id: 'z2', m: '2026-02', d: '02/01', a: -2_000 }),
        mf({ id: 'z3', m: '2026-03', d: '03/01', a: -1_000 }),
      ],
      ['2026-01', '2026-02', '2026-03'],
    );
    expect(run(null, {}, zigzag, []).kpis.peakMonth).toMatchObject({ month: '2026-03', diff: -1_000 });
  });

  it('形式違反と期間外の month は最も変化が大きい月へ倒す', () => {
    expect(run(YEAR, { month: '2026-13' }).selection.month).toBe('2026-03');
    expect(run(YEAR, { month: '2024-01' }).selection.month).toBe('2026-03');
    expect(run(YEAR, { month: '2026-01' }).selection.month).toBe('2026-01');
  });

  it('データが無ければ KPI は 0、選択月と詳細は無い', () => {
    const s = run(null, {}, dataset([], []), []);
    expect(s.series.months).toEqual([]);
    expect(s.kpis.current).toBe(0);
    expect(s.kpis.peakMonth).toBeNull();
    expect(s.detail).toBeNull();
    expect(s.selection.month).toBeNull();
  });
});

describe('増減要因と説明文', () => {
  it('上位 3 を差の絶対値の降順に並べ、差 0 は除き、説明文は決まった形', () => {
    const s = run(YEAR);
    const drivers = s.detail?.drivers ?? [];
    expect(drivers.length).toBeLessThanOrEqual(3);
    expect(drivers[0]).toMatchObject({
      category: '広告宣伝費',
      side: 'business',
      change: 240_000,
      payee: '架空広告社',
      origin: 'freee',
    });
    // 取引先 1 件なら「など」を付けない
    expect(drivers[0].text).toBe('広告宣伝費が架空広告社1件で¥240,000増');
    for (let i = 1; i < drivers.length; i++) {
      expect(Math.abs(drivers[i - 1].change)).toBeGreaterThanOrEqual(Math.abs(drivers[i].change));
    }
    expect(drivers.every((d) => d.change !== 0)).toBe(true);
    expect(s.kpis.peakMonth?.reason).toBe(drivers[0].text);
  });

  it('取引先が複数なら「など」と件数を付け、減少は「減」', () => {
    const d = dataset(
      [
        mf({ id: 'p1', m: '2026-01', d: '01/01', c: '店A', a: -10_000 }),
        mf({ id: 'p2', m: '2026-02', d: '02/01', c: '店A', a: -2_000 }),
        mf({ id: 'p3', m: '2026-02', d: '02/02', c: '店B', a: -1_000 }),
      ],
      ['2026-01', '2026-02'],
    );
    const s = run(null, { month: '2026-02' }, d, []);
    expect(s.detail?.drivers[0].text).toBe('食費が店Aなど2件で¥7,000減');
  });

  it('選択月の最大要因から、初期表示用の推奨明細導線を選択 focus と分けて返す', () => {
    const s = run(YEAR, { month: '2026-03' });
    expect(s.focus).toBeNull();
    expect(s.recommended).toMatchObject({
      month: '2026-03',
      category: '広告宣伝費',
      payee: '架空広告社',
      change: 240_000,
      origin: 'freee',
      side: 'business',
    });
    expect(s.recommended?.href).toBe('/analysis/total-cashflow?month=2026-03');
  });
});

describe('スパークライン', () => {
  it('今回期間の末月から遡る 12 枠。12 か月未満の期間では期間外が空', () => {
    const s = run({ from: '2026-04', to: '2026-06' });
    const food = s.categories.find((c) => c.name === '食費');
    expect(food?.spark).toHaveLength(12);
    expect(food?.spark.slice(0, 9).every((v) => v === null)).toBe(true);
    expect(food?.spark.slice(9).every((v) => typeof v === 'number')).toBe(true);
    expect(s.sparkMonths[11]).toBe('2026-06');
    expect(s.sparkMonths[0]).toBe('2025-07');
  });
});

describe('要確認の明細', () => {
  it('1 件以上なら件数と金額を返し、数値には含めない', () => {
    const s = run(YEAR);
    expect(s.review).toEqual({ count: 1, amount: 4_400, monthCount: 1, monthAmount: 4_400 });
    const hosting = s.categories
      .find((c) => c.name === '通信費' && c.side === 'business')
      ?.payees.find((p) => p.payee === '架空ホスティング');
    // freee 側の 4,400 だけが数えられ、MF 側の要確認は入らない
    expect(hosting).toMatchObject({ origin: 'freee', current: 4_400 });
  });

  it('0 件なら 0', () => {
    const s = run({ from: '2025-01', to: '2025-06' });
    expect(s.review).toEqual({ count: 0, amount: 0, monthCount: 0, monthAmount: 0 });
  });
});

describe('データの出典', () => {
  it('口座が空の freee 行は account null で、口座別の件数に数えない', () => {
    const s = run(YEAR, { month: '2026-03' });
    const sources = s.detail?.sources ?? [];
    const blank = sources.filter((r) => r.account === null);
    expect(blank).toEqual([{ origin: 'freee', account: null, count: 1 }]);
    const bank = sources.find((r) => r.origin === 'freee' && r.account === '架空銀行');
    // 広告・売上・クラウド・ホスティング (空口座の消耗品は数えない)
    expect(bank?.count).toBe(4);
    expect(sources.find((r) => r.origin === 'mf' && r.account === '架空カード')?.count).toBe(3);
  });
});

describe('カテゴリ行と選択', () => {
  it('増減額・増減率・構成比・寄与度の定義', () => {
    // 比較先を含む全月が取込済みの 6 か月で定義を確かめる。
    const s = run({ from: '2026-01', to: '2026-06' });
    const total = s.kpis.current;
    const change = s.kpis.change.amount ?? 0;
    for (const c of s.categories) {
      expect(c.share).toBeCloseTo(total === 0 ? 0 : c.current / total, 12);
      expect(c.change).toBe(c.current - (c.compare ?? 0));
      if (c.compare) expect(c.changeRate).toBeCloseTo((c.change ?? 0) / Math.abs(c.compare), 12);
      else expect(c.changeRate).toBeNull();
      expect(c.contribution).toBeCloseTo((c.change ?? 0) / change, 12);
    }
    const pareto = s.changePareto;
    expect(pareto.at(-1)?.cumulativeShare).toBeCloseTo(1, 12);
    expect(s.topMovers.map((r) => r.name)).toEqual(pareto.slice(0, 3).map((r) => r.name));
  });

  it('payee は完全一致だけを選び、部分一致では選ばない', () => {
    const hit = run(YEAR, { category: '食費', payee: '架空スーパー' });
    expect(hit.selection).toMatchObject({ category: '食費', payee: '架空スーパー' });
    expect(hit.focus).toMatchObject({
      month: '2026-03',
      category: '食費',
      payee: '架空スーパー',
      origin: 'mf',
      side: 'household',
    });
    expect(hit.focus?.href).toContain('month=2026-03');
    const partial = run(YEAR, { category: '食費', payee: '架空' });
    expect(partial.selection).toMatchObject({ category: '食費', payee: null });
    const missing = run(YEAR, { category: '存在しない' });
    expect(missing.selection).toMatchObject({ category: null, payee: null });
  });

  it('総合の同名カテゴリと同名取引先を side との組で一意に選ぶ', () => {
    const f = sameNameCategoryFixture();
    const range = { from: '2026-02', to: '2026-02' };
    const business = run(range, { category: '食費', payee: '共通取引先', side: 'business' }, f.data, f.deals);
    const household = run(
      range,
      { category: '食費', payee: '共通取引先', side: 'household' },
      f.data,
      f.deals,
    );

    expect(
      business.categories
        .filter((c) => c.name === '食費')
        .map((c) => c.side)
        .sort(),
    ).toEqual(['business', 'household']);
    expect(business.selection).toMatchObject({
      category: '食費',
      payee: '共通取引先',
      side: 'business',
    });
    expect(business.focus).toMatchObject({ side: 'business', change: 200 });
    expect(household.selection).toMatchObject({
      category: '食費',
      payee: '共通取引先',
      side: 'household',
    });
    expect(household.focus).toMatchObject({ side: 'household', change: 100 });

    // side の無い旧 URL も引き続き選択できる。
    expect(run(range, { category: '食費' }, f.data, f.deals).selection.category).toBe('食費');
  });

  it('支出が減ったときは KPI・カテゴリ・パレート・focus の change が負のまま', () => {
    const f = negativeChangeFixture();
    const s = run(
      { from: '2026-02', to: '2026-02' },
      { category: '食費', payee: '減額先', side: 'household' },
      f.data,
      f.deals,
    );

    expect(s.series.diff).toEqual([-100]);
    expect(s.kpis.change.amount).toBe(-100);
    expect(s.categories[0]?.change).toBe(-100);
    expect(s.categories[0]?.payees[0]?.change).toBe(-100);
    expect(s.changePareto[0]?.change).toBe(-100);
    expect(s.focus?.change).toBe(-100);
  });

  it('範囲を事業に絞ると家計の行は出ない', () => {
    const s = run(YEAR, { scope: 'business' });
    expect(s.categories.every((c) => c.side === 'business')).toBe(true);
    expect(s.categories.length).toBeGreaterThan(0);
  });

  it('支出は正の額、純収支だけ符号付き', () => {
    const s = run(YEAR, { metric: 'net' });
    expect(s.categories.some((c) => c.current < 0)).toBe(true);
    expect(run(YEAR).categories.every((c) => c.current >= 0)).toBe(true);
  });

  it('期間の月はデータの月に揃う', () => {
    expect(run(YEAR).series.months).toEqual(MONTHS.filter((m) => m >= YEAR.from && m <= YEAR.to));
  });
});
