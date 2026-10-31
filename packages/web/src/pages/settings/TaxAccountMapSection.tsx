/**
 * 勘定科目の対応表の節 (spec-classify-bulk-save FR-17・AC-16)。
 *
 * 他の節と違い、追加と削除は保存バーを通さず専用の API でその場で保存する。
 * 対応表は事業の明細の提案の算出に効くので、変えた後はページが設定と提案を含む読み出しを取り直す (onChanged)。
 * 取り直しを mutation の中で待つのは、読み直しが終わる前の二度押しで同じ行を送らないため。
 * 表はサーバの読み出しと同じ大項目のコード単位の順で、並べ替えは付けない。
 */
import {
  TAX_ACCOUNT_GROUPS,
  TAX_ACCOUNT_MAP_ROWS_MAX,
  type TaxAccountMapRow,
  type TaxAccountMapRowIssue,
  taxAccountMapRowIssue,
  taxAccountsByGroup,
} from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useRef, useState } from 'react';
import { ApiError, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog, usePendingConfirm } from '../../components/ConfirmDialog.js';
import {
  TAX_MAP_TEXT,
  taxMapAdded,
  taxMapErrorMessage,
  taxMapFieldText,
  taxMapRemoveLabel,
  taxMapRemoveTitle,
  taxMapRemoved,
} from './view-model.js';

type FieldCode = NonNullable<TaxAccountMapRowIssue['categoryBig'] | TaxAccountMapRowIssue['taxAccount']>;
type FieldErrors = { categoryBig?: FieldCode | 'duplicate'; taxAccount?: FieldCode };
interface TaxMapResponse {
  rows: TaxAccountMapRow[];
}

const BIG_ID = 'settings-tax-map-big';
const ACCOUNT_ID = 'settings-tax-map-account';

/** 送る前の検査。サーバと同じ core の判定に、表の中の重複だけを足す */
function fieldErrorsOf(row: TaxAccountMapRow, rows: readonly TaxAccountMapRow[]): FieldErrors {
  const errors: FieldErrors = { ...(taxAccountMapRowIssue(row) ?? {}) };
  if (!errors.categoryBig && rows.some((r) => r.categoryBig === row.categoryBig)) {
    errors.categoryBig = 'duplicate';
  }
  return errors;
}

/** サーバが欄の問題として返した 400 (invalid_request の fields と duplicate_category) を欄の誤りへ写す */
function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  if (error.code === 'duplicate_category') return { categoryBig: 'duplicate' };
  if (error.code !== 'invalid_request') return null;
  const fields = (error.body as { error?: { fields?: unknown } } | undefined)?.error?.fields;
  if (!fields || typeof fields !== 'object') return null;
  const { categoryBig, taxAccount } = fields as Record<string, unknown>;
  const errors: FieldErrors = {};
  if (typeof categoryBig === 'string') errors.categoryBig = categoryBig as FieldCode;
  if (typeof taxAccount === 'string') errors.taxAccount = taxAccount as FieldCode;
  return errors.categoryBig || errors.taxAccount ? errors : null;
}

const isApiError = (error: unknown, status: number, code?: string): boolean =>
  error instanceof ApiError && error.status === status && (code === undefined || error.code === code);

