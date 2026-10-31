// @vitest-environment jsdom

/**
 * 決算書画面の受入 (spec-statements-screen §7 の DOM)。
 *
 * - 上部の 3 項目は「見た目はタブ・意味はページ内ナビ」。role=tab を持たず、3 節は隠さず描画し、
 *   選んだ項目だけ aria-current="location" で、該当節の見出しへフォーカスを移す。選択は URL に残す。
 * - 行の選択は aria-pressed のボタン。選んだ行は URL の row に残す。
 * - 負債残高だけは残高 (時点の値) なので `前月末比` で、減少を良化色にする。現金増減には % を出さない。
 * - 負債は 3 状態。下書きは同じ利用者・同じ月だけに復元し、リセットで消える。未保存バーは件数を出す。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatementsResponse } from './api.js';
import { StatementsPage } from './pages/Statements.js';
import { draftKey } from './pages/statements/liability-draft.js';
import { availableCf, liabilityLines, statementsPayload } from './test-support/statements-fixture.js';

vi.mock('react-chartjs-2', () => ({
  Chart: ({
    'aria-label': ariaLabel,
    options,
  }: {
    'aria-label'?: string;
    options?: { plugins?: { legend?: { display?: boolean } } };
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-chart-legend={String(options?.plugins?.legend?.display ?? true)}
    />
  ),
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderWith(data: StatementsResponse = statementsPayload(), path = '/statements') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/auth/me'))
        return json({ authenticated: true, user: { id: 'u1', email: 'owner@example.test' } });
      return json(data);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StatementsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ready = () => screen.findByRole('heading', { name: '損益計算書（PL）' });
const nav = () => screen.getByRole('navigation', { name: '計算書' });
const comparison = (kind: 'flow' | 'cash' | 'stock') =>
  [...document.querySelectorAll(`[data-kpi-comparison="${kind}"]`)] as HTMLElement[];
const form = () => screen.getByRole('form', { name: '負債残高の入力' });
const lineGroup = (label: RegExp) => within(form()).getByRole('group', { name: label });

/** クレジット未払を 0 円で保存済みにした負債 (負債残高 2,300,000・前月末 2,500,000) */
const completeLines = () =>
  liabilityLines().map((line) =>
    line.category === 'クレジットカード未払金' ? { ...line, status: 'zero' as const, amount: 0 } : line,
  );

