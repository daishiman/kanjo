/**
 * 図表カタログの契約テスト(要望23c/25a)。
 * - 条件を満たさない図は枠だけ(available=false + 理由 + あと何ヶ月)で返る
 * - 満たす図はアプリが数値を計算する(AI の入力に依存しない)
 * - 長い窓は四半期に丸める(粒度の上限)
 * - TS のカタログと Skill 側の JSON が一致する(検証スクリプトとアプリの規則がずれない)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Dataset, emptyDataset } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { CATALOG_JSON_RELATIVE, catalogJson } from './catalog-json.js';
import { CHART_CATALOG, MONTHLY_LIMIT, bucketize, chartWindow } from './catalog.js';
import { buildAgentData } from './dataset.js';

function synthetic(n: number, opts: { unrecorded?: string[]; vendors?: boolean } = {}): Dataset {
  const months = Array.from({ length: n }, (_, i) => {
    const idx = 2021 * 12 + i; // 2021-01 から
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
  const fixed = months.map(() => 30000);
  const variable = months.map((_, i) => 10000 + (i % 4) * 5000);
  const spot = months.map((_, i) => (i === n - 1 ? 200000 : 0));
  return {
    ...emptyDataset(),
    months,
    biz: {
      revenue: months.map((_, i) => 150000 + (i % 3) * 20000),
      categories: ['架空家賃', '架空消耗品', '架空外注'],
      expense: { 架空家賃: fixed, 架空消耗品: variable, 架空外注: spot },
    },
    subs: opts.vendors
      ? {
          vendors: ['架空SaaS', '架空Cloud'],
          aliases: {},
          matrix: { 架空SaaS: fixed.map(() => 3000), 架空Cloud: fixed.map(() => 1000) },
          other: months.map(() => 500),
        }
      : { vendors: [], aliases: {}, matrix: {}, other: months.map(() => 0) },
    unrecordedExpMonths: opts.unrecorded ?? [],
  };
}

const last = (d: Dataset) => d.months[d.months.length - 1];

describe('図表カタログ', () => {
  it('全図が固定順・固定番号で返り、条件を満たさない図は理由と必要月数つきの枠になる', () => {
    const d = synthetic(2);
    const out = buildAgentData(d, { from: last(d), to: last(d) });
    expect(out.charts.map((c) => c.id)).toEqual(CHART_CATALOG.map((c) => c.id));
    expect(out.charts.map((c) => c.figure)).toEqual(CHART_CATALOG.map((c) => c.figure));
    const trend = out.charts.find((c) => c.id === 'trend_ma');
    expect(trend?.available).toBe(false);
    expect(trend?.monthsNeeded).toBe(4);
    expect(trend?.reason).toContain('6ヶ月');
    expect(trend?.status).toBe('source_missing');
    const subs = out.charts.find((c) => c.id === 'subs_vendor');
    expect(subs?.available).toBe(false);
    expect(subs?.reason).toContain('登録');
    expect(out.coverage.every((r) => r.status === 'ok' || r.status === 'source_missing')).toBe(true);
    // 構成比と寄与度は2ヶ月でも出せる
    expect(out.charts.find((c) => c.id === 'composition')?.available).toBe(true);
    expect(out.charts.find((c) => c.id === 'contribution')?.available).toBe(true);
  });

  it('条件を満たす図はアプリが数値を計算する(構成比の合計=1、パレートの累積=1、寄与度の両端=前期/今期)', () => {
    const d = synthetic(15, { vendors: true });
    const out = buildAgentData(d, { from: last(d), to: last(d) });
    const byId = Object.fromEntries(out.charts.map((c) => [c.id, c]));
    expect(byId.composition.available).toBe(true);
    const shares = byId.composition.data?.series[0].data ?? [];
    expect(shares.reduce<number>((acc, v) => acc + (v ?? 0), 0)).toBeCloseTo(1, 2);
    expect(byId.pareto.data?.series[1].data.at(-1)).toBeCloseTo(1, 3);
    const contrib = byId.contribution.data;
    expect(contrib?.labels[0]).toBe('前期合計');
    expect(contrib?.series[0].data[0]).toBe(out.summary.previous?.expense);
    expect(contrib?.series[0].data.at(-1)).toBe(out.summary.current?.expense);
    // 増減の合計 = 今期 − 前期
    const deltas = (contrib?.series[1].data ?? []).filter((v): v is number => v != null);
    expect(deltas.reduce((s, v) => s + v, 0)).toBe(
      (out.summary.current?.expense ?? 0) - (out.summary.previous?.expense ?? 0),
    );
    // 分布: 最終月(スポット20万)は平均+2σを超える外れ値
    const dist = byId.distribution.data;
    const lastExp = dist?.series[0].data.at(-1) as number;
    const upper = dist?.series[2].data.at(-1) as number;
    expect(lastExp).toBeGreaterThan(upper);
    // 前年同月: 15ヶ月あるので出せる
    expect(byId.yoy.available).toBe(true);
    expect(byId.yoy.data?.series.map((s) => s.label)).toEqual(['対象期間', '前年同月']);
    // サブスク: 登録2件 + その他
    expect(byId.subs_vendor.data?.series.map((s) => s.label)).toEqual(['架空SaaS', '架空Cloud', 'その他']);
    // 固定費/損益分岐点
    expect(byId.fixed_variable_bep.available).toBe(true);
    expect(byId.fixed_variable_bep.data?.series.map((s) => s.label)).toEqual([
      '固定費',
      '変動費',
      '売上',
      '損益分岐点',
    ]);
  });

  it('未記帳月は 0 ではなく null(線が途切れる)で渡す', () => {
    const d = synthetic(12);
    const un = d.months[5];
    const out = buildAgentData(synthetic(12, { unrecorded: [un] }), { from: last(d), to: last(d) });
    const trend = out.charts.find((c) => c.id === 'trend_ma');
    const i = trend?.data?.labels.indexOf(un) ?? -1;
    expect(i).toBeGreaterThanOrEqual(0);
    expect(trend?.data?.series[1].data[i]).toBeNull();
  });

  it('36ヶ月を超える窓は四半期に丸め、長期レポートでは前年同月比較を出さない', () => {
    const d = synthetic(60);
    const period = { from: d.months[0], to: last(d) };
    const out = buildAgentData(d, period);
    const trend = out.charts.find((c) => c.id === 'trend_ma');
    expect(trend?.granularity).toBe('quarter');
    expect(trend?.data?.labels[0]).toMatch(/^\d{4}-Q[1-4]$/);
    expect((trend?.data?.labels.length ?? 0) * 3).toBeGreaterThanOrEqual(
      chartWindow(d.months, period).length,
    );
    const yoy = out.charts.find((c) => c.id === 'yoy');
    expect(yoy?.available).toBe(false);
    expect(yoy?.reason).toContain('長期');
    const b = bucketize(d.months.slice(0, MONTHLY_LIMIT + 1), () => 1);
    expect(b.granularity).toBe('quarter');
    expect(b.values.reduce<number>((acc, v) => acc + (v ?? 0), 0)).toBe(MONTHLY_LIMIT + 1);
  });

  it('切り口(axes)はデータにある軸だけを列挙し、判定できない軸は available=false で返す', () => {
    const few = synthetic(3);
    const a = buildAgentData(few, { from: last(few), to: last(few) }).axes;
    expect(a.segment.fixedVariable.available).toBe(false);
    expect(a.segment.settlement.available).toBe(false);
    expect(a.category.bizAccounts.every((x) => x.type === '判定不能')).toBe(true);
    expect(a.period.presets.map((p) => p.id)).toEqual(['month', 'quarter', 'year13', 'year5']);
    expect(a.period.presets[2].availableMonths).toBe(3);
    const many = synthetic(15);
    const b = buildAgentData(many, { from: last(many), to: last(many) }).axes;
    expect(b.segment.fixedVariable.available).toBe(true);
    expect(b.segment.fixedVariable.fixedAccounts).toContain('架空家賃');
    expect(b.indicator.map((i) => i.id)).toContain('breakEven');
    expect(b.indicator.every((i) => typeof i.basis === 'string' && i.basis.length > 0)).toBe(true);
  });

  it('Skill 側の chart-catalog.json がアプリのカタログと一致する(pnpm catalog:export で更新)', () => {
    const onDisk = readFileSync(resolve(process.cwd(), '../..', CATALOG_JSON_RELATIVE), 'utf8');
    expect(onDisk).toBe(catalogJson());
  });
});
