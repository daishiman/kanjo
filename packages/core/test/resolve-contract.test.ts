import { describe, expect, it } from 'vitest';
import {
  type MfTx,
  type Rule,
  type TxEdit,
  applyClassification,
  emptyDataset,
  exportJSON,
  household,
  importJSON,
  overridesFromEdits,
  parseMfRows,
  resolveTx,
} from '../src/index.js';

const tx = (over: Partial<MfTx>): MfTx => ({
  id: 'x',
  m: '2026-07',
  d: '2026-07-01',
  c: '架空スーパー',
  a: -1000,
  big: '食費',
  mid: '食料品',
  ...over,
});

describe('属性の解決順序(手動 > ルール > 口座 > 取込値/既定)', () => {
  const rules: Rule[] = [
    { k: '架空スーパー', cls: null, big: '日用品', mid: null, owner: null },
    { k: '架空', cls: 'biz', big: null, mid: null, owner: 'spouse' },
  ];
  const inst = { 楽天カード: 'business' as const };

  it('何も無ければ取込値と既定', () => {
    const r = resolveTx(tx({ c: '無関係' }), rules, {}, inst);
    expect(r).toMatchObject({
      cls: 'per',
      clsSrc: '既定',
      big: '食費',
      mid: '食料品',
      catSrc: '取込値',
      owner: null,
      ownerSrc: '既定',
    });
    expect(r.edited).toBe(false);
    expect(r.conflict).toBe(false);
  });

  it('ルールは属性ごとに「その属性を持つ最初のルール」が勝つ', () => {
    const r = resolveTx(tx({}), rules, {}, inst);
    expect(r.big).toBe('日用品'); // 1本目(big だけ設定)
    expect(r.mid).toBe(''); // 大項目を差し替えたら中項目は組で置き換わる(取込値の中項目は残さない)
    expect(r.cls).toBe('biz'); // 2本目
    expect(r.owner).toBe('spouse'); // 2本目
    expect(r.catSrc).toBe('ルール');
  });

  it('科目はルール1本の(大項目, 中項目)を組で採用し、別ルールの中項目を混ぜない', () => {
    const r = resolveTx(
      tx({}),
      [
        { k: '架空スーパー', cls: null, big: '新聞図書費', mid: null, owner: null },
        { k: '架空', cls: null, big: null, mid: '書籍', owner: null },
      ],
      {},
      inst,
    );
    expect(r.big).toBe('新聞図書費');
    expect(r.mid).toBe(''); // 2本目の中項目「書籍」は混ぜない(事業科目+家計中項目の混在を防ぐ)
    expect(r.catSrc).toBe('ルール');
  });

  it('口座の名義はルールより弱く、既定より強い', () => {
    const r = resolveTx(tx({ c: '無関係', inst: '楽天カード' }), rules, {}, inst);
    expect(r.owner).toBe('business');
    expect(r.ownerSrc).toBe('口座');
  });

  it('手動編集は全てに勝ち、編集済みになる', () => {
    const edits: Record<string, TxEdit> = {
      x: { cls: 'per', big: '交際費', owner: 'business', baseBig: '食費', baseMid: '食料品' },
    };
    const r = resolveTx(tx({}), rules, edits, inst);
    expect(r).toMatchObject({
      cls: 'per',
      clsSrc: '手動',
      big: '交際費',
      mid: '', // 大項目+中項目は1組。大項目だけ編集しても取込値の中項目は引き継がない
      catSrc: '手動',
      owner: 'business',
      ownerSrc: '手動',
    });
    expect(r.edited).toBe(true);
    expect(r.conflict).toBe(false);
  });

  it('再取込で取込値が変わると食い違い(conflict)になる', () => {
    const edits: Record<string, TxEdit> = { x: { big: '交際費', baseBig: '食費', baseMid: '食料品' } };
    const r = resolveTx(tx({ big: '外食', mid: 'カフェ' }), rules, edits, inst);
    expect(r.conflict).toBe(true);
    expect(r.big).toBe('交際費');
  });

  it('overrides(HTML版互換) は cls を持つ編集だけを写す', () => {
    expect(overridesFromEdits({ a: { cls: 'biz' }, b: { big: 'X' } })).toEqual({ a: 'biz' });
  });
});

