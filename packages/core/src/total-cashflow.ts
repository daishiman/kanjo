/**
 * 事業と家計を合わせた月次トータル収支。
 *
 * 個人事業では事業と家計が同じ口座を通るため、freee と Money Forward の両方に同じ支払が現れる。
 * 二重に数えると「トータルでいくら出ているか」が実態より膨らみ、判断の土台にならない。
 *
 * ここでの取り決め:
 *   - 消し込みの肯定条件は「発生日が一致」かつ「金額が一致」の2つだけ。支払先は使わない
 *     (表記ゆれで別取引を同じと言い切る根拠にするには弱い)。
 *   - 一致した組は freee を正とし、事業費として1度だけ数える。MF 側は家計費から外す。
 *   - それ以外は公私仕分けの判定 (`resolveTx`) に従って事業/家計へ振り分ける。判定式は 1 本だけで、
 *     ここに中項目を読む分岐は置かない。
 *   - freee と突合できず要確認になった MF 明細は、4 つの束のいずれにも入れない。
 *   - 口座情報は候補を絞る否定条件にだけ使う (`accountsConflict`)。片側に情報が無ければガードしない。
 *   - ±3 日の近接は自動では寄せず、要確認として見せるだけに留める。
 *
 * 集計値は保存しない (dec-aggregation-strategy-001)。保存するのは利用者の判断
 * (`DuplicateVerdict`) だけで、それ以外は要求のたびにここで導出する。
 */
import { isCashTxId } from './cash.js';
import { type ResolvedTx, resolveTx } from './classify.js';
import { freeeDealKeys, mfStableKey } from './identity.js';
import { type PeriodRange, applyPeriod, previousYearPeriod } from './period.js';
import { normalizeMfDisplayDate } from './persisted-projection.js';
import { type TrendDirection, trendDirection } from './trend.js';
import type { Dataset, FreeeDeal, MfTx } from './types.js';
import { isMfCountable } from './types.js';

/** 候補抽出器が近接とみなす日数。自動付替には使わない (要確認一覧の生成にだけ用いる) */
export const REVIEW_NEAR_DAYS = 3;

/**
 * 1 件の要確認明細に並べる freee 候補の上限。
 *
 * 全件返すと同額の定額支払 (家賃・サブスク) で候補が膨れ、かえって比べられない。
 * 日付の近い順に絞る。
 */
export const REVIEW_MAX_CANDIDATES = 3;

export type DuplicateVerdictValue = 'same' | 'different';

/**
 * 利用者が「同じ取引か」を判断した結果。導出できない唯一の値であり、これだけを保存する。
 *
 * `freeeKey` は「同じ」と言ったときに、どの freee 取引と同じかを名指しするためにある。
 * 同日同額の freee 取引が複数ある場合、名指しが無いと機械が勝手に片方を選ぶことになり、
 * 利用者が見て決めた組と実際に寄る組がずれる。省略時は従来どおり近い順に選ぶ。
 */
export interface DuplicateVerdict {
  txId: string;
  verdict: DuplicateVerdictValue;
  freeeKey?: string | null;
}

/**
 * freee 側の二重登録を、理由を添えて総額から外す。
 *
 * 消し込み (MF との重複) とは別の問題である。消し込みは「同じ支払が2つの家計簿に出ている」
 * ことへの対処で、freee 側は正しい1件。こちらは freee そのものに同じ支払が2件入っている場合で、
 * 放置すると事業費が二重に膨らむ。既定では freee を正とするため、外すのは明示した分だけ。
 */
export interface FreeeExclusion {
  freeeKey: string;
  /** 表示用の理由文。`reasonCode` から引ける語だが、旧データの自由文もここに入る */
  reason: string;
  /** 定型の理由。旧データ (自由文だけ) は `'other'` として扱う */
  reasonCode?: ExclusionReasonCode;
  /** 利用者の補足。0..`EXCLUSION_MEMO_MAX` 字 */
  memo?: string;
}

/**
 * freee から除外する理由の定型。
 *
 * 自由文だけだと、同じ意味の除外が「振替」「振り替え」「口座間移動」と散らばり、
 * 後から「振替の除外はいくつあるか」に答えられない。数えられる語を先に決めておく。
 */
export const EXCLUSION_REASON_CODES = ['transfer', 'internal', 'book_only', 'duplicate', 'other'] as const;
export type ExclusionReasonCode = (typeof EXCLUSION_REASON_CODES)[number];

/** 画面と API 応答で使う表示語。`reasonCode` の唯一の正本 */
export const EXCLUSION_REASON_LABELS: Record<ExclusionReasonCode, string> = {
  transfer: '振替',
  internal: '内部移動',
  book_only: '帳簿のみ',
  duplicate: '二重登録',
  other: 'その他',
};

/** メモの上限。列を無制限にすると一覧の1行の高さが予測できなくなる */
export const EXCLUSION_MEMO_MAX = 200;

export const isExclusionReasonCode = (v: unknown): v is ExclusionReasonCode =>
  typeof v === 'string' && (EXCLUSION_REASON_CODES as readonly string[]).includes(v);

export type ReconcileReviewReason =
  | '発生日が一致しません'
  | '口座不一致'
  | '取込月と表示日の月が一致しません'
  | '対応する freee 取引が他の明細へ寄せられています';

/**
 * freee 取引1件を画面へ出す形。
 *
 * matched と freeeOnly に同じ形を使う。片方だけ列が違うと、
 * 同じ freee 取引が表によって別物に見える。
 */
export interface ReconcileFreee {
  /** `deals` 内での位置 */
  freeeIndex: number;
  /** 再取込を跨いでこの取引を指す鍵 (`freeeDealKeys`) */
  freeeKey: string;
  month: string;
  date: string;
  partner: string;
  amount: number;
  io: FreeeDeal['io'];
  account: string;
  settleAccount: string;
}

export interface ReconcileMatch {
  mfTxId: string;
  /** 寄せ先 freee 取引の `deals` 内での位置 */
  freeeIndex: number;
  freeeKey: string;
  by: 'auto' | 'user';
  /** 一致した組をそのまま並べて見せるための中身。件数だけでは正しさを確かめられない */
  mf: ReconcileReviewMf;
  freee: ReconcileFreee;
}

