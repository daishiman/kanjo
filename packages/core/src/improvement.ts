/**
 * 改善要望に添える診断情報の型・マスク規則・上限。
 *
 * ここを core に置くのは、同じ規則を「収集するブラウザ側」と「受け取るサーバ側」の
 * 両方から呼ぶため。architecture が要求する二重マスクは、別実装を2つ書くことではなく、
 * 同一の規則を2つの信頼境界で適用することを指す。クライアント側のマスクは改竄可能な
 * 経路なので、サーバは受け取った値へもう一度同じ関数を通す。
 */

/** 診断1件の種別。DevTools の Console / Network に出るもののうち、原因調査に効くものだけを採る */
export type DiagnosticKind = 'error' | 'unhandledrejection' | 'console_error' | 'console_warn' | 'network';

export const DIAGNOSTIC_KINDS: readonly DiagnosticKind[] = [
  'error',
  'unhandledrejection',
  'console_error',
  'console_warn',
  'network',
];

/** 診断1件。本文(レスポンスbody)は持たない。金融明細が診断経路へ漏れるのを構造で防ぐ */
export interface DiagnosticEntry {
  /** 発生時刻(ISO8601) */
  at: string;
  kind: DiagnosticKind;
  /** 1行要約。例外の message、通信なら "GET /api/summary 500" */
  message: string;
  /** 補助情報。スタックの先頭数行や発生画面。無ければ空文字 */
  detail: string;
}

/** 実行環境。UAとビューポートだけ。ここに識別子を足さない */
export interface DiagnosticEnvironment {
  userAgent: string;
  language: string;
  viewport: string;
  route: string;
  capturedAt: string;
}

export interface DiagnosticPayload {
  environment: DiagnosticEnvironment;
  entries: DiagnosticEntry[];
  /** 上限で捨てた件数。0でも省略しない(「捨てていない」ことを明示するため) */
  omittedCount: number;
}

/**
 * 保持件数の上限。
 *
 * 原因の手掛かりは直近に集まる。60件あれば「操作 → 失敗した通信 → 例外」の連鎖が
 * 数往復ぶん残る。これ以上増やしても指示文の情報量が膨らむだけで、読み手(エージェント)の
 * 見落としが増える。
 */
export const DIAGNOSTIC_MAX_ENTRIES = 60;

/**
 * 保持する総バイトの上限。
 *
 * 32KB は、指示文と一緒に貼り付けても文脈窓を圧迫しない量として採る。
 * 件数上限だけでは、1件が巨大なスタックトレースだった場合に全体が膨らむ。
 */
export const DIAGNOSTIC_MAX_BYTES = 32 * 1024;

/** 1件あたりの上限。長大なスタックが1件で枠を食い潰すのを防ぐ */
export const DIAGNOSTIC_MAX_MESSAGE = 400;
export const DIAGNOSTIC_MAX_DETAIL = 800;

/** 添付(スクリーンショット・診断)の保持日数。対応完了からの日数で数える */
export const IMPROVEMENT_RETENTION_DAYS = 30;

/** 使い捨てトークンの有効期間。AI分析と同じ24時間 */
export const IMPROVEMENT_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

/** 取得回数の上限。指示文は貼り直しがあるので1回では足りないが、無制限にもしない */
export const IMPROVEMENT_TOKEN_MAX_FETCH = 20;

/** スクリーンショットの受入上限(バイト)。縮小後の JPEG は通常 200KB 前後 */
export const IMPROVEMENT_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;

export const IMPROVEMENT_TITLE_MAX = 120;
export const IMPROVEMENT_BODY_MAX = 4000;

const MASK = '***';

/**
 * 秘匿値のマスク規則。
 *
 * 「消しすぎて原因が分からなくなる」と「残しすぎて漏れる」の間を取る。
 * URL のパスは残し(どのAPIで失敗したかが要る)、クエリの値だけ落とす。
 * 金額そのものは診断に載せない設計なので、ここでは桁の長い数字列(口座・カード番号)を潰す。
 */
