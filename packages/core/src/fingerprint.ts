import {
  canonicalMfTransactions,
  freeePersistedRow,
  mfPersistedIdentityRow,
} from './persisted-projection.js';
/**
 * 取込の内容指紋に使うversioned canonical encoding。
 * v2は各値を型+長さで符号化するため、改行・区切り文字を値に含んでもcell境界が衝突しない。
 * CSVは実際のcanonical tableへ保存する意味射影をそのまま使う。
 */
import { type FreeeDeal, type MfTx, normalizeOwner } from './types.js';

/** v4: MFのmemo/isTarget/isTransferをbusiness write-setに追加。 */
export const FINGERPRINT_VERSION = 4;

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

/**
 * 再取込を跨いで明細を追う第二の鍵(DR-13)の版。
 * `FINGERPRINT_VERSION` とは別に持つ。内容指紋は「取込の中身が変わったか」を見るのに対し、
 * こちらは「同じ明細か」を見るもので、変えたい理由も変えてよい時期も違う。
 * 版が違う鍵どうしは突き合わせない。突き合わせると、別の明細の手当てが移る。
 */
export const STABLE_KEY_VERSION = 1;

/** stable_key の材料。tx_id が振り直されても変わらない値だけを採る。 */
export interface StableKeyParts {
  /** 'YYYY-MM' */
  m: string;
  /** 表示日付。`normalizeMfDisplayDate` 後の 'MM/DD' */
  d: string;
  /** 内容(CSV原本のまま) */
  c: string;
  /** 金額。正=収入 / 負=支出 */
  a: number;
  /** 保有金融機関 */
  inst?: string | null;
  /** 大項目 */
  big?: string | null;
  /** 中項目 */
  mid?: string | null;
  /** メモ */
  memo?: string | null;
}

/**
 * stable_key に載せる値。
 *
 * 採るのは「取引そのものに紐づき、再取込で動かない」値だけである。
 *   - m / d … いつの取引か。日まで入れないと、同月・同額・同店の明細が衝突する。
 *   - c     … 何の取引か。CSV原本のまま使う(切り詰めると別取引が同じ鍵になる)。
 *   - a     … いくらの取引か。符号込みで、収入と支出を別物として扱う。
 *   - inst  … どの口座の取引か。同日・同額・同店が複数口座に並ぶ場合を分ける。
 *
 * 外したものと、その理由:
 *   - big / mid … 再取込でMF側が動かす値そのもの。鍵に入れると、3点比較にかけたい
 *     まさにその場面で鍵が変わり、追跡が切れて手当ての持ち主を見失う。
 *   - memo … MF側で後から編集できる。利用者がメモを直しただけで別明細になる。
 *   - id / idStable … これは第一の鍵(tx_id)側の関心事。第二の鍵が第一に依存すると、
 *     tx_id が振り直されたときに両方いっしょに切れて、二重に持つ意味が無くなる。
 */
export function stableKeyFields(parts: StableKeyParts): readonly unknown[] {
  return [parts.m, parts.d, parts.c, parts.a, parts.inst ?? null];
}

/**
 * 明細の第二の鍵。`tx_id` が使えないときだけ使う(第一は常に `tx_id`)。
 * 正規化は `normalizeMfDisplayDate` と同じ関数を通したものを受け取る前提で、ここでは複製しない。
 */
export const stableKeyOf = (parts: StableKeyParts): string =>
  `v${STABLE_KEY_VERSION}:mf:${canonicalEncode(stableKeyFields(parts))}`;

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
  return canonicalRows('mf', canonicalMfTransactions(txs).map(mfPersistedIdentityRow));
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
