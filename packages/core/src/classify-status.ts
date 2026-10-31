/**
 * 明細仕分けの 3 区分・要確認・信頼度・ルールの対象判定 (spec-classify-screen BR-01〜BR-13)。
 *
 * この 1 ファイルが「その明細は片付いているか」の唯一の判定元である。画面の KPI、
 * ナビのバッジ、月次クローズの『仕分け』は母数だけが違い、判定そのものは同じ関数から出す。
 * 判定を api や web に写すと、同じ画面の中で件数が食い違う (旧実装が実際にそうなっていた)。
 */
import type { PaymentMethod } from './cash.js';
import { type ResolvedTx, ruleMatches } from './classify.js';
import type {
  Cls,
  MfTx,
  Owner,
  PaymentMethodOverride,
  Rule,
  RuleScope,
  SplitTemplate,
  SplitTemplateLine,
  TxEdit,
} from './types.js';
import { OWNER_VALUES, isMfBizByMid } from './types.js';
import { type VendorMemoryRecord, normalizeVendorKey, vendorConfidence } from './vendor-memory.js';

export type ClassifyStatus = 'unsorted' | 'manual' | 'done';
export type ReviewReason = 'low_confidence' | 'conflict' | 'contradiction';

export interface StatusResult {
  status: ClassifyStatus;
  /** status が unsorted のときだけ true になり得る (BR-03) */
  needsReview: boolean;
  reviewReasons: ReviewReason[];
}

export interface ClassifyCounts {
  all: number;
  unsorted: number;
  review: number;
  manual: number;
  done: number;
}

/** 信頼度がこれ未満の提案は疑う (BR-03。79 は要確認・80 は要確認でない) */
export const REVIEW_CONFIDENCE_THRESHOLD = 80;

/**
 * 信頼度の段階 (spec-guide-screen、qa-guide-decision-008)。
 * 高 80 以上・中 50〜79・低 49 以下。境界の比較はこの関数だけに置き、画面は結果を描くだけにする。
 * 高の下限は要確認の閾値と同じ 80 だが、意味が違う (表示の段階 / 疑う基準) ので別の定数として持ち、
 * 両者が 80 であることは単体テストで固定する。
 */
export const CONFIDENCE_TIER_HIGH_MIN = 80;
export const CONFIDENCE_TIER_MEDIUM_MIN = 50;

export type ConfidenceTier = 'high' | 'medium' | 'low';

export const CONFIDENCE_TIER_LABEL: Record<ConfidenceTier, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 0〜100 の数だけを段階にする。範囲外・非数・null は null (画面は「—」) */
export function confidenceTier(confidence: number | null | undefined): ConfidenceTier | null {
  if (confidence == null || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) return null;
  if (confidence >= CONFIDENCE_TIER_HIGH_MIN) return 'high';
  if (confidence >= CONFIDENCE_TIER_MEDIUM_MIN) return 'medium';
  return 'low';
}

/** 画面に出す『段階＋%』。段階が主、% が副。範囲外は「—」 */
export function confidenceTierText(confidence: number | null | undefined): string {
  const tier = confidenceTier(confidence);
  if (tier == null || confidence == null) return '—';
  return `${CONFIDENCE_TIER_LABEL[tier]} ${Math.round(confidence)}%`;
}

/** よくある疑問・用語の説明文。境界の数字を定数から組む */
export const CONFIDENCE_TIER_DESCRIPTION = `高 (${CONFIDENCE_TIER_HIGH_MIN} 以上)・中 (${CONFIDENCE_TIER_MEDIUM_MIN}〜${
  CONFIDENCE_TIER_HIGH_MIN - 1
})・低 (${CONFIDENCE_TIER_MEDIUM_MIN - 1} 以下) の3段階＋%で表示`;

/** 衝突したときに提案の信頼度から引く点数 (BR-05) */
export const CONFLICT_CONFIDENCE_PENALTY = 20;

