/**
 * 取込前の差分プレビューと、3点比較の基準値の書戻し(T09)。
 *
 * ここが守る性質は2つある。
 *
 * 1. D1 のクエリ数が行数に比例しないこと。
 *    明細・手当て・ルール・取引先の決め事はすべて一括で読む。
 *    5,000行でも50,000行でもクエリ数は同じで、previewは一切書かない。
 *
 * 2. 基準値(base)を後戻りさせないこと。
 *    ここが返すbackfill計画を確定POSTが`base_known`に従って書く。
 *    既に入っている base を新しい取込値で上書きすると、3点比較が常に
 *    「取込元は動いていない」と読み、双方が動いた衝突を見逃して手当てを消す。
 *
 * 差分の応答に金額やstable_keyは入れない(DR-9)。衝突は `tx_id`と属性値、
 * 低確信候補は今回のpreviewに必要なvendor labelと候補属性だけを返す。
 */
import {
  type Dataset,
  type MfTx,
  type Owner,
  type Rule,
  STABLE_KEY_VERSION,
  THREE_WAY_ATTRS,
  TX_EDIT_BASE_BITS,
  type ThreeWayAttr,
  type TxEdit,
  type VendorMemoryRecord,
  canonicalEncode,
  canonicalMfTransactions,
  conflictingAttrs,
  isCashTxId,
  judgeVendorMemory,
  mfPersistedRow,
  mfStableKey,
  normalizeBaseKnown,
  resolveIncomingTx,
  resolveThreeWayAttrs,
  resolveTx,
} from '@kanjo/core';
import { D1_FREE_QUERY_LIMIT } from './import-lifecycle.js';
import { fingerprintCanonical } from './import-pipeline.js';

/* --------------------------------- 予算 --------------------------------- */

export interface ImportDiffQueryPlan {
  total: number;
  limit: number;
  accepted: boolean;
  breakdown: {
    /** 科目正規化・rules・vendor_memory・口座名義の一括読み */
    settingsReads: number;
    /** 対象月の明細を読む(月数に依らず json_each で1文) */
    scopeReads: number;
    /** 手当てを読む */
    editReads: number;
    /** previewは書込leaseを取らない。予算の明示用に0を保つ。 */
    lifecycle: number;
  };
}

/**
 * 差分プレビューが使う D1 クエリの見積り。
 * 行数を引数に取らないのが要点で、取込の幅が広がっても total は動かない。
 */
export function planImportDiffQueries(args: {
  monthChunks: number;
}): ImportDiffQueryPlan {
  const breakdown = {
    settingsReads: 4,
    scopeReads: Math.max(1, args.monthChunks),
    editReads: 1,
    lifecycle: 0,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, limit: D1_FREE_QUERY_LIMIT, accepted: total < D1_FREE_QUERY_LIMIT, breakdown };
}

/* --------------------------------- 差分 --------------------------------- */

/** 取込原本と今の保存内容を突き合わせた件数。合計は「原本の行数 + 消える行数」になる。 */
export interface ImportDiffCounts {
  /** 原本にあり、いまは無い */
  added: number;
  /** 双方にあり、保存する値が違う */
  changed: number;
  /** いまあり、原本に無い(洗い替えで消える) */
  deleted: number;
  /** 双方にあり、値も同じ */
  unchanged: number;
}

/**
 * 衝突した1明細。属性ごとに3つの値を並べる(DR-10)。
 *
 * `stable_key` はここに入れない。あれは内容と金額をそのまま並べた鍵なので、
 * 応答へ載せると明細本体を外へ出したことになる(DR-9)。
 * どの明細かは、画面が手元の一覧を `tx_id` で引いて解決する。
 */
export interface ImportDiffConflict {
  txId: string;
  attrs: Partial<
    Record<ThreeWayAttr, { base: string | null; current: string | null; incoming: string | null }>
  >;
}

/** 基準値が未記録だったので埋める行(D03 の遅延移行)。 */
export interface ImportDiffBackfill {
  /** 現在の手当てが持つID */
  txId: string;
  /** 今回の取込で確定するID。変わったときは同batchでrekeyする。 */
  incomingTxId: string;
  baseCls: string | null;
  baseOwner: string | null;
  baseMajor: string | null;
  baseMid: string | null;
  baseKnown?: number | null;
  stableKey: string;
}

