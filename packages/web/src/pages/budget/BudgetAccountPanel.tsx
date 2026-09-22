/**
 * 科目パネル (spec-budget-screen §7.7)。
 *
 * 自動提案の値・計算の詳細・推奨の根拠・主な根拠データは core の `BudgetFigureRow` をそのまま出す。
 * 画面で持つのはタブの選択と、計画による調整の入力欄の受け渡しだけ。
 */
import { BUDGET_REASON_MAX, type BudgetBaseRow, type BudgetFigureRow } from '@kanjo/core';
import { useState } from 'react';
import { AccessibleTabs } from '../../components/AccessibleTabs.js';
import { Button } from '../../components/Button.js';
import type { BudgetFormRow } from './draft.js';
import { AMOUNT_ERROR, manYen, monthJa, niceTicks, signedPct, signedYen, yenOf } from './view-model.js';

type PanelTab = 'basis' | 'data';
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'basis', label: '提案の根拠' },
  { id: 'data', label: '関連データ' },
];

export interface BudgetAccountPanelProps {
  row: BudgetBaseRow;
  figure: BudgetFigureRow;
  form: BudgetFormRow;
  unsaved: boolean;
  adjustmentInvalid: boolean;
  appliedSuggestion: boolean;
  onClose: () => void;
  onApply: () => void;
  onRevert: () => void;
  onAdjustment: (value: string) => void;
  onAdjustmentBlur: () => void;
  onReason: (value: string) => void;
}

