/**
 * 現金の記帳: 口座・カード明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として残す。
 * 事業分は freee 仕訳と同じ経路で科目別集計に、家計分は口座「現金」の明細として家計集計に反映される。
 * CSV/Excel の再取込では消えない(取込値とは別に保管する)。
 */
import {
  TRANSIT_CATEGORY,
  TRANSIT_SAME_ACCOUNT_NOTE,
  type TransitInput,
  buildTransitEntry,
  cashTxId,
  missingReceiptSeverity,
  receiptStatus,
  shouldSwitchToTransit,
  transitInputError,
} from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, Fragment, useState } from 'react';
import {
  type CashDealDuplicate,
  type CashEntriesResponse,
  type CashEntry,
  type CashEntryBody,
  type Cls,
  SCOPE_SHORT,
  api,
} from '../api.js';
import {
  AttachmentDisclosureCell,
  AttachmentDisclosureRow,
  useAttachmentDisclosure,
} from '../components/Attachments.js';
import { CategoryPicker } from '../components/CategoryPicker.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { HowTo } from '../components/HowTo.js';
import { PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
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
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
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
  transitFrom: e.transitFrom,
  transitTo: e.transitTo,
  transitRound: e.transitRound,
  receiptWaived: e.receiptWaived,
});

export type CashEntryMode = 'normal' | 'transit';

export const transitInputFromCashBody = (body: CashEntryBody): TransitInput => ({
  from: body.transitFrom ?? '',
  to: body.transitTo ?? '',
  oneWayAmount: body.transitRound ? body.amount / 2 : body.amount,
  round: body.transitRound,
});

export function setCashTransitInput(body: CashEntryBody, transit: TransitInput): CashEntryBody {
  const built = buildTransitEntry(transit);
  return {
    ...body,
    io: 'expense',
    amount: built.amount,
    description: built.description,
    transitFrom: transit.from,
    transitTo: transit.to,
    transitRound: transit.round,
    receiptWaived: true,
  };
}

export function changeCashEntryMode(body: CashEntryBody, mode: CashEntryMode): CashEntryBody {
  const currentMode: CashEntryMode =
    body.transitFrom !== null || body.transitTo !== null ? 'transit' : 'normal';
  if (currentMode === mode) return body;
  if (mode === 'transit') {
    return {
      ...body,
      io: 'expense',
      amount: 0,
      description: '',
      big: body.side === 'biz' ? TRANSIT_CATEGORY : '',
      mid: '',
      transitFrom: '',
      transitTo: '',
      transitRound: true,
      receiptWaived: true,
    };
  }
  return {
    ...body,
    amount: 0,
    description: '',
    transitFrom: null,
    transitTo: null,
    transitRound: false,
    receiptWaived: false,
  };
}

export const cashEntryMode = (body: CashEntryBody): CashEntryMode =>
  body.transitFrom !== null || body.transitTo !== null ? 'transit' : 'normal';

export const resetCashEntryAfterCreate = (body: CashEntryBody): CashEntryBody => ({
  ...body,
  amount: 0,
  description: '',
  big: '',
  mid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
});

const canSubmit = (b: CashEntryBody, mode: CashEntryMode): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
  b.amount > 0 &&
  b.description.trim().length > 0 &&
  b.big.trim().length > 0 &&
  (mode === 'normal' || transitInputError(transitInputFromCashBody(b)) === null);

