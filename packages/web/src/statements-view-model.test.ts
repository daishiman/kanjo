// @vitest-environment jsdom

/**
 * 決算書画面の純粋関数 (URL 状態・KPI の比較文言・期間移動・CSV・負債の下書き)。
 * DOM テストでは組み合わせの一例しか通らない境界 (0・null・データ範囲の端・数式注入) をここで固定する。
 */
import type { StatementsKpi } from '@kanjo/core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LIABILITY_DRAFT_PREFIX,
  clearAllLiabilityDrafts,
  countUnsaved,
  draftKey,
  formLinesFromBs,
  parseAmount,
  useLiabilityDraft,
} from './pages/statements/liability-draft.js';
import { csvCell, csvText, statementsPlCsvRows } from './pages/statements/statements-csv.js';
import {
  cfCauseLines,
  classifyLink,
  kpiComparison,
  kpiDiffClass,
  manText,
  monthlyTotalMan,
  monthsInPeriod,
  readStatementsUrl,
  shiftedPeriod,
} from './pages/statements/view-model.js';
import { liabilityLines, plRows, statementsScreen } from './test-support/statements-fixture.js';

const kpi = (patch: Partial<StatementsKpi>): StatementsKpi => ({
  value: 100,
  previous: 80,
  diff: 20,
  diffRate: 0.25,
  source: '',
  periodLabel: '',
  ...patch,
});

describe('URL 状態', () => {
  it('既定は PL・売上高・基準月なし。不正な値は既定へ倒す', () => {
    expect(readStatementsUrl(new URLSearchParams(''))).toEqual({ tab: 'pl', row: 'sales', ref: null });
    expect(readStatementsUrl(new URLSearchParams('tab=bs&row=sga&ref=2026-07'))).toEqual({
      tab: 'bs',
      row: 'sga',
      ref: '2026-07',
    });
    expect(readStatementsUrl(new URLSearchParams('tab=x&row=profit&ref=2026-13'))).toEqual({
      tab: 'pl',
      row: 'sales',
      ref: null,
    });
  });
});

describe('KPI の比較行', () => {
  it('前期が無ければ —、前期 0 は率を — にする', () => {
    expect(kpiComparison(kpi({ previous: null, diff: null, diffRate: null }), 'flow')).toBe('前期比 —');
    expect(kpiComparison(kpi({ previous: 0, diff: 100, diffRate: null }), 'flow')).toBe('前期比 +¥100 (—)');
  });

  it('現金増減は率を出さず、負債残高は前月末比と呼ぶ', () => {
    expect(kpiComparison(kpi({}), 'cash')).toBe('前期比 +¥20');
    expect(kpiComparison(kpi({ diff: -200_000, diffRate: -0.08 }), 'stock')).toBe(
      '前月末比 −¥200,000 (−8.0%)',
    );
  });

  it('負債だけ色の向きが逆になる', () => {
    expect(kpiDiffClass(-1, 'stock')).toBe('neg');
    expect(kpiDiffClass(1, 'stock')).toBe('pos');
    expect(kpiDiffClass(1, 'flow')).toBe('neg');
    expect(kpiDiffClass(-1, 'flow')).toBe('pos');
  });
});

describe('万円の表', () => {
  it('合計は円で足してから丸める', () => {
    // 1.4 万 × 3 を丸めてから足すと 3 万、足してから丸めると 4 万
    expect(monthlyTotalMan([{ amount: 14_000 }, { amount: 14_000 }, { amount: 14_000 }])).toBe('4');
    expect(manText(-1_234_567)).toBe('−123');
  });
});

describe('期間の前後移動', () => {
  const meta = (applied: { from: string; to: string } | null) =>
    ({ applied, full: { from: '2024-01', to: '2026-08' } }) as never;

  it('同じ長さだけずらし、データの範囲の外へ出る向きは null', () => {
    expect(shiftedPeriod(meta({ from: '2025-09', to: '2026-08' }), -1)).toEqual({
      mode: 'custom',
      from: '2024-09',
      to: '2025-08',
    });
    expect(shiftedPeriod(meta({ from: '2025-09', to: '2026-08' }), 1)).toBeNull();
    expect(shiftedPeriod(meta({ from: '2024-01', to: '2024-12' }), -1)).toBeNull();
    expect(shiftedPeriod(meta(null), -1)).toBeNull();
  });

  it('基準月の選択肢は期間内の月を年をまたいで並べる', () => {
    const months = monthsInPeriod(statementsScreen().period);
    expect(months).toHaveLength(12);
    expect(months.slice(3, 5)).toEqual(['2025-12', '2026-01']);
  });
});

