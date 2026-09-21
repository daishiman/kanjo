/**
 * 3. レポートの左上「レポート一覧」 (spec-ai-analysis-screen FR-7)。
 * 検索は取得済みの一覧に対する絞り込み (core `aiReportMatches`)。アーカイブの表示だけはサーバへ取り直す。
 */
import { aiDateTimeLabel, aiPeriodShortLabel, aiReportMatches } from '@kanjo/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { AiReportListResponse } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable, termColumn } from '../../components/DataTable.js';
import { describeError } from '../../components/Page.js';
import { AiSelectableRow } from './AiSelectableRow.js';

export function AiReportList({
  query,
  showArchived,
  onShowArchived,
  onSelect,
}: {
  query: UseQueryResult<AiReportListResponse>;
  showArchived: boolean;
  onShowArchived: (v: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const reports = query.data?.reports ?? [];
  const shown = reports.filter((r) => aiReportMatches(r, q));

  return (
    <section className="ai-panel" aria-labelledby="ai-report-list-title">
      <h3 id="ai-report-list-title">レポート一覧</h3>
      <div className="toolbar">
        <input
          type="search"
          aria-label="レポートを検索"
          placeholder="レポート名、内容で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="sub">
          <input type="checkbox" checked={showArchived} onChange={(e) => onShowArchived(e.target.checked)} />{' '}
          アーカイブを表示
        </label>
      </div>
      {query.isLoading ? (
        <p className="sub">レポートを読み込み中…</p>
      ) : query.isError ? (
        <div role="alert">
          <p className="sub">レポートを読み込めませんでした。{describeError(query.error)}</p>
          <Button size="mini" onClick={() => void query.refetch()}>
            再読込
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <p className="empty">まだレポートはありません</p>
      ) : shown.length === 0 ? (
        <p className="empty">「{q}」に当たるレポートはありません</p>
      ) : (
        <div className="scroll-x">
          <DataTable
            className="data ai-report-table"
            caption={<caption className="visually-hidden">取り込み済みのレポート</caption>}
            columns={[termColumn('reportVersion'), '作成日時', 'レポート名', '対象期間']}
          >
            {shown.map((r) => (
              <AiSelectableRow key={r.id} onSelect={() => onSelect(r.id)}>
                <td className="num">v{r.version}</td>
                <td className="num">{aiDateTimeLabel(r.createdAt)}</td>
                <td>
                  <Button
                    variant="text"
                    size="mini"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(r.id);
                    }}
                  >
                    {r.title}
                  </Button>
                  {r.archivedAt && <span className="pill neutral">アーカイブ</span>}
                </td>
                <td>{aiPeriodShortLabel(r.period.from, r.period.to)}</td>
              </AiSelectableRow>
            ))}
          </DataTable>
        </div>
      )}
      {!showArchived && (query.data?.archivedCount ?? 0) > 0 && (
        <p className="sub">アーカイブ中のレポートが {query.data?.archivedCount}件あります。</p>
      )}
    </section>
  );
}
