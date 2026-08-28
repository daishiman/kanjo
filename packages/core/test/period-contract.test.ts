import { describe, expect, it } from 'vitest';
import {
  SPAN_YEARS,
  applyPeriod,
  availableYears,
  emptyDataset,
  fullRange,
  isValidPeriod,
  lastMonthsRange,
  matrix,
  overview,
  periodLabel,
  resolvePeriodQuery,
  sliceDataset,
  yearRange,
} from '../src/index.js';
import type { Dataset, MfTx } from '../src/index.js';

/**
 * 対象期間の絞り込み契約。
 *
 * ここが守られないと「期間を絞ったのに一部の画面だけ全期間のまま」という、
 * 画面を見ても気づけない不整合が出る。月に並んだ要素は必ず同じ長さで揃うこと、
 * 設定類は絞り込みで消えないことの2点を固定する。
 */

const months = ['2025-11', '2025-12', '2026-01', '2026-02'];

const tx = (m: string, id: string): MfTx => ({
  id,
  m,
  d: `${m.slice(5)}/01`,
  c: '取引',
  a: -1000,
  big: '通信費',
  mid: '通信',
});

const sample = (): Dataset => ({
  ...emptyDataset(),
  months: [...months],
  biz: {
    revenue: [100, 200, 300, 400],
    categories: ['通信費', '外注費'],
    expense: { 通信費: [10, 20, 30, 40], 外注費: [0, 0, 5, 7] },
  },
  subs: {
    vendors: ['A', 'B'],
    aliases: {},
    accounts: {},
    matrix: { A: [1, 1, 1, 1], B: [2, 2, 0, 0] },
    other: [9, 8, 7, 6],
  },
  personal: {
    '2025-11': { income: { 給与: 1 }, expense: { 食費: 2 } },
    '2026-01': { income: { 給与: 3 }, expense: { 食費: 4 } },
  },
  bizPersonal: { '2025-12': { income: 5, expense: 6 } },
  personalByOwner: {
    '2025-11': {
      business: { income: 0, expense: 0 },
      spouse: { income: 0, expense: 0 },
      family: { income: 0, expense: 0 },
      unset: { income: 0, expense: 0 },
    },
  },
  cashOverride: { '2026-02': { revenue: 1, expense: 2 } },
  mfTx: [tx('2025-11', 'a'), tx('2026-01', 'b'), tx('2026-02', 'c')],
  rules: [{ k: '通信費', cls: 'biz' }],
  edits: { a: { cls: 'biz' } },
  institutionOwners: { 楽天: 'spouse' },
  budgets: { 通信費: 30000 },
  unrecordedExpMonths: ['2025-11', '2026-02'],
});

describe('期間の妥当性', () => {
  it('YYYY-MM 形式で、開始が終了以前のときだけ有効', () => {
    expect(isValidPeriod({ from: '2026-01', to: '2026-03' })).toBe(true);
    expect(isValidPeriod({ from: '2026-03', to: '2026-03' })).toBe(true);
    expect(isValidPeriod({ from: '2026-03', to: '2026-01' })).toBe(false);
    expect(isValidPeriod({ from: '2026-13', to: '2026-14' })).toBe(false);
    expect(isValidPeriod({ from: '2026-1', to: '2026-03' })).toBe(false);
    expect(isValidPeriod(null)).toBe(false);
    expect(isValidPeriod('2026-01')).toBe(false);
  });
});

describe('期間の選択肢', () => {
  it('年の一覧は重複なく新しい順', () => {
    expect(availableYears(sample())).toEqual(['2026', '2025']);
    expect(availableYears(emptyDataset())).toEqual([]);
  });

  it('暦年1年の期間は1月から12月', () => {
    expect(yearRange('2025')).toEqual({ from: '2025-01', to: '2025-12' });
  });

  it('データ全体の期間は最初と最後の月', () => {
    expect(fullRange(sample())).toEqual({ from: '2025-11', to: '2026-02' });
    expect(fullRange(emptyDataset())).toBeNull();
  });

  it('直近nヶ月の終点は暦の今日ではなくデータの最終月', () => {
    // 取込が遅れている月に「今日から12ヶ月」で切ると、末尾が必ず空になる
    expect(lastMonthsRange(sample(), 2)).toEqual({ from: '2026-01', to: '2026-02' });
    // データより長い指定は全期間に収まる
    expect(lastMonthsRange(sample(), 99)).toEqual({ from: '2025-11', to: '2026-02' });
    expect(lastMonthsRange(emptyDataset(), 12)).toBeNull();
  });
});

