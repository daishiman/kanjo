/**
 * P5 公私仕分け: 明細の事業/個人・科目(大項目/中項目)・名義を確定する。
 * 行内3ボタン(個人/事業/自動)は楽観的更新+失敗時ロールバック。キーボード J/K移動・B/P/A判定。
 * 編集は取込値(MFのCSV)とは別枠に保存され、再取込しても残る。ルール・名義・編集一覧の管理は設定画面。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type Candidates,
  type Cls,
  type Owner,
  type PaymentMethod,
  SCOPE_LABEL,
  type TransactionsResponse,
  type TxRow,
  api,
  ownerLabel,
  paymentMethodLabel,
} from '../api.js';
import {
  type AttachmentDisclosure,
  AttachmentDisclosureCell,
  AttachmentDisclosureRow,
  OrphanedAttachmentRecovery,
  useAttachmentDisclosure,
} from '../components/Attachments.js';
import {
  CategoryInputs,
  OwnerSelect,
  useInvalidateClassification,
} from '../components/ClassificationSettings.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { monthLabel, yen, yenS } from '../format.js';

const DISCARD_CLASSIFICATION_DRAFT_MESSAGE = '未保存の変更があります。変更を破棄して編集を閉じますか?';

/** 同じ行を閉じる場合と別行へ移る場合の未保存ガードを1箇所で共有する。 */
export function canLeaveClassificationEditor(
  currentId: string | null,
  nextId: string | null,
  dirty: boolean,
  confirmDiscard: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  if (!currentId || currentId === nextId || !dirty) return true;
  return confirmDiscard(DISCARD_CLASSIFICATION_DRAFT_MESSAGE);
}

/** フィルターや画面遷移は、未保存の確認後にだけ適用する。 */
export function applyClassificationViewChange(
  currentId: string | null,
  dirty: boolean,
  busy: boolean,
  applyChange: () => void,
  confirmDiscard?: (message: string) => boolean,
): boolean {
  if (busy || !canLeaveClassificationEditor(currentId, null, dirty, confirmDiscard)) return false;
  applyChange();
  return true;
}

export function canUseClassificationShortcuts(editingId: string | null, busyEditingId: string | null) {
  return editingId === null && busyEditingId === null;
}

export function shouldGuardClassificationLinkClick(intent: {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: string;
  download: boolean;
  routerLink: boolean;
  insideMain: boolean;
  sameOrigin: boolean;
  sameDocumentHash: boolean;
}): boolean {
  return (
    !intent.defaultPrevented &&
    intent.button === 0 &&
    !intent.metaKey &&
    !intent.ctrlKey &&
    !intent.shiftKey &&
    !intent.altKey &&
    (!intent.target || intent.target === '_self') &&
    !intent.download &&
    intent.routerLink &&
    !intent.insideMain &&
    intent.sameOrigin &&
    !intent.sameDocumentHash
  );
}

/**
 * 月別の仕分けサマリー(事業/個人の件数・金額)と「仕分けの考え方」の説明枠。
 * 金額 KPI が「いくらか」を答えるのに対し、ここは「あと何件見ればよいか」を答える。
 */
