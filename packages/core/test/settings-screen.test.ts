import { describe, expect, it } from 'vitest';
import {
  type CashOverrideRule,
  DEFAULT_OWNER_LABELS,
  type Dataset,
  type MfTx,
  NORM_RULE_CAT_SRC,
  type NormRule,
  type Rule,
  SETTINGS_IMPACTS,
  type SettingsChangeLogRow,
  type SettingsState,
  accountNormMap,
  applyCashOverrides,
  countSettingsChanges,
  diffSettings,
  emptyDataset,
  exportJSON,
  importJSON,
  normalizeAccount,
  resolveCashOverride,
  resolveTx,
  resolveVendorRule,
  settingsChangeEntries,
  settingsRevision,
  settingsScreen,
  settingsStateOf,
  settingsWriteState,
  shadowedNormRules,
  summarizeSettings,
  validateSettingsInput,
  vendorMatchKey,
} from '../src/index.js';

/** 設定画面 (spec-settings-screen) の BR-01〜BR-31 と AT-13 */

const rule = (
  ruleId: string,
  kind: NormRule['kind'],
  raw: string,
  norm: string,
  order: number,
  enabled = true,
): NormRule => ({
  ruleId,
  kind,
  raw,
  norm,
  order,
  enabled,
});

/** fixture: 勘定科目 2 行・取引先 7 行(画像の 7 行) */
const FIXTURE_RULES: NormRule[] = [
  rule('v1', 'vendor', 'スターバックス', 'カフェ・外食', 1),
  rule('v2', 'vendor', 'スタバ', 'カフェ・外食', 2),
  rule('v3', 'vendor', 'Starbucks', 'カフェ・外食', 3),
  rule('v4', 'vendor', 'スーパーマーケット', '食料品', 4),
  rule('v5', 'vendor', 'スーパー', '食料品', 5),
  rule('v6', 'vendor', 'Amazon.co.jp', '通信販売', 6),
  rule('v7', 'vendor', 'アマゾン', '通信販売', 7),
  rule('a1', 'account', '消耗品', '消耗品費', 8),
  rule('a2', 'account', '通信費用', '通信費', 9),
];

const state = (over: Partial<SettingsState> = {}): SettingsState => ({
  normRules: FIXTURE_RULES.map((r) => ({ ...r })),
  ownerLabels: { ...DEFAULT_OWNER_LABELS },
  statMinMonths: 6,
  cashOverrides: [],
  ...over,
});

const tx = (over: Partial<MfTx> = {}): MfTx => ({
  id: 't1',
  m: '2026-08',
  d: '08/10',
  c: 'スタバ',
  a: -600,
  big: '未分類',
  mid: '',
  ...over,
});

const cash = (overrideId: string, over: Partial<CashOverrideRule>): CashOverrideRule => ({
  overrideId,
  kind: 'payment',
  amount: 0,
  scope: 'all',
  month: null,
  memo: '',
  ...over,
});

describe('fixture', () => {
  it('勘定科目 2 行・取引先 7 行を持つ(0 件で緑にしない)', () => {
    expect(FIXTURE_RULES.filter((r) => r.kind === 'account')).toHaveLength(2);
    expect(FIXTURE_RULES.filter((r) => r.kind === 'vendor')).toHaveLength(7);
  });
});

describe('照合キー(BR-06)', () => {
  it('NFKC → 大文字小文字の畳み込み → 前後空白除去', () => {
    expect(vendorMatchKey('  ＳＴＡＲＢＵＣＫＳ ')).toBe('starbucks');
    expect(vendorMatchKey('ｽﾀﾊﾞ')).toBe('スタバ');
    expect(vendorMatchKey('Amazon.CO.JP')).toBe('amazon.co.jp');
  });
});

