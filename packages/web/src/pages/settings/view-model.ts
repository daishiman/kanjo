/**
 * 設定画面の文言と書式 (spec-settings-screen §7.2〜§7.14)。
 *
 * 画面の文言は spec の表と完全一致で比べるので、部品に直書きせずここへ集める。
 * 値の意味 (未保存件数・差分・検証) は core が持ち、ここは見せ方だけを組む。
 */
import {
  CASH_OVERRIDE_MEMO_MAX,
  type CashOverrideKind,
  NORM_RULE_TEXT_MAX,
  type NormRuleKind,
  OWNER_LABEL_MAX,
  type OwnerKey,
  type OwnerLabelError,
  type SettingsDiff,
  type SettingsFieldError,
} from '@kanjo/core';
import type { ApiError } from '../../api-client.js';
import type { BackupItem } from '../../api.js';

/* -------- 見出し (§7.2) -------- */

export const TITLE = '設定';
export const QUESTION = '集計ルールと復元設定を、安全に管理しますか？';
export const LEAD_LINES = [
  '分類・名義・統計の設定、現金の上書き値、データの出力・復元、バックアップを管理します。',
  'ここでの設定は、今後の取込・集計・分析・レポートに反映されます。',
] as const;

/** 節ナビ 8 項目。id は節の要素の id と同じ */
export const SECTION_NAV = [
  { id: 'norm-rules', label: '集計ルール' },
  { id: 'owner-labels', label: '名義' },
  { id: 'stats', label: '統計' },
  { id: 'cash-overrides', label: '現金上書き' },
  { id: 'data', label: 'データ' },
  { id: 'backups', label: 'バックアップ' },
  { id: 'account', label: 'アカウント' },
  { id: 'other-admin', label: 'その他の管理' },
] as const;

export type SectionId = (typeof SECTION_NAV)[number]['id'];

/* -------- 集計ルール (§7.3〜§7.5) -------- */

export const NORM_RULES_TEXT = {
  heading: '集計ルール',
  lead: '取引の内容を特定のカテゴリに正規化するルールを設定します。',
  subheading: 'カテゴリの正規化マップ',
  kind: '種別',
  raw: '元の表記（入力値）',
  norm: '正規化後のカテゴリ',
  actions: '操作',
  add: '+ ルールを追加',
  empty: '集計ルールはまだありません。',
  disabled: '無効',
  shadowed: '上の行が優先されます',
  deleteLabel: 'このルールを削除',
  deleteBody: '保存するまで確定しません。',
} as const;

export const normRulesLimitNote = (max: number): string => `集計ルールは${max}行までです。`;
export const selectedCountLabel = (n: number): string => `${n}件を選択中`;
export const bulkDeleteTitle = (n: number): string => `選択した${n}件の集計ルールを削除しますか？`;
export const deleteRuleTitle = (raw: string): string =>
  raw.trim() === '' ? 'このルールを削除しますか？' : `「${raw.trim()}」のルールを削除しますか？`;

export const KIND_LABEL: Record<NormRuleKind, string> = { account: '科目', vendor: '取引先' };

export const PANEL_TEXT = {
  heading: 'この設定の説明',
  close: '説明を閉じる',
  subheading: '選択中の集計ルール',
  raw: '元の表記',
  norm: '正規化後のカテゴリ',
  impacts: 'このルールが影響するもの',
  updated: '最終更新',
  unsaved: '未保存',
  undo: 'このルールを元に戻す',
  noPrevious: 'これより前の保存値はありません。',
  undoNotFound: '元に戻せる値がありません。',
  undoFailed: '直前の保存値を読み込めませんでした。',
  hintHeading: '設定のヒント',
  hint: '表記ゆれのある取引先名を、同じカテゴリにまとめることで、正確な集計が可能になります。',
  empty: '集計ルールを追加するか一覧から選ぶと、集計への影響をここで確認できます。',
} as const;

/* -------- 名義・統計・現金上書き (§7.6〜§7.8) -------- */

export const OWNER_TEXT = {
  heading: '名義',
  lead: '取引の名義・所有者の表示ラベルを設定します。レポートや分析画面で使用されます。',
} as const;

