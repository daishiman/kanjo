/**
 * 現金の記帳: 口座・カード明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として残す。
 * 事業分は freee 仕訳と同じ経路で科目別集計に、家計分は口座「現金」の明細として家計集計に反映される。
 * CSV/Excel の再取込では消えない(取込値とは別に保管する)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import {
  type CashEntriesResponse,
  type CashEntry,
  type CashEntryBody,
  type Cls,
  SCOPE_SHORT,
  api,
} from '../api.js';
import { CategoryInputs } from '../components/ClassificationSettings.js';
import { PageHeader, PageState } from '../components/Page.js';
import { monthLabel, yen } from '../format.js';

const today = (): string => {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const emptyBody = (): CashEntryBody => ({
  date: today(),
  side: 'biz',
  io: 'expense',
  amount: 0,
  description: '',
  big: '',
  mid: '',
  memo: null,
});

const toBody = (e: CashEntry): CashEntryBody => ({
  date: e.date,
  side: e.side,
  io: e.io,
  amount: e.amount,
  description: e.description,
  big: e.categoryMajor,
  mid: e.categoryMid,
  memo: e.memo,
});

const canSubmit = (b: CashEntryBody): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
  b.amount > 0 &&
  b.description.trim().length > 0 &&
  b.big.trim().length > 0;

/** 追加と編集で同じ入力作法(1組)を使う */
function EntryFields({
  value,
  onChange,
  candidates,
}: {
  value: CashEntryBody;
  onChange: (v: CashEntryBody) => void;
  candidates: CashEntriesResponse['candidates'];
}) {
  const set = (patch: Partial<CashEntryBody>) => onChange({ ...value, ...patch });
  return (
    <>
      <input
        type="date"
        value={value.date}
        onChange={(e) => set({ date: e.target.value })}
        aria-label="日付"
        required
      />
      <select
        value={value.side}
        onChange={(e) => set({ side: e.target.value as Cls, big: '', mid: '' })}
        aria-label="事業か家計か"
      >
        <option value="biz">事業</option>
        <option value="per">家計</option>
      </select>
      <select
        value={value.io}
        onChange={(e) => set({ io: e.target.value as CashEntryBody['io'] })}
        aria-label="支出か収入か"
      >
        <option value="expense">支出</option>
        <option value="income">収入</option>
      </select>
      <input
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        placeholder="金額(円)"
        aria-label="金額(円)"
        value={value.amount || ''}
        onChange={(e) => set({ amount: Math.floor(Number(e.target.value) || 0) })}
        style={{ width: 120 }}
      />
      <input
        type="text"
        placeholder="内容・支払先(例: 〇〇商工会議所 定例会)"
        aria-label="内容・支払先"
        maxLength={60}
        value={value.description}
        onChange={(e) => set({ description: e.target.value })}
        style={{ width: 260 }}
      />
      <CategoryInputs
        candidates={candidates}
        scope={value.side}
        big={value.big}
        mid={value.mid}
        onChange={(v) => set(v)}
        placeholderBig={value.side === 'biz' ? '勘定科目を選ぶ' : '大項目を選ぶ'}
        placeholderMid="中項目(任意)"
      />
      <input
        type="text"
        placeholder="メモ(任意)"
        aria-label="メモ"
        maxLength={200}
        value={value.memo ?? ''}
        onChange={(e) => set({ memo: e.target.value || null })}
        style={{ width: 160 }}
      />
    </>
  );
}

