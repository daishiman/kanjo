/**
 * 取込の内容指紋(正規化文字列)の契約テスト。
 * ファイル名・行順・空白が違っても同じ内容なら一致し、金額や行数が違えば一致しない。
 */
import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_VERSION,
  type FreeeDeal,
  MF_PERSISTED_COLUMNS,
  MF_PERSISTED_IDENTITY_COLUMNS,
  type MfTx,
  canonicalFreee,
  canonicalJsonSnapshot,
  canonicalMf,
  mfPersistedIdentityRow,
  mfPersistedRow,
  parseCSV,
  parseFreeeRows,
  parseMfRows,
} from '../src/index.js';

const freeeCsv = (rows: string[]) => ['収支区分,発生日,勘定科目,金額,取引先', ...rows].join('\n');
const r1 = '収入,2026/07/01,売上高,120000,架空顧客A';
const r2 = '支出,2026/07/02,支払手数料,3000,架空SaaS';

describe('canonicalFreee', () => {
  it('行の並び順が違っても同じ', () => {
    const a = parseFreeeRows(parseCSV(freeeCsv([r1, r2])), {}).deals;
    const b = parseFreeeRows(parseCSV(freeeCsv([r2, r1])), {}).deals;
    expect(canonicalFreee(a)).toBe(canonicalFreee(b));
  });
  it('保存値の空白差は別write-setとして区別する', () => {
    const base = parseFreeeRows(parseCSV(freeeCsv([r1])), {}).deals;
    const changed = parseFreeeRows(parseCSV(freeeCsv([`${r1} `])), {}).deals;
    expect(canonicalFreee(changed)).not.toBe(canonicalFreee(base));
  });
  it('金額が1円違えば別、行が1つ多くても別', () => {
    const base = parseFreeeRows(parseCSV(freeeCsv([r1, r2])), {}).deals;
    const amt = parseFreeeRows(parseCSV(freeeCsv([r1, r2.replace('3000', '3001')])), {}).deals;
    const more = parseFreeeRows(parseCSV(freeeCsv([r1, r2, r2])), {}).deals;
    expect(canonicalFreee(amt)).not.toBe(canonicalFreee(base));
    expect(canonicalFreee(more)).not.toBe(canonicalFreee(base));
  });
  it('科目の正規化対応表が違えば集計write-setも変わるため区別する', () => {
    const rows = parseCSV(freeeCsv([r1, r2]));
    const a = parseFreeeRows(rows, {}).deals;
    const b = parseFreeeRows(rows, { 支払手数料: 'サブスク・通信' }).deals;
    expect(canonicalFreee(a)).not.toBe(canonicalFreee(b));
  });
  it('制御文字を含む値でもcell境界が衝突しない', () => {
    const base: FreeeDeal = {
      month: '2026-07',
      date: '2026-07-01',
      io: 'expense',
      partner: 'a\u001fb',
      accountRaw: 'c',
      accountNorm: 'n',
      amount: 1,
    };
    const shifted = { ...base, partner: 'a', accountRaw: 'b\u001fc' };
    expect(canonicalFreee([base])).not.toBe(canonicalFreee([shifted]));
  });
});

