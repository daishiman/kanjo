import { zValidator } from '@hono/zod-validator';
import { createMiddleware } from 'hono/factory';
import type { z } from 'zod';

/** 公開APIのエラー本文の形。code は画面が文言を決める鍵で、message は既定の文。 */
export const errorBody = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message, ...extra },
});

/** 利用者ごとの応答を共有キャッシュに残さない。成功・失敗を問わず同じ値を付ける。 */
export const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** 公開APIのJSON入力エラーは、Zodの内部詳細を出さずこの1形に畳む。 */
export const INVALID_PUBLIC_REQUEST = {
  error: { code: 'invalid_request', message: '入力内容を確認してください' },
} as const;

export function publicJsonValidator<T extends z.ZodTypeAny>(schema: T) {
  // zValidatorの戻り値でc.req.valid('json')の出力型をそのまま引き継ぐ。
  const validationType = zValidator('json', schema);
  return createMiddleware(async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(INVALID_PUBLIC_REQUEST, 400);
    }
    const result = schema.safeParse(body);
    if (!result.success) return c.json(INVALID_PUBLIC_REQUEST, 400);
    c.req.addValidatedData('json', result.data);
    await next();
  }) as typeof validationType;
}
