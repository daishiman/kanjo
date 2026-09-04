/**
 * 明細1件ずつの振替の契約。
 *
 * 取り込んだ明細は、そのままでは直せない場所が2つ残っていた。
 *   - 口座(保有金融機関)。引き落とし元をMFが取り違えていても直す口が無い
 *   - 分割した内訳1行ごとの名義。妻と家族で分け合う引き落としを1回で表せない
 * どちらも「取込値は残したまま、有効値だけを差し替える」形で足した。
 * ここではその差し替えが効くこと、そして取込値を壊していないことを固定する。
 */
import { describe, expect, it } from 'vitest';
import { projectAccountingDataset } from '../src/dataset.js';
import { resolveTx } from '../src/index.js';
import { applySplits } from '../src/splits.js';
import { type MfTx, type Owner, type TxEdit, emptyDataset } from '../src/types.js';

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'A1',
  m: '2026-07',
  d: '2026-07-01',
  c: '架空スーパー',
  a: -10000,
  big: '食費',
  mid: '食料品',
  inst: '架空銀行',
  ...over,
});

/** 口座→名義。振替でどちらが引かれるかを見分けられるよう、二つの口座に別の名義を置く */
const institutionOwners: Record<string, Owner> = { 架空銀行: 'spouse', 架空カード: 'family' };

describe('口座の振替', () => {
  it('手当てが無ければ取込値の口座がそのまま有効値になる', () => {
    const r = resolveTx(tx(), [], {}, institutionOwners);
    expect(r.inst).toBe('架空銀行');
    expect(r.instSrc).toBe('取込値');
    expect(r.edited).toBe(false);
  });

  it('振替すると有効値だけが動き、取込値(MfTx.inst)は元のまま残る', () => {
    const t = tx();
    const edits: Record<string, TxEdit> = { A1: { inst: '架空カード' } };
    const r = resolveTx(t, [], edits, institutionOwners);

    expect(r.inst).toBe('架空カード');
    expect(r.instSrc).toBe('手動');
    // 取込値を書き換えると DR-13 の stable key(口座を材料に含む)が狂い、
    // 再取込のたびに手当てが別の明細へ付け替わる。ここは絶対に動かさない。
    expect(t.inst).toBe('架空銀行');
    // 口座だけを直した明細も「手当てあり」として扱う(取込値に戻す道を出すため)
    expect(r.edited).toBe(true);
  });

  it('名義の既定は振替後の口座から引く', () => {
    const r = resolveTx(tx(), [], { A1: { inst: '架空カード' } }, institutionOwners);
    // 取込時の口座(架空銀行=spouse)ではなく、振り替えた先(架空カード=family)を見る。
    // 前者だと画面の「口座」由来バッジが指す口座と実際の名義がずれる。
    expect(r.owner).toBe('family');
    expect(r.ownerSrc).toBe('口座');
  });

  it('手で決めた名義は振替に引きずられない', () => {
    const r = resolveTx(tx(), [], { A1: { inst: '架空カード', owner: 'business' } }, institutionOwners);
    expect(r.inst).toBe('架空カード');
    expect(r.owner).toBe('business');
    expect(r.ownerSrc).toBe('手動');
  });

  it('空文字の振替は「振替なし」として扱う', () => {
    const r = resolveTx(tx(), [], { A1: { inst: '' } }, institutionOwners);
    expect(r.inst).toBe('架空銀行');
    expect(r.instSrc).toBe('取込値');
  });
});

describe('内訳1行ごとの名義', () => {
  const LINE_IDS = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];

  const dataset = (lineOwners: (Owner | undefined)[]) => {
    const d = emptyDataset();
    // 分割は MF の ID 列がある明細にしか付かない(再取込後の同一性を保証できないため)
    d.mfTx = [tx({ a: -10000, idStable: true })];
    d.institutionOwners = { ...institutionOwners };
    d.txSplits = lineOwners.map((owner, i) => ({
      txId: 'A1',
      lineId: LINE_IDS[i],
      seq: i + 1,
      parentAmount: 10000,
      cls: 'per' as const,
      categoryMajor: i === 0 ? '食費' : '日用品',
      categoryMid: '',
      amount: 5000,
      ...(owner ? { owner } : {}),
    }));
    return d;
  };

  it('行ごとに違う名義を持てる', () => {
    const d = projectAccountingDataset(dataset(['spouse', 'family']));
    const owners = d.mfTx.map((t) => resolveTx(t, d.rules, d.edits, d.institutionOwners).owner);
    expect(d.mfTx).toHaveLength(2);
    expect(owners).toEqual(['spouse', 'family']);
  });

  it('名義を指定しない行は元の明細の名義に従う', () => {
    const d = dataset([undefined, 'family']);
    // 元の明細に手で名義を付けておく。指定なしの行はこれを継ぐ。
    d.edits = { A1: { owner: 'business', baseOwner: null, baseKnown: 8 } };
    const p = projectAccountingDataset(d);
    const owners = p.mfTx.map((t) => resolveTx(t, p.rules, p.edits, p.institutionOwners).owner);
    expect(owners).toEqual(['business', 'family']);
  });

  it('名義を指定した行は、親の名義と食い違っても衝突にしない', () => {
    // 内訳の名義は親の base ではなく内訳値で base を固定する。
    // しないと「親は business・内訳は family」が毎回3点比較の衝突として出続ける。
    const d = dataset([undefined, 'family']);
    d.edits = { A1: { owner: 'business', baseOwner: null, baseKnown: 8 } };
    applySplits(d, d.txSplits);

    expect(d.mfTx[1].projectedEdit?.owner).toBe('family');
    expect(d.mfTx[1].projectedEdit?.baseOwner).toBe('family');
    // 指定なしの行は親の手当てをそのまま引き継ぐ(owner のキーを置き換えない)
    expect(d.mfTx[0].projectedEdit?.owner).toBe('business');
    expect(d.mfTx[0].projectedEdit?.baseOwner).toBeNull();
  });
});
