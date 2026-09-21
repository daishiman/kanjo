/**
 * キャッシュフロー計算書 (CF) (spec §1.9)。
 *
 * 集計できない (core の cf.status='unavailable') ときは表とグラフを出さず、原因と解決方法を出す。
 * 原因は core が数えた件数のうち 0 でないものだけ (偽の原因を出さない)。
 * 集計できるときは既存の営業 CF 概算の表とグラフを出す。投資 CF・財務 CF は出さない (scope.out)。
 */
import type { StatementsScreen } from '@kanjo/core';
import { Link } from 'react-router-dom';
import { DataTable, termColumn } from '../../components/DataTable.js';
import { CashFlowCharts } from '../../components/FinancialCharts.js';
import { UiIcon } from '../../components/UiIcon.js';
import { gainCls, monthShort, yen, yenS } from '../../format.js';
import { cfCauseLines } from './view-model.js';

const STEPS = [
  'データ取込で最新の取引データを取り込む',
  '明細仕分けで仕訳を完了する',
  '再度この画面を開いて確認する',
] as const;

function Unavailable({
  causes,
}: { causes: Extract<StatementsScreen['cf'], { status: 'unavailable' }>['causes'] }) {
  const lines = cfCauseLines(causes);
  return (
    <>
      <div className="notice info stmt-banner">
        <span className="stmt-banner-copy">
          <UiIcon name="info" className="ui-icon stmt-status-icon" data-stmt-icon="info" />
          <output className="lines">
            <strong>キャッシュフロー計算書は、現在集計できていません。</strong>
            <br />
            現金の入出金を分類するための取込データが不足しています。
            <br />
            正しく表示するには、すべての入出金取引の仕訳を完了してください。
          </output>
        </span>
        <Link className="btn" to="/classify">
          取引データを確認 ↗
        </Link>
      </div>
      <div className="stmt-cf-help">
        {lines.length ? (
          <section aria-labelledby="stmt-cf-causes-title">
            <h3 id="stmt-cf-causes-title">主な原因</h3>
            <ul className="stmt-cause-list">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="stmt-cf-steps-title">
          <h3 id="stmt-cf-steps-title">解決方法</h3>
          <ol className="stmt-steps">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function Available({ cf }: { cf: Extract<StatementsScreen['cf'], { status: 'available' }> }) {
  if (!cf.months.length) return <p className="sub">記帳のある月がありません。</p>;
  return (
    <>
      <p className="sub lines">
        利益から、まだ入金されていない売上 (入金待ち) を引き、まだ払っていない経費 (支払待ち)
        を足し戻した概算です。
        <br />
        投資・財務のキャッシュフローは含みません。
      </p>
      <CashFlowCharts cf={cf} />
      <div className="table-heading compact">
        <h3>月別の照合表</h3>
        <span className="table-unit">単位: 円</span>
      </div>
      <div className="scroll-x">
        <DataTable
          className="data stack-sm"
          caption={<caption className="visually-hidden">キャッシュフローの月別明細</caption>}
          columns={[
            '月',
            '利益',
            '入金待ち(増)',
            '支払待ち(増)',
            termColumn('operatingCf', { className: 'num' }),
            '累計',
          ]}
        >
          {cf.months.map((month, index) => (
            <tr key={month.month}>
              <th scope="row">{monthShort(month.month)}</th>
              <td className={`num ${gainCls(month.profit)}`} data-label="利益">
                {yenS(month.profit)}
              </td>
              <td className="num" data-label="入金待ち(増)">
                {yen(month.receivableIncrease)}
              </td>
              <td className="num" data-label="支払待ち(増)">
                {yen(month.payableIncrease)}
              </td>
              <td className={`num ${gainCls(month.operating)}`} data-label="営業キャッシュフロー">
                {yenS(month.operating)}
              </td>
              <td className={`num ${gainCls(cf.cumulative[index])}`} data-label="累計">
                {yenS(cf.cumulative[index])}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">合計</th>
            <td className="num" data-label="利益">
              —
            </td>
            <td className="num" data-label="入金待ち(増)">
              —
            </td>
            <td className="num" data-label="支払待ち(増)">
              —
            </td>
            <td className={`num ${gainCls(cf.total)}`} data-label="営業キャッシュフロー">
              {yenS(cf.total)}
            </td>
            <td className={`num ${gainCls(cf.total)}`} data-label="累計">
              {yenS(cf.total)}
            </td>
          </tr>
        </DataTable>
      </div>
    </>
  );
}

export function StatementsCf({
  cf,
  headingRef,
}: {
  cf: StatementsScreen['cf'];
  headingRef: (element: HTMLHeadingElement | null) => void;
}) {
  return (
    <section id="cf" className="card stmt-section" aria-labelledby="stmt-cf-title">
      <h2 id="stmt-cf-title" tabIndex={-1} ref={headingRef}>
        キャッシュフロー計算書（CF）
      </h2>
      {cf.status === 'unavailable' ? <Unavailable causes={cf.causes} /> : <Available cf={cf} />}
    </section>
  );
}