/**
 * 要確認一覧に出す MF 側の中身。
 *
 * 識別子と理由語だけでは「同じ取引か」を人が判断できない。判断に要るのは
 * 日付・内容・金額・口座であり、それは全て `MfTx` に既にある。
 */
export interface ReconcileReviewMf {
  /** 照合に使った発生日 (`YYYY-MM-DD`)。表示日そのものではなく取込月へ載せた後の値 */
  date: string;
  /** MF の表示日 (`MM/DD`)。`date` と食い違う場合に月ずれを目で確認できる */
  displayDate: string;
  content: string;
  /** 符号を落とした実額。向きは `io` で持つ */
  amount: number;
  io: FreeeDeal['io'];
  institution: string;
  major: string;
  middle: string;
  memo: string;
  /** 公私仕分けと同じ resolver が出した判定と根拠。 */
  cls: ResolvedTx['cls'];
  clsSrc: ResolvedTx['clsSrc'];
}

/**
 * 要確認明細に対する freee 側の候補。
 *
 * 消し込みの肯定条件 (同額かつ同日) を満たさなかった理由を人が見極められるよう、
 * 同額・同じ向きで近い日付の取引を近い順に返す。候補が0件なら「freee 側に相手がいない」
 * ことがそれ自体の答えになる。
 */
export interface ReconcileReviewCandidate {
  /** `deals` 内での位置。同じ取引を指していることを呼び出し側が確認できる */
  freeeIndex: number;
  /** どの候補と組むかを利用者が名指しして保存するための鍵 */
  freeeKey: string;
  date: string;
  partner: string;
  amount: number;
  account: string;
  settleAccount: string;
  /** freee 発生日 − MF 発生日 の日数差。0 なら日付は一致している */
  dayGap: number;
  /** この候補と MF 明細の口座が明らかに食い違うか (`accountsConflict` と同じ判定) */
  accountConflict: boolean;
  /** 一致度 0..100 (BR-001)。`duplicateMatchScore` と同じ配点 */
  score: number;
}

export interface ReconcileReview {
  mfTxId: string;
  reason: ReconcileReviewReason;
  mf: ReconcileReviewMf;
  /** 近い順に最大 `REVIEW_MAX_CANDIDATES` 件。0 件もありうる */
  candidates: ReconcileReviewCandidate[];
}

/**
 * 「取り込んだ内容に抜け漏れが無いか」に件数で答えるための内訳。
 *
 * `matched + freeeOnly + excluded === freeeTotal` が成り立つ。`mfReview` はこの和には
 * 入らない。要確認は MF 明細ごとに立つもので、freee 側の分割とは数える対象が違う。
 */
export interface FreeeCoverage {
  freeeTotal: number;
  matched: number;
  freeeOnly: number;
  excluded: number;
  mfReview: number;
}

/** 総額から外した freee 取引と、その理由 */
export interface ReconcileExcluded extends ReconcileFreee {
  /** 利用者が書いた理由。表示用の自由文 */
  reason: string;
  /** 0041: 数えられる理由。0037 以前に外した行は null */
  reasonCode: ExclusionReasonCode | null;
  /** 0041: 定型の理由だけでは足りないときの補足 */
  memo: string | null;
}

/**
 * 消し込みの結果。freee 取引は必ずこの3つのどれか1つに入る。
 *
 * `matched.length + freeeOnly.length + excluded.length === deals.length` を保つのは、
 * 「取り込んだ内容に抜け漏れが無いか」に件数で答えられるようにするためである。
 * 一部だけを見せる作りだと、映っていない残りがあるのか無いのかを利用者が確かめられない。
 */
export interface ReconcileResult {
  matched: ReconcileMatch[];
  /** MF 側の要確認。freee ではなく MF 明細ごとに1件 */
  review: ReconcileReview[];
  /** matched にも excluded にも入らない freee 側の残余 */
  freeeOnly: ReconcileFreee[];
  excluded: ReconcileExcluded[];
}

export interface TotalCashflowMonth {
  month: string;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  bizExpense: number;
  householdExpense: number;
  bizIncome: number;
  householdIncome: number;
  /**
   * `totalExpense` と同じ取引集合を、画面で読める科目粒度へ分けた内訳。
   *
   * 事業と家計で同名科目があっても意味を混ぜないよう、キーは
   * `事業 / 科目` または `家計 / 大項目` とする。古い保存済み投影やテストfixtureとの
   * 互換のため省略可能だが、`totalCashflowReport` が作る行では必ず設定する。
   */
  expenseCategories?: Record<string, number>;
  /** その月に事業費/事業収入へ寄せた MF 明細の件数 */
  shiftedCount: number;
  /**
   * その月に寄せた MF 明細の実額合計 (符号を落とした絶対値)。
   *
   * 件数だけでは「3 件寄った」が 300 円なのか 30 万円なのかが分からず、消し込みが効いているかを
   * 判断できない。freee 側の金額ではなく MF 側の実額を足すのは、この値が「家計費から外れた額」
   * を意味するためである (freee 側は元から事業費として数えており、寄せても増減しない)。
   */
  shiftedAmount: number;
  reviewCount: number;
  /**
   * 要確認の MF 明細の実額合計 (符号を落とした絶対値)。
   * `reviewCount` とまったく同じ集合から出す。件数と金額を別の集合から出すと、
   * どちらかがずれても気づけない。
   */
  reviewAmount: number;
  trend: TrendDirection;
}

/**
 * 口座名の比較用の形。銀行名だけを残し、口座種別や表記の差を落とす。
 *
 * 完全一致を求めない。MF は「三井住友銀行 普通」、freee は「三井住友」のように粒度が違い、
 * 厳密一致にすると同じ口座を別物と言ってしまう。ここは包含で足りる。
 *
 * 名前が `normalizeAccount` でないのは、そちらが `normalize.ts` にある別物 (勘定科目の
 * 正規化マップ適用) だからである。同じ名前を2つ置くと、import 一つで意味が入れ替わる。
 */
export function normalizeInstitution(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .replace(/銀行|支店|普通|当座|口座|カード/g, '')
    .toLocaleLowerCase('ja');
}

