/**
 * 貸借対照表 (BS) と負債残高の入力 (spec §1.10・§1.11・§4)。
 *
 * 負債は項目ごとに「未入力 / 0円 / 金額」の 3 状態を持つ。未入力を 0 と取り違えないよう、
 * 必須項目に未入力がある月は負債合計・純資産を出さず `データ不足` と出す。
 * 入力中の値はブラウザ内の下書き (liability-draft.ts) にだけ置き、サーバへは保存ボタンでだけ送る。
 */
import type { StatementsBs as StatementsBsData, StatementsBsLine, StatementsScreen } from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';
import { ApiError } from '../../api-client.js';
import { type AuthState, type LiabilitiesSaveResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable } from '../../components/DataTable.js';
import { BalanceSheetChart } from '../../components/FinancialCharts.js';
import { PageActions } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { UiIcon } from '../../components/UiIcon.js';
import { monthLabel, yen, yenS } from '../../format.js';
import {
  type LiabilityFormLine,
  type LiabilityFormLines,
  changedLiabilityLines,
  formLinesFromBs,
  formatAmount,
  parseAmount,
  useLiabilityDraft,
} from './liability-draft.js';
import { monthsInPeriod } from './view-model.js';

const INSUFFICIENT = 'データ不足';

function lineAmountText(line: StatementsBsLine): string {
  if (line.status === 'unset') return '未入力';
  return yen(line.status === 'zero' ? 0 : (line.amount ?? 0));
}

