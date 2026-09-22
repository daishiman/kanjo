/**
 * 3. 取込内容の確認 と 4. 取込結果 (spec の同名節)。
 * 要約の数は core の importInspectionSummary、結果の文は importResultHeadline が決める。
 * 取込後の引き継ぎ (重複の要確認・サブスク候補) は旧画面の案内をそのまま持ち込む。
 */
import {
  IMPORT_SOURCE_SHORT,
  autoRegisterable,
  formatImportPeriod,
  importExclusionNote,
  importResultHeadline,
} from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api-client.js';
import type { SubsCandidate, TotalCashflowResponse } from '../../api.js';
import { Button } from '../../components/Button.js';
import type { ImportCommitOutcome } from './use-import-files.js';
import type { ImportSummaryView } from './view-model.js';

export function ImportSummaryStep({ view }: { view: ImportSummaryView }) {
  const summary = view.kind === 'ready' ? view.summary : null;
  const pending = view.kind === 'checking' ? '検査中' : '-';
  const note = summary ? importExclusionNote(summary.errorCount) : null;
  const items: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: '対象ファイル',
      value: summary ? `${summary.fileCount}件` : pending,
      sub: summary ? `（取込可能：${summary.importableCount}件）` : undefined,
    },
    {
      label: '取り込み予定の明細',
      value: summary ? `${summary.rowCount.toLocaleString('ja-JP')}件` : pending,
    },
    {
      label: '対象期間',
      value: summary ? formatImportPeriod(summary.periodFrom, summary.periodTo) : pending,
    },
    {
      label: '影響する取込元',
      value: summary
        ? summary.sources.length
          ? summary.sources
              .map((entry) => `${IMPORT_SOURCE_SHORT[entry.source]}（${entry.count}件）`)
              .join('、')
          : '-'
        : pending,
    },
    { label: '重複の可能性', value: summary ? `${summary.duplicateCount}件` : pending },
    {
      label: 'サブスク候補',
      value: summary ? `${summary.subsCandidates}件` : pending,
      sub: summary ? '取込後に確認できます。' : undefined,
    },
  ];

  return (
    <section
      className="card import-step"
      aria-labelledby="import-summary-title"
      aria-busy={view.kind === 'checking'}
    >
      <div className="import-step-head">
        <div>
          <h2 id="import-summary-title">
            <span className="import-step-no">3.</span> 取込内容の確認
          </h2>
          <p className="import-step-sub">
            {summary
              ? `${summary.fileCount}ファイルのチェック結果サマリーです。内容を確認し、問題なければ取り込みを実行してください。`
              : 'ファイルのチェックが終わると、ここに取り込む内容の要約が出ます。'}
          </p>
        </div>
      </div>
      <dl className="import-summary-grid">
        {items.map((item) => (
          <div key={item.label} className="import-summary-item">
            <dt>{item.label}</dt>
            <dd>
              <strong>{item.value}</strong>
              {item.sub && <small>{item.sub}</small>}
            </dd>
          </div>
        ))}
      </dl>
      {note && (
        <p className="notice warn import-exclusion" role="note">
          <span aria-hidden="true">! </span>
          {note}
        </p>
      )}
    </section>
  );
}

export function ImportResultStep({
  outcome,
  onRetryFailed,
}: {
  outcome: ImportCommitOutcome | null;
  onRetryFailed: () => void;
}) {
  const settled = outcome && (outcome.succeeded > 0 || outcome.failed > 0);
  return (
    <section className="card import-step import-result" aria-labelledby="import-result-title">
      <div className="import-step-head">
        <div>
          <h2 id="import-result-title">
            <span className="import-step-no">4.</span> 取込結果
          </h2>
          <p className="import-step-sub">
            {settled
              ? 'ファイルの取り込みが完了しました。結果を確認してください。'
              : '取り込みを実行すると、ここに結果が出ます。'}
          </p>
        </div>
      </div>
      {/* 結果の変化を読み上げる。確定前の案内は読み上げない */}
      <div
        // biome-ignore lint/a11y/useSemanticElements: output は phrasing content に限られ、結果の見出し ul と p を入れられないため status を付ける。
        role="status"
        aria-live="polite"
      >
        {outcome?.error && (
          <p className="notice warn" role="alert">
            {outcome.error}
          </p>
        )}
        {settled ? (
          <>
            <ul className="import-result-headline">
              {importResultHeadline(outcome.succeeded, outcome.failed).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          !outcome?.error && <p className="import-empty">まだ取り込んでいません</p>
        )}
      </div>
      {settled && (
        <>
          <ul className="import-result-cards">
            <li className="import-result-card good">
              <span>
                <span aria-hidden="true">✓ </span>取込成功
              </span>
              <strong>{outcome.succeeded}件</strong>
              <small>{outcome.rows.toLocaleString('ja-JP')}件の明細</small>
            </li>
            <li className="import-result-card bad">
              <span>
                <span aria-hidden="true">✕ </span>取込失敗
              </span>
              <strong>{outcome.failed}件</strong>
              <small>（エラー：{outcome.errors}件）</small>
            </li>
            <li className="import-result-card warn">
              <span>
                <span aria-hidden="true">! </span>重複の可能性
              </span>
              <strong>{outcome.duplicateCandidates}件</strong>
              <Link to="/analysis/total-cashflow">総収支で確認する →</Link>
            </li>
            <li className="import-result-card info">
              <span>
                <span aria-hidden="true">↻ </span>サブスク候補
              </span>
              <strong>{outcome.subsCandidates}件</strong>
              <Link to="/subscriptions">サブスクで確認する →</Link>
            </li>
          </ul>
          {outcome.failed > 0 && (
            <div className="import-result-actions">
              <Button onClick={onRetryFailed}>エラーのファイルのみ再試行</Button>
            </div>
          )}
          <DuplicateReviewNotice />
          {outcome.freeeImported && <SubsHandoff />}
        </>
      )}
    </section>
  );
}

/** 総収支に残っている重複の要確認。0 件なら出さない (常時出る警告は合図として働かない) */
function DuplicateReviewNotice() {
  const q = useQuery({
    queryKey: ['total-cashflow', 'import-notice'],
    queryFn: () => api<TotalCashflowResponse>('/total-cashflow'),
  });
  const count = (q.data?.months ?? []).reduce((sum, month) => sum + month.reviewCount, 0);
  if (count === 0) return null;
  return (
    <div className="notice warn lines" role="alert" aria-label="重複の要確認">
      freee と Money Forward で重複しているかもしれない支払が {count}件 残っています(要確認)。
      <br />
      日付か金額が揃わないため機械では決められません。同じ取引かどうかを選ぶと集計へ反映されます。
      <br />
      <Link to="/analysis/total-cashflow">トータル収支で確認する</Link>
    </div>
  );
}

/** freee を取り込んだときだけ、まとめて登録できるサブスク候補を知らせる */
function SubsHandoff() {
  const q = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () => api<{ candidates: SubsCandidate[] }>('/sub-vendors/candidates'),
  });
  const sure = autoRegisterable(q.data?.candidates ?? []);
  if (!sure.length) return null;
  return (
    <div className="notice info lines">
      サブスクとして登録できそうな支払先が {sure.length}件 見つかりました。
      <br />
      毎月ほぼ同額で続いている支払先です。まとめて登録できます。
      <br />
      <Link to="/subscriptions">サブスク分析で確認する</Link>
    </div>
  );
}