const MASK_RULES: readonly { re: RegExp; to: string }[] = [
  // Authorization ヘッダーとトークン原文。prefix は残す(どの種類かは調査に要る)
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, to: `Bearer ${MASK}` },
  { re: /\bkjo_[A-Za-z0-9._-]+/g, to: `kjo_${MASK}` },
  { re: /\bimp_[A-Za-z0-9._-]+/g, to: `imp_${MASK}` },
  // JWT(3セグメント)。Cloudflare Access のトークンが URL やログに載る経路がある
  { re: /\beyJ[A-Za-z0-9._-]{10,}/g, to: MASK },
  // Cookie 一式。セッション名を残すと「認証が切れていた」が読める
  { re: /\b(kanjo_session|CF_Authorization)=[^;\s]+/g, to: `$1=${MASK}` },
  // key=value / "key": "value" 形式の秘匿キー。
  // キー名の直後の `"` を $2 に含めるのは、console.error(obj) の JSON 形式が
  // 診断情報で最も多い形だから。ここを取りこぼすと平文が素通りする
  {
    re: /\b(password|passwd|token|secret|api[_-]?key|authorization)\b("?\s*[:=]\s*)("?)[^"&\s,}]+\3/gi,
    to: `$1$2"${MASK}"`,
  },
  // メールアドレス
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, to: MASK },
  // 10桁以上の連続数字(口座番号・カード番号・電話)。日付や金額はこの桁数に達しない
  { re: /\b\d[\d-]{9,}\b/g, to: MASK },
];

/** URL のクエリ値を落とす。パスとキー名は残す(どこで何を指定して失敗したかが要るため) */
function maskQuery(text: string): string {
  return text.replace(/\?[^\s"']*/g, (query) =>
    query.replace(/([?&])([^=&]+)=([^&]*)/g, (_m, sep: string, key: string) => `${sep}${key}=${MASK}`),
  );
}

/**
 * 文字列から秘匿値を落とす。
 *
 * 冪等であること(既にマスク済みの文字列を通しても変わらない)を前提に、サーバ側で
 * もう一度掛ける。純関数なので web / api の双方から同じ結果が得られる。
 */
export function redactSecrets(text: string): string {
  let out = maskQuery(text);
  for (const rule of MASK_RULES) out = out.replace(rule.re, rule.to);
  return out;
}

/** 表示・保存の前に1件を正規化する。長さ切り詰めとマスクをここに集約する */
export function normalizeDiagnosticEntry(entry: DiagnosticEntry): DiagnosticEntry {
  return {
    at: entry.at,
    kind: entry.kind,
    message: redactSecrets(entry.message).slice(0, DIAGNOSTIC_MAX_MESSAGE),
    detail: redactSecrets(entry.detail).slice(0, DIAGNOSTIC_MAX_DETAIL),
  };
}

/** JSON にしたときのバイト数。上限判定の基準を「保存される形」に揃える */
export function diagnosticEntryBytes(entry: DiagnosticEntry): number {
  return new TextEncoder().encode(JSON.stringify(entry)).length;
}

export interface TrimResult {
  entries: DiagnosticEntry[];
  /** 上限で捨てた件数 */
  omittedCount: number;
}

/**
 * 件数上限と総バイト上限の双方で切り詰める。新しい順に残し、古いものから捨てる。
 *
 * 片方だけの上限では必ず漏れがある。件数だけなら巨大な1件が、バイトだけなら
 * 極小の大量件数が通ってしまう。両方を課したうえで、捨てた件数を返して
 * 「黙って捨てない」を守る。
 *
 * @param entries 収集順(古い→新しい)の診断
 * @returns 残した診断(古い→新しい)と、捨てた件数
 */
export function trimDiagnostics(
  entries: readonly DiagnosticEntry[],
  limits: { maxEntries?: number; maxBytes?: number } = {},
): TrimResult {
  const maxEntries = limits.maxEntries ?? DIAGNOSTIC_MAX_ENTRIES;
  const maxBytes = limits.maxBytes ?? DIAGNOSTIC_MAX_BYTES;
  const kept: DiagnosticEntry[] = [];
  let bytes = 0;
  // 新しいものほど原因に近い。末尾から詰めて、入らなくなった時点で止める
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (kept.length >= maxEntries) break;
    const normalized = normalizeDiagnosticEntry(entries[i]);
    const size = diagnosticEntryBytes(normalized);
    if (bytes + size > maxBytes) break;
    bytes += size;
    kept.push(normalized);
  }
  kept.reverse();
  return { entries: kept, omittedCount: entries.length - kept.length };
}

