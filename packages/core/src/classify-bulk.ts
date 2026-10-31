/**
 * 一括保存の値の解決 (spec-classify-bulk-save FR-02〜FR-08・BR-01〜BR-03)。
 *
 * 画面の「保存前の内訳」と api の一括保存は、この 1 つの関数から同じ答えを出す。
 * 片側だけで値を決めると、内訳で「保存されます」と言った明細がサーバで外れる。
 *
 * 1 欄ずつ 一括指定 → 下書き → 土台 の順で決める。土台は明細の状態で変わる:
 * - 未整理: 提案。そのまま保存すれば完了になる道筋 (7.6) と同じ。
 *   提案が無ければ区分と名義は今の値 (明細の区分) を残すが、カテゴリの組は今の値から取らない (BR-01)。
 *   未整理の今の値の組は取込値 (MF の大・中) で、人の判断も区分の候補の検査も経ていない
 * - 確定済み (完了・手動変更): 今の値。提案で手の値を巻き戻さない
 */
import { type Candidates, categoryAllowed, categoryAllowedOrKept } from './categories.js';
import type { ClassifyStatus, SuggestionValue } from './classify-status.js';
import { NO_CATEGORY } from './no-category.js';
import type { Cls, Owner, PaymentMethodOverride, SplitProjection } from './types.js';

/** 行 key の長さの上限。URL の選択 (sel) とサーバの検査が同じ値を使う */
export const ROW_KEY_MAX_LENGTH = 200;

/** 選択の上限 (URL の sel・選択の読み出しの keys・見出しの全選択の停止)。BR-11・FR-09 */
export const SELECTION_MAX = 50;

/** 一覧の表示件数の選択肢と既定 (FR-12)。一覧の limit と画面の『表示件数』が同じ値を使う */
export const CLASSIFY_PAGE_SIZES = [25, 50, 100] as const;
export type ClassifyPageSize = (typeof CLASSIFY_PAGE_SIZES)[number];
export const CLASSIFY_DEFAULT_PAGE_SIZE: ClassifyPageSize = 50;
export const isClassifyPageSize = (value: unknown): value is ClassifyPageSize =>
  CLASSIFY_PAGE_SIZES.some((size) => size === value);

export type RowKind = 'mf' | 'cash' | 'split';
const ROW_KINDS: readonly string[] = ['mf', 'cash', 'split'] satisfies readonly RowKind[];

/** 分割の設定が崩れた親の状態。正常な分割の親は射影に現れない */
export type SplitParentState = Extract<SplitProjection, { kind: 'split-parent' }>['state'];

/** 一括指定。値のある欄だけが全明細を上書きする (FR-02) */
export interface BulkSpec {
  cls?: Cls;
  big?: string;
  mid?: string;
  owner?: Owner;
  paymentMethod?: PaymentMethodOverride;
}

/**
 * 明細ごとの下書き。画面の編集状態そのもの (支払方法とメモは省略できる)。
 * 大と中を両方とも省いた下書き (旧形式の item) は組を持たない。組は区分だけの一括指定と同じ規則で決める
 */
export interface BulkDraft {
  cls: Cls | null;
  big?: string | null;
  mid?: string | null;
  owner: Owner | null;
  paymentMethod?: PaymentMethodOverride | null;
  note?: string | null;
}

export interface BulkSaveCurrent {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  note: string | null;
}

export interface BulkSaveInput {
  bulk: BulkSpec | null;
  draft: BulkDraft | null;
  suggestion: SuggestionValue | null;
  /** 今の値 (上書き後)。確定済みの土台で、送る欄を決める比較の相手でもある */
  current: BulkSaveCurrent;
  status: ClassifyStatus;
  /** 保存済みの支払方法 (上書き) */
  paymentMethod: PaymentMethodOverride | null;
  candidates: Candidates;
}

export interface BulkSaveItem {
  cls: Cls | null;
  big: string;
  mid: string;
  owner: Owner | null;
  paymentMethod: PaymentMethodOverride | null;
  note: string | null;
}

/** 欄ごとの値の出どころ。内訳の「どこから来た値か」に出す */
export type BulkSaveSource = 'bulk' | 'draft' | 'suggestion' | 'current' | 'no_category';
export type BulkSaveFailCode = 'no_value' | 'no_change' | 'category_mismatch';

export type BulkSaveResolution =
  | {
      ok: true;
      item: BulkSaveItem;
      sources: Record<keyof BulkSaveItem, BulkSaveSource>;
      /** サーバへ送る欄。確定済みは変わった欄だけ (送らない欄は今の上書きを保つ) */
      patch: Partial<BulkSaveItem>;
    }
  | { ok: false; code: BulkSaveFailCode; reason: string };