/** 2 列 × 2 段の並び (左上から右下へ) */
export const OWNER_FIELDS: ReadonlyArray<{ key: OwnerKey; label: string; example: string }> = [
  { key: 'spouse', label: '配偶者の表示名', example: '例：パートナー、配偶者' },
  { key: 'business', label: '事業の表示名', example: '例：事業、ビジネス' },
  { key: 'family', label: '家族の表示名', example: '例：子ども、家族' },
  { key: 'unset', label: '未設定の表示名', example: '例：その他、未設定' },
];

export const OWNER_ERROR_TEXT: Record<OwnerLabelError, string> = {
  required: '表示名を入力してください。',
  too_long: `${OWNER_LABEL_MAX}文字以内で入力してください。`,
  control_char: '改行やタブなどの制御文字は使えません。',
  duplicate: 'ほかの名義と同じ表示名は使えません。',
};

export const STATS_TEXT = {
  heading: '統計',
  lead: '統計・分析で使用する最小データ期間を設定します。',
  label: 'AI分析の対象月数（最小）',
  unit: 'か月',
  info: '設定した月数に満たない期間では、AIによる傾向分析が実行されません。より長い期間を設定すると、分析の精度が向上します。',
} as const;

export const statRangeError = (min: number, max: number): string =>
  `${min}〜${max}の整数で入力してください。`;

export const CASH_TEXT = {
  heading: '現金上書き',
  lead: '現金の支払い・受け取りの金額を、データ上で上書きする値を設定します。空欄と0円の違いにご注意ください。',
  item: '項目',
  amount: '上書き値（円）',
  scope: '適用範囲',
  memo: 'メモ',
  scopeAll: '全期間',
  scopeMonth: '月指定',
  month: '対象月',
  memoPlaceholder: '（未設定）',
  addMonth: '月指定を追加',
  removeMonth: 'この月指定を削除',
  legend: [
    '空欄：上書きを行いません（元のデータを使用）',
    '0：全額を0円として上書きします',
    '※ 設定は取込後の集計に適用されます。',
  ],
} as const;

export const CASH_KIND_LABEL: Record<CashOverrideKind, string> = {
  payment: '現金の支払い',
  receipt: '現金の受け取り',
};

export const memoCount = (memo: string): string => `${[...memo].length}/${CASH_OVERRIDE_MEMO_MAX}`;

/** 欄ごとの検証結果 (core の SettingsFieldError と画面側の読めない入力) を文言にする */
export function fieldErrorText(field: string, code: SettingsFieldError | 'not_integer'): string {
  if (code === 'control_char') return '改行やタブなどの制御文字は使えません。';
  if (field.endsWith('.memo')) return `${CASH_OVERRIDE_MEMO_MAX}文字以内で入力してください。`;
  if (field.endsWith('.amount')) return '0以上の整数（円）で入力するか、空欄にしてください。';
  if (field.endsWith('.month'))
    return code === 'duplicate' ? '同じ適用範囲の行がすでにあります。' : '対象月を選んでください。';
  if (code === 'required') return '入力してください。';
  if (code === 'too_long') return `${NORM_RULE_TEXT_MAX}文字以内で入力してください。`;
  return '入力内容を確認してください。';
}

/* -------- データ・復元 (§7.9) -------- */

export const DATA_TEXT = {
  heading: 'データ',
  lead: '現在の設定に基づいて、各種データを出力します。',
  restoreHeading: '復元',
  restoreLead: 'エクスポートした設定ファイル（JSON）から、設定を復元します。',
  chooseFile: 'ファイルを選択',
  noFile: '選択されていません',
  restoreInfo: [
    '復元すると、現在のすべての設定が上書きされます。',
    '復元前に、現在の設定をバックアップすることを推奨します。',
  ],
  restoreButton: '設定を復元',
  restoreTitle: '設定を復元しますか？',
  restoreConfirm: '復元する',
  restoreBusy: '復元中…',
  cancel: 'キャンセル',
  restored: '設定を復元しました。',
  fileTooLarge: 'ファイルが大きすぎます。',
} as const;

