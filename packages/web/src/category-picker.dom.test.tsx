// @vitest-environment jsdom

/**
 * 科目選択の表示契約。
 *
 * この画面で一番効くのは「何を選べばいいか考えずに済むこと」なので、
 * (1) 一覧をスクロールさせない (2) 押す前に判断材料が出る (3) 確定申告の科目が取込前でも選べる
 * の3点を固定する。
 */
import { buildCandidates } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CategoryPicker } from './components/CategoryPicker.js';

afterEach(cleanup);

/** freee 取込済みの科目と、MF の家計大項目がある状態 */
const candidates = buildCandidates(
  ['外注費', '支払手数料'],
  [
    { big: '食費', mid: '外食' },
    { big: '日用品', mid: '' },
  ],
  [{ scope: 'biz', major: 'AIツール費', mid: '' }],
);

function Harness({
  scope = 'biz' as 'biz' | 'per',
  clearLabel,
}: { scope?: 'biz' | 'per'; clearLabel?: string }) {
  const [v, setV] = useState({ big: '', mid: '' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <CategoryPicker
        candidates={candidates}
        scope={scope}
        big={v.big}
        mid={v.mid}
        onChange={setV}
        clearLabel={clearLabel}
      />
      <output>{v.big || '(未指定)'}</output>
    </QueryClientProvider>
  );
}

const open = (label = '科目を選ぶ') => fireEvent.click(screen.getByRole('button', { name: label }));
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const picked = () => screen.getByRole('status').textContent;

describe('事業の科目選択', () => {
  it('一覧はプルダウンではなくボタンで、クリックだけで選べる', () => {
    // 確定申告の科目まで入ると30を超える。縦に並べるとスクロールなしでは選べない
    render(<Harness />);
    open();
    tab('よく使う');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '外注工賃' }));
    expect(picked()).toBe('外注工賃');
  });

  it('取込済みの科目が最初のタブに出る', () => {
    // 自分が実際に使った科目が一番選ばれやすい。分類を開かせない
    render(<Harness />);
    open();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: '外注費' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'AIツール費' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '使ったことがある' }).getAttribute('aria-selected')).toBe('true');
  });

  it('取込前でも確定申告の標準科目を選べる', () => {
    const none = buildCandidates([], [], []);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CategoryPicker candidates={none} scope="biz" big="" mid="" onChange={() => {}} />
      </QueryClientProvider>,
    );
    open();
    expect(screen.getByRole('tab', { name: 'よく使う' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: '使ったことがある' })).toBeNull();
    expect(screen.getByRole('button', { name: '旅費交通費' })).toBeTruthy();
  });

  it('分類を押すとその用途の科目に切り替わる', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('tab', { name: '移動・打合せ' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: '会議費' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: '通信費' })).toBeNull();
  });

  it('科目に触れると、選ぶ基準と自分の仕事に即した例が出る', () => {
    // 科目名だけでは選べない。押す前に判断材料を同じ画面に出す
    render(<Harness />);
    open();
    tab('よく使う');
    fireEvent.focus(screen.getByRole('button', { name: '外注工賃' }));
    expect(screen.getByText(/雇っていない人・会社に仕事を頼んで払った/)).toBeTruthy();
    expect(screen.getByText('業務委託のエンジニアへの開発費')).toBeTruthy();
  });

  it('迷ったときの基準が常に出ている', () => {
    render(<Harness />);
    open();
    expect(screen.getByText('迷ったら')).toBeTruthy();
    expect(screen.getByText(/毎月続く契約\(回線・SaaS\) → 通信費/)).toBeTruthy();
    expect(screen.getByText(/一貫性/)).toBeTruthy();
  });

  it('入力した支払先から科目を先回りして勧める', () => {
    // 「何を選べばいいか」を考えさせないのが要件。当てはまるときだけ出す
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CategoryPicker
          candidates={candidates}
          scope="biz"
          big=""
          mid=""
          onChange={() => {}}
          hintText="Anthropic Claude 月額"
        />
      </QueryClientProvider>,
    );
    open();
    expect(screen.getByText('入力内容から')).toBeTruthy();
    expect(screen.getByRole('button', { name: '消耗品費' })).toBeTruthy();
  });

  it('当てはまらない支払先では勧めない', () => {
    // 推測で決め打ちすると、間違いに気づけないまま毎月それを選び続ける
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CategoryPicker
          candidates={candidates}
          scope="biz"
          big=""
          mid=""
          onChange={() => {}}
          hintText="〇〇商店"
        />
      </QueryClientProvider>,
    );
    open();
    expect(screen.queryByText('入力内容から')).toBeNull();
  });

  it('候補にない科目の追加口は残す', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: '候補にない科目を追加' }));
    expect(screen.getByPlaceholderText('勘定科目名(例: 通信費)')).toBeTruthy();
  });
});

describe('家計の科目選択', () => {
  it('確定申告の科目は家計側に出さない', () => {
    // 事業と家計でマスタを分ける。事業の科目が混ざると集計がずれる
    render(<Harness scope="per" />);
    open();
    expect(screen.getByRole('button', { name: '食費' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '外注工賃' })).toBeNull();
  });

  it('取込前でも住宅・税・保険を選べる', () => {
    // 家の購入や固定資産税は一生で数回しか出ない。その場で費目を考えさせない
    const none = buildCandidates([], [], []);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CategoryPicker candidates={none} scope="per" big="" mid="" onChange={() => {}} />
      </QueryClientProvider>,
    );
    open();
    tab('住まい');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: '住宅ローン' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: '住宅購入' })).toBeTruthy();
    tab('税・保険');
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: '保険' })).toBeTruthy();
  });

  it('家計側でも触れると基準と例が出る', () => {
    render(<Harness scope="per" />);
    open();
    tab('税・保険');
    fireEvent.focus(screen.getByRole('button', { name: '税・社会保障' }));
    expect(screen.getByText(/固定資産税がここに毎年入る/)).toBeTruthy();
  });

  it('大項目を選ぶと中項目を選べる', () => {
    render(<Harness scope="per" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: '食費' }));
    expect(picked()).toBe('食費');
    expect(within(screen.getByRole('combobox')).getByRole('option', { name: '外食' })).toBeTruthy();
  });
});

describe('指定を外せる画面', () => {
  it('未指定に戻せる(取込値やルールのままにする選択肢)', () => {
    render(<Harness clearLabel="科目を指定しない" />);
    open();
    tab('よく使う');
    fireEvent.click(screen.getByRole('button', { name: '外注工賃' }));
    expect(picked()).toBe('外注工賃');
    open('外注工賃'); // 現在値のボタンを押して開き直す
    fireEvent.click(screen.getByRole('button', { name: '科目を指定しない' }));
    expect(picked()).toBe('(未指定)');
  });
});
