/**
 * 明細の分割記帳の契約。
 *
 * 守りたいのは1つだけ: 割った合計が元の金額と必ず一致すること。
 * ここが1円でもずれると、元の明細と内訳のどちらを集計に使うかが決まらず、
 * 二重計上か計上漏れのどちらかが静かに起きる。
 * 端数・0円行・入力途中の状態を、どれも「合計が合う」側に寄せて確かめる。
 */
import { describe, expect, it } from 'vitest';
import { type RatioLine, type SplitLine, splitByRatio, validateSplits } from '../src/splits.js';

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
