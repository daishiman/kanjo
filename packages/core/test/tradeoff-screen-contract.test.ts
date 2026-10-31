import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type DiagnosisImprovement,
  TRADEOFF_AMOUNT_MAX,
  TRADEOFF_CANDIDATE_KEY_MAX,
  TRADEOFF_CANDIDATE_LIMIT,
  TRADEOFF_MEMO_MAX,
  TRADEOFF_TITLE_MAX,
  type TradeoffCandidateNote,
  type TradeoffExpenseRow,
  type TradeoffScreenCandidate,
  buildTradeoffCandidates,
  claimPart,
  detectImprovements,
  emptyDataset,
  isValidTradeoffCovered,
  parseTradeoffCandidateKey,
  tradeoffCandidateKey,
  tradeoffCombos,
  tradeoffDefenseMargin,
  tradeoffNeed,
  tradeoffReason,
  tradeoffSimulation,
  tradeoffTrend,
} from '../src/index.js';

/**
 * トレードオフ画面の規則 (spec-tradeoff-screen「ビジネスルールと検証」、docs/spec-v1.1.md FR-09)。
 * 期待値は FR-09 の表と同じ値で、どちらかを変えるときは同じ変更で両方を直す。
 */

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

/** 科目ごとの月次系列を持つデータセット。catProfile の type はこの系列で決まる */
function dataset(expense: Record<string, number[]>): Dataset {
  const data = emptyDataset();
  data.months = MONTHS;
  data.biz = { revenue: MONTHS.map(() => 0), categories: Object.keys(expense), expense };
  return data;
}

/** 直近 3 か月 (04〜06) に各月の額を置いた freee 経費の行 */
function rows(
  account: string,
  partner: string,
  [m4, m5, m6]: [number, number, number],
): TradeoffExpenseRow[] {
  return [
    { month: '2026-04', account, partner, amount: m4 },
    { month: '2026-05', account, partner, amount: m5 },
    { month: '2026-06', account, partner, amount: m6 },
  ].filter((r) => r.amount !== 0);
}

const FIXED = [30000, 30000, 30000, 30000, 30000, 30000];
const SPOT = [0, 0, 0, 0, 0, 90000];
const SEMI = [10000, 40000, 10000, 40000, 10000, 40000];
const key = tradeoffCandidateKey;

describe('候補キー', () => {
  it('版付き JSON タプルで科目と取引先を往復できる', () => {
    expect(tradeoffCandidateKey('通信費', 'NTT')).toBe('v1:["通信費","NTT"]');
    expect(parseTradeoffCandidateKey(tradeoffCandidateKey('通信費', 'NTT'))).toEqual({
      account: '通信費',
      partner: 'NTT',
    });
    expect(parseTradeoffCandidateKey(tradeoffCandidateKey('通信費', ''))).toEqual({
      account: '通信費',
      partner: '',
    });
  });

  it('区切り記号・引用符・改行を含む組合せでも衝突せず往復できる', () => {
    const parts = ['', '|', 'a', 'a|b', '"quoted"', '\\path', 'line\nbreak', '日本語'];
    const keys = parts.flatMap((account) => parts.map((partner) => tradeoffCandidateKey(account, partner)));
    expect(new Set(keys).size).toBe(parts.length ** 2);
    for (const account of parts) {
      for (const partner of parts) {
        expect(parseTradeoffCandidateKey(tradeoffCandidateKey(account, partner))).toEqual({
          account,
          partner,
        });
      }
    }
    expect(tradeoffCandidateKey('広告|宣伝費', 'A')).not.toBe(tradeoffCandidateKey('広告', '宣伝費|A'));
  });

  it('旧形式と壊れたタプルは復号しない', () => {
    for (const value of ['通信費|NTT', 'v1:', 'v1:{}', 'v1:["a"]', 'v1:["a","b",""]']) {
      expect(parseTradeoffCandidateKey(value)).toBeNull();
    }
  });

  it('入力と候補の共有上限を core が単一で持つ', () => {
    expect(TRADEOFF_TITLE_MAX).toBe(100);
    expect(TRADEOFF_MEMO_MAX).toBe(500);
    expect(TRADEOFF_AMOUNT_MAX).toBe(100_000_000);
    expect(TRADEOFF_CANDIDATE_KEY_MAX).toBe(300);
    expect(TRADEOFF_CANDIDATE_LIMIT).toBe(50);
  });
});