export interface ImportDiff {
  months: string[];
  counts: ImportDiffCounts;
  conflicts: ImportDiffConflict[];
  backfill: ImportDiffBackfill[];
  /** API応答には出さない。取込確定batchのrekey/選択適用に使う。 */
  matches: ImportDiffMatch[];
  /** 高確信かpin済みの既存memoryから、確定POSTで自動作成するprovenance付き編集。 */
  autoApply: ImportVendorApplication[];
  /** 低確信memory。今回previewの対象だけを返す。 */
  vendorCandidates: ImportVendorCandidate[];
}

export interface ImportVendorApplication {
  txId: string;
  vendorKey: string;
  cls: string | null;
  big: string | null;
  mid: string | null;
  owner: string | null;
  stableKey: string;
}

export interface ImportVendorCandidate {
  txId: string;
  vendorKey: string;
  vendorLabel: string;
  cls: string | null;
  big: string | null;
  mid: string | null;
  owner: string | null;
  reason: string;
}

export interface ImportDiffMatch {
  incomingTxId: string;
  existingTxId: string;
  stableKey: string;
  edit: ExistingEditRow | null;
}

/** D1 から読む、比較に要る列だけの明細。 */
export interface ExistingMfRow {
  txId: string;
  month: string;
  date: string;
  description: string;
  amount: number;
  categoryMajor: string | null;
  categoryMid: string | null;
  institution: string | null;
  memo: string | null;
  isTarget: number;
  isTransfer: number;
}

/** D1 から読む手当て。base_* は未記録のことがある(0030 より前に付けた手当て)。 */
export interface ExistingEditRow {
  txId: string;
  cls: string | null;
  categoryMajor: string | null;
  categoryMid: string | null;
  owner: string | null;
  baseCls: string | null;
  baseOwner: string | null;
  baseMajor: string | null;
  baseMid: string | null;
  baseKnown: number;
  stableKey: string | null;
  fingerprintVersion: number | null;
  origin: 'manual' | 'vendor_memory' | null;
  originKey: string | null;
}

/** 保存する値が同じか。id と月をまたがない同一行どうしだけを比べる。 */
const persistedEqual = (incoming: MfTx, existing: ExistingMfRow): boolean => {
  const [, month, date, description, amount, major, mid, institution, memo, isTarget, isTransfer] =
    mfPersistedRow(incoming);
  return (
    month === existing.month &&
    date === existing.date &&
    description === existing.description &&
    amount === existing.amount &&
    major === (existing.categoryMajor ?? '') &&
    mid === (existing.categoryMid ?? '') &&
    institution === existing.institution &&
    memo === existing.memo &&
    isTarget === existing.isTarget &&
    isTransfer === existing.isTransfer
  );
};

const stableKeyForIncoming = (tx: MfTx): string => mfStableKey(tx);

const stableKeyForExisting = (row: ExistingMfRow): string =>
  mfStableKey({
    m: row.month,
    d: row.date,
    c: row.description,
    a: row.amount,
    inst: row.institution ?? undefined,
  });

/**
 * 取込原本と保存内容の差分を出す。
 *
 * 同一性は第一に `tx_id`、取れないときだけ `stable_key`(DR-13)。
 * 逆順にすると、MF が tx_id を振り直していない普通の再取込でも、
 * 同日・同額・同店の別明細どうしが入れ替わって手当ての持ち主が移る。
 */
