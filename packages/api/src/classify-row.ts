/**
 * 仕分け画面が読む「明細 1 行」の組み立て (spec-classify-screen の GET /api/transactions)。
 *
 * 一覧・単体保存・一括保存が同じ形の行を返すために、組み立てをここ 1 か所に置く。
 * 別々に組むと、保存直後に画面へ差し込む行と、次の取得で返る行がずれる。
 */
import {
  type Candidates,
  type Cls,
  type MfTx,
  type Owner,
  type Rule,
  type RuleTargetRow,
  type TxEdit,
  type VendorMemoryRecord,
  categoryAllowed,
  classifyStatus,
  classifySuggestion,
  isCashTxId,
  payeeOf,
  paymentMethodFor,
  paymentMethodOf,
  resolveTx,
  vendorMemoryEditContributes,
} from '@kanjo/core';

export interface ClassifyRowContext {
  rules: Rule[];
  edits: Record<string, TxEdit>;
  institutionOwners: Readonly<Record<string, Owner>>;
  vendorMemories: readonly VendorMemoryRecord[];
  candidates: Candidates;
}

/** 並べ替えのためだけに使う内部の値。応答へ出す前に落とす */
export interface RowSortKeys {
  sortAmount: number;
  groupKey: string;
}

export type ClassifyRow = ReturnType<typeof buildClassifyRow>;

export function buildClassifyRow(t: MfTx, ctx: ClassifyRowContext) {
  const r = resolveTx(t, ctx.rules, ctx.edits, ctx.institutionOwners);
  const split = t.splitProjection?.kind === 'split' ? t.splitProjection : null;
  const splitParent = t.splitProjection?.kind === 'split-parent' ? t.splitProjection : null;
  const rowKind = split ? 'split' : isCashTxId(t.id) ? 'cash' : 'mf';
  const parentTxId = split?.parentTxId ?? splitParent?.parentTxId ?? null;
  const e = split ? ctx.edits[split.parentTxId] : ctx.edits[t.id];
  const memoryContributes = vendorMemoryEditContributes(t, ctx.rules, e);
  // 提案・信頼度・根拠は core の 1 か所で決める。route では組み替えない (BR-04・BR-08)
  const suggestion = classifySuggestion(t, t.c, ctx.rules, ctx.vendorMemories);
  const payment = paymentMethodFor(e, paymentMethodOf({ id: t.id, inst: r.inst }));
  const status = classifyStatus({
    clsSrc: r.clsSrc,
    origin: e?.origin ?? null,
    matchedProposal: e?.matchedProposal ?? null,
    confidence: suggestion.confidence,
    conflict: suggestion.conflict,
    contradiction: suggestion.contradiction,
  });
  return {
    id: t.id,
    rowKey: split ? `split:${split.lineId}` : `${rowKind}:${t.id}`,
    rowKind,
    parentTxId,
    lineId: split?.lineId ?? null,
    splitSeq: split?.seq ?? null,
    splitLineCount: split?.lineCount ?? null,
    splitState: splitParent?.state ?? null,
    capabilities: {
      quickClass: rowKind !== 'split',
      edit: rowKind !== 'split',
      split: rowKind !== 'cash' && t.idStable === true,
    },
    idStable: t.idStable === true,
    date: t.d,
    description: t.c,
    /** 取引先の表示値 (BR-12)。内容から正規化して取り出す */
    payee: payeeOf(t.c),
    amount: t.a,
    /** 有効値(振替後の口座)。取込値は csvInstitution が別に運ぶ */
    institution: r.inst,
    instSrc: r.instSrc,
    /** 支払手段(口座名と現金IDからの導出。MF自身は列を持たない) */
    paymentMethod: payment.method,
    paymentMethodSource: payment.source,
    /** 取込値(MFの大項目/中項目・保有金融機関) */
    csvBig: t.big,
    csvMid: t.mid,
    csvInstitution: t.inst ?? null,
    /** 有効値 */
    big: r.big,
    mid: r.mid,
    catSrc: r.catSrc,
    cls: r.cls as Cls | null,
    /** materialize済みの決め事もtx_edit層なので手動。自動適用由来はoriginで運ぶ。 */
    src: r.clsSrc,
    owner: r.owner,
    ownerSrc: r.ownerSrc,
    edited: r.edited,
    conflict: r.conflict,
    /** 提案 (BR-04)。画面はこの値をそのまま『提案どおり確定』に使う */
    suggestion: suggestion.suggestion,
    suggestionLabel: suggestion.label,
    confidence: suggestion.confidence,
    basis: suggestion.basis,
    basisText: suggestion.basisText,
    /** 3 区分と要確認 (BR-01・BR-03) */
    status: status.status,
    needsReview: status.needsReview,
    reviewReasons: status.reviewReasons,
    note: e?.note ?? null,
    /** 値一致ではなく、保存された適用由来をそのまま画面へ渡す。 */
    origin: memoryContributes ? 'vendor_memory' : e?.origin === 'manual' ? 'manual' : null,
    originKey: memoryContributes ? (e?.originKey ?? null) : null,
    /** 手動の科目が現在の公私の系統に無い(公私を後から変えた等) */
    scopeMismatch: r.catSrc === '手動' && !categoryAllowed(ctx.candidates, r.cls, r.big, r.mid),
    edit: e
      ? {
          cls: e.cls ?? null,
          big: e.big ?? null,
          mid: e.mid ?? null,
          owner: e.owner ?? null,
          inst: e.inst ?? null,
          note: e.note ?? null,
          paymentMethod: e.paymentMethod ?? null,
          updatedAt: e.updatedAt ?? null,
          origin: memoryContributes ? 'vendor_memory' : e.origin === 'manual' ? 'manual' : null,
          originKey: memoryContributes ? (e.originKey ?? null) : null,
        }
      : null,
    /** 親子を離さず並べるためだけの内部 sort metadata。応答へ出す前に落とす */
    sortAmount: split?.parentAmount ?? Math.abs(t.a),
    groupKey: parentTxId ?? t.id,
  };
}

