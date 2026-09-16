import type { HTMLAttributes, ReactNode } from 'react';
import { ApiError } from '../api.js';
import { deltaCls, pct, yen } from '../format.js';
import { type AppRouteId, routeMetadata } from '../routeMetadata.js';
import { Button } from './Button.js';
import { DataTable } from './DataTable.js';
import { linkTerms } from './Term.js';

/** 全 route が共有する本文 landmark。幅の違いは用途を明示した variant だけで表す。 */
export function PageShell({
  width,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { width: 'reading' | 'data' }) {
  const classes = ['main', 'page-shell', `page-shell--${width}`, className].filter(Boolean).join(' ');
  return <main className={classes} {...props} />;
}

/** 長い編集画面の完了・取消操作を、画面ごとの独自 sticky 実装から切り離す。 */
export function PageActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ['page-actions', className].filter(Boolean).join(' ');
  return <div className={classes} {...props} />;
}

export function PageHeader({
  route,
  title,
  showTask = true,
  lead,
}: {
  route: AppRouteId;
  /** ナビの短い名称と、画面で答える問いが異なる場合のみ上書きする。 */
  title?: ReactNode;
  /** 問い自体が十分に場面を伝える画面では、汎用説明の重複を避ける。 */
  showTask?: boolean;
  /** 問いに添える 1 文。汎用説明の代わりに見出しの直下へ出す。 */
  lead?: ReactNode;
}) {
  const metadata = routeMetadata(route);
  return (
    <header className="page-heading">
      <h1 className="page-title">{title ?? metadata.label}</h1>
      {lead && <p className="page-task">{lead}</p>}
      {/* 段階表示: 見出しは1文に保ちつつ、判定基準・色の意味・免責といった
          「知らないと誤読する情報」は畳んで残す。<details> なのでJSなしで開閉でき、
          用語ホバー(linkTerms)も task と同じように効く。 */}
      {showTask && (
        <TaskCopy task={metadata.task} detail={metadata.taskDetail} summary="この画面のくわしい説明" />
      )}
    </header>
  );
}

/**
 * 「この単位は何をする場所か」の1文と、畳んだ詳細。
 *
 * 画面(PageHeader)と、画面の中のタブ(支出分析)で同じ形を使う。タブは元は独立した画面で、
 * それぞれの説明文を持っていた。束ねたときにその文を捨てると、用語ホバーごと説明が消える。
 */
export function TaskCopy({ task, detail, summary }: { task: string; detail: string; summary: string }) {
  return (
    <>
      <p className="page-task">{linkTerms(task)}</p>
      <TaskDetail detail={detail} summary={summary} />
    </>
  );
}

/**
 * 畳んだ詳細だけ。問いの見出し (PageHeader の lead) が1文の役目を果たす画面で、
 * 同じ文を二度出さずに「知らないと誤読する情報」だけを残すために使う。
 */
export function TaskDetail({ detail, summary }: { detail: string; summary: string }) {
  return (
    <details className="page-task-detail">
      <summary>{summary}</summary>
      <p>{linkTerms(detail)}</p>
    </details>
  );
}

/** 失敗理由を「何が起きたか + 次にすること」で言い換える(生のHTTPコードは見せない) */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'ログインの有効期限が切れました。もう一度ログインしてください。';
    if (error.code === 'schema_unavailable')
      return 'システム更新の適用待ちです。お客様の操作やファイルが原因ではありません。時間をおいて、もう一度読み込んでください。';
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
          <Button onClick={() => window.location.reload()}>再読み込みする</Button>
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
      <td className="num" data-label={previousLabel}>
        {yen(item.previous)}
      </td>
      <td className="num" data-label={currentLabel}>
        {yen(item.current)}
      </td>
      <td className={`num ${deltaCls(item.delta)}`} data-label="増減率">
        {pct(item.delta)}
      </td>
    </tr>
  );

  return (
    <div className="scroll-x">
      {/* stack-sm: 640px以下では1行=1カード。列が4つでも「何年と何年の比較か」を見失わない */}
      <DataTable
        className="data stack-sm"
        columns={[subjectLabel, previousLabel, currentLabel, '増減率']}
        foot={total && row(total)}
      >
        {rows.map((item) => row(item, item.key))}
      </DataTable>
    </div>
  );
}
