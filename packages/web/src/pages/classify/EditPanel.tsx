/**
 * 右の取引の編集パネル (spec-classify-screen 7.6)。
 *
 * 入力の保持はここに置く。親 (ClassifyPage) に持たせると、明細を開き直すたびに
 * 親が再描画され、一覧まで巻き添えで描き直しになる。
 * 下書きの自動保存もここから呼ぶ。保存できるのは「今開いている明細の入力」だけなので、
 * 入力と同じ場所に置かないと、保存した中身と画面の中身がずれる余地ができる。
 */
import type { Candidates, Cls } from '@kanjo/core';
import { useEffect, useId, useRef, useState } from 'react';
import type { ClassifyRow, ClassifyRuleRow, TxHistoryRow } from '../../api.js';
import { Button } from '../../components/Button.js';
import { CategoryPicker } from '../../components/CategoryPicker.js';
import { OwnerSelect } from '../../components/ClassificationSettings.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { Term } from '../../components/Term.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { clearDraft, loadDraft, saveDraft } from './draft.js';
import {
  type EditInput,
  amountText,
  canSave,
  dateText,
  draftSavedText,
  historyText,
  inputFromRow,
  outcomeOf,
  outcomeText,
  sameInput,
} from './view-model.js';

const METHOD_LABEL: Record<'cash' | 'card' | 'account', string> = {
  cash: '現金',
  card: 'カード',
  account: '口座',
};

/** 明細から導いた支払い方法。上書きしていないときに何が使われるかを見せる */
const derivedMethodText = (row: ClassifyRow): string => {
  const m = row.paymentMethod;
  const label = m && m in METHOD_LABEL ? METHOD_LABEL[m as 'cash'] : '不明';
  return `${label}（明細から判定）`;
};

export interface RuleDraft {
  payee: string;
  keyword: string;
  scope: 'all' | 'unconfirmed';
}