describe('推移', () => {
  it('+10% ちょうどは横ばい、超えれば増加', () => {
    expect(tradeoffTrend(1000, 1100)).toBe('flat');
    expect(tradeoffTrend(1000, 1101)).toBe('up');
  });

  it('−10% ちょうどは横ばい、下回れば減少', () => {
    expect(tradeoffTrend(1000, 900)).toBe('flat');
    expect(tradeoffTrend(1000, 899)).toBe('down');
  });

  it('初月 0 は最終月が正なら増加、0 なら横ばい', () => {
    expect(tradeoffTrend(0, 1)).toBe('up');
    expect(tradeoffTrend(0, 0)).toBe('flat');
  });
});

describe('必要度 (決定 010)', () => {
  it('固定費で横ばい・増加は高', () => {
    expect(tradeoffNeed('固定費', 'flat')).toBe('high');
    expect(tradeoffNeed('固定費', 'up')).toBe('high');
  });

  it('スポットはどの推移でも低', () => {
    expect(tradeoffNeed('スポット', 'up')).toBe('low');
    expect(tradeoffNeed('スポット', 'flat')).toBe('low');
  });

  it('減少は低 (固定費で減少もここに当たる)', () => {
    expect(tradeoffNeed('固定費', 'down')).toBe('low');
    expect(tradeoffNeed('準変動', 'down')).toBe('low');
  });

  it('それ以外は中', () => {
    expect(tradeoffNeed('準変動', 'flat')).toBe('mid');
    expect(tradeoffNeed('準変動', 'up')).toBe('mid');
  });
});

describe('理由の文', () => {
  it('当たりなしは type と推移だけ', () => {
    expect(tradeoffReason({ type: '固定費', trend: 'flat', improvementLabel: null, memo: null })).toBe(
      '固定費・直近 3 か月は横ばい',
    );
  });

  it('当たりありは改善案の label を続ける', () => {
    expect(
      tradeoffReason({
        type: '準変動',
        trend: 'up',
        improvementLabel: '広告宣伝費 を予算内に戻す',
        memo: null,
      }),
    ).toBe('準変動・直近 3 か月は増加・広告宣伝費 を予算内に戻す');
  });

  it('メモがあればメモを優先する', () => {
    expect(
      tradeoffReason({
        type: 'スポット',
        trend: 'down',
        improvementLabel: '広告宣伝費 を予算内に戻す',
        memo: '解約済み',
      }),
    ).toBe('解約済み');
  });
});

