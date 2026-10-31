/**
 * 明細仕分け画面の表示整形 (spec-classify-screen 7 節)。
 *
 * ここに置くのは「値 → 文言」の純関数だけで、問い合わせも DOM も持たない。
 * 通知文・件数文言・分割合計の文言をコンポーネントの中に散らすと、
 * 同じ意味の文が 2 通りに増えて、どちらが仕様どおりか分からなくなる。
 */
import {
  type BulkDraft,
  type BulkSaveSource,
  type BulkSpec,
  CLASSIFY_DEFAULT_PAGE_SIZE,
  type Candidates,
  type ClassifyPageSize,
  type PaymentMethodOverride,
  SELECTION_MAX,
  confidenceTierText,
  hasSuggestionValue,
  isClassifyPageSize,
  matchesSuggestion,
  resolveBulkSaveItem,
  rowSelectability,
} from '@kanjo/core';
import {
  ApiError,
  type BulkSaveBody,
  type ClassifyRow,
  type ClassifyStatus,
  type Cls,
  type Owner,
} from '../../api.js';

/** 件数の文言。3 桁区切り (例: 1,024件) */
export const countText = (n: number): string => `${n.toLocaleString('ja-JP')}件`;

/**
 * 金額の文言。画像どおり支出も正の数で出し、単位は「円」。
 * 共通の `yen` は ¥ 記号と符号を付けるので、この画面では使わない。
 */
export const amountText = (v: number): string => `${Math.abs(Math.round(v)).toLocaleString('ja-JP')}円`;

/** 信頼度。『段階＋%』(高 80 以上・中 50〜79・低 49 以下。境界は core の confidenceTier だけが持つ)。null は「—」(0% と区別する) */
export const confidenceText = (v: number | null): string => confidenceTierText(v);

/** 日付。YYYY/MM/DD */
export const dateText = (iso: string): string => iso.slice(0, 10).replace(/-/g, '/');

/** 期間の見出し (例: 2025年9月 - 2026年8月)。月が無ければ空文字 */
export function periodRangeLabel(from: string | null, to: string | null): string {
  if (!from || !to) return '';
  const label = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;
  return `${label(from)} - ${label(to)}`;
}

/* -------- 一覧の行 (7.5) -------- */

/** 内容。分割の内訳行は、元の内容の後ろに「(分割 n/m)」を添える */
export function descriptionText(
  row: Pick<ClassifyRow, 'description' | 'splitSeq' | 'splitLineCount'>,
): string {
  if (row.splitSeq == null || row.splitLineCount == null) return row.description;
  return `${row.description}（分割 ${row.splitSeq}/${row.splitLineCount}）`;
}

/**
 * 提案カテゴリの欄。確定済みの行は確定値を出す。
 * 「提案なし」に倒すのは、提案も確定値も無いときだけ。
 */
export function suggestionText(row: ClassifyRow): string {
  if (row.status !== 'unsorted') {
    const fixed = [row.big || null, row.mid || null].filter((x): x is string => !!x).join(' / ');
    if (fixed) return fixed;
  }
  return row.suggestionLabel || '提案なし';
}

/* -------- 通知 (7.7) -------- */

/**
 * 一括保存の結果。全件成功・部分失敗・全件失敗の 3 通りを 1 か所で決める。
 * 全件失敗は部分失敗の K=N の場合だが、文言も色も変わるので分けて返す。
 */
export function bulkResultMessage(n: number, m: number, k: number): { tone: 'ok' | 'ng'; text: string } {
  if (k === 0) return { tone: 'ok', text: `選択した${n}件を保存しました。` };
  if (m === 0) return { tone: 'ng', text: `選択した${n}件を保存できませんでした。` };
  return {
    tone: 'ok',
    text: `選択した${n}件のうち${m}件を保存しました。${k}件はエラーのため保存できませんでした。`,
  };
}

export const deleteMessage = (n: number): string => `${n}件の明細を削除しました。`;
export const undoMessage = (): string => '削除を元に戻しました。';

/* -------- 編集パネル (7.6) -------- */