/** 受信した診断payloadをサーバ側でもう一度マスク・切り詰めする。omittedCountは合算する */
export function sanitizeDiagnosticPayload(payload: DiagnosticPayload): DiagnosticPayload {
  const trimmed = trimDiagnostics(payload.entries);
  return {
    environment: {
      userAgent: redactSecrets(payload.environment.userAgent).slice(0, 300),
      language: redactSecrets(payload.environment.language).slice(0, 40),
      viewport: redactSecrets(payload.environment.viewport).slice(0, 40),
      route: redactSecrets(payload.environment.route).slice(0, 200),
      capturedAt: payload.environment.capturedAt,
    },
    entries: trimmed.entries,
    omittedCount: Math.max(0, payload.omittedCount) + trimmed.omittedCount,
  };
}

/* -------- 「問題点」の絞り込み -------- */

/** 先に見せる1件。reason は画面にそのまま出るので、利用者の言葉で短く書く */
export interface DiagnosticHighlight {
  entry: DiagnosticEntry;
  reason: string;
}

/** 先に見せる件数の既定。多いと結局読まれないので、目に入る数に留める */
export const DIAGNOSTIC_HIGHLIGHT_LIMIT = 3;

/**
 * 種別の重さ。
 *
 * 例外(error / unhandledrejection)は「その場で処理が止まった」証拠なので最上位。
 * 通信の失敗はその次 — 画面が空になる原因の大半はここで、かつ宛先と状態コードが
 * そのまま調査の入口になる。console_error は「拾われた例外」なので一段軽く、
 * console_warn は動いている最中にも出るため最下位に置く。
 */
const KIND_WEIGHT: Record<DiagnosticKind, number> = {
  error: 100,
  unhandledrejection: 100,
  network: 70,
  console_error: 50,
  console_warn: 10,
};

const KIND_REASON: Record<DiagnosticKind, string> = {
  error: '処理がここで止まっています',
  unhandledrejection: '処理がここで止まっています',
  network: '通信が失敗しています',
  console_error: 'エラーとして記録されています',
  console_warn: '警告として記録されています',
};

/**
 * 記録の中から「問題点」として先に見せる数件を選ぶ。
 *
 * 全件は折りたたみの中に出しているが、60件並んだ一覧は読まれない。
 * 送る側にも、受け取る側にも、最初に目を向けるべき数件が要る。
 *
 * ここは core に置く。画面(送信前の確認)と指示文(エージェントへの入口)の
 * 両方が同じ「何が問題か」を指していないと、送った人と直す人の話が食い違う。
 */
