/**
 * 一括操作バー (spec-classify-screen 7.8・spec-classify-bulk-save FR-02〜FR-05・FR-09)。
 *
 * 選択が 1 件でもある間だけ出す。件数と保存前の内訳を読み上げるのは、
 * 押す前に「何件に、どの値で効くのか」を数え直さずに済ませるため。
 * 内訳は view-model の planBulkSave (= api と同じ core の規則) だけが数える。
 */
import {
  type CandidateMajor,
  type Candidates,
  OWNER_VALUES,
  type Owner,
  type PaymentMethodOverride,
  SELECTION_MAX,
  isNoCategory,
} from '@kanjo/core';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ClassifyRow } from '../../api.js';
import { Button } from '../../components/Button.js';
import { useOwnerLabels } from '../../owner-labels.js';
import { type BulkForm, type BulkSavePlan, amountText, dateText } from './view-model.js';

const PAYMENT_METHODS: readonly { value: PaymentMethodOverride; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'account', label: '口座' },
];

/** 一括指定で選べる大項目。『カテゴリなし』(見分けのつかない書き方を含む) は区分だけの指定が自動で入れるので選ばせない */
const majorsOf = (candidates: Candidates, cls: BulkForm['cls']): CandidateMajor[] =>
  (cls ? candidates[cls] : [...candidates.biz, ...candidates.per]).filter((m) => !isNoCategory(m.name));

const midsOf = (candidates: Candidates, cls: BulkForm['cls'], big: string): string[] => [
  ...new Set(
    majorsOf(candidates, cls)
      .filter((m) => m.name === big)
      .flatMap((m) => m.mids.map((mid) => mid.name)),
  ),
];

