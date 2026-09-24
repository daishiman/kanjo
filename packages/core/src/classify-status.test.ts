import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_TIER_HIGH_MIN,
  CONFIDENCE_TIER_MEDIUM_MIN,
  CONFLICT_CONFIDENCE_PENALTY,
  MF_MID_CONFIDENCE,
  REVIEW_CONFIDENCE_THRESHOLD,
  RULE_KEYWORD_CONFIDENCE,
  RULE_PAYEE_CONFIDENCE,
  applySplitTemplate,
  classifyCounts,
  classifyStatus,
  classifySuggestion,
  confidenceTier,
  confidenceTierText,
  isContradiction,
  matchesSuggestion,
  payeeOf,
  paymentMethodFor,
  ruleTargets,
  splitTemplateIssues,
} from './classify-status.js';
import type { MfTx, Rule, SplitTemplate } from './types.js';
import type { VendorMemoryRecord } from './vendor-memory.js';

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 't1',
  m: '2026-09',
  d: '09/01',
  c: 'アマゾン ウェブ サービス',
  a: -5000,
  big: '通信費',
  mid: '',
  ...over,
});

const memory = (over: Partial<VendorMemoryRecord> = {}): VendorMemoryRecord => ({
  vendorKey: 'アマゾンウェブサービス',
  cls: 'biz',
  big: '通信費',
  mid: 'クラウド',
  hitCount: 9,
  disagreeCount: 1,
  ...over,
});

describe('classifyStatus (BR-01・BR-02)', () => {
  it('clsSrc が 既定 のものだけを未整理にする', () => {
    expect(classifyStatus({ clsSrc: '既定' }).status).toBe('unsorted');
    expect(classifyStatus({ clsSrc: 'ルール' }).status).toBe('done');
    expect(classifyStatus({ clsSrc: '中項目' }).status).toBe('done');
  });

  it('手動は提案一致のときだけ完了、それ以外は手動変更', () => {
    const base = { clsSrc: '手動', origin: 'manual' } as const;
    expect(classifyStatus({ ...base, matchedProposal: 1 }).status).toBe('done');
    expect(classifyStatus({ ...base, matchedProposal: 0 }).status).toBe('manual');
    // 列が無かった時期の行 (null) は完了と断定できないので手動変更へ倒す
    expect(classifyStatus({ ...base, matchedProposal: null }).status).toBe('manual');
    expect(classifyStatus({ clsSrc: '手動' }).status).toBe('manual');
  });

  it('後から提案が変わっても区分は変わらない (AT-13)', () => {
    // 区分は保存の時点で決めた matched_proposal だけで決まる。いまの提案の強さは見ない。
    // ここで提案を読み直すと、利用者が何もしていないのに完了と手動変更が入れ替わる
    const done = { clsSrc: '手動', origin: 'manual', matchedProposal: 1 } as const;
    const manual = { clsSrc: '手動', origin: 'manual', matchedProposal: 0 } as const;
    const suggestions = [
      { confidence: 95 },
      { confidence: 10 },
      { confidence: null },
      { confidence: 60, conflict: true, contradiction: true },
    ];
    expect(suggestions.map((s) => classifyStatus({ ...done, ...s }).status)).toEqual([
      'done',
      'done',
      'done',
      'done',
    ]);
    expect(suggestions.map((s) => classifyStatus({ ...manual, ...s }).status)).toEqual([
      'manual',
      'manual',
      'manual',
      'manual',
    ]);
    // 確定済みの明細には要確認も立たない (BR-03)
    expect(suggestions.every((s) => !classifyStatus({ ...done, ...s }).needsReview)).toBe(true);
  });

  it('vendor_memory が自動適用した手当ては、一致フラグが null でも完了にする', () => {
    const result = classifyStatus({
      clsSrc: '手動',
      origin: 'vendor_memory',
      matchedProposal: null,
      confidence: 50,
      conflict: true,
      contradiction: true,
    });

    expect(result).toEqual({ status: 'done', needsReview: false, reviewReasons: [] });
  });
});

