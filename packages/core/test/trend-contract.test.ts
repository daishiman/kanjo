import { describe, expect, it } from 'vitest';
import {
  categoryTrends,
  contributionBreakdown,
  emptyDataset,
  expenseSeriesByCategory,
  judgePriority,
  mannKendall,
  monthlySides,
  normalSf,
  sideSummaries,
  theilSen,
  trendsReport,
} from '../src/index.js';
import type { Dataset, PersonalMonth } from '../src/index.js';

/**
 * 増減判定の契約。
 *
 * 支出は「毎月ほぼ一定 + たまに大きな単発」という形をとる。ここで固定したいのは
 * 「単発1件で増加と言い切らない」こと。平均や最小二乗だと簡単にそうなる。
 */

const ds = (months: string[], expense: Record<string, number[]>, over: Partial<Dataset> = {}): Dataset => ({
  ...emptyDataset(),
  months,
  biz: { revenue: months.map(() => 0), categories: Object.keys(expense), expense },
  ...over,
});

const seq = (n: number, f: (i: number) => string): string[] => Array.from({ length: n }, (_, i) => f(i));
const monthsOf = (n: number): string[] =>
  seq(n, (i) => `2025-${String((i % 12) + 1).padStart(2, '0')}`).map((m, i) =>
    i < 12 ? m : m.replace('2025', '2026'),
  );

describe('正規分布の上側確率', () => {
  it('既知の値と一致する', () => {
    expect(normalSf(0)).toBeCloseTo(0.5, 6);
    expect(normalSf(1.96)).toBeCloseTo(0.025, 4);
    expect(normalSf(-1.96)).toBeCloseTo(0.975, 4);
    expect(normalSf(2.576)).toBeCloseTo(0.005, 4);
  });
});

describe('Mann-Kendall 傾向検定', () => {
  it('単調増加はすべてのペアが増加になる', () => {
    const r = mannKendall([1, 2, 3, 4, 5, 6]);
    expect(r.s).toBe(15); // 6C2
    expect(r.tau).toBeCloseTo(1, 6);
    expect(r.p).toBeLessThan(0.05);
  });

  it('単調減少は符号が反転するだけ', () => {
    const r = mannKendall([6, 5, 4, 3, 2, 1]);
    expect(r.s).toBe(-15);
    expect(r.tau).toBeCloseTo(-1, 6);
    expect(r.p).toBeLessThan(0.05);
  });

  it('全て同額なら傾向なし。0除算にもならない', () => {
    const r = mannKendall([5, 5, 5, 5, 5, 5]);
    expect(r.s).toBe(0);
    expect(r.tau).toBe(0);
    expect(r.p).toBe(1);
  });

  it('一定の中に単発1件があっても有意にはしない', () => {
    // 平均比較なら「急増」と出る形。順位だけを見る検定はここで踏みとどまる
    const r = mannKendall([10, 10, 10, 10, 10, 900]);
    expect(r.p).toBeGreaterThan(0.05);
  });

  it('サンプルが少なすぎるときは判定しない', () => {
    expect(mannKendall([1, 5, 9]).p).toBe(1);
    expect(mannKendall([]).n).toBe(0);
  });
});

describe('Theil-Sen 傾き', () => {
  it('きれいな直線では傾きそのものを返す', () => {
    expect(theilSen([0, 100, 200, 300])).toBeCloseTo(100, 6);
    expect(theilSen([300, 200, 100, 0])).toBeCloseTo(-100, 6);
  });

  it('外れ値1点では傾きが跳ねない', () => {
    // 最小二乗なら末尾の1点だけで傾きが 100 を超える
    expect(Math.abs(theilSen([10, 10, 10, 10, 10, 900]))).toBeLessThan(50);
  });

  it('1点以下では0', () => {
    expect(theilSen([5])).toBe(0);
    expect(theilSen([])).toBe(0);
  });
});

