/**
 * 明細仕分け画面の表示整形の契約 (spec-classify-screen 7 節)。
 *
 * ここで固定するのは「同じ意味の文が 2 通りに増えない」ことである。通知文・件数・
 * 分割合計・提案の初期値は、画面の複数箇所から同じ関数を通って出る。旧実装は
 * 同じ文言をコンポーネントの中に書き散らしていたので、片方だけ直る事故が起きていた。
 */
import { describe, expect, it } from 'vitest';
import type { ClassifyRow } from '../../api.js';
import {
  DEFAULT_FILTERS,
  amountText,
  bulkResultMessage,
  canSave,
  confidenceText,
  countText,
  dateText,
  descriptionText,
  filtersToParams,
  historyText,
  inputFromRow,
  isDefaultFilters,
  outcomeOf,
  outcomeText,
  parseFilters,
  parseSelectionParams,
  periodRangeLabel,
  previewAfterText,
  previewBadgeText,
  previewNoticeText,
  previewOmittedText,
  resolveBulkItem,
  sameInput,
  selectionParams,
  splitSumMessage,
  suggestionText,
} from './view-model.js';

const row = (over: Partial<ClassifyRow> = {}): ClassifyRow =>
  ({
    id: 'A1',
    rowKey: 'A1',
    date: '2026-09-01T00:00:00.000Z',
    payee: 'スターバックス',
    description: 'スターバックス 渋谷',
    amount: -560,
    status: 'unsorted',
    cls: null,
    big: '',
    mid: '',
    owner: null,
    note: null,
    paymentMethod: 'card',
    confidence: 92,
    review: false,
    suggestion: { cls: 'biz', big: '会議費', mid: '打合せ', owner: 'business' },
    suggestionLabel: '会議費 / 打合せ',
    basisText: '過去に同じ取引先を「会議費」として仕分けた事例が 12 件あります。',
    capabilities: { split: true },
    edit: null,
    splitSeq: null,
    splitLineCount: null,
    ...over,
  }) as ClassifyRow;

describe('件数・金額・日付', () => {
  it('件数は 3 桁区切りで「件」を付ける', () => {
    expect(countText(0)).toBe('0件');
    expect(countText(1024)).toBe('1,024件');
  });

  it('金額は支出も正の数で出し、¥ 記号と符号を付けない', () => {
    // 共通の yen は「-¥560」を返す。この画面は画像どおり「560円」なので別関数にしてある
    expect(amountText(-560)).toBe('560円');
    expect(amountText(1234567)).toBe('1,234,567円');
  });

  it('信頼度の null は 0% ではなく「—」', () => {
    expect(confidenceText(null)).toBe('—');
    expect(confidenceText(0)).toBe('0%');
  });

  it('日付は YYYY/MM/DD、期間の見出しは年月の範囲', () => {
    expect(dateText('2026-09-01T12:34:56.000Z')).toBe('2026/09/01');
    expect(periodRangeLabel('2025-09', '2026-08')).toBe('2025年9月 - 2026年8月');
    expect(periodRangeLabel(null, '2026-08')).toBe('');
  });
});

describe('一覧の行 (7.5)', () => {
  it('分割の内訳行は元の内容の後ろに (分割 n/m) を添える', () => {
    expect(descriptionText({ description: '家賃', splitSeq: 2, splitLineCount: 3 })).toBe('家賃（分割 2/3）');
    expect(descriptionText({ description: '家賃', splitSeq: null, splitLineCount: null })).toBe('家賃');
  });

  it('確定済みの行は提案ではなく確定値を出す', () => {
    expect(suggestionText(row({ status: 'manual', big: '地代家賃', mid: '事務所' }))).toBe(
      '地代家賃 / 事務所',
    );
  });

  it('提案も確定値も無いときだけ「提案なし」に倒す', () => {
    expect(suggestionText(row({ suggestionLabel: '' }))).toBe('提案なし');
    expect(suggestionText(row())).toBe('会議費 / 打合せ');
  });
});

describe('通知 (7.7)', () => {
  it('全件成功・部分失敗・全件失敗で文言と色が分かれる', () => {
    expect(bulkResultMessage(3, 3, 0)).toEqual({ tone: 'ok', text: '選択した3件を保存しました。' });
    expect(bulkResultMessage(3, 2, 1)).toEqual({
      tone: 'ok',
      text: '選択した3件のうち2件を保存しました。1件はエラーのため保存できませんでした。',
    });
    // 全件失敗は部分失敗の K=N だが、文言も色も変わるので別扱いにする
    expect(bulkResultMessage(3, 0, 3)).toEqual({
      tone: 'ng',
      text: '選択した3件を保存できませんでした。',
    });
  });
});

