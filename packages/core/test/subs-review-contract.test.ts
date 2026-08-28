import { describe, expect, it } from 'vitest';
import { SUBS_REVIEW_INTERVAL_MONTHS, subsReviewStatus } from '../src/index.js';

/** サブスクの見直し期限(四半期レビュー) */

const v = (id: number, name: string, reviewedAt: string | null) => ({ id, name, reviewedAt });

describe('サブスクの見直し期限', () => {
  it('見直しの推奨間隔は四半期', () => {
    expect(SUBS_REVIEW_INTERVAL_MONTHS).toBe(3);
  });

  it('一度も見直していない登録は、期限切れとして先頭に来る', () => {
    const rows = subsReviewStatus([v(1, 'A', '2026-08-01'), v(2, 'B', null)], '2026-08-27');
    expect(rows[0].name).toBe('B');
    expect(rows[0].monthsSince).toBeNull();
    expect(rows[0].due).toBe(true);
  });

  it('3ヶ月経つと期限切れ。2ヶ月ならまだ出さない', () => {
    const rows = subsReviewStatus(
      [v(1, '2ヶ月前', '2026-06-10'), v(2, '3ヶ月前', '2026-05-10')],
      '2026-08-27',
    );
    const byName = new Map(rows.map((r) => [r.name, r]));
    expect(byName.get('2ヶ月前')?.due).toBe(false);
    expect(byName.get('2ヶ月前')?.monthsSince).toBe(2);
    expect(byName.get('3ヶ月前')?.due).toBe(true);
    expect(byName.get('3ヶ月前')?.monthsSince).toBe(3);
  });

  it('経過月数は日ではなく月で数える(月末月初のブレで判定が揺れない)', () => {
    const late = subsReviewStatus([v(1, 'A', '2026-05-31')], '2026-08-01');
    const early = subsReviewStatus([v(1, 'A', '2026-05-01')], '2026-08-31');
    expect(late[0].monthsSince).toBe(3);
    expect(early[0].monthsSince).toBe(3);
  });

  it('期限切れは放置が長い順、期限内は後ろへ回す', () => {
    const rows = subsReviewStatus(
      [v(1, '直近', '2026-08-01'), v(2, '半年放置', '2026-02-01'), v(3, '4ヶ月放置', '2026-04-01')],
      '2026-08-27',
    );
    expect(rows.map((r) => r.name)).toEqual(['半年放置', '4ヶ月放置', '直近']);
  });

  it('年をまたいでも月数で数える', () => {
    const rows = subsReviewStatus([v(1, 'A', '2025-11-01')], '2026-02-15');
    expect(rows[0].monthsSince).toBe(3);
    expect(rows[0].due).toBe(true);
  });

  it('登録が無くても落ちない', () => {
    expect(subsReviewStatus([], '2026-08-27')).toEqual([]);
  });
});
