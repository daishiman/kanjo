// @vitest-environment jsdom

/**
 * 認証まわりの画面契約 (login-v2)。正本は specs/spec-login-v2.md の §UI・状態遷移 7.1〜7.18 と §API契約。
 *
 * ここで固定するのは次の4つ。
 *   - 画像 01-login-v2.png の構成要素と §7.2 の文言が、字面どおり・画像の順で出ること
 *   - 6状態 (送信中・認証失敗・ロック中・MFA コード入力・再送受付・再設定受付) と Google の失敗・未設定
 *   - 未認証で入れる経路は /login・/invite/accept・/reset-password・/mfa・/help・/privacy の6つだけ
 *   - 管理者も含め、誰も他人の秘密 (仮パスワード) を持たない。招待と本人の操作だけで認証手段が決まる
 *
 * API は fetch を差し替えて応答を固定する。サーバの挙動ではなく「画面がどの API をどの本文で呼ぶか」と
 * 「応答をどの文言・遷移に変えるか」を見る。
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_EVENT, type AuthState } from './api.js';

// 認証後の業務画面は別の契約テスト (common-shell-routes) が見る。ここでは「認証後の枠に入ったか」だけ分かればよい
vi.mock('./AuthenticatedApp.js', () => ({
  AuthenticatedApp: () => <h1>stub:AuthenticatedApp</h1>,
}));

const { App } = await import('./App.js');
const { UserAdmin } = await import('./components/UserAdmin.js');
const { AccountSettings } = await import('./components/AccountSettings.js');
const { externalNavigation } = await import('./features/auth/external-navigation.js');

interface Call {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  headers: Headers;
}

let calls: Call[] = [];

type Route = (call: Call, init?: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** アプリ独自の経路のエラー本文 (`{error:{code,message}}`) */
const apiError = (status: number, code: string, message = code, extra: object = {}): Response =>
  json({ error: { code, message }, ...extra }, status);

/** Better Auth 組込みの経路のエラー本文 (`{code,message}`) */
const authError = (status: number, code: string, message = code): Response => json({ code, message }, status);

const UNAUTHENTICATED: Record<string, Route> = {
  'GET /api/auth/me': () => apiError(401, 'unauthorized', '認証が必要です'),
  'GET /api/status': () => json({ status: 'normal' }),
};

/**
 * `"<METHOD> <path>"` → 応答。未登録は 404 にして、想定外の照会を沈黙で通さない。
 * 既定は未認証 (me が 401) で、稼働状態は正常。
 */
function stubFetch(routes: Record<string, Route> = {}): void {
  const table = { ...UNAUTHENTICATED, ...routes };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      const call: Call = {
        path,
        method,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        headers: new Headers(init?.headers),
      };
      calls.push(call);
      const route = table[`${method} ${path}`];
      if (!route) return new Response('{}', { status: 404 });
      return route(call, init);
    }),
  );
}

const pending = (): Promise<Response> => new Promise<Response>(() => {});

const authState = (
  role: 'admin' | 'member',
  overrides: Partial<NonNullable<AuthState['user']>> = {},
): AuthState => {
  const providers = overrides.providers ?? ['credential'];
  return {
    authenticated: true,
    user: {
      id: 'u1',
      email: role === 'admin' ? 'owner@example.test' : 'member@example.test',
      role,
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z',
      lastLoginAt: '2026-09-12T09:00:00.000Z',
      twoFactorEnabled: false,
      providers,
      authAccounts: providers.map((providerId) => ({ id: `account-${providerId}`, providerId })),
      ...overrides,
    },
  };
};

/** 現在の URL を DOM から読むための覗き窓。role を持たない要素にして、画面側の role 検索を汚さない */
function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location" hidden>
      {`${location.pathname}${location.search}`}
    </span>
  );
}

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const withQuery = (node: ReactNode, path = '/settings') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        {node}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );

async function openLogin(path = '/login') {
  const view = renderApp(path);
  await screen.findByRole('heading', { level: 1, name: 'ログイン' });
  return view;
}

const emailInput = () => screen.getByLabelText('メールアドレス') as HTMLInputElement;
const passwordInput = () => screen.getByLabelText('パスワード') as HTMLInputElement;
const loginButton = () => screen.getByRole('button', { name: /^(ログイン|確認中…)$/ }) as HTMLButtonElement;

/** 資格情報を埋めて送信ボタンを押す。押下の前後で毎回同じ手順にする */
function fillAndSubmit(email = 'owner@example.test', password = 'correct-horse-battery'): void {
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(passwordInput(), { target: { value: password } });
  fireEvent.click(loginButton());
}

const callsTo = (path: string) => calls.filter((call) => call.path === path);

/** a が b より文書の前にある */
const precedes = (a: Node, b: Node): boolean =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const ACCEPTED = '受け付けました。該当するアカウントがある場合は、数分以内にメールが届きます。';
const NETWORK_FAILED = 'ログインに失敗しました。通信状況を確認してもう一度お試しください';
const GOOGLE_FAILED =
  'Googleでログインできませんでした。招待先と同じメールアドレスのGoogleアカウントか確認してください。パスワードで登録済みの方は、ログイン後に設定画面から連携できます。';
