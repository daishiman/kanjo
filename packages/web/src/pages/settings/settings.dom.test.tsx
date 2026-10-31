// @vitest-environment jsdom

/**
 * 設定画面の文言・節・入力・保存・下書き (spec-settings-screen AT-01〜AT-12・AT-20・AT-22)。
 *
 * バックアップの節は `backup-restore.dom.test.tsx` が節の部品を直接描いて見ている。ここでは画面全体の組み立てを見る。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の設定画面 (`pages/Settings.tsx`) は分類ルール・名義・夜間バックアップをそれぞれの API で個別に保存し、
 * `/api/settings/screen` を読まず、節ナビ・説明パネル・保存バー・下書きを持たない。`./SettingsPage.js` 自体が存在しない。
 */
import {
  DEFAULT_TAX_ACCOUNT_MAP,
  NO_CATEGORY,
  type SettingsScreenView,
  TAX_ACCOUNT_MAP_ROWS_MAX,
  type TaxAccountMapRow,
  sortTaxAccountMap,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api.js';
import { PeriodProvider } from '../../period.js';
import { SettingsPage } from './SettingsPage.js';
import { settingsDraftKey } from './draft.js';
import {
  CASH_TEXT,
  CONFLICT,
  DATA_TEXT,
  EXPORT_LINKS,
  LEAD_LINES,
  LOAD_FAILED,
  NORM_RULES_TEXT,
  PANEL_TEXT,
  QUESTION,
  SAVE_TEXT,
  SECTION_NAV,
  STATS_TEXT,
  TAX_MAP_TEXT,
  deleteRuleTitle,
  resetTitle,
  taxMapAdded,
  taxMapErrorMessage,
  taxMapFieldText,
  taxMapRemoveLabel,
  taxMapRemoveTitle,
  taxMapRemoved,
  unsavedLabel,
} from './view-model.js';

const USER_ID = 'u-test';
const DRAFT_KEY = settingsDraftKey(USER_ID);
const SAVED_AT = '2026-09-01T00:00:00.000Z';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const rule = (ruleId: string, raw: string, norm: string, order: number) => ({
  ruleId,
  kind: 'vendor' as const,
  raw,
  norm,
  order,
  enabled: true,
  updatedAt: SAVED_AT,
  updatedBy: 'owner',
  canUndo: true,
  shadowedBy: null,
});

function screenView(patch: Partial<SettingsScreenView> = {}): SettingsScreenView {
  return {
    savedAt: SAVED_AT,
    normRules: [rule('r1', 'ｱﾏｿﾞﾝ', 'Amazon', 1), rule('r2', 'AMAZON.CO.JP', 'Amazon', 2)],
    ownerLabels: { business: '本人', spouse: 'パートナー', family: '子ども', unset: 'その他' },
    ownerLabelsSaved: false,
    statMinMonths: 6,
    statMinMonthsRange: { min: 1, max: 60, default: 6 },
    cashOverrides: [],
    // 版 2 の設定は勘定科目の対応表を持つ (spec-classify-bulk-save AC-17)。api は常に返す
    taxAccountMap: DEFAULT_TAX_ACCOUNT_MAP.map((row) => ({ ...row })),
    impacts: { account: ['損益計算書'], vendor: ['支出分析', '明細仕分け'] },
    limits: { normRules: 500, text: 60, memo: 100 },
    ...patch,
  };
}

type Call = { url: URL; init?: RequestInit };
type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage(opts: { view?: SettingsScreenView; handle?: Handler; period?: boolean } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(req), 'http://localhost');
      calls.push({ url, init });
      const custom = await opts.handle?.(url, init);
      if (custom) return custom;
      if (url.pathname.endsWith('/auth/me'))
        return json({ authenticated: true, user: { id: USER_ID, username: 'owner', role: 'admin' } });
      if (url.pathname.endsWith('/settings/screen') && init?.method === 'PUT')
        return json({ ok: true, savedAt: '2026-09-02T00:00:00.000Z', changes: 1, recomputed: true });
      if (url.pathname.endsWith('/settings/screen')) return json(opts.view ?? screenView());
      if (url.pathname.endsWith('/backups')) return json({ backups: [] });
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = (
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
      <a href="/overview">概要へ</a>
      <LocationProbe />
    </MemoryRouter>
  );
  const view = render(
    <QueryClientProvider client={client}>
      {opts.period ? <PeriodProvider>{page}</PeriodProvider> : page}
    </QueryClientProvider>,
  );
  return { calls, view, client };
}

