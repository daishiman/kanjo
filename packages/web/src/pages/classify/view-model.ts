/**
 * 明細仕分け画面の表示整形 (spec-classify-screen 7 節)。
 *
 * ここに置くのは「値 → 文言」の純関数だけで、問い合わせも DOM も持たない。
 * 通知文・件数文言・分割合計の文言をコンポーネントの中に散らすと、
 * 同じ意味の文が 2 通りに増えて、どちらが仕様どおりか分からなくなる。
 */
import { matchesSuggestion } from '@kanjo/core';
import type { BulkItemBody, ClassifyRow, ClassifyStatus, Cls, Owner } from '../../api.js';

/** 件数の文言。3 桁区切り (例: 1,024件) */
export const countText = (n: number): string => `${n.toLocaleString('ja-JP')}件`;

/**
 * 金額の文言。画像どおり支出も正の数で出し、単位は「円」。
 * 共通の `yen` は ¥ 記号と符号を付けるので、この画面では使わない。
 */
export const amountText = (v: number): string => `${Math.abs(Math.round(v)).toLocaleString('ja-JP')}円`;

/** 信頼度。null は「—」(0% と区別する) */
export const confidenceText = (v: number | null): string => (v == null ? '—' : `${v}%`);

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

/**
 * 編集入力の初期値 (7.6)。
 *
 * 未整理で提案がある明細は提案を初期値に置く。この画面の既定の道筋は
 * 「提案どおりに確定する」なので、そのまま保存を押せば完了になる状態から始める。
 * 確定済み・提案なしの明細は保存値をそのまま出す。
 */
/**
 * 提案があるか。api は提案なしを null で返すが、値の入っていない提案も提案として扱わない。
 * 「提案あり」の言い方をここ 1 か所に置かないと、初期値と予告で食い違う。
 */
const hasSuggestion = (s: ClassifyRow['suggestion']): s is NonNullable<ClassifyRow['suggestion']> =>
  s != null && !!(s.cls || s.big || s.mid || s.owner);

export function inputFromRow(row: ClassifyRow): EditInput {
  const s = row.suggestion;
  const suggested = row.status === 'unsorted' && hasSuggestion(s);
  return {
    cls: suggested ? (s.cls ?? null) : (row.cls ?? null),
    big: suggested ? s.big || null : row.big || null,
    mid: suggested ? s.mid || null : row.mid || null,
    owner: suggested ? (s.owner ?? null) : (row.owner ?? null),
    paymentMethod: row.edit?.paymentMethod ?? null,
    note: row.note ?? null,
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
  if (!hasSuggestion(row.suggestion)) return 'manual';
  return matchesSuggestion(row.suggestion, input) ? 'done' : 'manual';
}

export const outcomeText = (status: ClassifyStatus): string =>
  status === 'done' ? 'この内容で保存すると完了になります。' : 'この内容で保存すると手動変更になります。';

/** 保存ボタンを押せる条件 (7.6)。未整理は提案どおりの確定も押せる */
export const canSave = (row: ClassifyRow, input: EditInput): boolean =>
  !sameInput(inputFromRow(row), input) || row.status === 'unsorted';

/** 履歴の 1 行。{日時} {由来} → {変更後}（信頼度 n%） */
export function historyText(h: {
  changedAt: string;
  sourceLabel: string;
  after: string | null;
  confidence: number | null;
}): string {
  const when = `${dateText(h.changedAt)} ${h.changedAt.slice(11, 16)}`;
  const tail = h.confidence == null ? '' : `（信頼度 ${h.confidence}%）`;
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
  return out;
}

/** 絞り込みが既定のままか (0 件のときに出す文言を選ぶ) */
export const isDefaultFilters = (f: ClassifyFilters): boolean =>
  Object.keys(filtersToParams({ ...f, page: 1 })).length === 0;

/* -------- 選択・編集対象の URL 契約 -------- */

const MAX_URL_SELECTION = 50;

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
  ].slice(0, MAX_URL_SELECTION);
  const openTxKey = sp.get('tx')?.trim() || null;
  return { selected, openTxKey };
}

export function selectionParams(
  selected: readonly string[],
  openTxKey: string | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const unique = [...new Set(selected.filter(Boolean))].slice(0, MAX_URL_SELECTION);
  if (unique.length) out.sel = unique.join(',');
  if (openTxKey) out.tx = openTxKey;
  return out;
}

/* -------- 一括保存の入力解決 -------- */

export type BulkItemResolution =
  | { ok: true; item: BulkItemBody; source: 'draft' | 'suggestion' }
  | { ok: false; message: string };

/** 下書きを優先し、無ければ提案、どちらも無ければ通信前に失敗とする。 */
export function resolveBulkItem(row: ClassifyRow, draft: EditInput | null): BulkItemResolution {
  if (draft) return { ok: true, item: { txId: row.id, ...draft }, source: 'draft' };
  const suggestion = row.suggestion;
  if (suggestion && (suggestion.cls || suggestion.big || suggestion.mid || suggestion.owner)) {
    return {
      ok: true,
      item: {
        txId: row.id,
        cls: suggestion.cls ?? null,
        big: suggestion.big || null,
        mid: suggestion.mid || null,
        owner: suggestion.owner ?? null,
        paymentMethod: row.edit?.paymentMethod ?? null,
        note: row.note ?? null,
      },
      source: 'suggestion',
    };
  }
  return { ok: false, message: '提案または保存済みの下書きがありません。' };
}