describe('取引先ルールの適用(BR-07〜BR-09・AT-13)', () => {
  it('手動編集も仕分けルールも当たらない明細は、照合キーが一致した行の大項目になる', () => {
    const cases: Array<[string, string]> = [
      ['スタバ', 'カフェ・外食'],
      ['ＳＴＡＲＢＵＣＫＳ', 'カフェ・外食'],
      [' スーパー ', '食料品'],
      ['amazon.co.jp', '通信販売'],
    ];
    for (const [c, big] of cases) {
      const r = resolveTx(tx({ c }), [], {}, {}, FIXTURE_RULES);
      expect(r.big).toBe(big);
      expect(r.mid).toBe('');
      expect(r.catSrc).toBe(NORM_RULE_CAT_SRC);
    }
    expect(cases).toHaveLength(4);
  });

  it('部分一致では当たらない(照合キーの完全一致)', () => {
    const r = resolveTx(tx({ c: 'スタバ 渋谷店' }), [], {}, {}, FIXTURE_RULES);
    expect(r.big).toBe('未分類');
    expect(r.catSrc).toBe('取込値');
  });

  it('手動編集 > 仕分けルール > 集計ルール(取引先) の順に効く', () => {
    const sorting: Rule[] = [{ k: 'スタバ', cls: 'per', big: '交際費', mid: '' }];
    const byRule = resolveTx(tx(), sorting, {}, {}, FIXTURE_RULES);
    expect(byRule.big).toBe('交際費');
    expect(byRule.catSrc).toBe('ルール');
    const byEdit = resolveTx(tx(), sorting, { t1: { big: '会議費', mid: '' } }, {}, FIXTURE_RULES);
    expect(byEdit.big).toBe('会議費');
    expect(byEdit.catSrc).toBe('手動');
  });

  it('同じ照合キーの行は並び順の上の行が効き、下の行は「上の行が優先されます」の対象になる', () => {
    const rules = [rule('x1', 'vendor', 'スタバ', '外食', 1), rule('x2', 'vendor', 'ｽﾀﾊﾞ', '喫茶', 2)];
    expect(resolveVendorRule('スタバ', rules)?.ruleId).toBe('x1');
    expect(shadowedNormRules(rules)).toEqual({ x2: 'x1' });
    const swapped = [rule('x1', 'vendor', 'スタバ', '外食', 2), rule('x2', 'vendor', 'ｽﾀﾊﾞ', '喫茶', 1)];
    expect(resolveVendorRule('スタバ', swapped)?.ruleId).toBe('x2');
  });

  it('無効な行は効かず、優先の注記も付かない', () => {
    const rules = [
      rule('x1', 'vendor', 'スタバ', '外食', 1, false),
      rule('x2', 'vendor', 'スタバ', '喫茶', 2),
    ];
    expect(resolveVendorRule('スタバ', rules)?.ruleId).toBe('x2');
    expect(shadowedNormRules(rules)).toEqual({});
    expect(resolveTx(tx(), [], {}, {}, [rule('x1', 'vendor', 'スタバ', '外食', 1, false)]).catSrc).toBe(
      '取込値',
    );
  });

  it('保存済みの明細は書き換えない(集計時だけ効く)', () => {
    const t = tx();
    const before = JSON.stringify(t);
    resolveTx(t, [], {}, {}, FIXTURE_RULES);
    expect(JSON.stringify(t)).toBe(before);
  });

  it('全データ JSON の書き出しと取込で集計ルールと現金上書きが往復する', () => {
    const data: Dataset = {
      ...emptyDataset(),
      normRules: FIXTURE_RULES,
      cashOverrideRules: [cash('o1', {})],
    };
    const back = emptyDataset();
    importJSON(back, JSON.parse(JSON.stringify(exportJSON(data))));
    expect(back.normRules).toHaveLength(9);
    expect(back.cashOverrideRules).toHaveLength(1);
  });
});

describe('勘定科目ルール(BR-05)', () => {
  it('既存 normalizeAccount と同じ結果になる', () => {
    const map = accountNormMap(FIXTURE_RULES);
    expect(map).toEqual({ 消耗品: '消耗品費', 通信費用: '通信費' });
    expect(normalizeAccount('消耗品', map)).toBe('消耗品費');
    expect(normalizeAccount('旅費交通費', map)).toBe('旅費交通費');
  });

  it('無効な行は写さず、同じ表記は並び順の最初が効く', () => {
    const map = accountNormMap([
      rule('a1', 'account', '消耗品', 'A', 2),
      rule('a2', 'account', '消耗品', 'B', 1),
      rule('a3', 'account', '雑費', 'C', 3, false),
    ]);
    expect(map).toEqual({ 消耗品: 'B' });
  });
});

