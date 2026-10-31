import { invitationExpiresAt } from '@kanjo/core';
import { newOpaqueToken, sha256Hex } from './auth-tokens.js';
import type { SendMail } from './mail.js';

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: 'admin' | 'member';
  token_hash: string;
  expires_at: string;
  accepted_at: null;
  revoked_at: null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

type Selector = { id: string } | { email: string; unexpiredAt: string };

/**
 * 招待再送の token rotate と配送を集約する。
 * 配送失敗時は、この呼出しが書いたtokenだけをCASで元へ戻し、既存リンクを失効させない。
 */
export async function rotateAndDeliverInvitation(input: {
  db: D1Database;
  sendMail: SendMail;
  appOrigin: string;
  selector: Selector;
}): Promise<PendingInvitationRow | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const select =
      'id' in input.selector
        ? input.db
            .prepare(
              `SELECT id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at
                 FROM invitations
                WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1`,
            )
            .bind(input.selector.id)
        : input.db
            .prepare(
              `SELECT id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at
                 FROM invitations
                WHERE email=? AND expires_at>? AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1`,
            )
            .bind(input.selector.email, input.selector.unexpiredAt);
    const current = await select.first<PendingInvitationRow>();
    if (!current) return null;

    const token = newOpaqueToken();
    const tokenHash = await sha256Hex(token);
    const nowIso = new Date().toISOString();
    const expiresAt = invitationExpiresAt(new Date(nowIso)).toISOString();
    const rotated = await input.db
      .prepare(
        `UPDATE invitations SET token_hash=?,expires_at=?,updated_at=?
          WHERE id=? AND token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL
          RETURNING id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at`,
      )
      .bind(tokenHash, expiresAt, nowIso, current.id, current.token_hash)
      .first<PendingInvitationRow>();
    if (!rotated) continue;

    try {
      await input.sendMail(rotated.email, 'invite', {
        url: `${input.appOrigin.replace(/\/$/, '')}/invite/accept?token=${encodeURIComponent(token)}`,
        role: rotated.role,
      });
      return rotated;
    } catch (error) {
      await input.db
        .prepare(
          `UPDATE invitations SET token_hash=?,expires_at=?,updated_at=?
            WHERE id=? AND token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL`,
        )
        .bind(current.token_hash, current.expires_at, current.updated_at, current.id, tokenHash)
        .run();
      throw error;
    }
  }
  return null;
}