describe('編集パネルの入力 (7.6・BR-01)', () => {
  it('未整理で提案がある明細は、提案を初期値に置く', () => {
    // この画面の既定の道筋は「提案どおりに確定する」なので、開いた直後に保存を押せば完了になる
    expect(inputFromRow(row())).toMatchObject({
      cls: 'biz',
      big: '会議費',
      mid: '打合せ',
      owner: 'business',
    });
    expect(outcomeText(outcomeOf(row(), inputFromRow(row())))).toBe('この内容で保存すると完了になります。');
  });

  it('確定済みの明細は保存値をそのまま出す', () => {
    const fixed = row({ status: 'manual', cls: 'per', big: '食費', mid: '外食', owner: 'family' });
    expect(inputFromRow(fixed)).toMatchObject({ cls: 'per', big: '食費', mid: '外食', owner: 'family' });
  });

  it('提案が無ければ、何を入れても手動変更になる', () => {
    const none = row({ suggestion: { cls: null, big: '', mid: '', owner: null }, suggestionLabel: '' });
    expect(outcomeOf(none, inputFromRow(none))).toBe('manual');
    expect(outcomeText('manual')).toBe('この内容で保存すると手動変更になります。');
  });

  it('api が返す提案なし (null) でも落ちず、保存値をそのまま出す', () => {
    // buildClassifyRow は提案なしを空オブジェクトでなく null で返す。
    // 型が非 null だった頃は、提案のない明細の編集パネルを開くだけで s.cls が TypeError になっていた
    const none = row({ suggestion: null, suggestionLabel: null, cls: 'per', big: '食費', mid: '外食' });
    expect(inputFromRow(none)).toMatchObject({ cls: 'per', big: '食費', mid: '外食' });
    expect(outcomeOf(none, inputFromRow(none))).toBe('manual');
  });

  it('一致の判定は core と同じで、空文字と null の差では揺れない', () => {
    // 予告 (7.13) と、保存後に api が付ける matchedProposal は同じ matchesSuggestion を通る。
    // ここを web で書き直すと「完了になります」と言われた保存が手動変更になる
    const r = row({ suggestion: { cls: 'biz', big: '会議費', mid: '', owner: 'business' } });
    expect(outcomeOf(r, { ...inputFromRow(r), mid: null })).toBe('done');
    expect(outcomeOf(r, { ...inputFromRow(r), mid: '' })).toBe('done');
  });

  it('提案と 1 つでも違えば手動変更', () => {
    expect(outcomeOf(row(), { ...inputFromRow(row()), mid: '会議' })).toBe('manual');
  });

  it('メモと支払方法の違いは確定の判定に入らない', () => {
    // BR-09。メモだけの保存は確定ではないので、提案一致の判定を動かさない
    expect(outcomeOf(row(), { ...inputFromRow(row()), note: 'あとで確認' })).toBe('done');
  });

  it('sameInput は空文字と null を同じとみなす', () => {
    const base = inputFromRow(row());
    expect(sameInput(base, { ...base, big: base.big })).toBe(true);
    expect(sameInput({ ...base, big: null }, { ...base, big: '' })).toBe(true);
    expect(sameInput(base, { ...base, owner: 'family' })).toBe(false);
  });

  it('未整理は入力を変えていなくても保存を押せる', () => {
    // 「提案どおりに確定する」が押せないと、既定の道筋が通らない
    expect(canSave(row(), inputFromRow(row()))).toBe(true);
    const fixed = row({ status: 'done', cls: 'biz', big: '会議費', mid: '打合せ', owner: 'business' });
    expect(canSave(fixed, inputFromRow(fixed))).toBe(false);
    expect(canSave(fixed, { ...inputFromRow(fixed), note: 'メモ' })).toBe(true);
  });

  it('履歴の 1 行は {日時} {由来} → {変更後}（信頼度 n%）', () => {
    expect(
      historyText({
        changedAt: '2026-09-02T10:05:00.000Z',
        sourceLabel: '自動提案',
        after: '会議費 / 打合せ',
        confidence: 92,
      }),
    ).toBe('2026/09/02 10:05 自動提案 → 会議費 / 打合せ（信頼度 92%）');
    expect(
      historyText({
        changedAt: '2026-09-02T10:05:00.000Z',
        sourceLabel: '手動',
        after: null,
        confidence: null,
      }),
    ).toBe('2026/09/02 10:05 手動 → (なし)');
  });
});