/**
 * freee の決済口座欄に入るが、口座を指していない勘定科目。
 *
 * 事業主借・事業主貸は「事業の口座ではなく事業主個人の財布で決済した」という意味の
 * 資本勘定であって、金融機関の名前ではない。これを口座名として MF の「楽天カード まりこ」と
 * 突き合わせると、同じ取引でも必ず食い違うと出る。しかも意味の上ではむしろ
 * 「MF 側に出ている個人のカードで払った」と言っており、一致を否定する材料にならない。
 *
 * 実データ (2026-01) では要確認 19 件のうち 15 件がこの比較で残り、寄った件数が 0 になった。
 */
const NOT_AN_ACCOUNT = new Set(['事業主借', '事業主貸']);

/**
 * 口座が明らかに対応しない組か。true のとき自動では寄せない。
 *
 * fail-open にしてある。情報が無い側があるときに「不一致」と言うと、口座列を持たない
 * 取込時期の明細が丸ごと寄らなくなり、二重計上が残る。ガードは分かるときだけ効かせる。
 * 口座名でない勘定科目も「分からない」側に倒す (誤って分かった気になる方が高くつく)。
 */
export function accountsConflict(mf: Pick<MfTx, 'inst'>, deal: Pick<FreeeDeal, 'settleAccount'>): boolean {
  const settle = (deal.settleAccount ?? '').normalize('NFKC').replace(/[\s　]/g, '');
  const a = normalizeInstitution(mf.inst);
  const b = NOT_AN_ACCOUNT.has(settle) ? '' : normalizeInstitution(settle);
  if (a === '' || b === '') return false;
  return !(a.includes(b) || b.includes(a));
}

/**
 * 一致度の配点 (BR-001)。合計は 0..100 の整数。
 *
 * 金額は候補に上がる条件そのもの (同額・同じ向き) なので、候補である限り必ず満点が付く。
 * 満点を配るのではなく「候補である」ことの重みを 40 として明示している。
 */
export const MATCH_SCORE_AMOUNT = 40;
/** |dayGap| が 0,1,2,3 のときの点。4 日以上は 0 (そもそも候補に入らない) */
export const MATCH_SCORE_DATE = [30, 20, 10, 5] as const;
/** 口座: 一致 / 片側に情報なし / 明らかに食い違い */
export const MATCH_SCORE_ACCOUNT = { same: 15, unknown: 8, conflict: 0 } as const;
/** 摘要: 一致 / 一方が他方を含む / それ以外 */
export const MATCH_SCORE_TEXT = { same: 15, partial: 8, none: 0 } as const;

/**
 * 「この2件は同じ取引らしいか」を 0..100 の整数で表す (BR-001)。
 *
 * 保存しない。判定の助けとして毎回計算する。保存すると、口座名の正規化規則を変えたときに
 * 古い点だけが残り、画面の数字と規則が食い違う。
 *
 * 自動で寄った組 (同額・同じ向き・発生日一致) は最小でも
 * `40 + 30 + 8 + 0 = 78` になる。仕様が「78..100 をそのまま表示」と言うのはこの下限のこと。
 *
 * 名前に `duplicate` を付けているのは、照合画面 (reconciliation.ts) の `matchScore` と
 * 別物だから。あちらは「MF の1件に対する freee の相手らしさ」を金額一致と摘要類似で測る。
 * こちらは「二重計上らしさ」を日付・口座・摘要で測る。配点も上限の意味も違うので、
 * 同じ名前で並べると片方の配点をもう片方の根拠に使う読み違いが起きる。
 */
export function duplicateMatchScore(input: {
  /** freee 発生日 − MF 発生日 の日数差。符号は結果に影響しない */
  dayGap: number;
  mfAccount: string;
  freeeAccount: string;
  mfText: string;
  freeeText: string;
}): number {
  const gap = Math.abs(Math.trunc(input.dayGap));
  const date = MATCH_SCORE_DATE[gap] ?? 0;

  const mfAcc = normalizeInstitution(input.mfAccount);
  const rawFreeeAcc = (input.freeeAccount ?? '').normalize('NFKC').replace(/[\s　]/g, '');
  const freeeAcc = NOT_AN_ACCOUNT.has(rawFreeeAcc) ? '' : normalizeInstitution(rawFreeeAcc);
  const account =
    mfAcc === '' || freeeAcc === ''
      ? MATCH_SCORE_ACCOUNT.unknown
      : mfAcc.includes(freeeAcc) || freeeAcc.includes(mfAcc)
        ? MATCH_SCORE_ACCOUNT.same
        : MATCH_SCORE_ACCOUNT.conflict;

  // 空文字は何にでも含まれてしまう。「情報が無い」を「部分一致」と読み替えないよう先に落とす
  const mfText = normalizeInstitution(input.mfText);
  const freeeText = normalizeInstitution(input.freeeText);
  const text =
    mfText === '' || freeeText === ''
      ? MATCH_SCORE_TEXT.none
      : mfText === freeeText
        ? MATCH_SCORE_TEXT.same
        : mfText.includes(freeeText) || freeeText.includes(mfText)
          ? MATCH_SCORE_TEXT.partial
          : MATCH_SCORE_TEXT.none;

  return MATCH_SCORE_AMOUNT + date + account + text;
}

/** 照合に使う MF の発生日。表示日の「日」を取込月へ載せる (`expense-projection.ts` と同じ作り) */
export const mfMatchDate = (tx: MfTx): string => `${tx.m}-${normalizeMfDisplayDate(tx.d, tx.m).slice(-2)}`;

/** 取込月と表示日の月が食い違っているか。食い違うと `mfMatchDate` が別の日を指す */
const monthMismatched = (tx: MfTx): boolean =>
  normalizeMfDisplayDate(tx.d, tx.m).slice(0, 2) !== tx.m.slice(5, 7);

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

const mfIo = (tx: MfTx): FreeeDeal['io'] => (tx.a < 0 ? 'expense' : 'income');

const bucketKey = (io: FreeeDeal['io'], date: string, amount: number): string =>
  `${io}\u0000${date}\u0000${amount}`;

/** 照合の対象になる MF 明細。現金台帳と集計対象外、分割の親行は対象にしない */
export function reconcilableMf(data: Dataset): MfTx[] {
  return data.mfTx
    .filter((tx) => !isCashTxId(tx.id) && isMfCountable(tx) && tx.a !== 0 && tx.splitProjection == null)
    .sort((a, b) => {
      // 同じ (金額, 発生日) に複数並ぶとき、どれが寄るかを入力順に左右させない。
      // stable_key は再取込を跨いで変わらないため、順序も再取込で変わらない。
      const keyDiff = mfStableKey(a).localeCompare(mfStableKey(b));
      return keyDiff !== 0 ? keyDiff : a.id.localeCompare(b.id);
    });
}

