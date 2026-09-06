/**
 * トータル収支 (事業 + 家計) の契約テスト。
 *
 * ここは実装より先に書く赤いテストである (SYS-TCF-P04)。実装は SYS-TCF-P05 以降が
 * `packages/core/src/total-cashflow.ts` に置く。
 *
 * ## 受入条件とテストの対応表
 *
 * 受入は `specs/total-cashflow-requirements.md:226-232` の 6 行を項目に割ると 8 件になる
 * (1 行目が恒等式 2 本、6 行目が「9 列」と「警告」の 2 件)。
 *
 * | 受入 | 内容 | テスト |
 * |---|---|---|
 * | 受入A1 | 恒等式 `総支出 = 事業費 + 家計費` が全月で成立 | 本ファイル `受入A1` |
 * | 受入A2 | 恒等式 `総収入 = 事業収入 + 家計収入` が全月で成立 | 本ファイル `受入A2` |
 * | 受入A3 | (金額, 発生日) ごとに MF から `min(n, m)` 件が寄る。freee 件数超過 0 件 / 支払先判定 0 件 / ±3 日自動付替 0 件 | 本ファイル `受入A3` |
 * | 受入A4 | 利用者の「同じ」判断による付替は freee 側 1 取引につき MF 1 件まで | 本ファイル `受入A4` |
 * | 受入A5 | 判断が保存され再取込後も同じ明細へ再適用される (結合) | `packages/api/test/total-cashflow-verdict.integration.test.ts` |
 * | 受入A6 | `TREND_MIN_MONTHS` 未満は「判定不可」、有意判定は `TREND_ALPHA` を既存と共有 | 本ファイル `受入A6` |
 * | 受入A7 | 一覧表の 9 列すべてが常時表示される | `packages/web/test/total-cashflow-table.dom.test.tsx` |
 * | 受入A8 | 取込完了時に要確認が残っていれば画面へ警告が出る | `packages/web/test/total-cashflow-table.dom.test.tsx` |
 *
 * 表に無い `依存D-U3` は受入 8 件ではなく、P03 が決着させた設計依存
 * (`architecture/total-cashflow-backend.md` の U3) を固定するテストである。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  emptyDataset,
  monthlyTotalCashflow,
  reconcileBizDuplicates,
} from '../src/index.js';
import { TREND_ALPHA, TREND_MIN_MONTHS, categoryTrends, trendDirection } from '../src/trend.js';

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

/** 恒等式を破る月を 1 つでも見つけたら、その月を返す。0 件であることを件数で固定するために使う */
const identityViolations = (rows: ReturnType<typeof monthlyTotalCashflow>) =>
  rows.filter(
    (row) =>
      row.totalExpense !== row.bizExpense + row.householdExpense ||
      row.totalIncome !== row.bizIncome + row.householdIncome,
  );

describe('受入A1 恒等式 総支出 = 事業費 + 家計費', () => {
  it('消し込みが起きた月でも、起きなかった月でも全月で成立する', () => {
    const data = dataset(
      [
        // 2026-07: freee に対応が無い MF 支出だけ (寄せは起きない)
        mf({ id: 'mf-jul', m: '2026-07', d: '07/10', a: -12_000 }),
        // 2026-08: freee と日付・金額が一致する MF 支出 (寄せが起きる)
        mf({ id: 'mf-aug-dup', m: '2026-08', d: '08/05', a: -3_300 }),
        // 2026-08: 対応の無い MF 支出
        mf({ id: 'mf-aug-solo', m: '2026-08', d: '08/20', a: -5_000, c: '架空スーパー' }),
      ],
      ['2026-07', '2026-08'],
    );
    const rows = monthlyTotalCashflow(data, [deal()]);

    // 月数を固定する。0 行に対する「違反 0 件」を成立と読み違えないため
    expect(rows).toHaveLength(2);
    expect(identityViolations(rows)).toHaveLength(0);

    // 恒等式が 0 = 0 + 0 で自明に通っていないことを、実額で示す
    const july = rows.find((row) => row.month === '2026-07');
    const august = rows.find((row) => row.month === '2026-08');
    expect(july).toMatchObject({ totalExpense: 12_000, bizExpense: 0, householdExpense: 12_000 });
    expect(august).toMatchObject({
      // freee 3,300 (正) + 寄らなかった MF 5,000。MF 側の 3,300 は二重に数えない
      totalExpense: 8_300,
      bizExpense: 3_300,
      householdExpense: 5_000,
      shiftedCount: 1,
    });
  });
});

