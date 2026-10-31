/**
 * recommendationFor は classifySuggestion の写しである、という契約 (BR-04〜BR-08)。
 *
 * /review-queue と明細仕分け画面は、同じ明細に対して同じ提案を出さなければならない。
 * 旧実装は優先順 (vendor_memory → ルール → MF 中項目) を両方に書いていたので、
 * 片方だけ直すと画面ごとに違う推奨が出た。判定の持ち主を classifySuggestion 1 つに
 * 寄せたことを、ここで機械的に固定する。
 *
 * spec-classify-bulk-save で提案の最後に MF の分類 (AC-11・AC-12) が加わり、入力は
 * SuggestionContext 1 つになった。根拠の短い文 (basisLabel) も候補を作った 1 か所
 * (shortLabel) から出し、/review-queue の側で組み直さない。
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAX_ACCOUNT_MAP,
  type SuggestionContext,
  buildCandidates,
  classifySuggestion,
  recommendationFor,
} from '../src/index.js';
import type { MfTx, Rule } from '../src/types.js';
import type { VendorMemoryRecord } from '../src/vendor-memory.js';

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

const ctx = (over: Partial<SuggestionContext> = {}): SuggestionContext => ({
  rules: [],
  vendorMemories: [],
  normRules: [],
  taxAccountMap: DEFAULT_TAX_ACCOUNT_MAP,
  categoryCandidates: buildCandidates([], [{ big: '食費', mid: '食料品' }], []),
  ...over,
});

type Resolved = { cls: 'biz' | 'per' | null; owner: 'business' | 'spouse' | 'family' | null } | null;
const PER = { cls: 'per', owner: 'family' } as const;
const BIZ = { cls: 'biz', owner: 'business' } as const;

const CONTENT = 'アマゾン ウェブ サービス';
const RULE: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費', mid: 'クラウド' };

describe('由来と信頼度が classifySuggestion と一致する', () => {
  const cases: {
    name: string;
    tx: MfTx | null;
    resolved: Resolved;
    rules: Rule[];
    memories: VendorMemoryRecord[];
    basis: string;
  }[] = [
    {
      name: 'vendor_memory が当たる',
      tx: tx(),
      resolved: PER,
      rules: [],
      memories: [memory()],
      basis: 'vendor_memory',
    },
    { name: 'ルールが当たる', tx: tx(), resolved: PER, rules: [RULE], memories: [], basis: 'rule' },
    {
      name: 'MF 中項目だけが当たる',
      tx: tx({ mid: '事業経費' }),
      resolved: BIZ,
      rules: [],
      memories: [],
      basis: 'mf_mid',
    },
    {
      name: 'MF の分類だけが当たる (家計)',
      tx: tx(),
      resolved: PER,
      rules: [],
      memories: [],
      basis: 'mf_category',
    },
    {
      name: 'MF の分類だけが当たる (事業は対応表で科目へ)',
      tx: tx(),
      resolved: BIZ,
      rules: [],
      memories: [],
      basis: 'mf_category_map',
    },
    {
      name: '何も当たらない (MF が未分類のまま渡した明細)',
      tx: tx({ c: 'セブンイレブン', big: '未分類', mid: '' }),
      resolved: PER,
      rules: [],
      memories: [],
      basis: 'none',
    },
    {
      name: 'vendor_memory とルールが違うカテゴリを指す (衝突)',
      tx: tx(),
      resolved: PER,
      rules: [{ k: 'アマゾン', cls: 'per', big: '日用品' }],
      memories: [memory()],
      basis: 'vendor_memory',
    },
    {
      name: '明細が無い (取込前の行)',
      tx: null,
      resolved: null,
      rules: [RULE],
      memories: [memory()],
      basis: 'vendor_memory',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const input = ctx({ rules: c.rules, vendorMemories: c.memories });
      const s = classifySuggestion(c.tx, c.resolved, input, CONTENT);
      const r = recommendationFor(c.tx, c.resolved, input, CONTENT);
      expect(s.basis).toBe(c.basis);
      if (!s.suggestion || s.basis === 'none') {
        expect(r).toEqual({
          recommendation: null,
          basis: 'none',
          basisLabel: '根拠なし',
          confidence: null,
        });
        return;
      }
      // 由来・表示名・信頼度・短い根拠は 1 か所から出る
      expect(r).toEqual({
        recommendation: s.label,
        basis: s.basis,
        basisLabel: s.shortLabel,
        confidence: s.confidence,
      });
    });
  }
});

describe('衝突の減点は両方に効く', () => {
  it('衝突すると recommendationFor の信頼度も下がる', () => {
    const conflicting: Rule[] = [{ k: 'アマゾン', cls: 'per', big: '日用品' }];
    const alone = recommendationFor(tx(), PER, ctx({ vendorMemories: [memory()] }), CONTENT);
    const conflicted = recommendationFor(
      tx(),
      PER,
      ctx({ rules: conflicting, vendorMemories: [memory()] }),
      CONTENT,
    );
    expect(alone.confidence).not.toBeNull();
    expect(conflicted.confidence).not.toBeNull();
    expect(conflicted.confidence as number).toBeLessThan(alone.confidence as number);
    expect(
      classifySuggestion(tx(), PER, ctx({ rules: conflicting, vendorMemories: [memory()] }), CONTENT)
        .conflict,
    ).toBe(true);
  });
});

describe('basisLabel は候補を作った由来の短い文 (shortLabel) で、BR-08 の basisText を持ち込まない', () => {
  it('過去の仕分けは件数の短文', () => {
    // 2 つは別物。混ぜると /review-queue の 1 行が仕分け画面の長文に置き換わる
    const input = ctx({ vendorMemories: [memory()] });
    const r = recommendationFor(tx(), PER, input, CONTENT);
    const s = classifySuggestion(tx(), PER, input, CONTENT);
    expect(r.basisLabel).toBe('過去 10 件中 9 件');
    expect(s.shortLabel).toBe('過去 10 件中 9 件');
    expect(s.basisText).toBe(
      '過去に同じ取引先を「事業 / 通信費 / クラウド」として仕分けた事例が9件あります。（全10件中）',
    );
  });

  it('MF の分類は由来の名前を短文にし、対応表の根拠文は basisText にだけ出す', () => {
    const r = recommendationFor(tx(), BIZ, ctx(), CONTENT);
    expect(r).toEqual({
      recommendation: '事業 / 通信費',
      basis: 'mf_category_map',
      basisLabel: 'MF の分類 (対応表)',
      confidence: 60,
    });
    expect(classifySuggestion(tx(), BIZ, ctx(), CONTENT).basisText).toBe('通信費 → 通信費');
  });
});