describe('現金上書き(BR-12〜BR-14・AT-13)', () => {
  const cashTx = (id: string, m: string, a: number): MfTx =>
    tx({ id: `cash:${id}`, m, a, c: '現金', inst: '現金' });

  it('空欄は上書きしない・0 は 0 円・月指定は全期間より優先', () => {
    const rules = [
      cash('o1', { kind: 'payment', amount: 5000, scope: 'all' }),
      cash('o2', { kind: 'payment', amount: 0, scope: 'month', month: '2026-08' }),
      cash('o3', { kind: 'receipt', amount: null, scope: 'all' }),
    ];
    expect(resolveCashOverride(rules, '2026-08', 'payment')).toBe(0);
    expect(resolveCashOverride(rules, '2026-07', 'payment')).toBe(5000);
    expect(resolveCashOverride(rules, '2026-08', 'receipt')).toBeNull();
    expect(resolveCashOverride([], '2026-08', 'payment')).toBeNull();
  });

  it('支払い 0・全期間で、現金の支払いの月の合計が 0 になる', () => {
    const months = ['2026-07', '2026-08', '2026-09'];
    const txs = months.flatMap((m, i) => [cashTx(`p${i}`, m, -1000 * (i + 1)), cashTx(`r${i}`, m, 300)]);
    const out = applyCashOverrides(txs, [cash('o1', { amount: 0 })], months);
    for (const m of months) {
      const paid = out.filter((t) => t.m === m && t.a < 0).reduce((s, t) => s + t.a, 0);
      const got = out.filter((t) => t.m === m && t.a > 0).reduce((s, t) => s + t.a, 0);
      expect(paid).toBe(0);
      expect(got).toBe(300);
    }
    expect(months).toHaveLength(3);
  });

  it('月指定の値はその月の支払いを 1 件に置き換え、他の月は変えない', () => {
    const txs = [cashTx('a', '2026-07', -800), cashTx('b', '2026-08', -800), cashTx('c', '2026-08', -200)];
    const out = applyCashOverrides(
      txs,
      [cash('o1', { amount: 1500, scope: 'month', month: '2026-08' })],
      ['2026-07', '2026-08'],
    );
    expect(out.filter((t) => t.m === '2026-08').map((t) => t.a)).toEqual([-1500]);
    expect(out.filter((t) => t.m === '2026-07').map((t) => t.a)).toEqual([-800]);
  });

  it('現金でない明細は変えない', () => {
    const bank = tx({ id: 'bank1', a: -3000 });
    expect(applyCashOverrides([bank], [cash('o1', { amount: 0 })], ['2026-08'])).toEqual([bank]);
  });
});

describe('入力の検証(BR-01〜BR-17)', () => {
  it('正しい入力は空白を除き並び順を振る', () => {
    const v = validateSettingsInput({
      normRules: [
        { ruleId: 'n1', kind: 'vendor', raw: ' スタバ ', norm: 'カフェ', enabled: true },
        { ruleId: 'n2', kind: 'account', raw: '消耗品', norm: '消耗品費', enabled: false },
      ],
      statMinMonths: 12,
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.normRules?.map((r) => [r.raw, r.order])).toEqual([
        ['スタバ', 1],
        ['消耗品', 2],
      ]);
      expect(v.value.statMinMonths).toBe(12);
    }
  });

  it('不正な欄を鍵だけで返す', () => {
    const v = validateSettingsInput({
      normRules: [
        { ruleId: 'n1', kind: 'vendor', raw: '', norm: 'あ'.repeat(61), enabled: true },
        { ruleId: 'n1', kind: 'other' as never, raw: 'a\u0007', norm: 'x', enabled: true },
      ],
      statMinMonths: 25,
      cashOverrides: [
        { kind: 'payment', amount: -1, scope: 'month', month: '2026-13', memo: 'あ'.repeat(101) },
        { kind: 'payment', amount: 0, scope: 'all', month: null, memo: '' },
        { kind: 'payment', amount: 1, scope: 'all', month: null, memo: '' },
      ],
    });
    expect(v.ok).toBe(false);
    if (!v.ok)
      expect(v.fields).toEqual({
        'normRules.0.raw': 'required',
        'normRules.0.norm': 'too_long',
        'normRules.1.ruleId': 'duplicate_id',
        'normRules.1.kind': 'invalid_kind',
        'normRules.1.raw': 'control_char',
        statMinMonths: 'out_of_range',
        'cashOverrides.0.amount': 'out_of_range',
        'cashOverrides.0.month': 'invalid_month',
        'cashOverrides.0.memo': 'too_long',
        'cashOverrides.2.month': 'duplicate',
        'cashOverrides.2.overrideId': 'duplicate_id',
      });
  });

  it('文字数はコードポイントで数える(絵文字 60 個は通る)', () => {
    const v = validateSettingsInput({
      normRules: [{ ruleId: 'n1', kind: 'vendor', raw: '😀'.repeat(60), norm: 'x', enabled: true }],
    });
    expect(v.ok).toBe(true);
  });

  it('501 行は too_many', () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({
      ruleId: `n${i}`,
      kind: 'vendor' as const,
      raw: `r${i}`,
      norm: 'x',
      enabled: true,
    }));
    const v = validateSettingsInput({ normRules: rows });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fields).toEqual({ normRules: 'too_many' });
  });
});

