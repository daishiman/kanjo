/**
 * 照合画面の導出 (SYS-RECON-P04 で先に書いた赤いテスト)。
 *
 * 期待値の正本は `specs/spec-reconciliation.md` と `docs/reconciliation/requirements-baseline.md`。
 * 仕様で未決だった 7 件は、ここの assertion で値を固定する (確定の理由は architecture-decision.md)。
 *
 * | 未決事項 | 固定したテスト |
 * |---|---|
 * | 一致度の丸め | `一致度は Math.round で整数にする` |
 * | Dice の重複 bigram | `重複 bigram は多重集合で数える` |
 * | 0.5 ちょうどの比較 | `0.5 ちょうどは類似に含める` |
 * | ステータス定義 | `状態は 5 語で、行ごとに 1 つだけ` (利用者の指摘で MFのみ を未処理から分けた) |
 * | 月次レビュー API・再取消・actions 応答 | api/test/reconciliation.integration.test.ts |
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  RECONCILIATION_STATUS_LABELS,
  contentIsSimilar,
  contentSimilarity,
  emptyDataset,
  freeeDealKeys,
  isPairableFreee,
  matchScore,
  monthlyTotalCashflow,
  reconcileBizDuplicates,
  reconciliationReport,
  totalCashflowReport,
} from '../src/index.js';

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-08',
  d: '08/10',
  c: '架空クラウド',
  a: -3_300,
  big: '通信費',
  mid: '事業経費',
  inst: '',
  isTarget: true,
  isTransfer: false,
  ...over,
});

const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-08',
  date: '2026-08-10',
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: '通信費',
  amount: 3_300,
  ...over,
});

function dataset(txs: MfTx[]): Dataset {
  const data = emptyDataset();
  data.months = ['2026-08'];
  data.biz.revenue = [0];
  data.subs.other = [0];
  data.mfTx = txs;
  return data;
}

describe('内容の類似度 (Dice 係数)', () => {
  it('仕様の例示どおりの値になる', () => {
    expect(contentSimilarity('Amazon.co.jp', 'Amazon.co.jp')).toBe(1);
    expect(contentSimilarity('Amazon.co.jp', 'アマゾン')).toBe(0);
    expect(contentSimilarity('ヤマト運輸', 'ヤマト運輸株式会社')).toBeCloseTo(2 / 3, 10);
    expect(contentSimilarity('東京電力', '東京ガス')).toBeCloseTo(1 / 3, 10);
  });

  it('全角半角・空白・大文字小文字の違いは同じとみなす', () => {
    expect(contentSimilarity('ＡＷＳ　Ｊａｐａｎ', 'aws japan')).toBe(1);
  });

  it('重複 bigram は多重集合で数える', () => {
    // 「ああああ」は「ああ」3 つ、「ああ」は 1 つ。集合で数えると 1.0 になってしまう
    expect(contentSimilarity('ああああ', 'ああ')).toBeCloseTo(0.5, 10);
  });

  it('2 文字未満は正規化後の完全一致だけで判定する', () => {
    expect(contentSimilarity('A', 'a')).toBe(1);
    expect(contentSimilarity('A', 'AB')).toBe(0);
    expect(contentSimilarity('', '')).toBe(0);
  });

  it('0.5 ちょうどは類似に含める', () => {
    // bigram: ABCD = {AB,BC,CD}, ABXY... → 共通 AB,BC ではなく、ちょうど 0.5 になる組を使う
    // 「ああああ」(3) と「ああ」(1): 共通 1 → 2/4 = 0.5
    expect(contentIsSimilar('ああああ', 'ああ')).toBe(true);
    expect(contentIsSimilar('東京電力', '東京ガス')).toBe(false);
    expect(contentIsSimilar('ヤマト運輸', 'ヤマト運輸株式会社')).toBe(true);
  });
});

describe('一致度', () => {
  it('金額 50 + 日付 + 類似度 × 20', () => {
    expect(matchScore({ amountEqual: true, dayGap: 0, similarity: 1 })).toBe(100);
    expect(matchScore({ amountEqual: true, dayGap: 1, similarity: 0 })).toBe(70);
    expect(matchScore({ amountEqual: true, dayGap: -2, similarity: 0 })).toBe(60);
    expect(matchScore({ amountEqual: true, dayGap: 3, similarity: 0 })).toBe(55);
    expect(matchScore({ amountEqual: true, dayGap: 4, similarity: 0 })).toBe(50);
    expect(matchScore({ amountEqual: false, dayGap: 0, similarity: 0 })).toBe(30);
  });

  it('一致度は Math.round で整数にする', () => {
    // 50 + 30 + 2/3 × 20 = 93.33 → 93
    expect(matchScore({ amountEqual: true, dayGap: 0, similarity: 2 / 3 })).toBe(93);
    // 50 + 5 + 0.525 × 20 = 65.5 → 66
    expect(matchScore({ amountEqual: true, dayGap: 3, similarity: 0.525 })).toBe(66);
  });
});

describe('照合の行と状態', () => {
  it('状態は 5 語で、行ごとに 1 つだけ', () => {
    expect(Object.values(RECONCILIATION_STATUS_LABELS)).toEqual([
      '未処理',
      '要確認',
      '照合済み',
      'MFのみ',
      '除外',
    ]);
  });

  it('同日同額は照合済み、一致の理由を 3 つ返す', () => {
    const report = reconciliationReport({ data: dataset([mf()]), deals: [deal()] });
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0]!;
    expect(row.status).toBe('matched');
    expect(row.matchedBy).toBe('auto');
    expect(row.score).toBe(100);
    expect(row.difference).toBe(0);
    expect(row.reasons.map((r) => [r.kind, r.ok])).toEqual([
      ['amount', true],
      ['date', true],
      ['content', true],
    ]);
  });

  it('日付が 3 日ずれた同額は要確認で、日付の近い取引のキューにも入る', () => {
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals: [deal({ date: '2026-08-13' })],
    });
    const row = report.rows[0]!;
    expect(row.status).toBe('review');
    expect(row.queues).toEqual(['review', 'nearDate']);
    expect(row.candidateKeys).toHaveLength(1);
    expect(report.queues.nearDate).toBe(1);
  });

  it('日付が 4 日ずれると要確認にならず、事業支出なら MFのみ (対応不要)', () => {
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals: [deal({ date: '2026-08-14' })],
    });
    const row = report.rows[0]!;
    expect(row.status).toBe('mfOnly');
    expect(row.queues).toEqual(['mfOnly']);
    expect(report.kpi.mfOnlyCount).toBe(1);
    expect(report.kpi.mfOnlyAmount).toBe(3_300);
    expect(report.unmatchedFreee).toHaveLength(1);
    // 総収支は MF の金額で計上済み。照合の問いは無いので、解消率の分母にも対応の件数にも入れない
    expect(report.kpi.resolvableCount).toBe(0);
    expect(report.kpi.resolutionRate).toBeNull();
    expect(report.statusCounts.unprocessed + report.statusCounts.review).toBe(0);
    // freee 3,300 と組まなかったので、事業支出は freee 3,300 + MFのみ 3,300 (総収支の合算と同じ)
    expect(report.kpi.businessExpense).toBe(6_600);
  });

  it('同日 (日付差 0) の要確認は日付の近い取引に入れない', () => {
    // 口座不一致で寄らなかった組は同日でも要確認に残る
    const report = reconciliationReport({
      data: dataset([mf({ inst: '三井住友銀行' })]),
      deals: [deal({ settleAccount: 'みずほ銀行' })],
    });
    const row = report.rows[0]!;
    expect(row.status).toBe('review');
    expect(row.reviewReason).toBe('口座不一致');
    expect(row.queues).toEqual(['review']);
  });

  it('家計の支出で相手がいなければ一覧に出さない', () => {
    const report = reconciliationReport({ data: dataset([mf({ mid: '食費' })]), deals: [] });
    expect(report.rows).toEqual([]);
    expect(report.kpi.resolutionRate).toBeNull();
  });

  it('事業の収入は MFのみにしない (支出だけが対象)', () => {
    const report = reconciliationReport({ data: dataset([mf({ a: 3_300 })]), deals: [] });
    expect(report.rows).toEqual([]);
  });
});

describe('金額の差異キュー', () => {
  const base = () => ({ data: dataset([mf()]), deals: [deal({ amount: 3_000, date: '2026-08-11' })] });

  it('±3 日・同じ向き・内容が類似・金額違いの freee があると入る', () => {
    const row = reconciliationReport(base()).rows[0]!;
    expect(row.queues).toContain('amountMismatch');
    expect(row.difference).toBe(300);
    expect(row.reasons[0]).toEqual({ kind: 'amount', ok: false, label: '金額が異なる（差額 ¥300）' });
  });

  it('日付が 4 日ずれると入らない', () => {
    const row = reconciliationReport({ ...base(), deals: [deal({ amount: 3_000, date: '2026-08-14' })] })
      .rows[0]!;
    expect(row.queues).not.toContain('amountMismatch');
  });

  it('向きが違うと入らない', () => {
    const row = reconciliationReport({ ...base(), deals: [deal({ amount: 3_000, io: 'income' })] }).rows[0]!;
    expect(row.queues).not.toContain('amountMismatch');
  });

  it('内容が類似しなければ入らない', () => {
    const row = reconciliationReport({ ...base(), deals: [deal({ amount: 3_000, partner: '東京ガス' })] })
      .rows[0]!;
    expect(row.queues).not.toContain('amountMismatch');
  });

  it('金額が同じなら差異ではない', () => {
    const row = reconciliationReport({ ...base(), deals: [deal({ date: '2026-08-11' })] }).rows[0]!;
    expect(row.queues).not.toContain('amountMismatch');
  });

  it('家計の明細は、内容が似ていても金額違いの freee と組ませない', () => {
    // 同じ店での私用の買い物と事業の買い物は金額が違って当然。差異として並べると一覧が埋まる
    const report = reconciliationReport({ ...base(), data: dataset([mf({ mid: '食費' })]) });
    expect(report.rows).toEqual([]);
    expect(report.queues.amountMismatch).toBe(0);
  });

  it('1 件の freee 取引は 1 件の明細にだけ相手として見せる (まとめて照合しても全件が組める)', () => {
    const txs = [
      mf({ id: 'mf-1', c: '架空クラウド 東京', d: '08/10' }),
      mf({ id: 'mf-2', c: '架空クラウド', d: '08/11', a: -3_400 }),
      mf({ id: 'mf-3', c: '架空クラウド 大阪', d: '08/12', a: -3_500 }),
    ];
    const deals = [deal({ amount: 3_000, date: '2026-08-11' }), deal({ amount: 2_900, date: '2026-08-12' })];
    const report = reconciliationReport({ data: dataset(txs), deals });
    const partners = report.rows
      .filter((row) => row.status === 'unprocessed')
      .map((row) => row.freee!.freeeKey);
    expect(partners).toHaveLength(2);
    expect(new Set(partners).size).toBe(2);
    // 相手が残らなかった明細は、対応不要の MFのみ
    expect(report.statusCounts).toMatchObject({ unprocessed: 2, mfOnly: 1 });

    // 見えている相手のとおりに全件「同じ」とすれば、全件が照合済みになる
    const keys = freeeDealKeys(deals);
    const verdicts = report.rows
      .filter((row) => row.status === 'unprocessed')
      .map((row) => ({ txId: row.txId, verdict: 'same' as const, freeeKey: row.freee!.freeeKey }));
    expect(verdicts.every((v) => keys.includes(v.freeeKey))).toBe(true);
    const after = reconciliationReport({ data: dataset(txs), deals, verdicts });
    expect(after.statusCounts).toMatchObject({ unprocessed: 0, matched: 2, mfOnly: 1 });
  });
});

describe('利用者の判断と除外', () => {
  it('「別の取引」と判断した行は照合済み (matchedBy=different) で、要確認に数えない', () => {
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals: [deal({ date: '2026-08-12' })],
      verdicts: [{ txId: 'mf-1', verdict: 'different' }],
    });
    expect(report.rows[0]).toMatchObject({ status: 'matched', matchedBy: 'different' });
    expect(report.kpi.reviewCount).toBe(0);
  });

  it('「同じ取引」と判断すれば ±3 日の組でも照合済み (matchedBy=user)', () => {
    const deals = [deal({ date: '2026-08-12' })];
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals,
      verdicts: [{ txId: 'mf-1', verdict: 'same', freeeKey: freeeDealKeys(deals)[0] }],
    });
    expect(report.rows[0]).toMatchObject({ status: 'matched', matchedBy: 'user' });
  });

  it('金額の差異の行で相手を名指しして「同じ取引」とすれば照合済みになり、総額は freee の金額で数える', () => {
    const deals = [deal({ amount: 3_000, date: '2026-08-11' })];
    const data = dataset([mf()]);
    const before = reconciliationReport({ data, deals });
    expect(before.rows[0]).toMatchObject({ status: 'unprocessed', freee: { amount: 3_000 } });
    expect(before.rows[0]!.queues).toContain('amountMismatch');

    const verdicts = [{ txId: 'mf-1', verdict: 'same' as const, freeeKey: freeeDealKeys(deals)[0] }];
    const report = reconciliationReport({ data, deals, verdicts });
    expect(report.rows[0]).toMatchObject({ status: 'matched', matchedBy: 'user', difference: 300 });
    expect(report.queues.amountMismatch).toBe(0);
    expect(report.unmatchedFreee).toHaveLength(0);
    expect(report.kpi.businessExpense).toBe(3_000);
    // 総収支でも MF の 3,300 を足さず、正本の freee 3,000 だけを事業支出に数える
    expect(monthlyTotalCashflow(data, deals, verdicts)[0]).toMatchObject({ bizExpense: 3_000 });
  });

  it('名指しの無い「同じ取引」は金額違いの freee へ寄せない (どれと組むかを金額で絞れないため)', () => {
    const deals = [deal({ amount: 3_000, date: '2026-08-11' })];
    const result = reconcileBizDuplicates(dataset([mf()]), deals, [{ txId: 'mf-1', verdict: 'same' }]);
    expect(result.matched).toHaveLength(0);
  });

  it('名指しでも向き違い・±3 日の外の freee へは寄せない', () => {
    const deals = [deal({ amount: 3_000, date: '2026-08-14' }), deal({ amount: 3_000, io: 'income' })];
    const keys = freeeDealKeys(deals);
    const tx = mf();
    expect(deals.map((d) => isPairableFreee(tx, d))).toEqual([false, false]);
    for (const freeeKey of keys) {
      const result = reconcileBizDuplicates(dataset([tx]), deals, [
        { txId: 'mf-1', verdict: 'same', freeeKey },
      ]);
      expect(result.matched).toHaveLength(0);
    }
  });

  it('事業の明細に残った「別の取引」も、見比べる相手が無ければ照合済みではなく MFのみ', () => {
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals: [deal({ amount: 1_000, partner: '東京ガス' })],
      verdicts: [{ txId: 'mf-1', verdict: 'different' }],
    });
    expect(report.rows[0]).toMatchObject({ status: 'mfOnly', matchedBy: null });
    expect(report.kpi.resolvableCount).toBe(0);
  });

  it('家計の明細に残った「別の取引」は、見比べる相手が無ければ照合済みに数えない', () => {
    const report = reconciliationReport({
      data: dataset([mf({ mid: '食費', c: '架空スーパー' })]),
      // 金額も内容も違う freee 取引。判断が無くても照合の問いには載らない組
      deals: [deal({ amount: 1_000 })],
      verdicts: [{ txId: 'mf-1', verdict: 'different' }],
    });
    expect(report.rows).toHaveLength(0);
    expect(report.kpi.resolvableCount).toBe(0);
  });

  it('MF を除外した行は除外になり、MFのみにも解消率の分母にも入らない', () => {
    const report = reconciliationReport({
      data: dataset([mf(), mf({ id: 'mf-2', c: '架空ホスティング', a: -1_000 })]),
      deals: [deal()],
      mfExclusions: [{ txId: 'mf-2', reason: '照合画面で除外' }],
    });
    expect(report.statusCounts).toEqual({ unprocessed: 0, review: 0, matched: 1, mfOnly: 0, excluded: 1 });
    expect(report.rows.find((row) => row.txId === 'mf-2')).toMatchObject({ excludedBy: 'mf' });
    expect(report.kpi.resolutionRate).toBe(1);
    expect(report.kpi.mfOnlyCount).toBe(0);
  });

  it('相手の freee を除外した要確認の行は除外 (excludedBy=freee) になるが、事業支出は MF の金額で残る', () => {
    const deals = [deal({ date: '2026-08-12' })];
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals,
      freeeExclusions: [{ freeeKey: freeeDealKeys(deals)[0]!, reason: '照合画面で除外' }],
    });
    expect(report.rows[0]).toMatchObject({ status: 'excluded', excludedBy: 'freee' });
    // 除外は照合の問いから外すだけ。総収支は MF の 3,300 円を数え続けるので、KPI も同じ額を保つ
    expect(report.kpi.businessExpense).toBe(3_300);
  });
});

describe('除外と事業支出', () => {
  it('MF の事業支出を照合から除外しても、事業支出の KPI は変わらない (総収支の金額を動かさないため)', () => {
    const before = reconciliationReport({ data: dataset([mf()]), deals: [] });
    const after = reconciliationReport({
      data: dataset([mf()]),
      deals: [],
      mfExclusions: [{ txId: 'mf-1', reason: '照合画面で除外' }],
    });
    expect(before.rows[0]).toMatchObject({ status: 'mfOnly' });
    expect(after.rows[0]).toMatchObject({ status: 'excluded', excludedBy: 'mf' });
    expect(after.kpi.businessExpense).toBe(before.kpi.businessExpense);
    expect(after.kpi.businessExpense).toBe(3_300);
    // 除外した行は MFのみの件数と解消率の分母からは外れる
    expect(after.kpi.mfOnlyCount).toBe(0);
    expect(after.kpi.resolutionRate).toBeNull();
  });
});

describe('件数の一本化', () => {
  it('122件でも MFのみ42・要確認39・照合済み41を同じ1回の導出から返す', () => {
    const matchedTxs = Array.from({ length: 41 }, (_, index) => {
      const day = 1 + (index % 20);
      return mf({
        id: `matched-${index}`,
        d: `08/${String(day).padStart(2, '0')}`,
        c: `架空照合済み${index}`,
        a: -(10_000 + index),
      });
    });
    const reviewTxs = Array.from({ length: 39 }, (_, index) => {
      const day = 10 + (index % 10);
      return mf({
        id: `review-${index}`,
        d: `08/${String(day).padStart(2, '0')}`,
        c: `架空要確認${index}`,
        a: -(20_000 + index),
      });
    });
    const mfOnlyTxs = Array.from({ length: 42 }, (_, index) =>
      mf({
        id: `mf-only-${index}`,
        d: `08/${String(1 + (index % 20)).padStart(2, '0')}`,
        c: `架空MFのみ${index}`,
        a: -(30_000 + index),
      }),
    );
    const matchedDeals = matchedTxs.map((tx, index) =>
      deal({ date: `2026-08-${tx.d.slice(3)}`, partner: tx.c, amount: 10_000 + index }),
    );
    const reviewDeals = reviewTxs.map((tx, index) => {
      const nextDay = Number(tx.d.slice(3)) + 1;
      return deal({
        date: `2026-08-${String(nextDay).padStart(2, '0')}`,
        partner: tx.c,
        amount: 20_000 + index,
      });
    });

    const report = reconciliationReport({
      data: dataset([...matchedTxs, ...reviewTxs, ...mfOnlyTxs]),
      deals: [...matchedDeals, ...reviewDeals],
    });

    expect(report.rows).toHaveLength(122);
    expect(report.statusCounts).toEqual({
      unprocessed: 0,
      review: 39,
      matched: 41,
      mfOnly: 42,
      excluded: 0,
    });
    expect(report.kpi).toMatchObject({
      actionRequiredCount: 39,
      reviewCount: 39,
      resolvedCount: 41,
      resolvableCount: 80,
      mfOnlyCount: 42,
      resolutionRate: 41 / 80,
    });
    expect(report.sourceCounts).toEqual({ moneyforward: 122, freee: 80 });
    expect(report.mfOnly).toHaveLength(42);
    expect(report.unmatchedFreee).toHaveLength(39);
    expect(report.rows.filter((row) => row.freee !== null)).toHaveLength(80);
    expect(
      report.rows.filter((row) => row.status === 'review').every((row) => row.candidateKeys.length === 1),
    ).toBe(true);
  });

  it('要確認の件数は総収支の要確認と同じ (判断・除外を反映した後)', () => {
    const deals = [
      deal({ date: '2026-08-12' }),
      deal({ partner: '架空ホスティング', amount: 1_000, date: '2026-08-20' }),
    ];
    const txs = [
      mf(),
      mf({ id: 'mf-2', c: '架空ホスティング', a: -1_000, d: '08/21' }),
      mf({ id: 'mf-3', c: '架空ツール', a: -500, d: '08/05' }),
    ];
    const input = {
      data: dataset(txs),
      deals,
      verdicts: [{ txId: 'mf-2', verdict: 'different' as const }],
      mfExclusions: [{ txId: 'mf-3', reason: '照合画面で除外' }],
    };
    const report = reconciliationReport(input);
    const cashflow = totalCashflowReport(input.data, deals, input.verdicts, [], ['mf-3']);
    expect(report.kpi.reviewCount).toBe(1);
    expect(report.kpi.reviewCount).toBe(cashflow.review.length);
  });

  it('期間で絞っても、月末の MF と翌月初の freee の組は割れず、要確認の件数が全期間の判定と一致する', () => {
    const data = dataset([mf({ d: '08/31' })]);
    data.months = ['2026-08', '2026-09'];
    data.biz.revenue = [0, 0];
    data.subs.other = [0, 0];
    const deals = [deal({ month: '2026-09', date: '2026-09-02' })];
    const report = reconciliationReport({ data, deals, months: ['2026-08'] });
    expect(report.rows[0]).toMatchObject({ status: 'review' });
    expect(report.kpi.mfOnlyCount).toBe(0);
    expect(report.kpi.reviewCount).toBe(totalCashflowReport(data, deals).review.length);
    // 表示しない月の freee 取引は、事業支出にも freee にしかない取引にも数えない
    expect(report.kpi.businessExpense).toBe(0);
    expect(report.unmatchedFreee).toHaveLength(0);
    expect(reconciliationReport({ data, deals, months: ['2026-09'] }).rows).toHaveLength(0);
  });

  it('解消率は 照合済み ÷ (照合済み + 要確認 + 未処理)。MFのみは分母に入れない', () => {
    const report = reconciliationReport({
      data: dataset([
        mf(),
        mf({ id: 'mf-2', c: '架空ツール', a: -500, d: '08/05' }),
        mf({ id: 'mf-3', c: '架空サーバ', a: -700, d: '08/20' }),
      ]),
      deals: [deal(), deal({ partner: '架空サーバ', amount: 1_000, date: '2026-08-20' })],
    });
    expect(report.statusCounts).toMatchObject({ matched: 1, unprocessed: 1, mfOnly: 1 });
    expect(report.kpi.resolvedCount).toBe(1);
    expect(report.kpi.resolvableCount).toBe(2);
    expect(report.kpi.resolutionRate).toBe(0.5);
    // 事業支出 = freee 3,300 + 1,000 + freee と組んでいない MF 500 (MFのみ) + 700 (未処理)
    expect(report.kpi.businessExpense).toBe(5_500);
    expect(report.sourceCounts).toEqual({ moneyforward: 3, freee: 2 });
  });

  it('対応必要件数は要確認+未処理で、未処理だけでも1件として公開する', () => {
    const report = reconciliationReport({
      data: dataset([mf()]),
      deals: [deal({ amount: 3_000, date: '2026-08-11' })],
    });

    expect(report.statusCounts).toMatchObject({ review: 0, unprocessed: 1 });
    expect(report.kpi.reviewCount).toBe(0);
    expect(report.kpi.actionRequiredCount).toBe(1);
  });

  it('MFのみだけが残っていれば、解消率は対象なし', () => {
    const report = reconciliationReport({
      data: dataset([mf(), mf({ id: 'mf-2', c: '架空ツール', a: -500, d: '08/05' })]),
      deals: [deal()],
    });
    expect(report.kpi.resolvableCount).toBe(1);
    expect(report.kpi.resolutionRate).toBe(1);
    // 事業支出 = freee 3,300 + MFのみ 500
    expect(report.kpi.businessExpense).toBe(3_800);
    expect(report.sourceCounts).toEqual({ moneyforward: 2, freee: 1 });
  });
});