const loaded = () => screen.findByRole('heading', { level: 2, name: NORM_RULES_TEXT.heading });
const rawInputs = () => screen.getAllByRole('textbox', { name: NORM_RULES_TEXT.raw }) as HTMLInputElement[];
const saveBar = () =>
  screen.getByRole('button', { name: SAVE_TEXT.save }).closest('.settings-save-bar') as HTMLElement;
const puts = (calls: Call[]) =>
  calls.filter((c) => c.init?.method === 'PUT' && c.url.pathname.endsWith('/settings/screen'));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('見出しと節 (AT-01・AT-02・AT-20)', () => {
  it('見出し『設定』・問い・説明 2 行を出す', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: '設定' })).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
    for (const line of LEAD_LINES) expect(screen.getByText(line, { exact: false })).toBeTruthy();
  });

  it('節ナビは勘定科目の対応表を含む 9 項目で、各項目の宛先の節が画面にある', async () => {
    renderPage();
    await loaded();
    const nav = screen.getByRole('navigation', { name: '設定の節' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(9);
    expect(links.map((a) => a.textContent)).toEqual(SECTION_NAV.map((s) => s.label));
    expect(within(nav).getByRole('link', { name: TAX_MAP_TEXT.heading }).getAttribute('href')).toBe(
      '#tax-account-map',
    );
    for (const s of SECTION_NAV) expect(document.getElementById(s.id), s.id).not.toBeNull();
    expect(links.filter((a) => a.getAttribute('aria-current')).length).toBe(1);
  });

  it('既存の機能はアカウントとその他の管理の節に入っている', async () => {
    renderPage();
    await loaded();
    const account = document.getElementById('account') as HTMLElement;
    expect(within(account).getByRole('heading', { level: 2, name: 'アカウント' })).toBeTruthy();
    const other = document.getElementById('other-admin') as HTMLElement;
    expect(other.querySelector('#vendor-memory')).not.toBeNull();
  });
});

