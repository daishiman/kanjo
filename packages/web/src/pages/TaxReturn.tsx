/**
 * P16 確定申告: 申告できる状態かの確認 → 科目の割り当てと家事按分 → 決算書への転記シート。
 *
 * 画面の並びは「確認 → 直す → 書き出す」の順に固定する。
 * 先に書き出しを見せると、判定が赤のまま出力して申告してしまう。
 */
import {
  HOUSEHOLD_RATIO_BASIS_MAX,
  type ResolvedTaxAccountSetting,
  type TaxReadinessLevel,
  type TaxReturnRow,
} from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type TaxOverviewResponse, api } from '../api.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { yen } from '../format.js';
import { useTaxYear } from '../tax-year.js';

const LEVEL_PILL: Record<TaxReadinessLevel, string> = {
  blocked: 'pill alert',
  warn: 'pill warn',
  ok: 'pill calm',
};
const LEVEL_LABEL: Record<TaxReadinessLevel, string> = {
  blocked: '要対応',
  warn: '確認',
  ok: '完了',
};
const VERDICT_NOTICE: Record<TaxReadinessLevel, { cls: string; text: string }> = {
  blocked: {
    cls: 'notice danger',
    text: 'このまま申告すると金額が合いません。下の「要対応」を先に片付けてください。',
  },
  warn: {
    cls: 'notice',
    text: '転記できる状態です。ただし確認が残っています。中身を見てから書き出してください。',
  },
  ok: { cls: 'notice info', text: '転記できる状態です。下のシートを決算書へ書き写してください。' },
};

/** 編集中の1科目。保存前は入力途中の文字列をそのまま持つ(数字に直すのは保存時) */
interface Draft {
  taxAccount: string;
  businessPercent: string;
  basis: string;
}

const toDraft = (s: ResolvedTaxAccountSetting): Draft => ({
  taxAccount: s.taxAccount ?? '',
  businessPercent: String(s.businessPercent),
  basis: s.basis ?? '',
});

interface TaxAccountInput {
  account: string;
  taxAccount: string;
  businessPercent: number;
  basis: string | null;
}

