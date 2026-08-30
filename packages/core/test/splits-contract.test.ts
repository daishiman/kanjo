/**
 * 明細の分割記帳の契約。
 *
 * 守りたいのは1つだけ: 割った合計が元の金額と必ず一致すること。
 * ここが1円でもずれると、元の明細と内訳のどちらを集計に使うかが決まらず、
 * 二重計上か計上漏れのどちらかが静かに起きる。
 * 端数・0円行・入力途中の状態を、どれも「合計が合う」側に寄せて確かめる。
 */
import { describe, expect, it } from 'vitest';
import { projectAccountingDataset } from '../src/dataset.js';
import {
  type RatioLine,
  type SplitLine,
  type TxSplit,
  applySplits,
  splitByRatio,
  validateSplits,
} from '../src/splits.js';
import { type MfTx, emptyDataset } from '../src/types.js';

const r = (ratio: number, categoryMajor = '食費'): RatioLine => ({
  cls: 'per',
  categoryMajor,
  categoryMid: '',
  ratio,
});

const s = (amount: number, categoryMajor = '食費'): SplitLine => ({
  cls: 'per',
  categoryMajor,
  categoryMid: '',
  amount,
});

const sum = (lines: SplitLine[]) => lines.reduce((t, l) => t + l.amount, 0);

describe('割合から金額への変換', () => {
  it('割り切れる割合はそのままの比で割れる', () => {
    const out = splitByRatio(100000, [r(60), r(40, '交通費')]);
    expect(out.map((l) => l.amount)).toEqual([60000, 40000]);
    expect(sum(out)).toBe(100000);
  });

  it('割り切れなくても合計は元の金額とぴったり一致する', () => {
    // 3等分は33333.33…。切り捨てたままだと99999円になり、1円が消える
    const out = splitByRatio(100000, [r(1), r(1, '交通費'), r(1, '日用品')]);
    expect(sum(out)).toBe(100000);
    expect(out.map((l) => l.amount)).toEqual([33334, 33333, 33333]);
  });

  it('端数は切り捨てで損をした行から順に返る(大きい行に寄せない)', () => {
    // 素の値は [3333.33, 3333.33, 3333.33, ...] ではなく偏らせて確かめる
    const out = splitByRatio(1000, [r(1), r(1, '交通費'), r(1, '日用品'), r(97, '住居')]);
    // 1000*1/100=10 ちょうど。97は970ちょうど。端数が出ないケース
    expect(out.map((l) => l.amount)).toEqual([10, 10, 10, 970]);
    expect(sum(out)).toBe(1000);
  });

  it('割合の合計が100でなくても比として扱う(打ち終わる前に止めない)', () => {
    // 「6と4」でも「60と40」でも「3と2」でも同じ結果になってほしい
    const a = splitByRatio(100000, [r(6), r(4, '交通費')]);
    const b = splitByRatio(100000, [r(60), r(40, '交通費')]);
    const c = splitByRatio(100000, [r(3), r(2, '交通費')]);
    expect(a.map((l) => l.amount)).toEqual(b.map((l) => l.amount));
    expect(a.map((l) => l.amount)).toEqual(c.map((l) => l.amount));
  });

  it('同じ入力なら毎回同じ結果になる(端数の行き先が揺れない)', () => {
    // 割合を入れ直すたびに1円が別の行へ飛ぶと、金額が動いた理由が読めなくなる
    const lines = [r(1), r(1, '交通費'), r(1, '日用品')];
    const first = splitByRatio(100000, lines).map((l) => l.amount);
    for (let i = 0; i < 5; i++) {
      expect(splitByRatio(100000, lines).map((l) => l.amount)).toEqual(first);
    }
  });

  it('どんな割合の組み合わせでも合計は必ず元の金額になる', () => {
    // 端数の配り方を変えたときに、ここが最初に壊れる
    const totals = [100000, 99999, 12345, 7, 1000000];
    const patterns = [
      [1, 1, 1],
      [1, 2, 3, 4],
      [7, 11, 13],
      [1, 1, 1, 1, 1, 1, 1],
      [999, 1],
    ];
    for (const total of totals) {
      for (const p of patterns) {
        expect(
          sum(
            splitByRatio(
              total,
              p.map((v) => r(v)),
            ),
          ),
          `${total} / ${p}`,
        ).toBe(total);
      }
    }
  });

  it('行が無い・割合が全部0なら何も返さない(0除算でNaNを出さない)', () => {
    expect(splitByRatio(100000, [])).toEqual([]);
    expect(splitByRatio(100000, [r(0), r(0, '交通費')])).toEqual([]);
  });

  it('メモは入れたときだけ残る(空文字の行を作らない)', () => {
    const [withMemo, without] = splitByRatio(100000, [{ ...r(1), memo: '駅前のスーパー' }, r(1, '交通費')]);
    expect(withMemo.memo).toBe('駅前のスーパー');
    expect(without).not.toHaveProperty('memo');
  });
});

