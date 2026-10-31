/**
 * 失敗の類と文言 (SM-FE-08 / SM-UX-04)。409 は busy・revision・duplicate・取り消せない理由など意味が分かれるので、
 * status ではなくコードで類を決める。旧実装は 409 と 5xx をまとめて「サーバー側で処理に失敗しました」にしていたため、
 * busy と revision が SERVER_FAILED にならないことをここで押さえる。
 */
import { SUBSCRIPTION_UNDO_BLOCKED_MESSAGE } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api.js';
import {
  AUTO_RETRY_LIMIT,
  BUSY_EXHAUSTED,
  REVISION_EXHAUSTED,
  SERVER_FAILED,
  WriteFailure,
  buildLocally,
  busyRetrying,
  classifyWriteError,
  errorCodeOf,
  operationLabel,
  retryKindOf,
  revisionRetrying,
  staleMessage,
} from './operationText.js';

const busy = () => new ApiError(409, 'canonical_write_busy', '別の書き込みを処理中です');
const overloaded = () => new ApiError(503, 'd1_overloaded', '混み合っています');
const conflict = () => new ApiError(409, 'subscription_revision_conflict', '他の操作が先に反映されました');
const internal = () => new ApiError(500, 'internal', 'internal error');

describe('retryKindOf', () => {
  it('busy と過負荷は同じ key で待って送り直す', () => {
    expect(retryKindOf(busy())).toBe('busy');
    expect(retryKindOf(overloaded())).toBe('busy');
  });

  it('revision の衝突は取り直してから送り直す', () => {
    expect(retryKindOf(conflict())).toBe('revision');
  });

  it('5xx・その他の 409・通信の失敗は自動では送り直さない', () => {
    expect(retryKindOf(internal())).toBeNull();
    expect(retryKindOf(new ApiError(409, 'duplicate', '同じ名前があります'))).toBeNull();
    expect(retryKindOf(new TypeError('Failed to fetch'))).toBeNull();
    expect(retryKindOf(undefined)).toBeNull();
  });
});

describe('classifyWriteError', () => {
  it('busy と revision は上限まで送り直した後でも SERVER_FAILED にせず、再試行できる', () => {
    for (const error of [busy(), overloaded(), new WriteFailure('busy', busy())]) {
      expect(classifyWriteError(error, 'merge')).toEqual({
        class: 'busy',
        message: BUSY_EXHAUSTED,
        retryable: true,
      });
    }
    for (const error of [conflict(), new WriteFailure('revision', conflict())]) {
      expect(classifyWriteError(error, 'merge')).toEqual({
        class: 'revision',
        message: REVISION_EXHAUSTED,
        retryable: true,
      });
    }
  });

  it('5xx と通信の失敗だけが SERVER_FAILED で、同じ key で再試行できる', () => {
    const server = { class: 'server', message: SERVER_FAILED, retryable: true };
    expect(classifyWriteError(internal(), 'merge')).toEqual(server);
    expect(classifyWriteError(new WriteFailure('request', internal()), 'merge')).toEqual(server);
    expect(classifyWriteError(new TypeError('Failed to fetch'), 'vendor_create')).toEqual(server);
    expect(classifyWriteError(new WriteFailure('request', new TypeError('x')), 'review')).toEqual(server);
  });

  it('送る前に対象が崩れていたら崩れた名前を出し、統合は選び直し・それ以外は操作のやり直しを促す', () => {
    const stale = new WriteFailure('stale', null, ['Notion', 'Slack']);
    const merge = classifyWriteError(stale, 'merge');
    expect(merge.class).toBe('manual');
    expect(merge.retryable).toBe(false);
    expect(merge.message).toBe(staleMessage(['Notion', 'Slack'], 'merge'));
    expect(merge.message).toContain('Notion、Slack');
    expect(merge.message).toContain('統合しませんでした');
    expect(classifyWriteError(stale, 'vendor_update').message).toContain('送りませんでした');
  });

  it.each([
    ['undo_expired', 410, '30 日'],
    ['already_undone', 409, 'すでに元に戻されています'],
    ['undo_blocked_by_later_operation', 409, '後の操作から順に戻して'],
    ['too_many_aliases', 422, '50 件'],
    ['merge_cycle', 422, '統合先を選び直して'],
    ['schema_unavailable', 503, 'システム更新の適用待ち'],
    ['idempotency_key_reused', 422, '画面を読み込み直して'],
    ['idempotency_key_required', 400, '画面を読み込み直して'],
    ['empty_merge', 400, '画面を読み込み直して'],
  ])('%s は利用者が選び直すか読み込み直すしかないので、再試行を出さない', (code, status, text) => {
    const failure = classifyWriteError(new ApiError(status, code, 'api message'), 'unmerge');
    expect(failure.class).toBe('manual');
    expect(failure.retryable).toBe(false);
    expect(failure.message).toContain(text);
    expect(failure.message).not.toBe(SERVER_FAILED);
  });

  it('取り消せない理由は API と操作の記録と同じ core の文をそのまま出す', () => {
    for (const [code, message] of Object.entries(SUBSCRIPTION_UNDO_BLOCKED_MESSAGE)) {
      const status = code === 'undo_expired' ? 410 : 409;
      expect(classifyWriteError(new ApiError(status, code, 'api message'), 'unmerge').message).toBe(message);
    }
  });

  it('本文を作る段の例外 (broken) は画面の不具合として読み込み直しを促し、再試行を出さない', () => {
    const broken = classifyWriteError(new WriteFailure('broken', new TypeError('x')), 'merge');
    expect(broken.class).toBe('manual');
    expect(broken.retryable).toBe(false);
    expect(broken.message).toContain('画面を読み込み直して');
  });

  it('503 でも schema_unavailable はコードで先に分け、SERVER_FAILED にしない', () => {
    expect(classifyWriteError(new ApiError(503, 'schema_unavailable', 'x'), 'merge').class).toBe('manual');
  });

  it('404 は統合と取り消しで言い分け、その他は API の文言をそのまま出す', () => {
    const missing = new ApiError(404, 'not_found', '見つかりません');
    expect(classifyWriteError(missing, 'merge').message).toContain('統合先か統合元が見つかりませんでした');
    expect(classifyWriteError(missing, 'unmerge').message).toContain('この統合は見つかりませんでした');
    expect(classifyWriteError(missing, 'vendor_delete').message).toBe('見つかりません');
  });

  it('401 はログインし直しを促し、知らない 4xx は API の文言を出す', () => {
    expect(classifyWriteError(new ApiError(401, 'unauthorized', 'x'), 'merge').message).toContain(
      'もう一度ログイン',
    );
    const unknown = classifyWriteError(
      new ApiError(400, 'invalid_name', '名前が長すぎます'),
      'vendor_update',
    );
    expect(unknown).toEqual({ class: 'manual', message: '名前が長すぎます', retryable: false });
  });
});