describe('未保存件数(§7.14)', () => {
  it('変更が無ければ 0', () => {
    expect(countSettingsChanges(state(), state())).toBe(0);
  });

  it('フィールド単位で数え、追加・削除は 1 行 1 項目', () => {
    const draft = state();
    draft.normRules[0] = { ...draft.normRules[0], norm: '喫茶', enabled: false }; // 2
    draft.normRules.pop(); // 削除 1
    draft.normRules.push(rule('new1', 'vendor', 'ドトール', 'カフェ・外食', 10)); // 追加 1
    draft.ownerLabels = { ...draft.ownerLabels, business: '仕事' }; // 1
    draft.statMinMonths = 12; // 1
    draft.cashOverrides = [cash('o1', {})]; // 追加 1
    expect(countSettingsChanges(state(), draft)).toBe(7);
  });

  it('並べ替えは動いた行ごとに 1 項目(隣どうしの入れ替えは 2)', () => {
    const draft = state();
    draft.normRules = draft.normRules.map((r) =>
      r.ruleId === 'v1' ? { ...r, order: 2 } : r.ruleId === 'v2' ? { ...r, order: 1 } : r,
    );
    expect(countSettingsChanges(state(), draft)).toBe(2);
  });
});

describe('差分(BR-27)', () => {
  it('同じ状態の差分は 0 件', () => {
    expect(diffSettings(state(), state()).total).toBe(0);
  });

  it('ruleId が違っても (種別, 照合キー) が同じ行は同じ行として突き合わせる', () => {
    const next = state();
    next.normRules = next.normRules.map((r) =>
      r.ruleId === 'v2' ? { ...r, ruleId: 'other', raw: 'ｽﾀﾊﾞ' } : r,
    );
    const d = diffSettings(state(), next);
    expect(d.normRules.added.count).toBe(0);
    expect(d.normRules.removed.count).toBe(0);
    expect(d.normRules.changed.count).toBe(1);
    expect(d.normRules.changed.items[0]).toMatchObject({ key: 'other', kind: 'vendor', raw: 'ｽﾀﾊﾞ' });
  });

  it('各区分を数え、total は変更履歴の行数と同じ', () => {
    const next = state({
      ownerLabels: { ...DEFAULT_OWNER_LABELS, spouse: '妻', family: '子' },
      statMinMonths: 3,
      cashOverrides: [cash('o1', { amount: 100, scope: 'month', month: '2026-08' })],
    });
    next.normRules = next.normRules.filter((r) => r.ruleId !== 'a2');
    next.normRules.push(rule('n1', 'vendor', 'ドトール', 'カフェ・外食', 10));
    const d = diffSettings(state({ cashOverrides: [cash('o0', { amount: 0 })] }), next);
    expect(d.normRules.added.count).toBe(1);
    expect(d.normRules.removed.count).toBe(1);
    expect(d.ownerLabels.changed.map((c) => c.owner)).toEqual(['spouse', 'family']);
    expect(d.statMinMonths).toEqual({ before: 6, after: 3 });
    expect(d.cashOverrides.added.count).toBe(1);
    expect(d.cashOverrides.removed.count).toBe(1);
    expect(d.total).toBe(1 + 1 + 2 + 1 + 1 + 1);
  });

  it('中身が同じで位置だけ動いた行は reordered、中身も変わった行は changed に 1 回だけ', () => {
    const next = state();
    next.normRules = next.normRules.map((r) =>
      r.ruleId === 'v1' ? { ...r, order: 2, norm: '喫茶' } : r.ruleId === 'v2' ? { ...r, order: 1 } : r,
    );
    const d = diffSettings(state(), next);
    expect(d.normRules.changed.count).toBe(1);
    expect(d.normRules.reordered.count).toBe(1);
    expect(d.total).toBe(2);
  });

  it('items は最大 50 件で、count は全件', () => {
    const many = Array.from({ length: 60 }, (_, i) => rule(`n${i}`, 'vendor', `r${i}`, 'x', i + 1));
    const d = diffSettings(state({ normRules: [] }), state({ normRules: many }));
    expect(d.normRules.added.count).toBe(60);
    expect(d.normRules.added.items).toHaveLength(50);
  });
});

