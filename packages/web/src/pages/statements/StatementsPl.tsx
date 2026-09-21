/**
 * 損益計算書 (PL) カード・項目の詳細パネル・月別の推移・月次表 (spec §1.5-§1.8)。
 *
 * 数字は core の screen.pl.rows だけから読む。ここでするのは表示の丸めと、選択・展開の状態だけ。
 */
import type { StatementsPlRow, StatementsRowKey, StatementsScreen } from '@kanjo/core';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { StatementsPlTrendChart } from '../../components/FinancialCharts.js';
import { Term } from '../../components/Term.js';
import { UiIcon } from '../../components/UiIcon.js';
import { useDismissablePopover } from '../../components/use-dismissable-popover.js';
import { monthShort, yen, yenS } from '../../format.js';
import { HelpTip } from './HelpTip.js';
import { csvText, downloadCsv, statementsPlCsvRows } from './statements-csv.js';
import { classifyLink, manText, monthlyTotalMan, ratioText, shortRange, signedYen } from './view-model.js';

/** 売上高・売上総利益・営業利益は太字 (画像どおり) */
const STRONG_ROWS: ReadonlySet<StatementsRowKey> = new Set(['sales', 'gross', 'operating']);
const RATIO_HELP = '構成比 ＝ 各行の当期金額 ÷ 売上高です。売上高を 100.0% とします。';

function diffText(diff: number | null): string {
  return diff === null ? '—' : signedYen(diff);
}

/** 行の金額。利益の行はマイナスになりうるので符号つきで出す */
function amountText(row: StatementsPlRow, value: number | null): string {
  if (value === null) return '—';
  return row.key === 'gross' || row.key === 'operating' ? yenS(value) : yen(value);
}

function ExportMenu({ screen }: { screen: StatementsScreen }) {
  const [open, setOpen] = useState(false);
  const host = useDismissablePopover<HTMLSpanElement>(open, setOpen);

  const exportCsv = () => {
    const name = `損益計算書_${screen.period.from}_${screen.period.to}.csv`;
    downloadCsv(name, csvText(statementsPlCsvRows(screen)));
    setOpen(false);
  };

  return (
    <span className="popover-host" ref={host}>
      <button
        data-native-control="menu-trigger"
        type="button"
        className="btn stmt-icon-button"
        aria-label="PLをエクスポート"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UiIcon name="download" className="ui-icon stmt-action-icon" data-stmt-icon="download" />
        <span aria-hidden="true">エクスポート ▾</span>
      </button>
      {open ? (
        <span className="popover" role="menu">
          <Button role="menuitem" onClick={exportCsv}>
            CSV
          </Button>
        </span>
      ) : null}
    </span>
  );
}