/** 要確認一覧へ出す MF 側の中身。`MfTx` から表示に要る分だけを写す */
function reviewMf(tx: MfTx, resolved: Pick<ResolvedTx, 'cls' | 'clsSrc'>): ReconcileReviewMf {
  return {
    date: mfMatchDate(tx),
    displayDate: tx.d,
    content: tx.c,
    amount: Math.abs(tx.a),
    io: mfIo(tx),
    institution: tx.inst ?? '',
    major: tx.big,
    middle: tx.mid,
    memo: tx.memo ?? '',
    cls: resolved.cls,
    clsSrc: resolved.clsSrc,
  };
}

/**
 * 同額・同じ向きで発生日が ±`REVIEW_NEAR_DAYS` 日以内の freee 取引を、日付の近い順に返す。
 *
 * 帰属は動かさない。ここで返すのは「人が見比べる材料」であって照合結果ではない。
 * 同着は `deals` の並び順で決める (安定させるため)。
 */
function nearCandidates(
  tx: MfTx,
  deals: readonly FreeeDeal[],
  keys: readonly string[],
): ReconcileReviewCandidate[] {
  const mfDay = dayNumber(mfMatchDate(tx));
  const amount = Math.abs(tx.a);
  const io = mfIo(tx);
  return deals
    .map((deal, freeeIndex) => ({ deal, freeeIndex }))
    .filter(
      ({ deal }) =>
        deal.amount === amount &&
        deal.io === io &&
        Math.abs(dayNumber(deal.date) - mfDay) <= REVIEW_NEAR_DAYS,
    )
    .map(({ deal, freeeIndex }) => ({
      freeeIndex,
      freeeKey: keys[freeeIndex],
      date: deal.date,
      partner: deal.partner,
      amount: deal.amount,
      account: deal.accountRaw,
      settleAccount: deal.settleAccount ?? '',
      dayGap: dayNumber(deal.date) - mfDay,
      accountConflict: accountsConflict(tx, deal),
      score: duplicateMatchScore({
        dayGap: dayNumber(deal.date) - mfDay,
        mfAccount: tx.inst ?? '',
        freeeAccount: deal.settleAccount ?? '',
        mfText: tx.c,
        freeeText: deal.partner,
      }),
    }))
    .sort((a, b) => Math.abs(a.dayGap) - Math.abs(b.dayGap) || a.freeeIndex - b.freeeIndex);
}

/**
 * freee と MF の二重計上を消し込む。
 *
 * freee を外側のループにするのは、寄せる上限が freee の件数だからである。MF を外側にすると
 * 「freee に無い MF 明細まで寄って消える」形を書きやすく、過小計上になる。
 */