describe('集計ルールと説明パネル (AT-03〜AT-05)', () => {
  it('最初の有効なルールを選択した状態で、編集領域と説明を同じワークスペースに出す', async () => {
    const first = { ...rule('r1', '無効な表記', '対象外', 1), enabled: false };
    renderPage({
      view: screenView({
        normRules: [first, rule('r2', 'AMAZON.CO.JP', 'Amazon', 2)],
      }),
    });
    await loaded();

    const nav = screen.getByRole('navigation', { name: '設定の節' });
    const content = screen.getByRole('region', { name: '設定内容' });
    const panel = screen.getByRole('complementary', { name: PANEL_TEXT.heading });
    const workspace = nav.closest('.settings-workspace');
    const normRules = document.getElementById('norm-rules') as HTMLElement;
    const ownerLabels = document.getElementById('owner-labels') as HTMLElement;
    expect(workspace).not.toBeNull();
    expect(content.parentElement).toBe(workspace);
    expect(panel.closest('.settings-inspector')?.parentElement).toBe(workspace);
    expect(nav.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(content.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(normRules.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(ownerLabels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel).getByText('AMAZON.CO.JP')).toBeTruthy();
    expect(within(panel).queryByText('無効な表記')).toBeNull();
  });

  it('説明を明示的に閉じた後は、別の設定を編集しても勝手に再選択しない', async () => {
    renderPage();
    await loaded();
    const panel = await screen.findByRole('complementary', { name: PANEL_TEXT.heading });
    fireEvent.click(within(panel).getByRole('button', { name: PANEL_TEXT.close }));
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    expect(screen.queryByRole('complementary', { name: PANEL_TEXT.heading })).toBeNull();
  });

  it('選択中の行を削除すると、隣のルールへ説明が連続する', async () => {
    renderPage();
    await loaded();
    const panel = await screen.findByRole('complementary', { name: PANEL_TEXT.heading });
    expect(within(panel).getByText('ｱﾏｿﾞﾝ')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: NORM_RULES_TEXT.deleteLabel })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: deleteRuleTitle('ｱﾏｿﾞﾝ') });
    fireEvent.click(within(dialog).getByRole('button', { name: '削除する' }));

    await waitFor(() =>
      expect(
        within(screen.getByRole('complementary', { name: PANEL_TEXT.heading })).getByText('AMAZON.CO.JP'),
      ).toBeTruthy(),
    );
  });

  it('表の列・追加・上下移動がある', async () => {
    renderPage();
    await loaded();
    const table = document.querySelector('.settings-rules-table') as HTMLTableElement;
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent ?? '');
    for (const label of [NORM_RULES_TEXT.kind, NORM_RULES_TEXT.raw, NORM_RULES_TEXT.norm])
      expect(
        headers.some((h) => h.includes(label)),
        label,
      ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: NORM_RULES_TEXT.add }));
    expect(rawInputs()).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: '下へ移動' })[0] as HTMLElement);
    expect(
      rawInputs()
        .map((i) => i.value)
        .slice(0, 2),
    ).toEqual(['AMAZON.CO.JP', 'ｱﾏｿﾞﾝ']);
  });

  it('並べ替えハンドルはキーボードのArrowDownで行を下へ移す', async () => {
    renderPage();
    await loaded();
    const handle = screen.getByRole('button', { name: '「ｱﾏｿﾞﾝ」を並べ替え' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(rawInputs().map((input) => input.value)).toEqual(['AMAZON.CO.JP', 'ｱﾏｿﾞﾝ']);
    expect(document.activeElement).toBe(handle);
  });

  it('行を選ぶと説明パネルが出て、× で閉じる', async () => {
    renderPage();
    await loaded();
    fireEvent.focus(rawInputs()[0] as HTMLElement);
    const panel = await screen.findByRole('complementary', { name: PANEL_TEXT.heading });
    expect(within(panel).getByText('支出分析')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: PANEL_TEXT.close }));
    expect(screen.queryByRole('complementary', { name: PANEL_TEXT.heading })).toBeNull();
  });

  it('元に戻すと直前の保存値が入り、未保存の件数が増える', async () => {
    renderPage({
      handle: (url) =>
        url.pathname.endsWith('/settings/history')
          ? json({
              ruleId: 'r1',
              previous: { kind: 'vendor', raw: 'ｱﾏｿﾞﾝ', norm: '通販', enabled: true, order: 1 },
              lastChangedAt: SAVED_AT,
              lastChangedBy: 'owner',
            })
          : undefined,
    });
    await loaded();
    expect(within(saveBar()).getByText(SAVE_TEXT.clean)).toBeTruthy();
    fireEvent.focus(rawInputs()[0] as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: PANEL_TEXT.undo }));
    await waitFor(() => expect(within(saveBar()).getByText(unsavedLabel(1), { exact: false })).toBeTruthy());
    const norms = screen.getAllByRole('combobox', { name: NORM_RULES_TEXT.norm }) as HTMLInputElement[];
    expect(norms[0]?.value).toBe('通販');
  });
});

describe('名義・統計・現金上書き (AT-06)', () => {
  it('名義 4 欄・統計の既定 6・現金 2 行・凡例 3 行・メモ n/100', async () => {
    renderPage();
    await loaded();
    const owners = document.getElementById('owner-labels') as HTMLElement;
    expect(within(owners).getAllByRole('textbox')).toHaveLength(4);
    expect((screen.getByLabelText(STATS_TEXT.label) as HTMLInputElement).value).toBe('6');
    const cash = document.getElementById('cash-overrides') as HTMLElement;
    expect(within(cash).getByText('現金の支払い')).toBeTruthy();
    expect(within(cash).getByText('現金の受け取り')).toBeTruthy();
    for (const line of CASH_TEXT.legend) expect(within(cash).getByText(line)).toBeTruthy();
    expect(within(cash).getAllByText('0/100')).toHaveLength(2);
  });
});

