/**
 * 取込データ削除の対象特定と巻き添え計算(DR-1 / DR-6)。
 *
 * ここは純関数だけを置く。実際に消すのはAPI側だが、「何が対象か」をSQLの
 * WHERE句に散らすと、範囲外が消えていないことを試験で示せなくなる。
 * 対象集合をここで作り、API はその集合しか触らない、という形にする。
 */
import { canonicalEncode } from './fingerprint.js';

/** 帳簿本体を変えずに履歴だけを破棄できる終端状態。legacy `ok` は含めない。 */
export const IMPORT_HISTORY_DISCARDABLE_STATUSES = ['failed', 'duplicate'] as const;
export type ImportHistoryDiscardBlock =
  | 'in_progress'
  | 'legacy'
  | 'active'
  | 'has_canonical_data'
  | 'has_undo_snapshot'
  | 'unsupported_state';

/**
 * 履歴破棄のfail-closed判定。画面のgenerationStateではなく、DBから数え直した
 * active pointerとcanonical行参照を材料にする(DR-17)。
 */
export function importHistoryDiscardBlock(input: {
  status: string | null;
  activeTargetCount: number;
  canonicalRowCount: number;
  undoSnapshotCount?: number;
}): ImportHistoryDiscardBlock | null {
  if (input.status === 'processing' || input.status === 'applying') return 'in_progress';
  if (input.status === 'ok') return 'legacy';
  if (input.activeTargetCount > 0) return 'active';
  if (input.canonicalRowCount > 0) return 'has_canonical_data';
  if ((input.undoSnapshotCount ?? 0) > 0) return 'has_undo_snapshot';
  return (IMPORT_HISTORY_DISCARDABLE_STATUSES as readonly (string | null)[]).includes(input.status)
    ? null
    : 'unsupported_state';
}

/**
 * 履歴から帳簿データを取り消せるかの表示判定。
 *
 * `generationState='superseded'` でも JSON 復元後の canonical 行が残ることがあるため、
 * 状態名ではなく DB から数えた active pointer / canonical 参照を使う。
 * assets は canonical 行に import_id が無いため active ownership だけが根拠になる。
 */
export function importHistoryCancelable(input: {
  status: string | null;
  activeTargetCount: number;
  canonicalRowCount: number;
}): boolean {
  return input.status === 'committed' && (input.activeTargetCount > 0 || input.canonicalRowCount > 0);
}