export function computeImportDiff(args: {
  incoming: readonly MfTx[];
  existing: readonly ExistingMfRow[];
  edits: readonly ExistingEditRow[];
  /** 洗い替えの対象月。ここに無い月の保存行は「消える」に数えない(DR-1) */
  months: readonly string[];
  rules?: readonly Rule[];
  institutionOwners?: Readonly<Record<string, Owner>>;
  vendorMemories?: readonly VendorMemoryRecord[];
}): ImportDiff {
  const monthSet = new Set(args.months);
  const incoming = canonicalMfTransactions(args.incoming);
  const scoped = args.existing.filter((row) => monthSet.has(row.month));

  const existingById = new Map(scoped.map((row) => [row.txId, row]));
  // 第二の鍵は「同じ鍵が1件だけ」のときにしか使わない。複数あるとどれの手当てか決められない
  const byStableKey = new Map<string, ExistingMfRow[]>();
  for (const row of scoped) {
    const key = stableKeyForExisting(row);
    const bucket = byStableKey.get(key);
    if (bucket) bucket.push(row);
    else byStableKey.set(key, [row]);
  }
  const editByTxId = new Map(args.edits.map((edit) => [edit.txId, edit]));

  const counts: ImportDiffCounts = { added: 0, changed: 0, deleted: 0, unchanged: 0 };
  const conflicts: ImportDiffConflict[] = [];
  const backfill: ImportDiffBackfill[] = [];
  const matches: ImportDiffMatch[] = [];
  const autoApply: ImportVendorApplication[] = [];
  const vendorCandidates: ImportVendorCandidate[] = [];
  const matched = new Set<string>();
  const rules = [...(args.rules ?? [])];
  const institutionOwners = args.institutionOwners ?? {};
  const vendorMemories = args.vendorMemories ?? [];

  for (const tx of incoming) {
    const stableKey = stableKeyForIncoming(tx);
    const incomingEffective = resolveIncomingTx(tx, rules, institutionOwners, vendorMemories);
    const byId = existingById.get(tx.id);
    const candidates = byStableKey.get(stableKey) ?? [];
    const existing = byId ?? (candidates.length === 1 ? candidates[0] : undefined);

    if (!existing) {
      counts.added += 1;
      const sources = incomingEffective.sources;
      if (
        incomingEffective.vendorMemory &&
        incomingEffective.vendorDisposition === 'auto-apply' &&
        Object.values(sources).includes('vendor_memory')
      ) {
        autoApply.push({
          txId: tx.id,
          vendorKey: incomingEffective.vendorMemory.vendorKey,
          cls: sources.cls === 'vendor_memory' ? incomingEffective.cls : null,
          big: sources.big === 'vendor_memory' ? incomingEffective.big : null,
          mid: sources.mid === 'vendor_memory' ? incomingEffective.mid : null,
          owner: sources.owner === 'vendor_memory' ? incomingEffective.owner : null,
          stableKey,
        });
      } else if (incomingEffective.vendorMemory && incomingEffective.vendorDisposition === 'suggest') {
        const memory = incomingEffective.vendorMemory;
        vendorCandidates.push({
          txId: tx.id,
          vendorKey: memory.vendorKey,
          vendorLabel: memory.vendorLabel ?? memory.vendorKey,
          cls: memory.cls ?? null,
          big: memory.big ?? null,
          mid: memory.mid ?? null,
          owner: memory.owner ?? null,
          reason: judgeVendorMemory(memory).reason,
        });
      }
      continue;
    }
    matched.add(existing.txId);
    if (persistedEqual(tx, existing)) counts.unchanged += 1;
    else counts.changed += 1;

    const edit = editByTxId.get(existing.txId);
    matches.push({ incomingTxId: tx.id, existingTxId: existing.txId, stableKey, edit: edit ?? null });
    const manualEdit = edit && edit.origin !== 'vendor_memory' ? edit : null;
    if (!manualEdit) {
      const sources = incomingEffective.sources;
      if (
        incomingEffective.vendorMemory &&
        incomingEffective.vendorDisposition === 'auto-apply' &&
        Object.values(sources).includes('vendor_memory')
      ) {
        autoApply.push({
          txId: tx.id,
          vendorKey: incomingEffective.vendorMemory.vendorKey,
          cls: sources.cls === 'vendor_memory' ? incomingEffective.cls : null,
          big: sources.big === 'vendor_memory' ? incomingEffective.big : null,
          mid: sources.mid === 'vendor_memory' ? incomingEffective.mid : null,
          owner: sources.owner === 'vendor_memory' ? incomingEffective.owner : null,
          stableKey,
        });
      } else if (incomingEffective.vendorMemory && incomingEffective.vendorDisposition === 'suggest') {
        const memory = incomingEffective.vendorMemory;
        vendorCandidates.push({
          txId: tx.id,
          vendorKey: memory.vendorKey,
          vendorLabel: memory.vendorLabel ?? memory.vendorKey,
          cls: memory.cls ?? null,
          big: memory.big ?? null,
          mid: memory.mid ?? null,
          owner: memory.owner ?? null,
          reason: judgeVendorMemory(memory).reason,
        });
      }
      continue;
    }

    const editValue: TxEdit = {
      cls: manualEdit.cls as TxEdit['cls'],
      big: manualEdit.categoryMajor,
      mid: manualEdit.categoryMid,
      owner: manualEdit.owner as TxEdit['owner'],
      baseCls: manualEdit.baseCls as TxEdit['baseCls'],
      baseOwner: manualEdit.baseOwner as TxEdit['baseOwner'],
      baseBig: manualEdit.baseMajor,
      baseMid: manualEdit.baseMid,
      baseKnown: manualEdit.baseKnown,
      origin: manualEdit.origin,
      originKey: manualEdit.originKey,
    };
    const currentEffective = resolveTx(tx, rules, { [tx.id]: editValue }, { ...institutionOwners });

    const known = normalizeBaseKnown(manualEdit.baseKnown, {
      cls: manualEdit.baseCls,
      big: manualEdit.baseMajor,
      mid: manualEdit.baseMid,
      owner: manualEdit.baseOwner,
    });
    const active =
      (manualEdit.cls ? TX_EDIT_BASE_BITS.cls : 0) |
      (manualEdit.categoryMajor || manualEdit.categoryMid
        ? TX_EDIT_BASE_BITS.big | TX_EDIT_BASE_BITS.mid
        : 0) |
      (manualEdit.owner ? TX_EDIT_BASE_BITS.owner : 0);

    const byAttr = resolveThreeWayAttrs(
      {
        cls: manualEdit.baseCls,
        big: manualEdit.baseMajor,
        mid: manualEdit.baseMid,
        owner: manualEdit.baseOwner,
      },
      {
        cls: currentEffective.cls,
        big: currentEffective.big,
        mid: currentEffective.mid,
        owner: currentEffective.owner,
      },
      {
        cls: incomingEffective.cls,
        big: incomingEffective.big,
        mid: incomingEffective.mid,
        owner: incomingEffective.owner,
      },
      known,
    );

    // 解除済み属性のbaseは履歴として保持するが、現在の手動編集ではないため衝突に数えない。
    const conflicting = conflictingAttrs(byAttr).filter((attr) => (active & TX_EDIT_BASE_BITS[attr]) !== 0);
    if (conflicting.length) {
      conflicts.push({
        txId: existing.txId,
        attrs: Object.fromEntries(
          conflicting.map((attr) => [
            attr,
            {
              base: byAttr[attr].nextBase,
              current: byAttr[attr].value,
              incoming: incomingEffective[attr],
            },
          ]),
        ),
      });
    }

    // 基準値が未記録だった属性を埋める。既に入っている base は動かさない
    if (
      THREE_WAY_ATTRS.some(
        (attr) => (active & TX_EDIT_BASE_BITS[attr]) !== 0 && byAttr[attr].baseBackfilled,
      ) ||
      manualEdit.stableKey !== stableKey ||
      manualEdit.fingerprintVersion !== STABLE_KEY_VERSION ||
      existing.txId !== tx.id
    ) {
      backfill.push({
        txId: existing.txId,
        incomingTxId: tx.id,
        baseCls: (known & TX_EDIT_BASE_BITS.cls) !== 0 ? manualEdit.baseCls : incomingEffective.cls,
        baseOwner: (known & TX_EDIT_BASE_BITS.owner) !== 0 ? manualEdit.baseOwner : incomingEffective.owner,
        baseMajor: (known & TX_EDIT_BASE_BITS.big) !== 0 ? manualEdit.baseMajor : incomingEffective.big,
        baseMid: (known & TX_EDIT_BASE_BITS.mid) !== 0 ? manualEdit.baseMid : incomingEffective.mid,
        baseKnown: known | active,
        stableKey,
      });
    }
  }

  counts.deleted = scoped.filter((row) => !matched.has(row.txId)).length;
  return {
    months: [...monthSet].sort(),
    counts,
    conflicts,
    backfill,
    matches,
    autoApply,
    vendorCandidates,
  };
}