export function reconcileBizDuplicates(
  data: Dataset,
  deals: readonly FreeeDeal[],
  verdicts: readonly DuplicateVerdict[] = [],
  exclusions: readonly FreeeExclusion[] = [],
  mfExcludedTxIds: readonly string[] = [],
): ReconcileResult {
  // 照合画面で「照合から除外する」とした明細は、自動一致にも要確認にも出さない。
  // 総額からは外さない (照合の問いから外すだけで、支出そのものは実在する)。
  const mfExcluded = new Set(mfExcludedTxIds);
  const rows = reconcilableMf(data).filter((tx) => !mfExcluded.has(tx.id));
  // 一覧と照合行で別の判定式を持たず、同じ resolveTx の結果を使い回す。
  const resolvedById = new Map(
    rows.map((tx) => [tx.id, resolveTx(tx, data.rules, data.edits, data.institutionOwners)]),
  );
  const reviewOf = (tx: MfTx): ReconcileReviewMf => reviewMf(tx, resolvedById.get(tx.id)!);
  const keys = freeeDealKeys(deals);
  const verdictByTxId = new Map(verdicts.map((v) => [v.txId, v.verdict]));
  /** 「同じ」と言った利用者が、どの freee 取引を指したか。未指定なら null */
  const pickedFreeeKey = new Map(verdicts.map((v) => [v.txId, v.freeeKey ?? null]));
  const exclusionByKey = new Map(exclusions.map((e) => [e.freeeKey, e]));
  const excludedKeys = new Set(exclusionByKey.keys());
  const freeeOf = (freeeIndex: number): ReconcileFreee => {
    const deal = deals[freeeIndex];
    return {
      freeeIndex,
      freeeKey: keys[freeeIndex],
      month: deal.month,
      date: deal.date,
      partner: deal.partner,
      amount: deal.amount,
      io: deal.io,
      account: deal.accountRaw,
      settleAccount: deal.settleAccount ?? '',
    };
  };
  const matched: ReconcileMatch[] = [];
  const usedMf = new Set<string>();

  /** 「同額同日の候補はあったが寄らなかった」理由を、寄らなかった明細ごとに覚える */
  const blocked = new Map<string, ReconcileReviewReason>();

  const eligible = rows.filter((tx) => !monthMismatched(tx));
  const byBucket = new Map<string, MfTx[]>();
  for (const tx of eligible) {
    const key = bucketKey(mfIo(tx), mfMatchDate(tx), Math.abs(tx.a));
    byBucket.set(key, [...(byBucket.get(key) ?? []), tx]);
  }

  // 第一段: 発生日と金額の一致だけで寄せる。支払先は見ない
  deals.forEach((deal, freeeIndex) => {
    if (deal.amount <= 0 || excludedKeys.has(keys[freeeIndex])) return;
    const candidates = byBucket.get(bucketKey(deal.io, deal.date, deal.amount)) ?? [];
    for (const tx of candidates) {
      if (usedMf.has(tx.id)) continue;
      if (verdictByTxId.get(tx.id) === 'different') {
        // 利用者が「違う」と言った組は、機械の一致条件が揃っていても寄せない
        continue;
      }
      // 利用者が別の freee 取引を名指ししている組は、機械の都合でここに寄せない
      const picked = pickedFreeeKey.get(tx.id);
      if (picked && picked !== keys[freeeIndex]) continue;
      if (accountsConflict(tx, deal)) {
        blocked.set(tx.id, '口座不一致');
        continue;
      }
      usedMf.add(tx.id);
      matched.push({
        mfTxId: tx.id,
        freeeIndex,
        freeeKey: keys[freeeIndex],
        by: 'auto',
        mf: reviewOf(tx),
        freee: freeeOf(freeeIndex),
      });
      return;
    }
    // 候補が全て埋まっていた場合、溢れた明細は黙って消さず要確認へ回す
    for (const tx of candidates) {
      if (!usedMf.has(tx.id) && !blocked.has(tx.id)) {
        blocked.set(tx.id, '対応する freee 取引が他の明細へ寄せられています');
      }
    }
  });

  // 第二段: 利用者が「同じ」と判断した組。freee 1 取引につき MF 1 件までに限る
  const usedFreee = new Set(matched.map((m) => m.freeeIndex));
  deals.forEach((deal, freeeIndex) => {
    if (deal.amount <= 0 || usedFreee.has(freeeIndex) || excludedKeys.has(keys[freeeIndex])) return;
    const key = keys[freeeIndex];
    const fits = (row: MfTx, named: boolean): boolean =>
      !usedMf.has(row.id) &&
      // 識別子の安定性は判断を「保存」できるかの話であり、寄せてよいかの条件ではない。
      // 不安定な明細でも stable_key で判断を引き当てられる (identity.ts の 2 段解決)。
      verdictByTxId.get(row.id) === 'same' &&
      mfIo(row) === deal.io &&
      // 相手を名指しした「同じ」は金額違いでも寄せる (照合画面の「金額の差異」で利用者が同じと認めた組)。
      // 総額には正本の freee 側の金額が残る。名指しの無い「同じ」は、どの相手かを金額で絞る
      (named || Math.abs(row.a) === deal.amount) &&
      Math.abs(dayNumber(mfMatchDate(row)) - dayNumber(deal.date)) <= REVIEW_NEAR_DAYS;
    // 名指しされた組を先に成立させる。指定なしの明細に先を越されると、
    // 利用者が画面で選んだ相手と実際に寄る相手がずれる
    const tx =
      eligible.find((row) => pickedFreeeKey.get(row.id) === key && fits(row, true)) ??
      eligible.find((row) => !pickedFreeeKey.get(row.id) && fits(row, false));
    if (!tx) return;
    usedMf.add(tx.id);
    usedFreee.add(freeeIndex);
    matched.push({
      mfTxId: tx.id,
      freeeIndex,
      freeeKey: key,
      by: 'user',
      mf: reviewOf(tx),
      freee: freeeOf(freeeIndex),
    });
  });

  const review: ReconcileReview[] = [];
  for (const tx of rows) {
    if (usedMf.has(tx.id)) continue;
    // 「違う」と判断済みの組は、同じ問いを何度も出さない (仕様: 要確認として再提示しない)
    if (verdictByTxId.get(tx.id) === 'different') continue;
    // 候補抽出器 (金額一致かつ ±3 日以内) は帰属を動かさず、要確認一覧の生成にだけ使う。
    // 理由の別なく先に引くのは、どの理由であっても「freee 側の何と比べているのか」を
    // 見せないと人が判断できないためである。
    const raw = nearCandidates(tx, deals, keys);
    // BR-005: 除外を考えずに引いた候補がちょうど1件で、それが除外済みなら要確認から出す。
    // 相手が総額から消えた以上、この明細は「二重計上かもしれない」ではなく普通の支出であり、
    // 公私仕分けで数えるのが正しい。除外を戻せばこの枝を通らなくなり自動で要確認へ戻る。
    // 候補が2件以上あった組は、どれと同じだったかを機械が名指しできないため残す。
    if (raw.length === 1 && excludedKeys.has(raw[0].freeeKey)) continue;
    const candidates = raw.filter((c) => !excludedKeys.has(c.freeeKey)).slice(0, REVIEW_MAX_CANDIDATES);
    const push = (reason: ReconcileReviewReason): void => {
      review.push({ mfTxId: tx.id, reason, mf: reviewOf(tx), candidates });
    };
    if (monthMismatched(tx)) {
      push('取込月と表示日の月が一致しません');
      continue;
    }
    const held = blocked.get(tx.id);
    if (held) {
      push(held);
      continue;
    }
    // 判定は除外前の候補数で行う。除外後の数で決めると、候補2件のうち両方を除外したときに
    // 明細ごと一覧から消える。BR-005 が review から出すと言っているのは候補1件の場合だけで、
    // 残りは候補欄が空になるだけで一覧には残さなければならない。
    if (raw.length > 0) push('発生日が一致しません');
  }

  // freee 全件を matched / freeeOnly / excluded に分ける。freeeOnly は matched にも excluded にも入らない freee 側の残余。
  // 3つの件数を足すと取り込んだ freee の件数になり、映っていない残りが無いと言える
  const freeeOnly: ReconcileFreee[] = [];
  const excluded: ReconcileExcluded[] = [];
  deals.forEach((_deal, freeeIndex) => {
    const hit = exclusionByKey.get(keys[freeeIndex]);
    if (hit !== undefined) {
      // reasonCode と memo も一緒に出す。理由を数えられる形で保存しても、
      // 読み出す側が自由文しか受け取れないなら、画面は結局その自由文を並べ直すことになる
      excluded.push({
        ...freeeOf(freeeIndex),
        reason: hit.reason,
        reasonCode: hit.reasonCode ?? null,
        memo: hit.memo ?? null,
      });
      return;
    }
    if (usedFreee.has(freeeIndex)) return;
    freeeOnly.push(freeeOf(freeeIndex));
  });

  return { matched, review, freeeOnly, excluded };
}

/**
 * 月次のトータル収入・支出・収支と、事業/家計の内訳を導出する。
 *
 * 期間の絞り込みは引数で受けない。呼び出し側が `applyPeriod` で Dataset を切ってから渡す
 * (分析関数ごとに期間引数を配ると、切り方が実装ごとにずれる)。
 */
export function monthlyTotalCashflow(
  data: Dataset,
  deals: readonly FreeeDeal[] = [],
  verdicts: readonly DuplicateVerdict[] = [],
  exclusions: readonly FreeeExclusion[] = [],
  mfExcludedTxIds: readonly string[] = [],
): TotalCashflowMonth[] {
  return rowsFrom(data, deals, reconcileBizDuplicates(data, deals, verdicts, exclusions, mfExcludedTxIds));
}

