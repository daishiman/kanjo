import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button.js';
import { type DataColumn, DataTable } from '../../../components/DataTable.js';
import { UiIcon } from '../../../components/UiIcon.js';
import { yen } from '../../../format.js';
import { type ReconciliationRow, SUMMARY_PREVIEW_SIZE, slashDate } from './model.js';

export function ReconciliationSummaries({
  mfOnlyRows,
  reviewRows,
  onShowMfOnly,
  onShowReview,
}: {
  mfOnlyRows: readonly ReconciliationRow[];
  reviewRows: readonly ReconciliationRow[];
  onShowMfOnly: () => void;
  onShowReview: () => void;
}) {
  return (
    <div className="recon-lower">
      <SummaryCard
        id="recon-mf-only-title"
        title="MFにありfreeeにない支出"
        count={mfOnlyRows.length}
        description="総収支にはMFの金額で計上済みのため、照合の対応は要りません。区分が違う明細だけ仕分けで直します。"
        rows={mfOnlyRows}
        columns={['日付', '内容', { label: '金額', className: 'num' }, '口座・カード']}
        renderRow={(row) => (
          <tr key={row.txId}>
            <td className="nowrap">{slashDate(row.date)}</td>
            <td>{row.mf.content || '内容未設定'}</td>
            <td className="num">{yen(row.mf.amount)}</td>
            <td>{row.mf.institution || '—'}</td>
          </tr>
        )}
        onShowAll={onShowMfOnly}
        emptyMessage="MFにだけある支出はありません。"
        footer={
          <Link className="recon-lower-link" to="/classify?cls=biz">
            明細仕分けで区分を確かめる
            <UiIcon name="chevron-right" />
          </Link>
        }
      />
      <SummaryCard
        id="recon-review-title"
        title="自動一致できなかった候補"
        count={reviewRows.length}
        description="金額・日付・内容が近く、利用者の確認を待つ候補です。"
        rows={reviewRows}
        columns={['日付', '内容', { label: '金額', className: 'num' }, '理由']}
        renderRow={(row) => (
          <tr key={row.txId}>
            <td className="nowrap">{slashDate(row.date)}</td>
            <td>{row.mf.content || '内容未設定'}</td>
            <td className="num">{yen(row.mf.amount)}</td>
            <td>{row.reviewReason ?? '内容の確認が必要です'}</td>
          </tr>
        )}
        onShowAll={onShowReview}
        emptyMessage="確認を待つ候補はありません。"
        footer={
          <Link className="recon-lower-link" to="/import#import-history">
            データ取込を確認する
            <UiIcon name="chevron-right" />
          </Link>
        }
      />
    </div>
  );
}

function SummaryCard({
  id,
  title,
  count,
  description,
  rows,
  columns,
  renderRow,
  onShowAll,
  emptyMessage,
  footer,
}: {
  id: string;
  title: string;
  count: number;
  description: string;
  rows: readonly ReconciliationRow[];
  columns: readonly DataColumn[];
  renderRow: (row: ReconciliationRow) => ReactNode;
  onShowAll: () => void;
  emptyMessage: string;
  footer: ReactNode;
}) {
  const preview = rows.slice(0, SUMMARY_PREVIEW_SIZE);
  const remaining = Math.max(0, rows.length - preview.length);
  return (
    <section className="card recon-summary" aria-labelledby={id}>
      <h2 id={id}>
        {title} <span className="recon-count">{count}件</span>
      </h2>
      <p className="sub">{description}</p>
      {preview.length > 0 ? (
        <div className="scroll-x">
          <DataTable className="data recon-lower-table" columns={columns}>
            {preview.map(renderRow)}
          </DataTable>
        </div>
      ) : (
        <p className="recon-summary-empty">{emptyMessage}</p>
      )}
      <div className="recon-summary-actions">
        {remaining > 0 && (
          <Button variant="text" onClick={onShowAll}>
            残り{remaining}件を一覧で見る
            <UiIcon name="chevron-right" />
          </Button>
        )}
        {footer}
      </div>
    </section>
  );
}
