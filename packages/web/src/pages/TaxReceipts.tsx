/**
 * P17 領収書の残り: 証憑が付いていない事業経費を、緊急度の高い順に潰す。
 *
 * 一覧を金額順に出すだけだと「全部やらないと終わらない」画面になる。
 * 緊急度(core の receiptGapUrgency)で切って、まず要対応だけを出す。
 */
import { RECEIPT_GAP_URGENCY_LABEL, type ReceiptGapUrgency } from '@kanjo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { type TaxReceiptGapsResponse, api } from '../api.js';
import {
  AttachmentDisclosureCell,
  AttachmentDisclosureRow,
  useAttachmentDisclosure,
} from '../components/Attachments.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { ReceiptSourceProfilePanel } from '../components/ReceiptSourceProfile.js';
import { yen } from '../format.js';
import { useTaxYear } from '../tax-year.js';

const URGENCY_PILL: Record<ReceiptGapUrgency, string> = {
  must: 'pill alert',
  should: 'pill warn',
  optional: 'pill neutral',
};
const URGENCY_ORDER: ReceiptGapUrgency[] = ['must', 'should', 'optional'];

type Filter = ReceiptGapUrgency | 'all';

export function TaxReceiptsPage() {
  const qc = useQueryClient();
  const { key, withTaxYear } = useTaxYear();
  const attachments = useAttachmentDisclosure();
  const [filter, setFilter] = useState<Filter>('must');

  const q = useQuery({
    queryKey: ['tax-receipt-gaps', key],
    queryFn: () => api<TaxReceiptGapsResponse>(withTaxYear('/tax/receipt-gaps')),
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="taxReceipts" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="taxReceipts" />
        <PageState status="error" error={q.error} />
      </>
    );

  const { summary, rows, verdict, receiptArchive, year } = q.data;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.urgency === filter);

  return (
    <>
      <PageHeader route="taxReceipts" />
      <div className="tax-work-nav">
        <Link className="btn" to="/tax">
          ← {year}年の確定申告の準備へ戻る
        </Link>
      </div>

      <div className="kpis">
        <KpiCard
          label="添付率"
          value={`${Math.round(summary.coverage * 100)}%`}
          note={`対象 ${summary.requiredCount}件のうち ${summary.attachedCount}件`}
        />
        {URGENCY_ORDER.map((urgency) => (
          <KpiCard
            key={urgency}
            label={`未添付・${RECEIPT_GAP_URGENCY_LABEL[urgency]}`}
            value={`${summary.byUrgency[urgency].count}件`}
            note={yen(summary.byUrgency[urgency].amount)}
          />
        ))}
      </div>

      <div className="notice info">
        この画面で管理するのはマネーフォワード明細と事業現金の証憑です。freeeで記帳した仕訳の証憑はfreee側で確認してください。
      </div>

      {summary.requiredCount === 0 ? (
        <PageState
          status="empty"
          message={`${year}年には、このアプリで証憑を管理する事業支出がありません。`}
          action={
            <Link className="btn primary" to="/tax">
              準備チェックへ戻る
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <PageState
          status="empty"
          message={`${year}年の対象 ${summary.requiredCount}件には、R2原本を確認できた証憑がすべて揃っています。`}
          action={
            <div className="report-actions">
              {verdict !== 'blocked' ? (
                Array.from({ length: receiptArchive.parts }, (_, index) => index + 1).map((part) => (
                  <a
                    key={part}
                    className="btn primary"
                    href={withTaxYear(`/api/export/tax/receipts.zip?part=${part}`)}
                  >
                    証憑ZIP{receiptArchive.parts > 1 ? ` ${part}/${receiptArchive.parts}` : ''}
                  </a>
                ))
              ) : (
                <Link className="btn primary" to="/tax">
                  残りの要対応を確認
                </Link>
              )}
            </div>
          }
        />
      ) : (
        <>
          <section className="card">
            <div className="toolbar">
              <span>未添付の表示: </span>
              <div className="segment">
                {(['all', ...URGENCY_ORDER] as Filter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={filter === value ? 'active' : ''}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value === 'all'
                      ? `すべて(${rows.length})`
                      : `${RECEIPT_GAP_URGENCY_LABEL[value]}(${summary.byUrgency[value].count})`}
                  </button>
                ))}
              </div>
              <span className="sub">すべて揃うと証憑ZIPを書き出せます。</span>
            </div>

            <div className="scroll-x">
              <table className="data stack-sm tax-receipt-table">
                <thead>
                  <tr>
                    <th>緊急度</th>
                    <th>日付</th>
                    <th>内容</th>
                    <th>科目</th>
                    <th className="num">金額</th>
                    <th>証憑</th>
                    <th>取得先</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <Fragment key={row.txId}>
                      <tr>
                        <td data-label="緊急度">
                          <span className={URGENCY_PILL[row.urgency]}>
                            {RECEIPT_GAP_URGENCY_LABEL[row.urgency]}
                          </span>
                        </td>
                        <td data-label="日付">{row.date}</td>
                        <td className="tx-description" data-label="内容">
                          {row.description}
                        </td>
                        <td data-label="科目">{row.account}</td>
                        <td className="num" data-label="金額">
                          {yen(row.amount)}
                        </td>
                        <td data-label="証憑">
                          <AttachmentDisclosureCell
                            targetId={row.txId}
                            count={row.attachmentCount}
                            status={row.waived ? 'waived' : 'missing'}
                            severity={row.urgency === 'must' ? 'warn' : 'quiet'}
                            disclosure={attachments}
                          />
                        </td>
                        <td data-label="取得先">
                          <ReceiptSourceProfilePanel
                            targetId={row.txId}
                            merchant={row.description}
                            resolution={row.receiptSource}
                            withTaxYear={withTaxYear}
                            onSaved={() => {
                              void qc.invalidateQueries({ queryKey: ['tax-receipt-gaps'] });
                            }}
                          />
                        </td>
                      </tr>
                      <AttachmentDisclosureRow
                        targetId={row.txId}
                        colSpan={7}
                        disclosure={attachments}
                        onChanged={() => {
                          void qc.invalidateQueries({ queryKey: ['tax-receipt-gaps'] });
                          void qc.invalidateQueries({ queryKey: ['tax-overview'] });
                        }}
                      />
                    </Fragment>
                  ))}
                  {!shown.length && (
                    <tr>
                      <td colSpan={7} className="empty">
                        「{filter === 'must' ? '要対応' : filter === 'should' ? '推奨' : '後で確認'}
                        」の未添付はありません。別の絞り込みを選べます。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
