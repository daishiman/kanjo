/**
 * 名義別の収入 / 振替は収入・支出から除外 / 名義ラベルの設定 (spec §6)。
 *
 * 名義の表示名はサーバが応答に載せた `labels` と行の `label` をそのまま使い、内部値を画面で写し直さない。
 * 名義ラベルの検査は core `validateOwnerLabels` をサーバと共用し、違反は送信せずフィールドに示す。
 */
import {
  type HouseholdSummary,
  OWNER_LABEL_KEYS,
  OWNER_LABEL_MAX,
  type OwnerKey,
  type OwnerLabelError,
  type OwnerLabels,
  validateOwnerLabels,
} from '@kanjo/core';
import { useState } from 'react';
import { ApiError } from '../../api-client.js';
import { Button } from '../../components/Button.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { describeError } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { UiIcon } from '../../components/UiIcon.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { monthLabel, yen } from '../../format.js';
import { useSaveOwnerLabels } from '../../owner-labels.js';
import { incomeDiffClass, shortDate, signedYen } from './view-model.js';

export function HouseholdOwners({ data }: { data: HouseholdSummary }) {
  const owners = data.owners;
  const current = data.summary.total.income;
  const previous = data.summary.previousYear?.income ?? null;
  const diff = data.summary.change?.income.diff ?? null;
  const transfers = data.transfers;
  return (
    <div className="household-owners">
      <section className="card" aria-labelledby="household-owners-title">
        <h2 id="household-owners-title">名義別の収入</h2>
        <div className="scroll-x">
          <table
            className="data household-table"
            data-table-kind="comparison"
            data-sort-reason="名義の表示順で当期と前年を並べて比べる表"
          >
            <thead>
              <tr>
                <th scope="col">名義</th>
                <th scope="col" className="num">
                  当期
                </th>
                <th scope="col" className="num">
                  前年
                </th>
                <th scope="col" className="num">
                  増減額
                </th>
              </tr>
            </thead>
            <tbody>
              {owners.map((row) => (
                <tr key={row.owner}>
                  <td data-label="名義">{row.label}</td>
                  <td data-label="当期" className="num">
                    {yen(row.current)}
                  </td>
                  <td data-label="前年" className="num">
                    {yen(row.previous)}
                  </td>
                  <td data-label="増減額" className={`num ${incomeDiffClass(row.diff)}`}>
                    {diffText(row.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td data-label="名義">合計</td>
                <td data-label="当期" className="num">
                  {yen(current)}
                </td>
                <td data-label="前年" className="num">
                  {yen(previous)}
                </td>
                <td data-label="増減額" className={`num ${incomeDiffClass(diff)}`}>
                  {diffText(diff)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="household-transfers-title">
        <h2 id="household-transfers-title" className="household-icon-heading">
          <UiIcon name="repeat" aria-hidden="true" /> 振替は収入・支出から除外
        </h2>
        <p className="household-note">
          同一名義間・名義間の資金移動（<Term id="transfer">振替</Term>
          ）は、家計の収支に影響しないため、収入・支出から除外しています。
        </p>
        <div className="household-card-head">
          <h3>除外した振替 ({monthLabel(transfers.month)})</h3>
        </div>
        {transfers.rows.length === 0 ? (
          <p className="household-note">この月の振替はありません。</p>
        ) : (
          <div className="scroll-x">
            <table
              className="data household-table"
              data-table-kind="layout"
              data-sort-reason="選択月に除外した振替を日付の昇順で示す抜粋"
            >
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col">内容</th>
                  <th scope="col" className="num">
                    金額
                  </th>
                  <th scope="col">名義間</th>
                </tr>
              </thead>
              <tbody>
                {transfers.rows.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td data-label="日付">{shortDate(row.date)}</td>
                    <td data-label="内容">{row.description}</td>
                    <td data-label="金額" className="num">
                      {yen(row.amount)}
                    </td>
                    <td data-label="名義間">
                      {row.from.label} → {row.to.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OwnerLabelsCard labels={data.labels} />
    </div>
  );
}

/** 名義別の増減は 0 を符号なしの `0` で示す (spec §6.1) */
const diffText = (v: number | null) => (v === 0 ? '0' : signedYen(v));

/** ダイアログの行の補足。内部値は見せず、意味だけを示す */
const OWNER_HINT: Record<OwnerKey, string> = {
  business: '事業の名義',
  spouse: '配偶者の名義',
  family: '家族の名義',
  unset: '名義が決まっていない明細',
};

const ERROR_TEXT: Record<OwnerLabelError, string> = {
  required: '表示名を入力してください。',
  too_long: `${OWNER_LABEL_MAX}文字以内で入力してください。`,
  control_char: '改行やタブなどの制御文字は使えません。',
  duplicate: 'ほかの名義と同じ表示名は使えません。',
};

type FieldErrors = Partial<Record<OwnerKey, OwnerLabelError>>;

/** 400 invalid_owner_labels の fields を、ダイアログのフィールドエラーへ写す */
function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError) || error.code !== 'invalid_owner_labels') return null;
  const fields = (error.body as { error?: { fields?: unknown } } | null)?.error?.fields;
  return fields && typeof fields === 'object' ? (fields as FieldErrors) : null;
}

function OwnerLabelsCard({ labels }: { labels: OwnerLabels }) {
  const save = useSaveOwnerLabels();
  const dialog = useConfirmDialog({ busy: save.isPending });
  const [draft, setDraft] = useState<OwnerLabels>(labels);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const open = () => {
    setDraft(labels);
    setErrors({});
    setFormError(null);
    save.reset();
    dialog.setOpen(true);
  };
  const submit = () => {
    const result = validateOwnerLabels(draft);
    if (!result.ok) {
      setErrors(result.fields);
      return;
    }
    setErrors({});
    setFormError(null);
    save.mutate(result.labels, {
      onSuccess: () => dialog.close(),
      onError: (error) => {
        const fields = serverFieldErrors(error);
        if (fields) setErrors(fields);
        else setFormError(`保存できませんでした。${describeError(error)}`);
      },
    });
  };

  return (
    <section className="card household-labels" aria-labelledby="household-labels-title">
      <h2 id="household-labels-title">
        <UiIcon name="circle-user" aria-hidden="true" /> 名義ラベルの設定
      </h2>
      <p className="household-note">収入・支出の名義（本人・パートナーなど）の設定・編集ができます。</p>
      <Button ref={dialog.triggerRef} variant="secondary" onClick={open}>
        <UiIcon name="sliders-horizontal" aria-hidden="true" /> 名義ラベルを編集
      </Button>
      {dialog.open && (
        <ConfirmDialog
          dialog={dialog}
          title="名義ラベルを編集"
          confirmLabel="保存する"
          busyLabel="保存中…"
          onConfirm={submit}
          onDismiss={dialog.close}
          className="household-labels-dialog"
        >
          <p>画面・明細・CSV に表示する名義の呼び方を変えます。集計の結果は変わりません。</p>
          <div className="household-labels-fields">
            {OWNER_LABEL_KEYS.map((key) => {
              const id = `owner-label-${key}`;
              const err = errors[key];
              return (
                <div key={key} className="household-labels-field">
                  <label htmlFor={id}>
                    {labels[key]} <span className="household-note">({OWNER_HINT[key]})</span>
                  </label>
                  <input
                    id={id}
                    type="text"
                    value={draft[key]}
                    maxLength={OWNER_LABEL_MAX * 2}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${id}-error` : undefined}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  />
                  {err && (
                    <p id={`${id}-error`} className="household-field-error">
                      {ERROR_TEXT[err]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {formError && (
            <p className="household-field-error" role="alert">
              {formError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