describe('候補の作り方', () => {
  it('期間の終了月から遡る 3 か月を科目×取引先で集計し、月額は 3 か月の合計 ÷ 3', () => {
    const data = dataset({ 通信費: FIXED });
    const input = [
      ...rows('通信費', 'NTT', [3000, 3000, 3000]),
      ...rows('通信費', 'KDDI', [1200, 0, 1800]),
      // 窓の外 (03) は数えない
      { month: '2026-03', account: '通信費', partner: 'NTT', amount: 99999 },
    ];
    const out = buildTradeoffCandidates(data, input, { improvements: [] });
    expect(out.map((c) => [c.key, c.monthly, c.annual])).toEqual([
      [key('通信費', 'NTT'), 3000, 36000],
      [key('通信費', 'KDDI'), 1000, 12000],
    ]);
  });

  it('月額 1,000 円ちょうどは残り、999 円は落ちる', () => {
    const data = dataset({ 雑費: FIXED });
    const input = [...rows('雑費', 'A', [1000, 1000, 1000]), ...rows('雑費', 'B', [999, 999, 999])];
    const out = buildTradeoffCandidates(data, input, { improvements: [] });
    expect(out.map((c) => c.key)).toEqual([key('雑費', 'A')]);
  });

  it('3 か月平均は丸めてから月額 1,000 円の閾値を判定する', () => {
    const data = dataset({ 雑費: FIXED });
    const [candidate] = buildTradeoffCandidates(data, rows('雑費', '丸め境界', [1000, 1000, 999]), {
      improvements: [],
    });
    expect(candidate).toMatchObject({ key: key('雑費', '丸め境界'), monthly: 1000, annual: 12000 });
  });

  it('取引先が空の行も空文字を含むタプルキーになる', () => {
    const data = dataset({ 雑費: FIXED });
    const [c] = buildTradeoffCandidates(data, rows('雑費', '', [2000, 2000, 2000]), { improvements: [] });
    expect(c.key).toBe(key('雑費', ''));
    expect(c.partner).toBe('');
  });

  it('上限は 50 件、同額はキーの辞書順', () => {
    const data = dataset({ 雑費: FIXED });
    const input: TradeoffExpenseRow[] = [];
    for (let i = 0; i < 60; i += 1) {
      const amount = i < 2 ? 5000 : 2000 + i;
      input.push(...rows('雑費', `P${String(i).padStart(2, '0')}`, [amount, amount, amount]));
    }
    const out = buildTradeoffCandidates(data, input, { improvements: [] });
    expect(TRADEOFF_CANDIDATE_LIMIT).toBe(50);
    expect(out).toHaveLength(50);
    expect(out.slice(0, 2).map((c) => c.key)).toEqual([key('雑費', 'P00'), key('雑費', 'P01')]);
    expect(out[2].key).toBe(key('雑費', 'P59'));
  });

  it('300 字を超えるキーの候補は作らない', () => {
    const data = dataset({ 雑費: FIXED });
    const long = 'x'.repeat(300);
    const out = buildTradeoffCandidates(data, rows('雑費', long, [5000, 5000, 5000]), { improvements: [] });
    expect(out).toEqual([]);
  });

  it('必要度・推移・理由が全行に付き、type は catProfile から取る', () => {
    const data = dataset({ 地代家賃: FIXED, 広告宣伝費: SPOT, 外注費: SEMI });
    const input = [
      ...rows('地代家賃', '大家', [30000, 30000, 30000]),
      ...rows('広告宣伝費', 'Google', [10000, 10000, 20000]),
      ...rows('外注費', 'X社', [20000, 20000, 20000]),
    ];
    const out = buildTradeoffCandidates(data, input, { improvements: [] });
    const byKey = Object.fromEntries(out.map((c) => [c.key, c]));
    expect(byKey[key('地代家賃', '大家')]).toMatchObject({ need: 'high', needSource: 'auto', trend: 'flat' });
    expect(byKey[key('広告宣伝費', 'Google')]).toMatchObject({ need: 'low', trend: 'up' });
    expect(byKey[key('外注費', 'X社')]).toMatchObject({ need: 'mid', trend: 'flat' });
    expect(byKey[key('地代家賃', '大家')].reason).toBe('固定費・直近 3 か月は横ばい');
    expect(byKey[key('地代家賃', '大家')].relatedTo).toBeNull();
  });

  it('検知器の改善案に当たっても必要度は下げず、理由に label を足し、関連ページは最初の当たり (決定 011)', () => {
    const data = dataset({ 地代家賃: [40000, 40000, 40000, 40000, 40000, 40000] });
    const input = rows('地代家賃', '大家', [40000, 40000, 40000]);
    const improvements = detectImprovements(data);
    const hit = improvements.find((r) => r.claimKeys.includes(`business:category:${claimPart('地代家賃')}`));
    expect(hit).toBeDefined();
    const [c] = buildTradeoffCandidates(data, input, { improvements });
    expect(c.need).toBe('high');
    expect(c.reason).toBe(`固定費・直近 3 か月は横ばい・${hit?.label}`);
    expect(c.relatedTo).toBe(hit?.nextAction.to);
  });

  it('照合は claimPart の正規化 (全角・大文字) を通す', () => {
    const data = dataset({ ＡＷＳ: FIXED });
    const improvement = {
      claimKeys: [`business:category:${claimPart('aws')}`],
      label: 'AWS を見直す',
      nextAction: { label: '見る', to: '/subscriptions?account=aws' },
    } as unknown as DiagnosisImprovement;
    const [c] = buildTradeoffCandidates(data, rows('ＡＷＳ', 'Amazon', [3000, 3000, 3000]), {
      improvements: [improvement],
    });
    expect(c.relatedTo).toBe('/subscriptions?account=aws');
  });

  it('利用者の上書きが推定より優先し、needSource は manual、メモが理由より先に出る', () => {
    const data = dataset({ 地代家賃: FIXED });
    const notes = new Map<string, TradeoffCandidateNote>([
      [key('地代家賃', '大家'), { need: 'low', memo: '来月解約' }],
    ]);
    const [c] = buildTradeoffCandidates(data, rows('地代家賃', '大家', [30000, 30000, 30000]), {
      improvements: [],
      notes,
    });
    expect(c).toMatchObject({ need: 'low', needSource: 'manual', memo: '来月解約', reason: '来月解約' });
  });

  it('メモだけの上書きは必要度を自動のまま残す', () => {
    const data = dataset({ 地代家賃: FIXED });
    const notes = new Map<string, TradeoffCandidateNote>([
      [key('地代家賃', '大家'), { need: null, memo: '要相談' }],
    ]);
    const [c] = buildTradeoffCandidates(data, rows('地代家賃', '大家', [30000, 30000, 30000]), {
      improvements: [],
      notes,
    });
    expect(c).toMatchObject({ need: 'high', needSource: 'auto', memo: '要相談' });
  });

  it('期間に月が無ければ候補は空', () => {
    const data = emptyDataset();
    expect(
      buildTradeoffCandidates(data, rows('雑費', 'A', [5000, 5000, 5000]), { improvements: [] }),
    ).toEqual([]);
  });
});

