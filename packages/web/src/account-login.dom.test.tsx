// @vitest-environment jsdom

/**
 * 認証まわりの画面契約。
 *
 * ここで固定するのは見た目ではなく「漏らさないこと」と「迷わせないこと」:
 *   - 認証前にアプリ枠(ヘッダー・フッター・サイドバー)を描かない
 *   - 在籍しているメールアドレスを応答の差から推測させない
 *   - 一時パスワードは1度きりで、閉じたら復元できない
 *   - admin でない利用者に管理APIを叩かせない
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { AUTH_EVENT, type AuthState } from './api.js';
import { UserAdmin } from './components/UserAdmin.js';
import { LoginPage } from './pages/Login.js';
import { PasswordChangePage } from './pages/PasswordChange.js';

interface Call {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}

let calls: Call[] = [];

/**
 * `"<METHOD> <path>"` または `"<path>"` → 応答。未登録は 404 にして、想定外の照会を沈黙で通さない。
 * method 込みで引けるようにしているのは、同じ path の GET と POST が別の形を返すため
 * (`GET /admin/users` は一覧、`POST /admin/users` は発行結果)。
 */
function stubFetch(routes: Record<string, () => Response>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push({
        path,
        method,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
      });
      const route = routes[`${method} ${path}`] ?? routes[path];
      if (!route) return new Response('{}', { status: 404 });
      return route();
    }),
  );
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const apiError = (status: number, code: string, message: string, extra: object = {}): Response =>
  json({ error: { code, message }, ...extra }, status);

const authState = (role: 'admin' | 'member'): AuthState => ({
  authenticated: true,
  user: {
    id: 'u1',
    email: role === 'admin' ? 'owner@example.test' : 'member@example.test',
    role,
    status: 'active',
    mustChangePassword: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    lastLoginAt: '2026-09-12T09:00:00.000Z',
  },
});

const withQuery = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>,
  );

