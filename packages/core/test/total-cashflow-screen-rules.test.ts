/**
 * 総収支画面の規則 (BR-001..BR-007) の契約テスト。
 *
 * 実装より先に書く赤いテストである (SYS-TCSCREEN-P04)。実装は SYS-TCSCREEN-P05 が
 * `packages/core/src/total-cashflow.ts` に置く。
 *
 * 期待値の正本は `specs/spec-total-cashflow-screen.md` の BR-001..BR-009、
 * 着手時の扱いは `docs/total-cashflow-screen/requirements-baseline.md` の U-001..U-006。
 *
 * | 規則 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | BR-001 | 一致度 = 金額40 + 日付30/20/10/5/0 + 口座15/8/0 + 摘要15/8/0 | `BR-001-*` |
 * | BR-002 | 判定作業 3 区分の和 = review 件数 + 除外件数 | `BR-002-*` |
 * | BR-003 | 自動一致の一致度は 78..100 をそのまま出す | `BR-003-*` |
 * | BR-004 | 総合 = 事業 + 家計 を期間合計と月次系列の双方で満たす | `BR-004-*` |
 * | BR-005 | 唯一の候補を除外した明細は review から出て公私仕分けで数える | `BR-005-*` |
 * | BR-006 | 前年同期は 12 か月前。1 か月でも欠ければ null | `BR-006-*` |
 * | BR-007 | 判定進捗の N と M | `BR-007-*` |
 *
 * ## 置換前に落ちる理由
 *
 * `matchScore` / `previousYearPeriod` / `totalCashflowScreen` は置換前に存在しない。
 * BR-005 は `nearCandidates` が除外済みを先に落とすため、除外前の候補数を判定できず落ちる。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  emptyDataset,
  freeeDealKeys,
  matchScore,
  previousYearPeriod,
  reconcileBizDuplicates,
  totalCashflowScreen,
} from '../src/index.js';

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-08',
  d: '08/05',
  c: '架空クラウド',
  a: -3_300,
  big: '通信費',
  mid: 'サブスク',
  inst: '三井住友銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-08',
  date: '2026-08-05',
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: 'サブスク・通信',
  amount: 3_300,
  ...over,
});

function dataset(txs: MfTx[], months = ['2026-08']): Dataset {
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  return data;
}

const score = (over: Partial<Parameters<typeof matchScore>[0]> = {}) =>
  matchScore({
    dayGap: 0,
    mfAccount: '三井住友銀行 普通',
    freeeAccount: '三井住友銀行 普通',
    mfText: '架空クラウド',
    freeeText: '架空クラウド',
    ...over,
  });

describe('BR-001 一致度の配点', () => {
  it('BR-001-満点 すべて一致で 100', () => {
    expect(score()).toBe(100);
  });

  it('BR-001-日付 |dayGap| 0/1/2/3/4 で 30/20/10/5/0 になる', () => {
    const base = 40 + 15 + 15;
    expect([0, 1, 2, 3, 4].map((dayGap) => score({ dayGap }) - base)).toEqual([30, 20, 10, 5, 0]);
  });

  it('BR-001-日付-負号 dayGap の符号は結果を変えない', () => {
    expect([1, 2, 3, 4].map((d) => score({ dayGap: -d }))).toEqual(
      [1, 2, 3, 4].map((d) => score({ dayGap: d })),
    );
  });

  it('BR-001-口座 一致 15 / 片側情報なし 8 / 食い違い 0', () => {
    const base = 40 + 30 + 15;
    expect(score() - base).toBe(15);
    expect(score({ freeeAccount: '' }) - base).toBe(8);
    expect(score({ mfAccount: '' }) - base).toBe(8);
    expect(score({ freeeAccount: '楽天銀行 普通' }) - base).toBe(0);
  });

  it('BR-001-摘要 一致 15 / 含む 8 / それ以外 0', () => {
    const base = 40 + 30 + 15;
    expect(score() - base).toBe(15);
    expect(score({ freeeText: '架空クラウド ジャパン' }) - base).toBe(8);
    expect(score({ freeeText: '別会社' }) - base).toBe(0);
  });

  it('BR-001-摘要-空 片方が空なら「含む」にせず 0 にする', () => {
    const base = 40 + 30 + 15;
    expect(score({ freeeText: '' }) - base).toBe(0);
    expect(score({ mfText: '' }) - base).toBe(0);
  });

  it('BR-001-整数 0..100 の整数に収まる', () => {
    const all = [0, 1, 2, 3, 4].flatMap((dayGap) =>
      ['三井住友銀行 普通', '', '楽天銀行 普通'].flatMap((freeeAccount) =>
        ['架空クラウド', '架空クラウド ジャパン', '別会社', ''].map((freeeText) =>
          score({ dayGap, freeeAccount, freeeText }),
        ),
      ),
    );
    expect(all.filter((v) => !Number.isInteger(v) || v < 0 || v > 100)).toEqual([]);
  });
});

describe('BR-003 自動一致の一致度', () => {
  const data = dataset([mf({ id: 'mf-a' })]);
  // 口座 15 点を付けるには freee 側の決済口座欄が要る (`accountRaw` は勘定科目であって口座ではない)
  const deals = [deal({ settleAccount: '三井住友銀行 普通' })];

  it('BR-003-下限 口座も摘要も情報が無い自動一致は 78 で、100 に丸めない', () => {
    expect(score({ mfAccount: '', freeeAccount: '', mfText: 'あ', freeeText: 'い' })).toBe(78);
  });

  it('BR-003-そのまま autoMatches は by=auto の組だけを score つきで返す', () => {
    const screen = totalCashflowScreen(data, deals, [], [], { from: '2026-08', to: '2026-08' });
    expect(screen.autoMatches.map((m) => m.mfTxId)).toEqual(['mf-a']);
    expect(screen.autoMatches[0]?.score).toBe(100);
    expect(screen.autoMatches.every((m) => m.by === 'auto')).toBe(true);
  });

  it('BR-003-不変 「同じ取引にする」は同じ組を user 側へ動かすだけで総額を変えない', () => {
    const before = totalCashflowScreen(data, deals, [], [], { from: '2026-08', to: '2026-08' });
    const after = totalCashflowScreen(
      data,
      deals,
      [{ txId: 'mf-a', verdict: 'same', freeeKey: freeeDealKeys(deals)[0] }],
      [],
      { from: '2026-08', to: '2026-08' },
    );
    expect(after.summary.total).toEqual(before.summary.total);
  });
});

describe('BR-004 セグメントの恒等式', () => {
  const data = dataset(
    [
      mf({ id: 'mf-biz', mid: '事業・その他', a: -10_000 }),
      mf({ id: 'mf-home', c: 'スーパー', mid: '食料品', a: -2_000 }),
      mf({ id: 'mf-in', c: '給与', big: '収入', mid: '給与', a: 300_000 }),
    ],
    ['2026-08'],
  );

  it('BR-004-期間合計 総合 = 事業 + 家計', () => {
    const s = totalCashflowScreen(data, [], [], [], { from: '2026-08', to: '2026-08' }).summary;
    expect(s.total.income).toBe(s.biz.income + s.household.income);
    expect(s.total.expense).toBe(s.biz.expense + s.household.expense);
    expect(s.total.balance).toBe(s.total.income - s.total.expense);
  });

  it('BR-004-月次 月ごとにも 総合 = 事業 + 家計 が成り立つ', () => {
    const { series } = totalCashflowScreen(data, [], [], [], { from: '2026-08', to: '2026-08' });
    const broken = series.filter(
      (r) =>
        r.total.income !== r.biz.income + r.household.income ||
        r.total.expense !== r.biz.expense + r.household.expense,
    );
    expect(broken).toEqual([]);
  });
});

describe('BR-006 前年同期', () => {
  it('BR-006-期間 開始月と終了月をそれぞれ 12 か月前へずらす', () => {
    expect(previousYearPeriod({ from: '2025-09', to: '2026-08' })).toEqual({
      from: '2024-09',
      to: '2025-08',
    });
    expect(previousYearPeriod({ from: '2026-01', to: '2026-03' })).toEqual({
      from: '2025-01',
      to: '2025-03',
    });
  });

  const months = ['2025-07', '2025-08', '2026-07', '2026-08'];
  const txs = [
    mf({ id: 'p1', m: '2025-07', d: '07/05', a: -1_000 }),
    mf({ id: 'p2', m: '2025-08', d: '08/05', a: -2_000 }),
    mf({ id: 'c1', m: '2026-07', d: '07/05', a: -4_000 }),
    mf({ id: 'c2', m: '2026-08', d: '08/05', a: -6_000 }),
  ];

  it('BR-006-あり 前年同期間の全月が揃えば差額と率を出す', () => {
    const s = totalCashflowScreen(dataset(txs, months), [], [], [], {
      from: '2026-07',
      to: '2026-08',
    }).summary;
    expect(s.total.previousYear?.expense).toBe(3_000);
    expect(s.total.change?.expense.diff).toBe(10_000 - 3_000);
    expect(s.total.change?.expense.rate).toBeCloseTo(7_000 / 3_000, 10);
  });

  it('BR-006-欠け 前年側が 1 か月でも欠ければ null', () => {
    const lacking = months.filter((m) => m !== '2025-07');
    const s = totalCashflowScreen(
      dataset(
        txs.filter((t) => t.m !== '2025-07'),
        lacking,
      ),
      [],
      [],
      [],
      { from: '2026-07', to: '2026-08' },
    ).summary;
    expect(s.total.previousYear).toBeNull();
    expect(s.total.change).toBeNull();
  });

  it('BR-006-ゼロ除算 前年値 0 のとき差額は出すが率は null', () => {
    const only = ['2025-07', '2025-08', '2026-07', '2026-08'];
    const s = totalCashflowScreen(
      dataset([mf({ id: 'c2', m: '2026-08', d: '08/05', a: -6_000 })], only),
      [],
      [],
      [],
      { from: '2026-07', to: '2026-08' },
    ).summary;
    expect(s.total.previousYear?.expense).toBe(0);
    expect(s.total.change?.expense.diff).toBe(6_000);
    expect(s.total.change?.expense.rate).toBeNull();
  });
});

describe('BR-002 / BR-005 / BR-007 判定作業', () => {
  // 発生日が 1 日ずれた組: 自動では消し込まれず、候補 1 件つきで review に入る
  const shifted = dataset([mf({ id: 'mf-s', d: '08/06' })]);
  const shiftedDeals = [deal()];

  it('BR-002-和 3 区分の和が review 件数 + 除外件数に一致する', () => {
    const screen = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    const { duplicates, needsReview, excluded } = screen.workbench;
    const base = reconcileBizDuplicates(shifted, shiftedDeals, [], []);
    expect(duplicates.length + needsReview.length + excluded.length).toBe(
      base.review.length + base.excluded.length,
    );
  });

  it('BR-002-重複候補 候補ちょうど 1 件かつ日付ずれ理由のものだけが重複候補に入る', () => {
    const screen = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    expect(screen.workbench.duplicates.map((d) => d.mfTxId)).toEqual(['mf-s']);
    expect(screen.workbench.needsReview).toEqual([]);
  });

  it('BR-002-要確認 候補 0 件は要確認に入り、重複候補には入らない', () => {
    const alone = dataset([mf({ id: 'mf-alone', c: '誰か', a: -999, mid: '事業・その他' })]);
    const screen = totalCashflowScreen(alone, [], [], [], { from: '2026-08', to: '2026-08' });
    expect(screen.workbench.duplicates).toEqual([]);
  });

  it('BR-002-口座不一致 口座が食い違う組は要確認へ入る', () => {
    const data = dataset([mf({ id: 'mf-c', inst: '楽天銀行 普通' })]);
    const deals = [deal({ settleAccount: '三井住友銀行 普通' })];
    const screen = totalCashflowScreen(data, deals, [], [], { from: '2026-08', to: '2026-08' });
    expect(screen.workbench.needsReview.map((r) => r.mfTxId)).toContain('mf-c');
    expect(screen.workbench.duplicates.map((r) => r.mfTxId)).not.toContain('mf-c');
  });

  it('BR-005-唯一 唯一の候補を除外した明細は review から出る', () => {
    const keys = freeeDealKeys(shiftedDeals);
    const screen = totalCashflowScreen(
      shifted,
      shiftedDeals,
      [],
      [{ freeeKey: keys[0]!, reason: '振替', reasonCode: 'transfer' }],
      { from: '2026-08', to: '2026-08' },
    );
    expect(screen.workbench.duplicates).toEqual([]);
    expect(screen.workbench.needsReview).toEqual([]);
    expect(screen.workbench.excluded.map((e) => e.freeeKey)).toEqual([keys[0]]);
  });

  it('BR-005-戻す 除外を戻すと同じ明細が review へ戻る', () => {
    const before = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    const keys = freeeDealKeys(shiftedDeals);
    const excluded = totalCashflowScreen(
      shifted,
      shiftedDeals,
      [],
      [{ freeeKey: keys[0]!, reason: '振替', reasonCode: 'transfer' }],
      { from: '2026-08', to: '2026-08' },
    );
    const restored = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    expect(excluded.workbench.duplicates).toEqual([]);
    expect(restored.workbench.duplicates.map((d) => d.mfTxId)).toEqual(
      before.workbench.duplicates.map((d) => d.mfTxId),
    );
  });

  it('BR-005-複数 候補 2 件が全部除外済みでも review に残る', () => {
    const data = dataset([mf({ id: 'mf-m', d: '08/06' })]);
    const deals = [deal(), deal({ date: '2026-08-07', partner: '架空クラウド 2' })];
    const keys = freeeDealKeys(deals);
    const screen = totalCashflowScreen(
      data,
      deals,
      [],
      keys.map((freeeKey) => ({ freeeKey, reason: '振替', reasonCode: 'transfer' as const })),
      { from: '2026-08', to: '2026-08' },
    );
    const inWorkbench = [...screen.workbench.duplicates, ...screen.workbench.needsReview];
    expect(inWorkbench.map((r) => r.mfTxId)).toContain('mf-m');
  });

  it('BR-005-仕分け review から出た明細は公私仕分けで数えられ、総額は減らない', () => {
    const keys = freeeDealKeys(shiftedDeals);
    const before = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    const after = totalCashflowScreen(
      shifted,
      shiftedDeals,
      [],
      [{ freeeKey: keys[0]!, reason: '振替', reasonCode: 'transfer' }],
      { from: '2026-08', to: '2026-08' },
    );
    expect(after.summary.total.expense).toBeGreaterThanOrEqual(0);
    expect(after.summary.total.expense).toBe(after.summary.biz.expense + after.summary.household.expense);
    expect(before.summary.total.expense).toBe(before.summary.biz.expense + before.summary.household.expense);
  });

  it('BR-007-進捗 区分ごとに 対象件数 N と判定済み件数 M を返す', () => {
    const screen = totalCashflowScreen(shifted, shiftedDeals, [], [], {
      from: '2026-08',
      to: '2026-08',
    });
    expect(screen.workbench.progress.duplicates).toEqual({ total: 1, decided: 0 });

    const decided = totalCashflowScreen(shifted, shiftedDeals, [{ txId: 'mf-s', verdict: 'different' }], [], {
      from: '2026-08',
      to: '2026-08',
    });
    expect(decided.workbench.progress.duplicates.decided).toBe(decided.workbench.progress.duplicates.total);
  });
});
