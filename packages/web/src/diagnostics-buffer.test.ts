// @vitest-environment jsdom

/**
 * 診断リングバッファのテスト。
 *
 * 一番大事なのは「改善要望ボタンを押す前に起きたこと」が入っていること。
 * install はアプリ起動時に済んでおり、押下時点では既に貯まっている、という前提を
 * ここで再現する(install → エラー発生 → snapshot の順)。
 *
 * install は console と fetch を包む。包まれる「元」の側をテストが制御できるよう、
 * install より前に差し替えておく(あとから spy すると包みの外側になり、記録経路を通らない)。
 */
import { DIAGNOSTIC_MAX_ENTRIES } from '@kanjo/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  diagnosticsSnapshot,
  installDiagnostics,
  recordDiagnostic,
  resetDiagnosticsForTest,
} from './diagnostics-buffer.js';

let uninstall: () => void = () => undefined;
let baseError: ReturnType<typeof vi.fn>;
let baseWarn: ReturnType<typeof vi.fn>;
let baseFetch: ReturnType<typeof vi.fn>;
let realFetch: typeof window.fetch;

beforeEach(() => {
  resetDiagnosticsForTest();
  baseError = vi.fn();
  baseWarn = vi.fn();
  baseFetch = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.spyOn(console, 'error').mockImplementation(baseError);
  vi.spyOn(console, 'warn').mockImplementation(baseWarn);
  realFetch = window.fetch;
  window.fetch = baseFetch as unknown as typeof window.fetch;
  uninstall = installDiagnostics();
});

afterEach(() => {
  uninstall();
  window.fetch = realFetch;
  resetDiagnosticsForTest();
  vi.restoreAllMocks();
});

const entries = (route = '/') => diagnosticsSnapshot(route).entries;
const kinds = (route = '/'): string[] => entries(route).map((e) => e.kind);

describe('収集', () => {
  it('未捕捉の例外を記録する', () => {
    window.dispatchEvent(
      new ErrorEvent('error', { message: '架空の例外', error: new TypeError('架空の例外') }),
    );
    expect(kinds()).toContain('error');
    expect(entries()[0].message).toContain('TypeError: 架空の例外');
  });

  it('拾われなかった Promise の失敗を記録する', () => {
    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    (event as { reason: unknown }).reason = new RangeError('架空の失敗');
    window.dispatchEvent(event);
    expect(kinds()).toContain('unhandledrejection');
    expect(entries()[0].message).toContain('RangeError: 架空の失敗');
  });

  it('console.error と console.warn を記録し、元の出力も残す', () => {
    console.error('架空のエラー表示');
    console.warn('架空の警告表示');
    // DevTools の表示は失わない
    expect(baseError).toHaveBeenCalledWith('架空のエラー表示');
    expect(baseWarn).toHaveBeenCalledWith('架空の警告表示');
    expect(kinds()).toEqual(['console_error', 'console_warn']);
  });

  it('Error を渡した console.error はスタックの先頭だけを持つ', () => {
    console.error(new Error('架空の失敗'));
    const entry = entries()[0];
    expect(entry.message).toContain('Error: 架空の失敗');
    // 全フレームを抱え込まない
    expect(entry.detail.split(' / ').length).toBeLessThanOrEqual(4);
  });

  it('失敗した通信をメソッド・パス・ステータスだけで記録する', async () => {
    baseFetch.mockResolvedValueOnce(new Response('{"detail":"内部の詳細"}', { status: 500 }));
    await window.fetch('/api/classify?token=raw-token-value', { method: 'POST' });
    const entry = entries().find((e) => e.kind === 'network');
    expect(entry?.message).toBe('POST /api/classify 500');
    // レスポンス本文は持たない。持てる構造にしない
    expect(entry?.detail).toMatch(/^\d+ms$/);
  });

  it('通信が例外で落ちた場合も記録し、例外はそのまま呼び出し元へ返す', async () => {
    baseFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(window.fetch('/api/summary')).rejects.toThrow('Failed to fetch');
    expect(entries().find((e) => e.kind === 'network')?.message).toBe('GET /api/summary failed');
  });

  it('成功した通信は記録しない', async () => {
    await window.fetch('/api/summary');
    expect(kinds()).not.toContain('network');
  });
});

describe('上限と省略件数', () => {
  it('上限を超えると古い方から捨て、捨てた件数を omittedCount に足す', () => {
    const total = DIAGNOSTIC_MAX_ENTRIES + 12;
    for (let i = 0; i < total; i += 1) recordDiagnostic('console_error', `件 ${i}`);
    const snapshot = diagnosticsSnapshot('/');
    expect(snapshot.entries.length).toBeLessThanOrEqual(DIAGNOSTIC_MAX_ENTRIES);
    expect(snapshot.omittedCount).toBe(total - snapshot.entries.length);
    // 直近が残る。押下直前の状況が最も知りたい情報だから
    expect(snapshot.entries.at(-1)?.message).toBe(`件 ${total - 1}`);
  });

  it('snapshot を取ってもバッファは空にならない(送信失敗時に取り直せる)', () => {
    recordDiagnostic('console_warn', '架空の警告');
    expect(entries().length).toBe(1);
    expect(entries().length).toBe(1);
  });
});

describe('送信内容', () => {
  it('秘匿値は記録の時点でマスクされる', () => {
    recordDiagnostic('console_error', 'Authorization: Bearer raw-secret-token');
    expect(entries()[0].message).not.toContain('raw-secret-token');
    expect(entries()[0].message).toContain('***');
  });

  it('画面パスと環境情報が付く', () => {
    const snapshot = diagnosticsSnapshot('/classify?tab=all');
    expect(snapshot.environment.route).toBe('/classify?tab=all');
    expect(snapshot.environment.viewport).toMatch(/^\d+x\d+@/);
    expect(snapshot.environment.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('二重 install しても記録が二重にならない', () => {
    const second = installDiagnostics();
    console.error('架空のエラー');
    expect(entries().filter((e) => e.message === '架空のエラー').length).toBe(1);
    second();
  });
});
