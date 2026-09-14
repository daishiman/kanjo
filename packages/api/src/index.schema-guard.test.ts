import { describe, expect, it, vi } from 'vitest';
import { TEST_ADMIN_ROW, isUserLookupQuery, signedSessionCookieForTest } from './auth.test-support.js';
import { app } from './index.js';
import { SCHEMA_UNAVAILABLE_ERROR } from './schema-guard.js';

describe('実appの取込schema境界', () => {
  it('認証済み/api/summaryとGET/POST /api/importsを同じ503で止め、業務D1へ進めない', async () => {
    const secret = 'synthetic-schema-integration-secret';
    const cookie = await signedSessionCookieForTest(secret);
    let schemaQueries = 0;
    let authQueries = 0;
    let businessQueries = 0;
    const database = {
      prepare: (sql: string) => {
        if (sql === 'SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1') {
          schemaQueries += 1;
          return { first: async () => '0014_password_login_rate_limits.sql' };
        }
        // 認証の照会は業務D1ではない。ここを一緒に数えると、schema guardが
        // 「誰であるか」の確認まで止めている、という誤った保証になる。
        if (isUserLookupQuery(sql)) {
          authQueries += 1;
          return { bind: () => ({ first: async () => TEST_ADMIN_ROW }) };
        }
        businessQueries += 1;
        throw new Error('business D1 must not run behind the schema guard');
      },
    };
    const env = {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      SESSION_SECRET: secret,
      DB: database,
    };
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const summaryResponse = await app.request('/api/summary', { headers: { cookie } }, env);
    const getResponse = await app.request('/api/imports', { headers: { cookie } }, env);
    const postResponse = await app.request(
      '/api/imports',
      { method: 'POST', headers: { cookie }, body: new FormData() },
      env,
    );

    for (const response of [summaryResponse, getResponse, postResponse]) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: SCHEMA_UNAVAILABLE_ERROR });
    }
    expect(schemaQueries).toBe(1);
    // 3リクエストとも認証は通り、その先のschema境界で止まっている。
    expect(authQueries).toBe(3);
    expect(businessQueries).toBe(0);
    expect(errorLog).toHaveBeenCalledTimes(3);
  });
});