const RELOGIN = 'もう一度ログインしてください。';
const INVITE_UNAVAILABLE =
  'この招待リンクは使えません。テナント管理者に再送を依頼するか、ログイン画面の『招待メールを再送』をご利用ください。';

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('ログイン画面の構成 (§7.1・§7.2)', () => {
  it('§7.2 の文言を字面どおりに出す', async () => {
    stubFetch();
    await openLogin();
    const exact = [
      'Focus Ledger',
      '登録済みの認証方法でログインしてください。',
      '招待先と同じメールアドレスのGoogleアカウントを使用してください。',
      'または',
      'メールアドレスとパスワードでログイン',
      '次回からもログイン状態を保持する',
      '保持する場合は30日間、しない場合は12時間でログイン状態が切れます',
      '招待を受けた方',
      '招待メールのリンクから、Googleアカウントまたはメール＋パスワードを選んで登録を完了してください。',
      '管理者が仮パスワードを設定することはありません。',
      'アカウントはテナント管理者からの招待で作成されます。',
      '同じメールアドレスでGoogleとパスワードを登録した場合は、1つのアカウントとして安全に連携します。',
      '連携時は再認証とメール確認が必要です。',
      '安心してご利用いただくために',
      'セキュリティについて',
      '全通信を暗号化し、MFAと不正ログイン対策で保護します',
      'プライバシーについて',
      'ログイン情報は認証と保護の用途に限って使用します',
      'お客様のデータについて',
      '認証情報とテナント内データを分離して管理します',
    ];
    for (const text of exact) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'ログイン' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Googleでログイン' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'パスワードをお忘れの方' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '招待メールを再送' })).toBeTruthy();
    expect(emailInput().placeholder).toBe('you@example.com');
    // 画像の●はモック。初期は空で placeholder も無い (§7.18)
    expect(passwordInput().value).toBe('');
    expect(passwordInput().getAttribute('placeholder')).toBeNull();
    expect(screen.getByRole('button', { name: '表示' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ヘルプ' }).getAttribute('href')).toBe('/help');
    expect(screen.getByRole('link', { name: 'プライバシー' }).getAttribute('href')).toBe('/privacy');
    await waitFor(() => expect(screen.getByRole('contentinfo').textContent).toContain('サービス状況：正常'));
  });

  it('構成要素を画像の上から下の順に並べ、ロゴだけをカードの外に置く', async () => {
    stubFetch();
    const { container } = await openLogin();
    const card = container.querySelector('.login-card');
    expect(card).not.toBeNull();
    const logo = screen.getByText('Focus Ledger');
    expect(card?.contains(logo)).toBe(false);
    expect(precedes(logo, card as Node)).toBe(true);

    const order = [
      screen.getByRole('heading', { level: 1, name: 'ログイン' }),
      screen.getByText('登録済みの認証方法でログインしてください。'),
      screen.getByRole('button', { name: 'Googleでログイン' }),
      screen.getByText('招待先と同じメールアドレスのGoogleアカウントを使用してください。'),
      screen.getByText('または'),
      screen.getByText('メールアドレスとパスワードでログイン'),
      emailInput(),
      passwordInput(),
      screen.getByLabelText('次回からもログイン状態を保持する'),
      screen.getByRole('button', { name: 'ログイン' }),
      screen.getByRole('button', { name: 'パスワードをお忘れの方' }),
      screen.getByText('招待を受けた方'),
      screen.getByRole('button', { name: '招待メールを再送' }),
      screen.getByText('アカウントはテナント管理者からの招待で作成されます。'),
      screen.getByText(
        '同じメールアドレスでGoogleとパスワードを登録した場合は、1つのアカウントとして安全に連携します。',
      ),
      screen.getByText('安心してご利用いただくために'),
      screen.getByRole('contentinfo'),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(precedes(order[i - 1] as Node, order[i] as Node), `${i - 1} → ${i}`).toBe(true);
    }
    // 連携の1文は太字 (画像)。見出しにはしない
    expect(
      screen.getByText(
        '同じメールアドレスでGoogleとパスワードを登録した場合は、1つのアカウントとして安全に連携します。',
      ).tagName,
    ).toBe('STRONG');
  });

  it('アプリの枠を持たず、認証前に叩くのは me と稼働状態だけ', async () => {
    stubFetch();
    const { container } = await openLogin();
    await waitFor(() => expect(callsTo('/api/status')).toHaveLength(1));
    expect(container.querySelectorAll('header, nav, aside')).toHaveLength(0);
    expect(container.querySelectorAll('.sidebar, .app-shell, .page-header')).toHaveLength(0);
    // フッターはログインのカードの型の一部 (§7.1 の 10)。アプリ枠のフッターではない
    expect(container.querySelectorAll('footer')).toHaveLength(1);
    expect(container.querySelector('footer')?.classList.contains('login-footer')).toBe(true);
    expect([...new Set(calls.map((call) => call.path))].sort()).toEqual(['/api/auth/me', '/api/status']);
  });

  it('入口は Google とパスワードの2つだけで、旧来の導線を持たない', async () => {
    stubFetch();
    const { container } = await openLogin();
    const actions = [...container.querySelectorAll('button, a')].map((node) => node.textContent ?? '');
    expect(actions.filter((text) => /Access|Cloudflare|SSO|シングルサインオン|サポート/.test(text))).toEqual(
      [],
    );
    expect(container.textContent).not.toMatch(/一時パスワード|管理者に連絡/);
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('Google ボタンは白地・枠線の型で、ブランド規定の多色の G を持つ', async () => {
    stubFetch();
    await openLogin();
    const google = screen.getByRole('button', { name: 'Googleでログイン' });
    expect(google.className).toContain('login-google');
    expect(google.className).not.toContain('primary');
    const brandMark = google.querySelector<HTMLImageElement>('.login-google-mark');
    expect(brandMark?.getAttribute('src')).toBe('/google-g.svg');
    expect(brandMark?.getAttribute('alt')).toBe('');
  });

  it('すべてのアイコンが装飾扱いで、必ずテキストと併記される', async () => {
    stubFetch();
    const { container } = await openLogin();
    const icons = [...container.querySelectorAll('svg')];
    // ロゴ・目・メール・鎖・安心3つ・フッター3つ。Google Gは公式配色の静的画像。
    expect(icons.length).toBeGreaterThanOrEqual(10);
    for (const icon of icons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.parentElement?.textContent?.trim() ?? '').not.toBe('');
    }
  });

  it('入力欄の属性は §7.4 のとおり', async () => {
    stubFetch();
    await openLogin();
    const email = emailInput();
    expect(email.type).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(email.required).toBe(true);
    expect(passwordInput().type).toBe('password');
    expect(passwordInput().getAttribute('autocomplete')).toBe('current-password');
    // 保持は既定でチェックあり (見落としても 12 時間へ意図せず落ちない。§7.18)
    expect((screen.getByLabelText('次回からもログイン状態を保持する') as HTMLInputElement).checked).toBe(
      true,
    );
    // 説明は画像どおり別の行。チェックの読み上げ名には混ぜず、説明として結び付ける
    const remember = screen.getByLabelText('次回からもログイン状態を保持する');
    const describedBy = remember.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(
      '保持する場合は30日間、しない場合は12時間でログイン状態が切れます',
    );
  });

  it('初期フォーカスをメールアドレス欄に置く', async () => {
    stubFetch();
    await openLogin();
    expect(document.activeElement).toBe(emailInput());
  });

  it('パスワードの表示・非表示を同じ操作で切り替える', async () => {
    stubFetch();
    await openLogin();
    const toggle = screen.getByRole('button', { name: '表示' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(passwordInput(), { target: { value: 'secret-value' } });
    fireEvent.click(toggle);
    expect(passwordInput().type).toBe('text');
    expect(passwordInput().value).toBe('secret-value');
    const hide = screen.getByRole('button', { name: '隠す' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hide);
    expect(passwordInput().type).toBe('password');
  });
});

describe('サービス状況 (§7.8)', () => {
  const footer = () => screen.getByRole('contentinfo');
  const statusValue = () => footer().querySelector('[data-service-state]');

  it('normal は「正常」を成功色で出す', async () => {
    stubFetch();
    await openLogin();
    await waitFor(() => expect(statusValue()?.textContent).toBe('正常'));
    expect(statusValue()?.getAttribute('data-service-state')).toBe('normal');
  });

  it('degraded は「一部不調」を警告色で出す', async () => {
    stubFetch({ 'GET /api/status': () => json({ status: 'degraded' }) });
    await openLogin();
    await waitFor(() => expect(statusValue()?.textContent).toBe('一部不調'));
    expect(statusValue()?.getAttribute('data-service-state')).toBe('degraded');
  });

  it.each([
    ['500', () => json({ error: { code: 'internal' } }, 500)],
    ['429', () => apiError(429, 'rate_limited')],
    ['通信失敗', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['想定外の値', () => json({ status: 'maintenance' })],
  ])('%s は「確認できません」を中立色で出す', async (_label, route) => {
    stubFetch({ 'GET /api/status': route as Route });
    await openLogin();
    await waitFor(() => expect(statusValue()?.textContent).toBe('確認できません'));
    expect(statusValue()?.getAttribute('data-service-state')).toBe('unknown');
  });

  it('取得中は「サービス状況：」の後ろを空にし、5秒で打ち切って「確認できません」にする', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubFetch({
      'GET /api/status': (_call, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    });
    await openLogin();
    expect(footer().textContent).toContain('サービス状況：');
    expect(statusValue()?.textContent).toBe('');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await waitFor(() => expect(statusValue()?.textContent).toBe('確認できません'));
  });
});

describe('パスワードでのログイン (§7.4・§7.15)', () => {
  it('メールアドレスを正規化し、保持の指定と一緒に sign-in/email へ送る', async () => {
    stubFetch({ 'POST /api/auth/sign-in/email': pending });
    await openLogin();
    fillAndSubmit('  Owner@Example.TEST ', 'correct-horse-battery');
    await waitFor(() => expect(callsTo('/api/auth/sign-in/email')).toHaveLength(1));
    expect(callsTo('/api/auth/sign-in/email')[0]?.body).toEqual({
      email: 'owner@example.test',
      password: 'correct-horse-battery',
      rememberMe: true,
    });
    // 旧経路は1本も呼ばない
    expect(calls.some((call) => call.path === '/api/auth/login')).toBe(false);
  });

  it('保持を外すと rememberMe:false を送る', async () => {
    stubFetch({ 'POST /api/auth/sign-in/email': pending });
    await openLogin();
    fireEvent.click(screen.getByLabelText('次回からもログイン状態を保持する'));
    fillAndSubmit();
    await waitFor(() =>
      expect(callsTo('/api/auth/sign-in/email')[0]?.body).toMatchObject({ rememberMe: false }),
    );
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['⌘', { metaKey: true }],
  ])('%s + Enter でも送信できる', async (_label, modifier) => {
    stubFetch({ 'POST /api/auth/sign-in/email': pending });
    await openLogin();
    fireEvent.change(emailInput(), { target: { value: 'owner@example.test' } });
    fireEvent.change(passwordInput(), { target: { value: 'correct-horse-battery' } });
    fireEvent.keyDown(passwordInput(), { key: 'Enter', ...modifier });
    await waitFor(() => expect(callsTo('/api/auth/sign-in/email')).toHaveLength(1));
  });

  it('送信中: 主ボタンを「確認中…」で無効化し、入力欄を読み取り専用にする', async () => {
    stubFetch({ 'POST /api/auth/sign-in/email': pending });
    await openLogin();
    fillAndSubmit();
    await waitFor(() => expect(loginButton().textContent).toBe('確認中…'));
    expect(loginButton().disabled).toBe(true);
    expect(emailInput().readOnly).toBe(true);
    expect(passwordInput().readOnly).toBe(true);
    // 認証開始中は別の認証や保持設定を重ねて変えられない
    expect((screen.getByRole('button', { name: 'Googleでログイン' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('次回からもログイン状態を保持する') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'パスワードをお忘れの方' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    // 二重送信しない
    fireEvent.click(loginButton());
    expect(callsTo('/api/auth/sign-in/email')).toHaveLength(1);
  });

  it('空送信は必要な入力を明示し、API を呼ばない', async () => {
    stubFetch();
    await openLogin();
    fireEvent.click(loginButton());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'メールアドレスとパスワードを入力してください。',
    );
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(emailInput());
    expect(callsTo('/api/auth/sign-in/email')).toHaveLength(0);
  });

  it('成功したら認証状態を取り直し、next の画面へ移る', async () => {
    let signedIn = false;
    stubFetch({
      'GET /api/auth/me': () =>
        signedIn ? json(authState('member')) : apiError(401, 'unauthorized', '認証が必要です'),
      'POST /api/auth/sign-in/email': () => {
        signedIn = true;
        return json({
          redirect: false,
          token: 't',
          user: { id: 'u1', email: 'owner@example.test', role: 'member' },
        });
      },
    });
    await openLogin('/login?next=%2Fbudget%3Fmonth%3D2026-09');
    fillAndSubmit();
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    expect(currentLocation()).toBe('/budget?month=2026-09');
    expect(callsTo('/api/auth/me').length).toBeGreaterThanOrEqual(2);
    // 平文を画面に残さない
    expect(document.body.textContent).not.toContain('correct-horse-battery');
  });

  it('同じオリジンの相対パスでない next は / に置き換える (BR-12)', async () => {
    let signedIn = false;
    stubFetch({
      'GET /api/auth/me': () =>
        signedIn ? json(authState('member')) : apiError(401, 'unauthorized', '認証が必要です'),
      'POST /api/auth/sign-in/email': () => {
        signedIn = true;
        return json({ redirect: false, token: 't', user: { id: 'u1' } });
      },
    });
    await openLogin('/login?next=%2F%2Fevil.example%2Fsteal');
    fillAndSubmit();
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    expect(currentLocation()).toBe('/');
  });

  it('認証失敗: 不在・停止・相違を同じ文言で知らせ、パスワード欄を空にしてフォーカスを移す', async () => {
    stubFetch({
      'POST /api/auth/sign-in/email': () =>
        apiError(401, 'invalid_credentials', 'メールアドレスまたはパスワードが正しくありません'),
    });
    await openLogin();
    const unauthorized = vi.fn();
    window.addEventListener(AUTH_EVENT, unauthorized);
    fillAndSubmit('nobody@example.test');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('メールアドレスまたはパスワードが正しくありません。');
    expect(passwordInput().value).toBe('');
    expect(document.activeElement).toBe(passwordInput());
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput().getAttribute('aria-invalid')).toBe('true');
    // 入力の誤りは「セッションが切れた」通知ではない
    expect(unauthorized).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EVENT, unauthorized);
    // 失敗の文言はフォームの上に出す
    expect(precedes(alert, emailInput())).toBe(true);
  });

  it('Better Auth 形式の 401 本文でも同じ文言に畳む', async () => {
    stubFetch({
      'POST /api/auth/sign-in/email': () =>
        authError(401, 'INVALID_EMAIL_OR_PASSWORD', 'Invalid email or password'),
    });
    await openLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'メールアドレスまたはパスワードが正しくありません。',
    );
  });

  it('ロック中: 待ち時間を分に切り上げて伝え、その間は主ボタンを無効にする', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubFetch({
      'POST /api/auth/sign-in/email': () =>
        apiError(429, 'login_rate_limited', 'too many', { retryAfterSeconds: 125 }),
    });
    await openLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      '試行回数の上限に達しました。約3分後にもう一度お試しください',
    );
    fireEvent.change(passwordInput(), { target: { value: 'another-password' } });
    expect(loginButton().disabled).toBe(true);
    // Ctrl + Enter の抜け道でも送らない
    fireEvent.keyDown(passwordInput(), { key: 'Enter', ctrlKey: true });
    expect(callsTo('/api/auth/sign-in/email')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(125_000);
    });
    await waitFor(() => expect(loginButton().disabled).toBe(false));
  });

  it('認証が未設定: 503 を管理者への導線として伝える', async () => {
    stubFetch({ 'POST /api/auth/sign-in/email': () => apiError(503, 'auth_not_configured') });
    await openLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      '認証が未設定です。管理者にお問い合わせください',
    );
    // サーバ設定の問題は、利用者の資格情報の誤りではない
    expect(emailInput().getAttribute('aria-invalid')).toBeNull();
    expect(passwordInput().getAttribute('aria-invalid')).toBeNull();
  });

  it.each([
    ['400', () => apiError(400, 'invalid_request')],
    ['413', () => apiError(413, 'payload_too_large')],
    ['通信失敗', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s は通信失敗の文言に畳む', async (_label, route) => {
    stubFetch({ 'POST /api/auth/sign-in/email': route as Route });
    await openLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe(NETWORK_FAILED);
  });
});

describe('Google でのログイン (§7.3)', () => {
  it('Google の認可開始中を文言で示し、他の認証操作を無効にする', async () => {
    stubFetch({ 'POST /api/auth/sign-in/social': pending });
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Googleでログイン' }));
    const google = await screen.findByRole('button', { name: 'Googleへ移動中…' });
    expect((google as HTMLButtonElement).disabled).toBe(true);
    expect(google.getAttribute('aria-busy')).toBe('true');
    expect(loginButton().disabled).toBe(true);
    expect(emailInput().readOnly).toBe(true);
    expect(passwordInput().readOnly).toBe(true);
    expect((screen.getByLabelText('次回からもログイン状態を保持する') as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.click(loginButton());
    expect(callsTo('/api/auth/sign-in/email')).toHaveLength(0);
  });

  it('next を callbackURL にして sign-in/social を呼び、返った url へ移る', async () => {
    const assign = vi.spyOn(externalNavigation, 'assign').mockImplementation(() => {});
    stubFetch({
      'POST /api/auth/sign-in/social': () =>
        json({ url: 'https://accounts.google.com/o/oauth2/auth?x=1', redirect: true }),
    });
    await openLogin('/login?next=%2Fbudget');
    fireEvent.click(screen.getByRole('button', { name: 'Googleでログイン' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/auth?x=1'));
    expect(callsTo('/api/auth/sign-in/social')[0]?.body).toEqual({
      provider: 'google',
      callbackURL: '/budget',
      errorCallbackURL: '/login?error=google',
    });
    // 二重押し防止
    expect((screen.getByRole('button', { name: 'Googleへ移動中…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('保持を外すと remember=0 を付けて認可を始める', async () => {
    vi.spyOn(externalNavigation, 'assign').mockImplementation(() => {});
    stubFetch({
      'POST /api/auth/sign-in/social?remember=0': () =>
        json({ url: 'https://accounts.google.com/', redirect: true }),
    });
    await openLogin('/login?next=https%3A%2F%2Fevil.example');
    fireEvent.click(screen.getByLabelText('次回からもログイン状態を保持する'));
    fireEvent.click(screen.getByRole('button', { name: 'Googleでログイン' }));
    await waitFor(() => expect(callsTo('/api/auth/sign-in/social?remember=0')).toHaveLength(1));
    expect(callsTo('/api/auth/sign-in/social?remember=0')[0]?.body).toMatchObject({ callbackURL: '/' });
  });

  it('Google の失敗: ?error= で開いたら alert を出し、URL から error だけを消す', async () => {
    stubFetch();
    await openLogin('/login?next=%2Fbudget&error=google');
    expect((await screen.findByRole('alert')).textContent).toBe(GOOGLE_FAILED);
    await waitFor(() => expect(currentLocation()).toBe('/login?next=%2Fbudget'));
  });
});

describe('再送・再設定のダイアログ (§7.9)', () => {
  it('再設定: ログイン欄のメールを引き継ぎ、受付を role=status で出して続けて送らせない', async () => {
    stubFetch({ 'POST /api/auth/password-reset/request': () => json({ ok: true }, 202) });
    await openLogin();
    fireEvent.change(emailInput(), { target: { value: 'Owner@Example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードをお忘れの方' }));
    const dialog = await screen.findByRole('dialog', { name: 'パスワードの再設定' });
    const email = within(dialog).getByLabelText('メールアドレス') as HTMLInputElement;
    expect(email.value).toBe('Owner@Example.test');
    fireEvent.click(within(dialog).getByRole('button', { name: '再設定メールを送信' }));
    expect((await within(dialog).findByRole('status')).textContent).toBe(ACCEPTED);
    expect(callsTo('/api/auth/password-reset/request')[0]?.body).toEqual({ email: 'owner@example.test' });
    expect(
      (within(dialog).getByRole('button', { name: '再設定メールを送信' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('再送: 同じ部品で invite/resend-request を呼ぶ', async () => {
    stubFetch({ 'POST /api/auth/invite/resend-request': () => json({ ok: true }, 202) });
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: '招待メールを再送' }));
    const dialog = await screen.findByRole('dialog', { name: '招待メールを再送' });
    fireEvent.change(within(dialog).getByLabelText('メールアドレス'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '送信' }));
    expect((await within(dialog).findByRole('status')).textContent).toBe(ACCEPTED);
    expect(callsTo('/api/auth/invite/resend-request')[0]?.body).toEqual({ email: 'new@example.test' });
  });

  it('429 でも受付の文言にし、ロックの有無から宛先を推測させない', async () => {
    stubFetch({ 'POST /api/auth/invite/resend-request': () => apiError(429, 'login_rate_limited') });
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: '招待メールを再送' }));
    const dialog = await screen.findByRole('dialog', { name: '招待メールを再送' });
    fireEvent.change(within(dialog).getByLabelText('メールアドレス'), {
      target: { value: 'a@example.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '送信' }));
    expect((await within(dialog).findByRole('status')).textContent).toBe(ACCEPTED);
  });

  it('ネットワークの失敗だけは通信失敗の文言にし、送り直せる', async () => {
    stubFetch({
      'POST /api/auth/password-reset/request': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: 'パスワードをお忘れの方' }));
    const dialog = await screen.findByRole('dialog', { name: 'パスワードの再設定' });
    fireEvent.change(within(dialog).getByLabelText('メールアドレス'), {
      target: { value: 'a@example.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '再設定メールを送信' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(NETWORK_FAILED);
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(
      (within(dialog).getByRole('button', { name: '再設定メールを送信' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('Esc で閉じ、開いたボタンへフォーカスを戻す。Tab はダイアログの中で巡回する', async () => {
    stubFetch();
    await openLogin();
    const trigger = screen.getByRole('button', { name: '招待メールを再送' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '招待メールを再送' });
    const email = within(dialog).getByLabelText('メールアドレス');
    expect(document.activeElement).toBe(email);
    const close = within(dialog).getByRole('button', { name: '閉じる' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(close);
    email.focus();
    fireEvent.keyDown(email, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('閉じてから開き直せば、また送れる', async () => {
    stubFetch({ 'POST /api/auth/invite/resend-request': () => json({ ok: true }, 202) });
    await openLogin();
    fireEvent.click(screen.getByRole('button', { name: '招待メールを再送' }));
    let dialog = await screen.findByRole('dialog', { name: '招待メールを再送' });
    fireEvent.change(within(dialog).getByLabelText('メールアドレス'), {
      target: { value: 'a@example.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '送信' }));
    await within(dialog).findByRole('status');
    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }));
    fireEvent.click(screen.getByRole('button', { name: '招待メールを再送' }));
    dialog = await screen.findByRole('dialog', { name: '招待メールを再送' });
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect((within(dialog).getByRole('button', { name: '送信' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('MFA コード入力 (§7.10)', () => {
  async function reachMfa(routes: Record<string, Route>, path = '/login?next=%2Fcash') {
    stubFetch({ 'POST /api/auth/sign-in/email': () => json({ twoFactorRedirect: true }), ...routes });
    await openLogin(path);
    fillAndSubmit();
    await screen.findByRole('heading', { level: 1, name: '2段階認証' });
  }

  it('twoFactorRedirect で /mfa のコード入力へ移る', async () => {
    await reachMfa({});
    expect(currentLocation()).toBe('/mfa');
    expect(screen.getByText('認証アプリに表示されている6桁のコードを入力してください。')).toBeTruthy();
    const code = screen.getByLabelText('確認コード') as HTMLInputElement;
    expect(code.getAttribute('inputmode')).toBe('numeric');
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('pattern')).toBe('[0-9]{6}');
    expect(screen.getByRole('button', { name: '復旧コードを使う' })).toBeTruthy();
  });

  it('正しいコードで認証状態を取り直し、ログイン前の next へ移る', async () => {
    let verified = false;
    await reachMfa({
      'GET /api/auth/me': () =>
        verified ? json(authState('member')) : apiError(401, 'unauthorized', '認証が必要です'),
      'POST /api/auth/two-factor/verify-totp': () => {
        verified = true;
        return json({ token: 't', user: { id: 'u1' } });
      },
    });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    expect(callsTo('/api/auth/two-factor/verify-totp')[0]?.body).toEqual({ code: '123456' });
    expect(currentLocation()).toBe('/cash');
  });

  it('誤ったコードは同じ画面で「コードが正しくありません。」', async () => {
    await reachMfa({
      'POST /api/auth/two-factor/verify-totp': () => authError(401, 'INVALID_CODE', 'Invalid code'),
    });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    expect((await screen.findByRole('alert')).textContent).toBe('コードが正しくありません。');
    expect(currentLocation()).toBe('/mfa');
  });

  it('2FA の一時 Cookie が切れたら時間切れを伝えて /login へ戻す', async () => {
    await reachMfa({
      'POST /api/auth/two-factor/verify-totp': () =>
        authError(401, 'INVALID_TWO_FACTOR_COOKIE', 'Invalid two factor cookie'),
    });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await screen.findByRole('heading', { level: 1, name: 'ログイン' });
    expect(screen.getByRole('alert').textContent).toBe('時間切れです。もう一度ログインしてください。');
    expect(currentLocation()).toMatch(/^\/login/);
  });

  it('ロックはログインと同じ文言', async () => {
    await reachMfa({
      'POST /api/auth/two-factor/verify-totp': () =>
        apiError(429, 'login_rate_limited', 'locked', { retryAfterSeconds: 900 }),
    });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      '試行回数の上限に達しました。約15分後にもう一度お試しください',
    );
  });

  it('「復旧コードを使う」で復旧コードの入力に切り替え、verify-backup-code を呼ぶ', async () => {
    await reachMfa({ 'POST /api/auth/two-factor/verify-backup-code': pending });
    fireEvent.click(screen.getByRole('button', { name: '復旧コードを使う' }));
    const backup = screen.getByLabelText('復旧コード') as HTMLInputElement;
    expect(backup.getAttribute('autocomplete')).toBe('one-time-code');
    fireEvent.change(backup, { target: { value: 'abcde-fghij' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() =>
      expect(callsTo('/api/auth/two-factor/verify-backup-code')[0]?.body).toEqual({ code: 'abcde-fghij' }),
    );
    expect(screen.getByRole('button', { name: '認証アプリのコードを使う' })).toBeTruthy();
  });

  it('ログインを経ずに /mfa を開いたら、もう一度ログインするよう伝えて /login へ戻す', async () => {
    stubFetch();
    renderApp('/mfa');
    await screen.findByRole('heading', { level: 1, name: 'ログイン' });
    expect(screen.getByRole('alert').textContent).toBe(RELOGIN);
    expect(currentLocation()).toMatch(/^\/login/);
  });
});

describe('MFA の設定 (§7.10・decision-005/-006)', () => {
  const SETUP = {
    mfaSetupRequired: true,
    setupToken: 'setup-token-value',
    expiresAt: '2999-01-01T00:00:00.000Z',
  };
  const START = {
    totpURI:
      'otpauth://totp/Focus%20Ledger:owner%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Focus%20Ledger',
    secret: 'JBSWY3DPEHPK3PXP',
  };
  const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `code-${String(i).padStart(2, '0')}`);

  async function reachSetup(routes: Record<string, Route>, sign: Route = () => json(SETUP)) {
    stubFetch({
      'POST /api/auth/sign-in/email': sign,
      'POST /api/auth/mfa-setup/start': () => json(START),
      ...routes,
    });
    await openLogin('/login?next=%2Fimport');
    fillAndSubmit();
  }

  it('設定トークンで start を呼び、QR と手入力用の秘密鍵を出す', async () => {
    await reachSetup({});
    await screen.findByRole('heading', { level: 1, name: '2段階認証の設定' });
    expect(currentLocation()).toBe('/mfa');
    expect(screen.getByText('管理者は、2段階認証の設定を終えるまでログインできません。')).toBeTruthy();
    await waitFor(() => expect(callsTo('/api/auth/mfa-setup/start')).toHaveLength(1));
    expect(callsTo('/api/auth/mfa-setup/start')[0]?.body).toEqual({ setupToken: 'setup-token-value' });
    const qr = await screen.findByRole('img', { name: '認証アプリで読み取るQRコード' });
    expect(qr.querySelectorAll('path, rect').length).toBeGreaterThan(0);
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
  });

  it('設定トークンを URL・storage・履歴の state に置かない', async () => {
    await reachSetup({});
    await screen.findByRole('heading', { level: 1, name: '2段階認証の設定' });
    expect(currentLocation()).not.toContain('setup-token-value');
    expect(JSON.stringify({ ...localStorage })).not.toContain('setup-token-value');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('setup-token-value');
    expect(JSON.stringify(window.history.state ?? null)).not.toContain('setup-token-value');
  });

  it('初回コードで complete を呼び、復旧コード10個を「保存しました」まで出し続ける', async () => {
    let completed = false;
    await reachSetup({
      'GET /api/auth/me': () =>
        completed ? json(authState('admin', { twoFactorEnabled: true })) : apiError(401, 'unauthorized'),
      'POST /api/auth/mfa-setup/complete': () => {
        completed = true;
        return json({ backupCodes: BACKUP_CODES });
      },
    });
    await screen.findByRole('img', { name: '認証アプリで読み取るQRコード' });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: '設定を完了' }));
    const list = await screen.findByRole('list', { name: '復旧コード' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(BACKUP_CODES);
    // 保持はサーバがトークンの行に持つ (design-decisions 3.3)。web からは送り直さない
    expect(callsTo('/api/auth/mfa-setup/complete')[0]?.body).toEqual({
      setupToken: 'setup-token-value',
      code: '654321',
    });
    // 保存を確かめるまで先へ進ませない
    expect(currentLocation()).toBe('/mfa');
    expect(screen.queryByRole('heading', { name: 'stub:AuthenticatedApp' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存しました' }));
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    expect(currentLocation()).toBe('/import');
  });

  it('誤った初回コードはトークンを保ったまま「コードが正しくありません。」', async () => {
    await reachSetup({ 'POST /api/auth/mfa-setup/complete': () => apiError(401, 'mfa_code_invalid') });
    await screen.findByRole('img', { name: '認証アプリで読み取るQRコード' });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: '設定を完了' }));
    expect((await screen.findByRole('alert')).textContent).toBe('コードが正しくありません。');
    expect(currentLocation()).toBe('/mfa');
  });

  it('start 前の complete (409) は start からやり直す', async () => {
    let first = true;
    await reachSetup({
      'POST /api/auth/mfa-setup/complete': () => {
        if (first) {
          first = false;
          return apiError(409, 'mfa_setup_not_started');
        }
        return pending();
      },
    });
    await screen.findByRole('img', { name: '認証アプリで読み取るQRコード' });
    fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: '設定を完了' }));
    await waitFor(() => expect(callsTo('/api/auth/mfa-setup/start')).toHaveLength(2));
  });

  it.each([
    ['start', { 'POST /api/auth/mfa-setup/start': () => apiError(401, 'mfa_setup_token_invalid') }],
    ['complete', { 'POST /api/auth/mfa-setup/complete': () => apiError(401, 'mfa_setup_token_invalid') }],
  ])('%s が設定トークンを拒んだら、もう一度ログインするよう伝えて /login へ戻す', async (step, routes) => {
    await reachSetup(routes as Record<string, Route>);
    if (step === 'complete') {
      await screen.findByRole('img', { name: '認証アプリで読み取るQRコード' });
      fireEvent.change(screen.getByLabelText('確認コード'), { target: { value: '111111' } });
      fireEvent.click(screen.getByRole('button', { name: '設定を完了' }));
    }
    // 送信直後はまだ元のログイン画面が出ている。見出しではなく、戻った印の文言が出るのを待つ
    expect((await screen.findByRole('alert')).textContent).toBe(RELOGIN);
    expect(screen.getByRole('heading', { level: 1, name: 'ログイン' })).toBeTruthy();
    expect(callsTo('/api/auth/mfa-setup/start').length).toBeGreaterThan(0);
  });

  it('設定トークンの期限 (10分) を過ぎたら /login へ戻す', async () => {
    await reachSetup({}, () => json({ ...SETUP, expiresAt: '2000-01-01T00:00:00.000Z' }));
    // 送信直後はまだ元のログイン画面が出ている。見出しではなく、戻った印の文言が出るのを待つ
    expect((await screen.findByRole('alert')).textContent).toBe(RELOGIN);
    expect(screen.getByRole('heading', { level: 1, name: 'ログイン' })).toBeTruthy();
    // 期限切れのトークンでは start を呼ばない
    expect(callsTo('/api/auth/mfa-setup/start')).toEqual([]);
  });
});

describe('招待の承諾 (/invite/accept・§7.11)', () => {
  const INSPECT = { email: 'invitee@example.test', role: 'member', expiresAt: '2999-01-01T00:00:00.000Z' };

  async function openInvite(routes: Record<string, Route> = {}, path = '/invite/accept?token=invite-token') {
    stubFetch({ 'POST /api/auth/invite/inspect': () => json(INSPECT), ...routes });
    renderApp(path);
    await screen.findByRole('heading', { level: 1, name: '招待の承諾' });
  }

  it('token を本文で inspect に送り、URL から消して、招待のメールと役割を出す', async () => {
    await openInvite();
    await screen.findByText('invitee@example.test');
    expect(callsTo('/api/auth/invite/inspect')[0]?.body).toEqual({ token: 'invite-token' });
    expect(screen.getByText('一般')).toBeTruthy();
    await waitFor(() => expect(currentLocation()).toBe('/invite/accept'));
    expect(screen.getByRole('button', { name: 'Googleで登録' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'メールアドレスとパスワードで登録' })).toBeTruthy();
  });

  it('使えない招待は1種類の文言にする', async () => {
    await openInvite({ 'POST /api/auth/invite/inspect': () => apiError(404, 'invitation_unavailable') });
    expect((await screen.findByRole('alert')).textContent).toBe(INVITE_UNAVAILABLE);
  });

  it('token の無い URL も同じ文言で、API を呼ばない', async () => {
    await openInvite({}, '/invite/accept');
    expect((await screen.findByRole('alert')).textContent).toBe(INVITE_UNAVAILABLE);
    expect(callsTo('/api/auth/invite/inspect')).toHaveLength(0);
  });

  it('パスワードで登録: 一般は /login?email= へ移り、メール欄に入れておく', async () => {
    await openInvite({
      'POST /api/auth/invite/accept': () => json({ next: 'login', email: 'invitee@example.test' }),
    });
    await screen.findByText('invitee@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスとパスワードで登録' }));
    const password = screen.getByLabelText('新しいパスワード') as HTMLInputElement;
    const confirm = screen.getByLabelText('新しいパスワード（確認）') as HTMLInputElement;
    expect(password.getAttribute('autocomplete')).toBe('new-password');
    expect(confirm.getAttribute('autocomplete')).toBe('new-password');
    fireEvent.change(password, { target: { value: 'a-strong-passphrase' } });
    fireEvent.change(confirm, { target: { value: 'a-strong-passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await screen.findByRole('heading', { level: 1, name: 'ログイン' });
    expect(callsTo('/api/auth/invite/accept')[0]?.body).toEqual({
      token: 'invite-token',
      password: 'a-strong-passphrase',
    });
    expect(currentLocation()).toBe('/login?email=invitee%40example.test');
    expect(emailInput().value).toBe('invitee@example.test');
  });

  it('パスワードで登録: 管理者は設定トークンで /mfa の設定へ移る', async () => {
    await openInvite({
      'POST /api/auth/invite/inspect': () => json({ ...INSPECT, role: 'admin' }),
      'POST /api/auth/invite/accept': () =>
        json({ next: 'mfa_setup', setupToken: 'invite-setup', expiresAt: '2999-01-01T00:00:00.000Z' }),
      'POST /api/auth/mfa-setup/start': () => json({ totpURI: 'otpauth://totp/x?secret=ABC', secret: 'ABC' }),
    });
    await screen.findByText('invitee@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスとパスワードで登録' }));
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'a-strong-passphrase' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), {
      target: { value: 'a-strong-passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await screen.findByRole('heading', { level: 1, name: '2段階認証の設定' });
    await waitFor(() =>
      expect(callsTo('/api/auth/mfa-setup/start')[0]?.body).toEqual({ setupToken: 'invite-setup' }),
    );
  });

  it('確認欄が一致しなければ送らない', async () => {
    await openInvite();
    await screen.findByText('invitee@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスとパスワードで登録' }));
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'a-strong-passphrase' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: 'different' } });
    expect(screen.getByRole('alert').textContent).toBe('確認用のパスワードが一致しません');
    expect((screen.getByRole('button', { name: '登録する' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    [
      '409 user_exists',
      () => apiError(409, 'user_exists'),
      'このメールアドレスは登録済みです。ログインしてください。',
    ],
    ['404', () => apiError(404, 'invitation_unavailable'), INVITE_UNAVAILABLE],
    [
      '400 weak_password',
      () => apiError(400, 'weak_password', 'パスワードは12文字以上にしてください'),
      'パスワードは12文字以上にしてください',
    ],
  ])('承諾の失敗 %s', async (_label, route, message) => {
    await openInvite({ 'POST /api/auth/invite/accept': route as Route });
    await screen.findByText('invitee@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスとパスワードで登録' }));
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'a-strong-passphrase' } });
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), {
      target: { value: 'a-strong-passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('Googleで登録: requestSignUp を付けて認可を始める', async () => {
    const assign = vi.spyOn(externalNavigation, 'assign').mockImplementation(() => {});
    await openInvite({
      'POST /api/auth/sign-in/social': () => json({ url: 'https://accounts.google.com/', redirect: true }),
    });
    await screen.findByText('invitee@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Googleで登録' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/'));
    expect(callsTo('/api/auth/sign-in/social')[0]?.body).toEqual({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/invite/accept?error=google_mismatch',
      requestSignUp: true,
    });
  });

  it('Google のメールが招待と違って戻ったら、選び直しを促す', async () => {
    await openInvite({}, '/invite/accept?error=google_mismatch');
    expect((await screen.findByRole('alert')).textContent).toBe(
      '招待されたメールアドレスのGoogleアカウントを選んでください。',
    );
  });
});

describe('パスワードの再設定 (/reset-password・§7.12)', () => {
  async function openReset(routes: Record<string, Route> = {}, path = '/reset-password?token=reset-token') {
    stubFetch(routes);
    renderApp(path);
    await screen.findByRole('heading', { level: 1, name: 'パスワードの再設定' });
  }

  function submitNewPassword(value = 'a-new-passphrase') {
    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value } });
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
  }

  it('token を URL から消して本文で送り、成功したら『ログインへ』を出す', async () => {
    await openReset({ 'POST /api/auth/reset-password': () => json({ status: true }) });
    await waitFor(() => expect(currentLocation()).toBe('/reset-password'));
    submitNewPassword();
    expect(
      (await screen.findByText('パスワードを再設定しました。新しいパスワードでログインしてください。'))
        .tagName,
    ).toBeTruthy();
    expect(callsTo('/api/auth/reset-password')[0]?.body).toEqual({
      token: 'reset-token',
      newPassword: 'a-new-passphrase',
    });
    expect(screen.getByRole('link', { name: 'ログインへ' }).getAttribute('href')).toBe('/login');
  });

  it('無効・期限切れのトークンは1種類の文言', async () => {
    await openReset({
      'POST /api/auth/reset-password': () => authError(400, 'INVALID_TOKEN', 'Invalid token'),
    });
    submitNewPassword();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'この再設定リンクは使えません。もう一度『パスワードをお忘れの方』からお試しください。',
    );
  });

  it('token の無い URL も同じ文言で、入力欄を出さない', async () => {
    await openReset({}, '/reset-password');
    expect(screen.getByRole('alert').textContent).toBe(
      'この再設定リンクは使えません。もう一度『パスワードをお忘れの方』からお試しください。',
    );
    expect(screen.queryByLabelText('新しいパスワード')).toBeNull();
  });
});

describe('公開経路と未認証の振り分け (§7.16)', () => {
  it.each([
    ['/login', 'ログイン'],
    ['/invite/accept?token=x', '招待の承諾'],
    ['/reset-password?token=x', 'パスワードの再設定'],
    ['/help', 'ヘルプ'],
    ['/privacy', 'プライバシー'],
  ])('未認証でも %s を描く', async (path, heading) => {
    stubFetch({ 'POST /api/auth/invite/inspect': pending });
    renderApp(path);
    await screen.findByRole('heading', { level: 1, name: heading });
    expect(currentLocation().split('?')[0]).toBe(path.split('?')[0]);
    // 同じカードの型 (ロゴ＋カード＋フッター)
    expect(screen.getByText('Focus Ledger')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('公開経路以外は /login?next=<元のパスと query> へ置き換える', async () => {
    stubFetch();
    renderApp('/budget?month=2026-09');
    await screen.findByRole('heading', { level: 1, name: 'ログイン' });
    const location = currentLocation();
    expect(location.startsWith('/login?')).toBe(true);
    expect(new URLSearchParams(location.split('?')[1]).get('next')).toBe('/budget?month=2026-09');
  });

  it('認証済みで /login に来たら next へ移る', async () => {
    stubFetch({ 'GET /api/auth/me': () => json(authState('member')) });
    renderApp('/login?next=%2Fcash');
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    expect(currentLocation()).toBe('/cash');
  });

  it.each(['/invite/accept?token=x', '/reset-password?token=x'])(
    '認証済みで %s に来たら / へ移る',
    async (path) => {
      stubFetch({ 'GET /api/auth/me': () => json(authState('member')) });
      renderApp(path);
      await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
      expect(currentLocation()).toBe('/');
    },
  );

  it('ヘルプは API を呼ばずに手順を並べる', async () => {
    stubFetch();
    renderApp('/help');
    await screen.findByRole('heading', { level: 1, name: 'ヘルプ' });
    for (const heading of [
      'ログイン',
      '招待の受け方',
      '招待メールの再送',
      'パスワードの再設定',
      '連携',
      '2段階認証',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
    expect(document.body.textContent).toContain('復旧コード');
    expect(document.body.textContent).toContain('管理者');
    expect(calls.filter((call) => !['/api/auth/me', '/api/status'].includes(call.path))).toEqual([]);
  });

  it('プライバシーは利用目的・保存するもの・保存期間・外部送信先を示す', async () => {
    stubFetch();
    renderApp('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'プライバシー' });
    for (const heading of ['利用目的', '保存するもの', '保存期間', '外部送信先']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
    const text = document.body.textContent ?? '';
    for (const fact of ['30日', '12時間', '72時間', '1時間', '10分', '400日', 'Google', 'Resend']) {
      expect(text).toContain(fact);
    }
  });

  it('認証失効イベントで App 全体を /login?next= へ戻す', async () => {
    stubFetch({ 'GET /api/auth/me': () => json(authState('member')) });
    renderApp('/cash?month=2026-08');
    await screen.findByRole('heading', { name: 'stub:AuthenticatedApp' });
    act(() => {
      window.dispatchEvent(new Event(AUTH_EVENT));
    });
    await screen.findByRole('heading', { level: 1, name: 'ログイン' });
    expect(new URLSearchParams(currentLocation().split('?')[1]).get('next')).toBe('/cash?month=2026-08');
  });
});

describe('利用者管理 (§7.14・decision-004)', () => {
  const USERS = {
    users: [
      {
        id: 'u1',
        email: 'owner@example.test',
        role: 'admin',
        status: 'active',
        createdAt: '2026-09-01T00:00:00.000Z',
        lastLoginAt: '2026-09-12T09:00:00.000Z',
        twoFactorEnabled: true,
        providers: ['credential'],
      },
      {
        id: 'u2',
        email: 'member@example.test',
        role: 'member',
        status: 'active',
        createdAt: '2026-09-02T00:00:00.000Z',
        lastLoginAt: null,
        twoFactorEnabled: false,
        providers: ['google'],
      },
    ],
  };
  const invitation = (id: string, email: string, status: string) => ({
    id,
    email,
    role: 'member',
    status,
    expiresAt: '2026-09-25T00:00:00.000Z',
    invitedBy: 'owner@example.test',
    createdAt: '2026-09-22T00:00:00.000Z',
    acceptedAt: status === 'accepted' ? '2026-09-23T00:00:00.000Z' : null,
  });
  const INVITATIONS = {
    invitations: [
      invitation('i1', 'pending@example.test', 'pending'),
      invitation('i2', 'expired@example.test', 'expired'),
      invitation('i3', 'accepted@example.test', 'accepted'),
      invitation('i4', 'revoked@example.test', 'revoked'),
    ],
  };
  const ADMIN = {
    'GET /api/auth/me': () => json(authState('admin', { twoFactorEnabled: true })),
    'GET /api/admin/users': () => json(USERS),
    'GET /api/admin/invitations': () => json(INVITATIONS),
  };

  it('一般利用者には描画せず、管理APIも照会しない', async () => {
    stubFetch({ 'GET /api/auth/me': () => json(authState('member')) });
    const { container } = withQuery(<UserAdmin />);
    await waitFor(() => expect(callsTo('/api/auth/me')).toHaveLength(1));
    expect(container.querySelector('#user-admin')).toBeNull();
    expect(calls.filter((call) => call.path.startsWith('/api/admin'))).toEqual([]);
  });

  it('招待の一覧に状態・期限・招待者を出し、仮パスワードの導線を持たない', async () => {
    stubFetch(ADMIN);
    const { container } = withQuery(<UserAdmin />);
    const table = await screen.findByRole('table', { name: '招待の一覧' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace(/[▲▼↕]/g, '').trim());
    expect(headers).toEqual(['メールアドレス', '権限', '状態', '期限', '招待者', '操作']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[2]?.textContent)).toEqual([
      '未承諾',
      '期限切れ',
      '承諾済み',
      '取消',
    ]);
    // 再送・取消は未承諾と期限切れだけ
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: '再送' })).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: '取消' })).toBeTruthy();
    expect(within(rows[2] as HTMLElement).queryAllByRole('button')).toHaveLength(0);
    expect(within(rows[3] as HTMLElement).queryAllByRole('button')).toHaveLength(0);
    await screen.findByRole('table', { name: '利用者の一覧' });
    expect(container.textContent).not.toMatch(/一時パスワード|仮パスワードを発行/);
  });

  it('招待を作ると POST /admin/invitations を呼び、一覧を取り直す', async () => {
    stubFetch({
      ...ADMIN,
      'POST /api/admin/invitations': () =>
        json({ invitation: invitation('i9', 'new@example.test', 'pending') }, 201),
    });
    withQuery(<UserAdmin />);
    await screen.findByRole('table', { name: '招待の一覧' });
    const form = screen.getByRole('form', { name: '招待を作る' });
    fireEvent.change(within(form).getByLabelText('メールアドレス'), {
      target: { value: ' New@Example.test ' },
    });
    fireEvent.change(within(form).getByLabelText('権限'), { target: { value: 'admin' } });
    fireEvent.click(within(form).getByRole('button', { name: '招待メールを送る' }));
    expect((await screen.findByRole('status')).textContent).toBe(
      'new@example.test に招待メールを送りました。',
    );
    expect(callsTo('/api/admin/invitations').filter((call) => call.method === 'POST')[0]?.body).toEqual({
      email: 'new@example.test',
      role: 'admin',
    });
    await waitFor(() =>
      expect(callsTo('/api/admin/invitations').filter((call) => call.method === 'GET')).toHaveLength(2),
    );
    // 旧経路 (管理者が利用者を直接作る) を呼ばない
    expect(calls.filter((call) => call.path === '/api/admin/users' && call.method === 'POST')).toEqual([]);
  });

  it('メール送信の失敗 (502) は再送を促し、作成済みの一覧を取り直す', async () => {
    stubFetch({ ...ADMIN, 'POST /api/admin/invitations': () => apiError(502, 'mail_send_failed') });
    withQuery(<UserAdmin />);
    await screen.findByRole('table', { name: '招待の一覧' });
    const form = screen.getByRole('form', { name: '招待を作る' });
    fireEvent.change(within(form).getByLabelText('メールアドレス'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.click(within(form).getByRole('button', { name: '招待メールを送る' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      '招待は作成しましたが、メールを送れませんでした。再送してください。',
    );
    await waitFor(() =>
      expect(callsTo('/api/admin/invitations').filter((call) => call.method === 'GET')).toHaveLength(2),
    );
  });

  it('既に利用者がいるメールアドレス (409) を伝える', async () => {
    stubFetch({ ...ADMIN, 'POST /api/admin/invitations': () => apiError(409, 'user_exists') });
    withQuery(<UserAdmin />);
    await screen.findByRole('table', { name: '招待の一覧' });
    const form = screen.getByRole('form', { name: '招待を作る' });
    fireEvent.change(within(form).getByLabelText('メールアドレス'), {
      target: { value: 'owner@example.test' },
    });
    fireEvent.click(within(form).getByRole('button', { name: '招待メールを送る' }));
    expect((await screen.findByRole('alert')).textContent).toBe('このメールアドレスの利用者は登録済みです。');
  });

  it('再送と取消は :id/resend・:id/revoke へ本文なしで送る', async () => {
    stubFetch({
      ...ADMIN,
      'POST /api/admin/invitations/i1/resend': () =>
        json({ invitation: invitation('i1', 'pending@example.test', 'pending') }),
      'POST /api/admin/invitations/i2/revoke': () =>
        json({ invitation: invitation('i2', 'expired@example.test', 'revoked') }),
    });
    withQuery(<UserAdmin />);
    const table = await screen.findByRole('table', { name: '招待の一覧' });
    const rows = within(table).getAllByRole('row').slice(1);
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: '再送' }));
    expect((await screen.findByRole('status')).textContent).toBe(
      'pending@example.test に招待メールを送り直しました。',
    );
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(callsTo('/api/admin/invitations/i2/revoke')).toHaveLength(1));
    expect(callsTo('/api/admin/invitations/i1/resend')[0]?.body).toBeNull();
    expect(callsTo('/api/admin/invitations/i2/revoke')[0]?.body).toBeNull();
  });

  it('利用者の権限変更と停止は既存どおり PATCH /admin/users/:id に最小の差分で送る', async () => {
    stubFetch({
      ...ADMIN,
      'PATCH /api/admin/users/u2': () => json({ user: USERS.users[1] }),
    });
    withQuery(<UserAdmin />);
    const table = await screen.findByRole('table', { name: '利用者の一覧' });
    fireEvent.change(within(table).getByLabelText('member@example.test の権限'), {
      target: { value: 'admin' },
    });
    await waitFor(() => expect(callsTo('/api/admin/users/u2')).toHaveLength(1));
    const row = within(table).getByText('member@example.test').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '停止する' }));
    await waitFor(() => expect(callsTo('/api/admin/users/u2')).toHaveLength(2));
    expect(callsTo('/api/admin/users/u2').map((call) => call.body)).toEqual([
      { role: 'admin' },
      { status: 'suspended' },
    ]);
    expect(within(table).queryByRole('button', { name: /再発行/ })).toBeNull();
  });
});

describe('設定のアカウント欄 (§7.14・UC-9)', () => {
  const me = (
    overrides: Partial<NonNullable<AuthState['user']>> = {},
    role: 'admin' | 'member' = 'member',
  ) => ({
    'GET /api/auth/me': () => json(authState(role, overrides)),
  });

  async function openAccount(routes: Record<string, Route>, path = '/settings') {
    stubFetch(routes);
    withQuery(<AccountSettings />, path);
    return screen.findByRole('region', { name: 'アカウント' });
  }

  it('認証手段と2段階認証の状態を出す', async () => {
    const region = await openAccount(me({ providers: ['credential'], twoFactorEnabled: false }));
    const methods = within(region).getByRole('list', { name: '認証手段' });
    expect(
      within(methods)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('パスワード') as unknown as string,
      expect.stringContaining('Google') as unknown as string,
    ]);
    expect(within(methods).getAllByRole('listitem')[0]?.textContent).toContain('登録済み');
    expect(within(methods).getAllByRole('listitem')[1]?.textContent).toContain('未連携');
    expect(within(region).getByText('2段階認証: 未設定')).toBeTruthy();
  });

  it('パスワードを持つ人の Google 連携は、現在のパスワードで再認証して確認メールを送る', async () => {
    const region = await openAccount({
      ...me({ providers: ['credential'] }),
      'POST /api/account/link/start': () => json({ ok: true }, 202),
    });
    fireEvent.click(within(region).getByRole('button', { name: 'Googleを連携' }));
    const form = within(region).getByRole('form', { name: 'Googleを連携' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'current-pass' } });
    fireEvent.click(within(form).getByRole('button', { name: '確認メールを送る' }));
    expect((await within(region).findByRole('status')).textContent).toBe(
      '確認メールを送りました。メールのリンクを開くと連携を続けられます。',
    );
    expect(callsTo('/api/account/link/start')[0]?.body).toEqual({
      target: 'google',
      currentPassword: 'current-pass',
    });
  });

  it('再認証の失敗 (401 reauth_failed) は入力欄のエラーで、ログアウト扱いにしない', async () => {
    const unauthorized = vi.fn();
    window.addEventListener(AUTH_EVENT, unauthorized);
    const region = await openAccount({
      ...me({ providers: ['credential'] }),
      'POST /api/account/link/start': () => apiError(401, 'reauth_failed'),
    });
    fireEvent.click(within(region).getByRole('button', { name: 'Googleを連携' }));
    const form = within(region).getByRole('form', { name: 'Googleを連携' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'wrong' } });
    fireEvent.click(within(form).getByRole('button', { name: '確認メールを送る' }));
    expect((await within(region).findByRole('alert')).textContent).toBe(
      '現在のパスワードが正しくありません。',
    );
    expect(unauthorized).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EVENT, unauthorized);
  });

  it('Google だけの人のパスワード追加は、現在のパスワードを送らずに始める', async () => {
    const region = await openAccount({
      ...me({ providers: ['google'] }),
      'POST /api/account/link/start': () => json({ ok: true }, 202),
    });
    fireEvent.click(within(region).getByRole('button', { name: 'パスワードを追加' }));
    const form = within(region).getByRole('form', { name: 'パスワードを追加' });
    expect(within(form).queryByLabelText('現在のパスワード')).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: '確認メールを送る' }));
    await within(region).findByRole('status');
    expect(callsTo('/api/account/link/start')[0]?.body).toEqual({ target: 'password' });
  });

  it('確認リンク (Google) は confirm の後に link-social へ進み、URL から token を消す', async () => {
    const assign = vi.spyOn(externalNavigation, 'assign').mockImplementation(() => {});
    await openAccount(
      {
        ...me({ providers: ['credential'] }),
        'POST /api/account/link/confirm': () => json({ target: 'google', linkGrant: 'grant' }),
        'POST /api/auth/link-social': () => json({ url: 'https://accounts.google.com/link', redirect: true }),
      },
      '/settings?link_token=link-token',
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/link'));
    expect(callsTo('/api/account/link/confirm')[0]?.body).toEqual({ token: 'link-token' });
    expect(callsTo('/api/auth/link-social')[0]?.body).toEqual({
      provider: 'google',
      callbackURL: '/settings',
    });
    expect(callsTo('/api/auth/link-social')[0]?.headers.get('x-kanjo-link-grant')).toBe('grant');
    expect(currentLocation()).toBe('/settings');
  });

  it('確認リンク (パスワード) は新しいパスワードを受けて link/password へ送る', async () => {
    const region = await openAccount(
      {
        ...me({ providers: ['google'] }),
        'POST /api/account/link/confirm': () => json({ target: 'password', linkGrant: 'grant' }),
        'POST /api/account/link/password': () => json({ ok: true }),
      },
      '/settings?link_token=link-token',
    );
    const form = await within(region).findByRole('form', { name: 'パスワードを設定' });
    fireEvent.change(within(form).getByLabelText('新しいパスワード'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.change(within(form).getByLabelText('新しいパスワード（確認）'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'パスワードを設定' }));
    expect((await within(region).findByRole('status')).textContent).toBe('パスワードを追加しました。');
    expect(callsTo('/api/account/link/password')[0]?.body).toEqual({
      token: 'grant',
      newPassword: 'a-new-passphrase',
    });
  });

  it('使えない確認リンクは「この確認リンクは使えません。」', async () => {
    const region = await openAccount(
      { ...me(), 'POST /api/account/link/confirm': () => apiError(404, 'link_token_unavailable') },
      '/settings?link_token=stale',
    );
    expect((await within(region).findByRole('alert')).textContent).toBe('この確認リンクは使えません。');
  });

  it('手段が2つあれば片方を解除できる。1つだけなら解除の操作を出さない', async () => {
    const region = await openAccount({
      ...me({ providers: ['credential', 'google'] }),
      'POST /api/auth/unlink-account': () => json({ status: true }),
    });
    fireEvent.click(within(region).getByRole('button', { name: 'Googleの連携を解除' }));
    await waitFor(() =>
      expect(callsTo('/api/auth/unlink-account')[0]?.body).toEqual({ accountId: 'account-google' }),
    );
    cleanup();
    const single = await openAccount(me({ providers: ['google'] }));
    expect(within(single).queryByRole('button', { name: /解除/ })).toBeNull();
  });

  it('一般利用者は2段階認証を有効にできる (enable → QR と復旧コード → 初回コード)', async () => {
    const region = await openAccount({
      ...me({ twoFactorEnabled: false }),
      'POST /api/auth/two-factor/enable': () =>
        json({
          totpURI: 'otpauth://totp/Focus%20Ledger:m?secret=JBSWY3DPEHPK3PXP',
          backupCodes: ['b1', 'b2'],
        }),
      'POST /api/auth/two-factor/verify-totp': () => json({ token: 't' }),
    });
    fireEvent.click(within(region).getByRole('button', { name: '2段階認証を有効にする' }));
    const form = within(region).getByRole('form', { name: '2段階認証を有効にする' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'current-pass' } });
    fireEvent.click(within(form).getByRole('button', { name: '次へ' }));
    await within(region).findByRole('img', { name: '認証アプリで読み取るQRコード' });
    expect(callsTo('/api/auth/two-factor/enable')[0]?.body).toEqual({ password: 'current-pass' });
    expect(within(region).getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
    const codes = within(region).getByRole('list', { name: '復旧コード' });
    expect(
      within(codes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['b1', 'b2']);
    fireEvent.change(within(region).getByLabelText('確認コード'), { target: { value: '123456' } });
    fireEvent.click(within(region).getByRole('button', { name: '設定を完了' }));
    await waitFor(() =>
      expect(callsTo('/api/auth/two-factor/verify-totp')[0]?.body).toEqual({ code: '123456' }),
    );
  });

  it('一般利用者は無効にでき、管理者には無効化の操作を出さない (BR-10)', async () => {
    const region = await openAccount({
      ...me({ twoFactorEnabled: true }),
      'POST /api/auth/two-factor/disable': () => json({ status: true }),
    });
    fireEvent.click(within(region).getByRole('button', { name: '2段階認証を無効にする' }));
    const form = within(region).getByRole('form', { name: '2段階認証を無効にする' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'current-pass' } });
    fireEvent.click(within(form).getByRole('button', { name: '無効にする' }));
    await waitFor(() =>
      expect(callsTo('/api/auth/two-factor/disable')[0]?.body).toEqual({ password: 'current-pass' }),
    );
    cleanup();
    const admin = await openAccount(me({ twoFactorEnabled: true }, 'admin'));
    expect(within(admin).queryByRole('button', { name: '2段階認証を無効にする' })).toBeNull();
    expect(within(admin).getByText('管理者は2段階認証を無効にできません。')).toBeTruthy();
  });

  it('復旧コードを再発行し、1回だけ表示する', async () => {
    const region = await openAccount({
      ...me({ twoFactorEnabled: true }, 'admin'),
      'POST /api/auth/two-factor/generate-backup-codes': () =>
        json({ status: true, backupCodes: ['n1', 'n2'] }),
    });
    fireEvent.click(within(region).getByRole('button', { name: '復旧コードを再発行' }));
    const form = within(region).getByRole('form', { name: '復旧コードを再発行' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'current-pass' } });
    fireEvent.click(within(form).getByRole('button', { name: '再発行する' }));
    const codes = await within(region).findByRole('list', { name: '復旧コード' });
    expect(
      within(codes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['n1', 'n2']);
    fireEvent.click(within(region).getByRole('button', { name: '保存しました' }));
    expect(within(region).queryByRole('list', { name: '復旧コード' })).toBeNull();
  });

  it('パスワードの変更は change-password へ送り、他の端末のログインを切る', async () => {
    const region = await openAccount({
      ...me({ providers: ['credential'] }),
      'POST /api/auth/change-password': () => json({ token: null, user: { id: 'u1' } }),
    });
    const form = within(region).getByRole('form', { name: 'パスワードの変更' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'current-pass' } });
    fireEvent.change(within(form).getByLabelText('新しいパスワード'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.change(within(form).getByLabelText('新しいパスワード（確認）'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'パスワードを変更' }));
    expect((await within(region).findByRole('status')).textContent).toBe(
      'パスワードを変更しました。この端末はそのまま利用できます。',
    );
    expect(callsTo('/api/auth/change-password')[0]?.body).toEqual({
      currentPassword: 'current-pass',
      newPassword: 'a-new-passphrase',
      revokeOtherSessions: true,
    });
    expect(calls.some((call) => call.path === '/api/auth/password')).toBe(false);
  });

  it('現在のパスワードの誤り (400 INVALID_PASSWORD) を入力欄のエラーにする', async () => {
    const region = await openAccount({
      ...me({ providers: ['credential'] }),
      'POST /api/auth/change-password': () => authError(400, 'INVALID_PASSWORD', 'Invalid password'),
    });
    const form = within(region).getByRole('form', { name: 'パスワードの変更' });
    fireEvent.change(within(form).getByLabelText('現在のパスワード'), { target: { value: 'wrong' } });
    fireEvent.change(within(form).getByLabelText('新しいパスワード'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.change(within(form).getByLabelText('新しいパスワード（確認）'), {
      target: { value: 'a-new-passphrase' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'パスワードを変更' }));
    expect((await within(region).findByRole('alert')).textContent).toBe(
      '現在のパスワードが正しくありません。',
    );
  });

  it('パスワードを持たない人にはパスワードの変更を出さない', async () => {
    const region = await openAccount(me({ providers: ['google'] }));
    expect(within(region).queryByRole('form', { name: 'パスワードの変更' })).toBeNull();
  });
});
