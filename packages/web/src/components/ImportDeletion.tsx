/**
 * 取込データの削除・取り消しの画面部品(T12 / T14)。
 *
 * ここで守っていること:
 *  - 1回のクリックで消えない。必ず「消える内容の確認」を挟む二段階にする。
 *  - 全件はサーバが導出した真の全期間を見せ、明示文言を入力するまで進めない。
 *  - 画面にはテーブル名も SQL も明細の中身も出さない。件数と月だけを出す(DR-9)。
 *  - 消したあとは、その場と履歴の両方から取り消せる。期限を必ず添える。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import {
  type DeletionOperation,
  type DeletionPreflight,
  type DeletionResult,
  type ImportHistoryDiscardPreflight,
  type ImportHistoryDiscardResult,
  type UndoResult,
  api,
} from '../api.js';
import { describeError } from './Page.js';

/** 消す対象の指定。サーバへそのまま送る形 */
type DeletionRequest =
  | { granularity: 'transaction'; txIds: string[] }
  | { granularity: 'period'; period: { from: string; to: string }; kinds?: string[] }
  | {
      granularity: 'all';
      kinds?: string[];
    }
  | { granularity: 'import'; importId: number };

const KIND_CHOICES = [
  { value: 'mf', label: 'MF明細' },
  { value: 'freee', label: 'freee仕訳' },
  { value: 'assets', label: 'MF資産推移' },
] as const;

const GRANULARITY_LABEL: Record<DeletionOperation['granularity'], string> = {
  transaction: '明細を選んで',
  import: '取込ごと',
  period: '期間で',
  all: '全件',
};

const day = (iso: string): string => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString('ja-JP');
};

/** 期限までの残り日数。「あと何日戻せるか」を数字で出すために使う */
const daysLeft = (expiresAt: string, now = Date.now()): number =>
  Math.ceil((Date.parse(expiresAt) - now) / 86_400_000);

/**
 * 消える内容の要約。件数と月だけを出す。
 * 「何が消えないか」を並べて書くのは、消える件数だけでは手入力の不安が消えないため。
 */
function PreflightSummary({
  preflight,
  headingId,
}: {
  preflight: DeletionPreflight;
  headingId?: string;
}) {
  const { counts, collateral } = preflight;
  const generatedHeadingId = useId();
  const titleId = headingId ?? generatedHeadingId;
  return (
    <section className="deletion-preflight" aria-labelledby={titleId}>
      <div className="deletion-step-heading">
        <span className="deletion-step-number">2</span>
        <div>
          <h3 id={titleId}>消える内容</h3>
          <span>この時点ではまだ削除されていません</span>
        </div>
      </div>
      <dl className="deletion-count-grid">
        <div>
          <dt>MF明細</dt>
          <dd className="num">{counts.mfTx}件</dd>
        </div>
        <div>
          <dt>freee仕訳</dt>
          <dd className="num">{counts.freeeDeals}件</dd>
        </div>
        <div>
          <dt>MF資産残高</dt>
          <dd className="num">{counts.balanceEntries}件</dd>
        </div>
        <div>
          <dt>対象月</dt>
          <dd className="num">{counts.months}ヶ月</dd>
        </div>
      </dl>
      {preflight.months.length > 0 && <p className="deletion-months">{preflight.months.join(', ')}</p>}
      <section className="deletion-collateral" aria-label="一緒に外れる手当て">
        <strong>一緒に外れる手当て</strong>
        <ul>
          <li>公私・科目の手当て {collateral.txEdits}件</li>
          <li>明細の分割 {collateral.txSplits}件</li>
          <li>添付した書類 {collateral.attachments}件</li>
          <li>
            手で記帳した現金 {collateral.cashEntries}件
            {collateral.cashEntries === 0 ? '(取込の削除では消えません)' : ''}
          </li>
        </ul>
      </section>
      <p className="deletion-safety-copy">
        手入力した負債・現金は残ります。
        {preflight.undoable
          ? `削除後${preflight.undoRetentionDays}日間は取り消せます。`
          : '実行後は取り消せません。'}
      </p>
    </section>
  );
}