export interface EditInput {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
  paymentMethod: 'cash' | 'card' | 'account' | null;
  note: string | null;
}

const NO_CANDIDATES: Candidates = { biz: [], per: [] };

/** 今の値。api の一括保存が core へ渡す形と同じにする (空の大・中も空のまま渡す) */
const currentOf = (row: ClassifyRow) => ({
  cls: row.cls,
  big: row.big,
  mid: row.mid,
  owner: row.owner,
  note: row.note,
});

/**
 * 編集入力の初期値 (7.6)。
 *
 * 未整理で提案がある明細は提案を初期値に置く。この画面の既定の道筋は
 * 「提案どおりに確定する」なので、そのまま保存を押せば完了になる状態から始める。
 * 確定済み・提案なしの明細は保存値をそのまま出す。
 *
 * 決め方は一括保存と同じ core の resolveBulkSaveItem に任せる。ここで書き直すと、
 * 編集パネルの初期値と一括保存の内訳が別の規則で動き、同じ明細に別の値を出す。
 */
export function initialInput(row: ClassifyRow): EditInput {
  const paymentMethod = row.edit?.paymentMethod ?? null;
  const resolved = resolveBulkSaveItem({
    bulk: null,
    draft: null,
    suggestion: row.suggestion,
    current: currentOf(row),
    status: row.status,
    paymentMethod,
    candidates: NO_CANDIDATES,
  });
  // 埋める値が無い (未整理・提案なし) か変わる値が無い (確定済み) ときは、今の値から始める
  const v = resolved.ok ? resolved.item : { ...currentOf(row), paymentMethod };
  // 組の無い明細に保存が入れる『カテゴリなし』は編集パネルでは選べない値なので、未選択から始める
  const noCategory = resolved.ok && resolved.sources.big === 'no_category';
  return {
    cls: v.cls ?? null,
    big: noCategory ? null : v.big || null,
    mid: noCategory ? null : v.mid || null,
    owner: v.owner ?? null,
    paymentMethod: v.paymentMethod ?? null,
    note: v.note ?? null,
  };
}

export const sameInput = (a: EditInput, b: EditInput): boolean =>
  a.cls === b.cls &&
  (a.big || null) === (b.big || null) &&
  (a.mid || null) === (b.mid || null) &&
  a.owner === b.owner &&
  a.paymentMethod === b.paymentMethod &&
  (a.note || null) === (b.note || null);

/**
 * 保存したときにどの分類ステータスになるか (BR-01・7.13)。
 * 区分・カテゴリ・所有者が提案と全て一致したときだけ完了。
 * 提案が無ければ、何を入れても手動変更になる。
 *
 * 一致の判定は core の matchesSuggestion をそのまま使う。ここで書き直すと、
 * 保存前の予告 (7.13) と保存後に api が付ける matchedProposal が別の規則で動き、
 * 「完了になります」と言われた保存が手動変更になる。
 */
export function outcomeOf(row: ClassifyRow, input: EditInput): ClassifyStatus {
  if (!hasSuggestionValue(row.suggestion)) return 'manual';
  return matchesSuggestion(row.suggestion, input) ? 'done' : 'manual';
}

export const outcomeText = (status: ClassifyStatus): string =>
  status === 'done' ? 'この内容で保存すると完了になります。' : 'この内容で保存すると手動変更になります。';

/** 保存ボタンを押せる条件 (7.6)。未整理は提案どおりの確定も押せる */
export const canSave = (row: ClassifyRow, input: EditInput): boolean =>
  !sameInput(initialInput(row), input) || row.status === 'unsorted';

/** 履歴の 1 行。{日時} {由来} → {変更後}（信頼度 段階 n%） */
export function historyText(h: {
  changedAt: string;
  sourceLabel: string;
  after: string | null;
  confidence: number | null;
}): string {
  const when = `${dateText(h.changedAt)} ${h.changedAt.slice(11, 16)}`;
  const tail = h.confidence == null ? '' : `（信頼度 ${confidenceTierText(h.confidence)}）`;
  return `${when} ${h.sourceLabel} → ${h.after ?? '(なし)'}${tail}`;
}

