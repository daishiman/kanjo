/**
 * トータル収支の事業/家計の振り分けを、MF 中項目の前方一致へ一本化する契約テスト。
 *
 * 実装より先に書く赤いテストである (SYS-MFBIZ-P04)。実装は SYS-MFBIZ-P05 が
 * `packages/core/src/total-cashflow.ts` に置く。
 *
 * 期待値の正本は `docs/mf-business-classification/requirements-baseline.md` (P01)。
 * 受入の正本は `features/feat-mf-business-classification.md` の 8 件。
 *
 * | 受入 | 内容 | このファイルのテスト |
 * |---|---|---|
 * | 1 | 中項目由来の事業収入が家計収入に入らない | `受入1` |
 * | 2 | 中項目が事業で始まる支出が事業費に集計される | `受入2` |
 * | 3 | 公私仕分けの biz 集合とトータル収支の事業側集合が一致 | `受入3` |
 * | 4 | freee 側を一度だけ含む | `受入4` |
 * | 5 | 実装に存在しない中項目名も事業 | `受入5` |
 * | 6 | API 応答に clsSrc | `packages/web/test/classify-mid-source.dom.test.tsx` |
 * | 7 | 要確認が 4 束に現れず reviewAmount が同一集合 | `受入7` |
 * | 8 | 置換前の実装では赤 | 下記「置換前に落ちる理由」 |
 *
 * ## 置換前に落ちる理由 (受入 8)
 *
 * 置換前は `tx.big === '事業・副業'` で収入だけを判定していた。対象契約は
 * `大項目='収入' / 中項目='事業・副業'` なので、この比較は一致しない。
 * 支出側は freee 突合の有無だけで決まり、MF 単独の事業支出は家計費に入る。
 * よって `受入1` `受入2` `受入3` `受入5` `受入7` はいずれも置換前には成立しない。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  emptyDataset,
  monthlyTotalCashflow,
  resolveTx,
  totalCashflowReport,
} from '../src/index.js';
import * as core from '../src/index.js';

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2025-10',
  d: '10/15',
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
  month: '2025-10',
  date: '2025-10-15',
  io: 'expense',
  partner: '架空クラウド',
  accountRaw: '通信費',
  accountNorm: 'サブスク・通信',
  amount: 3_300,
  ...over,
});

function dataset(txs: MfTx[], months = ['2025-10']): Dataset {
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  return data;
}

/** 恒等式を破る月を返す。0 行に対する「違反 0 件」と取り違えないため件数と併せて使う */
const identityViolations = (rows: ReturnType<typeof monthlyTotalCashflow>) =>
  rows.filter(
    (row) =>
      row.totalExpense !== row.bizExpense + row.householdExpense ||
      row.totalIncome !== row.bizIncome + row.householdIncome,
  );

describe('O2 旧判定の識別子が消えている', () => {
  it('BIZ_INCOME_MAJOR が @kanjo/core から公開されていない', () => {
    expect(Object.keys(core)).not.toContain('BIZ_INCOME_MAJOR');
  });

  it('中項目を知らない旧 classifyTx が @kanjo/core から公開されていない', () => {
    expect(Object.keys(core)).not.toContain('classifyTx');
  });
});

describe('受入1 事業収入が家計収入に含まれない', () => {
  it('匿名 fixture (大項目=収入 / 中項目=事業・副業) を事業側だけに数える', () => {
    const data = dataset([
      mf({ id: 'in-a', d: '10/31', a: 120_000, big: '収入', mid: '事業・副業', c: '架空取引先 A' }),
      mf({
        id: 'in-b',
        d: '10/31',
        a: 30_000,
        big: '収入',
        mid: '事業・副業',
        c: '架空取引先 B',
        inst: '三井住友銀行 普通',
      }),
      // 家計の入金。事業側へ巻き込まれないことを同時に固定する
      mf({ id: 'in-home', d: '10/20', a: 50_000, big: 'その他入金', mid: '雑収入', c: '還付金' }),
    ]);
    const rows = monthlyTotalCashflow(data, []);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      bizIncome: 150_000,
      householdIncome: 50_000,
      totalIncome: 200_000,
    });
  });

  it('置換前の判定軸 (大項目が事業・副業) では 0 円になる形であることを示す', () => {
    // 大項目だけを見る実装なら、この匿名明細は家計収入に落ちる。
    const data = dataset([mf({ id: 'in-a', a: 120_000, big: '収入', mid: '事業・副業' })]);
    const rows = monthlyTotalCashflow(data, []);
    expect(rows[0]?.householdIncome).toBe(0);
    expect(rows[0]?.bizIncome).toBe(120_000);
  });
});

