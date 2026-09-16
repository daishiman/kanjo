/**
 * 照合画面 (/analysis/reconciliation) の導出。
 *
 * freee を税務の正本に保ったまま、Money Forward の明細 1 件ずつに「照合済み / 要確認 / 未処理 / MFのみ / 除外」を
 * 付け、利用者が次に何を片付ければよいかを件数と理由で示す。
 *
 * 取り決め (docs/reconciliation/architecture-decision.md):
 *   - 二重計上の判定器は `reconcileBizDuplicates` 1 本だけを使う。ここで一致条件を持ち直すと、
 *     総収支・支出分析ハブ・概況と照合画面で要確認の件数が食い違う。
 *   - 一致度と内容の類似度は「人が見比べる材料」であり、自動一致の条件には使わない。
 *   - 集計値は保存しない。保存するのは利用者の判断 (同じ / 別 / 除外) と操作履歴だけ。
 *   - freee に相手の無い MF の事業支出は「MFのみ」とし、利用者に対応を求めない。総収支は freee と組まなかった
 *     MF 明細を MF の金額のまま数えるので、支出は漏れも二重計上もしていない。対応が要るのは、総額から一時的に
 *     外している要確認と、金額違いの相手が見つかった未処理だけである。
 */
import { isCashTxId } from './cash.js';
import { resolveTx } from './classify.js';
import { freeeDealKeys } from './identity.js';
import {
  type DuplicateVerdict,
  type FreeeExclusion,
  REVIEW_NEAR_DAYS,
  type ReconcileFreee,
  type ReconcileReviewMf,
  type ReconcileReviewReason,
  mfMatchDate,
  reconcilableMf,
  reconcileBizDuplicates,
} from './total-cashflow.js';
import type { Dataset, FreeeDeal, MfTx } from './types.js';

export const RECONCILIATION_STATUSES = ['unprocessed', 'review', 'matched', 'mfOnly', 'excluded'] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

/**
 * 画面に出す状態名。
 *
 * - 対応が要る: 要確認 (同額の候補があり総額から外している) / 未処理 (金額違いの相手が見つかった)
 * - 対応が要らない: 照合済み / MFのみ (freee に相手が無く、MF の金額で総収支に計上済み) / 除外
 */
export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  unprocessed: '未処理',
  review: '要確認',
  matched: '照合済み',
  mfOnly: 'MFのみ',
  excluded: '除外',
};

/** 利用者の対応を待つ状態。対応キューの件数・解消率の分母・月次クローズはこの 2 つだけを数える */
export const RECONCILIATION_PENDING_STATUSES: readonly ReconciliationStatus[] = ['review', 'unprocessed'];

export const RECONCILIATION_QUEUES = ['review', 'mfOnly', 'amountMismatch', 'nearDate'] as const;
export type ReconciliationQueue = (typeof RECONCILIATION_QUEUES)[number];

export const RECONCILIATION_QUEUE_LABELS: Record<ReconciliationQueue, string> = {
  review: '要確認の候補',
  mfOnly: 'MFのみの支出',
  amountMismatch: '金額の差異',
  nearDate: '日付の近い取引',
};

/** 照合画面で「照合から除外する」とした MF 明細 */
export interface MfExclusion {
  txId: string;
  reason: string;
}

/** 内容が「類似」とみなす Dice 係数の下限。ちょうど 0.5 は類似に含める */
export const CONTENT_SIMILARITY_THRESHOLD = 0.5;

/** 比較用の形。NFKC で全角半角を揃え、空白を落とし、小文字にする */
export function normalizeContent(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .toLocaleLowerCase('ja');
}