/** 設定ファイルの上限 (API の本文上限と同じ 256KB) */
export const SETTINGS_FILE_MAX_BYTES = 256 * 1024;

export interface ExportLink {
  key: 'settings' | 'matrix' | 'transactions' | 'report';
  label: string;
  detail: string;
  path: string;
  /** 選択中の期間を付けるか。設定は期間に依存しない */
  withPeriod: boolean;
}

export const EXPORT_LINKS: readonly ExportLink[] = [
  {
    key: 'settings',
    label: '設定のエクスポート（JSON）',
    detail: 'すべての設定をJSON形式で出力',
    path: '/api/settings/export',
    withPeriod: false,
  },
  {
    key: 'matrix',
    label: '集計マトリクス（CSV）',
    detail: 'カテゴリ別の集計結果を出力',
    path: '/api/export/matrix.csv',
    withPeriod: true,
  },
  {
    key: 'transactions',
    label: '取引データ（CSV）',
    detail: '集計後の取引データを出力',
    path: '/api/export/transactions.csv',
    withPeriod: true,
  },
  {
    key: 'report',
    label: 'レポート（HTML）',
    detail: '設定内容のレポートを出力',
    path: '/api/export/report.html',
    withPeriod: true,
  },
];

export const RESTORE_NOTE = '復元の直前に、現在の設定を自動で退避します。取引データは変わりません。';
export const SAME_CONTENT = '現在の設定と同じ内容です。';
export const DRAFT_DISCARD_NOTE = '未保存の変更は破棄されます。';

/** 差分プレビューの本文。節ごとに 1 行 (§7.9) */
export function diffLines(diff: SettingsDiff): string[] {
  const n = diff.normRules;
  const rules = `集計ルール（追加 ${n.added.count} 件・変更 ${n.changed.count} 件・削除 ${n.removed.count} 件${
    n.reordered.count > 0 ? `・並び順 ${n.reordered.count} 件` : ''
  }）`;
  const owners = `名義（変更 ${diff.ownerLabels.changed.length} 件）`;
  const stat = diff.statMinMonths
    ? `統計（${diff.statMinMonths.before} か月 → ${diff.statMinMonths.after} か月）`
    : '統計（変更なし）';
  const c = diff.cashOverrides;
  const cash = `現金上書き（追加 ${c.added.count} 件・変更 ${c.changed.count} 件・削除 ${c.removed.count} 件）`;
  return [rules, owners, stat, cash];
}

/* -------- バックアップ (§7.10) -------- */

export const BACKUPS_TEXT = {
  heading: 'バックアップ',
  lead: '設定の自動バックアップです。過去のバックアップから設定を復元できます。',
  columns: ['日付', 'サイズ', 'ステータス', 'メモ', '操作'],
  compare: '比較',
  restore: '復元',
  aboutHeading: '自動バックアップについて',
  about:
    '毎日 午前2:00に、自動で設定のバックアップを作成します。過去のバックアップから、いつでも復元できます。',
  empty: 'バックアップはまだありません。毎日 午前2:00に作成されます。',
  loadFailed: 'バックアップの一覧を読み込めませんでした。',
  compareTitle: (date: string) => `${date}のバックアップと現在の設定の差分`,
  restoreTitle: (date: string) => `${date}のバックアップから設定を復元しますか？`,
  close: '閉じる',
} as const;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, '0');

function jstParts(iso: string): [string, string, string, string, string] | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + JST_OFFSET_MS);
  return [
    String(d.getUTCFullYear()),
    pad2(d.getUTCMonth() + 1),
    pad2(d.getUTCDate()),
    pad2(d.getUTCHours()),
    pad2(d.getUTCMinutes()),
  ];
}

