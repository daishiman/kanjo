/**
 * tx_edits の DB 行と core TxEdit の境界。
 *
 * 読み・単一書込み・一括復元で同じ列投影を使い、stable-keyと
 * 適用由来を新しい経路が落とさないようにする。
 */
import {
  STABLE_KEY_VERSION,
  TX_EDIT_ALL_BASES_KNOWN,
  TX_EDIT_BASE_BITS,
  type TxEdit,
  normalizeBaseKnown,
} from '@kanjo/core';
import type * as s from './db/schema.js';

export type TxEditDbRow = typeof s.txEdits.$inferSelect;

export type ManualEditPatch = Partial<Pick<TxEdit, 'cls' | 'big' | 'mid' | 'owner' | 'note'>>;
export type EffectiveEditBase = Required<Pick<TxEdit, 'cls' | 'big' | 'mid' | 'owner'>>;

/**
 * 手動編集を4属性のbaseと一緒に作る純粋関数。
 *
 * baseは「最初にその属性を手で変える直前」の tx_edit を除いた有効値で、一度入った値は
 * 上書きしない。vendor_memory由来の行は手動行ではないため、利用者が編集した値だけを
 * 新しいmanual行へ移す。quick classとfull editが同じ分岐を共有するための正本。
 */
export function applyManualEditWithBase(
  current: Readonly<TxEdit>,
  patch: Readonly<ManualEditPatch>,
  effectiveBefore: Readonly<EffectiveEditBase>,
): TxEdit {
  const next: TxEdit = current.origin === 'vendor_memory' ? {} : { ...current };
  let baseKnown =
    current.origin === 'vendor_memory'
      ? 0
      : normalizeBaseKnown(current.baseKnown, {
          cls: current.baseCls,
          big: current.baseBig,
          mid: current.baseMid,
          owner: current.baseOwner,
        });

  if (patch.cls !== undefined) {
    next.cls = patch.cls;
    if ((baseKnown & TX_EDIT_BASE_BITS.cls) === 0) next.baseCls = effectiveBefore.cls;
    baseKnown |= TX_EDIT_BASE_BITS.cls;
  }
  if (patch.owner !== undefined) {
    next.owner = patch.owner;
    if ((baseKnown & TX_EDIT_BASE_BITS.owner) === 0) next.baseOwner = effectiveBefore.owner;
    baseKnown |= TX_EDIT_BASE_BITS.owner;
  }
  if (patch.big !== undefined || patch.mid !== undefined) {
    if (patch.big !== undefined) next.big = patch.big || null;
    if (patch.mid !== undefined) next.mid = patch.mid || null;
    // 科目は組で編集する。片方が空でも「空だった」基準を両方固定する。
    if ((baseKnown & TX_EDIT_BASE_BITS.big) === 0) next.baseBig = effectiveBefore.big;
    if ((baseKnown & TX_EDIT_BASE_BITS.mid) === 0) next.baseMid = effectiveBefore.mid;
    baseKnown |= TX_EDIT_BASE_BITS.big | TX_EDIT_BASE_BITS.mid;
  }
  if (patch.note !== undefined) next.note = patch.note;

  next.origin = 'manual';
  next.originKey = null;
  next.baseKnown = baseKnown & TX_EDIT_ALL_BASES_KNOWN;
  return next;
}

/** 自動適用を個別に外すとき、memoryなしの有効値を手動行として固定する。 */
export function materializeManualFallback(
  current: Readonly<TxEdit>,
  effectiveWithMemory: Readonly<EffectiveEditBase>,
  fallbackWithoutMemory: Readonly<EffectiveEditBase>,
): TxEdit {
  return applyManualEditWithBase(
    current,
    {
      cls: fallbackWithoutMemory.cls,
      big: fallbackWithoutMemory.big || null,
      mid: fallbackWithoutMemory.mid || null,
      owner: fallbackWithoutMemory.owner,
    },
    effectiveWithMemory,
  );
}

export const txEditFromRow = (row: TxEditDbRow): TxEdit => ({
  cls: row.cls ?? null,
  big: row.categoryMajor ?? null,
  mid: row.categoryMid ?? null,
  owner: row.owner ?? null,
  baseBig: row.baseMajor ?? null,
  baseMid: row.baseMid ?? null,
  baseCls: row.baseCls ?? null,
  baseOwner: row.baseOwner ?? null,
  baseKnown: row.baseKnown,
  note: row.note ?? null,
  updatedAt: row.updatedAt ?? null,
  stableKey: row.stableKey ?? null,
  fingerprintVersion: row.fingerprintVersion ?? null,
  origin: row.origin ?? null,
  originKey: row.originKey ?? null,
});

/** Drizzle insert/upsert 用。列を増やすときはここだけを変える。 */
export const txEditInsertValues = (
  userId: string,
  txId: string,
  edit: TxEdit,
  fallbackUpdatedAt: string | null = null,
): typeof s.txEdits.$inferInsert => ({
  userId,
  txId,
  cls: edit.cls ?? null,
  categoryMajor: edit.big ?? null,
  categoryMid: edit.mid ?? null,
  owner: edit.owner ?? null,
  baseMajor: edit.baseBig ?? null,
  baseMid: edit.baseMid ?? null,
  baseCls: edit.baseCls ?? null,
  baseOwner: edit.baseOwner ?? null,
  baseKnown: normalizeBaseKnown(edit.baseKnown, {
    cls: edit.baseCls,
    big: edit.baseBig,
    mid: edit.baseMid,
    owner: edit.baseOwner,
  }),
  note: edit.note ?? null,
  updatedAt: edit.updatedAt ?? fallbackUpdatedAt,
  stableKey: edit.stableKey ?? null,
  fingerprintVersion: edit.fingerprintVersion ?? null,
  origin: edit.origin ?? null,
  originKey: edit.originKey ?? null,
});

/** JSON restore write-set の既存列順。適用由来は古いbackupには無いため安全側(NULL=手動)へ落とす。 */
export const txEditRestoreRow = (txId: string, edit: TxEdit): unknown[] => [
  txId,
  edit.cls ?? null,
  edit.big ?? null,
  edit.mid ?? null,
  edit.owner ?? null,
  edit.baseBig ?? null,
  edit.baseMid ?? null,
  edit.baseCls ?? null,
  edit.baseOwner ?? null,
  normalizeBaseKnown(edit.baseKnown, {
    cls: edit.baseCls,
    big: edit.baseBig,
    mid: edit.baseMid,
    owner: edit.baseOwner,
  }),
  edit.note ?? null,
  edit.updatedAt ?? null,
  edit.stableKey && edit.fingerprintVersion === STABLE_KEY_VERSION ? edit.stableKey : null,
  edit.stableKey && edit.fingerprintVersion === STABLE_KEY_VERSION ? edit.fingerprintVersion : null,
];
