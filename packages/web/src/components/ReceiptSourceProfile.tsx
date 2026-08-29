import type { ReceiptSourceProfile, ReceiptSourceResolution } from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { api } from '../api.js';

interface Props {
  targetId: string;
  merchant: string;
  resolution: ReceiptSourceResolution;
  withTaxYear: (path: string) => string;
  onSaved: () => void;
}

interface Draft {
  serviceName: string;
  sourceUrl: string;
  loginAccount: string;
  memo: string;
}

const profileDraft = (profile: ReceiptSourceProfile | null): Draft => ({
  serviceName: profile?.serviceName ?? '',
  sourceUrl: profile?.sourceUrl ?? '',
  loginAccount: profile?.loginAccount ?? '',
  memo: profile?.memo ?? '',
});

const sourceStateLabel = (resolution: ReceiptSourceResolution): string => {
  if (resolution.state === 'ambiguous') return '取得先の候補を選んでください';
  if (resolution.state === 'invalid-override') return '以前の取得先が無効です。設定し直してください';
  if (resolution.overrideState === 'applied') return 'この明細だけの選択・上書き';
  if (resolution.profile && resolution.inheritedFrom) return '同じ取引先の設定を継承';
  if (resolution.state === 'cleared') return 'この明細では継承しない設定';
  return '取得先は未設定';
};

export function ReceiptSourceProfilePanel({ targetId, merchant, resolution, withTaxYear, onSaved }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [inheritMerchant, setInheritMerchant] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => profileDraft(resolution.profile));
  const [status, setStatus] = useState('');

  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(withTaxYear('/tax/receipt-sources'), {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onMutate: () => setStatus('保存中です'),
    onSuccess: () => {
      setStatus('取得先を保存しました');
      setOpen(false);
      onSaved();
    },
    onError: (error: Error) => setStatus(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({
      mode: inheritMerchant ? 'merchant-profile' : 'transaction-override',
      targetId,
      fields: draft,
    });
  };

  const selectProfile = (profileKey: string) => save.mutate({ mode: 'select-profile', targetId, profileKey });

  const useInherited = () => save.mutate({ mode: 'inherit', targetId });

  const edit = () => {
    setDraft(profileDraft(resolution.profile));
    setInheritMerchant(resolution.overrideState !== 'applied');
    setOpen((current) => !current);
  };

  return (
    <div className="receipt-source">
      <div className="receipt-source-head">
        <span className={resolution.profile ? 'pill calm' : 'pill neutral'}>
          {sourceStateLabel(resolution)}
        </span>
        {resolution.profile && (
          <a
            className="btn small"
            href={resolution.profile.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${merchant}の取得先を外部サイトで開く`}
          >
            取得先を開く ↗
          </a>
        )}
        <button
          type="button"
          className="btn small"
          aria-expanded={open}
          aria-controls={`${id}-form`}
          onClick={edit}
        >
          取得先を{resolution.profile ? '編集' : '設定'}
        </button>
        {resolution.overrideState === 'applied' && (
          <button type="button" className="btn small" disabled={save.isPending} onClick={useInherited}>
            取引先の継承に戻す
          </button>
        )}
      </div>

      {resolution.profile && (
        <dl className="receipt-source-summary">
          <div>
            <dt>サービス</dt>
            <dd>{resolution.profile.serviceName}</dd>
          </div>
          {resolution.profile.loginAccount && (
            <div>
              <dt>ログインに使うアカウント</dt>
              <dd>{resolution.profile.loginAccount}</dd>
            </div>
          )}
          {resolution.profile.memo && (
            <div>
              <dt>メモ</dt>
              <dd>{resolution.profile.memo}</dd>
            </div>
          )}
        </dl>
      )}

      {resolution.state === 'ambiguous' && (
        <div className="receipt-source-candidates" aria-label={`${merchant}の取得先候補`}>
          {resolution.candidates.map((candidate) => (
            <button
              key={candidate.profileKey}
              type="button"
              className="btn small"
              disabled={save.isPending}
              onClick={() => selectProfile(candidate.profileKey)}
            >
              {candidate.serviceName}をこの明細に使う
            </button>
          ))}
        </div>
      )}

      {open && (
        <form id={`${id}-form`} className="receipt-source-form" onSubmit={submit}>
          <label htmlFor={`${id}-service`}>サービス・取得先名</label>
          <input
            id={`${id}-service`}
            required
            maxLength={120}
            value={draft.serviceName}
            onChange={(event) => setDraft({ ...draft, serviceName: event.target.value })}
          />
          <label htmlFor={`${id}-url`}>領収書の取得先URL</label>
          <input
            id={`${id}-url`}
            type="url"
            required
            inputMode="url"
            maxLength={2000}
            placeholder="https://…"
            value={draft.sourceUrl}
            onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
          />
          <label htmlFor={`${id}-account`}>ログインに使うアカウント名・メールアドレス</label>
          <input
            id={`${id}-account`}
            autoComplete="username"
            maxLength={254}
            value={draft.loginAccount}
            onChange={(event) => setDraft({ ...draft, loginAccount: event.target.value })}
          />
          <label htmlFor={`${id}-memo`}>補足メモ</label>
          <textarea
            id={`${id}-memo`}
            maxLength={500}
            value={draft.memo}
            onChange={(event) => setDraft({ ...draft, memo: event.target.value })}
          />
          <label className="receipt-source-inherit">
            <input
              type="checkbox"
              checked={inheritMerchant}
              onChange={(event) => setInheritMerchant(event.target.checked)}
            />
            今後の同じ取引先にも使う（翌月以降の入力を省略）
          </label>
          <p className="sub">
            パスワード・認証トークンは保存しません。リンク先のサービス側で管理してください。
          </p>
          <div className="report-actions">
            <button type="submit" className="btn primary" disabled={save.isPending}>
              {save.isPending ? '保存中…' : '取得先を保存'}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              キャンセル
            </button>
          </div>
        </form>
      )}
      <p
        className={save.isError ? 'receipt-source-status error' : 'receipt-source-status'}
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}