/** 資格情報を埋めて送信ボタンを押す。押下の前後で毎回同じ手順にする */
function fillAndSubmit(email = 'owner@example.test', password = 'correct-horse-battery'): void {
  fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ログイン画面の枠', () => {
  it('ヘッダー・フッター・サイドバーを1つも描かない', () => {
    stubFetch({});
    render(<LoginPage onSuccess={() => {}} />);
    // 「隠す」ではなく「存在しない」。枠があると未認証のまま業務APIを叩く経路が残る
    expect(document.querySelectorAll('header')).toHaveLength(0);
    expect(document.querySelectorAll('footer')).toHaveLength(0);
    expect(document.querySelectorAll('nav')).toHaveLength(0);
    // aside も禁じる。タグ名だけを塞いだ前版では、脇に置いた <aside> が
    // 380px の列として描かれ、実機ではサイドバーに見えていた
    expect(document.querySelectorAll('aside')).toHaveLength(0);
    expect(document.querySelectorAll('.sidebar, .app-shell, .page-header')).toHaveLength(0);
    // 認証前に業務APIへ出ていく経路が1本も無いこと
    expect(calls).toHaveLength(0);
  });

  it('Cloudflare Access など別経路のログイン導線を持たない', () => {
    stubFetch({});
    const { container } = render(<LoginPage onSuccess={() => {}} />);
    // 「Cloudflare」の語そのものは禁じない。保管先の開示 (安心3項目) は残すべき情報で、
    // 禁じたいのは別の手段でログインさせる操作可能な要素のほう
    const actions = [...container.querySelectorAll('button, a')].map((node) => node.textContent ?? '');
    expect(actions.filter((text) => /Access|Cloudflare|SSO|シングルサインオン/.test(text))).toEqual([]);
    // 入口はメールアドレスとパスワードの1組だけ
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('すべてのアイコンが装飾扱いで、必ずテキストと併記される', () => {
    stubFetch({});
    const { container } = render(<LoginPage onSuccess={() => {}} />);
    const icons = [...container.querySelectorAll('svg')];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      // 読み上げはテキスト側が担う。アイコン単独で意味を持たせない
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
      expect(icon.parentElement?.textContent?.trim() ?? '').not.toBe('');
    }
  });

  it('安心3項目を確定コピーどおりにカードの中へ常設する', () => {
    stubFetch({});
    const { container } = render(<LoginPage onSuccess={() => {}} />);
    // 脇のパネルを畳んだ後も、この3項目はカードの中に残っていること
    expect(container.querySelectorAll('.login-card .login-assurances')).toHaveLength(1);
    const labels = [...container.querySelectorAll('.login-assurances .login-assure-label')].map(
      (node) => node.textContent,
    );
    // 「削ってはならない要素」として固定する。件数も名前も緩めない
    expect(labels).toEqual(['セキュリティについて', 'プライバシーについて', 'お客様のデータについて']);
    expect(
      [...container.querySelectorAll('.login-assurances .login-assure-note')].map((node) => node.textContent),
    ).toEqual([
      '全通信を暗号化し、業界標準に基づいて保護します',
      'ログイン情報は認証と保護の用途に限って使用します',
      '通常は外部送信せず、AI分析時だけ明細を含まない集計データを24時間の使い捨て経路で渡します',
    ]);
  });

  it('初期フォーカスをメールアドレス欄に置く', () => {
    stubFetch({});
    render(<LoginPage onSuccess={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText('メールアドレス'));
  });
});

describe('ログインの送信', () => {
  it('ログイン状態の保持は既定ONで、保持期間を併記して送信する', async () => {
    stubFetch({ '/api/auth/login': () => json({ ok: true, user: { mustChangePassword: false } }) });
    const onSuccess = vi.fn();
    render(<LoginPage onSuccess={onSuccess} />);

    const remember = screen.getByLabelText(/次回からもログイン状態を保持する/);
    expect((remember as HTMLInputElement).checked).toBe(true);
    // 既定ONの帰結を隠さない。長さを開示した上で選んでもらう
    expect(screen.getByText('保持する場合は30日間、しない場合は12時間でログイン状態が切れます')).toBeTruthy();

    fillAndSubmit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ mustChangePassword: false }));
    expect(calls[0]?.body).toEqual({
      email: 'owner@example.test',
      password: 'correct-horse-battery',
      remember: true,
    });
  });

  it('保持を外すと remember:false を送る', async () => {
    stubFetch({ '/api/auth/login': () => json({ ok: true, user: { mustChangePassword: false } }) });
    render(<LoginPage onSuccess={() => {}} />);
    fireEvent.click(screen.getByLabelText(/次回からもログイン状態を保持する/));
    fillAndSubmit();
    await waitFor(() => expect(calls[0]?.body).toMatchObject({ remember: false }));
  });

  it('Ctrl + Enter でも送信できる', async () => {
    stubFetch({ '/api/auth/login': () => json({ ok: true, user: { mustChangePassword: false } }) });
    const { container } = render(<LoginPage onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'owner@example.test' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'correct-horse-battery' } });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.keyDown(form as HTMLFormElement, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.path).toBe('/api/auth/login');
  });

  it('成功後は入力欄に平文を残さない', async () => {
    stubFetch({ '/api/auth/login': () => json({ ok: true, user: { mustChangePassword: true } }) });
    const onSuccess = vi.fn();
    render(<LoginPage onSuccess={onSuccess} />);
    fillAndSubmit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ mustChangePassword: true }));
    expect((screen.getByLabelText('パスワード') as HTMLInputElement).value).toBe('');
  });

  it('パスワードの表示・非表示を同じ操作で切り替える', () => {
    stubFetch({});
    render(<LoginPage onSuccess={() => {}} />);
    const password = screen.getByLabelText('パスワード') as HTMLInputElement;

    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: '表示' }));
    expect(password.type).toBe('text');
    expect(screen.getByRole('button', { name: '隠す' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '隠す' }));
    expect(password.type).toBe('password');
  });
});

