/**
 * HTML版リファレンス実装とのスナップショット一致テスト（リリース必須ゲート）。
 * フィクスチャは匿名化した合成データ（金額・カテゴリ・ルールマッチ性のみ保存）。
 * 期待値スナップショットは reference-dashboard.html のロジックを直接実行して生成した。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  type Dataset,
  type MfTx,
  applyClassification,
  bizExpTotal,
  catProfile,
  defenseLine,
  diagnosis,
  emptyDataset,
  overview,
  subscriptions,
  suggestBudgets,
  sum,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf-8'));

const mfTx: MfTx[] = fx('mf-tx-2026-07.json');
const expected = fx('expected-2026-07.json');
const bizEmbedded = fx('biz-embedded.json');

describe('公私仕分けスナップショット（2026-07 実測値）', () => {
  const r = applyClassification(mfTx, DEFAULT_RULES, {});

  it('事業入金 = 750,180', () => {
    expect(r.bizPersonal['2026-07'].income).toBe(750_180);
  });
  it('事業立替 = 56,993', () => {
    expect(r.bizPersonal['2026-07'].expense).toBe(56_993);
  });
  it('個人支出 = 704,667', () => {
    expect(sum(Object.values(r.personal['2026-07'].expense))).toBe(704_667);
  });
  it('個人収入・支出のカテゴリ別内訳がHTML版と完全一致', () => {
    expect(r.personal['2026-07']).toEqual(expected.personal);
    expect(r.bizPersonal['2026-07']).toEqual(expected.bizPersonal);
  });
  it('手動判定が最優先される', () => {
    const o = applyClassification(mfTx, DEFAULT_RULES, { [mfTx[0].id]: 'per' });
    // 先頭明細(事業・副業の入金)を個人へ手動変更 → 事業入金が減る
    expect(o.bizPersonal['2026-07'].income).toBe(750_180 - mfTx[0].a);
  });
});

describe('freee側集計スナップショット（HTML版埋め込みDATAと同一入力）', () => {
  const data: Dataset = {
    ...emptyDataset(),
    months: bizEmbedded.months,
    biz: bizEmbedded.biz,
    subs: bizEmbedded.subs,
    cashOverride: bizEmbedded.cashOverride,
    unrecordedExpMonths: bizEmbedded.unrecordedExpMonths,
  };

  it('経費合計（2025-01）= HTML版と一致', () => {
    // 39566+36600+9680+3739+5879+4480 = 99,944
    expect(bizExpTotal(data, 0)).toBe(99_944);
  });
  it('サブスク・通信の統計プロファイル（未記帳月2026-07を除外）', () => {
    const p = catProfile(data, 'サブスク・通信');
    expect(p.cv).toBeLessThan(0.6); // CV=0.599 → 固定費（閾値0.6ぎりぎり）
    expect(p.type).toBe('固定費');
    expect(p.total).toBe(sum(bizEmbedded.biz.expense['サブスク・通信'].slice(0, 18)));
  });
  it('概況KPI: 平均月商は売上>0の月のみで算出', () => {
    const o = overview(data);
    const revs = bizEmbedded.biz.revenue.filter((v: number) => v > 0);
    expect(o.kpi.avgRevenue).toBeCloseTo(sum(revs) / revs.length, 6);
    expect(o.kpi.revenueMonths).toBe(revs.length);
  });
  it('サブスク重複検知: Anthropic の中央値1.8倍超過月が重複疑いに入る', () => {
    const s = subscriptions(data);
    const dupMonths = s.alerts
      .filter((a) => a.vendor === 'Anthropic' && a.type === 'dup')
      .map((a) => a.month);
    expect(dupMonths).toEqual(['2026-01', '2026-03', '2026-04', '2026-05']);
    const spikes = s.alerts.filter((a) => a.vendor === 'Open AI' && a.type === 'spike');
    expect(spikes.length).toBeGreaterThan(0);
  });
  it('予算推奨値は千円丸め', () => {
    const b = suggestBudgets(data);
    Object.values(b).forEach((v) => {
      expect(v % 1000).toBe(0);
    });
  });
  it('防衛ライン = 個人生活費3ヶ月平均 + 事業固定費', () => {
    const withPersonal: Dataset = { ...data, mfTx, rules: DEFAULT_RULES };
    const r = applyClassification(mfTx, DEFAULT_RULES, {});
    withPersonal.personal = r.personal;
    withPersonal.bizPersonal = r.bizPersonal;
    const d = defenseLine(withPersonal);
    expect(d.personalAvg).toBe(704_667); // 1ヶ月分のみなので平均=その月
    expect(d.bizIncome).toBe(750_180);
    expect(d.line).toBe(d.personalAvg + d.bizFixedAvg);
    expect(d.month).toBe('2026-07');
  });
  it('診断: 判定・シグナルの閾値がHTML版と同一', () => {
    const d = diagnosis(data);
    for (const e of d.entries) {
      if (e.profile.z >= 2) expect(e.judge).toBe('要確認');
      if (e.profile.type === '固定費' && e.profile.rAvg > 30000)
        expect(e.signals).toContain('契約見直し対象');
    }
    expect(d.bep.breakEven).toBe(d.kpi.fixedCost);
  });
});
