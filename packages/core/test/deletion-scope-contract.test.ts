import { describe, expect, it } from 'vitest';
import {
  type BalanceEntryRow,
  type DeletionRequest,
  type DeletionScopeInput,
  type FreeeDealRow,
  type ManualRecords,
  type MfTxRow,
  collateralCounts,
  deletionFingerprint,
  deletionPreflight,
  deletionScope,
} from '../src/index.js';

const mfTx: MfTxRow[] = [
  { id: 'a', month: '2026-05', importId: 1 },
  { id: 'b', month: '2026-06', importId: 1 },
  { id: 'c', month: '2026-07', importId: 2 },
  { id: 'd', month: '2026-08', importId: null },
];
const freeeDeals: FreeeDealRow[] = [
  { id: 10, month: '2026-06', importId: 3 },
  { id: 11, month: '2026-07', importId: 3 },
];
const balanceEntries: BalanceEntryRow[] = [
  { id: 100, month: '2026-06', source: 'mf' },
  { id: 101, month: '2026-06', source: 'manual' },
  { id: 102, month: '2026-07', source: 'mf' },
];
const importKinds = { 1: 'mf', 2: 'mf', 3: 'freee', 4: 'assets' } as const;
const activeTargets = [
  { targetKey: 'mf:2026-05', importId: 1 },
  { targetKey: 'mf:2026-06', importId: 1 },
  { targetKey: 'mf:2026-07', importId: 2 },
  { targetKey: 'freee:2026-06', importId: 3 },
  { targetKey: 'freee:2026-07', importId: 3 },
  { targetKey: 'assets:2026-06', importId: 4 },
  { targetKey: 'assets:2026-07', importId: 4 },
];

const scope = (request: DeletionRequest): DeletionScopeInput => ({
  request,
  mfTx,
  freeeDeals,
  balanceEntries,
  importKinds,
  activeTargets,
});

const manual: ManualRecords = {
  txEdits: [{ txId: 'a' }, { txId: 'c' }, { txId: 'zzz' }],
  txSplits: [{ txId: 'b' }],
  cashEntries: [{ month: '2026-06' }, { month: '2026-07' }],
  attachments: [
    { txId: 'a', month: null },
    { txId: null, month: '2026-07' },
    { txId: null, month: '2030-01' },
  ],
};

describe('削除の対象特定 — 4粒度', () => {
  it('明細粒度は指定した明細だけを対象にする', () => {
    const t = deletionScope(scope({ granularity: 'transaction', txIds: ['a', 'c'] }));
    expect(t.mfTxIds).toEqual(['a', 'c']);
    expect(t.freeeDealIds).toEqual([]); // 明細粒度の入口はMF明細だけ
    expect(t.balanceEntryIds).toEqual([]);
    expect(t.months).toEqual(['2026-05', '2026-07']);
  });

  it('取込粒度はその取込の行だけを対象にする', () => {
    const t = deletionScope(scope({ granularity: 'import', importId: 1 }));
    expect(t.mfTxIds).toEqual(['a', 'b']);
    expect(t.freeeDealIds).toEqual([]);
    expect(t.affectedTargetKeys).toEqual(['mf:2026-05', 'mf:2026-06']);
  });

  it('取込粒度は freee 取込でも同じように効く', () => {
    const t = deletionScope(scope({ granularity: 'import', importId: 3 }));
    expect(t.freeeDealIds).toEqual([10, 11]);
    expect(t.mfTxIds).toEqual([]);
    expect(t.affectedTargetKeys).toEqual(['freee:2026-06', 'freee:2026-07']);
  });

  it('資産だけの取込も active target の所有関係から対象を解決する', () => {
    const t = deletionScope(scope({ granularity: 'import', importId: 4 }));
    expect(t.mfTxIds).toEqual([]);
    expect(t.freeeDealIds).toEqual([]);
    expect(t.balanceEntryIds).toEqual([100, 102]);
    expect(t.months).toEqual(['2026-06', '2026-07']);
    expect(t.affectedTargetKeys).toEqual(['assets:2026-06', 'assets:2026-07']);
  });

  it('期間×種別は範囲内かつ指定種別だけを対象にする', () => {
    const t = deletionScope(
      scope({ granularity: 'period', period: { from: '2026-06', to: '2026-07' }, kinds: ['mf'] }),
    );
    expect(t.mfTxIds).toEqual(['b', 'c']);
    expect(t.freeeDealIds).toEqual([]); // 種別で除外
    expect(t.affectedTargetKeys).toEqual(['mf:2026-06', 'mf:2026-07']);
  });

  it('種別を指定しなければ全種別が対象になる', () => {
    const t = deletionScope(scope({ granularity: 'period', period: { from: '2026-06', to: '2026-06' } }));
    expect(t.mfTxIds).toEqual(['b']);
    expect(t.freeeDealIds).toEqual([10]);
  });

  it('全件はすべての取込由来行を対象にする', () => {
    const t = deletionScope(scope({ granularity: 'all' }));
    expect(t.mfTxIds).toEqual(['a', 'b', 'c', 'd']);
    expect(t.freeeDealIds).toEqual([10, 11]);
  });
});