describe('ログインの失敗', () => {
  it('不在・停止・相違をすべて同じ文面に畳む', async () => {
    // サーバが 401 に畳んだものを、画面が言い直して区別を復活させないこと
    stubFetch({ '/api/auth/login': () => apiError(401, 'invalid_credentials', '認証に失敗しました') });
    render(<LoginPage onSuccess={() => {}} />);
    fillAndSubmit('nobody@example.test');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('メールアドレスまたはパスワードが正しくありません。');
    // 在籍の有無を推測させる語を1つも出さない
    expect(alert.textContent).not.toContain('登録');
    expect(alert.textContent).not.toContain('停止');
    expect(alert.textContent).not.toContain('存在');
  });

  it('試行上限は待ち時間を分で伝える', async () => {
    stubFetch({
      '/api/auth/login': () =>
        apiError(429, 'rate_limited', '試行回数の上限に達しました', { retryAfterSeconds: 610 }),
    });
    render(<LoginPage onSuccess={() => {}} />);
    fillAndSubmit();
    // 610秒 → 切り上げて11分。「もう少し」ではなく待てる長さを示す
    expect((await screen.findByRole('alert')).textContent).toContain('約11分後');
  });

  it('試行上限に待ち時間が無い場合も内部情報を足さない', async () => {
    stubFetch({ '/api/auth/login': () => apiError(429, 'rate_limited', '試行回数の上限に達しました') });
    render(<LoginPage onSuccess={() => {}} />);
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toContain('時間をおいてもう一度お試しください');
  });

  it('認証未設定は管理者への導線として伝える', async () => {
    stubFetch({ '/api/auth/login': () => apiError(503, 'auth_unconfigured', '未設定です') });
    render(<LoginPage onSuccess={() => {}} />);
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toContain('認証が未設定です');
  });

  it('パスワード忘れは自動再発行ではなく管理者発行を案内する', () => {
    stubFetch({});
    render(<LoginPage onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'パスワードをお忘れの方' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('再発行メールを送信しません');
    expect(dialog.textContent).toContain('設定 → 利用者管理');
    // 案内するだけで、ここから再発行を起こさない
    expect(calls).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('予期しない失敗は通信失敗として畳む', async () => {
    stubFetch({ '/api/auth/login': () => apiError(500, 'internal_error', '内部情報') });
    render(<LoginPage onSuccess={() => {}} />);
    fillAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('通信状況を確認してもう一度お試しください');
    expect(alert.textContent).not.toContain('内部情報');
  });
});

describe('パスワードの強制変更', () => {
  it('認証失効イベントだけはApp全体をログイン画面へ戻す', async () => {
    stubFetch({
      '/api/auth/me': () =>
        json({ ...authState('member'), user: { ...authState('member').user!, mustChangePassword: true } }),
    });
    withQuery(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'パスワードの変更' });

    fireEvent(window, new Event(AUTH_EVENT));
    expect(await screen.findByRole('button', { name: 'ログイン' })).toBeTruthy();
  });

  it('現在パスワード相違の401でAppがログイン画面へ戻らない', async () => {
    stubFetch({
      '/api/auth/me': () =>
        json({ ...authState('member'), user: { ...authState('member').user!, mustChangePassword: true } }),
      '/api/auth/password': () => apiError(401, 'invalid_credentials', '現在のパスワードが違います'),
    });
    withQuery(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'パスワードの変更' });
    fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: 'wrong-current-0001' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'new-pass-abcdefg' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), {
      target: { value: 'new-pass-abcdefg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect((await screen.findByRole('alert')).textContent).toContain('現在のパスワードが違います');
    expect(screen.queryByRole('button', { name: 'ログイン' })).toBeNull();
  });

  it('パスワード変更中にセッションが失効した401はApp全体をログイン画面へ戻す', async () => {
    stubFetch({
      '/api/auth/me': () =>
        json({ ...authState('member'), user: { ...authState('member').user!, mustChangePassword: true } }),
      '/api/auth/password': () => apiError(401, 'unauthorized', '認証が必要です'),
    });
    withQuery(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'パスワードの変更' });
    fireEvent.change(screen.getByLabelText('現在のパスワード'), {
      target: { value: 'expired-session-0001' },
    });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'new-pass-abcdefg' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), {
      target: { value: 'new-pass-abcdefg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect(await screen.findByRole('button', { name: 'ログイン' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'パスワードの変更' })).toBeNull();
  });

  it('App内で変更が成功すると認証状態を再照会する', async () => {
    stubFetch({
      '/api/auth/me': () =>
        json({ ...authState('member'), user: { ...authState('member').user!, mustChangePassword: true } }),
      '/api/auth/password': () => json({ ok: true }),
    });
    withQuery(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'パスワードの変更' });
    fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: 'temp-pass-0001' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'new-pass-abcdefg' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), {
      target: { value: 'new-pass-abcdefg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    await waitFor(() =>
      expect(calls.filter((call) => call.path === '/api/auth/me').length).toBeGreaterThanOrEqual(2),
    );
  });

  it('強制のときは逃げ道を出さない', () => {
    stubFetch({});
    render(<PasswordChangePage forced onDone={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('button', { name: '変更せずに戻る' })).toBeNull();
    expect(screen.getByText(/一時パスワードのままではご利用いただけません/)).toBeTruthy();
  });

  it('任意のときだけ戻る導線を出す', () => {
    stubFetch({});
    render(<PasswordChangePage forced={false} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: '変更せずに戻る' })).toBeTruthy();
  });

  it('確認欄の不一致は送信せず手元で止める', () => {
    stubFetch({ '/api/auth/password': () => json({ ok: true }) });
    render(<PasswordChangePage forced onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: 'temp-pass-0001' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'new-pass-abcdefg' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), { target: { value: 'new-pass-abcd' } });

    expect(screen.getByRole('alert').textContent).toContain('確認用のパスワードが一致しません');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
    // 送っても区別できない失敗なので、平文をネットワークへ1回多く出さない
    expect(calls).toHaveLength(0);
  });

  it('一致すれば変更を送り、他端末が切れることを伝える', async () => {
    stubFetch({ '/api/auth/password': () => json({ ok: true }) });
    const onDone = vi.fn();
    render(<PasswordChangePage forced onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: 'temp-pass-0001' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'new-pass-abcdefg' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), {
      target: { value: 'new-pass-abcdefg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls[0]?.body).toEqual({
      currentPassword: 'temp-pass-0001',
      newPassword: 'new-pass-abcdefg',
    });
    expect(screen.getByText(/この端末以外のログイン状態は無効になります/)).toBeTruthy();
  });

  it('サーバの入力エラーを表示し、任意変更の取消を呼び出せる', async () => {
    stubFetch({
      '/api/auth/password': () => apiError(400, 'weak_password', '12文字以上で設定してください'),
    });
    const onCancel = vi.fn();
    render(<PasswordChangePage forced={false} onDone={() => {}} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: 'current-pass-0001' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'short-but-ready' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード(確認)'), {
      target: { value: 'short-but-ready' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect((await screen.findByRole('alert')).textContent).toContain('12文字以上で設定してください');
    fireEvent.click(screen.getByRole('button', { name: '変更せずに戻る' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('利用者管理', () => {
  it('一般利用者には描画せず、管理APIも照会しない', async () => {
    stubFetch({ '/api/auth/me': () => json(authState('member')) });
    const { container } = withQuery(<UserAdmin />);
    await waitFor(() => expect(calls.some((call) => call.path === '/api/auth/me')).toBe(true));
    expect(container.textContent).toBe('');
    // 403 が返るだけの照会を投げない。権限の正本はサーバだが、導線は先に閉じる
    expect(calls.every((call) => !call.path.startsWith('/api/admin/'))).toBe(true);
  });

  it('管理者には利用者一覧と一時パスワードの状態を出す', async () => {
    stubFetch({
      '/api/auth/me': () => json(authState('admin')),
      '/api/admin/users': () =>
        json({
          users: [
            {
              id: 'u1',
              email: 'owner@example.test',
              role: 'admin',
              status: 'active',
              mustChangePassword: false,
              createdAt: '2026-09-01T00:00:00.000Z',
              lastLoginAt: '2026-09-12T09:00:00.000Z',
            },
            {
              id: 'u2',
              email: 'newbie@example.test',
              role: 'member',
              status: 'suspended',
              mustChangePassword: true,
              createdAt: '2026-09-10T00:00:00.000Z',
              lastLoginAt: null,
            },
          ],
        }),
    });
    withQuery(<UserAdmin />);
    expect(await screen.findByText('newbie@example.test')).toBeTruthy();
    expect(screen.getByText('一時パスワード')).toBeTruthy();
    expect(screen.getByText('停止中')).toBeTruthy();
    // 停止中の利用者には再開、有効な利用者には停止を出す
    expect(screen.getByRole('button', { name: '再開する' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止する' })).toBeTruthy();
  });

  it('発行した一時パスワードは1度だけ表示し、閉じると復元できない', async () => {
    const invited = {
      id: 'u2',
      email: 'newbie@example.test',
      role: 'member',
      status: 'active',
      mustChangePassword: true,
      createdAt: '2026-09-13T00:00:00.000Z',
      lastLoginAt: null,
    };
    let created = false;
    stubFetch({
      '/api/auth/me': () => json(authState('admin')),
      'GET /api/admin/users': () => json({ users: created ? [invited] : [] }),
      'POST /api/admin/users': () => {
        created = true;
        return json({ user: invited, temporaryPassword: 'Temp-One-Time-99' }, 201);
      },
    });
    withQuery(<UserAdmin />);
    await screen.findByRole('button', { name: '利用者を追加' });

    // 招待経路と再発行経路は同じ表示部品を使う。ここでは招待で確かめる
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'newbie@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: '利用者を追加' }));

    const panel = await screen.findByRole('alert');
    expect(panel.textContent).toContain('この画面を閉じると二度と表示できません。');
    expect(screen.getByText('Temp-One-Time-99')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '控えたので閉じる' }));
    await waitFor(() => expect(screen.queryByText('Temp-One-Time-99')).toBeNull());
    // 再表示の導線が残っていないこと(残っていれば「1度だけ」が崩れる)
    expect(screen.queryByRole('button', { name: /もう一度表示/ })).toBeNull();
  });

  it('権限変更・停止・再開を同じ更新APIへ最小の差分で送る', async () => {
    const users = [
      {
        id: 'u2',
        email: 'active@example.test',
        role: 'member' as const,
        status: 'active' as const,
        mustChangePassword: false,
        createdAt: '2026-09-10T00:00:00.000Z',
        lastLoginAt: null,
      },
      {
        id: 'u3',
        email: 'paused@example.test',
        role: 'member' as const,
        status: 'suspended' as const,
        mustChangePassword: false,
        createdAt: '2026-09-11T00:00:00.000Z',
        lastLoginAt: null,
      },
    ];
    stubFetch({
      '/api/auth/me': () => json(authState('admin')),
      'GET /api/admin/users': () => json({ users }),
      'PATCH /api/admin/users/u2': () => json({ user: users[0] }),
      'PATCH /api/admin/users/u3': () => json({ user: users[1] }),
    });
    withQuery(<UserAdmin />);
    await screen.findByText('active@example.test');

    fireEvent.change(screen.getByLabelText('active@example.test の権限'), { target: { value: 'admin' } });
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'PATCH' && call.body?.role === 'admin')).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: '停止する' }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'PATCH' && call.body?.status === 'suspended')).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: '再開する' }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'PATCH' && call.body?.status === 'active')).toBe(true),
    );
  });

  it('一時パスワード再発行も招待と同じ一度きりの表示部品を使う', async () => {
    const user = {
      id: 'u2',
      email: 'member@example.test',
      role: 'member' as const,
      status: 'active' as const,
      mustChangePassword: false,
      createdAt: '2026-09-10T00:00:00.000Z',
      lastLoginAt: null,
    };
    stubFetch({
      '/api/auth/me': () => json(authState('admin')),
      'GET /api/admin/users': () => json({ users: [user] }),
      'POST /api/admin/users/u2/password-reset': () => json({ temporaryPassword: 'Reset-One-Time-77' }),
    });
    withQuery(<UserAdmin />);
    await screen.findByText('member@example.test');
    fireEvent.click(screen.getByRole('button', { name: '一時パスワード再発行' }));

    const panel = await screen.findByRole('alert');
    expect(panel.textContent).toContain('一時パスワードを再発行しました');
    expect(panel.textContent).toContain('Reset-One-Time-77');
  });

  it('管理操作の失敗は画面内で復帰可能なエラーとして出す', async () => {
    stubFetch({
      '/api/auth/me': () => json(authState('admin')),
      'GET /api/admin/users': () => json({ users: [] }),
      'POST /api/admin/users': () => apiError(409, 'email_exists', 'このメールアドレスは登録済みです'),
    });
    withQuery(<UserAdmin />);
    await screen.findByRole('button', { name: '利用者を追加' });
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'owner@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: '利用者を追加' }));

    expect((await screen.findByRole('alert')).textContent).toContain('このメールアドレスは登録済みです');
  });
});
