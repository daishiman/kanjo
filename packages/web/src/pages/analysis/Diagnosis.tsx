/**
 * 診断画面のページ制御。
 * URL 状態・取得・判断の保存・rolling deploy 互換境界だけを持ち、表示責務は diagnosis/ に分ける。
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api-client.js';
import { type DiagnosisActionStatus, type DiagnosisResponse, type DiagnosisScreen, api } from '../../api.js';
import { PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';
import { DiagnosisActionTable } from './diagnosis/ActionTable.js';
import { DiagnosisConditions } from './diagnosis/Conditions.js';
import { DiagnosisDetailPanel } from './diagnosis/DetailPanel.js';
import { DiagnosisEvidenceTable } from './diagnosis/EvidenceTable.js';
import { DiagnosisImpactWaterfall } from './diagnosis/ImpactWaterfall.js';
import { DiagnosisLegacyStats } from './diagnosis/LegacyStats.js';
import { DiagnosisOutcome } from './diagnosis/Outcome.js';
import { DiagnosisResultCards } from './diagnosis/ResultCards.js';
import { DiagnosisSelectionBar } from './diagnosis/SelectionBar.js';
import { DiagnosisSignals } from './diagnosis/Signals.js';
import { COMPARES, METRICS, SCOPES, type UrlState } from './diagnosis/types.js';
import { choiceParam, patchSearchParams } from './url-state.js';
import './diagnosis.css';

function readUrl(params: URLSearchParams): UrlState {
  return {
    scope: choiceParam(
      params,
      'scope',
      SCOPES.map((item) => item.id),
      'total',
    ),
    metric: choiceParam(
      params,
      'metric',
      METRICS.map((item) => item.id),
      'expense',
    ),
    compare: choiceParam(
      params,
      'compare',
      COMPARES.map((item) => item.id),
      'previous',
    ),
    action: params.get('action') || null,
    done: params.get('done') === '1',
    stats: params.get('stats') === '1',
  };
}

function screenQuery(state: UrlState): string {
  const query = new URLSearchParams({ scope: state.scope, metric: state.metric });
  if (state.compare !== 'previous') query.set('compare', state.compare);
  return query.toString();
}

/** 新フィールドが揃う応答だけを新ブロックへ渡す。旧 Worker は従来表示へ落とす (rolling deploy) */
function screenOf(response: DiagnosisResponse): DiagnosisScreen | null {
  if (
    !response.selection ||
    !response.improvements ||
    !response.health ||
    !response.waterfall ||
    !response.signals ||
    !response.evidence ||
    !response.totals
  )
    return null;
  return {
    ...response,
    selection: response.selection,
    improvements: response.improvements,
    health: response.health,
    waterfall: response.waterfall,
    signals: response.signals,
    evidence: response.evidence,
    totals: response.totals,
    // 条件の帯の合計だけは後から足したフィールド。欠けていても新ブロックは出す
    scopeTotals: response.scopeTotals ?? null,
  };
}

export function DiagnosisPage() {
  const [params, setParams] = useSearchParams();
  const url = readUrl(params);
  const { key, withPeriod } = usePeriod();
  const queryClient = useQueryClient();
  const queryKey = ['diagnosis', key, url.scope, url.metric, url.compare];
  const query = useQuery({
    queryKey,
    queryFn: () => api<DiagnosisResponse>(withPeriod(`/diagnosis?${screenQuery(url)}`)),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<Record<keyof UrlState, string | null>>) => {
    setParams((previous) => patchSearchParams(previous, patch), { replace: true });
  };

  // 楽観更新しない (ADR-006)。保存が通ってから取り直した値で合計・棒・シグナルを描き直す
  const save = useMutation({
    mutationFn: (input: { actionKey: string; status: DiagnosisActionStatus; note: string | null }) =>
      api(`/diagnosis/actions/${encodeURIComponent(input.actionKey)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status, note: input.note }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diagnosis'] }),
  });

  if (query.isLoading) return <PageState status="loading" />;
  if (!query.data) return <PageState status="error" error={query.error} />;

  const response = query.data;
  const screen = screenOf(response);
  const hasImportedPeriod =
    response.entries.length > 0 ||
    Boolean(screen?.improvements.length) ||
    // 取込0件の応答は kpi/bep ごと欠けることがある。空状態の判定自体で落とさない
    (screen?.selection.metric !== 'expense' &&
      ((response.kpi?.months ?? 0) > 0 || (response.bep?.revenueMonths ?? 0) > 0));
  if (!hasImportedPeriod && !screen?.improvements.length) {
    return (
      <PageState
        status="empty"
        message="診断できるデータが未取込です。"
        action={
          <Link className="btn primary" to="/import">
            データ取込へ
          </Link>
        }
      />
    );
  }

  if (!screen) {
    // 旧 Worker の応答。新ブロックを出さず、従来の統計だけを開いた状態で見せる
    return (
      <div className="diagnosis">
        <DiagnosisLegacyStats data={response} open update={update} />
      </div>
    );
  }

  const requested = screen.improvements.find((row) => row.action_key === url.action) ?? null;
  const firstActive = screen.improvements.find((row) => row.status !== '対応済み' && row.status !== '見送り');
  // 最頻フローは「上位候補の根拠を読む」から始まる。URL 指定が無い初回だけ、
  // サーバ順位の先頭にある未対応 1 件を賢い既定として選ぶ。
  const requestedIsVisible =
    requested && (url.done || (requested.status !== '対応済み' && requested.status !== '見送り'));
  const selected =
    (requestedIsVisible ? requested : null) ??
    firstActive ??
    (url.done ? screen.improvements[0] : null) ??
    null;
  const saveError =
    save.error instanceof ApiError ? save.error.message : save.error ? '保存できませんでした' : null;

  return (
    <div className={`diagnosis${query.isPlaceholderData ? ' is-stale' : ''}`} aria-busy={query.isFetching}>
      <DiagnosisConditions screen={screen} update={update} />
      <div className="diagnosis-overview">
        <DiagnosisResultCards screen={screen} />
        <DiagnosisSignals signals={screen.signals} />
      </div>
      <div className="diagnosis-workspace">
        <DiagnosisActionTable
          improvements={screen.improvements}
          totals={screen.totals}
          selected={selected?.action_key ?? null}
          showDone={url.done}
          update={update}
        />
        {selected ? (
          <DiagnosisDetailPanel
            key={selected.action_key}
            row={selected}
            saving={save.isPending}
            error={saveError}
            onSave={({ status, note }) => save.mutate({ actionKey: selected.action_key, status, note })}
          />
        ) : (
          <section className="card diagnosis-detail diagnosis-detail-empty" aria-label="課題の詳細">
            <h2>選択した項目の詳細</h2>
            <p>未対応の改善アクションはありません。次回の取込後に診断結果が更新されます。</p>
            <Link to="/import">取込状況を確認する</Link>
          </section>
        )}
      </div>
      <DiagnosisImpactWaterfall waterfall={screen.waterfall} />
      <DiagnosisOutcome screen={screen} />
      <DiagnosisEvidenceTable evidence={screen.evidence} />
      <DiagnosisLegacyStats data={response} open={url.stats} update={update} />
      {selected && <DiagnosisSelectionBar row={selected} />}
    </div>
  );
}
