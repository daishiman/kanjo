/**
 * 数値の図をひとつ包む共通の枠。
 *
 * 中身の並びは 見出し → 結論 → 期間と単位 → 凡例 → 図 → 次の行動 → 正確な値の表 で固定する。
 * 「結論 → 根拠 → 検算」の順にしたのは、数字を読み慣れていない利用者が図だけを見て
 * 判断を作れないため。先に1文で結論を言い、図はその裏づけ、表は確かめたい人のための検算に置く。
 * 図の中(canvas)は読み上げ・拡大・コピーのいずれもできないので、同じ数値が必ず
 * テキスト側にも存在する構造にしてある(model.rows がその正本)。
 *
 * この並びは全画面で同じにする。図ごとに順番が違うと、利用者は毎回どこを読むか探し直すことになる。
 * 数値の作り方・表記は figure-view-model.ts に閉じていて、ここは描くだけ。
 */
import { type CSSProperties, type ReactNode, useId } from 'react';
import type { FinancialFigureModel, FinancialFigureUnit } from './figure-view-model.js';

interface FinancialFigureProps {
  model: FinancialFigureModel;
  children: ReactNode;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  chartClassName?: string;
  anchorId?: string;
  beforeChart?: ReactNode;
  afterChart?: ReactNode;
  /**
   * 検算用の表を出さない。
   * 図そのものが表であるヒートマップだけの逃げ道で、同じ数字を転置して2回並べないため。
   * 使う側は、図の中に読める表があることを保証すること。
   */
  hideDetails?: boolean;
}

const UNIT_LABELS: Record<FinancialFigureUnit, string> = {
  yen: '円',
  pct: '%',
  count: '件数',
};

export function FinancialFigure({
  model,
  children,
  headingLevel = 3,
  className,
  chartClassName,
  anchorId,
  beforeChart,
  afterChart,
  hideDetails = false,
}: FinancialFigureProps) {
  const generatedId = useId().replaceAll(':', '');
  const id = `${model.id}-${generatedId}`;
  const titleId = `${id}-title`;
  const summaryId = `${id}-summary`;
  const tableId = `${id}-table`;
  const Heading = `h${headingLevel}` as const;

  return (
    <figure
      id={anchorId}
      className={['financial-figure', className].filter(Boolean).join(' ')}
      data-financial-figure
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <figcaption className="financial-figure__caption">
        <Heading id={titleId}>{model.title}</Heading>
      </figcaption>
      <p className="financial-figure__summary" id={summaryId} data-financial-summary>
        {model.summary}
      </p>
      <dl className="financial-figure__meta">
        <div>
          <dt>期間</dt>
          <dd data-financial-period>{model.period}</dd>
        </div>
        <div>
          <dt>単位</dt>
          <dd data-financial-unit>{model.unitLabel}</dd>
        </div>
      </dl>
      {/*
       * 系列が1本でもこのリストは残す。1件でも「図に描かれているのが何か」を canvas の外で
       * 名指しする唯一の場所で、7要素(見出し・結論・期間・単位・系列・行動・表)の1つだから。
       * 値ごとに色が変わる系列(増減の赤緑など)は color を持たないので、チップは色を主張しない。
       */}
      <ul className="financial-figure__series" data-financial-series aria-label="図の系列">
        {model.summarySeries.map((series) => (
          <li key={series.key}>
            <span
              aria-hidden="true"
              // 色は図のデータセットと同じ出どころ。CSS 側は var(--series-color, currentColor) で受ける
              style={series.color ? ({ '--series-color': series.color } as CSSProperties) : undefined}
            />
            {series.label}
          </li>
        ))}
      </ul>
      {beforeChart}
      <div className={['financial-figure__chart', chartClassName].filter(Boolean).join(' ')}>{children}</div>
      {afterChart}
      <p className="financial-figure__action" data-financial-action>
        <strong>次の行動:</strong> {model.action}
      </p>
      {!hideDetails && (
        <details className="financial-figure__details">
          <summary aria-controls={tableId}>正確な値を表で確認</summary>
          <div className="financial-figure__table-frame" id={tableId}>
            <div
              className="financial-figure__table-scroll"
              // biome-ignore lint/a11y/useSemanticElements: 局所的な二軸scroll領域を明示的な名前付きregionにする。
              role="region"
              aria-label={model.tableLabel}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: overflow表をキーボードでスクロールできるようにする。
              tabIndex={0}
            >
              <table className="data">
                <caption className="visually-hidden">{model.tableLabel}</caption>
                <thead>
                  <tr>
                    <th scope="col">{model.rowHeader}</th>
                    {model.series.map((series) => (
                      <th scope="col" className="num" key={series.key}>
                        {series.label}
                        <span className="visually-hidden">（{UNIT_LABELS[series.unit ?? 'yen']}）</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {row.cells.map((cell, index) => (
                        <td className="num" key={model.series[index]?.key ?? index}>
                          {cell.text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </figure>
  );
}
