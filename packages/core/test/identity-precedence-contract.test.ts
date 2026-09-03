import { describe, expect, it } from 'vitest';
import {
  type MfTx,
  STABLE_KEY_VERSION,
  type TxEdit,
  type VendorMemoryRecord,
  indexEditsByStableKey,
  mfStableKey,
  resolveIdentity,
  resolveIncomingTx,
  stableKeyFields,
} from '../src/index.js';

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  m: '2026-07',
  d: '07/03',
  c: '架空スーパー',
  a: -1280,
  big: '食費',
  mid: '食料品',
  inst: '楽天カード',
  ...over,
});

describe('stable_key の作り(DR-13)', () => {
  it('同じ取引からは何度でも同じ鍵が出る', () => {
    expect(mfStableKey(tx())).toBe(mfStableKey(tx()));
  });

  it('tx_id が振り直されても鍵は変わらない', () => {
    expect(mfStableKey(tx({ id: 'mf-999' }))).toBe(mfStableKey(tx()));
  });

  it('再取込でMF側の大項目・中項目が変わっても鍵は変わらない', () => {
    // ここが変わると、3点比較にかけたい相手を見失う
    expect(mfStableKey(tx({ big: '外食', mid: 'カフェ' }))).toBe(mfStableKey(tx()));
  });

  it('メモの編集で鍵が変わらない', () => {
    expect(mfStableKey({ ...tx(), memo: 'あとで直す' } as MfTx)).toBe(mfStableKey(tx()));
  });

  it('日・内容・金額・口座が違えば別の鍵になる', () => {
    const base = mfStableKey(tx());
    expect(mfStableKey(tx({ d: '07/04' }))).not.toBe(base);
    expect(mfStableKey(tx({ c: '架空ドラッグ' }))).not.toBe(base);
    expect(mfStableKey(tx({ a: -1281 }))).not.toBe(base);
    expect(mfStableKey(tx({ inst: '別カード' }))).not.toBe(base);
  });

  it('日付の表記ゆれ(スラッシュ/ハイフン)を同じ鍵へ寄せる', () => {
    expect(mfStableKey(tx({ d: '2026-07-03' }))).toBe(mfStableKey(tx({ d: '07/03' })));
  });

  it('値に区切り文字が入っても鍵が衝突しない', () => {
    expect(mfStableKey(tx({ c: 'A', inst: 'B|C' }))).not.toBe(mfStableKey(tx({ c: 'A|B', inst: 'C' })));
  });

  it('版が鍵の先頭に入る', () => {
    expect(mfStableKey(tx()).startsWith(`v${STABLE_KEY_VERSION}:mf:`)).toBe(true);
  });

  it('鍵の材料に取込側で動く属性を含めない', () => {
    const fields = stableKeyFields({
      m: '2026-07',
      d: '07/03',
      c: 'X',
      a: -1,
      big: '食費',
      mid: '食料品',
      memo: 'M',
    });
    expect(fields).not.toContain('食費');
    expect(fields).not.toContain('食料品');
    expect(fields).not.toContain('M');
  });
});

describe('同一性の解決順序(tx_id が第一・stable_key が第二)', () => {
  const edit: TxEdit = { big: '接待交際費', baseBig: '食費' };

  it('tx_id で見つかればそれを使う', () => {
    const r = resolveIdentity(tx(), { 'mf-1': edit });
    expect(r.match).toBe('tx-id');
    expect(r.edit).toBe(edit);
  });

  it('tx_id が振り直されても stable_key で追随する', () => {
    const index = indexEditsByStableKey([{ txId: 'mf-1', edit, parts: tx() }]);
    const r = resolveIdentity(tx({ id: 'mf-777' }), {}, index);
    expect(r.match).toBe('stable-key');
    expect(r.edit).toBe(edit);
    expect(r.matchedTxId).toBe('mf-1'); // 旧IDが分かる
  });

  it('tx_id 一致が stable_key 一致より優先される', () => {
    const 直接: TxEdit = { big: '直接' };
    const index = indexEditsByStableKey([{ txId: 'old', edit: { big: '間接' }, parts: tx() }]);
    expect(resolveIdentity(tx(), { 'mf-1': 直接 }, index).edit).toBe(直接);
  });

  it('版の違う stable_key とは突き合わせない', () => {
    const 旧版: TxEdit = { big: 'X', fingerprintVersion: STABLE_KEY_VERSION + 1 };
    const index = indexEditsByStableKey([{ txId: 'mf-1', edit: 旧版, parts: tx() }]);
    expect(resolveIdentity(tx({ id: 'mf-777' }), {}, index).match).toBe('none');
  });

  it('鍵が衝突した手当ては結び付けない(別明細へ手当てを移さない)', () => {
    const index = indexEditsByStableKey([
      { txId: 'a', edit: { big: 'A' }, parts: tx() },
      { txId: 'b', edit: { big: 'B' }, parts: tx() },
    ]);
    expect(Object.keys(index)).toEqual([]);
    expect(resolveIdentity(tx({ id: 'mf-777' }), {}, index).match).toBe('none');
  });

  it('どちらでも見つからなければ none', () => {
    expect(resolveIdentity(tx(), {}, {}).match).toBe('none');
  });
});

describe('属性値の優先順位(DR-12)', () => {
  const memory = (over: Partial<VendorMemoryRecord> = {}): VendorMemoryRecord => ({
    vendorKey: '架空スーパー',
    cls: 'biz',
    big: '会議費',
    mid: '取引先打合せ',
    owner: 'spouse',
    hitCount: 4,
    disagreeCount: 0,
    ...over,
  });

  it('tx_editを除く有効値は rules > 高確信vendor_memory > 取込/既定で解く', () => {
    const fromMemory = resolveIncomingTx(tx(), [], {}, [memory()]);
    expect(fromMemory).toMatchObject({
      cls: 'biz',
      big: '会議費',
      mid: '取引先打合せ',
      owner: 'spouse',
      sources: {
        cls: 'vendor_memory',
        big: 'vendor_memory',
        mid: 'vendor_memory',
        owner: 'vendor_memory',
      },
      vendorDisposition: 'auto-apply',
    });

    const fromRules = resolveIncomingTx(
      tx(),
      [{ k: '架空', cls: 'per', big: '旅費交通費', mid: null, owner: 'business' }],
      {},
      [memory()],
    );
    expect(fromRules).toMatchObject({
      cls: 'per',
      big: '旅費交通費',
      mid: '',
      owner: 'business',
      sources: { cls: 'rules', big: 'rules', mid: 'rules', owner: 'rules' },
    });
  });

  it('低確信と取消済みのvendor_memoryは有効値にしない', () => {
    for (const candidate of [memory({ hitCount: 2 }), memory({ revoked: true })]) {
      const resolved = resolveIncomingTx(tx(), [], { 楽天カード: 'family' }, [candidate]);
      expect(resolved).toMatchObject({
        cls: 'per',
        big: '食費',
        mid: '食料品',
        owner: 'family',
        sources: { cls: 'import', big: 'import', mid: 'import', owner: 'import' },
      });
    }
  });
});