describe('試算 (決定 005 / 009、O2)', () => {
  it('毎月 80,000 / 削減 85,000/月 → 960,000 / 1,020,000 / −60,000', () => {
    const r = tradeoffSimulation({ amount: 80000, recurring: true }, [85000], null);
    expect(r.annualCost).toBe(960000);
    expect(r.annualSaving).toBe(1020000);
    expect(r.annualDiff).toBe(-60000);
    expect(r.verdict).toBe('covered');
  });

  it('単発 300,000 / 削減 50,000/月 → 300,000 / 600,000 / −300,000', () => {
    const r = tradeoffSimulation({ amount: 300000, recurring: false }, [30000, 20000], null);
    expect(r.annualCost).toBe(300000);
    expect(r.annualSaving).toBe(600000);
    expect(r.annualDiff).toBe(-300000);
    expect(r.monthlySaving).toBe(50000);
  });

  it('毎月 100,000 / 削減 50,000/月 → 1,200,000 / 600,000 / +600,000 (支出増)', () => {
    const r = tradeoffSimulation({ amount: 100000, recurring: true }, [50000], null);
    expect(r.annualCost).toBe(1200000);
    expect(r.annualSaving).toBe(600000);
    expect(r.annualDiff).toBe(600000);
    expect(r.verdict).toBe('insufficient');
  });

  it('差額 0 は捻出できる側', () => {
    expect(tradeoffSimulation({ amount: 50000, recurring: true }, [50000], null).verdict).toBe('covered');
  });

  it('試算後の余裕 0 は維持、−1 は割れる', () => {
    // 余裕 5,000/月 = 60,000/年。差額 60,000 で 0、60,001 で −1
    const keep = tradeoffSimulation({ amount: 60000, recurring: false }, [], 5000);
    expect(keep.marginAnnual).toBe(60000);
    expect(keep.afterMargin).toBe(0);
    expect(keep.defense).toBe('keep');
    const brk = tradeoffSimulation({ amount: 60001, recurring: false }, [], 5000);
    expect(brk.afterMargin).toBe(-1);
    expect(brk.defense).toBe('break');
  });

  it('防衛ラインが無い (nodata) と余裕・試算後・判定は null で、試算そのものは出す', () => {
    const r = tradeoffSimulation({ amount: 80000, recurring: true }, [85000], null);
    expect(r.marginAnnual).toBeNull();
    expect(r.afterMargin).toBeNull();
    expect(r.defense).toBeNull();
    expect(r.annualDiff).toBe(-60000);
  });

  it('開始月を変えても結果は変わらない', () => {
    const a = tradeoffSimulation({ amount: 80000, recurring: true, startMonth: '2026-07' }, [85000], 1000);
    const b = tradeoffSimulation({ amount: 80000, recurring: true, startMonth: '2027-12' }, [85000], 1000);
    const c = tradeoffSimulation({ amount: 80000, recurring: true, startMonth: null }, [85000], 1000);
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });
});