/* -------- 分割明細の編集 (7.9) -------- */

/** 合計の一致表示。一致・不一致の両方をここで決め、ボタンの活性もこの結果から出す */
export function splitSumMessage(amounts: readonly number[], total: number): { ok: boolean; text: string } {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum === total) {
    return {
      ok: true,
      text: `金額の合計が元の取引金額と一致しています。(${amounts.map(amountText).join(' + ')} = ${amountText(total)})`,
    };
  }
  return {
    ok: false,
    text: `金額の合計が元の取引金額と一致していません。(合計 ${amountText(sum)} ／ 元の金額 ${amountText(total)} ／ 差額 ${amountText(sum - total)})`,
  };
}

/* -------- ルール適用プレビュー (7.10) -------- */

export const previewBadgeText = (n: number): string => `今後 ${n.toLocaleString('ja-JP')} 件に適用`;
export const previewOmittedText = (n: number): string => `ほか ${n.toLocaleString('ja-JP')} 件`;

/** 適用後の仕訳。分割しない場合は 1 つ、分割する場合は「カテゴリ 金額円」を / でつなぐ */
export const previewAfterText = (after: readonly { label: string; amount: number }[]): string =>
  after.length === 1 ? after[0].label : after.map((a) => `${a.label} ${amountText(a.amount)}`).join(' / ');

export const previewNoticeText = (n: number, hasTemplate: boolean): string =>
  hasTemplate
    ? `上記の ${n} 件の取引に対して、同じ分割内容を自動で適用できます。`
    : `上記の ${n} 件の取引に対して、同じ仕分けを自動で適用できます。`;

/* -------- 下書き (7.11) -------- */

