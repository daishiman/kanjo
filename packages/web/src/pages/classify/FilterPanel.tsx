/**
 * 左の絞り込み (spec-classify-screen 7.4)。
 *
 * ここは値を持たない。URL が持つ絞り込みを受け取り、変更を親へ返すだけにしてある。
 * パネル内に状態を置くと、URL から開き直したときと押して絞ったときで画面が食い違う。
 */
import { OWNER_VALUES } from '@kanjo/core';
import type { Candidates, ClassifyCounts, Owner } from '@kanjo/core';
import { useId, useState } from 'react';
import type { SavedFilterRow } from '../../api.js';
import { Button } from '../../components/Button.js';
import { useOwnerLabels } from '../../owner-labels.js';
import { type ClassifyFilters, FILTER_STATUS_LABEL, type FilterStatus, countText } from './view-model.js';

const STATUS_ORDER: FilterStatus[] = ['unsorted', 'review', 'manual', 'done'];
const METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'account', label: '口座' },
  { value: 'unknown', label: '不明' },
] as const;
// 所有者の選択肢は core の正本をそのまま使う。unset は永続値ではないので選ばせない
const OWNERS: readonly Owner[] = OWNER_VALUES;

export function FilterPanel({
  filters,
  onChange,
  kpi,
  candidates,
  periodLabel,
  saved,
  onApplySaved,
  onDeleteSaved,
  onSaveCurrent,
  onClear,
}: {
  filters: ClassifyFilters;
  onChange: (next: ClassifyFilters) => void;
  kpi: ClassifyCounts;
  candidates: Candidates;
  periodLabel: string;
  saved: SavedFilterRow[];
  onApplySaved: (row: SavedFilterRow) => void;
  onDeleteSaved: (row: SavedFilterRow) => void;
  onSaveCurrent: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : !window.matchMedia('(max-width: 1023px)').matches,
  );
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const { ownerLabel } = useOwnerLabels();
  const ids = {
    category: useId(),
    owner: useId(),
    method: useId(),
    q: useId(),
  };

  // 大項目は事業・個人の両方から集める。どちらの系統かは絞り込みでは問わない
  const majors = [...new Set([...candidates.biz, ...candidates.per].map((m) => m.name))];

  const toggleStatus = (s: FilterStatus) => {
    const has = filters.status.includes(s);
    // 最後の 1 つは外せない。空の絞り込みは「全件」とも「0 件」とも読めてしまう
    if (has && filters.status.length === 1) return;
    const status = has ? filters.status.filter((v) => v !== s) : [...filters.status, s];
    onChange({ ...filters, status: STATUS_ORDER.filter((v) => status.includes(v)), page: 1 });
  };

  return (
    <section className={`classify-filters${open ? '' : ' is-collapsed'}`} aria-label="絞り込み">
      <div className="classify-filters-head">
        <h2>絞り込み</h2>
        <button
          type="button"
          data-native-control="disclosure"
          aria-expanded={open}
          aria-label={open ? '絞り込みを折りたたむ' : '絞り込みを開く'}
          className="classify-collapse"
          onClick={() => setOpen(!open)}
        >
          {open ? '«' : '»'}
        </button>
      </div>

      {open && (
        <div className="classify-filters-body">
          <div className="classify-filter-group">
            <h3>対象月</h3>
            <p className="sub">{periodLabel}</p>
          </div>

          <fieldset className="classify-filter-group">
            <legend>分類ステータス</legend>
            {STATUS_ORDER.map((s) => (
              <label key={s} className="classify-check">
                <input
                  type="checkbox"
                  checked={filters.status.includes(s)}
                  onChange={() => toggleStatus(s)}
                />
                <span>
                  {FILTER_STATUS_LABEL[s]} {countText(kpi[s])}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="classify-filter-group">
            <label htmlFor={ids.category}>カテゴリ</label>
            <select
              id={ids.category}
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value, page: 1 })}
            >
              <option value="">すべてのカテゴリ</option>
              {majors.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="classify-filter-group">
            <label htmlFor={ids.owner}>所有者</label>
            <select
              id={ids.owner}
              value={filters.owner}
              onChange={(e) => onChange({ ...filters, owner: e.target.value, page: 1 })}
            >
              <option value="">すべての所有者</option>
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {ownerLabel(o)}
                </option>
              ))}
            </select>
          </div>

          <div className="classify-filter-group">
            <label htmlFor={ids.method}>支払い方法</label>
            <select
              id={ids.method}
              value={filters.method}
              onChange={(e) =>
                onChange({ ...filters, method: e.target.value as ClassifyFilters['method'], page: 1 })
              }
            >
              <option value="">すべての支払い方法</option>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <label className="classify-check">
            <input
              type="checkbox"
              checked={filters.manual}
              onChange={(e) => onChange({ ...filters, manual: e.target.checked, page: 1 })}
            />
            <span>手動変更された明細のみ</span>
          </label>

          <div className="classify-filter-group">
            <label htmlFor={ids.q}>キーワード</label>
            <input
              id={ids.q}
              type="search"
              value={filters.q}
              maxLength={100}
              placeholder="取引先名・内容・メモで検索"
              onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
            />
          </div>

          <div className="classify-filter-group">
            <h3>保存したフィルタ</h3>
            <ul className="classify-saved">
              {saved.map((row) => (
                <li key={row.id}>
                  <Button variant="text" size="mini" onClick={() => onApplySaved(row)}>
                    {row.name}
                  </Button>
                  <Button
                    variant="text"
                    size="mini"
                    aria-label={`「${row.name}」を削除`}
                    onClick={() => onDeleteSaved(row)}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
            {naming ? (
              <div className="classify-saved-form">
                <input
                  type="text"
                  value={name}
                  maxLength={40}
                  aria-label="フィルタの名前"
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  variant="primary"
                  size="mini"
                  disabled={name.trim().length === 0}
                  onClick={() => {
                    onSaveCurrent(name.trim());
                    setName('');
                    setNaming(false);
                  }}
                >
                  保存する
                </Button>
                <Button variant="text" size="mini" onClick={() => setNaming(false)}>
                  やめる
                </Button>
              </div>
            ) : (
              <Button variant="text" size="mini" onClick={() => setNaming(true)}>
                ＋ 現在の条件を保存
              </Button>
            )}
          </div>

          <Button variant="secondary" size="mini" onClick={onClear}>
            フィルタをクリア
          </Button>
        </div>
      )}
    </section>
  );
}