export function ClassificationProgressPanel({
  summary,
  month,
}: {
  summary: TransactionsResponse['summary'];
  month: string | null;
}) {
  const headingId = useId();
  const p = summary.progress;
  const target = month ?? summary.month;
  const done = p.total - p.reviewPending;

  return (
    <section className="classification-progress" aria-labelledby={headingId}>
      <h2 id={headingId}>{target ? `${monthLabel(target)}の仕分け` : '今月の仕分け'}</h2>
      <div className="kpis">
        <KpiCard
          compact
          label="事業"
          value={`${p.bizCount}件`}
          tone="biz"
          note={`入金 ${yen(summary.bizIncome)} / 立替 ${yen(summary.bizExpense)}`}
        />
        <KpiCard
          compact
          label="個人"
          value={`${p.personalCount}件`}
          tone="per"
          note={`収入 ${yen(summary.personalIncome)} / 支出 ${yen(summary.personalExpense)}`}
        />
        <KpiCard
          compact
          label="確認済み"
          value={`${done}件`}
          note={`手動 ${p.bySource.手動}件 / ルール ${p.bySource.ルール}件`}
        />
        <KpiCard
          compact
          label="未確認"
          value={`${p.reviewPending}件`}
          note={p.reviewPending ? 'まだ人もルールも触っていない明細' : '当月は一巡しました'}
        />
      </div>
      {p.reviewPending > 0 && (
        <p className="classification-progress-hint">
          未確認の {p.reviewPending} 件は、判断がまだ無いため既定の「個人」として集計されています。
          事業のものが混じっていないか確認してください。
        </p>
      )}
      <details className="classification-thinking">
        <summary>仕分けの考え方</summary>
        <ul>
          <li>
            <strong>事業</strong>は仕事のための収入・支出です。freee に記帳して決算書に載ります。
            ここでの「事業立替」は、個人の口座やカードから払った事業の支出で、freee へ記帳すべき金額です。
          </li>
          <li>
            <strong>個人</strong>は暮らしのための収入・支出です。家計として集計し、決算書には載りません。
          </li>
          <li>
            迷ったときは「この支払いが無かったら仕事が回らないか」で決めます。
            仕事と暮らしの両方に使うもの(通信費など)は、事業として使う割合だけを事業に入れます。
          </li>
          <li>同じ支払先が毎月出てくるなら、設定画面でルールに登録すると次の取込から自動で判定されます。</li>
          <li>
            ここでの編集は取込値(MF の大項目/中項目)とは別枠に保存されるため、取り込み直しても消えません。
          </li>
        </ul>
      </details>
    </section>
  );
}