export function TaxReturnPage() {
  const qc = useQueryClient();
  const { key, withTaxYear } = useTaxYear();
  const q = useQuery({
    queryKey: ['tax-overview', key],
    queryFn: () => api<TaxOverviewResponse>(withTaxYear('/tax/overview')),
  });

  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [unsetOnly, setUnsetOnly] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const save = useMutation({
    mutationFn: (settings: TaxAccountInput[]) =>
      api(withTaxYear('/tax/accounts'), { method: 'PUT', body: JSON.stringify({ settings }) }),
    onMutate: () => {
      setSaveError(null);
      setSaveStatus('保存中です');
    },
    onSuccess: () => {
      setDraft({});
      setSaveStatus(`${q.data?.year ?? ''}年の科目設定を保存しました`);
      void qc.invalidateQueries({ queryKey: ['tax-overview'] });
    },
    onError: (e: Error) => {
      setSaveStatus('保存できませんでした');
      setSaveError(e.message);
    },
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="tax" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="tax" />
        <PageState status="error" error={q.error} />
      </>
    );

  const { statement, checks, verdict, receipts, settings, taxAccountOptions, year, receiptArchive } = q.data;
  if (!statement.months.length)
    return (
      <>
        <PageHeader route="tax" />
        <PageState
          status="empty"
          message={`${year}年に仕訳がありません。先に取り込むか、申告対象年を切り替えてください。`}
          action={
            <Link className="btn primary tax-empty-action" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

  const draftOf = (s: ResolvedTaxAccountSetting): Draft => draft[s.account] ?? toDraft(s);
  const edit = (setting: ResolvedTaxAccountSetting, patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, [setting.account]: { ...draftOf(setting), ...patch } }));

  const dirty = Object.keys(draft).length > 0;
  const canSave = dirty || settings.some((setting) => setting.status === 'unconfirmed');
  // 行なしだけが未確認。100%も明示保存すれば確認済みになる。
  const shownSettings = unsetOnly
    ? settings.filter((s) => {
        const d = draftOf(s);
        const percent = Number(d.businessPercent);
        return (
          s.status === 'unconfirmed' ||
          !d.taxAccount ||
          !Number.isInteger(percent) ||
          percent < 0 ||
          percent > 100 ||
          (percent < 100 && !d.basis.trim())
        );
      })
    : settings;

  const submit = () => {
    const payload: TaxAccountInput[] = [];
    for (const setting of settings) {
      const d = draftOf(setting);
      const percent = Number(d.businessPercent);
      if (!d.taxAccount) {
        setSaveError(`${setting.account}: 決算書の科目を選んでください`);
        setSaveStatus('未入力があります');
        return;
      }
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        setSaveError(`${setting.account}: 事業割合は0〜100の整数で入力してください`);
        setSaveStatus('入力を確認してください');
        return;
      }
      if (percent < 100 && !d.basis.trim()) {
        setSaveError(`${setting.account}: 家事按分の根拠を入力してください`);
        setSaveStatus('未入力があります');
        return;
      }
      payload.push({
        account: setting.account,
        taxAccount: d.taxAccount,
        businessPercent: percent,
        basis: percent < 100 ? d.basis.trim() : null,
      });
    }
    save.mutate(payload);
  };

  return (
    <>
      <PageHeader route="tax" />

      <div className={VERDICT_NOTICE[verdict].cls}>
        <strong>{year}年分: </strong>
        {VERDICT_NOTICE[verdict].text}
      </div>

      <div className="kpis">
        <KpiCard label="売上(収入金額)" value={yen(statement.revenue)} tone="biz" />
        <KpiCard label="経費(申告額)" value={yen(statement.expenseTotal)} note="家事按分を引いた後" />
        <KpiCard
          label="所得(控除前)"
          value={yen(statement.incomeBeforeDeduction)}
          note="青色申告特別控除を引く前"
        />
        <KpiCard
          label="証憑の添付率"
          value={`${Math.round(receipts.coverage * 100)}%`}
          note={`未添付 ${receipts.missingCount}件 / ${yen(receipts.missingAmount)}`}
        />
      </div>

      <section className="card">
        <h2>申告の準備チェック</h2>
        <p className="sub">上から順に片付ける。「要対応」が残っている間は金額が変わる。</p>
        <ol className="tax-checks">
          {checks.map((check) => (
            <li key={check.id} className={`tax-check ${check.level}`}>
              <div className="tax-check-head">
                <span className={LEVEL_PILL[check.level]}>{LEVEL_LABEL[check.level]}</span>
                <strong>{check.title}</strong>
              </div>
              <p className="tax-check-detail">{check.detail}</p>
              {check.level !== 'ok' && (
                <p className="tax-check-action">
                  {check.href && check.href !== '/tax' ? (
                    <Link to={check.href}>{check.action}</Link>
                  ) : (
                    check.action
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>科目の扱い(決算書への割り当て・家事按分)</h2>
        <p className="sub">
          帳簿の科目名は決算書の欄名と一致しない。ここで対応づけ、自宅家賃などは事業割合を決める。
          100%（全額事業）も確認して保存する。按分するときは根拠を書く。
        </p>
        <div className="toolbar">
          <label>
            <input type="checkbox" checked={unsetOnly} onChange={(e) => setUnsetOnly(e.target.checked)} />{' '}
            未確認・要対応だけ表示
          </label>
          <button
            type="button"
            className="btn primary tax-save-action"
            disabled={!canSave || save.isPending}
            onClick={submit}
          >
            {save.isPending ? '保存中…' : '設定を保存'}
          </button>
          {dirty && !save.isPending && <span className="pill warn">未保存の変更あり</span>}
        </div>
        <p className={saveError ? 'notice danger' : 'tax-save-status'} aria-live="polite">
          {saveError ?? saveStatus}
        </p>
        <div className="scroll-x">
          <table className="data stack-sm tax-policy-table">
            <thead>
              <tr>
                <th>帳簿の科目</th>
                <th>決算書の科目</th>
                <th className="num">事業割合(%)</th>
                <th>按分の根拠</th>
              </tr>
            </thead>
            <tbody>
              {shownSettings.map((s) => {
                const d = draftOf(s);
                const needsBasis =
                  d.businessPercent.trim() !== '' && Number(d.businessPercent) < 100 && !d.basis.trim();
                return (
                  <tr key={s.account}>
                    <td data-label="帳簿の科目">
                      {s.account} {s.status === 'unconfirmed' && <span className="pill alert">未確認</span>}
                    </td>
                    <td data-label="決算書の科目">
                      <select
                        value={d.taxAccount}
                        aria-label={`${s.account} の決算書科目`}
                        onChange={(e) => edit(s, { taxAccount: e.target.value })}
                      >
                        <option value="">(未割当・申告額に入れない)</option>
                        <optgroup label="決算書に印字されている欄">
                          {taxAccountOptions.printed.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="空欄に自分で書く欄">
                          {taxAccountOptions.additional.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="専用欄">
                          {taxAccountOptions.separate.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="num" data-label="事業割合(%)">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        aria-label={`${s.account} の事業割合`}
                        value={d.businessPercent}
                        onChange={(e) => edit(s, { businessPercent: e.target.value })}
                      />
                    </td>
                    <td data-label="按分の根拠">
                      <input
                        type="text"
                        maxLength={HOUSEHOLD_RATIO_BASIS_MAX}
                        placeholder={needsBasis ? '例: 作業部屋6畳 / 全体30畳' : ''}
                        aria-label={`${s.account} の按分の根拠`}
                        aria-invalid={needsBasis}
                        value={d.basis}
                        onChange={(e) => edit(s, { basis: e.target.value })}
                      />
                      {needsBasis && <span className="pill alert">根拠が必要</span>}
                    </td>
                  </tr>
                );
              })}
              {!shownSettings.length && (
                <tr>
                  <td colSpan={4} className="empty">
                    未設定の科目はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>決算書への転記シート</h2>
        <p className="sub">
          上から順に、青色申告決算書(損益計算書)の同じ名前の欄へ書き写す。
          「空欄に記入」は決算書にあらかじめ印字されていない欄なので、科目名も自分で書く。
        </p>
        {statement.limits.length > 0 && (
          <ul className="lines">
            {statement.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        )}
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>区分</th>
                <th>決算書の科目</th>
                <th className="num">申告額</th>
                <th className="num">按分前</th>
                <th className="num">家事分</th>
                <th>内訳(帳簿の科目)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>収入金額</td>
                <td>売上(収入)金額</td>
                <td className="num">{yen(statement.revenue)}</td>
                <td className="num" />
                <td className="num" />
                <td />
              </tr>
              <StatementRows label="印字欄" rows={statement.printedRows} />
              <StatementRows label="空欄に記入" rows={statement.blankRows} />
              <StatementRows label="専用欄" rows={statement.separateRows} />
              {statement.unassigned.map((u) => (
                <tr key={u.account} className="tax-unassigned">
                  <td>
                    <span className="pill alert">未割当</span>
                  </td>
                  <td>―</td>
                  <td className="num">0</td>
                  <td className="num">{yen(u.gross)}</td>
                  <td className="num" />
                  <td>{u.account}(決算書の科目を割り当ててください)</td>
                </tr>
              ))}
              <tr className="tax-total">
                <td>合計</td>
                <td>経費計</td>
                <td className="num">{yen(statement.expenseTotal)}</td>
                <td className="num">{yen(statement.expenseTotal + statement.privateTotal)}</td>
                <td className="num">{yen(statement.privateTotal)}</td>
                <td />
              </tr>
              <tr className="tax-total">
                <td>差引</td>
                <td>所得金額(青色申告特別控除前)</td>
                <td className="num">{yen(statement.incomeBeforeDeduction)}</td>
                <td className="num" />
                <td className="num" />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>書き出し</h2>
        <p className="sub">
          freee・e-Taxへの転記補助と申告準備用の控えです。申告書の生成や法令適合を保証するものではありません。
        </p>
        <div className="report-actions tax-export-actions">
          {verdict === 'blocked' ? (
            <button type="button" className="btn primary" disabled>
              要対応を解消するとCSVを書き出せます
            </button>
          ) : (
            <>
              <a className="btn primary" href={withTaxYear('/api/export/tax/statement.csv')}>
                転記シート(CSV)
              </a>
              <a className="btn" href={withTaxYear('/api/export/tax/expenses.csv')}>
                科目別経費内訳(CSV)
              </a>
            </>
          )}
          {verdict !== 'blocked' && receipts.missingCount === 0 ? (
            Array.from({ length: receiptArchive.parts }, (_, index) => index + 1).map((part) => (
              <a key={part} className="btn" href={withTaxYear(`/api/export/tax/receipts.zip?part=${part}`)}>
                証憑まとめ(ZIP{receiptArchive.parts > 1 ? ` ${part}/${receiptArchive.parts}` : ''})
              </a>
            ))
          ) : (
            <button type="button" className="btn" disabled>
              証憑が揃うとZIPを書き出せます
            </button>
          )}
          <Link className="btn" to="/tax/receipts">
            未添付の領収書を潰す({receipts.missingCount}件)
          </Link>
        </div>
      </section>
    </>
  );
}

/** 転記シートの1区分。行が無い区分は見出しごと出さない(空欄を数えさせない) */
function StatementRows({ label, rows }: { label: string; rows: TaxReturnRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={`${label}:${row.taxAccount}`}>
          <td>{label}</td>
          <td>{row.taxAccount}</td>
          <td className="num">{yen(row.amount)}</td>
          <td className="num">{row.privateAmount ? yen(row.gross) : ''}</td>
          <td className="num">{row.privateAmount ? yen(row.privateAmount) : ''}</td>
          <td className="tax-sources">
            {row.sources
              .map((s) => (s.businessPercent == null ? s.account : `${s.account}(${s.businessPercent}%)`))
              .join(' / ')}
          </td>
        </tr>
      ))}
    </>
  );
}
