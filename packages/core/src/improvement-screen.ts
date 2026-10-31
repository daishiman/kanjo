/**
 * 改善リクエスト画面 (20-improvement) の規則。web の表示と api の応答が同じ判定を使うよう、ここで1回だけ決める (O3)。
 *
 * - 状態の遷移: IMPROVEMENT_TRANSITIONS の1つの表。api は許されない遷移を 409 にし、web は許される先だけを選ばせる。
 * - 作成フォームの検証: 本文 1〜1000 字とプライバシー確認 2 つ。送信を止める理由の文言もここで持つ。
 * - 概要: 本文の最初の空でない行を 40 字で切る。件名 (title) は使わない。
 * - IMP 番号: `IMP-` + 3 桁のゼロ詰め。検索では `IMP-024`・`imp-24`・`24` のどれでも当たる。
 * - 一覧: 検索 (全角半角・大小を同一視) → 件数タブ (検索後の集合) → タブで絞る → 10 件ずつのページ。
 * - 関連する依頼: 同じ関連ページの他の依頼を新しい順に 3 件まで。
 * - アクティビティ: 6 種類の見出しと説明を種類から組み、新しい順に並べる。
 * - 診断の表示用要約: OS・ブラウザ・画面サイズ・利用環境・末尾 4 桁のセッション ID。
 *
 * 規則の表は docs/improvement-screen/rules.md にあり、core の契約テストの期待値と同じである。
 */
import {
  type DiagnosticEnvironment,
  IMPROVEMENT_NEW_BODY_MAX,
  IMPROVEMENT_STATUS_LABEL,
  IMPROVEMENT_STATUS_VALUES,
  type ImprovementStatus,
} from './improvement.js';

/* ======================== 状態の遷移 ======================== */

/** 今の状態から移れる先 (spec「状態と遷移」の表)。同じ状態への変更は遷移ではなく、何も書かない */
export const IMPROVEMENT_TRANSITIONS: Readonly<Record<ImprovementStatus, readonly ImprovementStatus[]>> = {
  open: ['in_progress', 'done'],
  in_progress: ['open', 'reconfirm', 'done'],
  reconfirm: ['in_progress', 'done'],
  done: ['in_progress', 'reconfirm'],
};

export const isImprovementStatus = (value: unknown): value is ImprovementStatus =>
  typeof value === 'string' && (IMPROVEMENT_STATUS_VALUES as readonly string[]).includes(value);

export function canTransitionImprovement(from: ImprovementStatus, to: ImprovementStatus): boolean {
  return IMPROVEMENT_TRANSITIONS[from].includes(to);
}

/** 画面の選択肢の並び (件数タブと同じ順) で、今の状態から移れる先を返す */
export function allowedImprovementTransitions(from: ImprovementStatus): ImprovementStatus[] {
  return IMPROVEMENT_STATUS_VALUES.filter((to) => canTransitionImprovement(from, to));
}

/** 完了に入ったら done_at を付け、出たら外す。完了のままなら元の値を保つ (30 日の起点を動かさない) */
export function nextImprovementDoneAt(
  from: ImprovementStatus,
  to: ImprovementStatus,
  currentDoneAt: string | null,
  now: string,
): string | null {
  if (to !== 'done') return null;
  return from === 'done' ? currentDoneAt : now;
}

/* ======================== 作成フォーム ======================== */

export const IMPROVEMENT_DRAFT_MESSAGES = {
  bodyEmpty: '改善の内容を入力してください',
  bodyTooLong: `${IMPROVEMENT_NEW_BODY_MAX} 字以内で入力してください`,
  privacy: 'プライバシーに関する確認を 2 つともチェックしてください',
} as const;

export interface ImprovementDraftInput {
  body: string;
  privacyConfirmed: boolean;
  privacyConsented: boolean;
}

export interface ImprovementDraftCheck {
  ok: boolean;
  /** 欄名から理由文への対応。api の error.fields と画面の欄の近くの文に同じものを使う */
  fields: Partial<Record<'body' | 'privacy', string>>;
  /** 送信ボタンの近くに出す最初の理由。送れるときは null */
  message: string | null;
  /** trim 後の文字数 (UTF-16 の長さ。zod の max と同じ数え方) */
  length: number;
}

/** 本文の文字数。画面の「0/1000」と検証が同じ数を使う */
export const improvementBodyLength = (body: string): number => body.trim().length;

