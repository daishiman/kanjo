import { describe, expect, it } from 'vitest';
import { app } from './index.js';

const sessionCookie = async (secret: string): Promise<string> => {
  const expiresAt = String(Date.now() + 60_000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expiresAt)));
  const encoded = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `kanjo_session=${expiresAt}.${encoded}`;
};

describe('API公開境界', () => {
  it('認証未設定で保護APIを公開しない', async () => {
    const response = await app.request('/api/summary', undefined, {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'auth_not_configured', message: '認証が未設定です(SESSION_SECRET)' },
    });
  });

  it('存在しないAPIもSPAではなくJSONエラーにする', async () => {
    const env = {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      AUTH_PASSWORD: 'synthetic-test-password',
      SESSION_SECRET: 'synthetic-test-secret',
    };
    const cookie = await sessionCookie(env.SESSION_SECRET);

    const response = await app.request('/api/not-found', { headers: { cookie } }, env);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'エンドポイントがありません' },
    });
  });
});

describe('AIエージェント用API', () => {
  const env = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

  it('トークン無しではデータも結果送信も受け付けない', async () => {
    const data = await app.request('/api/ai/tasks/x/data', undefined, env);
    expect(data.status).toBe(401);
    const post = await app.request(
      '/api/ai/tasks/x/report',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      env,
    );
    expect(post.status).toBe(401);
    await expect(post.json()).resolves.toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('セッション無しではレポート一覧を見られない', async () => {
    const res = await app.request('/api/ai/reports', undefined, env);
    expect(res.status).toBe(401);
  });
});
