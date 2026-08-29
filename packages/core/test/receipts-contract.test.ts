/**
 * 証憑の未添付の洗い出しと、まとめ書き出しの索引の契約。
 *
 * 索引CSVの先頭3列(取引年月日・取引金額・取引先)は電子帳簿保存法の検索要件そのものなので、
 * 並びを変えると「保存しているのに要件を満たさない」状態になる。ここで固定する。
 */
import { describe, expect, it } from 'vitest';
import {
  type CashEntry,
  type Dataset,
  type MfTx,
  RECEIPT_GAP_URGENCY_LABEL,
  RECEIPT_INDEX_HEADER,
  RECEIPT_MAJOR_AMOUNT,
  RECEIPT_MINOR_AMOUNT,
  type ReceiptFile,
  type ReceiptGapRow,
  emptyDataset,
  receiptDate,
  receiptFileName,
  receiptGapReport,
  receiptGapReportFromInventory,
  receiptGapUrgency,
  receiptIndexRows,
  receiptInventory,
  receiptInventoryTargets,
  receiptReadme,
  receiptTargetSuffix,
  receiptZipPath,
} from '../src/index.js';

const tx = (over: Partial<MfTx> & { id: string }): MfTx => ({
  m: '2025-01',
  d: '01/05',
  c: 'コンビニ',
  a: -1200,
  big: '消耗品費',
  mid: '',
  ...over,
});

// 既定の公私判定は「個人」。事業経費として扱わせるため手動判定を全件に置く
const dataset = (mfTx: MfTx[]): Dataset => ({
  ...emptyDataset(),
  months: ['2025-01'],
  mfTx,
  edits: Object.fromEntries(mfTx.map((t) => [t.id, { cls: 'biz' as const }])),
});

const file = (over: Partial<ReceiptFile> = {}): ReceiptFile => ({
  txId: 'tx1',
  date: '2025-01-05',
  amount: 1200,
  partner: 'コンビニ',
  account: '消耗品費',
  paymentMethod: 'cash',
  seq: 1,
  ext: 'jpg',
  createdAt: '2025-02-01T10:00:00.000Z',
  ...over,
});

const cash = (over: Partial<CashEntry> = {}): CashEntry => ({
  id: 9,
  date: '2025-02-03',
  month: '2025-02',
  side: 'biz',
  io: 'expense',
  amount: 4800,
  description: '商工会議所',
  categoryMajor: '諸会費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  ...over,
});

describe('対象年の証憑棚卸し', () => {
  it('MFの分割子行を親取引単位に一度だけ数え、事業分の金額を合算する', () => {
    const data = dataset([
      tx({
        id: 'line-biz-1',
        a: -6000,
        big: '通信費',
        splitProjection: {
          kind: 'split',
          parentTxId: 'parent-1',
          lineId: 'line-biz-1',
          seq: 1,
          lineCount: 3,
          parentAmount: 10_000,
        },
      }),
      tx({
        id: 'line-biz-2',
        a: -1000,
        big: '支払手数料',
        splitProjection: {
          kind: 'split',
          parentTxId: 'parent-1',
          lineId: 'line-biz-2',
          seq: 2,
          lineCount: 3,
          parentAmount: 10_000,
        },
      }),
      tx({
        id: 'line-personal',
        a: -3000,
        splitProjection: {
          kind: 'split',
          parentTxId: 'parent-1',
          lineId: 'line-personal',
          seq: 3,
          lineCount: 3,
          parentAmount: 10_000,
        },
      }),
    ]);
    data.edits['line-personal'] = { cls: 'per' };

    const inventory = receiptInventory(data, { year: '2025' });
    expect(inventory.items).toHaveLength(1);
    expect(inventory.items[0]).toMatchObject({
      txId: 'parent-1',
      attachmentTargetId: 'parent-1',
      amount: 7000,
      source: 'mf',
      accounts: ['支払手数料', '通信費'],
    });
  });

  it('事業現金の支出を含め、別年・収入・個人現金は除く', () => {
    const inventory = receiptInventory(dataset([]), {
      year: '2025',
      cashEntries: [
        cash(),
        cash({ id: 10, date: '2024-12-31', month: '2024-12' }),
        cash({ id: 11, io: 'income' }),
        cash({ id: 12, side: 'per' }),
      ],
    });

    expect(inventory.items).toEqual([
      expect.objectContaining({
        txId: 'cash:9',
        attachmentTargetId: 'cash:9',
        amount: 4800,
        source: 'cash',
      }),
    ]);
  });

  it('freeeの証憑はこの棚卸しに混ぜず、外部確認境界として明示する', () => {
    const inventory = receiptInventory(dataset([]), { year: '2025' });
    expect(inventory.externalSources).toEqual([{ source: 'freee', responsibility: 'external-confirmation' }]);
  });

  it('対象年外のMF明細を棚卸しに入れない', () => {
    const data = dataset([tx({ id: 'in-year' }), tx({ id: 'other-year', m: '2024-12' })]);
    expect(receiptInventory(data, { year: '2025' }).items.map((row) => row.txId)).toEqual(['in-year']);
  });

  it('親target一覧でR2を確認し、その結果からgapを一貫生成する', () => {
    const inventory = receiptInventory(dataset([tx({ id: 'a' }), tx({ id: 'b' })]), {
      year: '2025',
    });
    expect(receiptInventoryTargets(inventory)).toEqual(['a', 'b']);
    const report = receiptGapReportFromInventory(inventory, { attachmentCounts: { a: 1 } });
    expect(report.summary).toMatchObject({ requiredCount: 2, attachedCount: 1, missingCount: 1 });
    expect(report.rows.map((row) => row.txId)).toEqual(['b']);
  });
});

