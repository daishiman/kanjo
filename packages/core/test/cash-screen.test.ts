/**
 * 現金入力画面の規則 (SYS-CASH-P04)。期待値の正本は docs/cash-screen/rules.md の表と
 * specs/spec-cash-screen.md「ビジネスルールと検証」。表を変えたらここも同時に直す。
 *
 * ## 置換前に落ちる理由
 * 旧実装は合計・絞り込み・ページングを pages/Cash.tsx の中で個別に計算し、core には入力経路・
 * 業務の目的の保存形・入力の上限・URL と下書きの関数が無い (import が解決しない)。
 * 架空データのみを使用する。
 */
import { describe, expect, it } from 'vitest';
import {
  CASH_DRAFT_KEY_PREFIX,
  CASH_LIMITS,
  type CashDraftStorage,
  type CashEntry,
  type CashInput,
  EMPTY_CASH_FILTER,
  cashBulkIdsError,
  cashCategoryOptions,
  cashDraftKey,
  cashEntryRoute,
  cashMonthNav,
  cashMonthsInPeriod,
  cashPageLabel,
  cashTotals,
  clearCashDraft,
  defaultCashMonth,
  filterCashEntries,
  formatTransitPurpose,
  isDefaultCashFilter,
  isRealCashDate,
  loadCashDraft,
  paginateCash,
  parseTransitPurpose,
  readCashUrl,
  saveCashDraft,
  transitPurposeLabel,
  transitTotal,
  truncateCodePoints,
  validateCashInput,
  writeCashUrl,
} from '../src/index.js';

const base: CashEntry = {
  id: 1,
  date: '2026-07-01',
  month: '2026-07',
  side: 'biz',
  io: 'expense',
  amount: 1000,
  description: '架空文具店',
  categoryMajor: '消耗品費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  owner: 'business',
  transitPurpose: null,
};
const e = (over: Partial<CashEntry>): CashEntry => ({ ...base, ...over });

const fixture: CashEntry[] = [
  e({
    id: 1,
    io: 'income',
    amount: 50000,
    description: '架空商店 売上',
    categoryMajor: '売上高',
    date: '2026-07-03',
  }),
  e({
    id: 2,
    io: 'income',
    amount: 3000,
    description: '雑収入',
    categoryMajor: '雑収入',
    date: '2026-07-10',
    owner: null,
  }),
  e({ id: 3, amount: 12000, description: 'ノート購入', memo: 'ABC社の打ち合わせ用', date: '2026-07-05' }),
  e({
    id: 4,
    amount: 440,
    description: '電車代 東京→新宿(往復)',
    categoryMajor: '旅費交通費',
    transitFrom: '東京',
    transitTo: '新宿',
    transitRound: true,
    receiptWaived: true,
    transitPurpose: '打ち合わせ',
    date: '2026-07-20',
  }),
  e({
    id: 5,
    side: 'per',
    amount: 680,
    description: 'コンビニ',
    categoryMajor: '食費',
    categoryMid: '食料品',
    owner: 'spouse',
    date: '2026-07-31',
  }),
];

describe('入力経路', () => {
  it('区間があれば交通費入力、null なら通常入力', () => {
    expect(cashEntryRoute({ transitFrom: '東京' })).toBe('transit');
    expect(cashEntryRoute({ transitFrom: null })).toBe('normal');
    expect(fixture.map(cashEntryRoute)).toEqual(['normal', 'normal', 'normal', 'transit', 'normal']);
  });
});