/** 由来ごとの信頼度 (BR-04)。vendor_memory だけは実績から計算する */
export const RULE_PAYEE_CONFIDENCE = 95;
export const RULE_KEYWORD_CONFIDENCE = 85;
export const MF_MID_CONFIDENCE = 70;

export interface StatusInput {
  /** resolveTx の clsSrc */
  clsSrc: ResolvedTx['clsSrc'];
  /** tx_edits.origin。列が無い既存行は null */
  origin?: TxEdit['origin'];
  /** tx_edits.matched_proposal。既存行は null */
  matchedProposal?: number | null;
  /** 提案の信頼度 (BR-04)。提案が無ければ null */
  confidence?: number | null;
  conflict?: boolean;
  contradiction?: boolean;
}

/**
 * 3 区分の判定 (BR-01)。各明細はちょうど 1 区分に入る。
 *
 * 「未整理」を clsSrc==='既定' と同じ集合にしているのが肝で (BR-02)、これにより
 * 月次クローズの『仕分け』の意味を変えずに、区分を 3 つへ増やせる。
 */
export function classifyStatus(input: StatusInput): StatusResult {
  const status = statusOf(input);
  const reasons: ReviewReason[] = [];
  if (status === 'unsorted' && input.confidence != null) {
    if (input.confidence < REVIEW_CONFIDENCE_THRESHOLD) reasons.push('low_confidence');
    if (input.conflict) reasons.push('conflict');
    if (input.contradiction) reasons.push('contradiction');
  }
  return { status, needsReview: reasons.length > 0, reviewReasons: reasons };
}

function statusOf({ clsSrc, origin, matchedProposal }: StatusInput): ClassifyStatus {
  if (clsSrc === '既定') return 'unsorted';
  if (clsSrc === 'ルール' || clsSrc === '中項目') return 'done';
  // 以降は clsSrc === '手動'
  // vendor_memory は取込時に自動適用された承認済みの決定なので完了。
  // matched_proposal は利用者の確定時に付く印で、この由来では NULL でも判定に使わない。
  if (origin === 'vendor_memory') return 'done';
  // origin が null の既存行は、列が無かった時期の手入力。提案との一致が分からないので手動変更に倒す
  return matchedProposal === 1 ? 'done' : 'manual';
}

/** 件数の集計。要確認は未整理の内数なので all の和には入れない (AT-12 の不変条件) */
export function classifyCounts(results: readonly StatusResult[]): ClassifyCounts {
  const counts: ClassifyCounts = { all: results.length, unsorted: 0, review: 0, manual: 0, done: 0 };
  for (const r of results) {
    counts[r.status] += 1;
    if (r.needsReview) counts.review += 1;
  }
  return counts;
}

/* -------- 提案と信頼度 (BR-04・BR-05・BR-08) -------- */

export type SuggestionBasis = 'vendor_memory' | 'rule' | 'mf_mid' | 'none';

export interface SuggestionValue {
  cls: Cls | null;
  big: string | null;
  mid: string | null;
  owner: Owner | null;
}

export interface ClassifySuggestion {
  /** 提案が無ければ null */
  suggestion: SuggestionValue | null;
  /** 画面の『提案カテゴリ』列にそのまま出す文字列 */
  label: string | null;
  basis: SuggestionBasis;
  confidence: number | null;
  /** 『信頼度の根拠』に出す文 (BR-08) */
  basisText: string;
  conflict: boolean;
  contradiction: boolean;
}

const CLS_LABEL: Record<Cls, string> = { biz: '事業', per: '家計' };

const labelOf = (v: SuggestionValue): string =>
  [v.cls ? CLS_LABEL[v.cls] : null, v.big, v.mid].filter((x): x is string => !!x).join(' / ');

const NO_SUGGESTION: ClassifySuggestion = {
  suggestion: null,
  label: null,
  basis: 'none',
  confidence: null,
  basisText: '提案に使える過去の事例・ルール・中項目がありません。',
  conflict: false,
  contradiction: false,
};

