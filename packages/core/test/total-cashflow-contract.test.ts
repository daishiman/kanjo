/**
 * トータル収支 (事業 + 家計) の契約テスト。
 *
 * ここは実装より先に書く赤いテストである (SYS-TCF-P04)。実装は SYS-TCF-P05 以降が
 * `packages/core/src/total-cashflow.ts` に置く。
 *
 * ## 受入条件とテストの対応表
 *
 * 正本は `features/feat-total-cashflow.md` の acceptance 10 件 (F1..F10) である。
 * 以前この表は `specs/total-cashflow-requirements.md:226-232` の 6 行を項目に割った 8 件を
 * 基準にしていたが、その 6 行には F3 / F4 / F6 / F8 が含まれていない (compile 時の欠落)。
 * 少ない方に合わせると、検証したつもりの穴が 4 件残る。件数の出典は正本側に置く。
 *
 * | 受入 | 内容 | テスト |
 * |---|---|---|
 * | F1 | 恒等式 `総支出 = 事業費 + 家計費` / `総収入 = 事業収入 + 家計収入` が全月で成立 | 本ファイル `受入A1` `受入A2` |
 * | F2 | 日付・金額一致の支出は freee 1 件だけ計上し MF は家計費に残らない | 本ファイル `受入A3` |
 * | F3 | 寄せた金額と件数が消し込み対象明細の実数と一致する | 本ファイル `受入F3` |
 * | F4 | 重複候補が判断できる材料つきで列挙され、0 件のときは 0 件と明示される | 本ファイル `受入F4` (MF の中身と freee 候補) / `packages/web/test/total-cashflow-table.dom.test.tsx` (対比表示と 0 件明示) |
 * | F5 | 判断が保存され再取込後も同じ明細へ再適用される (結合) | `packages/api/test/total-cashflow-verdict.integration.test.ts` |
 * | F6 | 収入側の「同じ」判定で家計収入から外れ freee 側だけが残る | 本ファイル `受入F6` |
 * | F7 | `TREND_MIN_MONTHS` 未満は「判定不可」、有意判定は `TREND_ALPHA` を既存と共有 | 本ファイル `受入A6` |
 * | F8 | 期間を切り替えても同じ月の値が一致する | 本ファイル `受入F8` |
 * | F9 | 一覧表の 9 列すべてが常時表示される | `packages/web/test/total-cashflow-table.dom.test.tsx` |
 * | F10 | 取込完了時に要確認が残っていれば画面へ警告が出る | `packages/web/test/import-review-notice.dom.test.tsx` |
 *
 * 利用者判断の上限 (freee 1 取引につき MF 1 件) を固定する `受入A4` と、P03 が決着させた
 * 設計依存 (`architecture/total-cashflow-backend.md` の U3) を固定する `依存D-U3` は、
 * 受入 10 件そのものではなく、F2 / F6 が壊れる経路を塞ぐ補助検査である。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type FreeeDeal,
  type MfTx,
  applyPeriod,
  emptyDataset,
  freeeDealKeys,
  monthlyTotalCashflow,
  reconcileBizDuplicates,
  totalCashflowReport,
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
  it('MF の中項目が「事業」で始まる入金だけが事業収入で、残りは家計収入になる', () => {
    const data = dataset([
      mf({ id: 'in-biz', a: 200_000, big: '収入', mid: '事業・副業', c: '架空商事' }),
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
    const data = dataset([mf({ id: 'in-dup', a: 200_000, big: '収入', mid: '事業・副業', c: '架空商事' })]);
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

  /*
    実データ (2026-01) では freee の決済口座がほぼ全件「事業主借」で、MF 側は
    「楽天カード まりこ」だった。これを口座名どうしとして比べたため 19 件中 15 件が
    口座不一致で残り、寄った件数が 0 になった。事業主借は勘定科目であって口座名ではない。
    旧実装はこの 2 件のうち上を落とす。
  */
  it('事業主借・事業主貸は口座名ではないので、口座名との食い違いを理由に止めない', () => {
    for (const settleAccount of ['事業主借', '事業主貸', '事業主借 ']) {
      const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-owner', inst: '楽天カード まりこ' })]), [
        deal({ settleAccount }),
      ]);
      expect({ settleAccount, matched: result.matched.length, review: result.review.length }).toEqual({
        settleAccount,
        matched: 1,
        review: 0,
      });
    }
  });

  it('口座名どうしの食い違いは今までどおり止める (ガードを外したのではない)', () => {
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-inst2', inst: '楽天カード まりこ' })]), [
      deal({ settleAccount: '三井住友銀行' }),
    ]);
    expect(result.matched).toHaveLength(0);
    expect(result.review[0]).toMatchObject({ reason: '口座不一致' });
  });
});

