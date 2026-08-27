import { describe, expect, it } from 'vitest';
import { signedSessionCookieForTest } from './auth.test-support.js';
import { app } from './index.js';
import { EXPECTED_D1_MIGRATION } from './schema-guard.js';

const schemaReadyDatabase = {
  prepare: () => ({ first: async () => EXPECTED_D1_MIGRATION }),
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

  it('未認証リクエストはschema照合より先に401で停止する', async () => {
    let schemaQueries = 0;
    const response = await app.request('/api/summary', undefined, {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      SESSION_SECRET: 'synthetic-test-secret',
      DB: {
        prepare: () => {
          schemaQueries += 1;
          throw new Error('schema lookup must not run before authentication');
        },
      },
    });

    expect(response.status).toBe(401);
    expect(schemaQueries).toBe(0);
  });

  it('存在しないAPIもSPAではなくJSONエラーにする', async () => {
    const env = {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      AUTH_PASSWORD: 'synthetic-test-password',
      SESSION_SECRET: 'synthetic-test-secret',
      DB: schemaReadyDatabase,
    };
    const cookie = await signedSessionCookieForTest(env.SESSION_SECRET);

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