describe('科目別トレンド', () => {
  const months = monthsOf(12);
  const data = ds(months, {
    // 毎月一定に少しずつ増える固定費
    サーバー費: months.map((_, i) => 10000 + i * 500),
    // 一定
    通信費: months.map(() => 8000),
    // 単発1件だけ
    接待費: months.map((_, i) => (i === 7 ? 120000 : 0)),
  });

  const rows = categoryTrends(data);
  const by = (a: string) => rows.find((r) => r.account === a);

  it('合計の大きい順に並ぶ', () => {
    expect(rows.map((r) => r.account)).toEqual(['サーバー費', '接待費', '通信費']);
  });

  it('構成比の合計は1になる', () => {
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6);
  });

  it('じわじわ増える科目は「増加」と判定し、年間の見込み額を出す', () => {
    const r = by('サーバー費');
    expect(r?.direction).toBe('増加');
    expect(r?.slopePerMonth).toBeCloseTo(500, 6);
    expect(r?.annualImpact).toBeCloseTo(6000, 6);
    expect(r?.type).toBe('固定費');
  });

  it('変わらない科目は「横ばい」', () => {
    expect(by('通信費')?.direction).toBe('横ばい');
    expect(by('通信費')?.slopePerMonth).toBe(0);
  });

  it('単発1件だけの科目を「増加」と言い切らない', () => {
    const r = by('接待費');
    expect(r?.direction).toBe('横ばい');
    expect(r?.type).toBe('スポット');
    expect(r?.presenceRate).toBeCloseTo(1 / 12, 6);
  });

  it('記帳月が短いうちは増減を断定しない', () => {
    const short = monthsOf(4);
    const r = categoryTrends(ds(short, { 通信費: [1, 2, 3, 4] }));
    expect(r[0].direction).toBe('判定不可');
  });

  it('未記帳月は指標から除外する', () => {
    // 0円として混ぜると、取込が遅れているだけで「減少」と出てしまう
    const d = ds(months, { 通信費: months.map((_, i) => (i >= 10 ? 0 : 8000)) });
    d.unrecordedExpMonths = months.slice(10);
    const r = categoryTrends(d);
    expect(r[0].series).toHaveLength(10);
    expect(r[0].direction).toBe('横ばい');
  });

  it('固定費なのに欠けている月を記録漏れの疑いとして挙げる', () => {
    const d = ds(months, { 家賃: months.map((_, i) => (i === 5 ? 0 : 90000)) });
    const r = categoryTrends(d)[0];
    expect(r.type).toBe('固定費');
    expect(r.gapMonths).toEqual([months[5]]);
  });

  it('スポット科目の空白月は記録漏れとして挙げない', () => {
    expect(by('接待費')?.gapMonths).toEqual([]);
  });

  it('データが無くても壊れない', () => {
    expect(categoryTrends(emptyDataset())).toEqual([]);
  });
});

describe('期間比較の寄与度分解', () => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const data = ds(months, {
    外注費: [100, 100, 200, 200],
    通信費: [50, 50, 40, 40],
  });
  const b = contributionBreakdown(data, months.slice(0, 2), months.slice(2));

  it('総額の増減を科目ごとの金額差に分解する', () => {
    expect(b.beforeTotal).toBe(150);
    expect(b.afterTotal).toBe(240);
    expect(b.diff).toBe(90);
    expect(b.rows.map((r) => [r.account, r.diff])).toEqual([
      ['外注費', 100],
      ['通信費', -10],
    ]);
  });

  it('寄与の合計は増減総額と一致する', () => {
    expect(b.rows.reduce((s, r) => s + r.diff, 0)).toBeCloseTo(b.diff, 6);
    expect(b.rows.reduce((s, r) => s + r.contribution, 0)).toBeCloseTo(1, 6);
  });

  it('影響の大きい順に並ぶ。減った科目も同じ土俵で並べる', () => {
    expect(b.rows[0].account).toBe('外注費');
  });

  it('月数が違う期間でも月平均に直して比べる', () => {
    const uneven = contributionBreakdown(data, ['2026-01'], months.slice(1));
    expect(uneven.beforeTotal).toBe(150);
    expect(uneven.afterTotal).toBeCloseTo((100 + 200 + 200) / 3 + (50 + 40 + 40) / 3, 6);
  });

  it('未記帳月は比較から外す', () => {
    const d = ds(months, { 外注費: [100, 100, 200, 0] });
    d.unrecordedExpMonths = ['2026-04'];
    const r = contributionBreakdown(d, months.slice(0, 2), months.slice(2));
    expect(r.afterMonths).toEqual(['2026-03']);
    expect(r.afterTotal).toBe(200);
  });

  it('総額が変わらないときは寄与割合を出さずゼロにする', () => {
    const flat = ds(months, { 外注費: [100, 100, 100, 100] });
    const r = contributionBreakdown(flat, months.slice(0, 2), months.slice(2));
    expect(r.diff).toBe(0);
    expect(r.rows.every((x) => x.contribution === 0)).toBe(true);
  });
});

