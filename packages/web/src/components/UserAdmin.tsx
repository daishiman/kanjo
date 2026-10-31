/**
 * 設定画面の「利用者管理」。admin だけに見える (spec-login-v2 §7.14・decision-004)。
 *
 * 自己サインアップは持たない。人を増やす入口は、ここで作る招待だけ。
 * 招待はメールでだけ届き、管理者は本人の秘密 (パスワード) を一度も手にしない。一時パスワードの発行は持たない。
 *
 * 権限判定の正本はサーバ側の 403。ここで非表示にするのは導線の整理であって、
 * 権限の実装ではない (API を直接叩けば通る、という状態を作らないのはサーバの責務)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { type AdminUserSummary, ApiError, type AuthState, type Invitation, api } from '../api.js';
import { ROLE_LABEL, normalizeEmail } from '../features/auth/view-model.js';
import { Button } from './Button.js';
import { DataTable } from './DataTable.js';
import { Input } from './Input.js';

const STATUS_LABEL = { active: '有効', suspended: '停止中' } as const;
const INVITATION_STATUS_LABEL: Record<Invitation['status'], string> = {
  pending: '未承諾',
  expired: '期限切れ',
  accepted: '承諾済み',
  revoked: '取消',
};

const MAIL_FAILED = '招待は作成しましたが、メールを送れませんでした。再送してください。';

/** 招待の失敗を文言へ。502 は「作成はできた」ので、一覧を取り直したうえで再送を促す */
function invitationErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return '操作に失敗しました。通信状況を確認してください';
  if (err.status === 502) return MAIL_FAILED;
  if (err.code === 'user_exists') return 'このメールアドレスの利用者は登録済みです。';
  if (err.code === 'invitation_not_pending') return 'この招待は承諾済みか取消済みです。一覧を更新しました。';
  if (err.status === 404) return 'この招待は見つかりません。一覧を更新しました。';
  return err.message;
}

const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : '操作に失敗しました。通信状況を確認してください';

const formatMoment = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** 再送・取消できるのは、まだ誰も使っていない招待だけ (承諾済み・取消はサーバが 409 を返す) */
const isOpen = (invitation: Invitation): boolean =>
  invitation.status === 'pending' || invitation.status === 'expired';