/*
  要確認は「理由を告げる」ためではなく「利用者が同じ取引か判断する」ために出す。
  理由だけではどの明細のことか分からず判断できない (P07 F4 不成立)。
  旧実装は `{mfTxId, reason}` しか返しておらず、下の 3 件はいずれもそこで落ちる。
*/
describe('受入F4 要確認は MF の中身と freee 候補を判断材料として持つ', () => {
  it('MF 側の日付・内容・金額・口座・分類を、識別子ではなく値で持つ', () => {
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-near', d: '08/07' })]), [
      deal({ date: '2026-08-05' }),
    ]);
    expect(result.review[0]!.mf).toEqual({
      date: '2026-08-07',
      displayDate: '08/07',
      content: '架空クラウド',
      amount: 3_300,
      io: 'expense',
      institution: '三井住友銀行 普通',
      major: '通信費',
      middle: 'サブスク',
      memo: '',
      cls: 'per',
      clsSrc: '既定',
    });
  });

  it('freee 側の候補を日数差つきで返す。捨てずに渡すのが要点', () => {
    const near = deal({ date: '2026-08-05', partner: 'freee 側の名前', settleAccount: '三井住友' });
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-near', d: '08/07' })]), [near]);
    expect(result.review[0]!.candidates).toEqual([
      {
        freeeIndex: 0,
        freeeKey: freeeDealKeys([near])[0],
        date: '2026-08-05',
        partner: 'freee 側の名前',
        amount: 3_300,
        account: '通信費',
        settleAccount: '三井住友',
        dayGap: -2,
        accountConflict: false,
      },
    ]);
  });

  it('口座不一致でも候補を出す。何と食い違ったのかが見えないと判断できない', () => {
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-inst', inst: '三井住友銀行 普通' })]), [
      deal({ settleAccount: 'ゆうちょ銀行' }),
    ]);
    expect(result.review[0]!.reason).toBe('口座不一致');
    expect(result.review[0]!.candidates).toHaveLength(1);
    expect(result.review[0]!.candidates[0]).toMatchObject({
      settleAccount: 'ゆうちょ銀行',
      dayGap: 0,
      accountConflict: true,
    });
  });

  it('同額の候補が多くても 3 件までに絞り、日付の近い順に並べる', () => {
    // 家賃やサブスクは同額が並ぶ。全件返すとかえって比べられない
    const result = reconcileBizDuplicates(dataset([mf({ id: 'mf-many', d: '08/07' })]), [
      deal({ date: '2026-08-04' }),
      deal({ date: '2026-08-10' }),
      deal({ date: '2026-08-08' }),
      deal({ date: '2026-08-06' }),
    ]);
    expect(result.review[0]!.candidates.map((c) => c.dayGap)).toEqual([1, -1, -3]);
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

  it('「違う」判断はfreeeへの寄せを解除し、MFを独立した残余として加算する', () => {
    const data = dataset([mf({ id: 'mf-diff' })]);
    const withoutVerdict = monthlyTotalCashflow(data, [deal()]);
    const withVerdict = monthlyTotalCashflow(data, [deal()], [{ txId: 'mf-diff', verdict: 'different' }]);

    expect(withoutVerdict[0]).toMatchObject({ shiftedCount: 1, householdExpense: 0 });
    expect(withVerdict[0]).toMatchObject({ shiftedCount: 0, householdExpense: 3_300 });
    expect(withoutVerdict[0]!.totalExpense).toBe(3_300);
    // freeeとは別の支出だと判断したため、MF残余分だけ総額が増える。
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

    // 既存の科目別トレンドと、切り出した trendDirection が同じ答えを出すこと。
    // categoryTrends の家計側は mfTx ではなく集計済みの data.personal を読むため、
    // 同じ系列をそちらへも置く (置かないと 0 行になり、比較が成立しない)。
    const data = dataset(
      months(6).map((m, i) =>
        mf({ id: `mf-${i}`, m, d: `${String(i + 1).padStart(2, '0')}/10`, a: -series[i]!, big: '通信費' }),
      ),
      months(6),
    );
    for (const [i, month] of months(6).entries()) {
      data.personal[month] = { income: {}, expense: { 通信費: series[i]! } };
    }
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

describe('受入F3 寄せた金額と件数が消し込み対象明細の実数と一致する', () => {
  it('月ごとの寄せた金額が、その月に寄った MF 明細の実額の合計と一致する', () => {
    // 2026-08 に 2 件、2026-09 に 1 件が寄る。金額はすべて異なる値にして、
    // 件数と金額を取り違えた実装や、定数を返す実装が緑にならないようにする。
    const data = dataset(
      [
        mf({ id: 'aug-a', m: '2026-08', d: '08/05', a: -3_300 }),
        mf({ id: 'aug-b', m: '2026-08', d: '08/12', a: -7_700, c: '架空電力' }),
        mf({ id: 'aug-solo', m: '2026-08', d: '08/20', a: -5_000, c: '架空スーパー' }),
        mf({ id: 'sep-a', m: '2026-09', d: '09/03', a: -11_000, c: '架空通信' }),
      ],
      ['2026-08', '2026-09'],
    );
    const deals = [
      deal({ month: '2026-08', date: '2026-08-05', amount: 3_300 }),
      deal({ month: '2026-08', date: '2026-08-12', amount: 7_700, partner: '架空電力' }),
      deal({ month: '2026-09', date: '2026-09-03', amount: 11_000, partner: '架空通信' }),
    ];

    const rows = monthlyTotalCashflow(data, deals);
    const result = reconcileBizDuplicates(data, deals);

    // 消し込みの実数を、表示値とは別経路で数え直す。fixture の写しでは一致しない
    const byId = new Map(data.mfTx.map((tx) => [tx.id, tx]));
    const actual = new Map<string, { count: number; amount: number }>();
    for (const match of result.matched) {
      const tx = byId.get(match.mfTxId)!;
      const acc = actual.get(tx.m) ?? { count: 0, amount: 0 };
      actual.set(tx.m, { count: acc.count + 1, amount: acc.amount + Math.abs(tx.a) });
    }

    // 寄った実数が 0 件でないことを先に固定する (0 件どうしの一致を成立と読まないため)
    expect(result.matched).toHaveLength(3);
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      const truth = actual.get(row.month) ?? { count: 0, amount: 0 };
      expect(row.shiftedCount).toBe(truth.count);
      expect(row.shiftedAmount).toBe(truth.amount);
    }

    // 具体値でも固定する。1 件あたりの平均や件数×定数で通らないようにする
    expect(rows.find((r) => r.month === '2026-08')).toMatchObject({
      shiftedCount: 2,
      shiftedAmount: 11_000,
    });
    expect(rows.find((r) => r.month === '2026-09')).toMatchObject({
      shiftedCount: 1,
      shiftedAmount: 11_000,
    });
  });

  it('寄りが 0 件の月は金額も 0 で、寄った月と同じ行の形を持つ', () => {
    const data = dataset([mf({ id: 'solo', a: -5_000, c: '架空スーパー' })]);
    const rows = monthlyTotalCashflow(data, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ shiftedCount: 0, shiftedAmount: 0 });
  });

  it('要確認は理由付きで列挙され、候補が無ければ 0 件になる (F4 の導出側)', () => {
    const withReview = reconcileBizDuplicates(dataset([mf({ id: 'mf-near', d: '08/07' })]), [
      deal({ date: '2026-08-05' }),
    ]);
    expect(withReview.review).toHaveLength(1);
    expect(withReview.review[0]!.reason).toBe('発生日が一致しません');

    const noCandidate = reconcileBizDuplicates(dataset([mf({ id: 'mf-far', d: '08/25' })]), [
      deal({ date: '2026-08-05' }),
    ]);
    expect(noCandidate.review).toHaveLength(0);
  });
});

describe('受入F8 期間を切り替えても同じ月の値が一致する', () => {
  it('期間を絞っても、範囲内の月の値は全期間で計算したときと同じである', () => {
    const allMonths = ['2026-07', '2026-08', '2026-09'];
    const data = dataset(
      [
        mf({ id: 'jul', m: '2026-07', d: '07/10', a: -12_000, c: '架空スーパー' }),
        mf({ id: 'aug-dup', m: '2026-08', d: '08/05', a: -3_300 }),
        mf({ id: 'aug-solo', m: '2026-08', d: '08/20', a: -5_000, c: '架空スーパー' }),
        mf({ id: 'sep', m: '2026-09', d: '09/03', a: -11_000, c: '架空通信' }),
      ],
      allMonths,
    );
    const deals = [
      deal({ month: '2026-08', date: '2026-08-05', amount: 3_300 }),
      deal({ month: '2026-09', date: '2026-09-03', amount: 11_000, partner: '架空通信' }),
    ];
    const range = { from: '2026-08', to: '2026-08' };

    const full = monthlyTotalCashflow(data, deals);
    const sliced = monthlyTotalCashflow(
      applyPeriod(data, range),
      deals.filter((d) => d.month >= range.from && d.month <= range.to),
    );

    // 絞った側が範囲外の月を持たないこと。deals を切り忘れると 2026-09 が生えてくる
    expect(sliced.map((row) => row.month)).toEqual(['2026-08']);
    expect(full).toHaveLength(3);

    const fullAug = full.find((row) => row.month === '2026-08')!;
    const slicedAug = sliced[0]!;

    // トレンドは系列 1 本に対する判定なので、期間を変えれば変わってよい。
    // 期間で不変であるべきなのは、その月自身から導かれる値のほうである。
    const { trend: _fullTrend, ...fullValues } = fullAug;
    const { trend: _slicedTrend, ...slicedValues } = slicedAug;
    expect(slicedValues).toEqual(fullValues);

    // 0 = 0 の一致で通っていないことを実額で示す
    expect(slicedValues).toMatchObject({
      totalExpense: 8_300,
      bizExpense: 3_300,
      householdExpense: 5_000,
      shiftedCount: 1,
    });
  });
});

describe('受入F6 収入側の「同じ」判定で家計収入から外れ freee 側だけが残る', () => {
  /** freee 売上と同額だが入金日が 1 日ずれた MF 入金。自動では寄らず要確認に残る */
  const incomeCase = () => {
    const data = dataset([
      mf({ id: 'in-home', d: '08/06', a: 100_000, big: 'その他入金', mid: '振込', c: '架空商事' }),
    ]);
    const deals = [
      deal({ io: 'income', date: '2026-08-05', amount: 100_000, partner: '架空商事', accountRaw: '売上高' }),
    ];
    return { data, deals };
  };

  it('判定前は要確認に残り、MF 側はどの合計にも入らない', () => {
    const { data, deals } = incomeCase();
    const result = reconcileBizDuplicates(data, deals);
    const rows = monthlyTotalCashflow(data, deals);

    expect(result.matched).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0]).toMatchObject({ mfTxId: 'in-home', reason: '発生日が一致しません' });

    // 判断が付くまで MF 側は保留する。freee 側だけが残るので二重計上にならない (O7)
    expect(rows[0]).toMatchObject({
      totalIncome: 100_000,
      bizIncome: 100_000,
      householdIncome: 0,
      shiftedCount: 0,
      shiftedAmount: 0,
      reviewCount: 1,
      reviewAmount: 100_000,
    });
  });

  it('「同じ」と判定すると家計収入から外れ、freee を正として一度だけ数える', () => {
    const { data, deals } = incomeCase();
    const before = monthlyTotalCashflow(data, deals);
    const rows = monthlyTotalCashflow(data, deals, [{ txId: 'in-home', verdict: 'same' }]);

    expect(rows).toHaveLength(1);
    expect(identityViolations(rows)).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      totalIncome: 100_000,
      bizIncome: 100_000,
      householdIncome: 0,
      shiftedCount: 1,
      shiftedAmount: 100_000,
    });
    // 未判断時点からMF候補は4区分の外。sameはfreee正本を確定するだけで総額を変えない。
    expect(rows[0]!.totalIncome).toBe(before[0]!.totalIncome);
  });

  it('「違う」と判定した収入は寄せず、要確認にも二度と出さない', () => {
    const { data, deals } = incomeCase();
    const result = reconcileBizDuplicates(data, deals, [{ txId: 'in-home', verdict: 'different' }]);
    const rows = monthlyTotalCashflow(data, deals, [{ txId: 'in-home', verdict: 'different' }]);

    expect(result.matched).toHaveLength(0);
    expect(result.review).toHaveLength(0);
    expect(rows[0]).toMatchObject({ totalIncome: 200_000, householdIncome: 100_000 });
  });

  it('支出の freee 取引に収入の MF 明細を寄せない (io をまたいだ付替が 0 件)', () => {
    const data = dataset([mf({ id: 'in-x', d: '08/05', a: 100_000, big: 'その他入金' })]);
    const result = reconcileBizDuplicates(
      data,
      [deal({ io: 'expense', amount: 100_000 })],
      [{ txId: 'in-x', verdict: 'same' }],
    );
    expect(result.matched).toHaveLength(0);
  });
});

