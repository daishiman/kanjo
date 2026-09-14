// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_EVENT, ApiError, api, apiUpload } from './api.js';

afterEach(() => vi.unstubAllGlobals());

describe('multipart API error contract', () => {
  it('schema 503の専用codeを共通ApiErrorに保つ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: { code: 'schema_unavailable', message: '復旧作業中です' } }, { status: 503 }),
      ),
    );

    const error = await apiUpload('/imports', new FormData()).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'schema_unavailable' });
  });

  it('一部成功の結果bodyは呼び出し側の明示条件で保つ', async () => {
    const body = { results: [{ filename: 'anonymous.csv', status: 'committed' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body, { status: 409 })),
    );

    await expect(
      apiUpload<typeof body>('/imports', new FormData(), {
        acceptErrorBody: (candidate) =>
          !!candidate && typeof candidate === 'object' && Array.isArray(Reflect.get(candidate, 'results')),
      }),
    ).resolves.toEqual(body);
  });
});

describe('401 notification contract', () => {
  it('明示した資格情報相違だけは画面内回復に留める', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'invalid_credentials', message: '現在のパスワードが違います' } },
          { status: 401 },
        ),
      ),
    );
    const onUnauthorized = vi.fn();
    window.addEventListener(AUTH_EVENT, onUnauthorized, { once: true });

    const error = await api('/auth/password', undefined, {
      recoverableUnauthorizedCodes: ['invalid_credentials'],
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(onUnauthorized).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EVENT, onUnauthorized);
  });

  it('許可していない認証失効codeは全体へ通知する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, { status: 401 }),
      ),
    );
    const onUnauthorized = vi.fn();
    window.addEventListener(AUTH_EVENT, onUnauthorized, { once: true });

    const error = await api('/auth/password', undefined, {
      recoverableUnauthorizedCodes: ['invalid_credentials'],
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