/**
 * 一覧表と要確認キューを1度の消し込みから作る。
 *
 * 一覧表の件数と要確認キューの中身は同じ消し込み結果から出さなければならない。
 * `monthlyTotalCashflow` と `reconcileBizDuplicates` を別々に呼ぶと、間に入力が差し替わったとき
 * 「要確認 1 件」と表示しながらキューが空、という食い違いが起こりうる。
 */
export function totalCashflowReport(
  data: Dataset,
  deals: readonly FreeeDeal[] = [],
  verdicts: readonly DuplicateVerdict[] = [],
  exclusions: readonly FreeeExclusion[] = [],
  mfExcludedTxIds: readonly string[] = [],
): {
  months: TotalCashflowMonth[];
  review: ReconcileReview[];
  matched: ReconcileMatch[];
  freeeOnly: ReconcileFreee[];
  excluded: ReconcileExcluded[];
  coverage: FreeeCoverage;
} {
  const result = reconcileBizDuplicates(data, deals, verdicts, exclusions, mfExcludedTxIds);
  return {
    months: rowsFrom(data, deals, result),
    review: result.review,
    matched: result.matched,
    freeeOnly: result.freeeOnly,
    excluded: result.excluded,
    coverage: {
      freeeTotal: deals.length,
      matched: result.matched.length,
      freeeOnly: result.freeeOnly.length,
      excluded: result.excluded.length,
      mfReview: result.review.length,
    },
  };
}

/**
 * 総収支の判定 (消し込み・除外・要確認) を通った 1 行。推移画面はこの行集合から数える。
 *
 * 総収支の月次値もこの行集合の和として作る。推移画面が別の選別を持つと、同じ月の支出が
 * 総収支と推移で食い違い、どちらが正しいかを利用者が決められなくなる。
 */
export interface TrendSourceRow {
  month: string;
  side: 'business' | 'household';
  io: 'income' | 'expense';
  /** freee は勘定科目、MF は解決後の大項目 */
  category: string;
  /** freee は取引先、MF は明細の内容 (名寄せしない) */
  payee: string;
  /** 正の額。収入か支出かは io が持つ */
  amount: number;
  origin: 'mf' | 'freee';
  /** MF は保有金融機関、freee は決済口座。空なら null (口座別の件数に数えない) */
  account: string | null;
  txId?: string;
}

/** freee の取引先が空の行に出す語。空文字のままだと表で行が読めない */
export const TREND_PAYEE_UNKNOWN = '(取引先なし)';

export interface TotalCashflowLedger {
  months: string[];
  rows: TrendSourceRow[];
  /** 月ごとの自動付替 (freee と突合済みの MF) と要確認の明細 */
  shifted: MfTx[];
  review: MfTx[];
}

function ledgerFrom(
  data: Dataset,
  deals: readonly FreeeDeal[],
  result: ReconcileResult,
): TotalCashflowLedger {
  const shiftedMf = new Set(result.matched.map((m) => m.mfTxId));
  const txById = new Map(data.mfTx.map((tx) => [tx.id, tx]));

  const months = [
    ...new Set([...data.months, ...deals.map((deal) => deal.month), ...data.mfTx.map((tx) => tx.m)]),
  ].sort();

  const counted = data.mfTx.filter(
    (tx) => !isCashTxId(tx.id) && isMfCountable(tx) && tx.splitProjection == null,
  );
  // 要確認は判断が付いていない。事業にも家計にも、収入にも支出にも入れない
  const reviewMf = new Set(result.review.map((r) => r.mfTxId));
  // 二重登録として外した freee 取引は、事業費にも事業収入にも入れない
  const excludedIndexes = new Set(result.excluded.map((row) => row.freeeIndex));

  // freee を先に並べる。支出内訳のキーの並び (freee の科目 → MF の大項目) を従来と変えないため
  const rows: TrendSourceRow[] = [];
  deals.forEach((deal, freeeIndex) => {
    if (deal.amount <= 0 || excludedIndexes.has(freeeIndex)) return;
    rows.push({
      month: deal.month,
      side: 'business',
      io: deal.io,
      category: deal.accountNorm || deal.accountRaw || 'その他',
      payee: deal.partner || TREND_PAYEE_UNKNOWN,
      amount: deal.amount,
      origin: 'freee',
      account: deal.settleAccount || null,
    });
  });
  for (const tx of counted) {
    // freee と突合済みの分は freee を正として数えているので、MF 側から積み増さない
    if (shiftedMf.has(tx.id) || reviewMf.has(tx.id) || tx.a === 0) continue;
    // 事業か家計かは公私仕分けと同じ resolveTx に聞く。判定式は 1 本だけにする
    const resolved = resolveTx(tx, data.rules, data.edits, data.institutionOwners);
    rows.push({
      month: tx.m,
      side: resolved.cls === 'biz' ? 'business' : 'household',
      io: tx.a < 0 ? 'expense' : 'income',
      category: resolved.big || tx.big || 'その他',
      payee: tx.c,
      amount: Math.abs(tx.a),
      origin: 'mf',
      account: tx.inst || null,
      txId: tx.id,
    });
  }

  const pick = (ids: readonly string[]): MfTx[] =>
    ids.map((id) => txById.get(id)).filter((tx): tx is MfTx => tx != null);
  return {
    months,
    rows,
    shifted: pick(result.matched.map((m) => m.mfTxId)),
    review: pick(result.review.map((r) => r.mfTxId)),
  };
}

/**
 * 総収支と同じ判定を通った行集合を返す。消し込みは 1 回だけ行う。
 *
 * `review` は同じ消し込みの要確認で、推移画面は件数と金額だけを使う (数値には含めない)。
 */
export function totalCashflowLedger(
  data: Dataset,
  deals: readonly FreeeDeal[] = [],
  verdicts: readonly DuplicateVerdict[] = [],
  exclusions: readonly FreeeExclusion[] = [],
  mfExcludedTxIds: readonly string[] = [],
): { ledger: TotalCashflowLedger; months: TotalCashflowMonth[] } {
  const result = reconcileBizDuplicates(data, deals, verdicts, exclusions, mfExcludedTxIds);
  const ledger = ledgerFrom(data, deals, result);
  return { ledger, months: monthsFromLedger(ledger) };
}

