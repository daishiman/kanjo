import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type AiReportListResponse, api } from '../../api.js';
import { PageHeader } from '../../components/Page.js';
import { AiBackLink } from './AiBackLink.js';
import { AiReportDetail, reanalyzeHref } from './AiReportDetail.js';
import { AiReportList } from './AiReportList.js';
import { useAiReportTab } from './use-ai-report-tab.js';
import './ai.css';

export function AiReportLibraryPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const query = useQuery({
    queryKey: ['ai-reports', showArchived],
    queryFn: () => api<AiReportListResponse>(showArchived ? '/ai/reports?archived=1' : '/ai/reports'),
  });
  return (
    <div className="ai ai-detail-page">
      <AiBackLink to="/ai">AI分析へ戻る</AiBackLink>
      <PageHeader
        route="ai"
        title="保存済みレポート"
        lead="後から読み返すレポートを選びます"
        showTask={false}
      />
      <AiReportList
        query={query}
        showArchived={showArchived}
        onShowArchived={setShowArchived}
        onSelect={(id) => navigate(`/ai/reports/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}

export function AiReportPage() {
  const { reportId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab, setTab } = useAiReportTab();
  return (
    <div className="ai ai-detail-page">
      <AiBackLink to="/ai/reports">レポート一覧へ戻る</AiBackLink>
      <PageHeader
        route="ai"
        title="分析レポート"
        lead="要約・根拠・背景仮説・改善提案を確認します"
        showTask={false}
      />
      <AiReportDetail
        id={reportId}
        tab={tab}
        onTab={setTab}
        onOpen={(id) => navigate(`/ai/reports/${encodeURIComponent(id)}`)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ['ai-report'] })}
        onReanalyze={(value) => navigate(reanalyzeHref(value))}
      />
    </div>
  );
}