/**
 * 二段階の削除。押した瞬間には何も消えず、確認を経てから消す。
 *
 * preflight で受け取った指紋を実行時にそのまま返すことで、
 * 「確認した内容」と「実際に消える内容」がずれていたらサーバ側で止まる。
 */
function useDeletionFlow(onDone: (result: DeletionResult) => void) {
  const [preflight, setPreflight] = useState<DeletionPreflight | null>(null);
  const [request, setRequest] = useState<DeletionRequest | null>(null);

  const check = useMutation({
    mutationFn: async (next: DeletionRequest) => {
      const path =
        next.granularity === 'import'
          ? `/imports/${next.importId}/undo/preflight`
          : '/data/deletions/preflight';
      const body =
        next.granularity === 'import'
          ? undefined
          : next.granularity === 'all'
            ? JSON.stringify({ granularity: next.granularity, kinds: next.kinds })
            : JSON.stringify(next);
      const result = await api<DeletionPreflight>(path, { method: 'POST', body });
      return { next, result };
    },
    onSuccess: ({ next, result }) => {
      setRequest(next);
      setPreflight(result);
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!request || !preflight) throw new Error('確認していない削除は実行できません');
      if (request.granularity === 'all' && !preflight.fullRange)
        throw new Error('全期間を確認できないため実行できません');
      const path = request.granularity === 'import' ? `/imports/${request.importId}/undo` : '/data/deletions';
      const body =
        request.granularity === 'import'
          ? JSON.stringify({ fingerprint: preflight.fingerprint })
          : JSON.stringify({
              ...request,
              ...(request.granularity === 'all' ? { confirmedPeriod: preflight.fullRange } : {}),
              fingerprint: preflight.fingerprint,
            });
      return api<DeletionResult>(path, { method: 'POST', body });
    },
    onSuccess: (result) => {
      setRequest(null);
      setPreflight(null);
      onDone(result);
    },
  });

  const cancel = () => {
    setRequest(null);
    setPreflight(null);
    check.reset();
    run.reset();
  };

  return { preflight, check, run, cancel };
}