const FAIL_REASON = {
  no_value: '埋める値がありません',
  no_change: '変わる値がありません',
  bulk_mismatch: '指定したカテゴリ (大) が明細の区分に合いません',
  draft_mismatch: '下書きのカテゴリが区分に合いません',
} as const;

/**
 * 提案があるか。値の入っていない提案は提案として扱わない (web の初期値と同じ言い方)。
 * ここで別の言い方をすると、内訳で「提案から埋めます」と出た明細が保存で no_value になる。
 */
export const hasSuggestionValue = (s: SuggestionValue | null | undefined): s is SuggestionValue =>
  s != null && !!(s.cls || s.big || s.mid || s.owner);

/** 区分・大・中・名義の 1 組と、その出どころ */
interface Layer {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  source: BulkSaveSource;
}

const text = (v: string | null | undefined): string => (v ?? '').trim();
/** 空文字と null を同じ「未設定」として比べる */
const sameValue = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a || null) === (b || null);

const fail = (code: BulkSaveFailCode, reason: string): BulkSaveResolution => ({ ok: false, code, reason });

export function resolveBulkSaveItem(input: BulkSaveInput): BulkSaveResolution {
  const { bulk, draft, current, candidates } = input;
  const settled = input.status !== 'unsorted';
  const suggestion = !settled && hasSuggestionValue(input.suggestion) ? input.suggestion : null;
  const base: Layer = suggestion
    ? { ...suggestion, source: 'suggestion' }
    : { ...current, source: 'current' };
  // 組 (大・中) の土台。未整理の明細は今の値を埋める値にしない (BR-01: 未整理は 一括指定→下書き→提案)。
  // 未整理の今の値の組は取込値 (MF の大・中) で、人の判断も区分の候補の検査も経ていない。
  // 提案の組は大を持つときだけ土台にする。未整理の明細に付く大の無い提案は、まだ自動で当てない取引先の記憶が
  // 区分・名義・中項目だけを持つときに生まれる (classify-status の candidatesFor)。空の組を土台にすると、
  // 空の大項目 (= 取込値へ戻す指定) を保存してしまう (用語集『カテゴリなし』・BR-02)
  const suggestionPair = suggestion && text(suggestion.big) ? base : null;
  const pairBase: Layer | null = settled ? base : suggestionPair;
  const draftLayer: Layer | null = draft
    ? { cls: draft.cls, big: draft.big ?? null, mid: draft.mid ?? null, owner: draft.owner, source: 'draft' }
    : null;
  // 組を省いた下書きは大・中の出どころにしない。省いた欄を空として送ると、今の科目を取込値へ戻してしまう
  const draftPair = draft && (draft.big !== undefined || draft.mid !== undefined) ? draftLayer : null;

  // 支払方法と中項目だけの一括指定は、分類の値を埋めない (中だけの指定はサーバが 400 にする)
  const bulkClassifies = !!bulk && (bulk.cls != null || !!text(bulk.big) || bulk.owner != null);
  if (!settled && !draftLayer && !suggestion && !bulkClassifies)
    return fail('no_value', FAIL_REASON.no_value);

  // 区分と名義は欄ごとに、値を持つ最初の層から取る (一括指定 → 下書き → 土台 → 今の値)。
  // 提案は区分や名義を欠くことがある。欠けた欄を空のまま保存すると、区分は明細を未整理に残し、
  // 名義は人が付けた値を消す。欠けた欄は今の値 (= 明細の区分と名義) を残す
  const currentLayer: Layer = { ...current, source: 'current' };
  const layerOf = <K extends 'cls' | 'owner'>(key: K): [Layer[K], BulkSaveSource] => {
    const fromBulk = bulk?.[key] as Layer[K] | undefined;
    if (fromBulk != null) return [fromBulk, 'bulk'];
    const layer = [draftLayer, base].find((l) => l?.[key] != null) ?? currentLayer;
    return [layer[key], layer.source];
  };
  const [cls, clsSource] = layerOf('cls');

  // 大と中は 1 組で決める。欄ごとに出どころを混ぜると、どの候補にも無い組ができる
  let pair: { big: string; mid: string; source: BulkSaveSource };
  const bulkBig = text(bulk?.big);
  if (bulkBig) {
    pair = { big: bulkBig, mid: text(bulk?.mid), source: 'bulk' };
  } else if (bulk?.cls != null || (draftLayer && !draftPair)) {
    // 区分だけの指定: 同じ区分の組を下書き → 組の土台の順に探し、無ければ『カテゴリなし』(AC-03)。
    // 組を省いた下書きも、解決した区分を同じ規則に通す (区分を変えた旧形式の item が別の区分の組を持ち込まない)
    const same = [draftPair, pairBase].find((l): l is Layer => l != null && l.cls === cls);
    pair = same
      ? { big: text(same.big), mid: text(same.mid), source: same.source }
      : { big: NO_CATEGORY, mid: '', source: 'no_category' };
  } else {
    // 組の土台が無いのは、提案も下書きも無い未整理に名義だけを一括指定したとき。組は埋める値のどこにも無い
    const from = draftPair ?? pairBase;
    pair = from
      ? { big: text(from.big), mid: text(from.mid), source: from.source }
      : { big: NO_CATEGORY, mid: '', source: 'no_category' };
  }

  // 人が入れた組 (一括指定・下書き) だけを検査する。提案と確定済みの今の値はサーバが作った値か人が決めた値なので信頼する
  const checkCls = cls ?? current.cls;
  if ((pair.source === 'bulk' || pair.source === 'draft') && checkCls != null) {
    // 下書きは今の値を送り返すことがある。今の値が『カテゴリなし』なら、その送り返しだけ通す (BR-04)
    const allowed =
      pair.source === 'draft'
        ? categoryAllowedOrKept(candidates, checkCls, pair.big, pair.mid, current.big)
        : categoryAllowed(candidates, checkCls, pair.big, pair.mid);
    if (!allowed) {
      return fail(
        'category_mismatch',
        pair.source === 'bulk' ? FAIL_REASON.bulk_mismatch : FAIL_REASON.draft_mismatch,
      );
    }
  }

  const [owner, ownerSource] = layerOf('owner');

  const [paymentMethod, paymentSource]: [PaymentMethodOverride | null, BulkSaveSource] =
    bulk?.paymentMethod != null
      ? [bulk.paymentMethod, 'bulk']
      : draft && draft.paymentMethod !== undefined
        ? [draft.paymentMethod, 'draft']
        : [input.paymentMethod, 'current'];

  const [note, noteSource]: [string | null, BulkSaveSource] =
    draft && draft.note !== undefined ? [draft.note || null, 'draft'] : [current.note || null, 'current'];

  const item: BulkSaveItem = { cls, big: pair.big, mid: pair.mid, owner, paymentMethod, note };
  const sources: Record<keyof BulkSaveItem, BulkSaveSource> = {
    cls: clsSource,
    big: pair.source,
    mid: pair.source,
    owner: ownerSource,
    paymentMethod: paymentSource,
    note: noteSource,
  };

  // 未整理は分類の 4 欄を必ず送る (保存で状態が確定する)。確定済みは変わった欄だけ
  const patch: Partial<BulkSaveItem> = {};
  if (!settled || !sameValue(item.cls, current.cls)) patch.cls = item.cls;
  if (!settled || !sameValue(item.big, current.big) || !sameValue(item.mid, current.mid)) {
    patch.big = item.big;
    patch.mid = item.mid;
  }
  if (!settled || !sameValue(item.owner, current.owner)) patch.owner = item.owner;
  if (!sameValue(item.paymentMethod, input.paymentMethod)) patch.paymentMethod = item.paymentMethod;
  if (!sameValue(item.note, current.note)) patch.note = item.note;
  if (settled && Object.keys(patch).length === 0) return fail('no_change', FAIL_REASON.no_change);

  return { ok: true, item, sources, patch };
}

