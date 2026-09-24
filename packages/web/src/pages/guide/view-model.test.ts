/**
 * 使い方画面の表示用の薄い層 (spec-guide-screen FR-4・FR-11・FR-16 / SYS-GUIDE-P04)。
 * URL の読み書き・円の符号・検索の絞り込みだけを確かめる。規則の正本は core の guide-screen。
 */
import { GUIDE_FAQ, GUIDE_SEARCH, GUIDE_TOPICS } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import {
  readGuideUrl,
  searchGuideTopics,
  selectedGuideTopic,
  signedYen,
  visibleFaqRows,
  visibleTopics,
  writeGuideUrl,
} from './view-model.js';

describe('readGuideUrl', () => {
  it('topic と q を読む', () => {
    expect(readGuideUrl(new URLSearchParams('topic=budget&q=予算'))).toEqual({ topic: 'budget', q: '予算' });
  });

  it('topic が無い・未知のときは月次の流れに戻す', () => {
    expect(readGuideUrl(new URLSearchParams('')).topic).toBe('flow');
    expect(readGuideUrl(new URLSearchParams('topic=unknown')).topic).toBe('flow');
  });

  it(`q は ${GUIDE_SEARCH.maxLength} 字で切る`, () => {
    const q = readGuideUrl(new URLSearchParams({ q: 'あ'.repeat(150) })).q;
    expect(q).toHaveLength(GUIDE_SEARCH.maxLength);
  });
});

describe('writeGuideUrl', () => {
  it('既定値 (月次の流れ・空の検索語) はキーごと消し、期間など他のキーは残す', () => {
    const before = new URLSearchParams('from=2026-01&to=2026-12&topic=budget&q=予算');
    const next = writeGuideUrl(before, { topic: 'flow', q: '' });
    expect(next.toString()).toBe('from=2026-01&to=2026-12');
    // 元の params は書き換えない
    expect(before.get('topic')).toBe('budget');
  });

  it('既定以外の値は書き、渡さなかったキーはそのまま', () => {
    const next = writeGuideUrl(new URLSearchParams('q=振替'), { topic: 'terms' });
    expect(next.get('topic')).toBe('terms');
    expect(next.get('q')).toBe('振替');
  });

  it('書く検索語も 100 字で切る', () => {
    const next = writeGuideUrl(new URLSearchParams(), { q: 'x'.repeat(120) });
    expect(next.get('q')).toHaveLength(GUIDE_SEARCH.maxLength);
  });
});

describe('signedYen', () => {
  it('正は +、負は全角の −、0 は符号なし', () => {
    expect(signedYen(123_456)).toBe('+¥123,456');
    expect(signedYen(-7_800)).toBe('−¥7,800');
    expect(signedYen(0)).toBe('¥0');
  });
});

describe('検索の絞り込み', () => {
  it('検索語が空なら目次 7 項目とよくある疑問 5 行をすべて出す', () => {
    const result = searchGuideTopics('');
    expect(visibleTopics(result).map((t) => t.id)).toEqual(GUIDE_TOPICS.map((t) => t.id));
    expect(visibleFaqRows(result)).toHaveLength(GUIDE_FAQ.rows.length);
    expect(result.none).toBe(false);
  });

  it('信頼度で引くと仕分けのトピックと信頼度の疑問に当たる', () => {
    const result = searchGuideTopics('信頼度');
    expect(visibleTopics(result).map((t) => t.id)).toContain('classify');
    expect(visibleFaqRows(result).map((r) => r.id)).toContain('confidence');
  });

  it('用語集の文言 (略語) でも『用語と目安』に当たる', () => {
    const result = searchGuideTopics('Break-Even Point');
    expect(visibleTopics(result).map((t) => t.id)).toEqual(['terms']);
  });

  it('どこにも当たらない語は none になり、目次も疑問も空', () => {
    const result = searchGuideTopics('該当しない語zzqq');
    expect(result.none).toBe(true);
    expect(visibleTopics(result)).toEqual([]);
    expect(visibleFaqRows(result)).toEqual([]);
    expect(selectedGuideTopic(result, 'flow')).toBeNull();
  });

  it('検索語で選択中の項目が外れたら、最初の一致へ移る', () => {
    const result = searchGuideTopics('予算');
    expect(selectedGuideTopic(result, 'flow')).toBe(result.topics[0]);
    expect(selectedGuideTopic(result, result.topics[0])).toBe(result.topics[0]);
  });
});