describe('未添付の洗い出し', () => {
  it('入金・個人支出は対象にしない(領収書を求める相手が違う)', () => {
    const report = receiptGapReport(dataset([tx({ id: '1', a: 50_000 }), tx({ id: '2', a: -1000 })]), {
      year: '2025',
      attachmentCounts: {},
    });
    expect(report.rows.map((r) => r.txId)).toEqual(['2']);
  });

  it('添付済みと証憑不要は一覧から外し、添付率には数える', () => {
    const report = receiptGapReport(dataset([tx({ id: '1' }), tx({ id: '2' }), tx({ id: 'cash:9' })]), {
      year: '2025',
      attachmentCounts: { '1': 2 },
      waivedTxIds: ['cash:9'],
    });

    expect(report.rows.map((r) => r.txId)).toEqual(['2']);
    // 証憑不要は分母にも入れない。電車代を毎回「未対応」と数えても直せない
    expect(report.summary.requiredCount).toBe(2);
    expect(report.summary.attachedCount).toBe(1);
    expect(report.summary.coverage).toBe(0.5);
  });

  it('minAmountは一覧の絞り込みだけで、添付率と未添付合計は期間全体のまま', () => {
    const report = receiptGapReport(dataset([tx({ id: '1', a: -300 }), tx({ id: '2', a: -50_000 })]), {
      year: '2025',
      attachmentCounts: {},
      minAmount: 1000,
    });

    expect(report.rows.map((r) => r.txId)).toEqual(['2']);
    expect(report.summary.missingCount).toBe(2);
    expect(report.summary.missingAmount).toBe(50_300);
  });

  it('緊急度の高い順、同じ緊急度では金額の大きい順に並ぶ', () => {
    const report = receiptGapReport(
      dataset([tx({ id: '1', a: -1000 }), tx({ id: '2', a: -90_000 }), tx({ id: '3', a: -5000 })]),
      { year: '2025', attachmentCounts: {} },
    );

    const rank = { must: 0, should: 1, optional: 2 } as const;
    const ranks = report.rows.map((r) => rank[r.urgency]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const level of ['must', 'should', 'optional'] as const) {
      const amounts = report.rows.filter((r) => r.urgency === level).map((r) => r.amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    }
  });

  it('緊急度の内訳は一覧に出る全件を過不足なく分ける', () => {
    const report = receiptGapReport(dataset([tx({ id: '1', a: -1000 }), tx({ id: '2', a: -90_000 })]), {
      year: '2025',
      attachmentCounts: {},
    });
    const counted = Object.values(report.summary.byUrgency).reduce((s, v) => s + v.count, 0);
    expect(counted).toBe(report.summary.missingCount);
    expect(Object.keys(RECEIPT_GAP_URGENCY_LABEL).sort()).toEqual(['must', 'optional', 'should']);
  });

  it('対象が1件も無ければ添付率は100%(0件を0%と言わない)', () => {
    expect(receiptGapReport(dataset([]), { year: '2025', attachmentCounts: {} }).summary.coverage).toBe(1);
  });
});

describe('未添付の緊急度', () => {
  const row = (over: Partial<ReceiptGapRow> = {}): ReceiptGapRow => ({
    txId: 'tx1',
    month: '2025-01',
    date: '2025-01-05',
    description: 'コンビニ',
    amount: 1200,
    account: '消耗品費',
    paymentMethod: 'card',
    attachmentCount: 0,
    waived: false,
    ...over,
  });

  it('高額は支払手段によらず要対応(調査で最初に抜かれる帯)', () => {
    for (const paymentMethod of ['cash', 'card', 'account', 'unknown'] as const) {
      expect(receiptGapUrgency(row({ amount: RECEIPT_MAJOR_AMOUNT, paymentMethod }))).toBe('must');
    }
  });

  it('同じ金額でも、裏づけの無い現金はカード・口座より1段重い', () => {
    const amount = RECEIPT_MINOR_AMOUNT;
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'cash' }))).toBe('must');
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'card' }))).toBe('should');
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'account' }))).toBe('should');
    // 手段が分かるまでは現金と同じ扱い。不明を軽いほうへ倒さない
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'unknown' }))).toBe('must');
  });

  it('少額はカード・口座なら任意、現金なら推奨まで下がる(0にはしない)', () => {
    const amount = RECEIPT_MINOR_AMOUNT - 1;
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'card' }))).toBe('optional');
    expect(receiptGapUrgency(row({ amount, paymentMethod: 'cash' }))).toBe('should');
  });

  it('免除済みは金額が大きくても優先度を上げない', () => {
    expect(receiptGapUrgency(row({ amount: 500_000, paymentMethod: 'cash', waived: true }))).toBe('optional');
  });

  it('金額が増えて緊急度が下がることはない(同じ支払手段の中で単調)', () => {
    const rank = { must: 0, should: 1, optional: 2 } as const;
    for (const paymentMethod of ['cash', 'card', 'account', 'unknown'] as const) {
      const amounts = [0, 999, RECEIPT_MINOR_AMOUNT, 10_000, RECEIPT_MAJOR_AMOUNT, 1_000_000];
      const ranks = amounts.map((amount) => rank[receiptGapUrgency(row({ amount, paymentMethod }))]);
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    }
  });
});