interface Candidate {
  basis: Exclude<SuggestionBasis, 'none'>;
  value: SuggestionValue;
  label: string;
  confidence: number;
  basisText: string;
}

/**
 * 由来を優先順 (vendor_memory → ルール → MF 中項目) に全部並べる。
 *
 * 先頭だけを返す既存の `recommendationFor` と違い、ここは全件を集める。衝突 (BR-05) は
 * 「2 つ以上の由来が違うカテゴリを提案している」ことなので、先頭で打ち切ると検出できない。
 */
function candidatesFor(
  tx: MfTx | null,
  content: string,
  rules: readonly Rule[],
  vendorMemories: readonly VendorMemoryRecord[],
): Candidate[] {
  const out: Candidate[] = [];
  const key = normalizeVendorKey(content);
  const memory = key ? vendorMemories.find((m) => !m.revoked && m.vendorKey === key) : undefined;
  if (memory) {
    const value: SuggestionValue = {
      cls: memory.cls ?? null,
      big: memory.big ?? null,
      mid: memory.mid ?? null,
      owner: memory.owner ?? null,
    };
    const label = labelOf(value);
    if (label) {
      const total = memory.hitCount + memory.disagreeCount;
      out.push({
        basis: 'vendor_memory',
        value,
        label,
        confidence: clampConfidence(Math.round(vendorConfidence(memory) * 100)),
        basisText: `過去に同じ取引先を「${label}」として仕分けた事例が${memory.hitCount}件あります。（全${total}件中）`,
      });
    }
  }
  if (tx) {
    for (const rule of rules) {
      if (!ruleMatches(tx, rule)) continue;
      // payee 付きのルールは取引先キーまで一致して初めて当たる。両方一致なら信頼度が上がる (BR-04)
      const payee = rule.payee ?? null;
      if (payee && normalizeVendorKey(content) !== payee) continue;
      const value: SuggestionValue = {
        cls: rule.cls ?? null,
        big: rule.big ?? null,
        mid: rule.mid ?? null,
        owner: rule.owner ?? null,
      };
      const label = labelOf(value);
      if (!label) continue;
      out.push({
        basis: 'rule',
        value,
        label,
        confidence: payee ? RULE_PAYEE_CONFIDENCE : RULE_KEYWORD_CONFIDENCE,
        basisText: payee
          ? `ルール「${rule.k}」（取引先「${payee}」）に一致しています。`
          : `ルール「${rule.k}」に一致しています。`,
      });
      break; // ルールは先勝ち (既存の評価順)
    }
    if (isMfBizByMid(tx)) {
      const value: SuggestionValue = { cls: 'biz', big: null, mid: null, owner: null };
      out.push({
        basis: 'mf_mid',
        value,
        label: CLS_LABEL.biz,
        confidence: MF_MID_CONFIDENCE,
        basisText: `MF の中項目「${tx.mid ?? ''}」から「${CLS_LABEL.biz}」を提案しています。`,
      });
    }
  }
  return out;
}

const clampConfidence = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

/** 同じカテゴリを指しているか。衝突の判定は区分と科目で見る (所有者は矛盾の側で見る) */
const sameCategory = (a: SuggestionValue, b: SuggestionValue): boolean =>
  a.cls === b.cls && (a.big ?? null) === (b.big ?? null) && (a.mid ?? null) === (b.mid ?? null);

/** 矛盾 (BR-05): 区分=個人 かつ 所有者=事業、または 区分=事業 かつ 所有者が事業以外 */
export function isContradiction(cls: Cls | null, owner: Owner | null): boolean {
  if (!cls || !owner) return false;
  return cls === 'per' ? owner === 'business' : owner !== 'business';
}

