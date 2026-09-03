/**
 * 再取込時の3点比較(DR-10)。
 *
 * 比べるのは3つの値である。
 *   - base     … 前回の取込で入っていた値(手当てを付けた時点の取込値)
 *   - current  … いま入っている値(利用者の手当て。無ければ base と同じ)
 *   - incoming … 新しい取込原本の値
 *
 * 分岐は3つだけで、4つ目を作らない。「取込元が動いていない(base == incoming)」なら
 * 手当てを維持し、「取込元だけが動いた」なら取り込んで base を前進させ、
 * 「双方が動いた」ときだけ利用者へ問う。どちらが正しいかを機械が決めないための境界である。
 */

/** 3分岐。これ以外の結果を作らない(DR-10)。 */
export type ThreeWayOutcome =
  /** 取込元が動いていない。手当てをそのまま残す。 */
  | 'keep-current'
  /** 取込元だけが動いた。取り込み、base を incoming へ前進させる。 */
  | 'take-incoming'
  /** 双方が動いた。機械では決められないので利用者へ問う。 */
  | 'conflict';

export interface ThreeWayResult<T> {
  outcome: ThreeWayOutcome;
  /** 採用値。conflict のときは既定である current(手当ての維持, DR-11)を入れる。 */
  value: T | null;
  /** 次に保存すべき base。conflict のときは利用者の解決を待つので base を動かさない。 */
  nextBase: T | null;
  /**
   * base が未記録だったため incoming で埋めた(D03/D6 の遅延移行)。
   * 分岐ではなく副作用である。これを立てずに未記録を「変化あり」と読むと、
   * 移行前の明細が初回の再取込で一斉に take-incoming へ倒れ、手当てが消える。
   */
  baseBackfilled: boolean;
}

/** tx_edits.base_known の4属性bit。DB/codec/3点比較の共通正本。 */
export const TX_EDIT_BASE_BITS = { cls: 1, big: 2, mid: 4, owner: 8 } as const;
export const TX_EDIT_ALL_BASES_KNOWN = 15;

type BaseValues = Partial<Record<keyof typeof TX_EDIT_BASE_BITS, string | null | undefined>>;

/** 旧serialized dataはbase_knownを持たないため、非nullのbaseだけを既知と推定する。 */
export function normalizeBaseKnown(baseKnown: number | null | undefined, base: BaseValues): number {
  if (baseKnown !== undefined && baseKnown !== null) return baseKnown & TX_EDIT_ALL_BASES_KNOWN;
  return (Object.keys(TX_EDIT_BASE_BITS) as Array<keyof typeof TX_EDIT_BASE_BITS>).reduce(
    (mask, attr) => (base[attr] === null || base[attr] === undefined ? mask : mask | TX_EDIT_BASE_BITS[attr]),
    0,
  );
}

/** 未設定の表し方(null / undefined / 空文字)を1つに寄せる。保存経路ごとに違う空値が入るため。 */
const norm = <T>(value: T | null | undefined): T | null =>
  value === undefined || value === null || (value as unknown) === '' ? null : value;

/**
 * 1属性ぶんの3点比較。
 *
 * base が未記録のときは incoming を base とみなす。こうすると必ず base == incoming に
 * なるので keep-current へ落ち、手当てが保たれる。埋めた事実は baseBackfilled で返す。
 *
 * incoming の `undefined` と `null` を潰さない。`FreeeDeal.dueDate` と同じ区別で、
 * `undefined` は「その属性を取込原本が運んでいない」、`null` は「運んでいるが空欄」を表す。
 * 潰すと、取込原本に対応値の無い属性(cls / owner)が「空欄へ変更された」と読まれ、
 * 手当てのある明細が毎回いつわりの衝突になる。
 */
export function resolveThreeWay<T>(
  base: T | null | undefined,
  current: T | null | undefined,
  incoming: T | null | undefined,
  baseKnown?: boolean,
): ThreeWayResult<T> {
  const cur = norm(current);
  const rawBase = norm(base);

  // 取込原本がこの属性を運んでいない。比較する相手が無いので手当てをそのまま残す。
  if (incoming === undefined)
    return { outcome: 'keep-current', value: cur, nextBase: rawBase, baseBackfilled: false };

  const inc = norm(incoming);
  const baseBackfilled = baseKnown === undefined ? rawBase === null : !baseKnown;
  const bse = baseBackfilled ? inc : rawBase;

  // 取込元が動いていない。手当てがあってもなくても、いまの値がそのまま残る。
  if (bse === inc) return { outcome: 'keep-current', value: cur, nextBase: inc, baseBackfilled };

  // 取込元だけが動いた。手当てが無い(current が base のまま)ので取り込んで base を進める。
  if (cur === bse) return { outcome: 'take-incoming', value: inc, nextBase: inc, baseBackfilled };

  // 双方が動いた。既定は手当ての維持(DR-11)。base は解決されるまで動かさない。
  return { outcome: 'conflict', value: cur, nextBase: bse, baseBackfilled };
}

/** 3点比較にかける属性。画面の衝突表示もこの単位で並べる。 */
export const THREE_WAY_ATTRS = ['cls', 'big', 'mid', 'owner'] as const;
export type ThreeWayAttr = (typeof THREE_WAY_ATTRS)[number];

/** 属性ごとの3点比較の結果一式。 */
export type ThreeWayByAttr = Record<ThreeWayAttr, ThreeWayResult<string>>;

/** 明細1件ぶんの3点比較。値は属性をまたいで比較しないので、文字列として一律に扱う。 */
export function resolveThreeWayAttrs(
  base: Partial<Record<ThreeWayAttr, string | null>>,
  current: Partial<Record<ThreeWayAttr, string | null>>,
  /** キーを置かない属性 = 取込原本が運んでいない。空欄(null)と区別する。 */
  incoming: Partial<Record<ThreeWayAttr, string | null>>,
  /** 省略時は旧dataとして非null baseから推定。明示0は全属性未記録。 */
  baseKnown?: number | null,
): ThreeWayByAttr {
  const known = normalizeBaseKnown(baseKnown, base);
  return Object.fromEntries(
    THREE_WAY_ATTRS.map((attr) => [
      attr,
      resolveThreeWay(base[attr], current[attr], incoming[attr], (known & TX_EDIT_BASE_BITS[attr]) !== 0),
    ]),
  ) as ThreeWayByAttr;
}

/** 衝突した属性だけを並べる。画面が行として出すのはこれが空でない明細だけ(DR-11)。 */
export const conflictingAttrs = (byAttr: ThreeWayByAttr): ThreeWayAttr[] =>
  THREE_WAY_ATTRS.filter((attr) => byAttr[attr].outcome === 'conflict');
