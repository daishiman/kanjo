import { describe, expect, it } from 'vitest';
import {
  type BulkSaveInput,
  NO_CATEGORY,
  ROW_KEY_MAX_LENGTH,
  buildCandidates,
  parseRowKey,
  resolveBulkSaveItem,
  rowSelectability,
} from '../src/index.js';

/**
 * 一括保存の値の解決 (spec-classify-bulk-save FR-02〜FR-05・BR-01〜BR-08)。
 * 画面の保存前の内訳とサーバの保存は、この 1 つの関数から同じ答えを出す。
 */

const candidates = buildCandidates(
  [],
  [
    { big: '食費', mid: '食料品' },
    { big: '食費', mid: '外食' },
    { big: '日用品', mid: 'ドラッグストア' },
  ],
  [],
);

const PER_SUGGESTION = { cls: 'per', big: '食費', mid: '食料品', owner: 'family' } as const;
const BIZ_CURRENT = { cls: 'biz', big: '通信費', mid: '', owner: 'business' } as const;

const input = (over: Partial<BulkSaveInput> = {}): BulkSaveInput => ({
  bulk: null,
  draft: null,
  suggestion: PER_SUGGESTION,
  current: { cls: 'per', big: '', mid: '', owner: null, note: null },
  status: 'unsorted',
  paymentMethod: null,
  candidates,
  ...over,
});

describe('土台の組 (AC-02)', () => {
  it('未整理は 下書き → 提案 の順', () => {
    const draft = { cls: 'per', big: '日用品', mid: 'ドラッグストア', owner: 'spouse' } as const;
    const withDraft = resolveBulkSaveItem(input({ draft }));
    expect(withDraft).toMatchObject({ ok: true, item: { ...draft } });
    expect(withDraft.ok && withDraft.sources.big).toBe('draft');

    const noDraft = resolveBulkSaveItem(input());
    expect(noDraft).toMatchObject({ ok: true, item: { ...PER_SUGGESTION } });
    expect(noDraft.ok && noDraft.sources).toMatchObject({
      cls: 'suggestion',
      big: 'suggestion',
      mid: 'suggestion',
      owner: 'suggestion',
    });
  });

  it('提案も下書きも無い未整理は、今の値を埋めずに外す (埋める値がありません)', () => {
    expect(resolveBulkSaveItem(input({ suggestion: null }))).toEqual({
      ok: false,
      code: 'no_value',
      reason: '埋める値がありません',
    });
  });

  it('支払方法だけの一括指定は分類の値に数えない', () => {
    expect(resolveBulkSaveItem(input({ suggestion: null, bulk: { paymentMethod: 'cash' } }))).toMatchObject({
      ok: false,
      code: 'no_value',
    });
  });

  it('確定済みは 下書き → 今の値。提案で手の値を上書きしない', () => {
    // 置換前の web の一括保存の値決めは下書きが無いと提案を送り、確定済みの手の値を巻き戻していた
    const done = input({ status: 'done', current: { ...BIZ_CURRENT, note: null } });
    expect(resolveBulkSaveItem(done)).toEqual({
      ok: false,
      code: 'no_change',
      reason: '変わる値がありません',
    });

    const draft = { cls: 'biz', big: '消耗品費', mid: '', owner: 'business' } as const;
    const r = resolveBulkSaveItem({ ...done, draft });
    expect(r).toMatchObject({ ok: true, item: { ...draft } });
    expect(r.ok && r.sources.big).toBe('draft');
  });

  it('手動変更も確定済みとして扱う', () => {
    const manual = input({ status: 'manual', current: { ...BIZ_CURRENT, note: null } });
    expect(resolveBulkSaveItem(manual)).toMatchObject({ ok: false, code: 'no_change' });
  });
});

