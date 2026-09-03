import { describe, expect, it } from 'vitest';
import { applyManualEditWithBase } from './tx-edit-codec.js';

const effective = {
  cls: 'biz' as const,
  big: '会議費',
  mid: '取引先打合せ',
  owner: 'spouse' as const,
};

describe('applyManualEditWithBase', () => {
  it('quick classは最初の手動値と、tx_editを除く編集直前のbaseを一緒に保存する', () => {
    expect(applyManualEditWithBase({}, { cls: 'per' }, effective)).toMatchObject({
      cls: 'per',
      baseCls: 'biz',
      origin: 'manual',
      originKey: null,
    });
  });

  it('full editは4属性のbaseを一度だけ取り、後の編集で上書きしない', () => {
    const first = applyManualEditWithBase(
      {},
      { cls: 'per', big: '旅費交通費', mid: '電車', owner: 'business' },
      effective,
    );
    expect(first).toMatchObject({
      baseCls: 'biz',
      baseBig: '会議費',
      baseMid: '取引先打合せ',
      baseOwner: 'spouse',
    });

    expect(
      applyManualEditWithBase(
        first,
        { cls: 'biz', big: '消耗品費', mid: null, owner: 'family' },
        { cls: 'per', big: '交際費', mid: '', owner: null },
      ),
    ).toMatchObject({
      baseCls: 'biz',
      baseBig: '会議費',
      baseMid: '取引先打合せ',
      baseOwner: 'spouse',
    });
  });

  it('vendor_memory自動行を手で変えると、自動値を手動値に偉装せず新しいmanual行にする', () => {
    expect(
      applyManualEditWithBase(
        { cls: 'biz', owner: 'spouse', origin: 'vendor_memory', originKey: '架空商店' },
        { cls: 'per' },
        effective,
      ),
    ).toEqual({ cls: 'per', baseCls: 'biz', baseKnown: 1, origin: 'manual', originKey: null });
  });

  it('owner=nullとmid=空文字も記録済みbaseとして一度だけ固定する', () => {
    const first = applyManualEditWithBase(
      {},
      { big: '会議費', mid: null, owner: 'business' },
      { ...effective, mid: '', owner: null },
    );
    expect(first).toMatchObject({ baseMid: '', baseOwner: null, baseKnown: 14 });

    const second = applyManualEditWithBase(
      first,
      { mid: '会議' },
      { ...effective, mid: '別', owner: 'family' },
    );
    expect(second).toMatchObject({ baseMid: '', baseOwner: null, baseKnown: 14 });
  });
});