describe('管理優先度', () => {
  const months = monthsOf(12);
  const find = (data: Dataset, account: string) => categoryTrends(data).find((r) => r.account === account);

  it('記録の欠けは、金額の大小に関わらず削減判断より前に出る', () => {
    // 「減った」のか「取り込めていない」のかを取り違えると以降の判断が全部狂う
    const gap = find(ds(months, { 家賃: months.map((_, i) => (i === 5 ? 0 : 5000)) }), '家賃');
    const big = find(ds(months, { 外注費: months.map(() => 900000) }), '外注費');
    if (!gap || !big) throw new Error('setup');
    const g = judgePriority(gap);
    expect(g.action).toBe('記録を整える');
    expect(g.reason).toContain(months[5]);
    expect(g.score).toBeGreaterThan(judgePriority(big).score);
  });

  it('じわじわ増える主要科目は削減検討にあがり、年間の見込み額を理由に含む', () => {
    const t = find(ds(months, { サーバー費: months.map((_, i) => 10000 + i * 500) }), 'サーバー費');
    if (!t) throw new Error('setup');
    const j = judgePriority(t);
    expect(j.action).toBe('削減を検討');
    expect(j.reason).toContain('12ヶ月');
  });

  it('増えていても単発なら削減対象にしない', () => {
    // 毎月削れる性質ではないので、同じ「増加」でも扱いを分ける
    const t = find(ds(months, { 接待費: months.map((_, i) => (i > 8 ? i * 40000 : 0)) }), '接待費');
    if (!t) throw new Error('setup');
    expect(t.type).toBe('スポット');
    expect(judgePriority(t).action).not.toBe('削減を検討');
  });

  it('増えていなくても、経費の大半を占める科目は削減検討にあがる', () => {
    const data = ds(months, {
      外注費: months.map(() => 500000),
      通信費: months.map(() => 8000),
    });
    const t = find(data, '外注費');
    if (!t) throw new Error('setup');
    expect(t.direction).toBe('横ばい');
    expect(judgePriority(t).action).toBe('削減を検討');
    const small = find(data, '通信費');
    if (!small) throw new Error('setup');
    expect(judgePriority(small).action).toBe('対応不要');
  });

  it('月数が足りないうちは増減を理由にせず、必要月数を伝える', () => {
    const t = find(ds(monthsOf(4), { 通信費: [1000, 2000, 3000, 4000] }), '通信費');
    if (!t) throw new Error('setup');
    const j = judgePriority(t);
    expect(j.action).toBe('継続監視');
    expect(j.reason).toContain('6ヶ月');
  });

  it('減っている科目は手を止めさせない', () => {
    const t = find(ds(months, { 広告費: months.map((_, i) => 120000 - i * 8000) }), '広告費');
    if (!t) throw new Error('setup');
    const j = judgePriority(t);
    expect(t.direction).toBe('減少');
    expect(j.action).toBe('対応不要');
    expect(j.reason).toContain('減少');
  });
});