describe('CF 不能の原因', () => {
  it('0 件の原因は出さず、決済方法の列が無いことだけでも原因にする', () => {
    expect(
      cfCauseLines({
        unclassified: 0,
        missingCash: { months: 0, settlementUnknown: false },
        accountUnset: 0,
      }),
    ).toEqual([]);
    expect(
      cfCauseLines({ unclassified: 0, missingCash: { months: 0, settlementUnknown: true }, accountUnset: 0 }),
    ).toEqual(['現金口座データが一部取り込まれていない（決済方法の列が無い取込があります）']);
    expect(
      cfCauseLines({ unclassified: 2, missingCash: { months: 3, settlementUnknown: true }, accountUnset: 0 }),
    ).toEqual([
      '未仕訳の取引が残っている（2件）',
      '現金口座データが一部取り込まれていない（3か月・決済方法の列なし）',
    ]);
  });

  it('計算行と科目の無い行には明細リンクを出さない', () => {
    const [sales, , gross] = plRows();
    expect(classifyLink(sales as never, '2026-08')).toBe(
      '/classify?category=%E5%A3%B2%E4%B8%8A%E9%AB%98&month=2026-08',
    );
    expect(classifyLink(gross as never, '2026-08')).toBeNull();
    expect(classifyLink({ key: 'sga', accounts: [] }, '2026-08')).toBeNull();
  });
});

describe('CSV', () => {
  it("数式として読まれうる文字列に ' を付け、金額の負数には付けない", () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('\0x')).toBe("'\0x");
    expect(csvCell(-200_000)).toBe('-200000');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(null)).toBe('');
  });

  it('区切り・引用符・改行を含むセルは引用し、行は CRLF で区切る', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=a,b')).toBe('"\'=a,b"');
    expect(
      csvText([
        ['a', 1],
        ['b', null],
      ]),
    ).toBe('a,1\r\nb,\r\n');
  });

  it('PL 5 行と区分の内訳を出し、計算行には内訳を付けない', () => {
    const rows = statementsPlCsvRows(statementsScreen());
    expect(rows[0]).toEqual([
      '区分',
      '勘定科目',
      '当期 (2025年9月 - 2026年8月)',
      '前期 (2024年9月 - 2025年8月)',
      '差額',
      '構成比(%)',
    ]);
    expect(rows.filter((row) => row[1] === '').map((row) => row[0])).toEqual([
      '売上高',
      '売上原価',
      '売上総利益',
      '販管費',
      '営業利益',
    ]);
    expect(rows.find((row) => row[1] === '通信費')).toEqual([
      '販管費',
      '通信費',
      900_000,
      820_000,
      80_000,
      null,
    ]);
    expect(rows.find((row) => row[0] === '売上高' && row[1] === '')?.[5]).toBe(100);
  });
});

describe('負債の入力と下書き', () => {
  beforeEach(() => localStorage.clear());

  it('保存済みの未入力は「選んでいない」から始める', () => {
    const lines = formLinesFromBs(liabilityLines());
    expect(lines['借入金']).toEqual({ status: 'amount', amount: '2,000,000' });
    expect(lines['クレジットカード未払金']).toEqual({ status: null, amount: '' });
  });

  it('金額は桁区切りを許し、0 以上 1 兆円以下の整数だけを受け付ける', () => {
    expect(parseAmount('1,000')).toBe(1000);
    expect(parseAmount('¥ 1 000')).toBe(1000);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('1000000000000')).toBe(1_000_000_000_000);
    expect(parseAmount('1000000000001')).toBeNull();
    expect(parseAmount('3万')).toBeNull();
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('1.5')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('未保存の件数は値の違う項目の数で、桁区切りの違いは数えない', () => {
    const saved = formLinesFromBs(liabilityLines());
    expect(countUnsaved(saved, { ...saved, 借入金: { status: 'amount', amount: '2000000' } })).toBe(0);
    expect(countUnsaved(saved, { ...saved, 借入金: { status: 'amount', amount: '2,000,001' } })).toBe(1);
    // 打ち間違いは空欄と別物として数える
    expect(
      countUnsaved({ a: { status: 'amount', amount: '' } }, { a: { status: 'amount', amount: 'x' } }),
    ).toBe(1);
  });

  it('ログアウト時は下書きだけを消し、他のキーは残す', () => {
    localStorage.setItem(draftKey('u1', '2026-08'), '{}');
    localStorage.setItem(draftKey('u2', '2026-07'), '{}');
    localStorage.setItem('kanjo.period', 'keep');
    clearAllLiabilityDrafts();
    expect(Object.keys(localStorage).filter((key) => key.startsWith(LIABILITY_DRAFT_PREFIX))).toEqual([]);
    expect(localStorage.getItem('kanjo.period')).toBe('keep');
  });

  it('認証確定時は入力中の値を守り、基準月を変えたらその月の値へ切り替える', () => {
    const august = formLinesFromBs(liabilityLines());
    const july = {
      ...august,
      借入金: { status: 'amount' as const, amount: '1,500,000' },
    };
    const { result, rerender } = renderHook(
      ({ userId, month, saved }) => useLiabilityDraft({ userId, month, saved }),
      { initialProps: { userId: null as string | null, month: '2026-08', saved: august } },
    );

    act(() => result.current.setLine('借入金', { amount: '3,000,000' }));
    rerender({ userId: 'u1', month: '2026-08', saved: august });
    expect(result.current.lines['借入金']?.amount).toBe('3,000,000');

    rerender({ userId: 'u1', month: '2026-07', saved: july });
    expect(result.current.lines['借入金']?.amount).toBe('1,500,000');
    expect(result.current.unsaved).toBe(0);
  });
});