describe('受入2 中項目が事業で始まる支出が事業費に集計される', () => {
  it('freee に相手がいない MF の事業支出も事業費に入り、家計費には残らない', () => {
    const data = dataset([
      mf({ id: 'ex-biz-1', a: -80_000, big: 'その他', mid: '事業経費' }),
      mf({ id: 'ex-biz-2', a: -20_000, big: '通信費', mid: '事業・情報サービス' }),
      mf({ id: 'ex-biz-3', a: -2_000, big: '通信費', mid: '事業・携帯電話' }),
      mf({ id: 'ex-home', a: -30_000, big: '食費', mid: '食料品' }),
    ]);
    const rows = monthlyTotalCashflow(data, []);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      bizExpense: 102_000,
      householdExpense: 30_000,
      totalExpense: 132_000,
    });
  });

  it('freee と日付+金額が一致した事業支出は freee を正として一度だけ数える', () => {
    const data = dataset([mf({ id: 'ex-dup', a: -3_300, big: 'その他', mid: '事業経費' })]);
    const rows = monthlyTotalCashflow(data, [deal()]);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      bizExpense: 3_300,
      householdExpense: 0,
      shiftedCount: 1,
      shiftedAmount: 3_300,
    });
  });
});

describe('受入3 公私仕分けの biz 集合とトータル収支の事業側集合が一致する', () => {
  it('手動編集で家計にした事業中項目の明細は、どちらの画面でも家計側になる', () => {
    const data = dataset([
      mf({ id: 'ex-biz', a: -10_000, big: 'その他', mid: '事業経費' }),
      mf({ id: 'ex-forced-home', a: -20_000, big: 'その他', mid: '事業経費' }),
    ]);
    data.edits = { 'ex-forced-home': { cls: 'per' } };

    // 公私仕分け側の biz 集合
    const bizIds = data.mfTx
      .filter((tx) => resolveTx(tx, data.rules, data.edits, data.institutionOwners).cls === 'biz')
      .map((tx) => tx.id);
    expect(bizIds).toEqual(['ex-biz']);

    // トータル収支側の事業費が同じ集合の金額になっていること
    const rows = monthlyTotalCashflow(data, []);
    expect(rows[0]).toMatchObject({ bizExpense: 10_000, householdExpense: 20_000 });
  });

  it('ルールで家計にした事業中項目の明細も両画面で家計側になる', () => {
    const data = dataset([mf({ id: 'ex-ruled', a: -15_000, c: '架空スーパー', mid: '事業経費' })]);
    data.rules = [{ k: '架空スーパー', cls: 'per' }];

    expect(resolveTx(data.mfTx[0]!, data.rules, data.edits).cls).toBe('per');
    expect(monthlyTotalCashflow(data, [])[0]).toMatchObject({
      bizExpense: 0,
      householdExpense: 15_000,
    });
  });
});