/** 下書きの保存時刻。端末の現地時刻で HH:MM */
export function draftSavedText(at: number): string {
  const d = new Date(at);
  return `下書きを自動保存しました ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* -------- 絞り込みの語彙 (7.4) -------- */

/** 一覧の絞り込みで使うステータス。API 契約の status と同じ語彙 (review を含む) */
export type FilterStatus = ClassifyStatus | 'review';

export interface ClassifyFilters {
  /** 分類ステータス。空にはしない (最後の 1 つは外せない) */
  status: FilterStatus[];
  category: string;
  owner: string;
  method: '' | 'cash' | 'card' | 'account' | 'unknown';
  manual: boolean;
  q: string;
  sort: 'date_desc' | 'date_asc';
  page: number;
  /** 表示件数 (FR-12)。25・50・100 のどれか */
  limit: ClassifyPageSize;
}

/** 既定は未整理だけ。画面を開いた人が最初に片付ける対象がここに出る */
export const DEFAULT_FILTERS: ClassifyFilters = {
  status: ['unsorted'],
  category: '',
  owner: '',
  method: '',
  manual: false,
  q: '',
  sort: 'date_desc',
  page: 1,
  limit: CLASSIFY_DEFAULT_PAGE_SIZE,
};

export const FILTER_STATUS_LABEL: Record<FilterStatus, string> = {
  unsorted: '未整理',
  review: '要確認',
  manual: '手動変更',
  done: '完了',
};

const STATUS_VALUES = Object.keys(FILTER_STATUS_LABEL) as FilterStatus[];

/**
 * URL から絞り込みを読む。壊れた値は既定へ倒す。
 * 期間は URL に持たない (画面共通の期間切替が持つ) ので、ここにも現れない。
 */
export function parseFilters(sp: URLSearchParams): ClassifyFilters {
  const raw = (sp.get('status') ?? '').split(',').filter(Boolean);
  const status = raw.filter((v): v is FilterStatus => (STATUS_VALUES as string[]).includes(v));
  const method = sp.get('method') ?? '';
  const page = Number.parseInt(sp.get('page') ?? '1', 10);
  const limit = Number(sp.get('limit'));
  return {
    status: status.length ? status : DEFAULT_FILTERS.status,
    category: sp.get('category') ?? '',
    owner: sp.get('owner') ?? '',
    method: (['cash', 'card', 'account', 'unknown'] as const).includes(method as 'cash')
      ? (method as ClassifyFilters['method'])
      : '',
    manual: sp.get('manual') === '1',
    q: sp.get('q') ?? '',
    sort: sp.get('sort') === 'date_asc' ? 'date_asc' : 'date_desc',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    // 選択肢に無い値 (30 など) は既定へ直す。任意の件数を受けると、ページ数の計算が URL ごとに変わる
    limit: isClassifyPageSize(limit) ? limit : CLASSIFY_DEFAULT_PAGE_SIZE,
  };
}

/** 既定と同じ値は URL に書かない。共有した URL が読める長さに収まる */
export function filtersToParams(f: ClassifyFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.status.join(',') !== DEFAULT_FILTERS.status.join(',')) out.status = f.status.join(',');
  if (f.category) out.category = f.category;
  if (f.owner) out.owner = f.owner;
  if (f.method) out.method = f.method;
  if (f.manual) out.manual = '1';
  if (f.q) out.q = f.q;
  if (f.sort !== DEFAULT_FILTERS.sort) out.sort = f.sort;
  if (f.page > 1) out.page = String(f.page);
  if (f.limit !== DEFAULT_FILTERS.limit) out.limit = String(f.limit);
  return out;
}

/** 絞り込みが既定のままか (0 件のときに出す文言を選ぶ)。ページと表示件数は絞り込みではない */
export const isDefaultFilters = (f: ClassifyFilters): boolean =>
  Object.keys(filtersToParams({ ...f, page: 1, limit: CLASSIFY_DEFAULT_PAGE_SIZE })).length === 0;

/* -------- 選択・編集対象の URL 契約 -------- */

/** 選択と開いている明細はURLを正本にし、再読込みと戻る/進むで復元する。 */
export function parseSelectionParams(sp: URLSearchParams): {
  selected: string[];
  openTxKey: string | null;
} {
  const selected = [
    ...new Set(
      (sp.get('sel') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, SELECTION_MAX);
  const openTxKey = sp.get('tx')?.trim() || null;
  return { selected, openTxKey };
}

export function selectionParams(
  selected: readonly string[],
  openTxKey: string | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const unique = [...new Set(selected.filter(Boolean))].slice(0, SELECTION_MAX);
  if (unique.length) out.sel = unique.join(',');
  if (openTxKey) out.tx = openTxKey;
  return out;
}

/* -------- 一括保存 (spec-classify-bulk-save FR-02〜FR-05・FR-16) -------- */

/** 一括指定の欄。空文字は「指定しない」 */
export interface BulkForm {
  cls: '' | Cls;
  big: string;
  mid: string;
  owner: '' | Owner;
  paymentMethod: '' | PaymentMethodOverride;
}

export const EMPTY_BULK_FORM: BulkForm = { cls: '', big: '', mid: '', owner: '', paymentMethod: '' };

/** 値のある欄だけを一括指定にする。サーバは null と空の欄を受けない (FR-02) */
export function bulkSpecOf(form: BulkForm): BulkSpec {
  const spec: BulkSpec = {};
  if (form.cls) spec.cls = form.cls;
  if (form.big) {
    spec.big = form.big;
    // 中だけの指定はサーバが 400 にする。大を空にした中は送らない
    if (form.mid) spec.mid = form.mid;
  }
  if (form.owner) spec.owner = form.owner;
  if (form.paymentMethod) spec.paymentMethod = form.paymentMethod;
  return spec;
}

/**
 * 送る下書きを core が読む形へ。api の toDraft と同じ変換にする。
 * 値の欄が 1 つも無い下書きは下書きでない (提案・今の値から埋める明細と同じに扱う)
 */
function coreDraftOf(d: Partial<EditInput>): BulkDraft | null {
  if (!Object.values(d).some((v) => v !== undefined)) return null;
  return {
    cls: d.cls ?? null,
    big: d.big,
    mid: d.mid,
    owner: d.owner ?? null,
    paymentMethod: d.paymentMethod,
    note: d.note,
  };
}

/** 内訳に出す値の出どころ。欄ごとの出どころのうち、いちばん手前の層で 1 行を呼ぶ */
export type BulkSaveLabel = '一括指定' | '下書き' | '提案' | '今の値';
const LABEL_ORDER: readonly BulkSaveLabel[] = ['一括指定', '下書き', '提案', '今の値'];

function labelOf(sources: Record<string, BulkSaveSource>): BulkSaveLabel {
  const values = Object.values(sources);
  if (values.includes('bulk')) return '一括指定';
  if (values.includes('draft')) return '下書き';
  if (values.includes('suggestion')) return '提案';
  return '今の値';
}

export interface BulkSavePlan {
  /** 送る明細 (選択の順)。外した明細は入れない */
  items: BulkSaveBody['items'];
  /** 出どころごとの件数。0 件の出どころは出さない */
  groups: { label: BulkSaveLabel; count: number }[];
  saveCount: number;
  /** 区分だけの指定で、同じ区分の組が無く『カテゴリなし』で保存する件数 (AC-03) */
  noCategoryCount: number;
  /** 外す明細と、その理由 (BR-03)。失敗には数えない */
  skipped: { row: ClassifyRow; reason: string }[];
  /** 外す理由の種類 (出た順・重複なし) */
  reasons: string[];
}

/**
 * 保存前の内訳 (FR-03・FR-04)。値は api と同じ core の resolveBulkSaveItem で決める。
 * 画面が別の規則で数えると、内訳で「保存します」と言った明細がサーバで外れる。
 *
 * rows は選択の順。送る本文の items もこの順になる。
 */
export function planBulkSave(
  rows: readonly ClassifyRow[],
  bulk: BulkSpec,
  candidates: Candidates,
  draftOf: (txId: string) => EditInput | null,
): BulkSavePlan {
  const items: BulkSaveBody['items'] = [];
  const counts = new Map<BulkSaveLabel, number>();
  const skipped: BulkSavePlan['skipped'] = [];
  let noCategoryCount = 0;
  for (const row of rows) {
    const blocked = rowSelectability(row);
    if (blocked) {
      skipped.push({ row, reason: blocked });
      continue;
    }
    const draft = draftOf(row.id);
    const resolved = resolveBulkSaveItem({
      bulk,
      draft: draft ? coreDraftOf(draft) : null,
      suggestion: row.suggestion,
      current: currentOf(row),
      status: row.status,
      paymentMethod: row.edit?.paymentMethod ?? null,
      candidates,
    });
    if (!resolved.ok) {
      skipped.push({ row, reason: resolved.reason });
      continue;
    }
    items.push({ txId: row.id, draft: draft ?? {} });
    const label = labelOf(resolved.sources);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (resolved.sources.big === 'no_category') noCategoryCount += 1;
  }
  return {
    items,
    groups: LABEL_ORDER.flatMap((label) => {
      const count = counts.get(label) ?? 0;
      return count ? [{ label, count }] : [];
    }),
    saveCount: items.length,
    noCategoryCount,
    skipped,
    reasons: [...new Set(skipped.map((s) => s.reason))],
  };
}

/** 通信の失敗・5xx の文言。書き込まれたか分からないので、失敗と決めつけない (FR-16) */
export const UNCERTAIN_SAVE_MESSAGE =
  '保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません';

export interface BulkRequestFailure {
  message: string;
  /** 『同じ内容で再試行』を出すか。送り直しても同じ答えになる失敗には出さない */
  retry: boolean;
  /** 一覧と選択の読み出しを読み直すか */
  reload: boolean;
}

/**
 * 要求全体の失敗の分け方 (FR-16・Error contract)。status から文言と再試行の有無を引く。
 * 401 は既存のログイン切れの扱い (AUTH_EVENT) に任せるので null を返す。
 */
export function bulkRequestFailure(error: unknown): BulkRequestFailure | null {
  if (!(error instanceof ApiError) || error.status >= 500) {
    return { message: UNCERTAIN_SAVE_MESSAGE, retry: true, reload: true };
  }
  if (error.status === 401) return null;
  // 409 は取込みか別の更新が終われば通る。400・403・413 は同じ本文では直らない
  return { message: error.message, retry: error.status === 409, reload: false };
}