function rowsFrom(data: Dataset, deals: readonly FreeeDeal[], result: ReconcileResult): TotalCashflowMonth[] {
  return monthsFromLedger(ledgerFrom(data, deals, result));
}

function monthsFromLedger(ledger: TotalCashflowLedger): TotalCashflowMonth[] {
  const sumAbs = (rows: MfTx[]) => rows.reduce((sum, tx) => sum + Math.abs(tx.a), 0);
  const rows = ledger.months.map((month) => {
    let freeeBizExpense = 0;
    let freeeIncome = 0;
    let mfBizExpense = 0;
    let householdExpense = 0;
    let mfBizIncome = 0;
    let householdIncome = 0;
    // 総支出と同じ選別済み集合から内訳を作る。元Datasetの月次カテゴリを別に足すと、
    // 消し込み・要確認・除外が内訳だけへ反映されず、KPIと支出内訳が食い違う。
    const expenseCategories: Record<string, number> = {};
    for (const row of ledger.rows) {
      if (row.month !== month) continue;
      const biz = row.side === 'business';
      if (row.io === 'expense') {
        const label =
          row.origin === 'freee' ? `事業 / ${row.category}` : `${biz ? '事業' : '家計'} / ${row.category}`;
        expenseCategories[label] = (expenseCategories[label] ?? 0) + row.amount;
      }
      if (row.origin === 'freee') {
        if (row.io === 'expense') freeeBizExpense += row.amount;
        else freeeIncome += row.amount;
      } else if (row.io === 'expense') {
        if (biz) mfBizExpense += row.amount;
        else householdExpense += row.amount;
      } else if (biz) mfBizIncome += row.amount;
      else householdIncome += row.amount;
    }

    // 件数と金額は同じ集合から出す。別々に数えると片方だけが実数とずれても気づけない
    const shiftedInMonth = ledger.shifted.filter((tx) => tx.m === month);
    const reviewInMonth = ledger.review.filter((tx) => tx.m === month);

    const bizIncome = freeeIncome + mfBizIncome;
    const totalExpense = freeeBizExpense + mfBizExpense + householdExpense;
    const totalIncome = bizIncome + householdIncome;

    return {
      month,
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      bizExpense: freeeBizExpense + mfBizExpense,
      householdExpense,
      bizIncome,
      householdIncome,
      expenseCategories,
      shiftedCount: shiftedInMonth.length,
      shiftedAmount: sumAbs(shiftedInMonth),
      reviewCount: reviewInMonth.length,
      reviewAmount: sumAbs(reviewInMonth),
      trend: '判定不可' as TrendDirection,
    };
  });

  // トレンドは「トータル支出の系列」1本に対する判定であり、月ごとに別の判定を持たない。
  // 各行に同じ語を出すのは、どの行から読み始めても期間全体の向きが分かるようにするため。
  const direction = trendDirection(rows.map((row) => row.totalExpense));
  for (const row of rows) row.trend = direction;

  return rows;
}

/** 収入・支出・収支の3点組。総合/事業/家計で同じ形を使う */
export interface SegmentTotals {
  income: number;
  expense: number;
  balance: number;
}

/** 前年同期との差。率は前年値が 0 のとき null (0 で割らない) */
export interface SegmentChange {
  diff: number;
  rate: number | null;
}

export interface SegmentSummary extends SegmentTotals {
  /** 前年同期の値。前年側の期間に1か月でも欠けがあれば null (BR-006) */
  previousYear: SegmentTotals | null;
  change: { income: SegmentChange; expense: SegmentChange; balance: SegmentChange } | null;
}

export interface TotalCashflowSeriesRow {
  month: string;
  total: SegmentTotals;
  biz: SegmentTotals;
  household: SegmentTotals;
}

/** 「N 件中 M 件」(BR-007)。M は verdict または除外を記録済みの件数 */
export interface WorkbenchProgress {
  total: number;
  decided: number;
}

/**
 * 判定作業の3区分 (BR-002)。
 *
 * 和は `review.length + excluded.length` に一致する。区分を足しても引いても総数が変わらない
 * ことが、「映っていない作業が無い」ことの担保になる。
 */
export interface TotalCashflowWorkbench {
  duplicates: ReconcileReview[];
  needsReview: ReconcileReview[];
  excluded: ReconcileExcluded[];
  progress: {
    duplicates: WorkbenchProgress;
    needsReview: WorkbenchProgress;
    excluded: WorkbenchProgress;
  };
}

/** 自動で寄った組。一致度は 78..100 をそのまま出し 100 に丸めない (BR-003) */
export interface AutoMatch extends ReconcileMatch {
  score: number;
  /** 利用者の判定。未判定なら null */
  verdict: DuplicateVerdictValue | null;
}

export interface TotalCashflowScreen {
  period: PeriodRange;
  summary: { total: SegmentSummary; biz: SegmentSummary; household: SegmentSummary };
  series: TotalCashflowSeriesRow[];
  workbench: TotalCashflowWorkbench;
  autoMatches: AutoMatch[];
  /** 既存 API の互換フィールドの出どころ。画面の数値と同じ消し込み結果であることを型で示す */
  report: ReturnType<typeof totalCashflowReport>;
}