/**
 * ルールが触りうる明細の並び (BR-11 の `ruleTargets` へ渡す形)。
 * プレビューと適用が同じ入力から同じ対象を出すために、ここ 1 か所で組む。
 * 分割の内訳行 (splitProjection.kind === 'split') は親の一部であって
 * それ自体が仕分けの単位ではないので、対象の候補から外す。
 */
export function buildRuleTargetRows(txs: readonly MfTx[], ctx: ClassifyRowContext): RuleTargetRow[] {
  const out: RuleTargetRow[] = [];
  for (const t of txs) {
    if (t.splitProjection?.kind === 'split') continue;
    const e = ctx.edits[t.id];
    const r = resolveTx(t, ctx.rules, ctx.edits, ctx.institutionOwners);
    const suggestion = classifySuggestion(t, t.c, ctx.rules, ctx.vendorMemories);
    const status = classifyStatus({
      clsSrc: r.clsSrc,
      origin: e?.origin ?? null,
      matchedProposal: e?.matchedProposal ?? null,
      confidence: suggestion.confidence,
      conflict: suggestion.conflict,
      contradiction: suggestion.contradiction,
    });
    out.push({
      txId: t.id,
      tx: t,
      content: t.c,
      status: status.status,
      hasSplit: t.splitProjection?.kind === 'split-parent',
      userConfirmed: e?.origin === 'manual' && e?.matchedProposal === 1,
    });
  }
  return out;
}

/** 応答へ出す形 (並べ替え用の内部キーを落とす) */
export function stripSortKeys<T extends RowSortKeys>({
  sortAmount: _sortAmount,
  groupKey: _groupKey,
  ...row
}: T): Omit<T, keyof RowSortKeys> {
  return row;
}