describe('データ (AT-07・AT-08)', () => {
  it('出力 4 種。期間は 3 種にだけ付き、設定の JSON には付かない', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'year', year: '2025' }));
    renderPage({ period: true });
    await loaded();
    const data = document.getElementById('data') as HTMLElement;
    for (const link of EXPORT_LINKS) {
      const a = within(data).getByText(link.label).closest('a') as HTMLAnchorElement;
      const href = a.getAttribute('href') ?? '';
      expect(href.startsWith(link.path), link.key).toBe(true);
      expect(href.includes('year=2025'), link.key).toBe(link.withPeriod);
      expect(a.hasAttribute('download'), link.key).toBe(true);
    }
  });

  it('復元はファイルを選ぶまで押せない', async () => {
    renderPage();
    await loaded();
    const button = screen.getByRole('button', { name: DATA_TEXT.restoreButton }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const input = document.querySelector('#data input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'settings.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});

describe('保存 (AT-10)', () => {
  it('変更した節を 1 回の PUT で送り、baseSavedAt を付ける', async () => {
    const { calls } = renderPage();
    await loaded();
    fireEvent.change(rawInputs()[0] as HTMLElement, { target: { value: 'ｱﾏｿﾞﾝ ｼﾞｬﾊﾟﾝ' } });
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    await waitFor(() => expect(within(saveBar()).getByText(unsavedLabel(2), { exact: false })).toBeTruthy());
    expect(within(saveBar()).getByText(SAVE_TEXT.unsavedHint)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: SAVE_TEXT.save }));
    await screen.findByText(SAVE_TEXT.saved);
    expect(puts(calls)).toHaveLength(1);
    const body = JSON.parse(String(puts(calls)[0]?.init?.body));
    expect(body.baseSavedAt).toBe(SAVED_AT);
    expect(body.statMinMonths).toBe(12);
    expect(body.normRules[0]).toMatchObject({ ruleId: 'r1', raw: 'ｱﾏｿﾞﾝ ｼﾞｬﾊﾟﾝ' });
    expect(body.ownerLabels).toBeUndefined();
  });

  it('入力に誤りがあると保存できない', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '0' } });
    await waitFor(() => expect(within(saveBar()).getByText(SAVE_TEXT.invalid)).toBeTruthy());
    expect((screen.getByRole('button', { name: SAVE_TEXT.save }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('409 の競合は案内を出して読み直す', async () => {
    let screenReads = 0;
    renderPage({
      handle: (url, init) => {
        if (!url.pathname.endsWith('/settings/screen')) return undefined;
        if (init?.method === 'PUT')
          return json({ error: { code: 'settings_conflict', message: 'conflict' } }, 409);
        screenReads += 1;
        return undefined;
      },
    });
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: SAVE_TEXT.save }));
    expect(await screen.findByText(CONFLICT)).toBeTruthy();
    await waitFor(() => expect(screenReads).toBeGreaterThanOrEqual(2));
  });
});

