import { SUB_VENDOR_NAME_MAX, type SubscriptionRow } from '@kanjo/core';
import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button.js';
import { UiIcon } from '../../components/UiIcon.js';
import { SOURCE_LABEL, rawNameKey } from './format.js';
import type { TargetOption } from './selection.js';
import type { RawSelection, RunWrite } from './types.js';

/**
 * 下端に固定した選択バー (FR-003 / SM-UX-01)。一覧の行と詳細の取引名を 1 つの選択として数え、
 * 統合先の選択欄と統合の送信はここ 1 か所に置く。選択が無ければ何も出さない。
 * 処理中でも統合のボタンと統合先は止めず、押すたびに 1 件を「操作」に積む (AC-011)。
 */
export function SelectionBar({
  rows,
  raws,
  options,
  target,
  mergeDisabled,
  vendorsFailed,
  targetRef,
  onTarget,
  onRetryVendors,
  onRemoveRow,
  onRemoveRaw,
  onClear,
  onMerge,
  onCreated,
  run,
}: {
  /** 一覧に存在する選択中の行 (選んだ順) */
  rows: readonly SubscriptionRow[];
  raws: readonly RawSelection[];
  options: readonly TargetOption[];
  target: string;
  mergeDisabled: boolean;
  /** 統合先の候補 (登録の一覧) を読めなかった */
  vendorsFailed: boolean;
  targetRef: RefObject<HTMLSelectElement>;
  onTarget: (value: string) => void;
  onRetryVendors: () => void;
  onRemoveRow: (vendorKey: string) => void;
  onRemoveRaw: (raw: RawSelection) => void;
  onClear: () => void;
  onMerge: () => void;
  onCreated: (value: string) => void;
  run: RunWrite;
}) {
  const targetId = useId();
  const hintId = useId();
  const barRef = useRef<HTMLElement>(null);
  const count = rows.length + raws.length;
  const visible = count > 0;
  // sticky のバーは自分の場所を流れの中に持つので、最後の行を覆い続けることは無い。
  // 覆うのはスクロールの途中で、キーボードで移ったフォーカスがバーの裏に入るとき (WCAG 2.4.11)。
  // バーの高さを :root へ渡し、CSS の scroll-padding-bottom でその分だけフォーカス先を持ち上げる。
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--subs-selection-h', `${bar.offsetHeight}px`);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--subs-selection-h');
    };
  }, [visible]);
  if (!visible) return null;
  // 統合先にできる登録済みの行を選んでいるときは、新しい統合先を作る理由が無い
  const canCreate = rows.every((row) => row.vendorId === null);
  const initialName = rows[0]?.displayName ?? raws[0]?.name ?? '';
  // 統合のボタンを押せないときは理由をそばに出し、無言の disabled で行き止まりにしない
  const mergeHint = !mergeDisabled
    ? null
    : target === ''
      ? '統合先を選ぶと統合できます。'
      : '統合先とは別の行か取引名も選ぶと統合できます。';
  return (
    // 名前付きの section は region として読まれる (画面下端の固定バー)
    <section ref={barRef} className="subs-selection" aria-label="選択中の取引">
      <p aria-live="polite">{count}件の取引を選択中</p>
      <ul className="subs-selection-chips">
        {rows.map((row) => (
          <li key={`row:${row.vendorKey}`}>
            {row.displayName}
            <Button
              variant="text"
              size="mini"
              aria-label={`${row.displayName}の選択を外す`}
              onClick={() => onRemoveRow(row.vendorKey)}
            >
              <UiIcon name="close" aria-hidden="true" />
            </Button>
          </li>
        ))}
        {raws.map((raw) => (
          <li key={`raw:${rawNameKey(raw.name, raw.source)}`}>
            {raw.name}
            <Button
              variant="text"
              size="mini"
              aria-label={`${raw.name}（${SOURCE_LABEL[raw.source]}）の選択を外す`}
              onClick={() => onRemoveRaw(raw)}
            >
              <UiIcon name="close" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="subs-selection-target">
        <label htmlFor={targetId}>統合先</label>
        <select
          id={targetId}
          ref={targetRef}
          value={target}
          onChange={(event) => onTarget(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {vendorsFailed && (
          <span className="subs-inline-error">
            統合先の候補を読み込めませんでした。
            <Button size="mini" onClick={onRetryVendors}>
              候補を読み直す
            </Button>
          </span>
        )}
      </div>
      {canCreate && (
        <MergeTargetCreator initialName={initialName} run={run} targetRef={targetRef} onCreated={onCreated} />
      )}
      <div className="subs-selection-actions">
        <Button
          variant="primary"
          disabled={mergeDisabled}
          aria-describedby={mergeHint ? hintId : undefined}
          onClick={onMerge}
        >
          選択した{count}件を統合
        </Button>
        <Button variant="text" onClick={onClear}>
          選択を解除
        </Button>
        {mergeHint && (
          <span id={hintId} className="subs-selection-hint">
            {mergeHint}
          </span>
        )}
      </div>
      <Button
        variant="text"
        className="subs-selection-close"
        aria-label="選択を解除して閉じる"
        onClick={onClear}
      >
        <UiIcon name="close" aria-hidden="true" />
      </Button>
    </section>
  );
}

/**
 * 選択に登録済みの行が無いとき、統合先をその場で登録して選ぶ。
 * 重複だけは入力のそばで既存の選択へ案内し、それ以外の失敗は「操作」の行に任せる (SM-UX-04)。
 */
function MergeTargetCreator({
  initialName,
  run,
  targetRef,
  onCreated,
}: {
  initialName: string;
  run: RunWrite;
  targetRef: RefObject<HTMLSelectElement>;
  onCreated: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const trimmed = value.trim();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <div className="subs-merge-create-entry">
      <Button
        ref={triggerRef}
        variant="text"
        aria-expanded={open}
        aria-controls={open ? `${id}-form` : undefined}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setValue(initialName);
          setError(null);
          setNotice(null);
          setOpen(true);
        }}
      >
        新しい統合先を登録
      </Button>
      {open && (
        <form
          id={`${id}-form`}
          className="subs-merge-create"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            if (!trimmed) {
              setError('統合先の名前を入力してください。');
              return;
            }
            setSubmitting(true);
            const outcome = await run(
              { kind: 'vendor_create', name: trimmed },
              { inlineCodes: ['duplicate'] },
            );
            setSubmitting(false);
            if (outcome.ok) {
              const created = outcome.data.id;
              if (created !== undefined) onCreated(String(created));
              setOpen(false);
              setNotice(`「${trimmed}」を登録し、統合先に選びました。`);
              targetRef.current?.focus();
              return;
            }
            if (outcome.code === 'duplicate') {
              setError('同じ名前の統合先がすでにあります。一覧から選んでください。');
            }
          }}
        >
          <label htmlFor={id}>新しい統合先の名前</label>
          <input
            ref={inputRef}
            id={id}
            value={value}
            required
            maxLength={SUB_VENDOR_NAME_MAX}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
          />
          {error && (
            <p id={`${id}-error`} className="subs-field-error" role="alert">
              {error}
            </p>
          )}
          <div className="subs-merge-create-actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              登録して統合先に選ぶ
            </Button>
            <Button
              onClick={() => {
                close();
                triggerRef.current?.focus();
              }}
            >
              やめる
            </Button>
          </div>
        </form>
      )}
      {/* 閉じた後も結果を残すため、フォームの外に置く */}
      <output>{notice}</output>
    </div>
  );
}