/** 追加と編集で同じ入力作法(1組)を使う */
function EntryFields({
  value,
  onChange,
  onModeChange,
  candidates,
}: {
  value: CashEntryBody;
  onChange: (v: CashEntryBody) => void;
  onModeChange: (mode: CashEntryMode) => void;
  candidates: CashEntriesResponse['candidates'];
}) {
  const set = (patch: Partial<CashEntryBody>) => onChange({ ...value, ...patch });
  // 交通費の科目を選んだら、区間から金額を組み立てられる入力に寄せる。
  // ただし内容や金額を入れたあとは勝手に捨てず、切り替えるかどうかを本人に選ばせる。
  const setCategory = (v: { big: string; mid: string }) => {
    if (shouldSwitchToTransit(v.big, value)) {
      onModeChange('transit');
      return;
    }
    set(v);
  };
  const offerTransit = value.big.trim() === TRANSIT_CATEGORY;
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
      <CategoryPicker
        candidates={candidates}
        scope={value.side}
        big={value.big}
        mid={value.mid}
        onChange={setCategory}
        placeholderBig={value.side === 'biz' ? '勘定科目を選ぶ' : '大項目を選ぶ'}
        placeholderMid="中項目(任意)"
        hintText={value.description}
      />
      {offerTransit && (
        <span className="sub transit-offer" style={{ margin: 0 }}>
          {TRANSIT_SAME_ACCOUNT_NOTE}
          <br />
          区間と片道運賃から金額を組み立てるなら、
          <button type="button" className="mini linklike" onClick={() => onModeChange('transit')}>
            交通費(電車代)の入力に切り替える
          </button>
        </span>
      )}
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

/**
 * 交通費の新規・編集で共用する入力。CashEntryBodyを1つの正本とし、
 * 区間と片道運賃から同じsetCashTransitInputで金額・内容・metadataを導出する。
 */
function TransitFields({
  value,
  onChange,
  candidates,
}: {
  value: CashEntryBody;
  onChange: (body: CashEntryBody) => void;
  candidates: CashEntriesResponse['candidates'];
}) {
  const t = transitInputFromCashBody(value);
  const setTransit = (patch: Partial<TransitInput>) =>
    onChange(setCashTransitInput(value, { ...t, ...patch }));
  const setBody = (patch: Partial<CashEntryBody>) => onChange({ ...value, ...patch });
  const error = transitInputError(t);
  const built = buildTransitEntry(t);

  return (
    <>
      <input
        type="date"
        value={value.date}
        onChange={(e) => setBody({ date: e.target.value })}
        aria-label="日付"
        required
      />
      <select
        value={value.side}
        onChange={(e) => {
          const v = e.target.value as Cls;
          setBody({ side: v, big: v === 'biz' ? TRANSIT_CATEGORY : '', mid: '' });
        }}
        aria-label="事業か家計か"
      >
        <option value="biz">事業</option>
        <option value="per">家計</option>
      </select>
      <input
        type="text"
        placeholder="出発(例: 名古屋)"
        aria-label="出発地"
        maxLength={40}
        value={t.from}
        onChange={(e) => setTransit({ from: e.target.value })}
        style={{ width: 140 }}
      />
      <span aria-hidden="true">→</span>
      <input
        type="text"
        placeholder="到着(例: 金山)"
        aria-label="到着地"
        maxLength={40}
        value={t.to}
        onChange={(e) => setTransit({ to: e.target.value })}
        style={{ width: 140 }}
      />
      <input
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        placeholder="片道(円)"
        aria-label="片道の運賃(円)"
        value={t.oneWayAmount || ''}
        onChange={(e) => setTransit({ oneWayAmount: Math.floor(Number(e.target.value) || 0) })}
        style={{ width: 110 }}
      />
      <label className="check">
        <input type="checkbox" checked={t.round} onChange={(e) => setTransit({ round: e.target.checked })} />
        往復
      </label>
      <CategoryPicker
        candidates={candidates}
        scope={value.side}
        big={value.big}
        mid={value.mid}
        onChange={setBody}
        placeholderBig={value.side === 'biz' ? '勘定科目を選ぶ' : '大項目を選ぶ'}
        placeholderMid="中項目(任意)"
      />
      <span className="sub" style={{ margin: 0 }}>
        {error ?? `${built.description} / ${yen(built.amount)}`}
      </span>
      <span className="sub" style={{ margin: 0 }}>
        電車代は
        <Term id="voucher" />
        (領収書)が出ないため「証憑不要」で記帳します。
        <br />
        {TRANSIT_SAME_ACCOUNT_NOTE}
      </span>
    </>
  );
}

function EntryModeTabs({
  mode,
  onChange,
}: {
  mode: CashEntryMode;
  onChange: (mode: CashEntryMode) => void;
}) {
  return (
    <span className="segment" role="tablist" aria-label="記帳の種類">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'normal'}
        className={mode === 'normal' ? 'on' : ''}
        onClick={() => {
          if (mode !== 'normal') onChange('normal');
        }}
      >
        通常の記帳
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'transit'}
        className={mode === 'transit' ? 'on' : ''}
        onClick={() => {
          if (mode !== 'transit') onChange('transit');
        }}
      >
        交通費(電車代)
      </button>
    </span>
  );
}

function CashEntryInputs({
  mode,
  value,
  onChange,
  onModeChange,
  candidates,
}: {
  mode: CashEntryMode;
  value: CashEntryBody;
  onChange: (body: CashEntryBody) => void;
  onModeChange: (mode: CashEntryMode) => void;
  candidates: CashEntriesResponse['candidates'];
}) {
  return (
    <>
      <EntryModeTabs mode={mode} onChange={onModeChange} />
      {mode === 'normal' ? (
        <EntryFields value={value} onChange={onChange} onModeChange={onModeChange} candidates={candidates} />
      ) : (
        <TransitFields value={value} onChange={onChange} candidates={candidates} />
      )}
    </>
  );
}

