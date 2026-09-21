/**
 * AI分析画面 (12-ai) の規則。画面・API・エージェント用トークンの検査が同じ判定を使うよう、ここで1回だけ決める。
 *
 * - 依頼の段階と進捗: 保存するのは時刻だけ (used_at / canceled_at / rejected_at / data_fetched_at / expires_at)。
 *   段階名と % は導出できるので保存しない。上から順に最初に当たったものを返す。
 * - T-番号: 利用者ごとの通し番号 seq を `T-0001` の形にする。seq の無い旧来の依頼は「旧」と作成日。
 * - 版の説明: レポート JSON の契約を変えずに、依頼の補足指示のうち利用者が書いた1行目から導く。
 * - タブの振り分け: 契約の本文を 要約 / 根拠データ / 背景仮説 / 改善提案 / 関連リンク へ写す。本文は加工しない。
 * - JSON 取り込みエラー: 実行環境の JSON.parse のメッセージに頼らず、自前の走査で最初の構文エラーの行と列を返す。
 * - 補足指示の下書き: localStorage のキーに利用者 ID を含め、上限を超える値と例外は保存せずに握る。
 *
 * 規則の表は docs/ai-screen/design-decisions.md にあり、core の契約テストの期待値と同じである。
 */

/* ======================== 段階と進捗 ======================== */

export type AiTaskStage = 'waiting' | 'running' | 'done' | 'failed' | 'canceled';

export const AI_TASK_STAGE_LABEL: Record<AiTaskStage, string> = {
  waiting: '待機中',
  running: '実行中',
  done: '完了',
  failed: '失敗',
  canceled: 'キャンセル',
};

export interface AiTaskStageInput {
  usedAt: string | null;
  canceledAt: string | null;
  expiresAt: string;
  rejectedAt: string | null;
  dataFetchedAt: string | null;
}

export interface AiTaskProgress {
  stage: AiTaskStage;
  /** 0〜100。失敗とキャンセルは進捗を持たない (null) */
  progress: number | null;
}

/**
 * 依頼の段階と進捗。優先順位は キャンセル → 完了 → 失敗 → 差し戻し → データ取得済み → 待機中。
 * 期限ちょうどの時刻 (expiresAt === now) はまだ期限内として扱う。
 */
export function aiTaskStage(t: AiTaskStageInput, now: number): AiTaskProgress {
  if (t.canceledAt) return { stage: 'canceled', progress: null };
  if (t.usedAt) return { stage: 'done', progress: 100 };
  if (Date.parse(t.expiresAt) < now) return { stage: 'failed', progress: null };
  if (t.rejectedAt) return { stage: 'running', progress: 75 };
  if (t.dataFetchedAt) return { stage: 'running', progress: 50 };
  return { stage: 'waiting', progress: 0 };
}

/** 結果を待っている段階 (取り直しとキャンセルの対象) */
export const aiTaskIsPending = (stage: AiTaskStage): boolean => stage === 'waiting' || stage === 'running';

/**
 * 依頼の段階から許可される操作を導く単一の能力表。
 * API の拒否と画面のボタン表示が別々の if を持たないために使う。
 */
export interface AiTaskCapabilities {
  cancel: boolean;
  acceptResult: boolean;
  retry: boolean;
  delete: boolean;
  openReport: boolean;
}

export function aiTaskCapabilities(stage: AiTaskStage): AiTaskCapabilities {
  const pending = stage === 'waiting' || stage === 'running';
  const retryable = stage === 'failed' || stage === 'canceled';
  return {
    cancel: pending,
    acceptResult: pending,
    retry: retryable,
    delete: retryable,
    openReport: stage === 'done',
  };
}

/** 再実行可能か。判定は能力表だけを正本にし、呼び出し側へ重複条件を持たせない。 */
export const aiTaskIsRetryable = (stage: AiTaskStage): boolean => aiTaskCapabilities(stage).retry;

/**
 * 旧来の API の `status` (done / expired / waiting)。段階から導き、別の判定を持たない。
 * キャンセルはトークンがもう使えないので expired に寄せる。
 */