describe('一括指定 (FR-02)', () => {
  it('一括指定は欄ごとに土台を上書きする', () => {
    const r = resolveBulkSaveItem(input({ bulk: { owner: 'spouse' } }));
    expect(r).toMatchObject({ ok: true, item: { ...PER_SUGGESTION, owner: 'spouse' } });
    expect(r.ok && r.sources).toMatchObject({ big: 'suggestion', owner: 'bulk' });
  });

  it('大項目を指定すると中項目は一括指定の値か空になる', () => {
    const r = resolveBulkSaveItem(input({ bulk: { big: '日用品' } }));
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: '日用品', mid: '' } });
    expect(r.ok && r.sources).toMatchObject({ big: 'bulk', mid: 'bulk' });

    const withMid = resolveBulkSaveItem(input({ bulk: { big: '食費', mid: '外食' } }));
    expect(withMid).toMatchObject({ ok: true, item: { big: '食費', mid: '外食' } });
  });

  it('区分に合わない大項目は category_mismatch で外す', () => {
    expect(resolveBulkSaveItem(input({ bulk: { cls: 'biz', big: '食費' } }))).toEqual({
      ok: false,
      code: 'category_mismatch',
      reason: '指定したカテゴリ (大) が明細の区分に合いません',
    });
  });

  it('区分だけを指定し、同じ区分の組が無ければ『カテゴリなし』(AC-03)', () => {
    const r = resolveBulkSaveItem(input({ bulk: { cls: 'biz' } }));
    expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: NO_CATEGORY, mid: '' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'bulk', big: 'no_category', mid: 'no_category' });
  });

  it('区分だけを指定し、下書きか提案に同じ区分の組があればそれを使う', () => {
    const fromSuggestion = resolveBulkSaveItem(input({ bulk: { cls: 'per' } }));
    expect(fromSuggestion).toMatchObject({ ok: true, item: { cls: 'per', big: '食費', mid: '食料品' } });
    expect(fromSuggestion.ok && fromSuggestion.sources.big).toBe('suggestion');

    const draft = { cls: 'biz', big: '消耗品費', mid: '', owner: 'business' } as const;
    const fromDraft = resolveBulkSaveItem(input({ draft, bulk: { cls: 'biz' } }));
    expect(fromDraft).toMatchObject({ ok: true, item: { cls: 'biz', big: '消耗品費' } });
    expect(fromDraft.ok && fromDraft.sources.big).toBe('draft');
  });

  it('確定済みに区分だけを指定すると、今の値の組を区分が合えば残す', () => {
    const done = input({ status: 'done', current: { ...BIZ_CURRENT, note: null } });
    const same = resolveBulkSaveItem({ ...done, bulk: { cls: 'biz' } });
    expect(same).toMatchObject({ ok: false, code: 'no_change' });
    const other = resolveBulkSaveItem({ ...done, bulk: { cls: 'per' } });
    expect(other).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '' } });
  });

  describe('提案も下書きも無い未整理は、今の値の組を埋める値にしない (BR-01・AC-03)', () => {
    // 未整理の今の値の組は取込値 (MF の大・中)。人の判断も区分の候補の検査も経ていない
    const IMPORTED = input({
      suggestion: null,
      current: { cls: 'per', big: '未分類', mid: '未分類', owner: 'family', note: null },
    });

    it('区分だけの指定は、今の値と区分が同じでも『カテゴリなし』', () => {
      const r = resolveBulkSaveItem({ ...IMPORTED, bulk: { cls: 'per' } });
      expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '' } });
      expect(r.ok && r.sources).toMatchObject({ cls: 'bulk', big: 'no_category', mid: 'no_category' });
    });

    it('名義だけの指定は、区分を明細の区分のまま残し、組は『カテゴリなし』', () => {
      const r = resolveBulkSaveItem({ ...IMPORTED, bulk: { owner: 'spouse' } });
      expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'spouse' } });
      expect(r.ok && r.sources).toMatchObject({ cls: 'current', big: 'no_category', owner: 'bulk' });
    });

    it('事業の明細の取込値の組を、候補の検査なしで確定させない', () => {
      const current = { cls: 'biz', big: '食費', mid: '外食', owner: 'business', note: null } as const;
      const r = resolveBulkSaveItem({ ...IMPORTED, current, bulk: { owner: 'business' } });
      expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: NO_CATEGORY, mid: '' } });
    });

    it('組を省いた下書き (メモだけ) も、今の値の組を取らない', () => {
      const r = resolveBulkSaveItem({ ...IMPORTED, draft: { cls: null, owner: null, note: '確認中' } });
      expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '', note: '確認中' } });
    });

    it('大項目を指定すれば一括指定の組を、明細の区分と比べて使う', () => {
      const r = resolveBulkSaveItem({ ...IMPORTED, bulk: { big: '日用品' } });
      expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: '日用品', mid: '' } });
      expect(r.ok && r.sources.big).toBe('bulk');
    });
  });

  it('中項目だけの一括指定は使わない (サーバが 400 にする)', () => {
    const r = resolveBulkSaveItem(input({ bulk: { mid: '外食' } }));
    expect(r).toMatchObject({ ok: true, item: { big: '食費', mid: '食料品' } });
  });
});

