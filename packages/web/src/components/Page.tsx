import type { ReactNode } from 'react';
import { ApiError } from '../api.js';
import { deltaCls, pct, yen } from '../format.js';
import { type AppRouteId, routeMetadata } from '../routeMetadata.js';
import { linkTerms } from './Term.js';

export function PageHeader({ route }: { route: AppRouteId }) {
  const metadata = routeMetadata(route);
  return (
    <header className="page-heading">
      <h1 className="page-title">{metadata.label}</h1>
      <p className="page-task">{linkTerms(metadata.task)}</p>
    </header>
  );
}

/** 失敗理由を「何が起きたか + 次にすること」で言い換える(生のHTTPコードは見せない) */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'ログインの有効期限が切れました。もう一度ログインしてください。';
    if (error.status >= 500)
      return 'サーバー側で処理に失敗しました。少し待ってから、もう一度読み込んでください。続く場合は取込履歴に失敗が残っていないか確認してください。';
    if (error.status === 404) return 'データの保存先が見つかりません。設定を確認してください。';
    return `${error.message}。もう一度読み込んでください。`;
  }
  if (error instanceof TypeError)
    return '通信できませんでした。ネットワーク接続を確認し、もう一度読み込んでください。';
  return '読み込みに失敗しました。通信状態を確認し、もう一度読み込んでください。';
}

export function PageState({
  status,
  message,
  action,
  error,
}: {
  status: 'loading' | 'error' | 'empty';
  message?: string;
  action?: ReactNode;
  /** 失敗時の原因(ApiError等)。message が無いときの文言に使う */
  error?: unknown;
}) {
  if (status === 'loading') {
    return (
      <output className="page-state loading" aria-busy="true" aria-live="polite">
        <span className="skeleton-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>データを読み込み中…</span>
      </output>
    );
  }

  const text = message ?? (status === 'error' ? describeError(error) : '対象データがありません。');

  return (
    <div className="page-state" role={status === 'error' ? 'alert' : 'status'}>
      <p>{text}</p>
      {action ??
        (status === 'error' ? (
          <button type="button" onClick={() => window.location.reload()}>
            再読み込みする
          </button>
        ) : null)}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  note,
  tone,
  compact = false,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'biz' | 'per';
  compact?: boolean;
}) {
  return (
    <div className={`kpi${compact ? ' compact' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {note != null && <div className="note">{note}</div>}
    </div>
  );
}

export interface AnnualComparisonRow {
  key: string;
  label: ReactNode;
  previous: number;
  current: number;
  /** 1=100%。負値・1超を許容する増減率。 */
  delta: number;
}

export function AnnualComparisonTable({
  subjectLabel,
  previousLabel,
  currentLabel,
  rows,
  total,
}: {
  subjectLabel: string;
  previousLabel: string;
  currentLabel: string;
  rows: AnnualComparisonRow[];
  total?: Omit<AnnualComparisonRow, 'key'>;
}) {
  const row = (item: Omit<AnnualComparisonRow, 'key'>, key?: string) => (
    <tr key={key} className={key ? undefined : 'total'}>
      <th scope="row">{item.label}</th>
      <td className="num">{yen(item.previous)}</td>
      <td className="num">{yen(item.current)}</td>
      <td className={`num ${deltaCls(item.delta)}`}>{pct(item.delta)}</td>
    </tr>
  );

  return (
    <div className="scroll-x">
      <table className="data">
        <thead>
          <tr>
            <th scope="col">{subjectLabel}</th>
            <th scope="col">{previousLabel}</th>
            <th scope="col">{currentLabel}</th>
            <th scope="col">増減率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => row(item, item.key))}
          {total && row(total)}
        </tbody>
      </table>
    </div>
  );
}