describe('トレンドまとめ', () => {
  const months = monthsOf(12);
  const data = ds(months, {
    外注費: months.map((_, i) => 400000 + i * 10000),
    通信費: months.map(() => 8000),
    消耗品費: months.map(() => 3000),
  });
  const r = trendsReport(data);

  it('優先度の高い順に並ぶ', () => {
    expect(r.rows.map((x) => x.score)).toEqual([...r.rows.map((x) => x.score)].sort((a, b) => b - a));
    expect(r.rows[0].account).toBe('外注費');
  });

  it('累積構成比から、経費の8割を占める科目数を出す', () => {
    expect(r.pareto[r.pareto.length - 1].cumShare).toBeCloseTo(1, 6);
    expect(r.coreCount).toBe(1);
  });

  it('期間の前半と後半を比べ、増減の出どころを分解する', () => {
    expect(r.breakdown.beforeMonths).toHaveLength(6);
    expect(r.breakdown.afterMonths).toHaveLength(6);
    expect(r.breakdown.rows[0].account).toBe('外注費');
    expect(r.breakdown.diff).toBeGreaterThan(0);
  });

  it('行動の要る件数を数える', () => {
    expect(Object.values(r.counts).reduce((s, x) => s + x, 0)).toBe(r.rows.length);
  });

  it('データが無くても壊れない', () => {
    const e = trendsReport(emptyDataset());
    expect(e.rows).toEqual([]);
    expect(e.coreCount).toBe(0);
    expect(e.monthlyAvg).toBe(0);
    expect(e.breakdown.diff).toBe(0);
  });
});

/* ======================== 事業と家計の突き合わせ ======================== */

/** 家計は「月 -> 大項目 -> 金額」で持つ。事業の「科目 -> 月配列」と形が違う */
const personalOf = (months: string[], exp: Record<string, number[]>): Record<string, PersonalMonth> => {
  const out: Record<string, PersonalMonth> = {};
  months.forEach((m, i) => {
    const expense: Record<string, number> = {};
    for (const [k, v] of Object.entries(exp)) expense[k] = v[i] ?? 0;
    out[m] = { income: {}, expense };
  });
  return out;
};

const both = (): Dataset => {
  const months = monthsOf(6);
  return ds(
    months,
    { 外注費: [100, 100, 100, 100, 100, 100] },
    {
      personal: personalOf(months, { 食費: [50, 50, 50, 50, 50, 50], 通信費: [10, 10, 10, 10, 10, 10] }),
    },
  );
};

describe('事業と家計の支出をそろえる', () => {
  it('持ち方の違う両者が同じ「科目 x 月配列」になる', () => {
    const rows = expenseSeriesByCategory(both());
    expect(rows.map((r) => [r.side, r.account])).toEqual([
      ['biz', '外注費'],
      ['personal', '通信費'],
      ['personal', '食費'],
    ]);
    for (const r of rows) expect(r.series).toHaveLength(6);
    expect(rows[2].series).toEqual([50, 50, 50, 50, 50, 50]);
  });

  it('スコープで片側だけに絞れる', () => {
    expect(expenseSeriesByCategory(both(), 'biz').every((r) => r.side === 'biz')).toBe(true);
    expect(expenseSeriesByCategory(both(), 'personal').every((r) => r.side === 'personal')).toBe(true);
  });

  it('同名の科目があっても事業と家計は別の行のまま', () => {
    // 足してしまうと「どちらの通信費が増えたのか」が分からず、打てる手が決まらない
    const months = monthsOf(6);
    const d = ds(
      months,
      { 通信費: [7, 7, 7, 7, 7, 7] },
      {
        personal: personalOf(months, { 通信費: [3, 3, 3, 3, 3, 3] }),
      },
    );
    const rows = categoryTrends(d);
    expect(rows.filter((r) => r.account === '通信費')).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(rows.find((r) => r.side === 'biz')?.total).toBe(42);
    expect(rows.find((r) => r.side === 'personal')?.total).toBe(18);
  });

  it('構成比は表示中のスコープの合計に対して出す', () => {
    // 家計だけを見ているのに事業込みの分母だと、家計内での大小が読めなくなる
    const all = categoryTrends(both());
    expect(all.find((r) => r.account === '食費')?.share).toBeCloseTo(300 / 960, 6);
    const per = categoryTrends(both(), 'personal');
    expect(per.find((r) => r.account === '食費')?.share).toBeCloseTo(300 / 360, 6);
  });
});