export function CashPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['cash-entries'],
    queryFn: () => api<CashEntriesResponse>('/cash-entries'),
  });
  const [draft, setDraft] = useState<CashEntryBody>(emptyBody);
  const [editing, setEditing] = useState<{ id: number; body: CashEntryBody } | null>(null);
  const [month, setMonth] = useState<string>('');

  // 集計は全ページに波及するため、変更後はすべて読み直す
  const refreshAll = () => void qc.invalidateQueries();

  const add = useMutation({
    mutationFn: (body: CashEntryBody) => api('/cash-entries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      // 続けて記帳しやすいよう日付と区分は残し、金額・内容・科目だけ空にする
      setDraft((d) => ({ ...d, amount: 0, description: '', big: '', mid: '', memo: null }));
      refreshAll();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CashEntryBody }) =>
      api(`/cash-entries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setEditing(null);
      refreshAll();
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/cash-entries/${id}`, { method: 'DELETE' }),
    onSuccess: refreshAll,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit(draft)) add.mutate({ ...draft, description: draft.description.trim() });
  };

  if (q.isLoading) return <PageState status="loading" />;
  if (q.isError || !q.data) return <PageState status="error" error={q.error} />;
  const { candidates, entries } = q.data;
  const months = [...new Set(entries.map((e) => e.month))].sort().reverse();
  const shown = month ? entries.filter((e) => e.month === month) : entries;
  const noBizCandidates = candidates.biz.length === 0;

  return (
    <>
      <PageHeader route="cash" />

      <div className="card">
        <h2>現金の記帳を追加</h2>
        <p className="sub">
          事業の支払いは freee の勘定科目で、家計の支払いは MF
          の大項目/中項目で記帳します。事業分は科目別の集計と統計診断に、家計分は口座「現金」の明細として公私仕分けと家計に反映されます。
        </p>
        {noBizCandidates && draft.side === 'biz' && (
          <div className="notice info">
            事業の勘定科目の候補がまだありません。先に「データ取込」で freee
            仕訳を取り込むと候補が揃います。取込前でも「候補にない科目を追加」から科目を登録すれば記帳できます。
          </div>
        )}
        <form onSubmit={submit} className="toolbar">
          <EntryFields value={draft} onChange={setDraft} candidates={candidates} />
          <button type="submit" className="primary" disabled={!canSubmit(draft) || add.isPending}>
            {add.isPending ? '記帳中…' : '記帳する'}
          </button>
        </form>
        {add.isError && (
          <div className="notice" role="alert">
            記帳できませんでした: {(add.error as Error).message}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>記帳した現金の明細</h2>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="月で絞る">
            <option value="">すべての月</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <span className="sub" style={{ margin: 0 }}>
            {shown.length}件
          </span>
        </div>
        {update.isError && (
          <div className="notice" role="alert">
            変更を保存できませんでした: {(update.error as Error).message}
          </div>
        )}
        {del.isError && (
          <div className="notice" role="alert">
            削除できませんでした: {(del.error as Error).message}
          </div>
        )}
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>日付</th>
                <th>区分</th>
                <th>内容・支払先</th>
                <th>科目</th>
                <th>金額</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) =>
                editing?.id === e.id ? (
                  <tr key={e.id} className="editor">
                    <td colSpan={7}>
                      <div className="editor-form">
                        <EntryFields
                          value={editing.body}
                          onChange={(body) => setEditing({ id: e.id, body })}
                          candidates={candidates}
                        />
                        <button
                          type="button"
                          className="primary"
                          disabled={!canSubmit(editing.body) || update.isPending}
                          onClick={() =>
                            update.mutate({
                              id: e.id,
                              body: { ...editing.body, description: editing.body.description.trim() },
                            })
                          }
                        >
                          保存
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id}>
                    <td className="num">{e.date}</td>
                    <td>
                      <span className={`pill ${e.side === 'biz' ? 'biz' : 'per'}`}>
                        {SCOPE_SHORT[e.side]}
                      </span>
                    </td>
                    <td>{e.description}</td>
                    <td>{e.categoryMid ? `${e.categoryMajor} / ${e.categoryMid}` : e.categoryMajor}</td>
                    <td className="num">
                      {e.io === 'income' ? '+' : '-'}
                      {yen(e.amount)}
                    </td>
                    <td>{e.memo ?? ''}</td>
                    <td>
                      <button
                        type="button"
                        className="mini"
                        onClick={() => setEditing({ id: e.id, body: toBody(e) })}
                      >
                        編集
                      </button>{' '}
                      <button
                        type="button"
                        className="mini"
                        disabled={del.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${e.date} の「${e.description}」(${yen(e.amount)})を削除しますか?`,
                            )
                          )
                            del.mutate(e.id);
                        }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {!shown.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    {entries.length
                      ? 'この月の現金の記帳はありません。上の「すべての月」に戻すか、別の月を選んでください。'
                      : '現金の記帳はまだありません。口座やカードの明細に出ない現金の支払い(商工会議所の会議費など)を、上のフォームから追加してください。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