const prepareCashEntry = (body: CashEntryBody, mode: CashEntryMode): CashEntryBody => {
  if (mode === 'normal') {
    return {
      ...body,
      description: body.description.trim(),
      transitFrom: null,
      transitTo: null,
      transitRound: false,
      receiptWaived: false,
    };
  }
  const transit = transitInputFromCashBody(body);
  return setCashTransitInput(body, { ...transit, from: transit.from.trim(), to: transit.to.trim() });
};

/**
 * 二重計上の疑い(現金の記帳 × freee 仕訳)の知らせ。
 * 自動で消し込みはしない。同じ日に同科目・同額の支払いが本当に2件あることがあるため、
 * 「どちらを残すか」は人が決める前提で、突合できた仕訳の中身をそのまま並べる。
 */
export function CashDuplicateNotice({
  duplicates,
  entries,
}: {
  duplicates: CashDealDuplicate[];
  entries: CashEntry[];
}) {
  if (!duplicates.length) return null;
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (
    <div className="card cash-duplicates" style={{ marginTop: 16 }}>
      <h2>
        <Term id="doubleCount" />
        の疑い {duplicates.length}件
      </h2>
      <p className="sub">
        現金で記帳した支払いと同じ内容の仕訳が freee 側にもあります。現金払いを後から freee
        にも登録すると、同じ支払いが経費として2回数えられます。どちらか一方だけを残してください(この画面は数え直しません)。
      </p>
      <ul>
        {duplicates.map((d) => {
          const e = byId.get(d.cashEntryId);
          if (!e) return null;
          return (
            <li key={`${d.cashEntryId}-${d.deal.date}-${d.deal.partner}-${d.deal.amount}`}>
              <span className={`pill ${d.confidence === 'same_day' ? 'warn' : 'neutral'}`}>
                {d.confidence === 'same_day' ? '同日' : `${d.dayGap}日ちがい`}
              </span>{' '}
              現金の記帳「{e.description}」({d.cashDate} / {e.categoryMajor} / {yen(e.amount)}) と、freee
              の仕訳「{d.deal.partner}」({d.deal.date} / {d.deal.accountNorm} / {yen(d.deal.amount)})
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CashPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['cash-entries'],
    queryFn: () => api<CashEntriesResponse>('/cash-entries'),
  });
  const [draft, setDraft] = useState<CashEntryBody>(emptyBody);
  const [editing, setEditing] = useState<{
    id: number;
    body: CashEntryBody;
    mode: CashEntryMode;
  } | null>(null);
  const [month, setMonth] = useState<string>('');
  const [mode, setMode] = useState<CashEntryMode>('normal');
  const attachments = useAttachmentDisclosure();

  // 集計は全ページに波及するため、変更後はすべて読み直す
  const refreshAll = () => void qc.invalidateQueries();

  const add = useMutation({
    mutationFn: (body: CashEntryBody) => api('/cash-entries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      // 日付と区分は残すが、証憑不要と交通費metadataは次の記帳へ持ち越さない。
      setDraft(resetCashEntryAfterCreate);
      setMode('normal');
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
    if (canSubmit(draft, mode)) add.mutate(prepareCashEntry(draft, mode));
  };

  if (q.isLoading) return <PageState status="loading" />;
  if (q.isError || !q.data) return <PageState status="error" error={q.error} />;
  const { candidates, entries } = q.data;
  const months = [...new Set(entries.map((e) => e.month))].sort().reverse();
  const shown = month ? entries.filter((e) => e.month === month) : entries;
  // 疑いも表と同じ月で絞る(表に無い行の警告だけが残ると探せない)
  const shownIds = new Set(shown.map((e) => e.id));
  const duplicates = (q.data.duplicates ?? []).filter((d) => shownIds.has(d.cashEntryId));
  const duplicateIds = new Set(duplicates.map((d) => d.cashEntryId));
  // 標準科目は常に並ぶので「候補ゼロ」は起きない。実績が1件も無い状態を知らせる
  const noBizCandidates = !candidates.biz.some((m) => m.source === 'freee' || m.source === 'custom');

  return (
    <>
      <PageHeader route="cash" />

      <div className="card">
        <h2>
          現金の<Term id="journalize">記帳</Term>を追加
        </h2>
        <p className="sub lines">
          事業は freee の<Term id="account" />
          と確定申告の標準科目から選びます。
          <br />
          家計は MF の大項目/中項目と生活の標準費目から選びます。
          <br />
          科目は「分類 → 科目」の2クリック。選ぶ前に基準と例が出ます。
          <br />
          事業分は科目別の集計へ、家計分は口座「現金」の明細へ入ります。
        </p>
        {noBizCandidates && draft.side === 'biz' && (
          <div className="notice info lines">
            freee 仕訳が未取込のため、標準科目だけが出ています。
            <br />
            「データ取込」で仕訳を入れると、使った科目が先頭に並びます。
          </div>
        )}
        <form onSubmit={submit} className="toolbar">
          <CashEntryInputs
            mode={mode}
            value={draft}
            onChange={setDraft}
            onModeChange={(nextMode) => {
              setDraft((current) => changeCashEntryMode(current, nextMode));
              setMode(nextMode);
            }}
            candidates={candidates}
          />
          <button type="submit" className="primary" disabled={!canSubmit(draft, mode) || add.isPending}>
            {add.isPending ? '記帳中…' : '記帳する'}
          </button>
        </form>
        {add.isError && (
          <div className="notice" role="alert">
            記帳できませんでした: {(add.error as Error).message}
          </div>
        )}
      </div>

      <CashDuplicateNotice duplicates={duplicates} entries={shown} />

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
        <HowTo id="cashLedger" />
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
          <DataTable
            columns={[
              '日付',
              '区分',
              '内容・支払先',
              '科目',
              '金額',
              'メモ',
              termColumn('voucher'),
              { label: '操作', sortable: false },
            ]}
          >
            {shown.map((e) =>
              editing?.id === e.id ? (
                <tr key={e.id} className="editor">
                  <td colSpan={8}>
                    <div className="editor-form">
                      <CashEntryInputs
                        mode={editing.mode}
                        value={editing.body}
                        onChange={(body) => setEditing({ ...editing, body })}
                        onModeChange={(nextMode) =>
                          setEditing({
                            ...editing,
                            mode: nextMode,
                            body: changeCashEntryMode(editing.body, nextMode),
                          })
                        }
                        candidates={candidates}
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={!canSubmit(editing.body, editing.mode) || update.isPending}
                        onClick={() =>
                          update.mutate({
                            id: e.id,
                            body: prepareCashEntry(editing.body, editing.mode),
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
                <Fragment key={e.id}>
                  <tr>
                    <td className="num">{e.date}</td>
                    <td>
                      <span className={`pill ${e.side === 'biz' ? 'biz' : 'per'}`}>
                        {SCOPE_SHORT[e.side]}
                      </span>
                    </td>
                    <td>
                      {e.description}
                      {duplicateIds.has(e.id) && (
                        <>
                          {' '}
                          <span
                            className="pill warn"
                            title="同じ支払いが freee の仕訳にもある疑いがあります。上の知らせを確認してください"
                          >
                            二重計上の疑い
                          </span>
                        </>
                      )}
                    </td>
                    <td>{e.categoryMid ? `${e.categoryMajor} / ${e.categoryMid}` : e.categoryMajor}</td>
                    <td className="num">
                      {e.io === 'income' ? '+' : '-'}
                      {yen(e.amount)}
                    </td>
                    <td>{e.memo ?? ''}</td>
                    <td>
                      <AttachmentDisclosureCell
                        targetId={cashTxId(e.id)}
                        status={receiptStatus(e, e.attachmentCount)}
                        count={e.attachmentCount}
                        severity={missingReceiptSeverity(e)}
                        disclosure={attachments}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mini"
                        onClick={() => {
                          const body = toBody(e);
                          setEditing({ id: e.id, body, mode: cashEntryMode(body) });
                        }}
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
                  <AttachmentDisclosureRow
                    targetId={cashTxId(e.id)}
                    colSpan={8}
                    disclosure={attachments}
                    onChanged={() => void qc.invalidateQueries({ queryKey: ['cash-entries'] })}
                  />
                </Fragment>
              ),
            )}
            {!shown.length && (
              <tr>
                <td colSpan={8} className="empty">
                  {entries.length
                    ? 'この月の現金の記帳はありません。上の「すべての月」に戻すか、別の月を選んでください。'
                    : '現金の記帳はまだありません。口座やカードの明細に出ない現金の支払い(商工会議所の会議費など)を、上のフォームから追加してください。'}
                </td>
              </tr>
            )}
          </DataTable>
        </div>
      </div>
    </>
  );
}