describe('大を持たない提案は組の出所にしない (用語集『カテゴリなし』・BR-02)', () => {
  // 未整理の明細に付く大の無い提案は、まだ自動で当てない取引先の記憶が区分・名義・中項目だけを持つときに生まれる
  // (classify-status の candidatesFor)。MF の中項目・区分だけのルールも同じ形の提案を作るが、その明細は区分が
  // 決まった確定済みなので提案を見ない。その空の大・中を「同じ区分の組」として保存しない
  const CLS_ONLY = input({
    suggestion: { cls: 'biz', big: null, mid: null, owner: null },
    current: { cls: 'per', big: '食費', mid: '外食', owner: 'family', note: null },
  });
  const OWNER_ONLY = input({ suggestion: { cls: 'per', big: null, mid: null, owner: 'spouse' } });

  it('指定が無ければ、区分は提案から取り、組は『カテゴリなし』', () => {
    const r = resolveBulkSaveItem(CLS_ONLY);
    expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: NO_CATEGORY, mid: '' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'suggestion', big: 'no_category', mid: 'no_category' });
  });

  it('区分だけの一括指定でも、提案の空の組を同じ区分の組として取らない', () => {
    const r = resolveBulkSaveItem({ ...CLS_ONLY, bulk: { cls: 'biz' } });
    expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: NO_CATEGORY, mid: '' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'bulk', big: 'no_category' });
  });

  it('名義だけの一括指定は、名義を一括指定から取り、組は『カテゴリなし』', () => {
    const r = resolveBulkSaveItem({ ...CLS_ONLY, bulk: { owner: 'business' } });
    expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: NO_CATEGORY, mid: '', owner: 'business' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'suggestion', big: 'no_category', owner: 'bulk' });
  });

  it('区分と名義だけの提案も組を持たない', () => {
    const r = resolveBulkSaveItem(OWNER_ONLY);
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'spouse' } });
  });

  it('区分を持たない提案 (中項目だけの記憶) は、区分を今の値から取る', () => {
    const r = resolveBulkSaveItem(input({ suggestion: { cls: null, big: null, mid: '外食', owner: null } }));
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'current', big: 'no_category' });
    // 未整理は区分を必ず送る。空の区分を保存すると明細は未整理のまま残る
    expect(r.ok && r.patch.cls).toBe('per');
  });

  it('名義を持たない提案は、今の名義 (人が付けた値) を消さない', () => {
    const r = resolveBulkSaveItem(
      input({
        suggestion: { cls: 'per', big: '食費', mid: '外食', owner: null },
        current: { cls: 'per', big: '', mid: '', owner: 'spouse', note: null },
      }),
    );
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: '食費', mid: '外食', owner: 'spouse' } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'suggestion', big: 'suggestion', owner: 'current' });
  });

  it('大項目を指定すれば、一括指定の組を使う', () => {
    const r = resolveBulkSaveItem({ ...OWNER_ONLY, bulk: { big: '日用品', mid: 'ドラッグストア' } });
    expect(r).toMatchObject({
      ok: true,
      item: { cls: 'per', big: '日用品', mid: 'ドラッグストア', owner: 'spouse' },
    });
    expect(r.ok && r.sources.big).toBe('bulk');
  });

  it('下書きに組があれば、下書きの組を使う', () => {
    const draft = { cls: null, big: '食費', mid: '外食', owner: null } as const;
    const r = resolveBulkSaveItem({ ...OWNER_ONLY, draft });
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: '食費', mid: '外食' } });
    expect(r.ok && r.sources.big).toBe('draft');
  });

  it('確定済みの明細は提案を見ず、今の値の組を残す', () => {
    const r = resolveBulkSaveItem({ ...CLS_ONLY, status: 'manual', bulk: { owner: 'spouse' } });
    expect(r).toMatchObject({ ok: true, item: { cls: 'per', big: '食費', mid: '外食', owner: 'spouse' } });
    expect(r.ok && r.sources.big).toBe('current');
  });
});