/**
 * 行 key (`mf:<id>` / `cash:<id>` / `split:<lineId>`) を分ける (FR-06)。
 * 最初のコロンで切る。内訳の lineId はコロンを含みうる。
 */
export function parseRowKey(key: unknown): { kind: RowKind; id: string } | null {
  if (typeof key !== 'string' || key.length > ROW_KEY_MAX_LENGTH) return null;
  const at = key.indexOf(':');
  if (at < 0) return null;
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (!id || !ROW_KINDS.includes(kind)) return null;
  return { kind: kind as RowKind, id };
}

/** サーバの split_line_read_only と同じ文。画面の理由とサーバの拒否を同じ言葉にする */
export const SPLIT_LINE_READ_ONLY_MESSAGE = '分割後の内訳は「内訳を編集」からまとめて変更してください';
export const SPLIT_STATE_BLOCKED_MESSAGE = '分割の設定を直してから保存してください';

/** 一括保存で選べない行なら、その理由 (1 行)。選べるなら null (FR-08・AC-19) */
export function rowSelectability(row: { rowKind: RowKind; splitState: SplitParentState | null }):
  | string
  | null {
  if (row.rowKind === 'split') return SPLIT_LINE_READ_ONLY_MESSAGE;
  if (row.splitState != null) return SPLIT_STATE_BLOCKED_MESSAGE;
  return null;
}
