// @vitest-environment jsdom

/**
 * 対象期間の選択の契約。
 *
 * 期間はデータが積み上がるほど効いてくる設定なので、
 * 「選び直せなくならない」ことと「選択が問い合わせに届く」ことを固定する。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PeriodProvider, parseSelection, selectionToQuery, usePeriod } from './period.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** 選択の結果としてサーバへ渡るパスを画面に出すだけの確認用 */
function Probe() {
  const { withPeriod, key } = usePeriod();
  return (
    <output>
      {withPeriod('/summary')} | {key}
    </output>
  );
}

describe('期間の選択をクエリにする', () => {
  it('全期間はパラメータを付けない', () => {
    expect(selectionToQuery({ mode: 'all' })).toBe('');
  });
  it('年・直近n年・任意期間はそれぞれの形になる', () => {
    expect(selectionToQuery({ mode: 'year', year: '2025' })).toBe('year=2025');
    expect(selectionToQuery({ mode: 'span', span: 2 })).toBe('span=2');
    expect(selectionToQuery({ mode: 'custom', from: '2025-04', to: '2026-03' })).toBe(
      'from=2025-04&to=2026-03',
    );
  });
});

describe('保存された選択の読み込み', () => {
  it('壊れた保存値は全期間に倒す', () => {
    // 選択が読めないだけで画面が出ないのが一番困る
    expect(parseSelection('not json')).toEqual({ mode: 'all' });
    expect(parseSelection('{"mode":"year","year":"20xx"}')).toEqual({ mode: 'all' });
    expect(parseSelection('{"mode":"span","span":7}')).toEqual({ mode: 'all' });
    expect(parseSelection('{"mode":"custom","from":"2026-05","to":"2026-01"}')).toEqual({ mode: 'all' });
    expect(parseSelection(null)).toEqual({ mode: 'all' });
  });

  it('正しい保存値はそのまま復元する', () => {
    expect(parseSelection('{"mode":"year","year":"2025"}')).toEqual({ mode: 'year', year: '2025' });
  });
});

describe('選択の共有', () => {
  it('保存された選択が問い合わせのパスに乗る', () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'year', year: '2025' }));
    render(
      <PeriodProvider>
        <Probe />
      </PeriodProvider>,
    );
    expect(screen.getByRole('status').textContent).toContain('/summary?year=2025');
  });

  it('選び直すと次の問い合わせに反映され、保存もされる', () => {
    render(
      <PeriodProvider>
        <Probe />
        <Setter />
      </PeriodProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '直近2年にする' }));
    expect(screen.getByRole('status').textContent).toContain('/summary?span=2');
    expect(localStorage.getItem('kanjo:period')).toBe(JSON.stringify({ mode: 'span', span: 2 }));
  });

  it('Provider の外でも落ちず、全期間として振る舞う', () => {
    // Provider を足し忘れた画面が白くなるより、全期間で出るほうが害が小さい
    render(<Probe />);
    expect(screen.getByRole('status').textContent).toContain('/summary |');
  });
});

function Setter() {
  const { setSelection } = usePeriod();
  return (
    <button type="button" onClick={() => setSelection({ mode: 'span', span: 2 })}>
      直近2年にする
    </button>
  );
}
