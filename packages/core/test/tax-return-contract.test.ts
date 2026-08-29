/**
 * 確定申告の転記シートと準備チェックの契約。
 *
 * ここで固定するのは「申告額が黙って変わらないこと」の3点:
 *   1. 割り当てのない科目は雑費に寄せず、未割当として表に出す
 *   2. 家事按分の端数は切り捨て(経費が増える側に丸めない)
 *   3. 収入科目・事業主貸を経費計に混ぜない
 * どれも画面を見ても気づけない種類の誤りなので、テストで止める。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  TAX_STATEMENT_EXPORT_HEADER,
  type TaxAccountPolicy,
  type TaxAccountSetting,
  apportion,
  defaultTaxAccountFor,
  emptyDataset,
  isAllowedTaxExpenseAccount,
  parseTaxYear,
  resolveTaxAccountPolicies,
  resolveTaxAccountSettings,
  taxReadinessVerdict,
  taxReturnReadiness,
  taxReturnStatement,
  taxStatementExportRows,
  taxYearScope,
} from '../src/index.js';

const months = ['2025-01', '2025-02'];

const dataset = (expense: Record<string, number[]>, revenue = [1_000_000, 1_000_000]): Dataset => ({
  ...emptyDataset(),
  months: [...months],
  biz: { revenue, categories: Object.keys(expense), expense },
});

const setting = (
  account: string,
  taxAccount: string | null,
  businessPercent = 100,
  basis: string | null = null,
): TaxAccountSetting => ({ taxYear: '2025', account, taxAccount, businessPercent, basis });

const policy = (
  taxYear: TaxAccountPolicy['taxYear'],
  account: string,
  taxAccount: TaxAccountPolicy['taxAccount'],
  businessPercent = 100,
): TaxAccountPolicy => ({ taxYear, account, taxAccount, businessPercent, basis: null });

describe('申告年の契約', () => {
  it('YYYYだけを受け入れ、1月から12月のカレンダー年に固定する', () => {
    expect(parseTaxYear('2025')).toBe('2025');
    expect(taxYearScope('2025')).toEqual({ year: '2025', from: '2025-01', to: '2025-12' });
    for (const invalid of ['1999', '2100', '25', '2025-01', 'all', ' 2025 ', '', 2025]) {
      expect(parseTaxYear(invalid)).toBeNull();
    }
  });
});

describe('家事按分', () => {
  it('端数は切り捨てる(経費が増える側に丸めない)', () => {
    expect(apportion(999, 30)).toBe(299); // 299.7 → 299
    expect(apportion(100, 100)).toBe(100);
    expect(apportion(100, 0)).toBe(0);
  });

  it('未設定・範囲外は按分せず全額を返す', () => {
    expect(apportion(1000, null)).toBe(1000);
    expect(apportion(1000, 120)).toBe(1000);
    expect(apportion(1000, Number.NaN)).toBe(1000);
  });

  it('負の値でも絶対値で切り捨て、符号を保つ', () => {
    expect(apportion(-999, 30)).toBe(-299);
  });
});

describe('決算書科目の割り当て', () => {
  it('決算書と同名の科目だけ既定で解決し、それ以外は推測で寄せない', () => {
    expect(defaultTaxAccountFor('旅費交通費')).toBe('旅費交通費');
    expect(defaultTaxAccountFor('サブスク・通信')).toBeNull();
  });

  it('保存済み設定を優先し、未保存の科目は既定値で埋める', () => {
    const resolved = resolveTaxAccountSettings(
      '2025',
      ['通信費', 'サブスク・通信'],
      [setting('サブスク・通信', '通信費', 80, '按分の根拠')],
    );
    expect(resolved).toEqual([
      { account: '通信費', status: 'unconfirmed', taxAccount: '通信費', businessPercent: 100, basis: null },
      {
        account: 'サブスク・通信',
        status: 'confirmed',
        taxAccount: '通信費',
        businessPercent: 80,
        basis: '按分の根拠',
      },
    ]);
  });

  it('行が無い科目だけを未確認とし、100%も保存済みの明示率として扱う', () => {
    const resolved = resolveTaxAccountPolicies(
      '2025',
      ['通信費', '水道光熱費'],
      [policy('2025', '通信費', '通信費', 100), policy('2024', '水道光熱費', '水道光熱費', 50)],
    );

    expect(resolved).toEqual([
      {
        account: '通信費',
        status: 'confirmed',
        taxAccount: '通信費',
        businessPercent: 100,
        basis: null,
      },
      {
        account: '水道光熱費',
        status: 'unconfirmed',
        taxAccount: '水道光熱費',
        businessPercent: 100,
        basis: null,
      },
    ]);
  });

  it('転記先は決算書の経費・専用欄科目だけを許す', () => {
    expect(isAllowedTaxExpenseAccount('通信費')).toBe(true);
    expect(isAllowedTaxExpenseAccount('研修費')).toBe(true);
    expect(isAllowedTaxExpenseAccount('専従者給与')).toBe(true);
    expect(isAllowedTaxExpenseAccount('売上高')).toBe(false);
    expect(isAllowedTaxExpenseAccount('雑収入')).toBe(false);
    expect(isAllowedTaxExpenseAccount('事業主貸')).toBe(false);
    expect(isAllowedTaxExpenseAccount('存在しない科目')).toBe(false);
  });
});

describe('転記シート', () => {
  it('指定年外の月を合計に混ぜない', () => {
    const data = dataset({ 通信費: [1000, 9000] }, [10_000, 90_000]);
    data.months = ['2025-01', '2024-12'];
    const st = taxReturnStatement(data, '2025', []);
    expect(st.months).toEqual(['2025-01']);
    expect(st.revenue).toBe(10_000);
    expect(st.expenseTotal).toBe(1000);
  });

  it('未割当の科目は雑費へ寄せず、未割当として金額つきで残す', () => {
    const st = taxReturnStatement(dataset({ サブスク・通信: [5000, 5000] }), '2025', []);

    expect(st.unassigned).toEqual([{ account: 'サブスク・通信', gross: 10000 }]);
    expect(st.expenseTotal).toBe(0);
    expect(st.printedRows).toHaveLength(0);
    // 見落とせないよう limits の先頭に出す
    expect(st.limits[0]).toContain('決算書の科目が決まっていない');
  });

  it('同じ決算書科目に集まる複数の帳簿科目を1行にまとめ、内訳を残す', () => {
    const st = taxReturnStatement(dataset({ 通信費: [3000, 3000], サブスク・通信: [1000, 1000] }), '2025', [
      setting('サブスク・通信', '通信費', 50, '事業利用分'),
    ]);

    const row = st.printedRows.find((r) => r.taxAccount === '通信費');
    expect(row?.gross).toBe(8000);
    expect(row?.amount).toBe(7000); // 6000 + floor(2000 * 50%)
    expect(row?.privateAmount).toBe(1000);
    expect(row?.sources.map((s) => s.account)).toEqual(['通信費', 'サブスク・通信']);
  });

  it('収入科目・事業主貸を経費計に入れない', () => {
    const st = taxReturnStatement(
      dataset({ 雑収入: [5000, 5000], 事業主貸: [7000, 7000], 通信費: [1000, 1000] }),
      '2025',
      [setting('雑収入', '雑収入'), setting('事業主貸', '事業主貸')],
    );

    expect(st.expenseTotal).toBe(2000);
    expect(st.unassigned).toEqual([]);
  });

  it('専従者給与は経費計と分け、所得の計算では引く', () => {
    const st = taxReturnStatement(
      dataset({ 専従者給与: [100_000, 100_000], 通信費: [1000, 1000] }),
      '2025',
      [],
    );

    expect(st.separateRows.map((r) => r.taxAccount)).toEqual(['専従者給与']);
    expect(st.expenseTotal).toBe(2000);
    expect(st.incomeBeforeDeduction).toBe(2_000_000 - 2000 - 200_000);
  });

  it('印字欄は決算書の並び、空欄行は金額の大きい順に出す', () => {
    const st = taxReturnStatement(
      dataset({ 消耗品費: [100, 100], 租税公課: [100, 100], 研修費: [100, 100], 支払手数料: [900, 900] }),
      '2025',
      [setting('研修費', '研修費'), setting('支払手数料', '支払手数料')],
    );

    expect(st.printedRows.map((r) => r.taxAccount)).toEqual(['租税公課', '消耗品費']);
    expect(st.blankRows.map((r) => r.taxAccount)).toEqual(['支払手数料', '研修費']);
  });

  it('書き出しの列は画面と同じ並びで、未割当も行として出す', () => {
    const st = taxReturnStatement(dataset({ 通信費: [1000, 1000], 謎の科目: [500, 500] }), '2025', []);
    const rows = taxStatementExportRows(st);

    expect(TAX_STATEMENT_EXPORT_HEADER[0]).toBe('区分');
    // 空行より前が転記する表。以降は注意書きなので列数が違ってよい
    const table = rows.slice(
      0,
      rows.findIndex((r) => r.length === 0),
    );
    expect(table.every((r) => r.length === TAX_STATEMENT_EXPORT_HEADER.length)).toBe(true);
    expect(table.some((r) => r.includes('謎の科目'))).toBe(true);
    expect(rows.some((r) => r[0] === '注意')).toBe(true);
  });
});

describe('申告の準備チェック', () => {
  const base = {
    year: '2025' as const,
    statement: taxReturnStatement(dataset({ 通信費: [1000, 1000] }), '2025', []),
    unconfirmedPolicies: [] as string[],
    reviewPending: 0,
    txTotal: 100,
    receipts: { requiredCount: 10, missingCount: 0, mustMissingCount: 0, missingAmount: 0, coverage: 1 },
    ratioUnsetAccounts: [] as string[],
    bizAdvanceTotal: 0,
    coveredMonths: Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`),
  };

  it('要対応・確認・完了の順に並べ、総合判定は最も重い段階を返す', () => {
    const checks = taxReturnReadiness({
      ...base,
      statement: taxReturnStatement(dataset({ 謎の科目: [1000, 1000] }), '2025', []),
    });

    const rank = { blocked: 0, warn: 1, ok: 2 } as const;
    const levels = checks.map((c) => rank[c.level]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(checks[0].level).toBe('blocked');
    expect(taxReadinessVerdict(checks)).toBe('blocked');
  });

  it('すべて揃っていれば要対応は残らない', () => {
    const checks = taxReturnReadiness(base);
    expect(checks.some((c) => c.level === 'blocked')).toBe(false);
    expect(taxReadinessVerdict(checks)).not.toBe('blocked');
  });

  it('12件でも対象年の1月から12月と一致しなければblocked', () => {
    const checks = taxReturnReadiness({
      ...base,
      coveredMonths: [...base.coveredMonths.slice(0, 11), '2024-12'],
    });
    expect(checks.find((check) => check.id === 'months')?.level).toBe('blocked');
  });

  it('科目方針の行が無い場合はblocked、100%を明示保存済みなら確認済み', () => {
    const blocked = taxReturnReadiness({ ...base, unconfirmedPolicies: ['通信費'] });
    expect(blocked.find((check) => check.id === 'tax-policy')?.level).toBe('blocked');
    expect(taxReturnReadiness(base).find((check) => check.id === 'tax-policy')?.level).toBe('ok');
  });

  it('要対応の未添付が1件でもあればblocked', () => {
    const checks = taxReturnReadiness({
      ...base,
      receipts: {
        requiredCount: 10,
        missingCount: 1,
        mustMissingCount: 1,
        missingAmount: 1000,
        coverage: 0.9,
      },
    });
    expect(checks.find((check) => check.id === 'receipts')?.level).toBe('blocked');
  });

  it('全チェックが次の行動を持つ(判定だけ出して放り出さない)', () => {
    for (const check of taxReturnReadiness(base)) {
      expect(check.title).not.toBe('');
      expect(check.detail).not.toBe('');
      // 済んだ項目に次の行動は要らない。残っている項目だけは必ず持つ
      if (check.level !== 'ok') expect(check.action).not.toBe('');
    }
  });
});
