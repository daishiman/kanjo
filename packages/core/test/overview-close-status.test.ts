/**
 * 概況画面の集計・未処理キュー・月次クローズ判定の契約テスト (SYS-OVERVIEW-P04 で先に書いた赤いテスト)。
 *
 * | 受入 | 内容 | テスト |
 * |---|---|---|
 * | AC-001 | 同じ月別系列から出した KPI・年次比較・内訳の支出総額差が 0 | `AC-001` |
 * | AC-003 | 内容指紋が変わった明細は保留が効かず再び数えられる | `AC-003` |
 * | AC-004 (core 側) | 4 ステップが判定表どおり、保留中は未完了 | `AC-004` |
 * | AC-006 | 同じ入力から同じ推奨・信頼度、根拠なしは推奨なし | `AC-006` |
 *
 * 契約の正本は `docs/overview-screen/architecture-decision.md` §2..§5。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  REVIEW_ITEM_KEY_MAX,
  type ReconcileReview,
  type VendorMemoryRecord,
  applyReviewSnoozes,
  buildReviewQueue,
  emptyDataset,
  isCloseMonth,
  isOverviewScope,
  isReviewItemKey,
  isReviewItemKind,
  monthlyCloseStatus,
  overviewAggregate,
  overviewScopeMonths,
  recommendationFor,
  reviewItemFingerprint,
  totalCashflowReport,
} from '../src/index.js';

const MONTHS = Array.from({ length: 15 }, (_, i) => {
  const y = 2025 + Math.floor((i + 6) / 12);
  const m = ((i + 6) % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}); // 2025-07 .. 2026-09

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-09',
  d: '09/05',
  c: '架空商店',
  a: -3_300,
  big: '食費',
  mid: '食料品',
  inst: '架空銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

function fixture(): Dataset {
  const data = emptyDataset();
  data.months = [...MONTHS];
  data.biz.revenue = MONTHS.map((_, i) => 300_000 + i * 1_000);
  data.biz.categories = ['通信費', '外注費', '地代家賃', '消耗品費', '旅費交通費', '広告宣伝費', '会議費'];
  data.biz.expense = Object.fromEntries(
    data.biz.categories.map((c, ci) => [c, MONTHS.map((_, i) => (ci + 1) * 1_000 + i * 10)]),
  );
  for (const [i, month] of MONTHS.entries()) {
    data.personal[month] = {
      income: { 給与: 200_000 + i * 500 },
      expense: {
        食費: 40_000 + i,
        住居費: 80_000,
        光熱費: 12_000 - i,
        日用品: 5_000,
        趣味: 3_000,
        医療費: 2_000,
      },
    };
    data.bizPersonal[month] = { income: 0, expense: 0 };
  }
  return data;
}

/** 総合範囲の材料。freee 取引と MF 家計明細を各月に置く (同額同日にしないので消し込みは起きない) */
const totalDeals: FreeeDeal[] = MONTHS.map((month, i) => ({
  month,
  date: `${month}-10`,
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: 'サブスク・通信',
  amount: 11_000 + i,
}));
const totalMfTx = (): MfTx[] =>
  MONTHS.flatMap((month, i) => [
    mf({ id: `mf-food-${month}`, m: month, d: `${month.slice(5)}/15`, c: '架空スーパー', a: -30_000 - i }),
    mf({
      id: `mf-home-${month}`,
      m: month,
      d: `${month.slice(5)}/16`,
      c: '架空不動産',
      a: -20_000,
      big: '住居費',
    }),
    mf({
      id: `mf-utility-${month}`,
      m: month,
      d: `${month.slice(5)}/17`,
      c: '架空電力',
      a: -10_000,
      big: '光熱費',
    }),
    mf({
      id: `mf-daily-${month}`,
      m: month,
      d: `${month.slice(5)}/18`,
      c: '架空日用品店',
      a: -5_000,
      big: '日用品',
    }),
    mf({
      id: `mf-hobby-${month}`,
      m: month,
      d: `${month.slice(5)}/19`,
      c: '架空娯楽店',
      a: -3_000,
      big: '趣味',
    }),
    mf({
      id: `mf-medical-${month}`,
      m: month,
      d: `${month.slice(5)}/20`,
      c: '架空医院',
      a: -2_000,
      big: '医療費',
    }),
    mf({
      id: `mf-pay-${month}`,
      m: month,
      d: `${month.slice(5)}/25`,
      c: '架空給与',
      a: 250_000,
      big: '収入',
      mid: '給与',
    }),
  ]);

