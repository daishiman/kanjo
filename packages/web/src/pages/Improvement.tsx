/**
 * 改善要望の一覧と詳細。
 *
 * この画面の役目は3つ。
 *   1. 出した要望の状態(未対応/対応中/対応済み)を追えること
 *   2. Claude Code / Codex 用の指示文を作り直せること(初回の指示文は投稿直後の1回しか出ない)
 *   3. 添付がいつ消えるかを、消える前に見せること
 *
 * 診断情報の本文はここで全部見せる。要望を出した本人が、何が送られたかを
 * あとから確認できない状態にはしない。
 */
import { IMPROVEMENT_STATUS_LABEL, IMPROVEMENT_STATUS_VALUES, type ImprovementStatus } from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type ImprovementRequestView,
  getImprovement,
  improvementScreenshotUrl,
  listImprovements,
  markImprovementCopied,
  reissueImprovementPrompt,
  setImprovementStatus,
} from '../api.js';

const TOKEN_LABEL: Record<ImprovementRequestView['token']['status'], string> = {
  none: '未発行',
  active: '有効',
  expired: '期限切れ',
  exhausted: '取得回数の上限',
};

const dateTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function ImprovementPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['improvements'], queryFn: listImprovements });
  const detail = useQuery({
    queryKey: ['improvements', selected],
    queryFn: () => getImprovement(selected as string),
    enabled: selected !== null,
  });

  const reissue = useMutation({
    mutationFn: (id: string) => reissueImprovementPrompt(id),
    onSuccess: (res) => {
      // 作り直した時点で、前に配った指示文は使えなくなる。そのことを明示する
      setPrompt(res.prompt);
      setNotice('指示文を作り直しました。前に配った指示文はもう使えません');
      void qc.invalidateQueries({ queryKey: ['improvements'] });
    },
    onError: () => setNotice('指示文を作り直せませんでした。添付が既に削除された可能性があります'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ImprovementStatus }) =>
      setImprovementStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['improvements'] });
      setNotice(null);
    },
  });

  async function copy(id: string, target: 'claude_code' | 'codex') {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      await markImprovementCopied(id, target);
      setNotice(`${target === 'claude_code' ? 'Claude Code' : 'Codex'} 用にコピーしました`);
      void qc.invalidateQueries({ queryKey: ['improvements'] });
    } catch {
      setNotice('コピーできませんでした。指示文を選択して手動でコピーしてください');
    }
  }

  const rows = list.data?.requests ?? [];
  const current = detail.data?.request ?? null;

  return (
    <div className="page improvement-page">
      <h1>改善要望</h1>
      <p className="page-lead">
        画面端の「改善を送る」から出した要望の一覧です。 指示文を Claude Code や Codex
        に貼ると、そのときの画面と診断情報を読みに行って直します。
      </p>

      {list.isLoading && (
        <output className="page-state loading" aria-busy="true">
          読み込み中…
        </output>
      )}
      {list.isError && (
        <p className="page-state error" role="alert">
          一覧を取得できませんでした
        </p>
      )}
      {!list.isLoading && rows.length === 0 && <p className="page-state empty">まだ要望はありません</p>}

      {rows.length > 0 && (
        <table className="table improvement-table">
          <thead>
            <tr>
              <th>件名</th>
              <th>画面</th>
              <th>状態</th>
              <th>添付</th>
              <th>作成</th>
              <th>添付の削除予定</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={selected === row.id ? 'selected' : undefined}>
                <td>{row.title}</td>
                <td className="mono">{row.route || '—'}</td>
                <td>
                  <select
                    aria-label={`${row.title} の状態`}
                    value={row.status}
                    onChange={(e) =>
                      changeStatus.mutate({ id: row.id, status: e.target.value as ImprovementStatus })
                    }
                  >
                    {IMPROVEMENT_STATUS_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {IMPROVEMENT_STATUS_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {row.purgedAt
                    ? '削除済み'
                    : [row.screenshot.available ? '画像' : null, row.diagnostics.available ? '診断' : null]
                        .filter(Boolean)
                        .join('・') || 'なし'}
                </td>
                <td>{dateTime(row.createdAt)}</td>
                <td>{row.attachmentExpiresAt ? dateTime(row.attachmentExpiresAt) : '対応完了後30日'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(row.id);
                      setPrompt(null);
                      setNotice(null);
                    }}
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {current && (
        <section className="improvement-detail">
          <h2>{current.title}</h2>
          <dl className="kv">
            <dt>状態</dt>
            <dd>{IMPROVEMENT_STATUS_LABEL[current.status]}</dd>
            <dt>発生画面</dt>
            <dd className="mono">{current.route || '—'}</dd>
            <dt>指示文のトークン</dt>
            <dd>
              {TOKEN_LABEL[current.token.status]}
              {current.token.expiresAt && `(期限 ${dateTime(current.token.expiresAt)})`}／取得
              {current.token.fetchCount} 回
            </dd>
            <dt>コピー</dt>
            <dd>
              {current.copiedAt
                ? `${dateTime(current.copiedAt)}(${current.copiedTarget === 'codex' ? 'Codex' : 'Claude Code'})`
                : '未コピー'}
            </dd>
          </dl>

          <h3>内容</h3>
          <p className="improvement-body">{current.body}</p>

          {current.purgedAt ? (
            <p className="page-state empty">
              添付は {dateTime(current.purgedAt)} に削除されました(対応完了から30日)。
            </p>
          ) : (
            <>
              {current.screenshot.available && (
                <>
                  <h3>スクリーンショット</h3>
                  <img
                    className="improvement-shot"
                    src={improvementScreenshotUrl(current.id)}
                    alt={`${current.title} の画面`}
                  />
                </>
              )}
              <h3>
                診断情報({detail.data?.diagnostics?.entries.length ?? 0} 件
                {(detail.data?.diagnostics?.omittedCount ?? 0) > 0 &&
                  `／省略 ${detail.data?.diagnostics?.omittedCount} 件`}
                )
              </h3>
              {detail.data?.diagnostics ? (
                <table className="table improvement-diagnostics">
                  <thead>
                    <tr>
                      <th>時刻</th>
                      <th>種別</th>
                      <th>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.diagnostics.entries.map((entry) => (
                      <tr key={`${entry.at}-${entry.message}`}>
                        <td className="mono">{dateTime(entry.at)}</td>
                        <td className="mono">{entry.kind}</td>
                        <td>
                          {entry.message}
                          {entry.detail && <div className="improvement-detail-line mono">{entry.detail}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="page-state empty">診断情報はありません</p>
              )}
            </>
          )}

          <h3>Claude Code / Codex 用の指示文</h3>
          {prompt ? (
            <>
              <textarea className="improve-prompt" readOnly value={prompt} rows={12} />
              <div className="improve-actions">
                <button type="button" onClick={() => void copy(current.id, 'claude_code')}>
                  Claude Code 用にコピー
                </button>
                <button type="button" onClick={() => void copy(current.id, 'codex')}>
                  Codex 用にコピー
                </button>
              </div>
            </>
          ) : (
            <p className="improve-note">
              指示文はトークンの原文を含むため保存していません。必要なときに作り直してください。
            </p>
          )}
          <div className="improve-actions">
            <button
              type="button"
              onClick={() => reissue.mutate(current.id)}
              disabled={reissue.isPending || current.purgedAt !== null}
            >
              {reissue.isPending ? '作成中…' : '指示文を作り直す'}
            </button>
          </div>
          {notice && <output className="improve-note">{notice}</output>}
        </section>
      )}
    </div>
  );
}