describe('事業と家計の規模の比較', () => {
  it('両方を並べ、割合の合計が1になる', () => {
    const sides = sideSummaries(both());
    expect(sides.map((s) => s.label)).toEqual(['事業', '家計']);
    expect(sides[0].total).toBe(600);
    expect(sides[1].total).toBe(360);
    expect(sides[0].share + sides[1].share).toBeCloseTo(1, 6);
    expect(sides[0].monthlyAvg).toBe(100);
    expect(sides[1].topAccount).toEqual({ account: '食費', total: 300 });
    expect(sides[1].accountCount).toBe(2);
  });

  it('片側だけのスコープではその側だけを返し、割合は1になる', () => {
    const only = sideSummaries(both(), 'personal');
    expect(only).toHaveLength(1);
    expect(only[0].share).toBeCloseTo(1, 6);
  });

  it('月ごとの推移はスコープに関わらず両方を返す', () => {
    // 片側を見ているときでも、もう片方が同じ画面で分かるようにする
    const ms = monthlySides(both());
    expect(ms).toHaveLength(6);
    expect(ms[0]).toEqual({ month: '2025-01', biz: 100, personal: 60, total: 160 });
  });

  it('未記帳月は事業側と同じ基準で除外する', () => {
    const months = monthsOf(6);
    const d = ds(
      months,
      { 外注費: [100, 100, 100, 100, 100, 0] },
      {
        personal: personalOf(months, { 食費: [50, 50, 50, 50, 50, 0] }),
        unrecordedExpMonths: [months[5]],
      },
    );
    expect(monthlySides(d)).toHaveLength(5);
    expect(sideSummaries(d)[1].monthlyAvg).toBe(50);
  });

  it('家計しか無くても事業だけのスコープで壊れない', () => {
    const months = monthsOf(6);
    const d = ds(months, {}, { personal: personalOf(months, { 食費: [50, 50, 50, 50, 50, 50] }) });
    expect(categoryTrends(d, 'biz')).toEqual([]);
    expect(sideSummaries(d, 'biz')[0]).toMatchObject({ total: 0, share: 0, topAccount: null });
  });
});

describe('スコープつきのまとめ', () => {
  it('スコープが結果に載り、合計がその側だけになる', () => {
    const r = trendsReport(both(), 'personal');
    expect(r.scope).toBe('personal');
    expect(r.scopeLabel).toBe('家計');
    expect(r.expenseTotal).toBe(360);
    expect(r.rows.every((x) => x.side === 'personal')).toBe(true);
    expect(r.pareto.every((x) => x.side === 'personal')).toBe(true);
  });

  it('既定は事業と家計の合算', () => {
    const r = trendsReport(both());
    expect(r.scopeLabel).toBe('事業+家計');
    expect(r.expenseTotal).toBe(960);
    expect(r.sides).toHaveLength(2);
  });

  it('寄与度分解も家計の科目を拾う', () => {
    const months = monthsOf(6);
    const d = ds(
      months,
      { 外注費: [100, 100, 100, 100, 100, 100] },
      {
        personal: personalOf(months, { 食費: [10, 10, 10, 40, 40, 40] }),
      },
    );
    const b = contributionBreakdown(d, months.slice(0, 3), months.slice(3));
    const row = b.rows.find((r) => r.side === 'personal' && r.account === '食費');
    expect(row?.diff).toBe(30);
    expect(row?.contribution).toBeCloseTo(1, 6);
  });
});