describe('受入A2 恒等式 総収入 = 事業収入 + 家計収入', () => {
  it('MF の大項目「事業・副業」だけが事業収入で、残りは家計収入になる', () => {
    const data = dataset([
      mf({ id: 'in-biz', a: 200_000, big: '事業・副業', mid: '売上', c: '架空商事' }),
      mf({ id: 'in-home', a: 50_000, big: 'その他入金', mid: '雑収入', c: '還付金' }),
    ]);
    const rows = monthlyTotalCashflow(data, []);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      totalIncome: 250_000,
      bizIncome: 200_000,
      householdIncome: 50_000,
    });
  });

  it('freee 売上と日付・金額が一致する MF 入金は freee を正として一度だけ数える', () => {
    const data = dataset([mf({ id: 'in-dup', a: 200_000, big: '事業・副業', c: '架空商事' })]);
    const rows = monthlyTotalCashflow(data, [
      deal({ io: 'income', amount: 200_000, partner: '架空商事', accountRaw: '売上高' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      totalIncome: 200_000,
      bizIncome: 200_000,
      householdIncome: 0,
      shiftedCount: 1,
    });
  });
});

describe('受入A3 (金額, 発生日) ごとに min(n, m) 件が寄る', () => {
  const sameBucketMf = (count: number): MfTx[] =>
    Array.from({ length: count }, (_, i) => mf({ id: `mf-${i}`, a: -3_300, c: `架空${i}` }));
  const sameBucketFreee = (count: number): FreeeDeal[] =>
    Array.from({ length: count }, (_, i) => deal({ amount: 3_300, partner: `別会社${i}` }));

  it('MF 3 件 freee 2 件なら 2 件だけが寄る', () => {
    const result = reconcileBizDuplicates(dataset(sameBucketMf(3)), sameBucketFreee(2));
    expect(result.matched).toHaveLength(2);
    expect(new Set(result.matched.map((m) => m.mfTxId)).size).toBe(2);
    expect(new Set(result.matched.map((m) => m.freeeIndex)).size).toBe(2);
  });

  it('freee 件数を超える付替が 0 件である (MF 1 件 freee 3 件)', () => {
    const result = reconcileBizDuplicates(dataset(sameBucketMf(1)), sameBucketFreee(3));
    expect(result.matched).toHaveLength(1);
  });

  it('支払先を用いた判定が 0 件である', () => {
    // 支払先が全く違っても、日付と金額が一致すれば寄る (肯定条件に支払先を使わない)
    const differentParty = reconcileBizDuplicates(dataset([mf({ id: 'mf-x', c: 'まったく別の店' })]), [
      deal({ partner: '架空クラウド' }),
    ]);
    expect(differentParty.matched).toHaveLength(1);

    // 支払先が同じでも、発生日が違えば寄らない (支払先は寄せる根拠にならない)
    const samePartyOtherDate = reconcileBizDuplicates(dataset([mf({ id: 'mf-y', d: '08/09' })]), [
      deal({ date: '2026-08-05' }),
    ]);
    expect(samePartyOtherDate.matched).toHaveLength(0);
  });

  it('±3 日照合による自動付替が 0 件で、候補は要確認に残る', () => {
    // 08/05 と 08/07 は候補抽出器の ±3 日以内だが、自動判定器は日付一致だけを見る
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-near', d: '08/07' })]), [
      deal({ date: '2026-08-05' }),
    ]);
    expect(result.matched).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0]).toMatchObject({ mfTxId: 'mf-near', reason: '発生日が一致しません' });
  });

  it('口座が明らかに対応しない組は寄せず、理由「口座不一致」で要確認へ回す (U2)', () => {
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-inst', inst: '三井住友銀行 普通' })]), [
      deal({ settleAccount: 'ゆうちょ銀行' }),
    ]);
    expect(result.matched).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0]).toMatchObject({ mfTxId: 'mf-inst', reason: '口座不一致' });
  });

  it('口座情報が片側に無ければガードせず寄せる (fail-open)', () => {
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-noinst', inst: undefined })]), [
      deal({ settleAccount: 'ゆうちょ銀行' }),
    ]);
    expect(result.matched).toHaveLength(1);
  });
});