/** 消した直後の知らせと、その場での取り消し。 */
export function DeletedNotice({
  result,
  onUndone,
  nextAction,
}: {
  result: DeletionResult;
  onUndone: () => void;
  nextAction?: { label: string; onClick: () => void };
}) {
  const qc = useQueryClient();
  const undo = useMutation({
    mutationFn: () => api<UndoResult>(`/data/undo/${result.operationId}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries();
      onUndone();
    },
  });
  return (
    <div className="deleted-notice" aria-live="polite">
      <div>
        <strong>{nextAction ? '入れ替えの準備ができました' : '取込データを削除しました'}</strong>
        <span>
          明細 {result.counts.mfTx}件・仕訳 {result.counts.freeeDeals}件・残高 {result.counts.balanceEntries}
          件
        </span>
        {nextAction && <span>取込履歴・削除記録と、設定・手入力データは残っています。</span>}
        <span>
          {day(result.expiresAt)}まで（あと{daysLeft(result.expiresAt)}日）取り消せます
        </span>
      </div>
      <div className="deleted-notice-actions">
        {nextAction && (
          <button type="button" className="primary" onClick={nextAction.onClick}>
            {nextAction.label}
          </button>
        )}
        <button
          type="button"
          className={nextAction ? undefined : 'primary'}
          onClick={() => undo.mutate()}
          disabled={undo.isPending}
        >
          {undo.isPending ? '戻しています…' : 'いま取り消す'}
        </button>
      </div>
      {undo.isError && (
        <div className="sub deleted-notice-error" role="alert">
          取り消せませんでした: {describeError(undo.error)}
        </div>
      )}
    </div>
  );
}

const REPLACEMENT_CONFIRMATION = '入れ替える';

/**
 * 現在の取込データを全件退避・削除し、次の新規取込へ進む専用入口。
 * 削除エンジンは既存の all preflight / fingerprint / undo をそのまま再利用する。
 */
export function ImportReplacementButton({
  disabled,
  onDeleted,
}: {
  disabled?: boolean;
  onDeleted: (result: DeletionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();

  const flow = useDeletionFlow((result) => {
    setOpen(false);
    setConfirmation('');
    onDeleted(result);
    triggerButtonRef.current?.focus();
  });

  const focusStage = !open ? 'closed' : flow.preflight ? 'ready' : 'checking';
  useEffect(() => {
    if (focusStage !== 'closed') cancelButtonRef.current?.focus();
  }, [focusStage]);

  const openDialog = (node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
  };

  const closeDialog = () => {
    if (flow.run.isPending) return;
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    setOpen(false);
    setConfirmation('');
    flow.cancel();
    triggerButtonRef.current?.focus();
  };

  const start = () => {
    setConfirmation('');
    setOpen(true);
    flow.check.mutate({ granularity: 'all' });
  };

  return (
    <div className="import-replacement-entry">
      <button
        ref={triggerButtonRef}
        type="button"
        className="import-replace-trigger"
        disabled={disabled || flow.check.isPending || flow.run.isPending}
        onClick={start}
      >
        データを入れ替える
      </button>
      {open && (
        <dialog
          ref={openDialog}
          className="deletion-confirm-dialog import-replacement-dialog"
          aria-labelledby={dialogTitleId}
          onClose={closeDialog}
          onCancel={(event) => {
            event.preventDefault();
            if (!flow.run.isPending) closeDialog();
          }}
        >
          <div className="import-replacement-confirmation">
            <h3 id={dialogTitleId}>取り込んだデータを入れ替えますか？</h3>
            <p>現在の取込データをいったん全て削除し、その後に新しいファイルを選びます。</p>
            <p className="import-safe-note">
              freee・マネーフォワード側の元データ、手入力した現金・負債、設定は消えません。
            </p>
            <p className="import-replacement-retained">
              取込履歴と削除記録も、監査と30日以内の取り消しのため残ります。
            </p>

            {flow.check.isPending && <p aria-live="polite">削除される件数と期間を確認しています…</p>}
            {flow.check.isError && (
              <div className="notice" role="alert">
                確認できませんでした: {describeError(flow.check.error)}
              </div>
            )}

            {flow.preflight && (
              <>
                <PreflightSummary preflight={flow.preflight} headingId={`${dialogTitleId}-scope`} />
                {flow.preflight.fullRange ? (
                  <>
                    <label className="import-replacement-confirm-field">
                      <span>
                        内容を確認し、「<strong>{REPLACEMENT_CONFIRMATION}</strong>」と入力
                      </span>
                      <input
                        type="text"
                        value={confirmation}
                        autoComplete="off"
                        onChange={(event) => setConfirmation(event.target.value)}
                      />
                    </label>
                    <div className="deletion-run-actions">
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={confirmation !== REPLACEMENT_CONFIRMATION || flow.run.isPending}
                        onClick={() => flow.run.mutate()}
                      >
                        {flow.run.isPending ? '削除中…' : '全データを削除して次へ'}
                      </button>
                      <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={closeDialog}
                        disabled={flow.run.isPending}
                      >
                        やめる
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="notice">入れ替えで削除する取込データはありません。</p>
                    <div className="deletion-run-actions">
                      <button ref={cancelButtonRef} type="button" onClick={closeDialog}>
                        閉じる
                      </button>
                    </div>
                  </>
                )}
                {flow.run.isError && (
                  <div className="notice" role="alert">
                    削除できませんでした: {describeError(flow.run.error)}
                  </div>
                )}
              </>
            )}

            {!flow.preflight && (
              <div className="deletion-run-actions">
                <button ref={cancelButtonRef} type="button" onClick={closeDialog}>
                  やめる
                </button>
              </div>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}

/**
 * 仕分け中のMF明細1件を、他の粒度と同じpreflight→指紋付き実行で消す。
 * IDは画面で入力させず、表示中の行からだけ渡す。
 */
export function TransactionDeletionButton({
  txId,
  disabled,
  onDeleted,
}: {
  txId: string;
  disabled?: boolean;
  onDeleted: (result: DeletionResult) => void;
}) {
  const qc = useQueryClient();
  const flow = useDeletionFlow((result) => {
    onDeleted(result);
    void qc.invalidateQueries();
  });

  return (
    <div>
      <button
        type="button"
        className="mini classify-quick"
        disabled={disabled || flow.check.isPending || flow.run.isPending}
        onClick={() => flow.check.mutate({ granularity: 'transaction', txIds: [txId] })}
      >
        {flow.check.isPending ? '確認中…' : 'この明細を削除'}
      </button>
      {flow.check.isError && (
        <div className="sub" role="alert">
          確認できませんでした: {describeError(flow.check.error)}
        </div>
      )}
      {flow.preflight && (
        <div>
          <PreflightSummary preflight={flow.preflight} />
          <button
            type="button"
            className="primary mini classify-quick"
            disabled={flow.run.isPending}
            onClick={() => flow.run.mutate()}
          >
            {flow.run.isPending ? '消しています…' : 'この明細1件を消す'}
          </button>{' '}
          <button
            type="button"
            className="mini classify-quick"
            onClick={flow.cancel}
            disabled={flow.run.isPending}
          >
            やめる
          </button>
          {flow.run.isError && (
            <div className="sub" role="alert">
              消せませんでした: {describeError(flow.run.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 取込履歴の1行から、その取込だけを取り消す。
 * 履歴行の中に確認を差し込むと行が崩れるので、確認はネイティブ dialog に分離する。
 */
export function ImportUndoButton({ importId, disabled }: { importId: number; disabled?: boolean }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<DeletionResult | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const flow = useDeletionFlow((result) => {
    setDone(result);
    void qc.invalidateQueries();
  });

  useEffect(() => {
    if (flow.preflight) cancelButtonRef.current?.focus();
  }, [flow.preflight]);

  const openDialog = (node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    flow.cancel();
    setDone(null);
    triggerButtonRef.current?.focus();
  };

  return (
    <div className="import-inline-action">
      <button
        ref={triggerButtonRef}
        type="button"
        aria-label="この取込を取り消す"
        disabled={disabled || flow.check.isPending}
        onClick={() => flow.check.mutate({ granularity: 'import', importId })}
      >
        {flow.check.isPending ? '確認中…' : '取り消す'}
      </button>
      {flow.check.isError && (
        <div className="sub" role="alert">
          確認できませんでした: {describeError(flow.check.error)}
        </div>
      )}
      {(flow.preflight || done) && (
        <dialog
          ref={openDialog}
          className="deletion-confirm-dialog"
          aria-labelledby={dialogTitleId}
          onClose={() => {
            flow.cancel();
            setDone(null);
            triggerButtonRef.current?.focus();
          }}
        >
          {done ? (
            <DeletedNotice result={done} onUndone={closeDialog} />
          ) : flow.preflight ? (
            <>
              <PreflightSummary preflight={flow.preflight} headingId={dialogTitleId} />
              <div className="deletion-run-actions">
                <button
                  type="button"
                  className="danger-btn"
                  disabled={flow.run.isPending}
                  onClick={() => flow.run.mutate()}
                >
                  {flow.run.isPending ? '削除中…' : 'この内容で消す'}
                </button>
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={closeDialog}
                  disabled={flow.run.isPending}
                >
                  やめる
                </button>
              </div>
              {flow.run.isError && (
                <div className="sub" role="alert">
                  消せませんでした: {describeError(flow.run.error)}
                </div>
              )}
            </>
          ) : null}
        </dialog>
      )}
    </div>
  );
}

/**
 * 帳簿データを変えず、非有効な履歴と不要になった保存原本だけを破棄する。
 * 「取込データの取り消し」と誤認させないよう、確認内容とAPIを分離する(DR-17)。
 */
export function ImportDiscardButton({
  importId,
  disabled,
  onDiscarded,
}: {
  importId: number;
  disabled?: boolean;
  onDiscarded?: () => void;
}) {
  const qc = useQueryClient();
  const [preflight, setPreflight] = useState<ImportHistoryDiscardPreflight | null>(null);
  const [done, setDone] = useState<ImportHistoryDiscardResult | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();

  const check = useMutation({
    mutationFn: () =>
      api<ImportHistoryDiscardPreflight>(`/imports/${importId}/discard/preflight`, { method: 'POST' }),
    onSuccess: setPreflight,
  });
  const run = useMutation({
    mutationFn: () => {
      if (!preflight) throw new Error('確認していない履歴は削除できません');
      return api<ImportHistoryDiscardResult>(`/imports/${importId}/discard`, {
        method: 'POST',
        body: JSON.stringify({ fingerprint: preflight.fingerprint }),
      });
    },
    onSuccess: (result) => {
      setDone(result);
      onDiscarded?.();
    },
  });

  useEffect(() => {
    if (done) closeButtonRef.current?.focus();
    else if (preflight) cancelButtonRef.current?.focus();
  }, [preflight, done]);

  const openDialog = (node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    setPreflight(null);
    if (done) void qc.invalidateQueries();
    setDone(null);
    check.reset();
    run.reset();
    triggerButtonRef.current?.focus();
  };

  const originalMessage =
    preflight?.originalDisposition === 'delete'
      ? 'この履歴と、ほかで使われていない保存原本を削除します。'
      : preflight?.originalDisposition === 'keep_shared'
        ? 'この履歴だけを削除します。保存原本はほかの取込でも使われているため残します。'
        : '保存原本はありません。この履歴だけを削除します。';

  return (
    <div className="import-inline-action">
      <button
        ref={triggerButtonRef}
        type="button"
        aria-label="この取込履歴を削除"
        disabled={disabled || check.isPending}
        onClick={() => check.mutate()}
      >
        {check.isPending ? '確認中…' : '履歴を削除'}
      </button>
      {check.isError && (
        <div className="sub" role="alert">
          確認できませんでした: {describeError(check.error)}
        </div>
      )}
      {(preflight || done) && (
        <dialog
          ref={openDialog}
          className="deletion-confirm-dialog import-discard-dialog"
          aria-labelledby={dialogTitleId}
          onClose={closeDialog}
          onCancel={(event) => {
            event.preventDefault();
            if (run.isPending) return;
            closeDialog();
          }}
        >
          {done ? (
            <div className="import-discard-confirmation" aria-live="polite">
              <h3 id={dialogTitleId}>履歴を削除しました</h3>
              <p>帳簿データは変更していません。</p>
              <p>
                {done.original === 'deleted'
                  ? '保存原本も削除しました。'
                  : done.original === 'deletion_pending'
                    ? '保存原本は安全な削除処理で再試行します。'
                    : done.original === 'kept_shared'
                      ? '共有中の保存原本は残しました。'
                      : '削除する保存原本はありませんでした。'}
              </p>
              <button ref={closeButtonRef} type="button" className="primary" onClick={closeDialog}>
                閉じる
              </button>
            </div>
          ) : preflight ? (
            <div className="import-discard-confirmation">
              <h3 id={dialogTitleId}>この取込履歴を削除しますか？</h3>
              <p className="import-safe-note">帳簿データは変わりません。</p>
              <p>{originalMessage}</p>
              <p>
                <strong>削除した履歴と対象の保存原本は元に戻せません。</strong>
              </p>
              <div className="deletion-run-actions">
                <button
                  type="button"
                  className="danger-btn"
                  disabled={run.isPending}
                  onClick={() => run.mutate()}
                >
                  {run.isPending ? '削除中…' : '履歴を削除する'}
                </button>
                <button ref={cancelButtonRef} type="button" onClick={closeDialog} disabled={run.isPending}>
                  やめる
                </button>
              </div>
              {run.isError && (
                <div className="sub" role="alert">
                  削除できませんでした: {describeError(run.error)}
                </div>
              )}
            </div>
          ) : null}
        </dialog>
      )}
    </div>
  );
}

/**
 * 期間を限定したメンテナンス削除。
 * 全件の入れ替えは上部の ImportReplacementButton に一本化し、同じ概念の二重入口を作らない。
 */
export function DeletionPanel() {
  const qc = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [done, setDone] = useState<DeletionResult | null>(null);
  const flow = useDeletionFlow((result) => {
    setDone(result);
    void qc.invalidateQueries();
  });

  const ready = !!from && !!to && from <= to;

  const submit = () => {
    const selectedKinds = kinds.length ? kinds : undefined;
    flow.check.mutate({ granularity: 'period', period: { from, to }, kinds: selectedKinds });
  };

  return (
    <details
      className="card import-deletion-disclosure"
      onToggle={(event) => {
        if (!event.currentTarget.open) flow.cancel();
      }}
    >
      <summary className="import-deletion-summary">
        <h2 aria-label="取り込んだデータを消す">
          <span className="import-deletion-copy">
            <span className="import-eyebrow">メンテナンス</span>
            <span className="import-deletion-title">期間を指定してデータを消す</span>
            <small>範囲と取り消し可否を実行前に確認できます</small>
          </span>
          <span className="import-disclosure-label" aria-hidden="true">
            開く
          </span>
        </h2>
      </summary>

      <div className="import-deletion-body">
        <p className="import-safe-note">
          消えるのはアプリ内の取込データだけです。マネーフォワード・freee・手入力した現金と負債は変わりません。
        </p>

        <section className="deletion-step" aria-labelledby="deletion-scope-title">
          <div className="deletion-step-heading">
            <span className="deletion-step-number">1</span>
            <div>
              <strong id="deletion-scope-title">対象を選ぶ</strong>
              <span>指定した期間だけを対象にします</span>
            </div>
          </div>

          <div className="deletion-period-fields">
            <label>
              <span>はじめの月</span>
              <input
                type="month"
                value={from}
                disabled={flow.check.isPending || flow.run.isPending}
                onChange={(event) => {
                  setFrom(event.target.value);
                  flow.cancel();
                }}
              />
            </label>
            <span aria-hidden="true">〜</span>
            <label>
              <span>おわりの月</span>
              <input
                type="month"
                value={to}
                disabled={flow.check.isPending || flow.run.isPending}
                onChange={(event) => {
                  setTo(event.target.value);
                  flow.cancel();
                }}
              />
            </label>
          </div>

          <fieldset className="deletion-kind-options">
            <legend>種別で絞る（未選択ならすべて）</legend>
            {KIND_CHOICES.map((kind) => (
              <label key={kind.value}>
                <input
                  type="checkbox"
                  checked={kinds.includes(kind.value)}
                  disabled={flow.check.isPending || flow.run.isPending}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    flow.cancel();
                    setKinds((previous) =>
                      checked ? [...previous, kind.value] : previous.filter((value) => value !== kind.value),
                    );
                  }}
                />
                {kind.label}
              </label>
            ))}
          </fieldset>

          <div className="deletion-check-action">
            <button type="button" onClick={submit} disabled={!ready || flow.check.isPending}>
              {flow.check.isPending ? '確認中…' : '消える内容を確認'}
            </button>
            {!ready && <span>開始月と終了月を選んでください</span>}
          </div>
          {flow.check.isError && (
            <div className="notice" role="alert">
              確認できませんでした: {describeError(flow.check.error)}
            </div>
          )}
        </section>

        {flow.preflight && (
          <>
            <PreflightSummary preflight={flow.preflight} />
            <section className="deletion-step deletion-run" aria-labelledby="deletion-run-title">
              <div className="deletion-step-heading">
                <span className="deletion-step-number">3</span>
                <div>
                  <strong id="deletion-run-title">削除を実行する</strong>
                  <span>上の件数と期間を確認してから実行してください</span>
                </div>
              </div>
              <div className="deletion-run-actions">
                <button
                  type="button"
                  className="danger-btn"
                  disabled={flow.run.isPending}
                  onClick={() => flow.run.mutate()}
                >
                  {flow.run.isPending ? '削除中…' : 'この内容で消す'}
                </button>
                <button type="button" onClick={flow.cancel} disabled={flow.run.isPending}>
                  やめる
                </button>
              </div>
              {flow.run.isError && (
                <div className="notice" role="alert">
                  消せませんでした: {describeError(flow.run.error)}
                </div>
              )}
            </section>
          </>
        )}

        {done && <DeletedNotice result={done} onUndone={() => setDone(null)} />}
        <DeletionHistory />
      </div>
    </details>
  );
}

/**
 * 消した・戻したの履歴。期限内のものだけ取り消せる。
 * 出るのは件数・粒度・日時だけで、何を消したかの中身は出ない(DR-9)。
 */
export function DeletionHistory() {
  const qc = useQueryClient();
  const operations = useQuery({
    queryKey: ['data-operations'],
    queryFn: () => api<{ operations: DeletionOperation[] }>('/data/operations'),
  });
  const undo = useMutation({
    mutationFn: (operationId: string) => api<UndoResult>(`/data/undo/${operationId}`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries(),
  });

  const rows = operations.data?.operations ?? [];

  return (
    <section className="deletion-history" aria-labelledby="deletion-history-title">
      <div className="deletion-history-heading">
        <div>
          <h3 id="deletion-history-title">消した記録</h3>
          <p>日時・範囲・件数だけを記録します</p>
        </div>
        <span className="num">{rows.length}件</span>
      </div>
      {rows.length ? (
        <ul className="deletion-history-list">
          {rows.map((row) => {
            const left = row.expiresAt ? daysLeft(row.expiresAt) : 0;
            return (
              <li key={row.id}>
                <div>
                  <strong>{row.kind === 'undo' ? '取り消し' : '削除'}</strong>
                  <span>
                    {GRANULARITY_LABEL[row.granularity]}・明細{' '}
                    <span className="num">{row.counts.mfTx ?? 0}</span>件
                  </span>
                </div>
                <time className="num" dateTime={row.createdAt}>
                  {day(row.createdAt)}
                </time>
                <div className="deletion-history-action">
                  {row.kind === 'undo' ? (
                    <span className="sub">操作済み</span>
                  ) : row.undone ? (
                    <span className="pill calm">取り消し済み</span>
                  ) : !row.expiresAt ? (
                    <span className="sub">取り消し期間終了</span>
                  ) : left <= 0 ? (
                    <span className="sub">期限切れ({day(row.expiresAt)})</span>
                  ) : !row.undoable ? (
                    <span
                      className="sub"
                      title="退避しておける量の上限に達したため、古いものから先に戻せなくなりました"
                    >
                      戻せません(保管量の上限)
                    </span>
                  ) : (
                    <button type="button" disabled={undo.isPending} onClick={() => undo.mutate(row.id)}>
                      取り消す(あと{left}日)
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="import-empty-state compact">まだ何も消していません。</div>
      )}
      {undo.isError && (
        <div className="notice" role="alert">
          取り消せませんでした: {describeError(undo.error)}
        </div>
      )}
    </section>
  );
}
