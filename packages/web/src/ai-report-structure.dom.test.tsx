// @vitest-environment jsdom

/**
 * AI分析レポートの本文の見え方。
 * 「文章が一続きで並んでいて読めない」を直した3点を固定する:
 * - 箇条書きを持たない本文(箇条書き規約より前に作られたレポート)は1文1行へ割る
 * - 箇条書きを持つ本文のリード文は割らない(二重に箇条書きにしない)
 * - 要点カードは項目名つきで、根拠は既定で畳む(最初に読む量を減らす)
 * 架空のレポートだけを使い、実データには触れない。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiReportFinding } from './api.js';
import { FindingList, ReportText } from './pages/Ai.js';

afterEach(cleanup);

const finding = (over: Partial<AiReportFinding> = {}): AiReportFinding => ({
  label: '個人支出の58.2%が名義未設定',
  fact: '個人支出 4,999,627円 のうち名義未設定が 2,908,372円(58.2%)。事業名義は 2,091,255円(41.8%)。妻名義の支出は 0円。',
  basis: 'household.byOwner の対象期間合計',
  interpretation:
    '妻名義の収入が 39.0% あるのに支出が 0円 なのは不自然。名義未設定の5機関に妻の支出が含まれる可能性がある。この状態では負担割合を確定できない。',
  action: '設定画面で4機関に名義を割り当てる',
  expectedEffect: null,
  amount: 2908372,
  priority: 'high',
  chart: null,
  ...over,
});

describe('本文の構造化', () => {
  it('箇条書きの無い本文は1文1行へ割り、閉じ括弧を次の行の頭へ送らない', () => {
    const { container } = render(
      <ReportText text="事業経費は 808,399円(月平均 62,185円)。図2のとおり上位3科目で 71.0% を占める。削減の緊急性は低い。" />,
    );
    const lines = container.querySelectorAll('ul.prose-lines > li');
    expect(lines.length).toBe(3);
    // 「(月平均 62,185円)。」の閉じ括弧は1行目に残る
    expect(lines[0].textContent).toBe('事業経費は 808,399円(月平均 62,185円)。');
    expect(lines[2].textContent).toBe('削減の緊急性は低い。');
    // 割った結果は段落として残さない(同じ文が2回出ない)
    expect(container.querySelectorAll('.report-text > p').length).toBe(0);
  });

  it('2文までは段落のまま出す(短い本文を無理に割らない)', () => {
    const { container } = render(<ReportText text="経費率は 13.6%。目安の下限を下回る。" />);
    expect(container.querySelector('ul.prose-lines')).toBeNull();
    expect(container.querySelectorAll('.report-text > p').length).toBe(1);
  });

  it('箇条書きを持つ本文のリード文は段落のまま置く', () => {
    const { container } = render(
      <ReportText
        text={
          '対象期間の経費は前月比で増加した。増加分の大半は外注費で説明できる。内訳は次のとおり。\n' +
          '- 外注費が 2,040,000円 で 41.0%\n' +
          '- 地代家賃は 1,440,000円 で 28.9%'
        }
      />,
    );
    // リード文は3文あるが、箇条書きがあるので割らない
    expect(container.querySelector('ul.prose-lines')).toBeNull();
    expect(container.querySelectorAll('.report-text > p').length).toBe(1);
    expect(container.querySelectorAll('.report-text > ul > li').length).toBe(2);
  });
});

describe('要点カードの読む順', () => {
  it('事実は項目名つきで1文1行になり、根拠は畳んだ中に入る', () => {
    const { container } = render(<FindingList title="改善すべき点" items={[finding()]} note="" />);
    const part = container.querySelector('.finding-part');
    expect(part?.querySelector('.finding-tag')?.textContent).toBe('事実');
    expect(part?.querySelectorAll('ul.prose-lines > li').length).toBe(3);

    // 根拠(計算に使ったキー)は最初は見えない
    const more = container.querySelector('details.finding-more');
    expect(more).toBeTruthy();
    expect((more as HTMLDetailsElement).open).toBe(false);
    expect(more?.textContent).toContain('household.byOwner');
    // 畳んだ中にあるので、カード直下には出ていない
    expect(container.querySelector('.finding-card > .finding-basis')).toBeNull();
  });

  it('優先度が高くない要点は解釈も畳み、最初に見えるのは事実と次の一手だけにする', () => {
    const { container } = render(
      <FindingList title="無駄なコスト" items={[finding({ priority: 'low' })]} note="" />,
    );
    const tags = [...container.querySelectorAll('.finding-tag')].map((el) => el.textContent);
    expect(tags).toEqual(['事実']);
    const more = container.querySelector('details.finding-more');
    expect(more?.textContent).toContain('妻名義の収入が');
    // 次の一手は畳まず、カードの中に残す
    expect(container.querySelector('.finding-action')?.textContent).toContain(
      '設定画面で4機関に名義を割り当てる',
    );
  });

  it('優先度が高い要点だけは解釈も最初から見せる', () => {
    const { container } = render(<FindingList title="改善すべき点" items={[finding()]} note="" />);
    const tags = [...container.querySelectorAll('.finding-tag')].map((el) => el.textContent);
    expect(tags).toEqual(['事実', '解釈']);
  });

  it('0件の区分は理由を添えて1行で終える', () => {
    render(<FindingList title="すぐ効く対策" items={[]} note="今月中に金額が確定する対策が無い" />);
    expect(screen.getByText('なし: 今月中に金額が確定する対策が無い')).toBeTruthy();
  });
});