describe('canonicalMf', () => {
  const header = '計算対象,日付,金額,大項目,中項目,振替,内容,ID';
  const m1 = '1,2026/07/01,-800,食費,食料品,0,架空スーパー,ID001';
  const m2 = '1,2026/07/02,-1200,食費,外食,0,架空食堂,ID002';
  const parse = (rows: string[]): MfTx[] => parseMfRows(parseCSV([header, ...rows].join('\n'))).txs;

  it('行の並び順が違っても同じ', () => {
    expect(canonicalMf(parse([m1, m2]))).toBe(canonicalMf(parse([m2, m1])));
  });
  it('金額・件数が違えば別', () => {
    expect(canonicalMf(parse([m1, m2.replace('-1200', '-1300')]))).not.toBe(canonicalMf(parse([m1, m2])));
    expect(canonicalMf(parse([m1]))).not.toBe(canonicalMf(parse([m1, m2])));
  });
  it('freee と MF は同じ行でも別系統として区別する', () => {
    const d: FreeeDeal[] = [];
    expect(canonicalFreee(d)).not.toBe(canonicalMf([]));
  });
  it('IDなし明細は行indexが復元keyのため行順変更を同一視しない', () => {
    const withoutId = '1,2026/07/03,-500,日用品,雑貨,0,架空売店,';
    const another = '1,2026/07/04,-600,日用品,雑貨,0,架空商店,';
    expect(canonicalMf(parse([withoutId, another]))).not.toBe(canonicalMf(parse([another, withoutId])));
  });
  it('重複IDは実際の保存と同じlast-write-winsで射影する', () => {
    const old = parse([m1])[0];
    const current = { ...old, a: -801 };
    expect(canonicalMf([old, current])).toBe(canonicalMf([current]));
  });
  it('slash/hyphenの日付表現を同じ保存日と指紋へ正規化する', () => {
    const slash = parse([m1])[0];
    const hyphen = { ...slash, d: '07-01' };
    expect(mfPersistedRow(slash)[2]).toBe('2026-07-01');
    expect(mfPersistedRow(hyphen)[2]).toBe('2026-07-01');
    expect(canonicalMf([slash])).toBe(canonicalMf([hyphen]));
  });

  it('v4の完全保存射影でmemo・計算対象・振替の差をそれぞれ指紋差にする', () => {
    const base = parse([m1])[0];
    expect(FINGERPRINT_VERSION).toBe(4);
    for (const changed of [
      { ...base, memo: '架空メモ' },
      { ...base, isTarget: false },
      { ...base, isTransfer: true },
    ]) {
      expect(canonicalMf([changed])).not.toBe(canonicalMf([base]));
    }
  });

  it('memoの前後空白・空白のみ・空文字・列欠落を別の保存値として指紋で区別する', () => {
    const memoHeader = `${header},メモ`;
    const parseMemo = (memo: string): MfTx =>
      parseMfRows(parseCSV([memoHeader, `${m1},${memo}`].join('\n'))).txs[0];
    const spaced = parseMemo('  架空メモ  ');
    const trimmed = parseMemo('架空メモ');
    const whitespaceOnly = parseMemo('   ');
    const empty = parseMemo('');
    const missing = parse([m1])[0];

    expect(spaced.memo).toBe('  架空メモ  ');
    expect(whitespaceOnly.memo).toBe('   ');
    expect(empty.memo).toBe('');
    expect(missing.memo).toBeUndefined();
    expect(canonicalMf([spaced])).not.toBe(canonicalMf([trimmed]));
    expect(canonicalMf([whitespaceOnly])).not.toBe(canonicalMf([empty]));
    expect(canonicalMf([empty])).not.toBe(canonicalMf([missing]));
  });

  it('旧データのundefinedを計算対象・非振替として完全保存行へ映射する', () => {
    const legacy = { ...parse([m1])[0], isTarget: undefined, isTransfer: undefined };
    const explicitDefaults = { ...legacy, isTarget: true, isTransfer: false };

    expect(MF_PERSISTED_COLUMNS).toEqual([
      'tx_id',
      'month',
      'date',
      'description',
      'amount',
      'category_major',
      'category_mid',
      'institution',
      'memo',
      'is_target',
      'is_transfer',
    ]);
    expect(MF_PERSISTED_IDENTITY_COLUMNS).toEqual([...MF_PERSISTED_COLUMNS, 'identity_stable']);
    expect(mfPersistedRow(legacy)).toEqual([
      legacy.id,
      legacy.m,
      '2026-07-01',
      legacy.c,
      legacy.a,
      legacy.big,
      legacy.mid,
      null,
      null,
      1,
      0,
    ]);
    expect(mfPersistedIdentityRow(legacy)).toEqual([...mfPersistedRow(legacy), 1]);
    expect(canonicalMf([legacy])).toBe(canonicalMf([explicitDefaults]));
  });
});

describe('canonicalJsonSnapshot', () => {
  it('object key順とexportedAtだけが違うsnapshotを同一視する', () => {
    const a = { months: ['2026-07'], exportedAt: '2026-08-01T00:00:00Z', nested: { b: 2, a: 1 } };
    const b = { nested: { a: 1, b: 2 }, exportedAt: '2026-08-02T00:00:00Z', months: ['2026-07'] };
    expect(canonicalJsonSnapshot(a)).toBe(canonicalJsonSnapshot(b));
  });

  it('array順と業務値の変化は区別する', () => {
    expect(canonicalJsonSnapshot({ months: ['2026-07', '2026-08'] })).not.toBe(
      canonicalJsonSnapshot({ months: ['2026-08', '2026-07'] }),
    );
    expect(canonicalJsonSnapshot({ budgets: { 架空費: 100 } })).not.toBe(
      canonicalJsonSnapshot({ budgets: { 架空費: 101 } }),
    );
  });

  it('復元write-setに影響しないmetadataと旧rules表現を同一視する', () => {
    const a = {
      months: ['2026-07'],
      rules: [{ keyword: '架空店', cls: 'per' }],
      exportedAt: '2026-08-01T00:00:00Z',
      cashEntries: [{ id: 1 }],
      displayOnly: 'old',
    };
    const b = {
      displayOnly: 'new',
      rules: [{ k: '架空店', cls: 'per', big: null, mid: null, owner: null }],
      months: ['2026-07'],
      exportedAt: '2026-08-02T00:00:00Z',
      cashEntries: [{ id: 2 }],
    };
    expect(canonicalJsonSnapshot(a)).toBe(canonicalJsonSnapshot(b));
  });

  it('旧selfとcanonical businessを同じowner write-setとして指紋化する', () => {
    const legacy = {
      rules: [{ k: '架空', cls: null, owner: 'self' }],
      edits: { tx: { owner: 'self' } },
      institutionOwners: { 架空銀行: 'self' },
      personalByOwner: { '2026-07': { self: { income: 1, expense: 2 } } },
    };
    const canonical = {
      rules: [{ k: '架空', cls: null, owner: 'business' }],
      edits: { tx: { owner: 'business' } },
      institutionOwners: { 架空銀行: 'business' },
      personalByOwner: { '2026-07': { business: { income: 1, expense: 2 } } },
      ownerSchemaVersion: 2,
    };
    expect(canonicalJsonSnapshot(legacy)).toBe(canonicalJsonSnapshot(canonical));
  });
});