function PlTable({
  screen,
  selected,
  onSelect,
}: {
  screen: StatementsScreen;
  selected: StatementsRowKey | null;
  onSelect: (row: StatementsRowKey) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<StatementsRowKey>>(() => new Set());
  const toggle = (key: StatementsRowKey) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const period = screen.period;

  return (
    <div className="scroll-x">
      <table
        className="data statement-table stmt-pl-table"
        data-table-kind="hierarchy"
        data-sort-reason="損益計算書の区分の順序 (売上高→営業利益) を固定する"
      >
        <caption className="visually-hidden">損益計算書の当期と前期の比較</caption>
        <thead>
          <tr>
            <th scope="col">勘定科目</th>
            <th scope="col" className="num">
              <span className="stmt-period-head">
                <span>当期</span>
                <span>({shortRange(period)})</span>
              </span>
            </th>
            <th scope="col" className="num">
              <span className="stmt-period-head">
                <span>前期</span>
                <span>({shortRange(period.previous)})</span>
              </span>
            </th>
            <th scope="col" className="num">
              差額
            </th>
            <th scope="col" className="num">
              <span className="stmt-kpi-label">
                <Term id="share" />
                <HelpTip label="構成比" text={RATIO_HELP} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {screen.pl.rows.map((row) => {
            const open = expanded.has(row.key);
            const isSelected = selected === row.key;
            const computed = row.key === 'gross' || row.key === 'operating';
            return (
              <Fragment key={row.key}>
                <tr
                  className={`${STRONG_ROWS.has(row.key) ? 'total ' : ''}${isSelected ? 'stmt-selected' : ''}`.trim()}
                  data-row={row.key}
                >
                  <th scope="row">
                    <span className="stmt-row-head">
                      <button
                        data-native-control="disclosure"
                        type="button"
                        className="stmt-expand"
                        aria-expanded={open}
                        aria-label={`${row.label}の内訳を${open ? '閉じる' : '開く'}`}
                        onClick={() => toggle(row.key)}
                      >
                        <span aria-hidden="true">›</span>
                      </button>
                      <Button
                        variant="text"
                        className="stmt-row-select"
                        aria-pressed={isSelected}
                        onClick={() => onSelect(row.key)}
                      >
                        {row.label}
                      </Button>
                    </span>
                  </th>
                  <td className="num">{amountText(row, row.current)}</td>
                  <td className="num">{amountText(row, row.previous)}</td>
                  <td className="num">{diffText(row.diff)}</td>
                  <td className="num">{ratioText(row.ratio)}</td>
                </tr>
                {open && computed ? (
                  <tr className="stmt-detail-row">
                    <th scope="row" className="stmt-account">
                      計算式
                    </th>
                    <td colSpan={4}>{row.formula}</td>
                  </tr>
                ) : null}
                {open && !computed && row.accounts.length === 0 ? (
                  <tr className="stmt-detail-row">
                    <th scope="row" className="stmt-account">
                      内訳なし
                    </th>
                    <td colSpan={4}>この期間に該当する勘定科目の仕訳がありません。</td>
                  </tr>
                ) : null}
                {open && !computed
                  ? row.accounts.map((account) => (
                      <tr key={`${row.key}/${account.account}`} className="stmt-detail-row">
                        <th scope="row" className="stmt-account">
                          {account.account}
                        </th>
                        <td className="num">{yen(account.current)}</td>
                        <td className="num">{account.previous === null ? '—' : yen(account.previous)}</td>
                        <td className="num">
                          {diffText(account.previous === null ? null : account.current - account.previous)}
                        </td>
                        <td className="num">{ratioText(account.ratio)}</td>
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {/* 画面の利益は帳簿の集計のまま。申告書の数字と比べて迷わないよう、何の前の数字かを表の直下で言う */}
      <p className="sub stmt-note">
        営業利益の構成比が、そのまま売上高営業
        <Term id="profitMargin" />
        です。金額は
        <Term id="houseworkSplit" />・<Term id="closingAdjust" />
        の前の集計なので、確定申告の最終値とは一致しません。
      </p>
    </div>
  );
}

function DetailPanel({
  row,
  lastMonth,
  onClose,
}: {
  row: StatementsPlRow;
  lastMonth: string;
  onClose: () => void;
}) {
  const computed = row.key === 'gross' || row.key === 'operating';
  const top = [...row.accounts].sort((a, b) => b.current - a.current).slice(0, 3);
  const link = classifyLink(row, lastMonth);
  // 棒の長さは期間内の最大の絶対値を 100% とする (負の月は注意色で出す)
  const peak = Math.max(1, ...row.monthly.map((point) => Math.abs(point.amount)));

  return (
    <aside className="card stmt-detail" aria-labelledby="stmt-detail-title">
      <div className="stmt-card-head">
        <h3 id="stmt-detail-title">項目の詳細</h3>
        <Button variant="text" size="mini" aria-label="項目の詳細を閉じる" onClick={onClose}>
          ×
        </Button>
      </div>
      <p className="stmt-detail-name">{row.label}</p>
      <p className="stmt-detail-value">{amountText(row, row.current)}</p>
      <dl className="stmt-detail-list">
        <div>
          <dt>計算式</dt>
          <dd>{row.formula}</dd>
        </div>
        <div>
          <dt>主な内訳の勘定科目</dt>
          <dd>
            {computed && row.accounts.length ? (
              <ul className="stmt-plain-list">
                {row.accounts.map((account) => (
                  <li key={account.account}>{account.account}</li>
                ))}
              </ul>
            ) : top.length ? (
              <ul className="stmt-plain-list">
                {top.map((account) => (
                  <li key={account.account}>
                    <span>{account.account}</span>
                    <span className="num">{yen(account.current)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              '該当する勘定科目がありません'
            )}
          </dd>
        </div>
        <div>
          <dt>月別の推移（万円）</dt>
          <dd>
            <ul className="stmt-bars" aria-label={`${row.label}の月別の推移`}>
              {row.monthly.map((point) => (
                <li key={point.month}>
                  <span className="stmt-bar-month">{monthShort(point.month)}</span>
                  <span className="stmt-bar-track" aria-hidden="true">
                    <span
                      className={`stmt-bar${point.amount < 0 ? ' is-negative' : ''}`}
                      style={{ height: `${(Math.abs(point.amount) / peak) * 100}%` }}
                    />
                  </span>
                  <span className="stmt-bar-value num">{manText(point.amount)}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>データの出典</dt>
          <dd>{row.source}</dd>
        </div>
        <div>
          <dt>関連データ</dt>
          <dd>
            {link ? (
              <Link className="btn" to={link}>
                明細を開く ↗
              </Link>
            ) : (
              <Button
                disabled
                title={
                  computed
                    ? '計算で求める行のため、開く明細がありません'
                    : 'この期間に該当する勘定科目の仕訳がありません'
                }
              >
                明細を開く ↗
              </Button>
            )}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function MonthlyTable({ rows }: { rows: StatementsPlRow[] }) {
  const months = rows[0]?.monthly.map((point) => point.month) ?? [];
  if (!months.length) return null;
  return (
    <section className="card stmt-monthly" aria-labelledby="stmt-monthly-title">
      <div className="stmt-card-head">
        <h3 id="stmt-monthly-title">月次の損益計算書（PL）</h3>
        <span className="table-unit">(万円)</span>
      </div>
      <div className="scroll-x">
        <table
          className="data statement-table"
          data-table-kind="hierarchy"
          data-sort-reason="損益計算書の区分の順序と月の並びを固定する"
        >
          <caption className="visually-hidden">月次の損益計算書（万円）</caption>
          <thead>
            <tr>
              <th scope="col">勘定科目</th>
              {months.map((month) => (
                <th key={month} scope="col" className="num">
                  {monthShort(month)}
                </th>
              ))}
              <th scope="col" className="num">
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={STRONG_ROWS.has(row.key) ? 'total' : undefined}>
                <th scope="row">{row.label}</th>
                {row.monthly.map((point) => (
                  <td key={point.month} className="num">
                    {manText(point.amount)}
                  </td>
                ))}
                {/* 円で足してから丸める (丸めた月の値を足すと合計がずれる) */}
                <td className="num">{monthlyTotalMan(row.monthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatementsPl({
  screen,
  selected,
  onSelect,
  onClose,
  headingRef,
}: {
  screen: StatementsScreen;
  /** null は詳細パネルを閉じている状態 */
  selected: StatementsRowKey | null;
  onSelect: (row: StatementsRowKey) => void;
  onClose: () => void;
  headingRef: (element: HTMLHeadingElement | null) => void;
}) {
  const row = selected ? screen.pl.rows.find((candidate) => candidate.key === selected) : undefined;
  return (
    <section id="pl" className="stmt-section" aria-labelledby="stmt-pl-title">
      <fieldset className={`stmt-pl-grid${row ? ' has-detail' : ''}`}>
        <legend className="visually-hidden">損益の比較・詳細・推移</legend>
        <div className="card stmt-pl-card">
          <div className="stmt-card-head">
            <div>
              <h2 id="stmt-pl-title" tabIndex={-1} ref={headingRef}>
                損益計算書（PL）
              </h2>
              {/* 行名を押しても画面は移らない (右の詳細が変わる)。何が起きるかを先に伝える */}
              <p className="sub">
                当期と前期の比較で、損益の状況を確認できます。区分名を選ぶと、内訳と計算式をこの画面で見られます。
              </p>
            </div>
            <ExportMenu screen={screen} />
          </div>
          <PlTable screen={screen} selected={row ? row.key : null} onSelect={onSelect} />
        </div>
        {row ? <DetailPanel row={row} lastMonth={screen.period.to} onClose={onClose} /> : null}
        <StatementsPlTrendChart rows={screen.pl.rows} />
      </fieldset>
      <MonthlyTable rows={screen.pl.rows} />
    </section>
  );
}