describe('needsReview (BR-03)', () => {
  it('信頼度 79 は要確認、80 は要確認でない', () => {
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBe(80);
    expect(classifyStatus({ clsSrc: '既定', confidence: 79 }).reviewReasons).toEqual(['low_confidence']);
    expect(classifyStatus({ clsSrc: '既定', confidence: 80 }).needsReview).toBe(false);
  });

  it('信頼度が null (提案なし) は要確認に数えない', () => {
    expect(classifyStatus({ clsSrc: '既定', confidence: null }).needsReview).toBe(false);
  });

  it('未整理でなければ要確認は立たない', () => {
    const r = classifyStatus({ clsSrc: 'ルール', confidence: 10, conflict: true, contradiction: true });
    expect(r.status).toBe('done');
    expect(r.needsReview).toBe(false);
  });

  it('衝突と矛盾はそれぞれ理由として並ぶ', () => {
    const r = classifyStatus({ clsSrc: '既定', confidence: 60, conflict: true, contradiction: true });
    expect(r.reviewReasons).toEqual(['low_confidence', 'conflict', 'contradiction']);
  });
});

describe('classifyCounts (AT-12)', () => {
  it('3 区分の和が全件に一致し、要確認は未整理を超えない', () => {
    const results = [
      classifyStatus({ clsSrc: '既定', confidence: 50 }),
      classifyStatus({ clsSrc: '既定', confidence: 90 }),
      classifyStatus({ clsSrc: '手動', origin: 'manual', matchedProposal: 0 }),
      classifyStatus({ clsSrc: 'ルール' }),
      classifyStatus({ clsSrc: '中項目' }),
    ];
    const c = classifyCounts(results);
    expect(c).toEqual({ all: 5, unsorted: 2, review: 1, manual: 1, done: 2 });
    expect(c.unsorted + c.manual + c.done).toBe(c.all);
    expect(c.review).toBeLessThanOrEqual(c.unsorted);
  });
});

describe('classifySuggestion の信頼度 (BR-04)', () => {
  it('取引先の決め事は実績の比率をそのまま百分率にする', () => {
    const s = classifySuggestion(tx(), tx().c, [], [memory()]);
    expect(s.basis).toBe('vendor_memory');
    expect(s.confidence).toBe(90); // 9/(9+1)
    expect(s.basisText).toBe(
      '過去に同じ取引先を「事業 / 通信費 / クラウド」として仕分けた事例が9件あります。（全10件中）',
    );
  });

  it('取引先とキーワードの両方に一致するルールは 95、キーワードだけは 85', () => {
    const both: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費', payee: payeeOf(tx().c) };
    const only: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費' };
    expect(classifySuggestion(tx(), tx().c, [both], []).confidence).toBe(RULE_PAYEE_CONFIDENCE);
    expect(classifySuggestion(tx(), tx().c, [only], []).confidence).toBe(RULE_KEYWORD_CONFIDENCE);
    expect(RULE_PAYEE_CONFIDENCE).toBe(95);
    expect(RULE_KEYWORD_CONFIDENCE).toBe(85);
  });

  it('payee が一致しないルールは当たらない', () => {
    const rule: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費', payee: 'ベツノトリヒキサキ' };
    expect(classifySuggestion(tx(), tx().c, [rule], []).basis).toBe('none');
  });

  it('MF の中項目だけが根拠なら 70', () => {
    const s = classifySuggestion(tx({ mid: '事業経費' }), 'ナゾノテン', [], []);
    expect(s.basis).toBe('mf_mid');
    expect(s.confidence).toBe(MF_MID_CONFIDENCE);
    expect(s.basisText).toBe('MF の中項目「事業経費」から「事業」を提案しています。');
  });

  it('提案が無ければ信頼度は null', () => {
    const s = classifySuggestion(tx({ c: 'ナゾノテン' }), 'ナゾノテン', [], []);
    expect(s).toMatchObject({
      suggestion: null,
      confidence: null,
      basis: 'none',
      basisText: '提案に使える過去の事例・ルール・中項目がありません。',
    });
  });

  it('取消済みの決め事は提案に使わない', () => {
    expect(classifySuggestion(tx(), tx().c, [], [memory({ revoked: true })]).basis).toBe('none');
  });
});