describe('下書きの系統の検査', () => {
  it('下書きの大項目が区分に合わなければ外す', () => {
    const draft = { cls: 'biz', big: '食費', mid: '', owner: 'business' } as const;
    expect(resolveBulkSaveItem(input({ draft }))).toEqual({
      ok: false,
      code: 'category_mismatch',
      reason: '下書きのカテゴリが区分に合いません',
    });
  });

  it('提案と今の値は系統を検査しない (サーバが作った値を信頼する)', () => {
    const odd = { cls: 'per', big: '候補に無い大項目', mid: '', owner: null } as const;
    expect(resolveBulkSaveItem(input({ suggestion: odd }))).toMatchObject({ ok: true });
  });

  describe('下書きの『カテゴリなし』は、今の値を送り返すときだけ通す (BR-04)', () => {
    const KEPT = { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'family', note: null } as const;

    it('今の値が『カテゴリなし』なら、送り返してメモだけを直せる', () => {
      const draft = { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'family', note: '確認済み' } as const;
      const r = resolveBulkSaveItem(input({ status: 'manual', current: KEPT, draft }));
      expect(r).toMatchObject({ ok: true, item: { big: NO_CATEGORY, mid: '', note: '確認済み' } });
    });

    it('今の値が別の大項目なら、下書きの『カテゴリなし』は外す', () => {
      const current = { cls: 'per', big: '食費', mid: '外食', owner: 'family', note: null } as const;
      const draft = { cls: 'per', big: NO_CATEGORY, mid: '', owner: 'family' } as const;
      const r = resolveBulkSaveItem(input({ status: 'manual', current, draft }));
      expect(r).toMatchObject({ ok: false, code: 'category_mismatch' });
    });

    it('送り返しでも、中項目は付けられない', () => {
      const draft = { cls: 'per', big: NO_CATEGORY, mid: '食料品', owner: 'family' } as const;
      const r = resolveBulkSaveItem(input({ status: 'manual', current: KEPT, draft }));
      expect(r).toMatchObject({ ok: false, code: 'category_mismatch' });
    });
  });
});

describe('支払方法とメモ', () => {
  it('支払方法は 一括指定 → 下書き → 保存済み', () => {
    const saved = input({ paymentMethod: 'card' });
    expect(resolveBulkSaveItem(saved)).toMatchObject({ ok: true, item: { paymentMethod: 'card' } });
    const draft = { ...PER_SUGGESTION, paymentMethod: 'account' } as const;
    expect(resolveBulkSaveItem({ ...saved, draft })).toMatchObject({ item: { paymentMethod: 'account' } });
    const r = resolveBulkSaveItem({ ...saved, draft, bulk: { paymentMethod: 'cash' } });
    expect(r).toMatchObject({ item: { paymentMethod: 'cash' } });
    expect(r.ok && r.sources.paymentMethod).toBe('bulk');
  });

  it('メモは下書きのものを使い、無ければ今のメモを残す', () => {
    const base = input({ current: { cls: 'per', big: '', mid: '', owner: null, note: '領収書あり' } });
    expect(resolveBulkSaveItem(base)).toMatchObject({ item: { note: '領収書あり' } });
    const draft = { ...PER_SUGGESTION, note: '書き直し' };
    expect(resolveBulkSaveItem({ ...base, draft })).toMatchObject({ item: { note: '書き直し' } });
  });

  it('確定済みで支払方法だけ変える一括指定は、変わる欄だけを送る', () => {
    const done = input({ status: 'done', current: { ...BIZ_CURRENT, note: null }, paymentMethod: null });
    const r = resolveBulkSaveItem({ ...done, bulk: { paymentMethod: 'cash' } });
    expect(r).toMatchObject({ ok: true, patch: { paymentMethod: 'cash' } });
    expect(r.ok && Object.keys(r.patch)).toEqual(['paymentMethod']);
  });
});

describe('送る欄 (patch)', () => {
  it('未整理は分類の 4 欄を全部送る', () => {
    const r = resolveBulkSaveItem(input());
    expect(r.ok && Object.keys(r.patch).sort()).toEqual(['big', 'cls', 'mid', 'owner']);
  });

  it('確定済みは変わった欄だけ。大と中はどちらかが変われば両方送る', () => {
    const done = input({ status: 'done', current: { ...BIZ_CURRENT, note: null } });
    const ownerOnly = resolveBulkSaveItem({ ...done, bulk: { owner: 'spouse' } });
    expect(ownerOnly.ok && ownerOnly.patch).toEqual({ owner: 'spouse' });
    const big = resolveBulkSaveItem({ ...done, bulk: { big: '消耗品費' } });
    expect(big.ok && big.patch).toEqual({ big: '消耗品費', mid: '' });
  });

  it('空文字と null は同じ「未設定」として比べる', () => {
    const done = input({
      status: 'done',
      current: { cls: 'biz', big: '通信費', mid: null, owner: 'business', note: null },
      draft: { cls: 'biz', big: '通信費', mid: '', owner: 'business', note: '' },
    });
    expect(resolveBulkSaveItem(done)).toMatchObject({ ok: false, code: 'no_change' });
  });
});