const sumBy = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((s, r) => s + pick(r), 0);

describe('AC-001 4 要素は同じ月別系列から出る', () => {
  const data = fixture();
  data.mfTx = totalMfTx();
  const report = totalCashflowReport(data, totalDeals);

  for (const scope of ['total', 'business', 'household'] as const) {
    it(`${scope}: KPI 支出 = 年次比較の今期支出 = 内訳合計`, () => {
      const series = overviewScopeMonths(scope, { data, totalMonths: report.months });
      const agg = overviewAggregate(series, null);
      const expenseRow = agg.yearComparison.rows.find((r) => r.key === 'expense');
      expect(agg.kpi.expense).toBeGreaterThan(0);
      expect(expenseRow?.current).toBe(agg.kpi.expense);
      expect(agg.breakdown.total).toBe(agg.kpi.expense);
      expect(agg.breakdown.items.length).toBeLessThanOrEqual(6);
      expect(sumBy(agg.breakdown.items, (x) => x.amount)).toBe(agg.kpi.expense);
      expect(agg.kpi.balance).toBe(agg.kpi.income - agg.kpi.expense);
      // 集計窓は直近 12 か月、推移は期間内の全月
      expect(agg.kpi.months).toBe(12);
      expect(agg.trend.map((t) => t.month)).toEqual(MONTHS);
      const window = agg.trend.slice(-12);
      expect(sumBy(window, (t) => t.expense)).toBe(agg.kpi.expense);
      expect(sumBy(window, (t) => t.income)).toBe(agg.kpi.income);
    });
  }

  it('内訳は金額降順の上位 5 件 + その他で、表示行の合計と構成比を支出計に保つ', () => {
    const series = overviewScopeMonths('business', { data, totalMonths: report.months });
    const agg = overviewAggregate(series, null);
    expect(agg.breakdown.items).toHaveLength(6);
    expect(agg.breakdown.items[5]?.label).toBe('その他');
    const top = agg.breakdown.items.slice(0, 5).map((x) => x.amount);
    expect([...top].sort((a, b) => b - a)).toEqual(top);
    expect(sumBy(agg.breakdown.items, (x) => x.amount)).toBe(agg.breakdown.total);
    expect(sumBy(agg.breakdown.items, (x) => x.share)).toBeCloseTo(1, 10);
    expect(agg.breakdown.total).toBe(agg.kpi.expense);
  });

  it('総合の内訳は同じ総支出集合を科目別にし、事業と家計の同名ラベルを混ぜない', () => {
    const series = overviewScopeMonths('total', { data, totalMonths: report.months });
    const agg = overviewAggregate(series, null);
    expect(agg.breakdown.items).toHaveLength(6);
    expect(agg.breakdown.items[0]?.label).toBe('家計 / 食費');
    expect(agg.breakdown.items.some((item) => item.label === '事業 / サブスク・通信')).toBe(true);
    expect(agg.breakdown.items.at(-1)?.label).toBe('その他');
    expect(agg.kpi.expense).toBe(sumBy(report.months.slice(-12), (m) => m.totalExpense));
    for (const month of report.months) {
      expect(sumBy(Object.values(month.expenseCategories ?? {}), (amount) => amount)).toBe(
        month.totalExpense,
      );
    }
  });

  it('前期は今期の直前の同じ月数。足りなければ null', () => {
    const series = overviewScopeMonths('household', { data, totalMonths: report.months });
    const short = overviewAggregate(series, null);
    // 15 か月しかないので直前 12 か月が揃わない
    expect(short.yearComparison.previousLabel).toBeNull();
    expect(short.yearComparison.rows.every((r) => r.previous === null && r.delta === null)).toBe(true);

    const threeMonths = overviewAggregate(series, { from: '2026-07', to: '2026-09' });
    expect(threeMonths.kpi.months).toBe(3);
    expect(threeMonths.trend.map((t) => t.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    const expense = threeMonths.yearComparison.rows.find((r) => r.key === 'expense');
    const prev = sumBy(
      series.filter((m) => m.month >= '2026-04' && m.month <= '2026-06'),
      (m) => m.expense,
    );
    expect(expense?.previous).toBe(prev);
    expect(expense?.delta).toBe((expense?.current ?? 0) - prev);
  });

  it('前期の途中に欠けた月があれば、要素数が足りても null (暦で揃える)', () => {
    const series = overviewScopeMonths('household', { data, totalMonths: report.months });
    // 2026-05 を抜くと 2026-07..09 の直前 3 要素は 2026-03, 04, 06 になり、暦の「前 3 か月」ではない
    const gapped = series.filter((m) => m.month !== '2026-05');
    const agg = overviewAggregate(gapped, { from: '2026-07', to: '2026-09' });
    expect(agg.kpi.months).toBe(3);
    expect(agg.yearComparison.previousLabel).toBeNull();
    expect(agg.yearComparison.rows.every((r) => r.previous === null && r.delta === null)).toBe(true);
  });

  it('scope の妥当性', () => {
    expect(isOverviewScope('total')).toBe(true);
    expect(isOverviewScope('business')).toBe(true);
    expect(isOverviewScope('household')).toBe(true);
    expect(isOverviewScope('all')).toBe(false);
    expect(isOverviewScope(undefined)).toBe(false);
  });
});

function queueFixture() {
  const data = fixture();
  data.mfTx = [
    mf({ id: 'mf-small', c: '架空商店', a: -1_000, d: '09/03' }),
    mf({ id: 'mf-large', c: '架空書店', a: -9_000, d: '09/01', mid: '書籍' }),
    mf({ id: 'mf-same-old', c: '架空文具', a: -5_000, m: '2026-08', d: '08/20' }),
    mf({ id: 'mf-same-new', c: '架空雑貨', a: -5_000, d: '09/02' }),
  ];
  data.rules = [{ k: '架空雑貨', cls: null, big: '消耗品費', mid: null }];
  const review: ReconcileReview[] = [
    {
      mfTxId: 'mf-review',
      reason: '発生日が一致しません',
      mf: {
        date: '2026-09-10',
        displayDate: '09/10',
        content: '架空工房',
        amount: 20_000,
        io: 'expense',
        institution: '架空銀行',
        major: '事業',
        middle: '外注',
        memo: '',
        cls: 'biz',
        clsSrc: '中項目',
      },
      candidates: [],
    },
  ];
  const vendorMemories: VendorMemoryRecord[] = [
    { vendorKey: '架空商店', cls: 'per', big: '食費', mid: null, hitCount: 9, disagreeCount: 1 },
  ];
  const failedImports = [
    { id: 'run-1', createdAt: '2026-09-11T01:02:03.000Z', failureReason: '列が足りません' },
  ];
  return { data, review, vendorMemories, failedImports };
}

describe('未処理キューの順序と材料 (FR-002)', () => {
  it('照合 → 仕分け → 取込、同種別は金額の絶対値降順、同額は日付の新しい順', () => {
    const q = buildReviewQueue(queueFixture());
    expect(q.map((x) => `${x.kind}:${x.itemKey}`)).toEqual([
      'reconciliation:mf-review',
      'classification:mf-large',
      'classification:mf-same-new',
      'classification:mf-same-old',
      'classification:mf-small',
      'import:run-1',
    ]);
    expect(q[0]).toMatchObject({
      amount: -20_000,
      date: '2026-09-10',
      month: '2026-09',
      content: '架空工房',
    });
    expect(q[5]).toMatchObject({ amount: 0, date: '2026-09-11', recommendation: null, basis: 'none' });
    expect(q.find((x) => x.itemKey === 'mf-same-old')).toMatchObject({
      date: '2026-08-20',
      month: '2026-08',
    });
  });

  it('ルール等で区分が決まっている明細は仕分けキューに出ない', () => {
    const input = queueFixture();
    input.data.rules.push({ k: '架空文具', cls: 'biz' });
    const keys = buildReviewQueue(input).map((x) => x.itemKey);
    expect(keys).not.toContain('mf-same-old');
  });
});

describe('AC-006 推奨と信頼度は決定論', () => {
  it('vendor_memory → ルール → MF中項目 → 推奨なし', () => {
    const { data, vendorMemories } = queueFixture();
    const byId = new Map(data.mfTx.map((t) => [t.id, t]));
    const vm = recommendationFor(byId.get('mf-small') ?? null, '架空商店', data.rules, vendorMemories);
    expect(vm).toEqual({
      recommendation: '家計 / 食費',
      basis: 'vendor_memory',
      basisLabel: '過去 10 件中 9 件',
      confidence: 90,
    });

    const rule = recommendationFor(byId.get('mf-same-new') ?? null, '架空雑貨', data.rules, vendorMemories);
    expect(rule).toMatchObject({ recommendation: '消耗品費', basis: 'rule', confidence: null });

    const midTx = { ...(byId.get('mf-large') as MfTx), mid: '事業用品' };
    const mid = recommendationFor(midTx, '架空書店', data.rules, vendorMemories);
    expect(mid).toMatchObject({ recommendation: '事業', basis: 'mf_mid', confidence: null });

    const none = recommendationFor(byId.get('mf-same-old') ?? null, '架空文具', data.rules, vendorMemories);
    expect(none).toEqual({ recommendation: null, basis: 'none', basisLabel: '根拠なし', confidence: null });
  });

  it('取り消し済みの決め事は根拠にしない', () => {
    const { data } = queueFixture();
    const revoked: VendorMemoryRecord[] = [
      { vendorKey: '架空文具', cls: 'biz', hitCount: 5, disagreeCount: 0, revoked: true },
    ];
    const tx = data.mfTx.find((t) => t.id === 'mf-same-old') ?? null;
    expect(recommendationFor(tx, '架空文具', data.rules, revoked).basis).toBe('none');
  });

  it('同じ入力を 2 回渡すと同じキューになる', () => {
    expect(buildReviewQueue(queueFixture())).toEqual(buildReviewQueue(queueFixture()));
  });
});

describe('AC-003 内容指紋', () => {
  it('指紋は 64 桁の 16 進で、金額・日付・内容のどれが変わっても変わる', async () => {
    const base = { amount: -1_000, date: '2026-09-03', content: '架空商店' };
    const fp = await reviewItemFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(await reviewItemFingerprint({ ...base })).toBe(fp);
    expect(await reviewItemFingerprint({ ...base, amount: -1_001 })).not.toBe(fp);
    expect(await reviewItemFingerprint({ ...base, date: '2026-09-04' })).not.toBe(fp);
    expect(await reviewItemFingerprint({ ...base, content: '架空商店2' })).not.toBe(fp);
    // 区切り文字の位置ずらしで衝突しない
    expect(await reviewItemFingerprint({ amount: 1, date: '2|x', content: 'y' })).not.toBe(
      await reviewItemFingerprint({ amount: 1, date: '2', content: 'x|y' }),
    );
    // 指紋に本文そのものは入らない
    expect(fp).not.toContain('架空');
  });

  it('保留は指紋が一致する間だけ効き、内容が変わると再び数えられる', async () => {
    const input = queueFixture();
    const queue = buildReviewQueue(input);
    const target = queue.find((x) => x.itemKey === 'mf-small');
    if (!target) throw new Error('fixture');
    const snoozes = [
      { kind: target.kind, itemKey: target.itemKey, fingerprint: await reviewItemFingerprint(target) },
    ];

    const snoozed = await applyReviewSnoozes(queue, snoozes);
    expect(snoozed.snoozedCount).toBe(1);
    expect(snoozed.items.map((x) => x.itemKey)).not.toContain('mf-small');
    expect(snoozed.items).toHaveLength(queue.length - 1);
    // 解除の対象として、効いている保留だけを明細ごと返す
    expect(snoozed.snoozed.map((x) => x.itemKey)).toEqual(['mf-small']);

    // 同じ明細の金額が再取込で変わった
    const changed = queueFixture();
    changed.data.mfTx = changed.data.mfTx.map((t) => (t.id === 'mf-small' ? { ...t, a: -1_200 } : t));
    const again = await applyReviewSnoozes(buildReviewQueue(changed), snoozes);
    expect(again.snoozedCount).toBe(0);
    expect(again.snoozed).toEqual([]);
    expect(again.items.map((x) => x.itemKey)).toContain('mf-small');
  });

  it('種別が違えば同じ itemKey でも保留は効かない', async () => {
    const queue = buildReviewQueue(queueFixture());
    const target = queue.find((x) => x.itemKey === 'mf-small');
    if (!target) throw new Error('fixture');
    const fp = await reviewItemFingerprint(target);
    const r = await applyReviewSnoozes(queue, [
      { kind: 'reconciliation', itemKey: 'mf-small', fingerprint: fp },
    ]);
    expect(r.snoozedCount).toBe(0);
  });
});

describe('AC-004 月次クローズ 4 ステップの判定表', () => {
  type Row = {
    name: string;
    unrecorded: boolean;
    /** committed の取込があるか (省略時 true) */
    committed?: boolean;
    cls: number;
    rec: number;
    reviewed: boolean;
    done: boolean[];
  };
  const table: Row[] = [
    { name: '全部済み', unrecorded: false, cls: 0, rec: 0, reviewed: true, done: [true, true, true, true] },
    { name: '取込未了', unrecorded: true, cls: 0, rec: 0, reviewed: true, done: [false, true, true, true] },
    {
      name: '仕分け残',
      unrecorded: false,
      cls: 2,
      rec: 0,
      reviewed: false,
      done: [true, false, true, false],
    },
    { name: '照合残', unrecorded: false, cls: 0, rec: 1, reviewed: true, done: [true, true, false, true] },
    {
      name: '月はあるが committed の取込が無い (手入力の現金だけ)',
      unrecorded: false,
      committed: false,
      cls: 0,
      rec: 0,
      reviewed: true,
      done: [false, true, true, true],
    },
  ];
  for (const row of table) {
    it(row.name, () => {
      const data = fixture();
      if (row.unrecorded) data.unrecordedExpMonths = ['2026-09'];
      const item = (kind: 'classification' | 'reconciliation', i: number) => ({
        kind,
        itemKey: `${kind}-${i}`,
        amount: -1,
        date: '2026-09-01',
        month: '2026-09',
        content: '架空商店',
        recommendation: null,
        basis: 'none' as const,
        basisLabel: '根拠なし',
        confidence: null,
      });
      const items = [
        ...Array.from({ length: row.cls }, (_, i) => item('classification', i)),
        ...Array.from({ length: row.rec }, (_, i) => item('reconciliation', i)),
      ];
      const reviews = row.reviewed ? [{ month: '2026-09', reviewedAt: '2026-09-15T00:00:00.000Z' }] : [];
      const status = monthlyCloseStatus({ data, items, reviews, hasCommittedImport: row.committed ?? true });
      expect(status.month).toBe('2026-09');
      expect(status.steps.map((s) => s.key)).toEqual([
        'import',
        'classification',
        'reconciliation',
        'review',
      ]);
      expect(status.steps.map((s) => s.done)).toEqual(row.done);
      expect(status.doneCount).toBe(row.done.filter(Boolean).length);
      expect(status.total).toBe(4);
      expect(status.steps[1].count).toBe(row.cls);
      expect(status.steps[2].count).toBe(row.rec);
      expect(status.reviewedAt).toBe(row.reviewed ? '2026-09-15T00:00:00.000Z' : null);
    });
  }

  it('保留中の明細は保留前の全件で数え、仕分けステップを完了にしない (BR-005)', async () => {
    const input = queueFixture();
    const queue = buildReviewQueue(input);
    const snoozes = await Promise.all(
      queue
        .filter((x) => x.kind === 'classification')
        .map(async (x) => ({
          kind: x.kind,
          itemKey: x.itemKey,
          fingerprint: await reviewItemFingerprint(x),
        })),
    );
    const visible = await applyReviewSnoozes(queue, snoozes);
    expect(visible.items.some((x) => x.kind === 'classification')).toBe(false);
    const status = monthlyCloseStatus({
      data: input.data,
      items: queue,
      reviews: [],
      hasCommittedImport: true,
    });
    expect(status.steps[1]).toMatchObject({ key: 'classification', done: false, count: 4 });
  });

  it('データが無ければ対象月は null で全ステップ未完了', () => {
    const status = monthlyCloseStatus({
      data: emptyDataset(),
      items: [],
      reviews: [],
      hasCommittedImport: false,
    });
    expect(status.month).toBeNull();
    expect(status.steps[0].done).toBe(false);
    expect(status.steps[3].done).toBe(false);
  });
});

describe('BR-007 入力検証', () => {
  it('kind', () => {
    expect(['classification', 'reconciliation', 'import'].every(isReviewItemKind)).toBe(true);
    expect(isReviewItemKind('other')).toBe(false);
  });
  it('itemKey は 1..200 文字', () => {
    expect(REVIEW_ITEM_KEY_MAX).toBe(200);
    expect(isReviewItemKey('a')).toBe(true);
    expect(isReviewItemKey('a'.repeat(200))).toBe(true);
    expect(isReviewItemKey('')).toBe(false);
    expect(isReviewItemKey('a'.repeat(201))).toBe(false);
  });
  it('month は YYYY-MM (01..12)', () => {
    expect(isCloseMonth('2026-09')).toBe(true);
    expect(isCloseMonth('2026-12')).toBe(true);
    expect(isCloseMonth('2026-13')).toBe(false);
    expect(isCloseMonth('2026-00')).toBe(false);
    expect(isCloseMonth('2026-9')).toBe(false);
    expect(isCloseMonth("2026-09' OR 1=1")).toBe(false);
  });
});