describe('まとめ書き出しの索引', () => {
  it('検索要件の3項目を先頭に置く', () => {
    expect(RECEIPT_INDEX_HEADER.slice(0, 3)).toEqual(['取引年月日', '取引金額', '取引先']);
  });

  it('索引の各行は見出しと同じ列数で、ファイル名で原本と突き合わせられる', () => {
    const rows = receiptIndexRows([file(), file({ seq: 2 })]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.length === RECEIPT_INDEX_HEADER.length)).toBe(true);
    expect(rows[0]).toContain(receiptZipPath(file()));
  });

  it('ファイル名は日付・取引先・金額で、同一明細の2枚目以降に連番を付ける', () => {
    const suffix = receiptTargetSuffix('tx1');
    expect(receiptFileName(file())).toBe(`2025-01-05_コンビニ_1200円_${suffix}.jpg`);
    expect(receiptFileName(file({ seq: 2 }))).toBe(`2025-01-05_コンビニ_1200円_${suffix}_2.jpg`);
  });

  it('日付・取引先・金額が同じ別取引でもZIP内パスが衝突しない', () => {
    expect(receiptZipPath(file({ txId: 'parent-a' }))).not.toBe(receiptZipPath(file({ txId: 'parent-b' })));
  });

  it('月フォルダに分けて入れる(税務調査で月単位に出すため)', () => {
    expect(receiptZipPath(file())).toBe(
      `2025-01/2025-01-05_コンビニ_1200円_${receiptTargetSuffix('tx1')}.jpg`,
    );
  });

  it('月と日から取引年月日を組み立てる', () => {
    expect(receiptDate('2025-01', '01/05')).toBe('2025-01-05');
    // 日が取れない形なら月初に倒す(索引の日付列を空にしない)
    expect(receiptDate('2025-01', '5')).toBe('2025-01-01');
  });

  it('READMEに対象期間・件数・作成日時を残す(後から何のZIPか分かる)', () => {
    const readme = receiptReadme('2025年', 42, '2026-02-01 09:00:00');
    expect(readme).toContain('2025年');
    expect(readme).toContain('42');
    expect(readme).toContain('2026-02-01 09:00:00');
  });
});