describe('防衛ラインの月の余裕', () => {
  it('nodata なら null、それ以外は diff を整数へ丸める', () => {
    expect(tradeoffDefenseMargin({ diff: 1234.6, status: 'ok' })).toEqual({
      monthlyMargin: 1235,
      status: 'ok',
    });
    expect(tradeoffDefenseMargin({ diff: 0, status: 'nodata' })).toEqual({
      monthlyMargin: null,
      status: 'nodata',
    });
  });
});

describe('covered の不変条件', () => {
  it('0 以上 1e10 以下の整数だけを受け入れる', () => {
    expect(isValidTradeoffCovered(0)).toBe(true);
    expect(isValidTradeoffCovered(10_000_000_000)).toBe(true);
    expect(isValidTradeoffCovered(10_000_000_001)).toBe(false);
    expect(isValidTradeoffCovered(-1)).toBe(false);
    expect(isValidTradeoffCovered(1.5)).toBe(false);
    expect(isValidTradeoffCovered(Number.NaN)).toBe(false);
  });
});

/** 推奨の入力に使う候補 (必要度と月額だけが効く) */
function cand(key: string, monthly: number, need: TradeoffScreenCandidate['need']): TradeoffScreenCandidate {
  return {
    key,
    account: key,
    partner: '',
    monthly,
    annual: monthly * 12,
    need,
    needSource: 'auto',
    trend: 'flat',
    reason: '',
    memo: null,
    relatedTo: null,
  };
}