/** 文字 bigram を多重集合で数える。「ああああ」は「ああ」が 3 つ */
function bigrams(text: string): Map<string, number> {
  const chars = [...text];
  const counts = new Map<string, number>();
  for (let i = 0; i < chars.length - 1; i++) {
    const gram = chars[i]! + chars[i + 1]!;
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** 共通 bigram 数と、両側の bigram 総数。類似判定を整数で行うために分けて返す */
function bigramOverlap(a: string, b: string): { common: number; na: number; nb: number } {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let common = 0;
  for (const [gram, count] of ga) common += Math.min(count, gb.get(gram) ?? 0);
  const total = (grams: Map<string, number>) => [...grams.values()].reduce((sum, n) => sum + n, 0);
  return { common, na: total(ga), nb: total(gb) };
}

/**
 * 内容 (MF の内容と freee の取引先) の類似度。文字 bigram の Dice 係数 0〜1。
 *
 * 片方でも正規化後 2 文字未満なら bigram が作れないので、正規化後の完全一致だけで 1 か 0 を返す。
 */
export function contentSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  if ([...na].length < 2 || [...nb].length < 2) return na !== '' && na === nb ? 1 : 0;
  const overlap = bigramOverlap(na, nb);
  return (2 * overlap.common) / (overlap.na + overlap.nb);
}

/**
 * 内容が類似か。`contentSimilarity >= 0.5` と同じ意味を整数で判定する。
 *
 * 2c/(na+nb) >= 1/2 は 4c >= na+nb と同値。浮動小数で比べると 0.5 ちょうどが
 * 丸め誤差で落ちる組がありうるため、境界はここだけで決める。
 */
export function contentIsSimilar(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  if ([...na].length < 2 || [...nb].length < 2) return na !== '' && na === nb;
  const overlap = bigramOverlap(na, nb);
  return 4 * overlap.common >= overlap.na + overlap.nb;
}

/** 日付差ごとの配点。3 日を超えると 0 */
const DATE_POINTS = [30, 20, 10, 5] as const;

/**
 * 一致度 0〜100。金額一致 50 点 + 日付 (0 日 30 / 1 日 20 / 2 日 10 / 3 日 5) + 内容類似度 × 20。
 * 画面へは整数で出すため、合計を `Math.round` で丸める (93.33 → 93)。
 */
export function matchScore(input: { amountEqual: boolean; dayGap: number; similarity: number }): number {
  const gap = Math.abs(input.dayGap);
  const datePoints = gap < DATE_POINTS.length ? DATE_POINTS[gap]! : 0;
  return Math.round((input.amountEqual ? 50 : 0) + datePoints + input.similarity * 20);
}

export interface ReconciliationReason {
  kind: 'amount' | 'date' | 'content';
  ok: boolean;
  label: string;
}

/** 行の相手として並べる freee 取引 */
export type ReconciliationFreee = ReconcileFreee;

export interface ReconciliationRow {
  txId: string;
  status: ReconciliationStatus;
  date: string;
  month: string;
  mf: ReconcileReviewMf;
  /** 見比べる相手。相手が見つからない行は null */
  freee: ReconciliationFreee | null;
  /** MF 金額 − freee 金額。相手が無ければ null */
  difference: number | null;
  /** 一致度 0〜100。相手が無ければ null */
  score: number | null;
  /** 内容の類似度 0〜1。相手が無ければ null */
  similarity: number | null;
  reasons: ReconciliationReason[];
  queues: ReconciliationQueue[];
  verdict: DuplicateVerdict['verdict'] | null;
  /** 照合済みになった経路。`different` は「別の取引」と判断したもの */
  matchedBy: 'auto' | 'user' | 'different' | null;
  /** 除外した側。MF 明細を外したか、相手の freee 取引が外されているか */
  excludedBy: 'mf' | 'freee' | null;
  excludedReason: string | null;
  reviewReason: ReconcileReviewReason | null;
  /** 要確認の行で「同じ取引」とするときの候補鍵。候補が無ければ空 */
  candidateKeys: string[];
}

export interface ReconciliationKpi {
  /** 除外していない freee の事業支出 + freee と組んでいない MF の事業支出 (未処理・MFのみ) */
  businessExpense: number;
  /** MFのみの事業支出。対応は要らない (MF の金額で総収支に計上済み) */
  mfOnlyCount: number;
  mfOnlyAmount: number;
  /** 利用者の対応が必要な総数。要確認 + 未処理の唯一の公開契約 */
  actionRequiredCount: number;
  /** 同額候補がある要確認の件数。対応必要の総数には actionRequiredCount を使う */
  reviewCount: number;
  resolvedCount: number;
  /** 照合済み + 要確認 + 未処理。MFのみと除外は照合の問いが無いので分母に入れない */
  resolvableCount: number;
  /** 解消率 0〜1。分母が 0 なら null (画面は「対象なし」) */
  resolutionRate: number | null;
}

export interface ReconciliationReport {
  kpi: ReconciliationKpi;
  statusCounts: Record<ReconciliationStatus, number>;
  sourceCounts: { moneyforward: number; freee: number };
  queues: Record<ReconciliationQueue, number>;
  /** MF 側の一覧の正本。状態別の集合はここから投影する */
  rows: ReconciliationRow[];
  /** 互換用の下段 preview。`rows.filter(status === 'mfOnly')` と同じ集合 */
  mfOnly: ReconciliationRow[];
  /** 下段「freeeにしかない取引」: どの MF とも組まず、除外もしていない freee 取引 */
  unmatchedFreee: ReconciliationFreee[];
}

export interface ReconciliationInput {
  data: Dataset;
  deals: readonly FreeeDeal[];
  verdicts?: readonly DuplicateVerdict[];
  freeeExclusions?: readonly FreeeExclusion[];
  mfExclusions?: readonly MfExclusion[];
  /**
   * 一覧と KPI に出す月。省略時は `data` の全月。
   *
   * 消し込みは常に `data` と `deals` の全体で行い、表示だけをこの月で絞る。先に期間で切ってから
   * 消し込むと、月末の MF 明細と翌月初の freee 取引 (±3 日) の組が期間の境で割れ、
   * 期間を問わない未処理キュー・月次クローズの件数と照合画面の件数が食い違う。
   */
  months?: readonly string[];
}

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const mfIo = (tx: MfTx): FreeeDeal['io'] => (tx.a < 0 ? 'expense' : 'income');

/**
 * MF 明細の相手として見比べられる freee 取引か。向きが同じで、発生日が ±`REVIEW_NEAR_DAYS` 日以内。
 * 金額は問わない (金額の差異キューの相手も含むため)。照合 API が名指しの相手を検める規則と同じ
 */
export function isPairableFreee(tx: MfTx, deal: FreeeDeal): boolean {
  return (
    deal.amount > 0 &&
    deal.io === mfIo(tx) &&
    Math.abs(dayNumber(deal.date) - dayNumber(mfMatchDate(tx))) <= REVIEW_NEAR_DAYS
  );
}

/** freee 取引のうち事業主貸は個人の支出であり、事業支出に数えない (expense-projection と同じ) */
const isPersonalDeal = (deal: FreeeDeal): boolean =>
  deal.accountRaw === '事業主貸' || deal.accountNorm === '事業主貸';

function reasonsFor(mf: ReconcileReviewMf, freee: ReconciliationFreee | null): ReconciliationReason[] {
  if (!freee) return [];
  const gap = Math.abs(dayNumber(freee.date) - dayNumber(mf.date));
  const difference = mf.amount - freee.amount;
  return [
    {
      kind: 'amount',
      ok: difference === 0,
      label:
        difference === 0
          ? '金額が一致'
          : `金額が異なる（差額 ¥${Math.abs(difference).toLocaleString('ja-JP')}）`,
    },
    { kind: 'date', ok: gap === 0, label: gap === 0 ? '日付が一致' : `日付が${gap}日ずれ` },
    {
      kind: 'content',
      ok: contentIsSimilar(mf.content, freee.partner),
      label: contentIsSimilar(mf.content, freee.partner) ? '内容が類似' : '内容が異なる',
    },
  ];
}

/** 照合画面の全体を 1 度の消し込みから導出する */
export function reconciliationReport(input: ReconciliationInput): ReconciliationReport {
  const { data, deals } = input;
  const shownMonths = new Set(input.months ?? data.months);
  const verdicts = input.verdicts ?? [];
  const freeeExclusions = input.freeeExclusions ?? [];
  const mfExclusions = input.mfExclusions ?? [];
  const mfExcludedIds = mfExclusions.map((row) => row.txId);
  const result = reconcileBizDuplicates(data, deals, verdicts, freeeExclusions, mfExcludedIds);

  const keys = freeeDealKeys(deals);
  const freeeOf = (freeeIndex: number): ReconciliationFreee => {
    const deal = deals[freeeIndex]!;
    return {
      freeeIndex,
      freeeKey: keys[freeeIndex]!,
      month: deal.month,
      date: deal.date,
      partner: deal.partner,
      amount: deal.amount,
      io: deal.io,
      account: deal.accountRaw,
      settleAccount: deal.settleAccount ?? '',
    };
  };
  const excludedReasonByKey = new Map(freeeExclusions.map((row) => [row.freeeKey, row.reason]));
  const mfExcludedReason = new Map(mfExclusions.map((row) => [row.txId, row.reason]));
  const verdictByTxId = new Map(verdicts.map((row) => [row.txId, row.verdict]));
  const matchedByTxId = new Map(result.matched.map((row) => [row.mfTxId, row]));
  const reviewByTxId = new Map(result.review.map((row) => [row.mfTxId, row]));
  const usedFreee = new Set(result.matched.map((row) => row.freeeIndex));

  const candidates = reconcilableMf(data).filter((tx) => !isCashTxId(tx.id) && shownMonths.has(tx.m));
  const resolved = new Map(
    candidates.map((tx) => [tx.id, resolveTx(tx, data.rules, data.edits, data.institutionOwners)]),
  );
  const mfView = (tx: MfTx): ReconcileReviewMf => {
    const hit = matchedByTxId.get(tx.id)?.mf ?? reviewByTxId.get(tx.id)?.mf;
    if (hit) return hit;
    const r = resolved.get(tx.id)!;
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
      cls: r.cls,
      clsSrc: r.clsSrc,
    };
  };

  /**
   * 向きと発生日で freee 取引を引く索引。MF 1 件ごとに全 freee を走査すると MF × freee になるため、
   * ±3 日の 7 日ぶんの束だけを見る
   */
  const dealsByDay = new Map<string, number[]>();
  deals.forEach((deal, freeeIndex) => {
    if (deal.amount <= 0) return;
    const slot = `${deal.io}\u0000${dayNumber(deal.date)}`;
    dealsByDay.set(slot, [...(dealsByDay.get(slot) ?? []), freeeIndex]);
  });
  /** ±3 日・同じ向きの freee 取引。条件を足して絞る。内容の似ている順 → 日付の近い順 */
  const nearby = (tx: MfTx, accept: (deal: FreeeDeal, freeeIndex: number) => boolean) => {
    const day = dayNumber(mfMatchDate(tx));
    const found: { deal: FreeeDeal; freeeIndex: number; gap: number; similarity: number }[] = [];
    for (let gap = -REVIEW_NEAR_DAYS; gap <= REVIEW_NEAR_DAYS; gap++) {
      for (const freeeIndex of dealsByDay.get(`${mfIo(tx)}\u0000${day + gap}`) ?? []) {
        const deal = deals[freeeIndex]!;
        if (!accept(deal, freeeIndex)) continue;
        // 並べ替えの比較ごとに bigram を作り直さないよう、類似度は 1 組 1 回だけ計算する
        found.push({ deal, freeeIndex, gap, similarity: contentSimilarity(tx.c, deal.partner) });
      }
    }
    return found.sort(
      (a, b) =>
        b.similarity - a.similarity || Math.abs(a.gap) - Math.abs(b.gap) || a.freeeIndex - b.freeeIndex,
    );
  };
  const isBusiness = (tx: MfTx) =>
    (resolved.get(tx.id) ?? resolveTx(tx, data.rules, data.edits, data.institutionOwners)).cls === 'biz';
  /** 相手の freee 取引を二重登録として外したために、要確認から落ちた明細の相手 */
  const excludedPartnerOf = (tx: MfTx) =>
    nearby(
      tx,
      (deal, freeeIndex) => deal.amount === Math.abs(tx.a) && excludedReasonByKey.has(keys[freeeIndex]!),
    )[0];

  /**
   * 金額の差異の相手を、MF 明細と freee 取引の 1 対 1 で割り当てる。
   *
   * - 事業の明細だけを対象にする。家計の明細と事業の freee 取引を「内容が似ている」だけで組ませると、
   *   同じ店での私用と事業用の買い物 (金額は当然違う) が差異として大量に並ぶ。家計の明細が freee に
   *   二重登録されていれば金額が一致するので、要確認の側で拾える。
   * - 1 件の freee 取引を複数の明細に見せない。見せると、まとめて照合したときに 1 件しか組めず、
   *   残りは保存したのに照合されない。似ている順 → 日付の近い順に早い者勝ちで決める。
   * - 期間で絞る前の全明細で割り当てる。表示中の月だけで割り当てると、期間を変えるたびに相手が変わる。
   */
  const mismatchPartner = new Map<string, number>();
  {
    const pairs: { txId: string; order: number; freeeIndex: number; gap: number; similarity: number }[] = [];
    reconcilableMf(data).forEach((tx, order) => {
      if (isCashTxId(tx.id) || matchedByTxId.has(tx.id) || mfExcludedReason.has(tx.id)) return;
      if (verdictByTxId.get(tx.id) === 'different' || !isBusiness(tx)) return;
      if (!reviewByTxId.has(tx.id) && excludedPartnerOf(tx)) return;
      for (const hit of nearby(
        tx,
        (deal, freeeIndex) =>
          deal.amount !== Math.abs(tx.a) &&
          !usedFreee.has(freeeIndex) &&
          !excludedReasonByKey.has(keys[freeeIndex]!) &&
          contentIsSimilar(tx.c, deal.partner),
      )) {
        pairs.push({
          txId: tx.id,
          order,
          freeeIndex: hit.freeeIndex,
          gap: Math.abs(hit.gap),
          similarity: hit.similarity,
        });
      }
    });
    pairs.sort(
      (a, b) =>
        b.similarity - a.similarity || a.gap - b.gap || a.order - b.order || a.freeeIndex - b.freeeIndex,
    );
    const taken = new Set<number>();
    for (const pair of pairs) {
      if (mismatchPartner.has(pair.txId) || taken.has(pair.freeeIndex)) continue;
      mismatchPartner.set(pair.txId, pair.freeeIndex);
      taken.add(pair.freeeIndex);
    }
  }

  const rows: ReconciliationRow[] = [];
  for (const tx of candidates) {
    const mf = mfView(tx);
    const base = {
      txId: tx.id,
      date: mf.date,
      month: tx.m,
      mf,
      verdict: verdictByTxId.get(tx.id) ?? null,
      matchedBy: null,
      excludedBy: null,
      excludedReason: null,
      reviewReason: null,
      candidateKeys: [] as string[],
      queues: [] as ReconciliationQueue[],
    } satisfies Partial<ReconciliationRow>;
    const withFreee = (freee: ReconciliationFreee | null) => {
      const similarity = freee ? contentSimilarity(mf.content, freee.partner) : null;
      return {
        freee,
        difference: freee ? mf.amount - freee.amount : null,
        similarity,
        score: freee
          ? matchScore({
              amountEqual: mf.amount === freee.amount,
              dayGap: dayNumber(freee.date) - dayNumber(mf.date),
              similarity: similarity ?? 0,
            })
          : null,
        reasons: reasonsFor(mf, freee),
      };
    };

    const matched = matchedByTxId.get(tx.id);
    if (matched) {
      rows.push({ ...base, status: 'matched', matchedBy: matched.by, ...withFreee(matched.freee) });
      continue;
    }
    const excludedReason = mfExcludedReason.get(tx.id);
    if (excludedReason !== undefined) {
      rows.push({ ...base, status: 'excluded', excludedBy: 'mf', excludedReason, ...withFreee(null) });
      continue;
    }
    const business = isBusiness(tx);
    const businessExpense = tx.a < 0 && business;
    /** freee に相手が無い事業支出。対応は要らないので、判断が残っていても MFのみとして見せる */
    const mfOnlyRow = (): ReconciliationRow => ({
      ...base,
      status: 'mfOnly',
      queues: ['mfOnly'],
      ...withFreee(null),
    });
    if (base.verdict === 'different') {
      // 「別の取引」と判断した行は、判断が無ければ照合の問いに載っていた明細 (±3 日に同額の freee 取引があるか、
      // 事業の明細で内容の似た freee 取引がある) だけを照合済みに数える。問いの無い明細に残った古い判断で
      // 照合済みと解消率の分母を水増ししない
      const askedBefore =
        nearby(
          tx,
          (deal, freeeIndex) =>
            !excludedReasonByKey.has(keys[freeeIndex]!) &&
            (deal.amount === Math.abs(tx.a) || (business && contentIsSimilar(tx.c, deal.partner))),
        ).length > 0;
      if (askedBefore) rows.push({ ...base, status: 'matched', matchedBy: 'different', ...withFreee(null) });
      else if (businessExpense) rows.push(mfOnlyRow());
      continue;
    }
    const partnerIndex = mismatchPartner.get(tx.id);
    const review = reviewByTxId.get(tx.id);
    if (review) {
      const best = review.candidates[0];
      const freee = best ? freeeOf(best.freeeIndex) : null;
      const queues: ReconciliationQueue[] = ['review'];
      if (best && Math.abs(best.dayGap) >= 1 && Math.abs(best.dayGap) <= REVIEW_NEAR_DAYS)
        queues.push('nearDate');
      if (partnerIndex !== undefined) queues.push('amountMismatch');
      rows.push({
        ...base,
        status: 'review',
        reviewReason: review.reason,
        candidateKeys: review.candidates.map((c) => c.freeeKey),
        queues,
        ...withFreee(freee),
      });
      continue;
    }
    const excludedPartner = excludedPartnerOf(tx);
    if (excludedPartner) {
      rows.push({
        ...base,
        status: 'excluded',
        excludedBy: 'freee',
        excludedReason: excludedReasonByKey.get(keys[excludedPartner.freeeIndex]!) ?? null,
        ...withFreee(freeeOf(excludedPartner.freeeIndex)),
      });
      continue;
    }
    if (partnerIndex !== undefined) {
      rows.push({
        ...base,
        status: 'unprocessed',
        queues: ['amountMismatch'],
        ...withFreee(freeeOf(partnerIndex)),
      });
      continue;
    }
    if (businessExpense) rows.push(mfOnlyRow());
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.txId.localeCompare(b.txId));

  const statusCounts: Record<ReconciliationStatus, number> = {
    unprocessed: 0,
    review: 0,
    matched: 0,
    mfOnly: 0,
    excluded: 0,
  };
  const queues: Record<ReconciliationQueue, number> = {
    review: 0,
    mfOnly: 0,
    amountMismatch: 0,
    nearDate: 0,
  };
  for (const row of rows) {
    statusCounts[row.status] += 1;
    for (const queue of row.queues) queues[queue] += 1;
  }

  const mfOnly = rows.filter((row) => row.status === 'mfOnly');
  const mfOnlyAmount = mfOnly.reduce((sum, row) => sum + row.mf.amount, 0);
  // freee と組んでいない MF の事業支出。総収支が MF の金額で数えるものと同じ集合 (未処理の金額違いも含む)。
  // 除外は照合の問いから外すだけで総収支の金額を動かさないため、除外した行もここに残す
  const unpairedBusinessExpense = rows
    .filter(
      (row) =>
        (row.status === 'mfOnly' || row.status === 'unprocessed' || row.status === 'excluded') &&
        row.mf.io === 'expense',
    )
    .filter((row) => row.mf.cls === 'biz')
    .reduce((sum, row) => sum + row.mf.amount, 0);
  const freeeBusinessExpense = deals.reduce(
    (sum, deal, freeeIndex) =>
      shownMonths.has(deal.month) &&
      deal.io === 'expense' &&
      deal.amount > 0 &&
      !isPersonalDeal(deal) &&
      !excludedReasonByKey.has(keys[freeeIndex]!)
        ? sum + deal.amount
        : sum,
    0,
  );
  const resolvableCount = statusCounts.matched + statusCounts.review + statusCounts.unprocessed;
  const actionRequiredCount = RECONCILIATION_PENDING_STATUSES.reduce(
    (sum, status) => sum + statusCounts[status],
    0,
  );

  return {
    kpi: {
      businessExpense: freeeBusinessExpense + unpairedBusinessExpense,
      mfOnlyCount: mfOnly.length,
      mfOnlyAmount,
      actionRequiredCount,
      reviewCount: statusCounts.review,
      resolvedCount: statusCounts.matched,
      resolvableCount,
      resolutionRate: resolvableCount === 0 ? null : statusCounts.matched / resolvableCount,
    },
    statusCounts,
    sourceCounts: { moneyforward: rows.length, freee: rows.filter((row) => row.freee !== null).length },
    queues,
    rows,
    mfOnly,
    // freeeOnly は判定器の時点で matched を除いた残余。ここでは表示月だけを投影する。
    unmatchedFreee: result.freeeOnly.filter((row) => shownMonths.has(row.month)),
  };
}
