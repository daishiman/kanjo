/**
 * P5 公私仕分け: 明細を事業/個人に確定する。
 * 行内3ボタン(個人/事業/自動)は楽観的更新+失敗時ロールバック。キーボード J/K移動・B/P/A判定。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { type RuleRow, type TransactionsResponse, type TxRow, api } from '../api.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { yen, yenS } from '../format.js';

export function ClassifyPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string | null>(null);
  const [cls, setCls] = useState('');
  const [qtext, setQtext] = useState('');
  const [manualOnly, setManualOnly] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);

  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (cls) params.set('cls', cls);
  if (qtext) params.set('q', qtext);
  if (manualOnly) params.set('manual', '1');
  const key = ['transactions', month, cls, qtext, manualOnly] as const;

  const q = useQuery({
    queryKey: key,
    queryFn: () => api<TransactionsResponse>(`/transactions?${params.toString()}`),
  });

  const setClass = useMutation({
    mutationFn: ({ txId, next }: { txId: string; next: 'biz' | 'per' | null }) =>
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
      void qc.invalidateQueries({ queryKey: ['summary'] });
      void qc.invalidateQueries({ queryKey: ['household'] });
    },
  });

  const rows = q.data?.transactions ?? [];

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === 'j') setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
      else if (k === 'k') setFocusIdx((i) => Math.max(i - 1, 0));
      else if ((k === 'b' || k === 'p' || k === 'a') && rows[focusIdx]) {
        const tx = rows[focusIdx];
        setClass.mutate({ txId: tx.id, next: k === 'b' ? 'biz' : k === 'p' ? 'per' : null });
      }
    },
    [rows, focusIdx, setClass],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

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
        <PageState status="error" />
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

      <div className="kpis">
        <KpiCard label="明細数" value={String(s.count)} />
        <KpiCard label="総収入" value={yen(s.totalIncome)} />
        <KpiCard label="事業入金" value={yen(s.bizIncome)} tone="biz" />
        <KpiCard label="個人収入" value={yen(s.personalIncome)} tone="per" />
        <KpiCard label="総支出" value={yen(s.totalExpense)} />
        <KpiCard label="事業立替" value={yen(s.bizExpense)} tone="biz" />
        <KpiCard label="個人支出" value={yen(s.personalExpense)} tone="per" />
      </div>

      <div className="toolbar">
        <select value={month ?? d.month ?? ''} onChange={(e) => setMonth(e.target.value)}>
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
              className={cls === k && !manualOnly ? 'on' : ''}
              onClick={() => {
                setCls(k);
                setManualOnly(false);
              }}
            >
              {label}
            </button>
          ))}
          <button type="button" className={manualOnly ? 'on' : ''} onClick={() => setManualOnly((v) => !v)}>
            手動のみ
          </button>
        </span>
        <input
          type="text"
          placeholder="キーワード検索"
          value={qtext}
          onChange={(e) => setQtext(e.target.value)}
        />
      </div>

      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>日付</th>
              <th>内容</th>
              <th>大項目/中項目</th>
              <th>金額</th>
              <th>判定</th>
              <th>根拠</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <TxLine
                key={t.id}
                t={t}
                focused={i === focusIdx}
                onFocus={() => setFocusIdx(i)}
                onSet={(next) => setClass.mutate({ txId: t.id, next })}
              />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="empty">
                  該当する明細がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RulesCard />
    </>
  );
}

function TxLine({
  t,
  focused,
  onFocus,
  onSet,
}: {
  t: TxRow;
  focused: boolean;
  onFocus: () => void;
  onSet: (next: 'biz' | 'per' | null) => void;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボード操作はページ全体のJ/K/B/P/Aハンドラで提供
    <tr className={focused ? 'kbd-focus' : ''} onClick={onFocus}>
      <td className="num">{t.date}</td>
      <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t.description}
      </td>
      <td>
        {t.big}
        {t.mid ? ` / ${t.mid}` : ''}
      </td>
      <td className={`num ${t.amount < 0 ? '' : ''}`}>{yenS(t.amount)}</td>
      <td>
        <span className={`pill ${t.cls}`}>{t.cls === 'biz' ? '事業' : '個人'}</span>
      </td>
      <td>
        <span className="pill neutral">{t.src}</span>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className={`mini ${t.cls === 'per' && t.src === '手動' ? 'on-per' : ''}`}
          onClick={() => onSet('per')}
        >
          個人
        </button>{' '}
        <button
          type="button"
          className={`mini ${t.cls === 'biz' && t.src === '手動' ? 'on-biz' : ''}`}
          onClick={() => onSet('biz')}
        >
          事業
        </button>{' '}
        <button type="button" className="mini" disabled={t.src !== '手動'} onClick={() => onSet(null)}>
          自動
        </button>
      </td>
    </tr>
  );
}

function RulesCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['rules'],
    queryFn: () => api<{ rules: RuleRow[]; usingDefaults: boolean }>('/rules'),
  });
  const [keyword, setKeyword] = useState('');
  const [ruleCls, setRuleCls] = useState<'biz' | 'per'>('biz');
  const [top, setTop] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['rules'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };
  const add = useMutation({
    mutationFn: () => api('/rules', { method: 'POST', body: JSON.stringify({ keyword, cls: ruleCls, top }) }),
    onSuccess: () => {
      setKeyword('');
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/rules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const move = useMutation({
    mutationFn: (order: number[]) => api('/rules', { method: 'PATCH', body: JSON.stringify({ order }) }),
    onSuccess: invalidate,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) add.mutate();
  };

  const rules = q.data?.rules ?? [];
  const reorder = (i: number, dir: -1 | 1) => {
    const order = rules.map((r) => r.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    move.mutate(order);
  };

  return (
    <div className="card">
      <h2>仕分けルール(上から先勝ちで評価)</h2>
      {q.data?.usingDefaults && (
        <p className="sub">現在はHTML版の既定ルールを使用中。追加すると編集可能になります。</p>
      )}
      <form onSubmit={submit} className="toolbar">
        <input
          type="text"
          placeholder="キーワード(内容/大項目/中項目に部分一致)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 280 }}
        />
        <select value={ruleCls} onChange={(e) => setRuleCls(e.target.value as 'biz' | 'per')}>
          <option value="biz">事業</option>
          <option value="per">個人</option>
        </select>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} /> 最優先に追加
        </label>
        <button type="submit" className="primary" disabled={!keyword.trim() || add.isPending}>
          追加
        </button>
      </form>
      <table className="data">
        <thead>
          <tr>
            <th>優先</th>
            <th>キーワード</th>
            <th>判定</th>
            <th>影響件数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={r.id}>
              <td className="num">{i + 1}</td>
              <td>{r.keyword}</td>
              <td>
                <span className={`pill ${r.cls}`}>{r.cls === 'biz' ? '事業' : '個人'}</span>
              </td>
              <td className="num">{r.hits}件</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="mini" onClick={() => reorder(i, -1)} disabled={i === 0}>
                  ↑
                </button>{' '}
                <button
                  type="button"
                  className="mini"
                  onClick={() => reorder(i, 1)}
                  disabled={i === rules.length - 1}
                >
                  ↓
                </button>{' '}
                <button type="button" className="mini danger-btn" onClick={() => del.mutate(r.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
          {!rules.length && !q.data?.usingDefaults && (
            <tr>
              <td colSpan={5} className="empty">
                ルールがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
