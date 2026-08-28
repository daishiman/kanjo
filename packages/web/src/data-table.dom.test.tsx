// @vitest-environment jsdom

/**
 * 並べ替えできる表の表示契約。
 *
 * この部品は「画面に出ている文字を読んで、children の並びだけ差し替える」という作りなので、
 * 純関数のテスト(table-sort.test.ts)だけでは足りない。実際に描画してからでないと、
 * DOM を読む部分と React が行を作り直さない部分が確かめられない。
 *
 * 固定したいのは4点。
 * (1) 見出しを押すと行の並びが変わる (2) 3回押すと元の並びに戻る
 * (3) 合計行は動かない (4) 並べ替えても入力中のセルの中身が消えない
 * とくに(4)は、この表が公私仕分けや科目編集など「表の中で直接打つ」画面で使われるため、
 * 並べ替えのたびに打ちかけの文字が消えると機能そのものが使えなくなる。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataTable } from './components/DataTable.js';

afterEach(cleanup);

/** 各行の1列目(名前)を上から読む。合計行も含める */
const rowNames = (): string[] =>
  [...screen.getAllByRole('row')]
    .slice(1) // 見出し行を除く
    .map((tr) => (tr as HTMLTableRowElement).cells[0]?.textContent ?? '');

const clickHeader = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

const VENDORS = [
  { name: 'あんず', amount: '¥1,200' },
  { name: 'いちご', amount: '¥300' },
  { name: 'うめ', amount: '¥25,000' },
];

function Basic() {
  return (
    <DataTable
      columns={['支払先', { label: '金額', className: 'num' }, { label: '操作', sortable: false }]}
      foot={
        <tr className="total">
          <td>合計</td>
          <td className="num">¥26,500</td>
          <td />
        </tr>
      }
    >
      {VENDORS.map((v) => (
        <tr key={v.name}>
          <td>{v.name}</td>
          <td className="num">{v.amount}</td>
          <td>
            <button type="button">編集</button>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

describe('並べ替えできる表', () => {
  it('金額の見出しを押すと、小さい順・大きい順・元の順を繰り返す', () => {
    render(<Basic />);
    expect(rowNames()).toEqual(['あんず', 'いちご', 'うめ', '合計']);

    clickHeader('金額');
    expect(rowNames()).toEqual(['いちご', 'あんず', 'うめ', '合計']);

    clickHeader('金額');
    expect(rowNames()).toEqual(['うめ', 'あんず', 'いちご', '合計']);

    // 3回目で並べ替えを解除する。元の並びに意味がある表(日付順など)へ戻せないと困る
    clickHeader('金額');
    expect(rowNames()).toEqual(['あんず', 'いちご', 'うめ', '合計']);
  });

  it('合計行は並べ替えても最後に残る', () => {
    render(<Basic />);
    clickHeader('支払先');
    expect(rowNames().at(-1)).toBe('合計');
    clickHeader('支払先');
    expect(rowNames().at(-1)).toBe('合計');
  });

  it('並べ替えさせない列には押せる見出しを出さない', () => {
    render(<Basic />);
    expect(screen.queryByRole('button', { name: /操作/ })).toBeNull();
  });

  it('いま並べ替えている列と向きを読み上げに伝える', () => {
    render(<Basic />);
    const header = () => screen.getAllByRole('columnheader')[1];
    expect(header().getAttribute('aria-sort')).toBeNull();
    clickHeader('金額');
    expect(header().getAttribute('aria-sort')).toBe('ascending');
    clickHeader('金額');
    expect(header().getAttribute('aria-sort')).toBe('descending');
  });

  it('並べ替えても入力中のセルの中身が消えない', () => {
    function Editable() {
      const [memo, setMemo] = useState<Record<string, string>>({});
      return (
        <DataTable columns={['支払先', { label: '金額', className: 'num' }, '別名']}>
          {VENDORS.map((v) => (
            <tr key={v.name}>
              <td>{v.name}</td>
              <td className="num">{v.amount}</td>
              <td>
                <input
                  aria-label={`${v.name}の別名`}
                  value={memo[v.name] ?? ''}
                  onChange={(e) => setMemo((m) => ({ ...m, [v.name]: e.target.value }))}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      );
    }
    render(<Editable />);
    fireEvent.change(screen.getByLabelText('うめの別名'), { target: { value: '打ちかけ' } });

    clickHeader('金額');
    // 行は移動しただけで作り直されていないので、打ちかけの文字はそのまま残る
    expect((screen.getByLabelText('うめの別名') as HTMLInputElement).value).toBe('打ちかけ');
    expect(rowNames()).toEqual(['いちご', 'あんず', 'うめ']);
  });

  it('行が入れ替わったら、前の並び順を引きずらない', () => {
    function Filtered() {
      const [all, setAll] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setAll(false)}>
            絞り込む
          </button>
          <DataTable columns={['支払先', { label: '金額', className: 'num' }]}>
            {(all ? VENDORS : VENDORS.slice(1)).map((v) => (
              <tr key={v.name}>
                <td>{v.name}</td>
                <td className="num">{v.amount}</td>
              </tr>
            ))}
          </DataTable>
        </>
      );
    }
    render(<Filtered />);
    clickHeader('金額');
    expect(rowNames()).toEqual(['いちご', 'あんず', 'うめ']);

    fireEvent.click(screen.getByRole('button', { name: '絞り込む' }));
    // 絞り込んだ後も、残った行が金額の小さい順で並ぶ(古い並びを行数だけ合わせて使い回さない)
    expect(rowNames()).toEqual(['いちご', 'うめ']);
  });
});