/** previewと確定が同じMF全unit・同じ基準行を見たことの指紋。 */
export const importResolutionFingerprint = (
  unitFingerprints: readonly string[],
  diff: ImportDiff,
): Promise<string> =>
  fingerprintCanonical(
    `import-resolution:${canonicalEncode({
      unitFingerprints: [...unitFingerprints].sort(),
      months: diff.months,
      counts: diff.counts,
      conflicts: diff.conflicts,
      backfill: diff.backfill,
      autoApply: diff.autoApply,
      vendorCandidates: diff.vendorCandidates,
      matches: diff.matches.map((match) => ({
        incomingTxId: match.incomingTxId,
        existingTxId: match.existingTxId,
        stableKey: match.stableKey,
        edit: match.edit,
      })),
    })}`,
  );

/* ------------------------------- D1 の読み ------------------------------- */

export async function loadDiffBaseline(
  database: D1Database,
  userId: string,
  months: readonly string[],
): Promise<{ existing: ExistingMfRow[]; edits: ExistingEditRow[] }> {
  const monthPayload = JSON.stringify(months.map((month) => [month]));
  const [rows, edits] = await Promise.all([
    database
      .prepare(
        `SELECT tx_id, month, date, description, amount, category_major, category_mid,
                institution, memo, is_target, is_transfer
         FROM mf_transactions WHERE user_id=? AND month IN (
           SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
         )`,
      )
      .bind(userId, monthPayload)
      .all<{
        tx_id: string;
        month: string;
        date: string;
        description: string;
        amount: number;
        category_major: string | null;
        category_mid: string | null;
        institution: string | null;
        memo: string | null;
        is_target: number;
        is_transfer: number;
      }>(),
    database
      .prepare(
        `SELECT tx_id, cls, category_major, category_mid, owner, base_cls, base_owner, base_major, base_mid,
                base_known, stable_key, fingerprint_version, origin, origin_key
         FROM tx_edits WHERE user_id=?`,
      )
      .bind(userId)
      .all<{
        tx_id: string;
        cls: string | null;
        category_major: string | null;
        category_mid: string | null;
        owner: string | null;
        base_cls: string | null;
        base_owner: string | null;
        base_major: string | null;
        base_mid: string | null;
        base_known: number;
        stable_key: string | null;
        fingerprint_version: number | null;
        origin: 'manual' | 'vendor_memory' | null;
        origin_key: string | null;
      }>(),
  ]);

  return canonicalDiffBaseline({
    existing: rows.results.map((row) => ({
      txId: row.tx_id,
      month: row.month,
      date: row.date,
      description: row.description,
      amount: row.amount,
      categoryMajor: row.category_major,
      categoryMid: row.category_mid,
      institution: row.institution,
      memo: row.memo,
      isTarget: row.is_target,
      isTransfer: row.is_transfer,
    })),
    edits: edits.results.map((row) => ({
      txId: row.tx_id,
      cls: row.cls,
      categoryMajor: row.category_major,
      categoryMid: row.category_mid,
      owner: row.owner,
      baseCls: row.base_cls,
      baseOwner: row.base_owner,
      baseMajor: row.base_major,
      baseMid: row.base_mid,
      baseKnown: row.base_known,
      stableKey: row.stable_key,
      fingerprintVersion: row.fingerprint_version,
      origin: row.origin,
      originKey: row.origin_key,
    })),
  });
}

