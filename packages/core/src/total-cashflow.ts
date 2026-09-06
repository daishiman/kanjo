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
 *   - それ以外の支出は家計費。収入は MF の大項目「事業・副業」と freee 収入が事業収入、残りが家計収入。
 *   - 口座情報は候補を絞る否定条件にだけ使う (`accountsConflict`)。片側に情報が無ければガードしない。
 *   - ±3 日の近接は自動では寄せず、要確認として見せるだけに留める。
 *
 * 集計値は保存しない (dec-aggregation-strategy-001)。保存するのは利用者の判断
 * (`DuplicateVerdict`) だけで、それ以外は要求のたびにここで導出する。
 */
import { isCashTxId } from './cash.js';
import { mfStableKey } from './identity.js';
import { normalizeMfDisplayDate } from './persisted-projection.js';
import { type TrendDirection, trendDirection } from './trend.js';
import type { Dataset, FreeeDeal, MfTx } from './types.js';
import { isMfCountable } from './types.js';

/** MF の大項目がこれなら事業収入。それ以外の入金は家計収入になる */
export const BIZ_INCOME_MAJOR = '事業・副業';

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

/** 利用者が「同じ取引か」を判断した結果。導出できない唯一の値であり、これだけを保存する */
export interface DuplicateVerdict {
  txId: string;
  verdict: DuplicateVerdictValue;
}

export type ReconcileReviewReason =
  | '発生日が一致しません'
  | '口座不一致'
  | '取込月と表示日の月が一致しません'
  | '対応する freee 取引が他の明細へ寄せられています';

export interface ReconcileMatch {
  mfTxId: string;
  /** 寄せ先 freee 取引の `deals` 内での位置 */
  freeeIndex: number;
  by: 'auto' | 'user';
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
  date: string;
  partner: string;
  amount: number;
  account: string;
  settleAccount: string;
  /** freee 発生日 − MF 発生日 の日数差。0 なら日付は一致している */
  dayGap: number;
  /** この候補と MF 明細の口座が明らかに食い違うか (`accountsConflict` と同じ判定) */
  accountConflict: boolean;
}

export interface ReconcileReview {
  mfTxId: string;
  reason: ReconcileReviewReason;
  mf: ReconcileReviewMf;
  /** 近い順に最大 `REVIEW_MAX_CANDIDATES` 件。0 件もありうる */
  candidates: ReconcileReviewCandidate[];
}

export interface ReconcileResult {
  matched: ReconcileMatch[];
  review: ReconcileReview[];
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

/** 照合に使う MF の発生日。表示日の「日」を取込月へ載せる (`expense-projection.ts` と同じ作り) */
const mfMatchDate = (tx: MfTx): string => `${tx.m}-${normalizeMfDisplayDate(tx.d, tx.m).slice(-2)}`;

/** 取込月と表示日の月が食い違っているか。食い違うと `mfMatchDate` が別の日を指す */
const monthMismatched = (tx: MfTx): boolean =>
  normalizeMfDisplayDate(tx.d, tx.m).slice(0, 2) !== tx.m.slice(5, 7);

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

const mfIo = (tx: MfTx): FreeeDeal['io'] => (tx.a < 0 ? 'expense' : 'income');

const bucketKey = (io: FreeeDeal['io'], date: string, amount: number): string =>
  `${io}\u0000${date}\u0000${amount}`;

/** 照合の対象になる MF 明細。現金台帳と集計対象外、分割の親行は対象にしない */
function reconcilableMf(data: Dataset): MfTx[] {
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
function reviewMf(tx: MfTx): ReconcileReviewMf {
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
  };
}

/**
 * 同額・同じ向きで発生日が ±`REVIEW_NEAR_DAYS` 日以内の freee 取引を、日付の近い順に返す。
 *
 * 帰属は動かさない。ここで返すのは「人が見比べる材料」であって照合結果ではない。
 * 同着は `deals` の並び順で決める (安定させるため)。
 */
function nearCandidates(tx: MfTx, deals: readonly FreeeDeal[]): ReconcileReviewCandidate[] {
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
      date: deal.date,
      partner: deal.partner,
      amount: deal.amount,
      account: deal.accountRaw,
      settleAccount: deal.settleAccount ?? '',
      dayGap: dayNumber(deal.date) - mfDay,
      accountConflict: accountsConflict(tx, deal),
    }))
    .sort((a, b) => Math.abs(a.dayGap) - Math.abs(b.dayGap) || a.freeeIndex - b.freeeIndex)
    .slice(0, REVIEW_MAX_CANDIDATES);
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
): ReconcileResult {
  const rows = reconcilableMf(data);
  const verdictByTxId = new Map(verdicts.map((v) => [v.txId, v.verdict]));
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
    if (deal.amount <= 0) return;
    const candidates = byBucket.get(bucketKey(deal.io, deal.date, deal.amount)) ?? [];
    for (const tx of candidates) {
      if (usedMf.has(tx.id)) continue;
      if (verdictByTxId.get(tx.id) === 'different') {
        // 利用者が「違う」と言った組は、機械の一致条件が揃っていても寄せない
        continue;
      }
      if (accountsConflict(tx, deal)) {
        blocked.set(tx.id, '口座不一致');
        continue;
      }
      usedMf.add(tx.id);
      matched.push({ mfTxId: tx.id, freeeIndex, by: 'auto' });
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
    if (deal.amount <= 0 || usedFreee.has(freeeIndex)) return;
    const tx = eligible.find(
      (row) =>
        !usedMf.has(row.id) &&
        // 識別子の安定性は判断を「保存」できるかの話であり、寄せてよいかの条件ではない。
        // 不安定な明細でも stable_key で判断を引き当てられる (identity.ts の 2 段解決)。
        verdictByTxId.get(row.id) === 'same' &&
        mfIo(row) === deal.io &&
        Math.abs(row.a) === deal.amount &&
        Math.abs(dayNumber(mfMatchDate(row)) - dayNumber(deal.date)) <= REVIEW_NEAR_DAYS,
    );
    if (!tx) return;
    usedMf.add(tx.id);
    usedFreee.add(freeeIndex);
    matched.push({ mfTxId: tx.id, freeeIndex, by: 'user' });
  });

  const review: ReconcileReview[] = [];
  for (const tx of rows) {
    if (usedMf.has(tx.id)) continue;
    // 「違う」と判断済みの組は、同じ問いを何度も出さない (仕様: 要確認として再提示しない)
    if (verdictByTxId.get(tx.id) === 'different') continue;
    // 候補抽出器 (金額一致かつ ±3 日以内) は帰属を動かさず、要確認一覧の生成にだけ使う。
    // 理由の別なく先に引くのは、どの理由であっても「freee 側の何と比べているのか」を
    // 見せないと人が判断できないためである。
    const candidates = nearCandidates(tx, deals);
    const push = (reason: ReconcileReviewReason): void => {
      review.push({ mfTxId: tx.id, reason, mf: reviewMf(tx), candidates });
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
    if (candidates.length > 0) push('発生日が一致しません');
  }

  return { matched, review };
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
): TotalCashflowMonth[] {
  return rowsFrom(data, deals, reconcileBizDuplicates(data, deals, verdicts));
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
): { months: TotalCashflowMonth[]; review: ReconcileReview[] } {
  const result = reconcileBizDuplicates(data, deals, verdicts);
  return { months: rowsFrom(data, deals, result), review: result.review };
}