describe('freee 全件の行き先を件数で示す', () => {
  it('一致・除外・そのどちらにも入らない freee 側の残余に必ず分かれ、合計が freee の件数になる', () => {
    const deals = [
      deal({ partner: '架空クラウド' }),
      deal({ date: '2026-08-09', partner: '架空アプリ', amount: 2_900 }),
      deal({ date: '2026-08-09', partner: '架空アプリ', amount: 2_900 }),
    ];
    const data = dataset([
      mf({ id: 'mf-hit', d: '08/05', a: -3_300 }),
      mf({ id: 'mf-far', d: '08/20', a: -7_000, c: '架空スーパー' }),
    ]);
    const report = totalCashflowReport(
      data,
      deals,
      [],
      [{ freeeKey: freeeDealKeys(deals)[2], reason: '同じ支払を2回登録していた' }],
    );

    expect(report.coverage).toEqual({
      freeeTotal: 3,
      matched: 1,
      freeeOnly: 1,
      excluded: 1,
      mfReview: report.review.length,
    });
    expect(report.coverage.matched + report.coverage.freeeOnly + report.coverage.excluded).toBe(
      report.coverage.freeeTotal,
    );
    expect(report.matched[0]).toMatchObject({
      mfTxId: 'mf-hit',
      by: 'auto',
      mf: { content: '架空クラウド', amount: 3_300 },
      freee: { partner: '架空クラウド', amount: 3_300 },
    });
    expect(report.freeeOnly.map((row) => row.partner)).toEqual(['架空アプリ']);
    expect(report.excluded[0]).toMatchObject({ partner: '架空アプリ', reason: '同じ支払を2回登録していた' });
  });

  it('除外した freee 取引は事業費から落ち、候補にも出てこない', () => {
    const deals = [deal({ amount: 2_900 }), deal({ amount: 2_900 })];
    const data = dataset([mf({ id: 'mf-one', a: -2_900 })]);
    const exclusions = [{ freeeKey: freeeDealKeys(deals)[1], reason: '二重登録' }];

    const before = monthlyTotalCashflow(data, deals)[0];
    const after = monthlyTotalCashflow(data, deals, [], exclusions)[0];
    expect(before).toMatchObject({ bizExpense: 5_800 });
    expect(after).toMatchObject({ bizExpense: 2_900, totalExpense: 2_900 });

    const report = totalCashflowReport(data, deals, [], exclusions);
    expect(report.review.flatMap((row) => row.candidates)).toHaveLength(0);
  });
});