export function TaxAccountMapSection({
  rows,
  onChanged,
}: {
  rows: TaxAccountMapRow[];
  /** 追加・削除の後に、設定と提案を含む読み出しを取り直す */
  onChanged: () => Promise<unknown>;
}) {
  const [big, setBig] = useState('');
  const [account, setAccount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const bigRef = useRef<HTMLInputElement | null>(null);
  const accountRef = useRef<HTMLSelectElement | null>(null);

  const add = useMutation({
    mutationFn: async (row: TaxAccountMapRow) => {
      const result = await api<TaxMapResponse>('/settings/tax-account-map', {
        method: 'POST',
        body: JSON.stringify(row),
      });
      await onChanged();
      return result;
    },
  });
  const remove = useMutation({
    mutationFn: async (categoryBig: string) => {
      const result = await api<TaxMapResponse>(
        `/settings/tax-account-map/${encodeURIComponent(categoryBig)}`,
        { method: 'DELETE' },
      );
      await onChanged();
      return result;
    },
  });
  const confirmRemove = usePendingConfirm<string>({ busy: remove.isPending });

  const atLimit = rows.length >= TAX_ACCOUNT_MAP_ROWS_MAX;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (add.isPending || atLimit) return;
    const row: TaxAccountMapRow = { categoryBig: big.trim(), taxAccount: account };
    const errors = fieldErrorsOf(row, rows);
    setFieldErrors(errors);
    setStatus(null);
    setAlert(null);
    if (errors.categoryBig) return bigRef.current?.focus();
    if (errors.taxAccount) return accountRef.current?.focus();
    add.mutate(row, {
      onSuccess: () => {
        setBig('');
        setAccount('');
        setStatus(taxMapAdded(row.categoryBig));
        bigRef.current?.focus();
      },
      onError: (error) => {
        const fields = serverFieldErrors(error);
        if (fields) {
          setFieldErrors(fields);
          (fields.categoryBig ? bigRef : accountRef).current?.focus();
          return;
        }
        // 他の画面で行が増えて上限に達した。読み直して追加の口を閉じる
        if (isApiError(error, 400, 'too_many_rows')) void onChanged();
        setAlert(taxMapErrorMessage(error));
      },
    });
  };

  const askRemove = (categoryBig: string, trigger: HTMLButtonElement) => {
    remove.reset();
    setStatus(null);
    setAlert(null);
    confirmRemove.dialog.triggerRef.current = trigger;
    confirmRemove.ask(categoryBig);
  };
  const dismissRemove = () => {
    if (remove.isPending) return;
    confirmRemove.dismiss();
    remove.reset();
  };
  const runRemove = () => {
    const target = confirmRemove.target;
    if (target === null) return;
    remove.mutate(target, {
      onSuccess: () => {
        // 押した行は消えるので、閉じた後のフォーカスは追加の欄へ戻す
        confirmRemove.dialog.triggerRef.current = null;
        confirmRemove.dismiss();
        setStatus(taxMapRemoved(target));
        bigRef.current?.focus();
      },
      onError: (error) => {
        // 他の画面で先に消えた行。確認を閉じて読み直し、節に知らせる (それ以外はダイアログに残して送り直せるようにする)
        if (!isApiError(error, 404)) return;
        confirmRemove.dialog.triggerRef.current = null;
        confirmRemove.dismiss();
        void onChanged();
        setAlert(taxMapErrorMessage(error));
        bigRef.current?.focus();
      },
    });
  };

  const bigError = fieldErrors.categoryBig;
  const accountError = fieldErrors.taxAccount;

  return (
    <section className="card settings-section" id="tax-account-map" aria-labelledby="tax-account-map-heading">
      <h2 id="tax-account-map-heading">{TAX_MAP_TEXT.heading}</h2>
      <p className="sub">{TAX_MAP_TEXT.lead}</p>
      <p className="settings-note">{TAX_MAP_TEXT.note}</p>
      <div className="settings-table-wrap">
        <table
          className="data settings-tax-map-table"
          data-table-kind="workflow"
          data-sort-reason="サーバの読み出しと同じ大項目の順で、追加した行の位置が読み直しても変わらないようにするため"
        >
          <caption className="visually-hidden">{TAX_MAP_TEXT.heading}</caption>
          <thead>
            <tr>
              <th scope="col">{TAX_MAP_TEXT.big}</th>
              <th scope="col">{TAX_MAP_TEXT.account}</th>
              <th scope="col">{TAX_MAP_TEXT.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="settings-empty">
                  {TAX_MAP_TEXT.empty}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.categoryBig}>
                <td>{row.categoryBig}</td>
                <td>{row.taxAccount}</td>
                <td>
                  <Button
                    variant="danger"
                    size="mini"
                    aria-label={taxMapRemoveLabel(row.categoryBig)}
                    onClick={(event) => askRemove(row.categoryBig, event.currentTarget)}
                  >
                    {TAX_MAP_TEXT.remove}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="settings-rules-add settings-tax-map-add" onSubmit={submit} noValidate>
        <div className="settings-field">
          <label htmlFor={BIG_ID}>{TAX_MAP_TEXT.big}</label>
          <input
            ref={bigRef}
            id={BIG_ID}
            type="text"
            placeholder={TAX_MAP_TEXT.bigPlaceholder}
            aria-invalid={bigError ? true : undefined}
            aria-describedby={bigError ? `${BIG_ID}-error` : undefined}
            value={big}
            onChange={(e) => setBig(e.target.value)}
          />
          {bigError && (
            <span className="settings-field-error" id={`${BIG_ID}-error`}>
              {taxMapFieldText('categoryBig', bigError)}
            </span>
          )}
        </div>
        <div className="settings-field">
          <label htmlFor={ACCOUNT_ID}>{TAX_MAP_TEXT.account}</label>
          <select
            ref={accountRef}
            id={ACCOUNT_ID}
            aria-invalid={accountError ? true : undefined}
            aria-describedby={accountError ? `${ACCOUNT_ID}-error` : undefined}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">{TAX_MAP_TEXT.accountPlaceholder}</option>
            {TAX_ACCOUNT_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {taxAccountsByGroup(group).map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {accountError && (
            <span className="settings-field-error" id={`${ACCOUNT_ID}-error`}>
              {taxMapFieldText('taxAccount', accountError)}
            </span>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={atLimit || add.isPending}>
          {add.isPending ? TAX_MAP_TEXT.adding : TAX_MAP_TEXT.add}
        </Button>
      </form>
      {atLimit && <p className="sub">{TAX_MAP_TEXT.limit}</p>}
      {alert && (
        <p className="settings-field-error" role="alert">
          {alert}
        </p>
      )}
      {status && <output className="notice">{status}</output>}

      {confirmRemove.target !== null && (
        <ConfirmDialog
          dialog={confirmRemove.dialog}
          title={taxMapRemoveTitle(confirmRemove.target)}
          confirmLabel={TAX_MAP_TEXT.removeConfirm}
          busyLabel={TAX_MAP_TEXT.removeBusy}
          dismissLabel={TAX_MAP_TEXT.cancel}
          onConfirm={runRemove}
          onDismiss={dismissRemove}
        >
          <p>{TAX_MAP_TEXT.removeBody}</p>
          {remove.isError && !isApiError(remove.error, 404) && (
            <p className="settings-field-error" role="alert">
              {taxMapErrorMessage(remove.error)}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