/**
 * 明細 1 件の提案・信頼度・根拠の文 (BR-04・BR-05・BR-08)。
 *
 * 衝突したときに信頼度を「関与した由来の最小値 − 20」へ落とすのは、
 * 「一番弱い根拠より確かとは言えない」うえに「食い違っていること自体が減点材料」だからである。
 */
export function classifySuggestion(
  tx: MfTx | null,
  content: string,
  rules: readonly Rule[],
  vendorMemories: readonly VendorMemoryRecord[],
): ClassifySuggestion {
  const candidates = candidatesFor(tx, content, rules, vendorMemories);
  const head = candidates[0];
  if (!head) return { ...NO_SUGGESTION };

  const other = candidates.find((c) => !sameCategory(c.value, head.value));
  const conflict = other !== undefined;
  const confidence = conflict
    ? Math.max(0, Math.min(...candidates.map((c) => c.confidence)) - CONFLICT_CONFIDENCE_PENALTY)
    : head.confidence;
  const contradiction = isContradiction(head.value.cls, head.value.owner);

  let basisText = head.basisText;
  if (other) basisText += `別の根拠が「${other.label}」を提案しているため、信頼度を下げています。`;
  if (contradiction) basisText += '区分と所有者が一致していません。';

  return {
    suggestion: head.value,
    label: head.label,
    basis: head.basis,
    confidence: clampConfidence(confidence),
    basisText,
    conflict,
    contradiction,
  };
}

/* -------- 提案一致フラグ (BR-09) -------- */

/**
 * 保存後の値が提案どおりかを判定する。サーバだけで呼び、クライアントの申告は使わない。
 * 比べるのは区分・大項目・中項目・所有者の 4 値。提案が無ければ常に不一致 (= 手動変更)。
 */
export function matchesSuggestion(
  suggestion: SuggestionValue | null,
  saved: { cls: Cls | null; big: string | null; mid: string | null; owner: Owner | null },
): boolean {
  if (!suggestion) return false;
  const norm = (v: string | null | undefined) => v || null;
  return (
    suggestion.cls === saved.cls &&
    norm(suggestion.big) === norm(saved.big) &&
    norm(suggestion.mid) === norm(saved.mid) &&
    (suggestion.owner ?? null) === (saved.owner ?? null)
  );
}

/* -------- 分割の型 (BR-10) -------- */

export interface AppliedSplitLine {
  amount: number;
  cls: Cls;
  big: string;
  mid: string;
  owner: Owner | null;
  memo: string;
}

/** 型が形として成り立っているか。残額はちょうど 1 行、固定額は 1 行以上 */
export function splitTemplateIssues(template: SplitTemplate, maxLines: number): string[] {
  const issues: string[] = [];
  const remainders = template.lines.filter((l) => l.kind === 'remainder');
  const fixed = template.lines.filter((l) => l.kind === 'fixed');
  if (remainders.length !== 1) issues.push('残額の行はちょうど1行にしてください');
  if (fixed.length < 1) issues.push('固定額の行を1行以上にしてください');
  if (fixed.some((l) => !Number.isInteger(l.amount) || (l.amount ?? 0) <= 0))
    issues.push('固定額は正の整数にしてください');
  if (template.lines.length > maxLines) issues.push(`分割は${maxLines}行までです`);
  return issues;
}

/**
 * 保存されている分割の型 (JSON 文字列) を読む。
 * 壊れた値・形の合わない値は null へ倒す。DB に何が入っていても画面が落ちないことを優先する。
 */
export function parseSplitTemplate(json: string | null | undefined): SplitTemplate | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const lines = (parsed as { lines?: unknown }).lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const out: SplitTemplateLine[] = [];
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') return null;
    const l = raw as Record<string, unknown>;
    if (l.kind !== 'fixed' && l.kind !== 'remainder') return null;
    if (l.cls !== 'biz' && l.cls !== 'per') return null;
    const line: SplitTemplateLine = { kind: l.kind, cls: l.cls };
    if (typeof l.amount === 'number' && Number.isInteger(l.amount)) line.amount = l.amount;
    if (typeof l.big === 'string') line.big = l.big;
    if (typeof l.mid === 'string') line.mid = l.mid;
    if (OWNER_VALUES.includes(l.owner as Owner)) line.owner = l.owner as Owner;
    if (typeof l.memo === 'string') line.memo = l.memo;
    out.push(line);
  }
  return { lines: out };
}

