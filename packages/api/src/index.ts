import { zValidator } from '@hono/zod-validator';
/**
 * kanjo-console Worker エントリ。
 * - /api/auth/*: ログイン(アプリ内セッション)。Access併用時は不要だが常設(冪等)
 * - /api/*: 認証必須のREST(spec §9)
 * - それ以外: Workers Assets がSPAを配信(データを含まないため公開)
 * - scheduled: 夜間バックアップ(統合JSON→R2 backups/、30日保持)
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { type AuthEnv, authGuard, clearSession, issueSession, verifyPassword } from './auth.js';
import { canonicalMutationFence } from './canonical-mutation-fence.js';
import { aiAgentRoute, aiRoute } from './routes/ai.js';
import { analyticsRoute } from './routes/analytics.js';
import { cashRoute } from './routes/cash.js';
import { classifyRoute } from './routes/classify.js';
import { importsRoute } from './routes/imports.js';
import { settingsRoute } from './routes/settings.js';
import { subsRoute } from './routes/subs.js';
import { getDb, loadBackupPayload } from './store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const app = new Hono<Ctx>();

/* -------- 認証エンドポイント(未認証で到達可能なのはここだけ) -------- */

const loginSchema = z.object({ password: z.string().min(1).max(500) });

app.post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
  const env = c.env;
  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
    return c.json({ error: { code: 'access_mode', message: 'Cloudflare Access認証を使用しています' } }, 400);
  }
  if (!env.AUTH_PASSWORD || !env.SESSION_SECRET) {
    return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
  }
  const { password } = c.req.valid('json');
  if (!(await verifyPassword(password, env.AUTH_PASSWORD))) {
    return c.json({ error: { code: 'invalid_credentials', message: 'パスワードが違います' } }, 401);
  }
  await issueSession(c, env.SESSION_SECRET);
  return c.json({ ok: true });
});

app.post('/api/auth/logout', (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

// 認証状態の確認(ガードを通れば200)
app.get('/api/auth/me', authGuard(), (c) => c.json({ authenticated: true }));

// AIエージェント用(依頼ごとの使い捨てトークンで認証。セッション不要)
app.route('/api', aiAgentRoute);

/* -------- 保護されたAPI -------- */

app.use('/api/*', authGuard());
app.use('/api/*', canonicalMutationFence());
app.route('/api', aiRoute);
app.route('/api', importsRoute);
app.route('/api', cashRoute);
app.route('/api', analyticsRoute);
app.route('/api', classifyRoute);
app.route('/api', settingsRoute);
app.route('/api', subsRoute);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'not_found', message: 'エンドポイントがありません' } }, 404);
  }
  // SPAフォールバックは Workers Assets 側(not_found_handling)が担当
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  // 金融明細のため、エラーログにも明細内容・金額は出さない(種別のみ)
  console.error(JSON.stringify({ level: 'error', path: c.req.path, name: err.name }));
  return c.json({ error: { code: 'internal', message: 'サーバーエラーが発生しました' } }, 500);
});

/* -------- 夜間バックアップ(cron) -------- */

async function nightlyBackup(env: AuthEnv): Promise<void> {
  const db = getDb(env.DB);
  const payload = await loadBackupPayload(db, 'default');
  const today = new Date().toISOString().slice(0, 10);
  await env.FILES.put(`backups/${today}.json`, JSON.stringify(payload));
  // 30日より古いバックアップを削除
  const list = await env.FILES.list({ prefix: 'backups/' });
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const obj of list.objects) {
    const day = obj.key.slice('backups/'.length, 'backups/'.length + 10);
    if (day && day < cutoff) await env.FILES.delete(obj.key);
  }
  console.log(JSON.stringify({ level: 'info', job: 'nightly_backup', key: `backups/${today}.json` }));
}

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: AuthEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(nightlyBackup(env));
  },
};
