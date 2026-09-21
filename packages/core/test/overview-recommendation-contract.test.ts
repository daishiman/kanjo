/**
 * recommendationFor は classifySuggestion の写しである、という契約 (BR-04〜BR-08)。
 *
 * /review-queue と明細仕分け画面は、同じ明細に対して同じ提案を出さなければならない。
 * 旧実装は優先順 (vendor_memory → ルール → MF 中項目) を両方に書いていたので、
 * 片方だけ直すと画面ごとに違う推奨が出た。判定の持ち主を classifySuggestion 1 つに
 * 寄せたことを、ここで機械的に固定する。
 */
import { describe, expect, it } from 'vitest';
import { classifySuggestion, recommendationFor } from '../src/index.js';
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

const CONTENT = 'アマゾン ウェブ サービス';
const RULE: Rule = { k: 'アマゾン', cls: 'biz', big: '通信費', mid: 'クラウド' };

describe('由来と信頼度が classifySuggestion と一致する', () => {
  const cases: { name: string; tx: MfTx | null; rules: Rule[]; memories: VendorMemoryRecord[] }[] = [
    { name: 'vendor_memory が当たる', tx: tx(), rules: [], memories: [memory()] },
    { name: 'ルールが当たる', tx: tx(), rules: [RULE], memories: [] },
    { name: 'MF 中項目だけが当たる', tx: tx({ mid: '事業経費' }), rules: [], memories: [] },
    { name: '何も当たらない', tx: tx({ c: 'セブンイレブン', mid: '' }), rules: [], memories: [] },
    {
      name: 'vendor_memory とルールが違うカテゴリを指す (衝突)',
      tx: tx(),
      rules: [{ k: 'アマゾン', cls: 'per', big: '日用品' }],
      memories: [memory()],
    },
    { name: '明細が無い (取込前の行)', tx: null, rules: [RULE], memories: [memory()] },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const s = classifySuggestion(c.tx, CONTENT, c.rules, c.memories);
      const r = recommendationFor(c.tx, CONTENT, c.rules, c.memories);
      if (!s.suggestion || s.basis === 'none') {
        expect(r).toEqual({
          recommendation: null,
          basis: 'none',
          basisLabel: '根拠なし',
          confidence: null,
        });
        return;
      }
      // 由来・表示名・信頼度は 1 か所から出る。basisLabel だけが /review-queue 固有の短文
      expect(r.basis).toBe(s.basis);
      expect(r.recommendation).toBe(s.label);
      expect(r.confidence).toBe(s.confidence);
    });
  }
});

describe('衝突の減点は両方に効く', () => {
  it('衝突すると recommendationFor の信頼度も下がる', () => {
    const conflicting: Rule[] = [{ k: 'アマゾン', cls: 'per', big: '日用品' }];
    const alone = recommendationFor(tx(), CONTENT, [], [memory()]);
    const conflicted = recommendationFor(tx(), CONTENT, conflicting, [memory()]);
    expect(alone.confidence).not.toBeNull();
    expect(conflicted.confidence).not.toBeNull();
    expect(conflicted.confidence as number).toBeLessThan(alone.confidence as number);
    expect(classifySuggestion(tx(), CONTENT, conflicting, [memory()]).conflict).toBe(true);
  });
});

describe('basisLabel は /review-queue 固有の短文のまま', () => {
  it('BR-08 の basisText を持ち込まない', () => {
    // 2 つは別物。混ぜると /review-queue の 1 行が仕分け画面の長文に置き換わる
    const r = recommendationFor(tx(), CONTENT, [], [memory()]);
    const s = classifySuggestion(tx(), CONTENT, [], [memory()]);
    expect(r.basisLabel).toBe('過去 10 件中 9 件');
    expect(s.basisText).toBe(
      '過去に同じ取引先を「事業 / 通信費 / クラウド」として仕分けた事例が9件あります。（全10件中）',
    );
  });
});