describe('書込みと変更履歴(BR-19・BR-21)', () => {
  it('変更なしなら履歴は 0 行', () => {
    expect(settingsChangeEntries(state(), settingsWriteState(state(), state()))).toEqual([]);
  });

  it('照合キーで突き合わせた行は現在の id を引き継ぎ、『削除+追加』にしない', () => {
    const next = state();
    next.normRules = next.normRules.map((r) =>
      r.ruleId === 'v2' ? { ...r, ruleId: 'other', norm: '喫茶' } : r,
    );
    const written = settingsWriteState(state(), next);
    expect(written.normRules.map((r) => r.ruleId)).toEqual(FIXTURE_RULES.map((r) => r.ruleId));
    const entries = settingsChangeEntries(state(), written);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ target: 'norm_rule', targetKey: 'v2' });
    expect(JSON.parse(entries[0].before!)).toEqual({
      kind: 'vendor',
      raw: 'スタバ',
      norm: 'カフェ・外食',
      enabled: true,
      order: 2,
    });
    expect(JSON.parse(entries[0].after!).norm).toBe('喫茶');
  });

  it('件数は diffSettings の total と一致し、作成は before=null・削除は after=null', () => {
    const cur = state({ cashOverrides: [cash('o0', { amount: 0 })] });
    const next = state({
      ownerLabels: { ...DEFAULT_OWNER_LABELS, spouse: '妻' },
      statMinMonths: 3,
      cashOverrides: [cash('o1', { amount: 100, scope: 'month', month: '2026-08' })],
    });
    next.normRules = next.normRules.filter((r) => r.ruleId !== 'a2');
    next.normRules.push(rule('n1', 'vendor', 'ドトール', 'カフェ・外食', 10));
    const written = settingsWriteState(cur, next);
    const entries = settingsChangeEntries(cur, written);
    expect(entries).toHaveLength(diffSettings(cur, written).total);
    expect(entries.map((e) => [e.target, e.targetKey, e.before === null, e.after === null])).toEqual([
      ['norm_rule', 'n1', true, false],
      ['norm_rule', 'a2', false, true],
      ['owner_label', 'spouse', false, false],
      ['stat_min_months', 'statMinMonths', false, false],
      ['cash_override', 'o1', true, false],
      ['cash_override', 'o0', false, true],
    ]);
  });

  it('打ち切らない(60 行の追加は 60 行)', () => {
    const many = Array.from({ length: 60 }, (_, i) => rule(`n${i}`, 'vendor', `r${i}`, 'x', i + 1));
    const empty = state({ normRules: [] });
    expect(settingsChangeEntries(empty, settingsWriteState(empty, state({ normRules: many })))).toHaveLength(
      60,
    );
  });

  it('現金上書きは (種別, 範囲, 月) で突き合わせて id を引き継ぎ、突き合わない行の id の重なりは振り直す', () => {
    const cur = state({ cashOverrides: [cash('o-x', { amount: 100 })] });
    const next = state({
      cashOverrides: [cash('o-y', { amount: 200 }), cash('o-x', { kind: 'receipt', amount: 5 })],
    });
    const written = settingsWriteState(cur, next);
    expect(written.cashOverrides.map((r) => r.overrideId)).toEqual(['o-x', 'o-receipt-all']);
    const entries = settingsChangeEntries(cur, written);
    expect(entries.map((e) => [e.targetKey, e.before === null])).toEqual([
      ['o-receipt-all', true],
      ['o-x', false],
    ]);
  });

  it('並び順は配列の順で 1 から振り直す', () => {
    const next = state({ normRules: [rule('b', 'vendor', 'b', 'x', 10), rule('a', 'vendor', 'a', 'x', 3)] });
    expect(
      settingsWriteState(state({ normRules: [] }), next).normRules.map((r) => [r.ruleId, r.order]),
    ).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('影響するもの・要約(§7.5・BR-31)', () => {
  it('取引先は 4 項目、勘定科目は保存時の集計し直しを足した 5 項目', () => {
    expect(SETTINGS_IMPACTS.vendor).toEqual([
      '収支のカテゴリ集計',
      '月次サマリー',
      'カテゴリ別の分析グラフ',
      'レポート出力（CSV・HTML）',
    ]);
    expect(SETTINGS_IMPACTS.account).toHaveLength(5);
    expect(SETTINGS_IMPACTS.account[4]).toBe('取込済みの明細の科目（保存時に集計し直します）');
  });

  it('要約は件数と名義の保存有無', () => {
    expect(summarizeSettings(state({ cashOverrides: [cash('o1', {})] }), true)).toEqual({
      normRules: 9,
      ownerLabelsSet: true,
      statMinMonths: 6,
      cashOverrides: 1,
    });
  });
});

describe('画面の値(GET /api/settings/screen)', () => {
  const stored = FIXTURE_RULES.map((r) => ({
    ...r,
    updatedAt: '2026-09-01T00:00:00.000Z',
    updatedBy: 'system',
  }));
  const log = (
    seq: number,
    targetKey: string,
    before: string | null,
    changedAt: string,
    by = 'taro',
  ): SettingsChangeLogRow => ({
    seq,
    target: 'norm_rule',
    targetKey,
    before,
    after: '{}',
    changedBy: by,
    changedAt,
    origin: 'screen',
  });

  it('並び順・優先の注記・元に戻せるか・更新者を組む', () => {
    const view = settingsScreen({
      normRules: [...stored].reverse(),
      cashOverrides: [],
      ownerLabels: null,
      statMinMonths: null,
      latestChanges: [
        log(1, 'v1', null, '2026-09-01T00:00:00.000Z', 'system'),
        log(2, 'v2', '{"norm":"外食"}', '2026-09-20T01:00:00.000Z'),
      ],
    });
    expect(view.normRules.map((r) => r.ruleId)).toEqual(FIXTURE_RULES.map((r) => r.ruleId));
    expect(view.normRules[0]).toMatchObject({ canUndo: false, updatedBy: 'システム' });
    expect(view.normRules[1]).toMatchObject({
      canUndo: true,
      updatedBy: 'taro',
      updatedAt: '2026-09-20T01:00:00.000Z',
    });
    expect(view.savedAt).toBe('2026-09-20T01:00:00.000Z');
    expect(view.ownerLabels).toEqual(DEFAULT_OWNER_LABELS);
    expect(view.ownerLabelsSaved).toBe(false);
    expect(view.statMinMonths).toBe(6);
    expect(view.statMinMonthsRange).toEqual({ min: 3, max: 24, default: 6 });
    expect(view.limits).toEqual({ normRules: 500, text: 60, memo: 100 });
  });

  it('画面の値から設定 4 種に戻すと差分 0 件(決定論)', () => {
    const input = {
      normRules: stored,
      cashOverrides: [{ ...cash('o1', {}), updatedAt: 'x', updatedBy: 'system' }],
      ownerLabels: { business: '仕事' },
      statMinMonths: 12,
      latestChanges: [],
    };
    const a = settingsScreen(input);
    expect(JSON.stringify(settingsScreen(input))).toBe(JSON.stringify(a));
    const s = settingsStateOf(a);
    expect(diffSettings(s, s).total).toBe(0);
    expect(s.ownerLabels.business).toBe('仕事');
    expect(a.savedAt).toBeNull();
    expect(settingsRevision([])).toBeNull();
  });
});
