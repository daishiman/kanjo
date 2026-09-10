/**
 * MF 中項目の前方一致による事業判定 (述語と公私仕分け側) の契約テスト。
 *
 * 実装より先に書く赤いテストである (SYS-MFBIZ-P04)。実装は SYS-MFBIZ-P05 が
 * `packages/core/src/types.ts` と `packages/core/src/classify.ts` に置く。
 *
 * 期待値の正本は `docs/mf-business-classification/requirements-baseline.md` (P01)。
 * ここで数値を作り直さない。
 *
 * ## 置換前の実装では赤になること (受入 8)
 *
 * 置換前の `resolveIncomingTx` は中項目を一切見ず、既定を無条件に `'per'` にしている。
 * したがって「中項目が事業で始まれば biz」を求める検査はすべて落ちる。
 * 置換前の回帰テストでは、`isMfBizByMid` / `MF_BIZ_MID_PREFIX` が未定義、
 * `clsSrc` に `'中項目'` が無い、`bySource` に `中項目` キーが無い)。
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  MF_BIZ_MID_PREFIX,
  type MfTx,
  type Rule,
  type TxEdit,
  classificationProgress,
  isMfBizByMid,
  resolveIncomingTx,
  resolveTx,
} from '../src/index.js';

const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2025-10',
  d: '10/31',
  c: '架空クラウド',
  a: -3_300,
  big: '通信費',
  mid: 'サブスク',
  inst: '三井住友銀行 普通',
  isTarget: true,
  isTransfer: false,
  ...over,
});

const resolve = (t: MfTx, rules: Rule[] = [], edits: Record<string, TxEdit> = {}) =>
  resolveTx(t, rules, edits);

describe('述語 isMfBizByMid', () => {
  it('前方一致の定数は「事業」である', () => {
    expect(MF_BIZ_MID_PREFIX).toBe('事業');
  });

  it('代表的な中項目の表記をすべて事業と判定する', () => {
    const mids = ['事業経費', '事業・副業', '事業・情報サービス', '事業・携帯電話'];
    expect(mids).toHaveLength(4);
    expect(mids.filter((mid) => isMfBizByMid({ mid }))).toHaveLength(4);
  });

  it('実装に存在しない中項目名でもコード変更なしに事業と判定する (受入 5)', () => {
    // 『事業・広告費』は述語の列挙には無い名前で、コード内のどのリテラルとも一致しない。
    // 列挙で実装すると必ずここで落ちる
    expect(isMfBizByMid({ mid: '事業・広告費' })).toBe(true);
  });

  it('事業で始まらない中項目は判定しない。部分一致に緩めない', () => {
    // 部分一致で書かれていないことを、匿名の反例で固定する。
    const nonBiz = ['サブスク', '副業・事業', '家事業務', '', '食費'];
    expect(nonBiz).toHaveLength(5);
    expect(nonBiz.filter((mid) => isMfBizByMid({ mid }))).toHaveLength(0);
  });

  it('中項目が無い明細は事業と判定しない', () => {
    expect(isMfBizByMid({ mid: undefined })).toBe(false);
  });

  it('比較時だけ前後の ASCII/全角空白を吸収する', () => {
    expect(isMfBizByMid({ mid: '  事業・広告費  ' })).toBe(true);
    expect(isMfBizByMid({ mid: '　事業・通信費　' })).toBe(true);
    expect(isMfBizByMid({ mid: ' 　 ' })).toBe(false);
  });
});

describe('公私仕分けの優先順位 (C7)', () => {
  it('中項目が事業で始まる明細は biz になり、根拠は「中項目」になる', () => {
    const r = resolve(mf({ big: '通信費', mid: '事業・情報サービス' }));
    expect(r.cls).toBe('biz');
    expect(r.clsSrc).toBe('中項目');
  });

  it('収入側も同じ述語で biz になる (収入・支出の両方)', () => {
    const r = resolve(mf({ a: 120_000, big: '収入', mid: '事業・副業', c: '架空取引先 A' }));
    expect(r.cls).toBe('biz');
    expect(r.clsSrc).toBe('中項目');
  });

  it('手動編集が中項目より優先される', () => {
    const t = mf({ mid: '事業経費' });
    const r = resolve(t, [], { [t.id]: { cls: 'per' } });
    expect(r.cls).toBe('per');
    expect(r.clsSrc).toBe('手動');
  });

  it('ルールが中項目より優先される', () => {
    const t = mf({ c: '架空スーパー', mid: '事業経費' });
    const r = resolve(t, [{ k: '架空スーパー', cls: 'per' }]);
    expect(r.cls).toBe('per');
    expect(r.clsSrc).toBe('ルール');
  });

  it('取引先の決め事が中項目より優先される', () => {
    const t = mf({ c: '架空クラウド', mid: '事業経費' });
    const incoming = resolveIncomingTx(t, [], {}, [
      {
        vendorKey: '架空クラウド',
        hitCount: 3,
        disagreeCount: 0,
        cls: 'per',
      },
    ]);
    expect(incoming.cls).toBe('per');
    expect(incoming.sources.cls).toBe('vendor_memory');
  });

  it('家計の中項目は既定のまま per になる', () => {
    const r = resolve(mf({ big: '食費', mid: '食料品' }));
    expect(r.cls).toBe('per');
    expect(r.clsSrc).toBe('既定');
  });

  it('resolveIncomingTx の出どころも中項目由来を区別する', () => {
    const incoming = resolveIncomingTx(mf({ mid: '事業経費' }), []);
    expect(incoming.cls).toBe('biz');
    expect(incoming.sources.cls).toBe('mf_mid');
  });
});

describe('仕分けの進み具合 (O5)', () => {
  it('中項目由来は確認済みとして数え、未レビュー件数に含めない', () => {
    const progress = classificationProgress([
      { cls: 'biz', clsSrc: '中項目' },
      { cls: 'biz', clsSrc: '中項目' },
      { cls: 'biz', clsSrc: '手動' },
      { cls: 'per', clsSrc: 'ルール' },
      { cls: 'per', clsSrc: '既定' },
    ]);
    expect(progress.total).toBe(5);
    expect(progress.bySource).toEqual({ 手動: 1, ルール: 1, 中項目: 2, 既定: 1 });
    // 未レビューは「人もルールも中項目も触っていない」1 件だけ
    expect(progress.reviewPending).toBe(1);
    // 出どころ別の合計は total に一致する (どこかに落ちた件数が無いこと)
    const sum = Object.values(progress.bySource).reduce((a, b) => a + b, 0);
    expect(sum).toBe(progress.total);
  });
});

describe('既定ルールから事業リテラルが消えている (O4)', () => {
  it('判定目的で「事業」始まりのキーワードを持つ既定ルールが 0 件である', () => {
    // 置換前は '事業経費' と '事業・副業' の 2 件が入っている
    expect(DEFAULT_RULES.length).toBeGreaterThan(0);
    expect(DEFAULT_RULES.filter((rule) => rule.k.startsWith('事業'))).toHaveLength(0);
  });

  it('既定ルールを消しても、その明細は述語で biz のままである', () => {
    expect(resolve(mf({ big: 'その他', mid: '事業経費' })).cls).toBe('biz');
    expect(resolve(mf({ a: 30_000, big: '収入', mid: '事業・副業' })).cls).toBe('biz');
  });

  it('旧部分一致だけが真になる明細は、中項目の正本を優先して家計にする', () => {
    const t = mf({ c: '事業経費の返金', big: 'その他入金', mid: '雑収入', a: 1_000 });
    expect(resolve(t, DEFAULT_RULES)).toMatchObject({ cls: 'per', clsSrc: '既定' });
    // 利用者が明示的に保存した旧ルールは引き続き優先される。
    expect(resolve(t, [{ k: '事業経費', cls: 'biz' }])).toMatchObject({ cls: 'biz', clsSrc: 'ルール' });
  });
});
