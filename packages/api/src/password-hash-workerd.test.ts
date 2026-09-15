/**
 * PBKDF2 の反復回数が本番の実行環境 (workerd) で受け付けられることを固定する回帰テスト。
 *
 * 本番の Workers は PBKDF2 の反復が 100,000 を超えると deriveBits で NotSupportedError を投げる。
 * 210,000 で出荷した版は全テスト緑のまま、本番のログインが全件 500 になった
 * (Node の WebCrypto にも、ローカルの Miniflare の workerd にもこの上限が無く、再現しない)。
 * そのため上限そのものは定数で固定し、導出の互換は workerd 内と Node (seed-admin.mjs) で突き合わせる。
 */
import { pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PBKDF2_ITERATIONS } from './users.js';

/** 本番 Workers の WebCrypto が受け付ける PBKDF2 反復の上限。ローカル実行環境では検出できない。 */
const WORKERS_PRODUCTION_PBKDF2_MAX_ITERATIONS = 100_000;

const seedAdminPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scripts/seed-admin.mjs');

const WORKER = `export default {
  async fetch(request) {
    const { password, salt, iterations } = await request.json();
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt), iterations },
        key,
        256,
      );
      return Response.json({ ok: true, derived: Array.from(new Uint8Array(bits)) });
    } catch (error) {
      return Response.json({ ok: false, error: String(error && error.name) + ': ' + String(error && error.message) });
    }
  },
};`;

let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({ name: 'password-hash-workerd', modules: true, script: WORKER }),
  );
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
});

describe('PBKDF2 の反復回数 (workerd)', () => {
  it('本番 Workers の上限を超えない', () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(WORKERS_PRODUCTION_PBKDF2_MAX_ITERATIONS);
  });

  it('現行の反復回数で workerd が導出でき、Node の pbkdf2Sync と同じ値になる', async () => {
    const password = 'synthetic-test-password';
    const salt = Array.from({ length: 16 }, (_, index) => index);

    const response = await mf.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ password, salt, iterations: PBKDF2_ITERATIONS }),
    });
    const result = (await response.json()) as { ok: boolean; derived?: number[]; error?: string };

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    const expected = pbkdf2Sync(password, Buffer.from(salt), PBKDF2_ITERATIONS, 32, 'sha256');
    expect(result.derived).toEqual(Array.from(expected));
  });

  it('seed-admin.mjs の反復回数が users.ts と一致する', () => {
    const match = readFileSync(seedAdminPath, 'utf8').match(/const PBKDF2_ITERATIONS = ([\d_]+);/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1].replaceAll('_', ''))).toBe(PBKDF2_ITERATIONS);
  });
});