describe('受入A4 利用者の「同じ」判断は freee 1 取引につき MF 1 件まで', () => {
  it('2 件の MF を「同じ」と判断しても、1 つの freee 取引に寄るのは 1 件だけ', () => {
    // 発生日をずらして自動判定を 0 件にし、利用者判断だけが効く状態にする
    const data = dataset([
      mf({ id: 'mf-a', d: '08/07', a: -3_300 }),
      mf({ id: 'mf-b', d: '08/08', a: -3_300 }),
    ]);
    const result = reconcileBizDuplicates(
      data,
      [deal({ date: '2026-08-05' })],
      [
        { txId: 'mf-a', verdict: 'same' },
        { txId: 'mf-b', verdict: 'same' },
      ],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({ by: 'user', freeeIndex: 0 });
    // 溢れた方は黙って消えず、要確認として残る
    expect(result.review.filter((r) => r.mfTxId === 'mf-b')).toHaveLength(1);
  });

  it('「違う」判断は帰属を動かさず、合計も動かさない', () => {
    const data = dataset([mf({ id: 'mf-diff' })]);
    const withoutVerdict = monthlyTotalCashflow(data, [deal()]);
    const withVerdict = monthlyTotalCashflow(data, [deal()], [{ txId: 'mf-diff', verdict: 'different' }]);

    expect(withoutVerdict[0]).toMatchObject({ shiftedCount: 1, householdExpense: 0 });
    expect(withVerdict[0]).toMatchObject({ shiftedCount: 0, householdExpense: 3_300 });
    // 帰属は動くが総額は動かない
    expect(withVerdict[0]!.totalExpense).toBe(6_600);
    expect(identityViolations(withVerdict)).toHaveLength(0);
  });
});

describe('受入A6 トレンド判定は既存の閾値を共有する', () => {
  const months = (n: number) => Array.from({ length: n }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);

  it('記帳月数が TREND_MIN_MONTHS 未満なら「判定不可」', () => {
    expect(TREND_MIN_MONTHS).toBe(6);
    expect(trendDirection([1, 2, 3, 4, 5])).toBe('判定不可');

    const data = dataset(
      months(5).map((m, i) =>
        mf({ id: `mf-${i}`, m, d: `${String(i + 1).padStart(2, '0')}/10`, a: -(1_000 * (i + 1)) }),
      ),
      months(5),
    );
    const rows = monthlyTotalCashflow(data, []);
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.trend !== '判定不可')).toHaveLength(0);
  });

  it('有意判定は TREND_ALPHA を既存 categoryTrends と共有し、判定式を複製しない', () => {
    expect(TREND_ALPHA).toBe(0.05);
    const series = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000];
    expect(trendDirection(series)).toBe('増加');

    // 既存の科目別トレンドと、切り出した trendDirection が同じ答えを出すこと
    const data = dataset(
      months(6).map((m, i) =>
        mf({ id: `mf-${i}`, m, d: `${String(i + 1).padStart(2, '0')}/10`, a: -series[i]!, big: '通信費' }),
      ),
      months(6),
    );
    const rows = categoryTrends(data, 'personal');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.direction).toBe(trendDirection(rows[0]!.series));
  });
});

describe('依存D-U3 MF の取込月と表示日の月が一致する不変条件', () => {
  it('月が食い違う明細は自動で寄せず、要確認として見せる', () => {
    // 現行の取込経路では m も d も同じセルから作られるため常に一致する。
    // 請求月で束ねる取込元を将来足した場合に、照合日 `${m}-${d の日}` が静かに壊れる。
    const data = dataset([mf({ id: 'mf-cross', m: '2026-08', d: '09/02', a: -3_300 })], ['2026-08']);
    const result = reconcileBizDuplicates(data, [deal({ month: '2026-09', date: '2026-09-02' })]);

    expect(result.matched).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0]).toMatchObject({
      mfTxId: 'mf-cross',
      reason: '取込月と表示日の月が一致しません',
    });
  });
});
