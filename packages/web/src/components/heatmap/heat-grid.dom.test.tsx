// @vitest-environment jsdom

/**
 * `HeatGrid` が仕様 §3.3 の制約を守っていることを固定する。
 *
 * 濃淡が 2 か所で別々に実装されていた原因は「正本が無かったこと」ではなく、
 * 変換層が計算済みの値を落としたことだった。ここで釘付けにするのは、部品が
 * 分母を持たないこと・色と外側レイアウトを親から受け取ることの 2 点である。
 * 「props に `max` が無い」は型が保証するのでテストに書けないが、
 * 塗りが `intensity` だけで決まることは DOM から確かめられる。
 */
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chartDecorativeFill } from '../charts.js';
import { HeatGrid } from './heat-grid.js';
import { type HeatRow, heatShade } from './heat-model.js';

afterEach(cleanup);

/** 期待色を実際のセルと同じ表現へ揃える（8 桁 16 進は DOM で `rgba(...)` へ正規化される） */
const asRendered = (css: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = css;
  return probe.style.backgroundColor;
};

const COLUMNS = ['1月', '2月'] as const;

const rows: HeatRow[] = [
  {
    key: 'ad',
    label: '広告宣伝費',
    cells: [
      { value: 240_000, intensity: 1 },
      { value: null, intensity: null },
    ],
  },
];

const renderGrid = (props: Partial<Parameters<typeof HeatGrid>[0]> = {}) =>
  render(
    <HeatGrid
      columns={[...COLUMNS]}
      rows={rows}
      rowHeader="科目"
      color="#0f766e"
      formatValue={(v) => `${v}円`}
      {...props}
    />,
  );

describe('HeatGrid', () => {
  it('塗りは intensity だけで決まる（同じ値でも intensity が違えば色が違う）', () => {
    const { container } = renderGrid({
      rows: [
        {
          key: 'a',
          label: 'A',
          cells: [
            { value: 240_000, intensity: 1 },
            { value: 240_000, intensity: 0 },
          ],
        },
      ],
    });
    const cells = container.querySelectorAll<HTMLTableCellElement>('td.heat');
    expect(cells[0]?.style.backgroundColor).toBe(asRendered(chartDecorativeFill('#0f766e', heatShade(1))));
    expect(cells[1]?.style.backgroundColor).toBe(asRendered(chartDecorativeFill('#0f766e', heatShade(0))));
    expect(cells[0]?.style.backgroundColor).not.toBe(cells[1]?.style.backgroundColor);
  });

  it('色は props で受け取る（部品内に固定しない）', () => {
    const { container } = renderGrid({ color: '#087f78' });
    const cell = container.querySelector<HTMLTableCellElement>('td.heat');
    expect(cell?.style.backgroundColor).toBe(asRendered(chartDecorativeFill('#087f78', heatShade(1))));
  });

  it('intensity が null のセルは塗らず、値も出さない', () => {
    const { container } = renderGrid();
    const cells = container.querySelectorAll<HTMLTableCellElement>('td.heat');
    expect(cells[1]?.getAttribute('style')).toBeNull();
    expect(cells[1]?.textContent).toBe('');
  });

  it('数値はセルの文字としても出る（色だけに情報を持たせない）', () => {
    const { container } = renderGrid();
    const cell = container.querySelector<HTMLTableCellElement>('td.heat');
    expect(cell?.textContent).toBe('240000円');
  });

  it('外側レイアウトのクラスは親が与える（部品が勝手に外枠を名乗らない）', () => {
    const { container } = renderGrid({ className: 'matrix-scroll' });
    expect(container.firstElementChild?.className).toBe('matrix-scroll');

    cleanup();
    const bare = renderGrid().container;
    expect(bare.firstElementChild?.className).toBe('');
  });

  it('行と列の見出しを見出しセルとして出す（読み上げで表として辿れる）', () => {
    const { container } = renderGrid();
    const table = container.querySelector('table') as HTMLTableElement;
    expect(within(table).getByText('科目').tagName).toBe('TH');
    expect(within(table).getByText('広告宣伝費').getAttribute('scope')).toBe('row');
    expect(within(table).getByText('1月').getAttribute('scope')).toBe('col');
  });

  it('選べるセルは button になる（マウスでしか選べない表にしない）', () => {
    const onSelect = vi.fn();
    const { container } = renderGrid({ onSelect, selected: { rowKey: 'ad', column: '1月' } });
    const buttons = container.querySelectorAll<HTMLButtonElement>('td.heat button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');

    buttons[1]?.click();
    expect(onSelect).toHaveBeenCalledWith('ad', '2月');
  });

  it('onSelect が無ければ押せる要素を作らない（選べない表に選択の印を出さない）', () => {
    const { container } = renderGrid();
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelector('td.heat')?.getAttribute('aria-pressed')).toBeNull();
  });
});