export function ClassifyPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string | null>(null);
  const [cls, setCls] = useState('');
  const [owner, setOwner] = useState('');
  const [qtext, setQtext] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [manualOnly, setManualOnly] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirtyEditingId, setDirtyEditingId] = useState<string | null>(null);
  const [busyEditingId, setBusyEditingId] = useState<string | null>(null);
  const attachments = useAttachmentDisclosure();

  const requestEditingId = useCallback(
    (nextId: string | null) => {
      if (busyEditingId) return;
      if (!canLeaveClassificationEditor(editingId, nextId, dirtyEditingId === editingId)) return;
      setDirtyEditingId(null);
      setBusyEditingId(null);
      setEditingId(nextId);
    },
    [busyEditingId, dirtyEditingId, editingId],
  );

  const requestViewChange = useCallback(
    (applyChange: () => void) =>
      applyClassificationViewChange(editingId, dirtyEditingId === editingId, busyEditingId !== null, () => {
        setDirtyEditingId(null);
        setBusyEditingId(null);
        setEditingId(null);
        applyChange();
      }),
    [busyEditingId, dirtyEditingId, editingId],
  );

  const onSettingsNavigation = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (!requestViewChange(() => {})) event.preventDefault();
    },
    [requestViewChange],
  );

  const finishEditing = useCallback(() => {
    setDirtyEditingId(null);
    setBusyEditingId(null);
    setEditingId(null);
  }, []);

  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (cls) params.set('cls', cls);
  if (owner) params.set('owner', owner);
  if (qtext) params.set('q', qtext);
  if (method) params.set('method', method);
  if (manualOnly) params.set('manual', '1');
  const key = ['transactions', month, cls, owner, qtext, method, manualOnly] as const;

  const q = useQuery({
    queryKey: key,
    queryFn: () => api<TransactionsResponse>(`/transactions?${params.toString()}`),
  });

  const setClass = useMutation({
    mutationFn: ({ txId, next }: { txId: string; next: Cls | null }) =>
      api(`/transactions/${encodeURIComponent(txId)}/class`, {
        method: 'PUT',
        body: JSON.stringify({ cls: next }),
      }),
    onMutate: async ({ txId, next }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TransactionsResponse>(key);
      if (prev) {
        qc.setQueryData<TransactionsResponse>(key, {
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === txId
              ? { ...t, cls: next ?? t.cls, src: next ? ('手動' as const) : ('既定' as const) }
              : t,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev); // 失敗時ロールバック
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['classification'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
      void qc.invalidateQueries({ queryKey: ['household'] });
    },
  });

  const rows = q.data?.transactions ?? [];

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!canUseClassificationShortcuts(editingId, busyEditingId)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === 'j') setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
      else if (k === 'k') setFocusIdx((i) => Math.max(i - 1, 0));
      else if ((k === 'b' || k === 'p' || k === 'a') && rows[focusIdx]) {
        const tx = rows[focusIdx];
        setClass.mutate({ txId: tx.id, next: k === 'b' ? 'biz' : k === 'p' ? 'per' : null });
      }
    },
    [rows, focusIdx, setClass, editingId, busyEditingId],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    if (!editingId || dirtyEditingId !== editingId) return;
    const preventDraftUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventDraftUnload);
    return () => window.removeEventListener('beforeunload', preventDraftUnload);
  }, [dirtyEditingId, editingId]);

  useEffect(() => {
    if (!editingId) return;
    const guardShellNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        !shouldGuardClassificationLinkClick({
          defaultPrevented: event.defaultPrevented,
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          target: anchor.target,
          download: anchor.hasAttribute('download'),
          routerLink: anchor.hasAttribute('data-discover'),
          insideMain: anchor.closest('#main-content') !== null,
          sameOrigin: url.origin === window.location.origin,
          sameDocumentHash:
            url.pathname === window.location.pathname &&
            url.search === window.location.search &&
            url.hash.length > 0,
        })
      )
        return;
      if (!requestViewChange(() => {})) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guardShellNavigation, true);
    return () => document.removeEventListener('click', guardShellNavigation, true);
  }, [editingId, requestViewChange]);

  if (q.isLoading)
    return (
      <>
        <PageHeader route="classify" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="classify" />
        <PageState status="error" error={q.error} />
      </>
    );
  const d = q.data;
  const s = d.summary;

  return (
    <>
      <PageHeader route="classify" />
      <p className="kbd-help">
        <kbd>J</kbd>/<kbd>K</kbd> 移動・<kbd>B</kbd> 事業・<kbd>P</kbd> 個人・<kbd>A</kbd> 自動
      </p>

      <div className="notice info">
        事業立替 <strong className="num">{yen(s.bizExpense)}</strong>{' '}
        は「freeeへ記帳すべき金額」。税務上の正はfreeeの記帳です。
      </div>
      {s.conflictCount > 0 && (
        <div className="notice">
          再取込で取込値が変わった編集済み明細が {s.conflictCount}{' '}
          件あります(「編集済み」の行に元の値を表示)。
          <Link to="/settings" onClick={onSettingsNavigation}>
            設定の「手動で編集した明細」
          </Link>
          で見直せます。
        </div>
      )}
      {s.nonCountableCount > 0 && (
        <div className="notice info">
          この月はCSVの {s.nonCountableCount}{' '}
          件が集計対象外(口座間の振替、またはMFで「計算対象」を外した明細)です。取込漏れではなく、記録は残したうえで収支には数えていません。
        </div>
      )}
      {s.noInstitutionCount > 0 && (
        <div className="notice info">
          口座(保有金融機関)が記録されていない明細が {s.noInstitutionCount}{' '}
          件あります。MF明細を取り込み直すと口座が入り、名義の自動判定が効きます。
        </div>
      )}

      <OrphanedAttachmentRecovery />

      <div className="kpis">
        <KpiCard
          label="明細数"
          value={String(s.count)}
          note={s.editedCount ? `うち手動編集 ${s.editedCount}件` : undefined}
        />
        <KpiCard label="総収入" value={yen(s.totalIncome)} />
        <KpiCard label="事業入金" value={yen(s.bizIncome)} tone="biz" />
        <KpiCard
          label="個人収入"
          value={yen(s.personalIncome)}
          tone="per"
          note={`${ownerLabel('business')} ${yen(s.incomeByOwner.business)} / ${ownerLabel('spouse')} ${yen(
            s.incomeByOwner.spouse,
          )} / ${ownerLabel('family')} ${yen(s.incomeByOwner.family)}${
            s.incomeByOwner.unset ? ` / 未設定 ${yen(s.incomeByOwner.unset)}` : ''
          }`}
        />
        <KpiCard label="総支出" value={yen(s.totalExpense)} />
        <KpiCard label="事業立替" value={yen(s.bizExpense)} tone="biz" />
        <KpiCard label="個人支出" value={yen(s.personalExpense)} tone="per" />
      </div>

      <ClassificationProgressPanel summary={s} month={d.month} />

      <div className="toolbar">
        <select
          aria-label="対象月"
          value={month ?? d.month ?? ''}
          onChange={(e) => {
            const next = e.target.value;
            requestViewChange(() => setMonth(next));
          }}
        >
          {d.months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="segment">
          {(
            [
              ['', 'すべて'],
              ['biz', '事業'],
              ['per', '個人'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={cls === k ? 'on' : ''}
              aria-pressed={cls === k}
              onClick={() => requestViewChange(() => setCls(k))}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="segment">
          {(
            [
              ['', '名義: すべて'],
              ['business', ownerLabel('business')],
              ['spouse', ownerLabel('spouse')],
              ['family', ownerLabel('family')],
              ['unset', '未設定'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={owner === k ? 'on' : ''}
              aria-pressed={owner === k}
              onClick={() => requestViewChange(() => setOwner(k))}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="segment">
          {(
            [
              ['', '支払: すべて'],
              ['cash', paymentMethodLabel('cash')],
              ['account', paymentMethodLabel('account')],
              ['card', paymentMethodLabel('card')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={method === k ? 'on' : ''}
              aria-pressed={method === k}
              onClick={() => requestViewChange(() => setMethod(k))}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="segment">
          <button
            type="button"
            className={manualOnly ? 'on' : ''}
            aria-pressed={manualOnly}
            onClick={() => requestViewChange(() => setManualOnly((v) => !v))}
          >
            編集済みのみ
          </button>
        </span>
        <input
          type="text"
          placeholder="キーワード検索(内容・科目・口座)"
          value={qtext}
          onChange={(e) => {
            if ((e.nativeEvent as InputEvent).isComposing) return;
            const next = e.target.value;
            requestViewChange(() => setQtext(next));
          }}
        />
        <Link to="/settings" className="btn" onClick={onSettingsNavigation}>
          ルール・名義の設定
        </Link>
      </div>

      <div className="card scroll-x classify-table-card">
        <table className="data classify-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>内容</th>
              <th>口座</th>
              <th>大項目/中項目</th>
              <th>金額</th>
              <th>判定</th>
              <th>名義</th>
              <th>証憑</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <TxLine
                key={t.id}
                t={t}
                focused={i === focusIdx}
                editing={editingId === t.id}
                editBusy={busyEditingId !== null}
                candidates={d.candidates}
                onFocus={() => setFocusIdx(i)}
                onSet={(next) => setClass.mutate({ txId: t.id, next })}
                onToggleEdit={() => requestEditingId(editingId === t.id ? null : t.id)}
                onDirtyChange={(dirty) => setDirtyEditingId(dirty ? t.id : null)}
                onBusyChange={(busy) => setBusyEditingId(busy ? t.id : null)}
                onSaved={finishEditing}
                attachments={attachments}
              />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="empty">
                  該当する明細がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TxLine({
  t,
  focused,
  editing,
  editBusy,
  candidates,
  onFocus,
  onSet,
  onToggleEdit,
  onDirtyChange,
  onBusyChange,
  onSaved,
  attachments,
}: {
  t: TxRow;
  focused: boolean;
  editing: boolean;
  editBusy: boolean;
  candidates: Candidates;
  onFocus: () => void;
  onSet: (next: Cls | null) => void;
  onToggleEdit: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
  attachments: AttachmentDisclosure;
}) {
  const catEdited = t.catSrc === '手動';
  const editorId = useId();
  const qc = useQueryClient();
  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: キーボード操作はページ全体のJ/K/B/P/Aハンドラで提供 */}
      <tr
        className={[focused ? 'kbd-focus' : '', editing ? 'editing-open' : ''].filter(Boolean).join(' ')}
        onClick={onFocus}
      >
        <td className="num">{t.date}</td>
        <td className="tx-description" title={t.description}>
          {t.description}
        </td>
        <td className="tx-institution" title={t.institution ?? undefined}>
          {t.institution ?? '—'}
          {t.paymentMethod === 'cash' && (
            <>
              {' '}
              <span className="pill neutral" title="現金の記帳から追加した明細(取込ではない)">
                手入力
              </span>
            </>
          )}
        </td>
        <td>
          {t.big}
          {t.mid ? ` / ${t.mid}` : ''}
          {catEdited && (
            <>
              {' '}
              <span className="pill edited">{t.conflict ? '編集済み・取込値が変更' : '編集済み'}</span>
              {t.scopeMismatch && (
                <span
                  className="pill warn"
                  title="公私を変えたため、科目が今の系統(事業=freee科目 / 個人=MF内訳)の候補にありません"
                >
                  科目が
                  <Term id="publicPrivate" />
                  と不一致
                </span>
              )}
              <span className="orig">
                取込値: {t.csvBig}
                {t.csvMid ? ` / ${t.csvMid}` : ''}
              </span>
            </>
          )}
          {t.catSrc === 'ルール' && (
            <>
              {' '}
              <span className="pill neutral">ルール</span>
              <span className="orig">
                取込値: {t.csvBig}
                {t.csvMid ? ` / ${t.csvMid}` : ''}
              </span>
            </>
          )}
        </td>
        <td className="num">{yenS(t.amount)}</td>
        <td>
          <span className={`pill ${t.cls}`}>{t.cls === 'biz' ? '事業' : '個人'}</span>{' '}
          <span className="pill neutral">{t.src}</span>
        </td>
        <td>
          {t.owner ? ownerLabel(t.owner) : <span className="pill neutral">未設定</span>}
          {t.owner && <span className="orig owner-source">{t.ownerSrc}</span>}
        </td>
        <td>
          <AttachmentDisclosureCell
            targetId={t.id}
            status={t.attachmentCount > 0 ? 'attached' : undefined}
            count={t.attachmentCount}
            disclosure={attachments}
            buttonClassName="classify-quick"
            disabledReason={
              t.idStable
                ? undefined
                : 'MFのID列がない明細は、再取込後の同一性を保証できないため添付できません'
            }
          />
        </td>
        <td>
          <div className="classify-quick-actions" aria-label={`${t.description}の簡易操作`}>
            <QuickClassButton
              label="個人"
              selected={t.cls === 'per' && t.src === '手動'}
              disabled={editBusy}
              onClick={() => onSet('per')}
            />
            <QuickClassButton
              label="事業"
              selected={t.cls === 'biz' && t.src === '手動'}
              disabled={editBusy}
              onClick={() => onSet('biz')}
            />
            <button
              type="button"
              className="mini classify-quick"
              disabled={editBusy || t.src !== '手動'}
              onClick={() => onSet(null)}
            >
              自動に戻す
            </button>
            <button
              type="button"
              className="mini classify-quick edit-trigger"
              aria-expanded={editing}
              aria-controls={editorId}
              disabled={editBusy}
              onClick={onToggleEdit}
            >
              {editing ? '編集を閉じる' : '編集する'}
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <EditorRow
          id={editorId}
          t={t}
          candidates={candidates}
          onClose={onToggleEdit}
          onDirtyChange={onDirtyChange}
          onBusyChange={onBusyChange}
          onSaved={onSaved}
        />
      )}
      <AttachmentDisclosureRow
        targetId={t.id}
        colSpan={9}
        disclosure={attachments}
        rowClassName="editing-open"
        onChanged={() => void qc.invalidateQueries({ queryKey: ['transactions'] })}
      />
    </>
  );
}

function QuickClassButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mini classify-quick"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {selected && <span aria-hidden="true">✓ </span>}
      {label}
    </button>
  );
}

/** 科目・名義・公私の編集パネル。保存 / 取込値に戻す / 同じ内容をルール化 */
function EditorRow({
  id,
  t,
  candidates,
  onClose,
  onDirtyChange,
  onBusyChange,
  onSaved,
}: {
  id: string;
  t: TxRow;
  candidates: Candidates;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
}) {
  const invalidate = useInvalidateClassification();
  const [big, setBig] = useState(t.edit?.big ?? '');
  const [mid, setMid] = useState(t.edit?.mid ?? '');
  const [own, setOwn] = useState<Owner | null>(t.edit?.owner ?? null);
  const [c, setC] = useState<Cls | null>(t.edit?.cls ?? null);
  const [keyword, setKeyword] = useState(t.description);
  const [ruleDone, setRuleDone] = useState(false);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/transactions/${encodeURIComponent(t.id)}/edit`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      onSaved();
    },
  });
  const rule = useMutation({
    mutationFn: () =>
      api('/rules', {
        method: 'POST',
        body: JSON.stringify({ keyword, cls: c, big: big || null, mid: mid || null, owner: own, top: true }),
      }),
    onSuccess: () => {
      setRuleDone(true);
      invalidate();
    },
  });
  /** 科目候補の系統 = 編集後の公私(未指定なら現在の有効値) */
  const scope: Cls = c ?? t.cls;
  const editDirty =
    big !== (t.edit?.big ?? '') ||
    mid !== (t.edit?.mid ?? '') ||
    own !== (t.edit?.owner ?? null) ||
    c !== (t.edit?.cls ?? null);
  const hasUnsavedChanges = editDirty || (!ruleDone && keyword !== t.description);
  const busy = save.isPending || rule.isPending;
  const ruleAttr = !!(c || big || mid || own);

  useEffect(() => onDirtyChange(hasUnsavedChanges), [hasUnsavedChanges, onDirtyChange]);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  return (
    <tr className="editor">
      <td colSpan={9}>
        <section id={id} className="classification-editor" aria-labelledby={`${id}-title`}>
          <header className="classification-editor-summary">
            <div>
              <h3 id={`${id}-title`}>{t.description}</h3>
              <p>
                <span className="num">{t.date}</span>
                {' ・ '}
                {t.institution ?? '口座未記録'}
              </p>
            </div>
            <strong className="num classification-editor-amount">{yenS(t.amount)}</strong>
          </header>

          <p className="classification-import-summary">
            <span>取込時の科目</span>
            <strong>
              {t.csvBig}
              {t.csvMid ? ` / ${t.csvMid}` : ''}
            </strong>
          </p>

          <fieldset className="classification-editor-fields" aria-label="変更内容" disabled={busy}>
            <div className="classification-editor-grid">
              <label className="classification-field">
                <span>公私</span>
                <select
                  value={c ?? ''}
                  onChange={(e) => {
                    const next = (e.target.value || null) as Cls | null;
                    setC(next);
                    // 系統(事業/個人)が変わると候補も変わるので科目は選び直す
                    if ((next ?? t.cls) !== scope) {
                      setBig('');
                      setMid('');
                    }
                  }}
                >
                  <option value="">
                    {t.cls === 'biz' ? '事業' : '個人'}のまま({t.src})
                  </option>
                  <option value="biz">事業</option>
                  <option value="per">個人</option>
                </select>
              </label>

              <div className="classification-field">
                <span>科目</span>
                <span className="classification-field-help">
                  {SCOPE_LABEL[scope]}(空欄は取込値・ルールを維持)
                </span>
                <div className="classification-category-controls">
                  <CategoryInputs
                    candidates={candidates}
                    scope={scope}
                    big={big}
                    mid={mid}
                    onChange={(v) => {
                      setBig(v.big);
                      setMid(v.mid);
                    }}
                  />
                </div>
              </div>

              <div className="classification-field">
                <span>名義</span>
                <OwnerSelect value={own} onChange={setOwn} />
              </div>
            </div>

            <details className="classification-rule-details">
              <summary>同じ内容にも適用</summary>
              <div className="classification-rule-form">
                <label className="classification-field">
                  <span>キーワード</span>
                  <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </label>
                <button
                  type="button"
                  disabled={!keyword.trim() || !ruleAttr || rule.isPending || ruleDone}
                  onClick={() => rule.mutate()}
                >
                  {ruleDone ? 'ルールを追加しました' : '最優先ルールを追加'}
                </button>
              </div>
              {rule.isError && (
                <p className="classification-editor-error" role="alert">
                  {(rule.error as Error).message}
                </p>
              )}
            </details>
          </fieldset>

          <div className="classification-editor-actions">
            <button
              type="button"
              className="tertiary-button"
              disabled={!t.edited || busy}
              onClick={() => save.mutate({ reset: true })}
            >
              取込値に戻す
            </button>
            <button type="button" disabled={busy} onClick={onClose}>
              編集を閉じる
            </button>
            <button
              type="button"
              className="primary"
              disabled={!editDirty || busy}
              onClick={() => save.mutate({ big: big || null, mid: mid || null, owner: own, cls: c })}
            >
              変更を保存
            </button>
          </div>
          {save.isError && (
            <p className="classification-editor-error" role="alert">
              {(save.error as Error).message}
            </p>
          )}
        </section>
      </td>
    </tr>
  );
}