function BalanceTable({ bs, asOf }: { bs: StatementsBsData; asOf: string | null }) {
  return (
    <div className="scroll-x">
      <table
        className="data statement-table stmt-bs-table"
        data-table-kind="hierarchy"
        data-sort-reason="貸借対照表の資産・負債・純資産の順序を固定する"
      >
        <caption className="visually-hidden">{monthLabel(bs.referenceMonth)}末の貸借対照表</caption>
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col" className="num">
              {monthLabel(bs.referenceMonth)}末
              {/* 月末に達していない月は、何日時点かを出さないと前月と並べて読めない */}
              {asOf ? <span className="sub stmt-note">{asOf}時点</span> : null}
            </th>
          </tr>
        </thead>
        <tbody>
          {bs.assets.map((asset) => (
            <tr key={`asset/${asset.category}`}>
              <th scope="row">{asset.category}</th>
              <td className="num">{yen(asset.amount)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">資産合計</th>
            <td className="num">{yen(bs.assetTotal)}</td>
          </tr>
          {bs.lines.map((line) => (
            <tr key={`liability/${line.category}`}>
              <th scope="row">{line.label}</th>
              <td className="num">{lineAmountText(line)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">負債合計</th>
            <td className="num">{bs.liabilityTotal === null ? INSUFFICIENT : yen(bs.liabilityTotal)}</td>
          </tr>
          <tr className="total">
            <th scope="row">
              <Term id="netAssets" />
            </th>
            <td className="num">{bs.netAssets === null ? INSUFFICIENT : yenS(bs.netAssets)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function timeText(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 保存本文。何も選んでいない行は送らない (保存済みの値に触らない) */
function saveBody(month: string, saved: LiabilityFormLines, lines: LiabilityFormLines) {
  return {
    month,
    lines: changedLiabilityLines(saved, lines)
      .filter(([, line]) => line.status !== null)
      .map(([category, line]) =>
        line.status === 'amount'
          ? { category, status: line.status, amount: parseAmount(line.amount) ?? 0 }
          : { category, status: line.status },
      ),
  };
}

function saveErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return error.message || 'いまは保存できません。取込の完了を待って、もう一度保存してください。';
    if (error.status === 413) return '入力内容が大きすぎます。';
    if (error.status === 400) return '入力内容を確認してください。金額は 0 以上の整数で入れてください。';
  }
  return '保存できませんでした。入力内容は下書きに残っています。時間をおいてもう一度保存してください。';
}

function LineField({
  line,
  value,
  error,
  onChange,
}: {
  line: StatementsBsLine;
  value: LiabilityFormLine;
  error: string | null;
  onChange: (patch: Partial<LiabilityFormLine>) => void;
}) {
  const name = useId();
  const errorId = `${name}-error`;
  const amountInvalid = value.status === 'amount' && parseAmount(value.amount) === null;
  return (
    <fieldset className="stmt-line" aria-describedby={error ? errorId : undefined}>
      <legend className="visually-hidden">
        {line.label}
        {line.required ? '必須' : ''}
      </legend>
      <div className="stmt-line-layout">
        <div className="stmt-line-label" aria-hidden="true">
          <span>{line.label}</span>
          {line.required ? <span className="stmt-required">必須</span> : null}
        </div>
        <div className="stmt-line-control">
          <div className="stmt-line-choices">
            {(
              [
                ['unset', '未入力'],
                ['zero', '0円'],
                ['amount', '金額を入力'],
              ] as const
            ).map(([status, label]) => (
              <label key={status} className="stmt-choice">
                <input
                  type="radio"
                  name={name}
                  value={status}
                  checked={value.status === status}
                  onChange={() => onChange({ status })}
                />
                {label}
              </label>
            ))}
            {value.status === 'amount' ? (
              <span className="stmt-amount">
                <span aria-hidden="true">¥</span>
                <input
                  aria-label={`${line.label}の金額`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value.amount}
                  aria-invalid={amountInvalid}
                  onChange={(event) => onChange({ amount: event.target.value })}
                  onBlur={() => onChange({ amount: formatAmount(value.amount) })}
                />
              </span>
            ) : null}
          </div>
          {error ? (
            <p id={errorId} className="stmt-field-error stmt-inline-status" role="alert">
              <UiIcon name="alert" className="ui-icon stmt-status-icon" data-stmt-icon="field-alert" />
              {error}
            </p>
          ) : amountInvalid && value.amount !== '' ? (
            <p className="stmt-field-error stmt-inline-status" role="alert">
              <UiIcon name="alert" className="ui-icon stmt-status-icon" data-stmt-icon="field-alert" />
              {line.label}の金額は 0 以上 1 兆円以下の整数で入れてください。
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}

function UnsavedBar({
  count,
  saving,
  onReset,
  onSave,
}: {
  count: number;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  // 未保存の入力があるままページを離れようとしたら確認する
  useEffect(() => {
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [count]);

  if (count === 0) return null;
  return (
    <section className="stmt-unsaved" aria-label="未保存の入力">
      <div className="stmt-alert-copy">
        <UiIcon name="alert" className="ui-icon stmt-status-icon" data-stmt-icon="alert" />
        <p className="lines">
          <strong>未保存の項目が {count} 件あります</strong>
          <br />
          入力内容を確認し、保存してください。
        </p>
      </div>
      <PageActions className="stmt-actions">
        <Button className="stmt-icon-button" onClick={onReset} disabled={saving}>
          <UiIcon name="rotate-ccw" className="ui-icon stmt-action-icon" data-stmt-icon="reset" />
          リセット
        </Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? '保存中…' : '負債残高を保存'}
        </Button>
      </PageActions>
    </section>
  );
}

function LiabilityForm({
  id,
  open,
  onOpen,
  bs,
  months,
  onMonth,
}: {
  id: string;
  /** 閉じていてもフォームの状態 (下書き・未保存バー) は保つ。隠すのはフォーム本体だけ */
  open: boolean;
  onOpen: () => void;
  bs: StatementsBsData;
  months: string[];
  onMonth: (month: string) => void;
}) {
  const qc = useQueryClient();
  const auth = useQuery({ queryKey: ['auth'], queryFn: () => api<AuthState>('/auth/me') });
  const userId = auth.data?.user?.id ?? null;
  const month = bs.referenceMonth;
  const saved = useMemo(() => formLinesFromBs(bs.lines), [bs.lines]);
  const draft = useLiabilityDraft({ userId, month, saved });
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set());

  // 月を変えたら前の月の「選んでください」を持ち越さない
  // biome-ignore lint/correctness/useExhaustiveDependencies: 基準月が変わったときだけ消す。
  useEffect(() => setMissing(new Set()), [month]);

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof saveBody>) =>
      api<LiabilitiesSaveResponse>('/balances/liabilities', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      draft.clear();
      return qc.invalidateQueries({ queryKey: ['statements'] });
    },
    // 未保存バーから保存して失敗したときも、理由の出る場所を見せる
    onError: onOpen,
  });

  const submit = () => {
    const unchosen = bs.lines.filter(
      (line) => line.required && (draft.lines[line.category]?.status ?? null) === null,
    );
    setMissing(new Set(unchosen.map((line) => line.category)));
    const badAmount = bs.lines.some((line) => {
      const value = draft.lines[line.category];
      return value?.status === 'amount' && parseAmount(value.amount) === null;
    });
    if (unchosen.length || badAmount) {
      onOpen();
      return;
    }
    const body = saveBody(month, saved, draft.lines);
    if (!body.lines.length) return;
    save.mutate(body);
  };

  const reset = () => {
    setMissing(new Set());
    save.reset();
    draft.reset();
  };

  return (
    <>
      <form
        id={id}
        hidden={!open}
        className={`stmt-form${draft.unsaved ? ' has-unsaved' : ''}`}
        aria-label="負債残高の入力"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="stmt-form-head">
          <label className="stmt-month">
            基準月
            <select value={month} onChange={(event) => onMonth(event.target.value)}>
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {draft.savedAt ? (
            <output className="stmt-draft-saved">
              <UiIcon name="check" className="ui-icon stmt-status-icon" data-stmt-icon="saved" />
              下書きを自動保存しました {timeText(draft.savedAt)}
            </output>
          ) : null}
        </div>
        {bs.lines.map((line) => (
          <LineField
            key={line.category}
            line={line}
            value={draft.lines[line.category] ?? { status: null, amount: '' }}
            error={missing.has(line.category) ? `${line.label}の入力方法を選択してください。` : null}
            onChange={(patch) => {
              if (patch.status !== undefined && patch.status !== null) {
                setMissing((previous) => {
                  if (!previous.has(line.category)) return previous;
                  const next = new Set(previous);
                  next.delete(line.category);
                  return next;
                });
              }
              draft.setLine(line.category, patch);
            }}
          />
        ))}
        <p className="sub stmt-inline-status">
          <UiIcon name="info" className="ui-icon stmt-status-icon" data-stmt-icon="distinction" />
          0円と未入力は区別されます
        </p>
        {save.isError ? (
          <p className="notice danger" role="alert">
            {saveErrorText(save.error)}
          </p>
        ) : null}
        <PageActions className="stmt-actions">
          <Button className="stmt-icon-button" onClick={reset} disabled={save.isPending}>
            <UiIcon name="rotate-ccw" className="ui-icon stmt-action-icon" data-stmt-icon="reset" />
            リセット
          </Button>
          <Button variant="primary" type="submit" disabled={save.isPending}>
            {save.isPending ? '保存中…' : '負債残高を保存'}
          </Button>
        </PageActions>
      </form>
      <UnsavedBar count={draft.unsaved} saving={save.isPending} onReset={reset} onSave={submit} />
    </>
  );
}

function BalanceSheetSources({ sources }: { sources: StatementsScreen['bs']['sources'] }) {
  return (
    <div className="stmt-sources">
      <h3>資産の残高はまだ取り込まれていません</h3>
      <p className="sub lines">
        貸借対照表は「ある時点の残高」の表です。
        <br />
        取引をいくら足しても、<Term id="openingBalance">期首の残高</Term>が無いと資産の欄は埋まりません。
        <br />
        下のCSVを取り込むと、資産の欄が埋まります。
      </p>
      <div className="scroll-x">
        <DataTable
          className="data stack-sm"
          caption={<caption className="visually-hidden">貸借対照表の取込元</caption>}
          columns={['順', 'CSV', '元', '書き出す場所', '要る列', 'これで分かること']}
        >
          {sources.map((source) => (
            <tr key={`${source.service}/${source.name}`}>
              <th scope="row">{source.step}</th>
              <td data-label="CSV">{source.name}</td>
              <td data-label="元">
                <span className={`pill ${source.service === 'freee' ? 'biz' : 'per'}`}>{source.service}</span>
              </td>
              <td data-label="書き出す場所">
                {source.where}
                {/* メニューのたどり方だけだと、書いてある画面に行き着けない人が出る */}
                {source.url ? (
                  <a className="sub stmt-note" href={source.url} target="_blank" rel="noreferrer">
                    {source.url}
                  </a>
                ) : null}
              </td>
              <td data-label="要る列">{source.columns.join(' / ')}</td>
              <td data-label="これで分かること">
                {source.use}
                {source.note ? <span className="sub stmt-note">{source.note}</span> : null}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
      <p className="sub lines">
        手元資金が何ヶ月もつか（
        <Term id="runway" />
        ）も、残高がそろえば出せます。
        <br />
        これは
        <Term id="bcp" />
        で最初に見る数字です。
      </p>
    </div>
  );
}

export function StatementsBs({
  screen,
  onMonth,
  headingRef,
}: {
  screen: StatementsScreen;
  onMonth: (month: string) => void;
  headingRef: (element: HTMLHeadingElement | null) => void;
}) {
  const bs = screen.bs;
  const formId = useId();
  // 未入力が無ければ表を見せ、フォームは閉じた状態で始める
  const [open, setOpen] = useState(!bs.complete);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 基準月を変えたときだけ開閉の初期値を決め直す。
  useEffect(() => setOpen(!bs.complete), [bs.referenceMonth]);
  const months = monthsInPeriod(screen.period);
  const partialAsOf = bs.partial ? bs.asOf : null;
  const hasAssets = bs.assets.length > 0;

  return (
    <section id="bs" className="card stmt-section" aria-labelledby="stmt-bs-title">
      <h2 id="stmt-bs-title" tabIndex={-1} ref={headingRef}>
        貸借対照表（BS）
      </h2>
      <div className={`stmt-banner${bs.complete ? '' : ' notice'}`}>
        {bs.complete ? (
          <p className="sub">
            {monthLabel(bs.referenceMonth)}末の残高です。負債は下の入力フォームから直せます。
          </p>
        ) : (
          <span className="stmt-banner-copy">
            <UiIcon
              name="alert"
              className="ui-icon stmt-status-icon stmt-bs-alert-icon"
              data-stmt-icon="alert"
            />
            <output className="lines">
              <strong>負債残高のデータが入力されていません。</strong>
              <br />
              貸借対照表を作成するには、各項目の残高を入力してください。
              <br />
              入力された値は決算書の整合性確認に使用されます。
            </output>
          </span>
        )}
        <button
          data-native-control="disclosure"
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '入力フォームを閉じる ⌃' : '入力フォームを開く ⌄'}
        </button>
      </div>
      <div className={`stmt-bs-grid${bs.complete ? '' : ' is-incomplete'}`}>
        {bs.complete ? (
          <div>
            <BalanceTable bs={bs} asOf={partialAsOf} />
            {!hasAssets ? <BalanceSheetSources sources={bs.sources} /> : <BalanceSheetChart bs={bs} />}
          </div>
        ) : null}
        <div>
          <LiabilityForm
            id={formId}
            open={open}
            onOpen={() => setOpen(true)}
            bs={bs}
            months={months}
            onMonth={onMonth}
          />
          {!bs.complete && !hasAssets ? <BalanceSheetSources sources={bs.sources} /> : null}
        </div>
      </div>
    </section>
  );
}