describe('受入4 freee 側を一度だけ含む', () => {
  it('事業費と事業収入の双方で freee 由来の金額が二重に足されない', () => {
    const data = dataset([
      mf({ id: 'ex-dup', a: -3_300, big: 'その他', mid: '事業経費' }),
      mf({ id: 'in-dup', d: '10/31', a: 200_000, big: '収入', mid: '事業・副業', c: '架空商事' }),
    ]);
    const rows = monthlyTotalCashflow(data, [
      deal(),
      deal({ io: 'income', date: '2025-10-31', amount: 200_000, partner: '架空商事', accountRaw: '売上高' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      bizExpense: 3_300,
      bizIncome: 200_000,
      householdExpense: 0,
      householdIncome: 0,
      shiftedCount: 2,
    });
  });
});

describe('受入5 実装に存在しない中項目名も事業と判定される', () => {
  it('『事業・広告費』がコード変更なしに事業費へ入る', () => {
    const data = dataset([mf({ id: 'ex-ad', a: -44_000, big: 'その他', mid: '事業・広告費' })]);
    const rows = monthlyTotalCashflow(data, []);
    expect(rows[0]).toMatchObject({ bizExpense: 44_000, householdExpense: 0 });
  });
});

describe('受入7 要確認はどの合計にも入らず reviewAmount と reviewCount が同じ集合から出る', () => {
  /**
   * 要確認を作る: 同額・同じ向きで日付が 1 日ずれた freee 取引を置く。
   * 発生日が一致しないので寄らず、候補があるので要確認へ回る。
   */
  const nearDeal = (over: Partial<FreeeDeal> = {}) => deal({ date: '2025-10-16', ...over });

  it('事業の要確認支出は事業費にも家計費にも入らない', () => {
    const data = dataset([mf({ id: 'ex-review-biz', a: -3_300, big: 'その他', mid: '事業経費' })]);
    const report = totalCashflowReport(data, [nearDeal()]);

    expect(report.review).toHaveLength(1);
    expect(report.review[0]?.mf).toMatchObject({ cls: 'biz', clsSrc: '中項目' });
    expect(report.months[0]).toMatchObject({
      // freee 側の 3,300 は freee を正として残る。MF 側が上乗せされれば 6,600 になる
      bizExpense: 3_300,
      householdExpense: 0,
      reviewCount: 1,
      reviewAmount: 3_300,
    });
  });

  it('家計の要確認支出も家計費に入らない (事業述語の真偽を問わない)', () => {
    const data = dataset([mf({ id: 'ex-review-home', a: -3_300, big: '食費', mid: '食料品' })]);
    const report = totalCashflowReport(data, [nearDeal()]);

    expect(report.review).toHaveLength(1);
    expect(report.months[0]).toMatchObject({
      bizExpense: 3_300,
      // 家計側の明細でも、要確認である限り家計費には入らない
      householdExpense: 0,
      reviewCount: 1,
      reviewAmount: 3_300,
    });
  });

  it('要確認の入金も事業収入・家計収入のどちらにも入らない', () => {
    const data = dataset([
      mf({ id: 'in-review-biz', d: '10/15', a: 200_000, big: '収入', mid: '事業・副業' }),
      mf({ id: 'in-review-home', d: '10/15', a: 50_000, big: 'その他入金', mid: '雑収入' }),
    ]);
    const report = totalCashflowReport(data, [
      nearDeal({ io: 'income', amount: 200_000, accountRaw: '売上高' }),
      nearDeal({ io: 'income', amount: 50_000, accountRaw: '雑収入' }),
    ]);

    expect(report.review).toHaveLength(2);
    expect(report.months[0]).toMatchObject({
      // freee の入金 250,000 だけが残る。MF 側が上乗せされれば 500,000 になる
      bizIncome: 250_000,
      householdIncome: 0,
      totalIncome: 250_000,
      reviewCount: 2,
      reviewAmount: 250_000,
    });
  });

  it('reviewAmount は reviewCount と同じ集合の絶対値合計である', () => {
    const data = dataset([
      mf({ id: 'r1', d: '10/15', a: -3_300, big: 'その他', mid: '事業経費' }),
      mf({ id: 'r2', d: '10/15', a: 200_000, big: '収入', mid: '事業・副業' }),
      // 要確認にならない明細。金額が reviewAmount へ混ざらないことを固定する
      mf({ id: 'plain', d: '10/20', a: -9_999, big: '食費', mid: '食料品' }),
    ]);
    const report = totalCashflowReport(data, [
      nearDeal(),
      nearDeal({ io: 'income', amount: 200_000, accountRaw: '売上高' }),
    ]);

    const expected = report.review
      .map((r) => data.mfTx.find((tx) => tx.id === r.mfTxId))
      .reduce((sum, tx) => sum + Math.abs(tx?.a ?? 0), 0);
    expect(report.review).toHaveLength(2);
    expect(report.months[0]?.reviewCount).toBe(2);
    expect(report.months[0]?.reviewAmount).toBe(expected);
    expect(report.months[0]?.reviewAmount).toBe(203_300);
    // 要確認でない 9,999 円は家計費に残る
    expect(report.months[0]?.householdExpense).toBe(9_999);
  });
});