describe('Dataset の絞り込み', () => {
  const cut = sliceDataset(sample(), { from: '2025-12', to: '2026-01' });

  it('月に並んだ配列はすべて months と同じ長さに揃う', () => {
    expect(cut.months).toEqual(['2025-12', '2026-01']);
    for (const arr of [
      cut.biz.revenue,
      cut.subs.other,
      ...Object.values(cut.biz.expense),
      ...Object.values(cut.subs.matrix),
    ]) {
      expect(arr).toHaveLength(cut.months.length);
    }
  });

  it('値は元の月の位置から取られる', () => {
    expect(cut.biz.revenue).toEqual([200, 300]);
    expect(cut.biz.expense.通信費).toEqual([20, 30]);
    expect(cut.subs.other).toEqual([8, 7]);
  });

  it('月をキーにした表は期間外のキーが落ちる', () => {
    expect(Object.keys(cut.personal)).toEqual(['2026-01']);
    expect(Object.keys(cut.bizPersonal)).toEqual(['2025-12']);
    expect(Object.keys(cut.personalByOwner)).toEqual([]);
    expect(Object.keys(cut.cashOverride)).toEqual([]);
  });

  it('明細と未記帳月も期間で絞られる', () => {
    expect(cut.mfTx.map((t) => t.id)).toEqual(['b']);
    expect(cut.unrecordedExpMonths).toEqual([]);
  });

  it('設定類は絞り込みで消えない', () => {
    // 予算を落とすと、期間を絞った瞬間に全科目が「予算未設定」になってしまう
    expect(cut.budgets).toEqual({ 通信費: 30000 });
    expect(cut.rules).toEqual([{ k: '通信費', cls: 'biz' }]);
    expect(cut.edits).toEqual({ a: { cls: 'biz' } });
    expect(cut.institutionOwners).toEqual({ 楽天: 'spouse' });
  });

  it('期間内に一度も金額が立たない科目・ベンダーは一覧から落ちる', () => {
    // 空行が並ぶと「この期間には無かった」ことがかえって読み取れなくなる
    expect(cut.biz.categories).toEqual(['通信費', '外注費']);
    expect(sliceDataset(sample(), { from: '2025-11', to: '2025-12' }).biz.categories).toEqual(['通信費']);
    expect(sliceDataset(sample(), { from: '2026-01', to: '2026-02' }).subs.vendors).toEqual(['A']);
  });

  it('元の Dataset を書き換えない', () => {
    const src = sample();
    sliceDataset(src, { from: '2026-01', to: '2026-01' });
    expect(src.months).toEqual(months);
    expect(src.biz.expense.通信費).toEqual([10, 20, 30, 40]);
  });

  it('該当月が無い期間でも壊れず空になる', () => {
    const none = sliceDataset(sample(), { from: '2030-01', to: '2030-12' });
    expect(none.months).toEqual([]);
    expect(none.biz.categories).toEqual([]);
    expect(() => overview(none)).not.toThrow();
    expect(() => matrix(none)).not.toThrow();
  });
});

describe('期間の適用', () => {
  it('指定なし・壊れた指定は全期間のまま', () => {
    expect(applyPeriod(sample(), null).months).toEqual(months);
    expect(applyPeriod(sample(), undefined).months).toEqual(months);
    expect(applyPeriod(sample(), { from: '2026-03', to: '2026-01' }).months).toEqual(months);
  });

  it('絞り込んだ Dataset でも既存の分析がそのまま動く', () => {
    // 分析関数に期間引数を足さずに済むことが、この設計の目的そのもの
    const y = applyPeriod(sample(), yearRange('2026'));
    expect(overview(y).months).toEqual(['2026-01', '2026-02']);
    expect(matrix(y).years).toEqual(['2026']);
    expect(matrix(y).months).toEqual(['2026-01', '2026-02']);
  });
});

describe('期間指定の解決', () => {
  const d = sample();

  it('任意期間が最優先', () => {
    expect(resolvePeriodQuery(d, { from: '2025-12', to: '2026-01', year: '2025', span: '1' })).toEqual({
      from: '2025-12',
      to: '2026-01',
    });
  });

  it('年の指定は暦年1年に解決する', () => {
    expect(resolvePeriodQuery(d, { year: '2025' })).toEqual({ from: '2025-01', to: '2025-12' });
  });

  it('データに無い年は全期間に倒す', () => {
    // 空の画面を出しても何も分からないうえ、選択肢から戻れなくなる
    expect(resolvePeriodQuery(d, { year: '2019' })).toBeNull();
  });

  it('直近n年はデータの最終月から遡る', () => {
    // 1年=12ヶ月ぶんだが、データが4ヶ月しかなければ全部が入る
    expect(resolvePeriodQuery(d, { span: '1' })).toEqual({ from: '2025-11', to: '2026-02' });
    expect(resolvePeriodQuery(d, { span: '3' })).toEqual({ from: '2025-11', to: '2026-02' });
  });

  it('1年・2年・3年だけを受け付ける', () => {
    expect(SPAN_YEARS).toEqual([1, 2, 3]);
    expect(resolvePeriodQuery(d, { span: '5' })).toBeNull();
    expect(resolvePeriodQuery(d, { span: 'abc' })).toBeNull();
  });

  it('指定なし・壊れた指定は全期間', () => {
    expect(resolvePeriodQuery(d, {})).toBeNull();
    expect(resolvePeriodQuery(d, { from: '2026-05', to: '2026-01' })).toBeNull();
    expect(resolvePeriodQuery(d, { from: null, to: null, year: null, span: null })).toBeNull();
  });

  it('12ヶ月ぶんのデータがあれば直近1年は12ヶ月になる', () => {
    const many = { ...emptyDataset() };
    many.months = Array.from({ length: 30 }, (_, i) => {
      const y = 2024 + Math.floor(i / 12);
      return `${y}-${String((i % 12) + 1).padStart(2, '0')}`;
    });
    expect(resolvePeriodQuery(many, { span: '1' })).toEqual({ from: '2025-07', to: '2026-06' });
    expect(resolvePeriodQuery(many, { span: '2' })).toEqual({ from: '2024-07', to: '2026-06' });
  });
});

describe('期間ラベル', () => {
  it('未指定は全期間', () => {
    expect(periodLabel(null)).toBe('全期間');
  });
  it('同月なら1つだけ出す', () => {
    expect(periodLabel({ from: '2026-08', to: '2026-08' })).toBe('2026年8月');
  });
  it('範囲は前後を並べる', () => {
    expect(periodLabel({ from: '2025-01', to: '2026-12' })).toBe('2025年1月 〜 2026年12月');
  });
});
