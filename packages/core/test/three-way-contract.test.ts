import { describe, expect, it } from 'vitest';
import {
  type MfTx,
  THREE_WAY_ATTRS,
  type TxEdit,
  conflictingAttrs,
  resolveThreeWay,
  resolveThreeWayAttrs,
  resolveTx,
} from '../src/index.js';

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'x',
  m: '2026-07',
  d: '2026-07-01',
  c: '架空スーパー',
  a: -1000,
  big: '食費',
  mid: '食料品',
  ...over,
});

describe('3点比較の真理値(DR-10)', () => {
  it('base == incoming なら current が残る(取込元が動いていない)', () => {
    const r = resolveThreeWay('食費', '交際費', '食費');
    expect(r.outcome).toBe('keep-current');
    expect(r.value).toBe('交際費');
    expect(r.nextBase).toBe('食費');
  });

  it('base != incoming かつ current == base なら incoming を採り base が前進する', () => {
    const r = resolveThreeWay('食費', '食費', '外食');
    expect(r.outcome).toBe('take-incoming');
    expect(r.value).toBe('外食');
    expect(r.nextBase).toBe('外食');
  });

  it('双方が変わったときだけ conflict を返し、base を動かさない', () => {
    const r = resolveThreeWay('食費', '交際費', '外食');
    expect(r.outcome).toBe('conflict');
    expect(r.value).toBe('交際費'); // 既定は手当ての維持(DR-11)
    expect(r.nextBase).toBe('食費'); // 解決されるまで base を進めない
  });

  it('分岐は3つだけで、4つ目を作らない', () => {
    const seen = new Set<string>();
    for (const b of [null, 'A', 'B'])
      for (const c of [null, 'A', 'B'])
        for (const i of [null, 'A', 'B']) seen.add(resolveThreeWay(b, c, i).outcome);
    expect([...seen].sort()).toEqual(['conflict', 'keep-current', 'take-incoming']);
  });

  it('base と current の空値表現(null / 空文字)を同じ値として扱う', () => {
    expect(resolveThreeWay('', '', null).outcome).toBe('keep-current');
    expect(resolveThreeWay('A', '', 'A').outcome).toBe('keep-current');
  });

  it('取込原本が運んでいない属性(incoming=undefined)は空欄(null)と区別する', () => {
    // undefined = 列が無い。比べる相手が無いので手当てが残る。
    expect(resolveThreeWay('per', 'biz', undefined)).toMatchObject({
      outcome: 'keep-current',
      value: 'biz',
      nextBase: 'per', // 運んでいない属性で base を動かさない
      baseBackfilled: false,
    });
    // null = 列はあるが空欄。これは「空欄へ変わった」という変化である。
    expect(resolveThreeWay('per', 'biz', null).outcome).toBe('conflict');
  });
});

describe('base 未記録の遅延移行(D03)', () => {
  it('base が無い明細は take-incoming へ倒れず、手当てが残る', () => {
    const r = resolveThreeWay(null, '交際費', '外食');
    expect(r.outcome).toBe('keep-current');
    expect(r.value).toBe('交際費');
    expect(r.baseBackfilled).toBe(true);
    expect(r.nextBase).toBe('外食'); // 埋めた base は今回の取込値
  });

  it('base を持つ明細では baseBackfilled が立たない', () => {
    expect(resolveThreeWay('食費', '交際費', '外食').baseBackfilled).toBe(false);
  });

  it('明示的に記録済みなnull baseを未記録と混同しない', () => {
    const knownEmpty = resolveThreeWay(null, 'spouse', 'family', true);
    expect(knownEmpty).toMatchObject({ outcome: 'conflict', baseBackfilled: false, nextBase: null });
    expect(resolveThreeWay(null, 'spouse', 'family', false).baseBackfilled).toBe(true);
  });

  it('移行の前後で手当ての扱いが変わらない', () => {
    const 移行前 = resolveThreeWay(null, '交際費', '外食');
    const 移行後 = resolveThreeWay(移行前.nextBase, '交際費', '外食');
    expect(移行後.outcome).toBe('keep-current');
    expect(移行後.value).toBe(移行前.value);
  });
});

describe('属性単位の3点比較(D02)', () => {
  it('衝突していない属性は conflictingAttrs に出ない', () => {
    const byAttr = resolveThreeWayAttrs(
      { big: '食費', mid: '食料品' },
      { big: '交際費', mid: '食料品' },
      { big: '外食', mid: '食料品' },
    );
    expect(conflictingAttrs(byAttr)).toEqual(['big']);
  });

  it('4属性すべてを比較する', () => {
    const byAttr = resolveThreeWayAttrs({}, {}, {});
    expect(Object.keys(byAttr).sort()).toEqual([...THREE_WAY_ATTRS].sort());
  });
});

describe('resolveTx への接続(既存の conflict は導出値として残る)', () => {
  it('再取込で取込値が変わった編集済み明細は conflict になる', () => {
    const edits: Record<string, TxEdit> = { x: { big: '交際費', baseBig: '食費', baseMid: '食料品' } };
    const r = resolveTx(tx({ big: '外食', mid: 'カフェ' }), [], edits);
    expect(r.conflict).toBe(true);
    expect(conflictingAttrs(r.threeWay)).toContain('big');
    expect(r.big).toBe('交際費'); // 既定は手当ての維持
  });

  it('取込値が動いていなければ編集済みでも conflict にならない', () => {
    const edits: Record<string, TxEdit> = {
      x: { big: '交際費', baseBig: '食費', baseMid: '食料品' },
    };
    const r = resolveTx(tx(), [], edits);
    expect(r.conflict).toBe(false);
  });

  it('base を持たない編集済み明細は conflict にならない(移行前の明細を巻き込まない)', () => {
    const r = resolveTx(tx({ big: '外食' }), [], { x: { big: '交際費' } });
    expect(r.conflict).toBe(false);
    expect(r.threeWay.big.baseBackfilled).toBe(true);
  });

  it('cls / owner は取込原本に対応値が無いので単独では衝突しない', () => {
    const r = resolveTx(tx(), [], { x: { cls: 'biz', owner: 'spouse', baseCls: 'per' } });
    expect(r.threeWay.cls.outcome).toBe('keep-current');
    expect(r.threeWay.owner.outcome).toBe('keep-current');
  });
});