/** 説明パネルの最終更新。月日を 2 桁にする (§7.5) */
export function panelDateLabel(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p[0]}年${p[1]}月${p[2]}日 ${p[3]}:${p[4]}` : '—';
}

/** 更新者は全角括弧で包む (§7.5) */
export const updatedByLabel = (actor: string): string => `（${actor}）`;

/** バックアップの日付。作成時刻が無い回は日付だけを同じ区切りで出す (§7.10) */
export function backupDateLabel(item: Pick<BackupItem, 'date' | 'uploaded'>): string {
  const p = item.uploaded ? jstParts(item.uploaded) : null;
  return p ? `${p[0]}/${p[1]}/${p[2]} ${p[3]}:${p[4]}` : item.date.replaceAll('-', '/');
}

/** サイズは KB の整数に切り上げる。失敗の回は『—』 */
export const backupSizeLabel = (size: number | null): string =>
  size == null ? '—' : `${Math.ceil(size / 1024).toLocaleString('ja-JP')}KB`;

export type BackupBadge = '最新' | '成功' | '失敗';

export function backupBadge(item: Pick<BackupItem, 'status' | 'latest'>): BackupBadge {
  if (item.status === 'failed') return '失敗';
  return item.latest ? '最新' : '成功';
}

/** メモ。保存時に残したメモを優先し、無ければ成否に応じた既定の文 */
export function backupMemo(item: Pick<BackupItem, 'status' | 'memo'>): string {
  if (item.memo) return item.memo;
  return item.status === 'failed' ? 'バックアップの作成に失敗しました' : '自動バックアップ';
}

/* -------- 保存バー・離脱 (§7.12) -------- */

export const SAVE_TEXT = {
  unsavedHint: '変更した設定を保存してください。',
  clean: '未保存の変更はありません。',
  invalid: '入力内容を確認してください。',
  reset: '変更をリセット',
  save: '設定を保存',
  saving: '保存中…',
  saved: '設定を保存しました。',
  resetConfirm: '破棄する',
  resetBusy: '破棄しています…',
  leave: '保存していない変更があります。移動しますか？ 下書きは端末に残ります。',
  leaveConfirm: '移動する',
  leaveBusy: '移動しています…',
  leaveDismiss: 'とどまる',
  retry: '再試行',
} as const;

export const unsavedLabel = (n: number): string => `未保存 ${n}項目`;
export const resetTitle = (n: number): string => `未保存の変更（${n}項目）をすべて破棄しますか？`;

export const LOAD_FAILED = '設定を読み込めませんでした。';
export const RELOAD = '再読み込み';
export const CONFLICT = '他の画面で更新されました';

const errorOf = (error: unknown): Partial<ApiError> => (error ?? {}) as Partial<ApiError>;

/** 保存の失敗の文言 (§API: PUT /api/settings/screen の Error contract) */
export function saveErrorMessage(error: unknown): string {
  const e = errorOf(error);
  if (e.status === 400) return '設定を保存できませんでした。入力内容を確認してください。';
  if (e.status === 413) return '保存する内容が大きすぎます。';
  if (e.status === 409 && e.code === 'settings_conflict') return CONFLICT;
  if (e.status === 409 && typeof e.message === 'string' && e.message !== '') return e.message;
  return '設定を保存できませんでした。時間をおいてもう一度お試しください。';
}

/** 『再試行』を出すか。入力を直す 400・413 と、再取得で済ませる競合には出さない */
export function canRetry(error: unknown): boolean {
  const e = errorOf(error);
  if (e.status === 400 || e.status === 413) return false;
  return !(e.status === 409 && e.code === 'settings_conflict');
}

/** 復元・比較の失敗の文言 (§API: 復元・バックアップの Error contract) */
export function restoreErrorMessage(error: unknown): string {
  const e = errorOf(error);
  switch (e.code) {
    case 'invalid_settings_file':
      return '設定ファイルの形式が正しくありません。';
    case 'unsupported_settings_version':
      return 'このファイルの版には対応していません。';
    case 'pre_restore_backup_failed':
      return '現在の設定を退避できなかったため、復元を中止しました。';
    case 'settings_conflict':
      return CONFLICT;
    case 'backup_not_found':
      return 'そのバックアップは残っていません(保持は30日)';
    case 'backup_settings_unreadable':
      return 'このバックアップの設定は読み取れません。';
  }
  if (e.status === 413) return DATA_TEXT.fileTooLarge;
  if (e.status === 409 && typeof e.message === 'string' && e.message !== '') return e.message;
  return '設定を復元できませんでした。時間をおいてもう一度お試しください。';
}
