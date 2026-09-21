/**
 * ルールの影響プレビュー (spec-classify-screen 7.10)。
 *
 * 作る前に「今後どれだけの明細が変わるか」を見せる。
 * 件数と適用後の姿は preview 応答をそのまま読む。画面側で数え直すと、
 * 見せた件数と実際に変わる件数がずれる余地ができる。
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ClassifyRuleBody, RulePreviewResponse } from '../../api.js';
import { api } from '../../api.js';
import { Button } from '../../components/Button.js';
import {
  amountText,
  dateText,
  previewAfterText,
  previewBadgeText,
  previewNoticeText,
  previewOmittedText,
} from './view-model.js';

export function RulePreviewPanel({
  rule,
  period,
  onClose,
  onApplied,
}: {
  rule: ClassifyRuleBody;
  period: { from: string; to: string };
  onClose: () => void;
  onApplied: (applied: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewQuery = useQuery({
    queryKey: ['classify-rule-preview', rule, period.from, period.to],
    queryFn: () =>
      api<RulePreviewResponse>('/rules/preview', {
        method: 'POST',
        body: JSON.stringify({ rule, ...period }),
      }),
  });
  const preview = previewQuery.data ?? null;

  const apply = () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    api<{ applied: number }>('/rules/apply', {
      method: 'POST',
      body: JSON.stringify({ rule, ...period, fingerprint: preview.fingerprint }),
    })
      .then((res) => onApplied(res.applied))
      .catch(() => setError('ルールを適用できませんでした。'))
      .finally(() => setBusy(false));
  };

  return (
    <section className="classify-preview" aria-label="ルールの影響プレビュー">
      <div className="classify-edit-head">
        <h2>このルールで変わる明細</h2>
        <Button variant="text" size="mini" aria-label="プレビューを閉じる" onClick={onClose}>
          ×
        </Button>
      </div>

      {(error || previewQuery.isError) && (
        <p className="sub" role="alert">
          {error ?? '影響のプレビューを読み込めませんでした。'}
        </p>
      )}

      {preview === null ? (
        <p className="sub">読み込んでいます…</p>
      ) : preview.count === 0 ? (
        <p className="sub">この条件に当てはまる明細はありません。</p>
      ) : (
        <>
          <p className="classify-preview-badge">{previewBadgeText(preview.count)}</p>
          <ul className="classify-preview-rows">
            {preview.rows.map((r) => (
              <li key={r.txId}>
                <span>{dateText(r.date)}</span>
                <span>{r.payee}</span>
                <span>{r.description}</span>
                <span className="num">{amountText(r.amount)}</span>
                <span>→ {previewAfterText(r.after)}</span>
              </li>
            ))}
          </ul>
          {preview.omitted > 0 && <p className="sub">{previewOmittedText(preview.omitted)}</p>}
          <p className="sub">{previewNoticeText(preview.count, !!rule.splitTemplate)}</p>
        </>
      )}

      <div className="classify-edit-actions">
        <Button variant="primary" disabled={busy || preview === null} onClick={apply}>
          {busy ? '保存しています…' : preview?.count === 0 ? 'ルールを保存' : 'ルールを作成して適用'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          やめる
        </Button>
      </div>
    </section>
  );
}