describe('下書き・リセット・離脱 (AT-11)', () => {
  it('入力は 800ms 後に端末へ残り、再読込で戻り、保存で消える', async () => {
    const first = renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), { timeout: 2000 });
    first.view.unmount();

    renderPage();
    await loaded();
    await waitFor(() =>
      expect((screen.getByLabelText(STATS_TEXT.label) as HTMLInputElement).value).toBe('12'),
    );
    expect(within(saveBar()).getByText(unsavedLabel(1), { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: SAVE_TEXT.save }));
    await screen.findByText(SAVE_TEXT.saved);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('リセットは確認してから下書きを捨てる', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: SAVE_TEXT.reset }));
    const dialog = await screen.findByRole('dialog', { name: resetTitle(1) });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_TEXT.resetConfirm }));
    await waitFor(() =>
      expect((screen.getByLabelText(STATS_TEXT.label) as HTMLInputElement).value).toBe('6'),
    );
    expect(within(saveBar()).getByText(SAVE_TEXT.clean)).toBeTruthy();
  });

  it('未保存のまま画面の外へ移ると確認し、とどまれば移動しない', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    await waitFor(() => expect(within(saveBar()).getByText(unsavedLabel(1), { exact: false })).toBeTruthy());

    fireEvent.click(screen.getByRole('link', { name: '概要へ' }));
    const dialog = await screen.findByRole('dialog', { name: SAVE_TEXT.leave });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_TEXT.leaveDismiss }));
    expect(screen.getByTestId('location').textContent).toBe('/settings');

    fireEvent.click(screen.getByRole('link', { name: '概要へ' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: SAVE_TEXT.leave })).getByRole('button', {
        name: SAVE_TEXT.leaveConfirm,
      }),
    );
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/overview'));
  });

  it('節ナビでは確認を出さない', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    await waitFor(() => expect(within(saveBar()).getByText(unsavedLabel(1), { exact: false })).toBeTruthy());
    const nav = screen.getByRole('navigation', { name: '設定の節' });
    fireEvent.click(within(nav).getByRole('link', { name: '統計' }));
    expect(screen.queryByRole('dialog', { name: SAVE_TEXT.leave })).toBeNull();
  });
});

describe('状態と通信先 (AT-12・AT-22)', () => {
  it('読込中も設定の節ナビを残す', () => {
    renderPage({
      handle: (url) =>
        url.pathname.endsWith('/settings/screen') ? new Promise<Response>(() => undefined) : undefined,
    });
    expect(screen.getByRole('navigation', { name: '設定の節' })).toBeTruthy();
    expect(screen.getByText('データを読み込み中…')).toBeTruthy();
  });

  it('読込に失敗すると案内と再読み込みを出す', async () => {
    renderPage({
      handle: (url) =>
        url.pathname.endsWith('/settings/screen')
          ? json({ error: { code: 'x', message: 'x' } }, 500)
          : undefined,
    });
    expect(await screen.findByText(LOAD_FAILED)).toBeTruthy();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '設定の節' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'アカウント' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'その他の管理' })).toBeTruthy();
  });

  it('集計ルールが無いと空の案内を出す', async () => {
    renderPage({ view: screenView({ normRules: [] }) });
    expect(await screen.findByText(NORM_RULES_TEXT.empty)).toBeTruthy();
    const panel = screen.getByRole('complementary', { name: PANEL_TEXT.heading });
    expect(within(panel).getByText(PANEL_TEXT.empty)).toBeTruthy();
    expect(within(panel).getByRole('link', { name: '集計ルールへ移動' })).toBeTruthy();
  });

  it('通信先は /api だけ', async () => {
    const { calls } = renderPage();
    await loaded();
    await waitFor(() => expect(calls.length).toBeGreaterThan(2));
    for (const c of calls) expect(c.url.pathname.startsWith('/api/'), c.url.pathname).toBe(true);
  });
});