describe('合計', () => {
  it('収入 2 件・支出 3 件', () => {
    expect(cashTotals(fixture)).toEqual({ income: 53000, expense: 13120, net: 39880 });
  });
  it('差額は負にもなる', () => {
    expect(cashTotals([e({ io: 'income', amount: 100 }), e({ amount: 250 })])).toEqual({
      income: 100,
      expense: 250,
      net: -150,
    });
  });
  it('0 件は 0', () => {
    expect(cashTotals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
});

describe('絞り込み', () => {
  const ids = (f: Partial<typeof EMPTY_CASH_FILTER>) =>
    filterCashEntries(fixture, { ...EMPTY_CASH_FILTER, ...f }).map((x) => x.id);

  it('既定は全件で順序を保つ', () => {
    expect(ids({})).toEqual([1, 2, 3, 4, 5]);
    expect(isDefaultCashFilter(EMPTY_CASH_FILTER)).toBe(true);
    expect(isDefaultCashFilter({ ...EMPTY_CASH_FILTER, min: 0 })).toBe(false);
  });
  it('キーワードは全角英数・大小の違いを吸収し、メモと駅名にも当たる', () => {
    expect(ids({ q: 'ａｂｃ' })).toEqual([3]);
    expect(ids({ q: 'abc社' })).toEqual([3]);
    expect(ids({ q: '新宿' })).toEqual([4]);
    expect(ids({ q: '打ち合わせ' })).toEqual([3, 4]);
    expect(ids({ q: '食料品' })).toEqual([5]);
    expect(ids({ q: '  ' })).toEqual([1, 2, 3, 4, 5]);
  });
  it('収支・カテゴリ・担当者・入力経路', () => {
    expect(ids({ io: 'income' })).toEqual([1, 2]);
    expect(ids({ category: '食費 / 食料品' })).toEqual([5]);
    expect(ids({ category: '消耗品費' })).toEqual([3]);
    expect(ids({ owner: 'unset' })).toEqual([2]);
    expect(ids({ owner: 'spouse' })).toEqual([5]);
    expect(ids({ route: 'transit' })).toEqual([4]);
    expect(ids({ route: 'normal' })).toEqual([1, 2, 3, 5]);
  });
  it('金額と日付は両端を含む', () => {
    expect(ids({ min: 680, max: 3000 })).toEqual([2, 5]);
    expect(ids({ from: '2026-07-05', to: '2026-07-20' })).toEqual([2, 3, 4]);
  });
  it('全条件の AND', () => {
    expect(ids({ io: 'expense', owner: 'business', min: 500, q: 'ノート' })).toEqual([3]);
    expect(ids({ io: 'income', route: 'transit' })).toEqual([]);
  });
  it('カテゴリの候補は出現順で重複なし', () => {
    expect(cashCategoryOptions([...fixture, e({ id: 9 })])).toEqual([
      '売上高',
      '雑収入',
      '消耗品費',
      '旅費交通費',
      '食費 / 食料品',
    ]);
  });
});

describe('ページング (1 ページ 20 件)', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('0 件は page=1 で「0件」', () => {
    const p = paginateCash(rows(0), 1);
    expect(p).toEqual({ rows: [], page: 1, pageCount: 1, start: 0, end: 0, total: 0 });
    expect(cashPageLabel(p)).toBe('0件');
  });
  it('20 件ちょうどは 1 ページ', () => {
    const p = paginateCash(rows(20), 1);
    expect([p.pageCount, p.start, p.end, p.rows.length]).toEqual([1, 1, 20, 20]);
    expect(cashPageLabel(p)).toBe('1-20件 / 20件');
  });
  it('21 件は 2 ページ目が 1 件', () => {
    const p = paginateCash(rows(21), 2);
    expect(p).toEqual({ rows: [21], page: 2, pageCount: 2, start: 21, end: 21, total: 21 });
  });
  it('範囲外のページは最後のページへ寄せる', () => {
    expect(paginateCash(rows(21), 9).page).toBe(2);
    expect(paginateCash(rows(21), 0).page).toBe(1);
  });
  it('既定の件数は CASH_LIMITS.pageSize', () => {
    expect(CASH_LIMITS.pageSize).toBe(20);
  });
});

describe('交通費の合計', () => {
  const t = { from: '東京', to: '新宿' };
  it('片道 220 の往復で 440、片道で 220', () => {
    expect(transitTotal({ ...t, oneWayAmount: 220, round: true })).toEqual({ amount: 440, error: null });
    expect(transitTotal({ ...t, oneWayAmount: 220, round: false })).toEqual({ amount: 220, error: null });
  });
  it('上限を超えるとエラー', () => {
    expect(transitTotal({ ...t, oneWayAmount: 500_000_001, round: true }).error).toBe('金額が大きすぎます');
    expect(transitTotal({ ...t, oneWayAmount: 500_000_000, round: true })).toEqual({
      amount: 1_000_000_000,
      error: null,
    });
  });
});

describe('業務の目的', () => {
  it('固定の 4 つとその他の往復', () => {
    for (const p of ['客先訪問', '打ち合わせ', '仕入れ・買い出し', '研修・セミナー'] as const) {
      expect(formatTransitPurpose(p, null)).toBe(p);
      expect(parseTransitPurpose(p)).toEqual({ purpose: p, note: null });
    }
    expect(formatTransitPurpose('その他', ' 展示会の下見 ')).toBe('その他:展示会の下見');
    expect(parseTransitPurpose('その他:展示会の下見')).toEqual({ purpose: 'その他', note: '展示会の下見' });
  });
  it('どちらにも当たらない値はその他の記述', () => {
    expect(parseTransitPurpose('営業')).toEqual({ purpose: 'その他', note: '営業' });
    expect(transitPurposeLabel('その他:展示会の下見')).toBe('展示会の下見');
    expect(transitPurposeLabel(null)).toBeNull();
  });
});

describe('入力検証 (API の zod と同じ上限)', () => {
  const ok: CashInput = {
    date: '2026-07-01',
    side: 'biz',
    io: 'expense',
    amount: 1,
    description: 'あ',
    categoryMajor: '消耗品費',
    owner: 'business',
    memo: null,
    transitFrom: null,
    transitTo: null,
    transitRound: false,
    transitPurpose: null,
    transitPurposeNote: null,
  };
  const transit: CashInput = {
    ...ok,
    transitFrom: '東京',
    transitTo: '新宿',
    transitRound: true,
    transitPurpose: '打ち合わせ',
  };
  const v = (over: Partial<CashInput>, from: CashInput = ok) => validateCashInput({ ...from, ...over });

  it('既定の入力は通る', () => {
    expect(v({})).toBeNull();
    expect(v({}, transit)).toBeNull();
  });
  it('内容 60 / 61 字', () => {
    expect(v({ description: 'あ'.repeat(60) })).toBeNull();
    expect(v({ description: 'あ'.repeat(61) })).toBe('内容は60字以内で入力してください');
    expect(v({ description: '   ' })).toBe('内容を入力してください');
  });
  it('字数はコードポイントで数える', () => {
    expect(v({ description: '𠮷'.repeat(60) })).toBeNull();
  });
  it('メモ 200 / 201 字', () => {
    expect(v({ memo: 'a'.repeat(200) })).toBeNull();
    expect(v({ memo: 'a'.repeat(201) })).toBe('メモは200字以内で入力してください');
  });
  it('駅名 40 / 41 字', () => {
    expect(v({ transitFrom: 'a'.repeat(40) }, transit)).toBeNull();
    expect(v({ transitTo: 'a'.repeat(41) }, transit)).toBe('駅名は40字以内で入力してください');
    expect(v({ transitTo: null }, transit)).toBe('出発駅と到着駅の両方を入力してください');
  });
  it('金額 1 円 / 0 円、1,000,000,000 / 1,000,000,001 円', () => {
    expect(v({ amount: 1 })).toBeNull();
    expect(v({ amount: 0 })).toBe('金額は1円以上の整数で入力してください');
    expect(v({ amount: 1.5 })).toBe('金額は1円以上の整数で入力してください');
    expect(v({ amount: 1_000_000_000 })).toBeNull();
    expect(v({ amount: 1_000_000_001 })).toBe('金額が大きすぎます');
  });
  it('実在しない日付', () => {
    expect(isRealCashDate('2026-02-28')).toBe(true);
    expect(isRealCashDate('2026-02-30')).toBe(false);
    expect(isRealCashDate('2026-13-01')).toBe(false);
    expect(isRealCashDate('2026/02/01')).toBe(false);
    expect(v({ date: '2026-02-30' })).toBe('日付が正しくありません');
  });
  it('担当者は 3 値のどれか (必須)', () => {
    expect(v({ owner: null })).toBe('担当者を選んでください');
    expect(v({ owner: 'unset' })).toBe('担当者を選んでください');
    expect(v({ owner: 'family' })).toBeNull();
  });
  it('allowUnset(API の互換)は担当者と業務の目的の「無い」だけを許し、値の検査は画面と同じ', () => {
    const api = (over: Partial<CashInput>, from: CashInput = ok) =>
      validateCashInput({ ...from, ...over }, { allowUnset: true });
    expect(api({ owner: null })).toBeNull();
    expect(api({ owner: 'unset' })).toBe('担当者を選んでください');
    expect(api({ transitPurpose: null }, transit)).toBeNull();
    expect(api({ transitPurpose: '観光' }, transit)).toBe(v({ transitPurpose: '観光' }, transit));
    expect(api({ transitPurpose: null, transitPurposeNote: '記述だけ' }, transit)).not.toBeNull();
    expect(api({ transitTo: null }, transit)).toBe('出発駅と到着駅の両方を入力してください');
  });
  it('交通費は支出だけ、往復は区間があるときだけ', () => {
    expect(v({ io: 'income' }, transit)).toBe('交通費は支出として入力してください');
    expect(v({ transitRound: true })).toBe('往復は区間があるときだけ選べます');
  });
  it('業務の目的: 区間があるとき必須、無いとき null、その他は 40 / 41 字', () => {
    expect(v({ transitPurpose: null }, transit)).toBe('業務の目的を選んでください');
    expect(v({ transitPurpose: '営業' }, transit)).toBe('業務の目的は候補から選んでください');
    expect(v({ transitPurpose: '打ち合わせ' })).toBe('業務の目的は交通費のときだけ入力できます');
    expect(v({ transitPurpose: 'その他', transitPurposeNote: 'あ'.repeat(40) }, transit)).toBeNull();
    expect(v({ transitPurpose: 'その他', transitPurposeNote: 'あ'.repeat(41) }, transit)).toBe(
      'その他の目的は40字以内で入力してください',
    );
    expect(v({ transitPurpose: 'その他', transitPurposeNote: '' }, transit)).toBe(
      'その他の目的を入力してください',
    );
    expect(v({ transitPurposeNote: 'x' }, transit)).toBe('目的の記述はその他のときだけ入力できます');
  });
});

describe('月', () => {
  const months = cashMonthsInPeriod('2025-09', '2026-08');
  it('期間の月を古い順に', () => {
    expect(months).toHaveLength(12);
    expect([months[0], months[11]]).toEqual(['2025-09', '2026-08']);
  });
  it('月送りは期間の端で止まる', () => {
    expect(cashMonthNav(months, '2025-09')).toEqual({ prev: null, next: '2025-10' });
    expect(cashMonthNav(months, '2026-08')).toEqual({ prev: '2026-07', next: null });
    expect(cashMonthNav(months, '2027-01')).toEqual({ prev: null, next: null });
  });
  it('既定の月は今日の月、期間の外なら最後の月', () => {
    expect(defaultCashMonth(months, '2026-03-15')).toBe('2026-03');
    expect(defaultCashMonth(months, '2026-09-10')).toBe('2026-08');
    expect(defaultCashMonth([], '2026-09-10')).toBeNull();
  });
});

describe('URL', () => {
  const months = cashMonthsInPeriod('2026-01', '2026-12');
  const read = (qs: string) => readCashUrl(new URLSearchParams(qs), months);

  it('全キーの往復', () => {
    const qs =
      'tab=transit&month=2026-07&q=%E6%9D%B1%E4%BA%AC&io=expense&category=%E6%B6%88%E8%80%97%E5%93%81%E8%B2%BB&owner=unset&route=transit&min=100&max=5000&from=2026-07-01&to=2026-07-31&page=2';
    const s = read(qs);
    expect(s).toEqual({
      tab: 'transit',
      month: '2026-07',
      filter: {
        q: '東京',
        io: 'expense',
        category: '消耗品費',
        owner: 'unset',
        route: 'transit',
        min: 100,
        max: 5000,
        from: '2026-07-01',
        to: '2026-07-31',
      },
      page: 2,
    });
    expect(writeCashUrl(s).toString()).toBe(qs);
  });
  it('不正な値は既定に落とし、既定値は URL に付けない', () => {
    const s = read('tab=x&month=2030-01&io=all&owner=boss&route=y&min=-1&max=1e3&from=2026-02-30&page=0');
    expect(s).toEqual({ tab: 'normal', month: null, filter: { ...EMPTY_CASH_FILTER }, page: 1 });
    expect(writeCashUrl(s).toString()).toBe('');
  });
});

describe('一括の id', () => {
  it('1〜100 件の正の整数で重複なし', () => {
    expect(cashBulkIdsError([1])).toBeNull();
    expect(cashBulkIdsError(Array.from({ length: 100 }, (_, i) => i + 1))).toBeNull();
    expect(cashBulkIdsError(Array.from({ length: 101 }, (_, i) => i + 1))).toBe(
      '一度に削除できるのは100件までです',
    );
    expect(cashBulkIdsError([])).toBe('明細を選んでください');
    expect(cashBulkIdsError([1, 1])).toBe('同じ明細が重複しています');
    expect(cashBulkIdsError([0])).toBe('明細の指定が正しくありません');
    expect(cashBulkIdsError(['1'])).toBe('明細の指定が正しくありません');
  });
});

describe('下書き', () => {
  const store = (): CashDraftStorage & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  };
  const draft = {
    normal: {
      date: '2026-07-01',
      side: 'biz' as const,
      io: 'expense' as const,
      amount: '1200',
      description: 'ノート',
      categoryMajor: '消耗品費',
      categoryMid: '',
      owner: 'business' as const,
      memo: 'm'.repeat(250),
    },
    transit: {
      from: '東京',
      to: '新宿',
      oneWay: '220',
      round: true,
      purpose: '打ち合わせ' as const,
      purposeNote: '',
      memo: '',
    },
  };

  it('利用者ごとのキーで保存し、読み戻せる。上限を超える値は上限で切る', () => {
    const s = store();
    const saved = saveCashDraft(s, 'u1', draft, '2026-07-01T05:25:00.000Z');
    expect(CASH_DRAFT_KEY_PREFIX).toBe('kanjo:cash-draft:v1:');
    expect(cashDraftKey('u1')).toBe(`${CASH_DRAFT_KEY_PREFIX}u1`);
    expect([...s.map.keys()]).toEqual(['kanjo:cash-draft:v1:u1']);
    expect(saved?.normal.memo).toHaveLength(200);
    expect(loadCashDraft(s, 'u1')).toEqual(saved);
    expect(loadCashDraft(s, 'u2')).toBeNull();
    clearCashDraft(s, 'u1');
    expect(loadCashDraft(s, 'u1')).toBeNull();
  });
  it('壊れた値と例外は握って null', () => {
    const s = store();
    s.map.set(cashDraftKey('u1'), '{broken');
    expect(loadCashDraft(s, 'u1')).toBeNull();
    const throwing: CashDraftStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadCashDraft(throwing, 'u1')).toBeNull();
    expect(saveCashDraft(throwing, 'u1', draft, '2026-07-01T00:00:00Z')).toBeNull();
    expect(() => clearCashDraft(throwing, 'u1')).not.toThrow();
    expect(loadCashDraft(null, 'u1')).toBeNull();
  });
  it('旧版の tab は無視し、候補外の値は空に戻す', () => {
    const s = store();
    s.map.set(
      cashDraftKey('u1'),
      JSON.stringify({
        tab: 'x',
        normal: { owner: 'boss', side: 'x' },
        transit: { purpose: '営業' },
        savedAt: 't',
      }),
    );
    const d = loadCashDraft(s, 'u1');
    expect(d).not.toHaveProperty('tab');
    expect([d?.normal.owner, d?.normal.side, d?.transit.purpose]).toEqual(['', 'biz', '']);
  });
});

describe('入力文字数', () => {
  it('UTF-16 ではなくコードポイントで超過分を切る', () => {
    expect(truncateCodePoints('😀'.repeat(41), 40)).toBe('😀'.repeat(40));
    expect([...truncateCodePoints('😀'.repeat(41), 40)]).toHaveLength(40);
  });
});