beforeEach(() => {
  localStorage.clear();
  // jsdom は scrollIntoView を持たない。呼ばれたことだけを記録する
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('見出しと期間', () => {
  it('問いの見出しと説明文、対象期間を出す', async () => {
    renderWith();
    await ready();
    expect(
      await screen.findByRole('heading', { level: 1, name: '損益・資金・残高は、整合していますか？' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '損益計算書・キャッシュフロー計算書・貸借対照表のつながりを確認し、決算の整合性をチェックしましょう。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('2025年9月 - 2026年8月', { selector: '.period-range-label' })).toBeTruthy();
    // データの最終月まで来ているので、次の期間へは進めない
    expect((screen.getByRole('button', { name: '次の期間へ' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '前の期間へ' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ページ内ナビ', () => {
  it('タブの意味論を使わず、3 節をすべて描画したまま選んだ節の見出しへフォーカスを移す', async () => {
    renderWith();
    await ready();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
    const links = within(nav()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      '損益計算書',
      'キャッシュフロー計算書',
      '貸借対照表',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(['location', null, null]);

    fireEvent.click(within(nav()).getByRole('link', { name: 'キャッシュフロー計算書' }));

    const cf = screen.getByRole('heading', { name: 'キャッシュフロー計算書（CF）' });
    expect(document.activeElement).toBe(cf);
    expect(
      within(nav()).getByRole('link', { name: 'キャッシュフロー計算書' }).getAttribute('aria-current'),
    ).toBe('location');
    expect(within(nav()).getByRole('link', { name: '損益計算書' }).getAttribute('aria-current')).toBeNull();
    expect(search().get('tab')).toBe('cf');
    // 隠さない: PL と BS も描画されたまま
    expect(screen.getByRole('heading', { name: '損益計算書（PL）' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '貸借対照表（BS）' })).toBeTruthy();
  });

  it('共有された URL の ?tab= の節へ、読み込み後にフォーカスを移す', async () => {
    renderWith(statementsPayload(), '/statements?tab=bs');
    await ready();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: '貸借対照表（BS）' })),
    );
    expect(within(nav()).getByRole('link', { name: '貸借対照表' }).getAttribute('aria-current')).toBe(
      'location',
    );
  });
});

describe('損益計算書の行の選択', () => {
  it('既定は売上高で、選んだ行を aria-pressed と URL に残し、詳細パネルを切り替える', async () => {
    renderWith();
    await ready();
    const table = screen.getByRole('table', { name: '損益計算書の当期と前期の比較' });
    const select = (name: string) => within(table).getByRole('button', { name });
    expect(select('売上高').getAttribute('aria-pressed')).toBe('true');
    expect(select('営業利益').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(select('営業利益'));

    expect(select('営業利益').getAttribute('aria-pressed')).toBe('true');
    expect(select('売上高').getAttribute('aria-pressed')).toBe('false');
    expect(search().get('row')).toBe('operating');
    const panel = screen.getByRole('complementary', { name: '項目の詳細' });
    expect(within(panel).getByText('営業利益 ＝ 売上総利益 − 販管費')).toBeTruthy();
    // 計算行には開く明細が無い
    expect((within(panel).getByRole('button', { name: '明細を開く ↗' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(within(panel).getByRole('button', { name: '項目の詳細を閉じる' }));
    expect(screen.queryByRole('complementary', { name: '項目の詳細' })).toBeNull();
    expect(select('営業利益').getAttribute('aria-pressed')).toBe('false');
  });

  it('URL の row から選択を復元する', async () => {
    renderWith(statementsPayload(), '/statements?row=sga');
    await ready();
    const panel = screen.getByRole('complementary', { name: '項目の詳細' });
    expect(within(panel).getByText('販管費', { selector: '.stmt-detail-name' })).toBeTruthy();
    // 主な内訳は当期金額の大きい順に 3 件
    expect(
      within(panel)
        .getAllByRole('listitem')
        .slice(0, 3)
        .map((item) => item.firstChild?.textContent),
    ).toEqual(['地代家賃', '通信費', '消耗品費']);
  });

  it('区分の行は明細仕分けへのリンクを出す', async () => {
    renderWith(statementsPayload(), '/statements?row=sales');
    await ready();
    const panel = screen.getByRole('complementary', { name: '項目の詳細' });
    const link = within(panel).getByRole('link', { name: '明細を開く ↗' });
    expect(link.getAttribute('href')).toBe(
      `/classify?${new URLSearchParams({ category: '売上高', month: '2026-08' }).toString()}`,
    );
  });

  it('計算行の内訳も screen の accounts を正とする', async () => {
    const data = statementsPayload();
    const operating = data.screen.pl.rows.find((row) => row.key === 'operating');
    if (!operating) throw new Error('営業利益行がありません');
    operating.accounts = [
      { account: '粗利益（API定義）', current: 4_620_000, previous: 4_120_000, ratio: 0.37 },
      { account: '販管費（API定義）', current: -2_800_000, previous: -2_620_000, ratio: -0.22 },
    ];
    renderWith(data, '/statements?row=operating');
    await ready();
    const panel = screen.getByRole('complementary', { name: '項目の詳細' });
    expect(within(panel).getByText('粗利益（API定義）')).toBeTruthy();
    expect(within(panel).getByText('販管費（API定義）')).toBeTruthy();
  });

  it('詳細パネルの月別推移は、月を横軸に並べた縦棒で出す', async () => {
    renderWith(statementsPayload(), '/statements?row=sales');
    await ready();
    const panel = screen.getByRole('complementary', { name: '項目の詳細' });
    const trend = within(panel).getByRole('list', { name: '売上高の月別の推移' });
    expect(within(trend).getAllByRole('listitem')).toHaveLength(12);
    const bars = [...trend.querySelectorAll<HTMLElement>('.stmt-bar')];
    expect(bars.every((bar) => bar.style.height !== '' && bar.style.width === '')).toBe(true);
  });
});

describe('KPI', () => {
  it('売上高は前期比を金額と % で出す', async () => {
    renderWith();
    await ready();
    const [sales, operating] = comparison('flow');
    expect(sales?.textContent).toBe('▲ 前期比 +¥1,240,000 (+11.0%)');
    expect(operating?.textContent).toBe('▲ 前期比 +¥320,000 (+21.3%)');
  });

  it('負債残高は前月末比で、減少を良化色にする', async () => {
    renderWith(statementsPayload({ lines: completeLines() }));
    await ready();
    const [liabilities] = comparison('stock');
    expect(liabilities?.textContent).toBe('▼ 前月末比 −¥200,000 (−8.0%)');
    // format.ts の deltaCls: 減少は neg (良化色)。売上高などの gainCls とは向きが逆
    expect(liabilities?.classList.contains('neg')).toBe(true);
    expect(liabilities?.classList.contains('pos')).toBe(false);
    expect(screen.getByText('基準日：2026年8月末')).toBeTruthy();
  });

  it('必須の負債に未入力があれば、負債残高に合計を出さない', async () => {
    renderWith();
    await ready();
    expect(screen.getByText('未入力あり')).toBeTruthy();
    expect(comparison('stock')[0]?.textContent).toBe('前月末比 —');
  });

  it('現金増減には % を出さない', async () => {
    renderWith(statementsPayload({ cf: availableCf }));
    await ready();
    const [cash] = comparison('cash');
    expect(cash?.textContent).toBe('▲ 前期比 +¥120,000');
    expect(cash?.textContent).not.toContain('%');
  });

  it('? で計算式を開閉できる', async () => {
    renderWith();
    await ready();
    const help = screen.getByRole('button', { name: '営業利益の説明' });
    expect(help.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
    const note = document.getElementById(help.getAttribute('aria-controls') ?? '');
    expect(note?.hidden).toBe(false);
    expect(note?.textContent).toContain('営業利益');
  });

  it('4つの数字に、意味の異なるアイコンを添える', async () => {
    renderWith();
    await ready();
    expect(document.querySelectorAll('.stmt-kpis .kpi-icon .ui-icon')).toHaveLength(4);
  });
});

describe('損益の推移図', () => {
  it('見出しと凡例はそれぞれ1か所だけにする', async () => {
    renderWith();
    await ready();
    expect(screen.getAllByRole('heading', { name: '月別の損益推移' })).toHaveLength(1);
    expect(screen.getAllByRole('list', { name: '図の系列' })).toHaveLength(1);
    expect(
      screen
        .getByRole('img', { name: '月別の売上高、売上原価、営業利益の推移を示す図' })
        .getAttribute('data-chart-legend'),
    ).toBe('false');
  });

  it('直下の月次PL表と正確値を二重表示しない', async () => {
    renderWith();
    await ready();
    const heading = screen.getByRole('heading', { name: '月別の損益推移' });
    const figure = heading.closest('figure');
    expect(figure).not.toBeNull();
    if (!figure) throw new Error('月別の損益推移 figure がありません');

    expect(within(figure).queryByText('正確な値を表で確認')).toBeNull();
    expect(figure.querySelector('[data-financial-action]')).toBeNull();
    expect(screen.getByRole('table', { name: '月次の損益計算書（万円）' })).toBeTruthy();
  });

  it('項目の詳細はPL表と推移図の共通グリッドに置く', async () => {
    renderWith();
    await ready();
    const detail = screen.getByRole('heading', { name: '項目の詳細' }).closest('aside');
    const trend = screen.getByRole('heading', { name: '月別の損益推移' }).closest('figure');
    expect(detail).not.toBeNull();
    expect(trend).not.toBeNull();
    expect(detail?.parentElement).toBe(trend?.parentElement);
    expect(detail?.parentElement?.classList.contains('has-detail')).toBe(true);
  });

  it('月次PLはcoreの円値を万円表示し、合計も期間合計と一致する', async () => {
    renderWith();
    await ready();
    const table = screen.getByRole('table', { name: '月次の損益計算書（万円）' });
    const sales = within(table).getByRole('row', { name: /^売上高 / });
    const values = within(sales)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(values[0]).toBe('95');
    expect(values.at(-1)).toBe('1,248');
  });
});

describe('参照画像の意味記号', () => {
  it('PLの書き出し・図の単位と、CF/BSの状態記号を表示する', async () => {
    renderWith();
    await ready();

    const exportButton = screen.getByRole('button', { name: 'PLをエクスポート' });
    expect(exportButton.querySelector('[data-stmt-icon="download"]')).toBeTruthy();

    const trend = screen.getByRole('heading', { name: '月別の損益推移' }).closest('figure');
    expect(trend).not.toBeNull();
    expect(trend?.querySelector('.stmt-pl-trend-unit')?.textContent).toBe('(万円)');

    const cf = document.getElementById('cf');
    const bs = document.getElementById('bs');
    expect(cf?.querySelector('[data-stmt-icon="info"]')).toBeTruthy();
    expect(bs?.querySelector('.stmt-banner [data-stmt-icon="alert"]')).toBeTruthy();
  });

  it('下書き・リセット・未保存の状態記号を表示する', async () => {
    renderWith();
    await ready();

    const distinction = screen.getByText('0円と未入力は区別されます');
    expect(distinction.closest('p')?.querySelector('[data-stmt-icon="distinction"]')).toBeTruthy();

    fireEvent.click(within(form()).getByRole('button', { name: '負債残高を保存' }));
    const missing = await screen.findByText('クレジット未払の入力方法を選択してください。');
    expect(missing.closest('p')?.querySelector('[data-stmt-icon="field-alert"]')).toBeTruthy();

    fireEvent.click(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' }));
    const bar = screen.getByRole('region', { name: '未保存の入力' });
    expect(bar.querySelector('[data-stmt-icon="alert"]')).toBeTruthy();
    expect(
      within(bar).getByRole('button', { name: 'リセット' }).querySelector('[data-stmt-icon="reset"]'),
    ).toBeTruthy();
    expect(
      within(form()).getByRole('button', { name: 'リセット' }).querySelector('[data-stmt-icon="reset"]'),
    ).toBeTruthy();

    await waitFor(() => expect(form().querySelector('[data-stmt-icon="saved"]')).toBeTruthy(), {
      timeout: 2000,
    });
  });
});

describe('キャッシュフロー計算書', () => {
  it('PLの比較・詳細・推移と、CFの原因・解決をひとまとまりとして読める', async () => {
    renderWith();
    await ready();

    expect(screen.getByRole('group', { name: '損益の比較・詳細・推移' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '主な原因' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '解決方法' })).toBeTruthy();
  });

  it('集計できないときは、0 でない原因だけを件数付きで出す', async () => {
    renderWith();
    await ready();
    expect(screen.getByText('キャッシュフロー計算書は、現在集計できていません。')).toBeTruthy();
    const causes = screen.getByRole('heading', { name: '主な原因' }).nextElementSibling as HTMLElement;
    expect(
      within(causes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '未仕訳の取引が残っている（12件）',
      '現金口座データが一部取り込まれていない（1か月）',
      '取引の勘定科目が正しく設定されていない（3件）',
    ]);
    expect(screen.getByRole('link', { name: '取引データを確認 ↗' }).getAttribute('href')).toBe('/classify');
  });

  it('集計できるときは、概算の表を出す', async () => {
    renderWith(statementsPayload({ cf: availableCf }));
    await ready();
    expect(screen.queryByText('キャッシュフロー計算書は、現在集計できていません。')).toBeNull();
    expect(screen.getByRole('table', { name: 'キャッシュフローの月別明細' })).toBeTruthy();
    expect(
      screen
        .getByRole('img', { name: '月別の利益と営業キャッシュフローの比較図' })
        .getAttribute('data-chart-legend'),
    ).toBe('false');
  });
});

describe('負債残高の入力', () => {
  it('3 状態から選び、0円と未入力を区別する', async () => {
    renderWith();
    await ready();
    const group = lineGroup(/クレジット未払/);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['unset', 'zero', 'amount']);
    // 保存済みで未入力の必須項目は、どれも選んでいない状態から始める (未入力のままでよいかを選ばせる)
    expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(false);
    expect(within(lineGroup(/借入金/)).getByRole('radio', { name: '金額を入力' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(lineGroup(/借入金/)).getByLabelText('借入金の金額')).toHaveProperty('value', '2,000,000');
    expect(within(group).getByText('必須')).toBeTruthy();
    expect(within(lineGroup(/その他の負債/)).queryByText('必須')).toBeNull();
    expect(screen.getByText('0円と未入力は区別されます')).toBeTruthy();
  });

  it('変えた項目の数を未保存バーに出し、リセットで保存済みの値へ戻す', async () => {
    renderWith();
    await ready();
    expect(screen.queryByRole('region', { name: '未保存の入力' })).toBeNull();

    fireEvent.click(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' }));
    fireEvent.click(within(lineGroup(/その他の負債/)).getByRole('radio', { name: '0円' }));

    const bar = screen.getByRole('region', { name: '未保存の入力' });
    expect(within(bar).getByText('未保存の項目が 2 件あります')).toBeTruthy();

    // 同じ値に戻したものは数えない
    fireEvent.click(within(lineGroup(/その他の負債/)).getByRole('radio', { name: '金額を入力' }));
    fireEvent.change(within(lineGroup(/借入金/)).getByLabelText('借入金の金額'), {
      target: { value: '2000000' },
    });
    expect(within(bar).getByText('未保存の項目が 2 件あります')).toBeTruthy();

    fireEvent.click(within(bar).getByRole('button', { name: 'リセット' }));
    expect(screen.queryByRole('region', { name: '未保存の入力' })).toBeNull();
    expect(
      within(lineGroup(/クレジット未払/))
        .getAllByRole('radio')
        .some((radio) => (radio as HTMLInputElement).checked),
    ).toBe(false);
  });

  it('入力が止まると下書きを自動保存し、開き直すと復元する', async () => {
    renderWith();
    await ready();
    fireEvent.click(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' }));
    await waitFor(() => expect(screen.getByText(/下書きを自動保存しました \d\d:\d\d/)).toBeTruthy(), {
      timeout: 2000,
    });
    const stored = JSON.parse(localStorage.getItem(draftKey('u1', '2026-08')) ?? 'null');
    expect(stored.lines['クレジットカード未払金']).toEqual({ status: 'zero', amount: '' });

    cleanup();
    renderWith();
    await ready();
    await waitFor(() =>
      expect(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' })).toHaveProperty(
        'checked',
        true,
      ),
    );
    expect(screen.getByText('未保存の項目が 1 件あります')).toBeTruthy();

    // リセットは下書きも消す (次に開いても戻らない)
    fireEvent.click(within(form()).getByRole('button', { name: 'リセット' }));
    expect(localStorage.getItem(draftKey('u1', '2026-08'))).toBeNull();
  });

  it('別の利用者の下書きは復元しない', async () => {
    localStorage.setItem(
      draftKey('someone-else', '2026-08'),
      JSON.stringify({
        savedAt: '2026-09-19T10:00:00.000Z',
        lines: { クレジットカード未払金: { status: 'zero', amount: '' } },
      }),
    );
    renderWith();
    await ready();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(within(lineGroup(/クレジット未払/)).getByRole('radio', { name: '0円' })).toHaveProperty(
      'checked',
      false,
    );
    expect(screen.queryByRole('region', { name: '未保存の入力' })).toBeNull();
  });

  it('必須がそろっている月はフォームを閉じて始め、開閉ボタンで開く', async () => {
    renderWith(statementsPayload({ lines: completeLines() }));
    await ready();
    const toggle = screen.getByRole('button', { name: '入力フォームを開く ⌄' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('form', { name: '負債残高の入力' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: '入力フォームを閉じる ⌃' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByRole('form', { name: '負債残高の入力' })).toBeTruthy();
  });

  it('フォームを閉じていても、復元した下書きの未保存バーを出し、保存できなければフォームを開く', async () => {
    localStorage.setItem(
      draftKey('u1', '2026-08'),
      JSON.stringify({
        savedAt: '2026-09-19T10:00:00.000Z',
        lines: {
          借入金: { status: 'amount', amount: '3万' },
          未払金・買掛金: { status: 'amount', amount: '300,000' },
          クレジットカード未払金: { status: 'zero', amount: '' },
          その他の負債: { status: null, amount: '' },
        },
      }),
    );
    renderWith(statementsPayload({ lines: completeLines() }));
    await ready();
    expect(screen.queryByRole('form', { name: '負債残高の入力' })).toBeNull();
    const bar = await screen.findByRole('region', { name: '未保存の入力' });
    expect(within(bar).getByText('未保存の項目が 1 件あります')).toBeTruthy();
    // 打ち間違いは送らず、直す場所 (フォーム) を開く
    fireEvent.click(within(bar).getByRole('button', { name: '負債残高を保存' }));
    expect(screen.getByRole('form', { name: '負債残高の入力' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '入力フォームを閉じる ⌃' })).toBeTruthy();
  });
});

describe('貸借対照表の図', () => {
  const bsSection = () => document.getElementById('bs') as HTMLElement;

  it('必須の負債に未入力が残る間は、純資産の図を出さない (前の月の図にも差し替えない)', async () => {
    renderWith();
    await ready();
    expect(bsSection().querySelector('.financial-figure')).toBeNull();
    expect(within(bsSection()).getByRole('form', { name: '負債残高の入力' })).toBeTruthy();
  });

  it('そろった月は、表と同じ基準月の図を出す', async () => {
    renderWith(statementsPayload({ lines: completeLines(), asOf: '2026-08-31', partial: false }));
    await ready();
    const figure = bsSection().querySelector('.financial-figure') as HTMLElement;
    expect(figure).toBeTruthy();
    expect(figure.textContent).toContain('2026-08-31時点');
    expect(figure.textContent).not.toContain('2026-07-31');
  });
});