export function BudgetAccountPanel(props: BudgetAccountPanelProps) {
  const { row, figure, form } = props;
  const [tab, setTab] = useState<PanelTab>('basis');
  const basis = figure.suggestionBasis;
  const remaining = BUDGET_REASON_MAX - form.planReason.length;

  return (
    <aside className="card budget-panel" aria-labelledby="budget-panel-title">
      <div className="budget-panel-head">
        <h2 id="budget-panel-title">{row.account}</h2>
        <Button variant="text" size="mini" aria-label="科目パネルを閉じる" onClick={props.onClose}>
          ×
        </Button>
      </div>
      <AccessibleTabs
        ariaLabel="科目パネルの表示"
        idPrefix="budget-panel-tab"
        items={TABS}
        value={tab}
        onChange={setTab}
        ariaControls={(id) => `budget-panel-body-${id}`}
      />

      {tab === 'basis' ? (
        <div
          id="budget-panel-body-basis"
          role="tabpanel"
          aria-labelledby="budget-panel-tab-basis"
          className="budget-panel-body"
        >
          <p className="budget-suggestion-value">
            自動提案 {yenOf(figure.suggestion)}（前期差 {signedYen(figure.suggestion - row.prevActual)}）
          </p>
          <Button variant="primary" disabled={props.appliedSuggestion} onClick={props.onApply}>
            この値を適用
          </Button>

          <h3>推奨の根拠</h3>
          <p>{figure.basisText}</p>

          <h3>計算の詳細</h3>
          <dl className="budget-calc">
            <div>
              <dt>前期実績</dt>
              <dd>{yenOf(basis.prevActual)}</dd>
            </div>
            <div>
              <dt>増減率 (過去12か月)</dt>
              <dd>{signedPct(basis.growthRate)}</dd>
            </div>
            <div>
              <dt>計画による調整</dt>
              <dd>{signedYen(basis.planAdjustment)}</dd>
            </div>
            <div>
              <dt>季節性補正</dt>
              <dd>{signedYen(basis.seasonal)}</dd>
            </div>
            <div>
              <dt>推奨値</dt>
              <dd>{yenOf(figure.suggestion)}</dd>
            </div>
          </dl>

          <h3>計画による調整</h3>
          <div className="budget-adjust">
            <label>
              <span>調整額</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${row.account}の計画による調整額`}
                aria-invalid={props.adjustmentInvalid || undefined}
                value={form.planAdjustment}
                onChange={(event) => props.onAdjustment(event.target.value)}
                onBlur={props.onAdjustmentBlur}
              />
            </label>
            {props.adjustmentInvalid && <p className="budget-field-error">{AMOUNT_ERROR}</p>}
            <label>
              <span>理由</span>
              <input
                type="text"
                maxLength={BUDGET_REASON_MAX}
                aria-label={`${row.account}の調整の理由`}
                value={form.planReason}
                onChange={(event) => props.onReason(event.target.value)}
              />
            </label>
            <p className="budget-reason-count">残り {remaining} 字</p>
          </div>

          <h3>
            月別の実績推移 (過去12か月) <span className="budget-unit">（万円）</span>
          </h3>
          <RecentBars months={row.recentMonthly.slice(-12)} />

          <h3>主な根拠データ</h3>
          <ul className="budget-evidence">
            {figure.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <p className="budget-before">適用前の値 {yenOf(row.saved?.annualAmount ?? null)}</p>
          <Button disabled={!props.unsaved} onClick={props.onRevert}>
            この行を元に戻す
          </Button>
        </div>
      ) : (
        <div
          id="budget-panel-body-data"
          role="tabpanel"
          aria-labelledby="budget-panel-tab-data"
          className="budget-panel-body"
        >
          <table
            className="budget-mini-table"
            data-table-kind="matrix"
            data-sort-reason="月の推移を読む表なので、月順に固定する"
          >
            <caption>月別の実績（過去24か月）</caption>
            <thead>
              <tr>
                <th scope="col">月</th>
                <th scope="col" className="num">
                  実績
                </th>
              </tr>
            </thead>
            <tbody>
              {row.recentMonthly.slice(-24).map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthJa(m.month)}</th>
                  <td className="num">{yenOf(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table
            className="budget-mini-table"
            data-table-kind="matrix"
            data-sort-reason="月の推移を読む表なので、月順に固定する"
          >
            <caption>予算対象の月別の見通し</caption>
            <thead>
              <tr>
                <th scope="col">月</th>
                <th scope="col" className="num">
                  見通し
                </th>
                <th scope="col">区分</th>
              </tr>
            </thead>
            <tbody>
              {figure.forecastMonthly.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthJa(m.month)}</th>
                  <td className="num">{yenOf(m.amount)}</td>
                  <td>{m.actual ? '実績' : '見通し'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}

const BAR_W = 320;
const BAR_H = 120;

/** 直近 12 か月の月次実績の棒 (SVG の自前描画)。無い月は描かない */
function RecentBars({ months }: { months: { month: string; amount: number }[] }) {
  if (months.length === 0) return <p className="budget-empty-note">実績がありません。</p>;
  const ticks = niceTicks(
    Math.min(0, ...months.map((m) => m.amount)),
    Math.max(0, ...months.map((m) => m.amount)),
    3,
  );
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  const top = 8;
  const bottom = BAR_H - 20;
  const y = (v: number) => top + ((high - v) / (high - low || 1)) * (bottom - top);
  const slot = BAR_W / 12;
  return (
    <figure className="budget-recent">
      <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} role="img" aria-label="月別の実績推移" focusable="false">
        <line className="budget-axis-zero" x1={0} x2={BAR_W} y1={y(0)} y2={y(0)} />
        {months.map((m, i) => (
          <g key={m.month}>
            <rect
              className="budget-bar-recent"
              x={slot * i + slot * 0.2}
              width={slot * 0.6}
              y={Math.min(y(m.amount), y(0))}
              height={Math.abs(y(0) - y(m.amount))}
            >
              <title>{`${monthJa(m.month)} ${manYen(m.amount)}万円`}</title>
            </rect>
            <text className="budget-tick" x={slot * i + slot / 2} y={BAR_H - 6} textAnchor="middle">
              {Number(m.month.slice(5, 7))}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