describe('衝突と矛盾 (BR-05)', () => {
  it('別々のカテゴリを指す由来が 2 つあれば、最小の信頼度から 20 引く', () => {
    const rule: Rule = { k: 'アマゾン', cls: 'per', big: '日用品' };
    const s = classifySuggestion(tx(), tx().c, [rule], [memory()]);
    expect(s.conflict).toBe(true);
    // 取引先の決め事 90 とキーワードだけのルール 85 の小さい方 − 20
    expect(s.confidence).toBe(RULE_KEYWORD_CONFIDENCE - CONFLICT_CONFIDENCE_PENALTY);
    expect(s.basisText).toContain('別の根拠が「家計 / 日用品」を提案しているため、信頼度を下げています。');
  });

  it('同じカテゴリを指す由来が重なっても衝突にしない', () => {
    const rule: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費', mid: 'クラウド' };
    const s = classifySuggestion(tx(), tx().c, [rule], [memory()]);
    expect(s.conflict).toBe(false);
    expect(s.confidence).toBe(90);
  });

  it('区分と所有者の食い違いを矛盾とする', () => {
    expect(isContradiction('per', 'business')).toBe(true);
    expect(isContradiction('biz', 'family')).toBe(true);
    expect(isContradiction('biz', 'business')).toBe(false);
    expect(isContradiction('per', 'family')).toBe(false);
    expect(isContradiction(null, 'business')).toBe(false);
    const s = classifySuggestion(tx(), tx().c, [], [memory({ cls: 'per', owner: 'business' })]);
    expect(s.contradiction).toBe(true);
    expect(s.basisText).toContain('区分と所有者が一致していません。');
  });
});

describe('matchesSuggestion (BR-09)', () => {
  const suggestion = { cls: 'biz' as const, big: '通信費', mid: 'クラウド', owner: 'business' as const };

  it('4 値すべてが同じときだけ一致', () => {
    expect(matchesSuggestion(suggestion, { ...suggestion })).toBe(true);
    expect(matchesSuggestion(suggestion, { ...suggestion, mid: '別' })).toBe(false);
    expect(matchesSuggestion(suggestion, { ...suggestion, owner: 'family' })).toBe(false);
  });

  it('提案が無ければ常に不一致 (= 手動変更)', () => {
    expect(matchesSuggestion(null, { cls: 'biz', big: '', mid: '', owner: null })).toBe(false);
  });

  it('空文字と null を同じ「未設定」として比べる', () => {
    const s = { cls: 'biz' as const, big: null, mid: null, owner: null };
    expect(matchesSuggestion(s, { cls: 'biz', big: '', mid: '', owner: null })).toBe(true);
  });
});

describe('分割の型 (BR-10)', () => {
  const template: SplitTemplate = {
    lines: [
      { kind: 'fixed', amount: 3000, cls: 'biz', big: '通信費' },
      { kind: 'remainder', cls: 'per', big: '日用品' },
    ],
  };

  it('残額 = 元の金額 − 固定額の合計で、和は元の金額に戻る', () => {
    const lines = applySplitTemplate(-5000, template);
    expect(lines?.map((l) => l.amount)).toEqual([3000, 2000]);
    expect(lines?.reduce((s, l) => s + l.amount, 0)).toBe(5000);
  });

  it('残額が 0 以下なら分割できない', () => {
    expect(applySplitTemplate(-3000, template)).toBeNull();
    expect(applySplitTemplate(-2000, template)).toBeNull();
  });

  it('残額の行は 1 行、固定額の行は 1 行以上', () => {
    expect(splitTemplateIssues(template, 50)).toEqual([]);
    const twoRemainders: SplitTemplate = {
      lines: [...template.lines, { kind: 'remainder', cls: 'per' }],
    };
    expect(splitTemplateIssues(twoRemainders, 50)).toContain('残額の行はちょうど1行にしてください');
    expect(splitTemplateIssues({ lines: [{ kind: 'remainder', cls: 'per' }] }, 50)).toContain(
      '固定額の行を1行以上にしてください',
    );
    const negative: SplitTemplate = {
      lines: [{ kind: 'fixed', amount: -1, cls: 'biz' }, ...template.lines.slice(1)],
    };
    expect(splitTemplateIssues(negative, 50)).toContain('固定額は正の整数にしてください');
    expect(splitTemplateIssues(template, 1)).toContain('分割は1行までです');
  });
});