export function highlightDiagnostics(
  entries: readonly DiagnosticEntry[],
  limit: number = DIAGNOSTIC_HIGHLIGHT_LIMIT,
): DiagnosticHighlight[] {
  if (entries.length === 0 || limit <= 0) return [];

  /*
   * 同じ message は1件に畳む。同一の失敗が再試行で10回並ぶことは珍しくなく、
   * 畳まないと上位3件が全部同じ行で埋まる。畳んだ回数はそれ自体が情報なので
   * reason に出す(「何度も起きている」は「一度だけ起きた」より重い)。
   * 代表は最後に見た1件 — 押す直前に近いほうが再現条件に近い。
   */
  const groups = new Map<string, { entry: DiagnosticEntry; count: number; lastIndex: number }>();
  entries.forEach((entry, index) => {
    const key = `${entry.kind} ${entry.message}`;
    const found = groups.get(key);
    if (found) {
      found.count += 1;
      found.entry = entry;
      found.lastIndex = index;
    } else {
      groups.set(key, { entry, count: 1, lastIndex: index });
    }
  });

  /*
   * 並べ替えの軸は「種別の重さ」が主、「新しさ」が従。
   * 新しさを主にすると、直前に出た警告1件が例外を押しのける。逆に種別だけで見ると、
   * 画面を開いた瞬間の古い例外が、いま押した操作の失敗より上に来る。
   * 新しさは entries 内の位置で測る。時刻文字列の解析を挟まずに済み、
   * 同一ミリ秒の並びでも記録された順が保たれる(entries は昇順)。
   */
  const total = entries.length;
  const ranked = [...groups.values()].sort((a, b) => {
    const byKind = KIND_WEIGHT[b.entry.kind] - KIND_WEIGHT[a.entry.kind];
    if (byKind !== 0) return byKind;
    return b.lastIndex - a.lastIndex;
  });

  return ranked.slice(0, limit).map((g) => {
    const parts = [KIND_REASON[g.entry.kind]];
    if (g.count > 1) parts.push(`${g.count}回起きています`);
    // 末尾に近いものだけ「直前」と言う。全件に付けると目印にならない
    if (g.lastIndex >= total - 3) parts.push('押す直前の記録です');
    return { entry: g.entry, reason: parts.join(' / ') };
  });
}

/* -------- 使い捨てトークンの原始関数 -------- */

/**
 * エージェント用トークンの発行とハッシュ化。
 *
 * AI分析(kjo_)と改善要望(imp_)は prefix だけが違う同じ方式 —
 * 32バイトの乱数を base64url にし、原文は発行時の1回だけ返して、
 * 保存するのは SHA-256 の16進だけ。同じ方式を2箇所に書くと、
 * 片方だけ乱数長を縮めたりハッシュを省いたりする改変が起きても
 * どちらも「動く」ため気づけない。規則の正本をここ1つにする。
 *
 * prefix を引数にするのは、取り違え防止のために種別ごとに変えたいから。
 * 診断のマスク規則(MASK_RULES)は prefix 単位で書かれているので、
 * 新しい prefix を足すときはそちらにも規則を1行足す。
 */
export function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 保存・照合に使う SHA-256 の16進表現。原文とハッシュを取り違えないよう戻り値は常に64桁 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 新しいトークンの原文。呼び出し元は画面へ1回返すだけで、保存は sha256Hex の結果だけにする */
export function mintAgentToken(prefix: string): string {
  return prefix + toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** 改善要望のトークン prefix。AI分析の kjo_ と取り違えないよう別にする */
export const IMPROVEMENT_TOKEN_PREFIX = 'imp_';

/** 改善要望の対応状態 */
export type ImprovementStatus = 'open' | 'in_progress' | 'done' | 'wontfix';

export const IMPROVEMENT_STATUS_VALUES: readonly ImprovementStatus[] = [
  'open',
  'in_progress',
  'done',
  'wontfix',
];

export const IMPROVEMENT_STATUS_LABEL: Record<ImprovementStatus, string> = {
  open: '未対応',
  in_progress: '対応中',
  done: '対応済み',
  wontfix: '対応しない',
};

/** スクリーンショットのR2キー。ユーザ配下に閉じ、添付と同じ命名規則に合わせる */
export const improvementScreenshotR2Key = (userId: string, requestId: string): string =>
  `improvements/${userId}/${requestId}.jpg`;

/**
 * 添付の失効時刻。対応完了(done)からの経過で数える。
 * 未完了(doneAt が null)なら失効しない — 調査中に証跡が消えるのは本末転倒なため。
 */
export function improvementPurgeDueAt(doneAt: string | null): string | null {
  if (!doneAt) return null;
  const base = Date.parse(doneAt);
  if (Number.isNaN(base)) return null;
  return new Date(base + IMPROVEMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** いま時点で添付を消すべきか。削除ジョブとGET詳細の両方から同じ判定を使う */
export function improvementAttachmentExpired(doneAt: string | null, now: string): boolean {
  const due = improvementPurgeDueAt(doneAt);
  return due !== null && Date.parse(now) >= Date.parse(due);
}