export function aiTaskLegacyStatus(stage: AiTaskStage): 'done' | 'expired' | 'waiting' {
  if (stage === 'done') return 'done';
  if (stage === 'failed' || stage === 'canceled') return 'expired';
  return 'waiting';
}

/* ======================== 日付の表示 (Asia/Tokyo) ======================== */

const pad2 = (n: string): string => n.padStart(2, '0');

/**
 * 時差を足し算せず、タイムゾーンの変換は `Intl` に任せる
 * (リポジトリの他の日時表示と同じやり方に揃える)。
 */
const JST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function jstParts(iso: string): { y: string; m: string; d: string; hh: string; mm: string } | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const at: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of JST_PARTS.formatToParts(new Date(t))) at[part.type] = part.value;
  return {
    y: at.year ?? '',
    m: at.month ?? '',
    d: at.day ?? '',
    // 24 時台 (深夜 0 時を 24 と出す実装) を 00 に揃える
    hh: at.hour === '24' ? '00' : (at.hour ?? ''),
    mm: at.minute ?? '',
  };
}

/** `2026/09/10` (Asia/Tokyo) */
export function aiDateLabel(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p.y}/${pad2(p.m)}/${pad2(p.d)}` : iso;
}

/** `2026/09/10 10:18` (Asia/Tokyo) */
export function aiDateTimeLabel(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p.y}/${pad2(p.m)}/${pad2(p.d)} ${pad2(p.hh)}:${pad2(p.mm)}` : iso;
}

/** `10:22` (Asia/Tokyo) */
export function aiClockLabel(iso: string): string {
  const p = jstParts(iso);
  return p ? `${pad2(p.hh)}:${pad2(p.mm)}` : '';
}

/* ======================== T-番号 ======================== */

/** seq を4桁にゼロ埋めして `T-` を付ける。10000 以上は桁をそのまま出す。seq の無い旧来の依頼は「旧 作成日」 */
export function aiTaskDisplayId(seq: number | null, createdAt: string): string {
  if (seq == null) return `旧 ${aiDateLabel(createdAt)}`;
  return `T-${String(seq).padStart(4, '0')}`;
}

/* ======================== 期間の表示 ======================== */

const ymParts = (ym: string): { y: number; m: number } => ({
  y: Number(ym.slice(0, 4)),
  m: Number(ym.slice(5, 7)),
});

/** 両端を含む月数 */
export function aiPeriodMonths(from: string, to: string): number {
  const a = ymParts(from);
  const b = ymParts(to);
  return b.y * 12 + b.m - (a.y * 12 + a.m) + 1;
}

/** 1.依頼の対象期間: `2025年9月 - 2026年8月（1年）`。12 の倍数でなければ `（7か月）` */
export function aiPeriodRangeLabel(from: string, to: string): string {
  const a = ymParts(from);
  const b = ymParts(to);
  const n = aiPeriodMonths(from, to);
  const len = n % 12 === 0 ? `${n / 12}年` : `${n}か月`;
  return `${a.y}年${a.m}月 - ${b.y}年${b.m}月（${len}）`;
}

/** 2.実行中の依頼期間: `2025/9 - 2026/8` */
export function aiPeriodShortLabel(from: string, to: string): string {
  const a = ymParts(from);
  const b = ymParts(to);
  return `${a.y}/${a.m} - ${b.y}/${b.m}`;
}

/* ======================== 指示文の宛先 ======================== */

/**
 * プロンプトを実行してもらう相手。指示文の冒頭 1 行 (どこの Skill を読むか) だけが変わる。
 *
 * プロンプトは依頼のトークンを含み、保存しない。だから後から宛先だけ作り直すことはできず、
 * 宛先は依頼を作るときの入力として受け取る。api も web もこの型を使う。
 */
export type AiCopyTarget = 'claude_code' | 'codex';

export const AI_COPY_TARGETS: readonly AiCopyTarget[] = ['claude_code', 'codex'];

export const AI_COPY_TARGET_LABEL: Record<AiCopyTarget, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
};

/* ======================== 版の説明と依頼内容 ======================== */

export const AI_VERSION_NOTE_FIRST = '初回レポート';
export const AI_VERSION_NOTE_REANALYSIS = '最新のデータで再分析';

