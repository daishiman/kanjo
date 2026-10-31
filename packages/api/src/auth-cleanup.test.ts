import { describe, expect, it } from 'vitest';
import { runScheduledAuthCleanup } from './auth-cleanup.js';

describe('夜間の認証保守', () => {
  it('毎日2queryだけ実行し、8日で監査と4種類の期限artifactを巡回する', async () => {
    const queries: string[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          run: async () => {
            queries.push(sql);
            return { meta: { changes: 1 } };
          },
        }),
      }),
    } as unknown as D1Database;
    const kinds = new Set<string>();
    for (let offset = 0; offset < 8; offset += 1) {
      const start = queries.length;
      const result = await runScheduledAuthCleanup(db, new Date(Date.UTC(2026, 9, 1 + offset)));
      expect(queries.length - start).toBe(2);
      expect(result.rateLimitsDeleted).toBe(1);
      kinds.add(result.kind);
    }
    expect(queries.filter((sql) => sql.includes('DELETE FROM auth_rate_limits'))).toHaveLength(8);
    expect(queries.filter((sql) => sql.includes('DELETE FROM auth_audit_log'))).toHaveLength(4);
    expect([...kinds].sort()).toEqual([
      'auth_audit_log',
      'link_confirmation_token',
      'mfa_setup_token',
      'session',
      'verification',
    ]);
  });
});