/** 'YYYY-MM' の期間を月キーの配列へ開く。両端を含む */
function monthsOf(range: PeriodRange): string[] {
  const out: string[] = [];
  let y = Number(range.from.slice(0, 4));
  let m = Number(range.from.slice(5, 7));
  while (`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}` <= range.to) {
    out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const zeroTotals = (): SegmentTotals => ({ income: 0, expense: 0, balance: 0 });

const addTotals = (acc: SegmentTotals, income: number, expense: number): SegmentTotals => ({
  income: acc.income + income,
  expense: acc.expense + expense,
  balance: acc.income + income - (acc.expense + expense),
});

function seriesOf(months: readonly TotalCashflowMonth[]): TotalCashflowSeriesRow[] {
  return months.map((r) => ({
    month: r.month,
    total: { income: r.totalIncome, expense: r.totalExpense, balance: r.totalBalance },
    biz: { income: r.bizIncome, expense: r.bizExpense, balance: r.bizIncome - r.bizExpense },
    household: {
      income: r.householdIncome,
      expense: r.householdExpense,
      balance: r.householdIncome - r.householdExpense,
    },
  }));
}

function sumSegment(rows: readonly SegmentTotals[]): SegmentTotals {
  return rows.reduce((acc, r) => addTotals(acc, r.income, r.expense), zeroTotals());
}

/** 差額と率。率は前年値 0 のとき null。符号は「当期 − 前年」のまま持つ */
const changeOf = (current: number, previous: number): SegmentChange => ({
  diff: current - previous,
  rate: previous === 0 ? null : (current - previous) / Math.abs(previous),
});

function summaryOf(current: SegmentTotals, previousYear: SegmentTotals | null): SegmentSummary {
  return {
    ...current,
    previousYear,
    change: previousYear
      ? {
          income: changeOf(current.income, previousYear.income),
          expense: changeOf(current.expense, previousYear.expense),
          balance: changeOf(current.balance, previousYear.balance),
        }
      : null,
  };
}

/**
 * 重複候補 (BR-002) に入る条件。
 *
 * 候補がちょうど1件で、かつ理由が日付のずれであること。候補が2件以上あるものは
 * 「どちらと同じか」を人が選ぶ必要があり、1手で済む作業と混ぜると
 * 「重複候補を片付ける」の所要時間が読めなくなる。
 */
const isDuplicateCandidate = (r: ReconcileReview): boolean =>
  r.candidates.length === 1 &&
  (r.reason === '発生日が一致しません' || r.reason === '取込月と表示日の月が一致しません');

/**
 * 画面が必要とする値を1回の消し込みからまとめて作る。
 *
 * 期間は引数で受ける。前年同期 (BR-006) が「当期とは別の期間で同じ計算をやり直した結果」で
 * ある以上、期間を Dataset の切り方だけで表せないためである。ここが `applyPeriod` を
 * 関数の内側で2回呼ぶ唯一の場所で、他の分析関数の約束 (切ってから渡す) は変えていない。
 */
export function totalCashflowScreen(
  all: Dataset,
  // 既定値を置かない。空配列を既定にすると、呼び出し側が渡し忘れたときに
  // 「freee が 0 件の月」と区別できない結果が静かに返る
  allDeals: readonly FreeeDeal[],
  verdicts: readonly DuplicateVerdict[],
  exclusions: readonly FreeeExclusion[],
  range: PeriodRange,
  // 照合画面 (0041) で突合から外した MF 明細。要確認から外すが総額には残す。
  // 既定値を置くのは、この引数だけが後から足されたもので、
  // 渡さない呼び出し = 照合の除外がまだ無かった頃と同じ振る舞いになるため
  mfExcludedTxIds: readonly string[] = [],
): TotalCashflowScreen {
  const reportFor = (r: PeriodRange): ReturnType<typeof totalCashflowReport> => {
    const sliced = applyPeriod(all, r);
    const months = new Set(sliced.months);
    return totalCashflowReport(
      sliced,
      allDeals.filter((d) => months.has(d.month)),
      verdicts,
      exclusions,
      mfExcludedTxIds,
    );
  };

  const report = reportFor(range);
  const series = seriesOf(report.months);
  const current = {
    total: sumSegment(series.map((r) => r.total)),
    biz: sumSegment(series.map((r) => r.biz)),
    household: sumSegment(series.map((r) => r.household)),
  };

  // 前年同期は「全月が揃っているとき」だけ出す。欠けた月を 0 として足すと、
  // 取込が始まる前の月まで「支出 0 だった」と読めてしまい、増減が実態と逆に出る
  const prevRange = previousYearPeriod(range);
  const known = new Set(all.months);
  const prevComplete = monthsOf(prevRange).every((m) => known.has(m));
  const prev = prevComplete ? seriesOf(reportFor(prevRange).months) : null;
  const previous = prev
    ? {
        total: sumSegment(prev.map((r) => r.total)),
        biz: sumSegment(prev.map((r) => r.biz)),
        household: sumSegment(prev.map((r) => r.household)),
      }
    : null;

  const verdictByTxId = new Map(verdicts.map((v) => [v.txId, v.verdict]));
  const ordered = [...report.review].sort(compareWorkbenchRows);
  const duplicates = ordered.filter(isDuplicateCandidate);
  const needsReview = ordered.filter((r) => !isDuplicateCandidate(r));
  const decidedIn = (rows: readonly ReconcileReview[]): number =>
    rows.filter((r) => verdictByTxId.has(r.mfTxId)).length;

  return {
    period: range,
    summary: {
      total: summaryOf(current.total, previous?.total ?? null),
      biz: summaryOf(current.biz, previous?.biz ?? null),
      household: summaryOf(current.household, previous?.household ?? null),
    },
    series,
    workbench: {
      duplicates,
      needsReview,
      excluded: report.excluded,
      progress: {
        duplicates: { total: duplicates.length, decided: decidedIn(duplicates) },
        needsReview: { total: needsReview.length, decided: decidedIn(needsReview) },
        // 除外されている時点で記録済み。N と M は必ず一致する
        excluded: { total: report.excluded.length, decided: report.excluded.length },
      },
    },
    autoMatches: report.matched
      .filter((m) => m.by === 'auto')
      .map((m) => ({
        ...m,
        score: duplicateMatchScore({
          dayGap: dayNumber(m.freee.date) - dayNumber(m.mf.date),
          mfAccount: m.mf.institution,
          freeeAccount: m.freee.settleAccount,
          mfText: m.mf.content,
          freeeText: m.freee.partner,
        }),
        verdict: verdictByTxId.get(m.mfTxId) ?? null,
      })),
    report,
  };
}

/**
 * 判定作業の一覧に出す順序。
 *
 * 仕様は順序を決めていない。ここは「利用者がどれから片付けると気分よく進むか」という
 * 設計判断であり、規則ではない。一致度の高い順にするのは、迷わず片付く組を先に出して
 * 残りを「本当に迷うものだけ」へ減らすためである。同着は発生日順、最後は id で安定させる
 * (並びが実行のたびに変わると、判定中に行が動いて誤操作になる)。
 */
function compareWorkbenchRows(a: ReconcileReview, b: ReconcileReview): number {
  const best = (r: ReconcileReview): number =>
    r.candidates.length ? Math.max(...r.candidates.map((c) => c.score)) : -1;
  return best(b) - best(a) || a.mf.date.localeCompare(b.mf.date) || a.mfTxId.localeCompare(b.mfTxId);
}