/**
 * 依頼フォームが機械的に付ける見出し。
 *
 * 補足指示の本文は「依頼フォームが組み立てた定型部分」と「利用者が書いた言葉」が混ざる。
 * 版の説明・依頼内容の要約に出したいのは後者だけなので、前者をここで名指しする。
 */
const AI_SUPPLEMENT_MACHINE_PREFIXES = [
  '分析の目的: ',
  'レポート量: ',
  '知りたいこと: ',
  '対象期間に起きた変化: ',
  '外部調査: ',
];

/** 定型の見出しだけで構成された行 (`[分析前ヒアリング]` のような区切りも含む) */
const AI_SUPPLEMENT_MACHINE_MARKERS = ['[分析前ヒアリング]', '[その他の補足]'];

/**
 * 補足指示のうち、利用者が自分の言葉で書いた最初の行。
 *
 * 依頼フォームは `分析の目的: …` から始まる定型文を必ず先頭に置く。これをそのまま
 * 版の説明に使うと全ての版が同じ書き出しになり、「何版目が何だったか」が読めない。
 * 機械が付けた行を飛ばし、利用者の言葉が1行も無ければ null を返す。
 */
export function aiSupplementUserLine(supplement: string | null | undefined): string | null {
  const lines = (supplement ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // 接頭辞付きの行は中身も選択肢から選んだ定型文 (目的・レポート量・知りたいこと) なので、
  // 接頭辞だけ剥がして使わず行ごと飛ばす。残るのは利用者が自由記述で書いた行だけになる。
  return (
    lines.find(
      (line) =>
        !AI_SUPPLEMENT_MACHINE_MARKERS.includes(line) &&
        !AI_SUPPLEMENT_MACHINE_PREFIXES.some((prefix) => line.startsWith(prefix)),
    ) ?? null
  );
}

/** 版履歴の1行。利用者の言葉の1行目、無ければ v1 は「初回レポート」、v2 以降は「最新のデータで再分析」 */
export function aiVersionNote(supplement: string | null | undefined, version: number): string {
  return (
    aiSupplementUserLine(supplement) ?? (version <= 1 ? AI_VERSION_NOTE_FIRST : AI_VERSION_NOTE_REANALYSIS)
  );
}

/* ======================== タブの振り分け ======================== */

export type AiReportTab = 'summary' | 'evidence' | 'context' | 'improvements' | 'links';

export const AI_REPORT_TABS: readonly AiReportTab[] = [
  'summary',
  'evidence',
  'context',
  'improvements',
  'links',
];

export const AI_REPORT_TAB_LABEL: Record<AiReportTab, string> = {
  summary: '要約',
  evidence: '根拠データ',
  context: '背景仮説',
  improvements: '改善提案',
  links: '関連リンク',
};

export const isAiReportTab = (v: unknown): v is AiReportTab =>
  typeof v === 'string' && (AI_REPORT_TABS as readonly string[]).includes(v);

type Priority = 'high' | 'mid' | 'low' | null;

/** タブの振り分けが読む最小の形 (契約 v3 の AiReportBody と構造的に一致する) */
export interface AiReportFindingLike {
  label: string;
  fact: string;
  action: string;
  priority: Priority;
}

export interface AiReportBodyLike<F extends AiReportFindingLike, C, S, U, N, X = unknown> {
  summary: string;
  keyFindings: { improvements: F[]; wasted: F[]; quickWins: F[] };
  charts: C[];
  sections: S[];
  dataGaps: string[];
  followUp: U | null;
  needs: N[];
  contextAnalysis?: X;
}

export interface AiReportTabsView<F extends AiReportFindingLike, C, S, U, N, X> {
  summary: {
    summary: string;
    highlights: { label: string; fact: string }[];
    actions: string[];
  };
  evidence: { charts: C[]; sections: S[]; dataGaps: string[] };
  context: X | null;
  improvements: {
    keyFindings: { improvements: F[]; wasted: F[]; quickWins: F[] };
    followUp: U | null;
  };
  links: { needs: N[] };
}

const PRIORITY_RANK: Record<string, number> = { high: 0, mid: 1, low: 2 };
const rankOf = (p: Priority): number => (p ? (PRIORITY_RANK[p] ?? 3) : 3);

/** 3分類を1列に並べ、priority が high → mid → low → null の順 (同順位は配列の順) で上位 n 件 */
export function aiTopFindings<F extends AiReportFindingLike>(
  k: { improvements: F[]; wasted: F[]; quickWins: F[] },
  n = 3,
): F[] {
  return [...k.improvements, ...k.wasted, ...k.quickWins]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rankOf(a.f.priority) - rankOf(b.f.priority) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.f);
}

