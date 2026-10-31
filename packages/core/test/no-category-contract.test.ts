/**
 * 『カテゴリなし』の契約 (spec-classify-bulk-save FR-18・BR-04・AC-05)。
 *
 * 『カテゴリなし』は予約の値で、保存した値はそのまま残しつつ、数えるときは未分類と同じに扱う。
 * 読み替えを集計ごとに書くと、どこか 1 か所だけ『カテゴリなし』という大項目の行が生まれ、
 * 説明可能率や総収支の内訳が画面ごとに食い違う。だから読み替えは core の 1 か所
 * (`categoryForTotals`) に寄せ、ここでは全部の出口を 1 つの表で縛る。
 *
 * | 出口 | 期待 |
 * |---|---|
 * | 家計の集計 (`applyClassification`) | 未分類の行に入り、『カテゴリなし』の行は作らない |
 * | 説明可能率 (`personalExplainability`) | 説明できない側に入る |
 * | 総収支の内訳 (`totalCashflowLedger`) | category が未分類 |
 * | 支出の見通し (`buildExpenseProjection`) | categoryRaw / categoryNorm が未分類 |
 * | 分類の状態 (`resolveTx` → `classifyStatus`) | 値は『カテゴリなし』のまま、出所は手動、状態は手動 |
 * | 候補の検査 (`categoryAllowed`) | 候補に無い値として弾く。ルール・分割・取引先の記憶・現金は新しい値を受ける窓口なので受けない |
 * | 候補の一覧 (`buildCandidates`) | 取込値や追加の候補に同じ名前 (表記ゆれを含む) があっても入れない |
 * | 今の値を残す保存の検査 (`categoryAllowedOrKept`) | 今の値がそれなら、中項目が空のときだけ通す (メモだけ直す保存) |
 * | 対応表の大項目 (`taxAccountMapRowIssue`) | 予約の値は登録できない |
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type MfTx,
  NO_CATEGORY,
  applyClassification,
  buildCandidates,
  buildExpenseProjection,
  categoryAllowed,
  categoryAllowedOrKept,
  categoryForTotals,
  classifyStatus,
  emptyDataset,
  isNoCategory,
  personalExplainability,
  resolveTx,
  taxAccountMapRowIssue,
  totalCashflowLedger,
} from '../src/index.js';

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'none',
  idStable: true,
  m: '2026-08',
  d: '08/05',
  c: '架空ストア',
  a: -3_000,
  big: '食費',
  mid: '食料品',
  inst: '架空銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

function dataset(): Dataset {
  const data = emptyDataset();
  data.months = ['2026-08'];
  data.biz.revenue = [0];
  data.subs.other = [0];
  data.mfTx = [tx(), tx({ id: 'food', c: '架空スーパー', a: -1_000 })];
  data.edits = { none: { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'family' } };
  data.personal = applyClassification(data.mfTx, data.rules, data.edits, data.institutionOwners).personal;
  return data;
}

describe('予約の値', () => {
  it('前後の空白を除いて一致したものだけを予約の値とみなす', () => {
    expect(NO_CATEGORY).toBe('カテゴリなし');
    expect([NO_CATEGORY, ` ${NO_CATEGORY} `, '未分類', '', null, undefined].map(isNoCategory)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('画面で見分けがつかない書き方も予約の値とみなし、見て違いが分かる書き方はみなさない', () => {
    // 候補の名前の検査を素通りすると、画面には『カテゴリなし』と見える大項目が予約の値とは別に作られる
    const lookAlike = {
      半角カナ: 'ｶﾃｺﾞﾘなし',
      分解した濁点: NO_CATEGORY.normalize('NFD'),
      末尾のゼロ幅スペース: `${NO_CATEGORY}\u200B`,
      途中のゼロ幅スペース: 'カテゴリ\u200Bなし',
      先頭のBOM: `\uFEFF${NO_CATEGORY}`,
      ソフトハイフン: 'カテ\u00ADゴリなし',
      右から左の印: `\u200F${NO_CATEGORY}`,
      全角空白: `\u3000${NO_CATEGORY}\u3000`,
      ノーブレークスペース: `${NO_CATEGORY}\u00A0`,
    };
    for (const [name, value] of Object.entries(lookAlike)) {
      expect(value, name).not.toBe(NO_CATEGORY);
      expect(isNoCategory(value), name).toBe(true);
      expect(categoryForTotals(value), name).toBe('未分類');
    }
    const distinct = {
      漢字の無し: 'カテゴリ無し',
      カタカナのナシ: 'カテゴリナシ',
      半角カナのﾅｼ: 'ｶﾃｺﾞﾘﾅｼ',
      後ろに文字: `${NO_CATEGORY}2`,
      途中の空白: 'カテゴリ なし',
    };
    for (const [name, value] of Object.entries(distinct)) {
      expect(isNoCategory(value), name).toBe(false);
      expect(categoryForTotals(value), name).toBe(value);
    }
  });

  it('判定を覚えても結果は変わらない (同じ値を繰り返し呼ぶ・覚えた数の上限を超える)', () => {
    const values = ['ｶﾃｺﾞﾘなし', 'カテゴリ無し', NO_CATEGORY, '架空食費'];
    const first = values.map(isNoCategory);
    expect(first).toEqual([true, false, true, false]);
    expect(values.map(isNoCategory)).toEqual(first);
    // 上限 (1024 件) を超える種類の名前を通して覚えた判定を捨てさせても、同じ値は同じ結果になる
    for (let i = 0; i < 1100; i += 1) isNoCategory(`架空の候補${i}`);
    expect(values.map(isNoCategory)).toEqual(first);
  });

  it('数えるときだけ未分類へ読み替え、空の値は読み替えない (総収支が取込値へ戻すため)', () => {
    expect(categoryForTotals(NO_CATEGORY)).toBe('未分類');
    expect(categoryForTotals('食費')).toBe('食費');
    expect(categoryForTotals('')).toBe('');
  });
});

describe('出口ごとの扱い (AC-05)', () => {
  it('家計の集計は未分類の行に入れ、『カテゴリなし』の行を作らない', () => {
    const expense = dataset().personal['2026-08']?.expense ?? {};
    expect(expense['未分類']).toBe(3_000);
    expect(expense).not.toHaveProperty(NO_CATEGORY);
    expect(expense['食費']).toBe(1_000);
  });

  it('説明可能率では説明できない側に入る', () => {
    expect(personalExplainability(dataset())).toEqual({
      month: '2026-08',
      rate: 0.25,
      unexplained: 3_000,
      total: 4_000,
    });
  });

  it('総収支の内訳は未分類として数える', () => {
    const { ledger } = totalCashflowLedger(dataset());
    const row = ledger.rows.find((r) => r.txId === 'none');
    expect(row).toMatchObject({ side: 'household', category: '未分類' });
    expect(ledger.rows.some((r) => r.category === NO_CATEGORY)).toBe(false);
  });

  it('支出の見通しは未分類として数える', () => {
    const fact = buildExpenseProjection(dataset(), []).effectiveExpenses.find((f) => f.sourceId === 'none');
    expect(fact).toMatchObject({ categoryRaw: '未分類', categoryNorm: '未分類' });
  });

  it('保存した値は『カテゴリなし』のまま残り、分類の状態は手動', () => {
    const data = dataset();
    const resolved = resolveTx(data.mfTx[0] as MfTx, data.rules, data.edits, data.institutionOwners);
    expect(resolved).toMatchObject({ cls: 'per', big: NO_CATEGORY, mid: '', catSrc: '手動', clsSrc: '手動' });
    // 一括保存は『カテゴリなし』を提案一致にしない (matchedProposal=0)
    expect(classifyStatus({ clsSrc: resolved.clsSrc, origin: 'manual', matchedProposal: 0 }).status).toBe(
      'manual',
    );
  });

  it('候補の検査は予約の値を候補に無い値として弾く (新しく値を受ける窓口)', () => {
    const cands = buildCandidates([], [{ big: '食費', mid: '食料品' }], []);
    expect(categoryAllowed(cands, 'per', NO_CATEGORY, '')).toBe(false);
    expect(categoryAllowed(cands, 'biz', NO_CATEGORY, null)).toBe(false);
    expect(categoryAllowed(cands, 'per', NO_CATEGORY, '食料品')).toBe(false);
  });

  it('取込値や追加の候補に予約の値と同じ名前があっても、候補には入れない', () => {
    // 候補は取込値 (freee の勘定科目・MF の大中項目) と追加の候補から作る。同じ名前を候補に入れると、
    // 候補の検査を通ってルールや取引先の記憶に予約の値が入り、編集パネルでも選べてしまう
    const cands = buildCandidates(
      [NO_CATEGORY, '通信費'],
      [
        { big: NO_CATEGORY, mid: '' },
        { big: 'ｶﾃｺﾞﾘなし', mid: '' },
        { big: '食費', mid: NO_CATEGORY },
        { big: '食費', mid: '食料品' },
      ],
      [{ scope: 'per', major: `${NO_CATEGORY}\u200b`, mid: '' }],
    );
    const names = (cls: 'biz' | 'per') => cands[cls].flatMap((m) => [m.name, ...m.mids.map((x) => x.name)]);
    expect(names('biz').filter(isNoCategory)).toEqual([]);
    expect(names('per').filter(isNoCategory)).toEqual([]);
    // 予約の値でない名前は残る (全部を捨てて 0 件になったのではない)
    expect(names('biz')).toContain('通信費');
    expect(cands.per.find((m) => m.name === '食費')?.mids.map((x) => x.name)).toContain('食料品');
    expect(categoryAllowed(cands, 'biz', NO_CATEGORY, null)).toBe(false);
    expect(categoryAllowed(cands, 'per', 'ｶﾃｺﾞﾘなし', '')).toBe(false);
    expect(categoryAllowed(cands, 'per', '食費', NO_CATEGORY)).toBe(false);
  });

  it('今の値を残す保存は、今の値が予約の値で中項目が空のときだけ通す', () => {
    const cands = buildCandidates([], [{ big: '食費', mid: '食料品' }], []);
    expect(categoryAllowedOrKept(cands, 'per', NO_CATEGORY, '', NO_CATEGORY)).toBe(true);
    expect(categoryAllowedOrKept(cands, 'biz', NO_CATEGORY, null, NO_CATEGORY)).toBe(true);
    expect(categoryAllowedOrKept(cands, 'per', NO_CATEGORY, '食料品', NO_CATEGORY)).toBe(false);
    expect(categoryAllowedOrKept(cands, 'per', NO_CATEGORY, '', '食費')).toBe(false);
    expect(categoryAllowedOrKept(cands, 'per', NO_CATEGORY, '', null)).toBe(false);
    // 予約の値でなければ、今まで通りの候補の検査
    expect(categoryAllowedOrKept(cands, 'per', '食費', '食料品', NO_CATEGORY)).toBe(true);
    expect(categoryAllowedOrKept(cands, 'per', '候補に無い', '', '候補に無い')).toBe(false);
  });

  it('対応表の大項目に予約の値は登録できない', () => {
    expect(taxAccountMapRowIssue({ categoryBig: NO_CATEGORY, taxAccount: '通信費' })).not.toBeNull();
    expect(taxAccountMapRowIssue({ categoryBig: '通信費', taxAccount: '通信費' })).toBeNull();
  });
});