describe('ruleTargets (BR-11)', () => {
  const rows = [
    { txId: 'a', tx: tx({ id: 'a' }), content: tx().c, status: 'unsorted' as const, hasSplit: false },
    { txId: 'b', tx: tx({ id: 'b' }), content: tx().c, status: 'done' as const, hasSplit: false },
    { txId: 'c', tx: tx({ id: 'c' }), content: tx().c, status: 'manual' as const, hasSplit: false },
    { txId: 'd', tx: tx({ id: 'd' }), content: tx().c, status: 'unsorted' as const, hasSplit: true },
    {
      txId: 'e',
      tx: tx({ id: 'e' }),
      content: tx().c,
      status: 'unsorted' as const,
      hasSplit: false,
      deleted: true,
    },
    {
      txId: 'g',
      tx: tx({ id: 'g' }),
      content: tx().c,
      status: 'done' as const,
      hasSplit: false,
      userConfirmed: true,
    },
    {
      txId: 'f',
      tx: tx({ id: 'f', c: 'ベツノミセ' }),
      content: 'ベツノミセ',
      status: 'unsorted' as const,
      hasSplit: false,
    },
  ];

  it('検査対象は 7 件ある', () => {
    expect(rows).toHaveLength(7);
  });

  it('利用者が提案どおり確定した完了の明細も外す', () => {
    expect(ruleTargets({ k: 'アマゾン' }, rows).map((r) => r.txId)).not.toContain('g');
  });

  it('手動変更・削除済み・一致しない明細は外す (AT-14)', () => {
    const hit = ruleTargets({ k: 'アマゾン' }, rows);
    expect(hit.map((r) => r.txId)).toEqual(['a', 'b', 'd']);
  });

  it('scope=unconfirmed は未整理だけに当たる', () => {
    const hit = ruleTargets({ k: 'アマゾン', scope: 'unconfirmed' }, rows);
    expect(hit.map((r) => r.txId)).toEqual(['a', 'd']);
  });

  it('分割の型を持つルールは、すでに分割済みの明細を二重に割らない', () => {
    const template: SplitTemplate = {
      lines: [
        { kind: 'fixed', amount: 1000, cls: 'biz' },
        { kind: 'remainder', cls: 'per' },
      ],
    };
    const hit = ruleTargets({ k: 'アマゾン', splitTemplate: template }, rows);
    expect(hit.map((r) => r.txId)).toEqual(['a', 'b']);
  });

  it('payee を持つルールは取引先キーまで一致した明細だけに当たる', () => {
    const hit = ruleTargets({ k: 'アマゾン', payee: payeeOf(tx().c) }, rows);
    expect(hit.map((r) => r.txId)).toEqual(['a', 'b', 'd']);
    expect(ruleTargets({ k: 'アマゾン', payee: 'ホカノミセ' }, rows)).toHaveLength(0);
  });
});

describe('paymentMethodFor (BR-13)', () => {
  it('上書きがあればそれ、無ければ明細からの判定', () => {
    expect(paymentMethodFor({ paymentMethod: 'cash' }, 'card')).toEqual({ method: 'cash', source: 'edit' });
    expect(paymentMethodFor({ paymentMethod: null }, 'card')).toEqual({ method: 'card', source: 'derived' });
    expect(paymentMethodFor(undefined, 'unknown')).toEqual({ method: 'unknown', source: 'derived' });
  });
});

describe('payeeOf (BR-12)', () => {
  it('正規化した取引先キーを返し、作れなければ内容をそのまま返す', () => {
    expect(payeeOf('アマゾン ウェブ サービス')).toBe('アマゾンウェブサービス');
    expect(payeeOf('  ')).toBe('  ');
  });
});

describe('信頼度の段階 (高 80 以上・中 50〜79・低 49 以下)', () => {
  it('境界の前後を段階へ振り分ける', () => {
    expect([0, 49, 50, 79, 80, 100].map(confidenceTier)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
    ]);
  });

  it('範囲外・数でない値は段階を持たない', () => {
    expect([-1, 101, Number.NaN, null, undefined].map(confidenceTier)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(confidenceTierText(101)).toBe('—');
  });

  it('表示は『段階＋%』', () => {
    expect(confidenceTierText(92)).toBe('高 92%');
    expect(confidenceTierText(55)).toBe('中 55%');
    expect(confidenceTierText(0)).toBe('低 0%');
  });

  it('要確認の閾値と高の下限はともに 80 (閾値は変えない)', () => {
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBe(80);
    expect(CONFIDENCE_TIER_HIGH_MIN).toBe(REVIEW_CONFIDENCE_THRESHOLD);
    expect(CONFIDENCE_TIER_MEDIUM_MIN).toBe(50);
  });
});