describe('推奨の組み合わせ (決定 003)', () => {
  it('届かない組み合わせは入らず、1 件だけの組み合わせも出さない', () => {
    // 年額 120,000 = 月 10,000。A 単独で届くが 1 件は出さない
    const out = tradeoffCombos(
      [cand('A', 10000, 'mid'), cand('B', 100, 'mid'), cand('C', 100, 'mid')],
      120000,
    );
    expect(out.map((c) => c.keys)).toEqual([
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'B', 'C'],
    ]);
    expect(tradeoffCombos([cand('A', 100, 'mid'), cand('B', 100, 'mid')], 120000)).toEqual([]);
  });

  it('新しい支出の年額が 0 以下なら空', () => {
    expect(tradeoffCombos([cand('A', 10000, 'mid'), cand('B', 10000, 'mid')], 0)).toEqual([]);
  });

  it('第 1 段: 必要度 高 の件数が少ないほど上', () => {
    const out = tradeoffCombos(
      [cand('A', 6000, 'high'), cand('B', 6000, 'mid'), cand('C', 6000, 'mid')],
      144000,
    );
    expect(out[0].keys).toEqual(['B', 'C']);
    expect(out[0].highCount).toBe(0);
  });

  it('第 2 段: 高が同数なら 低 の件数が多いほど上', () => {
    const out = tradeoffCombos(
      [cand('A', 6000, 'mid'), cand('B', 6000, 'mid'), cand('C', 6000, 'low')],
      144000,
    );
    expect(out[0].keys).toEqual(['A', 'C']);
    expect(out[0].lowCount).toBe(1);
  });

  it('第 3 段: 高・低が同数なら超過額が小さいほど上', () => {
    const out = tradeoffCombos(
      [cand('A', 9000, 'mid'), cand('B', 7000, 'mid'), cand('C', 5000, 'mid')],
      144000,
    );
    expect(out[0].keys).toEqual(['B', 'C']);
    expect(out[0].excess).toBe(0);
  });

  it('第 4 段: 超過額も同じなら件数が少ないほど上', () => {
    const out = tradeoffCombos(
      [cand('A', 6000, 'mid'), cand('B', 6000, 'mid'), cand('C', 3000, 'mid'), cand('D', 3000, 'mid')],
      144000,
    );
    expect(out[0].keys).toEqual(['A', 'B']);
    expect(out[0].count).toBe(2);
  });

  it('第 5 段: すべて同じならキーを連結した文字列の辞書順', () => {
    const out = tradeoffCombos(
      [cand('B', 6000, 'mid'), cand('A', 6000, 'mid'), cand('C', 6000, 'mid')],
      144000,
    );
    expect(out.slice(0, 3).map((c) => c.keys.join(''))).toEqual(['AB', 'AC', 'BC']);
  });

  it('同じ入力で同じ上位 4 件、充足度は切り捨て、しやすさ・リスク・理由の文が付く', () => {
    const input = [
      cand('A', 50000, 'high'),
      cand('B', 40000, 'mid'),
      cand('C', 30000, 'low'),
      cand('D', 20000, 'low'),
      cand('E', 10000, 'mid'),
    ];
    const first = tradeoffCombos(input, 900000);
    expect(tradeoffCombos([...input].reverse(), 900000)).toEqual(first);
    expect(first).toHaveLength(4);
    expect(first[0]).toEqual({
      keys: ['B', 'C', 'D'],
      count: 3,
      monthlySaving: 90000,
      annualSaving: 1080000,
      excess: 180000,
      sufficiency: 120,
      lowCount: 2,
      highCount: 0,
      ease: '易しい',
      risk: '低',
      reason: '3 件で年間 1,080,000 円を削減、必要度 高 を 0 件含む',
    });
  });

  it('充足度は割り切れないとき切り捨てる (1,080,000 ÷ 640,000 = 168.75% → 168)', () => {
    const combo = tradeoffCombos(
      [cand('A', 50000, 'high'), cand('B', 40000, 'mid'), cand('C', 30000, 'low'), cand('D', 20000, 'low')],
      640000,
    ).find((c) => c.keys.join() === 'B,C,D');
    expect(combo?.annualSaving).toBe(1080000);
    expect(combo?.sufficiency).toBe(168);
  });

  it('候補は月額上位 12 件だけから組む', () => {
    const input = Array.from({ length: 13 }, (_, i) =>
      cand(`K${String(i).padStart(2, '0')}`, 13000 - i * 10, 'mid'),
    );
    input[12] = cand('K12', 12870, 'low');
    const out = tradeoffCombos(input, 12000 * 12 * 2);
    expect(out.every((c) => !c.keys.includes('K12'))).toBe(true);
  });

  it('しやすさ・リスクの写し方 (FR-09)', () => {
    const risk = (needs: TradeoffScreenCandidate['need'][]) =>
      tradeoffCombos(
        needs.map((n, i) => cand(`K${i}`, 10000, n)),
        10000 * 12 * needs.length,
      ).find((c) => c.count === needs.length);
    expect(risk(['low', 'mid'])).toMatchObject({ ease: '易しい', risk: '低' });
    expect(risk(['low', 'mid', 'high'])).toMatchObject({ ease: '普通', risk: '中' });
    expect(risk(['mid', 'high', 'high'])).toMatchObject({ ease: '難しい', risk: '高' });
  });
});