export function aiReportTabs<F extends AiReportFindingLike, C, S, U, N, X = unknown>(
  body: AiReportBodyLike<F, C, S, U, N, X>,
): AiReportTabsView<F, C, S, U, N, X> {
  const top = aiTopFindings(body.keyFindings);
  return {
    summary: {
      summary: body.summary,
      highlights: top.map((f) => ({ label: f.label, fact: f.fact })),
      actions: top.map((f) => f.action).filter((a) => a.trim().length > 0),
    },
    evidence: { charts: body.charts, sections: body.sections, dataGaps: body.dataGaps },
    context: body.contextAnalysis ?? null,
    improvements: { keyFindings: body.keyFindings, followUp: body.followUp },
    links: { needs: body.needs },
  };
}

/* ======================== JSON 取り込みエラーの行と位置 ======================== */

export interface JsonErrorPosition {
  /** 1 始まり */
  line: number;
  /** 1 始まり */
  column: number;
}

/**
 * 入力を JSON (RFC 8259) として走査し、最初の構文エラーの位置を返す。正しい JSON なら null。
 * 入力の終わりで途切れた場合は、最後の文字の次を位置とする。
 */
export function jsonErrorPosition(text: string): JsonErrorPosition | null {
  let i = 0;
  const n = text.length;
  class Stop extends Error {}
  const fail = (): never => {
    throw new Stop();
  };
  const ws = () => {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else break;
    }
  };
  const lit = (word: string) => {
    for (const ch of word) {
      if (text[i] !== ch) fail();
      i++;
    }
  };
  const digits = () => {
    const s = i;
    while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    if (i === s) fail();
  };
  const num = () => {
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else if (text[i] >= '1' && text[i] <= '9') digits();
    else fail();
    if (text[i] === '.') {
      i++;
      digits();
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      digits();
    }
  };
  const str = () => {
    i++; // 開きの "
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return;
      }
      if (c < ' ') fail(); // 制御文字 (生の改行を含む)
      if (c === '\\') {
        i++;
        const e = text[i];
        if (e === 'u') {
          i++;
          for (let k = 0; k < 4; k++) {
            if (!/[0-9a-fA-F]/.test(text[i] ?? '')) fail();
            i++;
          }
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) fail();
        i++;
        continue;
      }
      i++;
    }
    fail();
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        str();
        ws();
        if (text[i] !== ':') fail();
        i++;
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return;
        }
        fail();
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return;
        }
        fail();
      }
    }
    if (c === '"') str();
    else if (c === 't') lit('true');
    else if (c === 'f') lit('false');
    else if (c === 'n') lit('null');
    else if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) num();
    else fail();
  };
  try {
    value();
    ws();
    if (i < n) fail();
    return null;
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const upto = text.slice(0, Math.min(i, n));
    const lines = upto.split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }
}

/** 取り込み欄に出す文。入力は消さない */
export const aiJsonErrorMessage = (p: JsonErrorPosition): string =>
  `JSONの形式が正しくありません。${p.line}行目で不正な文字があります。入力内容は保持されています。修正後、再度取り込んでください。`;

/* ======================== 補足指示の下書き ======================== */

/** 補足指示の上限字数 (契約の supplement と同じ) */
export const AI_SUPPLEMENT_MAX = 1000;

export const aiDraftKey = (userId: string): string => `kanjo:ai:supplement-draft:${userId}`;

export interface AiDraft {
  text: string;
  savedAt: string;
}

