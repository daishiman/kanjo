import { Hono } from 'hono';
import {
  AUTH_RATE_LIMIT_ERROR,
  authRetryAfterSeconds,
  inspectAuthRateLimit,
  recordAuthRateLimitFailure,
} from '../auth-rate-limit.js';
import type { AuthEnv, AuthVariables } from '../auth.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const statusRoute = new Hono<Ctx>();

statusRoute.get('/status', async (c) => {
  try {
    const rate = await inspectAuthRateLimit(c.env.DB, 'status', c.req.raw);
    if (rate.lockedUntil) {
      return c.json(
        { error: { ...AUTH_RATE_LIMIT_ERROR, retryAfterSeconds: authRetryAfterSeconds(rate.lockedUntil) } },
        429,
        { 'Cache-Control': 'no-store' },
      );
    }
    // 60回目で行はlockになるが、この要求までは許可する。次のinspect（61回目）が429になる。
    await recordAuthRateLimitFailure(c.env.DB, rate);
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'normal' as const }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'status_probe',
        name: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return c.json({ status: 'degraded' as const }, 200, { 'Cache-Control': 'no-store' });
  }
});