describe('組を省いた下書き (旧形式の item)', () => {
  // 事業の明細で、科目は取込値のまま (MF の大・中)。この組は事業の候補に無いが、今の値なので検査しない
  const BIZ_IMPORTED = { cls: 'biz', big: '通信費', mid: '携帯電話', owner: 'business', note: null } as const;

  it('メモだけの下書きは今の科目を残し、メモだけを送る (取込値へ戻さない)', () => {
    const done = input({ status: 'manual', current: { ...BIZ_IMPORTED } });
    const r = resolveBulkSaveItem({ ...done, draft: { cls: null, owner: null, note: '打合せ' } });
    expect(r).toMatchObject({ ok: true, item: { cls: 'biz', big: '通信費', mid: '携帯電話' } });
    expect(r.ok && r.patch).toEqual({ note: '打合せ' });
    expect(r.ok && r.sources.big).toBe('current');
  });

  it('区分が土台と同じなら土台の組、違えば『カテゴリなし』(区分だけの一括指定と同じ答え)', () => {
    const done = input({ status: 'done', current: { ...BIZ_IMPORTED } });
    const same = resolveBulkSaveItem({ ...done, draft: { cls: 'biz', owner: null } });
    expect(same).toMatchObject({ ok: false, code: 'no_change' });

    const other = resolveBulkSaveItem({ ...done, draft: { cls: 'per', owner: null } });
    const viaBulk = resolveBulkSaveItem({ ...done, bulk: { cls: 'per' } });
    expect(other).toMatchObject({ ok: true, item: { cls: 'per', big: NO_CATEGORY, mid: '' } });
    expect(other.ok && other.item).toEqual(viaBulk.ok && viaBulk.item);
  });

  it('未整理は提案を土台にし、区分を提案と同じにすれば提案の組を使う', () => {
    const r = resolveBulkSaveItem(input({ draft: { cls: 'per', owner: null } }));
    expect(r).toMatchObject({ ok: true, item: { ...PER_SUGGESTION } });
    expect(r.ok && r.sources).toMatchObject({ cls: 'draft', big: 'suggestion' });
  });

  it('大か中のどちらかを送った下書きは、組を下書きから取る (空の大は取込値へ戻す指定)', () => {
    const done = input({
      status: 'manual',
      current: { cls: 'per', big: '日用品', mid: '', owner: null, note: null },
    });
    const r = resolveBulkSaveItem({ ...done, draft: { cls: null, big: '', owner: null } });
    expect(r).toMatchObject({ ok: true, patch: { big: '', mid: '' } });
    expect(r.ok && r.sources.big).toBe('draft');
  });
});

describe('parseRowKey (FR-06)', () => {
  it('接頭辞と id に分ける', () => {
    expect(parseRowKey('mf:abc')).toEqual({ kind: 'mf', id: 'abc' });
    expect(parseRowKey('cash:c1')).toEqual({ kind: 'cash', id: 'c1' });
    expect(parseRowKey('split:l1:2')).toEqual({ kind: 'split', id: 'l1:2' });
  });

  it('接頭辞の無いもの・id が空のもの・長すぎるものは null', () => {
    expect(parseRowKey('abc')).toBeNull();
    expect(parseRowKey('mf:')).toBeNull();
    expect(parseRowKey('other:abc')).toBeNull();
    expect(ROW_KEY_MAX_LENGTH).toBe(200);
    const head = 'mf:';
    expect(parseRowKey(head + 'x'.repeat(ROW_KEY_MAX_LENGTH - head.length))).not.toBeNull();
    expect(parseRowKey(head + 'x'.repeat(ROW_KEY_MAX_LENGTH - head.length + 1))).toBeNull();
  });
});

describe('rowSelectability (FR-08・AC-19)', () => {
  it('内訳行はサーバの split_line_read_only と同じ文で選べない', () => {
    expect(rowSelectability({ rowKind: 'split', splitState: null })).toBe(
      '分割後の内訳は「内訳を編集」からまとめて変更してください',
    );
  });

  it('分割の設定が崩れた親は選べない', () => {
    expect(rowSelectability({ rowKind: 'mf', splitState: 'amount_conflict' })).toBe(
      '分割の設定を直してから保存してください',
    );
    expect(rowSelectability({ rowKind: 'mf', splitState: 'identity_unstable' })).toBe(
      '分割の設定を直してから保存してください',
    );
  });

  it('ふつうの明細と現金の行は選べる', () => {
    expect(rowSelectability({ rowKind: 'mf', splitState: null })).toBeNull();
    expect(rowSelectability({ rowKind: 'cash', splitState: null })).toBeNull();
  });
});
