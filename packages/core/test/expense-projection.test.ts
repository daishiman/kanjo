import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  buildExpenseProjection,
  emptyDataset,
  sourceNeutralSubscriptions,
} from '../src/index.js';

const mfExpense = (overrides: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-08',
  d: '08/05',
  c: '架空クラウド',
  a: -3_300,
  big: '通信費',
  mid: 'サブスク',
  isTarget: true,
  isTransfer: false,
  ...overrides,
});

const freeeExpense = (overrides: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-08',
  date: '2026-08-05',
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: 'サブスク・通信',
  amount: 3_300,
  ...overrides,
});

function dataset(txs: MfTx[], businessIds: string[] = []): Dataset {
  const data = emptyDataset();
  data.months = ['2026-08'];
  data.biz.revenue = [0];
  data.subs.other = [0];
  data.mfTx = txs;
  data.edits = Object.fromEntries(businessIds.map((id) => [id, { cls: 'biz' as const }]));
  return data;
}

describe('入力元に依存しない支出照合', () => {
  it('freeeとMFが厳密に1対1で一致する事業支出を1度だけ数える', () => {
    const data = dataset([mfExpense()], ['mf-1']);
    const result = buildExpenseProjection(data, [freeeExpense()]);

    expect(result.summary).toEqual({
      booked: 3_300,
      unbooked: 0,
      effective: 3_300,
      matchedCount: 1,
      reviewCount: 0,
    });
    expect(result.months).toEqual([{ month: '2026-08', booked: 3_300, unbooked: 0, effective: 3_300 }]);
  });

  it('MFにしかない事業支出を未記帳として実質支出へ加える', () => {
    const data = dataset([mfExpense({ id: 'mf-only', a: -8_800 })], ['mf-only']);
    const result = buildExpenseProjection(data, []);

    expect(result.summary).toMatchObject({ booked: 0, unbooked: 8_800, effective: 8_800 });
    expect(result.unbooked).toHaveLength(1);
    expect(result.unbooked[0]).toMatchObject({ source: 'mf', purpose: 'business', amount: 8_800 });
  });

  it('支払先が異なる同日同額は自動統合せず要確認に残す', () => {
    const data = dataset([mfExpense({ c: '架空店A' })], ['mf-1']);
    const result = buildExpenseProjection(data, [freeeExpense({ partner: '架空店B' })]);

    expect(result.summary).toMatchObject({ booked: 3_300, unbooked: 3_300, effective: 6_600 });
    expect(result.summary.reviewCount).toBe(1);
    expect(result.review[0]?.reason).toBe('支払先が一致しません');
  });

  it('同じ照合キーが複数ある場合は自動統合しない', () => {
    const data = dataset([mfExpense({ id: 'mf-a' }), mfExpense({ id: 'mf-b' })], ['mf-a', 'mf-b']);
    const result = buildExpenseProjection(data, [freeeExpense()]);

    expect(result.summary.matchedCount).toBe(0);
    expect(result.summary.reviewCount).toBe(2);
    expect(result.summary.effective).toBe(9_900);
  });

  it('不安定IDと分割明細は厳密一致しても自動統合しない', () => {
    const data = dataset(
      [
        mfExpense({ id: 'unstable', idStable: false }),
        mfExpense({
          id: 'split-line',
          splitProjection: {
            kind: 'split',
            parentTxId: 'mf-parent',
            lineId: '00000000-0000-4000-8000-000000000001',
            seq: 1,
            lineCount: 2,
            parentAmount: 6_600,
          },
        }),
      ],
      ['unstable', 'split-line'],
    );
    const result = buildExpenseProjection(data, [freeeExpense()]);

    expect(result.summary.matchedCount).toBe(0);
    expect(result.summary.reviewCount).toBe(2);
  });

  it('freeeの事業主貸を個人支出とし、経費に混ぜない', () => {
    const result = buildExpenseProjection(dataset([mfExpense({ a: -12_000 })]), [
      freeeExpense({ accountRaw: '事業主貸', accountNorm: '事業主貸', amount: 12_000 }),
    ]);

    expect(result.summary).toMatchObject({ booked: 0, unbooked: 0, effective: 0, matchedCount: 0 });
    expect(result.matched).toHaveLength(1);
    expect(result.effectiveExpenses[0]).toMatchObject({ purpose: 'personal', amount: 12_000 });
  });

  it('手入力現金をMF未記帳とは呼ばず、既存の現金台帳へ任せる', () => {
    const data = dataset(
      [
        mfExpense({ id: 'cash:1', c: '架空現金支出', idStable: true }),
        mfExpense({ id: 'mf-only', c: '架空カード支出', d: '08/13' }),
      ],
      ['mf-only'],
    );
    const result = buildExpenseProjection(data, []);

    expect(result.unbooked.map((fact) => fact.sourceId)).toEqual(['mf-only']);
    expect(result.effectiveExpenses.map((fact) => fact.sourceId)).toEqual(['mf-only']);
  });
});

describe('データ元に依存しないサブスク集計', () => {
  it('MFだけの登録支払先を数え、freeeと一致するMFは二重計上しない', () => {
    const data = dataset(
      [mfExpense(), mfExpense({ id: 'mf-only', m: '2026-08', d: '08/12', c: '架空動画', a: -1_200 })],
      ['mf-1'],
    );
    data.subs.vendors = ['架空クラウド', '架空動画'];
    data.subs.aliases = {};
    data.subs.accounts = {};
    data.subs.matrix = { 架空クラウド: [0], 架空動画: [0] };

    const result = sourceNeutralSubscriptions(data, [freeeExpense()]);

    expect(result.matrix['架空クラウド']).toEqual([3_300]);
    expect(result.matrix['架空動画']).toEqual([1_200]);
    expect(result.sourceCoverage).toEqual({ freee: 1, moneyForward: 1, matched: 1, review: 0 });
  });
});