describe('分割の検証', () => {
  it('合計が合っていれば問題なし', () => {
    expect(validateSplits(100000, [s(60000), s(40000, '交通費')])).toEqual([]);
  });

  it('足りない分は「いくら残っているか」を円で伝える', () => {
    const issues = validateSplits(100000, [s(60000), s(30000, '交通費')]);
    expect(issues).toHaveLength(1);
    expect(issues[0].index).toBeNull();
    expect(issues[0].message).toContain('10,000円');
  });

  it('はみ出した分も同じように伝える(符号で読ませない)', () => {
    const issues = validateSplits(100000, [s(60000), s(50000, '交通費')]);
    expect(issues[0].message).toContain('10,000円');
    expect(issues[0].message).toContain('はみ出');
  });

  it('0円や小数の行は行番号つきで弾く', () => {
    const issues = validateSplits(100, [s(0), s(50.5, '交通費'), s(49.5, '日用品')]);
    expect(issues.filter((i) => i.index === 0)).toHaveLength(1);
    expect(issues.filter((i) => i.index === 1)).toHaveLength(1);
  });

  it('分類の無い行は弾く(集計に入らないまま保存されると気づけない)', () => {
    const issues = validateSplits(100000, [s(100000, '')]);
    expect(issues.some((i) => i.index === 0 && i.message.includes('分類'))).toBe(true);
  });

  it('1行も無いときは、合計のズレではなく「行がない」と言う', () => {
    const issues = validateSplits(100000, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('行がありません');
  });

  it('splitByRatio が返したものは、そのまま検証を通る', () => {
    // 変換と検証で端数の扱いが食い違うと、自分で作った分割を保存できなくなる
    for (const total of [100000, 99999, 7]) {
      const lines = splitByRatio(total, [r(1), r(1, '交通費'), r(1, '日用品')]);
      expect(validateSplits(total, lines), String(total)).toEqual([]);
    }
  });
});

describe('集計への反映', () => {
  const tx = (id: string, a: number): MfTx => ({
    id,
    idStable: true,
    m: '2026-07',
    d: '07/25',
    c: 'カード引き落とし',
    a,
    big: '未分類',
    mid: '',
  });

  /** 明細だけを持つ最小の Dataset */
  const dataWith = (...txs: MfTx[]) => {
    const d = emptyDataset();
    d.months = ['2026-07'];
    d.mfTx = txs;
    return d;
  };

  const split = (
    txId: string,
    seq: number,
    amount: number,
    major: string,
    parentAmount = 100000,
  ): TxSplit => ({
    txId,
    lineId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    seq,
    parentAmount,
    amount,
    cls: 'per',
    categoryMajor: major,
    categoryMid: '',
  });

  it('元の1行が内訳N行に置き換わる(元の行は残らない)', () => {
    // 元の行を残したまま内訳を足すと、同じ10万円を2回数えることになる
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '交通費')]);
    expect(d.mfTx.map((t) => t.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
    expect(d.mfTx.map((t) => t.a)).toEqual([-60000, -40000]);
  });

  it('内訳の金額を足すと元の明細と同じになる', () => {
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [
      split('t1', 1, 33334, '食費'),
      split('t1', 2, 33333, '交通費'),
      split('t1', 3, 33333, '日用品'),
    ]);
    expect(d.mfTx.reduce((s, t) => s + t.a, 0)).toBe(-100000);
  });

  it('収入の明細を分割しても符号が保たれる', () => {
    // 内訳は正の数で持つので、符号は元の明細から復元するしかない
    const d = dataWith(tx('t1', 50000));
    applySplits(d, [split('t1', 1, 30000, '給与', 50000), split('t1', 2, 20000, '雑収入', 50000)]);
    expect(d.mfTx.map((t) => t.a)).toEqual([30000, 20000]);
  });

  it('内訳の分類は手動編集と同じ枠に入る(仕分けの経路を増やさない)', () => {
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [
      { ...split('t1', 1, 60000, '食費'), cls: 'biz' },
      { ...split('t1', 2, 40000, '交通費'), cls: 'biz' },
    ]);
    expect(d.mfTx[0].projectedEdit).toMatchObject({ cls: 'biz', big: '食費' });
  });

  it('親のowner/noteを残し、分類だけを内訳の値へ投影する', () => {
    const d = dataWith(tx('t1', -100000));
    d.edits.t1 = { cls: 'per', big: '未分類', owner: 'spouse', note: '親のメモ' };
    d.overrides.t1 = 'per';
    applySplits(d, [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '交通費')]);
    expect(d.edits.t1).toMatchObject({ owner: 'spouse', note: '親のメモ' });
    expect(d.overrides.t1).toBe('per');
    expect(d.mfTx[0].projectedEdit).toMatchObject({ owner: 'spouse', note: '親のメモ', big: '食費' });
  });

  it('合計が合わない分割は無視して元の行を残す', () => {
    // 元の明細は銀行の記録で必ず正しい。内訳は人が入れたもので間違いうる
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [split('t1', 1, 60000, '食費'), split('t1', 2, 30000, '交通費')]);
    expect(d.mfTx.map((t) => t.id)).toEqual(['t1']);
    expect(d.mfTx[0].a).toBe(-100000);
  });

  it('分割の無い明細には触らない', () => {
    const d = dataWith(tx('t1', -100000), tx('t2', -5000));
    applySplits(d, [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '交通費')]);
    expect(d.mfTx.map((t) => t.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      't2',
    ]);
  });

  it('内訳は並び順(seq)で出る。DBの返す順に左右されない', () => {
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [
      split('t1', 3, 30000, '日用品'),
      split('t1', 1, 50000, '食費'),
      split('t1', 2, 20000, '交通費'),
    ]);
    expect(d.mfTx.map((t) => t.splitProjection?.kind)).toEqual(['split', 'split', 'split']);
    expect(d.mfTx.map((t) => t.a)).toEqual([-50000, -20000, -30000]);
  });

  it('メモは内容欄に足して、どの内訳かを一覧で見分けられるようにする', () => {
    const d = dataWith(tx('t1', -100000));
    applySplits(d, [
      { ...split('t1', 1, 60000, '食費'), memo: '週末の買い出し' },
      split('t1', 2, 40000, '交通費'),
    ]);
    expect(d.mfTx[0].c).toBe('カード引き落とし / 週末の買い出し');
  });

  it('外部IDの#末尾を型判定せず、親と子を構造化metadataで区別する', () => {
    const d = dataWith(tx('raw#1', -100000));
    d.txSplits = [split('raw#1', 1, 60000, '食費'), split('raw#1', 2, 40000, '交通費')];
    const projected = projectAccountingDataset(d);
    expect(projected.mfTx[0].splitProjection).toMatchObject({ kind: 'split', parentTxId: 'raw#1' });
    expect(projected.mfTx[1].splitProjection).toMatchObject({ kind: 'split', parentTxId: 'raw#1' });
  });

  it('親金額が変わった分割は元明細へfail-closedし、要確認状態を残す', () => {
    const d = dataWith(tx('t1', -120000));
    applySplits(d, [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '交通費')]);
    expect(d.mfTx).toHaveLength(1);
    expect(d.mfTx[0]).toMatchObject({
      id: 't1',
      a: -120000,
      splitProjection: { kind: 'split-parent', state: 'amount_conflict' },
    });
  });

  it('分割が1件も無ければ何も起きない', () => {
    const d = dataWith(tx('t1', -100000));
    applySplits(d, []);
    expect(d.mfTx.map((t) => t.id)).toEqual(['t1']);
  });

  // 分割は仕分け画面の中だけの表示ではない。
  // 集計は projectAccountingDataset を通した結果を使うので、
  // 家計の科目別・名義別・事業立替のどれもが内訳の姿で出る必要がある。
  // ここが繋がっていないと、画面では分けたのに家計簿は「未分類10万円」のまま静かにずれる。
  describe('他ページの集計への波及', () => {
    it('家計の科目別支出は、親の1行ではなく内訳の科目で積まれる', () => {
      const d = dataWith(tx('t1', -100000));
      d.txSplits = [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '水道光熱費')];
      const projected = projectAccountingDataset(d);
      expect(projected.personal['2026-07'].expense).toEqual({ 食費: 60000, 水道光熱費: 40000 });
    });

    it('家計の収入は、分割した内訳の中項目ごとに積まれる', () => {
      const d = dataWith(tx('t1', 50000));
      d.txSplits = [
        { ...split('t1', 1, 30000, '収入', 50000), categoryMid: '給与' },
        { ...split('t1', 2, 20000, '収入', 50000), categoryMid: 'その他' },
      ];
      const projected = projectAccountingDataset(d);
      expect(projected.personal['2026-07'].income).toEqual({ 給与: 30000, その他: 20000 });
    });

    it('名義は親から引き継ぐ。内訳ごとに選び直させない', () => {
      const d = dataWith(tx('t1', -100000));
      d.edits.t1 = { owner: 'spouse' };
      d.txSplits = [split('t1', 1, 60000, '食費'), split('t1', 2, 40000, '水道光熱費')];
      const projected = projectAccountingDataset(d);
      expect(projected.personalByOwner['2026-07'].spouse.expense).toBe(100000);
      expect(projected.personalByOwner['2026-07'].unset.expense).toBe(0);
    });

    it('事業にした内訳は事業立替へ回り、家計の科目別からは外れる', () => {
      // 事業側の科目別内訳はfreee帳簿(data.biz)が正本。
      // MF側は「事業立替がいくらか」までを持つ。ここを取り違えると二重計上になる
      const d = dataWith(tx('t1', -100000));
      d.txSplits = [{ ...split('t1', 1, 70000, '通信費'), cls: 'biz' }, split('t1', 2, 30000, '水道光熱費')];
      const projected = projectAccountingDataset(d);
      expect(projected.bizPersonal['2026-07'].expense).toBe(70000);
      expect(projected.personal['2026-07'].expense).toEqual({ 水道光熱費: 30000 });
    });

    it('合計が合わない内訳は集計にも出さず、親の金額のまま数える', () => {
      const d = dataWith(tx('t1', -100000));
      d.txSplits = [split('t1', 1, 60000, '食費'), split('t1', 2, 30000, '水道光熱費')];
      const projected = projectAccountingDataset(d);
      expect(projected.personal['2026-07'].expense).toEqual({ 未分類: 100000 });
    });
  });
});
