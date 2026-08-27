import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiUpload } from './api.js';

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