export function BulkActionBar({
  count,
  keys,
  rows,
  pendingKeys,
  loadError,
  plan,
  lostCount,
  capped,
  form,
  candidates,
  busy,
  onFormChange,
  onClear,
  onSave,
}: {
  /** 選択の件数 (見つからない明細を含む) */
  count: number;
  /** URL の選択 (選択の順) */
  keys: readonly string[];
  /** 選択のうち読み出せた明細 */
  rows: readonly ClassifyRow[];
  /** 読み出し中の key。読み終わるまで保存できない (内訳が確定しない) */
  pendingKeys: readonly string[];
  loadError: boolean;
  plan: BulkSavePlan;
  lostCount: number;
  capped: boolean;
  form: BulkForm;
  candidates: Candidates;
  busy: boolean;
  onFormChange: (next: BulkForm) => void;
  onClear: () => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  // 1 列に積む 1023px 以下だけ一括指定欄を畳む。広い幅ではこの開閉は CSS で隠れ、欄は常に見えている
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const { ownerLabel } = useOwnerLabels();
  const ids = {
    cls: useId(),
    big: useId(),
    mid: useId(),
    owner: useId(),
    method: useId(),
    fields: useId(),
  };
  // 畳んでいても何かを指定していることが分かるよう、指定した欄の数を開閉の名前に出す
  const specified = [form.cls, form.big, form.mid, form.owner, form.paymentMethod].filter(Boolean).length;
  const barRef = useRef<HTMLElement>(null);
  // 画面下に貼り付くバーは、スクロールの途中で Tab で移った行や編集パネルの操作を裏に隠す (WCAG 2.4.11)。
  // 高さを :root へ渡し、CSS がその分だけフォーカス先を持ち上げ、貼り付いた編集パネルの下端をバーの上で止める。
  // バーは選択があるときだけ描画されるので、出ている間 = この部品が生きている間
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--classify-bulk-h', `${bar.offsetHeight}px`);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--classify-bulk-h');
    };
  }, []);

  const byKey = new Map(rows.map((row) => [row.rowKey, row]));
  const reasonOf = new Map(plan.skipped.map((s) => [s.row.rowKey, s.reason]));
  const pending = new Set(pendingKeys);
  const mids = form.big ? midsOf(candidates, form.cls, form.big) : [];

  // 区分を変えたら、その区分に無い大・中は空に戻す (どの候補にも無い組を作らせない)
  const changeCls = (cls: BulkForm['cls']) => {
    const keepBig = !!form.big && majorsOf(candidates, cls).some((m) => m.name === form.big);
    const keepMid = keepBig && !!form.mid && midsOf(candidates, cls, form.big).includes(form.mid);
    onFormChange({ ...form, cls, big: keepBig ? form.big : '', mid: keepMid ? form.mid : '' });
  };

  const majorOptions = (list: CandidateMajor[]) =>
    list.map((m) => (
      <option key={m.name} value={m.name}>
        {m.name}
      </option>
    ));

  return (
    <section ref={barRef} className="classify-bulk-bar" aria-label="一括操作">
      <div className="classify-bulk-head">
        <span className="classify-bulk-count">{`${count} 件選択中`}</span>
        {capped && <span className="classify-bulk-capped">{`上限の ${SELECTION_MAX} 件で止めました`}</span>}
        {/* 折り返しを組の単位にして、開閉の矢印だけが次の行へ落ちないようにする */}
        <span className="classify-bulk-actions">
          <Button variant="text" size="mini" onClick={onClear} disabled={busy}>
            選択をクリア
          </Button>
          <Button
            variant="primary"
            size="mini"
            onClick={onSave}
            disabled={busy || plan.saveCount === 0 || pending.size > 0}
          >
            {busy ? '保存しています…' : `選択した${plan.saveCount}件を保存`}
          </Button>
        </span>
        <span className="classify-bulk-toggles">
          <button
            type="button"
            data-native-control="disclosure"
            aria-expanded={fieldsOpen}
            aria-controls={ids.fields}
            className="classify-bulk-fields-toggle"
            onClick={() => setFieldsOpen(!fieldsOpen)}
          >
            {specified > 0 ? `一括指定 (${specified})` : '一括指定'}
          </button>
          <button
            type="button"
            data-native-control="disclosure"
            aria-expanded={open}
            aria-label="選択中の明細を表示"
            className="classify-bulk-toggle"
            onClick={() => setOpen(!open)}
          >
            ^
          </button>
        </span>
      </div>

      <div id={ids.fields} className={fieldsOpen ? 'classify-bulk-fields is-open' : 'classify-bulk-fields'}>
        <div className="classify-bulk-field">
          <label htmlFor={ids.cls}>区分</label>
          <select
            id={ids.cls}
            value={form.cls}
            onChange={(e) => changeCls(e.target.value as BulkForm['cls'])}
          >
            <option value="">指定しない</option>
            <option value="biz">事業</option>
            <option value="per">個人</option>
          </select>
        </div>
        <div className="classify-bulk-field">
          <label htmlFor={ids.big}>カテゴリ (大)</label>
          <select
            id={ids.big}
            value={form.big}
            onChange={(e) => onFormChange({ ...form, big: e.target.value, mid: '' })}
          >
            <option value="">指定しない</option>
            {form.cls ? (
              majorOptions(majorsOf(candidates, form.cls))
            ) : (
              <>
                <optgroup label="事業">{majorOptions(majorsOf(candidates, 'biz'))}</optgroup>
                <optgroup label="個人">{majorOptions(majorsOf(candidates, 'per'))}</optgroup>
              </>
            )}
          </select>
        </div>
        <div className="classify-bulk-field">
          <label htmlFor={ids.mid}>カテゴリ (中)</label>
          <select
            id={ids.mid}
            value={form.mid}
            disabled={!form.big}
            onChange={(e) => onFormChange({ ...form, mid: e.target.value })}
          >
            <option value="">指定しない</option>
            {mids.map((mid) => (
              <option key={mid} value={mid}>
                {mid}
              </option>
            ))}
          </select>
        </div>
        <div className="classify-bulk-field">
          <label htmlFor={ids.owner}>所有者</label>
          <select
            id={ids.owner}
            value={form.owner}
            onChange={(e) => onFormChange({ ...form, owner: e.target.value as '' | Owner })}
          >
            <option value="">指定しない</option>
            {OWNER_VALUES.map((o) => (
              <option key={o} value={o}>
                {ownerLabel(o)}
              </option>
            ))}
          </select>
        </div>
        <div className="classify-bulk-field">
          <label htmlFor={ids.method}>支払い方法</label>
          <select
            id={ids.method}
            value={form.paymentMethod}
            onChange={(e) =>
              onFormChange({ ...form, paymentMethod: e.target.value as BulkForm['paymentMethod'] })
            }
          >
            <option value="">指定しない</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <output className="classify-bulk-plan">
        {plan.groups.map((g) => (
          <span key={g.label}>{`${g.count}件を${g.label}で保存`}</span>
        ))}
        {plan.noCategoryCount > 0 && <span>{`うち${plan.noCategoryCount}件は『カテゴリなし』で保存`}</span>}
        {plan.skipped.length > 0 && <span>{`${plan.skipped.length}件は保存しません`}</span>}
        {plan.reasons.map((reason) => (
          <span key={reason} className="classify-bulk-reason">
            {reason}
          </span>
        ))}
        {lostCount > 0 && <span>{`${lostCount}件は見つかりません`}</span>}
      </output>

      {open && (
        <ul className="classify-bulk-list">
          {keys.map((key) => {
            const row = byKey.get(key);
            if (!row) {
              return (
                <li key={key} className="sub">
                  {pending.has(key) && loadError ? '読み込めませんでした' : '読み込んでいます…'}
                </li>
              );
            }
            const reason = reasonOf.get(key);
            return (
              <li key={key}>
                {`${dateText(row.date)} ${row.payee} ${amountText(row.amount)}`}
                {reason && <span className="classify-bulk-reason">{reason}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