function rowsFrom(data: Dataset, deals: readonly FreeeDeal[], result: ReconcileResult): TotalCashflowMonth[] {
  const shiftedMf = new Set(result.matched.map((m) => m.mfTxId));
  const txById = new Map(data.mfTx.map((tx) => [tx.id, tx]));

  const monthOf = (txId: string): string => txById.get(txId)?.m ?? '';
  const months = [
    ...new Set([...data.months, ...deals.map((deal) => deal.month), ...data.mfTx.map((tx) => tx.m)]),
  ].sort();

  const counted = data.mfTx.filter(
    (tx) => !isCashTxId(tx.id) && isMfCountable(tx) && tx.splitProjection == null,
  );

  const rows = months.map((month) => {
    const monthDeals = deals.filter((deal) => deal.month === month && deal.amount > 0);
    const bizExpense = monthDeals
      .filter((deal) => deal.io === 'expense')
      .reduce((sum, deal) => sum + deal.amount, 0);
    const freeeIncome = monthDeals
      .filter((deal) => deal.io === 'income')
      .reduce((sum, deal) => sum + deal.amount, 0);

    // 件数と金額は同じ集合から出す。別々に数えると片方だけが実数とずれても気づけない
    const shiftedInMonth = result.matched
      .map((m) => txById.get(m.mfTxId))
      .filter((tx): tx is MfTx => tx != null && tx.m === month);

    const leftover = counted.filter((tx) => tx.m === month && !shiftedMf.has(tx.id));
    // 寄らなかった支出は全て家計費。事業費は freee を正とするため MF からは積み増さない
    const householdExpense = leftover.filter((tx) => tx.a < 0).reduce((sum, tx) => sum + Math.abs(tx.a), 0);
    const mfBizIncome = leftover
      .filter((tx) => tx.a > 0 && tx.big === BIZ_INCOME_MAJOR)
      .reduce((sum, tx) => sum + tx.a, 0);
    const householdIncome = leftover
      .filter((tx) => tx.a > 0 && tx.big !== BIZ_INCOME_MAJOR)
      .reduce((sum, tx) => sum + tx.a, 0);

    const bizIncome = freeeIncome + mfBizIncome;
    const totalExpense = bizExpense + householdExpense;
    const totalIncome = bizIncome + householdIncome;

    return {
      month,
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      bizExpense,
      householdExpense,
      bizIncome,
      householdIncome,
      shiftedCount: shiftedInMonth.length,
      shiftedAmount: shiftedInMonth.reduce((sum, tx) => sum + Math.abs(tx.a), 0),
      reviewCount: result.review.filter((r) => monthOf(r.mfTxId) === month).length,
      trend: '判定不可' as TrendDirection,
    };
  });

  // トレンドは「トータル支出の系列」1本に対する判定であり、月ごとに別の判定を持たない。
  // 各行に同じ語を出すのは、どの行から読み始めても期間全体の向きが分かるようにするため。
  const direction = trendDirection(rows.map((row) => row.totalExpense));
  for (const row of rows) row.trend = direction;

  return rows;
}