export function EditPanel({
  row,
  candidates,
  history,
  historyError,
  rules,
  busy,
  onClose,
  onSave,
  onDelete,
  onSplit,
  onMakeRule,
  onDirtyChange,
}: {
  row: ClassifyRow;
  candidates: Candidates;
  history: TxHistoryRow[];
  historyError: boolean;
  rules: ClassifyRuleRow[];
  busy: boolean;
  onClose: () => void;
  /** 保存。Promise を返す場合、下書きの破棄は解決を待つ (UC-8-2・FR-17) */
  onSave: (input: EditInput) => void | Promise<void>;
  onDelete: () => void;
  onSplit: () => void;
  onMakeRule: (draft: RuleDraft, input: EditInput) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saved = inputFromRow(row);
  const [input, setInput] = useState<EditInput>(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // 開いた時点の下書きを初期値として読む。ここを null 始まりにすると、
  // 親が key で作り直すので下の openedId 分岐が一度も走らず、復元ボタンが出ない
  const [restorable, setRestorable] = useState<EditInput | null>(() => loadDraft(row.id)?.input ?? null);
  const [rule, setRule] = useState<RuleDraft>({ payee: row.payee, keyword: '', scope: 'unconfirmed' });
  const leave = useConfirmDialog();
  const remove = useConfirmDialog({ busy });
  const ids = { method: useId(), note: useId() };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = !sameInput(saved, input);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // 入力が止まってから 1 秒後に下書きを保存する (7.11)。打つたびに書くと、
  // 端末の保存が入力の速さに引きずられる
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const draft = saveDraft(row.id, input);
      if (draft) setSavedAt(draft.savedAt);
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, input, row.id]);

  const outcome = outcomeOf(row, input);

  const close = () => {
    if (dirty) {
      leave.setOpen(true);
      return;
    }
    onClose();
  };

  return (
    <section className="classify-edit" aria-label="取引の編集">
      <div className="classify-edit-head">
        <h2>取引の編集</h2>
        {dirty && <span className="classify-unsaved">● 未保存</span>}
        <Button variant="text" size="mini" aria-label="編集を閉じる" onClick={close}>
          ×
        </Button>
      </div>

      <dl className="classify-edit-basic">
        <div>
          <dt>日付</dt>
          <dd>{`${dateText(row.date)} の取引`}</dd>
        </div>
        <div>
          <dt>取引先</dt>
          <dd>{row.payee}</dd>
        </div>
        <div>
          <dt>金額</dt>
          <dd>{amountText(row.amount)}</dd>
        </div>
        <div>
          <dt>内容</dt>
          <dd>{row.description}</dd>
        </div>
      </dl>

      <p className="sub">提案どおりに確定すると完了、提案と異なる値で確定すると手動変更になります。</p>
      <p className="sub">{outcomeText(outcome)}</p>

      <div className="classify-edit-group">
        <h3>
          <Term id="publicPrivate">クイック仕分け</Term>
        </h3>
        <div className="classify-quick-row">
          {(['biz', 'per'] as Cls[]).map((cls) => (
            <Button
              key={cls}
              variant={input.cls === cls ? 'primary' : 'secondary'}
              size="mini"
              onClick={() => setInput({ ...input, cls })}
            >
              {cls === 'biz' ? '事業' : '個人'}
            </Button>
          ))}
          <Button variant="text" size="mini" onClick={() => setInput(saved)}>
            リセット
          </Button>
        </div>
      </div>

      <div className="classify-edit-group">
        <h3>カテゴリ</h3>
        <CategoryPicker
          candidates={candidates}
          scope={input.cls}
          big={input.big ?? ''}
          mid={input.mid ?? ''}
          clearLabel="指定しない"
          hintText={row.description}
          onChange={(v) => setInput({ ...input, big: v.big || null, mid: v.mid || null })}
        />
      </div>

      <div className="classify-edit-group">
        <h3>所有者</h3>
        <OwnerSelect value={input.owner} onChange={(owner) => setInput({ ...input, owner })} />
      </div>

      <div className="classify-edit-group">
        <label htmlFor={ids.method}>支払い方法</label>
        <select
          id={ids.method}
          value={input.paymentMethod ?? ''}
          onChange={(e) =>
            setInput({
              ...input,
              paymentMethod: (e.target.value || null) as EditInput['paymentMethod'],
            })
          }
        >
          <option value="">{derivedMethodText(row)}</option>
          {(Object.keys(METHOD_LABEL) as (keyof typeof METHOD_LABEL)[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>

      <p className="sub">証憑は freee 側で管理します</p>

      <div className="classify-edit-group">
        <label htmlFor={ids.note}>メモ</label>
        <textarea
          id={ids.note}
          value={input.note ?? ''}
          maxLength={200}
          onChange={(e) => setInput({ ...input, note: e.target.value || null })}
        />
        <span className="sub">{`${(input.note ?? '').length}/200`}</span>
      </div>

      {savedAt != null && <p className="sub classify-draft">{draftSavedText(savedAt)}</p>}
      {restorable && (
        <Button
          variant="text"
          size="mini"
          onClick={() => {
            setInput(restorable);
            setRestorable(null);
          }}
        >
          下書きを復元
        </Button>
      )}

      <div className="classify-edit-group">
        <h3>取引の履歴</h3>
        {historyError ? (
          <p className="sub" role="alert">
            履歴を読み込めませんでした。
          </p>
        ) : history.length === 0 ? (
          <p className="sub">まだ履歴はありません。</p>
        ) : (
          <ul className="classify-history">
            {history.map((h) => (
              <li key={`${h.opId}-${h.changedAt}-${h.field}`}>{historyText(h)}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="classify-edit-group">
        <h3>信頼度の根拠</h3>
        <p className="sub">{row.basisText}</p>
      </div>

      <div className="classify-edit-actions">
        <Button
          variant="primary"
          disabled={busy || !canSave(row, input)}
          onClick={() => {
            // 下書きを消すのは保存が成功したときだけ (UC-8-2・FR-17)。
            // 同期で消すと、通信が失敗した保存で手入力が消えて戻せなくなる
            void Promise.resolve(onSave(input)).then(
              () => {
                clearDraft(row.id);
                setSavedAt(null);
              },
              () => {},
            );
          }}
        >
          編集
        </Button>
        <Button variant="secondary" disabled={!row.capabilities.split} onClick={onSplit}>
          分割
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => remove.setOpen(true)}>
          削除
        </Button>
      </div>

      <div className="classify-edit-group">
        <h3>この条件をルールにする</h3>
        <select
          aria-label="ルールの取引先"
          value={rule.payee}
          onChange={(e) => setRule({ ...rule, payee: e.target.value })}
        >
          <option value={row.payee}>{row.payee}</option>
        </select>
        <input
          type="text"
          aria-label="ルールのキーワード"
          value={rule.keyword}
          onChange={(e) => setRule({ ...rule, keyword: e.target.value })}
        />
        <select
          aria-label="ルールの適用範囲"
          value={rule.scope}
          onChange={(e) => setRule({ ...rule, scope: e.target.value as RuleDraft['scope'] })}
        >
          <option value="all">一致する明細すべて</option>
          <option value="unconfirmed">未確定の明細だけ</option>
        </select>
        <Button variant="secondary" size="mini" onClick={() => onMakeRule(rule, input)}>
          ルールを作成
        </Button>
      </div>

      <div className="classify-edit-group">
        <h3>該当する既存のルール</h3>
        {rules.length === 0 ? (
          <p className="sub">該当するルールはありません。</p>
        ) : (
          <ul className="classify-rules">
            {rules.map((r) => (
              <li key={r.id}>
                {`${r.payee ?? r.keyword} → ${[r.big, r.mid].filter(Boolean).join(' / ')}（過去に${r.hits ?? 0}件適用）`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {leave.open && (
        <dialog ref={leave.bind} className="deletion-confirm-dialog" aria-labelledby={leave.titleId}>
          <div className="confirm-dialog-body">
            <h3 ref={leave.titleRef} id={leave.titleId} tabIndex={-1}>
              保存していない変更があります。このまま移動しますか？
            </h3>
            <div className="deletion-run-actions">
              <Button
                variant="primary"
                onClick={() => {
                  leave.close();
                  onClose();
                }}
              >
                移動する
              </Button>
              <Button variant="secondary" onClick={() => leave.close()}>
                とどまる
              </Button>
            </div>
          </div>
        </dialog>
      )}

      {remove.open && (
        <ConfirmDialog
          dialog={remove}
          title="この明細を消しますか？"
          confirmLabel="この明細を消す"
          busyLabel="消しています…"
          onConfirm={() => {
            remove.close();
            onDelete();
          }}
          onDismiss={() => remove.close()}
        >
          <p>{`${dateText(row.date)} ${row.payee} ${amountText(row.amount)} の 1 件を消します。あとから元に戻せます。`}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