export function checkImprovementDraft(input: ImprovementDraftInput): ImprovementDraftCheck {
  const length = improvementBodyLength(input.body);
  const fields: ImprovementDraftCheck['fields'] = {};
  if (length === 0) fields.body = IMPROVEMENT_DRAFT_MESSAGES.bodyEmpty;
  else if (length > IMPROVEMENT_NEW_BODY_MAX) fields.body = IMPROVEMENT_DRAFT_MESSAGES.bodyTooLong;
  if (!input.privacyConfirmed || !input.privacyConsented) fields.privacy = IMPROVEMENT_DRAFT_MESSAGES.privacy;
  const message = fields.body ?? fields.privacy ?? null;
  return { ok: message === null, fields, message, length };
}

/* ======================== 概要と IMP 番号 ======================== */

export const IMPROVEMENT_SUMMARY_MAX = 40;

/** 本文の最初の空でない行を trim し、40 字を超えたら切って「…」を付ける */
export function improvementSummary(body: string): string {
  const line =
    body
      .split(/\r\n|\r|\n/)
      .find((l) => l.trim().length > 0)
      ?.trim() ?? '';
  const chars = Array.from(line);
  return chars.length > IMPROVEMENT_SUMMARY_MAX
    ? `${chars.slice(0, IMPROVEMENT_SUMMARY_MAX).join('')}…`
    : line;
}

/** 1→IMP-001、24→IMP-024、1000→IMP-1000 */
export const formatImprovementNumber = (seq: number): string => `IMP-${String(seq).padStart(3, '0')}`;

/* ======================== 関連ページの画面名 ======================== */

/**
 * 経路から画面名を引く表。web の routeMetadata.ts の label と同じ値で、
 * web のテスト (improvement-route-labels.test.ts) が一致を確かめる。core は web を参照できないため写しを持つ。
 */
export const IMPROVEMENT_ROUTE_LABELS: Readonly<Record<string, string>> = {
  '/': '概要',
  '/import': 'データ取込',
  '/cash': '現金入力',
  '/classify': '明細仕分け',
  '/subscriptions': 'サブスク',
  '/household': '家計収支',
  '/analysis': '支出分析',
  '/analysis/reconciliation': '照合',
  '/analysis/total-cashflow': '総収支',
  '/analysis/matrix': 'マトリックス',
  '/analysis/trends': '推移',
  '/analysis/diagnosis': '診断',
  '/statements': '決算書',
  '/ai': 'AI分析',
  '/budget': '予算',
  '/tradeoff': 'トレードオフ',
  '/settings': '設定',
  '/guide': '使い方',
  '/improvement': '改善リクエスト',
};

