/**
 * 設定画面の「利用者管理」。admin だけに見える。
 *
 * 自己サインアップは持たない。増やすのも止めるのも、ここでの admin の操作としてだけ起きる。
 * 一時パスワードは発行の応答に1度だけ現れる値で、どこにも保存されない。閉じたら二度と出せない。
 *
 * 権限判定の正本はサーバ側の 403。ここで非表示にするのは導線の整理であって、
 * 権限の実装ではない (API を直接叩けば通る、という状態を作らないのはサーバの責務)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type AccountUser, ApiError, type AuthState, api } from '../api.js';
import { Button } from './Button.js';

interface IssuedPassword {
  email: string;
  password: string;
  reason: 'invite' | 'reset';
}

const ROLE_LABEL = { admin: '管理者', member: '一般' } as const;
const STATUS_LABEL = { active: '有効', suspended: '停止中' } as const;

const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : '操作に失敗しました。通信状況を確認してください';

const formatMoment = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function UserAdmin() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
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
    queryFn: () => api<{ users: AccountUser[] }>('/admin/users'),
    // admin でない利用者にこの照会を投げても 403 になるだけなので、投げない
    enabled: isAdmin,
  });

  const afterChange = () => {
    setError('');
    void qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const invite = useMutation({
    mutationFn: () =>
      api<{ user: AccountUser; temporaryPassword: string }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: (data) => {
      setEmail('');
      setIssued({ email: data.user.email, password: data.temporaryPassword, reason: 'invite' });
      afterChange();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; role?: 'admin' | 'member'; status?: 'active' | 'suspended' }) =>
      api<{ user: AccountUser }>(`/admin/users/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: input.role, status: input.status }),
      }),
    onSuccess: afterChange,
    onError: (err) => setError(errorMessage(err)),
  });

  const resetPassword = useMutation({
    mutationFn: (user: AccountUser) =>
      api<{ temporaryPassword: string }>(`/admin/users/${user.id}/password-reset`, { method: 'POST' }).then(
        (data) => ({ email: user.email, password: data.temporaryPassword }),
      ),
    onSuccess: (data) => {
      setIssued({ ...data, reason: 'reset' });
      afterChange();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!isAdmin) return null;

  return (
    <div className="card" id="user-admin">
      <h2>利用者管理</h2>
      <p className="sub">
        このシステムに入れる人を管理します。利用者が自分で登録することはできません。
        追加も停止も、ここからの操作としてだけ行われ、すべて監査記録に残ります。
      </p>

      {issued && (
        <div className="user-admin-issued" role="alert">
          <h3>{issued.reason === 'invite' ? '追加しました' : '一時パスワードを再発行しました'}</h3>
          <p>
            {issued.email} の一時パスワードです。<strong>この画面を閉じると二度と表示できません。</strong>
            別の手段で本人へ渡してください。本人は最初のログイン時に必ず変更します。
          </p>
          <code className="user-admin-temp">{issued.password}</code>
          <Button variant="primary" onClick={() => setIssued(null)}>
            控えたので閉じる
          </Button>
        </div>
      )}

      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      <form
        className="user-admin-invite"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invite.isPending && email) invite.mutate();
        }}
      >
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
          />
        </label>
        <label>
          権限
          <select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'member')}>
            <option value="member">一般</option>
            <option value="admin">管理者</option>
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={invite.isPending || !email}>
          {invite.isPending ? '追加中…' : '利用者を追加'}
        </Button>
      </form>

      {users.isLoading && <p className="sub">読み込み中…</p>}
      {users.data && (
        <table className="user-admin-table">
          <thead>
            <tr>
              <th>メールアドレス</th>
              <th>権限</th>
              <th>状態</th>
              <th>最終ログイン</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.data.users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.email}
                  {user.mustChangePassword && <span className="user-admin-flag">一時パスワード</span>}
                </td>
                <td>
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
                  <Button size="mini" onClick={() => resetPassword.mutate(user)}>
                    一時パスワード再発行
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