/** localStorage と同じ形。テストでは Map で代用する */
export interface AiDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 保存できたら保存した下書きを返す。上限超過・例外は保存せず null (画面は止めない) */
export function saveAiDraft(
  storage: AiDraftStorage | null,
  userId: string,
  text: string,
  now: string,
): AiDraft | null {
  if (!storage || text.length > AI_SUPPLEMENT_MAX) return null;
  try {
    if (text.length === 0) {
      storage.removeItem(aiDraftKey(userId));
      return null;
    }
    const draft: AiDraft = { text, savedAt: now };
    storage.setItem(aiDraftKey(userId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function loadAiDraft(storage: AiDraftStorage | null, userId: string): AiDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(aiDraftKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AiDraft>;
    if (typeof v.text !== 'string' || typeof v.savedAt !== 'string' || v.text.length > AI_SUPPLEMENT_MAX)
      return null;
    return { text: v.text, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function clearAiDraft(storage: AiDraftStorage | null, userId: string): void {
  try {
    storage?.removeItem(aiDraftKey(userId));
  } catch {
    /* 消せなくても次の保存で上書きされる */
  }
}

/* ======================== レポートの量 ======================== */

/** 依頼時に選ぶレポートの量。依頼・レポートの条件表・本文の折りたたみが同じ語で揃う */
export type AiAnalysisDepth = 'concise' | 'standard' | 'detailed';

/** 受け取った値がレポート量として妥当かを判定する側 (api の契約検証) が使う、値の全集合 */
export const AI_ANALYSIS_DEPTHS = [
  'concise',
  'standard',
  'detailed',
] as const satisfies readonly AiAnalysisDepth[];

/** 短い名。条件表や補足指示の要約など、説明を付ける余地がないところで使う */
export const AI_ANALYSIS_DEPTH_LABEL: Record<AiAnalysisDepth, string> = {
  concise: '簡潔',
  standard: '標準',
  detailed: '詳細',
};

/** 依頼の選択肢。選ぶ前に何が変わるか分かるよう、短い名に説明を添える */
export const AI_ANALYSIS_DEPTH_CHOICES: { id: AiAnalysisDepth; label: string }[] = [
  { id: 'concise', label: `${AI_ANALYSIS_DEPTH_LABEL.concise}（主要論点だけ）` },
  { id: 'standard', label: `${AI_ANALYSIS_DEPTH_LABEL.standard}（おすすめ）` },
  { id: 'detailed', label: `${AI_ANALYSIS_DEPTH_LABEL.detailed}（対立仮説・限界も詳しく）` },
];

/* ======================== レポート一覧の検索 ======================== */

/** 照合用の形。NFKC で全角半角を揃え、小文字にする */
const searchKey = (value: string): string => value.normalize('NFKC').toLocaleLowerCase('ja');

/** レポート名・要約・対象期間に対する、大文字小文字・全角半角を区別しない部分一致 */
export function aiReportMatches(
  r: { title: string; summary?: string; label: string },
  query: string,
): boolean {
  const q = searchKey(query.trim());
  if (!q) return true;
  return (
    searchKey(r.title).includes(q) || searchKey(r.summary ?? '').includes(q) || searchKey(r.label).includes(q)
  );
}

/* ======================== 選択中の既定 ======================== */

/** 既定の選択: 実行中 → 待機中 → 最新の完了 の順で最初の1件。tasks は新しい順 */
export function aiDefaultSelectedTask<T extends { stage: AiTaskStage }>(tasks: T[]): T | null {
  return (
    tasks.find((t) => t.stage === 'running') ??
    tasks.find((t) => t.stage === 'waiting') ??
    tasks.find((t) => t.stage === 'done') ??
    null
  );
}

/**
 * 「使用データを確認」で開く依頼。表示中の期間と同じ期間の依頼だけを対象に、
 * 既定の選択と同じ順で 1 件選ぶ。
 *
 * 利用者に依頼を選ばせない。期間が同じなら AI へ渡した集計値も同じなので、
 * どの依頼を開いても「この期間で渡すデータ」は変わらない。
 */
export function aiDatasetSourceTask<T extends { stage: AiTaskStage; period: { from: string; to: string } }>(
  tasks: T[],
  range: { from: string; to: string } | null,
): T | null {
  if (!range) return null;
  return aiDefaultSelectedTask(tasks.filter((t) => t.period.from === range.from && t.period.to === range.to));
}