describe('指定範囲の外は1件も入らない(DR-1)', () => {
  it('期間の境界は閉区間で、外の月が混ざらない', () => {
    const t = deletionScope(scope({ granularity: 'period', period: { from: '2026-06', to: '2026-07' } }));
    expect(t.mfTxIds).not.toContain('a'); // 2026-05
    expect(t.mfTxIds).not.toContain('d'); // 2026-08
    expect(t.mfTxIds).toEqual(['b', 'c']);
  });

  it('存在しない取込IDを指定しても他の行を巻き込まない', () => {
    const targets = deletionScope(scope({ granularity: 'import', importId: 999 }));
    expect(targets.mfTxIds).toEqual([]);
    expect(targets.balanceEntryIds).toEqual([]);
    expect(targets.affectedTargetKeys).toEqual([]);
  });

  it('空の明細指定は何も対象にしない', () => {
    expect(deletionScope(scope({ granularity: 'transaction', txIds: [] })).mfTxIds).toEqual([]);
  });
});

describe('手入力の巻き添えを防ぐ(DR-6 / 0026 の source 列)', () => {
  it('balance_entries は source=mf の行しか対象にしない', () => {
    const t = deletionScope(scope({ granularity: 'all' }));
    expect(t.balanceEntryIds).toEqual([100, 102]);
    expect(t.balanceEntryIds).not.toContain(101); // 手入力の負債
  });

  it('期間削除でも手入力の残高は残る', () => {
    const t = deletionScope(scope({ granularity: 'period', period: { from: '2026-06', to: '2026-06' } }));
    expect(t.balanceEntryIds).toEqual([100]);
  });

  it('現金記録は対象集合に入らない', () => {
    const t = deletionScope(scope({ granularity: 'all' }));
    expect(collateralCounts(t, manual).cashEntries).toBe(0);
  });
});

describe('巻き添え件数', () => {
  it('対象明細を参照する手当て・分割・添付を数える', () => {
    const t = deletionScope(scope({ granularity: 'transaction', txIds: ['a', 'b'] }));
    const c = collateralCounts(t, manual);
    expect(c.txEdits).toBe(1); // 'a' のみ('c' は対象外、'zzz' は無関係)
    expect(c.txSplits).toBe(1); // 'b'
  });

  it('対象月に紐づく添付も数える', () => {
    const t = deletionScope(scope({ granularity: 'transaction', txIds: ['c'] }));
    expect(collateralCounts(t, manual).attachments).toBe(1); // month=2026-07 の添付
  });

  it('対象が空なら巻き添えも0', () => {
    const t = deletionScope(scope({ granularity: 'transaction', txIds: [] }));
    expect(collateralCounts(t, manual)).toEqual({ txEdits: 0, txSplits: 0, attachments: 0, cashEntries: 0 });
  });
});

describe('確認指紋', () => {
  it('同じ範囲からは同じ指紋が再現する', () => {
    const a = deletionFingerprint(deletionScope(scope({ granularity: 'import', importId: 1 })), manual);
    const b = deletionFingerprint(deletionScope(scope({ granularity: 'import', importId: 1 })), manual);
    expect(a).toBe(b);
  });

  it('範囲が違えば指紋も違う', () => {
    const a = deletionFingerprint(deletionScope(scope({ granularity: 'import', importId: 1 })), manual);
    const b = deletionFingerprint(deletionScope(scope({ granularity: 'import', importId: 2 })), manual);
    expect(a).not.toBe(b);
  });

  it('件数が同じでも中身が入れ替われば指紋が変わる', () => {
    const a = deletionFingerprint(deletionScope(scope({ granularity: 'transaction', txIds: ['a'] })), manual);
    const b = deletionFingerprint(deletionScope(scope({ granularity: 'transaction', txIds: ['b'] })), manual);
    expect(a).not.toBe(b);
  });

  it('指定の並び順が違っても同じ指紋になる', () => {
    const a = deletionFingerprint(
      deletionScope(scope({ granularity: 'transaction', txIds: ['a', 'c'] })),
      manual,
    );
    const b = deletionFingerprint(
      deletionScope(scope({ granularity: 'transaction', txIds: ['c', 'a'] })),
      manual,
    );
    expect(a).toBe(b);
  });

  it('対象が同じでも付随データが変われば指紋が変わる', () => {
    const targets = deletionScope(scope({ granularity: 'transaction', txIds: ['a'] }));
    const before = deletionFingerprint(targets, manual);
    const after = deletionFingerprint(targets, {
      ...manual,
      txEdits: [{ txId: 'zzz' }],
    });
    expect(after).not.toBe(before);
  });

  it('全件初期化で退避するbaseline行が変われば指紋が変わる', () => {
    const targets = deletionScope(scope({ granularity: 'all' }));
    const before = deletionFingerprint(targets, manual, {
      fullResetRows: [{ table: 'restored_monthly_agg', rowId: '["2026-06","biz"]', month: '2026-06' }],
    });
    const after = deletionFingerprint(targets, manual, {
      fullResetRows: [
        { table: 'restored_monthly_agg', rowId: '["2026-06","biz"]', month: '2026-06' },
        { table: 'restored_monthly_agg', rowId: '["2026-07","biz"]', month: '2026-07' },
      ],
    });
    expect(after).not.toBe(before);
  });
});

describe('preflight のまとめ', () => {
  it('件数・巻き添え・指紋を一度に返し、状態を動かさない', () => {
    const input = scope({ granularity: 'import', importId: 1 });
    const p = deletionPreflight(input, manual);
    expect(p.counts).toEqual({ mfTx: 2, freeeDeals: 0, balanceEntries: 0, months: 2 });
    expect(p.collateral.txEdits).toBe(1);
    expect(p.fingerprint).toBe(deletionFingerprint(p.targets, manual));
    // 入力を書き換えていない
    expect(mfTx).toHaveLength(4);
    expect(deletionPreflight(input, manual)).toEqual(p);
  });
});