/**
 * 型を金額 total の明細へ当てはめる。残額が 0 以下なら null (= 分割できない明細)。
 * 戻り値の金額の和は常に total に一致する。
 */
export function applySplitTemplate(total: number, template: SplitTemplate): AppliedSplitLine[] | null {
  const abs = Math.abs(total);
  const fixedSum = template.lines.reduce((s, l) => s + (l.kind === 'fixed' ? (l.amount ?? 0) : 0), 0);
  const remainder = abs - fixedSum;
  if (remainder <= 0) return null;
  return template.lines.map((l) => ({
    amount: l.kind === 'fixed' ? (l.amount ?? 0) : remainder,
    cls: l.cls,
    big: l.big ?? '',
    mid: l.mid ?? '',
    owner: l.owner ?? null,
    memo: l.memo ?? '',
  }));
}

/* -------- ルールの対象 (BR-11・BR-12) -------- */

export interface RuleTargetRow {
  txId: string;
  tx: MfTx;
  /** 判定に使う内容 (MfTx.c と同じ値) */
  content: string;
  status: ClassifyStatus;
  /** すでに内訳を持っている */
  hasSplit: boolean;
  /** 利用者が提案どおりに確定した明細 (origin=manual かつ matched_proposal=1) */
  userConfirmed?: boolean;
  deleted?: boolean;
}

export interface RuleTargetSpec {
  k: string;
  payee?: string | null;
  scope?: RuleScope;
  cls?: Cls | null;
  big?: string | null;
  mid?: string | null;
  owner?: Owner | null;
  splitTemplate?: SplitTemplate | null;
}

/**
 * ルールが実際に触る明細を決める (BR-11)。プレビューと適用がこの 1 つを共有するので、
 * 「見えていたものと違うものが変わった」が起きない (AT-11)。
 */
export function ruleTargets(rule: RuleTargetSpec, rows: readonly RuleTargetRow[]): RuleTargetRow[] {
  const payee = rule.payee || null;
  const scope: RuleScope = rule.scope ?? 'all';
  const hasTemplate = !!rule.splitTemplate;
  return rows.filter((row) => {
    if (row.deleted) return false;
    // 利用者が自分で決めた明細をルールで塗り替えない。確定も利用者の決定なので外す
    if (row.status === 'manual') return false;
    if (row.userConfirmed) return false;
    if (scope === 'unconfirmed' && row.status !== 'unsorted') return false;
    if (hasTemplate && row.hasSplit) return false;
    if (!ruleMatches(row.tx, { k: rule.k, cls: rule.cls ?? null })) return false;
    if (payee && normalizeVendorKey(row.content) !== payee) return false;
    return true;
  });
}

/** 取引先の表示値 (BR-12)。正規化キーを作れない明細は内容をそのまま出す */
export function payeeOf(content: string): string {
  return normalizeVendorKey(content) || content;
}

/* -------- 支払方法 (BR-13) -------- */

/**
 * 表示する支払方法と、その出どころ。上書きがあればそれ、無ければ明細からの判定。
 * 出どころを返すのは、画面が「（明細から判定）」を添えるかを決めるためである。
 */
export function paymentMethodFor(
  edit: { paymentMethod?: PaymentMethodOverride | null } | undefined,
  derived: PaymentMethod,
): { method: PaymentMethod; source: 'edit' | 'derived' } {
  const override = edit?.paymentMethod ?? null;
  return override ? { method: override, source: 'edit' } : { method: derived, source: 'derived' };
}