describe('buildLocally', () => {
  const thrownBy = (error: unknown): unknown => {
    try {
      buildLocally(() => {
        throw error;
      });
    } catch (thrown) {
      return thrown;
    }
    return undefined;
  };

  it('手元の値から作る段の例外を broken に包み、意図して投げた WriteFailure はそのまま通す', () => {
    expect(buildLocally(() => 1)).toBe(1);
    const cause = new TypeError('x');
    const wrapped = thrownBy(cause);
    expect(wrapped).toBeInstanceOf(WriteFailure);
    expect((wrapped as WriteFailure).reason).toBe('broken');
    expect((wrapped as WriteFailure).cause).toBe(cause);
    const stale = new WriteFailure('stale', null, ['Notion']);
    expect(thrownBy(stale)).toBe(stale);
  });
});

describe('errorCodeOf', () => {
  it('WriteFailure の中の ApiError まで辿り、ApiError でなければ null', () => {
    const duplicate = new ApiError(409, 'duplicate', '同じ名前があります');
    expect(errorCodeOf(duplicate)).toBe('duplicate');
    expect(errorCodeOf(new WriteFailure('request', duplicate))).toBe('duplicate');
    expect(errorCodeOf(new WriteFailure('busy', busy()))).toBe('canonical_write_busy');
    expect(errorCodeOf(new WriteFailure('stale', null, ['A']))).toBeNull();
    expect(errorCodeOf(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('文言', () => {
  it('自動の送り直しは何回目かを上限と並べて出す', () => {
    expect(AUTO_RETRY_LIMIT).toBe(3);
    expect(busyRetrying(2)).toContain('(2/3)');
    expect(revisionRetrying(1)).toContain('(1/3)');
  });

  it('統合だけは統合先の名前を見出しに入れ、名前が無ければ「統合先」と書く', () => {
    expect(operationLabel('merge', 'Aqua Voice')).toBe('Aqua Voice へ統合');
    expect(operationLabel('merge', null)).toBe('統合先 へ統合');
    expect(operationLabel('unmerge', 'Aqua Voice')).toBe('統合の取り消し');
    expect(operationLabel('vendor_update', null)).toBe('登録内容の変更');
  });
});