describe('名義別の集計', () => {
  it('個人分の収入・支出を事業/妻/家族/未設定に分ける', () => {
    const txs: MfTx[] = [
      tx({ id: '1', a: 300000, big: '収入', mid: '給与', inst: 'A銀行' }),
      tx({ id: '2', a: 100000, big: '収入', mid: '給与', inst: 'B銀行' }),
      tx({ id: '3', a: -5000, inst: 'A銀行' }),
      tx({ id: '4', a: 20000, big: '収入', mid: 'その他' }),
      tx({ id: '5', a: -9999, c: '架空事業', inst: 'A銀行' }),
    ];
    const r = applyClassification(
      txs,
      [{ k: '架空事業', cls: 'biz' }],
      { '4': { owner: 'spouse' }, '3': { owner: 'family' } },
      { A銀行: 'business' },
    );
    const o = r.personalByOwner['2026-07'];
    expect(o.business).toEqual({ income: 300000, expense: 0 });
    expect(o.spouse).toEqual({ income: 20000, expense: 0 });
    expect(o.family).toEqual({ income: 0, expense: 5000 });
    expect(o.unset).toEqual({ income: 100000, expense: 0 });
    // 事業分は名義集計に入れない
    expect(r.bizPersonal['2026-07'].expense).toBe(9999);
  });

  it('旧self exportをbusinessへ正規化し、新exportはcanonical ownerだけを出す', () => {
    const data = emptyDataset();
    importJSON(data, {
      months: ['2026-07'],
      rules: [{ k: '架空', cls: null, owner: 'self' }],
      edits: { legacy: { owner: 'self' } },
      institutionOwners: { 架空銀行: 'self', 空欄口座: null },
      personalByOwner: {
        '2026-07': {
          self: { income: 10, expense: 20 },
          spouse: { income: 1, expense: 2 },
          unset: { income: 0, expense: 0 },
        },
      },
    });
    expect(data.rules[0].owner).toBe('business');
    expect(data.edits.legacy.owner).toBe('business');
    expect(data.institutionOwners).toEqual({ 架空銀行: 'business' });
    expect(data.personalByOwner['2026-07'].business).toEqual({ income: 10, expense: 20 });
    const exported = exportJSON(data) as Record<string, unknown>;
    expect(exported.ownerSchemaVersion).toBe(2);
    expect(JSON.stringify(exported)).not.toContain('"self"');
  });

  it('未知ownerは復元時に捨てず拒否する', () => {
    expect(() => importJSON(emptyDataset(), { institutionOwners: { 架空銀行: 'unknown' } })).toThrow(
      'unknown owner',
    );
  });
});

describe('MFパーサー: 保有金融機関', () => {
  it('列があれば inst に入り、無ければ undefined', () => {
    const header = [
      '計算対象',
      '日付',
      '内容',
      '金額（円）',
      '保有金融機関',
      '大項目',
      '中項目',
      'メモ',
      '振替',
      'ID',
    ];
    const rows = [
      header,
      ['1', '2026/07/01', '架空スーパー', '-1000', '架空銀行 だいし', '食費', '食料品', '', '0', 'id1'],
    ];
    const [t] = parseMfRows(rows).txs;
    expect(t.inst).toBe('架空銀行 だいし');
    const [t2] = parseMfRows([
      header.filter((h) => h !== '保有金融機関'),
      ['1', '2026/07/01', 'x', '-1', '食費', '食料品', '', '0', 'id2'],
    ]).txs;
    expect(t2.inst).toBeUndefined();
  });
});

describe('事業 vs 個人の比較と名義別(家計)', () => {
  it('月ごとに freee と MF を並べ、片側だけの月は null。合計はデータのある月数で平均', () => {
    const d = emptyDataset();
    d.months = ['2026-06', '2026-07'];
    d.biz = {
      revenue: [500000, 400000],
      categories: ['架空固定費'],
      expense: { 架空固定費: [100000, 100000] },
    };
    d.unrecordedExpMonths = ['2026-07'];
    d.personal = {
      '2026-07': { income: { 給与: 300000 }, expense: { 食費: 50000 } },
      '2026-08': { income: { 給与: 300000 }, expense: { 食費: 70000 } },
    };
    d.personalByOwner = {
      '2026-07': {
        business: { income: 300000, expense: 50000 },
        spouse: { income: 0, expense: 0 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 0 },
      },
      '2026-08': {
        business: { income: 200000, expense: 70000 },
        spouse: { income: 100000, expense: 0 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 0 },
      },
    };
    d.mfTx = [tx({ id: 'a', inst: '未設定銀行' }), tx({ id: 'b' })];
    const h = household(d);
    const c = h.comparison;
    expect(c.rows.map((r) => r.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(c.rows[0]).toMatchObject({
      biz: { income: 500000, expense: 100000, balance: 400000 },
      personal: { income: null, expense: null, balance: null },
    });
    expect(c.rows[1]).toMatchObject({
      biz: { income: 400000, expense: null, balance: null },
      personal: { income: 300000, expense: 50000, balance: 250000 },
    });
    expect(c.rows[2].biz).toEqual({ income: null, expense: null, balance: null });
    expect(c.biz.months).toBe(2);
    expect(c.biz.income).toBe(900000);
    expect(c.biz.monthlyAvg.income).toBe(450000);
    expect(c.biz.annualized.income).toBe(5400000);
    expect(c.personal.months).toBe(2);
    expect(c.personal.expense).toBe(120000);
    expect(c.personal.annualized.balance).toBe(((600000 - 120000) / 2) * 12);

    const o = h.byOwner;
    expect(o.rows).toHaveLength(2);
    expect(o.totals.business.income).toBe(500000);
    expect(o.totals.spouse.income).toBe(100000);
    expect(o.totals.spouse.incomeShare).toBeCloseTo(100000 / 600000);
    expect(o.totals.business.annualized.income).toBe(250000 * 12);
    expect(o.unmappedInstitutions).toEqual(['未設定銀行']);
    expect(o.noInstitutionCount).toBe(1);
  });
});
