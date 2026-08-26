import { canonicalMfTransactions, freeePersistedRow, mfPersistedRow } from './persisted-projection.js';
/**
 * 取込の内容指紋に使うversioned canonical encoding。
 * v2は各値を型+長さで符号化するため、改行・区切り文字を値に含んでもcell境界が衝突しない。
 * CSVは実際のcanonical tableへ保存する意味射影をそのまま使う。
 */
import { type FreeeDeal, type MfTx, normalizeOwner } from './types.js';

export const FINGERPRINT_VERSION = 2;

const atom = (tag: string, value: string): string => `${tag}${value.length}:${value}`;

export function canonicalEncode(value: unknown): string {
  if (value === null || value === undefined) return 'n;';
  if (typeof value === 'string') return atom('s', value);
  if (typeof value === 'number') return atom('d', Object.is(value, -0) ? '0' : String(value));
  if (typeof value === 'boolean') return value ? 'b1;' : 'b0;';
  if (Array.isArray(value)) return atom('a', value.map(canonicalEncode).join(''));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return atom(
      'o',
      entries.map(([key, child]) => `${canonicalEncode(key)}${canonicalEncode(child)}`).join(''),
    );
  }
  throw new TypeError(`canonical encoding対象外の型です: ${typeof value}`);
}

const canonicalRows = (kind: 'freee' | 'mf', rows: ReadonlyArray<readonly unknown[]>): string => {
  const encodedRows = rows.map((row) => canonicalEncode(row)).sort();
  return `v${FINGERPRINT_VERSION}:${kind}:${canonicalEncode(encodedRows)}`;
};

/** freee保存行の意味射影。accountNormも集計write-setの一部なので含める。 */
export function canonicalFreee(deals: FreeeDeal[]): string {
  return canonicalRows('freee', deals.map(freeePersistedRow));
}

/** MF保存行の意味射影。明示IDがある場合は行順に依らない。 */
export function canonicalMf(txs: MfTx[]): string {
  return canonicalRows('mf', canonicalMfTransactions(txs).map(mfPersistedRow));
}

/**
 * JSON復元snapshotの意味表現。object keyは再帰sortし、復元write-setに影響しない
 * export時刻と監査用cashEntries原本だけを除外する。array順はrules等の意味なので保持する。
 */
export function canonicalJsonSnapshot(snapshot: Record<string, unknown>): string {
  const projected: Record<string, unknown> = {};
  const copy = (key: string): void => {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) projected[key] = snapshot[key];
  };
  // importJSON/restoreCommitStatementsが読み、canonical tableまたは集計へ反映するfieldだけを採る。
  for (const key of [
    'months',
    'biz',
    'subs',
    'personal',
    'bizPersonal',
    'mfTx',
    'budgets',
    'cashOverride',
    'unrecordedExpMonths',
    'cashProjection',
  ])
    copy(key);
  if (snapshot.institutionOwners && typeof snapshot.institutionOwners === 'object') {
    projected.institutionOwners = Object.fromEntries(
      Object.entries(snapshot.institutionOwners as Record<string, unknown>).flatMap(
        ([institution, value]) => {
          const owner = normalizeOwner(value);
          return owner ? [[institution, owner]] : [];
        },
      ),
    );
  }
  if (snapshot.personalByOwner && typeof snapshot.personalByOwner === 'object') {
    projected.personalByOwner = Object.fromEntries(
      Object.entries(snapshot.personalByOwner as Record<string, Record<string, unknown>>).map(
        ([month, owners]) => [
          month,
          {
            business: owners.business ?? owners.self ?? { income: 0, expense: 0 },
            spouse: owners.spouse ?? { income: 0, expense: 0 },
            family: owners.family ?? { income: 0, expense: 0 },
            unset: owners.unset ?? { income: 0, expense: 0 },
          },
        ],
      ),
    );
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'rules') && Array.isArray(snapshot.rules)) {
    projected.rules = snapshot.rules.map((value) => {
      const rule = value as Record<string, unknown>;
      return {
        k: rule.k ?? rule.keyword ?? '',
        cls: rule.cls ?? null,
        big: rule.big ?? null,
        mid: rule.mid ?? null,
        owner: normalizeOwner(rule.owner),
      };
    });
  }
  // 新形式editsが旧overridesより優先されるimportJSONの契約をfingerprintにも合わせる。
  if (Object.prototype.hasOwnProperty.call(snapshot, 'edits')) {
    projected.edits = Object.fromEntries(
      Object.entries(snapshot.edits as Record<string, Record<string, unknown>>).map(([id, edit]) => [
        id,
        { ...edit, owner: normalizeOwner(edit.owner) },
      ]),
    );
  } else if (snapshot.overrides && typeof snapshot.overrides === 'object') {
    projected.edits = Object.fromEntries(
      Object.entries(snapshot.overrides as Record<string, unknown>).map(([id, cls]) => [id, { cls }]),
    );
  }
  return `v${FINGERPRINT_VERSION}:json:${canonicalEncode(projected)}`;
}