describe('分割の合計 (7.9・BR-10)', () => {
  it('一致・不一致の両方を 1 か所で決める', () => {
    expect(splitSumMessage([300, 260], 560)).toEqual({
      ok: true,
      text: '金額の合計が元の取引金額と一致しています。(300円 + 260円 = 560円)',
    });
    expect(splitSumMessage([300, 200], 560).ok).toBe(false);
    expect(splitSumMessage([300, 200], 560).text).toContain('差額 60円');
  });
});

describe('ルール適用プレビュー (7.10)', () => {
  it('件数・省略・適用後の仕訳・注意文が揃う', () => {
    expect(previewBadgeText(1024)).toBe('今後 1,024 件に適用');
    expect(previewOmittedText(7)).toBe('ほか 7 件');
    expect(previewAfterText([{ label: '会議費 / 打合せ', amount: 560 }])).toBe('会議費 / 打合せ');
    expect(
      previewAfterText([
        { label: '地代家賃', amount: 60000 },
        { label: '水道光熱費', amount: 8000 },
      ]),
    ).toBe('地代家賃 60,000円 / 水道光熱費 8,000円');
    expect(previewNoticeText(3, false)).toBe('上記の 3 件の取引に対して、同じ仕分けを自動で適用できます。');
    expect(previewNoticeText(3, true)).toBe('上記の 3 件の取引に対して、同じ分割内容を自動で適用できます。');
  });
});

describe('絞り込みの URL 契約 (7.4)', () => {
  it('既定は未整理だけで、既定値は URL に書かない', () => {
    expect(DEFAULT_FILTERS.status).toEqual(['unsorted']);
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({});
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('既定から外れた値だけを URL に書く', () => {
    expect(
      filtersToParams({
        ...DEFAULT_FILTERS,
        status: ['unsorted', 'review'],
        manual: true,
        q: 'スタバ',
        page: 3,
      }),
    ).toEqual({ status: 'unsorted,review', manual: '1', q: 'スタバ', page: '3' });
  });

  it('壊れた値は既定へ倒す', () => {
    const f = parseFilters(new URLSearchParams('status=nope&method=bitcoin&page=0&sort=size'));
    expect(f.status).toEqual(['unsorted']);
    expect(f.method).toBe('');
    expect(f.page).toBe(1);
    expect(f.sort).toBe('date_desc');
  });

  it('URL → 絞り込み → URL が元に戻る', () => {
    const qs =
      'status=review,done&category=会議費&owner=business&method=card&manual=1&q=渋谷&sort=date_asc&page=2';
    expect(new URLSearchParams(filtersToParams(parseFilters(new URLSearchParams(qs)))).toString()).toBe(
      new URLSearchParams(qs).toString(),
    );
  });

  it('期間は URL の絞り込みに現れない (画面共通の期間切替が持つ)', () => {
    const f = parseFilters(new URLSearchParams('from=2026-01&to=2026-03'));
    expect(filtersToParams(f)).toEqual({});
  });

  it('選択 sel と編集 tx をURL正本とし、重複排除と50件上限を適用する', () => {
    const ids = Array.from({ length: 55 }, (_, index) => `mf:${index}`);
    const parsed = parseSelectionParams(
      new URLSearchParams(`sel=${encodeURIComponent([ids[0], ids[0], ...ids.slice(1)].join(','))}&tx=mf%3A9`),
    );
    expect(parsed.selected).toHaveLength(50);
    expect(parsed.selected.slice(0, 2)).toEqual(['mf:0', 'mf:1']);
    expect(parsed.openTxKey).toBe('mf:9');
    expect(selectionParams(parsed.selected, parsed.openTxKey)).toEqual({
      sel: parsed.selected.join(','),
      tx: 'mf:9',
    });
  });
});

describe('一括保存の入力解決', () => {
  it('下書き > 提案 > クライアント失敗の優先順にする', () => {
    const suggested = row();
    const draft = { ...inputFromRow(suggested), big: '雑費', mid: null };
    expect(resolveBulkItem(suggested, draft)).toEqual({
      ok: true,
      item: { txId: 'A1', ...draft },
      source: 'draft',
    });
    expect(resolveBulkItem(suggested, null)).toMatchObject({
      ok: true,
      item: { txId: 'A1', cls: 'biz', big: '会議費', mid: '打合せ' },
      source: 'suggestion',
    });
    expect(resolveBulkItem(row({ suggestion: null, suggestionLabel: null }), null)).toEqual({
      ok: false,
      message: '提案または保存済みの下書きがありません。',
    });
  });
});