export function UserAdmin() {
  const qc = useQueryClient();
  const emailId = useId();
  const roleId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // App と同じ queryKey・同じ endpoint。別の型を名乗ると cache が食い違うので AuthState を共有する
  const me = useQuery({
    queryKey: ['auth'],
    queryFn: () => api<AuthState>('/auth/me'),
    retry: false,
  });
  const isAdmin = me.data?.user?.role === 'admin';

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<{ users: AdminUserSummary[] }>('/admin/users'),
    // admin でない利用者にこの照会を投げても 403 になるだけなので、投げない
    enabled: isAdmin,
  });

  const invitations = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => api<{ invitations: Invitation[] }>('/admin/invitations'),
    enabled: isAdmin,
  });

  const refreshInvitations = () => void qc.invalidateQueries({ queryKey: ['admin-invitations'] });

  const report = (message: string) => {
    setError('');
    setNotice(message);
  };
  const fail = (message: string) => {
    setNotice('');
    setError(message);
  };

  const invite = useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) =>
      api<{ invitation: Invitation }>('/admin/invitations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: ({ invitation }) => {
      setEmail('');
      report(`${invitation.email} に招待メールを送りました。`);
    },
    onError: (err) => fail(invitationErrorMessage(err)),
    // 502 でも招待の行はできている。成否どちらでも一覧をサーバの状態に合わせる
    onSettled: refreshInvitations,
  });

  const resend = useMutation({
    mutationFn: (invitation: Invitation) =>
      api<{ invitation: Invitation }>(`/admin/invitations/${invitation.id}/resend`, { method: 'POST' }),
    onSuccess: ({ invitation }) => report(`${invitation.email} に招待メールを送り直しました。`),
    onError: (err) => fail(invitationErrorMessage(err)),
    onSettled: refreshInvitations,
  });

  const revoke = useMutation({
    mutationFn: (invitation: Invitation) =>
      api<{ invitation: Invitation }>(`/admin/invitations/${invitation.id}/revoke`, { method: 'POST' }),
    onSuccess: ({ invitation }) => report(`${invitation.email} の招待を取り消しました。`),
    onError: (err) => fail(invitationErrorMessage(err)),
    onSettled: refreshInvitations,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; role?: 'admin' | 'member'; status?: 'active' | 'suspended' }) =>
      api<{ user: AdminUserSummary }>(`/admin/users/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: input.role, status: input.status }),
      }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => fail(errorMessage(err)),
  });

  if (!isAdmin) return null;

  const normalized = normalizeEmail(email);
  const rowBusy = resend.isPending || revoke.isPending;

  return (
    <div className="card" id="user-admin">
      <h2>利用者管理</h2>
      <p className="sub">
        このシステムに入れる人を管理します。利用者が自分で登録することはできません。
        招待メールを受け取った本人が、自分でパスワードかGoogleを登録します。操作はすべて監査記録に残ります。
      </p>

      {notice && <output className="notice">{notice}</output>}
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      <form
        className="user-admin-invite"
        aria-label="招待を作る"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invite.isPending && normalized) invite.mutate({ email: normalized, role });
        }}
      >
        <label htmlFor={emailId}>メールアドレス</label>
        <Input
          id={emailId}
          kind="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="member@example.com"
        />
        <label htmlFor={roleId}>権限</label>
        <select
          id={roleId}
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
        >
          <option value="member">{ROLE_LABEL.member}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </select>
        <Button type="submit" variant="primary" disabled={invite.isPending || !normalized}>
          {invite.isPending ? '送信中…' : '招待メールを送る'}
        </Button>
      </form>

      <h3>招待</h3>
      {invitations.isLoading && <p className="sub">読み込み中…</p>}
      {invitations.data && (
        <DataTable
          className="user-admin-table"
          caption={<caption className="visually-hidden">招待の一覧</caption>}
          columns={['メールアドレス', '権限', '状態', '期限', '招待者', { label: '操作', sortable: false }]}
        >
          {invitations.data.invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td>{invitation.email}</td>
              <td>{ROLE_LABEL[invitation.role]}</td>
              <td>{INVITATION_STATUS_LABEL[invitation.status]}</td>
              <td data-sort={invitation.expiresAt}>{formatMoment(invitation.expiresAt)}</td>
              <td>{invitation.invitedBy ?? '—'}</td>
              <td className="user-admin-actions">
                {isOpen(invitation) && (
                  <>
                    <Button size="mini" disabled={rowBusy} onClick={() => resend.mutate(invitation)}>
                      再送
                    </Button>
                    <Button
                      size="mini"
                      variant="danger"
                      disabled={rowBusy}
                      onClick={() => revoke.mutate(invitation)}
                    >
                      取消
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <h3>利用者</h3>
      {users.isLoading && <p className="sub">読み込み中…</p>}
      {users.data && (
        <DataTable
          className="user-admin-table"
          caption={<caption className="visually-hidden">利用者の一覧</caption>}
          columns={['メールアドレス', '権限', '状態', '最終ログイン', { label: '操作', sortable: false }]}
        >
          {users.data.users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td data-sort={ROLE_LABEL[user.role]}>
                <select
                  value={user.role}
                  aria-label={`${user.email} の権限`}
                  onChange={(event) =>
                    update.mutate({ id: user.id, role: event.target.value as 'admin' | 'member' })
                  }
                >
                  <option value="member">{ROLE_LABEL.member}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                </select>
              </td>
              <td>{STATUS_LABEL[user.status]}</td>
              <td>{formatMoment(user.lastLoginAt)}</td>
              <td className="user-admin-actions">
                <Button
                  size="mini"
                  onClick={() =>
                    update.mutate({
                      id: user.id,
                      status: user.status === 'active' ? 'suspended' : 'active',
                    })
                  }
                >
                  {user.status === 'active' ? '停止する' : '再開する'}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