describe('勘定科目の対応表 (spec-classify-bulk-save FR-17・AC-16)', () => {
  const MAP_PATH = '/api/settings/tax-account-map';
  const BUSY = '別の取込みまたは更新が進行中です。完了後に再試行してください';

  /** 対応表をサーバ側の状態として持ち、追加・削除と設定の読み出しをその状態で答える */
  function taxMapServer(reply: { post?: () => Response | undefined; del?: () => Response | undefined } = {}) {
    const state = {
      rows: DEFAULT_TAX_ACCOUNT_MAP.map((r) => ({ ...r })) as TaxAccountMapRow[],
      screenReads: 0,
    };
    const handle: Handler = (url, init) => {
      if (url.pathname.endsWith('/settings/screen') && init?.method !== 'PUT') {
        state.screenReads += 1;
        return json(screenView({ taxAccountMap: state.rows.map((r) => ({ ...r })) }));
      }
      if (url.pathname === MAP_PATH && init?.method === 'POST') {
        const custom = reply.post?.();
        if (custom) return custom;
        state.rows = sortTaxAccountMap([...state.rows, JSON.parse(String(init.body)) as TaxAccountMapRow]);
        return json({ rows: state.rows });
      }
      if (url.pathname.startsWith(`${MAP_PATH}/`) && init?.method === 'DELETE') {
        const custom = reply.del?.();
        if (custom) return custom;
        const big = decodeURIComponent(url.pathname.slice(MAP_PATH.length + 1));
        state.rows = state.rows.filter((r) => r.categoryBig !== big);
        return json({ rows: state.rows });
      }
      return undefined;
    };
    return { state, handle };
  }

  const section = () => document.getElementById('tax-account-map') as HTMLElement;
  const bigInput = () => within(section()).getByLabelText(TAX_MAP_TEXT.big) as HTMLInputElement;
  const accountSelect = () => within(section()).getByLabelText(TAX_MAP_TEXT.account) as HTMLSelectElement;
  const addButton = () =>
    within(section()).getByRole('button', { name: TAX_MAP_TEXT.add }) as HTMLButtonElement;
  const mapCalls = (calls: Call[], method: 'POST' | 'DELETE') =>
    calls.filter((c) => c.init?.method === method && c.url.pathname.startsWith(MAP_PATH));
  const fill = (big: string, account: string) => {
    fireEvent.change(bigInput(), { target: { value: big } });
    fireEvent.change(accountSelect(), { target: { value: account } });
  };
  const bodyRows = () =>
    within(within(section()).getByRole('table', { name: TAX_MAP_TEXT.heading }))
      .getAllByRole('row')
      .slice(1)
      .map((tr) =>
        within(tr)
          .getAllByRole('cell')
          .slice(0, 2)
          .map((td) => td.textContent),
      );

  it('表は大項目・勘定科目・操作の 3 列で、保存済みの対応表を行ごとに出す', async () => {
    renderPage();
    await loaded();
    expect(within(section()).getByRole('heading', { level: 2, name: TAX_MAP_TEXT.heading })).toBeTruthy();
    const table = within(section()).getByRole('table', { name: TAX_MAP_TEXT.heading });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual([TAX_MAP_TEXT.big, TAX_MAP_TEXT.account, TAX_MAP_TEXT.actions]);
    expect(bodyRows()).toEqual(DEFAULT_TAX_ACCOUNT_MAP.map((r) => [r.categoryBig, r.taxAccount]));
    for (const r of DEFAULT_TAX_ACCOUNT_MAP) {
      expect(within(table).getByRole('button', { name: taxMapRemoveLabel(r.categoryBig) })).toBeTruthy();
    }
    // 勘定科目は一覧から選ぶ (自由入力にしない)
    expect(within(accountSelect()).getByRole('option', { name: '損害保険料' })).toBeTruthy();
  });

  it('追加は前後の空白を除いた行を専用の API で送り、設定と提案を含む読み出しを取り直し、保存バーを汚さない', async () => {
    const server = taxMapServer();
    const { calls, client } = renderPage({ handle: server.handle });
    await loaded();
    client.setQueryData(['classify', 'list-probe'], { rows: [] });
    const readsBefore = server.state.screenReads;

    fill('  保険  ', '損害保険料');
    fireEvent.click(addButton());
    expect(await within(section()).findByText(taxMapAdded('保険'))).toBeTruthy();

    expect(mapCalls(calls, 'POST')).toHaveLength(1);
    expect(JSON.parse(String(mapCalls(calls, 'POST')[0]?.init?.body))).toEqual({
      categoryBig: '保険',
      taxAccount: '損害保険料',
    });
    expect(server.state.screenReads).toBeGreaterThan(readsBefore);
    expect(bodyRows()).toContainEqual(['保険', '損害保険料']);
    expect(bigInput().value).toBe('');
    expect(accountSelect().value).toBe('');
    expect(document.activeElement).toBe(bigInput());
    // 事業の明細の提案が変わるので、明細仕分けの読み出しを古いものとして扱う
    expect(client.getQueryState(['classify', 'list-probe'])?.isInvalidated).toBe(true);
    expect(within(saveBar()).getByText(SAVE_TEXT.clean)).toBeTruthy();
    expect(puts(calls)).toHaveLength(0);
  });

  it('対応表は保存バーの PUT に含めない', async () => {
    const { calls } = renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText(STATS_TEXT.label), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: SAVE_TEXT.save }));
    await screen.findByText(SAVE_TEXT.saved);
    const body = JSON.parse(String(puts(calls)[0]?.init?.body));
    expect(body.statMinMonths).toBe(12);
    expect(body).not.toHaveProperty('taxAccountMap');
  });

  it('欄の誤りは送る前に欄の下に示し、誤りのある欄へフォーカスする', async () => {
    const { calls } = renderPage();
    await loaded();
    const expectFieldError = async (field: HTMLElement, text: string) => {
      expect(await within(section()).findByText(text)).toBeTruthy();
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const describedBy = field.getAttribute('aria-describedby');
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(text);
      expect(document.activeElement).toBe(field);
    };

    fireEvent.click(addButton());
    await expectFieldError(bigInput(), taxMapFieldText('categoryBig', 'required'));

    fill(` ${NO_CATEGORY} `, '損害保険料');
    fireEvent.click(addButton());
    await expectFieldError(bigInput(), taxMapFieldText('categoryBig', 'reserved'));

    fill('通信費', '損害保険料');
    fireEvent.click(addButton());
    await expectFieldError(bigInput(), taxMapFieldText('categoryBig', 'duplicate'));

    fill('保険', '');
    fireEvent.click(addButton());
    await expectFieldError(accountSelect(), taxMapFieldText('taxAccount', 'not_in_list'));
    expect(bigInput().getAttribute('aria-invalid')).toBeNull();

    expect(mapCalls(calls, 'POST')).toHaveLength(0);
  });

  it('サーバが欄の問題として返した 400 (duplicate_category・invalid_request の fields) を欄に出す', async () => {
    const replies = [
      json({ error: { code: 'duplicate_category', message: 'duplicate' } }, 400),
      json(
        { error: { code: 'invalid_request', message: 'invalid', fields: { taxAccount: 'not_in_list' } } },
        400,
      ),
    ];
    const server = taxMapServer({ post: () => replies.shift() });
    const { calls } = renderPage({ handle: server.handle });
    await loaded();

    fill('保険', '損害保険料');
    fireEvent.click(addButton());
    expect(await within(section()).findByText(taxMapFieldText('categoryBig', 'duplicate'))).toBeTruthy();
    expect(document.activeElement).toBe(bigInput());
    // 欄の問題は入力を残して直せるようにする
    expect(bigInput().value).toBe('保険');

    fireEvent.change(bigInput(), { target: { value: '保険料' } });
    fireEvent.click(addButton());
    expect(await within(section()).findByText(taxMapFieldText('taxAccount', 'not_in_list'))).toBeTruthy();
    expect(document.activeElement).toBe(accountSelect());
    expect(within(section()).queryByRole('alert')).toBeNull();
    expect(mapCalls(calls, 'POST')).toHaveLength(2);
  });

  it('上限の 400 too_many_rows は案内を出し、対応表を読み直す', async () => {
    const server = taxMapServer({
      post: () => json({ error: { code: 'too_many_rows', message: 'too many' } }, 400),
    });
    renderPage({ handle: server.handle });
    await loaded();
    const readsBefore = server.state.screenReads;
    fill('保険', '損害保険料');
    fireEvent.click(addButton());
    expect((await within(section()).findByRole('alert')).textContent).toBe(TAX_MAP_TEXT.limit);
    await waitFor(() => expect(server.state.screenReads).toBeGreaterThan(readsBefore));
  });

  it(`${TAX_ACCOUNT_MAP_ROWS_MAX} 行あると追加を押せず、上限の案内を出す`, async () => {
    const rows = Array.from({ length: TAX_ACCOUNT_MAP_ROWS_MAX }, (_, i) => ({
      categoryBig: `大項目${String(i).padStart(3, '0')}`,
      taxAccount: '通信費',
    }));
    renderPage({ view: screenView({ taxAccountMap: rows }) });
    await loaded();
    expect(addButton().disabled).toBe(true);
    expect(within(section()).getByText(TAX_MAP_TEXT.limit)).toBeTruthy();
  });

  it('削除は確認してから、大項目を encode した path へ送り、行を消して知らせる', async () => {
    const big = '水道・光熱費';
    const server = taxMapServer();
    const { calls, client } = renderPage({ handle: server.handle });
    await loaded();
    client.setQueryData(['review-queue', 'probe'], { items: [] });

    fireEvent.click(within(section()).getByRole('button', { name: taxMapRemoveLabel(big) }));
    let dialog = await screen.findByRole('dialog', { name: taxMapRemoveTitle(big) });
    expect(within(dialog).getByText(TAX_MAP_TEXT.removeBody)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: TAX_MAP_TEXT.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: taxMapRemoveTitle(big) })).toBeNull());
    expect(mapCalls(calls, 'DELETE')).toHaveLength(0);

    fireEvent.click(within(section()).getByRole('button', { name: taxMapRemoveLabel(big) }));
    dialog = await screen.findByRole('dialog', { name: taxMapRemoveTitle(big) });
    fireEvent.click(within(dialog).getByRole('button', { name: TAX_MAP_TEXT.removeConfirm }));
    expect(await within(section()).findByText(taxMapRemoved(big))).toBeTruthy();

    expect(mapCalls(calls, 'DELETE').map((c) => c.url.pathname)).toEqual([
      `${MAP_PATH}/${encodeURIComponent(big)}`,
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: taxMapRemoveTitle(big) })).toBeNull());
    expect(bodyRows().map(([b]) => b)).not.toContain(big);
    expect(document.activeElement).toBe(bigInput());
    expect(client.getQueryState(['review-queue', 'probe'])?.isInvalidated).toBe(true);
  });

  it('削除の 404 は確認を閉じて読み直し、節に知らせる', async () => {
    const server = taxMapServer({
      del: () => json({ error: { code: 'not_found', message: 'not found' } }, 404),
    });
    renderPage({ handle: server.handle });
    await loaded();
    const readsBefore = server.state.screenReads;
    fireEvent.click(within(section()).getByRole('button', { name: taxMapRemoveLabel('通信費') }));
    const dialog = await screen.findByRole('dialog', { name: taxMapRemoveTitle('通信費') });
    fireEvent.click(within(dialog).getByRole('button', { name: TAX_MAP_TEXT.removeConfirm }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: taxMapRemoveTitle('通信費') })).toBeNull(),
    );
    expect((await within(section()).findByRole('alert')).textContent).toBe(
      taxMapErrorMessage(new ApiError(404, 'not_found', 'not found', undefined)),
    );
    await waitFor(() => expect(server.state.screenReads).toBeGreaterThan(readsBefore));
  });

  it('削除の 409 は確認に残してサーバの文を出し、そのまま送り直せる', async () => {
    const replies = [json({ error: { code: 'canonical_write_busy', message: BUSY } }, 409)];
    const server = taxMapServer({ del: () => replies.shift() });
    const { calls } = renderPage({ handle: server.handle });
    await loaded();
    fireEvent.click(within(section()).getByRole('button', { name: taxMapRemoveLabel('通信費') }));
    const dialog = await screen.findByRole('dialog', { name: taxMapRemoveTitle('通信費') });
    fireEvent.click(within(dialog).getByRole('button', { name: TAX_MAP_TEXT.removeConfirm }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(BUSY);
    expect(screen.getByRole('dialog', { name: taxMapRemoveTitle('通信費') })).toBe(dialog);

    fireEvent.click(within(dialog).getByRole('button', { name: TAX_MAP_TEXT.removeConfirm }));
    expect(await within(section()).findByText(taxMapRemoved('通信費'))).toBeTruthy();
    expect(mapCalls(calls, 'DELETE')).toHaveLength(2);
  });
});