/** preview/commitが共有するbaselineの最終正規化。cashはMF差分の同一性に混ぜない。 */
export function canonicalDiffBaseline(baseline: {
  existing: ExistingMfRow[];
  edits: ExistingEditRow[];
}): { existing: ExistingMfRow[]; edits: ExistingEditRow[] } {
  const existing = baseline.existing.filter((row) => !isCashTxId(row.txId));
  const ids = new Set(existing.map((row) => row.txId));
  return { existing, edits: baseline.edits.filter((edit) => ids.has(edit.txId)) };
}

/** POST /imports が既に読んだcanonical snapshotを、差分と同じ入力へ投影する。 */
export function diffBaselineFromDataset(data: Dataset): {
  existing: ExistingMfRow[];
  edits: ExistingEditRow[];
} {
  return canonicalDiffBaseline({
    existing: data.mfTx.map((tx) => {
      const [
        ,
        month,
        date,
        description,
        amount,
        categoryMajor,
        categoryMid,
        institution,
        memo,
        isTarget,
        isTransfer,
      ] = mfPersistedRow(tx);
      return {
        txId: tx.id,
        month,
        date,
        description,
        amount,
        categoryMajor: categoryMajor || null,
        categoryMid: categoryMid || null,
        institution,
        memo,
        isTarget,
        isTransfer,
      };
    }),
    edits: Object.entries(data.edits).map(([txId, edit]) => ({
      txId,
      cls: edit.cls ?? null,
      categoryMajor: edit.big ?? null,
      categoryMid: edit.mid ?? null,
      owner: edit.owner ?? null,
      baseCls: edit.baseCls ?? null,
      baseOwner: edit.baseOwner ?? null,
      baseMajor: edit.baseBig ?? null,
      baseMid: edit.baseMid ?? null,
      baseKnown: normalizeBaseKnown(edit.baseKnown, {
        cls: edit.baseCls,
        big: edit.baseBig,
        mid: edit.baseMid,
        owner: edit.baseOwner,
      }),
      stableKey: edit.stableKey ?? null,
      fingerprintVersion: edit.fingerprintVersion ?? null,
      origin: edit.origin ?? null,
      originKey: edit.originKey ?? null,
    })),
  });
}