describe('同じ日に複数の候補がある場合、どれと組むかを選べる', () => {
  /** 同日同額の freee が2件、MF が1件。機械には決めようがない形 */
  const ambiguous = () => {
    const deals = [
      deal({ partner: '架空アプリ A', amount: 2_900, date: '2026-08-09' }),
      deal({ partner: '架空アプリ B', amount: 2_900, date: '2026-08-09' }),
    ];
    const data = dataset([mf({ id: 'mf-pick', d: '08/12', a: -2_900, c: '架空アプリ' })]);
    return { deals, data, keys: freeeDealKeys(deals) };
  };

  it('候補は鍵つきで返り、利用者が名指しした相手へ寄る', () => {
    const { deals, data, keys } = ambiguous();
    const review = reconcileBizDuplicates(data, deals).review;
    expect(review[0]!.candidates.map((c) => c.freeeKey)).toEqual(keys);

    const result = reconcileBizDuplicates(data, deals, [
      { txId: 'mf-pick', verdict: 'same', freeeKey: keys[1] },
    ]);
    expect(result.matched).toEqual([
      expect.objectContaining({ mfTxId: 'mf-pick', freeeKey: keys[1], by: 'user' }),
    ]);
    expect(result.freeeOnly.map((row) => row.partner)).toEqual(['架空アプリ A']);
  });

  it('名指し無しの「同じ」は従来どおり寄る (指定は必須にしない)', () => {
    const { deals, data, keys } = ambiguous();
    const result = reconcileBizDuplicates(data, deals, [{ txId: 'mf-pick', verdict: 'same' }]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.freeeKey).toBe(keys[0]);
  });

  it('日付も金額も一致する組でも、別の freee を名指ししていればそちらへ寄せる', () => {
    const deals = [
      deal({ partner: '架空アプリ A', amount: 2_900, date: '2026-08-05' }),
      deal({ partner: '架空アプリ B', amount: 2_900, date: '2026-08-06' }),
    ];
    const keys = freeeDealKeys(deals);
    const data = dataset([mf({ id: 'mf-pick', d: '08/05', a: -2_900, c: '架空アプリ' })]);

    const auto = reconcileBizDuplicates(data, deals);
    expect(auto.matched[0]!.freeeKey).toBe(keys[0]);

    const picked = reconcileBizDuplicates(data, deals, [
      { txId: 'mf-pick', verdict: 'same', freeeKey: keys[1] },
    ]);
    expect(picked.matched).toEqual([
      expect.objectContaining({ mfTxId: 'mf-pick', freeeKey: keys[1], by: 'user' }),
    ]);
  });
});