/** 画面名。クエリとハッシュは落として引き、表に無い経路はパスのまま、空なら「記録なし」 */
export function improvementRouteLabel(route: string): string {
  const path = route.split(/[?#]/)[0] ?? '';
  if (!path) return '記録なし';
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return IMPROVEMENT_ROUTE_LABELS[trimmed] ?? trimmed;
}

/* ======================== 一覧 (検索・件数・ページング) ======================== */

export const IMPROVEMENT_PAGE_SIZE = 10;
export const IMPROVEMENT_QUERY_MAX = 100;

export type ImprovementTab = 'all' | ImprovementStatus;
export const IMPROVEMENT_TABS: readonly ImprovementTab[] = ['all', ...IMPROVEMENT_STATUS_VALUES];
export const IMPROVEMENT_TAB_LABEL: Record<ImprovementTab, string> = {
  all: 'すべて',
  ...IMPROVEMENT_STATUS_LABEL,
};

/** 一覧の材料。api が D1 の行から、web のテストが架空の値から作る */
export interface ImprovementListSource {
  id: string;
  seq: number;
  body: string;
  route: string;
  status: ImprovementStatus;
  createdAt: string;
  updatedAt: string;
  /** 削除中なら時刻。一覧・件数・関連からは常に除く */
  deletedAt?: string | null;
}

export interface ImprovementListItem {
  id: string;
  seq: number;
  number: string;
  route: string;
  routeLabel: string;
  summary: string;
  status: ImprovementStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementListQuery {
  q: string;
  tab: ImprovementTab;
  page: number;
}

export interface ImprovementListResult {
  items: ImprovementListItem[];
  counts: Record<ImprovementTab, number>;
  /** 範囲内に倒した後のページ */
  page: number;
  pageSize: number;
  /** タブで絞った後の件数 (ページングの総数) */
  total: number;
  pageCount: number;
}

/** 壊れた値を既定に倒す。URL の検索パラメータと api の query の両方がここを通る */
export function normalizeImprovementListQuery(input: {
  q?: string | null;
  tab?: string | null;
  page?: string | number | null;
}): ImprovementListQuery {
  const q = Array.from(input.q ?? '')
    .slice(0, IMPROVEMENT_QUERY_MAX)
    .join('');
  const tab = (IMPROVEMENT_TABS as readonly string[]).includes(input.tab ?? '')
    ? (input.tab as ImprovementTab)
    : 'all';
  const n = typeof input.page === 'number' ? input.page : Number.parseInt(String(input.page ?? ''), 10);
  const page = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return { q, tab, page };
}

/** 全角半角 (NFKC) と大小を同一視し、前後の空白を落とす */
export const normalizeImprovementSearchText = (text: string): string =>
  text.normalize('NFKC').toLowerCase().trim();

export function toImprovementListItem(row: ImprovementListSource): ImprovementListItem {
  return {
    id: row.id,
    seq: row.seq,
    number: formatImprovementNumber(row.seq),
    route: row.route,
    routeLabel: improvementRouteLabel(row.route),
    summary: improvementSummary(row.body),
    status: row.status,
    statusLabel: IMPROVEMENT_STATUS_LABEL[row.status],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** IMP 番号・本文・関連ページ名 (とパス) に部分一致するか。番号は `imp-24` や `24` でも当てる */
export function matchesImprovementQuery(row: ImprovementListSource, query: string): boolean {
  const q = normalizeImprovementSearchText(query);
  if (!q) return true;
  const numberMatch = /^(?:imp-?)?0*(\d+)$/.exec(q);
  if (numberMatch && Number(numberMatch[1]) === row.seq) return true;
  const haystack = [formatImprovementNumber(row.seq), row.body, improvementRouteLabel(row.route), row.route]
    .map(normalizeImprovementSearchText)
    .join('\n');
  return haystack.includes(q);
}

/** 作成日の新しい順、同時刻は seq の大きい順 */
export function compareImprovementNewestFirst(a: ImprovementListSource, b: ImprovementListSource): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return b.seq - a.seq;
}

const emptyCounts = (): Record<ImprovementTab, number> => ({
  all: 0,
  open: 0,
  in_progress: 0,
  done: 0,
  reconfirm: 0,
});

export function buildImprovementList(
  rows: readonly ImprovementListSource[],
  input: Partial<ImprovementListQuery> = {},
): ImprovementListResult {
  const query = normalizeImprovementListQuery(input);
  const hits = rows
    .filter((row) => !row.deletedAt && matchesImprovementQuery(row, query.q))
    .sort(compareImprovementNewestFirst);
  const counts = emptyCounts();
  for (const row of hits) {
    counts.all += 1;
    counts[row.status] += 1;
  }
  const filtered = query.tab === 'all' ? hits : hits.filter((row) => row.status === query.tab);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / IMPROVEMENT_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * IMPROVEMENT_PAGE_SIZE;
  return {
    items: filtered.slice(start, start + IMPROVEMENT_PAGE_SIZE).map(toImprovementListItem),
    counts,
    page,
    pageSize: IMPROVEMENT_PAGE_SIZE,
    total,
    pageCount,
  };
}

/** 「10件 / 全12件」。ページの件数と総数から描く */
export const improvementPageRangeText = (result: Pick<ImprovementListResult, 'items' | 'total'>): string =>
  `${result.items.length}件 / 全${result.total}件`;

/* ======================== 関連する依頼 ======================== */

export const IMPROVEMENT_RELATED_LIMIT = 3;

/** 同じ route の他の依頼を新しい順に 3 件まで。自分・削除中・route が空の依頼は出さない */
export function relatedImprovements(
  target: Pick<ImprovementListSource, 'id' | 'route'>,
  rows: readonly ImprovementListSource[],
  limit: number = IMPROVEMENT_RELATED_LIMIT,
): ImprovementListItem[] {
  if (!target.route) return [];
  return rows
    .filter((row) => row.id !== target.id && !row.deletedAt && row.route === target.route)
    .sort(compareImprovementNewestFirst)
    .slice(0, limit)
    .map(toImprovementListItem);
}

/* ======================== アクティビティ ======================== */

export type ImprovementActivityKind =
  | 'created'
  | 'status_changed'
  | 'reissued'
  | 'deleted'
  | 'restored'
  | 'migrated_wontfix';

export const IMPROVEMENT_ACTIVITY_KINDS: readonly ImprovementActivityKind[] = [
  'created',
  'status_changed',
  'reissued',
  'deleted',
  'restored',
  'migrated_wontfix',
];

export interface ImprovementActivitySource {
  id: string;
  kind: ImprovementActivityKind;
  fromStatus: ImprovementStatus | null;
  toStatus: ImprovementStatus | null;
  createdAt: string;
}

export interface ImprovementActivityView extends ImprovementActivitySource {
  title: string;
  description: string;
}

const statusText = (status: ImprovementStatus | null): string =>
  status ? IMPROVEMENT_STATUS_LABEL[status] : '';

export function describeImprovementActivity(activity: ImprovementActivitySource): ImprovementActivityView {
  const text = ((): { title: string; description: string } => {
    switch (activity.kind) {
      case 'created':
        return { title: '改善リクエストを作成', description: statusText(activity.toStatus) || '受付' };
      case 'status_changed':
        return {
          title: `${statusText(activity.toStatus)}に変更`,
          description: `${statusText(activity.fromStatus)} → ${statusText(activity.toStatus)}`,
        };
      case 'reissued':
        return { title: 'プロンプトを再発行', description: '前に発行したプロンプトは使えなくなりました' };
      case 'deleted':
        return { title: '削除', description: 'このリクエストを削除しました' };
      case 'restored':
        return { title: '元に戻す', description: '削除を取り消しました' };
      case 'migrated_wontfix':
        return { title: '完了に変更', description: '対応しない (wontfix) から完了へ移しました' };
    }
  })();
  return { ...activity, ...text };
}

/** 新しい順。同時刻は id の降順 (同じ batch で書いた行の順を安定させる) */
export function orderImprovementActivities(
  activities: readonly ImprovementActivitySource[],
): ImprovementActivityView[] {
  return [...activities]
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    })
    .map(describeImprovementActivity);
}

/* ======================== 診断の表示用要約 ======================== */

export interface ImprovementDiagnosticsSummary {
  os: string;
  browser: string;
  viewport: string;
  environment: string;
  sessionIdMasked: string;
}

const UNKNOWN = '不明';

function detectOs(ua: string): string {
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return UNKNOWN;
}

/** ブラウザの名前だけを出す。版番号は伏せ、伏せたことを表示に残す */
function detectBrowser(ua: string): string {
  const table: readonly [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Safari\//, 'Safari'],
  ];
  const hit = table.find(([re]) => re.test(ua));
  return hit ? `${hit[1]}（マスク済み）` : UNKNOWN;
}

function formatViewport(viewport: string): string {
  // web の診断は「幅x高さ@倍率」で記録する (diagnostics-buffer.ts)。倍率は画面サイズの表示に要らない
  const m = /^(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*[\d.]+)?$/.exec(viewport.trim());
  return m ? `${m[1]} × ${m[2]}` : viewport.trim() || UNKNOWN;
}

function detectEnvironment(origin: string | undefined): string {
  if (!origin) return UNKNOWN;
  let host = origin;
  try {
    host = new URL(origin).hostname;
  } catch {
    host = origin.replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0] ?? '';
  }
  return /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/.test(host) || host.endsWith('.localhost')
    ? 'ローカル環境'
    : '本番環境';
}

/** セッション ID は末尾 4 桁だけを出す (`****-****-****-a3f2`) */
export function maskImprovementSessionId(sessionId: string | undefined): string {
  const tail = (sessionId ?? '').replace(/[^A-Za-z0-9]/g, '').slice(-4);
  return tail.length === 4 ? `****-****-****-${tail}` : '記録なし';
}

export function summarizeDiagnosticEnvironment(
  env: Pick<DiagnosticEnvironment, 'userAgent' | 'viewport' | 'sessionId' | 'origin'>,
): ImprovementDiagnosticsSummary {
  return {
    os: detectOs(env.userAgent),
    browser: detectBrowser(env.userAgent),
    viewport: formatViewport(env.viewport),
    environment: detectEnvironment(env.origin),
    sessionIdMasked: maskImprovementSessionId(env.sessionId),
  };
}

/** 画面の「含まれる情報 / 含まれない情報」。docs/improvement-request.md と同じ内容 */
export const IMPROVEMENT_DIAGNOSTICS_DISCLOSURE = {
  included: [
    'OS とブラウザの種類 (版番号は伏せて表示)',
    '画面の大きさと言語',
    '送信した画面のパスと記録した時刻',
    '直前に起きたエラー・警告・失敗した通信の要約 (最大 60 件、秘匿値はマスク済み)',
    'ページを開くたびに作る乱数のセッション ID (表示は末尾 4 桁)',
  ],
  excluded: [
    '明細・金額・取引先・口座の中身 (通信の本文は記録しません)',
    'パスワード・トークン・Cookie の値',
    'メールアドレス・電話番号・住所',
    'ログインしている利用者の ID',
  ],
} as const;