/** 取込の種類。`imports.kind` と同じ語を使う。 */
export const IMPORT_KINDS = ['freee', 'mf', 'assets', 'json'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/** 削除の粒度。4つ以外を作らない。 */
export const DELETION_GRANULARITIES = ['transaction', 'import', 'period', 'all'] as const;
export type DeletionGranularity = (typeof DELETION_GRANULARITIES)[number];

/** 'YYYY-MM' の閉区間。from > to は空区間として扱わず、呼出側で弾く。 */
export interface MonthRange {
  from: string;
  to: string;
}

export interface DeletionRequest {
  granularity: DeletionGranularity;
  /** granularity='transaction' のときの対象明細 */
  txIds?: readonly string[];
  /** granularity='import' のときの対象取込 */
  importId?: number;
  /** granularity='period' のときの対象期間 */
  period?: MonthRange;
  /** granularity='period' / 'all' のときの対象種別。空・未指定は全種別。 */
  kinds?: readonly ImportKind[];
}

/** 削除の判定に要る最小限の行の姿。実テーブルの列をそのまま持ち込まない。 */
export interface MfTxRow {
  id: string;
  month: string;
  importId: number | null;
}
export interface FreeeDealRow {
  id: number;
  month: string;
  importId: number | null;
}
/** `balance_entries` は import_id を持たない。区別は source 列で行う(0026 の設計)。 */
export interface BalanceEntryRow {
  id: number;
  month: string;
  source: 'mf' | 'manual';
}

/** 巻き添えの判定に要る手動記録。件数を数えるだけで、消さない。 */
export interface ManualRecords {
  /** 明細への手当て。tx_id で明細を参照する。 */
  txEdits: readonly { txId: string }[];
  /** 分割記帳。 */
  txSplits: readonly { txId: string }[];
  /** 現金記録。取込由来でないので対象集合に入れない(DR-6)。 */
  cashEntries: readonly { month: string }[];
  /** 添付。 */
  attachments: readonly { txId: string | null; month: string | null }[];
}

export interface DeletionScopeInput {
  request: DeletionRequest;
  mfTx: readonly MfTxRow[];
  freeeDeals: readonly FreeeDealRow[];
  balanceEntries: readonly BalanceEntryRow[];
  /** 取込ID→種別。period / all で種別を絞るときに使う。 */
  importKinds: Readonly<Record<number, ImportKind>>;
  /** 現在の target_key を所有する取込。履歴ではなく active pointer だけを渡す。 */
  activeTargets: readonly { targetKey: string; importId: number }[];
}

export interface DeletionTargets {
  mfTxIds: string[];
  freeeDealIds: number[];
  balanceEntryIds: number[];
  /**
   * 削除行と同じ範囲に属する現行取込指紋。
   * 月から全種別を推測せず、active target の実在と所有取込から決める。
   */
  affectedTargetKeys: string[];
  /** 集計を作り直す対象月(DR-5)。対象行が1件でもある月を全部挙げる。 */
  months: string[];
}

/**
 * 巻き添えになる手動記録の件数。消さないが、消えたように見える件数として利用者へ示す。
 * 消えないのに数える理由は、参照先の明細が消えるとこれらが宙に浮くためで、
 * 「消えるもの」ではなく「行き先を失うもの」として確認画面に出す。
 */
export interface CollateralCounts {
  txEdits: number;
  txSplits: number;
  attachments: number;
  /** 常に0。現金記録は対象集合に入らない(DR-6)。0 であることを見せるために持つ。 */
  cashEntries: number;
}

const inRange = (month: string, range: MonthRange): boolean => month >= range.from && month <= range.to;

const kindOf = (importId: number | null, kinds: Readonly<Record<number, ImportKind>>): ImportKind | null =>
  importId === null ? null : (kinds[importId] ?? null);

/** 種別の絞り込み。未指定・空配列は「全種別」を意味する。 */
const kindAllowed = (kind: ImportKind | null, requested: readonly ImportKind[] | undefined): boolean => {
  if (!requested || requested.length === 0) return true;
  return kind !== null && requested.includes(kind);
};

interface CanonicalTarget {
  kind: Exclude<ImportKind, 'json'>;
  month: string;
}

/** `mf:YYYY-MM` / `freee:YYYY-MM` / `assets:YYYY-MM` 以外は月次削除の指紋にしない。 */
const canonicalTarget = (targetKey: string): CanonicalTarget | null => {
  const match = /^(mf|freee|assets):(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(targetKey);
  if (!match) return null;
  return { kind: match[1] as CanonicalTarget['kind'], month: match[2] };
};

/** 行の対象と同じ根拠で、無効化する active target も一度だけ決める。 */
const affectedTargetKeys = (
  req: DeletionRequest,
  activeTargets: DeletionScopeInput['activeTargets'],
  selectedMfMonths: ReadonlySet<string>,
): string[] =>
  activeTargets
    .filter((target) => {
      const parsed = canonicalTarget(target.targetKey);
      if (!parsed) return false;
      switch (req.granularity) {
        case 'transaction':
          return parsed.kind === 'mf' && selectedMfMonths.has(parsed.month);
        case 'import':
          return req.importId !== undefined && target.importId === req.importId;
        case 'period':
          return !!req.period && inRange(parsed.month, req.period) && kindAllowed(parsed.kind, req.kinds);
        case 'all':
          return kindAllowed(parsed.kind, req.kinds);
      }
    })
    .map((target) => target.targetKey)
    .sort();

/**
 * 削除の対象集合を決める。
 *
 * 指定範囲の外は1件も入れない。範囲の解釈をここ1箇所に閉じ、
 * API 側が別の解釈を持てないようにする(DR-1: 範囲はサーバで再解釈する)。
 */
export function deletionScope(input: DeletionScopeInput): DeletionTargets {
  const { request: req, mfTx, freeeDeals, balanceEntries, importKinds, activeTargets } = input;

  const wantedTxIds = new Set(req.txIds ?? []);
  const matchesMf = (row: MfTxRow): boolean => {
    switch (req.granularity) {
      case 'transaction':
        return wantedTxIds.has(row.id);
      case 'import':
        return row.importId !== null && row.importId === req.importId;
      case 'period':
        return (
          !!req.period &&
          inRange(row.month, req.period) &&
          kindAllowed(kindOf(row.importId, importKinds), req.kinds)
        );
      case 'all':
        return kindAllowed(kindOf(row.importId, importKinds), req.kinds);
    }
  };
  const matchesFreee = (row: FreeeDealRow): boolean => {
    switch (req.granularity) {
      // freee 仕訳は明細単位の削除対象にしない。明細粒度の入口はMF明細だけが持つ。
      case 'transaction':
        return false;
      case 'import':
        return row.importId !== null && row.importId === req.importId;
      case 'period':
        return (
          !!req.period &&
          inRange(row.month, req.period) &&
          kindAllowed(kindOf(row.importId, importKinds), req.kinds)
        );
      case 'all':
        return kindAllowed(kindOf(row.importId, importKinds), req.kinds);
    }
  };
  const matchesBalance = (row: BalanceEntryRow): boolean => {
    // 手入力の負債を取込の削除で消さない(0026 が source 列を置いた理由そのもの)。
    if (row.source !== 'mf') return false;
    switch (req.granularity) {
      case 'transaction':
        return false;
      // balance_entries は import_id を持たないため、取込単位の削除では
      // その取込が触った月を経由してしか特定できない。呼出側が月を渡す。
      case 'import':
        return false;
      case 'period':
        return !!req.period && inRange(row.month, req.period) && kindAllowed('assets', req.kinds);
      case 'all':
        return kindAllowed('assets', req.kinds);
    }
  };

  const mfTxIds = mfTx.filter(matchesMf).map((r) => r.id);
  const freeeDealIds = freeeDeals.filter(matchesFreee).map((r) => r.id);

  const selectedMfMonths = new Set(mfTx.filter(matchesMf).map((row) => row.month));
  const targetKeys = affectedTargetKeys(req, activeTargets, selectedMfMonths);
  const assetTargetMonths = new Set(
    targetKeys
      .map(canonicalTarget)
      .filter((target): target is CanonicalTarget => target?.kind === 'assets')
      .map((target) => target.month),
  );

  // balance_entries は import_id を持たない。取込単位では、
  // その取込が「現在」所有する assets target の月だけを使う。
  // imports.target_keys の履歴だけで決めると、後続取込の現行行を消しうる。
  const balanceEntryIds = balanceEntries
    .filter((row) =>
      req.granularity === 'import'
        ? row.source === 'mf' && assetTargetMonths.has(row.month)
        : matchesBalance(row),
    )
    .map((r) => r.id);

  const months = new Set<string>();
  for (const r of mfTx) if (matchesMf(r)) months.add(r.month);
  for (const r of freeeDeals) if (matchesFreee(r)) months.add(r.month);
  for (const r of balanceEntries) if (balanceEntryIds.includes(r.id)) months.add(r.month);
  for (const targetKey of targetKeys) {
    const target = canonicalTarget(targetKey);
    if (target) months.add(target.month);
  }

  return {
    mfTxIds: [...mfTxIds].sort(),
    freeeDealIds: [...freeeDealIds].sort((a, b) => a - b),
    balanceEntryIds: [...balanceEntryIds].sort((a, b) => a - b),
    affectedTargetKeys: targetKeys,
    months: [...months].sort(),
  };
}

/** 対象集合を参照している手動記録を数える。数えるだけで、対象集合には足さない。 */
export function collateralCounts(targets: DeletionTargets, manual: ManualRecords): CollateralCounts {
  const txIds = new Set(targets.mfTxIds);
  const months = new Set(targets.months);
  return {
    txEdits: manual.txEdits.filter((r) => txIds.has(r.txId)).length,
    txSplits: manual.txSplits.filter((r) => txIds.has(r.txId)).length,
    attachments: manual.attachments.filter(
      (r) => (r.txId !== null && txIds.has(r.txId)) || (r.month !== null && months.has(r.month)),
    ).length,
    cashEntries: 0,
  };
}

/**
 * 確認指紋。preflight で示した対象と、実行時の対象が同じであることを示す(DR-1)。
 *
 * 同じ範囲からは何度でも同じ値が出る。件数ではなく対象そのものから作るので、
 * 「件数は同じだが中身が入れ替わった」場合も検出できる。
 */
export function deletionFingerprint(targets: DeletionTargets, manual: ManualRecords): string {
  const txIds = new Set(targets.mfTxIds);
  const months = new Set(targets.months);
  return `v1:del:${canonicalEncode({
    mfTxIds: [...targets.mfTxIds].sort(),
    freeeDealIds: [...targets.freeeDealIds].sort((a, b) => a - b),
    balanceEntryIds: [...targets.balanceEntryIds].sort((a, b) => a - b),
    affectedTargetKeys: [...targets.affectedTargetKeys].sort(),
    months: [...targets.months].sort(),
    // preflight で見せた付随データも確認の一部。件数だけでは、
    // 同数の別レコードへ入れ替わった変化を検出できないため参照先を入れる。
    collateral: {
      txEdits: manual.txEdits
        .filter((row) => txIds.has(row.txId))
        .map((row) => row.txId)
        .sort(),
      txSplits: manual.txSplits
        .filter((row) => txIds.has(row.txId))
        .map((row) => row.txId)
        .sort(),
      attachments: manual.attachments
        .filter(
          (row) =>
            (row.txId !== null && txIds.has(row.txId)) || (row.month !== null && months.has(row.month)),
        )
        .map((row) => [row.txId, row.month])
        .sort((a, b) => canonicalEncode(a).localeCompare(canonicalEncode(b))),
    },
  })}`;
}

/** 対象・巻き添え・指紋をまとめた preflight の結果。API がそのまま返せる形。 */
export interface DeletionPreflight {
  targets: DeletionTargets;
  counts: { mfTx: number; freeeDeals: number; balanceEntries: number; months: number };
  collateral: CollateralCounts;
  fingerprint: string;
}

export function deletionPreflight(input: DeletionScopeInput, manual: ManualRecords): DeletionPreflight {
  const targets = deletionScope(input);
  return {
    targets,
    counts: {
      mfTx: targets.mfTxIds.length,
      freeeDeals: targets.freeeDealIds.length,
      balanceEntries: targets.balanceEntryIds.length,
      months: targets.months.length,
    },
    collateral: collateralCounts(targets, manual),
    fingerprint: deletionFingerprint(targets, manual),
  };
}
